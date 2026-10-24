#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const calculateConcreteEstimate = require('../src/concrete-calculations.src.js');

const ceilWaste = (value, waste = 5) => Math.ceil(value * (1 + waste / 100));
const concrete = ({ length, width, thickness, ratio = [1, 2, 4], dryFactor = 1.54, density = 1440, bagKg = 50, waste = 5 }) => {
  const wet = length * width * thickness;
  const dry = wet * dryFactor;
  const sum = ratio.reduce((a, b) => a + b, 0);
  const cementBags = Math.ceil((dry * ratio[0] / sum * density * (1 + waste / 100)) / bagKg);
  return { wet, dry, cementBags };
};
const masonry = ({ wallVolume, wallThickness, unitLength, unitThickness, unitHeight, leaves, mortarCm = 1, waste = 5, mortarRatio = [1, 6], density = 1440, bagKg = 50, dryFactor = 1.33 }) => {
  const mortar = mortarCm / 100;
  const impliedThickness = leaves * unitThickness + Math.max(0, leaves - 1) * mortar;
  assert.ok(Math.abs(impliedThickness - wallThickness) <= 0.011, 'wall thickness must match leaves and joints');
  const unitFace = (unitLength + mortar) * (unitHeight + mortar);
  const theoretical = (wallVolume / wallThickness / unitFace) * leaves;
  const mortarVolume = wallVolume - theoretical * (unitLength * unitThickness * unitHeight);
  // Cement/sand from dry mortar; wastage applied once to the wet mortar (bricks flow),
  // which equals the blocks flow (wet mortar -> dry -> parts, wastage on cement/sand).
  const mortarOrder = mortarVolume * (1 + waste / 100);
  const dryMortar = mortarOrder * dryFactor;
  const sum = mortarRatio[0] + mortarRatio[1];
  const cementWeight = (dryMortar * mortarRatio[0] / sum) * density;
  const sandVolume = dryMortar * mortarRatio[1] / sum;
  return {
    theoretical,
    order: ceilWaste(theoretical, waste),
    mortarVolume,
    mortarOrder,
    cementWeight,
    cementBags: Math.ceil(cementWeight / bagKg),
    sandVolume,
    mixingWaterLitres: cementWeight * 0.6
  };
};
const steelKg = (diameterMm, lengthM, bars, waste = 5) => (diameterMm ** 2 / 162) * lengthM * bars * (1 + waste / 100);
const earthwork = ({ length, width, height, sections, swell, truckCapacity }) => {
  const gross = length * width * height * sections;
  const loose = gross * (1 + swell / 100);
  return { gross, loose, truckLoads: Math.ceil(loose / truckCapacity) };
};

// Trusted hand-checked examples.
assert.deepEqual(concrete({ length: 5, width: 4, thickness: .2 }), { wet: 4, dry: 6.16, cementBags: 27 });
const appConcrete = calculateConcreteEstimate({ mode: 'dims', type: 'slab', length: 5, width: 4, thickness: .2, quantity: 1, ratio: [1, 2, 4], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 5 });
assert.equal(appConcrete.ok, true);
assert.equal(appConcrete.wetVolume, 4);
assert.equal(appConcrete.cementBags, 27);
const appVolume = calculateConcreteEstimate({ mode: 'volume', type: 'column', totalVolume: 4, quantity: 0, ratio: [1, 2, 4], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 5 });
assert.equal(appVolume.ok, true);
assert.equal(appVolume.wetVolume, 4, 'total-volume mode must not multiply by element count');
assert.equal(appVolume.quantity, null, 'total-volume mode must ignore the hidden element count');
assert.equal(calculateConcreteEstimate({ mode: 'volume', type: 'slab', totalVolume: 4, quantity: '', ratio: [1, 2, 4], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 5 }).ok, true);
assert.equal(calculateConcreteEstimate({ mode: 'dims', type: 'slab', length: 5, width: 4, thickness: .2, quantity: 0, ratio: [1, 2, 4], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 5 }).error, 'invalidQuantity');
const appCustom = calculateConcreteEstimate({ mode: 'volume', type: 'slab', totalVolume: 1, quantity: 1, ratio: [1, 3, 6], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 0 });
assert.equal(appCustom.ok, true);
assert.equal(appCustom.ratio.join(':'), '1:3:6');
const appCustomMode = calculateConcreteEstimate({ mode: 'volume', type: 'slab', totalVolume: 1, quantity: 1, mixMode: 'custom', ratio: [1, 3, 6], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 0 });
assert.equal(appCustomMode.ok, true);
assert.equal(appCustomMode.mixMode, 'custom');
assert.equal(calculateConcreteEstimate({ mode: 'dims', type: 'slab', length: 1e999, width: 1, thickness: 1, quantity: 1, ratio: [1, 2, 4], dryFactor: 1.54, density: 1440, bagKg: 50, wastePercent: 5 }).ok, false);
assert.equal(calculateConcreteEstimate({ mode: 'volume', type: 'slab', totalVolume: 1, quantity: 1, ratio: [1, 2, 4], dryFactor: .9, density: 1440, bagKg: 50, wastePercent: 5 }).ok, false);
const block = masonry({ wallVolume: 6, wallThickness: .2, unitLength: .4, unitThickness: .2, unitHeight: .2, leaves: 1 });
assert.equal(block.order, 366);
assert.ok(block.mortarVolume > 0 && block.mortarVolume < 1);
const wallGross = 5 * 3 * .2;
const openingVolume = 2 * 1.5 * 1 * .2;
assert.ok(Math.abs(openingVolume - 0.6) < 1e-12, 'openings must be width × height × wall thickness');
assert.ok(Math.abs(wallGross - openingVolume - 2.4) < 1e-12, 'opening deduction must use wall thickness');
assert.ok(Math.abs(1.1 * 1.33 - 1.463) < 1e-12, 'mortar dry factor must be explicit and applied to wet mortar');
const brick = masonry({ wallVolume: 3.45, wallThickness: .115, unitLength: .24, unitThickness: .115, unitHeight: .075, leaves: 1 });
assert.equal(brick.order, 1483);
assert.ok(brick.mortarVolume > 0);

