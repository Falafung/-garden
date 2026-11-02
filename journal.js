/* สมุดสวน — หน้า "บันทึกสวน": ภาพต้นไม้ อายุต้น และบันทึกการเดินดูสวนรายวัน */
'use strict';

// ---------- ข้อมูลอ้างอิง: อาการ / สีใบ ----------
const HEALTH = [
  { key: 'great', label: 'ดีมาก', icon: '😄', cls: 'good' },
  { key: 'ok', label: 'ปกติ', icon: '🙂', cls: '' },
  { key: 'concern', label: 'น่ากังวล', icon: '😟', cls: 'warn' },
  { key: 'bad', label: 'แย่', icon: '😣', cls: 'bad' },
];
const HEALTH_RANK = { great: 0, ok: 1, concern: 2, bad: 3 };

const LEAF_COLORS = [
  { key: 'dark', label: 'เขียวเข้ม เป็นมัน', color: '#2e6b2a', ok: true, note: 'ต้นสมบูรณ์ดี (ถ้าเขียวเข้มจัดแต่ไม่ยอมออกดอก อาจได้ไนโตรเจนมากเกินไป)' },
  { key: 'green', label: 'เขียวปกติ', color: '#4c9a3f', ok: true, note: 'ปกติ' },
  { key: 'flush', label: 'ใบอ่อนแดง/ทองแดง', color: '#b5653b', ok: true, note: 'ปกติของใบอ่อนหลายชนิด เช่น มะม่วง ทุเรียน ลำไย เมื่อใบแก่จะเปลี่ยนเป็นสีเขียว' },
  { key: 'pale', label: 'เขียวอ่อน/ซีดทั้งใบ', color: '#a8c96a', note: 'อาจขาดไนโตรเจน หรือรากทำงานไม่ดี (น้ำขัง ดินแน่น) → ใส่ปุ๋ยไนโตรเจน/ปุ๋ยอินทรีย์ และตรวจการระบายน้ำ' },
  { key: 'yellowold', label: 'เหลืองที่ใบแก่ (ใบล่าง)', color: '#d9c23a', note: 'เหลืองทั้งใบ → มักขาดไนโตรเจน · เหลืองระหว่างเส้นใบ → มักขาดแมกนีเซียม (เสริมดีเกลือ/โดโลไมท์)' },
  { key: 'yellownew', label: 'ใบอ่อนเหลือง เส้นใบเขียว', color: '#e3d65a', vein: true, note: 'มักขาดจุลธาตุ เช่น เหล็ก สังกะสี แมงกานีส พบบ่อยในดินด่างหรือใส่ปูนมาก → พ่นปุ๋ยทางใบที่มีจุลธาตุ และตรวจ pH ดิน' },
  { key: 'purple', label: 'ม่วงแดง (ใบแก่)', color: '#8e4a6b', note: 'อาจขาดฟอสฟอรัส หรืออากาศหนาวจัด → เสริมปุ๋ยฟอสฟอรัส (ตัวกลางสูง)' },
  { key: 'brown', label: 'น้ำตาล/แห้งกรอบ', color: '#8b5a2b', note: 'ขาดน้ำรุนแรง แดดเผา ปุ๋ยหรือสารเคมีเข้มข้นเกิน หรือรากเสียหาย → ตรวจความชื้นดินและรากก่อน' },
];

