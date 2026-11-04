/* สมุดสวน — ซิงก์ข้อมูลทุกเครื่องและแชร์สวนเป็นกลุ่มด้วย Firebase (ล็อกอิน Google) + Google Drive
 *
 * โครงสร้างบน Firestore
 *   farms/{farmId}                 { name, ownerUid, members: { uid: { role, money, name, email, photo, invite, joinedAt } } }
 *   farms/{farmId}/records/{key}   ข้อมูลทั่วไป หนึ่งเอกสารต่อหนึ่งรายการ  key = คอลเลกชัน~id
 *   farms/{farmId}/money/{key}     ข้อมูลเงิน (บัญชี และราคาของผลผลิต/คลัง) อ่านได้เฉพาะคนที่ได้สิทธิ์ดูเงิน
 *   farms/{farmId}/invites/{code}  ลิงก์เชิญ { role, money, farmName, createdBy, expiresAt, revoked }
 *   users/{uid}                    { farms: { farmId: { name, role } } }  รายการสวนของแต่ละคน
 *   users/{uid}/records/...        ข้อมูลรูปแบบเดิม (ก่อนมีระบบกลุ่ม) ใช้ย้ายเข้าสวนอัตโนมัติ
 * ถ้ายังไม่ได้ตั้งค่า Firebase แอปจะทำงานแบบเก็บในเครื่องเหมือนเดิม
 */
const FB_VER = '10.12.2';
const CFG_KEY = 'suan-firebase-config';
const ACTIVE_KEY = 'suan-active-farm'; // สวนที่ข้อมูลในเครื่องนี้เป็นของ  {uid, farmId}
const JOIN_KEY = 'suan-join';
const DRIVE_TOKEN_KEY = 'suan-drive-token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'สมุดสวน';
const COLLS = ['plots', 'activities', 'finance', 'harvests', 'stock', 'journal', 'knowledge'];
const PRICED = ['harvests', 'stock']; // ฟิลด์ price ของคอลเลกชันเหล่านี้ถือเป็นข้อมูลเงิน
const LOCAL_ONLY_SETTINGS = ['theme', 'browserNotify'];
const SETUP_GUIDE = 'https://github.com/Falafung/-garden/blob/main/SETUP-FIREBASE.md';
const INVITE_DAYS = 7;
const ROLE_LABEL = { owner: 'เจ้าของ', editor: 'บันทึก/แก้ไขได้', viewer: 'ดูอย่างเดียว' };

// ---------- ฟังก์ชันจัดการข้อมูล (ไม่ขึ้นกับ Firebase) ----------
// คีย์ที่ขึ้นต้นด้วย $ เป็นข้อมูลเงิน (เก็บใน money)
export function toRecords(db, { money = true } = {}) {
  const m = new Map();
  const st = { ...(db.settings || {}) };
  LOCAL_ONLY_SETTINGS.forEach(k => delete st[k]);
  m.set('settings~main', JSON.stringify(st));
  for (const c of COLLS) {
    for (const it of db[c] || []) {
      if (!it || !it.id) continue;
      if (c === 'finance') { if (money) m.set(`$finance~${it.id}`, JSON.stringify(it)); continue; }
      if (PRICED.includes(c)) {
        const { price, ...rest } = it;
        m.set(`${c}~${it.id}`, JSON.stringify(rest));
        if (money && price !== undefined && price !== '' && price !== null) m.set(`$price~${c}~${it.id}`, JSON.stringify(price));
        continue;
      }
      m.set(`${c}~${it.id}`, JSON.stringify(it));
    }
  }
  return m;
}
export function fromRecords(map) {
  const db = { settings: {} };
  COLLS.forEach(c => { db[c] = []; });
  const prices = [];
  for (const [k, v] of map) {
    let val; try { val = JSON.parse(v); } catch { continue; }
    if (k.startsWith('$price~')) { prices.push([k, val]); continue; }
    const key = k.startsWith('$') ? k.slice(1) : k;
    const c = key.slice(0, key.indexOf('~'));
    if (c === 'settings') db.settings = val;
    else if (db[c]) db[c].push(val);
  }
  for (const [k, price] of prices) {
    const [, c, id] = k.split('~');
    const it = (db[c] || []).find(x => x.id === id);
    if (it) it.price = price;
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
    (cloud[c] || []).forEach(x => byId.set(x.id, PRICED.includes(c) && x.price === undefined && byId.get(x.id)?.price !== undefined ? { ...x, price: byId.get(x.id).price } : x));
    let arr = [...byId.values()];
    if (c === 'knowledge') {
      const cloudIds = new Set((cloud.knowledge || []).map(k => k.id)), cloudTitles = new Set((cloud.knowledge || []).map(k => k.title));
      arr = arr.filter(k => cloudIds.has(k.id) || !cloudTitles.has(k.title));
    }
    out[c] = arr;
  }
  return out;
}
export function hashStr(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
export function localChanges(baseHashes, localMap) {
  const sets = [], dels = [];
  for (const [k, v] of localMap) if (baseHashes[k] !== hashStr(v)) sets.push([k, v]);
  for (const k of Object.keys(baseHashes)) if (!localMap.has(k)) dels.push(k);
  return { sets, dels };
}
// ข้อมูลเดิมรูปแบบเก่า (ก่อนแยกเงิน) → รูปแบบใหม่
export function legacyToRecords(legacyMap) {
  const db = { settings: {} };
  COLLS.forEach(c => { db[c] = []; });
  for (const [k, v] of legacyMap) {
    let val; try { val = JSON.parse(v); } catch { continue; }
    const c = k.slice(0, k.indexOf('~'));
    if (c === 'settings') db.settings = val; else if (db[c]) db[c].push(val);
  }
  return toRecords(db);
}
function hasUserData(db) { return ['plots', 'activities', 'finance', 'harvests', 'stock', 'journal'].some(c => (db[c] || []).length); }
function randomCode(n = 22) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map(x => a[x % a.length]).join('');
}

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
  error: '', ready: false, timer: null, lastSync: null,
  farmId: null, farm: null, myFarms: {}, invites: [], newInvite: null,
  base: new Map(), unacked: new Map(), remotePub: new Map(), remoteMoney: new Map(),
  unsubs: [], gotPub: false, gotMoney: false, meta: { pending: false, cached: false },
  drive: { busy: false, msg: '', link: '' },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = s => window.toast?.(s) ?? console.log(s);
