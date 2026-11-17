// Photography → Chess hands over to the tile's own board: the board the transition cures in place must be the
// board the band then draws. Seeks the seam to moments near its end, photographs each, and compares the
// board's box in each with the settled band's (P 1.2, the band let go): the mean difference (0 … 255) and the
// share of pixels off by more than 24. The last held moment (P 1.16) must be close (the band's words are
// still coming into focus round it, and at 1.2 its game has begun, so not 0).
//   node tools/site/handoff_check.mjs [--size 1440x900@2] [--base URL]
// The photographs go to scene-shots/handoff (served from the repo, for the comparison in the page). Exits 1
// when P 1.16 is off by a mean of more than 12. Needs the site served.
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { launch, parseSize } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  size: { type: 'string', default: '1440x900@2' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
} });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = 'scene-shots/handoff', AT = [0.9, 1.0, 1.06, 1.12, 1.16, 1.2], LIMIT = 12;
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch({ preset: 'gpu' });
try {
  const size = parseSize(o.size), dpr = size.deviceScaleFactor;
  const page = await browser.newPage(size);
  await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitFor(() => /\bgl\b/.test(document.documentElement.className), { timeout: 20000 });
  await page.waitFor(async () => (await import('/static/site/scene/scene.js')).getScene()?.inkReady?.(), { timeout: 60000 });
  await page.eval(async () => {
    const L = await import('/static/site/lerp.js');
    window.__seek = P => {
      const el = document.querySelector('.seam-hold[data-to="ink"]'), wrap = el.parentElement.classList.contains('seam-wrap') ? el.parentElement : null;
      const band = wrap?.querySelector('.band'), shift = band ? parseFloat(band.style.getPropertyValue('--held-shift')) || 0 : 0, vh = innerHeight;
      const hold = L.holdFor('ink', matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? L.HOLD.pinTouch : L.HOLD.pin), ease = L.easeFor('ink');
      const T = (wrap || el).getBoundingClientRect().top + scrollY, R = wrap ? el.offsetHeight + shift : Math.max(1, el.offsetHeight - vh);
      const a = hold.leadIn * vh, b = hold.leadOut * vh;
      let lo = 0, hi = 1;
      for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (L.transitP(ease(m)) < P) lo = m; else hi = m; }
      scrollTo({ top: T - a + lo * (R + a + b), behavior: 'instant' });
    };
  });
  const rects = {};
  for (const P of AT) {
    await page.eval(P => window.__seek(P), P);
    await sleep(2500);
    rects[P] = await page.eval(() => { const r = document.querySelector('.band[data-style="ink"] .pv-board-wrap').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
    await page.screenshot(`${OUT}/P${P}.png`);
  }
  const res = await page.eval(async (rects, dpr, out) => {
    const load = u => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
    const px = async (P, r) => {
      const i = await load(`/${out}/P${P}.png?${Math.random()}`), c = new OffscreenCanvas(r[2] * dpr, r[3] * dpr), x = c.getContext('2d');
      x.drawImage(i, -r[0] * dpr, -r[1] * dpr);
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const ref = await px(1.2, rects[1.2]), res = {};
    for (const P of Object.keys(rects)) {
      const d = await px(P, rects[P]);
      let sum = 0, big = 0, n = 0;
      for (let k = 0; k < d.length; k += 4) { const e = (Math.abs(d[k] - ref[k]) + Math.abs(d[k + 1] - ref[k + 1]) + Math.abs(d[k + 2] - ref[k + 2])) / 3; sum += e; if (e > 24) big++; n++; }
      res[P] = { box: rects[P].join(','), mean: +(sum / n).toFixed(2), off: +(100 * big / n).toFixed(1) };
    }
    return res;
  }, rects, dpr, OUT);
  for (const P of AT) console.log(`P ${P.toFixed(2)}  box ${res[P].box}  mean ${res[P].mean}  off ${res[P].off}%`);
  if (res[1.16].mean > LIMIT) { console.log(`P 1.16 is off by ${res[1.16].mean} (> ${LIMIT})`); process.exitCode = 1; }
  const pr = page.problems();
  if (pr.exceptions.length || pr.consoleErrors.length) { console.log('problems', JSON.stringify(pr).slice(0, 1500)); process.exitCode = 1; }
} finally { await browser.close(); }
