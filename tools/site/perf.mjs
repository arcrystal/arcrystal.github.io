#!/usr/bin/env node
// Scroll performance of the homepage: wheels from the hero to past the last band like a person
// would, and reports rAF frame intervals and the protocol's style and layout counters.
//   node tools/site/perf.mjs [--strict] [--base URL] [--size 1440x900]
// Runs: the gpu preset, the gpu preset with the CPU throttled 4×, and SwiftShader (a weak GPU).
// --strict exits 1 when a run is over its budget.
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  strict: { type: 'boolean', default: false },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
  size: { type: 'string', default: '1440x900' },
} });
const [width, height] = o.size.split('x').map(Number);
const RUNS = [
  { name: 'gpu', preset: 'gpu', throttle: 1, budget: { p90: 17.5, worst: 50, recalcPerFrame: Infinity } },
  { name: 'gpu, CPU 4×', preset: 'gpu', throttle: 4, budget: { p90: 20, worst: Infinity, recalcPerFrame: 4 } },
  { name: 'swiftshader (falls back to CSS)', preset: 'swiftshader', throttle: 1, budget: { p90: 33.4, worst: Infinity, recalcPerFrame: Infinity } },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let over = 0;

for (const run of RUNS) {
  const browser = await launch({ preset: run.preset });
  try {
    const page = await browser.newPage({ width, height });
    await page.send('Performance.enable');
    await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
    await page.waitFor(() => /\b(no-)?gl\b/.test(document.documentElement.className), { timeout: 20000 }).catch(() => {});
    await sleep(1200);
    if (run.throttle > 1) await page.setCpuThrottle(run.throttle);
    const info = await page.eval(() => ({
      gl: document.documentElement.classList.contains('gl'),
      end: document.querySelector('.bands').offsetTop + document.querySelector('.bands').offsetHeight,
    }));
    const m0 = (await page.metrics()).perf;
    await page.eval(() => {
      window.__iv = []; window.__stop = false;
      let last = null;
      const tick = t => { if (last !== null) window.__iv.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    // Wheel at a steady 100 px per 16 ms until past the last band, then let the page settle.
    for (let y = 0; y < info.end; y += 100) { await page.wheel(100, { x: width / 2, y: height / 2 }); await sleep(16); }
    await sleep(800);
    const iv = (await page.eval(() => { window.__stop = true; return window.__iv; })).slice(30);
    const m1 = (await page.metrics()).perf;
    const d = k => m1[k] - m0[k];
    const sorted = [...iv].sort((a, b) => a - b);
    const q = f => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
    const res = {
      run: run.name, scene: info.gl ? 'webgl' : 'css', frames: iv.length,
      p50: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), worst: +sorted[sorted.length - 1].toFixed(1),
      over33: iv.filter(x => x > 33.4).length,
      recalcMs: Math.round(d('RecalcStyleDuration') * 1000), recalcs: d('RecalcStyleCount'),
      layoutMs: Math.round(d('LayoutDuration') * 1000), layouts: d('LayoutCount'),
      scriptMs: Math.round(d('ScriptDuration') * 1000), taskMs: Math.round(d('TaskDuration') * 1000),
    };
    const fails = [];
    if (res.p90 > run.budget.p90) fails.push(`p90 ${res.p90} > ${run.budget.p90}`);
    if (res.worst > run.budget.worst) fails.push(`worst ${res.worst} > ${run.budget.worst}`);
    const perFrame = res.recalcMs / Math.max(1, res.frames);
    if (perFrame > run.budget.recalcPerFrame) fails.push(`style recalc ${perFrame.toFixed(1)} ms a frame > ${run.budget.recalcPerFrame}`);
    over += fails.length;
    console.log(`${fails.length ? 'OVER' : 'ok  '} ${JSON.stringify(res)}${fails.length ? `  ← ${fails.join('; ')}` : ''}`);
  } finally {
    await browser.close();
  }
}
if (o.strict && over) process.exitCode = 1;