const me = () => S.farm?.members?.[S.user?.uid] || null;
const role = () => me()?.role || null;
const canEdit = () => !S.ready || role() === 'owner' || role() === 'editor';
const canMoney = () => !S.ready || role() === 'owner' || me()?.money === true;
const isOwner = () => role() === 'owner';
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
  const group = S.ready && S.farm && Object.keys(S.farm.members || {}).length > 1;
  el.innerHTML = m ? `<a href="#settings" class="sync-badge ${m[2]}" title="${esc(m[1])}">${group ? '👥 ' : ''}${m[0]}</a>` : '';
}
function fbError(e) {
  const c = e?.code || '';
  if (c.includes('unauthorized-domain')) return `โดเมนนี้ (${location.hostname}) ยังไม่ได้รับอนุญาต — เพิ่มใน Firebase → Authentication → Settings → Authorized domains`;
  if (c.includes('operation-not-allowed')) return 'ยังไม่ได้เปิดการล็อกอินด้วย Google — เปิดใน Firebase → Authentication → Sign-in method → Google';
  if (c.includes('popup-blocked')) return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน — อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วกดใหม่';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'ปิดหน้าต่างล็อกอินก่อนเสร็จ';
  if (c.includes('permission-denied')) return 'ไม่มีสิทธิ์อ่าน/เขียนข้อมูล — ตรวจว่าได้วางกฎ Firestore ชุดล่าสุดตามคู่มือแล้ว';
  if (c.includes('invalid-api-key') || c.includes('api-key-not-valid')) return 'ค่า apiKey ไม่ถูกต้อง — ตรวจค่าตั้งค่า Firebase';
  if (c.includes('network') || c.includes('unavailable')) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
  return (e?.message || String(e)).replace(/^Firebase:\s*/, '');
}

