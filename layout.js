/* สมุดสวน — หน้า "ผังสวน" (blueprint): ออกแบบตำแหน่งต้นไม้ ระยะห่าง และแนวท่อน้ำของแต่ละแปลง
 * หน่วยทั้งหมดเป็นเมตร · มุมซ้ายบนของแปลง = (0,0) · แกน x ไปทางขวา (กว้าง) แกน y ลงล่าง (ยาว) · ทิศเหนืออยู่ด้านบน
 */
'use strict';

const PIPE_TYPES = {
  main: { label: 'ท่อเมน', color: '#4dd0e1', px: 6, d: 50, unit: 'stick' },
  sub: { label: 'ท่อแยก', color: '#90caf9', px: 4, d: 25, unit: 'stick' },
  drip: { label: 'สายน้ำหยด/สายไมโคร', color: '#e1f5fe', px: 2.5, d: 16, unit: 'roll', dash: '7 5' },
};
const ITEM_TYPES = {
  pump: { label: 'ปั๊มน้ำ', icon: '⚙️' }, valve: { label: 'วาล์ว', icon: '🔘' }, sprinkler: { label: 'หัวสปริงเกอร์', icon: '💧' },
  filter: { label: 'กรองน้ำ', icon: '🧽' }, tank: { label: 'ถังน้ำ', icon: '🛢️' }, pond: { label: 'บ่อ/สระน้ำ', icon: '🌊' },
  house: { label: 'บ้าน/โรงเรือน', icon: '🏠' }, gate: { label: 'ทางเข้า', icon: '🚪' },
};
const TREE_STATES = {
  ok: { label: 'ปกติ', color: '#66bb6a' }, new: { label: 'ปลูกใหม่/ปลูกซ่อม', color: '#4fc3f7' },
  sick: { label: 'มีอาการ', color: '#ffca28' }, dead: { label: 'ตาย/ต้องปลูกซ่อม', color: '#ef5350' },
};
const LY_TOOLS = [
  ['select', '✋', 'เลือก/ย้าย'], ['tree', '🌳', 'ต้นไม้'], ['main', '━', 'ท่อเมน'], ['sub', '─', 'ท่อแยก'], ['drip', '┄', 'สายน้ำหยด'],
  ['item:sprinkler', '💧', 'หัวน้ำ'], ['item:valve', '🔘', 'วาล์ว'], ['item:pump', '⚙️', 'ปั๊ม'], ['measure', '📏', 'วัดระยะ'], ['erase', '🧹', 'ลบ'],
];
const EDIT_TOOLS = new Set(['tree', 'main', 'sub', 'drip', 'erase']);
const LY = {
  plot: '', tool: 'select', sel: null, draft: null, measure: null, cursor: null,
  snap: true, labels: false, dims: false, views: {}, hist: {}, ptrs: new Map(), down: null, pinch: null,
  auto: null, msg: '',
};

// ---------- ข้อมูล ----------
function lyRound(v) { return Math.round(v * 100) / 100; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function pipeLen(p) { let s = 0; for (let i = 1; i < p.pts.length; i++) s += dist(p.pts[i - 1], p.pts[i]); return s; }
function parseSpacing(s) { const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*[x×*X]\s*(\d+(?:\.\d+)?)/); return m ? [+m[1], +m[2]] : null; }
function defaultSize(p) {
  const sqm = areaWa(p) * SQM_PER_WA;
  if (!sqm) return [40, 40];
  const w = Math.max(5, Math.round(Math.sqrt(sqm * 1.25)));
  return [w, Math.max(5, Math.round(sqm / w))];
}
function getLayout(plotId, create = false) {
  if (!Array.isArray(DB.layouts)) DB.layouts = [];
  let L = DB.layouts.find(l => l.plotId === plotId);
  if (!L && create) {
    const p = plotById(plotId);
    const [w, h] = defaultSize(p);
    const sp = parseSpacing(p?.spacing) || [8, 8];
    L = { id: 'L' + plotId, plotId, w, h, canopy: Math.min(sp[0], sp[1]) * 0.75, perTree: 1, trees: [], pipes: [], items: [], updatedAt: Date.now() };
    DB.layouts.push(L);
  }
  if (L) { L.trees ||= []; L.pipes ||= []; L.items ||= []; L.canopy ||= 4; if (L.perTree == null) L.perTree = 1; }
  return L;
}
function curLayout() { return getLayout(LY.plot, true); }
function snapshot(L) { return JSON.stringify({ w: L.w, h: L.h, canopy: L.canopy, perTree: L.perTree, trees: L.trees, pipes: L.pipes, items: L.items }); }
function pushHist(L, snap = snapshot(L)) {
  const h = (LY.hist[L.plotId] ||= []);
  h.push(snap); if (h.length > 60) h.shift();
}
function commit(L) { L.updatedAt = Date.now(); save(); lyRefresh(); }
function mutate(fn) {
  if (!canEdit()) { toast('👁 ดูอย่างเดียว — แก้ผังไม่ได้'); return; }
  const L = curLayout();
  pushHist(L);
  fn(L);
  commit(L);
}
window.lyUndo = () => {
  const L = curLayout(), h = LY.hist[L.plotId];
  if (!h?.length || !canEdit()) return toast('ไม่มีอะไรให้ย้อนกลับ');
  Object.assign(L, JSON.parse(h.pop()));
  LY.sel = null; commit(L); toast('ย้อนกลับแล้ว');
};

// ---------- คำนวณ ----------
function nearestTrees(trees, t, k = 4) {
  const ds = [];
  for (const o of trees) if (o !== t) ds.push([dist([t.x, t.y], [o.x, o.y]), o]);
  ds.sort((a, b) => a[0] - b[0]);
  if (!ds.length) return [];
  const lim = ds[0][0] * 1.5 + 0.01;
  return ds.filter(d => d[0] <= lim).slice(0, k);
}
function medianSpacing(trees) {
  if (trees.length < 2) return null;
  const sample = trees.length > 1500 ? trees.filter((_, i) => i % Math.ceil(trees.length / 1500) === 0) : trees;
  const nn = sample.map(t => { let m = Infinity; for (const o of trees) if (o !== t) { const d = (t.x - o.x) ** 2 + (t.y - o.y) ** 2; if (d < m) m = d; } return Math.sqrt(m); }).sort((a, b) => a - b);
  return nn[Math.floor(nn.length / 2)];
}
function autoPositions(w, h, dx, dy, m, pattern) {
  const out = [];
  if (!(dx > 0 && dy > 0)) return out;
  let r = 0;
  for (let y = m; y <= h - m + 1e-6 && r < 1000; y += dy, r++) {
    const off = pattern === 'tri' && r % 2 ? dx / 2 : 0;
    let c = 0;
    for (let x = m + off; x <= w - m + 1e-6 && c < 1000; x += dx, c++) out.push({ x: lyRound(x), y: lyRound(y), label: `${r + 1}-${c + 1}` });
  }
  return out;
}
function rowsOf(trees) {
  const rows = new Map();
  trees.forEach(t => { const k = Math.round(t.y * 10) / 10; (rows.get(k) || rows.set(k, []).get(k)).push(t); });
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([y, ts]) => ({ y, ts: ts.sort((a, b) => a.x - b.x) }));
}
function summary(L) {
  const st = {}; Object.keys(TREE_STATES).forEach(k => { st[k] = 0; });
  L.trees.forEach(t => { st[t.state || 'ok']++; });
  const pipes = {};
  L.pipes.forEach(p => { const k = `${p.type}|${p.d || PIPE_TYPES[p.type].d}`; pipes[k] = (pipes[k] || 0) + pipeLen(p); });
  const items = {}; L.items.forEach(i => { items[i.type] = (items[i.type] || 0) + 1; });
  const sqm = L.w * L.h;
  return { n: L.trees.length, st, pipes, items, sqm, rai: sqm / 1600, spacing: medianSpacing(L.trees), tees: L.pipes.filter(p => p.type !== 'main').length };
}

