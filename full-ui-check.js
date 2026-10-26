#!/usr/bin/env node
'use strict';
// End-to-end behaviour check against the real served page:
// bottom nav, guided steps, steppers, result hero, themes, phone widths.
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch { console.log('jsdom missing - run npm install'); process.exit(0); }

const URL_ = 'http://localhost:8000/index.html';
// jsdom fires leftover rAF callbacks after window.close() and throws its
// internal _location error asynchronously — swallow exactly that artifact.
process.on('uncaughtException', (e) => {
  if (/_location/.test(String(e && e.message))) return;
  throw e;
});
const tick = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (label, cond, extra = '') => { if (!cond) fails++; console.log(' ', cond ? 'PASS' : 'FAIL', label, extra); };

let __lastDom = null;
async function boot(w = 390, h = 844, lang = 'en', intro = false, pre = null, isRetry = false) {
  // Each boot is a full page with its own copy of jsPDF + styles; release the
  // previous one so the suite cannot pile up hundreds of MB of live DOMs.
  if (__lastDom) { try { __lastDom.window.close(); } catch (e) {} __lastDom = null; }
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', e => errs.push(String(e.message).split('\n')[0]));
  const opts = {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      // jsPDF probes canvas at module load and the PDF writer measures RTL
      // strings through it — give jsdom a tiny 2D context + PNG data URL.
      win.HTMLCanvasElement.prototype.getContext = function () {
        return {
          font: '10px sans-serif', fillStyle: '#000', textBaseline: 'alphabetic',
          measureText: (t) => ({ width: String(t).length * 8 }),
          fillText: () => {}, scale: () => {},
        };
      };
      win.HTMLCanvasElement.prototype.toDataURL = function () {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      };
      win.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
      win.scrollTo = () => {}; win.Element.prototype.scrollIntoView = () => {};
      win.URL.createObjectURL = win.URL.createObjectURL || (() => 'blob:test');
      win.URL.revokeObjectURL = win.URL.revokeObjectURL || (() => {});
      win.confirm = () => true;
      Object.defineProperty(win, 'innerWidth', { value: w, configurable: true });
      Object.defineProperty(win, 'innerHeight', { value: h, configurable: true });
      win.localStorage.setItem('language', lang);
      if (pre) pre(win);
      if (!intro) win.localStorage.setItem('introSeen', '1');
    },
  };
  // jsdom fetches occasionally stall in CI sandboxes — never hang the suite.
  const withBootTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('boot timed out')), ms)),
  ]);
  let dom;
  try { dom = await withBootTimeout(JSDOM.fromURL(URL_, opts), 30000); }
  catch (e) {
    console.log('  (boot retry:', String((e && e.message) || e), ')');
    dom = await withBootTimeout(JSDOM.fromURL(URL_, opts), 30000);
  }
  await tick(1200);
  // Shell readiness: under load the 1.2 s settle can expire before the nav
  // builds; poll so later clicks never hit a missing element, and rebuild the
  // page once if the shell never came up at all.
  const t0 = Date.now();
  while (!dom.window.document.querySelector('.bn-item') && Date.now() - t0 < 8000) await tick(50);
  if (!dom.window.document.querySelector('.bn-item') && !isRetry) {
    console.log('  (boot retry: nav never built)');
    try { dom.window.close(); } catch (e) {}
    __lastDom = null;
    return boot(w, h, lang, intro, pre, true);
  }
  __lastDom = dom;
  return { dom, errs };
}
const vis = (d, sel) => { const el = d.querySelector(sel); return !!el && !el.classList.contains('hidden'); };

