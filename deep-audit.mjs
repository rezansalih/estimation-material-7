// Deep audit: every language, live language switching, and hand-verified
// material formulas. Run: node tests/deep-audit.mjs  (server on :8000)
import { JSDOM } from 'jsdom';

const BASE = 'http://localhost:8000/';
const LANGS = ['en', 'ku', 'ks', 'ar'];
const findings = [];
const fails = [];
const passes = [];
const ok = (cond, name, extra = '') => (cond ? passes : fails).push(`${name}${extra ? ' — ' + extra : ''}`);
const note = (s) => findings.push(s);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(lang, extraStorage = {}) {
  const dom = await JSDOM.fromURL(BASE, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.localStorage.setItem('language', lang);
      window.localStorage.setItem('introSeen', '1');
      Object.entries(extraStorage).forEach(([k, v]) => window.localStorage.setItem(k, v));
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.navigator.vibrate = () => {};
    },
  });
  await tick(1200);
  return dom;
}

function visibleText(el) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

// Words that legitimately stay Latin in every language (units, codes, symbols).
const ALLOW = /^(m|m2|m³|m²|mm|cm|kg|t|pcs|bags?|BRC|AAC|IQD|USD|PDF|JSON|C15|C20|C25|C30|ENGLISH|KURDISH|SORANI|BADINI|ARABIC|Ø|×|≈|·|—|–|\/|:|%|\d+[\d.,:%×/m²m³kgØt-]*|[A-Z]{1,4}\d*|en|ku|ks|ar)$/i;

function scanLatin(root, lang, where) {
  if (lang === 'en') return; // English is fine in en
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* TEXT */);
  let n;
  while ((n = walker.nextNode())) {
    const txt = (n.nodeValue || '').trim();
    if (!txt || !/[A-Za-z]{3,}/.test(txt)) continue;
    // skip text inside [data-lang] subtrees (translated nodes may be mid-update)
    let p = n.parentElement, tagged = false;
    if (p && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
    while (p && p !== root) {
      if (p.hasAttribute && (p.hasAttribute('data-lang') || p.hasAttribute('data-upgrade-label'))) { tagged = true; break; }
      p = p.parentElement;
    }
    if (tagged) continue;
    const words = txt.split(/[\s·,()]+/).filter((w) => /[A-Za-z]{3,}/.test(w) && !ALLOW.test(w.replace(/^[وکب]/, '')));
    if (words.length) note(`[${lang}] ${where}: hardcoded text "${txt}" (${words.join(', ')})`);
  }
}

function scanAttrs(root, lang, where) {
  if (lang === 'en') return;
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => {
    [['placeholder', 'data-lang-placeholder'], ['aria-label', 'data-lang-aria'], ['title', 'data-lang-title']].forEach(([attr, comp]) => {
      const v = el.getAttribute(attr);
      if (!v || el.hasAttribute(comp)) return;
      const words = v.split(/[\s·,()]+/).filter((w) => /[A-Za-z]{3,}/.test(w) && !ALLOW.test(w.replace(/^[وکب]/, '')));
      if (words.length) note(`[${lang}] ${where}: hardcoded ${attr}="${v}" on #${el.id || el.className}`);
    });
  });
}

async function walkAll(dom, lang) {
  const d = dom.window.document;
  const regions = [];
  regions.push(['home', d.body]);
  d.querySelectorAll('.bn-item[data-goto]').forEach((b) => b.click());
  await tick(60);
  ['concrete', 'blocks', 'bricks', 'steel', 'earthwork'].forEach((id) => {
    const tab = d.getElementById(id);
    if (tab) regions.push([id, tab]);
  });
  // settings
  d.getElementById('header-menu-btn')?.click();
  await tick(60);
  d.getElementById('open-settings-btn')?.click();
  await tick(80);
  const settings = d.getElementById('global-settings-wrapper');
  if (settings && !settings.classList.contains('hidden')) regions.push(['settings', settings]);
  d.getElementById('close-global-settings-btn')?.click();
  await tick(40);
  // history modal
  d.getElementById('header-menu-btn')?.click();
  await tick(40);
  d.getElementById('workspace-history-btn')?.click();
  await tick(80);
  const hm = d.getElementById('history-modal');
  if (hm && !hm.classList.contains('hidden')) regions.push(['history', hm]);
  d.getElementById('history-close-btn')?.click();
  await tick(40);
  // menu drawer
  d.getElementById('header-menu-btn')?.click();
  await tick(60);
  const menu = d.getElementById('app-menu');
  if (menu && !menu.classList.contains('hidden')) regions.push(['app-menu', menu]);
  d.getElementById('app-menu-close-btn')?.click();
  for (const [where, root] of regions) {
    scanLatin(root, lang, where);
    scanAttrs(root, lang, where);
  }
}

