// Photography → Chess, "ink, unmixed" (scene/unmix-plan.js, scene/ink-sim.js, scene/glsl/unmix.js): the clock
// and its hold, the runs' playback (the dissolve played backward lands exactly on the board), the cure's order,
// the bake's drops, stirrers and pace, a projection like the solver's, the pieces' order, the silhouettes' distances,
// and what the shaders mirror.
import test from 'node:test';
import assert from 'node:assert/strict';
import { START, SHAPES, GLYPH, pieceAt, distances, signedBytes } from '../../../static/site/scene/ink-plan.js';
import { UNMIX, rainAt, unmixAt, lodAt, weightsAt, SLOTS, cureAt, smoothIn } from '../../../static/site/scene/unmix-plan.js';
import { RAIN, DISSOLVE, PACE, createPace, rng, rainDrops, dropSources, stirrers } from '../../../static/site/scene/ink-sim.js';
import { INKSIM } from '../../../static/site/scene/glsl/ink-sim.js';
import { UNMIX_SEEN, UNMIX_GLSL } from '../../../static/site/scene/glsl/unmix.js';
import { PLUME_GLSL } from '../../../static/site/scene/glsl/plume.js';
import { HELD, holdFor, inkEase, inkRaw, easeFor, transitP } from '../../../static/site/lerp.js';
import { TALL, TYPES } from '../../../static/site/scene/staunton.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const U = UNMIX;

test('the clock: tray, rain, diffusion, the still point, the unmixing, the squares, the pieces, the world, in that order', () => {
  assert.ok(U.drops[1] < U.rain[0], 'every drop enters before the plumes spread');
  assert.ok(U.rain[0] < U.diffuse[0] && U.diffuse[1] <= U.still[1], 'the rain, then its diffusion, by the still point');
  assert.ok(U.still[0] < U.unmix[0] + 0.05 && U.unmix[0] < U.focus[0] && U.focus[1] <= U.unmix[1], 'the unmixing comes into focus as it lands');
  assert.ok(U.tremble[1] <= U.clear[0], 'the outline stills before the drain');
  assert.ok(U.squares[1] <= U.harden[1] && U.squares[0] <= U.harden[0], 'the click reveal cures squares first');
  assert.ok(U.harden[1] <= U.clear[1] && U.clear[1] < 1.2, 'cured, and the world clear, before the hold ends');
  const [s0, ds] = HELD.ink;
  assert.ok(s0 >= U.harden[1] - 0.02 && s0 + ds <= 1.2 + 1e-9, 'the band surfaces over the finished board');
  assert.equal(easeFor('ink'), inkEase);
  assert.equal(holdFor('ink').leadOut, 0, 'the band is held to the very end');
  for (const P of [-0.1, 0.2, 0.55, 0.9, 1.15]) near(transitP(inkEase(inkRaw(P))), P, 2e-3);
});

test('the dye finishes collecting before the water falls from above the header to below the foot', () => {
  assert.ok(U.clear[0] > U.unmix[1]);
  for (const height of [390,844,1080]) {
    const level = P => -12 + (height+24)*smoothIn(U.clear,P);
    assert.ok(level(U.clear[0])+4 < 0);
    assert.ok(level(U.clear[1])-4 > height);
    near(level((U.clear[0]+U.clear[1])/2),height/2,1e-8);
  }
});

