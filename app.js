/* สมุดสวน — เว็บแอปจัดการสวน (ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้) */
'use strict';

// ---------- ค่าคงที่ ----------
const STORE_KEY = 'suan-data-v1';
const WX_CACHE_KEY = 'suan-weather-cache';
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const PLOT_COLORS = ['#2f7d32', '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#e34948', '#8d6e63', '#00838f'];
const ACTIVITY_TYPES = ['รดน้ำ', 'ใส่ปุ๋ย', 'พ่นยา/ฮอร์โมน', 'กำจัดวัชพืช', 'ตัดแต่งกิ่ง', 'ปลูก/ปลูกซ่อม', 'เก็บเกี่ยว', 'ตรวจโรค/แมลง', 'ซ่อมบำรุง', 'อื่นๆ'];
const INCOME_CATS = ['ขายผลผลิต', 'ขายกิ่งพันธุ์', 'เงินอุดหนุน', 'อื่นๆ'];
const EXPENSE_CATS = ['ปุ๋ย', 'ยา/สารเคมี', 'เมล็ด/กิ่งพันธุ์', 'ค่าแรง', 'ค่าน้ำ/ไฟ', 'น้ำมัน', 'อุปกรณ์/เครื่องมือ', 'ค่าขนส่ง', 'อื่นๆ'];
const KB_CATS = ['ปุ๋ย', 'โรคและแมลง', 'การดูแล', 'สูตร/ฮอร์โมน', 'อื่นๆ'];
const STOCK_UNITS = ['กก.', 'กระสอบ', 'ลิตร', 'ขวด', 'ซอง', 'ชิ้น', 'ต้น'];
const SQM_PER_WA = 4, WA_PER_NGAN = 100, WA_PER_RAI = 400;

const DEFAULT_KB = [
  { cat: 'ปุ๋ย', title: 'ยูเรีย 46-0-0', content: 'ไนโตรเจนสูง (N 46%)\n• ช่วย: เร่งการเจริญเติบโตของใบและลำต้น ใบเขียวเข้ม แตกยอดใหม่\n• เหมาะ: ช่วงต้นยังเล็ก หลังตัดแต่งกิ่ง เร่งแตกใบอ่อน\n• ระวัง: ใส่มากทำให้ต้นอวบ อ่อนแอต่อโรค ไม่ควรใช้ช่วงสะสมอาหารก่อนออกดอก\n• วิธีใช้: หว่านรอบทรงพุ่มแล้วรดน้ำตาม หรือละลายน้ำรด' },
  { cat: 'ปุ๋ย', title: 'สูตรเสมอ 15-15-15 / 16-16-16', content: 'มี N-P-K เท่ากัน\n• ช่วย: บำรุงต้นโดยรวม ทั้งใบ ราก และผล\n• เหมาะ: บำรุงทั่วไป หลังเก็บเกี่ยวเพื่อฟื้นฟูต้น\n• วิธีใช้: ไม้ผลโตแล้วประมาณ 0.5–1 กก./ต้น/ครั้ง แบ่งใส่ 2–3 ครั้งต่อปี (ปรับตามขนาดทรงพุ่ม)' },
  { cat: 'ปุ๋ย', title: 'สูตรตัวกลางสูง 8-24-24 / 9-24-24', content: 'ฟอสฟอรัส (P) และโพแทสเซียม (K) สูง\n• ช่วย: สะสมอาหาร กระตุ้นการสร้างตาดอก ช่วยระบบราก\n• เหมาะ: ช่วงเตรียมต้นก่อนออกดอก (เช่น มะม่วง ทุเรียน ลำไย)\n• ระวัง: ควรใช้คู่กับการงดน้ำ/ลดไนโตรเจนในพืชที่ต้องการชักนำการออกดอก' },
  { cat: 'ปุ๋ย', title: 'สูตรตัวท้ายสูง 13-13-21 / 0-0-60', content: 'โพแทสเซียม (K) สูง\n• ช่วย: เพิ่มความหวาน สีผิว เนื้อแน่น น้ำหนักผล\n• เหมาะ: ช่วงผลโต–ก่อนเก็บเกี่ยว 1–2 เดือน\n• 0-0-60 (โพแทสเซียมคลอไรด์) ใช้เติม K อย่างเดียว' },
  { cat: 'ปุ๋ย', title: 'ปุ๋ยอินทรีย์ / ปุ๋ยคอก', content: 'เช่น มูลวัว มูลไก่ ปุ๋ยหมัก\n• ช่วย: ปรับโครงสร้างดินให้ร่วนซุย อุ้มน้ำ เพิ่มจุลินทรีย์ ช่วยให้รากดูดปุ๋ยเคมีได้ดีขึ้น\n• วิธีใช้: ใส่ต้นฤดูฝน 5–20 กก./ต้น (ตามขนาดต้น) ควรเป็นปุ๋ยคอกที่หมักแล้ว\n• ระวัง: มูลไก่สดร้อน อาจทำให้รากเสียหาย' },
  { cat: 'ปุ๋ย', title: 'โดโลไมท์ / ปูนมาร์ล', content: 'ปรับสภาพดินเป็นกรด (pH ต่ำ) และเพิ่มแคลเซียม-แมกนีเซียม\n• เหมาะ: ดินเปรี้ยว ดินภาคใต้/ภาคตะวันออก\n• วิธีใช้: หว่านก่อนใส่ปุ๋ยเคมีอย่างน้อย 2 สัปดาห์ ไม่ควรใส่พร้อมกัน' },
  { cat: 'การดูแล', title: 'ไม่ควรพ่นยาเมื่อไหร่', content: '• ลมแรงเกิน ~15 กม./ชม. — ละอองยาปลิว ไม่ถึงเป้าหมาย\n• มีโอกาสฝนตกภายใน 4–6 ชม. — ยาถูกชะล้าง\n• แดดจัดเที่ยงวัน — ยาระเหยเร็ว ใบไหม้ได้\nช่วงที่เหมาะ: เช้าตรู่ หรือเย็น ลมสงบ' },
  { cat: 'โรคและแมลง', title: 'เพลี้ยไฟ', content: 'อาการ: ใบอ่อน/ยอดหงิกงอ ขอบใบไหม้ ผลผิวกร้าน\nช่วงระบาด: อากาศแห้งแล้ง ฝนทิ้งช่วง\nการจัดการ: ฉีดน้ำเพิ่มความชื้น ใช้กับดักกาวเหนียวสีฟ้า สารชีวภัณฑ์ (บิวเวอร์เรีย) หรือสารเคมีตามคำแนะนำ' },
];

// ---------- สถานะ / storage ----------
function emptyData() {
  return {
    settings: { farmName: 'สวนของฉัน', lat: null, lon: null, locName: '', theme: 'auto' },
    plots: [], activities: [], finance: [], harvests: [], stock: [], journal: [],
    knowledge: DEFAULT_KB.map(k => ({ id: uid(), ...k })),
  };
}
function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyData();
    const d = JSON.parse(raw);
    const base = emptyData();
    const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
    for (const k of ['plots', 'activities', 'finance', 'harvests', 'stock', 'knowledge', 'journal']) if (!Array.isArray(out[k])) out[k] = base[k];
    return out;
  } catch (e) {
    console.warn('อ่านข้อมูลไม่สำเร็จ', e);
    return emptyData();
  }
}
let DB = loadData();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  catch (e) { toast('บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลของเบราว์เซอร์อาจเต็มหรือถูกปิด'); }
}

