// WCAG contrast of every text pair in static/site/styles.json ("contrast": [fg, bg, minimum, "over bg"?]).
// A translucent ground is first composited over the style's page background ("over bg").
//   node tools/site/contrast.mjs          exit 1 when a pair is below its minimum
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHex } from '../../static/site/lerp.js';

const file = fileURLToPath(new URL('../../static/site/styles.json', import.meta.url));
const { styles, contrast } = JSON.parse(readFileSync(file, 'utf8'));

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const lin = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (top, base) => top.slice(0, 3).map((c, i) => c * top[3] + base[i] * (1 - top[3])).concat(1);

export function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let failed = 0;
for (const [id, style] of Object.entries(styles)) {
  const page = parseHex(style.colors.bg);
  for (const [fgPath, bgPath, min, mode] of contrast) {
    let bg = parseHex(get(style, bgPath));
    if (mode === 'over bg' || bg[3] < 1) bg = over(bg, page);
    const fg = over(parseHex(get(style, fgPath)), bg);
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(7)} ${fgPath.padEnd(13)} on ${bgPath.padEnd(10)} ${r.toFixed(2).padStart(6)} (min ${min})`);
  }
}
if (failed) {
  console.log(`${failed} pair(s) below the minimum`);
  process.exitCode = 1;
}
