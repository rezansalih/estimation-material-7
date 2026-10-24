
const { JSDOM, VirtualConsole } = require('jsdom');
const tick = ms => new Promise(r => setTimeout(r, ms));
process.on('uncaughtException', (e) => { if (/_location/.test(String(e && e.message))) return; throw e; });
(async () => {
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', e => errs.push(String(e.message).split('\n')[0]));
  const dom = await JSDOM.fromURL('http://localhost:8000/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
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
      win.scrollTo = () => {}; win.Element.prototype.scrollIntoView = () => {}; win.confirm = () => true;
      win.localStorage.setItem('language', 'en'); win.localStorage.setItem('introSeen', '1');
    },
  });
  await tick(1500);
  const w = dom.window; const d = w.document;
  const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  d.querySelector('.bn-item[data-goto="blocks"]').click(); await tick(150);
  const bDims = d.querySelector('input[name="block-mode"][value="dims"]');
  bDims.checked = true; bDims.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(30);
  set('block-wall-length', '10'); set('block-wall-height', '3'); set('block-wall-width-input', '0.2');
  const tagSel = d.getElementById('block-tag');
  tagSel.value = 'substructure'; tagSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  d.getElementById('mobile-calculate').click(); await tick(400);
  console.log('TAG VALUE AT CALC:', tagSel.value);
  console.log('BLOCKS TABLE HTML:', JSON.stringify(d.querySelector('#blocks-table-body').innerHTML.slice(0, 300)));
  console.log('BLOCKS RESULT HAS BADGE TEXT?', /Substructure/.test(d.getElementById('blocks-result').textContent));
  d.querySelector('.bn-item[data-goto="bricks"]').click(); await tick(150);
  console.log('BRICK MODE default:', d.querySelector('input[name="brick-mode"]:checked')?.value);
  set('brick-wall-length', '10'); set('brick-wall-height', '3'); set('brick-wall-width-input', '0.115');
  const tagSel2 = d.getElementById('brick-tag');
  tagSel2.value = 'ground'; tagSel2.dispatchEvent(new w.Event('change', { bubbles: true }));
  d.getElementById('mobile-calculate').click(); await tick(400);
  console.log('BRICKS TABLE LEN:', d.querySelector('#bricks-table-body').querySelectorAll('tr').length);
  console.log('BRICKS RESULT snippet:', d.getElementById('bricks-result').textContent.replace(/\s+/g, ' ').slice(0, 120));
  console.log('ERRS:', errs.slice(0, 3));
  dom.window.close(); process.exit(0);
})();