// ---------- utils ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return ymd(new Date()); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function fmtDate(s, withYear = true) {
  if (!s) return '-';
  const d = parseYmd(s);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]}${withYear ? ' ' + String(d.getFullYear() + 543).slice(-2) : ''}`;
}
function fmtNum(n, digits = 0) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
function fmtMoney(n) { return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ฿'; }
function plotById(id) { return DB.plots.find(p => p.id === id); }
function plotName(id) { return plotById(id)?.name || (id ? '(แปลงถูกลบ)' : 'ทั้งสวน'); }
function plotColor(id) { return plotById(id)?.color || 'var(--muted)'; }
function areaWa(p) { return (+p.rai || 0) * WA_PER_RAI + (+p.ngan || 0) * WA_PER_NGAN + (+p.wa || 0); }
function fmtArea(wa) {
  wa = Math.round(wa * 10) / 10;
  const rai = Math.floor(wa / WA_PER_RAI); wa -= rai * WA_PER_RAI;
  const ngan = Math.floor(wa / WA_PER_NGAN); wa -= ngan * WA_PER_NGAN;
  const parts = [];
  if (rai) parts.push(`${rai} ไร่`);
  if (ngan) parts.push(`${ngan} งาน`);
  if (wa || !parts.length) parts.push(`${fmtNum(wa, 1)} ตร.วา`);
  return parts.join(' ');
}
function monthKey(s) { return s.slice(0, 7); }
function monthLabel(key, full = false) {
  const [y, m] = key.split('-').map(Number);
  return `${(full ? TH_MONTHS_FULL : TH_MONTHS)[m - 1]} ${full ? y + 543 : String(y + 543).slice(-2)}`;
}
function plotOptions(selected, includeAll = true, allLabel = 'ทั้งสวน / ไม่ระบุแปลง') {
  return (includeAll ? `<option value="">${allLabel}</option>` : '') +
    DB.plots.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
function options(list, selected) { return list.map(v => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join(''); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- modal ----------
const modal = document.getElementById('modal');
let modalHandler = null;
function openModal(title, bodyHtml, onSubmit, okLabel = 'บันทึก') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOk').textContent = okLabel;
  modalHandler = onSubmit;
  modal.showModal();
  const first = modal.querySelector('#modalBody input, #modalBody select, #modalBody textarea');
  if (first) first.focus();
}
document.getElementById('modalForm').addEventListener('submit', e => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  modal.querySelectorAll('#modalBody input[type=checkbox]').forEach(cb => { fd[cb.name] = cb.checked; });
  if (modalHandler && modalHandler(fd) === false) return;
  modal.close(); save(); render();
});
document.getElementById('modalCancel').addEventListener('click', () => modal.close());
function confirmDelete(what, fn) {
  if (confirm(`ลบ${what}นี้ใช่ไหม? (กู้คืนไม่ได้)`)) { fn(); save(); render(); toast('ลบแล้ว'); }
}

// ---------- chart helper (bar) ----------
function barChart({ labels, series, fmt = v => fmtNum(v), tipTitles, axisEvery = 1, max }) {
  const allVals = series.flatMap(s => s.values);
  const top = max ?? Math.max(1, ...allVals);
  const cols = labels.map((lb, i) => {
    const tip = `<b>${esc(tipTitles ? tipTitles[i] : lb)}</b>` + series.map(s => `<br>${esc(s.name)}: ${esc(fmt(s.values[i]))}`).join('');
    const bars = series.map(s => `<div class="bar ${s.cls || ''}" style="height:${(s.values[i] / top) * 100}%"></div>`).join('');
    return `<div class="bar-col" data-tip="${esc(tip)}">${bars}</div>`;
  }).join('');
  const axis = labels.map((lb, i) => `<span>${i % axisEvery === 0 ? esc(lb) : ''}</span>`).join('');
  const legend = series.length > 1
    ? `<div class="legend">${series.map(s => `<span><span class="swatch" style="background:var(--${s.cls === 's2' ? 'series-2' : 'series-1'})"></span>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<div class="bars"><div class="gridline" style="top:6px"><span>${esc(fmt(top))}</span></div>${cols}</div><div class="bar-axis">${axis}</div>`;
}
const tipEl = Object.assign(document.createElement('div'), { className: 'tip' });
document.body.appendChild(tipEl);
document.addEventListener('mousemove', e => {
  const col = e.target.closest?.('[data-tip]');
  if (!col) { tipEl.style.display = 'none'; return; }
  tipEl.innerHTML = col.dataset.tip;
  tipEl.style.display = 'block';
  const w = tipEl.offsetWidth;
  tipEl.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 12) + 'px';
  tipEl.style.top = (e.clientY - tipEl.offsetHeight - 10) + 'px';
});

// ---------- สภาพอากาศ (Open-Meteo, ไม่ต้องใช้ API key) ----------
const WX_CODES = {
  0: ['☀️', 'ท้องฟ้าแจ่มใส'], 1: ['🌤️', 'มีเมฆเล็กน้อย'], 2: ['⛅', 'มีเมฆบางส่วน'], 3: ['☁️', 'เมฆมาก'],
  45: ['🌫️', 'หมอก'], 48: ['🌫️', 'หมอกน้ำค้างแข็ง'],
  51: ['🌦️', 'ฝนปรอยเบา'], 53: ['🌦️', 'ฝนปรอย'], 55: ['🌧️', 'ฝนปรอยหนัก'],
  61: ['🌦️', 'ฝนตกเล็กน้อย'], 63: ['🌧️', 'ฝนตกปานกลาง'], 65: ['🌧️', 'ฝนตกหนัก'],
  80: ['🌦️', 'ฝนซู่เล็กน้อย'], 81: ['🌧️', 'ฝนซู่'], 82: ['⛈️', 'ฝนซู่หนัก'],
  95: ['⛈️', 'พายุฝนฟ้าคะนอง'], 96: ['⛈️', 'พายุฝน ลูกเห็บ'], 99: ['⛈️', 'พายุฝน ลูกเห็บหนัก'],
};
function wxInfo(code) { return WX_CODES[code] || ['🌡️', 'ไม่ทราบสภาพ']; }
function windDir(deg) { return ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'][Math.round(((deg % 360) / 45)) % 8]; }

let WX = null, WX_STATE = 'idle', WX_ERR = '';
try { WX = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || 'null'); } catch { WX = null; }

async function fetchWeather(force = false) {
  const { lat, lon } = DB.settings;
  if (lat == null || lon == null) return;
  if (!force && WX && WX.lat === lat && WX.lon === lon && Date.now() - WX.fetchedAt < 30 * 60 * 1000) return;
  WX_STATE = 'loading'; WX_ERR = ''; render();
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 7,
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'precipitation_probability,precipitation,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max',
  });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    WX = { lat, lon, fetchedAt: Date.now(), data };
    try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(WX)); } catch { /* ไม่เป็นไร */ }
    WX_STATE = 'ok';
  } catch (e) {
    WX_STATE = 'error'; WX_ERR = 'ดึงข้อมูลพยากรณ์ไม่สำเร็จ (ตรวจสอบอินเทอร์เน็ต)';
  }
  render();
}

function wxNext(hours) {
  // ข้อมูลรายชั่วโมงตั้งแต่ชั่วโมงปัจจุบัน
  const h = WX.data.hourly;
  const nowIso = WX.data.current.time.slice(0, 13);
  let start = h.time.findIndex(t => t.slice(0, 13) >= nowIso);
  if (start < 0) start = 0;
  const idx = [];
  for (let i = start; i < Math.min(h.time.length, start + hours); i++) idx.push(i);
  return idx.map(i => ({ time: h.time[i], prob: h.precipitation_probability[i] ?? 0, rain: h.precipitation[i] ?? 0, wind: h.wind_speed_10m[i] ?? 0 }));
}

function wxAdvice() {
  const cur = WX.data.current, d = WX.data.daily;
  const next6 = wxNext(6);
  const maxProb6 = Math.max(0, ...next6.map(x => x.prob));
  const maxWind6 = Math.max(cur.wind_speed_10m, ...next6.map(x => x.wind));
  const todayProb = d.precipitation_probability_max[0] ?? 0;
  const todayRain = d.precipitation_sum[0] ?? 0;
  const out = [];
  if (maxWind6 > 20 || maxProb6 >= 60) out.push(['bad', '🚫 ไม่เหมาะพ่นยา/ฮอร์โมน', `ลมสูงสุด ${fmtNum(maxWind6)} กม./ชม. โอกาสฝนใน 6 ชม. ${maxProb6}%`]);
  else if (maxWind6 > 12 || maxProb6 >= 30) out.push(['warn', '⚠️ พ่นยาได้แต่ควรระวัง', `ลม ${fmtNum(maxWind6)} กม./ชม. โอกาสฝนใน 6 ชม. ${maxProb6}% — เลือกช่วงลมสงบ`]);
  else out.push(['good', '✅ เหมาะกับการพ่นยา/ฮอร์โมน', `ลมเบา ${fmtNum(maxWind6)} กม./ชม. โอกาสฝนใน 6 ชม. ${maxProb6}%`]);
  if (todayProb >= 70 || todayRain >= 5) out.push(['good', '💧 อาจงดรดน้ำวันนี้', `โอกาสฝน ${todayProb}% คาดปริมาณ ${fmtNum(todayRain, 1)} มม.`]);
  else if (todayProb < 30) out.push(['warn', '💧 ควรรดน้ำตามปกติ', `โอกาสฝนวันนี้เพียง ${todayProb}%`]);
  if (todayRain >= 20) out.push(['bad', '🌧️ ฝนหนัก ชะลอการใส่ปุ๋ยเม็ด', `คาดฝน ${fmtNum(todayRain, 1)} มม. ปุ๋ยอาจถูกชะล้าง ระวังน้ำขังโคนต้น`]);
  else if (todayRain >= 2 && todayRain < 20) out.push(['good', '🌱 ช่วงดีสำหรับใส่ปุ๋ย', 'ดินชื้นจากฝนเล็กน้อย ช่วยให้ปุ๋ยละลายซึมลงดิน']);
  return out;
}

// ---------- stock ----------
function applyStock(act, sign) {
  if (!act.stockId || !act.stockQty) return;
  const item = DB.stock.find(s => s.id === act.stockId);
  if (item) item.qty = Math.round(((+item.qty || 0) + sign * (+act.stockQty)) * 1000) / 1000;
}

