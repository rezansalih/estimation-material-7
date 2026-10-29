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
  set(d, 'concrete-custom-ratio', '1:2:4');
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
  set(d, 'slab-cover', 40);
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
  {
    const qb = d.querySelector('#steel-result .quote-btn');
    if (qb) {
      qb.click();
      await tick(200);
      const qtext = text(d, 'quote-items');
      ok(!/<bdi/i.test(qtext), 'Summary sheet shows no raw <bdi> tags in items', qtext.slice(0, 140));
      ok(/\u00d8/.test(qtext), 'Summary sheet keeps the diameter sign', qtext.slice(0, 140));
      d.getElementById('quote-close-btn')?.click();
    }
  }

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
  ok(/3\.23/.test(gt), 'GT includes formwork 3.23 m2 (C1 slab 7.3x2.2x0.17 edges)', gt.slice(0, 240));
  // ---- bag size change must not rewrite already-ordered mass ----
  // Rows ordered as 50 kg bags stay at their mass even if the setting moves on.
  set(d, 'cement-bag-mass', 25);
  pick(d, 'concrete-mode', 'volume');
  set(d, 'concrete-total-volume', 1);
  set(d, 'concrete-quantity', 1);
  d.getElementById('calculate-concrete').click();
  await tick(300);
  const tinyTxt = String(text(d, 'concrete-result')).replace(/,/g, '');
  const orderPart = tinyTxt.split(/What to order/i)[1] || tinyTxt;
  const bagMatch = orderPart.match(/Cement[^0-9]*([0-9]+)/i);
  const newBags = bagMatch ? Number(bagMatch[1]) : NaN;
  if (typeof dom.window.openGrandTotal === 'function') dom.window.openGrandTotal();
  await tick(200);
  const gt2 = text(d, 'grandtotal-content');
  const expectedKg = 87 * 50 + newBags * 25;
  ok(newBags > 0 && gt2.includes((expectedKg / 1000).toFixed(2)),
     `GT mass ${(expectedKg / 1000).toFixed(2)} t (${87 * 50} + ${newBags * 25} kg) survives bag-size switch`, tinyTxt.slice(0, 700));
  ok(!/87\s*bags/.test(gt2), 'mixed bag sizes show mass, not a summed count', gt2.slice(0, 240));
  set(d, 'cement-bag-mass', 50);

  // ============ CASE 12 — guards ========================================
  pick(d, 'block-mode', 'dims');
  set(d, 'block-num-windows', 50); set(d, 'block-window-width', 10); set(d, 'block-window-height', 10);
  d.getElementById('calculate-blocks').click();
  await tick(250);
  ok(!d.getElementById('error-box')?.classList.contains('hidden') || (text(d, 'blocks-result').length === 0),
     'B12 openings larger than the wall -> error, no crash');

  // ============ CASE 13 — glue round-trip + remembered quote prices ========
  // Selecting glue auto-sets a 3 mm joint; switching back must restore the
  // user's 1.2 cm. Remembered quote prices must follow the line, not the slot.
  pick(d, 'block-mode', 'dims');
  set(d, 'block-wall-length', 7.3); set(d, 'block-wall-height', 2.2); set(d, 'block-wall-width-input', 0.3);
  set(d, 'block-num-windows', 2); set(d, 'block-window-width', 1.4); set(d, 'block-window-height', 1.2);
  set(d, 'block-num-doors', 1); set(d, 'block-door-width', 0.9); set(d, 'block-door-height', 2.1);
  selectVal(d, 'block-type', 'custom');
  set(d, 'block-custom-length', 390); set(d, 'block-custom-width', 190); set(d, 'block-custom-height', 190);
  set(d, 'block-mortar-thickness', 1.2); set(d, 'block-mortar-dry-factor', 1.33); set(d, 'block-mortar-ratio', '1:4');
  set(d, 'block-cement-density', 1440); set(d, 'wastage', 8);
  selectVal(d, 'block-joint-type', 'glue');
  set(d, 'block-glue-rate', 4); set(d, 'block-glue-bag', 25);
  d.getElementById('calculate-blocks').click(); await tick(300);
  d.querySelector('#blocks-result .quote-btn').click(); await tick(200);
  let qpins = d.querySelectorAll('#quote-items .quote-price');
  ok(qpins.length === 2, 'glue summary has 2 priced lines', String(qpins.length));
  qpins[1].value = '7';
  qpins[1].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  d.getElementById('quote-close-btn')?.click();
  selectVal(d, 'block-joint-type', 'mortar');
  ok(d.getElementById('block-mortar-thickness').value === '1.2',
     'switching back to mortar restores the joint thickness', d.getElementById('block-mortar-thickness').value);
  d.getElementById('calculate-blocks').click(); await tick(300);
  t = text(d, 'blocks-result');
  ok(/144/.test(t) && /3\s*bags/.test(t), 'mortar re-run after glue uses the restored 1.2 cm joint', t.slice(0, 160));
  d.querySelector('#blocks-result .quote-btn').click(); await tick(200);
  qpins = d.querySelectorAll('#quote-items .quote-price');
  ok(qpins.length === 3, 'mortar summary has 3 priced lines', String(qpins.length));
  ok(qpins[1] && qpins[1].value.trim() === '', 'remembered glue price must not land on the mortar cement line', qpins[1] && qpins[1].value);
  d.getElementById('quote-close-btn')?.click();

  // ============ CASE 14 — price commas, currency conversion, custom =======
  // "2,5" must parse like every other numeric field (decimal comma, not NaN);
  // remembered prices must convert with the currency switch; and the custom
  // currency option must actually be selectable.
  d.querySelector('#blocks-result .quote-btn').click(); await tick(200);
  let pins2 = d.querySelectorAll('#quote-items .quote-price');
  pins2[1].value = '2,5';
  pins2[1].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await tick(50);
  ok(Math.abs(Number(pins2[1].value) - 2.5) < 0.001, 'price input accepts decimal comma (2,5 -> 2.5)', pins2[1].value);
  const amt1 = d.getElementById('quote-amount-1')?.textContent || '';
  ok(amt1 !== '' && amt1 !== '—', 'comma price computes an amount', amt1);
  d.getElementById('quote-close-btn')?.click();
  set(d, 'exchange-rate', 200);
  const curSel = d.getElementById('currency');
  curSel.value = '$';
  curSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(100);
  ok(curSel.value === '$', 'currency switches to USD', curSel.value);
  d.querySelector('#blocks-result .quote-btn').click(); await tick(200);
  pins2 = d.querySelectorAll('#quote-items .quote-price');
  ok(Math.abs(Number(pins2[1].value) - 1.25) < 0.001, 'remembered price converts IQD -> USD (2.5 -> 1.25)', pins2[1].value);
  d.getElementById('quote-close-btn')?.click();
  curSel.value = 'other';
  curSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  ok(curSel.value === 'other', 'custom currency selectable', curSel.value);
  ok(!d.getElementById('custom-currency').classList.contains('hidden'), 'custom currency input shows');
  curSel.value = 'د.ع';
  curSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  // ============ CASE 15 — staircase flight + bent-up (cranked) bars =======
  // Stair: going 3, 10 risers × 0.15 (rise 1.5), width 1.2, cover 20 mm,
  // main Ø12 @150, dist Ø10 @250, extension 0.3, 2 landings × 1.2 m depth.
  // slope = sqrt(9 + 2.25) = 3.3541; run 3.3141 + 2×0.3 = 3.9141 m
  // main 9 bars; dist 15 bars × 1.16; landings 18×1.76 + 12×1.16
  // Ø12 66.907 m → 62.45 kg; Ø10 31.32 m → 20.30 kg; total 82.75 kg
  set(d, 'wastage', 5);
  set(d, 'steel-member-quantity', 1);
  selectVal(d, 'steel-element-selector', 'stair');
  await tick(120);
  set(d, 'stair-going', 3); set(d, 'stair-riser-h', 0.15); set(d, 'stair-risers', 10);
  set(d, 'stair-width', 1.2); set(d, 'stair-cover', 20); set(d, 'stair-end-ext', 0.3);
  set(d, 'stair-landings', 2); set(d, 'stair-landing-depth', 1.2);
  set(d, 'stair-main-spacing', 150); selectVal(d, 'stair-main-diameter', '12');
  set(d, 'stair-dist-spacing', 250); selectVal(d, 'stair-dist-diameter', '10');
  d.getElementById('calculate-steel').click();
  await tick(300);
  t = text(d, 'steel-result');
  ok(/82\.75/.test(t), 'stair flight + 2 landings = 82.75 kg', t.slice(0, 220));
  ok(/Staircase \(flight\)/.test(t), 'stair element name shows translated, not raw key', t.slice(0, 120));

  // Crank: one-way strip 6 m, user bars 3.5 m, Ø10 @200, D = 120 mm, 2 cranks
  // cut = 3.5 + 2×0.42×0.12 = 3.6008 m; 31 bars → 111.62 m → 72.35 kg
  selectVal(d, 'steel-element-selector', 'one_way');
  await tick(120);
  set(d, 'one-way-dist-length', 6); set(d, 'one-way-bar-length', 3.5);
  set(d, 'one-way-spacing', 200); selectVal(d, 'one-way-diameter', '10');
  const crankCb = d.getElementById('one-way-crank');
  if (!crankCb.checked) crankCb.click();
  await tick(30);
  set(d, 'one-way-crank-depth', 120); set(d, 'one-way-crank-count', 2);
  d.getElementById('calculate-steel').click();
  await tick(300);
  t = text(d, 'steel-result');
  ok(/72\.35/.test(t), 'cranked one-way bars = 72.35 kg (0.42D per crank)', t.slice(0, 220));
  ok(/Bent-up/.test(t), 'crank shape shown in the result', t.slice(0, 160));

  // ============ CASE 16 — backfill mode, GT split + soil balance =========
  // 3×2×1.5 = 9 m³ fill; shrink 15% → order 10.59 m³; ÷6 → 2 loads.
  // Session holds the earlier case in BOTH modes (60.48 m³ bank each: loose
  // 75.60 excavated vs 68.73 fill); plus this one → import balance 3.72 m³.
  const bf = d.querySelector('input[name="earthwork-mode"][value="backfill"]');
  bf.checked = true;
  bf.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(50);
  set(d, 'earthwork-length', 3); set(d, 'earthwork-width', 2); set(d, 'earthwork-height', 1.5);
  set(d, 'earthwork-quantity', 1); set(d, 'earthwork-truck-capacity', 6);
  set(d, 'earthwork-swell', 15);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  t = text(d, 'earthwork-result');
  ok(/10\.59/.test(t) && /Truck Loads\s*2\b/i.test(t), 'backfill order 10.59 m³, 2 loads', t.slice(0, 200));
  if (typeof dom.window.openGrandTotal === 'function') dom.window.openGrandTotal();
  await tick(200);
  const gtE = text(d, 'grandtotal-content');
  ok(/Excavation \(swell\)/.test(gtE), 'GT shows the excavation section', gtE.slice(0, 200));
  ok(/Backfill \(compaction\)/.test(gtE), 'GT shows the backfill section separately', gtE.slice(0, 200));
  ok(/3\.72/.test(gtE), 'GT shows the 3.72 m³ soil balance (import)', gtE.slice(gtE.indexOf('Excavation') - 20, gtE.indexOf('Excavation') + 320));
  d.getElementById('grandtotal-close-btn')?.click();

  // typed swell survives mode toggles (only auto-set values are replaced)
  set(d, 'earthwork-swell', 33);
  bf.checked = false;
  d.querySelector('input[name="earthwork-mode"][value="excavation"]').checked = true;
  d.querySelector('input[name="earthwork-mode"][value="excavation"]').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(30);
  ok(d.getElementById('earthwork-swell').value === '33', 'typed swell survives toggle to excavation', d.getElementById('earthwork-swell').value);
  ok(!d.getElementById('earthwork-soil-picks').classList.contains('hidden'), 'soil picker returns in excavation mode');
  bf.checked = true;
  bf.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(30);
  ok(d.getElementById('earthwork-swell').value === '33', 'typed swell survives toggle back to backfill', d.getElementById('earthwork-swell').value);
  ok(d.getElementById('earthwork-soil-picks').classList.contains('hidden'), 'soil picker hides in backfill mode');

  // quantity shows in the session description
  set(d, 'earthwork-quantity', 2);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  ok(/\u00d7 2/.test(text(d, 'earthwork-table-body')), 'session description shows x2 elements', text(d, 'earthwork-table-body').slice(0, 120));

  // v90 — routed validation messages; nothing silently substituted.
  const errT = () => (d.getElementById('error-box')?.textContent || '');
  set(d, 'earthwork-quantity', 1);
  set(d, 'earthwork-swell', 60);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  ok(/between 0 and 50/.test(errT()), 'shrink 60 shows the shrink-range message', errT().slice(0, 160));
  set(d, 'earthwork-swell', '');
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  ok(/between 0 and 50/.test(errT()), 'empty factor asks for a percentage', errT().slice(0, 160));
  set(d, 'earthwork-swell', 15);
  set(d, 'earthwork-truck-capacity', 'abc');
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  ok(d.getElementById('earthwork-truck-capacity').value === '4', 'garbage capacity is cleaned and falls back to the written-back 4 m³ default', d.getElementById('earthwork-truck-capacity').value);
  t = text(d, 'earthwork-result');
  ok(/10\.59/.test(t) && /Truck Loads\s*3\b/i.test(t), 'fallback truck 4: 10.59 m³ → 3 loads', t.slice(0, 200));
  ok(!/NaN/.test(t), 'no NaN leaks into the result card');
  set(d, 'earthwork-truck-capacity', '');
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  ok(d.getElementById('earthwork-truck-capacity').value === '4', 'empty capacity fills the 4 m³ default back into the field', d.getElementById('earthwork-truck-capacity').value);
  const exr = d.querySelector('input[name="earthwork-mode"][value="excavation"]');
  exr.checked = true;
  exr.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(30);
  set(d, 'earthwork-swell', 150);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  ok(/between 0 and 100/.test(errT()), 'swell 150 shows the swell-range message', errT().slice(0, 160));
  bf.checked = true;
  bf.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(30);
  set(d, 'earthwork-swell', 50);
  d.getElementById('calculate-earthwork').click();
  await tick(300);
  t = text(d, 'earthwork-result');
  ok(/18\.00/.test(t) && /Truck Loads\s*5\b/i.test(t), 'shrink 50 boundary computes: 9/0.5 = 18 m³ → 5 loads at 4 m³', t.slice(0, 200));

  // ============ CASE K6 — openings, mortar-off costs, cavity note, messages ==
  selectVal(d, 'brick-type', 'local_iraqi');
  set(d, 'brick-wall-length', 10); set(d, 'brick-wall-height', 3); set(d, 'brick-wall-width-input', 0.115);
  set(d, 'brick-mortar-thickness', 1.0); set(d, 'brick-mortar-dry-factor', 1.33);
  set(d, 'brick-mortar-ratio', '1:3'); set(d, 'brick-cement-density', 1440);
  set(d, 'brick-include-mortar', true);
  d.getElementById('brick-include-mortar').checked = true;
  d.getElementById('brick-include-mortar').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  set(d, 'brick-num-windows', 2); set(d, 'brick-window-width', 1.5); set(d, 'brick-window-height', 1.2);
  set(d, 'brick-num-doors', 1); set(d, 'brick-door-width', 0.9); set(d, 'brick-door-height', 2.1);
  d.getElementById('calculate-bricks').click();
  await tick(300);
  t = text(d, 'bricks-result');
  // net 3.45 - (2*1.5*1.2 + 0.9*2.1)*0.115 = 2.81865 m3 -> 24.51 m2 face
  // /0.02125 = 1153.41 -> ceil(x1.05) = 1212 bricks
  ok(/1,212/.test(t), 'K6 openings wall = 1,212 bricks', t.slice(0, 200));
  ok(/Deducted 0\.631/.test(t), 'K6 openings line shows the deducted 0.631 m3', t.slice(0, 200));
  ok(/5\s*bags/.test(t), 'K6 mortar cement 5 bags');
  ok(/0\.45/.test(t), 'K6 mortar sand 0.45 m3');

  // mortar OFF + cavity wall: only the brick price is needed for a complete total,
  // no phantom cement/sand rows, and the wall-gap note still shows.
  const mi = d.getElementById('brick-include-mortar');
  mi.checked = false;
  mi.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(30);
  ok(d.getElementById('brick-mortar-settings').classList.contains('hidden'), 'K6 mortar settings hide when mortar is off');
  set(d, 'brick-wall-width-input', 0.28);
  set(d, 'brick-num-windows', 0); set(d, 'brick-window-width', 0); set(d, 'brick-window-height', 0);
  set(d, 'brick-num-doors', 0); set(d, 'brick-door-width', 0); set(d, 'brick-door-height', 0);
  set(d, 'brick-cost', 0.25);
  set(d, 'brick-cement-cost', ''); set(d, 'brick-sand-cost', '');
  d.getElementById('calculate-bricks').click();
  await tick(300);
  t = text(d, 'bricks-result');
  // two leaves in 0.28 m, 5 cm cavity: 30 m2 face /0.018 x2 -> 3333.33 -> ceil(x1.05)=3501
  ok(/3,501/.test(t), 'K6 cavity wall, mortar off = 3,501 bricks', t.slice(0, 200));
  ok(/875/.test(t) && !/Cost not entered/.test(t), 'K6 brick price alone completes the total cost', t.slice(0, 200));
  ok(!/Cement Cost/.test(t) && !/Sand Cost/.test(t), 'K6 no phantom mortar cost rows when mortar is off');
  ok(/not covered by the chosen unit size/.test(t), 'K6 wall-gap note shows even with mortar off', t.slice(0, 220));
  set(d, 'brick-cement-density', 'abc');
  d.getElementById('calculate-bricks').click();
  await tick(300);
  ok(/3,501/.test(text(d, 'bricks-result')), 'K6 mortar-off ignores garbage mortar settings');
  ok(d.getElementById('error-box').classList.contains('hidden'), 'K6 no error from unused mortar fields');

  // volume mode: a bad total volume gets the total-volume message, not "wall width"
  d.getElementById('brick-adv-volume').checked = true;
  d.getElementById('brick-adv-volume').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(30);
  set(d, 'brick-wall-volume', 0);
  d.getElementById('calculate-bricks').click();
  await tick(300);
  ok(/valid total volume/.test(errT()), 'K6 volume mode error names the total volume', errT().slice(0, 160));

  // ============ CASE B7 — preset units, thermo hint, wastage-once display =====
  pick(d, 'block-mode', 'dims');
  selectVal(d, 'block-type', 'solid_20');
  set(d, 'block-wall-length', 10); set(d, 'block-wall-height', 3); set(d, 'block-wall-width-input', 0.2);
  set(d, 'block-num-windows', 0); set(d, 'block-window-width', 0); set(d, 'block-window-height', 0);
  set(d, 'block-num-doors', 0); set(d, 'block-door-width', 0); set(d, 'block-door-height', 0);
  d.getElementById('block-include-mortar').checked = false;
  d.getElementById('block-include-mortar').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  set(d, 'wastage', 5);
  d.getElementById('calculate-blocks').click();
  await tick(300);
  t = text(d, 'blocks-result');
  // 400x200x200 mm preset, no joints: 30 m2 face / (0.4x0.2) = 375 -> ceil(x1.05) = 394
  ok(/394/.test(t), 'B7 preset solid_20 parses as mm -> 394 blocks', t.slice(0, 160));
  const bnote = d.getElementById('block-hollow-note');
  selectVal(d, 'block-type', 'thermo_20');
  ok(!bnote.classList.contains('hidden'), 'B7 thermo-stone shows the grout note under the picker');
  selectVal(d, 'block-type', 'solid_20');
  ok(bnote.classList.contains('hidden'), 'B7 solid block hides the grout note');

  // wastage is applied once to the wet mortar: the displayed cement weight and
  // the to-batch figure now reconcile exactly like the bricks tool.
  selectVal(d, 'block-type', 'custom');
  set(d, 'block-custom-length', 390); set(d, 'block-custom-width', 190); set(d, 'block-custom-height', 190);
  set(d, 'block-wall-length', 7.3); set(d, 'block-wall-height', 2.2); set(d, 'block-wall-width-input', 0.3);
  set(d, 'block-num-windows', 2); set(d, 'block-window-width', 1.4); set(d, 'block-window-height', 1.2);
  set(d, 'block-num-doors', 1); set(d, 'block-door-width', 0.9); set(d, 'block-door-height', 2.1);
  d.getElementById('block-include-mortar').checked = true;
  d.getElementById('block-include-mortar').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  selectVal(d, 'block-joint-type', 'mortar');
  set(d, 'block-mortar-thickness', 1.2);
  set(d, 'block-mortar-dry-factor', 1.33);
  set(d, 'block-mortar-ratio', '1:4');
  set(d, 'block-cement-density', 1440);
  set(d, 'wastage', 8);
  d.getElementById('calculate-blocks').click();
  await tick(300);
  t = text(d, 'blocks-result');
  ok(/127\.99/.test(t), 'B7 cement weight includes the 8% mortar wastage', t.slice(0, 220));
  ok(/0\.334/.test(t) && /0\.309/.test(t), 'B7 mortar row shows 0.334 to batch (0.309 net + waste)', t.slice(0, 220));

  // ============ C3 (v93) — session description carries the element count ====
  pick(d, 'concrete-mode', 'dims');
  selectVal(d, 'concrete-type', 'slab');
  set(d, 'concrete-length', 7.3); set(d, 'concrete-width', 2.2); set(d, 'concrete-thickness', 0.17);
  set(d, 'concrete-quantity', 2);
  selectVal(d, 'concrete-mix-basis', 'custom');
  set(d, 'concrete-custom-ratio', '1:2:4');
  set(d, 'concrete-dry-factor', 1.54);
  set(d, 'concrete-cement-density', 1440);
  set(d, 'wastage', 5);
  d.getElementById('calculate-concrete').click();
  await tick(300);
  t = text(d, 'concrete-result');
  ok(t.includes('5.46') && t.includes('37 × 50 kg'), 'C3 qty 2 -> 5.46 m3 / 37 bags', t.slice(0, 160));
  const c3desc = d.getElementById('concrete-table-body').textContent;
  ok(c3desc.includes('7.3 × 2.2 × 0.17 m × 2'), 'C3 session description shows x quantity', c3desc.slice(0, 200));
  set(d, 'concrete-quantity', 1);
  d.getElementById('calculate-concrete').click();
  await tick(300);
  const c3desc1 = d.getElementById('concrete-table-body').textContent;
  ok(c3desc1.includes('7.3 × 2.2 × 0.17 m') && !c3desc1.includes('0.17 m × 1'), 'C3 single element shows no x 1', c3desc1.slice(0, 200));

  // ============ C4 (v95) — Client Quote opens from the app menu ============
  const qBtn = d.getElementById('workspace-quote-btn');
  ok(qBtn && qBtn.classList.contains('quote-btn'), 'C4 menu entry exists and routes to the quote sheet');
  qBtn.click();
  await tick(250);
  ok(!d.getElementById('quote-overlay').classList.contains('hidden'), 'C4 menu entry opens the quote sheet');
  d.getElementById('quote-close-btn').click();
  await tick(150);

  // ============ C5 (v97) — exported summary sheet carries panel prices ======
  selectVal(d, 'currency', '$');
  set(d, 'price-cement-bag', 5); set(d, 'price-sand', 2); set(d, 'price-aggregate', 3);
  pick(d, 'concrete-mode', 'dims');
  selectVal(d, 'concrete-type', 'slab');
  set(d, 'concrete-length', 7.3); set(d, 'concrete-width', 2.2); set(d, 'concrete-thickness', 0.17);
  set(d, 'concrete-quantity', 1);
  selectVal(d, 'concrete-mix-basis', 'custom');
  set(d, 'concrete-custom-ratio', '1:2:4');
  set(d, 'concrete-dry-factor', 1.54);
  set(d, 'concrete-cement-density', 1440);
  set(d, 'wastage', 5);
  d.getElementById('calculate-concrete').click();
  await tick(300);
  d.querySelector('#concrete-result .export-btn').click();
  await tick(300);
  const phtml = d.getElementById('print-area').innerHTML;
  ok(phtml.includes('95.00') && phtml.includes('105.08'), 'C5 exported sheet carries panel prices (95.00 / 105.08)', phtml.slice(0, 200));
  qBtn.click();
  await tick(250);
  set(d, 'quote-project', 'Villa A');
  d.getElementById('quote-close-btn').click();
  await tick(150);
  d.querySelector('#concrete-result .export-btn').click();
  await tick(300);
  const phtml2 = d.getElementById('print-area').innerHTML;
  ok(phtml2.includes('Villa A'), 'C5 print header carries the quote project name', phtml2.slice(0, 160));

  console.log(`\n=== FORMULA AUDIT: ${passes.length} passed, ${fails.length} failed ===`);
  passes.forEach((p) => console.log('  PASS', p));
  fails.forEach((f) => console.log('  FAIL', f));
  process.exit(fails.length ? 1 : 0);
}

run().catch((e) => { console.error('AUDIT CRASH:', e); process.exit(1); });