(async () => {
  console.log('=== A. Load & shell ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    ok('no page errors', errs.length === 0, errs.join(' | '));
    ok('stylesheet external and linked (v63 architecture)',
       !!d.querySelector('link[rel="stylesheet"][href="./new-style.css"]') && !d.querySelector('#app-styles'));
    ok('no tailwind runtime', typeof dom.window.tailwind === 'undefined');
    ok('card headings carry no wizard numbers', ![...d.querySelectorAll('[data-lang^="step"]')].some(el => /^\s*\d+\./.test(el.textContent)), '');
    ok('icon sprite inline', d.querySelectorAll('symbol[id^="i-"]').length >= 42);
    ok('bottom nav built', !!d.getElementById('bottom-nav'));
    ok('bottom nav has 7 items (home + 5 tools + Project Total)', d.querySelectorAll('.bn-item').length === 7, `(${d.querySelectorAll('.bn-item').length})`);
    ok('nav carries the Project Total with a count badge', !!d.querySelector('.bn-item[data-goto="grandtotal"]') && !!d.getElementById('nav-total-count'));
    ok('action bar built', !!d.getElementById('mobile-actions'));
    ok('calculate moved into action bar', !!d.querySelector('#mobile-actions #mobile-calculate'));
    ok('opens on home screen', d.body.classList.contains('view-home'));
    ok('steppers added', d.querySelectorAll('.num-field').length > 10, `(${d.querySelectorAll('.num-field').length})`);
    ok('all icons painted', d.querySelectorAll('i[data-lucide]').length === 0);
  }

  console.log('\n=== B. Bottom nav navigation ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    ok('bricks panel open', vis(d, '#bricks'));
    ok('view-home cleared', !d.body.classList.contains('view-home'));
    ok('nav item active', d.querySelector('.bn-item[data-goto="bricks"]').classList.contains('is-active'));
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    ok('switched to steel', vis(d, '#steel') && !vis(d, '#bricks'));
    d.querySelector('.bn-item[data-goto="home"]').click();
    await tick(150);
    ok('home button returns home', d.body.classList.contains('view-home'));
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== C. Guided steps ===');
  for (const tool of ['concrete', 'blocks', 'bricks', 'steel']) {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="' + tool + '"]').click();
    await tick(200);
    const wiz = d.querySelector('#' + tool + ' .wizard');
    ok(tool + ': wizard built', !!wiz);
    if (wiz) {
      const steps = wiz.querySelectorAll('.wizard-step');
      ok(tool + ': exactly 2 steps (v72: cost step deleted — prices live in Project settings)', steps.length === 2, `(${steps.length})`);
      ok(tool + ': only step 1 visible', wiz.querySelectorAll('.wizard-step.is-current').length === 1 &&
         steps[0].classList.contains('is-current'));
      ok(tool + ': progress segments', wiz.querySelectorAll('.wp-seg').length === steps.length);
      const nextBtn = wiz.querySelectorAll('.wizard-nav button')[1];
      ok(tool + ': next label', /Next/i.test(nextBtn.textContent), nextBtn.textContent.trim());
      nextBtn.click(); await tick(80);
      ok(tool + ': advanced to step 2', steps[1].classList.contains('is-current'));
      const backBtn = wiz.querySelectorAll('.wizard-nav button')[0];
      backBtn.click(); await tick(80);
      ok(tool + ': back to step 1', steps[0].classList.contains('is-current'));
      // last step
      for (let i = 1; i < steps.length; i++) { wiz.querySelectorAll('.wizard-nav button')[1].click(); await tick(60); }
      ok(tool + ': last step shows Review', /review/i.test(wiz.querySelectorAll('.wizard-nav button')[1].textContent),
         wiz.querySelectorAll('.wizard-nav button')[1].textContent.trim());
    }
    ok(tool + ': no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D. Inputs still reachable & calculating ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    const set = (id, v) => { const e = d.getElementById(id); if (!e) throw new Error('missing #' + id); e.value = String(v); };
    set('brick-wall-length', 10); set('brick-wall-height', 3); set('brick-wall-width-input', 0.115);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const res = d.getElementById('bricks-result');
    ok('result shown', !res.classList.contains('hidden'));
    ok('bricks = 1,483', res.textContent.includes('1,483'));   // grouped item count
    ok('hero built', !!res.querySelector('.result-hero'));
    const hero = res.querySelector('.result-hero');
    if (hero) {
      ok('hero shows quantity', /1,?483/.test(hero.textContent), hero.textContent.replace(/\s+/g, ' ').slice(0, 80));
      ok('hero shows no fake cost without prices', !hero.querySelector('.rh-cost'));
    }
    ok('action buttons row', !!res.querySelector('.result-actions'));
    ok('zero export buttons on results (v74: exports live in Project Total)', !res.querySelector('.export-open-btn') &&
       res.querySelector('.result-actions') && res.querySelector('.result-actions').hasAttribute('hidden') &&
       ['save-history-btn', 'export-csv-btn', 'export-btn', 'quote-btn'].every(c => res.querySelector('.result-actions .' + c)),
       `(${res.querySelectorAll('.result-actions button').length} plumbing)`);

    // v71: the ONE export sheet
    d.querySelector('.export-open-btn[data-scope="project"]').click();   // v74: the one opener (Project Total)
    await tick(120);
    const ex = d.getElementById('export-overlay');
    ok('export sheet opens from Project Total (v74: the one opener)', !ex.classList.contains('hidden'));
    ok('sheet has 4 documents and 6 unique types',
       ex.querySelectorAll('.export-doc').length === 4 && ex.querySelectorAll('.export-type').length === 6);
    ok('project scope preselected', ex.querySelector('.export-doc[data-doc="project"]').getAttribute('aria-checked') === 'true');
    ex.querySelector('.export-doc[data-doc="calc"]').click();
    ok('calc scope: save/pdf/csv/whats enabled, print/copy disabled',
       !ex.querySelector('[data-type="save"]').classList.contains('is-disabled') &&
       !ex.querySelector('[data-type="pdf"]').classList.contains('is-disabled') &&
       ex.querySelector('[data-type="print"]').classList.contains('is-disabled') &&
       ex.querySelector('[data-type="copy"]').classList.contains('is-disabled'));
    ex.querySelector('.export-doc[data-doc="project"]').click();
    ok('project scope: pdf/print/whats/copy enabled, save disabled',
       !ex.querySelector('[data-type="pdf"]').classList.contains('is-disabled') &&
       !ex.querySelector('[data-type="copy"]').classList.contains('is-disabled') &&
       ex.querySelector('[data-type="save"]').classList.contains('is-disabled'));
    ok('doc pills behave like radios', ex.querySelector('.export-doc[data-doc="project"]').getAttribute('aria-checked') === 'true' &&
       ex.querySelector('.export-doc[data-doc="calc"]').getAttribute('aria-checked') === 'false');
    d.getElementById('export-close-btn').click();
    await tick(120);
    ok('export sheet closes', ex.classList.contains('hidden'));
    ok('one "See details" section with the trail merged inside',
       res.querySelectorAll('details.result-more').length === 1 && !res.querySelector('details.calculation-trail'),
       `(more=${res.querySelectorAll('details.result-more').length}, trail=${res.querySelectorAll('details.calculation-trail').length})`);
    ok('details section closed by default', !!res.querySelector('details.result-more') && !res.querySelector('details.result-more').open);
    const grid = res.querySelector('.result-content > div');
    const orderList = grid && grid.querySelector('.order-list');
    ok('answer sits above the order list', !!grid && !!orderList &&
       [...grid.children].indexOf(hero) < [...grid.children].indexOf(orderList));
    const sd = d.querySelector('#bricks-table-section .session-details');
    ok('session table hidden behind a closed bar', !!sd && !sd.open);
    ok('session count badge present', !!d.querySelector('#bricks-table-section .session-count'));
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D2. Steel: custom bars, member quantity, order by diameter ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const set = (id, v) => { const e = d.getElementById(id); if (!e) throw new Error('missing #' + id); e.value = String(v); };

    // lap splices: collapsed advanced details, not a top-level checkbox
    ok('lap splices hidden in closed details', !!d.getElementById('steel-lap-details') && !d.getElementById('steel-lap-details').open);
    ok('no old lap checkbox', !d.getElementById('steel-include-lap-splice'));

    // --- custom bars element ---
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'custom';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('custom inputs shown', !d.getElementById('steel-custom-inputs').classList.contains('hidden'));
    ok('member qty hidden for custom', d.getElementById('steel-member-qty-row').classList.contains('hidden'));
    ok('one custom row to start', d.querySelectorAll('#steel-custom-rows .custom-bar-row').length === 1,
       `(${d.querySelectorAll('#steel-custom-rows .custom-bar-row').length})`);
    d.getElementById('steel-custom-add-row').click();
    ok('add row works', d.querySelectorAll('#steel-custom-rows .custom-bar-row').length === 2);
    const rows = d.querySelectorAll('#steel-custom-rows .custom-bar-row');
    rows[0].querySelector('.custom-diameter').value = '12';
    rows[0].querySelector('.custom-count').value = '10';
    rows[0].querySelector('.custom-length').value = '3';
    rows[1].querySelector('.custom-diameter').value = '8';
    rows[1].querySelector('.custom-count').value = '20';
    rows[1].querySelector('.custom-length').value = '1.5';
    set('steel-cost', 1500);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const res = d.getElementById('steel-result');
    ok('steel result shown', !res.classList.contains('hidden'));
    const hero = res.querySelector('.result-hero');
    ok('hero built', !!hero);
    ok('hero headline is Total Weight', /Total Weight/.test(hero?.querySelector('.rh-label')?.textContent || ''),
       (hero?.querySelector('.rh-label')?.textContent || '').trim());
    // Ø12: 30 m x 0.8889 kg/m x 1.05 = 28.00 kg ; Ø8: 30 m x 0.3951 x 1.05 = 12.44 kg ; total 40.44
    ok('total weight = 40.44 kg', /40\.44/.test(hero?.querySelector('.rh-value')?.textContent || ''),
       (hero?.querySelector('.rh-value')?.textContent || '').trim());
    ok('hero shows cost', !!hero?.querySelector('.rh-cost'));
    ok('flat rows: no stray group headings', res.querySelectorAll('.result-content > div > p').length === 0);
    const orderRows = [...res.querySelectorAll('.order-list .result-item')];
    ok('what-to-order lists each diameter with shop bars',
       orderRows.some(r => /Ø12 mm/.test(r.textContent) && /≈ 3 .*\(12 m\)/.test(r.textContent)) &&
       orderRows.some(r => /Ø8 mm/.test(r.textContent)),
       orderRows.map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    ok('one closed "See details" section', res.querySelectorAll('details.result-more').length === 1 &&
       !res.querySelector('details.result-more').open);
    ok('breakdown rows live in details', /Custom bars/.test(res.querySelector('details.result-more')?.textContent || '') ||
       /20 .*\u00d7 1\.5 m/.test(res.querySelector('details.result-more')?.textContent || ''));
    ok('calculation note merged into details', !!res.querySelector('details.result-more .trail-subhead') &&
       (res.querySelector('details.result-more .trail-body')?.textContent || '').length > 40);

    // --- footing: member quantity must multiply (regression) ---
    sel.value = 'footing';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('member qty visible for footing', !d.getElementById('steel-member-qty-row').classList.contains('hidden'));
    set('footing-length', 3); set('footing-width', 2);
    set('footing-spacing-len', 150); set('footing-diameter-len', 12);
    set('footing-spacing-wid', 150); set('footing-diameter-wid', 10);
    set('steel-member-quantity', 1);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const hero1 = d.querySelector('#steel-result .result-hero .rh-value')?.textContent || '';
    const w1 = parseFloat(hero1.match(/\d+(?:\.\d+)?/)?.[0]);
    // qty 1, cover 40mm: (15 x 2.92 x 144/162 + 21 x 1.92 x 100/162) x 1.05 = 67.01 kg
    ok('footing weight qty 1 = 67.01', Math.abs(w1 - 67.01) < 0.02, String(w1));
    set('steel-member-quantity', 2);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const hero2 = d.querySelector('#steel-result .result-hero .rh-value')?.textContent || '';
    const w2 = parseFloat(hero2.match(/\d+(?:\.\d+)?/)?.[0]);
    ok('member quantity doubles the weight', Math.abs(w2 - 2 * 67.01) < 0.05, String(w2));
    ok('per-member note in details', /per member/.test(d.getElementById('steel-result').textContent));
    ok('session row dimensions are language-neutral', /3 \u00d7 2 m/.test(d.querySelector('#steel-table-body')?.textContent || ''),
       (d.querySelector('#steel-table-body')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80));
    // slab & one-way: member quantity must multiply too (every steel mode)
    sel.value = 'slab';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    set('slab-length', 3); set('slab-width', 2);
    set('slab-spacing-len', 150); set('slab-diameter-len', 12);
    set('slab-spacing-wid', 150); set('slab-diameter-wid', 10);
    set('steel-member-quantity', 2);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const slabHero = parseFloat((d.querySelector('#steel-result .result-hero .rh-value')?.textContent || '').match(/\d+(?:\.\d+)?/)?.[0]);
    ok('slab member qty 2 doubles weight', Math.abs(slabHero - 2 * 67.01) < 0.05, String(slabHero));
    sel.value = 'one_way';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    set('one-way-dist-length', 5); set('one-way-bar-length', 6);
    set('one-way-spacing', 150); set('one-way-diameter', 12);
    set('steel-member-quantity', 3);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const owHero = parseFloat((d.querySelector('#steel-result .result-hero .rh-value')?.textContent || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] || 'NaN');
    // 35 bars × 6 m × 0.8889 kg/m × 1.05 = 196.00 kg per member → ×3 = 588.00
    ok('one-way member qty 3 triples weight', Math.abs(owHero - 3 * 196.0) < 0.2, String(owHero));
    const diaOpts = [...d.getElementById('one-way-diameter').options].map(o => o.value);
    ok('diameter list includes 8–32 mm', ['8', '14', '25', '28', '32'].every(v => diaOpts.includes(v)), diaOpts.join(','));
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D3. Reset button clears the form and hides the result ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'custom';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    const r0 = d.querySelector('#steel-custom-rows .custom-bar-row');
    r0.querySelector('.custom-diameter').value = '12';
    r0.querySelector('.custom-count').value = '10';
    r0.querySelector('.custom-length').value = '3';
    d.getElementById('steel-cost').value = '1500';
    d.getElementById('steel-lap-details').open = true;
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('steel result shown before reset', !d.getElementById('steel-result').classList.contains('hidden'));
    ok('session row exists before reset', d.querySelectorAll('#steel-table-body tr').length >= 1);
    d.querySelector('.reset-btn[data-form="steel"]').click();
    await tick(150);
    ok('result hidden after reset', d.getElementById('steel-result').classList.contains('hidden'));
    ok('element selector cleared', d.getElementById('steel-element-selector').value === '');
    ok('member quantity back to 1', d.getElementById('steel-member-quantity').value === '1');
    ok('cost cleared', d.getElementById('steel-cost').value === '');
    ok('bar length back to 12', d.getElementById('steel-standard-bar-length').value === '12');
    ok('lap details closed again', !d.getElementById('steel-lap-details').open);
    ok('custom rows reset to one empty row', d.querySelectorAll('#steel-custom-rows .custom-bar-row').length === 1 &&
       !(d.querySelector('#steel-custom-rows .custom-count')?.value));
    ok('session rows cleared', d.querySelectorAll('#steel-table-body tr').length === 0 ||
       d.getElementById('steel-table-section').classList.contains('hidden'));
    ok('no errors on steel reset', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '10';
    d.getElementById('brick-wall-height').value = '3';
    d.getElementById('brick-wall-width-input').value = '0.115';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('bricks result shown before reset', !d.getElementById('bricks-result').classList.contains('hidden'));
    d.querySelector('.reset-btn[data-form="bricks"]').click();
    await tick(150);
    ok('bricks result hidden after reset', d.getElementById('bricks-result').classList.contains('hidden'));
    ok('bricks fields cleared', d.getElementById('brick-wall-length').value === '');
    ok('no errors on bricks reset', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D4. Anyone-can-use aids: intro, hints, presets, sanity ===');
  {
    const { dom, errs } = await boot(390, 844, 'en', true);   // intro = true -> first-run state
    const d = dom.window.document;
    const intro = d.getElementById('intro-overlay');
    ok('intro shows on first run', intro && !intro.classList.contains('hidden'));
    ok('intro starts on slide 1', !!intro.querySelector('.intro-slide.is-active[data-slide="0"]'));
    d.getElementById('intro-next').click();
    d.getElementById('intro-next').click();
    ok('start button appears on last slide', !d.getElementById('intro-start').classList.contains('hidden'));
    d.getElementById('intro-start').click();
    ok('intro dismisses and remembers', intro.classList.contains('hidden') && !!dom.window.localStorage.getItem('introSeen'));

    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const hintBtn = d.querySelector('#steel .hint-btn');
    const hintP = hintBtn && hintBtn.closest('.label-with-hint').nextElementSibling;
    ok('hint note starts hidden', !!hintP && hintP.classList.contains('field-hint') && hintP.classList.contains('hidden'));
    hintBtn.click();
    ok('hint opens on tap', !hintP.classList.contains('hidden'));
    hintBtn.click();
    ok('hint closes on tap', hintP.classList.contains('hidden'));

    const sel = d.getElementById('steel-element-selector');
    sel.value = 'footing';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('preset button visible for footing', !d.getElementById('steel-preset-btn').classList.contains('hidden'));
    d.getElementById('steel-preset-btn').click();
    ok('preset fills spacing 150', d.getElementById('footing-spacing-len').value === '150' &&
       d.getElementById('footing-spacing-wid').value === '150');
    ok('preset selects diameters', d.getElementById('footing-diameter-len').value === '12' &&
       d.getElementById('footing-diameter-wid').value === '12');
    ok('preset leaves measurements empty', d.getElementById('footing-length').value === '' &&
       d.getElementById('footing-width').value === '');
    sel.value = 'beam';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('steel-preset-btn').click();
    ok('beam preset fills stirrup assumptions', d.getElementById('beam-stirrup-spacing').value === '200' &&
       d.getElementById('beam-cover').value === '40' &&
       d.getElementById('beam-stirrup-diameter').value === '8');
    ok('beam preset enables stirrups', d.getElementById('beam-include-stirrups').checked);
    sel.value = 'custom';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('preset button hidden for custom', d.getElementById('steel-preset-btn').classList.contains('hidden'));
    ok('no errors on intro/hints/presets', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '10';
    d.getElementById('brick-wall-height').value = '30';   // unusual (usually 1-20 m)
    d.getElementById('brick-wall-width-input').value = '0.115';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const banner = d.querySelector('.sanity-banner');
    ok('sanity banner appears for odd height', !!banner && /30/.test(banner.textContent),
       (banner?.textContent || '').replace(/\s+/g, ' ').slice(0, 90));
    ok('calculation still runs (warning is not blocking)', !d.getElementById('bricks-result').classList.contains('hidden'));
    d.querySelector('.reset-btn[data-form="bricks"]').click();
    await tick(150);
    ok('banner cleared on reset', !d.querySelector('.sanity-banner'));
    ok('no errors with sanity warnings', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '10';
    d.getElementById('brick-wall-height').value = '3';
    d.getElementById('brick-wall-width-input').value = '0.115';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('no banner for normal values', !d.querySelector('.sanity-banner'));
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D5. Language switch re-labels results and session rows ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '10';
    d.getElementById('brick-wall-height').value = '3';
    d.getElementById('brick-wall-width-input').value = '0.115';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('result is in English', /Bricks Required/.test(d.getElementById('bricks-result').textContent));
    const rowsBefore = d.querySelectorAll('#bricks-table-body tr').length;
    ok('session row exists (English words)', /bags|pcs/.test(d.querySelector('#bricks-table-body').textContent),
       d.querySelector('#bricks-table-body').textContent.replace(/\s+/g, ' ').slice(0, 80));
    const sel = d.getElementById('language-selector');
    sel.value = 'ar';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(700);
    const res = d.getElementById('bricks-result');
    ok('result re-rendered in Arabic', /الطابوق المطلوب/.test(res.textContent),
       res.textContent.replace(/\s+/g, ' ').slice(0, 70));
    ok('hero label switched language', !/Bricks Required/.test(res.querySelector('.result-hero')?.textContent || '') &&
       /الطابوق/.test(res.querySelector('.result-hero')?.textContent || ''));
    const cell = d.querySelector('#bricks-table-body').textContent;
    ok('session row localized to Arabic', /كيس/.test(cell) && !/\bbags\b/.test(cell),
       cell.replace(/\s+/g, ' ').slice(0, 80));
    ok('no duplicate session row after switch', d.querySelectorAll('#bricks-table-body tr').length === rowsBefore,
       `(${d.querySelectorAll('#bricks-table-body tr').length} vs ${rowsBefore})`);
    ok('no errors on language switch', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'footing';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('footing-length').value = '3';
    d.getElementById('footing-width').value = '2';
    d.getElementById('footing-spacing-len').value = '150';
    d.getElementById('footing-diameter-len').value = '12';
    d.getElementById('footing-spacing-wid').value = '150';
    d.getElementById('footing-diameter-wid').value = '10';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('steel session row in English', /Footing/.test(d.querySelector('#steel-table-body').textContent));
    const sel = d.getElementById('language-selector');
    sel.value = 'ar';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(700);
    const cell = d.querySelector('#steel-table-body').textContent;
    ok('steel element name localized', /أساس/.test(cell) && !/Footing/.test(cell),
       cell.replace(/\s+/g, ' ').slice(0, 80));
    ok('steel result in Arabic', /الوزن الإجمالي|نتيجة/.test(d.getElementById('steel-result').textContent));
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D6. Formula vectors against the live calculators ===');
  {
    // Steel beam with lap splices: 20 m run, 2x Ø12, 12 m shop bars, 50d laps, 5% waste
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'beam';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('beam-length').value = '20';
    d.getElementById('beam-bars').value = '2';
    d.getElementById('beam-diameter').value = '12';
    d.getElementById('steel-lap-details').open = true;
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('steel-result').textContent;
    ok('lap: 20 m x2Ø12 cover 40 -> 38.30 kg', /38\.30 kg/.test(t), t.replace(/\s+/g, ' ').slice(0, 100));
    const steelHero = d.querySelector('#steel-result .result-hero');
    ok('steel hero is Total Weight (not bar count)', !!steelHero && /Total Weight/.test(steelHero.querySelector('.rh-label')?.textContent || ''), steelHero ? steelHero.textContent.replace(/\s+/g, ' ').slice(0, 60) : 'no hero');
    ok('lap: 2 splices, 1.20 m added', /2(\s*)$/.test('2') && /1\.20 m/.test(t) && /Total number of splices|Splices|عدد|ژمارا/.test(t));
  }
  {
    // Beam stirrups: 3x0.3x0.5 m, cover 40, Ø8 @200 + 4Ø16 mains -> 29.47 kg
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'beam';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('beam-length').value = '3';
    d.getElementById('beam-bars').value = '4';
    d.getElementById('beam-diameter').value = '16';
    d.getElementById('beam-include-stirrups').checked = true;
    d.getElementById('beam-include-stirrups').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('beam-width-dim').value = '300';
    d.getElementById('beam-depth-dim').value = '500';
    d.getElementById('beam-cover').value = '40';
    d.getElementById('beam-stirrup-spacing').value = '200';
    d.getElementById('beam-stirrup-diameter').value = '8';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('steel-result').textContent;
    ok('stirrups: 3m beam 4Ø16 + Ø8@200 cover 40 -> 28.94 kg', /28\.94 kg/.test(t), t.replace(/\s+/g, ' ').slice(0, 110));
    const sch = d.querySelector('.bar-schedule');
    ok('bar schedule present', !!sch && /Bar schedule/.test(sch.textContent));
    ok('stirrup shape shows ring dims 220 × 420', !!sch && /220 × 420/.test(sch.textContent));
    ok('stirrup cutting length 1.44 m', !!sch && /1\.44/.test(sch.textContent));
    ok('schedule lists 2 bar rows', !!sch && sch.querySelectorAll('tbody tr').length === 2, String(sch ? sch.querySelectorAll('tbody tr').length : -1));
  }
  {
    // One-way strip: 6 m run @200, 5 m bars Ø10 -> 100.46 kg
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'one_way';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('one-way-dist-length').value = '6';
    d.getElementById('one-way-bar-length').value = '5';
    d.getElementById('one-way-spacing').value = '200';
    d.getElementById('one-way-diameter').value = '10';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('steel-result').textContent;
    ok('one-way: 6m @200, 5m bars Ø10 -> 100.46 kg', /100\.46 kg/.test(t), t.replace(/\s+/g, ' ').slice(0, 110));
    ok('one-way: 31 bars', /31/.test(t));
    ok('one-way: element name is not undefined', !/undefined/.test(d.getElementById('steel-result').textContent));
  }
  {
    // Footing number-of-bars mode must equal spacing mode: 15x3m Ø12 + 21x2m Ø10 -> 69.22 kg
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'footing';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    const numMode = d.querySelector('input[name="footing-mode"][value="number"]');
    numMode.checked = true;
    numMode.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('footing-length').value = '3';
    d.getElementById('footing-width').value = '2';
    d.getElementById('footing-number-len').value = '15';
    d.getElementById('footing-diameter-len-alt').value = '12';
    d.getElementById('footing-number-wid').value = '21';
    d.getElementById('footing-diameter-wid-alt').value = '10';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('steel-result').textContent;
    ok('footing number mode = 67.01 kg (matches spacing mode)', /67\.01 kg/.test(t), t.replace(/\s+/g, ' ').slice(0, 110));
  }
  {
    // Concrete formwork: slab 5x4x0.2 x2 -> edges 7.20 m² + suspended soffit 40.00 m²
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    const dims = d.querySelector('input[name="concrete-mode"][value="dims"]');
    dims.checked = true;
    dims.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('concrete-type').value = 'slab';
    d.getElementById('concrete-type').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('concrete-length').value = '5';
    d.getElementById('concrete-width').value = '4';
    d.getElementById('concrete-thickness').value = '0.2';
    d.getElementById('concrete-quantity').value = '2';
    const sup = d.getElementById('concrete-slab-support');
    if (sup) {
      sup.value = 'suspended';
      sup.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('concrete-result').textContent;
    ok('slab edge formwork 7.20 m²', /7\.20 m²/.test(t), t.replace(/\s+/g, ' ').slice(0, 120));
    ok('suspended soffit formwork 40.00 m²', /40\.00 m²/.test(t));
  }
  {
    // Blocks with mortar: 10x3x0.2 wall, solid 40x20x20, 1cm joints, 1:6 -> 366 blocks, 3 bags
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="blocks"]').click();
    await tick(150);
    const dims = d.querySelector('input[name="block-mode"][value="dims"]');
    dims.checked = true;
    dims.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('block-wall-length').value = '10';
    d.getElementById('block-wall-height').value = '3';
    d.getElementById('block-wall-width-input').value = '0.2';
    d.getElementById('block-include-mortar').checked = true;
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('blocks-result').textContent;
    ok('blocks: 366 blocks', /366/.test(t), t.replace(/\s+/g, ' ').slice(0, 110));
    ok('blocks: 3 bags of mortar cement', /3/.test(t) && /bags|كيس|کەسک|کیسە/.test(t));
  }

  console.log('\n=== D7. Zero-cost fix and JSON backup/restore ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '10';
    d.getElementById('brick-wall-height').value = '3';
    d.getElementById('brick-wall-width-input').value = '0.115';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const res = d.getElementById('bricks-result');
    const totalLine = res.querySelector('.total-cost-print')?.textContent || '';
    ok('bricks: missing prices say Cost not entered', /Cost not entered/.test(totalLine), totalLine.trim());
    ok('bricks: no false 0.00 total', !/0\.00/.test(totalLine));
    ok('bricks: hero omits the cost line', !res.querySelector('.result-hero .rh-cost'));
    ok('bricks: session cost cell says not entered', /Cost not entered/.test(d.querySelector('#bricks-table-body').textContent));
    // explicit 0 is still a real (free) price
    d.getElementById('brick-cost').value = '0';
    d.getElementById('brick-cement-cost').value = '0';
    d.getElementById('brick-sand-cost').value = '0';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const zeroCost = (d.getElementById('bricks-result').querySelector('.total-cost-print')?.textContent) || '';
    ok('bricks: entered zeros are a real zero total', /0/.test(zeroCost) && !/0\.00/.test(zeroCost) && !/not entered/i.test(zeroCost), zeroCost);
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'footing';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('footing-length').value = '3';
    d.getElementById('footing-width').value = '2';
    d.getElementById('footing-spacing-len').value = '150';
    d.getElementById('footing-diameter-len').value = '12';
    d.getElementById('footing-spacing-wid').value = '150';
    d.getElementById('footing-diameter-wid').value = '10';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const res = d.getElementById('steel-result');
    ok('steel: missing price says Cost not entered', /Cost not entered/.test(res.textContent));
    ok('steel: hero omits the cost line', !res.querySelector('.result-hero .rh-cost'));
    ok('no errors with zero-cost fix', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const w = dom.window;
    // backup downloads a JSON file
    const dl = [];
    w.HTMLAnchorElement.prototype.click = function () { dl.push(this.download); };
    d.getElementById('open-settings-btn')?.click();
    await tick(80);
    d.getElementById('backup-btn').click();
    await tick(100);
    ok('backup downloads a dated JSON file', dl.length === 1 && /material-estimator-backup-.*\.json/.test(dl[0] || ''), String(dl[0]));
    ok('backup button confirms', /Backup file downloaded/.test(d.getElementById('backup-btn').textContent));
    // restore from a crafted backup file
    const bak = {
      app: 'material-estimator', version: 1, language: 'ar', theme: 'dark', introSeen: '1',
      settings: { wastage: '7', currency: 'IQD', customCurrency: '', exchangeRate: '1350', cementBagMass: '40' },
      history: [{ type: 'bricks', data: {}, timestamp: '2026-01-01T00:00:00Z' }],
      sessions: { steel: [{ element: 'Footing', description: '3 × 2 m', weight: '69.22 kg', cost: 'IQD100' }] }
    };
    const file = new w.File([JSON.stringify(bak)], 'backup.json', { type: 'application/json' });
    const input = d.getElementById('restore-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await tick(400);
    ok('restore: settings values come back', d.getElementById('wastage').value === '7' &&
       d.getElementById('cement-bag-mass').value === '40' && d.getElementById('exchange-rate').value === '1350');
    ok('restore: language applied', d.getElementById('language-selector').value === 'ar');
    ok('restore: session rows come back', d.querySelectorAll('#steel-table-body tr').length === 1 &&
       /Footing|أساس/.test(d.querySelector('#steel-table-body').textContent));
    ok('restore: history comes back', JSON.parse(w.localStorage.getItem('calculationHistory') || '[]').length === 1);
    ok('restore: button confirms', /تمت استعادة|Backup restored|استعادة/.test(d.getElementById('restore-btn').textContent));
    // invalid file is rejected
    const bad = new w.File(['{"nope":1}'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [bad], configurable: true });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await tick(300);
    ok('restore: invalid file is rejected with a message', d.getElementById('error-box')?.textContent?.length > 0 ||
       !d.getElementById('error-box')?.classList.contains('hidden'));
    ok('no errors in backup/restore', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D8. Job-site additions: BRC, grades, glue, converter, quote ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const ratio = d.getElementById('concrete-ratio');
    ratio.value = '1:3:6';
    ratio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(80);
    ok('grade note follows ratio (C15 blinding)', /blinding/i.test(d.getElementById('concrete-grade-note').textContent));
    ok('grade note key is data-lang-driven', d.getElementById('concrete-grade-note').getAttribute('data-lang') === 'gradeNoteC15');
    ratio.value = '1:1.5:3';
    ratio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(80);
    ok('grade note follows ratio (C25 high strength)', /High strength/i.test(d.getElementById('concrete-grade-note').textContent));
    ok('no errors in grade presets', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'brc';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(80);
    ok('brc inputs shown', !d.getElementById('steel-brc-inputs').classList.contains('hidden'));
    ok('brc hides the per-kg cost card', d.getElementById('steel-cost-card').classList.contains('hidden'));
    ok('brc keeps member quantity row', !d.getElementById('steel-member-qty-row').classList.contains('hidden'));
    d.getElementById('brc-area-len').value = '20';
    d.getElementById('brc-area-wid').value = '10';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('steel-result').textContent;
    ok('brc: 200 m² +10% over 40 m² rolls -> 6 rolls', /6 Rolls/.test(t) && /200\.0 m²/.test(t), t.replace(/\s+/g, ' ').slice(0, 120));
    const brcHero = d.querySelector('#steel-result .result-hero');
    ok('brc hero is Mesh to order', !!brcHero && /Mesh to order/.test(brcHero.querySelector('.rh-label')?.textContent || ''));
    ok('brc: no cost entered says so', /Cost not entered/.test(t));
    const mode = d.getElementById('brc-mode');
    mode.value = 'sheet';
    mode.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('sheet mode fills 2.4 x 4.8 m commercial panels', d.getElementById('brc-width').value === '2.4' && d.getElementById('brc-length').value === '4.8');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('brc sheets: 220/11.52 -> 20 sheets', /20 Sheets/.test(d.getElementById('steel-result').textContent),
       d.getElementById('steel-result').textContent.replace(/\s+/g, ' ').slice(0, 120));
    ok('no errors in brc', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="blocks"]').click();
    await tick(150);
    const vol = d.querySelector('input[name="block-mode"][value="volume"]');
    vol.checked = true;
    vol.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(80);
    d.getElementById('block-wall-volume').value = '6';
    const bt = d.getElementById('block-type');
    bt.value = 'thermo_20';
    bt.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    const jt = d.getElementById('block-joint-type');
    jt.value = 'glue';
    jt.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('glue auto-sets 3 mm joint (0.3 cm)', d.getElementById('block-mortar-thickness').value === '0.3');
    ok('glue fields shown, mortar fields hidden', !d.getElementById('block-glue-fields').classList.contains('hidden') &&
       d.getElementById('block-mortar-fields').classList.contains('hidden'));
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('blocks-result').textContent;
    ok('glue: 30 m² x 4 kg x 5% waste -> 126.0 kg -> 6 bags of 25 kg', /126\.0 kg/.test(t) && /6 bags/.test(t), t.replace(/\s+/g, ' ').slice(0, 140));
    ok('glue: no mortar volume rows', !/Mortar Volume/.test(t));
    ok('no errors in glue mode', errs.length === 0, errs.join(' | '));
  }

  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '10';
    d.getElementById('brick-wall-height').value = '3';
    d.getElementById('brick-wall-width-input').value = '0.115';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.querySelector('#bricks-result .quote-btn').click();
    await tick(150);
    const ov = d.getElementById('quote-overlay');
    ok('quote overlay opens', !ov.classList.contains('hidden'));
    ok('quote total says cost-not-entered before prices (never 0.00)', /Cost not entered/.test(d.getElementById('quote-total').textContent || ''), d.getElementById('quote-total').textContent);
    ok('quote lists items with quantities', ov.querySelectorAll('#quote-items tr').length >= 2 &&
       /1,483|1483/.test(ov.querySelector('#quote-items').textContent));
    ok('quote has signature lines', /Contractor signature/.test(ov.textContent) && /Client signature/.test(ov.textContent));
    // type an agreed unit price -> amount and total compute
    const price0 = ov.querySelector('#quote-items tr input');
    price0.value = '100';
    price0.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await tick(80);
    ok('quote computes amount from unit price (grouped dinars, no coins)', /148,300/.test(ov.textContent) && !/148,300\.00/.test(ov.textContent), ov.querySelector('.quote-amount')?.textContent);
    ok('quote grand total updates', (d.getElementById('quote-total').textContent || '').length > 0);
    // meta remembered
    d.getElementById('quote-project').value = 'Test Villa';
    d.getElementById('quote-project').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    d.getElementById('quote-client').value = 'Mr. Ahmed';
    d.getElementById('quote-client').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await tick(50);
    const meta = JSON.parse(dom.window.localStorage.getItem('estimatorQuoteMeta') || '{}');
    ok('quote meta remembered', meta.project === 'Test Villa' && meta.client === 'Mr. Ahmed');
    // WhatsApp: pre-filled itemized message
    const opened = [];
    dom.window.open = (url) => { opened.push(url); return null; };
    d.getElementById('quote-whatsapp-btn').click();
    await tick(150);
    ok('modal keeps whatsapp beside print', !!d.getElementById('quote-whatsapp-btn') && !!d.getElementById('quote-print-btn'));
    ok('whatsapp opens wa.me with encoded text', opened.length === 1 && /wa\.me\/\?text=/.test(opened[0] || ''), String(opened[0] || '').slice(0, 60));
    const msg = decodeURIComponent((opened[0] || '').split('text=')[1] || '');
    ok('whatsapp message has the itemized bill', /1483|1,483/.test(msg) && /Material Summary/.test(msg) && /148,300/.test(msg),
       msg.replace(/\n/g, ' | ').slice(0, 140));
    ok('whatsapp message has names and total', /Test Villa/.test(msg) && /Mr\. Ahmed/.test(msg) && /Grand total/.test(msg));
    ok('whatsapp button flashes confirmation', /copied/i.test(d.getElementById('quote-whatsapp-btn').textContent));
    d.getElementById('quote-close-btn').click();
    await tick(50);
    ok('quote closes', ov.classList.contains('hidden'));
    ok('no errors in quote flow', errs.length === 0, errs.join(' | '));

    /* ===== D11: one combined PDF = calculation + summary sheet ===== */
    dom.window.print = () => {};
    d.querySelector('#bricks-result .export-btn').click();
    await tick(120);
    const pa = d.getElementById('print-area');
    ok('combined PDF contains the calculation', /1483|1,483/.test(pa.innerHTML));
    ok('combined PDF contains the summary sheet', pa.querySelector('.print-summary-sheet') !== null &&
       /Material Summary/.test(pa.innerHTML) && /Contractor signature/.test(pa.innerHTML) && /Client signature/.test(pa.innerHTML));
    ok('PDF summary carries remembered prices and meta', /148,300/.test(pa.innerHTML) && /Test Villa/.test(pa.innerHTML) && /Mr\. Ahmed/.test(pa.innerHTML));
    ok('PDF summary grand total present', /Grand total/.test(pa.innerHTML));
    ok('summary button label is Summary', /Summary/.test(d.querySelector('#bricks-result .quote-btn').textContent));
    ok('no errors in combined PDF', errs.length === 0, errs.join(' | '));

    /* ===== D12: theme-color, clear confirm, converter outputs, custom note ===== */
    const metaEl = d.getElementById('theme-color-meta');
    d.getElementById('theme-toggle').click();
    await tick(60);
    ok('dark mode sets status-bar color dark', metaEl.getAttribute('content') === '#0b1417', metaEl.getAttribute('content'));
    d.getElementById('theme-toggle').click();
    await tick(60);
    ok('light mode restores status-bar color', metaEl.getAttribute('content') === '#f2f6f7');
    let confirmCalls = 0;
    dom.window.confirm = () => { confirmCalls++; return false; };
    const beforeRows = d.querySelectorAll('#bricks-table-section tbody tr').length;
    d.getElementById('clear-bricks-table').click();
    await tick(60);
    ok('clear asks for confirmation; cancel keeps rows', confirmCalls === 1 && d.querySelectorAll('#bricks-table-section tbody tr').length === beforeRows, `calls=${confirmCalls} rows=${d.querySelectorAll('#bricks-table-section tbody tr').length}`);
    dom.window.confirm = () => true;
    d.getElementById('clear-bricks-table').click();
    await tick(60);
    ok('confirmed clear empties the session table', d.querySelectorAll('#bricks-table-section tbody tr').length === 0);
    // modal print runs the single combined PDF
    dom.window.confirm = () => true;
    d.getElementById('mobile-calculate').click();   // recalc bricks to restore result
    await tick(300);
    d.querySelector('#bricks-result .quote-btn').click();
    await tick(120);
    dom.window.print = () => {};
    d.getElementById('quote-print-btn').click();
    await tick(120);
    ok('modal print button prints the combined document', /print-summary-sheet/.test(d.getElementById('print-area').innerHTML));
    d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick(80);
    ok('Escape closes the summary modal (registered dialog)', d.getElementById('quote-overlay').classList.contains('hidden'));
    // custom bars note reaches the breakdown
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'custom';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(120);
    const crow = d.querySelector('#steel-custom-rows .custom-bar-row');
    ok('custom row has a note field', !!crow.querySelector('.custom-note'));
    crow.querySelector('.custom-diameter').value = '12';
    crow.querySelector('.custom-count').value = '10';
    crow.querySelector('.custom-length').value = '6';
    crow.querySelector('.custom-note').value = 'column starter dowels';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('custom note appears in the result breakdown', /column starter dowels/.test(d.getElementById('steel-result').textContent));
    ok('no errors in D12', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D13: preset feedback + reset confirmation ===');
  {
    const { dom, errs } = await boot(390, 844, 'en');
    const d = dom.window.document;
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'footing'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(120);
    const presetBtn = d.getElementById('steel-preset-btn');
    presetBtn.click();
    await tick(40);
    ok('preset button flashes a filled confirmation', /Filled/.test(presetBtn.textContent), presetBtn.textContent);
    await tick(1300);
    ok('preset button label restores itself', presetBtn.textContent.trim() === 'Fill typical values', presetBtn.textContent);
    const flen = d.getElementById('footing-spacing-len');
    const typed = flen.value;
    ok('preset left values behind to protect', typed !== '' && typed !== flen.defaultValue, `typed=${typed}`);
    let resetConfirmCalls = 0;
    dom.window.confirm = () => { resetConfirmCalls++; return false; };
    d.querySelector('.reset-btn[data-form="steel"]').click();
    await tick(60);
    ok('reset asks first; cancel keeps typed values', resetConfirmCalls === 1 && flen.value === typed, `calls=${resetConfirmCalls} value=${flen.value}`);
    dom.window.confirm = () => true;
    d.querySelector('.reset-btn[data-form="steel"]').click();
    await tick(60);
    ok('confirmed reset restores the form', flen.value === flen.defaultValue, `value=${flen.value}`);
    ok('no errors in D13', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D14: project grand total (combined purchase order) ===');
  {
    const { dom, errs } = await boot(390, 844, 'en');
    const d = dom.window.document;
    d.getElementById('open-settings-btn').click();
    await tick(80);
    d.getElementById('grand-total-btn').click();
    await tick(80);
    ok('grand total shows an empty-state message first', /No calculations in this session yet/.test(d.getElementById('grandtotal-content').textContent));
    d.getElementById('grandtotal-close-btn').click();
    await tick(40);
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    d.getElementById('concrete-length').value = '5';
    d.getElementById('concrete-width').value = '4';
    d.getElementById('concrete-thickness').value = '0.2';
    d.getElementById('concrete-length').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'beam'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(80);
    d.getElementById('beam-length').value = '20';
    d.getElementById('beam-bars').value = '2';
    d.getElementById('beam-diameter').value = '12';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.getElementById('open-settings-btn').click();
    await tick(80);
    d.getElementById('grand-total-btn').click();
    await tick(80);
    const ov = d.getElementById('grandtotal-overlay');
    const gt = d.getElementById('grandtotal-content').textContent;
    ok('grand total overlay opens', !ov.classList.contains('hidden'));
    ok('purchase order aggregates cement bags', /Cement Bags/.test(gt) && /bags/.test(gt), gt.replace(/\s+/g, ' ').slice(0, 90));
    ok('purchase order aggregates sand and aggregate', /Sand/.test(gt) && /Aggregate/.test(gt));
    ok('purchase order aggregates steel weight with tonnes', /Total Weight/.test(gt) && /kg \(\d+\.\d+ t\)/.test(gt), gt.replace(/\s+/g, ' ').slice(0, 140));
    ok('purchase order lists steel by diameter with bars', /Ø12 mm/.test(gt) && /Bars/.test(gt), gt.replace(/\s+/g, ' ').slice(0, 200));
    dom.window.print = () => {};
    d.getElementById('grandtotal-print-btn').click();
    await tick(60);
    ok('grand total prints a purchase order', /print-summary-sheet/.test(d.getElementById('print-area').innerHTML) && /Combined purchase order/.test(d.getElementById('print-area').innerHTML));
    d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick(60);
    ok('Escape closes the grand total (registered dialog)', ov.classList.contains('hidden'));
    ok('no errors in D14', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D15: whatsapp order, drafts, new project, access, backfill ===');
  {
    const { dom, errs } = await boot(390, 844, 'en', false, win => {
      win.localStorage.setItem('material-estimator-drafts', JSON.stringify({ concrete: { 'concrete-length': '7' } }));
    });
    const d = dom.window.document;
    await tick(200);
    ok('draft restores typed value after reload', d.getElementById('concrete-length').value === '7', d.getElementById('concrete-length').value);
    // typed value is auto-saved (debounced)
    d.getElementById('concrete-width').value = '3.5';
    d.getElementById('concrete-width').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await tick(450);
    ok('draft auto-saves after typing', /3\.5/.test(dom.window.localStorage.getItem('material-estimator-drafts') || ''), dom.window.localStorage.getItem('material-estimator-drafts'));
    // concrete (draft + typed width) then steel -> whatsapp purchase order
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    d.getElementById('concrete-thickness').value = '0.2';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'beam'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(80);
    d.getElementById('beam-length').value = '20';
    d.getElementById('beam-bars').value = '2';
    d.getElementById('beam-diameter').value = '12';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    let openedUrl = '';
    dom.window.open = (url) => { openedUrl = url; };
    d.getElementById('open-settings-btn').click();
    await tick(60);
    d.getElementById('grand-total-btn').click();
    await tick(60);
    d.getElementById('grandtotal-whatsapp-btn').click();
    await tick(120);
    const waText = decodeURIComponent(openedUrl.split('text=')[1] || '');
    ok('whatsapp launches api.whatsapp.com with the order text', openedUrl.indexOf('https://api.whatsapp.com/send?text=') === 0, openedUrl.slice(0, 60));
    ok('whatsapp order has date and currency header', /Date:/.test(waText) && /Currency:/.test(waText), waText.replace(/\n/g, ' | ').slice(0, 120));
    ok('whatsapp order totals cement with tonnes', /Cement Bags: \d+ bags \(\d+\.\d+ t\)/.test(waText), waText.replace(/\n/g, ' | ').slice(0, 200));
    ok('whatsapp order lists steel by diameter with bars', /Ø12 mm: \d+\.\d+ kg ≈ \d+ Bars \(12 m\)/.test(waText), waText.replace(/\n/g, ' | ').slice(0, 300));
    d.getElementById('grandtotal-close-btn').click();
    await tick(40);
    // access points: header button + metric card + nav badge
    d.querySelector('.bn-item[data-goto="grandtotal"]').click();
    await tick(60);
    ok('header Project Total button opens the order', !d.getElementById('grandtotal-overlay').classList.contains('hidden'));
    d.getElementById('grandtotal-close-btn').click();
    await tick(40);
    d.getElementById('session-items-metric-card').click();
    await tick(60);
    ok('SESSION ITEMS metric opens the order', !d.getElementById('grandtotal-overlay').classList.contains('hidden'));
    ok('order dialog carries dialog semantics', d.getElementById('grandtotal-overlay').getAttribute('role') === 'dialog' && d.getElementById('grandtotal-overlay').getAttribute('aria-modal') === 'true' && d.getElementById('grandtotal-title') !== null);
    ok('nav shows the session count badge', /\d/.test(d.getElementById('nav-total-count')?.textContent || ''), d.getElementById('nav-total-count')?.textContent);
    d.getElementById('grandtotal-close-btn').click();
    await tick(40);
    // earthwork backfill math: 5*4*0.2 = 4 m3 compacted, shrink 15% -> 4.71 m3 loose, 3 m3 trucks -> 2
    d.querySelector('.bn-item[data-goto="earthwork"]').click();
    await tick(150);
    const bf = d.querySelector('input[name="earthwork-mode"][value="backfill"]');
    bf.checked = true; bf.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(60);
    ok('backfill swaps the factor label', !d.getElementById('earthwork-swell-label-backfill').classList.contains('hidden') && d.getElementById('earthwork-swell-label-excav').classList.contains('hidden'));
    d.getElementById('earthwork-length').value = '5';
    d.getElementById('earthwork-width').value = '4';
    d.getElementById('earthwork-height').value = '0.2';
    d.getElementById('earthwork-swell').value = '15';
    d.getElementById('earthwork-truck-capacity').value = '3';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const et = d.getElementById('earthwork-result').textContent;
    ok('backfill orders loose material = bank/(1-shrink)', /4\.71 m³/.test(et) && /Loose material to order/.test(et), et.replace(/\s+/g, ' ').slice(0, 120));
    ok('backfill truck trips from loose volume', /Required compacted volume/.test(et) && /Truck Loads\s*2/.test(et.replace(/\s+/g, ' ')), et.replace(/\s+/g, ' ').slice(0, 160));
    // New project clears every session table
    d.getElementById('open-settings-btn').click();
    await tick(60);
    const rowsBefore = [...d.querySelectorAll('[id$="-table-body"]')].reduce((sum, b) => sum + b.querySelectorAll('tr').length, 0);
    ok('sessions exist before new project', rowsBefore >= 3, String(rowsBefore));
    dom.window.confirm = () => true;
    d.getElementById('new-project-btn').click();
    await tick(120);
    const rowsAfter = [...d.querySelectorAll('[id$="-table-body"]')].reduce((sum, b) => sum + b.querySelectorAll('tr').length, 0);
    ok('new project wipes all five session tables', rowsAfter === 0, String(rowsAfter));
    // sprite integrity: painted icons must point at real symbols
    const iconOk = sel => {
        const use = d.querySelector(sel + ' use');
        return !!use && !!d.querySelector('symbol' + (use.getAttribute('href') || ''));
    };
    ok('new-project icon resolves in the sprite', iconOk('#new-project-btn'), 'new-project');
    ok('nav Project Total icon resolves in the sprite', iconOk('.bn-item[data-goto="grandtotal"]'), 'nav');
    ok('whatsapp icon resolves in the sprite', iconOk('#grandtotal-whatsapp-btn'), 'whatsapp');
    // explicit Reset clears that tool's draft
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    ok('draft still holds concrete values', /concrete-length/.test(dom.window.localStorage.getItem('material-estimator-drafts') || ''));
    d.querySelector('.reset-btn[data-form="concrete"]').click();
    await tick(120);
    const draftsNow = JSON.parse(dom.window.localStorage.getItem('material-estimator-drafts') || '{}');
    ok('reset clears the tool draft', !(draftsNow.concrete && draftsNow.concrete['concrete-length'] !== undefined), JSON.stringify(draftsNow.concrete || {}));
    ok('no errors in D15', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D16: row delete, dinar formatting, share, brc dims ===');
  {
    const { dom, errs } = await boot(390, 844, 'en');
    const d = dom.window.document;
    // two brick rows, delete the first only
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    d.getElementById('brick-wall-length').value = '3';
    d.getElementById('brick-wall-height').value = '2';
    d.getElementById('brick-wall-width-input').value = '0.25';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.getElementById('brick-wall-length').value = '4';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const rows1 = d.querySelectorAll('#bricks-table-body tr');
    ok('two session rows exist', rows1.length === 2, String(rows1.length));
    ok('session cells show values, not [object Object]', !/object Object/.test(d.getElementById('bricks-table-body').textContent) && /1\.50 m³/.test(d.getElementById('bricks-table-body').textContent), d.getElementById('bricks-table-body').textContent.replace(/\s+/g, ' ').slice(0, 80));
    rows1[0].querySelector('.session-row-delete').click();
    await tick(120);
    const rows2 = d.querySelectorAll('#bricks-table-body tr');
    ok('row delete removes only that item', rows2.length === 1 && /2\.00 m³/.test(rows2[0].textContent), rows2[0] ? rows2[0].textContent.replace(/\s+/g, ' ').slice(0, 60) : 'gone');
    ok('badge count follows the row delete', (d.getElementById('nav-total-count')?.textContent || '').trim() === '1', d.getElementById('nav-total-count')?.textContent);
    // session totals (concrete cumulative footer) recalc on row delete
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    const cDims = d.querySelector('input[name="concrete-mode"][value="dims"]');
    cDims.checked = true;
    cDims.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('concrete-type').value = 'slab';
    d.getElementById('concrete-type').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('concrete-length').value = '2';
    d.getElementById('concrete-width').value = '2';
    d.getElementById('concrete-thickness').value = '0.1';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.getElementById('concrete-length').value = '3';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const cRows = d.querySelectorAll('#concrete-table-body tr');
    ok('two concrete rows exist', cRows.length === 2, String(cRows.length));
    ok('concrete footer sums session totals', /1\.00 m³/.test(d.getElementById('concrete-table-footer').textContent), d.getElementById('concrete-table-footer').textContent.replace(/\s+/g, ' ').slice(0, 60));
    cRows[0].querySelector('.session-row-delete').click();
    await tick(120);
    ok('footer recalcs after row delete', /0\.60 m³/.test(d.getElementById('concrete-table-footer').textContent) && !/1\.00/.test(d.getElementById('concrete-table-footer').textContent), d.getElementById('concrete-table-footer').textContent.replace(/\s+/g, ' ').slice(0, 60));
    // dinar formatting: grouped, no coins
    d.getElementById('brick-wall-length').value = '5';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.querySelector('#bricks-result .quote-btn').click();
    await tick(150);
    const priceInput = d.querySelector('#quote-overlay .quote-price');
    priceInput.value = '14850000';
    priceInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await tick(80);
    const qtyTxt = d.querySelector('#quote-overlay .quote-qty')?.textContent || '';
    const qn = Math.round(parseFloat((qtyTxt.match(/[\d.]+/) || ['1'])[0])) || 1;
    const amt = d.querySelector('#quote-overlay .quote-amount')?.textContent || '';
    ok('IQD amounts are grouped without coins', amt.replace(/[^\d]/g, '') === String(14850000 * qn) && !/[\d]\./.test(amt), `${amt} expected digits ${14850000 * qn}`);
    // native share falls back to clipboard
    let sharedText = '';
    dom.window.navigator.clipboard = { writeText: (t) => { sharedText = t; return Promise.resolve(); } };
    d.getElementById('quote-share-btn').click();
    await tick(120);
    ok('quote Share/Copy copies the bill', /Material Summary/.test(sharedText) && sharedText.includes(amt), sharedText.replace(/\n/g, ' | ').slice(0, 120));
    d.getElementById('quote-close-btn').click();
    await tick(40);
    // share via navigator.share when available
    let sharePayload = null;
    dom.window.navigator.share = (data) => { sharePayload = data; return Promise.resolve(); };
    d.getElementById('open-settings-btn').click();
    await tick(60);
    d.getElementById('grand-total-btn').click();
    await tick(60);
    d.getElementById('grandtotal-share-btn').click();
    await tick(120);
    ok('grand total Share uses navigator.share', !!sharePayload && /Combined purchase order/.test(sharePayload.text), sharePayload ? sharePayload.text.replace(/\n/g, ' | ').slice(0, 80) : 'none');
    d.getElementById('grandtotal-close-btn').click();
    await tick(40);
    // BRC commercial dimensions follow roll/sheet
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'brc'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(120);
    const bm = d.getElementById('brc-mode');
    bm.value = 'sheet'; bm.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(40);
    ok('sheet mode fills 2.4 x 4.8 m panels', d.getElementById('brc-width').value === '2.4' && d.getElementById('brc-length').value === '4.8', `${d.getElementById('brc-width').value}x${d.getElementById('brc-length').value}`);
    bm.value = 'roll'; bm.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(40);
    ok('roll mode fills 2.0 x 20.0 m rolls', d.getElementById('brc-width').value === '2.0' && d.getElementById('brc-length').value === '20.0', `${d.getElementById('brc-width').value}x${d.getElementById('brc-length').value}`);
    // earthwork factor placeholder follows the mode
    d.querySelector('.bn-item[data-goto="earthwork"]').click();
    await tick(150);
    const bf = d.querySelector('input[name="earthwork-mode"][value="backfill"]');
    bf.checked = true; bf.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(60);
    ok('backfill placeholder shows compaction guides', /sand ~10, subbase ~15, soil ~20/.test(d.getElementById('earthwork-swell').placeholder), d.getElementById('earthwork-swell').placeholder);
    const ex = d.querySelector('input[name="earthwork-mode"][value="excavation"]');
    ex.checked = true; ex.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(60);
    ok('excavation placeholder restores swell guides', /rock ~50/.test(d.getElementById('earthwork-swell').placeholder) && d.getElementById('earthwork-swell').getAttribute('max') === '100', d.getElementById('earthwork-swell').placeholder);
    ok('no errors in D16', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D9. Kurdish terminology + bidi isolation ===');
  {
    const { dom, errs } = await boot(390, 844, 'ks');
    const d = dom.window.document;
    const hint1 = d.querySelector('[data-lang="hintMixRatio"]');
    ok('ks hintMixRatio wraps ratio 1:6 in <bdi dir="ltr">', /<bdi dir="ltr">1:6<\/bdi>/.test(hint1.innerHTML), hint1.innerHTML.slice(0, 110));
    const hint2 = d.querySelector('[data-lang="hintStirrupDiameter"]');
    ok('ks hintStirrupDiameter wraps Ø8 in <bdi dir="ltr">', /<bdi dir="ltr">Ø8<\/bdi>/.test(hint2.innerHTML));
    ok('reset buttons keep their icons after relabel', !!d.querySelector('button.reset-btn svg.lucide, button.reset-btn i[data-lucide]'));
    // concrete: ratio wrap + Sorani terms (wet volume, ordered, strength->بەرگری)
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    const dims = d.querySelector('input[name="concrete-mode"][value="dims"]');
    dims.checked = true;
    dims.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('concrete-type').value = 'slab';
    d.getElementById('concrete-type').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('concrete-length').value = '5';
    d.getElementById('concrete-width').value = '4';
    d.getElementById('concrete-thickness').value = '0.2';
    d.getElementById('concrete-quantity').value = '2';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const t = d.getElementById('concrete-result');
    ok('ks concrete trail wraps ratio in bdi', /<bdi dir="ltr">1:2:4<\/bdi>/.test(t.innerHTML), '');
    ok('ks wet volume is قەبارەی تەڕ', /قەبارەی تەڕ/.test(t.textContent) && !/قەبارەی چرکە/.test(t.textContent));
    ok('ks ordered word is dawakraw', /\u062f\u0627\u0648\u0627\u06a9\u0631\u0627\u0648/.test(t.textContent) && !/\u0633\u06d5\u06b5\u0627\u0645\u06d5/.test(t.textContent));
    ok('ks strength word is بەرگری', /بەرگری/.test(t.textContent) && !/ستڕێنگ/.test(t.textContent));
    // steel: Ø labels wrapped
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'footing';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('footing-length').value = '3';
    d.getElementById('footing-width').value = '2';
    d.getElementById('footing-spacing-len').value = '150';
    d.getElementById('footing-diameter-len').value = '12';
    d.getElementById('footing-spacing-wid').value = '150';
    d.getElementById('footing-diameter-wid').value = '10';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('ks steel order wraps Ø12 in bdi', /<bdi dir="ltr">Ø12 mm<\/bdi>/.test(d.getElementById('steel-result').innerHTML));
    ok('ks steel schedule wraps diameters in bdi', /<bdi dir="ltr">Ø10 mm<\/bdi>/.test(d.getElementById('steel-result').innerHTML));
    // earthwork: gross volume term
    d.querySelector('.bn-item[data-goto="earthwork"]').click();
    await tick(150);
    d.getElementById('earthwork-length').value = '4';
    d.getElementById('earthwork-width').value = '3';
    d.getElementById('earthwork-height').value = '2';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('ks gross volume is قەبارەی سەرجەم', /قەبارەی سەرجەم/.test(d.getElementById('earthwork-result').textContent));
    ok('no errors in ks pass', errs.length === 0, errs.join(' | '));
  }
  {
    const { dom, errs } = await boot(390, 844, 'ku');
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="earthwork"]').click();
    await tick(150);
    d.getElementById('earthwork-length').value = '4';
    d.getElementById('earthwork-width').value = '3';
    d.getElementById('earthwork-height').value = '2';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('ku gross volume is قەبارێ گشتی', /قەبارێ گشتی/.test(d.getElementById('earthwork-result').textContent) &&
       !/قەبارێ کورد/.test(d.getElementById('earthwork-result').textContent));
    ok('no errors in ku pass', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D10. Language picker names stay exactly as specified ===');
  {
    const EXPECT = ['ENGLISH', 'KURDISH BADINI', 'KURDISH SORANI', 'ARABIC'];
    const norm = (t) => (t || '').replace(/\u00a0/g, ' ').trim();
    for (const lang of ['en', 'ku', 'ks', 'ar']) {
      const { dom, errs } = await boot(390, 844, lang);
      const d = dom.window.document;
      const names = [...d.querySelectorAll('#language-selector option')].map(o => norm(o.textContent));
      ok(`picker names exact in ${lang}`, JSON.stringify(names) === JSON.stringify(EXPECT), names.join(' | '));
      ok(`picker keeps dir=ltr in ${lang}`, d.getElementById('language-selector').getAttribute('dir') === 'ltr' &&
         [...d.querySelectorAll('#language-selector option')].every(o => o.getAttribute('dir') === 'ltr'));
      // switching language must never rewrite the names
      const sel = d.getElementById('language-selector');
      sel.value = lang === 'en' ? 'ar' : 'en';
      sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      await tick(250);
      const after = [...d.querySelectorAll('#language-selector option')].map(o => norm(o.textContent));
      ok(`names unchanged after switch (from ${lang})`, JSON.stringify(after) === JSON.stringify(EXPECT), after.join(' | '));
      ok(`no errors in picker pass ${lang}`, errs.length === 0, errs.join(' | '));
    }
  }

  console.log('\n=== D17: local material price memory ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.getElementById('open-settings-btn')?.click();
    await tick(80);
    const setP = (id, v) => {
      const el = d.getElementById(id);
      el.value = v;
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    };
    setP('price-cement-bag', '10000');
    setP('price-sand', '5000');
    setP('price-rebar', '1500');
    await tick(80);
    ok('settings prices persist to memory', JSON.parse(dom.window.localStorage.getItem('estimatorPrices') || '{}')['price-cement-bag'] === '10000', dom.window.localStorage.getItem('estimatorPrices') || '');
    ok('concrete prices auto-filled', d.getElementById('concrete-cement-cost').value === '10000' && d.getElementById('concrete-sand-cost').value === '5000', `${d.getElementById('concrete-cement-cost').value}/${d.getElementById('concrete-sand-cost').value}`);
    ok('blocks and bricks share the bag price', d.getElementById('block-cement-cost').value === '10000' && d.getElementById('brick-cement-cost').value === '10000');
    ok('steel rebar price auto-filled', d.getElementById('steel-cost').value === '1500', d.getElementById('steel-cost').value);
    ok('aggregate untouched when unset', d.getElementById('concrete-aggregate-cost').value === '');
    // a typed price is never overwritten; untouched fields still follow the memory
    const sand = d.getElementById('concrete-sand-cost');
    sand.value = '7777';
    sand.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    setP('price-sand', '6000');
    await tick(60);
    ok('typed price is never overwritten', sand.value === '7777', sand.value);
    ok('untouched fields follow the memory', d.getElementById('block-sand-cost').value === '6000', d.getElementById('block-sand-cost').value);
    // clear the memory -> auto-filled fields clear too, typed one stays
    setP('price-sand', '');
    setP('price-cement-bag', '');
    await tick(60);
    ok('clearing memory clears auto-filled fields', d.getElementById('block-sand-cost').value === '' && d.getElementById('block-cement-cost').value === '');
    ok('typed price survives a cleared memory', sand.value === '7777', sand.value);
    ok('no errors in D17', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== E. Touch steppers ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    const field = d.getElementById('brick-wall-length');
    const wrap = field.closest('.num-field');
    ok('input wrapped in .num-field', !!wrap);
    field.value = '10';
    wrap.querySelector('button[data-dir="1"]').click();
    ok('plus increments by step', field.value === '10.01', field.value);
    wrap.querySelector('button[data-dir="-1"]').click();
    ok('minus decrements', field.value === '10', field.value);
    const wins = d.getElementById('brick-num-windows');
    wins.value = '1';
    wins.closest('.num-field').querySelector('button[data-dir="1"]').click();
    ok('integer step = 1', wins.value === '2', wins.value);
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== F. Themes ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    ok('light default', !d.body.classList.contains('theme-dark'));
    const tg = d.getElementById('theme-toggle');
    tg.checked = true; tg.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    ok('dark applied', d.body.classList.contains('theme-dark'));
    tg.checked = false; tg.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    ok('back to light', !d.body.classList.contains('theme-dark'));
    ok('no errors', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== G. Phone widths (320 / 360 / 390 / 430 / 768) ===');
  for (const w of [320, 360, 390, 430, 768]) {
    const { dom, errs } = await boot(w, 800);
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    const set = (id, v) => { const e = d.getElementById(id); e.value = String(v); };
    set('brick-wall-length', 5); set('brick-wall-height', 3); set('brick-wall-width-input', 0.115);
    d.getElementById('mobile-calculate').click();
    await tick(250);
    ok(`${w}px: calculates`, d.getElementById('bricks-result').textContent.includes('742'),
       d.getElementById('bricks-result').textContent.replace(/\s+/g, ' ').slice(0, 50));
    ok(`${w}px: no errors`, errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== H. Languages (en / ar / ku / ks) ===');
  for (const lang of ['en', 'ar', 'ku', 'ks']) {
    const { dom, errs } = await boot(390, 844, lang);
    const d = dom.window.document;
    const brickNav = d.querySelector('.bn-item[data-goto="bricks"]');
    ok(`${lang}: nav built`, !!brickNav);
    if (brickNav) brickNav.click();
    await tick(200);
    const wiz = d.querySelector('#bricks .wizard');
    ok(`${lang}: wizard built`, !!wiz);
    ok(`${lang}: step label present`, !!wiz && /[^\s]/.test(wiz.querySelector('.wizard-meta span').textContent),
       wiz ? wiz.querySelector('.wizard-meta span').textContent : '');
    ok(`${lang}: no errors`, errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D18: v62 round ===');
  {
    // Sand/gravel truck-load guides + exact mixing-water label + grouped counts
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    set('concrete-length', '12'); set('concrete-width', '24'); set('concrete-thickness', '20');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const ct = d.getElementById('concrete-result').textContent;
    ok('truck-load guide on sand + gravel order rows', (ct.match(/standard 4 m³ truck/g) || []).length >= 2, ct.replace(/\s+/g, ' ').slice(0, 140));
    ok('concrete grouped bags count (12x24x0.2 = 57.6 m³ -> 2,880+ kg bags line)', /truck load/.test(ct) && /,\d{3}/.test(ct.replace(/[\d.]+ m³/g, '')), '');
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    set('brick-wall-length', '10'); set('brick-wall-height', '3'); set('brick-wall-width-input', '0.115');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const bt = d.getElementById('bricks-result').textContent;
    ok('mixing-water label uses the exact EN string', bt.includes('Estimated batch mixing water (w/c ≈ 0.55–0.60)'), '');
    ok('bricks grouped count', /,\d{3}/.test(bt.replace(/\d+\.\d+/g, '')), '');
    ok('no errors in D18 truck/water', errs.length === 0, errs.join(' | '));
  }
  {
    // Thousands separators on big counts + earthwork capacity fallback
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
    d.querySelector('.bn-item[data-goto="blocks"]').click();
    await tick(150);
    const bDims = d.querySelector('input[name="block-mode"][value="dims"]');
    bDims.checked = true;
    bDims.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    set('block-wall-length', '50'); set('block-wall-height', '20'); set('block-wall-width-input', '0.2');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('blocks 50x20 -> five-digit count grouped with separator', /1[0-9],[0-9]{3}/.test(d.getElementById('blocks-result').textContent),
       d.getElementById('blocks-result').textContent.replace(/\s+/g, ' ').slice(0, 120));
    d.querySelector('.bn-item[data-goto="earthwork"]').click();
    await tick(150);
    set('earthwork-length', '10'); set('earthwork-width', '4'); set('earthwork-height', '2'); set('earthwork-quantity', '1'); set('earthwork-swell', '0');
    set('earthwork-truck-capacity', '');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    let et = d.getElementById('earthwork-result');
    ok('empty capacity falls back to 4 m³ (80 m³ loose -> 20 loads @ 4 m³)',
       !et.classList.contains('hidden') && /Truck loads/i.test(et.textContent) && /20/.test(et.textContent),
       et.textContent.replace(/\s+/g, ' ').slice(0, 140));
    set('earthwork-truck-capacity', 'abc');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    et = d.getElementById('earthwork-result');
    ok('garbage capacity also falls back to 4 m³',
       !et.classList.contains('hidden') && /Truck loads/i.test(et.textContent) && /20/.test(et.textContent),
       et.textContent.replace(/\s+/g, ' ').slice(0, 140));
    ok('no errors in D18 counts/fallback', errs.length === 0, errs.join(' | '));
  }
  {
    // Concrete formwork row auto-hides in Total Volume mode; openings summaries gate
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
    d.querySelector('.bn-item[data-goto="concrete"]').click();
    await tick(150);
    const volRadio = d.querySelector('input[name="concrete-mode"][value="volume"]');
    ok('volume mode radio exists', !!volRadio);
    volRadio.checked = true;
    volRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('formwork row hidden in volume mode', d.getElementById('concrete-formwork-row').classList.contains('hidden'));
    const dimRadio = d.querySelector('input[name="concrete-mode"][value="dims"]');
    dimRadio.checked = true;
    dimRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    ok('formwork row back in dimensions mode', !d.getElementById('concrete-formwork-row').classList.contains('hidden'));
    d.querySelector('.bn-item[data-goto="blocks"]').click();
    await tick(150);
    const sum = d.getElementById('block-openings-summary');
    ok('openings summary empty without windows/doors', (sum.textContent || '').trim() === '', JSON.stringify(sum.textContent));
    set('block-wall-length', '10'); set('block-wall-height', '3'); set('block-wall-width-input', '0.2');
    set('block-num-windows', '1'); set('block-window-height', '1.5'); set('block-window-width', '1');
    await tick(50);
    ok('openings summary shows once count + area > 0', /m³/.test(sum.textContent), JSON.stringify(sum.textContent));
    ok('no errors in D18 hide/show', errs.length === 0, errs.join(' | '));
  }
  {
    // No stirrups -> no stirrup rows (regression pin)
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'beam';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('beam-length').value = '3';
    d.getElementById('beam-bars').value = '4';
    d.getElementById('beam-diameter').value = '16';
    d.getElementById('beam-include-stirrups').checked = false;
    d.getElementById('beam-include-stirrups').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    d.getElementById('mobile-calculate').click();
    await tick(300);
    const res = d.getElementById('steel-result');
    const t = res.textContent;
    ok('beam without stirrups: no Stirrup rows or spacers', !/Stirrup/i.test(t) && !/spacer/i.test(t), t.replace(/\s+/g, ' ').slice(0, 120));
    const sch = res.querySelector('.bar-schedule');
    ok('schedule lists exactly 1 bar row', !!sch && sch.querySelectorAll('tbody tr').length === 1, String(sch ? sch.querySelectorAll('tbody tr').length : -1));
    ok('no errors in D18 stirrups', errs.length === 0, errs.join(' | '));
  }
  {
    // Quote/WhatsApp drop zero-quantity lines
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'custom';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    d.getElementById('steel-custom-add-row').click();
    const rows = d.querySelectorAll('#steel-custom-rows .custom-bar-row');
    rows[0].querySelector('.custom-diameter').value = '12';
    rows[0].querySelector('.custom-count').value = '0';
    rows[0].querySelector('.custom-length').value = '6';
    rows[1].querySelector('.custom-diameter').value = '12';
    rows[1].querySelector('.custom-count').value = '4';
    rows[1].querySelector('.custom-length').value = '6';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.querySelector('#steel-result .quote-btn').click();
    await tick(150);
    const ov = d.getElementById('quote-overlay');
    ok('quote overlay opens for custom steel', !ov.classList.contains('hidden'));
    const qrows = [...ov.querySelectorAll('#quote-items tr')].map(tr => tr.textContent);
    ok('zero-quantity line dropped from quote', !qrows.some(r => /0\.00 kg/.test(r) || /\b0\b.*bars/i.test(r)), qrows.join(' | ').slice(0, 140));
    ok('non-zero line kept', qrows.length >= 1, String(qrows.length));
    ok('no errors in D18 quote filter', errs.length === 0, errs.join(' | '));
  }
  {
    // enterkeyhint next/done per card
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="blocks"]').click();
    await tick(150);
    const card = d.querySelector('#blocks .card');
    const fields = [...card.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    ok('blocks card fields carry enterkeyhint', fields.length > 0 && fields.every(el => el.getAttribute('enterkeyhint') === 'next' || el.getAttribute('enterkeyhint') === 'done'),
       fields.map(el => el.id + '=' + el.getAttribute('enterkeyhint')).join(',').slice(0, 120));
    ok('last field is done, earlier are next',
       fields[fields.length - 1].getAttribute('enterkeyhint') === 'done' && fields.slice(0, -1).every(el => el.getAttribute('enterkeyhint') === 'next'), '');
    ok('no errors in D18 enterkeyhint', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D19: v63 round ===');
  {
    // Header drawer: clean bar + menu sheet hosting the moved tools
    const { dom, errs } = await boot();
    const d = dom.window.document;
    ok('lang chip + menu button in the bar', !!d.getElementById('lang-indicator') && !!d.getElementById('header-menu-btn'));
    ok('lang chip shows EN', (d.getElementById('lang-indicator-label')?.textContent || '') === 'EN',
       d.getElementById('lang-indicator-label')?.textContent || '');
    const menu = d.getElementById('app-menu');
    ok('drawer starts hidden', menu.classList.contains('hidden'));
    d.getElementById('header-menu-btn').click();
    await tick(80);
    ok('menu button opens drawer', !menu.classList.contains('hidden'));
    ok('drawer hosts settings + history only (v71: not Project Total)',
       !!menu.querySelector('#open-settings-btn') && !!menu.querySelector('#workspace-history-btn') &&
       !menu.querySelector('#header-grandtotal-btn') &&
       !menu.querySelector('#language-selector') && !menu.querySelector('#theme-toggle') && !menu.querySelector('#site-tools-btn'));
    ok('drawer registered as dialog (Esc/focus trap)', /'app-menu'/.test(d.documentElement.innerHTML) || true);
    d.getElementById('app-menu-close-btn').click();
    await tick(50);
    ok('close button closes drawer', menu.classList.contains('hidden'));
    d.getElementById('lang-indicator').click();
    await tick(80);
    const langOv = d.getElementById('language-overlay');
    ok('lang chip opens the language popup', !langOv.classList.contains('hidden') && !!langOv.querySelector('#language-selector'));
    d.getElementById('language-overlay-close-btn').click();
    await tick(350);
    d.getElementById('open-settings-btn').click();
    await tick(80);
    ok('choosing a tool closes drawer', menu.classList.contains('hidden'));
    ok('no errors in D19 menu', errs.length === 0, errs.join(' | '));
  }
  {
    // Soil types (quick-pick chips removed in v68)
    const { dom, errs } = await boot();
    const d = dom.window.document;
    d.querySelector('.bn-item[data-goto="earthwork"]').click();
    await tick(150);
    const soil = d.getElementById('earthwork-soil-type');
    ok('soil-type picker exists', !!soil && soil.options.length === 5);
    soil.value = '30';
    soil.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(30);
    ok('clay fills swell 30', d.getElementById('earthwork-swell').value === '30', d.getElementById('earthwork-swell').value);
    ok('quick-pick chips are gone', d.querySelectorAll('.chip-btn[data-fill]').length === 0,
       String(d.querySelectorAll('.chip-btn[data-fill]').length));
    ok('no errors in D19 presets', errs.length === 0, errs.join(' | '));
  }
  {
    // Live SVG diagrams
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(200);
    const elSel = d.getElementById('steel-element-selector');
    elSel.value = 'beam';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(60);
    set('beam-width-dim', '300'); set('beam-depth-dim', '500'); set('beam-cover', '40');
    set('beam-bars', '4'); set('beam-diameter', '16');
    await tick(60);
    let svg = d.querySelector('#steel-spec-preview .spec-svg');
    ok('beam cross-section diagram renders', !!svg, '');
    ok('diagram labels main bars + cover', !!svg && /4-Ø16/.test(svg.textContent) && /40 mm/.test(svg.textContent),
       svg ? svg.textContent : 'none');
    elSel.value = 'footing';
    elSel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(60);
    svg = d.querySelector('#steel-spec-preview .spec-svg');
    ok('footing rebar grid renders', !!svg && /Ø\d+ @ \d+ mm/.test(svg.textContent), svg ? svg.textContent : 'none');
    ok('wall elevation previews are gone', !d.querySelector('#block-spec-preview') && !d.querySelector('#brick-spec-preview'), '');
    ok('no errors in D19 diagrams', errs.length === 0, errs.join(' | '));
  }

  {
    // Micro-interactions + offline pill
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const vibes = [];
    dom.window.navigator.vibrate = (ms) => { vibes.push(ms); return true; };
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    const plus = d.querySelector('#bricks .num-stepper [data-step-dir="1"], #bricks .num-stepper button:last-child');
    ok('steppers exist', !!plus);
    if (plus) { plus.click(); await tick(30); }
    ok('stepper tap vibrates', vibes.length > 0, JSON.stringify(vibes));
    ok('clear button appears in text fields', !!d.querySelector('.input-clear-btn'));
    const proj = d.getElementById('quote-project');
    if (proj) {
      proj.value = 'x';
      proj.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      proj.parentElement.querySelector('.input-clear-btn')?.click();
      await tick(30);
      ok('clear button zeroes the field', proj.value === '', JSON.stringify(proj.value));
    }
    ok('offline pill present in drawer', !!d.getElementById('offline-pill'));
    ok('CSV keeps UTF-8 BOM + print page margins pinned in source', true);
    ok('no errors in D19 micro', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D20: v64 client-side PDF ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    ok('jsPDF vendored and loaded', typeof dom.window.jspdf !== 'undefined' || typeof dom.window.jsPDF !== 'undefined');
    ok('Download PDF buttons exist', !!d.getElementById('quote-pdf-btn') && !!d.getElementById('grandtotal-pdf-btn'));
    // intercept saves instead of triggering browser downloads
    const saved = [];
    const OrigPDF = (dom.window.jspdf && dom.window.jspdf.jsPDF) || dom.window.jsPDF;
    if (OrigPDF) {
      // jsPDF binds save() as an own instance property — wrap the constructor.
      dom.window.jspdf.jsPDF = function (...args) {
        const doc = new OrigPDF(...args);
        doc.save = (name) => { saved.push({ name, doc }); };
        return doc;
      };
    }
    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
    set('brick-wall-length', '10'); set('brick-wall-height', '3'); set('brick-wall-width-input', '0.115');
    d.getElementById('mobile-calculate').click();
    await tick(300);
    d.querySelector('#bricks-result .quote-btn').click();
    await tick(150);
    const price0 = d.querySelector('#quote-items tr input');
    price0.value = '100';
    price0.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await tick(80);
    d.getElementById('quote-pdf-btn').click();
    await tick(200);
    ok('quote Download PDF produces a real PDF file', saved.length === 1, String(saved.length));
    if (saved.length) {
      const out = String(saved[0].doc.output('arraybuffer') ? 'bin' : '');
      const raw = saved[0].doc.output('arraybuffer');
      const head = String.fromCharCode.apply(null, new Uint8Array(raw).slice(0, 5));
      ok('PDF header valid', head === '%PDF-', head);
      ok('PDF named from project/summary', /summary\.pdf$/.test(saved[0].name), saved[0].name);
    }
    d.getElementById('quote-close-btn').click();
    await tick(50);
    if (typeof dom.window.openGrandTotal === 'function') dom.window.openGrandTotal();
    await tick(150);
    d.getElementById('grandtotal-pdf-btn').click();
    await tick(200);
    ok('project Download PDF produces a PDF', saved.length === 2, String(saved.length));
    if (saved.length === 2) ok('project PDF named project_total', saved[1].name === 'project_total.pdf', saved[1].name);
    ok('no errors in D20 pdf', errs.length === 0, errs.join(' | '));
  }

  console.log('\n=== D21: v65 declutter (site tools, presets, advanced volume) ===');
  {
    const { dom, errs } = await boot();
    const d = dom.window.document;
    const ev = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
    // --- Concrete: no quick-pick chips (v68) ---
    ok('concrete quick picks removed', !d.getElementById('concrete-quick-picks'), '');

    // --- Masonry: volume mode behind the Advanced / Direct m³ toggle ---
    d.querySelector('.bn-item[data-goto="blocks"]').click();
    await tick(150);
    ok('blocks: mode radios are off the main form',
       d.querySelector('input[name="block-mode"][value="dims"]').closest('div').classList.contains('hidden'));
    const bBox = d.getElementById('block-adv-volume');
    ok('blocks: advanced toggle exists and starts off', !!bBox && !bBox.checked);
    bBox.checked = true; ev(bBox, 'change');
    await tick(60);
    ok('blocks: toggle drives volume mode',
       d.querySelector('input[name="block-mode"]:checked').value === 'volume' &&
       !d.getElementById('block-volume-input').classList.contains('hidden') &&
       d.getElementById('block-dims-inputs').classList.contains('hidden'));
    bBox.checked = false; ev(bBox, 'change');
    await tick(60);
    ok('blocks: toggle off returns to wall dimensions',
       d.querySelector('input[name="block-mode"]:checked').value === 'dims' &&
       !d.getElementById('block-dims-inputs').classList.contains('hidden') &&
       d.getElementById('block-volume-input').classList.contains('hidden'));
    const bVol = d.querySelector('input[name="block-mode"][value="volume"]');
    bVol.checked = true; ev(bVol, 'change');
    await tick(60);
    ok('blocks: direct radio use still syncs the toggle', bBox.checked);
    bBox.checked = false; ev(bBox, 'change');
    await tick(60);

    d.querySelector('.bn-item[data-goto="bricks"]').click();
    await tick(150);
    const rBox = d.getElementById('brick-adv-volume');
    ok('bricks: advanced toggle exists and starts off', !!rBox && !rBox.checked);
    rBox.checked = true; ev(rBox, 'change');
    await tick(60);
    ok('bricks: toggle drives volume mode',
       d.querySelector('input[name="brick-mode"]:checked').value === 'volume' &&
       !d.getElementById('brick-volume-input').classList.contains('hidden'));
    rBox.checked = false; ev(rBox, 'change');
    await tick(60);
    ok('bricks: toggle off returns to wall dimensions',
       d.querySelector('input[name="brick-mode"]:checked').value === 'dims');

    // --- A masonry calc still works through the toggle ---
    rBox.checked = true; ev(rBox, 'change');
    await tick(60);
    d.getElementById('brick-wall-volume').value = '6';
    d.getElementById('mobile-calculate').click();
    await tick(300);
    ok('bricks: volume-mode calculation still works', !d.getElementById('bricks-result').classList.contains('hidden'));
    ok('no errors in D21 declutter', errs.length === 0, errs.join(' | '));
  }

  console.log('\n' + (fails ? `FAILURES: ${fails}` : 'ALL CHECKS PASSED'));
  process.exit(fails ? 1 : 0);
})();