test('the playback: the rain forward, the dissolve backward, landing exactly where it began', () => {
  let r = -1, d = 2;
  for (let P = -0.2; P <= 1.2; P += 0.01) {
    assert.ok(rainAt(P) >= r - 1e-12 && unmixAt(P) <= d + 1e-12, `monotone at ${P}`);
    r = rainAt(P); d = unmixAt(P);
    const [w1, w2] = weightsAt(P);
    assert.ok(w1 >= 0 && w2 >= 0 && w1 + w2 <= 1 + 1e-9, `weights at ${P}`);
    assert.ok(lodAt(P) >= 0 && lodAt(P) <= U.lodMax + 1e-9);
  }
  // The dissolve played back to its very first frame (the identity map, the board's own ink), and slowing as it lands.
  assert.equal(unmixAt(U.unmix[1]), 0);
  assert.equal(unmixAt(1.2), 0);
  const step = P => unmixAt(P) - unmixAt(P + 0.01);
  assert.ok(step(U.unmix[0] + 0.02) > 3 * step(U.unmix[1] - 0.03), 'fast from the haze, slow onto the board');
  // Sharp as the rain falls and as the board lands; most diffused at the still point.
  assert.equal(lodAt(0.1), 0);
  assert.equal(lodAt(U.focus[1]), 0);
  assert.ok(lodAt((U.still[0] + U.still[1]) / 2) > 0.8 * U.lodMax);
  // The crossfade: all rain before the still point, all dissolve after it.
  assert.deepEqual(weightsAt(0.3), [1, 0]);
  assert.deepEqual(weightsAt(0.75), [0, 1]);
  // The rain stops short of its last keyframes (where its map has run past what the grid can carry).
  assert.ok(U.rainRun[1] <= 0.8 && U.unmixRun[0] <= 1);
});

test('the cure: the 32 pieces, knights first, each from its foot, all done before the world clears', () => {
  assert.equal(SLOTS.length, 32);
  for (const [i, s] of SLOTS.entries()) {
    assert.ok(s.order >= 0 && s.order <= 1, `slot ${i}`);
    assert.equal(s.tall, TALL[TYPES[s.type]]);
    assert.equal(cureAt(s.order, U.harden[0] - 0.01), 0);
    assert.ok(cureAt(s.order, U.harden[1]) > 1 - 1e-9, `slot ${i} cured`);
    let prev = 0;
    for (let P = U.harden[0]; P <= U.harden[1]; P += 0.005) { const c = cureAt(s.order, P); assert.ok(c >= prev); prev = c; }
  }
  const knights = SLOTS.filter(s => s.type === 3), pawns = SLOTS.filter(s => s.type === 5);
  assert.ok(Math.max(...knights.map(s => s.order)) < Math.min(...pawns.map(s => s.order)), 'knights before pawns');
  assert.ok(SLOTS.some(s => s.order === 0) && SLOTS.some(s => s.order === 1));
  // In the FEN's order, as the board (staunton.js startSlots) keeps its slots.
  assert.equal(SLOTS[0].type, TYPES.indexOf('R'));
  assert.equal(SLOTS[4].type, TYPES.indexOf('K'));
  assert.equal(SLOTS[31].type, TYPES.indexOf('R'));
});

