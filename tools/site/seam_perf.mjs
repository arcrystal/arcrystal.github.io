#!/usr/bin/env node
// Frame times through one seam's hold, by how far its transition has come: scrolls from where the
// strip first shows to just past its release at an even pace, on the GPU, and reports rAF intervals
// in seven stretches of the scene clock P (−0.2 … 1.2).
//   node tools/site/seam_perf.mjs --seam ink [--size 1440x900] [--dpr 2] [--secs 24] [--passes 2] [--base URL] [--strict]
// --seam: the style the seam goes to (cosmos, glass, folio, darkroom, ink). --strict exits 1 when any
// stretch has a frame over 20 ms or a 90th percentile over 17.5 ms. --passes runs it again from the
// top (a first pass pays for what is made once; later ones show what every pass pays). The frames over
// 20 ms are listed with the P they ended at and the long tasks seen near them. Needs the site served.
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  seam: { type: 'string', default: 'ink' },
  size: { type: 'string', default: '1440x900' },
  dpr: { type: 'string', default: '2' },
  secs: { type: 'string', default: '24' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
  strict: { type: 'boolean', default: false },
  passes: { type: 'string', default: '1' },
} });
const [width, height] = o.size.split('x').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await launch({ preset: 'gpu' });
let over = 0;
try {
  // Narrow sides (≤ 500 px) are phones: touch and a mobile viewport, as cdp.mjs parseSize has them.
  const page = await browser.newPage({ width, height, deviceScaleFactor: Number(o.dpr), mobile: Math.min(width, height) <= 500 });
  await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitFor(() => /\bgl\b/.test(document.documentElement.className), { timeout: 20000 });
  await page.waitFor(() => !document.documentElement.classList.contains('site-loading'), { timeout: 125000 });
  if (o.seam === 'ink') await page.waitFor(async () => (await import('/static/site/scene/scene.js')).getScene()?.inkReady?.(), { timeout: 60000 });
  await sleep(3000);
  for (let pass = 1; pass <= Number(o.passes); pass++) {
  const res = await page.eval(async (style, secs) => {
    const L = await import('/static/site/lerp.js');
    const el = document.querySelector(`.seam-hold[data-to="${style}"]`);
    if (!el) return { error: `no hold for ${style} (is motion on?)` };
    const wrap = el.parentElement.classList.contains('seam-wrap') ? el.parentElement : null, band = wrap?.querySelector('.band');
    const shift = band ? parseFloat(band.style.getPropertyValue('--held-shift')) || 0 : 0;
    const pin=matchMedia('(pointer: coarse)').matches || innerWidth<700 ? L.HOLD.pinTouch : L.HOLD.pin;
    const vh=innerHeight, hold=L.holdFor(style,pin), ease=L.easeFor(style,pin);
    const T = (wrap || el).getBoundingClientRect().top + scrollY, R = wrap ? el.offsetHeight + shift : Math.max(1, el.offsetHeight - vh);
    const a = hold.leadIn * vh, b = hold.leadOut * vh, y0 = T - a, y1 = T + R + b + 60;
    scrollTo({ top: y0, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 900));
    const edges = [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2], out = edges.slice(0, -1).map(() => []), slow = [], tasks = [];
    const po = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')
      ? new PerformanceObserver(l => { for (const e of l.getEntries()) tasks.push({ at: e.startTime, ms: e.duration, render: e.renderStart ? +(e.startTime + e.duration - e.renderStart).toFixed(1) : null, scripts: (e.scripts || []).map(x => `${(x.sourceURL || '').split('/').pop()}:${x.sourceFunctionName || x.invoker || ''} ${x.duration.toFixed(0)}`).slice(0, 3) }); }) : null;
    po?.observe({ type: 'long-animation-frame', buffered: false });
    const t0 = performance.now();
    let last = t0;
    await new Promise(done => {
      const step = now => {
        const k = (now - t0) / (secs * 1000);
        if (k >= 1) return done();
        const y = y0 + (y1 - y0) * k;
        scrollTo({ top: y, behavior: 'instant' });
        const P = L.transitP(ease(Math.max(0, Math.min(1, (y - T + a) / (R + a + b)))));
        out[Math.max(0, Math.min(out.length - 1, edges.findIndex(e => e > P) - 1))].push(now - last);
        if (now - last > 20) slow.push({ P: +P.toFixed(3), ms: +(now - last).toFixed(1), at: now });
        last = now;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    po?.disconnect();
    for (const sl of slow) sl.near = tasks.filter(t => t.at < sl.at && t.at + t.ms > sl.at - sl.ms - 5).map(({ ms, render, scripts }) => ({ ms: +ms.toFixed(1), render, scripts }));
    const stat = v => { const s = [...v].sort((x, y) => x - y); return s.length ? { frames: s.length, p50: +s[s.length >> 1].toFixed(1), p90: +s[Math.floor(s.length * 0.9)].toFixed(1), worst: +s[s.length - 1].toFixed(1), over20: s.filter(x => x > 20).length } : null; };
    const cv = document.querySelector('canvas.scene');
    return { canvas: cv ? [cv.width, cv.height] : null, slow, stretches: out.map((v, i) => ({ P: `${edges[i]} … ${edges[i + 1]}`, ...stat(v) })) };
  }, o.seam, Number(o.secs));
  if (res.error) { console.error(res.error); process.exitCode = 1; }
  else {
    console.log(`${o.seam} at ${o.size} ×${o.dpr}, canvas ${res.canvas?.join('×')}${Number(o.passes) > 1 ? `, pass ${pass}` : ''}`);
    for (const s of res.stretches) {
      if (!s.frames) continue;
      const bad = s.over20 > 0 || s.p90 > 17.5;
      if (bad) over++;
      console.log(`  P ${s.P.padEnd(12)} ${String(s.frames).padStart(4)} frames  p50 ${s.p50}  p90 ${s.p90}  worst ${s.worst}  over 20 ms: ${s.over20}${bad ? '  ←' : ''}`);
    }
    for (const sl of res.slow) console.log(`    ${sl.ms} ms ending at P ${sl.P}${sl.near.length ? `: ${sl.near.map(t => `long frame ${t.ms} ms (render ${t.render}) ${t.scripts.join(', ')}`).join('; ')}` : ''}`);
  }
  }
} finally { await browser.close(); }
if (o.strict && over) process.exitCode = 1;