// ---------- router ----------
const PAGES = {};
let CAL = { month: monthKey(todayStr()), selected: todayStr(), plot: '' };
let FIN = { month: '', type: '', plot: '' };
let KB = { q: '', cat: '' };
function currentTab() { const t = location.hash.slice(1); return PAGES[t] ? t : 'dashboard'; }
function render() {
  applyTheme();
  document.getElementById('farmName').textContent = DB.settings.farmName || 'สมุดสวน';
  const tab = currentTab();
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  let html;
  try { html = PAGES[tab](); }
  catch (e) {
    console.error(e);
    html = `<div class="card"><h2>⚠️ หน้านี้แสดงผลไม่สำเร็จ</h2><p>ลองรีเฟรชหน้าเว็บ (Ctrl + Shift + R) ถ้ายังไม่หาย ส่งข้อความนี้มาให้ผู้ดูแล:</p><pre class="small" style="white-space:pre-wrap">${esc(e.message)}</pre></div>`;
  }
  document.getElementById('app').innerHTML = html;
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
function applyTheme() {
  const t = DB.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- หน้า: ภาพรวม ----------
PAGES.dashboard = () => {
  const today = todayStr(), mk = monthKey(today);
  const totalWa = DB.plots.reduce((a, p) => a + areaWa(p), 0);
  const totalTrees = DB.plots.reduce((a, p) => a + (+p.trees || 0), 0);
  const finMonth = DB.finance.filter(f => monthKey(f.date) === mk);
  const inc = finMonth.filter(f => f.type === 'in').reduce((a, f) => a + +f.amount, 0);
  const exp = finMonth.filter(f => f.type === 'out').reduce((a, f) => a + +f.amount, 0);
  const pending = DB.activities.filter(a => !a.done && a.date <= addDays(today, 7)).sort((a, b) => a.date.localeCompare(b.date));
  const recent = DB.activities.filter(a => a.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const lowStock = DB.stock.filter(s => s.minQty !== '' && s.minQty != null && +s.qty <= +s.minQty);

  let wxCard;
  if (DB.settings.lat == null) {
    wxCard = `<p class="muted">ยังไม่ได้ตั้งตำแหน่งสวน</p><a class="btn primary" href="#weather">ตั้งตำแหน่งเพื่อดูพยากรณ์ฝน</a>`;
  } else if (!WX?.data) {
    wxCard = `<p class="muted">${WX_STATE === 'error' ? esc(WX_ERR) : 'กำลังโหลดพยากรณ์…'}</p>`;
  } else {
    const c = WX.data.current, d = WX.data.daily, [ic, txt] = wxInfo(c.weather_code);
    const adv = wxAdvice()[0];
    wxCard = `<div class="wx-now"><span class="wx-icon">${ic}</span><div><div class="wx-big">${d.precipitation_probability_max[0] ?? 0}%</div><div class="muted small">โอกาสฝนวันนี้</div></div>
      <div class="small">${esc(txt)} · ${fmtNum(c.temperature_2m, 1)}°C<br>ลม ${fmtNum(c.wind_speed_10m)} กม./ชม. จากทิศ${windDir(c.wind_direction_10m)}<br>ฝนคาด ${fmtNum(d.precipitation_sum[0], 1)} มม.</div></div>
      <div class="advice ${adv[0]}"><b>${adv[1]}</b><div class="small">${esc(adv[2])}</div></div>
      <p class="small" style="margin:.5rem 0 0"><a href="#weather">ดูพยากรณ์ 7 วัน →</a></p>`;
  }

  return `
  <div class="page-head"><h1>ภาพรวมสวน</h1><div class="row">
    <button class="btn primary" onclick="editActivity()">+ บันทึกงาน</button>
    <button class="btn" onclick="editFinance()">+ รายรับ/จ่าย</button></div></div>
  <div class="grid cols-4">
    <div class="card stat"><div class="label">แปลงปลูก</div><div class="value">${DB.plots.length}</div><div class="sub">${fmtNum(totalTrees)} ต้น</div></div>
    <div class="card stat"><div class="label">พื้นที่รวม</div><div class="value" style="font-size:1.25rem">${fmtArea(totalWa)}</div><div class="sub">${fmtNum(totalWa * SQM_PER_WA)} ตร.ม.</div></div>
    <div class="card stat"><div class="label">รายรับ ${monthLabel(mk)}</div><div class="value">${fmtMoney(inc)}</div><div class="sub">รายจ่าย ${fmtMoney(exp)}</div></div>
    <div class="card stat"><div class="label">คงเหลือสุทธิเดือนนี้</div><div class="value" style="color:${inc - exp >= 0 ? 'var(--good)' : 'var(--bad)'}">${inc - exp >= 0 ? '+' : ''}${fmtMoney(inc - exp)}</div><div class="sub">${finMonth.length} รายการ</div></div>
  </div>
  <div class="grid cols-2" style="margin-top:12px">
    <div class="card"><h2>🌦️ ลมฝนวันนี้</h2>${wxCard}</div>
    <div class="card"><h2>📋 งานที่ต้องทำ (7 วันข้างหน้า)<a class="small" href="#calendar">ปฏิทิน →</a></h2>
      ${pending.length ? `<ul class="list">${pending.slice(0, 8).map(activityLi).join('')}</ul>` : '<div class="empty">ไม่มีงานค้าง 🎉</div>'}</div>
    <div class="card"><h2>✅ งานที่ทำล่าสุด</h2>
      ${recent.length ? `<ul class="list">${recent.map(activityLi).join('')}</ul>` : '<div class="empty">ยังไม่มีบันทึก</div>'}</div>
    <div class="card"><h2>📦 วัสดุใกล้หมด<a class="small" href="#stock">คลัง →</a></h2>
      ${lowStock.length ? `<ul class="list">${lowStock.map(s => `<li><span class="grow">${esc(s.name)}</span><span class="pill warn">เหลือ ${fmtNum(s.qty, 2)} ${esc(s.unit)}</span></li>`).join('')}</ul>` : '<div class="empty">ไม่มีรายการใกล้หมด</div>'}</div>
  </div>`;
};

function activityLi(a) {
  const today = todayStr();
  const status = a.done ? '' : a.date < today ? '<span class="pill bad">เลยกำหนด</span>' : a.date === today ? '<span class="pill warn">วันนี้</span>' : '<span class="pill">แผนงาน</span>';
  return `<li>
    <input type="checkbox" ${a.done ? 'checked' : ''} onchange="toggleDone('${a.id}')" title="ทำแล้ว" style="width:auto;margin-top:.3rem">
    <div class="grow"><div><span class="dot" style="background:${plotColor(a.plotId)}"></span><b>${esc(a.type)}</b> · ${esc(plotName(a.plotId))} ${status}</div>
      <div class="small muted">${fmtDate(a.date)}${a.detail ? ' — ' + esc(a.detail) : ''}${a.stockId ? ` · ใช้ ${esc(DB.stock.find(s => s.id === a.stockId)?.name || '?')} ${fmtNum(a.stockQty, 2)}` : ''}</div></div>
    <button class="icon-btn" title="แก้ไข" onclick="editActivity('${a.id}')">✏️</button>
    <button class="icon-btn" title="ลบ" onclick="deleteActivity('${a.id}')">🗑️</button></li>`;
}

// ---------- หน้า: แปลงปลูก ----------
PAGES.plots = () => {
  const cards = DB.plots.map(p => {
    const acts = DB.activities.filter(a => a.plotId === p.id && a.done).sort((a, b) => b.date.localeCompare(a.date));
    const fin = DB.finance.filter(f => f.plotId === p.id);
    const inc = fin.filter(f => f.type === 'in').reduce((a, f) => a + +f.amount, 0);
    const exp = fin.filter(f => f.type === 'out').reduce((a, f) => a + +f.amount, 0);
    const wa = areaWa(p);
    const density = p.trees && wa ? `${fmtNum(p.trees / (wa / WA_PER_RAI), 0)} ต้น/ไร่` : '';
    const age = p.plantDate ? ageText(p.plantDate) : '';
    return `<div class="card plot-card" style="--plot-color:${p.color}">
      <h3>${esc(p.name)}<span><button class="icon-btn" onclick="editPlot('${p.id}')" title="แก้ไข">✏️</button><button class="icon-btn" onclick="deletePlot('${p.id}')" title="ลบ">🗑️</button></span></h3>
      <div><b>${esc(p.crop || '-')}</b>${p.variety ? ` <span class="muted">(${esc(p.variety)})</span>` : ''}</div>
      <div class="meta">พื้นที่ ${fmtArea(wa)} · ${fmtNum(p.trees)} ต้น ${density ? '· ' + density : ''}</div>
      ${p.plantDate ? `<div class="meta">ปลูกเมื่อ ${fmtDate(p.plantDate)} (${age})</div>` : ''}
      ${p.spacing ? `<div class="meta">ระยะปลูก ${esc(p.spacing)}</div>` : ''}
      ${p.note ? `<div class="meta" style="margin-top:.3rem">${esc(p.note)}</div>` : ''}
      <hr style="border:none;border-top:1px solid var(--border);margin:.6rem 0">
      <div class="small">งานล่าสุด: ${acts[0] ? `${esc(acts[0].type)} (${fmtDate(acts[0].date)})` : '<span class="muted">ยังไม่มี</span>'}</div>
      <div class="small">รายรับ ${fmtMoney(inc)} · รายจ่าย ${fmtMoney(exp)}</div>
      <div class="row" style="margin-top:.5rem"><button class="btn small" onclick="editActivity(null,'${p.id}')">+ บันทึกงาน</button><button class="btn small" onclick="editFinance(null,'${p.id}')">+ รายรับ/จ่าย</button></div>
    </div>`;
  }).join('');
  const totalWa = DB.plots.reduce((a, p) => a + areaWa(p), 0);
  return `<div class="page-head"><h1>แปลงปลูก</h1><button class="btn primary" onclick="editPlot()">+ เพิ่มแปลง</button></div>
    <p class="muted" style="margin-top:-.5rem">${DB.plots.length} แปลง · พื้นที่รวม ${fmtArea(totalWa)}</p>
    ${DB.plots.length ? `<div class="grid cols-3">${cards}</div>` : '<div class="card empty">ยังไม่มีแปลง — กด “เพิ่มแปลง” เพื่อเริ่มต้น</div>'}`;
};
function ageText(s) {
  const d = parseYmd(s), now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) m--;
  if (m < 0) return 'ยังไม่ถึงวันปลูก';
  return m >= 12 ? `อายุ ${Math.floor(m / 12)} ปี ${m % 12} เดือน` : `อายุ ${m} เดือน`;
}
window.editPlot = (id) => {
  const p = id ? plotById(id) : { color: PLOT_COLORS[DB.plots.length % PLOT_COLORS.length] };
  openModal(id ? 'แก้ไขแปลง' : 'เพิ่มแปลงใหม่', `
    <label class="field"><span>ชื่อแปลง *</span><input name="name" required value="${esc(p.name)}" placeholder="เช่น แปลง A หลังบ้าน"></label>
    <div class="field-row">
      <label class="field"><span>พืชที่ปลูก</span><input name="crop" value="${esc(p.crop)}" placeholder="เช่น ทุเรียน"></label>
      <label class="field"><span>สายพันธุ์</span><input name="variety" value="${esc(p.variety)}" placeholder="เช่น หมอนทอง"></label>
    </div>
    <span class="small muted">เนื้อที่</span>
    <div class="field-row">
      <label class="field"><span>ไร่</span><input name="rai" type="number" min="0" step="1" value="${esc(p.rai ?? '')}"></label>
      <label class="field"><span>งาน</span><input name="ngan" type="number" min="0" max="3" step="1" value="${esc(p.ngan ?? '')}"></label>
      <label class="field"><span>ตร.วา</span><input name="wa" type="number" min="0" step="0.1" value="${esc(p.wa ?? '')}"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>จำนวนต้น</span><input name="trees" type="number" min="0" value="${esc(p.trees ?? '')}"></label>
      <label class="field"><span>ระยะปลูก</span><input name="spacing" value="${esc(p.spacing)}" placeholder="เช่น 8×8 ม."></label>
      <label class="field"><span>วันที่ปลูก</span><input name="plantDate" type="date" value="${esc(p.plantDate)}"></label>
    </div>
    <label class="field"><span>สีประจำแปลง</span><select name="color">${PLOT_COLORS.map(c => `<option value="${c}" ${c === p.color ? 'selected' : ''} style="color:${c}">■ ${c}</option>`).join('')}</select></label>
    <label class="field"><span>หมายเหตุ</span><textarea name="note" placeholder="ลักษณะดิน แหล่งน้ำ ฯลฯ">${esc(p.note)}</textarea></label>`,
    fd => {
      if (!fd.name.trim()) return false;
      const rec = { ...p, ...fd, name: fd.name.trim() };
      if (id) Object.assign(p, rec); else DB.plots.push({ id: uid(), ...rec });
      toast('บันทึกแปลงแล้ว');
    });
};
window.deletePlot = id => confirmDelete('แปลง', () => { DB.plots = DB.plots.filter(p => p.id !== id); });

// ---------- หน้า: ปฏิทินงาน ----------
PAGES.calendar = () => {
  const [y, m] = CAL.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const today = todayStr();
  const acts = DB.activities.filter(a => !CAL.plot || a.plotId === CAL.plot);
  const byDate = {};
  acts.forEach(a => (byDate[a.date] ||= []).push(a));
  let cells = TH_DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const s = ymd(d), list = byDate[s] || [];
    if (i >= 35 && d.getMonth() !== m - 1) break;
    cells += `<button class="cal-day ${d.getMonth() !== m - 1 ? 'other' : ''} ${s === today ? 'today' : ''} ${s === CAL.selected ? 'selected' : ''}" onclick="calSelect('${s}')">
      <span class="num">${d.getDate()}</span>
      ${list.slice(0, 3).map(a => `<span class="cal-ev ${a.done ? '' : 'plan'}" style="--plot-color:${plotColor(a.plotId)}">${esc(a.type)}</span>`).join('')}
      ${list.length > 3 ? `<span class="cal-more">+${list.length - 3}</span>` : ''}</button>`;
  }
  const dayList = (byDate[CAL.selected] || []);
  const monthActs = acts.filter(a => monthKey(a.date) === CAL.month);
  const counts = {};
  monthActs.filter(a => a.done).forEach(a => counts[a.type] = (counts[a.type] || 0) + 1);
  return `<div class="page-head"><h1>ปฏิทินงาน</h1><div class="row">
      <select onchange="CAL.plot=this.value;render()" style="width:auto">${plotOptions(CAL.plot, true, 'ทุกแปลง')}</select>
      <button class="btn primary" onclick="editActivity(null, CAL.plot, CAL.selected)">+ บันทึกงาน</button></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
      <div class="card" style="grid-column:span 2;min-width:0">
        <div class="cal-head" style="margin-bottom:.6rem">
          <button class="btn small" onclick="calMove(-1)">‹</button>
          <h2 style="margin:0;flex:1;text-align:center">${monthLabel(CAL.month, true)}</h2>
          <button class="btn small" onclick="calMove(1)">›</button>
          <button class="btn small" onclick="CAL.month=monthKey(todayStr());CAL.selected=todayStr();render()">วันนี้</button>
        </div>
        <div class="cal-grid">${cells}</div>
        <p class="small muted" style="margin:.5rem 0 0">กรอบทึบ = ทำแล้ว · กรอบเส้นประ = แผนงานที่ยังไม่ทำ · สีตามแปลง</p>
      </div>
      <div class="grid">
        <div class="card"><h2>${fmtDate(CAL.selected)}<button class="btn small" onclick="editActivity(null, CAL.plot, CAL.selected)">+ เพิ่ม</button></h2>
          ${dayList.length ? `<ul class="list">${dayList.map(activityLi).join('')}</ul>` : '<div class="empty">ไม่มีบันทึกในวันนี้</div>'}</div>
        <div class="card"><h3>สรุปงานที่ทำในเดือนนี้</h3>
          ${Object.keys(counts).length ? `<table>${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v} ครั้ง</td></tr>`).join('')}</table>` : '<div class="empty">ยังไม่มี</div>'}</div>
      </div>
    </div>`;
};
window.calSelect = s => { CAL.selected = s; if (monthKey(s) !== CAL.month) CAL.month = monthKey(s); render(); };
window.calMove = n => {
  const [y, m] = CAL.month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  CAL.month = monthKey(ymd(d)); CAL.selected = ymd(d); render();
};
window.editActivity = (id, plotId = '', date = '') => {
  const a = id ? DB.activities.find(x => x.id === id) : { plotId, date: date || todayStr(), type: ACTIVITY_TYPES[0], done: (date || todayStr()) <= todayStr() };
  openModal(id ? 'แก้ไขบันทึกงาน' : 'บันทึกงาน / วางแผนงาน', `
    <div class="field-row">
      <label class="field"><span>วันที่</span><input name="date" type="date" required value="${esc(a.date)}"></label>
      <label class="field"><span>แปลง</span><select name="plotId">${plotOptions(a.plotId)}</select></label>
    </div>
    <label class="field"><span>ประเภทงาน</span><select name="type">${options(ACTIVITY_TYPES, a.type)}</select></label>
    <label class="field"><span>รายละเอียด</span><textarea name="detail" placeholder="เช่น ใส่ปุ๋ย 15-15-15 ต้นละ 1 กก.">${esc(a.detail)}</textarea></label>
    <div class="field-row">
      <label class="field"><span>วัสดุที่ใช้ (ตัดจากคลัง)</span><select name="stockId"><option value="">— ไม่ระบุ —</option>${DB.stock.map(s => `<option value="${s.id}" ${s.id === a.stockId ? 'selected' : ''}>${esc(s.name)} (${fmtNum(s.qty, 2)} ${esc(s.unit)})</option>`).join('')}</select></label>
      <label class="field"><span>จำนวนที่ใช้</span><input name="stockQty" type="number" min="0" step="any" value="${esc(a.stockQty ?? '')}"></label>
    </div>
    <label class="field inline-check"><input type="checkbox" name="done" ${a.done ? 'checked' : ''}> <span style="margin:0">ทำเสร็จแล้ว (ไม่ติ๊ก = แผนงาน/งานที่ต้องทำ)</span></label>`,
    fd => {
      const rec = { date: fd.date, plotId: fd.plotId, type: fd.type, detail: fd.detail.trim(), stockId: fd.stockId, stockQty: fd.stockId ? +fd.stockQty || 0 : 0, done: !!fd.done };
      if (id) {
        if (a.done) applyStock(a, +1); // คืนของเดิมก่อน
        Object.assign(a, rec);
        if (a.done) applyStock(a, -1);
      } else {
        const n = { id: uid(), ...rec };
        DB.activities.push(n);
        if (n.done) applyStock(n, -1);
      }
      toast('บันทึกแล้ว');
    });
};
window.toggleDone = id => {
  const a = DB.activities.find(x => x.id === id);
  a.done = !a.done;
  applyStock(a, a.done ? -1 : +1);
  save(); render();
};
window.deleteActivity = id => confirmDelete('บันทึกงาน', () => {
  const a = DB.activities.find(x => x.id === id);
  if (a?.done) applyStock(a, +1);
  DB.activities = DB.activities.filter(x => x.id !== id);
});

// ---------- หน้า: ลมฝน ----------
PAGES.weather = () => {
  const s = DB.settings;
  const locForm = `<div class="card"><h2>📍 ตำแหน่งสวน</h2>
    <p class="small muted" style="margin-top:0">${s.lat != null ? `ปัจจุบัน: <b>${esc(s.locName || 'ไม่ระบุชื่อ')}</b> (${(+s.lat).toFixed(4)}, ${(+s.lon).toFixed(4)})` : 'ยังไม่ได้ตั้งตำแหน่ง'}</p>
    <div class="row"><button class="btn primary" onclick="useGeo()">ใช้ตำแหน่งปัจจุบันของฉัน</button></div>
    <form class="row" style="margin-top:.6rem" onsubmit="event.preventDefault();searchPlace(this.q.value)">
      <input name="q" placeholder="หรือค้นหาชื่ออำเภอ/จังหวัด เช่น จันทบุรี" style="flex:1;min-width:180px"><button class="btn">ค้นหา</button></form>
    <div id="geoResults"></div></div>`;
  if (s.lat == null) return `<div class="page-head"><h1>ลมฝน</h1></div>${locForm}`;
  if (!WX?.data || WX.lat !== s.lat || WX.lon !== s.lon) {
    if (WX_STATE !== 'loading' && WX_STATE !== 'error') setTimeout(() => fetchWeather(), 0);
    return `<div class="page-head"><h1>ลมฝน</h1></div><div class="card">${WX_STATE === 'error' ? `<p>${esc(WX_ERR)}</p><button class="btn" onclick="fetchWeather(true)">ลองใหม่</button>` : '<p class="muted">กำลังโหลดพยากรณ์…</p>'}</div>${locForm}`;
  }
  const c = WX.data.current, d = WX.data.daily, [ic, txt] = wxInfo(c.weather_code);
  const hours = wxNext(24);
  const hourChart = barChart({
    labels: hours.map(h => h.time.slice(11, 13) + 'น.'),
    tipTitles: hours.map(h => `${fmtDate(h.time.slice(0, 10), false)} ${h.time.slice(11, 16)} น.`),
    series: [{ name: 'โอกาสฝน', values: hours.map(h => h.prob) }],
    fmt: v => `${fmtNum(v)}%`, axisEvery: 3, max: 100,
  });
  const days = d.time.map((t, i) => {
    const [di, dt] = wxInfo(d.weather_code[i]);
    const dow = TH_DOW[parseYmd(t).getDay()];
    return `<div class="wx-day"><div class="small"><b>${i === 0 ? 'วันนี้' : dow + '.'}</b> ${fmtDate(t, false)}</div><div class="ic" title="${esc(dt)}">${di}</div>
      <div><b>${d.precipitation_probability_max[i] ?? 0}%</b> <span class="small muted">ฝน</span></div>
      <div class="small">${fmtNum(d.precipitation_sum[i], 1)} มม.</div>
      <div class="small muted">${fmtNum(d.temperature_2m_min[i])}°–${fmtNum(d.temperature_2m_max[i])}°</div>
      <div class="small muted">ลม ${fmtNum(d.wind_speed_10m_max[i])} กม./ชม.</div></div>`;
  }).join('');
  const updated = new Date(WX.fetchedAt);
  return `<div class="page-head"><h1>ลมฝน · ${esc(s.locName || '')}</h1>
      <div class="row"><span class="small muted">อัปเดต ${pad(updated.getHours())}:${pad(updated.getMinutes())} น.</span><button class="btn small" onclick="fetchWeather(true)">↻ รีเฟรช</button></div></div>
    <div class="grid cols-2">
      <div class="card"><h2>ตอนนี้</h2>
        <div class="wx-now"><span class="wx-icon">${ic}</span><div><div class="wx-big">${fmtNum(c.temperature_2m, 1)}°C</div><div class="muted">${esc(txt)}</div></div>
        <table style="width:auto;flex:1">
          <tr><td>โอกาสฝนวันนี้</td><td class="num"><b>${d.precipitation_probability_max[0] ?? 0}%</b></td></tr>
          <tr><td>ปริมาณฝนคาดการณ์</td><td class="num">${fmtNum(d.precipitation_sum[0], 1)} มม.</td></tr>
          <tr><td>ลม</td><td class="num">${fmtNum(c.wind_speed_10m)} กม./ชม. (กระโชก ${fmtNum(c.wind_gusts_10m)})</td></tr>
          <tr><td>ทิศลม</td><td class="num">จาก${windDir(c.wind_direction_10m)}</td></tr>
          <tr><td>ความชื้น</td><td class="num">${fmtNum(c.relative_humidity_2m)}%</td></tr>
          <tr><td>UV สูงสุด</td><td class="num">${fmtNum(d.uv_index_max[0], 1)}</td></tr>
        </table></div></div>
      <div class="card"><h2>คำแนะนำงานสวนวันนี้</h2>
        ${wxAdvice().map(([cls, t, sub]) => `<div class="advice ${cls}"><b>${t}</b><div class="small">${esc(sub)}</div></div>`).join('')}
        <p class="small muted" style="margin:.6rem 0 0">คำแนะนำนี้คำนวณจากพยากรณ์อัตโนมัติ ใช้ประกอบการตัดสินใจเท่านั้น</p></div>
    </div>
    <div class="card" style="margin-top:12px"><h2>โอกาสฝนรายชั่วโมง (24 ชม. ข้างหน้า)</h2>${hourChart}</div>
    <div class="card" style="margin-top:12px"><h2>พยากรณ์ 7 วัน</h2><div class="wx-days">${days}</div></div>
    <div style="margin-top:12px">${locForm}</div>
    <p class="small muted">ข้อมูลพยากรณ์จาก <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>`;
};
window.fetchWeather = fetchWeather;
window.useGeo = () => {
  if (!navigator.geolocation) return toast('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
  toast('กำลังหาตำแหน่ง…');
  navigator.geolocation.getCurrentPosition(pos => {
    DB.settings.lat = +pos.coords.latitude.toFixed(4); DB.settings.lon = +pos.coords.longitude.toFixed(4);
    DB.settings.locName = 'ตำแหน่งปัจจุบัน'; save(); fetchWeather(true);
  }, () => toast('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — ลองค้นหาด้วยชื่อแทน'), { timeout: 15000 });
};
window.searchPlace = async q => {
  q = q.trim(); if (!q) return;
  const box = document.getElementById('geoResults');
  box.innerHTML = '<p class="muted small">กำลังค้นหา…</p>';
  try {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: q, count: 8, language: 'th' }));
    const j = await r.json();
    const res = j.results || [];
    box.innerHTML = res.length ? `<ul class="list">${res.map(p => `<li><span class="grow">${esc(p.name)}<span class="small muted"> · ${esc([p.admin2, p.admin1, p.country].filter(Boolean).join(', '))}</span></span>
      <button class="btn small" onclick='setPlace(${p.latitude},${p.longitude},${JSON.stringify(esc(p.name + (p.admin1 ? ', ' + p.admin1 : '')))})'>เลือก</button></li>`).join('')}</ul>`
      : '<p class="muted small">ไม่พบสถานที่ ลองพิมพ์ชื่ออำเภอหรือจังหวัด</p>';
  } catch { box.innerHTML = '<p class="small">ค้นหาไม่สำเร็จ</p>'; }
};
window.setPlace = (lat, lon, name) => {
  Object.assign(DB.settings, { lat: +(+lat).toFixed(4), lon: +(+lon).toFixed(4), locName: name });
  save(); fetchWeather(true);
};

// ---------- หน้า: ผลผลิต ----------
PAGES.harvest = () => {
  const list = [...DB.harvests].sort((a, b) => b.date.localeCompare(a.date));
  const byPlot = {};
  DB.harvests.forEach(h => {
    const k = h.plotId + '|' + h.unit;
    byPlot[k] ||= { plotId: h.plotId, unit: h.unit, qty: 0, value: 0, n: 0 };
    byPlot[k].qty += +h.qty || 0; byPlot[k].value += (+h.qty || 0) * (+h.price || 0); byPlot[k].n++;
  });
  return `<div class="page-head"><h1>ผลผลิต</h1><button class="btn primary" onclick="editHarvest()">+ บันทึกผลผลิต</button></div>
    <div class="card"><h2>สรุปตามแปลง</h2>
      ${Object.keys(byPlot).length ? `<div class="table-wrap"><table><tr><th>แปลง</th><th class="num">ครั้ง</th><th class="num">ปริมาณรวม</th><th class="num">มูลค่ารวม</th><th class="num">ต่อต้น</th></tr>
      ${Object.values(byPlot).map(r => { const p = plotById(r.plotId); return `<tr><td><span class="dot" style="background:${plotColor(r.plotId)}"></span>${esc(plotName(r.plotId))}</td><td class="num">${r.n}</td><td class="num">${fmtNum(r.qty, 2)} ${esc(r.unit)}</td><td class="num">${fmtMoney(r.value)}</td><td class="num">${p?.trees ? fmtNum(r.qty / p.trees, 2) + ' ' + esc(r.unit) : '-'}</td></tr>`; }).join('')}</table></div>` : '<div class="empty">ยังไม่มีบันทึกผลผลิต</div>'}</div>
    <div class="card" style="margin-top:12px"><h2>รายการทั้งหมด</h2>
      ${list.length ? `<div class="table-wrap"><table><tr><th>วันที่</th><th>แปลง</th><th>ผลผลิต</th><th class="num">ปริมาณ</th><th class="num">ราคา/หน่วย</th><th class="num">มูลค่า</th><th></th></tr>
      ${list.map(h => `<tr><td>${fmtDate(h.date)}</td><td>${esc(plotName(h.plotId))}</td><td>${esc(h.product)}${h.grade ? ` <span class="pill">${esc(h.grade)}</span>` : ''}</td><td class="num">${fmtNum(h.qty, 2)} ${esc(h.unit)}</td><td class="num">${h.price ? fmtMoney(h.price) : '-'}</td><td class="num">${fmtMoney((+h.qty || 0) * (+h.price || 0))}</td>
      <td class="num"><button class="icon-btn" onclick="editHarvest('${h.id}')">✏️</button><button class="icon-btn" onclick="deleteHarvest('${h.id}')">🗑️</button></td></tr>`).join('')}</table></div>` : '<div class="empty">—</div>'}</div>`;
};
window.editHarvest = id => {
  const h = id ? DB.harvests.find(x => x.id === id) : { date: todayStr(), unit: 'กก.' };
  const defProduct = h.product || plotById(h.plotId)?.crop || '';
  openModal(id ? 'แก้ไขผลผลิต' : 'บันทึกผลผลิต', `
    <div class="field-row">
      <label class="field"><span>วันที่</span><input name="date" type="date" required value="${esc(h.date)}"></label>
      <label class="field"><span>แปลง</span><select name="plotId">${plotOptions(h.plotId)}</select></label>
    </div>
    <div class="field-row">
      <label class="field"><span>ผลผลิต</span><input name="product" value="${esc(defProduct)}" placeholder="เช่น ทุเรียน"></label>
      <label class="field"><span>เกรด</span><input name="grade" value="${esc(h.grade)}" placeholder="เช่น A, B, ตกเกรด"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>ปริมาณ</span><input name="qty" type="number" min="0" step="any" required value="${esc(h.qty ?? '')}"></label>
      <label class="field"><span>หน่วย</span><input name="unit" value="${esc(h.unit)}" list="unitList"><datalist id="unitList">${['กก.', 'ตัน', 'ลูก', 'หวี', 'เครือ', 'ตะกร้า'].map(u => `<option value="${u}">`).join('')}</datalist></label>
      <label class="field"><span>ราคาขาย/หน่วย</span><input name="price" type="number" min="0" step="any" value="${esc(h.price ?? '')}"></label>
    </div>
    ${id ? '' : '<label class="field inline-check"><input type="checkbox" name="toFinance" checked> <span style="margin:0">ลงบัญชีรายรับอัตโนมัติ (ถ้ามีราคาขาย)</span></label>'}`,
    fd => {
      const rec = { date: fd.date, plotId: fd.plotId, product: fd.product.trim(), grade: fd.grade.trim(), qty: +fd.qty || 0, unit: fd.unit.trim() || 'กก.', price: +fd.price || 0 };
      if (id) Object.assign(h, rec);
      else {
        DB.harvests.push({ id: uid(), ...rec });
        if (fd.toFinance && rec.price > 0) DB.finance.push({ id: uid(), date: rec.date, type: 'in', category: 'ขายผลผลิต', plotId: rec.plotId, amount: Math.round(rec.qty * rec.price * 100) / 100, note: `${rec.product} ${rec.grade} ${fmtNum(rec.qty, 2)} ${rec.unit} × ${rec.price}`.replace(/\s+/g, ' ') });
      }
      toast('บันทึกผลผลิตแล้ว');
    });
};
window.deleteHarvest = id => confirmDelete('บันทึกผลผลิต', () => { DB.harvests = DB.harvests.filter(x => x.id !== id); });

// ---------- หน้า: บัญชี ----------
PAGES.finance = () => {
  const list = DB.finance.filter(f => (!FIN.month || monthKey(f.date) === FIN.month) && (!FIN.type || f.type === FIN.type) && (FIN.plot === '' || (FIN.plot === '_none' ? !f.plotId : f.plotId === FIN.plot)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const inc = list.filter(f => f.type === 'in').reduce((a, f) => a + +f.amount, 0);
  const exp = list.filter(f => f.type === 'out').reduce((a, f) => a + +f.amount, 0);
  // 12 เดือนล่าสุด
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) months.push(monthKey(ymd(new Date(now.getFullYear(), now.getMonth() - i, 1))));
  const sumBy = (mk, t) => DB.finance.filter(f => monthKey(f.date) === mk && f.type === t && (FIN.plot === '' || (FIN.plot === '_none' ? !f.plotId : f.plotId === FIN.plot))).reduce((a, f) => a + +f.amount, 0);
  const incM = months.map(mk => sumBy(mk, 'in')), expM = months.map(mk => sumBy(mk, 'out'));
  const chart = barChart({ labels: months.map(mk => monthLabel(mk)), tipTitles: months.map(mk => monthLabel(mk, true)), series: [{ name: 'รายรับ', values: incM }, { name: 'รายจ่าย', values: expM, cls: 's2' }], fmt: fmtMoney, axisEvery: 2 });
  const cat = {};
  list.forEach(f => { const k = f.type + '|' + f.category; cat[k] = (cat[k] || 0) + +f.amount; });
  const monthsWithData = [...new Set(DB.finance.map(f => monthKey(f.date)))].sort().reverse();
  return `<div class="page-head"><h1>บัญชีรายรับ–รายจ่าย</h1><div class="row">
      <button class="btn primary" onclick="editFinance(null,'',null,'in')">+ รายรับ</button><button class="btn" onclick="editFinance(null,'',null,'out')">+ รายจ่าย</button>
      <button class="btn ghost" onclick="exportFinanceCsv()">⬇ CSV</button></div></div>
    <div class="row" style="margin-bottom:12px">
      <select style="width:auto" onchange="FIN.month=this.value;render()"><option value="">ทุกเดือน</option>${monthsWithData.map(mk => `<option value="${mk}" ${mk === FIN.month ? 'selected' : ''}>${monthLabel(mk, true)}</option>`).join('')}</select>
      <select style="width:auto" onchange="FIN.type=this.value;render()"><option value="">รับ+จ่าย</option><option value="in" ${FIN.type === 'in' ? 'selected' : ''}>รายรับ</option><option value="out" ${FIN.type === 'out' ? 'selected' : ''}>รายจ่าย</option></select>
      <select style="width:auto" onchange="FIN.plot=this.value;render()"><option value="">ทุกแปลง</option><option value="_none" ${FIN.plot === '_none' ? 'selected' : ''}>ทั้งสวน (ไม่ระบุแปลง)</option>${DB.plots.map(p => `<option value="${p.id}" ${p.id === FIN.plot ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    </div>
    <div class="grid cols-4">
      <div class="card stat"><div class="label">รายรับ</div><div class="value">${fmtMoney(inc)}</div></div>
      <div class="card stat"><div class="label">รายจ่าย</div><div class="value">${fmtMoney(exp)}</div></div>
      <div class="card stat"><div class="label">กำไร/ขาดทุน</div><div class="value" style="color:${inc - exp >= 0 ? 'var(--good)' : 'var(--bad)'}">${inc - exp >= 0 ? '+' : ''}${fmtMoney(inc - exp)}</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:12px">
      <div class="card"><h2>12 เดือนล่าสุด</h2>${chart}
        <details style="margin-top:.6rem"><summary class="small">ดูเป็นตาราง</summary><div class="table-wrap"><table><tr><th>เดือน</th><th class="num">รายรับ</th><th class="num">รายจ่าย</th><th class="num">สุทธิ</th></tr>
        ${months.map((mk, i) => `<tr><td>${monthLabel(mk, true)}</td><td class="num">${fmtMoney(incM[i])}</td><td class="num">${fmtMoney(expM[i])}</td><td class="num">${fmtMoney(incM[i] - expM[i])}</td></tr>`).join('')}</table></div></details></div>
      <div class="card"><h2>แยกตามหมวด</h2>
        ${Object.keys(cat).length ? `<table>${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [t, c] = k.split('|'); return `<tr><td><span class="pill ${t === 'in' ? 'good' : ''}">${t === 'in' ? 'รับ' : 'จ่าย'}</span> ${esc(c)}</td><td class="num">${fmtMoney(v)}</td></tr>`; }).join('')}</table>` : '<div class="empty">—</div>'}</div>
    </div>
    <div class="card" style="margin-top:12px"><h2>รายการ (${list.length})</h2>
      ${list.length ? `<div class="table-wrap"><table><tr><th>วันที่</th><th>หมวด</th><th>แปลง</th><th>รายละเอียด</th><th class="num">จำนวนเงิน</th><th></th></tr>
      ${list.map(f => `<tr><td>${fmtDate(f.date)}</td><td><span class="pill ${f.type === 'in' ? 'good' : ''}">${f.type === 'in' ? 'รับ' : 'จ่าย'}</span> ${esc(f.category)}</td><td>${esc(plotName(f.plotId))}</td><td>${esc(f.note)}</td>
      <td class="num" style="color:${f.type === 'in' ? 'var(--good)' : 'var(--text)'}">${f.type === 'in' ? '+' : '−'}${fmtMoney(f.amount)}</td>
      <td class="num"><button class="icon-btn" onclick="editFinance('${f.id}')">✏️</button><button class="icon-btn" onclick="deleteFinance('${f.id}')">🗑️</button></td></tr>`).join('')}</table></div>` : '<div class="empty">ไม่มีรายการ</div>'}</div>`;
};
window.editFinance = (id, plotId = '', _unused = null, type = 'out') => {
  const f = id ? DB.finance.find(x => x.id === id) : { date: todayStr(), type, plotId };
  const catOpts = t => options(t === 'in' ? INCOME_CATS : EXPENSE_CATS, f.category);
  openModal(id ? 'แก้ไขรายการ' : 'เพิ่มรายรับ/รายจ่าย', `
    <div class="field-row">
      <label class="field"><span>ประเภท</span><select name="type" onchange="this.form.category.innerHTML=this.value==='in'?${esc(JSON.stringify(options(INCOME_CATS)))}:${esc(JSON.stringify(options(EXPENSE_CATS)))}">
        <option value="out" ${f.type === 'out' ? 'selected' : ''}>รายจ่าย</option><option value="in" ${f.type === 'in' ? 'selected' : ''}>รายรับ</option></select></label>
      <label class="field"><span>หมวด</span><select name="category">${catOpts(f.type)}</select></label>
    </div>
    <div class="field-row">
      <label class="field"><span>วันที่</span><input name="date" type="date" required value="${esc(f.date)}"></label>
      <label class="field"><span>จำนวนเงิน (บาท)</span><input name="amount" type="number" min="0" step="any" required value="${esc(f.amount ?? '')}"></label>
    </div>
    <label class="field"><span>แปลง</span><select name="plotId">${plotOptions(f.plotId)}</select></label>
    <label class="field"><span>รายละเอียด</span><input name="note" value="${esc(f.note)}" placeholder="เช่น ปุ๋ย 15-15-15 จำนวน 5 กระสอบ"></label>`,
    fd => {
      const rec = { date: fd.date, type: fd.type, category: fd.category, plotId: fd.plotId, amount: +fd.amount || 0, note: fd.note.trim() };
      if (id) Object.assign(f, rec); else DB.finance.push({ id: uid(), ...rec });
      toast('บันทึกแล้ว');
    });
};
window.deleteFinance = id => confirmDelete('รายการ', () => { DB.finance = DB.finance.filter(x => x.id !== id); });
window.exportFinanceCsv = () => {
  const rows = [['วันที่', 'ประเภท', 'หมวด', 'แปลง', 'รายละเอียด', 'จำนวนเงิน']].concat(
    [...DB.finance].sort((a, b) => a.date.localeCompare(b.date)).map(f => [f.date, f.type === 'in' ? 'รายรับ' : 'รายจ่าย', f.category, plotName(f.plotId), f.note, f.amount]));
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  download(`บัญชีสวน-${todayStr()}.csv`, csv, 'text/csv');
};