const SYMPTOMS = [
  { key: 'holes', label: 'ใบมีรอยกัด/ขาดแหว่ง', cause: 'หนอนกินใบ ด้วง ตั๊กแตน หรือลมแรง/พายุ', action: 'พลิกดูใต้ใบหาหนอนหรือมูลแมลง ถ้าพบหนอนให้จับทำลายหรือใช้เชื้อ Bt · ถ้าขาดเป็นแนวหลังพายุ มักเป็นจากลม ไม่ต้องใช้ยา' },
  { key: 'spots', label: 'จุด/แผลสีน้ำตาลหรือดำ', cause: 'เชื้อราโรคใบจุด/แอนแทรคโนส พบมากช่วงฝนชุก ความชื้นสูง', action: 'เก็บใบที่เป็นโรคไปทำลาย ตัดแต่งทรงพุ่มให้โปร่ง พ่นสารป้องกันเชื้อรา (เช่น กลุ่มคอปเปอร์) หรือไตรโคเดอร์มา ในวันที่ไม่มีฝน' },
  { key: 'mildew', label: 'ผงสีขาวบนใบ/ช่อดอก', cause: 'ราแป้ง มักเกิดช่วงกลางคืนชื้น กลางวันแห้ง', action: 'พ่นกำมะถันชนิดละลายน้ำ (เลี่ยงช่วงแดดร้อนจัด) หรือเชื้อบาซิลลัส ซับทิลิส' },
  { key: 'sooty', label: 'คราบดำคล้ายเขม่า', cause: 'ราดำ ขึ้นบนน้ำหวานที่เพลี้ยแป้ง เพลี้ยหอย แมลงหวี่ขาวขับถ่ายไว้', action: 'กำจัดแมลงต้นเหตุก่อน (สังเกตมดขึ้นลงต้น) ฉีดน้ำหรือน้ำผสมสบู่อ่อนล้างคราบ' },
  { key: 'curl', label: 'ใบอ่อน/ยอดหงิกงอ', cause: 'เพลี้ยไฟ เพลี้ยอ่อน หรือไรขาว มักระบาดช่วงอากาศแห้ง', action: 'ส่องใต้ใบอ่อนด้วยแว่นขยาย ฉีดพ่นน้ำเพิ่มความชื้น ใช้กับดักกาวเหนียวสีฟ้า/เหลือง หรือสารชีวภัณฑ์บิวเวอร์เรีย' },
  { key: 'mine', label: 'รอยทางคดเคี้ยวสีเงินในใบ', cause: 'หนอนชอนใบ (พบบ่อยในส้ม มะนาว)', action: 'ตัดใบที่เสียหายมาก ไม่ใส่ไนโตรเจนมากเกินช่วงแตกใบอ่อน พ่นปิโตรเลียมออยล์ช่วงใบอ่อน' },
  { key: 'stipple', label: 'จุดประเล็กๆ สีซีด ใต้ใบมีใย', cause: 'ไรแดง/ไรศัตรูพืช ระบาดช่วงแล้ง', action: 'ฉีดน้ำแรงๆ ใต้ใบ ใช้กำมะถันหรือสารกำจัดไรตามคำแนะนำ' },
  { key: 'edgeburn', label: 'ขอบใบ/ปลายใบไหม้', cause: 'ขาดโพแทสเซียม ดินเค็ม ใส่ปุ๋ยมากหรือชิดโคนเกินไป หรือขาดน้ำ', action: 'ตรวจปริมาณปุ๋ยที่ใส่ รดน้ำสม่ำเสมอ เสริมโพแทสเซียมตามระยะ (เช่น 13-13-21)' },
  { key: 'rust', label: 'จุดนูนสีส้ม/สนิมบนใบ', cause: 'โรคสนิมสาหร่าย พบในทรงพุ่มทึบและชื้น', action: 'ตัดแต่งกิ่งให้โปร่ง พ่นสารกลุ่มคอปเปอร์' },
  { key: 'wilt', label: 'ใบเหี่ยว ทั้งที่ดินไม่แห้ง', cause: 'รากเน่าโคนเน่า (เชื้อไฟทอปธอรา สำคัญมากในทุเรียน) หรือน้ำขัง รากขาดอากาศ', action: 'ตรวจโคนต้นและราก เร่งระบายน้ำ ใส่ไตรโคเดอร์มา และปรึกษาเจ้าหน้าที่เกษตรเรื่องสารป้องกันกำจัด' },
  { key: 'drop', label: 'ใบร่วงมากผิดปกติ', cause: 'สภาพน้ำ/อากาศเปลี่ยนกะทันหัน รากมีปัญหา หรือโรคใบ', action: 'ดูอาการอื่นที่เกิดร่วมกัน ตรวจรากและความชื้นดิน' },
  { key: 'dieback', label: 'กิ่งแห้งตายจากปลาย', cause: 'โรคกิ่งแห้งจากเชื้อรา หรือแมลงเจาะกิ่ง', action: 'ตัดกิ่งต่ำกว่าส่วนที่แห้ง 10–15 ซม. ทาแผลด้วยปูนแดงหรือสารป้องกันเชื้อรา แล้วนำกิ่งไปทำลาย' },
  { key: 'canker', label: 'โคน/ลำต้นมีแผล ยางหรือน้ำไหล', cause: 'โรครากเน่าโคนเน่า หรือหนอนเจาะลำต้น (ถ้ามีรูและขุยไม้)', action: 'ขูดแผลแล้วทาสารป้องกันเชื้อราตามคำแนะนำ ถ้าพบรูมีขุยให้หาตัวหนอนทำลาย' },
  { key: 'insects', label: 'พบแมลง/มดขึ้นต้นมาก', cause: 'มดมักพาเพลี้ยมาเลี้ยงเพื่อกินน้ำหวาน', action: 'ดูว่าเป็นแมลงชนิดใด ถ่ายรูปเก็บไว้ ตัดทางมดขึ้นต้น' },
];
const STAGES = ['แตกใบอ่อน', 'ออกดอก', 'ติดผลอ่อน', 'ผลใกล้เก็บ', 'หลังเก็บเกี่ยว/พักต้น'];
const SOILS = [{ key: 'dry', label: 'แห้ง' }, { key: 'moist', label: 'ชื้นพอดี' }, { key: 'wet', label: 'แฉะ/น้ำขัง' }];

const JN = { plot: '', editId: null, photo: null, showAll: false };

// ---------- อายุต้น ----------
function ageParts(plantDate) {
  if (!plantDate) return null;
  const d = parseYmd(plantDate), now = new Date();
  const totalDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - d) / 86400000);
  if (totalDays < 0) return { totalDays, years: 0, months: 0, days: 0, future: true };
  let months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  let days = now.getDate() - d.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  return { totalDays, years: Math.floor(months / 12), months: months % 12, days };
}
function stageOf(years) {
  if (years < 1) return 'ต้นกล้า/ตั้งตัว';
  if (years < 3) return 'เจริญเติบโตทางกิ่งใบ';
  if (years < 5) return 'เริ่มให้ผลผลิต';
  return 'ให้ผลผลิตเต็มที่';
}

