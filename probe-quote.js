
const { JSDOM, VirtualConsole } = require('jsdom');
const tick = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', e => errs.push(String(e.message).split('\n')[0]));
  const dom = await JSDOM.fromURL('http://localhost:8000/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
      win.scrollTo = () => {}; win.Element.prototype.scrollIntoView = () => {};
      win.confirm = () => true;
      win.localStorage.setItem('language', 'en');
      win.localStorage.setItem('introSeen', '1');
    },
  });
  await tick(1200);
  const w = dom.window; const d = w.document;
  d.querySelector('.bn-item[data-goto="bricks"]').click();
  await tick(200);
  d.getElementById('brick-wall-length').value = '10';
  d.getElementById('brick-wall-height').value = '3';
  d.getElementById('brick-wall-width-input').value = '0.115';
  d.getElementById('mobile-calculate').click();
  await tick(300);
  d.querySelector('#bricks-result .quote-btn').click();
  await tick(150);
  const ov = d.getElementById('quote-overlay');
  console.log('ERRS:', errs);
  console.log('ROWS:', [...ov.querySelectorAll('#quote-items tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()));
  const price0 = ov.querySelector('#quote-items tr input');
  console.log('PRICE0:', price0 && price0.value, '| input count:', ov.querySelectorAll('#quote-items tr input').length);
  price0.value = '100';
  price0.dispatchEvent(new w.Event('input', { bubbles: true }));
  await tick(80);
  console.log('AFTER:', [...ov.querySelectorAll('#quote-items tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()));
  console.log('TOTAL:', d.getElementById('quote-total').textContent);
  console.log('OVTEXT has 148,300?', /148,300/.test(ov.textContent), '| has 148,300.00?', /148,300\.00/.test(ov.textContent));
  w.print = () => {};
  d.getElementById('quote-close-btn').click();
  await tick(50);
  d.querySelector('#bricks-result .export-btn').click();
  await tick(150);
  const pa = d.getElementById('print-area');
  console.log('PA has 148,300?', /148,300/.test(pa.innerHTML));
  console.log('PA has Test Villa?', /Test Villa/.test(pa.innerHTML), '| Ahmed?', /Mr\. Ahmed/.test(pa.innerHTML));
  console.log('PA summary snippet:', (pa.querySelector('.print-summary-sheet')?.textContent || 'NO SHEET').replace(/\s+/g, ' ').slice(0, 400));
  dom.window.close(); process.exit(0);
})();