// ---------- หน้า: คลังวัสดุ ----------
PAGES.stock = () => {
  const list = [...DB.stock].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  return `<div class="page-head"><h1>คลังวัสดุ (ปุ๋ย ยา อุปกรณ์)</h1><button class="btn primary" onclick="editStock()">+ เพิ่มรายการ</button></div>
    <p class="muted small" style="margin-top:-.5rem">เมื่อบันทึกงานและเลือก “วัสดุที่ใช้” ระบบจะตัดยอดคงเหลือให้อัตโนมัติ</p>
    <div class="card">${list.length ? `<div class="table-wrap"><table><tr><th>รายการ</th><th class="num">คงเหลือ</th><th class="num">แจ้งเตือนเมื่อต่ำกว่า</th><th></th><th></th></tr>
      ${list.map(s => { const low = s.minQty !== '' && s.minQty != null && +s.qty <= +s.minQty; return `<tr><td><b>${esc(s.name)}</b>${s.note ? `<div class="small muted">${esc(s.note)}</div>` : ''}</td>
        <td class="num">${fmtNum(s.qty, 2)} ${esc(s.unit)} ${low ? '<span class="pill warn">ใกล้หมด</span>' : ''}</td><td class="num">${s.minQty !== '' && s.minQty != null ? fmtNum(s.minQty, 2) + ' ' + esc(s.unit) : '-'}</td>
        <td class="num"><button class="btn small" onclick="adjustStock('${s.id}',1)">+ รับเข้า</button> <button class="btn small" onclick="adjustStock('${s.id}',-1)">− เบิกออก</button></td>
        <td class="num"><button class="icon-btn" onclick="editStock('${s.id}')">✏️</button><button class="icon-btn" onclick="deleteStock('${s.id}')">🗑️</button></td></tr>`; }).join('')}</table></div>` : '<div class="empty">ยังไม่มีรายการในคลัง</div>'}</div>`;
};
window.editStock = id => {
  const s = id ? DB.stock.find(x => x.id === id) : { unit: 'กก.', qty: 0 };
  openModal(id ? 'แก้ไขรายการ' : 'เพิ่มรายการในคลัง', `
    <label class="field"><span>ชื่อ *</span><input name="name" required value="${esc(s.name)}" placeholder="เช่น ปุ๋ย 15-15-15"></label>
    <div class="field-row">
      <label class="field"><span>คงเหลือ</span><input name="qty" type="number" step="any" value="${esc(s.qty)}"></label>
      <label class="field"><span>หน่วย</span><input name="unit" value="${esc(s.unit)}" list="stockUnits"><datalist id="stockUnits">${STOCK_UNITS.map(u => `<option value="${u}">`).join('')}</datalist></label>
      <label class="field"><span>เตือนเมื่อเหลือ ≤</span><input name="minQty" type="number" step="any" value="${esc(s.minQty ?? '')}"></label>
    </div>
    <label class="field"><span>หมายเหตุ</span><input name="note" value="${esc(s.note)}" placeholder="ร้านที่ซื้อ ราคา ฯลฯ"></label>`,
    fd => {
      if (!fd.name.trim()) return false;
      const rec = { name: fd.name.trim(), qty: +fd.qty || 0, unit: fd.unit.trim(), minQty: fd.minQty === '' ? '' : +fd.minQty, note: fd.note.trim() };
      if (id) Object.assign(s, rec); else DB.stock.push({ id: uid(), ...rec });
    });
};
window.adjustStock = (id, sign) => {
  const s = DB.stock.find(x => x.id === id);
  openModal(`${sign > 0 ? 'รับเข้า' : 'เบิกออก'}: ${s.name}`, `
    <label class="field"><span>จำนวน (${esc(s.unit)})</span><input name="qty" type="number" min="0" step="any" required></label>
    ${sign > 0 ? `<label class="field"><span>ราคารวม (บาท) — ถ้าใส่จะลงบัญชีรายจ่ายให้</span><input name="cost" type="number" min="0" step="any"></label>` : ''}`,
    fd => {
      const q = +fd.qty || 0;
      s.qty = Math.round(((+s.qty || 0) + sign * q) * 1000) / 1000;
      if (sign > 0 && +fd.cost > 0) {
        const cat = /ยา|สาร|ฮอร์โมน/.test(s.name) ? 'ยา/สารเคมี' : /ปุ๋ย/.test(s.name) ? 'ปุ๋ย' : 'อุปกรณ์/เครื่องมือ';
        DB.finance.push({ id: uid(), date: todayStr(), type: 'out', category: cat, plotId: '', amount: +fd.cost, note: `ซื้อ ${s.name} ${fmtNum(q, 2)} ${s.unit}` });
      }
      toast('ปรับยอดแล้ว');
    });
};
window.deleteStock = id => confirmDelete('รายการคลัง', () => { DB.stock = DB.stock.filter(x => x.id !== id); });