// ---------- วาด SVG ----------
function textSize(L) { return Math.min(3, Math.max(0.45, Math.max(L.w, L.h) / 45)); }
function gridStep(L) { const m = Math.max(L.w, L.h); return m <= 80 ? 1 : m <= 300 ? 5 : 10; }
function niceScale(L) { const target = Math.max(L.w, L.h) / 5; return [1, 2, 5, 10, 20, 50, 100, 200, 500].find(v => v >= target * 0.6) || 500; }
function lyDefs(L, pfx) {
  const g = gridStep(L), G = g * 5;
  return `<defs>
    <pattern id="${pfx}m" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="M ${g} 0 L 0 0 0 ${g}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1" vector-effect="non-scaling-stroke"/></pattern>
    <pattern id="${pfx}M" width="${G}" height="${G}" patternUnits="userSpaceOnUse"><rect width="${G}" height="${G}" fill="url(#${pfx}m)"/><path d="M ${G} 0 L 0 0 0 ${G}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1" vector-effect="non-scaling-stroke"/></pattern>
  </defs>`;
}
function lyBody(L, { editor = false } = {}) {
  const fs = textSize(L), w = L.w, h = L.h, ns = 'vector-effect="non-scaling-stroke"';
  const font = `font-family="Sarabun, 'Noto Sans Thai', sans-serif"`;
  let s = `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#${editor ? 'lyg' : 'lyx'}M)"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#ffffff" stroke-width="2.5" ${ns}/>`;
  // ขนาดขอบ
  s += `<g fill="#cfe3ff" font-size="${fs}" ${font} text-anchor="middle">
    <line x1="0" y1="${-fs * 1.4}" x2="${w}" y2="${-fs * 1.4}" stroke="#cfe3ff" stroke-width="1" ${ns}/>
    <line x1="0" y1="${-fs * 1.9}" x2="0" y2="${-fs * 0.9}" stroke="#cfe3ff" stroke-width="1" ${ns}/><line x1="${w}" y1="${-fs * 1.9}" x2="${w}" y2="${-fs * 0.9}" stroke="#cfe3ff" stroke-width="1" ${ns}/>
    <text x="${w / 2}" y="${-fs * 1.75}">${fmtNum(w, 1)} ม.</text>
    <line x1="${-fs * 1.4}" y1="0" x2="${-fs * 1.4}" y2="${h}" stroke="#cfe3ff" stroke-width="1" ${ns}/>
    <line x1="${-fs * 1.9}" y1="0" x2="${-fs * 0.9}" y2="0" stroke="#cfe3ff" stroke-width="1" ${ns}/><line x1="${-fs * 1.9}" y1="${h}" x2="${-fs * 0.9}" y2="${h}" stroke="#cfe3ff" stroke-width="1" ${ns}/>
    <text x="${-fs * 1.75}" y="${h / 2}" transform="rotate(-90 ${-fs * 1.75} ${h / 2})">${fmtNum(h, 1)} ม.</text></g>`;
  // ทิศเหนือ + สเกล
  const nx = w + fs * 2.2, ny = fs * 0.5;
  s += `<g ${font}><path d="M ${nx} ${ny} l ${fs * 0.7} ${fs * 2} l ${-fs * 0.7} ${-fs * 0.6} l ${-fs * 0.7} ${fs * 0.6} z" fill="#ffffff"/><text x="${nx}" y="${ny + fs * 3.2}" font-size="${fs}" fill="#ffffff" text-anchor="middle" font-weight="700">N</text></g>`;
  const sc = niceScale(L), sy = h + fs * 2.2;
  s += `<g ${font}><rect x="0" y="${sy}" width="${sc / 2}" height="${fs * 0.45}" fill="#ffffff"/><rect x="${sc / 2}" y="${sy}" width="${sc / 2}" height="${fs * 0.45}" fill="none" stroke="#ffffff" stroke-width="1" ${ns}/>
    <text x="0" y="${sy + fs * 1.6}" font-size="${fs * 0.85}" fill="#ffffff">0</text><text x="${sc}" y="${sy + fs * 1.6}" font-size="${fs * 0.85}" fill="#ffffff" text-anchor="middle">${sc} ม.</text></g>`;
  // ท่อ
  for (const p of L.pipes) {
    const T = PIPE_TYPES[p.type] || PIPE_TYPES.sub;
    const pts = p.pts.map(q => q.join(',')).join(' ');
    s += `<g data-k="pipe" data-id="${p.id}">${editor ? `<polyline points="${pts}" fill="none" stroke="transparent" stroke-width="18" ${ns} stroke-linecap="round"/>` : ''}<polyline points="${pts}" fill="none" stroke="${T.color}" stroke-width="${T.px}" ${ns} stroke-linecap="round" stroke-linejoin="round" ${T.dash ? `stroke-dasharray="${T.dash}"` : ''}/></g>`;
  }
  // ต้นไม้
  const cr = L.canopy / 2, tr = Math.max(0.12, Math.min(0.35, cr * 0.15));
  for (const t of L.trees) {
    const c = TREE_STATES[t.state || 'ok']?.color || '#66bb6a';
    s += `<g data-k="tree" data-id="${t.id}" transform="translate(${t.x} ${t.y})"><circle r="${cr}" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="1.5" ${ns}/><circle r="${tr}" fill="${c}"/>${t.state === 'dead' ? `<path d="M ${-cr * .5} ${-cr * .5} L ${cr * .5} ${cr * .5} M ${cr * .5} ${-cr * .5} L ${-cr * .5} ${cr * .5}" stroke="#ef5350" stroke-width="2" ${ns}/>` : ''}${LY.labels || !editor ? `<text y="${cr + fs * 0.9}" font-size="${fs * 0.75}" fill="#e3f2fd" text-anchor="middle" ${font}>${esc(t.label || '')}</text>` : ''}</g>`;
  }
  // อุปกรณ์
  for (const it of L.items) {
    const T = ITEM_TYPES[it.type] || ITEM_TYPES.valve, r = fs * 0.85;
    s += `<g data-k="item" data-id="${it.id}" transform="translate(${it.x} ${it.y})"><circle r="${r}" fill="#0d47a1" stroke="#ffffff" stroke-width="1.5" ${ns}/><text font-size="${r * 1.15}" text-anchor="middle" dominant-baseline="central">${T.icon}</text>${it.label ? `<text y="${r + fs * 0.9}" font-size="${fs * 0.75}" fill="#ffffff" text-anchor="middle" ${font}>${esc(it.label)}</text>` : ''}</g>`;
  }
  return s;
}
function dimLine(a, b, fs, color = '#ffeb3b') {
  const d = dist(a, b); if (d < 1e-6) return '';
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, txt = `${fmtNum(d, 1)} ม.`;
  const tw = fs * 0.55 * txt.length * 0.6 + fs * 0.4;
  return `<g pointer-events="none"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="1.6" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>
    <rect x="${mx - tw / 2}" y="${my - fs * 0.5}" width="${tw}" height="${fs}" rx="${fs * 0.25}" fill="#0b2545" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke"/>
    <text x="${mx}" y="${my}" font-size="${fs * 0.62}" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="Sarabun, sans-serif">${txt}</text></g>`;
}
function lyOverlay(L) {
  const fs = textSize(L);
  let s = '';
  // ระยะทั้งผัง: ระยะจากต้นแรกไปต้นถัดไปในแถวและแถวถัดไป
  if (LY.dims && L.trees.length > 1) {
    const rows = rowsOf(L.trees);
    rows.slice(0, 1).forEach(r => { if (r.ts.length > 1) s += dimLine([r.ts[0].x, r.ts[0].y], [r.ts[1].x, r.ts[1].y], fs, '#80deea'); });
    if (rows.length > 1) { const a = rows[0].ts[0], b = rows[1].ts.reduce((m, t) => dist([a.x, a.y], [t.x, t.y]) < dist([a.x, a.y], [m.x, m.y]) ? t : m); s += dimLine([a.x, a.y], [b.x, b.y], fs, '#80deea'); }
  }
  const sel = LY.sel;
  if (sel?.k === 'tree') {
    const t = L.trees.find(x => x.id === sel.id);
    if (t) {
      nearestTrees(L.trees, t).forEach(([, o]) => { s += dimLine([t.x, t.y], [o.x, o.y], fs); });
      s += `<circle cx="${t.x}" cy="${t.y}" r="${L.canopy / 2 + fs * 0.25}" fill="none" stroke="#ffeb3b" stroke-width="3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
  }
  if (sel?.k === 'item') {
    const it = L.items.find(x => x.id === sel.id);
    if (it) s += `<circle cx="${it.x}" cy="${it.y}" r="${fs * 1.2}" fill="none" stroke="#ffeb3b" stroke-width="3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }
  if (sel?.k === 'pipe') {
    const p = L.pipes.find(x => x.id === sel.id);
    if (p) {
      s += `<polyline points="${p.pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="#ffeb3b" stroke-width="${(PIPE_TYPES[p.type]?.px || 4) + 4}" stroke-opacity=".45" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
      if (canEdit()) p.pts.forEach((q, i) => { s += `<circle data-k="vertex" data-id="${p.id}" data-vi="${i}" cx="${q[0]}" cy="${q[1]}" r="${fs * 0.45}" fill="#ffeb3b" stroke="#0b2545" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`; });
      for (let i = 1; i < p.pts.length; i++) s += dimLine(p.pts[i - 1], p.pts[i], fs * 0.8, '#fff59d');
    }
  }
  // ท่อที่กำลังวาด
  if (LY.draft) {
    const T = PIPE_TYPES[LY.draft.type];
    const pts = [...LY.draft.pts, ...(LY.cursor ? [LY.cursor] : [])];
    s += `<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${T.color}" stroke-width="${T.px}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${T.dash || '10 6'}" pointer-events="none"/>`;
    LY.draft.pts.forEach(q => { s += `<circle cx="${q[0]}" cy="${q[1]}" r="${fs * 0.3}" fill="${T.color}" pointer-events="none"/>`; });
    if (LY.cursor && LY.draft.pts.length) s += dimLine(LY.draft.pts.at(-1), LY.cursor, fs * 0.8, '#fff59d');
  }
  // วัดระยะ
  if (LY.measure?.length) {
    const [a, b] = LY.measure, c = b || LY.cursor;
    s += `<circle cx="${a[0]}" cy="${a[1]}" r="${fs * 0.3}" fill="#ff8a65" pointer-events="none"/>`;
    if (c) s += dimLine(a, c, fs, '#ff8a65') + `<circle cx="${c[0]}" cy="${c[1]}" r="${fs * 0.3}" fill="#ff8a65" pointer-events="none"/>`;
  }
  return s;
}

// ---------- มุมมอง ----------
function lyFitView(L, svg) {
  const fs = textSize(L), pad = Math.max(L.w, L.h) * 0.04 + fs * 3.5;
  let x = -pad, y = -pad, w = L.w + pad * 2 + fs * 2, h = L.h + pad * 2 + fs * 2;
  const cw = svg?.clientWidth || 800, ch = svg?.clientHeight || 500, a = cw / ch;
  if (w / h < a) { const nw = h * a; x -= (nw - w) / 2; w = nw; } else { const nh = w / a; y -= (nh - h) / 2; h = nh; }
  return { x, y, w, h };
}
function lySvg() { return document.getElementById('lySvg'); }
function applyView() {
  const svg = lySvg(); if (!svg) return;
  const v = LY.views[LY.plot];
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}
function worldAt(svg, cx, cy) {
  const m = svg.getScreenCTM(); if (!m) return [0, 0];
  const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
  return [p.x, p.y];
}
function zoomAt(f, cx, cy) {
  const svg = lySvg(), v = LY.views[LY.plot];
  const [wx, wy] = cx == null ? [v.x + v.w / 2, v.y + v.h / 2] : worldAt(svg, cx, cy);
  const L = curLayout(), maxW = (Math.max(L.w, L.h) + 50) * 4;
  const nw = Math.min(maxW, Math.max(2, v.w / f)), k = nw / v.w;
  LY.views[LY.plot] = { x: wx - (wx - v.x) * k, y: wy - (wy - v.y) * k, w: nw, h: v.h * k };
  applyView();
}
window.lyZoom = f => zoomAt(f);
window.lyFit = () => { LY.views[LY.plot] = lyFitView(curLayout(), lySvg()); applyView(); };

// ---------- snap ----------
function pxToWorld(px) { const svg = lySvg(), m = svg?.getScreenCTM(); return m ? px / m.a : px * 0.05; }
function snapPoint(L, p, forPipe) {
  if (forPipe) {
    const tol = pxToWorld(14);
    let best = null, bd = tol;
    const cand = [...L.trees.map(t => [t.x, t.y]), ...L.items.map(i => [i.x, i.y]), ...L.pipes.flatMap(q => q.pts), ...(LY.draft?.pts || [])];
    for (const c of cand) { const d = dist(c, p); if (d < bd) { bd = d; best = c; } }
    if (best) return [lyRound(best[0]), lyRound(best[1])];
    // ดูดเข้ากับแนวราบ/ดิ่งของจุดก่อนหน้า
    const last = LY.draft?.pts.at(-1);
    if (last) { if (Math.abs(p[0] - last[0]) < tol) p = [last[0], p[1]]; if (Math.abs(p[1] - last[1]) < tol) p = [p[0], last[1]]; }
  }
  if (LY.snap) p = [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2];
  return [lyRound(p[0]), lyRound(p[1])];
}

// ---------- หน้า ----------
PAGES.layout = () => {
  if (!DB.plots.length) return `<div class="page-head"><h1>ผังสวน</h1></div><div class="card empty">ยังไม่มีแปลง — <a href="#plots">เพิ่มแปลงปลูก</a> ก่อน แล้วกลับมาวาดผังได้เลย</div>`;
  if (!plotById(LY.plot)) LY.plot = DB.plots[0].id;
  const p = plotById(LY.plot);
  const L = getLayout(LY.plot) || { w: defaultSize(p)[0], h: defaultSize(p)[1] };
  const edit = canEdit();
  if (!edit && EDIT_TOOLS.has(LY.tool.split(':')[0]) || (!edit && LY.tool.startsWith('item'))) LY.tool = 'select';
  const tools = LY_TOOLS.filter(([k]) => edit || k === 'select' || k === 'measure');
  const others = Object.entries(ITEM_TYPES).filter(([k]) => !['sprinkler', 'valve', 'pump'].includes(k));
  queueMicrotask(lyMount);
  return `<div class="page-head"><h1>ผังสวน</h1><div class="row">
      <select style="width:auto" onchange="LY.plot=this.value;LY.sel=null;LY.draft=null;LY.measure=null;render()">${DB.plots.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="btn ro-ok" onclick="lyExportPng()">🖼️ บันทึกเป็นรูป</button></div></div>
    <div class="ly-toolbar">
      ${tools.map(([k, ic, lb]) => `<button class="ly-tool ${LY.tool === k ? 'active' : ''}" onclick="lySetTool('${k}')" title="${lb}"><span class="ic">${ic}</span><span>${lb}</span></button>`).join('')}
      ${edit ? `<select class="ly-tool-sel ${LY.tool.startsWith('item:') && others.some(([k]) => LY.tool === 'item:' + k) ? 'active' : ''}" onchange="if(this.value)lySetTool(this.value)"><option value="">อื่นๆ ▾</option>${others.map(([k, T]) => `<option value="item:${k}" ${LY.tool === 'item:' + k ? 'selected' : ''}>${T.icon} ${T.label}</option>`).join('')}</select>
        <button class="ly-tool" onclick="lyUndo()" title="ย้อนกลับ (Ctrl+Z)"><span class="ic">↶</span><span>ย้อนกลับ</span></button>` : ''}
    </div>
    <div class="ly-wrap">
      <div class="card ly-canvas-card">
        <div class="ly-hint" id="lyHint"></div>
        <svg id="lySvg" class="ly-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${lyDefs(L, 'lyg')}<g id="lyBody"></g><g id="lyOver"></g></svg>
        <div class="ly-zoom"><button onclick="lyZoom(1.3)" title="ซูมเข้า">＋</button><button onclick="lyZoom(1/1.3)" title="ซูมออก">－</button><button onclick="lyFit()" title="พอดีจอ">⤢</button></div>
        <div class="ly-draftbar" id="lyDraftBar"></div>
      </div>
      <div class="ly-side">
        <div class="card" id="lySel"></div>
        <div class="card" id="lySum"></div>
        ${edit ? `<div class="card" id="lyAuto"></div>` : ''}
        <div class="card" id="lySet"></div>
      </div>
    </div>`;
};
window.lySetTool = t => {
  if (LY.draft && LY.draft.pts.length > 1) lyFinishPipe(); else LY.draft = null;
  LY.tool = t; LY.measure = null;
  if (['main', 'sub', 'drip'].includes(t)) LY.sel = null;
  render();
};
function lyHintText() {
  const t = LY.tool;
  if (['main', 'sub', 'drip'].includes(t)) return LY.draft?.pts.length ? 'แตะเพื่อเพิ่มจุดหักของท่อ · ดับเบิลคลิก/Enter หรือกด “จบเส้นท่อ”' : `แตะจุดเริ่มต้นของ${PIPE_TYPES[t].label} (ดูดเข้าหาต้นไม้/ปลายท่อเดิมให้อัตโนมัติ)`;
  if (t === 'tree') return 'แตะตรงที่ต้องการปลูกต้นไม้ · ลากพื้นที่ว่างเพื่อเลื่อนผัง';
  if (t.startsWith('item:')) return `แตะเพื่อวาง${ITEM_TYPES[t.slice(5)].label}`;
  if (t === 'measure') return LY.measure?.length === 1 ? 'แตะจุดที่สอง' : 'แตะสองจุดเพื่อวัดระยะ';
  if (t === 'erase') return 'แตะต้นไม้ ท่อ หรืออุปกรณ์ที่ต้องการลบ';
  return 'แตะเพื่อเลือก · ลากต้นไม้/อุปกรณ์เพื่อย้าย · ลากพื้นที่ว่างเพื่อเลื่อน · ล้อเมาส์/จีบนิ้วเพื่อซูม';
}
function lyDraw() {
  const L = getLayout(LY.plot) || curLayoutView();
  const b = document.getElementById('lyBody'); if (!b) return;
  b.innerHTML = lyBody(L, { editor: true });
  lyDrawOverlay();
}
function curLayoutView() { const p = plotById(LY.plot); const [w, h] = defaultSize(p); return { w, h, canopy: 4, trees: [], pipes: [], items: [] }; }
function lyDrawOverlay() {
  const o = document.getElementById('lyOver'); if (!o) return;
  o.innerHTML = lyOverlay(getLayout(LY.plot) || curLayoutView());
  const hint = document.getElementById('lyHint'); if (hint) hint.textContent = lyHintText();
  const bar = document.getElementById('lyDraftBar');
  if (bar) {
    const d = LY.draft;
    bar.innerHTML = d ? `<span>${PIPE_TYPES[d.type].label}: <b>${fmtNum(pipeLenPts(d.pts), 1)} ม.</b> (${d.pts.length} จุด)</span><button class="btn small primary ro-ok" onclick="lyFinishPipe()">✓ จบเส้นท่อ</button><button class="btn small ro-ok" onclick="LY.draft=null;lyDrawOverlay()">ยกเลิก</button>`
      : LY.measure?.length === 2 ? `<span>📏 ระยะ: <b>${fmtNum(dist(LY.measure[0], LY.measure[1]), 2)} ม.</b></span><button class="btn small ro-ok" onclick="LY.measure=null;lyDrawOverlay()">ล้าง</button>` : '';
    bar.hidden = !bar.innerHTML;
  }
}
function pipeLenPts(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; }
function lyRefresh() { lyDraw(); lyPanels(); }

// ---------- แผงข้าง ----------
function lyPanels() {
  const p = plotById(LY.plot); if (!p) return;
  const L = getLayout(LY.plot) || curLayoutView();
  const edit = canEdit();
  const S = summary(L);
  const set = document.getElementById('lySet');
  if (set) set.innerHTML = `<h3>⚙️ ขนาดแปลงและการแสดงผล</h3>
    <div class="field-row"><label class="field"><span>กว้าง (ม.)</span><input type="number" min="2" step="0.5" value="${L.w}" ${edit ? '' : 'disabled'} onchange="lySetSize(this.value,null)"></label>
      <label class="field"><span>ยาว (ม.)</span><input type="number" min="2" step="0.5" value="${L.h}" ${edit ? '' : 'disabled'} onchange="lySetSize(null,this.value)"></label>
      <label class="field"><span>ทรงพุ่ม Ø (ม.)</span><input type="number" min="0.5" step="0.5" value="${L.canopy}" ${edit ? '' : 'disabled'} onchange="lySetCanopy(this.value)"></label></div>
    <p class="small muted" style="margin:-.3rem 0 .5rem">ผัง ${fmtNum(S.sqm)} ตร.ม. (${fmtArea(S.sqm / SQM_PER_WA)})${areaWa(p) ? ` · แปลงในระบบ ${fmtArea(areaWa(p))}${Math.abs(S.sqm - areaWa(p) * SQM_PER_WA) / (areaWa(p) * SQM_PER_WA) > 0.1 ? ' <span class="pill warn">ขนาดไม่ตรงกัน</span>' : ''}` : ''}</p>
    <label class="inline-check small"><input type="checkbox" class="ro-ok" ${LY.snap ? 'checked' : ''} onchange="LY.snap=this.checked"> ดูดเข้าตาราง 0.5 ม.</label>
    <label class="inline-check small"><input type="checkbox" class="ro-ok" ${LY.labels ? 'checked' : ''} onchange="LY.labels=this.checked;lyDraw()"> แสดงหมายเลขต้น</label>
    <label class="inline-check small"><input type="checkbox" class="ro-ok" ${LY.dims ? 'checked' : ''} onchange="LY.dims=this.checked;lyDrawOverlay()"> แสดงระยะระหว่างต้น/แถว</label>
    <div class="ly-legend small">${Object.entries(PIPE_TYPES).map(([, T]) => `<span><i style="background:${T.color}"></i>${T.label}</span>`).join('')}${Object.entries(TREE_STATES).map(([, T]) => `<span><i style="background:${T.color};border-radius:50%"></i>${T.label}</span>`).join('')}</div>`;
  const auto = document.getElementById('lyAuto');
  if (auto) {
    const sp = parseSpacing(p.spacing) || [8, 8];
    const A = (LY.auto && LY.auto.plot === p.id) ? LY.auto : (LY.auto = { plot: p.id, dx: sp[0], dy: sp[1], m: Math.min(sp[0], sp[1]) / 2, pattern: 'square', lat: 'drip' });
    const n = autoPositions(L.w, L.h, A.dx, A.dy, A.m, A.pattern).length;
    auto.innerHTML = `<h3>🌳 ปลูกตามระยะอัตโนมัติ</h3>
      <div class="field-row"><label class="field"><span>ระยะระหว่างต้น (ม.)</span><input type="number" min="0.5" step="0.5" value="${A.dx}" oninput="LY.auto.dx=+this.value;lyAutoCount()"></label>
        <label class="field"><span>ระยะระหว่างแถว (ม.)</span><input type="number" min="0.5" step="0.5" value="${A.dy}" oninput="LY.auto.dy=+this.value;lyAutoCount()"></label></div>
      <div class="field-row"><label class="field"><span>ระยะห่างจากขอบ (ม.)</span><input type="number" min="0" step="0.5" value="${A.m}" oninput="LY.auto.m=+this.value;lyAutoCount()"></label>
        <label class="field"><span>รูปแบบ</span><select onchange="LY.auto.pattern=this.value;lyAutoCount()"><option value="square" ${A.pattern === 'square' ? 'selected' : ''}>สี่เหลี่ยม</option><option value="tri" ${A.pattern === 'tri' ? 'selected' : ''}>สามเหลี่ยม (สลับฟันปลา)</option></select></label></div>
      <button class="btn primary" onclick="lyAutoPlant()">ปลูก <b id="lyAutoN">${fmtNum(n)}</b> ต้นตามระยะนี้</button>
      <p class="small muted" style="margin:.4rem 0 0">${L.trees.length ? 'จะแทนที่ต้นไม้เดิมทั้งหมดในผัง (ย้อนกลับได้)' : ''}</p>
      <h3 style="margin-top:1rem">💧 เดินท่ออัตโนมัติตามแถว</h3>
      <label class="field"><span>ท่อย่อยตามแถวใช้</span><select onchange="LY.auto.lat=this.value"><option value="drip" ${A.lat === 'drip' ? 'selected' : ''}>สายน้ำหยด/สายไมโคร</option><option value="sub" ${A.lat === 'sub' ? 'selected' : ''}>ท่อแยก (PVC/PE)</option></select></label>
      <button class="btn" onclick="lyAutoPipes()" ${L.trees.length ? '' : 'disabled'}>เดินท่อเมน + ท่อย่อยทุกแถว</button>
      <p class="small muted" style="margin:.4rem 0 0">ท่อเมนเลียบขอบซ้าย ต่อท่อย่อยไปทุกแถว พร้อมปั๊มและวาล์วต้นทาง · แทนที่เฉพาะท่อที่สร้างอัตโนมัติ ย้าย/แก้ทีละเส้นได้ภายหลัง</p>`;
  }
  const sum = document.getElementById('lySum');
  if (sum) {
    const pipeRows = Object.entries(S.pipes).sort().map(([k, len]) => {
      const [type, d] = k.split('|'), T = PIPE_TYPES[type], buy = len * 1.05;
      return `<tr><td><i class="ly-sw" style="background:${T.color}"></i>${T.label} Ø${d} มม.</td><td class="num">${fmtNum(len, 1)} ม.</td><td class="num">${T.unit === 'roll' ? `${Math.ceil(buy / 100)} ม้วน (100 ม.)` : `${Math.ceil(buy / 4)} ท่อน (4 ม.)`}</td></tr>`;
    }).join('');
    const emit = S.n * (+L.perTree || 0) + (S.items.sprinkler || 0);
    sum.innerHTML = `<h3>📋 สรุปผัง</h3>
      <div class="ly-stats"><div><b>${fmtNum(S.n)}</b><span>ต้น</span></div><div><b>${S.rai ? fmtNum(S.n / S.rai, 0) : '-'}</b><span>ต้น/ไร่</span></div><div><b>${S.spacing ? fmtNum(S.spacing, 1) : '-'}</b><span>ระยะห่างจริง (ม.)</span></div></div>
      <div class="small" style="margin:.3rem 0">${Object.entries(TREE_STATES).filter(([k]) => S.st[k]).map(([k, T]) => `<span class="pill" style="border-left:4px solid ${T.color}">${T.label} ${S.st[k]}</span>`).join(' ')}</div>
      ${+p.trees !== S.n && S.n && edit ? `<button class="btn small" onclick="lySyncTrees()">อัปเดตจำนวนต้นของแปลงเป็น ${fmtNum(S.n)} ต้น</button>` : ''}
      <h3 style="margin-top:.9rem">🧾 รายการวัสดุโดยประมาณ</h3>
      ${pipeRows || Object.keys(S.items).length || emit ? `<div class="table-wrap"><table>${pipeRows}
        <tr><td>หัวน้ำ (${+L.perTree || 0} หัว/ต้น${S.items.sprinkler ? ` + วางเอง ${S.items.sprinkler}` : ''})</td><td class="num" colspan="2">${fmtNum(emit)} หัว</td></tr>
        ${S.tees ? `<tr><td>ข้อต่อสามทาง/ข้อต่อแยก (ประมาณ)</td><td class="num" colspan="2">${S.tees} ตัว</td></tr>` : ''}
        ${Object.entries(S.items).filter(([k]) => k !== 'sprinkler').map(([k, c]) => `<tr><td>${ITEM_TYPES[k]?.icon || ''} ${ITEM_TYPES[k]?.label || k}</td><td class="num" colspan="2">${c}</td></tr>`).join('')}
      </table></div>` : '<div class="empty small">ยังไม่มีท่อหรืออุปกรณ์ในผัง</div>'}
      <div class="row small" style="margin-top:.4rem">หัวน้ำต่อต้น <select style="width:auto" ${edit ? '' : 'disabled'} onchange="lySetPerTree(this.value)">${[0, 1, 2, 3, 4].map(v => `<option ${+L.perTree === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <p class="small muted" style="margin:.4rem 0 0">ความยาวท่อเผื่อเศษ 5% แล้ว · เป็นค่าประมาณสำหรับซื้อของ ควรเผื่อข้อต่อและสายต่อหัวน้ำเพิ่ม</p>`;
  }
  lySelPanel(L);
}
function lySelPanel(L) {
  const el = document.getElementById('lySel'); if (!el) return;
  const sel = LY.sel, edit = canEdit(), dis = edit ? '' : 'disabled';
  if (!sel) { el.innerHTML = `<h3>🔍 รายละเอียด</h3><p class="small muted" style="margin:0">แตะต้นไม้ ท่อ หรืออุปกรณ์บนผังเพื่อดูตำแหน่ง ระยะห่าง และแก้ไข</p>`; return; }
  if (sel.k === 'tree') {
    const t = L.trees.find(x => x.id === sel.id); if (!t) { LY.sel = null; return lySelPanel(L); }
    const nn = nearestTrees(L.trees, t);
    el.innerHTML = `<h3>🌳 ต้นที่ ${esc(t.label || '-')}<button class="icon-btn" onclick="LY.sel=null;lyRefresh()" title="ปิด">✕</button></h3>
      <p class="small muted" style="margin:0 0 .5rem">ตำแหน่ง ห่างขอบซ้าย ${fmtNum(t.x, 2)} ม. · ห่างขอบบน ${fmtNum(t.y, 2)} ม.</p>
      ${nn.length ? `<p class="small" style="margin:0 0 .5rem">ระยะถึงต้นข้างเคียง: ${nn.map(([d, o]) => `<b>${fmtNum(d, 2)} ม.</b> (${esc(o.label || '-')})`).join(' · ')}</p>` : ''}
      <div class="field-row"><label class="field"><span>หมายเลข</span><input value="${esc(t.label || '')}" ${dis} onchange="lyEditSel('label',this.value)"></label>
        <label class="field"><span>สถานะ</span><select ${dis} onchange="lyEditSel('state',this.value)">${Object.entries(TREE_STATES).map(([k, T]) => `<option value="${k}" ${(t.state || 'ok') === k ? 'selected' : ''}>${T.label}</option>`).join('')}</select></label></div>
      <label class="field"><span>หมายเหตุ</span><input value="${esc(t.note || '')}" ${dis} placeholder="เช่น ปลูกซ่อม 3 พ.ย." onchange="lyEditSel('note',this.value)"></label>
      ${edit ? `<button class="btn small danger" onclick="lyDeleteSel()">ลบต้นนี้</button>` : ''}`;
  } else if (sel.k === 'pipe') {
    const p = L.pipes.find(x => x.id === sel.id); if (!p) { LY.sel = null; return lySelPanel(L); }
    el.innerHTML = `<h3>💧 ${PIPE_TYPES[p.type].label}<button class="icon-btn" onclick="LY.sel=null;lyRefresh()" title="ปิด">✕</button></h3>
      <p class="small" style="margin:0 0 .5rem">ความยาว <b>${fmtNum(pipeLen(p), 2)} ม.</b> · ${p.pts.length} จุด${edit ? ' · ลากจุดสีเหลืองเพื่อปรับแนวท่อ' : ''}</p>
      <div class="field-row"><label class="field"><span>ชนิด</span><select ${dis} onchange="lyEditSel('type',this.value)">${Object.entries(PIPE_TYPES).map(([k, T]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${T.label}</option>`).join('')}</select></label>
        <label class="field"><span>ขนาด Ø (มม.)</span><input type="number" min="4" step="1" value="${p.d || PIPE_TYPES[p.type].d}" ${dis} onchange="lyEditSel('d',+this.value)"></label></div>
      ${edit ? `<button class="btn small danger" onclick="lyDeleteSel()">ลบท่อเส้นนี้</button>` : ''}`;
  } else {
    const it = L.items.find(x => x.id === sel.id); if (!it) { LY.sel = null; return lySelPanel(L); }
    el.innerHTML = `<h3>${ITEM_TYPES[it.type]?.icon || ''} ${ITEM_TYPES[it.type]?.label || ''}<button class="icon-btn" onclick="LY.sel=null;lyRefresh()" title="ปิด">✕</button></h3>
      <p class="small muted" style="margin:0 0 .5rem">ตำแหน่ง ${fmtNum(it.x, 2)}, ${fmtNum(it.y, 2)} ม.</p>
      <div class="field-row"><label class="field"><span>ชนิด</span><select ${dis} onchange="lyEditSel('type',this.value)">${Object.entries(ITEM_TYPES).map(([k, T]) => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${T.icon} ${T.label}</option>`).join('')}</select></label>
        <label class="field"><span>ชื่อ/ป้าย</span><input value="${esc(it.label || '')}" ${dis} placeholder="เช่น วาล์วโซน 1" onchange="lyEditSel('label',this.value)"></label></div>
      ${edit ? `<button class="btn small danger" onclick="lyDeleteSel()">ลบ</button>` : ''}`;
  }
}
function selObj(L) {
  const s = LY.sel; if (!s) return null;
  return (s.k === 'tree' ? L.trees : s.k === 'pipe' ? L.pipes : L.items).find(x => x.id === s.id);
}
window.lyEditSel = (field, val) => mutate(L => { const o = selObj(L); if (o) o[field] = typeof val === 'string' ? val.trim() : val; });
window.lyDeleteSel = () => {
  const s = LY.sel; if (!s) return;
  mutate(L => { const key = s.k === 'tree' ? 'trees' : s.k === 'pipe' ? 'pipes' : 'items'; L[key] = L[key].filter(x => x.id !== s.id); });
  LY.sel = null; lyRefresh();
};
window.lySetSize = (w, h) => { mutate(L => { if (w != null && +w >= 2) L.w = +w; if (h != null && +h >= 2) L.h = +h; }); lyFit(); };
window.lySetCanopy = v => mutate(L => { if (+v > 0) L.canopy = +v; });
window.lySetPerTree = v => mutate(L => { L.perTree = +v; });
window.lySyncTrees = () => { const p = plotById(LY.plot), n = curLayout().trees.length; p.trees = n; save(); toast(`อัปเดตจำนวนต้นของ ${p.name} เป็น ${n} ต้นแล้ว`); lyPanels(); };
window.lyAutoCount = () => {
  const L = getLayout(LY.plot) || curLayoutView(), A = LY.auto;
  const el = document.getElementById('lyAutoN'); if (el) el.textContent = fmtNum(autoPositions(L.w, L.h, A.dx, A.dy, A.m, A.pattern).length);
};
window.lyAutoPlant = () => {
  const A = LY.auto, L0 = curLayout();
  const pos = autoPositions(L0.w, L0.h, A.dx, A.dy, A.m, A.pattern);
  if (!pos.length) return toast('ระยะนี้ปลูกไม่ได้สักต้น — ลองลดระยะหรือระยะขอบ');
  if (pos.length > 5000) return toast('จำนวนต้นมากเกินไป (เกิน 5,000) — ตรวจระยะอีกครั้ง');
  mutate(L => {
    L.trees = pos.map(q => ({ id: uid(), ...q, state: 'ok' }));
    L.canopy = Math.min(A.dx, A.dy) * 0.75;
  });
  LY.sel = null; lyRefresh();
  toast(`ปลูก ${pos.length} ต้นตามระยะ ${A.dx}×${A.dy} ม. แล้ว`);
};
window.lyAutoPipes = () => {
  const L0 = curLayout();
  if (!L0.trees.length) return toast('ยังไม่มีต้นไม้ในผัง');
  const lat = LY.auto?.lat || 'drip';
  mutate(L => {
    const rows = rowsOf(L.trees);
    const minX = Math.min(...L.trees.map(t => t.x));
    const mainX = lyRound(Math.max(0.3, minX - Math.min(1.5, minX / 2)));
    const y0 = lyRound(Math.max(0.3, rows[0].y - Math.min(2, rows[0].y / 2)));
    L.pipes = L.pipes.filter(p => !p.auto);
    L.items = L.items.filter(i => !i.auto);
    // ปั๊มอยู่ทางขวาของหัวท่อเมน วาล์วอยู่ที่หัวท่อเมน (เว้นระยะไม่ให้สัญลักษณ์ซ้อนกัน)
    const pumpX = lyRound(Math.min(L.w - 0.3, mainX + textSize(L) * 2.6));
    L.pipes.push({ id: uid(), type: 'main', d: PIPE_TYPES.main.d, pts: [[pumpX, y0], [mainX, y0], [mainX, rows.at(-1).y]], auto: true });
    rows.forEach(r => { const endX = lyRound(Math.min(L.w - 0.2, r.ts.at(-1).x + 0.5)); L.pipes.push({ id: uid(), type: lat, d: PIPE_TYPES[lat].d, pts: [[mainX, r.y], [endX, r.y]], auto: true }); });
    if (!L.items.some(i => i.type === 'pump')) L.items.push({ id: uid(), type: 'pump', x: pumpX, y: y0, label: 'ปั๊ม', auto: true });
    L.items.push({ id: uid(), type: 'valve', x: mainX, y: y0, label: '', auto: true });
  });
  toast('เดินท่ออัตโนมัติแล้ว');
};
window.lyFinishPipe = () => {
  const d = LY.draft; LY.draft = null; LY.cursor = null;
  if (!d || d.pts.length < 2) { lyDrawOverlay(); return; }
  const pts = d.pts.filter((q, i) => i === 0 || dist(q, d.pts[i - 1]) > 0.01);
  if (pts.length < 2) { lyDrawOverlay(); return; }
  mutate(L => { const p = { id: uid(), type: d.type, d: PIPE_TYPES[d.type].d, pts }; L.pipes.push(p); LY.sel = { k: 'pipe', id: p.id }; });
};

// ---------- ส่งออก PNG ----------
window.lyExportPng = () => {
  const L = getLayout(LY.plot) || curLayoutView(), p = plotById(LY.plot), S = summary(L);
  const fs = textSize(L), v = lyFitView(L, { clientWidth: 1600, clientHeight: 1100 });
  const W = 2000, H = Math.round(W * v.h / v.w) + 120;
  const title = `ผังแปลง ${p?.name || ''} — ${fmtNum(L.w, 1)} × ${fmtNum(L.h, 1)} ม. · ${fmtNum(S.n)} ต้น${S.spacing ? ` · ระยะ ~${fmtNum(S.spacing, 1)} ม.` : ''}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#0b3a6e"/>
    <text x="40" y="70" font-size="40" font-weight="700" fill="#ffffff" font-family="Sarabun, sans-serif">${esc(title)}</text>
    <svg x="0" y="110" width="${W}" height="${H - 110}" viewBox="${v.x} ${v.y} ${v.w} ${v.h}">${lyDefs(L, 'lyx')}${lyBody(L, { editor: false })}</svg>
    <text x="${W - 40}" y="${H - 24}" font-size="22" fill="#9fc3ff" text-anchor="end" font-family="Sarabun, sans-serif">สมุดสวน · ${fmtDate(todayStr())}</text></svg>`;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    c.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `ผังแปลง-${(p?.name || 'สวน').replace(/[\\/:*?"<>|]/g, '')}-${todayStr()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast('บันทึกรูปผังแล้ว');
    }, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('สร้างรูปไม่สำเร็จ'); };
  img.src = url;
};

// ---------- เมาส์/สัมผัส ----------
function lyMount() {
  const svg = lySvg(); if (!svg) return;
  const L = getLayout(LY.plot) || curLayoutView();
  if (!LY.views[LY.plot]) LY.views[LY.plot] = lyFitView(L, svg);
  applyView();
  lyRefresh();
  svg.addEventListener('pointerdown', lyDown);
  svg.addEventListener('pointermove', lyMove);
  svg.addEventListener('pointerup', lyUp);
  svg.addEventListener('pointercancel', e => { LY.ptrs.delete(e.pointerId); LY.down = null; LY.pinch = null; });
  svg.addEventListener('pointerleave', () => { if (LY.cursor && !LY.down) { LY.cursor = null; lyDrawOverlay(); } });
  svg.addEventListener('dblclick', e => { if (LY.draft) { e.preventDefault(); lyFinishPipe(); } });
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
}
function hitOf(e) {
  const g = e.target.closest?.('[data-k]');
  return g ? { k: g.dataset.k, id: g.dataset.id, vi: g.dataset.vi != null ? +g.dataset.vi : null, el: g } : null;
}
function lyDown(e) {
  const svg = lySvg();
  svg.setPointerCapture?.(e.pointerId);
  LY.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (LY.ptrs.size === 2) {
    const [a, b] = [...LY.ptrs.values()];
    LY.pinch = { d: dist(a, b), view: { ...LY.views[LY.plot] }, mid: worldAt(svg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
    LY.down = null; return;
  }
  const hit = hitOf(e), L = getLayout(LY.plot);
  const d = { cx: e.clientX, cy: e.clientY, p: worldAt(svg, e.clientX, e.clientY), hit, moved: false, view: { ...LY.views[LY.plot] }, k: svg.getScreenCTM()?.a || 1 };
  if (L && canEdit() && hit && (LY.tool === 'select') && (hit.k === 'tree' || hit.k === 'item' || hit.k === 'vertex')) {
    d.drag = hit; d.snap = snapshot(L);
  }
  LY.down = d;
}
function lyMove(e) {
  const svg = lySvg(); if (!svg) return;
  if (LY.ptrs.has(e.pointerId)) LY.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (LY.pinch && LY.ptrs.size === 2) {
    const [a, b] = [...LY.ptrs.values()], f = dist(a, b) / LY.pinch.d, v = LY.pinch.view, m = LY.pinch.mid;
    const nw = Math.max(2, v.w / f), k = nw / v.w;
    LY.views[LY.plot] = { x: m[0] - (m[0] - v.x) * k, y: m[1] - (m[1] - v.y) * k, w: nw, h: v.h * k };
    applyView(); return;
  }
  const d = LY.down;
  const L = getLayout(LY.plot);
  if (!d) {
    // แสดงเส้นท่อ/ไม้บรรทัดตามเมาส์
    if (LY.draft || LY.measure?.length === 1) { LY.cursor = snapPoint(L || curLayoutView(), worldAt(svg, e.clientX, e.clientY), !!LY.draft); lyDrawOverlay(); }
    return;
  }
  if (!d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) > 5) d.moved = true;
  if (!d.moved) return;
  if (d.drag && L) {
    const p = snapPoint(L, worldAt(svg, e.clientX, e.clientY), false);
    if (d.drag.k === 'vertex') {
      const pipe = L.pipes.find(x => x.id === d.drag.id); if (!pipe) return;
      pipe.pts[d.drag.vi] = p; lyDraw();
    } else {
      const o = (d.drag.k === 'tree' ? L.trees : L.items).find(x => x.id === d.drag.id); if (!o) return;
      o.x = p[0]; o.y = p[1];
      d.drag.el.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
      if (LY.sel?.id === o.id) lyDrawOverlay();
    }
    return;
  }
  // ลากพื้นที่ว่าง = เลื่อนผัง
  const v = d.view;
  LY.views[LY.plot] = { ...v, x: v.x - (e.clientX - d.cx) / d.k, y: v.y - (e.clientY - d.cy) / d.k };
  applyView();
}
function lyUp(e) {
  LY.ptrs.delete(e.pointerId);
  if (LY.pinch) { if (LY.ptrs.size < 2) LY.pinch = null; return; }
  const d = LY.down; LY.down = null;
  if (!d) return;
  const L = getLayout(LY.plot);
  if (d.drag && d.moved && L) {
    pushHist(L, d.snap);
    if (d.drag.k !== 'vertex') LY.sel = { k: d.drag.k, id: d.drag.id };
    commit(L); return;
  }
  if (d.moved) return;
  lyClick(d.p, d.hit);
}
function lyClick(p, hit) {
  const t = LY.tool, svgL = getLayout(LY.plot) || curLayoutView();
  if (t === 'select') {
    LY.sel = hit && hit.k !== 'vertex' ? { k: hit.k, id: hit.id } : (hit?.k === 'vertex' ? LY.sel : null);
    lyDrawOverlay(); lySelPanel(svgL); return;
  }
  if (t === 'measure') {
    const q = snapPoint(svgL, p, true);
    LY.measure = !LY.measure || LY.measure.length === 2 ? [q] : [LY.measure[0], q];
    lyDrawOverlay(); return;
  }
  if (!canEdit()) return;
  if (t === 'erase') {
    if (!hit || hit.k === 'vertex') return;
    LY.sel = { k: hit.k, id: hit.id }; lyDeleteSel(); return;
  }
  if (t === 'tree') {
    const L = curLayout(), q = snapPoint(L, p, false);
    if (L.trees.some(o => dist([o.x, o.y], q) < 0.3)) return;
    const n = L.trees.length + 1;
    mutate(L2 => { const tr = { id: uid(), x: q[0], y: q[1], label: String(n), state: 'ok' }; L2.trees.push(tr); LY.sel = { k: 'tree', id: tr.id }; });
    return;
  }
  if (t.startsWith('item:')) {
    const q = snapPoint(curLayout(), p, true);
    mutate(L2 => { const it = { id: uid(), type: t.slice(5), x: q[0], y: q[1], label: '' }; L2.items.push(it); LY.sel = { k: 'item', id: it.id }; });
    return;
  }
  if (PIPE_TYPES[t]) {
    const q = snapPoint(curLayout(), p, true);
    if (!LY.draft || LY.draft.type !== t) LY.draft = { type: t, pts: [] };
    const last = LY.draft.pts.at(-1);
    if (last && dist(last, q) < 0.05) { if (LY.draft.pts.length > 1) lyFinishPipe(); return; }
    LY.draft.pts.push(q); LY.cursor = q;
    lyDrawOverlay();
  }
}
document.addEventListener('keydown', e => {
  if (currentTab() !== 'layout' || document.getElementById('modal').open) return;
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'Escape') { LY.draft = null; LY.measure = null; LY.sel = null; LY.cursor = null; lyRefresh(); }
  else if (e.key === 'Enter' && LY.draft) lyFinishPipe();
  else if ((e.key === 'Delete' || e.key === 'Backspace') && LY.sel && canEdit()) { e.preventDefault(); lyDeleteSel(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); lyUndo(); }
});
window.lyOpen = plotId => { LY.plot = plotId; LY.sel = null; LY.draft = null; location.hash = '#layout'; };

// ถ้าเปิดลิงก์มาที่หน้านี้โดยตรง ให้แสดงผลอีกครั้งหลังโหลดไฟล์นี้เสร็จ
if (location.hash === '#layout') render();