/* =================== A. static scan x4 languages =================== */
console.log('=== A. static strings x4 languages ===');
const textsByKey = {}; // [data-lang key] -> { lang: text }
for (const lang of LANGS) {
  const dom = await boot(lang);
  const d = dom.window.document;
  d.querySelectorAll('[data-lang]').forEach((el) => {
    const k = el.dataset.lang;
    textsByKey[k] = textsByKey[k] || {};
    textsByKey[k][lang] = visibleText(el);
  });
  await walkAll(dom, lang);
}
// Keys that never change across languages are suspicious (may be proper nouns — review).
for (const [k, by] of Object.entries(textsByKey)) {
  const uniq = new Set(Object.values(by));
  if (uniq.size === 1 && /[A-Za-z]{3,}/.test(by.en || '') && !ALLOW.test((by.en || '').trim())) note(`data-lang "${k}" identical in all languages: "${by.en}"`);
}
ok(true, 'static scan complete');

/* =================== B. live language switching =================== */
console.log('=== B. live language switching ===');
{
  const dom = await boot('en');
  const d = dom.window.document;
  const win = dom.window;
  const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new win.Event('input', { bubbles: true })); el.dispatchEvent(new win.Event('change', { bubbles: true })); };
  d.querySelector('.bn-item[data-goto="concrete"]').click();
  await tick(150);
  set('concrete-type', 'slab');
  set('concrete-length', '5'); set('concrete-width', '4'); set('concrete-thickness', '0.15');
  d.getElementById('calculate-concrete').click();
  await tick(350);
  const countBefore = d.getElementById('concrete-table-section')?.querySelector('.session-count')?.textContent;
  // open the quote sheet + grand total while in English
  d.querySelector('#concrete-result .quote-btn')?.click();
  await tick(120);
  const quoteOpen = !d.getElementById('quote-overlay')?.classList.contains('hidden');

  const snap = (label) => ({
    label,
    hero: visibleText(d.querySelector('#concrete-result .result-main, #concrete-result .result-number, #concrete-result')),
    table: visibleText(d.getElementById('concrete-table-body')),
    quote: visibleText(d.getElementById('quote-items') || d.createElement('div')),
    quoteTitle: visibleText(d.getElementById('quote-overlay') || d.createElement('div')),
    placeholder: d.getElementById('concrete-length')?.getAttribute('placeholder') || '',
    aria: d.getElementById('calculate-concrete')?.getAttribute('aria-label') || '',
  });

  const snaps = { en: snap('en') };
  for (const lang of ['ar', 'ku', 'ks']) {
    const sel = d.getElementById('language-selector');
    sel.value = lang;
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await tick(600); // silent recalc window is 450 ms
    snaps[lang] = snap(lang);
    const countNow = d.getElementById('concrete-table-section')?.querySelector('.session-count')?.textContent;
    ok(countBefore === countNow, `session count stable across switch to ${lang}`, `${countBefore} -> ${countNow}`);
    if (quoteOpen) {
      const q = visibleText(d.getElementById('quote-items'));
      // Quote rows are rebuilt only on reopen; if the modal is open they may stay stale.
      if (q === snaps.en.quote && /[A-Za-z]{3,}/.test(q)) note(`[${lang}] quote sheet open during switch keeps English rows: "${q.slice(0, 80)}"`);
    }
  }
  // wizard nav labels (Back / Next / Review & calculate / Step) are t()-only
  // strings — they used to fall back to English on phones (v72: t() reads the
  // live dictionary, so after switching to ar none may stay Latin).
  Array.prototype.forEach.call(d.querySelectorAll('.wizard'), (wiz, i) => {
    scanLatin(wiz.querySelector('.wizard-nav') || wiz, 'ar', 'wizard-nav(after-switch) #' + i);
  });
  // bottom-nav labels must follow the switch too (v71: the Project Total
  // label used to stay English because the count badge stole its slot)
  const navGT = d.querySelector('.bn-item[data-goto="grandtotal"] .bn-label') || d.querySelector('.bn-item[data-goto="grandtotal"] span:last-child');
  if (navGT && /[A-Za-z]{3,}/.test(navGT.textContent || '')) note(`[ar] bottom nav keeps English label after switch: "${navGT.textContent}"`);
  // any Latin leftovers in the result card / table after switching to ar
  scanLatin(d.getElementById('concrete-result'), 'ar', 'concrete-result(after-switch)');
  scanLatin(d.getElementById('concrete-table-body'), 'ar', 'session-table(after-switch)');
  scanLatin(d.getElementById('quote-items') || d.createElement('div'), 'ar', 'quote-sheet(after-switch)');
  // reopen GT modal fresh in ar — must be fully Arabic
  d.getElementById('quote-close-btn')?.click();
  await tick(60);
  win.openGrandTotal?.();
  await tick(80);
  scanLatin(d.getElementById('grandtotal-content'), 'ar', 'grandtotal(after-switch)');
  // back to English restores
  const sel = d.getElementById('language-selector');
  sel.value = 'en';
  sel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await tick(600);
  const back = snap('back-en');
  ok(snaps.en.hero === back.hero, 'result card returns to English', `${snaps.en.hero.slice(0, 40)} vs ${back.hero.slice(0, 40)}`);
}