// ---------- หน้า: คลังความรู้ ----------
PAGES.knowledge = () => {
  const q = KB.q.trim().toLowerCase();
  const list = DB.knowledge.filter(k => (!KB.cat || k.cat === KB.cat) && (!q || (k.title + ' ' + k.content).toLowerCase().includes(q)));
  return `<div class="page-head"><h1>คลังความรู้</h1><button class="btn primary" onclick="editKb()">+ เพิ่มความรู้</button></div>
    <div class="row" style="margin-bottom:12px">
      <input id="kbSearch" placeholder="ค้นหา เช่น ปุ๋ย, เพลี้ย" value="${esc(KB.q)}" oninput="KB.q=this.value;render();const el=document.getElementById('kbSearch');el.focus();el.setSelectionRange(el.value.length,el.value.length)" style="flex:1;min-width:180px">
      <select style="width:auto" onchange="KB.cat=this.value;render()"><option value="">ทุกหมวด</option>${KB_CATS.map(c => `<option ${c === KB.cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
    ${list.length ? `<div class="grid cols-2">${list.map(k => `<div class="card"><details class="kb" open>
      <summary><span><span class="pill">${esc(k.cat)}</span> ${esc(k.title)}</span><span><button type="button" class="icon-btn" onclick="event.preventDefault();editKb('${k.id}')">✏️</button><button type="button" class="icon-btn" onclick="event.preventDefault();deleteKb('${k.id}')">🗑️</button></span></summary>
      <div class="kb-content">${esc(k.content)}</div></details></div>`).join('')}</div>` : '<div class="card empty">ไม่พบข้อมูล</div>'}
    <p class="small muted">ข้อมูลตั้งต้นเป็นแนวทางทั่วไป ควรปรับตามชนิดพืช สภาพดิน และคำแนะนำจากเจ้าหน้าที่เกษตรในพื้นที่</p>`;
};
window.editKb = id => {
  const k = id ? DB.knowledge.find(x => x.id === id) : { cat: KB_CATS[0] };
  openModal(id ? 'แก้ไขความรู้' : 'เพิ่มความรู้', `
    <label class="field"><span>หัวข้อ *</span><input name="title" required value="${esc(k.title)}" placeholder="เช่น ปุ๋ยหมักชีวภาพ"></label>
    <label class="field"><span>หมวด</span><select name="cat">${options(KB_CATS, k.cat)}</select></label>
    <label class="field"><span>เนื้อหา (ประโยชน์ ช่วยด้านไหน วิธีใช้ ข้อควรระวัง)</span><textarea name="content" style="min-height:180px">${esc(k.content)}</textarea></label>`,
    fd => {
      if (!fd.title.trim()) return false;
      const rec = { title: fd.title.trim(), cat: fd.cat, content: fd.content };
      if (id) Object.assign(k, rec); else DB.knowledge.push({ id: uid(), ...rec });
    });
};
window.deleteKb = id => confirmDelete('หัวข้อความรู้', () => { DB.knowledge = DB.knowledge.filter(x => x.id !== id); });

// ---------- หน้า: ตั้งค่า ----------
PAGES.settings = () => `<div class="page-head"><h1>ตั้งค่า</h1></div>
  <div class="grid cols-2">
    <div class="card"><h2>ข้อมูลสวน</h2>
      <label class="field"><span>ชื่อสวน</span><input value="${esc(DB.settings.farmName)}" onchange="DB.settings.farmName=this.value.trim();save();render()"></label>
      <label class="field"><span>ธีม</span><select onchange="DB.settings.theme=this.value;save();render()">
        ${[['auto', 'ตามระบบ'], ['light', 'สว่าง'], ['dark', 'มืด']].map(([v, l]) => `<option value="${v}" ${DB.settings.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="small muted">ตำแหน่งสวนสำหรับพยากรณ์อากาศ ตั้งได้ที่หน้า <a href="#weather">ลมฝน</a></p></div>
    <div class="card"><h2>สำรอง / ย้ายข้อมูล</h2>
      <p class="small muted" style="margin-top:0">ข้อมูลทั้งหมดเก็บไว้ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ควรกด “ส่งออก” เก็บไว้เป็นระยะ และใช้ “นำเข้า” เพื่อย้ายไปเครื่องอื่น</p>
      <div class="row"><button class="btn primary" onclick="exportAll()">⬇ ส่งออกข้อมูล (.json)</button>
        <label class="btn">⬆ นำเข้าข้อมูล<input type="file" accept=".json,application/json" hidden onchange="importAll(this.files[0])"></label></div>
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">
      <div class="row"><button class="btn small" onclick="loadSample()">ใส่ข้อมูลตัวอย่าง</button><button class="btn small danger" onclick="resetAll()">ล้างข้อมูลทั้งหมด</button></div></div>
  </div>`;
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
window.exportAll = () => download(`สมุดสวน-สำรอง-${todayStr()}.json`, JSON.stringify(DB, null, 2), 'application/json');
window.importAll = async file => {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || !Array.isArray(d.plots) || !Array.isArray(d.activities)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
    if (!confirm('นำเข้าจะเขียนทับข้อมูลปัจจุบันทั้งหมด ดำเนินการต่อ?')) return;
    const base = emptyData();
    DB = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
    save(); render(); toast('นำเข้าข้อมูลแล้ว');
  } catch (e) { alert('นำเข้าไม่สำเร็จ: ' + e.message); }
};
window.resetAll = () => {
  if (!confirm('ล้างข้อมูลทั้งหมด? แนะนำให้ส่งออกสำรองก่อน')) return;
  DB = emptyData(); save(); render(); toast('ล้างข้อมูลแล้ว');
};
window.loadSample = () => {
  if ((DB.plots.length || DB.activities.length || DB.finance.length) && !confirm('จะเพิ่มข้อมูลตัวอย่างต่อจากข้อมูลเดิม ดำเนินการต่อ?')) return;
  const t = todayStr();
  const p1 = { id: uid(), name: 'แปลง A ทุเรียน', crop: 'ทุเรียน', variety: 'หมอนทอง', rai: 3, ngan: 2, wa: 0, trees: 80, spacing: '8×8 ม.', plantDate: addDays(t, -365 * 4), color: PLOT_COLORS[0], note: 'ดินร่วนปนทราย มีสระน้ำด้านทิศเหนือ' };
  const p2 = { id: uid(), name: 'แปลง B มะนาว', crop: 'มะนาว', variety: 'แป้นพิจิตร', rai: 1, ngan: 0, wa: 50, trees: 120, spacing: '4×4 ม.', plantDate: addDays(t, -365 * 2), color: PLOT_COLORS[1], note: '' };
  const s1 = { id: uid(), name: 'ปุ๋ย 15-15-15', qty: 150, unit: 'กก.', minQty: 50, note: '' };
  const s2 = { id: uid(), name: 'ปุ๋ยคอกมูลวัว', qty: 20, unit: 'กระสอบ', minQty: 10, note: '' };
  DB.plots.push(p1, p2); DB.stock.push(s1, s2);
  DB.activities.push(
    { id: uid(), date: addDays(t, -10), plotId: p1.id, type: 'ใส่ปุ๋ย', detail: '15-15-15 ต้นละ 1 กก.', stockId: s1.id, stockQty: 80, done: true },
    { id: uid(), date: addDays(t, -6), plotId: p2.id, type: 'ตัดแต่งกิ่ง', detail: 'ตัดกิ่งกระโดง', done: true },
    { id: uid(), date: addDays(t, -2), plotId: p1.id, type: 'รดน้ำ', detail: 'ระบบสปริงเกอร์ 2 ชม.', done: true },
    { id: uid(), date: addDays(t, -1), plotId: p2.id, type: 'ตรวจโรค/แมลง', detail: 'พบเพลี้ยไฟเล็กน้อยที่ยอดอ่อน', done: true },
    { id: uid(), date: t, plotId: p2.id, type: 'พ่นยา/ฮอร์โมน', detail: 'พ่นสารชีวภัณฑ์ป้องกันเพลี้ยไฟ', done: false },
    { id: uid(), date: addDays(t, 3), plotId: p1.id, type: 'กำจัดวัชพืช', detail: 'ตัดหญ้าใต้ทรงพุ่ม', done: false },
  );
  s1.qty -= 80;
  const m0 = new Date(), mk = i => ymd(new Date(m0.getFullYear(), m0.getMonth() - i, 5));
  DB.finance.push(
    { id: uid(), date: mk(0), type: 'out', category: 'ปุ๋ย', plotId: '', amount: 4500, note: 'ปุ๋ย 15-15-15 จำนวน 5 กระสอบ' },
    { id: uid(), date: mk(0), type: 'out', category: 'ค่าแรง', plotId: p1.id, amount: 1800, note: 'จ้างตัดหญ้า 3 แรง' },
    { id: uid(), date: mk(1), type: 'in', category: 'ขายผลผลิต', plotId: p2.id, amount: 12600, note: 'มะนาว 420 กก. × 30' },
    { id: uid(), date: mk(1), type: 'out', category: 'ยา/สารเคมี', plotId: p2.id, amount: 950, note: 'สารกำจัดเพลี้ยไฟ' },
    { id: uid(), date: mk(2), type: 'out', category: 'ค่าน้ำ/ไฟ', plotId: '', amount: 1200, note: 'ค่าไฟปั๊มน้ำ' },
    { id: uid(), date: mk(3), type: 'in', category: 'ขายผลผลิต', plotId: p1.id, amount: 85000, note: 'ทุเรียน 850 กก. × 100' },
    { id: uid(), date: mk(3), type: 'out', category: 'ค่าแรง', plotId: p1.id, amount: 6000, note: 'ค่าแรงตัดทุเรียน' },
  );
  DB.harvests.push(
    { id: uid(), date: mk(1), plotId: p2.id, product: 'มะนาว', grade: '', qty: 420, unit: 'กก.', price: 30 },
    { id: uid(), date: mk(3), plotId: p1.id, product: 'ทุเรียน', grade: 'A', qty: 850, unit: 'กก.', price: 100 },
  );
  save(); location.hash = '#dashboard'; render(); toast('เพิ่มข้อมูลตัวอย่างแล้ว');
};

// ---------- เริ่มต้น ----------
render();
fetchWeather();
