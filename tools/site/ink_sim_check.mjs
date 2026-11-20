#!/usr/bin/env node
// Chess's live ink on the GPU (scene/live-ink.js), driven hard: the tools' fixed step, the scroll's stir at
// its most, held at P for many steps, its health read back now and then (energy, the fastest cell, mist).
// Fails on a NaN or Inf, a speed over the limit, energy run away from its target, or a flow gone still.
//   node tools/site/ink_sim_check.mjs [--size 1440x900@2] [--at .66] [--steps 3000]
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';
import { SIM, energyAt } from '../../static/site/scene/ink-sim.js';

const { values: o } = parseArgs({ options: {
  size: { type: 'string', default: '1440x900@2' },
  at: { type: 'string', default: '.66' },
  steps: { type: 'string', default: '3000' },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
} });
const [wh, dpr = '1'] = o.size.split('@'), [width, height] = wh.split('x').map(Number), P = Number(o.at), steps = Number(o.steps);
const b = await launch({ preset: 'gpu' });
let failed = false;
const fail = m => { console.log('  ✖', m); failed = true; };
try {
  const p = await b.newPage({ width, height, deviceScaleFactor: Number(dpr), mobile: Math.min(width, height) <= 500, timeout: 600000, init: ['window.__inkSim = { fixed: true, health: true, vel: 3 }; window.__noAdapt = true;'] });
  await p.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  await p.waitFor(() => !document.documentElement.classList.contains('site-loading'), { timeout: 125000 });
  await p.waitFor(async () => (await import('/static/site/scene/scene.js')).getScene()?.inkReady?.(), { timeout: 60000 });
  await p.eval(async P => {
    const { holdFor, HOLD, inkRaw } = await import('/static/site/lerp.js');
    const el = document.querySelector('.seam-hold[data-to="ink"]'), pin = matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? HOLD.pinTouch : HOLD.pin;
    const L = holdFor('ink', pin), wrap = el.closest('.seam-wrap') || el, shift = parseFloat(getComputedStyle(wrap.querySelector('.band')).getPropertyValue('--held-shift')) || 0;
    const start = wrap.getBoundingClientRect().top + scrollY - L.leadIn * innerHeight, travel = el.offsetHeight + shift + (L.leadIn + L.leadOut) * innerHeight;
    scrollTo({ top: start + inkRaw(P, pin) * travel, behavior: 'instant' });
  }, P);
  await p.waitFor(() => window.__inkSim.stats?.()?.settled, { timeout: 120000 });
  const target = energyAt(P, 1 - Math.exp(-3 / SIM.stir.scale));
  const seen = [];
  const t0 = Date.now();
  while (true) {
    const s = await p.eval(() => window.__inkSim.stats());
    seen.push(s);
    if (s.steps >= steps || Date.now() - t0 > 540000) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  const last = seen.at(-1), energies = seen.slice(3).map(s => s.energy);
  console.log(`${o.size} at P ${P}: ${last.steps} steps; energy ${Math.min(...energies).toExponential(2)} … ${Math.max(...energies).toExponential(2)} (target ${target.toExponential(2)}); fastest ${Math.max(...seen.map(s => s.most))} cells/step; gain ${last.gain}; mist ${last.mist}`);
  if (seen.some(s => ![s.energy, s.most, s.mist, s.gain].every(Number.isFinite))) fail('a NaN or Inf');
  if (seen.some(s => s.most > SIM.speed * 1.5)) fail('a cell faster than the limit (after the impulses it may briefly exceed it)');
  if (Math.max(...energies) > 10 * target) fail('energy ran away');
  if (Math.min(...energies) < .05 * target) fail('the flow went still');
  if (last.steps < steps) fail(`only ${last.steps} of ${steps} steps`);
  const pr = p.problems();
  if (pr.exceptions.length || pr.consoleErrors.length) fail(JSON.stringify(pr).slice(0, 800));
} finally { await b.close(); }
if (failed) process.exitCode = 1; else console.log('  ✔ healthy');