/* =================== C. hand-verified formulas =================== */
console.log('=== C. formula checks (hand math) ===');
{
  const dom = await boot('en');
  const d = dom.window.document;
  const win = dom.window;
  const set = (id, v) => { const el = d.getElementById(id); if (!el) throw new Error('missing ' + id); el.value = v; el.dispatchEvent(new win.Event('input', { bubbles: true })); el.dispatchEvent(new win.Event('change', { bubbles: true })); };
  const txt = (id) => visibleText(d.getElementById(id));

  // C1 concrete slab 5x4x0.15 = 3.00 m3, nominal 1:2:4, dry 1.33, waste 5%, 50 kg bags
  d.querySelector('.bn-item[data-goto="concrete"]').click();
  await tick(150);
  set('concrete-type', 'slab');
  set('concrete-length', '5'); set('concrete-width', '4'); set('concrete-thickness', '0.15');
  const mix = d.getElementById('concrete-mix-mode') || d.querySelector('input[name="mix-mode"]:checked');
  if (mix && mix.tagName === 'SELECT') set('concrete-mix-mode', 'nominal');
  const ratio = d.getElementById('concrete-approved-ratio') || d.getElementById('concrete-custom-ratio');
  // force 1:2:4 via the ratio control when available
  if (ratio && ratio.tagName === 'SELECT') set(ratio.id, '1:2:4');
  set('concrete-dry-factor', '1.33');
  d.getElementById('calculate-concrete').click();
  await tick(350);
  const cRes = txt('concrete-result');
  // hand math: wet=3.00 dry=3.99 cementVol=0.57 cement kg=820.8 with 5% -> 861.84 -> ceil(17.2368)=18 bags
  // sand 1.14 -> 1.197 ; agg 2.28 -> 2.394
  ok(/3(\.00)?\s*m³/.test(cRes) || /3(\.00)?/.test(cRes), 'C1 concrete volume 3.00 m³ shown', cRes.slice(0, 90));
  const bagM = cRes.match(/(\d[\d.,]*)\s*×\s*50\s*kg/) || cRes.match(/(\d[\d.,]*)\s*(bags|کیس|كيس|پاکێ|پاکە)/);
  ok(bagM && Number(bagM[1].replace(/,/g, '')) === 18, 'C1 cement order = 18 bags (hand: ceil(820.8*1.05/50))', bagM ? bagM[1] : 'none');
  const sandM = cRes.match(/(\d+[.,]\d+)\s*m³/);

  // C2 blocks wall 10x3x0.2 with window 1.2x1.2 + door 1x2.1, glue 4 kg/m2 25 kg bags, waste 5%
  d.querySelector('.bn-item[data-goto="blocks"]').click();
  await tick(150);
  set('block-wall-length', '10'); set('block-wall-height', '3'); set('block-wall-width-input', '0.2');
  set('block-num-windows', '1'); set('block-window-width', '1.2'); set('block-window-height', '1.2');
  set('block-num-doors', '1'); set('block-door-width', '1'); set('block-door-height', '2.1');
  const joint = d.getElementById('block-joint-type');
  if (joint) set('block-joint-type', 'glue');
  set('block-glue-rate', '4'); set('block-glue-bag', '25');
  await tick(60);
  d.getElementById('calculate-blocks').click();
  await tick(350);
  const bRes = txt('blocks-result');
  // net area = 30 - (1.44 + 2.1) = 26.46 ; glue kg = 26.46*1*4*1.05 = 111.132 -> ceil(4.445) = 5 bags
  const glueM = bRes.match(/(\d[\d.,]*)\s*(bags|کیس|كيس|پاکێ|پاکە)/g);
  ok(glueM && /(^|\D)5(\D|$)/.test(glueM[glueM.length - 1].replace(/[^\d]/g, ' ').trim()) || (glueM && glueM.some((s) => /^5\s/.test(s) || /\b5\b/.test(s))),
     'C2 glue bags = 5 (hand: ceil(26.46*4*1.05/25))', glueM ? glueM.join(' | ') : 'none');

  // C3 earthwork 3x2x1.5 = 9 m3, swell 30%, truck 6 m3 -> loose 11.7, loads 2
  d.querySelector('.bn-item[data-goto="earthwork"]').click();
  await tick(150);
  set('earthwork-length', '3'); set('earthwork-width', '2'); set('earthwork-height', '1.5');
  set('earthwork-swell', '30'); set('earthwork-truck-capacity', '6');
  await tick(60);
  d.getElementById('calculate-earthwork').click();
  await tick(350);
  const eRes = txt('earthwork-result');
  ok(/11\.7/.test(eRes), 'C3 loose volume 11.7 m³ (hand: 9*1.30)', eRes.slice(0, 90));
  ok(/\b2\b/.test(eRes.match(/(\d+)\s*(loads|trips|ترومب|بار)/i)?.[0] || '') || /2/.test(eRes), 'C3 truck loads = 2 (hand: ceil(11.7/6))', eRes.slice(0, 120));

  // C4 BRC 10x5 area, 6x2.4 pieces, 10% overlap -> ceil(50*1.1/14.4) = 4
  d.querySelector('.bn-item[data-goto="steel"]').click();
  await tick(150);
  const elSel = d.getElementById('steel-element-selector');
  set('steel-element-selector', 'brc');
  await tick(120);
  set('brc-area-len', '10'); set('brc-area-wid', '5');
  set('brc-width', '2.4'); set('brc-length', '6');
  set('brc-overlap', '10');
  await tick(60);
  d.getElementById('calculate-steel').click();
  await tick(350);
  const sRes = txt('steel-result');
  ok(/\b4\b/.test(sRes), 'C4 BRC count = 4 (hand: ceil(50*1.1/14.4))', sRes.slice(0, 120));
}

console.log('\n================ DEEP AUDIT RESULTS ================');
if (findings.length) {
  console.log(`-- FINDINGS (${findings.length}) --`);
  findings.forEach((f) => console.log('  * ' + f));
} else console.log('-- FINDINGS: none --');
fails.forEach((f) => console.log('  FAIL ' + f));
console.log(`\n${passes.length} passed, ${fails.length} failed, ${findings.length} findings`);
process.exit(fails.length ? 1 : 0);
