// Formula audit — independent awkward-number battery with hand-computed
// expectations (NOT the numbers the other suites pin). Run with the static
// server on :8000:  node tests/formula-audit.mjs
// Every expected value below was computed by hand (shown in comments).
import { JSDOM } from 'jsdom';

const BASE = 'http://localhost:8000/';
const passes = [];
const fails = [];
const ok = (cond, name, extra = '') => (cond ? passes : fails).push(`${name}${extra ? ' — ' + extra : ''}`);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const dom = await JSDOM.fromURL(BASE, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.localStorage.setItem('language', 'en');
      window.localStorage.setItem('introSeen', '1');
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.navigator.vibrate = () => {};
    },
  });
  await tick(1200);
  return dom;
}

function set(d, id, v) {
  const e = d.getElementById(id);
  if (!e) { ok(false, `field #${id} exists`); return; }
  e.value = String(v);
  e.dispatchEvent(new (d.defaultView.Event)('input', { bubbles: true }));
  e.dispatchEvent(new (d.defaultView.Event)('change', { bubbles: true }));
}
function pick(d, name, value) {
  const el = d.querySelector(`input[name="${name}"][value="${value}"]`);
  if (!el) { ok(false, `radio ${name}=${value} exists`); return; }
  el.click();
}
function selectVal(d, id, v) {
  const e = d.getElementById(id);
  if (!e) { ok(false, `select #${id} exists`); return; }
  e.value = v;
  e.dispatchEvent(new (d.defaultView.Event)('change', { bubbles: true }));
}
const text = (d, id) => (d.getElementById(id)?.textContent || '').replace(/\s+/g, ' ');

