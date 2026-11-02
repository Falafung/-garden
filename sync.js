/* สมุดสวน — ซิงก์ข้อมูลทุกเครื่องด้วย Firebase (ล็อกอิน Google) + สำรอง/ส่งออกไป Google Drive
 * ข้อมูลเก็บที่ Firestore: users/{uid}/records/{คอลเลกชัน~id} หนึ่งเอกสารต่อหนึ่งรายการ
 * ถ้ายังไม่ได้ตั้งค่า Firebase แอปจะทำงานแบบเก็บในเครื่องเหมือนเดิม
 */
const FB_VER = '10.12.2';
const CFG_KEY = 'suan-firebase-config';
const LINK_KEY = 'suan-sync-uid';
const DRIVE_TOKEN_KEY = 'suan-drive-token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'สมุดสวน';
const COLLS = ['plots', 'activities', 'finance', 'harvests', 'stock', 'journal', 'knowledge'];
const LOCAL_ONLY_SETTINGS = ['theme', 'browserNotify'];
const SETUP_GUIDE = 'https://github.com/Falafung/-garden/blob/main/SETUP-FIREBASE.md';

// ---------- ฟังก์ชันจัดการข้อมูล (ไม่ขึ้นกับ Firebase) ----------
export function toRecords(db) {
  const m = new Map();
  const st = { ...(db.settings || {}) };
  LOCAL_ONLY_SETTINGS.forEach(k => delete st[k]);
  m.set('settings~main', JSON.stringify(st));
  for (const c of COLLS) for (const it of db[c] || []) if (it && it.id) m.set(`${c}~${it.id}`, JSON.stringify(it));
  return m;
}
export function fromRecords(map) {
  const db = { settings: {} };
  COLLS.forEach(c => { db[c] = []; });
  for (const [k, v] of map) {
    const i = k.indexOf('~'), c = k.slice(0, i);
    let val; try { val = JSON.parse(v); } catch { continue; }
    if (c === 'settings') db.settings = val;
    else if (db[c]) db[c].push(val);
  }
  return db;
}
export function diff(a, b) {
  const sets = [], dels = [];
  for (const [k, v] of b) if (a.get(k) !== v) sets.push([k, v]);
  for (const k of a.keys()) if (!b.has(k)) dels.push(k);
  return { sets, dels };
}
export function applyDiff(map, { sets, dels }) {
  const out = new Map(map);
  dels.forEach(k => out.delete(k));
  sets.forEach(([k, v]) => out.set(k, v));
  return out;
}
export function mapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}
// รวมข้อมูลสองชุด: ถ้า id ซ้ำ ใช้ของคลาวด์ · คลังความรู้ตั้งต้นที่ชื่อซ้ำกันจะไม่ซ้ำซ้อน
export function mergeDb(local, cloud) {
  const out = { settings: { ...(local.settings || {}) } };
  for (const [k, v] of Object.entries(cloud.settings || {})) if (v !== null && v !== '' && v !== undefined) out.settings[k] = v;
  for (const c of COLLS) {
    const byId = new Map();
    (local[c] || []).forEach(x => byId.set(x.id, x));
    (cloud[c] || []).forEach(x => byId.set(x.id, x));
    let arr = [...byId.values()];
    if (c === 'knowledge') {
      const seen = new Set(), cloudTitles = new Set((cloud.knowledge || []).map(k => k.title));
      arr = arr.filter(k => {
        const fromLocalOnly = !(cloud.knowledge || []).some(x => x.id === k.id);
        if (fromLocalOnly && cloudTitles.has(k.title)) return false;
        if (seen.has(k.id)) return false;
        seen.add(k.id); return true;
      });
    }
    out[c] = arr;
  }
  return out;
}
// ลายนิ้วมือของข้อมูลที่ซิงก์ล่าสุด (เก็บในเครื่อง) ใช้แยกว่าอะไรถูกแก้ในเครื่องนี้ตอนออฟไลน์
export function hashStr(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
export function localChanges(baseHashes, localMap) {
  const sets = [], dels = [];
  for (const [k, v] of localMap) if (baseHashes[k] !== hashStr(v)) sets.push([k, v]);
  for (const k of Object.keys(baseHashes)) if (!localMap.has(k)) dels.push(k);
  return { sets, dels };
}
function hasUserData(db) { return ['plots', 'activities', 'finance', 'harvests', 'stock', 'journal'].some(c => (db[c] || []).length); }

// ---------- ค่าตั้งค่า ----------
export function parseConfig(text) {
  text = String(text || '').trim();
  if (!text) return null;
  let cfg = null;
  try { cfg = JSON.parse(text); } catch {
    cfg = {};
    for (const m of text.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g)) cfg[m[1]] = m[2];
  }
  return cfg && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId ? cfg : null;
}
function getConfig() {
  if (window.SUAN_FIREBASE_CONFIG?.apiKey) return { cfg: window.SUAN_FIREBASE_CONFIG, from: 'file' };
  try { const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); if (c?.apiKey) return { cfg: c, from: 'local' }; } catch { /* ไม่มี */ }
  return { cfg: null, from: null };
}

