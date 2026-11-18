// Whether Photography → Chess's fluid (scene/ink-sim.js, paced by transit.js bake) is baked by the time a
// visitor scrolling steadily from the top reaches its seam: it bakes while the other seams play, so it must
// be in well before then. Scrolls at each pace (CSS px a second) from the top and reports when the seam began,
// when the fluid was in, and the frames over 20 ms on the way.
//   node tools/site/ink_bake_check.mjs [--size 1440x900@2] [--paces 800,1600] [--base URL]
// Exits 1 when the fluid was not in by the seam at any pace. Needs the site served.
import { parseArgs } from 'node:util';
import { launch, parseSize } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  size: { type: 'string', default: '1440x900@2' },
  paces: { type: 'string', default: '' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
} });
const size = parseSize(o.size);
const paces = (o.paces || (size.mobile ? '600,1200' : '800,1600')).split(',').map(Number);
for (const pace of paces) {
  const browser = await launch({ preset: 'gpu' });
  try {
    const page = await browser.newPage(size);
    await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitFor(() => /\bgl\b/.test(document.documentElement.className), { timeout: 20000 });
    const r = await page.eval(async pace => {
      const m = await import('/static/site/scene/scene.js'), L = await import('/static/site/lerp.js');
      const el = document.querySelector('.seam-hold[data-to="ink"]');
      if (!el) return { error: 'no hold for ink (is motion on?)' };
      const wrap = el.closest('.seam-wrap') || el, vh = innerHeight;
      const hold = L.holdFor('ink', matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? L.HOLD.pinTouch : L.HOLD.pin);
      const start = wrap.getBoundingClientRect().top + scrollY - hold.leadIn * vh;
      const t0 = performance.now();
      let y = 0, baked = null, reached = null, last = t0, slow = 0, frames = 0;
      await new Promise(done => {
        const step = now => {
          const dt = now - last; last = now;
          if (++frames > 5 && dt > 20) slow++;
          y += pace * dt / 1000;
          scrollTo({ top: y, behavior: 'instant' });
          if (baked === null && m.getScene()?.inkReady?.()) baked = Math.round(now - t0);
          if (reached === null && y >= start) reached = Math.round(now - t0);
          if (reached !== null || now - t0 > 120000) return done();
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      return { reached, baked, slow, frames };
    }, pace);
    if (r.error) { console.error(r.error); process.exitCode = 1; continue; }
    const ok = r.baked !== null && r.baked <= r.reached;
    console.log(`${size.label}@${size.deviceScaleFactor} at ${pace} px/s: the seam at ${(r.reached / 1000).toFixed(1)} s, the fluid in ${r.baked === null ? 'not yet' : `at ${(r.baked / 1000).toFixed(1)} s`}${ok ? '' : '  ←'}; ${r.slow} of ${r.frames} frames over 20 ms`);
    if (!ok) process.exitCode = 1;
  } finally { await browser.close(); }
}
