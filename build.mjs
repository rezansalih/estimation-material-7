// Build: minify src/*.src.js and merge them into ONE shipped app.js, in the
// same order the page used to load them (concrete-calculations -> app ->
// app-ui -> calculator chunks). Identifiers are NOT mangled, so the
// translation tables and handler names the tests audit stay readable.
import { minify } from 'terser';
import fs from 'node:fs';

const BANNER = '/* AUTO-GENERATED - DO NOT EDIT DIRECTLY. Edit src/*.src.js and run npm run build */';

const jobs = [
  ['src/concrete-calculations.src.js', 'concrete-calculations'],
  ['src/app.src.js', 'app'],
  ['src/app-ui.src.js', 'app-ui'],
  ['src/calc-concrete.src.js', 'calc-concrete'],
  ['src/calc-blocks.src.js', 'calc-blocks'],
  ['src/calc-bricks.src.js', 'calc-bricks'],
  ['src/calc-steel.src.js', 'calc-steel'],
  ['src/calc-earthwork.src.js', 'calc-earthwork'],
];
const parts = [];
for (const [src, name] of jobs) {
  const code = fs.readFileSync(src, 'utf8');
  const res = await minify(code, { compress: true, mangle: { reserved: ['translations'] }, format: { comments: false } });
  if (res.error) throw res.error;
  parts.push(`/* --- ${name} --- */\n${res.code}`);
  console.log(`${name.padEnd(28)} ${String(code.length).padStart(7)} -> ${String(res.code.length).padStart(7)} bytes`);
}
fs.writeFileSync('app.js', BANNER + '\n' + parts.join('\n;\n') + '\n');
console.log(`app.js (merged)         ${String(parts.join('\n;\n').length).padStart(7)} bytes total`);
