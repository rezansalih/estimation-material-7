import { JSDOM } from 'jsdom';
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const dom = await JSDOM.fromURL('http://localhost:8000/', {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('language', 'en'); w.localStorage.setItem('introSeen', '1');
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.navigator.vibrate = () => {};
  },
});
await tick(1200);
const d = dom.window.document;
const set = (id, v) => { const e = d.getElementById(id); e.value = String(v); e.dispatchEvent(new dom.window.Event('input', { bubbles: true })); e.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
const sel = d.getElementById('steel-element-selector');
sel.value = 'footing'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
await tick(100);
set('footing-length', 3); set('footing-width', 2);
set('footing-spacing-len', 150); set('footing-diameter-len', 12);
set('footing-spacing-wid', 150); set('footing-diameter-wid', 10);
set('steel-member-quantity', 1);
console.log('cover value =', d.getElementById('footing-cover')?.value);
console.log('wastage =', d.getElementById('wastage')?.value);
(d.getElementById('calculate-steel') || d.getElementById('mobile-calculate')).click();
await tick(300);
const t = d.getElementById('steel-result').textContent.replace(/\s+/g, ' ');
console.log('result:', t.slice(0, 260));
const wpm = (x) => x * x / 162;
const runLen = 3 - 0.08, runWid = 2 - 0.08;
console.log('hand:', (15 * runLen * wpm(12) + 21 * runWid * wpm(10)) * 1.05);