// ---------- ภาพวาดต้นไม้ (SVG) ----------
function treeShape(crop = '') {
  if (/มะพร้าว|ปาล์ม|หมาก/.test(crop)) return 'palm';
  if (/กล้วย/.test(crop)) return 'banana';
  if (/ทุเรียน|มังคุด|ลองกอง|ลางสาด|ยาง|สะตอ/.test(crop)) return 'cone';
  if (/มะนาว|ส้ม|พริก|มะกรูด|ฝรั่ง|ชมพู่|กาแฟ|มะละกอ/.test(crop)) return 'bush';
  return 'round';
}
function fruitStyle(crop = '') {
  if (/ทุเรียน/.test(crop)) return { color: '#7d8b2e', r: 7, spiky: true };
  if (/มะม่วง/.test(crop)) return { color: '#e0b42c', r: 6, oval: true };
  if (/มะนาว|มะกรูด/.test(crop)) return { color: '#8cc43c', r: 4 };
  if (/ส้ม/.test(crop)) return { color: '#f08c2a', r: 5 };
  if (/มังคุด/.test(crop)) return { color: '#5b2348', r: 5 };
  if (/ลำไย|ลองกอง|ลางสาด/.test(crop)) return { color: '#c7a36a', r: 3.5 };
  if (/เงาะ|ลิ้นจี่/.test(crop)) return { color: '#d6413a', r: 4.5 };
  if (/มะพร้าว/.test(crop)) return { color: '#6b8e23', r: 7 };
  if (/กล้วย/.test(crop)) return { color: '#c9c23a', r: 4 };
  return { color: '#e3622f', r: 5 };
}
function seeded(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function strHash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 100000; return h; }