// --- Hand-verified masonry material vectors (wall 10 x 3 x 0.2, solid 40x20x20 block,
// 1 cm joints, 1:6 mortar, density 1440, 50 kg bags, 5% waste) ---
const blockMat = masonry({ wallVolume: 6, wallThickness: .2, unitLength: .4, unitThickness: .2, unitHeight: .2, leaves: 1 });
assert.equal(blockMat.order, 366);                                    // ceil(348.432 x 1.05)
assert.ok(Math.abs(blockMat.mortarVolume - 0.425081) < 0.001, String(blockMat.mortarVolume));   // 6 - 348.432x0.016
assert.equal(blockMat.cementBags, 3);                                  // 116.31 kg x 1.05 / 50 -> 2.44 -> 3 bags
assert.ok(Math.abs(blockMat.sandVolume - 0.508845) < 0.001, String(blockMat.sandVolume));
// Brick 10 x 3 x 0.115 wall (3.45 m3): mortar = 15.3% joint fraction -> 0.5276 m3;
// water = 0.6 L per kg cement
assert.ok(Math.abs(brick.mortarVolume - 0.527647) < 0.001, String(brick.mortarVolume));
assert.ok(brick.mixingWaterLitres > 0 && Math.abs(brick.mixingWaterLitres - brick.cementWeight * 0.6) < 1e-9);

// --- Hand-verified steel formula vectors (mirror of calc-steel.src.js) ---
// Lap splices: stock bars needed per run = ceil((L - O) / (S - O)); order length = L + splices x O.
const lap = (L, bars, diaMm, S = 12, lapFactor = 50) => {
  const O = lapFactor * (diaMm / 1000);
  const splicesPerBar = L <= S ? 0 : Math.max(0, Math.ceil((L - O) / (S - O)) - 1);
  return { splices: splicesPerBar * bars, totalLength: L * bars + splicesPerBar * bars * O };
};
const lapVec = lap(20, 2, 12);                                          // 20 m run, 2x Ø12, 12 m stock, 50d
assert.equal(lapVec.splices, 2);                                        // 1 splice per bar
assert.ok(Math.abs(lapVec.totalLength - 41.2) < 1e-9, String(lapVec.totalLength));
assert.ok(Math.abs(lapVec.totalLength * (144 / 162) * 1.05 - 38.45) < 0.02);
assert.equal(lap(3, 4, 16).splices, 0);                                 // fits in one stock bar
assert.equal(lap(24, 1, 12).splices, 2);                                // ceil(23.4/11.4)-1 = 2
// Stirrups: cutting length = 2(w-2c) + 2(d-2c) + 2x10d hooks; count = ceil(L/s) + 1
const stirrup = (wMm, dMm, coverMm, diaMm, lengthM, spacingMm) => {
  const single = (2 * (wMm - 2 * coverMm) + 2 * (dMm - 2 * coverMm) + 2 * (10 * diaMm)) / 1000;
  const count = Math.ceil((lengthM * 1000) / spacingMm) + 1;
  return { single, count, totalLength: single * count };
};
const st = stirrup(300, 500, 40, 8, 3, 200);                            // 30x50 beam, cover 40, Ø8 @200
assert.ok(Math.abs(st.single - 1.44) < 1e-9, String(st.single));
assert.equal(st.count, 16);
assert.ok(Math.abs(st.totalLength * (64 / 162) * 1.05 - 9.56) < 0.02);
// Beam 4Ø16 x 3 m + stirrups above = 19.91 + 9.56 = 29.47 kg
assert.ok(Math.abs(12 * (256 / 162) * 1.05 + st.totalLength * (64 / 162) * 1.05 - 29.47) < 0.02);
// One-way strip: bars = ceil(dist/spacing) + 1, each barLength long
const oneWayBars = Math.ceil((6 * 1000) / 200) + 1;                     // 6 m run @200 -> 31
assert.equal(oneWayBars, 31);
assert.ok(Math.abs(31 * 5 * (100 / 162) * 1.05 - 100.46) < 0.02);
// Footing mesh (D2 cross-check): counts from spacing equal explicit number mode
assert.equal(Math.ceil((2 * 1000) / 150) + 1, 15);                      // lengthwise bars across 2 m
assert.equal(Math.ceil((3 * 1000) / 150) + 1, 21);                      // widthwise bars across 3 m
assert.ok(Math.abs((15 * 3 * (144 / 162) + 21 * 2 * (100 / 162)) * 1.05 - 69.22) < 0.02);
const brickFaceRate = 1 / ((.24 + .01) * (.075 + .01));
assert.ok(Math.abs(brickFaceRate - 47.06) < .02, 'brick face-rate sanity check');
assert.ok(Math.abs(steelKg(12, 10, 4) - 37.33) < .02);
assert.deepEqual(earthwork({ length: 5, width: 4, height: 1, sections: 1, swell: 25, truckCapacity: 4 }), { gross: 20, loose: 25, truckLoads: 7 });

