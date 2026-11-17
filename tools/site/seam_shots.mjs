#!/usr/bin/env node
// Screenshots of one seam's transition at chosen moments of its clock P (−0.2 … 1.2, as lerp.js transitP),
// scrolled to exactly, in order; and past its release (P > 1.2: that much past it, in screens).
//   node tools/site/seam_shots.mjs --seam ink --size 1440x900@2 --at -0.1,0,0.15,0.3 --out DIR [--base URL]
// --seam: the style the seam goes to (cosmos, glass, folio, darkroom, ink). Sizes as cdp.mjs parseSize has
// them (narrow sides are phones). For ink, it waits for the fluid to be baked (scene.inkReady). Prints
// where the held band is at each moment. Needs the site served.
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { launch, parseSize } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  seam: { type: 'string', default: 'ink' },
  size: { type: 'string', default: '1440x900@2' },
  at: { type: 'string', default: '-0.1,0,0.15,0.3,0.45,0.55,0.65,0.75,0.85,0.9,0.95,1.0,1.1,1.19' },
  out: { type: 'string', default: '/tmp/seam-shots' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
  wait: { type: 'string', default: '450' },
} });
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(o.out, { recursive: true });
const browser = await launch({ preset: 'gpu' });
try {
  const page = await browser.newPage(parseSize(o.size));
  await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitFor(() => /\bgl\b/.test(document.documentElement.className), { timeout: 20000 });
  if (o.seam === 'ink') {
    const t0 = Date.now();
    await page.waitFor(async () => (await import('/static/site/scene/scene.js')).getScene()?.inkReady?.(), { timeout: 60000 });
    console.log(`the ink's fluid baked in ${Date.now() - t0} ms (after the scene)`);
  } else await sleep(3000);
  await page.eval(async style => {
    const L = await import('/static/site/lerp.js');
    window.__seek = P => {
      const el = document.querySelector(`.seam-hold[data-to="${style}"]`), wrap = el.parentElement.classList.contains('seam-wrap') ? el.parentElement : null;
      const band = wrap?.querySelector('.band'), shift = band ? parseFloat(band.style.getPropertyValue('--held-shift')) || 0 : 0, vh = innerHeight;
      const hold = L.holdFor(style, matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? L.HOLD.pinTouch : L.HOLD.pin), ease = L.easeFor(style);
      const T = (wrap || el).getBoundingClientRect().top + scrollY, R = wrap ? el.offsetHeight + shift : Math.max(1, el.offsetHeight - vh);
      const a = hold.leadIn * vh, b = hold.leadOut * vh;
      if (P > 1.2) { scrollTo({ top: T + R + b + (P - 1.2) * vh, behavior: 'instant' }); return; }
      let lo = 0, hi = 1;
      for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (L.transitP(ease(m)) < P) lo = m; else hi = m; }
      scrollTo({ top: T - a + lo * (R + a + b), behavior: 'instant' });
    };
  }, o.seam);
  for (const s of o.at.split(',')) {
    const P = Number(s);
    await page.eval(P => window.__seek(P), P);
    await sleep(Number(o.wait));
    const info = await page.eval(style => { const b = document.querySelector(`.band[data-style="${style}"]`); return b ? { held: b.classList.contains('is-held'), surface: b.style.getPropertyValue('--surface') } : null; }, o.seam === 'ink' ? 'ink' : o.seam);
    await page.screenshot(`${o.out}/P${s}.png`);
    console.log(`P ${s}`, JSON.stringify(info));
  }
  const pr = page.problems();
  if (pr.exceptions.length || pr.consoleErrors.length) { console.log('problems', JSON.stringify(pr).slice(0, 1500)); process.exitCode = 1; }
} finally { await browser.close(); }