function treeSvg(plot, latest) {
  const age = ageParts(plot?.plantDate);
  const years = age && !age.future ? age.years + age.months / 12 : 3;
  const g = Math.max(0.3, Math.min(1, 0.3 + years / 7));
  const leaf = LEAF_COLORS.find(l => l.key === latest?.leafColor) || LEAF_COLORS[1];
  const sym = new Set(latest?.symptoms || []);
  const stages = new Set(latest?.stages || []);
  const shape = treeShape(plot?.crop);
  const rnd = seeded(strHash(plot?.id || 'x'));
  const groundY = 222, cx = 130;
  let rainy = false;
  if (typeof WX !== 'undefined' && WX?.data?.daily) rainy = (WX.data.daily.precipitation_probability_max[0] ?? 0) >= 60;

  let s = `<svg viewBox="0 0 260 250" class="tree-svg" role="img" aria-label="ภาพวาดต้นไม้ของแปลง ${esc(plot?.name || '')}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-1)"/><stop offset="1" stop-color="var(--sky-2)"/></linearGradient></defs>
    <rect x="0" y="0" width="260" height="250" rx="16" fill="url(#sky)"/>`;
  // ฟ้า: ฝนหรือแดด
  if (rainy) {
    s += `<g fill="#9aa7b3"><ellipse cx="200" cy="38" rx="34" ry="14"/><ellipse cx="180" cy="44" rx="22" ry="12"/><ellipse cx="222" cy="46" rx="20" ry="10"/></g>
      <g stroke="#6f9fd8" stroke-width="2" stroke-linecap="round">${[0, 1, 2, 3, 4].map(i => `<line x1="${178 + i * 11}" y1="${60 + (i % 2) * 6}" x2="${174 + i * 11}" y2="${72 + (i % 2) * 6}"/>`).join('')}</g>`;
  } else {
    s += `<circle cx="214" cy="40" r="16" fill="#f6c343"/><g stroke="#f6c343" stroke-width="2.5" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = Math.PI * a / 180; return `<line x1="${214 + Math.cos(r) * 22}" y1="${40 + Math.sin(r) * 22}" x2="${214 + Math.cos(r) * 28}" y2="${40 + Math.sin(r) * 28}"/>`; }).join('')}</g>`;
  }
  // พื้นดิน
  const soilColor = latest?.soil === 'wet' ? '#6b5640' : latest?.soil === 'dry' ? '#c8a878' : '#9c7a53';
  s += `<ellipse cx="${cx}" cy="${groundY + 4}" rx="120" ry="18" fill="#7fb26a"/><ellipse cx="${cx}" cy="${groundY + 2}" rx="${30 + 30 * g}" ry="7" fill="${soilColor}"/>`;
  if (latest?.soil === 'wet') s += `<ellipse cx="${cx - 20}" cy="${groundY + 3}" rx="16" ry="3" fill="#7aa9d6" opacity=".8"/>`;

  const trunkColor = '#7a5232';
  const pts = []; // จุดบนพุ่มใบ สำหรับวางผล/อาการ
  const canopy = [];
  const darker = 'rgba(0,0,0,.14)', lighter = 'rgba(255,255,255,.16)';

  if (shape === 'palm') {
    const h = 70 + 100 * g, topY = groundY - h;
    s += `<path d="M${cx - 6} ${groundY} Q${cx + 10} ${groundY - h / 2} ${cx} ${topY}" stroke="${trunkColor}" stroke-width="${8 + 4 * g}" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI + (i / 7) * Math.PI, len = 46 + 26 * g;
      const ex = cx + Math.cos(a) * len, ey = topY + Math.sin(a) * len * 0.45 + 18;
      canopy.push(`<path d="M${cx} ${topY} Q${(cx + ex) / 2} ${topY - 22} ${ex} ${ey}" stroke="${leaf.color}" stroke-width="7" fill="none" stroke-linecap="round"/>`);
      pts.push([(cx + ex) / 2, (topY + ey) / 2 - 6]);
    }
    s += canopy.join('');
    if (years >= 4 || stages.has('ติดผลอ่อน') || stages.has('ผลใกล้เก็บ')) {
      const f = fruitStyle(plot?.crop);
      [[-8, 8], [6, 10], [-1, 16]].forEach(([dx, dy]) => { s += `<circle cx="${cx + dx}" cy="${topY + dy}" r="${f.r}" fill="${f.color}"/>`; });
    }
  } else if (shape === 'banana') {
    const h = 60 + 70 * g, topY = groundY - h;
    s += `<rect x="${cx - 7}" y="${topY}" width="14" height="${h}" rx="6" fill="#8aa24a"/>`;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9, len = 50 + 30 * g;
      const ex = cx + Math.cos(a) * len, ey = topY + Math.sin(a) * len * 0.7 + 10;
      canopy.push(`<path d="M${cx} ${topY + 4} Q${(cx + ex) / 2} ${Math.min(topY, ey) - 18} ${ex} ${ey} Q${(cx + ex) / 2} ${Math.min(topY, ey) - 2} ${cx} ${topY + 10}Z" fill="${leaf.color}" stroke="${darker}"/>`);
      pts.push([(cx * 0.4 + ex * 0.6), (topY + ey) / 2 - 8]);
    }
    s += canopy.join('');
    if (stages.has('ติดผลอ่อน') || stages.has('ผลใกล้เก็บ') || stages.has('ออกดอก')) {
      s += `<path d="M${cx + 4} ${topY + 6} q16 10 12 36" stroke="#6b7a2e" stroke-width="3" fill="none"/>`;
      if (stages.has('ออกดอก')) s += `<ellipse cx="${cx + 16}" cy="${topY + 46}" rx="5" ry="8" fill="#7b2d4a"/>`;
      for (let i = 0; i < 4; i++) s += `<ellipse cx="${cx + 14 + (i % 2) * 6}" cy="${topY + 18 + i * 6}" rx="6" ry="2.6" fill="#c9c23a" transform="rotate(-25 ${cx + 14} ${topY + 18 + i * 6})"/>`;
    }
  } else {
    // ไม้ยืนต้น: ลำต้น + พุ่มใบ
    const h = shape === 'bush' ? 22 + 40 * g : shape === 'cone' ? 26 + 50 * g : 30 + 60 * g;
    const trunkW = shape === 'bush' ? 5 + 4 * g : 6 + 10 * g;
    const baseY = groundY - h;
    s += `<path d="M${cx - trunkW} ${groundY} L${cx - trunkW * 0.55} ${baseY} L${cx + trunkW * 0.55} ${baseY} L${cx + trunkW} ${groundY}Z" fill="${trunkColor}"/>`;
    s += `<path d="M${cx} ${baseY + h * 0.3} l-${16 * g} -${18 * g} M${cx} ${baseY + h * 0.15} l${18 * g} -${16 * g}" stroke="${trunkColor}" stroke-width="${3 + 3 * g}" stroke-linecap="round"/>`;
    let blobs;
    if (shape === 'cone') {
      const W = 38 + 42 * g, H = 60 + 66 * g;
      blobs = [];
      for (let i = 0; i < 6; i++) {
        const t = i / 5, y = baseY + 10 - t * H, w = W * (1 - t * 0.75);
        blobs.push([cx - w * 0.45, y, w * 0.55], [cx + w * 0.45, y, w * 0.55], [cx, y - 6, w * 0.6]);
      }
    } else {
      const R = shape === 'bush' ? 26 + 30 * g : 30 + 38 * g, cy = baseY - R * 0.55;
      blobs = [[cx, cy, R], [cx - R * 0.7, cy + R * 0.25, R * 0.62], [cx + R * 0.7, cy + R * 0.25, R * 0.62], [cx - R * 0.42, cy - R * 0.5, R * 0.6], [cx + R * 0.45, cy - R * 0.45, R * 0.6]];
    }
    blobs.forEach(([x, y, r]) => canopy.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${leaf.color}"/>`));
    s += canopy.join('');
    // แสงเงา
    blobs.forEach(([x, y, r], i) => { if (i % 2 === 0) s += `<circle cx="${(x - r * 0.25).toFixed(1)}" cy="${(y - r * 0.3).toFixed(1)}" r="${(r * 0.45).toFixed(1)}" fill="${lighter}"/>`; });
    blobs.forEach(([x, y, r]) => { s += `<path d="M${(x - r * 0.8).toFixed(1)} ${(y + r * 0.45).toFixed(1)} q${(r * 0.8).toFixed(1)} ${(r * 0.5).toFixed(1)} ${(r * 1.6).toFixed(1)} 0" stroke="${darker}" stroke-width="3" fill="none"/>`; });
    if (leaf.vein) blobs.slice(0, 4).forEach(([x, y, r]) => { s += `<path d="M${x - r * 0.4} ${y} l${r * 0.8} 0 M${x} ${y - r * 0.4} l0 ${r * 0.8}" stroke="#4c9a3f" stroke-width="2"/>`; });
    for (let i = 0; i < 40; i++) {
      const [x, y, r] = blobs[Math.floor(rnd() * blobs.length)];
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.8;
      pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
    }
    // ดอก/ผล
    const fruiting = stages.has('ติดผลอ่อน') || stages.has('ผลใกล้เก็บ') || (!latest?.stages?.length && years >= 4);
    if (stages.has('ออกดอก')) pts.slice(0, 14).forEach(([x, y]) => { s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#fff6d6" stroke="#e9c76b" stroke-width="1"/>`; });
    if (stages.has('แตกใบอ่อน')) pts.slice(14, 24).forEach(([x, y]) => { s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4" ry="2.2" fill="#b5653b" opacity=".85"/>`; });
    if (fruiting) {
      const f = fruitStyle(plot?.crop), small = stages.has('ติดผลอ่อน') && !stages.has('ผลใกล้เก็บ');
      pts.slice(24, shape === 'bush' ? 32 : 34).forEach(([x, y]) => {
        const r = small ? f.r * 0.6 : f.r;
        s += `<line x1="${x.toFixed(1)}" y1="${(y - r - 3).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - r).toFixed(1)}" stroke="#5a3d22" stroke-width="1.2"/>`;
        s += f.oval ? `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 0.75).toFixed(1)}" ry="${r.toFixed(1)}" fill="${f.color}"/>`
          : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${f.color}" ${f.spiky ? 'stroke="#5d6a1e" stroke-width="1.5" stroke-dasharray="1.5 1.5"' : ''}/>`;
      });
    }
  }
  // อาการบนใบ
  const mark = (list, fn) => list.forEach(p => { s += fn(p[0].toFixed(1), p[1].toFixed(1)); });
  const P = i => pts.slice(i, i + 6);
  if (sym.has('spots')) mark(P(0), (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="#6b3f1d"/>`);
  if (sym.has('mildew')) mark(P(6), (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#f4f4f0" opacity=".9"/>`);
  if (sym.has('sooty')) mark(P(12), (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#2b2b2b" opacity=".7"/>`);
  if (sym.has('holes')) mark(P(18), (x, y) => `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--sky-2)"/>`);
  if (sym.has('rust')) mark(P(24), (x, y) => `<circle cx="${x}" cy="${y}" r="2.8" fill="#d9772b"/>`);
  if (sym.has('dieback')) s += `<path d="M${cx + 8} ${pts[0]?.[1] ?? 100} l22 -26 l8 4 M${cx + 22} ${(pts[0]?.[1] ?? 100) - 16} l10 -2" stroke="#8a6a4a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  if (sym.has('insects')) mark(P(30), (x, y) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#222"/>`);
  if (sym.has('drop')) for (let i = 0; i < 6; i++) s += `<ellipse cx="${cx - 50 + i * 20 + rnd() * 8}" cy="${groundY + rnd() * 8}" rx="5" ry="2.4" fill="${leaf.key === 'brown' ? '#8b5a2b' : '#c9b13a'}"/>`;
  s += `</svg>`;
  return s;
}

// ---------- วินิจฉัยเบื้องต้น ----------
function diagnose(entry) {
  const out = [];
  const lc = LEAF_COLORS.find(l => l.key === entry.leafColor);
  if (lc && !lc.ok) out.push({ title: `สีใบ: ${lc.label}`, cause: lc.note, action: '' });
  (entry.symptoms || []).forEach(k => {
    const s = SYMPTOMS.find(x => x.key === k);
    if (s) out.push({ title: s.label, cause: s.cause, action: s.action });
  });
  const sym = new Set(entry.symptoms || []);
  if (sym.has('wilt') && entry.soil === 'dry') out.push({ title: 'เหี่ยว + ดินแห้ง', cause: 'น่าจะขาดน้ำมากกว่าโรครากเน่า', action: 'รดน้ำให้ชุ่ม คลุมโคนด้วยฟางหรือใบไม้แห้งรักษาความชื้น' });
  if (entry.soil === 'wet' && !sym.has('wilt')) out.push({ title: 'ดินแฉะ/น้ำขัง', cause: 'น้ำขังนานเสี่ยงต่อรากเน่า โดยเฉพาะทุเรียน', action: 'ทำร่องระบายน้ำ งดให้น้ำจนดินหมาด' });
  return out;
}
function diagHtml(entry) {
  const d = diagnose(entry);
  if (!d.length) return `<div class="advice good"><b>ไม่พบอาการผิดปกติที่ต้องกังวล</b><div class="small">บันทึกไว้เพื่อเทียบกับครั้งต่อไป</div></div>`;
  return d.map(x => `<div class="advice warn"><b>${esc(x.title)}</b><div class="small">สาเหตุที่เป็นไปได้: ${esc(x.cause)}</div>${x.action ? `<div class="small">แนวทาง: ${esc(x.action)}</div>` : ''}</div>`).join('') +
    `<p class="small muted" style="margin:.4rem 0 0">เป็นการวินิจฉัยเบื้องต้นจากอาการที่เลือก ควรตรวจซ้ำ และหากอาการลุกลามให้ปรึกษาเจ้าหน้าที่เกษตรในพื้นที่</p>`;
}

// ---------- หน้า ----------
PAGES.journal = () => {
  if (!Array.isArray(DB.journal)) DB.journal = [];
  if (!DB.plots.length) return `<div class="page-head"><h1>บันทึกสวน</h1></div><div class="card empty">ยังไม่มีแปลง — <a href="#plots">เพิ่มแปลงปลูก</a> พร้อมวันที่ปลูกก่อน แล้วกลับมาบันทึกได้เลย</div>`;
  if (!plotById(JN.plot)) JN.plot = DB.plots[0].id;
  const p = plotById(JN.plot);
  const logs = DB.journal.filter(j => j.plotId === p.id).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const latest = logs[0];
  const editing = JN.editId ? DB.journal.find(j => j.id === JN.editId) : null;
  const age = ageParts(p.plantDate);
  const today = todayStr();
  const sinceLast = latest ? Math.round((parseYmd(today) - parseYmd(latest.date)) / 86400000) : null;
  const hl = latest ? HEALTH.find(h => h.key === latest.health) : null;
  const lc = latest ? LEAF_COLORS.find(l => l.key === latest.leafColor) : null;

  const ageHtml = age ? (age.future ? `<div class="age-big">ยังไม่ถึงวันปลูก</div>` :
    `<div class="age-big">${age.years ? `${age.years} <small>ปี</small> ` : ''}${age.months} <small>เดือน</small> ${age.days} <small>วัน</small></div>
     <div class="muted small">ปลูกเมื่อ ${fmtDate(p.plantDate)} · รวม ${fmtNum(age.totalDays)} วัน · ระยะ: <b>${stageOf(age.years)}</b></div>`)
    : `<div class="muted">ยังไม่ได้ระบุวันที่ปลูก — <a href="#plots" onclick="setTimeout(()=>editPlot('${p.id}'),50)">ใส่วันที่ปลูก</a> เพื่อคำนวณอายุต้น</div>`;

  // แถบสุขภาพ 30 วัน
  const strip = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const day = logs.filter(l => l.date === d);
    const worst = day.sort((a, b) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health])[0];
    const h = worst && HEALTH.find(x => x.key === worst.health);
    strip.push(`<span class="hs ${h ? 'hs-' + h.key : ''}" data-tip="${esc(`<b>${fmtDate(d)}</b><br>${h ? h.icon + ' ' + h.label : 'ไม่ได้บันทึก'}`)}"></span>`);
  }

  const f = editing || { date: today, health: 'ok', leafColor: 'green', symptoms: [], stages: [], soil: 'moist' };
  const chip = (type, name, value, label, checked, extra = '') =>
    `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}><span>${extra}${esc(label)}</span></label>`;

  return `<div class="page-head"><h1>บันทึกสวน</h1>
      <select style="width:auto" onchange="JN.plot=this.value;JN.editId=null;JN.photo=null;render()">${DB.plots.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="card jn-hero" style="--plot-color:${p.color}">
      <div class="jn-art">${treeSvg(p, latest)}</div>
      <div class="jn-info">
        <div class="muted small">${esc(p.name)}</div>
        <h2 style="margin:.1rem 0 .4rem;display:block">${esc(p.crop || 'ไม่ระบุพืช')}${p.variety ? ` <span class="muted" style="font-weight:400">${esc(p.variety)}</span>` : ''}</h2>
        <div class="muted small">อายุต้นไม้ในแปลงนี้</div>
        ${ageHtml}
        <div class="jn-facts">
          <div><span class="muted small">จำนวนต้น</span><b>${fmtNum(p.trees)} ต้น</b></div>
          <div><span class="muted small">พื้นที่</span><b>${fmtArea(areaWa(p))}</b></div>
          <div><span class="muted small">ตรวจล่าสุด</span><b>${latest ? (sinceLast === 0 ? 'วันนี้' : `${sinceLast} วันก่อน`) : 'ยังไม่เคย'}</b></div>
          <div><span class="muted small">สุขภาพล่าสุด</span><b>${hl ? `<span class="pill ${hl.cls}">${hl.icon} ${hl.label}</span>` : '-'}</b></div>
          <div><span class="muted small">สีใบล่าสุด</span><b>${lc ? `<span class="swatch" style="background:${lc.color}"></span>${esc(lc.label)}` : '-'}</b></div>
        </div>
        <div style="margin-top:.6rem"><div class="muted small">สุขภาพ 30 วันล่าสุด</div><div class="hstrip">${strip.join('')}</div>
          <div class="legend small" style="margin-top:.3rem">${HEALTH.map(h => `<span><span class="swatch hs-${h.key}"></span>${h.label}</span>`).join('')}<span><span class="swatch hs-none"></span>ไม่ได้บันทึก</span></div></div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:12px;align-items:start">
      <form class="card" id="jnForm" onsubmit="event.preventDefault();saveJournal(this)" oninput="jnPreview(this)">
        <h2>${editing ? '✏️ แก้ไขบันทึก' : '📝 วันนี้ไปดูสวนมาเป็นอย่างไร'}${editing ? '<button type="button" class="btn small" onclick="JN.editId=null;JN.photo=null;render()">ยกเลิก</button>' : ''}</h2>
        <label class="field"><span>วันที่</span><input type="date" name="date" value="${esc(f.date)}" required style="max-width:200px"></label>
        <div class="field"><span class="flabel">ภาพรวมสุขภาพต้น</span><div class="chips">${HEALTH.map(h => chip('radio', 'health', h.key, h.label, f.health === h.key, h.icon + ' ')).join('')}</div></div>
        <div class="field"><span class="flabel">สีใบส่วนใหญ่</span><div class="chips">${LEAF_COLORS.map(l => chip('radio', 'leafColor', l.key, l.label, f.leafColor === l.key, `<span class="swatch" style="background:${l.color}"></span>`)).join('')}</div></div>
        <div class="field"><span class="flabel">อาการที่พบ (เลือกได้หลายข้อ)</span><div class="chips">${SYMPTOMS.map(s => chip('checkbox', 'symptoms', s.key, s.label, f.symptoms?.includes(s.key))).join('')}</div></div>
        <div class="field"><span class="flabel">ระยะของต้นตอนนี้</span><div class="chips">${STAGES.map(s => chip('checkbox', 'stages', s, s, f.stages?.includes(s))).join('')}</div></div>
        <div class="field"><span class="flabel">ความชื้นดิน</span><div class="chips">${SOILS.map(s => chip('radio', 'soil', s.key, s.label, f.soil === s.key)).join('')}</div></div>
        <label class="field"><span>จำนวนต้นที่พบอาการ (ถ้ามี)</span><input type="number" name="affected" min="0" value="${esc(f.affected ?? '')}" style="max-width:160px"></label>
        <label class="field"><span>บันทึกเพิ่มเติม</span><textarea name="note" placeholder="เช่น ต้นที่ 12 แถวริมรั้ว ใบล่างเริ่มเหลือง เจอมดเยอะ">${esc(f.note)}</textarea></label>
        <div class="field"><span class="flabel">รูปถ่าย (ไม่บังคับ)</span>
          <input type="file" accept="image/*" capture="environment" onchange="jnPhoto(this.files[0])">
          <div id="jnPhotoPrev">${(JN.photo ?? f.photo) ? `<img src="${JN.photo ?? f.photo}" class="jn-photo" alt="รูปที่แนบ"><button type="button" class="btn small" onclick="JN.photo='';document.getElementById('jnPhotoPrev').innerHTML=''">ลบรูป</button>` : ''}</div></div>
        ${editing ? '' : `<label class="field inline-check"><input type="checkbox" name="followup" checked> <span style="margin:0">ถ้าพบอาการ สร้างงาน “ตรวจโรค/แมลง” ติดตามผลใน 3 วัน</span></label>`}
        <button class="btn primary" style="width:100%">${editing ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
      </form>
      <div class="grid">
        <div class="card"><h2>🔎 วินิจฉัยเบื้องต้น</h2><div id="jnDiag">${diagHtml(f)}</div></div>
        <div class="card"><h2>📖 บันทึกที่ผ่านมา (${logs.length})</h2>
          ${logs.length ? `<ul class="list">${(JN.showAll ? logs : logs.slice(0, 10)).map(journalLi).join('')}</ul>
          ${logs.length > 10 && !JN.showAll ? `<button class="btn small" onclick="JN.showAll=true;render()">ดูทั้งหมด</button>` : ''}` : '<div class="empty">ยังไม่มีบันทึกของแปลงนี้</div>'}</div>
      </div>
    </div>`;
};

function journalLi(j) {
  const h = HEALTH.find(x => x.key === j.health), l = LEAF_COLORS.find(x => x.key === j.leafColor);
  const syms = (j.symptoms || []).map(k => SYMPTOMS.find(s => s.key === k)?.label).filter(Boolean);
  return `<li><div class="grow">
      <div><b>${fmtDate(j.date)}</b> ${h ? `<span class="pill ${h.cls}">${h.icon} ${h.label}</span>` : ''} ${l ? `<span class="small"><span class="swatch" style="background:${l.color}"></span>${esc(l.label)}</span>` : ''}</div>
      ${syms.length ? `<div class="chips small" style="margin-top:.25rem">${syms.map(s => `<span class="pill warn">${esc(s)}</span>`).join('')}</div>` : ''}
      ${j.stages?.length ? `<div class="small muted">ระยะ: ${j.stages.map(esc).join(', ')}</div>` : ''}
      ${j.affected ? `<div class="small muted">พบอาการ ${fmtNum(j.affected)} ต้น</div>` : ''}
      ${j.weather ? `<div class="small muted">อากาศวันนั้น: โอกาสฝน ${j.weather.prob}% · ฝน ${fmtNum(j.weather.rain, 1)} มม.</div>` : ''}
      ${j.note ? `<div class="small" style="white-space:pre-wrap">${esc(j.note)}</div>` : ''}
      ${j.photo ? `<img src="${j.photo}" class="jn-photo" alt="รูปวันที่ ${fmtDate(j.date)}" onclick="window.open().document.write('<img src=&quot;'+this.src+'&quot; style=&quot;max-width:100%&quot;>')">` : ''}
    </div>
    <button class="icon-btn" title="แก้ไข" onclick="JN.editId='${j.id}';JN.photo=null;render();scrollTo(0,document.getElementById('jnForm').offsetTop-80)">✏️</button>
    <button class="icon-btn" title="ลบ" onclick="confirmDelete('บันทึก',()=>{DB.journal=DB.journal.filter(x=>x.id!=='${j.id}')})">🗑️</button></li>`;
}

function readJournalForm(form) {
  const fd = new FormData(form);
  return {
    date: fd.get('date'), health: fd.get('health'), leafColor: fd.get('leafColor'), soil: fd.get('soil'),
    symptoms: fd.getAll('symptoms'), stages: fd.getAll('stages'),
    affected: fd.get('affected') === '' ? '' : +fd.get('affected'), note: (fd.get('note') || '').trim(),
    followup: fd.get('followup') === 'on',
  };
}
window.jnPreview = form => {
  const e = readJournalForm(form);
  document.getElementById('jnDiag').innerHTML = diagHtml(e);
  // อัปเดตภาพต้นไม้ตามที่กำลังกรอก
  const p = plotById(JN.plot);
  document.querySelector('.jn-art').innerHTML = treeSvg(p, e);
};
window.jnPhoto = file => {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const max = 640, k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    JN.photo = c.toDataURL('image/jpeg', 0.6);
    URL.revokeObjectURL(img.src);
    document.getElementById('jnPhotoPrev').innerHTML = `<img src="${JN.photo}" class="jn-photo" alt="รูปที่แนบ"><button type="button" class="btn small" onclick="JN.photo='';document.getElementById('jnPhotoPrev').innerHTML=''">ลบรูป</button>`;
  };
  img.onerror = () => toast('เปิดรูปนี้ไม่ได้');
  img.src = URL.createObjectURL(file);
};
window.saveJournal = form => {
  if (!Array.isArray(DB.journal)) DB.journal = [];
  const e = readJournalForm(form);
  const { followup, ...rec } = e;
  rec.plotId = JN.plot;
  if (WX?.data?.daily) {
    const i = WX.data.daily.time.indexOf(rec.date);
    if (i >= 0) rec.weather = { prob: WX.data.daily.precipitation_probability_max[i] ?? 0, rain: WX.data.daily.precipitation_sum[i] ?? 0 };
  }
  let target;
  if (JN.editId) {
    target = DB.journal.find(j => j.id === JN.editId);
    const keepPhoto = JN.photo === null ? target.photo : JN.photo;
    Object.assign(target, rec, { photo: keepPhoto || '' });
    if (!rec.weather) target.weather = target.weather || null;
  } else {
    target = { id: uid(), createdAt: Date.now(), ...rec, photo: JN.photo || '' };
    DB.journal.push(target);
    if (followup && (rec.symptoms.length || !LEAF_COLORS.find(l => l.key === rec.leafColor)?.ok)) {
      const syms = rec.symptoms.map(k => SYMPTOMS.find(s => s.key === k)?.label).filter(Boolean);
      DB.activities.push({ id: uid(), date: addDays(rec.date, 3), plotId: rec.plotId, type: 'ตรวจโรค/แมลง', detail: 'ติดตามอาการ: ' + (syms.join(', ') || 'สีใบผิดปกติ'), done: false });
    }
  }
  let msg = 'บันทึกแล้ว';
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  catch {
    if (target.photo) { target.photo = ''; save(); msg = 'พื้นที่เก็บข้อมูลเต็ม — บันทึกแล้วแต่ไม่ได้เก็บรูป'; }
    else msg = 'บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลเต็ม';
  }
  JN.editId = null; JN.photo = null;
  render(); toast(msg);
};

// ถ้าเปิดลิงก์มาที่หน้านี้โดยตรง ให้แสดงผลอีกครั้งหลังโหลดไฟล์นี้เสร็จ
if (location.hash === '#journal') render();
