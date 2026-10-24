const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const tick = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const vc = new VirtualConsole();
  const errs = [];
  vc.on('jsdomError', e => errs.push(String(e.message).split('\n')[0]));
  const dom = await JSDOM.fromURL('http://localhost:8000/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.Element.prototype.scrollIntoView = () => {};
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.confirm = () => true; w.open = () => null; w.scrollTo = () => {};
    }
  });
  await tick(700);
  const d = dom.window.document;
  try {
    d.querySelector('.bn-item[data-goto="steel"]').click();
    await tick(150);
    const sel = d.getElementById('steel-element-selector');
    sel.value = 'footing';
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick(50);
    const set = (id, v) => { d.getElementById(id).value = String(v); };
    set('footing-length', 3); set('footing-width', 2);
    set('footing-spacing-len', 150); set('footing-diameter-len', 12);
    set('footing-spacing-wid', 150); set('footing-diameter-wid', 10);
    d.getElementById('mobile-calculate').click();
    await tick(350);
    const res = d.getElementById('steel-result');
    console.log('--- result items ---');
    res.querySelectorAll('.result-item').forEach(it => {
      console.log(`[${it.getAttribute('data-kind')}] vis=${it.style.display !== 'none'} :: ${it.textContent.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    });
    const more = res.querySelector('details.result-more');
    console.log('--- result-more ---');
    console.log(more ? more.innerHTML.replace(/\s+/g, ' ') : 'NONE');
    console.log('errs:', errs);
  } catch (e) { console.log('CAUGHT:', e.stack.split('\n').slice(0, 3).join(' | ')); }
  dom.window.close();
})();
