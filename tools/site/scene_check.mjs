#!/usr/bin/env node
// The scene, headless: the shader builds, and a screenshot of every tile and of every handoff at a
// quarter, half and three quarters, for looking at (no midpoint should be muddy or empty).
//   node tools/site/scene_check.mjs [--out DIR] [--size 1440x900] [--preset gpu|swiftshader|nowebgl] [--reduced-motion]
//     [--only NAME] [--base URL]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';
import { HOLD } from '../../static/site/lerp.js';

const { values: o } = parseArgs({ options: {
  out: { type: 'string', default: 'scene-shots' },
  size: { type: 'string', default: '1440x900' },
  preset: { type: 'string', default: 'gpu' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
  only: { type: 'string' },
  'reduced-motion': { type: 'boolean', default: false },
} });
const [width, height] = o.size.split('x').map(Number);
fs.mkdirSync(o.out, { recursive: true });

// The scroll fraction at which a held handoff reaches h (inverting smoothstep by bisection).
const smooth = x => x * x * (3 - 2 * x);
const fracFor = h => { let a = 0, b = 1; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (smooth(m) < h) a = m; else b = m; } return HOLD / 2 + (1 - HOLD) * a; };
const marks = [];
for (let k = 0; k < 5; k++) marks.push({ p: k, name: `tile-${k}` });
for (const h of [0.25, 0.5, 0.75]) {
  marks.push({ p: -1 + h, name: `handoff-house-0-h${h}` });
  for (let k = 0; k < 4; k++) marks.push({ p: k + fracFor(h), name: `handoff-${k}-${k + 1}-h${h}` });
  marks.push({ p: 4 + (() => { let a = 0, b = 1; for (let q = 0; q < 40; q++) { const m = (a + b) / 2; if (smooth(m) < h) a = m; else b = m; } return a; })(), name: `handoff-4-house-h${h}` });
}
marks.push({ p: -1, name: 'hero' });
const list = o.only ? marks.filter(m => m.name.includes(o.only)) : marks;

const browser = await launch({ preset: o.preset });
let failed = false;
try {
  const page = await browser.newPage({ width, height, deviceScaleFactor: width < 600 ? 2 : 1, mobile: width < 600 });
  if (o['reduced-motion']) await page.setMedia({ reducedMotion: true });
  await page.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  await page.eval(() => document.documentElement.setAttribute('data-hold', ''));
  const gl = await page.waitFor(() => document.documentElement.classList.contains('gl') || document.documentElement.classList.contains('no-gl'), { timeout: 20000 }).then(() => page.eval(() => document.documentElement.classList.contains('gl')));
  console.log(`scene: ${gl ? 'drawing' : 'not available (CSS fallback)'}`);
  for (const m of list.sort((a, b) => a.p - b.p)) {
    await page.eval(p => {
      const s = document.querySelector('.stage');
      const vh = document.querySelector('.stage-pin').clientHeight;
      const run = s.offsetHeight - vh, top = s.offsetTop, n = 5;
      const y = p < 0 ? top + p * vh : p > n - 1 ? top + run + (p - (n - 1)) * vh : top + (run / (n - 1)) * p;
      window.scrollTo({ top: y, behavior: 'instant' });
    }, m.p);
    await new Promise(r => setTimeout(r, 1100));
    await page.screenshot(path.join(o.out, `${m.name}.png`));
    process.stdout.write('.');
  }
  const problems = page.problems?.() ?? {};
  console.log('\n' + JSON.stringify({ consoleErrors: problems.consoleErrors, exceptions: problems.exceptions }));
  if (problems.consoleErrors?.length || problems.exceptions?.length) failed = true;
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