test('the bake: sixteen separated drops on the tray, stirrers that wind up', () => {
  const a = rng(7), b = rng(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  for (const [nx, ny, W] of [[256, 208, 1440], [144, 400, 390]]) {
    const drops = rainDrops(nx, ny, W, RAIN.drops[0]), top = ny / (1 + RAIN.above);
    assert.equal(drops.length, RAIN.drops[0]);
    assert.deepEqual(drops, rainDrops(nx, ny, W, RAIN.drops[0]), 'the same every visit');
    for (const [x, y, r, black] of drops) {
      assert.ok(x > 0 && x < nx && r > 0, 'across the screen');
      assert.ok(y - r > 0 && y + r < top, 'the whole drop is visible');
      assert.ok(y > top*.5, 'drips enter in the upper half');
      assert.ok(y + r < ny, 'inside the grid');
      assert.ok(black === 0 || black === 1);
    }
    const slots = dropSources(drops).map(d => d[3]);
    assert.deepEqual([...slots].sort((a,b)=>a-b),SLOTS.flatMap((s,i)=>s.type!==TYPES.indexOf('P')?[i]:[]));
    assert.equal(drops.length,16);
    assert.equal(drops.filter(d => d[3]).length,8);
    for (let i=0;i<16;i++) for (const d of drops.slice(i+1)) assert.ok(Math.hypot(d[0]-drops[i][0],d[1]-drops[i][1]) > d[2]+drops[i][2]);
  }
  const T = DISSOLVE.steps * DISSOLVE.dt;
  assert.ok(stirrers(0, T, 224, 140).every(s => s[3] === 0), 'the board at rest as it begins to dissolve (where the unmixing ends)');
  const late = stirrers(T, T, 224, 140);
  assert.equal(late.length, DISSOLVE.stirrers);
  assert.ok(late.some(s => s[3] > 0) && late.some(s => s[3] < 0), 'stirring both ways');
  assert.ok(stirrers(RAIN.storm[0] * T, T, 256, 208, RAIN.stirrers, 128, 80, RAIN.storm[0], RAIN.storm[1]).every(s => s[3] === 0), 'no storm until the rain has fallen');
  assert.ok(RAIN.keys >= 32 && DISSOLVE.keys >= 24 && RAIN.steps % (RAIN.keys - 1) < RAIN.keys);
});

test('the bake\'s pace: never stopped by a seam, quick when near Chess, halved by a long frame it caused', () => {
  const F = 1 / 60, run = (pace, frames, opts, dt = () => F) => { let n = 0; for (let i = 0; i < frames; i++) { const k = pace.steps(dt(i), opts); n += k; if (k) pace.did(); } return n; };
  // Quiet and busy rates, over a second of quick frames.
  near(run(createPace(PACE.fine), 60, {}), 60 * PACE.fine.quiet, 1, 'quiet');
  near(run(createPace(PACE.fine), 60, { busy: true }), 60 * PACE.fine.busy, 1, 'busy');
  near(run(createPace(PACE.coarse), 60, { busy: true }), 60 * PACE.coarse.busy, 1, 'busy, touch');
  near(run(createPace(PACE.fine), 60, { busy: true, urgent: true }), 60 * PACE.fine.quiet, 1, 'urgent');
  // The whole bake, steadily scrolling through seams, is in within a few seconds (the old bake stopped).
  const steps = RAIN.steps + DISSOLVE.steps;
  for (const [rate, most] of [[PACE.fine, 7], [PACE.coarse, 13]]) {
    const p = createPace(rate); let n = 0, f = 0;
    while (n < steps && f < 6000) { const k = p.steps(F, { busy: true }); n += k; if (k) p.did(); f++; }
    assert.ok(f * F <= most, `${f * F}s`);
  }
  // A long frame just after it worked halves it; a long frame it did not cause does not.
  const p = createPace(PACE.fine);
  run(p, 30, {});
  p.did(); p.steps(0.05, {});
  near(p.scale, 0.5, 1e-9, 'halved');
  const q = createPace(PACE.fine);
  for (let i = 0; i < 30; i++) q.steps(F, {});
  q.steps(0.05, {});
  near(q.scale, 1, 1e-9, 'not its doing');
  // It climbs back, for ten seconds no higher than three quarters of where it hurt, and then all the way.
  run(p, 300, {});
  assert.ok(p.scale <= 0.75 + 1e-9 && p.scale > 0.5, `${p.scale}`);
  run(p, 900, {});
  near(p.scale, 1, 1e-9, 'recovered');
  // Never below the least pace, however long the frames.
  const r = createPace(PACE.coarse);
  for (let i = 0; i < 200; i++) { r.did(); r.steps(0.05, { busy: true }); }
  assert.ok(r.scale >= PACE.least - 1e-12);
  assert.ok(run(r, 600, { busy: true }) > 0, 'still baking');
});

test('the solver\'s projection takes the divergence out (its Jacobi pressure, as glsl/ink-sim.js has it)', () => {
  // A 24 × 24 grid, a smooth field with sources (as a flow on a grid is); after the pressure is solved and
  // its gradient taken off, far less divergence.
  const n = 24, r = rng(3), u = new Float64Array(n * n), v = new Float64Array(n * n);
  const waves = Array.from({ length: 6 }, () => [r() * 0.5, r() * 0.5, r() * 6.28, r() - 0.5, r() - 0.5]);
  for (let i = 0; i < n * n; i++) { const x = i % n, y = Math.floor(i / n); for (const [kx, ky, ph, a, b] of waves) { const w = Math.sin(kx * x + ky * y + ph); u[i] += a * w; v[i] += b * w; } }
  const at = (a, x, y) => a[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
  const div = (u, v) => { const d = new Float64Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d[y * n + x] = 0.5 * ((at(u, x + 1, y) - at(u, x - 1, y)) + (at(v, x, y + 1) - at(v, x, y - 1))); return d; };
  const norm = d => Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length);
  const d0 = div(u, v);
  let p = new Float64Array(n * n);
  for (let k = 0; k < 400; k++) { const q = new Float64Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) q[y * n + x] = (at(p, x - 1, y) + at(p, x + 1, y) + at(p, x, y - 1) + at(p, x, y + 1) - d0[y * n + x]) * 0.25; p = q; }
  const u2 = u.map((_, i) => u[i] - 0.5 * (at(p, (i % n) + 1, Math.floor(i / n)) - at(p, (i % n) - 1, Math.floor(i / n))));
  const v2 = v.map((_, i) => v[i] - 0.5 * (at(p, i % n, Math.floor(i / n) + 1) - at(p, i % n, Math.floor(i / n) - 1)));
  // (What remains is at the walls, where the field is held and the differences are one-sided.)
  assert.ok(norm(div(u2, v2)) < 0.33 * norm(d0), `${norm(div(u2, v2))} vs ${norm(d0)}`);
});

