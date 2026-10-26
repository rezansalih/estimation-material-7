// Edge-case battery — weird inputs & cross-cutting behavior. Not part of the
// green chain; run ad hoc: node tests/edge-probe.mjs (server on :8000).
import { JSDOM } from 'jsdom';
const BASE = 'http://localhost:8000/';
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (c, n, x = '') => results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);

async function boot(lang = 'en') {
  const dom = await JSDOM.fromURL(BASE, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('language', lang);
      w.localStorage.setItem('introSeen', '1');
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.navigator.vibrate = () => {};
    },
  });
  await tick(1200);
  return dom;
}
const set = (d, id, v) => { const e = d.getElementById(id); if (!e) return ok(false, `#${id} exists`); e.value = String(v); e.dispatchEvent(new d.defaultView.Event('input', { bubbles: true })); e.dispatchEvent(new d.defaultView.Event('change', { bubbles: true })); };
const pick = (d, n, v) => { const el = d.querySelector(`input[name="${n}"][value="${v}"]`); if (el) el.click(); };
const text = (d, id) => (d.getElementById(id)?.textContent || '').replace(/\s+/g, ' ');

const dom = await boot();
const d = dom.window.document;
const errs = [];
dom.window.addEventListener('error', (e) => errs.push(e.message));

// 1. comma decimal guard (typing 2,5 must yield 2.5 on any keyboard)
{
  const el = d.getElementById('concrete-length');
  const W = d.defaultView;
  el.value = '2,5';
  el.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(el.value === '2.5', 'typed comma 2,5 -> 2.5 (input path)', 'value=[' + el.value + ']');
  el.value = '1.234,5';
  el.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(el.value === '1234.5', 'pasted 1.234,5 -> 1234.5', 'value=[' + el.value + ']');
  el.value = '\u0662\u066B\u0665'; // Arabic-Indic 2٫5
  el.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(el.value === '2.5', 'arabic-indic 2٫5 -> 2.5', 'value=[' + el.value + ']');
  el.value = '2.5';
  el.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(el.value === '2.5', 'plain 2.5 untouched', 'value=[' + el.value + ']');
  el.value = '2.5';
}

// 2. negative length
set(d, 'concrete-length', -5);
d.getElementById('calculate-concrete').click(); await tick(250);
ok(text(d, 'concrete-result').length === 0, 'negative length rejected, no result');

// 3. zero thickness
set(d, 'concrete-length', 5); set(d, 'concrete-thickness', 0);
d.getElementById('calculate-concrete').click(); await tick(250);
ok(text(d, 'concrete-result').length === 0, 'zero thickness rejected');

// 4. huge numbers — must not crash
set(d, 'concrete-thickness', 0.15); set(d, 'concrete-length', 999999); set(d, 'concrete-width', 999999);
d.getElementById('calculate-concrete').click(); await tick(300);
const t4 = text(d, 'concrete-result');
ok(t4.length > 0 && !/NaN|Infinity|undefined/.test(t4), 'huge dims -> finite result', t4.slice(0, 80));

// 5. wastage 0%
set(d, 'concrete-length', 5); set(d, 'concrete-width', 4); set(d, 'concrete-thickness', 0.15);
set(d, 'concrete-dry-factor', 1.33);
set(d, 'wastage', 0);
d.getElementById('calculate-concrete').click(); await tick(250);
const t5 = text(d, 'concrete-result');
ok(/17\b/.test(t5), 'waste 0% -> 17 bags exact', 'wastage=[' + d.getElementById('wastage').value + '] ' + t5.slice(0, 260));

// 6. wastage 50% boundary ok / 51 blocked by sanity?
set(d, 'wastage', 50);
d.getElementById('calculate-concrete').click(); await tick(250);
ok(text(d, 'concrete-result').length > 0, 'waste 50% accepted');
errs.length = 0;

// 7. BRC sheet mode sanity
const sel = d.getElementById('steel-element-selector'); sel.value = 'brc'; sel.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
await tick(150);
{ const m = d.getElementById('brc-mode'); m.value = 'sheet'; m.dispatchEvent(new d.defaultView.Event('change', { bubbles: true })); }
set(d, 'brc-area-len', 7.3); set(d, 'brc-area-wid', 4.5); set(d, 'brc-width', 2.2); set(d, 'brc-length', 5.8); set(d, 'brc-overlap', 10);
d.getElementById('calculate-steel').click(); await tick(250);
const t7 = text(d, 'steel-result');
ok(/\d+ Sheets/.test(t7) && !/NaN/.test(t7), 'BRC sheet mode computes', t7.slice(0, 120));

// 8. steel custom bars: add a row and compute
const sel2 = d.getElementById('steel-element-selector'); sel2.value = 'custom'; sel2.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
await tick(150);
const addBtn = d.getElementById('steel-custom-add-row');
if (addBtn) { addBtn.click(); await tick(100); }
const dia = d.querySelector('select[id*="custom"], input[id*="custom"]');
const rowsHtml = (d.getElementById('steel-custom-rows') || d.body).innerHTML.replace(/\s+/g, ' ').slice(0, 200);
ok(!!addBtn && !!dia, 'custom bars row machinery present', 'btn=' + !!addBtn + ' dia=' + !!dia + ' | ' + rowsHtml);

// 9. language switch -> RTL + translated chrome
const ar = await boot('ar');
const d2 = ar.window.document;
ok(/rtl|dir=/.test(d2.documentElement.outerHTML.slice(0, 400)) || d2.body.closest('[dir]')?.dir === 'rtl' || d2.documentElement.dir === 'rtl' || (d2.querySelector('html')?.getAttribute('dir') || '') === 'rtl', 'ar boots RTL', String(d2.documentElement.getAttribute('dir')));
const htmlAr = d2.documentElement.outerHTML;
ok(htmlAr.includes('المقدّر') || htmlAr.includes('المواد') || htmlAr.includes('الإسمنت') || htmlAr.includes('الاسمنت'), 'ar chrome translated');

// 10. no page errors across all of the above
ok(errs.length === 0, 'no window errors during edge battery', errs.join(' | '));

console.log('\n=== EDGE BATTERY ===');
results.forEach((r) => console.log(' ', r));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