// ---------- เริ่มต้น Firebase ----------
function captureJoinHash() {
  const m = location.hash.match(/^#join=([\w-]+)\.(\w+)$/);
  if (!m) return null;
  const j = { farmId: m[1], code: m[2] };
  sessionStorage.setItem(JOIN_KEY, JSON.stringify(j));
  history.replaceState(null, '', '#settings');
  return j;
}
async function init() {
  if (captureJoinHash()) window.render?.();
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
const F = {
  farm: id => S.fb.doc(S.db, 'farms', id),
  records: id => S.fb.collection(S.db, 'farms', id, 'records'),
  money: id => S.fb.collection(S.db, 'farms', id, 'money'),
  invites: id => S.fb.collection(S.db, 'farms', id, 'invites'),
  invite: (id, code) => S.fb.doc(S.db, 'farms', id, 'invites', code),
  user: () => S.fb.doc(S.db, 'users', S.user.uid),
  legacy: () => S.fb.collection(S.db, 'users', S.user.uid, 'records'),
};
function memberInfo(extra = {}) {
  return { name: S.user.displayName || S.user.email || 'สมาชิก', email: S.user.email || '', photo: S.user.photoURL || '', joinedAt: Date.now(), ...extra };
}
function activeFarm() { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch { return null; } }
function setActiveFarm(farmId) { localStorage.setItem(ACTIVE_KEY, JSON.stringify({ uid: S.user.uid, farmId })); }
function baseKey(farmId = S.farmId) { return `suan-sync-base-${S.user.uid}-${farmId}`; }
function loadBaseHashes() { try { return JSON.parse(localStorage.getItem(baseKey()) || 'null'); } catch { return null; } }
function persistAcked(map) {
  const h = {}; for (const [k, v] of map) h[k] = hashStr(v);
  try { localStorage.setItem(baseKey(), JSON.stringify(h)); } catch { /* ไม่เป็นไร */ }
}
function ackOps(ops, farmId) {
  if (!S.user || S.farmId !== farmId) return;
  let h; try { h = JSON.parse(localStorage.getItem(baseKey(farmId)) || '{}'); } catch { h = {}; }
  for (const [op, k, v] of ops) { if (op === 'set') h[k] = hashStr(v); else delete h[k]; }
  try { localStorage.setItem(baseKey(farmId), JSON.stringify(h)); } catch { /* ไม่เป็นไร */ }
}
async function getMap(col) {
  const snap = await S.fb.getDocsFromServer(col);
  return new Map(snap.docs.map(d => [d.id, d.data().v]));
}
function canMoneyFor(farm) { const m = farm?.members?.[S.user.uid]; return !!m && (m.role === 'owner' || m.money === true); }
function combine(pub, money) {
  const out = new Map(pub);
  for (const [k, v] of money) out.set('$' + k, v);
  return out;
}

async function onSignedIn(user) {
  S.user = user; S.ready = false;
  setState('connecting'); rerender();
  try {
    // 1) รายการสวนของฉัน
    const us = await S.fb.getDoc(F.user());
    S.myFarms = us.exists() ? (us.data().farms || {}) : {};
    const join = JSON.parse(sessionStorage.getItem(JOIN_KEY) || 'null');
    const local = window.getDB();
    // 2) ยังไม่มีสวน → สร้างสวนของตัวเอง (ย้ายข้อมูลรูปแบบเดิมถ้ามี)
    //    ยกเว้นเปิดมาจากลิงก์เชิญและเครื่องนี้ยังไม่มีข้อมูลของตัวเอง
    if (!Object.keys(S.myFarms).length) {
      let legacy = new Map();
      try { legacy = await getMap(F.legacy()); } catch { /* ไม่มีข้อมูลเดิม */ }
      if (legacy.size || hasUserData(local) || !join) await createFarm(legacy);
    }
    // 3) เลือกสวนที่จะเปิด
    const act = activeFarm();
    let target = null;
    if (act?.uid === user.uid && S.myFarms[act.farmId]) target = act.farmId;
    else target = Object.keys(S.myFarms).find(id => S.myFarms[id].role === 'owner') || Object.keys(S.myFarms)[0] || null;
    if (target) await connectFarm(target, 'auto');
    else { setState('synced'); rerender(); }
    // 4) มีลิงก์เชิญค้างอยู่
    if (join) { sessionStorage.removeItem(JOIN_KEY); await handleJoin(join); }
  } catch (e) {
    console.error(e);
    setState(navigator.onLine ? 'error' : 'offline', fbError(e)); rerender();
    if (!navigator.onLine) setTimeout(() => S.user && !S.ready && onSignedIn(S.user), 30000);
  }
}
async function createFarm(legacyMap = new Map()) {
  const ref = S.fb.doc(S.fb.collection(S.db, 'farms'));
  const name = window.getDB().settings.farmName || 'สวนของฉัน';
  await S.fb.setDoc(ref, { name, ownerUid: S.user.uid, createdAt: Date.now(), members: { [S.user.uid]: memberInfo({ role: 'owner', money: true }) } });
  S.myFarms[ref.id] = { name, role: 'owner' };
  await S.fb.setDoc(F.user(), { farms: { [ref.id]: S.myFarms[ref.id] } }, { merge: true });
  if (legacyMap.size) {
    await writeDiff(diff(new Map(), legacyToRecords(legacyMap)), ref.id);
    t('ย้ายข้อมูลเดิมเข้าสวนของคุณแล้ว');
  }
  return ref.id;
}
function stopListeners() { S.unsubs.forEach(u => u()); S.unsubs = []; }

// mode: 'auto' = เปิดตอนเริ่มแอป (รวมข้อมูลในเครื่องถ้าจำเป็น) · 'switch' = สลับ/เข้าร่วมสวน (ใช้ข้อมูลคลาวด์)
async function connectFarm(farmId, mode) {
  stopListeners(); clearTimeout(S.timer); S.timer = null;
  S.ready = false; S.farmId = farmId; S.unacked = new Map(); S.newInvite = null; S.invites = [];
  setState('connecting'); rerender();
  const fs = await S.fb.getDoc(F.farm(farmId)).catch(() => null);
  if (!fs || !fs.exists() || !fs.data().members?.[S.user.uid]) { await dropFarm(farmId); return; }
  S.farm = fs.data();
  const allowMoney = canMoneyFor(S.farm);
  const pub = await getMap(F.records(farmId));
  const money = allowMoney ? await getMap(F.money(farmId)) : new Map();
  const remote = combine(pub, money);
  const local = window.getDB();
  const localMap = toRecords(local, { money: allowMoney });
  const act = activeFarm();
  const linked = act?.uid === S.user.uid && act.farmId === farmId;
  const editable = ['owner', 'editor'].includes(S.farm.members[S.user.uid].role);
  if (mode === 'switch' || !editable) {
    S.base = remote; adoptRemote(remote, true);
  } else if (linked) {
    // ส่งเฉพาะสิ่งที่แก้ในเครื่องนี้ตั้งแต่ซิงก์ครั้งก่อน แล้วรวมกับข้อมูลล่าสุดจากคลาวด์
    const baseH = loadBaseHashes();
    if (baseH) {
      const mine = localChanges(baseH, localMap);
      const merged = applyDiff(remote, mine);
      if (mine.sets.length || mine.dels.length) await writeDiff(mine, farmId);
      S.base = merged; adoptRemote(merged);
    } else {
      const sets = diff(remote, localMap).sets;
      await writeDiff({ sets, dels: [] }, farmId);
      S.base = applyDiff(remote, { sets, dels: [] }); adoptRemote(S.base);
    }
  } else if (!remote.size || (remote.size === 1 && remote.has('settings~main'))) {
    await writeDiff(diff(remote, localMap), farmId);
    S.base = localMap;
    if (hasUserData(local)) t('อัปโหลดข้อมูลเครื่องนี้ขึ้นคลาวด์แล้ว');
  } else if (!hasUserData(local) || mapsEqual(localMap, remote)) {
    S.base = remote; adoptRemote(remote, true);
  } else {
    const choice = await askMerge(remote);
    if (!choice) { await signOutNow(); return; }
    S.base = remote;
    if (choice === 'cloud') adoptRemote(remote, true);
    else {
      const target = choice === 'merge' ? mergeDb(local, fromRecords(remote)) : local;
      const tMap = toRecords(target, { money: allowMoney });
      await writeDiff(diff(remote, tMap), farmId);
      S.base = tMap; window.replaceDB(target);
    }
    t(choice === 'merge' ? 'รวมข้อมูลแล้ว' : choice === 'cloud' ? 'ใช้ข้อมูลจากคลาวด์แล้ว' : 'ใช้ข้อมูลเครื่องนี้แทนคลาวด์แล้ว');
  }
  setActiveFarm(farmId);
  S.ready = true;
  listen(farmId);
  setState('synced'); S.lastSync = new Date(); rerender();
  if (isOwner()) loadInvites();
  maybeAutoBackup();
}
function adoptRemote(remote, force = false) {
  const local = window.getDB();
  if (force || !mapsEqual(toRecords(local, { money: canMoneyFor(S.farm) }), remote)) window.replaceDB(fromRecords(remote));
}
async function dropFarm(farmId) {
  stopListeners();
  delete S.myFarms[farmId];
  try { await S.fb.setDoc(F.user(), { farms: { [farmId]: S.fb.deleteField() } }, { merge: true }); } catch { /* ไม่เป็นไร */ }
  if (activeFarm()?.farmId === farmId) localStorage.removeItem(ACTIVE_KEY);
  S.farm = null; S.farmId = null; S.ready = false;
  const next = Object.keys(S.myFarms).find(id => S.myFarms[id].role === 'owner') || Object.keys(S.myFarms)[0];
  if (next) return connectFarm(next, 'switch');
  window.replaceDB({});
  const id = await createFarm();
  return connectFarm(id, 'switch');
}
function listen(farmId) {
  stopListeners();
  S.gotPub = false; S.gotMoney = !canMoney();
  const onData = () => {
    if (S.farmId !== farmId || !S.gotPub || !S.gotMoney) return;
    const serverView = combine(S.remotePub, canMoney() ? S.remoteMoney : new Map());
    // ใส่การแก้ของเครื่องนี้ที่เซิร์ฟเวอร์ยังไม่ยืนยันทับลงไป (กันข้อมูลที่บันทึกตอนออฟไลน์หาย)
    const remote = new Map(serverView);
    for (const [k, [op, v]] of S.unacked) { if (op === 'set') remote.set(k, v); else remote.delete(k); }
    const localMap = toRecords(window.getDB(), { money: canMoney() });
    const mine = canEdit() ? diff(S.base, localMap) : { sets: [], dels: [] };
    let merged = remote;
    if (mine.sets.length || mine.dels.length) {
      merged = applyDiff(remote, mine);
      clearTimeout(S.timer); S.timer = null;
      writeDiff(mine, farmId).catch(e => setState('error', fbError(e)));
    }
    S.base = merged;
    const { pending, cached } = S.meta;
    if (!pending && !cached && !S.unacked.size && !mine.sets.length && !mine.dels.length) persistAcked(serverView);
    if (!mapsEqual(localMap, merged)) window.replaceDB(fromRecords(merged));
    if (!navigator.onLine || (cached && pending)) setState('offline');
    else if (pending) setState('syncing');
    else { setState('synced'); S.lastSync = new Date(); }
    if (location.hash === '#settings' && !document.getElementById('modal')?.open) window.render?.();
  };
  const onErr = e => { console.error(e); if (S.farmId === farmId) { setState('error', fbError(e)); rerender(); } };
  S.unsubs.push(S.fb.onSnapshot(F.records(farmId), { includeMetadataChanges: true }, snap => {
    S.remotePub = new Map(snap.docs.map(d => [d.id, d.data().v]));
    S.meta = { pending: snap.metadata.hasPendingWrites, cached: snap.metadata.fromCache };
    S.gotPub = true; onData();
  }, onErr));
  if (canMoney()) {
    S.unsubs.push(S.fb.onSnapshot(F.money(farmId), { includeMetadataChanges: true }, snap => {
      S.remoteMoney = new Map(snap.docs.map(d => [d.id, d.data().v]));
      S.gotMoney = true; onData();
    }, onErr));
  }
  // เปลี่ยนสิทธิ์ / ถูกนำออก / เปลี่ยนชื่อสวน
  S.unsubs.push(S.fb.onSnapshot(F.farm(farmId), snap => {
    if (S.farmId !== farmId) return;
    const before = me();
    if (!snap.exists() || !snap.data().members?.[S.user.uid]) {
      t('คุณไม่ได้เป็นสมาชิกสวนนี้แล้ว');
      dropFarm(farmId); return;
    }
    S.farm = snap.data();
    const after = me();
    if (S.myFarms[farmId] && (S.myFarms[farmId].name !== S.farm.name || S.myFarms[farmId].role !== after.role)) {
      S.myFarms[farmId] = { name: S.farm.name, role: after.role };
      S.fb.setDoc(F.user(), { farms: { [farmId]: S.myFarms[farmId] } }, { merge: true }).catch(() => {});
    }
    if (before && (before.role !== after.role || !!before.money !== !!after.money)) {
      t(`สิทธิ์ของคุณในสวนนี้เปลี่ยนเป็น: ${ROLE_LABEL[after.role]}${after.money || after.role === 'owner' ? ' · เห็นบัญชีเงิน' : ''}`);
      connectFarm(farmId, 'switch'); return;
    }
    rerender();
  }, e => {
    // อ่านข้อมูลสวนไม่ได้แล้ว = ถูกนำออก
    if (S.farmId === farmId && String(e?.code).includes('permission-denied')) { t('คุณไม่ได้เป็นสมาชิกสวนนี้แล้ว'); dropFarm(farmId); }
    else onErr(e);
  }));
}
async function writeDiff({ sets, dels }, farmId = S.farmId) {
  const ops = [...sets.map(([k, v]) => ['set', k, v]), ...dels.map(k => ['del', k])];
  for (let i = 0; i < ops.length; i += 200) {
    const b = S.fb.writeBatch(S.db);
    const batchOps = ops.slice(i, i + 200);
    for (const [op, k, v] of batchOps) {
      const isMoney = k.startsWith('$');
      const id = isMoney ? k.slice(1) : k;
      const ref = S.fb.doc(S.db, 'farms', farmId, isMoney ? 'money' : 'records', id);
      if (op === 'set') b.set(ref, { v, c: id.slice(0, id.indexOf('~')), t: S.fb.serverTimestamp(), by: S.user.uid });
      else b.delete(ref);
    }
    const tags = batchOps.map(([op, k, v]) => { const tag = [op, v]; S.unacked.set(k, tag); return [k, tag]; });
    // ไม่รอผลจากเซิร์ฟเวอร์ตอนออฟไลน์: Firestore เก็บคิวไว้และส่งเมื่อออนไลน์
    const p = b.commit().then(() => {
      ackOps(batchOps, farmId);
      tags.forEach(([k, tag]) => { if (S.unacked.get(k) === tag) S.unacked.delete(k); });
    });
    if (navigator.onLine) await p; else p.catch(e => setState('error', fbError(e)));
  }
}
async function pushNow() {
  clearTimeout(S.timer); S.timer = null;
  if (!S.user || !S.ready) return;
  const cur = toRecords(window.getDB(), { money: canMoney() });
  const d = diff(S.base, cur);
  if (!d.sets.length && !d.dels.length) return;
  if (!canEdit()) {
    // ดูอย่างเดียว: ยกเลิกการแก้ในเครื่อง
    window.replaceDB(fromRecords(S.base));
    t('👁 คุณมีสิทธิ์ดูอย่างเดียวในสวนนี้ — การแก้ไขไม่ถูกบันทึก');
    return;
  }
  S.base = cur;
  setState(navigator.onLine ? 'syncing' : 'offline');
  try { await writeDiff(d); } catch (e) { console.error(e); setState('error', fbError(e)); rerender(); }
  // ชื่อสวนเปลี่ยน → อัปเดตชื่อในข้อมูลสวน (เจ้าของเท่านั้น)
  const name = window.getDB().settings.farmName;
  if (isOwner() && name && S.farm && S.farm.name !== name) {
    S.farm.name = name;
    S.fb.updateDoc(F.farm(S.farmId), { name }).catch(() => {});
  }
}
function push() {
  if (!S.ready || !S.user) return;
  clearTimeout(S.timer);
  S.timer = setTimeout(pushNow, canEdit() ? 400 : 0);
}
function onSignedOut() {
  stopListeners(); S.user = null; S.ready = false; S.farm = null; S.farmId = null;
  S.base = new Map(); S.unacked = new Map(); S.myFarms = {}; S.invites = []; S.newInvite = null;
  setState('signedout'); rerender();
}
async function signOutNow() {
  await pushNow();
  sessionStorage.removeItem(DRIVE_TOKEN_KEY);
  await S.fb.signOut(S.auth);
}
function modalPromise(title, html, okLabel, onOk) {
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    let answered = false;
    const onClose = () => { modal.removeEventListener('close', onClose); if (!answered) resolve(null); };
    modal.addEventListener('close', onClose);
    window.openModal(title, html, fd => { answered = true; resolve(onOk(fd)); }, okLabel);
  });
}
function askMerge(remote) {
  const cloud = fromRecords(remote), local = window.getDB();
  const cnt = d => `${(d.plots || []).length} แปลง · ${(d.activities || []).length} งาน · ${(d.finance || []).length} รายการบัญชี · ${(d.journal || []).length} บันทึกสวน`;
  return modalPromise('มีข้อมูลทั้งในเครื่องนี้และบนคลาวด์', `
      <p class="small" style="margin-top:0">☁️ คลาวด์: ${cnt(cloud)}<br>📱 เครื่องนี้: ${cnt(local)}</p>
      <label class="field inline-check"><input type="radio" name="choice" value="merge" checked> <span><b>รวมข้อมูลทั้งสองที่</b> (แนะนำ) — ไม่มีอะไรหาย รายการเดียวกันใช้ฉบับบนคลาวด์</span></label>
      <label class="field inline-check"><input type="radio" name="choice" value="cloud"> <span>ใช้ข้อมูลบนคลาวด์ (ข้อมูลในเครื่องนี้จะถูกแทนที่)</span></label>
      <label class="field inline-check"><input type="radio" name="choice" value="local"> <span>ใช้ข้อมูลเครื่องนี้แทนคลาวด์ (ข้อมูลบนคลาวด์จะถูกแทนที่)</span></label>`,
    'ตกลง', fd => fd.choice || 'merge');
}