test('the pieces: the starting position, knights first, black a beat before white', () => {
  const rows = START.split('/');
  let count = 0;
  for (let row = 0; row < 8; row++) for (let file = 0; file < 8; file++) {
    const p = pieceAt(file, row), ch = /\d/.test(rows[row]) ? null : rows[row][file];
    assert.equal(!!p, !!ch, `(${file}, ${row})`);
    if (!p) continue;
    count++;
    assert.equal(SHAPES[p.shape], ch.toUpperCase());
    assert.equal(p.white, ch === ch.toUpperCase());
    assert.ok(p.when >= 0 && p.when <= 1);
  }
  assert.equal(count, 32);
  assert.ok(pieceAt(1, 0).when < pieceAt(4, 0).when && pieceAt(4, 0).when < pieceAt(0, 0).when && pieceAt(0, 0).when < pieceAt(2, 0).when, 'knight, king, rook, bishop');
  assert.ok(pieceAt(2, 0).when < pieceAt(3, 1).when && pieceAt(3, 1).when < pieceAt(0, 1).when, 'then the pawns, from the middle out');
  assert.ok(pieceAt(1, 0).when < pieceAt(1, 7).when);
});

test('the silhouettes: exact distances, signed about the outline', () => {
  const n = 41, mask = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x - 20, y - 20) <= 8) mask[y * n + x] = 255;
  const d = distances(mask, n, n);
  assert.equal(d[20 * n + 20], 0);
  near(d[20 * n + 35], 7, 1e-9, 'straight out');
  near(d[0], Math.hypot(20, 20) - 8, 0.8, 'to the corner');
  const s = signedBytes(mask, n, n, 10);
  assert.ok(s[20 * n + 20] < 40 && s[0] === 255 && Math.abs(s[20 * n + 28] - 128) < 20, 'inside low, outside high, the outline in the middle');
  assert.ok(GLYPH.range < GLYPH.cell / 2);
});

test('the shaders mirror the plan', () => {
  const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(5)));
  for (const s of [`UM_HARDEN = vec2(${f(U.harden[0])}, ${f(U.harden[1])})`, `UM_SQUARES = vec2(${f(U.squares[0])}, ${f(U.squares[1])})`, `UM_LODMAX = ${f(U.lodMax)}`]) assert.ok(UNMIX_GLSL.includes(s), s);
  assert.ok(UNMIX_GLSL.includes(`UM_ORDER[32] = float[32](${SLOTS.map(s => f(s.order)).join(', ')})`));
  assert.ok(UNMIX_GLSL.includes('vec3 groundUnmix(') && UNMIX_GLSL.includes('vec4 umClickCover('));
  for (const src of [UNMIX_SEEN, UNMIX_GLSL, PLUME_GLSL, ...Object.values(INKSIM)]) assert.ok(!src.includes('${'), 'every constant written in');
  assert.ok(Object.keys(INKSIM).length >= 10);
  assert.ok(INKSIM.carry.includes('layout(location = 1) out vec4 o2;'), 'the density and the map carried in one pass');
});