// ---------- สถานะ ----------
const S = {
  fb: null, app: null, auth: null, db: null, user: null,
  state: 'off', // off | loading | signedout | connecting | synced | syncing | offline | error
  error: '', base: new Map(), unacked: new Map(), ready: false, unsub: null, timer: null, lastSync: null,
  drive: { busy: false, msg: '', link: '' },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = s => window.toast?.(s) ?? console.log(s);
function rerender() { if (!document.getElementById('modal')?.open) window.render?.(); updateBadge(); }
function setState(st, err = '') { S.state = st; S.error = err; updateBadge(); }
function updateBadge() {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  const map = {
    synced: ['☁️✓', 'ซิงก์แล้ว', 'good'], syncing: ['☁️…', 'กำลังซิงก์', ''], connecting: ['☁️…', 'กำลังเชื่อมต่อ', ''],
    offline: ['☁️⚠', 'ออฟไลน์ — จะซิงก์เมื่อมีอินเทอร์เน็ต', 'warn'], error: ['☁️✕', 'ซิงก์มีปัญหา — ดูที่ตั้งค่า', 'bad'],
  };
  const m = map[S.state];
  el.innerHTML = m ? `<a href="#settings" class="sync-badge ${m[2]}" title="${esc(m[1])}">${m[0]}</a>` : '';
}
function fbError(e) {
  const c = e?.code || '';
  if (c.includes('unauthorized-domain')) return `โดเมนนี้ (${location.hostname}) ยังไม่ได้รับอนุญาต — เพิ่มใน Firebase → Authentication → Settings → Authorized domains`;
  if (c.includes('operation-not-allowed')) return 'ยังไม่ได้เปิดการล็อกอินด้วย Google — เปิดใน Firebase → Authentication → Sign-in method → Google';
  if (c.includes('popup-blocked')) return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน — อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วกดใหม่';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'ปิดหน้าต่างล็อกอินก่อนเสร็จ';
  if (c.includes('permission-denied')) return 'ไม่มีสิทธิ์อ่าน/เขียนข้อมูล — ตรวจ Firestore Rules ตามคู่มือ';
  if (c.includes('invalid-api-key') || c.includes('api-key-not-valid')) return 'ค่า apiKey ไม่ถูกต้อง — ตรวจค่าตั้งค่า Firebase';
  if (c.includes('network')) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
  return (e?.message || String(e)).replace(/^Firebase:\s*/, '');
}

// ---------- เริ่มต้น Firebase ----------
async function init() {
  const { cfg } = getConfig();
  if (!cfg) { setState('off'); rerender(); return; }
  setState('loading');
  try {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
    const [appM, authM, fsM] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
    S.fb = { ...appM, ...authM, ...fsM };
    S.app = S.fb.initializeApp(cfg);
    S.auth = S.fb.getAuth(S.app);
    try {
      S.db = S.fb.initializeFirestore(S.app, { localCache: S.fb.persistentLocalCache({ tabManager: S.fb.persistentMultipleTabManager() }) });
    } catch {
      S.db = S.fb.initializeFirestore(S.app, { localCache: S.fb.memoryLocalCache() });
    }
    S.fb.onAuthStateChanged(S.auth, u => { u ? onSignedIn(u) : onSignedOut(); });
  } catch (e) {
    console.error(e);
    setState('error', 'โหลดระบบซิงก์ไม่สำเร็จ (ตรวจอินเทอร์เน็ตหรือค่าตั้งค่า): ' + fbError(e));
    rerender();
  }
}
function baseKey() { return `suan-sync-base-${S.user.uid}`; }
// S.base = สถานะที่เครื่องนี้ถือว่าตรงกับคลาวด์ (ใช้หาสิ่งที่แก้ใหม่)
// ลายนิ้วมือที่เก็บถาวร = เฉพาะสิ่งที่เซิร์ฟเวอร์ยืนยันแล้ว เพื่อไม่ให้ของที่แก้ตอนออฟไลน์หายเมื่อปิดแอปก่อนส่งสำเร็จ
function setBase(map) { S.base = map; }
function persistAcked(map) {
  const h = {}; for (const [k, v] of map) h[k] = hashStr(v);
  try { localStorage.setItem(baseKey(), JSON.stringify(h)); } catch { /* ไม่เป็นไร */ }
}
function ackOps(ops, uid) {
  if (!S.user || S.user.uid !== uid) return;
  const h = loadBaseHashes() || {};
  for (const [op, k, v] of ops) { if (op === 'set') h[k] = hashStr(v); else delete h[k]; }
  try { localStorage.setItem(baseKey(), JSON.stringify(h)); } catch { /* ไม่เป็นไร */ }
}
function loadBaseHashes() { try { return JSON.parse(localStorage.getItem(baseKey()) || 'null'); } catch { return null; } }
function recordsCol() { return S.fb.collection(S.db, 'users', S.user.uid, 'records'); }

async function onSignedIn(user) {
  S.user = user; S.ready = false;
  setState('connecting'); rerender();
  let remote;
  try {
    const snap = await S.fb.getDocsFromServer(recordsCol());
    remote = new Map(snap.docs.map(d => [d.id, d.data().v]));
  } catch (e) {
    if (localStorage.getItem(LINK_KEY) === user.uid) {
      try { const snap = await S.fb.getDocs(recordsCol()); remote = new Map(snap.docs.map(d => [d.id, d.data().v])); } catch { remote = null; }
    }
    if (!remote) { setState(navigator.onLine ? 'error' : 'offline', 'การเชื่อมครั้งแรกต้องใช้อินเทอร์เน็ต: ' + fbError(e)); rerender(); setTimeout(() => S.user && !S.ready && onSignedIn(S.user), 30000); return; }
  }
  const local = window.getDB();
  const localMap = toRecords(local);
  const linked = localStorage.getItem(LINK_KEY) === user.uid;
  try {
    if (linked) {
      // เครื่องนี้ซิงก์กับบัญชีนี้อยู่แล้ว: ส่งเฉพาะสิ่งที่แก้ในเครื่องนี้ตั้งแต่ซิงก์ครั้งก่อน แล้วรวมกับข้อมูลล่าสุดจากคลาวด์
      const baseH = loadBaseHashes();
      if (baseH) {
        const mine = localChanges(baseH, localMap);
        const merged = applyDiff(remote, mine);
        if (mine.sets.length || mine.dels.length) await writeDiff(mine);
        setBase(merged);
        adoptRemote(merged);
      } else {
        // ไม่มีข้อมูลการซิงก์ครั้งก่อน: รวมแบบไม่ลบอะไร
        const target = mergeDb(local, fromRecords(remote)), tMap = toRecords(target);
        await writeDiff({ sets: diff(remote, tMap).sets, dels: [] });
        setBase(applyDiff(remote, { sets: diff(remote, tMap).sets, dels: [] }));
        adoptRemote(S.base);
      }
    } else if (!remote.size) {
      await writeDiff(diff(new Map(), localMap));
      setBase(localMap);
      t('อัปโหลดข้อมูลเครื่องนี้ขึ้นคลาวด์แล้ว');
    } else if (!hasUserData(local)) {
      setBase(remote); adoptRemote(remote, true);
      t('ดึงข้อมูลจากคลาวด์มาที่เครื่องนี้แล้ว');
    } else {
      const choice = await askMerge(remote);
      if (!choice) { await signOutNow(); return; }
      setBase(remote);
      if (choice === 'cloud') adoptRemote(remote, true);
      else {
        const target = choice === 'merge' ? mergeDb(local, fromRecords(remote)) : local;
        const tMap = toRecords(target);
        await writeDiff(diff(remote, tMap));
        setBase(tMap);
        window.replaceDB(target);
      }
      t(choice === 'merge' ? 'รวมข้อมูลแล้ว' : choice === 'cloud' ? 'ใช้ข้อมูลจากคลาวด์แล้ว' : 'ใช้ข้อมูลเครื่องนี้แทนคลาวด์แล้ว');
    }
  } catch (e) { console.error(e); setState('error', fbError(e)); rerender(); return; }
  localStorage.setItem(LINK_KEY, user.uid);
  S.ready = true;
  listen();
  setState('synced'); S.lastSync = new Date(); rerender();
  maybeAutoBackup();
}
function adoptRemote(remote, force = false) {
  const local = window.getDB();
  if (force || !mapsEqual(toRecords(local), remote)) window.replaceDB(fromRecords(remote));
}
function listen() {
  S.unsub?.();
  S.unsub = S.fb.onSnapshot(recordsCol(), { includeMetadataChanges: true }, snap => {
    const serverView = new Map(snap.docs.map(d => [d.id, d.data().v]));
    // ใส่การแก้ของเครื่องนี้ที่เซิร์ฟเวอร์ยังไม่ยืนยันทับลงไป (กันข้อมูลที่บันทึกตอนออฟไลน์หาย)
    const remote = new Map(serverView);
    for (const [k, [op, v]] of S.unacked) { if (op === 'set') remote.set(k, v); else remote.delete(k); }
    // มีการแก้ในเครื่องที่ยังไม่ได้ส่ง → รวมเข้ากับข้อมูลล่าสุดจากคลาวด์ก่อน
    const localMap = toRecords(window.getDB());
    const mine = diff(S.base, localMap);
    let merged = remote;
    if (mine.sets.length || mine.dels.length) {
      merged = applyDiff(remote, mine);
      clearTimeout(S.timer); S.timer = null;
      writeDiff(mine).catch(e => { setState('error', fbError(e)); });
    }
    setBase(merged);
    if (!mapsEqual(localMap, merged)) window.replaceDB(fromRecords(merged));
    const pending = snap.metadata.hasPendingWrites, cached = snap.metadata.fromCache;
    if (!pending && !cached && !S.unacked.size && !mine.sets.length && !mine.dels.length) persistAcked(serverView);
    if (!navigator.onLine || (cached && pending)) setState('offline');
    else if (pending) setState('syncing');
    else { setState('synced'); S.lastSync = new Date(); }
    if (location.hash === '#settings' && !document.getElementById('modal')?.open) window.render?.();
  }, e => { console.error(e); setState('error', fbError(e)); rerender(); });
}
async function writeDiff({ sets, dels }) {
  const ops = [...sets.map(([k, v]) => ['set', k, v]), ...dels.map(k => ['del', k])];
  for (let i = 0; i < ops.length; i += 400) {
    const b = S.fb.writeBatch(S.db);
    for (const [op, k, v] of ops.slice(i, i + 400)) {
      const ref = S.fb.doc(S.db, 'users', S.user.uid, 'records', k);
      if (op === 'set') b.set(ref, { v, c: k.slice(0, k.indexOf('~')), t: S.fb.serverTimestamp() });
      else b.delete(ref);
    }
    // ไม่รอผลจากเซิร์ฟเวอร์ตอนออฟไลน์: Firestore เก็บคิวไว้และส่งเมื่อออนไลน์
    const batchOps = ops.slice(i, i + 400), uid = S.user.uid;
    const tags = batchOps.map(([op, k, v]) => { const tag = [op, v]; S.unacked.set(k, tag); return [k, tag]; });
    const p = b.commit().then(() => {
      ackOps(batchOps, uid);
      tags.forEach(([k, tag]) => { if (S.unacked.get(k) === tag) S.unacked.delete(k); });
    });
    if (navigator.onLine) await p; else p.catch(e => setState('error', fbError(e)));
  }
}
async function pushNow() {
  clearTimeout(S.timer); S.timer = null;
  if (!S.user) return;
  const cur = toRecords(window.getDB());
  const d = diff(S.base, cur);
  if (!d.sets.length && !d.dels.length) return;
  setBase(cur);
  setState(navigator.onLine ? 'syncing' : 'offline');
  try { await writeDiff(d); } catch (e) { console.error(e); setState('error', fbError(e)); rerender(); }
}
function push() {
  if (!S.ready || !S.user) return;
  clearTimeout(S.timer);
  S.timer = setTimeout(pushNow, 400);
}
function onSignedOut() {
  S.unsub?.(); S.unsub = null; S.user = null; S.ready = false; S.base = new Map(); S.unacked = new Map();
  setState('signedout'); rerender();
}
async function signOutNow() {
  await pushNow();
  sessionStorage.removeItem(DRIVE_TOKEN_KEY);
  localStorage.removeItem(LINK_KEY);
  await S.fb.signOut(S.auth);
}
function askMerge(remote) {
  const cloud = fromRecords(remote), local = window.getDB();
  const cnt = d => `${(d.plots || []).length} แปลง · ${(d.activities || []).length} งาน · ${(d.finance || []).length} รายการบัญชี · ${(d.journal || []).length} บันทึกสวน`;
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    let answered = false;
    const onClose = () => { modal.removeEventListener('close', onClose); if (!answered) resolve(null); };
    modal.addEventListener('close', onClose);
    window.openModal('มีข้อมูลทั้งในเครื่องนี้และบนคลาวด์', `
      <p class="small" style="margin-top:0">☁️ คลาวด์: ${cnt(cloud)}<br>📱 เครื่องนี้: ${cnt(local)}</p>
      <label class="field inline-check"><input type="radio" name="choice" value="merge" checked style="width:auto"> <span style="margin:0"><b>รวมข้อมูลทั้งสองที่</b> (แนะนำ) — ไม่มีอะไรหาย รายการเดียวกันใช้ฉบับบนคลาวด์</span></label>
      <label class="field inline-check"><input type="radio" name="choice" value="cloud" style="width:auto"> <span style="margin:0">ใช้ข้อมูลบนคลาวด์ (ข้อมูลในเครื่องนี้จะถูกแทนที่)</span></label>
      <label class="field inline-check"><input type="radio" name="choice" value="local" style="width:auto"> <span style="margin:0">ใช้ข้อมูลเครื่องนี้แทนคลาวด์ (ข้อมูลบนคลาวด์จะถูกแทนที่)</span></label>`,
      fd => { answered = true; resolve(fd.choice || 'merge'); }, 'ตกลง');
  });
}