// ---------- กลุ่ม: ลิงก์เชิญ / สมาชิก ----------
function inviteLink(farmId, code) { return `${location.origin}${location.pathname}#join=${farmId}.${code}`; }
async function loadInvites() {
  if (!isOwner()) { S.invites = []; return; }
  try {
    const snap = await S.fb.getDocs(F.invites(S.farmId));
    S.invites = snap.docs.map(d => ({ code: d.id, ...d.data() })).filter(i => !i.revoked && i.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) { console.error(e); S.invites = []; }
  rerender();
}
async function handleJoin({ farmId, code }) {
  if (S.myFarms[farmId]) {
    if (S.farmId !== farmId) await connectFarm(farmId, 'switch');
    t('คุณเป็นสมาชิกสวนนี้อยู่แล้ว'); return;
  }
  let inv;
  try { const s = await S.fb.getDoc(F.invite(farmId, code)); inv = s.exists() ? s.data() : null; } catch { inv = null; }
  if (!inv || inv.revoked) return window.openModal('ลิงก์เชิญใช้ไม่ได้', '<p>ลิงก์นี้ถูกยกเลิกหรือไม่ถูกต้อง ขอลิงก์ใหม่จากเจ้าของสวน</p>', () => true, 'ปิด');
  if (inv.expiresAt < Date.now()) return window.openModal('ลิงก์เชิญหมดอายุ', '<p>ลิงก์นี้หมดอายุแล้ว ขอลิงก์ใหม่จากเจ้าของสวน</p>', () => true, 'ปิด');
  const ok = await modalPromise(`เข้าร่วมสวน “${esc(inv.farmName || 'สวน')}”`, `
      <p style="margin-top:0">คุณได้รับเชิญให้เข้าร่วมสวนนี้</p>
      <ul class="small"><li>สิทธิ์: <b>${esc(ROLE_LABEL[inv.role])}</b></li><li>บัญชีรายรับ-รายจ่าย: <b>${inv.money ? 'เห็น' : 'ไม่เห็น'}</b></li></ul>
      <p class="small muted">เมื่อเข้าร่วม แอปในเครื่องนี้จะแสดงข้อมูลของสวนนี้ ${Object.keys(S.myFarms).length ? '(สวนของคุณเองยังอยู่บนคลาวด์ สลับกลับได้ที่หน้าตั้งค่า)' : ''}</p>`,
    'เข้าร่วม', () => true);
  if (!ok) return;
  try {
    await pushNow();
    await S.fb.updateDoc(F.farm(farmId), { [`members.${S.user.uid}`]: memberInfo({ role: inv.role, money: !!inv.money, invite: code }) });
    S.myFarms[farmId] = { name: inv.farmName || 'สวน', role: inv.role };
    await S.fb.setDoc(F.user(), { farms: { [farmId]: S.myFarms[farmId] } }, { merge: true });
    await connectFarm(farmId, 'switch');
    t(`เข้าร่วมสวน “${inv.farmName || ''}” แล้ว`);
  } catch (e) { console.error(e); t('เข้าร่วมไม่สำเร็จ: ' + fbError(e)); }
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
function safeName(s) { return String(s || 'สวน').replace(/[\\/:*?"<>|']/g, '').slice(0, 40); }
function lastBackupKey() { return `suan-last-backup-${S.farmId}`; }
function lastBackup() { return localStorage.getItem(lastBackupKey()) || window.getDB().settings.lastDriveBackup; }
async function backup(token, silent = false) {
  const folder = await driveFolder(token);
  const name = `สมุดสวน-${safeName(S.farm?.name)}-สำรอง-${window.todayStr()}.json`;
  const q = `name='${name}' and '${folder}' in parents and trashed=false`;
  const ex = await (await gapi(token, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`)).json();
  const f = await driveUpload(token, ex.files?.[0]?.id ? { name } : { name, parents: [folder], mimeType: 'application/json' }, JSON.stringify(window.getDB()), 'application/json', ex.files?.[0]?.id);
  localStorage.setItem(lastBackupKey(), new Date().toISOString());
  S.drive.msg = `✅ สำรองแล้ว: ${name}`; S.drive.link = f.webViewLink || '';
  if (!silent) t('สำรองข้อมูลลง Google Drive แล้ว');
}
function maybeAutoBackup() {
  const last = lastBackup();
  if (canMoney() && driveTokenCached() && (!last || Date.now() - new Date(last).getTime() > 24 * 3600 * 1000)) driveAction('กำลังสำรองอัตโนมัติ', tk => backup(tk, true), false);
}
function ago(iso) {
  if (!iso) return 'ยังไม่เคย';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'เมื่อสักครู่'; if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60); if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
}
function daysLeft(ms) { return Math.max(0, Math.ceil((ms - Date.now()) / 86400000)); }

// ---------- หน้าตั้งค่า ----------
function cardHtml() {
  const { cfg, from } = getConfig();
  const guide = `<a href="${SETUP_GUIDE}" target="_blank" rel="noopener">คู่มือตั้งค่า Firebase</a> · <a href="docs/firebase-setup-video.html" target="_blank" rel="noopener">🎬 วิดีโอคู่มือ</a>`;
  const join = JSON.parse(sessionStorage.getItem(JOIN_KEY) || 'null');
  const joinNote = join ? `<div class="advice warn" style="margin-bottom:.6rem"><b>📩 คุณได้รับลิงก์เชิญเข้าร่วมสวน</b><div class="small">${cfg ? 'กด “เข้าสู่ระบบด้วย Google” ด้านล่างเพื่อเข้าร่วม' : 'ระบบซิงก์ยังไม่ได้ตั้งค่าในเว็บนี้'}</div></div>` : '';
  if (!cfg) {
    return `<div class="card sync-card"><h2>☁️ ซิงก์ข้อมูลทุกเครื่อง</h2>${joinNote}
      <p class="small" style="margin-top:0">ตอนนี้ข้อมูลอยู่ในเครื่องนี้เท่านั้น เปิดซิงก์เพื่อให้มือถือ คอม และ iPad เห็นข้อมูลเดียวกัน โดยล็อกอินด้วยบัญชี Google</p>
      <p class="small">1) ทำตาม ${guide}<br>2) วางค่า <code>firebaseConfig</code> ที่ได้ลงในช่องนี้ แล้วกดบันทึก</p>
      <textarea id="fbCfg" placeholder='const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};' style="min-height:120px;font-family:monospace;font-size:.8rem"></textarea>
      <div class="row" style="margin-top:.5rem"><button class="btn primary" onclick="SYNC.saveConfig(document.getElementById('fbCfg').value)">บันทึกค่าตั้งค่า</button></div></div>`;
  }
  const s = S.state;
  let body = '';
  if (s === 'loading') body = `${joinNote}<p class="muted">กำลังโหลดระบบซิงก์…</p>`;
  else if (s === 'error' && !S.user) body = `<div class="advice bad"><b>เชื่อมต่อไม่สำเร็จ</b><div class="small">${esc(S.error)}</div></div><div class="row" style="margin-top:.5rem"><button class="btn ro-ok" onclick="SYNC.signIn()">ลองล็อกอินอีกครั้ง</button><button class="btn ro-ok" onclick="location.reload()">รีโหลดหน้า</button></div>`;
  else if (!S.user) body = `${joinNote}<p class="small" style="margin-top:0">ล็อกอินด้วยบัญชี Google เดียวกันในทุกเครื่อง ข้อมูลจะตรงกันอัตโนมัติ</p>
      <button class="btn primary ro-ok" onclick="SYNC.signIn()"><span style="font-weight:700">G</span>&nbsp; เข้าสู่ระบบด้วย Google</button>`;
  else {
    const st = { synced: ['good', '✅ ซิงก์แล้ว'], syncing: ['', '⏳ กำลังซิงก์…'], connecting: ['', '⏳ กำลังเชื่อมต่อ…'], offline: ['warn', '⚠️ ออฟไลน์ — บันทึกต่อได้ จะซิงก์เมื่อมีอินเทอร์เน็ต'], error: ['bad', '❌ ' + S.error] }[s] || ['', s];
    const farms = Object.entries(S.myFarms);
    body = `<div class="row" style="gap:.6rem;align-items:center">
        ${S.user.photoURL ? `<img src="${esc(S.user.photoURL)}" alt="" width="36" height="36" style="border-radius:50%" referrerpolicy="no-referrer">` : ''}
        <div class="grow"><b>${esc(S.user.displayName || '')}</b><div class="small muted">${esc(S.user.email || '')}</div></div>
        <button class="btn small ro-ok" onclick="SYNC.signOut()">ออกจากระบบ</button></div>
      <div class="advice ${st[0]}" style="margin-top:.6rem"><b>${esc(st[1])}</b>${S.lastSync && s === 'synced' ? `<div class="small">ซิงก์ล่าสุด ${S.lastSync.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</div>` : ''}</div>
      ${farms.length > 1 ? `<label class="field" style="margin-top:.7rem"><span>สวนที่เปิดอยู่</span><select class="ro-ok" onchange="SYNC.switchFarm(this.value)">${farms.map(([id, f]) => `<option value="${id}" ${id === S.farmId ? 'selected' : ''}>${esc(f.name)} — ${esc(ROLE_LABEL[f.role] || '')}</option>`).join('')}</select></label>` : ''}
      ${S.ready && canMoney() ? `<h3 style="margin-top:1rem">📁 Google Drive</h3>
      <p class="small muted" style="margin-top:0">สำรองข้อมูลสวนนี้เป็นไฟล์ลงโฟลเดอร์ “${DRIVE_FOLDER_NAME}” ใน Drive ของคุณเอง (เมื่อเชื่อมแล้ว จะสำรองอัตโนมัติวันละครั้งตอนเปิดแอป) · สำรองล่าสุด: <b>${ago(lastBackup())}</b></p>
      <div class="row">
        <button class="btn ro-ok" ${S.drive.busy ? 'disabled' : ''} onclick="SYNC.driveBackup()">☁️ สำรองลง Drive ตอนนี้</button>
        ${canEdit() ? `<button class="btn" ${S.drive.busy ? 'disabled' : ''} onclick="SYNC.driveRestoreList()">⤵ กู้คืนจาก Drive</button>` : ''}
        <button class="btn ro-ok" ${S.drive.busy ? 'disabled' : ''} onclick="SYNC.driveSheet()">📊 บัญชี → Google Sheets</button>
      </div>
      ${S.drive.msg ? `<p class="small" style="margin:.5rem 0 0">${esc(S.drive.msg)} ${S.drive.link ? `<a href="${esc(S.drive.link)}" target="_blank" rel="noopener">เปิด →</a>` : ''}</p>` : ''}` : ''}`;
  }
  return `<div class="card sync-card"><h2>☁️ ซิงก์ข้อมูลทุกเครื่อง</h2>${body}
    <p class="small muted" style="margin:.8rem 0 0">${from === 'local' ? `ค่าตั้งค่า Firebase บันทึกไว้ในเครื่องนี้ · <a href="#settings" onclick="event.preventDefault();SYNC.clearConfig()">ล้างค่า</a> · ` : ''}${guide}</p></div>
    ${S.ready && S.farm ? membersCardHtml() : ''}`;
}
function membersCardHtml() {
  const members = Object.entries(S.farm.members || {}).sort((a, b) => (b[1].role === 'owner') - (a[1].role === 'owner') || (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  const owner = isOwner();
  const mine = me();
  const memberRow = ([uid, m]) => `<li>
      ${m.photo ? `<img src="${esc(m.photo)}" alt="" width="32" height="32" style="border-radius:50%;flex:none" referrerpolicy="no-referrer">` : '<span style="font-size:1.6rem;line-height:1">👤</span>'}
      <div class="grow"><b>${esc(m.name)}</b>${uid === S.user.uid ? ' <span class="small muted">(คุณ)</span>' : ''}<div class="small muted">${esc(m.email || '')}</div>
        ${owner && m.role !== 'owner' ? `<div class="row" style="gap:.4rem;margin-top:.3rem">
          <select class="ro-ok" style="width:auto;padding:.2rem .4rem" onchange="SYNC.setRole('${uid}',this.value)">${['editor', 'viewer'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
          <label class="inline-check small"><input type="checkbox" class="ro-ok" ${m.money ? 'checked' : ''} onchange="SYNC.setMoney('${uid}',this.checked)" style="width:auto"> เห็นบัญชีเงิน</label>
          <button class="btn small danger ro-ok" onclick="SYNC.removeMember('${uid}')">นำออก</button></div>`
          : `<div class="small"><span class="pill ${m.role === 'owner' ? 'good' : ''}">${ROLE_LABEL[m.role]}</span> ${m.role !== 'owner' ? `<span class="pill">${m.money ? '💰 เห็นบัญชีเงิน' : '🚫 ไม่เห็นบัญชีเงิน'}</span>` : ''}</div>`}
      </div></li>`;
  const inv = S.newInvite;
  return `<div class="card members-card"><h2>👥 สมาชิกสวน “${esc(S.farm.name)}”</h2>
    <p class="small muted" style="margin-top:0">สิทธิ์ของคุณ: <b>${ROLE_LABEL[mine.role]}</b>${mine.role !== 'owner' ? ` · ${canMoney() ? 'เห็นบัญชีเงิน' : 'ไม่เห็นบัญชีเงิน'}` : ''}</p>
    <ul class="list">${members.map(memberRow).join('')}</ul>
    ${owner ? `<h3 style="margin-top:1rem">🔗 เชิญคนเข้าสวน</h3>
      <div class="row" style="gap:.5rem">
        <select id="invRole" class="ro-ok" style="width:auto"><option value="editor">บันทึก/แก้ไขได้</option><option value="viewer">ดูอย่างเดียว</option></select>
        <label class="inline-check small"><input type="checkbox" id="invMoney" class="ro-ok" style="width:auto"> เห็นบัญชีเงิน</label>
        <button class="btn primary ro-ok" onclick="SYNC.createInvite(document.getElementById('invRole').value, document.getElementById('invMoney').checked)">สร้างลิงก์เชิญ</button>
      </div>
      ${inv ? `<div class="advice good" style="margin-top:.6rem"><b>ลิงก์เชิญใหม่ (${ROLE_LABEL[inv.role]} · ${inv.money ? 'เห็นบัญชีเงิน' : 'ไม่เห็นบัญชีเงิน'} · หมดอายุใน ${INVITE_DAYS} วัน)</b>
        <input readonly class="ro-ok" id="invLink" value="${esc(inv.link)}" onclick="this.select()" style="margin:.4rem 0;font-size:.85rem">
        <div class="row" style="gap:.4rem"><button class="btn small ro-ok" onclick="SYNC.copyInvite()">📋 คัดลอก</button>${navigator.share ? '<button class="btn small ro-ok" onclick="SYNC.shareInvite()">📤 แชร์ (LINE ฯลฯ)</button>' : ''}</div>
        <div class="small muted" style="margin-top:.3rem">ส่งลิงก์นี้ให้คนที่ต้องการ เขาเปิดลิงก์แล้วล็อกอินด้วย Google ก็เข้าสวนได้ (ใช้ได้หลายคน จนกว่าจะหมดอายุหรือกดยกเลิก)</div></div>` : ''}
      ${S.invites.length ? `<p class="small" style="margin:.8rem 0 .3rem"><b>ลิงก์ที่ยังใช้ได้</b></p><ul class="list">${S.invites.map(i => `<li><span class="grow small">${ROLE_LABEL[i.role]} · ${i.money ? 'เห็นบัญชีเงิน' : 'ไม่เห็นบัญชีเงิน'} · เหลือ ${daysLeft(i.expiresAt)} วัน</span>
        <button class="btn small ro-ok" onclick="SYNC.copyInvite('${i.code}')" title="คัดลอกลิงก์">📋</button><button class="btn small danger ro-ok" onclick="SYNC.revokeInvite('${i.code}')">ยกเลิก</button></li>`).join('')}</ul>` : ''}`
      : `<button class="btn small danger ro-ok" style="margin-top:.6rem" onclick="SYNC.leaveFarm()">ออกจากสวนนี้</button>`}
  </div>`;
}

// ---------- คำสั่งจากหน้าเว็บ ----------
window.SYNC = {
  get signedIn() { return !!S.user && S.ready; },
  get canEdit() { return canEdit(); },
  get canSeeMoney() { return canMoney(); },
  get isGroup() { return S.ready && Object.keys(S.farm?.members || {}).length > 1; },
  get me() { return S.user ? (S.user.displayName || S.user.email || '') : ''; },
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
    localStorage.removeItem(CFG_KEY); localStorage.removeItem(ACTIVE_KEY); location.reload();
  },
  async signIn() {
    if (!S.auth) return init();
    try {
      setState('connecting'); rerender();
      await S.fb.signInWithPopup(S.auth, new S.fb.GoogleAuthProvider());
    } catch (e) { S.state = S.user ? S.state : 'error'; S.error = fbError(e); rerender(); t(fbError(e)); }
  },
  async signOut() {
    if (!confirm('ออกจากระบบ? ข้อมูลยังอยู่ในเครื่องนี้และบนคลาวด์ แต่จะไม่ซิงก์จนกว่าจะล็อกอินใหม่')) return;
    await signOutNow(); t('ออกจากระบบแล้ว');
  },
  async switchFarm(id) {
    if (!S.myFarms[id] || id === S.farmId) return;
    await pushNow();
    try { await connectFarm(id, 'switch'); t(`เปิดสวน “${S.myFarms[id]?.name || ''}” แล้ว`); } catch (e) { setState('error', fbError(e)); rerender(); }
  },
  async createInvite(roleSel, money) {
    if (!isOwner()) return;
    const code = randomCode();
    const data = { role: roleSel === 'viewer' ? 'viewer' : 'editor', money: !!money, farmName: S.farm.name, createdBy: S.user.uid, createdAt: Date.now(), expiresAt: Date.now() + INVITE_DAYS * 86400000, revoked: false };
    try {
      await S.fb.setDoc(F.invite(S.farmId, code), data);
      S.newInvite = { ...data, code, link: inviteLink(S.farmId, code) };
      await loadInvites();
    } catch (e) { t('สร้างลิงก์ไม่สำเร็จ: ' + fbError(e)); }
  },
  async copyInvite(code) {
    const link = code ? inviteLink(S.farmId, code) : S.newInvite?.link;
    if (!link) return;
    try { await navigator.clipboard.writeText(link); t('คัดลอกลิงก์แล้ว'); }
    catch { window.prompt('คัดลอกลิงก์นี้', link); }
  },
  async shareInvite() {
    const link = S.newInvite?.link;
    if (!link) return;
    try { await navigator.share({ title: 'เชิญเข้าร่วมสวน', text: `เชิญเข้าร่วมสวน “${S.farm?.name || ''}” ในแอปสมุดสวน`, url: link }); } catch { /* ผู้ใช้ยกเลิก */ }
  },
  async revokeInvite(code) {
    if (!confirm('ยกเลิกลิงก์นี้? คนที่ยังไม่ได้กดลิงก์จะเข้าไม่ได้ (คนที่เข้ามาแล้วยังอยู่)')) return;
    try {
      await S.fb.deleteDoc(F.invite(S.farmId, code));
      if (S.newInvite?.code === code) S.newInvite = null;
      await loadInvites(); t('ยกเลิกลิงก์แล้ว');
    } catch (e) { t('ยกเลิกไม่สำเร็จ: ' + fbError(e)); }
  },
  async setRole(uid, r) {
    try { await S.fb.updateDoc(F.farm(S.farmId), { [`members.${uid}.role`]: r === 'viewer' ? 'viewer' : 'editor' }); t('เปลี่ยนสิทธิ์แล้ว'); } catch (e) { t('เปลี่ยนสิทธิ์ไม่สำเร็จ: ' + fbError(e)); rerender(); }
  },
  async setMoney(uid, on) {
    try { await S.fb.updateDoc(F.farm(S.farmId), { [`members.${uid}.money`]: !!on }); t(on ? 'ให้เห็นบัญชีเงินแล้ว' : 'ซ่อนบัญชีเงินแล้ว'); } catch (e) { t('เปลี่ยนสิทธิ์ไม่สำเร็จ: ' + fbError(e)); rerender(); }
  },
  async removeMember(uid) {
    const m = S.farm.members[uid];
    if (!confirm(`นำ “${m?.name || ''}” ออกจากสวน? เขาจะเห็นข้อมูลสวนนี้ไม่ได้อีก`)) return;
    try { await S.fb.updateDoc(F.farm(S.farmId), { [`members.${uid}`]: S.fb.deleteField() }); t('นำออกแล้ว'); } catch (e) { t('นำออกไม่สำเร็จ: ' + fbError(e)); }
  },
  async leaveFarm() {
    if (!confirm(`ออกจากสวน “${S.farm?.name || ''}”? คุณจะเห็นข้อมูลสวนนี้ไม่ได้อีก จนกว่าจะได้รับเชิญใหม่`)) return;
    const id = S.farmId;
    try {
      stopListeners();
      await S.fb.updateDoc(F.farm(id), { [`members.${S.user.uid}`]: S.fb.deleteField() });
      await dropFarm(id);
      t('ออกจากสวนแล้ว');
    } catch (e) { t('ออกจากสวนไม่สำเร็จ: ' + fbError(e)); listen(id); }
  },
  driveBackup() { driveAction('กำลังสำรองข้อมูล', tk => backup(tk)); },
  driveRestoreList() {
    if (!canEdit()) return t('ดูอย่างเดียว — กู้คืนข้อมูลไม่ได้');
    driveAction('กำลังโหลดรายการไฟล์สำรอง', async tk => {
      const folder = await driveFolder(tk);
      const q = `'${folder}' in parents and trashed=false and mimeType='application/json'`;
      const j = await (await gapi(tk, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=30&fields=files(id,name,modifiedTime,size)`)).json();
      S.drive.msg = '';
      const files = j.files || [];
      window.openModal('กู้คืนจาก Google Drive', files.length
        ? `<p class="small muted" style="margin-top:0">เลือกไฟล์ที่ต้องการ ข้อมูลของสวนที่เปิดอยู่ (ทุกเครื่อง ทุกสมาชิก) จะถูกแทนที่ด้วยไฟล์นี้</p><ul class="list">${files.map(f => `<li><span class="grow">${esc(f.name)}<div class="small muted">แก้ไข ${new Date(f.modifiedTime).toLocaleString('th-TH')} · ${Math.round((+f.size || 0) / 1024)} KB</div></span><button type="button" class="btn small" onclick="SYNC.driveRestore('${f.id}')">กู้คืน</button></li>`).join('')}</ul>`
        : '<div class="empty">ยังไม่มีไฟล์สำรองในโฟลเดอร์นี้</div>', () => true, 'ปิด');
    });
  },
  driveRestore(id) {
    if (!confirm('กู้คืนจากไฟล์นี้? ข้อมูลของสวนที่เปิดอยู่ในทุกเครื่องจะถูกแทนที่')) return;
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
    if (!canMoney()) return;
    driveAction('กำลังสร้างไฟล์ Google Sheets', async tk => {
      const folder = await driveFolder(tk);
      const name = `บัญชี-${safeName(S.farm?.name)}-${window.todayStr()}`;
      const f = await driveUpload(tk, { name, parents: [folder], mimeType: 'application/vnd.google-apps.spreadsheet' }, window.financeCsv(), 'text/csv; charset=UTF-8');
      S.drive.msg = '✅ สร้างไฟล์บัญชีใน Google Sheets แล้ว'; S.drive.link = f.webViewLink || '';
      if (location.hash !== '#settings') {
        window.openModal('เปิดใน Google Sheets', `<p>สร้างไฟล์ “${esc(name)}” ในโฟลเดอร์ ${DRIVE_FOLDER_NAME} แล้ว</p>${f.webViewLink ? `<a class="btn primary ro-ok" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">เปิดไฟล์ →</a>` : ''}`, () => true, 'ปิด');
      }
    });
  },
};
// ก่อนปิดหน้า ส่งการแก้ไขที่ค้างอยู่ทันที
addEventListener('pagehide', () => { if (S.timer) pushNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.timer) pushNow(); });
addEventListener('online', () => { if (S.user) { if (!S.ready) onSignedIn(S.user); else updateBadge(); } });
addEventListener('offline', () => { if (S.user) setState('offline'); });
// เปิดลิงก์เชิญขณะแอปเปิดอยู่แล้ว
addEventListener('hashchange', () => {
  const j = captureJoinHash();
  if (!j) return;
  if (S.user && S.ready) { sessionStorage.removeItem(JOIN_KEY); handleJoin(j); }
  else window.render?.();
});

if (!window.__SUAN_NO_AUTO_INIT) init();
