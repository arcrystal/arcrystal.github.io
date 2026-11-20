#!/usr/bin/env node
// A film of Chess's live ink (scene/live-ink.js) in real time: held still, scrolled at an even pace, scrolled
// back, and stirred by a quick scroll, so its motion at rest and under the scroll can both be judged.
// CDP screencast, timestamps kept (as accretion_movie.mjs). Needs the site served (tools/site/serve.mjs).
//   node tools/site/ink_film.mjs [--size 1440x900@2] [--out DIR] [--name NAME] [--script "rest .62 4; scroll .62 .70 5; ..."]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { launch } from './cdp.mjs';

const { values: o } = parseArgs({ options: {
  size: { type: 'string', default: '1440x900@2' },
  out: { type: 'string', default: 'scene-shots/live-ink' },
  name: { type: 'string', default: 'event' },
  script: { type: 'string', default: 'rest .60 3; scroll .60 .66 5; rest .66 5; scroll .66 .62 2.5; rest .62 2; scroll .62 .72 1.6; rest .72 4; scroll .72 .79 5' },
  init: { type: 'string', multiple: true, default: [] },
  base: { type: 'string', default: 'http://127.0.0.1:8100' },
} });
const [wh, dpr = '1'] = o.size.split('@'), [width, height] = wh.split('x').map(Number);
const steps = o.script.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [kind, ...v] = s.split(/\s+/); return { kind, v: v.map(Number) }; });
fs.mkdirSync(o.out, { recursive: true });
const b = await launch({ preset: 'gpu' });
try {
  const p = await b.newPage({ width, height, deviceScaleFactor: Number(dpr), mobile: Math.min(width, height) <= 500, timeout: 120000, init: o.init });
  await p.goto(`${o.base}/`, { waitUntil: 'load', timeout: 30000 });
  await p.waitFor(() => !document.documentElement.classList.contains('site-loading'), { timeout: 125000 });
  await p.waitFor(async () => (await import('/static/site/scene/scene.js')).getScene()?.inkReady?.(), { timeout: 60000 });
  await p.eval(async () => {
    const { holdFor, HOLD, inkRaw } = await import('/static/site/lerp.js');
    const el = document.querySelector('.seam-hold[data-to="ink"]');
    const pin = matchMedia('(pointer: coarse)').matches || innerWidth < 700 ? HOLD.pinTouch : HOLD.pin;
    const L = holdFor('ink', pin), wrap = el.closest('.seam-wrap') || el;
    const shift = Number.parseFloat(getComputedStyle(wrap.querySelector('.band')).getPropertyValue('--held-shift')) || 0;
    const start = wrap.getBoundingClientRect().top + scrollY - L.leadIn * innerHeight;
    const travel = el.offsetHeight + shift + (L.leadIn + L.leadOut) * innerHeight;
    window.__seek = P => scrollTo({ top: start + inkRaw(P, pin) * travel, behavior: 'instant' });
    window.__scrollInk = (a, z, t) => scrollTo({ top: start + (inkRaw(a, pin) + (inkRaw(z, pin) - inkRaw(a, pin)) * t) * travel, behavior: 'instant' });
  });
  // Arrive a little before the first beat, so the ink is already alive.
  const first = steps[0].v[0];
  await p.eval(P => window.__seek(P), Math.max(.556, first - .02));
  await new Promise(r => setTimeout(r, 600));
  await p.eval(P => window.__scrollInk(P - .02, P, 1), first);
  await new Promise(r => setTimeout(r, 1500));
  const dir = path.join(o.out, `${o.name}-frames`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const off = p.on('Page.screencastFrame', e => { const file = `${String(frames.length).padStart(5, '0')}.jpg`; fs.writeFileSync(path.join(dir, file), Buffer.from(e.data, 'base64')); frames.push({ file, time: e.metadata.timestamp }); p.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); });
  await p.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  for (const s of steps) {
    if (s.kind === 'rest') { await p.eval(P => window.__seek(P), s.v[0]); await new Promise(r => setTimeout(r, s.v[1] * 1000)); }
    else await p.eval((a, z, secs) => new Promise(done => { let t0; const tick = t => { t0 ??= t; const k = Math.min(1, (t - t0) / (secs * 1000)); window.__scrollInk(a, z, k); if (k < 1) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); }), s.v[0], s.v[1], s.v[2]);
  }
  await new Promise(r => setTimeout(r, 200));
  await p.send('Page.stopScreencast'); off();
  const manifest = frames.map((f, i) => `file '${f.file}'\nduration ${Math.min(.25, Math.max(.008, (frames[i + 1]?.time ?? f.time + 1 / 30) - f.time))}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
  fs.writeFileSync(path.join(dir, 'frames.txt'), manifest);
  const target = path.join(o.out, `${o.name}.mp4`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'frames.txt'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2,fps=30', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target], { encoding: 'utf8' });
  if (r.status) throw Error(r.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
  const span = frames.length > 1 ? frames.at(-1).time - frames[0].time : 0;
  console.log(target, frames.length, 'frames over', span.toFixed(1), 's', JSON.stringify(await p.eval(() => window.__inkSim?.stats?.() ?? null)));
  const problems = p.problems();
  if (problems.exceptions.length || problems.consoleErrors.length) { console.log('problems', JSON.stringify(problems).slice(0, 1500)); process.exitCode = 1; }
} finally { await b.close(); }
