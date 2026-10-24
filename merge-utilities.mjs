// Merge freshly generated Tailwind utilities into new-style.css between the
// marker comments (the stylesheet of record), then delete the temp file.
// Embedding into index.html is done by scripts/embed-css.mjs.
import fs from 'node:fs';
const tmp = '.tailwind-out.css';
const target = 'new-style.css';
const start = '/* === TAILWIND-UTILITIES-START === */';
const end = '/* === TAILWIND-UTILITIES-END === */';
const css = fs.readFileSync(target, 'utf8');
const generated = fs.readFileSync(tmp, 'utf8').trim();
const before = css.indexOf(start), after = css.indexOf(end);
if (before < 0 || after < before) throw new Error('Utilities markers missing from new-style.css');
if (!generated) throw new Error('Generated utilities are empty — refusing to clobber ' + target);
fs.writeFileSync(target, `${start}\n${generated}\n` + css.slice(after));
fs.unlinkSync(tmp);
console.log(`Merged ${generated.length} characters of Tailwind utilities into ${target}`);