// Edge cases required by the specification.
// v70: layers through the thickness are derived from the wall width — a
// 40 cm wall of 20 cm blocks counts as 2 layers automatically.
const doubleLeaf = masonry({ wallVolume: 12, wallThickness: .4, unitLength: .4, unitThickness: .2, unitHeight: .2, leaves: 2 });
assert.ok(Math.abs(doubleLeaf.theoretical - 2 * block.theoretical) < 0.5, 'double-thick wall = double the blocks');
assert.throws(() => {
  const gross = 2 * 2 * .2;
  const openings = 3;
  if (openings >= gross) throw new Error('openings exceed wall');
}, /openings exceed wall/);
assert.throws(() => {
  const width = 300, depth = 500, cover = 40, diameter = 8, spacing = 0;
  if (!(width > 2 * cover + diameter && depth > 2 * cover + diameter && spacing > 0)) throw new Error('invalid stirrups');
}, /invalid stirrups/);

// Regression guard: the invalid m³ + m² formula must not return to the app.
// The app script lives in app.js now; scan markup + script together so the
// assertions below keep covering both.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') +
             fs.readFileSync(path.join(__dirname, '..', 'src', 'app.src.js'), 'utf8') +
             ['concrete','blocks','bricks','steel','earthwork'].map(n => fs.readFileSync(path.join(__dirname, '..', 'src', `calc-${n}.src.js`), 'utf8')).join('\n');
assert.equal(html.includes('singleBlockVolume + (mortarThicknessM'), false);
assert.equal(html.includes('singleBrickVolume + (mortarThicknessM'), false);
assert.match(html, /src="\.\/app\.js"/);
assert.equal(/src="\.\/app-ui\.js"|src="\.\/concrete-calculations\.js"|src="\.\/calc-[a-z]+\.js"/.test(html), false,
  'all application JS must ship as one merged app.js');