async function run() {
  const dom = await boot();
  const d = dom.window.document;

  // ============ CASE 1 — concrete dims, awkward numbers ==================
  // 7.3 x 2.2 x 0.17 = 2.7302 m3 wet; dry 1.54 -> 4.204508
  // ratio 1:2:4 (sum 7): cement 0.600644 m3 -> 864.93 kg; x1.05 -> 19 bags
  // sand order 1.2614 m3; aggregate order 2.5227 m3
  pick(d, 'concrete-mode', 'dims');
  set(d, 'concrete-length', 7.3); set(d, 'concrete-width', 2.2); set(d, 'concrete-thickness', 0.17);
  set(d, 'concrete-quantity', 1);
  selectVal(d, 'concrete-mix-basis', 'custom');
  set(d, 'concrete-approved-ratio', '1:2:4');
  set(d, 'concrete-dry-factor', 1.54);
  set(d, 'concrete-cement-density', 1440);
  set(d, 'wastage', 5);
  d.getElementById('calculate-concrete').click();
  await tick(300);
  let t = text(d, 'concrete-result');
  ok(t.includes('2.73'), 'C1 wet volume 2.73 m³', t.slice(0, 120));
  ok(/\b19\b/.test(t), 'C1 cement 19 bags', t.slice(0, 200));
  ok(t.includes('1.26'), 'C1 sand order 1.26 m³');
  ok(t.includes('2.52'), 'C1 aggregate order 2.52 m³');

  // ============ CASE 2 — volume mode ignores the element count ===========
  // 9.25 m3 stays 9.25 (qty 7 must NOT multiply)
  pick(d, 'concrete-mode', 'volume');
  set(d, 'concrete-total-volume', 9.25);
  set(d, 'concrete-quantity', 7);
  d.getElementById('calculate-concrete').click();
  await tick(300);
  t = text(d, 'concrete-result');
  ok(t.includes('9.25') && !t.includes('64.75'), 'C2 volume mode ignores quantity', t.slice(0, 120));

  // ============ CASE 3 — blocks, custom size + openings ==================
  // wall 7.3x2.2x0.3, custom 390x190x190 mm, joint 1.2 cm, waste 8%, 1:4
  // openings 2 windows 1.4x1.2 + 1 door 0.9x2.1 -> net 3.243 m3, face 10.81 m²
  // face module (0.402x0.202)=0.081204 -> 133.1215 blocks -> ceil(x1.08)=144
  // wall gap = 30 - 1x(19+1.2) = 9.8 cm is NOT mortar (v79) -> mortar 0.3094
  // dry 1.33 -> cement 118.51 kg x1.08 -> 3 bags; sand 0.36
  pick(d, 'block-mode', 'dims');
  set(d, 'block-wall-length', 7.3); set(d, 'block-wall-height', 2.2); set(d, 'block-wall-width-input', 0.3);
  set(d, 'block-num-windows', 2); set(d, 'block-window-width', 1.4); set(d, 'block-window-height', 1.2);
  set(d, 'block-num-doors', 1); set(d, 'block-door-width', 0.9); set(d, 'block-door-height', 2.1);
  selectVal(d, 'block-type', 'custom');
  set(d, 'block-custom-length', 390); set(d, 'block-custom-width', 190); set(d, 'block-custom-height', 190);
  selectVal(d, 'block-joint-type', 'mortar');
  set(d, 'block-mortar-thickness', 1.2);
  set(d, 'block-mortar-dry-factor', 1.33);
  set(d, 'block-mortar-ratio', '1:4');
  set(d, 'block-cement-density', 1440);
  set(d, 'wastage', 8);
  d.getElementById('calculate-blocks').click();
  await tick(300);
  t = text(d, 'blocks-result');
  ok(/Blocks Required\s*144/.test(t), 'B3 blocks 144', t.slice(0, 160));
  ok(/3\s*bags/.test(t), 'B3 mortar cement 3 bags (gap excluded)');
  ok(/0\.36/.test(t), 'B3 mortar sand 0.36 m³ (gap excluded)');
  ok(/not covered/.test(t), 'B3 shows the wall-gap note (9.8 cm)');

  // ============ CASE 4 — glue mode on the same wall ======================
  // glue auto-sets a 3 mm thin-bed joint; leaves capped by fit:
  // min(round(0.3/0.193)=2, floor(0.3/0.19)=1) = 1 leaf (2x19 cm cannot fit in 30 cm)
  // glue 4 kg/m² x 10.81 m² x 1 leaf x 1.08 = 46.699 kg -> ceil(/25) = 2 bags
  selectVal(d, 'block-joint-type', 'glue');
  set(d, 'block-glue-rate', 4);
  set(d, 'block-glue-bag', 25);
  d.getElementById('calculate-blocks').click();
  await tick(300);
  t = text(d, 'blocks-result');
  ok(/46\.7/.test(t) && /2\s*bags/.test(t), 'B4 glue 46.70 kg -> 2 bags (leaves fit-capped)', t.slice(0, 220));

  // ============ CASE 5 — bricks custom + openings-free ===================
  // wall 6.4x2.6x0.115, custom 240x115x75 mm, joint 1 cm, waste 5%, 1:4
  // face module (0.25x0.085)=0.02125 -> 783.0588 -> ceil(x1.05)=823 bricks
  // mortar 0.2927 -> dry -> cement 112.10 kg x1.05 -> 3 bags; sand 0.33
  set(d, 'wastage', 5);
  pick(d, 'brick-mode', 'dims');
  set(d, 'brick-wall-length', 6.4); set(d, 'brick-wall-height', 2.6); set(d, 'brick-wall-width-input', 0.115);
  selectVal(d, 'brick-type', 'custom');
  set(d, 'brick-custom-length', 240); set(d, 'brick-custom-width', 115); set(d, 'brick-custom-height', 75);
  set(d, 'brick-mortar-thickness', 1.0);
  set(d, 'brick-mortar-dry-factor', 1.33);
  set(d, 'brick-mortar-ratio', '1:4');
  set(d, 'brick-cement-density', 1440);
  d.getElementById('calculate-bricks').click();
  await tick(300);
  t = text(d, 'bricks-result');
  ok(t.includes('823'), 'K5 bricks 823', t.slice(0, 160));
  ok(/3\s*bags/.test(t), 'K5 mortar cement 3 bags');
  ok(/0\.33/.test(t), 'K5 mortar sand 0.33 m³ (2 decimals)');

  // ============ CASE 6 — steel two-way slab, 2 members ==================
  // cover 40 mm -> run 6.12 m x 4.32 m (default slab-cover)
  // bars along width = ceil(6200/180)+1 = 36 x 4.32 m of Ø10 (0.617284 kg/m)
  // bars along length = ceil(4400/150)+1 = 31 x 6.12 m of Ø12 (0.888889 kg/m)
  // per member 264.6378 kg; x2 members x1.05 waste = 555.74 kg
  selectVal(d, 'steel-element-selector', 'slab');
  await tick(120);
  pick(d, 'slab-mode', 'spacing');
  set(d, 'slab-length', 6.2); set(d, 'slab-width', 4.4);
  set(d, 'slab-spacing-len', 150); set(d, 'slab-spacing-wid', 180);
  selectVal(d, 'slab-diameter-len', '12');
  selectVal(d, 'slab-diameter-wid', '10');
  set(d, 'steel-member-quantity', 2);
  d.getElementById('calculate-steel').click();
  await tick(300);
  t = text(d, 'steel-result');
  ok(t.includes('555.74'), 'S6 two-way 555.74 kg (cover deducted)', t.slice(0, 220));

  // ============ CASE 7 — laps (15 m bars, 12 m shop bars, 50d Ø12) ======
  // cover 40 mm -> run 14.92 m x 1.92 m
  // splices/bar = ceil((14.92-0.6)/(12-0.6))-1 = 1 -> per bar 15.52 m
  // bars along length = ceil(2000/250)+1 = 9 -> 139.68 m; width bars 61 x 1.92 = 117.12 m
  // total Ø12 -> 130.37 kg; Ø10 -> 75.91 kg; sum 206.28 kg
  set(d, 'slab-length', 15); set(d, 'slab-width', 2);
  set(d, 'slab-spacing-len', 250); set(d, 'slab-spacing-wid', 250);
  set(d, 'steel-member-quantity', 1);
  const lapDetails = d.getElementById('steel-lap-details');
  if (lapDetails) lapDetails.open = true;
  set(d, 'steel-standard-bar-length', 12);
  set(d, 'steel-lap-splice-factor', 50);
  d.getElementById('calculate-steel').click();
  await tick(300);
  t = text(d, 'steel-result');
  ok(t.includes('206.28'), 'S7 lap 50d -> 206.28 kg (cover deducted)', t.slice(0, 220));

  // ============ CASE 8 — BRC rolls ======================================
  // area 7.3x4.5 = 32.85 m², roll 2.2x25 = 55 m², overlap 12%
  // ceil(32.85 x 1.12 / 55) = ceil(0.6723) = 1 roll
  selectVal(d, 'steel-element-selector', 'brc');
  await tick(120);
  selectVal(d, 'brc-mode', 'roll');
  set(d, 'brc-area-len', 7.3); set(d, 'brc-area-wid', 4.5);
  set(d, 'brc-width', 2.2); set(d, 'brc-length', 25);
  set(d, 'brc-overlap', 12);
  d.getElementById('calculate-steel').click();
  await tick(300);
  t = text(d, 'steel-result');
  ok(/1 Roll\b/.test(t), 'BRC 1 Roll (singular)', t.slice(0, 220));

  // ============ CASE 9 — earthwork excavation ===========================
  // 4.5x3.2x2.1 x2 = 60.48 bank; +25% loose = 75.60; ceil(/7) = 11 loads
  pick(d, 'earthwork-mode', 'excavation');
  set(d, 'earthwork-length', 4.5); set(d, 'earthwork-width', 3.2); set(d, 'earthwork-height', 2.1);
  set(d, 'earthwork-quantity', 2);
  set(d, 'earthwork-swell', 25);
  set(d, 'earthwork-truck-capacity', 7);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  t = text(d, 'earthwork-result');
  ok(t.includes('60.48'), 'E9 bank 60.48 m³', t.slice(0, 160));
  ok(t.includes('75.60') || t.includes('75.6'), 'E9 loose 75.60 m³');
  ok(/\b11\b/.test(t), 'E9 11 truck loads');

  // ============ CASE 10 — backfill with shrink ==========================
  // order = 60.48 / (1-0.12) = 68.73 loose; ceil(/7) = 10 loads
  pick(d, 'earthwork-mode', 'backfill');
  set(d, 'earthwork-swell', 12);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  t = text(d, 'earthwork-result');
  ok(t.includes('68.73'), 'E10 backfill order 68.73 m³', t.slice(0, 160));
  ok(/\b10\b/.test(t), 'E10 10 truck loads');

  // ============ CASE 11 — Project Total aggregation =====================
  // session rows: C1 19 bags + C2 (9.25 m3 volume) 62 bags + B3 3 + K5 3 = 87
  if (typeof dom.window.openGrandTotal === 'function') dom.window.openGrandTotal();
  await tick(300);
  const gt = text(d, 'grandtotal-content');
  ok(/87\s*bags/i.test(gt), 'GT aggregates cement = 87 bags (19+62+3+3)', gt.slice(0, 200));

  // ============ CASE 12 — guards ========================================
  pick(d, 'block-mode', 'dims');
  set(d, 'block-num-windows', 50); set(d, 'block-window-width', 10); set(d, 'block-window-height', 10);
  d.getElementById('calculate-blocks').click();
  await tick(250);
  ok(!d.getElementById('error-box')?.classList.contains('hidden') || (text(d, 'blocks-result').length === 0),
     'B12 openings larger than the wall -> error, no crash');

  console.log(`\n=== FORMULA AUDIT: ${passes.length} passed, ${fails.length} failed ===`);
  passes.forEach((p) => console.log('  PASS', p));
  fails.forEach((f) => console.log('  FAIL', f));
  process.exit(fails.length ? 1 : 0);
}

run().catch((e) => { console.error('AUDIT CRASH:', e); process.exit(1); });