// ---------- Google Drive ----------
function driveTokenCached() {
  try { const x = JSON.parse(sessionStorage.getItem(DRIVE_TOKEN_KEY) || 'null'); if (x && x.exp > Date.now() + 60000) return x.token; } catch { /* ไม่มี */ }
  return null;
}
async function driveToken(interactive) {
  const c = driveTokenCached();
  if (c || !interactive) return c;
  const prov = new S.fb.GoogleAuthProvider();
  prov.addScope(DRIVE_SCOPE);
  prov.setCustomParameters({ login_hint: S.user?.email || '' });
  const res = await S.fb.reauthenticateWithPopup(S.user, prov);
  const token = S.fb.GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error('ไม่ได้รับสิทธิ์เข้าถึง Google Drive');
  sessionStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60 * 1000 }));
  return token;
}
async function gapi(token, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (r.status === 401) { sessionStorage.removeItem(DRIVE_TOKEN_KEY); throw new Error('สิทธิ์ Google Drive หมดอายุ — กดอีกครั้งเพื่อเชื่อมใหม่'); }
  if (r.status === 403) {
    const j = await r.json().catch(() => ({}));
    const msg = j?.error?.message || '';
    throw new Error(/has not been used|disabled/i.test(msg) ? 'ยังไม่ได้เปิด Google Drive API ในโปรเจกต์ — ทำตามคู่มือข้อ 5' : 'Google Drive ไม่อนุญาต: ' + msg);
  }
  if (!r.ok) throw new Error(`Google Drive ตอบกลับ ${r.status}`);
  return r;
}
async function driveFolder(token) {
  const key = `suan-drive-folder-${S.user.uid}`;
  const cached = localStorage.getItem(key);
  if (cached) {
    try { const r = await gapi(token, `https://www.googleapis.com/drive/v3/files/${cached}?fields=id,trashed`); const j = await r.json(); if (!j.trashed) return cached; } catch (e) { if (/หมดอายุ|API/.test(e.message)) throw e; }
  }
  const q = `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await (await gapi(token, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json();
  let id = found.files?.[0]?.id;
  if (!id) {
    const r = await gapi(token, 'https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }) });
    id = (await r.json()).id;
  }
  localStorage.setItem(key, id);
  return id;
}
async function driveUpload(token, meta, content, contentType, fileId) {
  const boundary = 'suan' + Math.random().toString(36).slice(2);
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n${content}\r\n--${boundary}--`;
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
  const r = await gapi(token, url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return r.json();
}
async function driveAction(label, fn, interactive = true) {
  if (!S.user) return t('ล็อกอินก่อนใช้ Google Drive');
  let token;
  try { token = await driveToken(interactive); } catch (e) { S.drive.msg = '⚠️ ' + fbError(e); rerender(); return; }
  if (!token) return;
  S.drive.busy = true; S.drive.msg = label + '…'; S.drive.link = ''; rerender();
  try { await fn(token); } catch (e) { console.error(e); S.drive.msg = '⚠️ ' + (e.message || e); }
  S.drive.busy = false; rerender();
}
async function backup(token, silent = false) {
  const folder = await driveFolder(token);
  const name = `สมุดสวน-สำรอง-${window.todayStr()}.json`;
  const q = `name='${name}' and '${folder}' in parents and trashed=false`;
  const ex = await (await gapi(token, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json();
  const db = window.getDB();
  const f = await driveUpload(token, ex.files?.[0]?.id ? { name } : { name, parents: [folder], mimeType: 'application/json' }, JSON.stringify(db), 'application/json', ex.files?.[0]?.id);
  db.settings.lastDriveBackup = new Date().toISOString();
  window.save();
  S.drive.msg = `✅ สำรองแล้ว: ${name}`; S.drive.link = f.webViewLink || '';
  if (!silent) t('สำรองข้อมูลลง Google Drive แล้ว');
}
function maybeAutoBackup() {
  const last = window.getDB().settings.lastDriveBackup;
  if (driveTokenCached() && (!last || Date.now() - new Date(last).getTime() > 24 * 3600 * 1000)) driveAction('กำลังสำรองอัตโนมัติ', tk => backup(tk, true), false);
}
function ago(iso) {
  if (!iso) return 'ยังไม่เคย';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'เมื่อสักครู่'; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60); if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
}

// ---------- หน้าตั้งค่า ----------
function cardHtml() {
  const { cfg, from } = getConfig();
  const guide = `<a href="${SETUP_GUIDE}" target="_blank" rel="noopener">คู่มือตั้งค่า Firebase (ทำครั้งเดียว ~10 นาที)</a>`;
  if (!cfg) {
    return `<div class="card sync-card"><h2>☁️ ซิงก์ข้อมูลทุกเครื่อง</h2>
      <p class="small" style="margin-top:0">ตอนนี้ข้อมูลอยู่ในเครื่องนี้เท่านั้น เปิดซิงก์เพื่อให้มือถือ คอม และ iPad เห็นข้อมูลเดียวกัน โดยล็อกอินด้วยบัญชี Google</p>
      <p class="small">1) ทำตาม ${guide}<br>2) วางค่า <code>firebaseConfig</code> ที่ได้ลงในช่องนี้ แล้วกดบันทึก</p>
      <textarea id="fbCfg" placeholder='const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};' style="min-height:120px;font-family:monospace;font-size:.8rem"></textarea>
      <div class="row" style="margin-top:.5rem"><button class="btn primary" onclick="SYNC.saveConfig(document.getElementById('fbCfg').value)">บันทึกค่าตั้งค่า</button></div></div>`;
  }
  const s = S.state;
  let body = '';
  if (s === 'loading') body = '<p class="muted">กำลังโหลดระบบซิงก์…</p>';
  else if (s === 'error' && !S.user) body = `<div class="advice bad"><b>เชื่อมต่อไม่สำเร็จ</b><div class="small">${esc(S.error)}</div></div><div class="row" style="margin-top:.5rem"><button class="btn" onclick="SYNC.signIn()">ลองล็อกอินอีกครั้ง</button><button class="btn" onclick="location.reload()">รีโหลดหน้า</button></div>`;
  else if (!S.user) body = `<p class="small" style="margin-top:0">ล็อกอินด้วยบัญชี Google เดียวกันในทุกเครื่อง ข้อมูลจะตรงกันอัตโนมัติ</p>
      <button class="btn primary" onclick="SYNC.signIn()"><span style="font-weight:700">G</span>&nbsp; เข้าสู่ระบบด้วย Google</button>`;
  else {
    const st = { synced: ['good', '✅ ซิงก์แล้ว'], syncing: ['', '⏳ กำลังซิงก์…'], connecting: ['', '⏳ กำลังเชื่อมต่อ…'], offline: ['warn', '⚠️ ออฟไลน์ — บันทึกต่อได้ จะซิงก์เมื่อมีอินเทอร์เน็ต'], error: ['bad', '❌ ' + S.error] }[s] || ['', s];
    const last = window.getDB().settings.lastDriveBackup;
    body = `<div class="row" style="gap:.6rem;align-items:center">
        ${S.user.photoURL ? `<img src="${esc(S.user.photoURL)}" alt="" width="36" height="36" style="border-radius:50%" referrerpolicy="no-referrer">` : ''}
        <div class="grow"><b>${esc(S.user.displayName || '')}</b><div class="small muted">${esc(S.user.email || '')}</div></div>
        <button class="btn small" onclick="SYNC.signOut()">ออกจากระบบ</button></div>
      <div class="advice ${st[0]}" style="margin-top:.6rem"><b>${esc(st[1])}</b>${S.lastSync ? `<div class="small">ซิงก์ล่าสุด ${S.lastSync.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</div>` : ''}</div>
      <h3 style="margin-top:1rem">📁 Google Drive</h3>
      <p class="small muted" style="margin-top:0">สำรองข้อมูลทั้งหมดเป็นไฟล์ลงโฟลเดอร์ “${DRIVE_FOLDER_NAME}” ใน Drive ของคุณ (เมื่อเชื่อมแล้ว จะสำรองอัตโนมัติวันละครั้งตอนเปิดแอป) · สำรองล่าสุด: <b>${ago(last)}</b></p>
      <div class="row">
        <button class="btn" ${S.drive.busy ? 'disabled' : ''} onclick="SYNC.driveBackup()">☁️ สำรองลง Drive ตอนนี้</button>
        <button class="btn" ${S.drive.busy ? 'disabled' : ''} onclick="SYNC.driveRestoreList()">⤵ กู้คืนจาก Drive</button>
        <button class="btn" ${S.drive.busy ? 'disabled' : ''} onclick="SYNC.driveSheet()">📊 บัญชี → Google Sheets</button>
      </div>
      ${S.drive.msg ? `<p class="small" style="margin:.5rem 0 0">${esc(S.drive.msg)} ${S.drive.link ? `<a href="${esc(S.drive.link)}" target="_blank" rel="noopener">เปิด →</a>` : ''}</p>` : ''}`;
  }
  return `<div class="card sync-card"><h2>☁️ ซิงก์ข้อมูลทุกเครื่อง</h2>${body}
    <p class="small muted" style="margin:.8rem 0 0">${from === 'local' ? `ค่าตั้งค่า Firebase บันทึกไว้ในเครื่องนี้ · <a href="#settings" onclick="event.preventDefault();SYNC.clearConfig()">ล้างค่า</a> · ` : ''}${guide}</p></div>`;
}

// ---------- คำสั่งจากหน้าเว็บ ----------
window.SYNC = {
  get signedIn() { return !!S.user && S.ready; },
  cardHtml, push,
  async saveConfig(text) {
    const cfg = parseConfig(text);
    if (!cfg) return t('อ่านค่าตั้งค่าไม่ได้ — ต้องมี apiKey, authDomain, projectId และ appId');
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    t('บันทึกค่าตั้งค่าแล้ว กำลังเชื่อมต่อ…');
    if (S.app) location.reload(); else init();
  },
  clearConfig() {
    if (!confirm('ล้างค่าตั้งค่า Firebase ในเครื่องนี้? (ข้อมูลบนคลาวด์ไม่หาย)')) return;
    localStorage.removeItem(CFG_KEY); localStorage.removeItem(LINK_KEY); location.reload();
  },
  async signIn() {
    if (!S.auth) return init();
    try {
      setState('connecting'); rerender();
      await S.fb.signInWithPopup(S.auth, new S.fb.GoogleAuthProvider());
    } catch (e) { setState(S.user ? S.state : 'error', fbError(e)); if (!S.user) S.state = 'error'; rerender(); t(fbError(e)); }
  },
  async signOut() {
    if (!confirm('ออกจากระบบ? ข้อมูลยังอยู่ในเครื่องนี้และบนคลาวด์ แต่จะไม่ซิงก์จนกว่าจะล็อกอินใหม่')) return;
    await signOutNow(); t('ออกจากระบบแล้ว');
  },
  driveBackup() { driveAction('กำลังสำรองข้อมูล', tk => backup(tk)); },
  driveRestoreList() {
    driveAction('กำลังโหลดรายการไฟล์สำรอง', async tk => {
      const folder = await driveFolder(tk);
      const q = `'${folder}' in parents and trashed=false and mimeType='application/json'`;
      const j = await (await gapi(tk, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=30&fields=files(id,name,modifiedTime,size)`)).json();
      S.drive.msg = '';
      const files = j.files || [];
      window.openModal('กู้คืนจาก Google Drive', files.length
        ? `<p class="small muted" style="margin-top:0">เลือกไฟล์ที่ต้องการ ข้อมูลปัจจุบันในทุกเครื่องจะถูกแทนที่ด้วยไฟล์นี้</p><ul class="list">${files.map(f => `<li><span class="grow">${esc(f.name)}<div class="small muted">แก้ไข ${new Date(f.modifiedTime).toLocaleString('th-TH')} · ${Math.round((+f.size || 0) / 1024)} KB</div></span><button type="button" class="btn small" onclick="SYNC.driveRestore('${f.id}')">กู้คืน</button></li>`).join('')}</ul>`
        : '<div class="empty">ยังไม่มีไฟล์สำรองในโฟลเดอร์นี้</div>', () => true, 'ปิด');
    });
  },
  driveRestore(id) {
    if (!confirm('กู้คืนจากไฟล์นี้? ข้อมูลปัจจุบันในทุกเครื่องที่ซิงก์จะถูกแทนที่')) return;
    document.getElementById('modal').close();
    driveAction('กำลังกู้คืน', async tk => {
      const r = await gapi(tk, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
      const d = await r.json();
      if (!d || !Array.isArray(d.plots)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของสมุดสวน');
      window.replaceDB(d, { push: true });
      S.drive.msg = '✅ กู้คืนข้อมูลแล้ว'; t('กู้คืนข้อมูลแล้ว');
    });
  },
  driveSheet() {
    driveAction('กำลังสร้างไฟล์ Google Sheets', async tk => {
      const folder = await driveFolder(tk);
      const f = await driveUpload(tk, { name: `บัญชีสวน-${window.todayStr()}`, parents: [folder], mimeType: 'application/vnd.google-apps.spreadsheet' }, window.financeCsv(), 'text/csv; charset=UTF-8');
      S.drive.msg = '✅ สร้างไฟล์บัญชีใน Google Sheets แล้ว'; S.drive.link = f.webViewLink || '';
      if (location.hash !== '#settings') {
        window.openModal('เปิดใน Google Sheets', `<p>สร้างไฟล์ “บัญชีสวน-${window.todayStr()}” ในโฟลเดอร์ ${DRIVE_FOLDER_NAME} แล้ว</p>${f.webViewLink ? `<a class="btn primary" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">เปิดไฟล์ →</a>` : ''}`, () => true, 'ปิด');
      }
    });
  },
};
// ก่อนปิดหน้า ส่งการแก้ไขที่ค้างอยู่ทันที
addEventListener('pagehide', () => { if (S.timer) pushNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.timer) pushNow(); });
addEventListener('online', () => { if (S.user) { if (!S.ready) onSignedIn(S.user); else updateBadge(); } });
addEventListener('offline', () => { if (S.user) setState('offline'); });

if (!window.__SUAN_NO_AUTO_INIT) init();