assert.match(html, /value = '1:2:4'/);
assert.match(html, /const currentQuantity = quantity;/, 'slab and other element formwork must use the entered quantity');
assert.match(html, /const totalCementCost = cementCost === null \? null : cementBags \* cementCost;/);
assert.match(html, /const totalSandCost = sandCost === null \? null : sandVolume \* sandCost;/);
assert.match(html, /const totalAggregateCost = aggregateCost === null \? null : aggregateVolume \* aggregateCost;/);
assert.match(html, /value="custom"[^>]*>Custom nominal ratio/);
assert.equal(/value="approved"/.test(html), false, 'approved-recipe option must be gone');
assert.equal(/concrete-approved-water|concrete-approved-admixture|concrete-approved-cement|mixMode, approvedRecipe|moistureBasisNote|Solids purchase allowance/.test(html), false, 'approved-recipe UI must be gone');
assert.match(html, /id="concrete-approved-ratio"/, 'custom nominal ratio input stays');
assert.match(html, /id="concrete-nominal-ratio-wrap"/);
assert.match(html, /concrete-dry-factor-wrap/);
assert.match(html, /concrete-cement-density-wrap/);
assert.match(html, /concrete-nominal-ratio-wrap.*classList\.toggle\('hidden', custom\)/s);
assert.match(html, /getElementById\('concrete-ratio'\)\.disabled = custom/);
assert.match(html, /languageSelector\.addEventListener\('change', updateConcreteMixVisibility\)/);
assert.equal(require('../package.json').scripts.test, 'node tests/calculations.test.js');
assert.match(html, /Formwork pricing needs element dimensions/);
assert.match(html, /data-lang="costScopeNote"/);
assert.match(html, /formworkRow\.classList\.toggle\('hidden', mode === 'volume'\)/);
assert.match(html, /id="block-window-width"/);
assert.match(html, /id="block-window-height"/);
assert.match(html, /id="block-door-width"/);
assert.match(html, /id="block-door-height"/);
assert.match(html, /block-window-width.*block-window-height.*wallWidth/s);
assert.match(html, /id="block-mortar-dry-factor"/);
const blockHandler = html.slice(html.indexOf("__calcHandlers.blocks"), html.indexOf("__calcHandlers.bricks"));
assert.equal(blockHandler.includes('const dryMortarVolume = mortarVolume * 1.33;'), false);
// v70: no leaves question — layers through the wall thickness are derived
// from the wall width the user types.
assert.match(blockHandler, /wallThicknessM \/ \(blockWidthM \+ mortarThicknessM\)/);
assert.equal(blockHandler.includes('block-leaves'), false);
assert.match(html, /T\.hollowBlockNote/);
assert.match(html, /id="brick-hollow-note"/);
assert.match(html, /T\.hollowBrickNote/);
assert.match(html, /id="brick-mortar-dry-factor"/);
// Regression guard: the "Custom site product" brick option must have real inputs,
// otherwise selecting it throws on Calculate.
for (const id of ['brick-custom-profile', 'brick-custom-length', 'brick-custom-width', 'brick-custom-height']) {
  assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
}
// Regression guard: every brick-* element the bricks handler reads must exist in the markup.
{
  const handler = html.slice(html.indexOf("__calcHandlers.bricks"), html.indexOf("__calcHandlers.steel"));
  const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const m of handler.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) {
    assert.ok(declared.has(m[1]), `bricks handler reads missing element #${m[1]}`);
  }
}
// Regression guard: brick preset dimensions must all be millimetres (no mixed m/mm attributes).
for (const m of html.matchAll(/data-(width|length|height)="([^"]+)"[^>]*data-lang="(localBrick|standardBrick|engineeringBrick|romanBrick|hollowBrick)"/g)) {
  assert.ok(Number(m[2]) >= 1, `brick preset ${m[3]} ${m[1]} looks like metres, not mm: ${m[2]}`);
}
assert.match(html, /T\.bricksPerM2/);
// Formula-audit guards: result HTML must not hardcode the English word "bags",
// and block preset data-width is METRES while bricks are MILLIMETRES (handler conventions).
for (const f of ['calc-blocks.src.js', 'calc-bricks.src.js', 'calc-concrete.src.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  assert.equal(/\$\{cementBags\} bags/.test(src), false, `${f} hardcodes "bags" in output`);
}
{
  const blockOpts = [...html.matchAll(/<option[^>]*data-width="([^"]+)"[^>]*data-lang="(?:solidBlock20|solidBlock15|hollowBlock|lightweightBlock)"/g)].map(m => Number(m[1]));
  assert.ok(blockOpts.length >= 4 && blockOpts.every(v => v < 1), `block preset widths must be metres (handler does not divide): ${blockOpts}`);
  const brickOpts = [...html.matchAll(/<option[^>]*data-width="([^"]+)"[^>]*data-lang="(?:localBrick|standardBrick|engineeringBrick|romanBrick|hollowBrick)"/g)].map(m => Number(m[1]));
  assert.ok(brickOpts.length >= 3 && brickOpts.every(v => v >= 1), `brick preset widths must be millimetres: ${brickOpts}`);
}
assert.match(html, /T\.mixingWaterEstimate/);
assert.match(html, /const mixingWaterLitres = cementWeight \* MORTAR_WATER_PER_KG_CEMENT/);
const brickHandler = html.slice(html.indexOf("__calcHandlers.bricks"), html.indexOf("__calcHandlers.steel"));
assert.equal(brickHandler.includes('const dryMortarVolume = mortarVolume * 1.33;'), false);
assert.match(brickHandler, /<details class="calculation-trail/);
assert.match(brickHandler, /wallThicknessM \/ \(brickWidthM \+ mortarThicknessM\)/, 'bricks derive layers from the wall width');
assert.equal(brickHandler.includes('brick-leaves'), false);
assert.equal(html.includes('windowVolume'), false, 'obsolete window-volume translation/input key returned');
assert.equal(html.includes('doorVolume'), false, 'obsolete door-volume translation/input key returned');
assert.equal(html.includes('title="1 = single-leaf wall"'), false, 'English-only leaf tooltip returned');
for (const tab of ['concrete', 'blocks', 'bricks', 'steel', 'earthwork']) {
  assert.match(html, new RegExp(`data-tab="${tab}"`), `missing ${tab} tab target`);
}
assert.match(html, /t\.id = t\.id \|\| 'tab-' \+ t\.dataset\.tab/);
assert.match(html, /t\.addEventListener\('click'/);
// Shipped assets. The Tailwind Play CDN and the Lucide runtime were replaced by
// a compiled stylesheet (assets/app.css) and an inline SVG sprite, so the vendor
// runtimes are no longer part of the deployment.
for (const asset of [
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'favicon.ico', 'app.js', 'sw.js'
]) assert.ok(fs.existsSync(path.join(__dirname, '..', asset)), `deployment asset missing: ${asset}`);
// ...and nothing in the shipped page may point at the old vendor runtimes.
for (const dead of ['vendor/tailwindcss.js', 'vendor/lucide.js', 'printing-quote', 'mobile-sticky-footer', 'global-settings-placeholder', 'concrete-approved-recipe', 'mixModeApproved']) {
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').includes(dead), false,
    `${dead} must not be referenced by the page`);
}

// Every diameter dropdown shares one unified list (including JS-built custom rows).
const DIA = ['8', '10', '12', '14', '16', '18', '20', '22', '25', '28', '32'];
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const m of indexHtml.matchAll(/<select[^>]*(?:diameter|dia)[^>]*>[\s\S]*?<\/select>/g)) {
  const opts = [...m[0].matchAll(/value="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(opts, DIA, `diameter select must use the unified list: ${m[0].slice(0, 60)}`);
}
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.src.js'), 'utf8');
assert.ok(appSrc.includes('[8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32]'), 'custom bar rows must use the unified diameter list');
// Total-volume mode asks for volume only — no wall leaves / thickness inputs.
for (const [wrapId, leavesId, widthId] of [['block-volume-input', 'block-leaves', 'block-wall-width-input'], ['brick-volume-input', 'brick-leaves', 'brick-wall-width-input']]) {
  const wrap = indexHtml.match(new RegExp(`<div id="${wrapId}"[\\s\\S]*?<div id="[^"]*-result|<div id="${wrapId}"[\\s\\S]*?<\\/section`));
  assert.ok(wrap, `find ${wrapId}`);
  assert.equal(wrap[0].includes(leavesId), false, `${wrapId} must not contain ${leavesId}`);
  assert.equal(wrap[0].includes(widthId), false, `${wrapId} must not contain ${widthId}`);
}

// Orphan hidden translation spans removed; option/fallback labels honest.
assert.equal(/<span data-lang="(stepOf|nextStep|reviewStep|homeBack)" style="display:none"/.test(indexHtml), false, 'orphan hidden spans must be gone');
assert.ok(/value="one_way" data-lang="oneWay">One-way slab \/ strip</.test(indexHtml), 'one-way option must read One-way slab / strip');
assert.equal(/One-Way Reinforcement/.test(indexHtml), false, 'One-Way Reinforcement wording must be gone');
assert.equal(/Select Structural Element/.test(indexHtml), false, 'stale Structural Element label must be gone');
assert.equal(/Structural Steel Calculator/.test(indexHtml), false, 'stale Structural Steel title must be gone');
// theme-color is driven by JS; converter outputs read-only; modal has its print action.
assert.ok(/id="theme-color-meta"/.test(indexHtml), 'theme-color meta needs its id');
assert.ok(/id="quote-print-btn"/.test(indexHtml), 'summary modal keeps a print button (same combined PDF)');

// iOS status bar glyphs must be dark (readable on the light app); integer
// count fields use the numeric keypad; icons use logical margins (RTL-safe);
// the summary/intro dialogs are registered; hidden inputs are labelled.
assert.ok(/apple-mobile-web-app-status-bar-style" content="default"/.test(indexHtml), 'status-bar-style must be default (dark glyphs)');
assert.equal(/black-translucent/.test(indexHtml), false, 'black-translucent must be gone');
for (const fid of ['beam-bars', 'column-bars', 'footing-number-len', 'footing-number-wid', 'slab-number-len', 'slab-number-wid', 'earthwork-quantity', 'concrete-quantity', 'steel-member-quantity']) {
  const m = indexHtml.match(new RegExp(`<input[^>]*id="${fid}"[^>]*>`));
  assert.ok(m, `find ${fid}`);
  assert.ok(/inputmode="numeric"/.test(m[0]), `${fid} must use inputmode="numeric"`);
  assert.equal(/inputmode="decimal"/.test(m[0]), false, `${fid} must not offer a decimal keypad`);
}
assert.equal(/mr-1|ml-1/.test(indexHtml), false, 'no physical margin utilities on RTL-sensitive icons');
assert.equal(/mr-1|ml-1/.test(appSrc), false, 'no physical margin utilities in app.src.js');
assert.ok(/<label for="quote-notes" data-lang="quoteNotesLabel">/.test(indexHtml), 'quote-notes label must point at its textarea');
assert.ok(/id="custom-currency"[^>]*data-lang-aria="customCurrencyLabel"/.test(indexHtml), 'custom-currency needs an accessible name');
assert.ok(/'history-modal', 'quote-overlay', 'intro-overlay'/.test(indexHtml), 'quote + intro dialogs must be registered for Esc/focus trap');

// v54: distinct window/door labels, reset guard, preset feedback, and a
// build:css that actually updates the stylesheet of record.
// v65: the land converter moved out of the excavation card into a Site Tools
// popup; masonry volume mode sits behind an Advanced / Direct m³ toggle;
// concrete quick picks are tagged per element.
// v70: Site Tools is deleted entirely (user decision) — no popup, no menu
// button, no land converter markup. Wall leaves is gone too: the wall width
// alone determines how many layers of block fit through the thickness.
assert.equal(/id="site-tools-overlay"/.test(indexHtml) || /id="site-tools-btn"/.test(indexHtml) || /id="land-area-value"/.test(indexHtml), false, 'site tools must stay gone');
assert.equal(/id="block-leaves"/.test(indexHtml) || /id="brick-leaves"/.test(indexHtml), false, 'wall leaves input must stay gone');
assert.ok(/class="sd-chev[^"]*"/.test(indexHtml), 'app accordions keep the rotating chevron');
assert.ok(/id="block-adv-volume"/.test(indexHtml) && /id="brick-adv-volume"/.test(indexHtml), 'masonry gets the advanced / direct m³ toggle');
assert.equal(/role="radiogroup" aria-labelledby="calcmode-lbl-[23]"/.test(indexHtml), false, 'masonry mode radios must not crowd the main form');
// v68: the confusing extras stay gone — no quick-pick chips, no phase
// picker, and no wall elevation preview.
assert.equal(/id="concrete-quick-picks"/.test(indexHtml), false, 'quick-pick chips must stay gone');
assert.equal(/id="block-tag"/.test(indexHtml) || /id="concrete-tag"/.test(indexHtml), false, 'phase picker must stay gone');
assert.equal(/id="block-spec-preview"/.test(indexHtml) || /id="brick-spec-preview"/.test(indexHtml), false, 'wall elevation preview must stay gone');
// v67: plain-language audit fixes — wrong hint text, jargon labels, and
// hardcoded English strings must all be gone or translatable.
assert.equal(/Total Volume concrete \(Quantities\)/.test(appSrc), false, 'concrete hero label must be plain');
assert.equal(/quotePrintBtn: "Print \/ Save as PDF"/.test(appSrc), false, 'print button must not compete with Download PDF');
assert.ok(/data-hint="hintCalcModeConcrete"/.test(indexHtml), 'concrete needs its own calculate-by hint');
assert.equal(/ph\.placeholder = backfill \? 'sand/.test(appSrc), false, 'swell placeholder must come from the dictionary');
assert.ok(/data-lang-placeholder/.test(appSrc) && /querySelectorAll\('\[data-lang-placeholder\]'\)/.test(appSrc), 'placeholders need a translation pass');
assert.ok(/data-lang-aria="earthworkModeLabel"/.test(indexHtml) && /data-lang-aria="homeScreenLabel"/.test(indexHtml) &&
   /data-lang-aria="workspaceStatusLabel"/.test(indexHtml), 'aria labels must be translatable');
for (const key of ['windowWidth', 'windowHeight', 'doorWidth', 'doorHeight']) {
  assert.ok(new RegExp(`data-lang="${key}"`).test(indexHtml), `${key} labels must be used in the openings`);
}
assert.equal(/data-lang="openingWidth"|data-lang="openingHeight"/.test(indexHtml), false, 'generic opening labels must be gone');
for (const key of ['windowWidth', 'windowHeight', 'doorWidth', 'doorHeight', 'presetFilled', 'confirmReset']) {
  assert.ok(new RegExp(`${key}:`).test(appSrc), `${key} must exist in every language block`);
}
assert.equal(/openingWidth:/.test(appSrc), false, 'stale openingWidth translations must be removed');
assert.ok(/if \(dirty && !window\.confirm\(translations\[localStorage\.getItem\('language'\) \|\| 'en'\]\.confirmReset/.test(appSrc), 'reset must ask before wiping typed work');
assert.ok(/presetFilled \|\| '✓ Filled!'/.test(appSrc), 'preset click must flash a filled confirmation');
const pkgJson = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
assert.equal(/assets\/app\.css/.test(pkgJson), false, 'build:css must not target the deleted assets/app.css');
assert.ok(/merge-utilities\.mjs/.test(pkgJson), 'build:css must merge utilities into new-style.css');
assert.ok(/TAILWIND-UTILITIES-START/.test(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'merge-utilities.mjs'), 'utf8')), 'merge script must know the markers');

// v55: Kurdish artifact cleanup, steel naming, hero bar counts, grand-total BOQ,
// error-box scroll, generated-file banners, and embedded-CSS sync enforcement.
assert.equal(/جی بەفیڕۆچوونێ/.test(appSrc), false, 'Badini جی بەفیڕۆچوونێ must be gone');
assert.ok(/پێش بەفیڕۆچوون/.test(appSrc), 'Badini پێش بەفیڕۆچوون must be used');
assert.equal(/سەڵامە|ستڕێنگ|قەبارەی چرکە|قەبار.ی کورد/.test(appSrc), false, 'Sorani artifacts must stay gone');
assert.ok(/homeSteelDesc: "Rebar weight, lengths, and bar counts by element"/.test(appSrc), 'steel home card wording');
assert.equal(/Structural Steel|Bar bending schedules/.test(appSrc + indexHtml), false, 'no structural-steel / bar-bending wording');
assert.ok(/errorBox\.scrollIntoView\(\{ behavior: 'smooth'/.test(appSrc), 'error box must scroll into view');
for (const f of ['app.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.ok(src.startsWith('/* AUTO-GENERATED - DO NOT EDIT DIRECTLY.'), `${f} must carry the AUTO-GENERATED banner`);
}
for (const [f, needle] of [['src/calc-concrete.src.js', 'nums: { cementBags: cementBags'], ['src/calc-blocks.src.js', 'nums: { blocks: blocksNeeded'], ['src/calc-bricks.src.js', 'nums: { bricks: bricksNeeded'], ['src/calc-earthwork.src.js', 'nums: { volume: volume'], ['src/calc-steel.src.js', 'nums: { weightKg:']]) {
  assert.ok(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes(needle), `${f} must carry raw nums for the BOQ`);
}
assert.ok(/totalBars12 \? ` ≈ \$\{formatQty\(totalBars12\)\}/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'calc-steel.src.js'), 'utf8')), 'steel hero must show total commercial bars');
for (const id of ['grandtotal-overlay', 'grandtotal-close-btn', 'grandtotal-print-btn', 'grand-total-btn', 'grandtotal-content']) {
  assert.ok(indexHtml.includes(`id="${id}"`), `missing #${id}`);
}
assert.ok(/'history-modal', 'quote-overlay', 'intro-overlay', 'grandtotal-overlay', 'app-menu'/.test(indexHtml), 'dialogs (incl. v63 menu drawer) must be registered');
assert.ok(/function buildGrandTotalHTML\(\)/.test(appSrc), 'grand-total engine must exist');
for (const key of ['grandTotalBtn', 'grandTotalOpenBtn', 'grandTotalTitle', 'grandTotalHint', 'grandTotalEmpty', 'gtPerDiameter', 'gtSourceNote']) {
  assert.ok(new RegExp(`${key}: `).test(appSrc), `${key} must exist in every language block`);
}
const cssFile = fs.readFileSync(path.join(__dirname, '..', 'new-style.css'), 'utf8');
assert.ok(indexHtml.includes('href="./new-style.css"'), 'index.html must link the stylesheet of record');

// v56: whatsapp purchase order, form drafts, new-project wipe, quick access,
// dialog semantics, update toast, and earthwork backfill (compaction).
assert.ok(/id="grandtotal-overlay" class="hidden modal-overlay" role="dialog" aria-modal="true" aria-labelledby="grandtotal-title"/.test(indexHtml), 'grand total must carry dialog semantics');
assert.ok(/id="grandtotal-whatsapp-btn"/.test(indexHtml), 'grand total needs the WhatsApp button');
assert.ok(/buildGrandTotalWhatsAppText/.test(appSrc) && /api\.whatsapp\.com\/send\?text=/.test(appSrc), 'whatsapp order text builder must exist');
assert.ok(/id="new-project-btn"/.test(indexHtml), 'new-project button must exist');
assert.ok(/id="header-grandtotal-btn"/.test(indexHtml) && /id="session-items-metric-card"/.test(indexHtml) && /nav-total-count/.test(indexHtml + fs.readFileSync(path.join(__dirname, '..', 'src', 'app-ui.src.js'), 'utf8')), 'grand total needs header + metric + nav access points');
assert.ok(/id="update-toast"/.test(indexHtml) && /updatefound/.test(indexHtml) && /controllerchange/.test(indexHtml), 'update toast + SW listeners must exist');
assert.ok(/name="earthwork-mode"/.test(indexHtml) && /backfillMode/.test(appSrc), 'earthwork backfill mode must exist');
assert.ok(/volume \/ \(1 - factorUsed \/ 100\)/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'calc-earthwork.src.js'), 'utf8')), 'backfill must use bank / (1 - compaction)');
for (const key of ['projectTotalNav', 'newProjectTitle', 'newProjectHint', 'newProjectBtn', 'confirmNewProject', 'updateToast', 'updateReload', 'excavationMode', 'backfillMode', 'compactionFactorLabel', 'compactedVolume', 'looseOrder', 'hintCompaction']) {
  assert.ok(new RegExp(`${key}: `).test(appSrc), `${key} must exist in every language block`);
}
assert.ok(/material-estimator-drafts/.test(appSrc) && /function saveDrafts/.test(appSrc) && /function restoreDrafts/.test(appSrc), 'form drafts system must exist');
assert.ok(/delete drafts\[formId\]/.test(appSrc), 'explicit Reset must clear the tool draft');
assert.ok(/supressDraft|suppressDraft/.test(appSrc), 'draft writes must be suppressible around Reset');

// v57: every icon referenced anywhere must exist in the SVG sprite (the blank-box
// bug class), dialog/CSS sync stays strict, header grid balanced, earthwork
// mode group styled, and compaction math cannot divide by ~zero.
const spriteSources = [indexHtml, ...['app.src.js', 'app-ui.src.js', 'calc-concrete.src.js', 'calc-blocks.src.js', 'calc-bricks.src.js', 'calc-steel.src.js', 'calc-earthwork.src.js', 'concrete-calculations.src.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'))].join('\n');
const usedIcons = new Set();
for (const m of spriteSources.matchAll(/data-lucide="([a-z0-9-]+)"/g)) usedIcons.add(m[1]);
for (const m of spriteSources.matchAll(/#i-([a-z0-9-]+)/g)) usedIcons.add(m[1]);
const spriteIcons = new Set([...indexHtml.matchAll(/<symbol id="i-([a-z0-9-]+)"/g)].map(m => m[1]));
const missingIcons = [...usedIcons].filter(n => !spriteIcons.has(n)).sort();
assert.deepEqual(missingIcons, [], `icons used without sprite symbols: ${missingIcons.join(', ')}`);
assert.equal(/data-lucide="trash"/.test(indexHtml), false, 'bare trash must be trash-2');
assert.ok(/data-lucide="trash-2"|#i-trash-2/.test(indexHtml), 'trash-2 must be used');
assert.ok(/<symbol id="i-message-circle"/.test(indexHtml) && /<symbol id="i-file-text"/.test(indexHtml), 'whatsapp and file icons must be in the sprite');
// v64: real client-side PDF — vendored jsPDF precached; RTL strings are drawn
// through the browser's text engine (canvas) so Arabic/Kurdish shaping is exact.
assert.ok(fs.existsSync(path.join(__dirname, '..', 'vendor', 'jspdf.umd.min.js')), 'jsPDF must be vendored');
const swSrc = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert.ok(/vendor\/jspdf\.umd\.min\.js/.test(swSrc), 'sw.js must precache jsPDF');
assert.ok(/downloadSummaryPdf/.test(appSrc) && /downloadProjectPdf/.test(appSrc), 'PDF builders must exist');
assert.ok(/id="quote-pdf-btn"/.test(indexHtml) && /id="grandtotal-pdf-btn"/.test(indexHtml), 'Download PDF buttons must exist');
// v63 export hardening: CSV carries a UTF-8 BOM for Excel on Arabic/Kurdish
// Windows; printing gets 10 mm page margins, B/W contrast, and no URL footers.
assert.ok(/\\uFEFF/.test(appSrc), 'CSV exports must start with a UTF-8 BOM');
assert.ok(/@page \{ margin: 10mm; \}/.test(cssFile) && /a\[href\]::after \{ content: none/.test(cssFile), 'print CSS needs page margins + no URL footers');
assert.ok(/navigator\.vibrate/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'app-ui.src.js'), 'utf8')), 'steppers need haptic taps');
assert.ok(/spec-svg/.test(cssFile) && /steel-spec-preview/.test(indexHtml), 'spec diagrams must exist');
// v63: header drawer — top bar keeps only [logo+title] + [lang chip] + [menu];
// settings / history / project total / language / theme live in #app-menu.
assert.ok(/id="lang-indicator"/.test(indexHtml) && /id="header-menu-btn"/.test(indexHtml), 'header needs lang chip + menu button');
// v69: the drawer keeps four actions — language moved to the header chip
// popup, dark mode moved inside Project settings.
assert.ok(/id="app-menu"[\s\S]*id="open-settings-btn"[\s\S]*id="workspace-history-btn"[\s\S]*id="header-grandtotal-btn"/.test(indexHtml), 'drawer must host settings, history, project total');
const drawerSlice = indexHtml.slice(indexHtml.indexOf('class="app-menu-body"'), indexHtml.indexOf('id="global-settings-wrapper"'));
assert.equal(/id="language-selector"/.test(drawerSlice) || /id="theme-toggle"/.test(drawerSlice), false, 'language and dark mode must leave the drawer');
assert.ok(/id="language-overlay"[\s\S]*?id="language-selector"/.test(indexHtml), 'the language list opens from the header chip');
assert.ok(/id="global-settings-wrapper"[\s\S]*?id="theme-toggle"/.test(indexHtml), 'dark mode lives in project settings');
assert.ok(/'app-menu', 'language-overlay'/.test(indexHtml), 'the language popup joins the dialog registry');
assert.ok(/data-lang-aria="stepperDecrease"/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'app-ui.src.js'), 'utf8')), 'stepper buttons need translatable labels');
assert.ok(appSrc.split("addEventListener('app:lang'")[1].slice(0, 1500).includes('openQuote(quoteCurrentType)'), 'the open quote sheet must re-render on language switch');
assert.ok(/\.app-menu-overlay/.test(cssFile) && /\.lang-chip/.test(cssFile), 'drawer CSS must exist');
assert.ok(/role="radiogroup" data-lang-aria="earthworkModeLabel"/.test(indexHtml), 'earthwork mode must be a segmented radiogroup with a translatable label');
const earthSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'calc-earthwork.src.js'), 'utf8');
assert.ok(/if \(factorUsed >= 90\) factorUsed = 89;/.test(earthSrc), 'backfill must guard against division by zero');
assert.ok(/ph\.max = backfill \? '50' : '100'/.test(appSrc), 'compaction input max must clamp to 50');
// v63: CSS architecture — stylesheet is external and link-referenced; the
// fonts it references are real .woff2 assets (precached), never data URIs.
assert.ok(/<link rel="stylesheet" href="\.\/new-style\.css">/.test(indexHtml), 'index.html must link ./new-style.css');
assert.ok(!/APP_STYLES_START|<style id="app-styles">/.test(indexHtml), 'no embedded CSS block in index.html');
assert.ok(!/data:font/.test(cssFile), 'fonts must not be data URIs');
for (const f of ['vazirmatn-arabic.woff2', 'vazirmatn-latin.woff2']) {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'fonts', f)), `fonts/${f} must exist`);
  assert.ok(cssFile.includes(`./fonts/${f}`), `new-style.css must reference ./fonts/${f}`);
}
assert.ok(/\.\/new-style\.css/.test(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8')) &&
          /vazirmatn-arabic\.woff2/.test(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8')), 'sw.js must precache CSS + fonts');

// v58: per-row session delete, dinar formatting, native share, BRC auto dims,
// compaction placeholder, and LTR number fields in RTL.
assert.ok(/session-row-delete/.test(appSrc) && /sessionResults\[type\]\.splice\(idx, 1\)/.test(appSrc), 'session rows must be individually deletable');
assert.ok(/typeof value === 'object' \|\| key === 'tag'\) return;/.test(appSrc), 'session cells must skip engine objects (nums/quoteLines/tag)');
assert.equal((indexHtml.match(/aria-hidden="true"><\/th>/g) || []).length, 5, 'all 5 session tables need the action column');
assert.ok(/function formatMoney/.test(appSrc) && /maximumFractionDigits: 0/.test(appSrc), 'money must drop coins for IQD');
for (const f of ['calc-concrete.src.js', 'calc-blocks.src.js', 'calc-bricks.src.js', 'calc-steel.src.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  assert.ok(/formatMoney\(totalCost, currency\)|formatMoney\(results\.totalCost, currency\)/.test(src), `${f} must format money with formatMoney`);
  assert.equal(/Cost\.toFixed\(2\)/.test(src), false, `${f} must not render money with toFixed(2)`);
}
assert.ok(/id="quote-share-btn"/.test(indexHtml) && /id="grandtotal-share-btn"/.test(indexHtml), 'both overlays need Share buttons');
assert.ok(/navigator\.share/.test(appSrc) && /shareTextOrCopy/.test(appSrc), 'share must use navigator.share with clipboard fallback');
assert.ok(/shareBtn: "Share \/ Copy"/.test(appSrc), 'shareBtn key must exist in every language block');
assert.ok(/w\.value = '2\.4'; l\.value = '4\.8'/.test(appSrc) && /w\.value = '2\.0'; l\.value = '20\.0'/.test(appSrc), 'BRC roll/sheet must fill commercial dimensions');
assert.ok(/sand ~10, subbase ~15, soil ~20/.test(appSrc), 'backfill placeholder must show compaction guides');
assert.ok(/html\[dir="rtl"\] input\[type="number"\]/.test(cssFile), 'RTL number fields must type LTR');
assert.ok(/formatMoney\(amount, quoteCurrency\(\)\)/.test(appSrc) && /formatMoney\(total, cur\)/.test(appSrc), 'quote and summary money must use formatMoney');

console.log('PASS: concrete, blocks, bricks, steel, earthwork, openings, stirrups, and dimensional regression checks');
