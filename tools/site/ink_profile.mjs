#!/usr/bin/env node
// What Chess's ink transition costs a frame at fixed P: vsync and the frame-rate limit off, so each rAF
// interval is the frame's own cost. (Timer queries are unreliable under ANGLE on Metal: they overlap.)
// Each --variant is a script run before the page's (e.g. "window.__inkSim={off:true}"), measured in
// its own tab against the plain page. Needs the site served (tools/site/serve.mjs).
//   node tools/site/ink_profile.mjs [--size 1440x900@2] [--at .6,.66,.72] [--secs 3] [--variant JS]...
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  size: { type: 'string', default: '1440x900@2' },
  at: { type: 'string', default: '.58,.64,.70,.76' },
  secs: { type: 'string', default: '3' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
  variant: { type: 'string', multiple: true, default: [] },
} });
const [wh, dpr = '1'] = o.size.split('@'), [width, height] = wh.split('x').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch({ preset: 'gpu', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
try {
  for (const variant of ['', ...o.variant]) {
    const page = await browser.newPage({ width, height, deviceScaleFactor: Number(dpr), mobile: Math.min(width, height) <= 500, init: ['window.__noAdapt = true;', ...(variant ? [variant] : [])] });
    await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
    await page.waitFor(() => !document.documentElement.classList.contains('site-loading'), { timeout: 125000 });
    await page.waitFor(async () => (await import('/static/site/scene/scene.js')).getScene()?.inkReady?.(), { timeout: 60000 });
    await page.eval(async () => {
      const L = await import('/static/site/lerp.js');
      window.__seek = P => {
        const el = document.querySelector('.seam-hold[data-to="ink"]'), wrap = el.parentElement.classList.contains('seam-wrap') ? el.parentElement : null;
        const band = wrap?.querySelector('.band'), shift = band ? parseFloat(band.style.getPropertyValue('--held-shift')) || 0 : 0, vh = innerHeight;
        const pin = matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? L.HOLD.pinTouch : L.HOLD.pin, hold = L.holdFor('ink', pin), ease = L.easeFor('ink', pin);
        const T = (wrap || el).getBoundingClientRect().top + scrollY, R = wrap ? el.offsetHeight + shift : Math.max(1, el.offsetHeight - vh);
        const a = hold.leadIn * vh, b = hold.leadOut * vh;
        let lo = 0, hi = 1;
        for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (L.transitP(ease(m)) < P) lo = m; else hi = m; }
        scrollTo({ top: T - a + lo * (R + a + b), behavior: 'instant' });
      };
    });
    console.log(variant ? `variant: ${variant}` : 'plain');
    for (const P of o.at.split(',').map(Number)) {
      await page.eval(P => window.__seek(P), P);
      await sleep(1000);
      const r = await page.eval(secs => new Promise(done => {
        const v = []; let last = 0; const t0 = performance.now();
        const step = t => { if (last) v.push(t - last); last = t; if (t - t0 < secs * 1000) requestAnimationFrame(step); else { v.sort((a, b) => a - b); done({ n: v.length, mean: (performance.now() - t0) / Math.max(1, v.length), p50: v[v.length >> 1], p90: v[Math.floor(.9 * v.length)], canvas: [document.querySelector('canvas.scene')?.width, document.querySelector('canvas.scene')?.height], sim: window.__inkSim?.stats?.() ?? null }); } };
        requestAnimationFrame(step);
      }), Number(o.secs));
      console.log(`  P ${P}  canvas ${r.canvas.join('×')}  mean ${r.mean.toFixed(2)} ms  p50 ${r.p50.toFixed(2)}  p90 ${r.p90.toFixed(2)}  (${r.n} frames)${r.sim ? `  sim ${JSON.stringify(r.sim)}` : ''}`);
    }
    const pr = page.problems();
    if (pr.exceptions.length || pr.consoleErrors.length) { console.log('problems', JSON.stringify(pr).slice(0, 1500)); process.exitCode = 1; }
    await page.close?.();
  }
} finally { await browser.close(); }
