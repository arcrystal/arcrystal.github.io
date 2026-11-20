#!/usr/bin/env node
// Chess's drain against its rise (scene/ink-tank.js): the same water at the same level. Shoots the rise and
// the return at equal tank levels L, then compares the band of surface between the far and near lines,
// away from the lines themselves, the UI and (on wide screens) the board's columns:
//   luma percentiles (p5 p50 p95 p99.5), the standard deviation, Ex/Ey (horizontal over vertical gradient
//   energy: low is the long vertical streaking of reflections), and R−B (warmth).
//   node tools/site/drain_look.mjs [--size 1280x800@1] [--out DIR]
// Needs the site served (tools/site/serve.mjs --port 8100) and ffmpeg.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { CAMERA, CLEAR, DRAIN, tankCamera, tankLevel } from '../../static/site/scene/ink-tank.js';

const { values: o } = parseArgs({ options: {
  size: { type: 'string', default: '1280x800@1' },
  out: { type: 'string', default: '/tmp/drain-look' },
} });
const [W, H] = o.size.split('@')[0].split('x').map(Number);
const solve = (L, lo, hi, falling) => {
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if ((tankLevel(m) < L) !== falling) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
const levels = [.75, .5, .25];
const pairs = levels.map(L => [L, solve(L, CAMERA.start, CAMERA.end, false), solve(L, CLEAR[0], DRAIN.fall[1], true)]);
// At the opening level: the rise's held opening against the return's pause, before and after the lights.
pairs.push([0, .2, DRAIN.pause[0] + .1 * (DRAIN.pause[1] - DRAIN.pause[0])], [0, .27, DRAIN.pause[1]]);
const Ps = [...new Set(pairs.flatMap(([, a, b]) => [a, b]).map(P => +P.toFixed(5)))];
fs.mkdirSync(o.out, { recursive: true });
if (!process.env.NOSHOOT) execFileSync('node', ['tools/site/seam_shots.mjs', '--seam', 'ink', '--size', o.size, '--at', Ps.join(','), '--out', o.out], { stdio: 'inherit' });

function stats(P) {
  const file = `${o.out}/P${+P.toFixed(5)}.png`;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const cam = tankCamera(P), far = 1 - (cam[0] + .5 * cam[1]), nearRow = 1 - (cam[0] - .5 * cam[1]);
  const top = Math.max(Math.ceil((far + 6 / H) * H), 70), bottom = Math.min(Math.floor((nearRow - 10 / H) * H), H - 70);
  const L = [], RB = [];
  let ex = 0, ey = 0;
  const lum = (x, y) => { const i = 3 * (y * W + x); return (.2126 * raw[i] + .7152 * raw[i + 1] + .0722 * raw[i + 2]) / 255; };
  for (let y = top; y < bottom - 1; y++) for (let x = 8; x < W - 8; x++) {
    // (On wide screens the board's columns are left out: the drain refracts its checker.)
    if (W > 900 && x > W * .44 && x < W * .93) continue;
    const i = 3 * (y * W + x), l = lum(x, y);
    L.push(l); RB.push((raw[i] - raw[i + 2]) / 255);
    ex += (lum(x + 1, y) - l) ** 2; ey += (lum(x, y + 1) - l) ** 2;
  }
  if (!L.length) return null;
  L.sort((a, b) => a - b);
  const q = f => L[Math.min(L.length - 1, Math.floor(f * L.length))], mean = L.reduce((a, b) => a + b) / L.length;
  const sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / L.length);
  return { rows: [top, bottom], p5: q(.05), p50: q(.5), p95: q(.95), p995: q(.995), sd, ExEy: ex / Math.max(ey, 1e-9), RB: RB.reduce((a, b) => a + b) / RB.length };
}
const fmt = s => s ? `p5 ${s.p5.toFixed(3)} p50 ${s.p50.toFixed(3)} p95 ${s.p95.toFixed(3)} p99.5 ${s.p995.toFixed(3)} sd ${s.sd.toFixed(3)} Ex/Ey ${s.ExEy.toFixed(2)} R−B ${s.RB.toFixed(3)} rows ${s.rows}` : 'no band';
for (const [L, up, down] of pairs) {
  console.log(`L ${L}`);
  console.log(`  rise   P ${up.toFixed(4)}  ${fmt(stats(up))}`);
  console.log(`  return P ${down.toFixed(4)}  ${fmt(stats(down))}`);
}
