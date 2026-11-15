// Outdoors → Photography, and the click into Photography: the thickness of a moment. The clock, the
// lantern's path, the instants and their weights, the depth and the camera, the crossing integral,
// development, the meniscus, and what the shader mirrors.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOMENT, MOMENTC, evening, lampAt, timeColour, LEAVES, leafAt, level, instantLevel, instantWeight,
  depthAt, viewAt, rayAt, crossingIntegral, HD, hdDensity, induction, densityAt, grainFraction, wetAt,
} from '../../../static/site/scene/moment-plan.js';
import { MOMENT_GLSL } from '../../../static/site/scene/glsl/moment.js';
import { HOLD, holdFor, darkroomEase, darkroomRaw, easeFor, transitP } from '../../../static/site/lerp.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);

test('the clock: the glass remembers, the evening deepens and closes, the shutter, the paper', () => {
  const M = MOMENT;
  assert.ok(M.remember[1] <= M.depth[0], 'the evening is whole before it has depth');
  assert.ok(M.depth[0] < M.finer[0] && M.finer[1] <= M.join[0] + 0.03 && M.join[1] <= M.drift[0] + 0.03, 'it parts, its instants halve, then join');
  assert.ok(M.close[0] >= M.drift[1] - 1e-9 && M.close[0] < M.close[1] && M.close[1] < M.close[2], 'held, then closed');
  assert.ok(M.shutter[0] >= M.close[2] - 0.01 && M.exposure >= M.close[2] - 1e-9 && M.exposure <= M.shutter[0] + 0.01, 'the curtain ends the exposure');
  assert.ok(M.red[0] >= M.shutter[0] && M.edge[0] >= M.red[0] && M.tip[0] >= M.edge[0] && M.wet[0] >= M.tip[0], 'the safelight, then the paper');
  assert.ok(M.withdraw[1] <= 1.2 && M.sink[1] <= 1.2 + 1e-9, 'settled by the end');
  // The lantern is taken only once the strip is held (on a desktop and on a phone).
  for (const pin of [HOLD.pin, HOLD.pinTouch]) {
    const L = holdFor('darkroom', pin), R = pin * L.pin, p = L.leadIn / (R + L.leadIn + L.leadOut);
    assert.ok(M.remember[0] >= transitP(darkroomEase(p)) + 0.02, `held by then (pin ${pin})`);
  }
  assert.equal(evening(M.remember[0]), 0);
  assert.equal(evening(M.depth[0]), 1);
  // The click's clocks.
  assert.ok(MOMENTC.sweep[1] < MOMENTC.shutter[1] && MOMENTC.shutter[1] <= 1 && MOMENTC.red[1] <= 1);
  assert.ok(MOMENTC.wet[1] <= MOMENTC.settle[1] && MOMENTC.settle[1] <= 1);
});

test('the lantern: one sweep across the window, on screen, its column giving its time', () => {
  let prev = Infinity;
  for (let t = 0; t <= 1 + 1e-9; t += 0.01) {
    const [x, y] = lampAt(t);
    assert.ok(x > 0.05 && x < 0.95 && y > 0.05 && y < 0.95, `on screen at ${t}`);
    assert.ok(x < prev, 'right to left, never back (so the shader can invert it)');
    prev = x;
  }
  const c0 = timeColour(0), c1 = timeColour(1);
  assert.ok(c0[0] > c0[2] * 2, 'the remembered light warm');
  assert.ok(c1[2] > c1[0] * 2, 'the newest cool');
  for (const L of LEAVES) {
    assert.ok(L.a >= 0 && L.b <= 1 && L.a < L.b);
    assert.equal(leafAt(L, L.a - 0.01), null);
    assert.ok(leafAt(L, L.a).p[1] < 0 && leafAt(L, L.b).p[1] > 1, 'it falls past the whole window');
  }
});

test('the instants: halving, the evening\'s weight shared so the total never changes', () => {
  const n = MOMENT.slices;
  assert.equal(instantLevel(n - 1), 3);
  assert.equal(instantLevel(n / 2 - 1), 3);
  assert.equal(instantLevel(n / 16 - 1 + n / 8), 4);
  assert.equal(instantLevel(0), 6);
  assert.equal([...Array(n).keys()].filter(i => instantLevel(i) === 3).length, MOMENT.echoes);
  for (let l = 3; l <= 6 + 1e-9; l += 0.01) {
    const sum = [...Array(n).keys()].reduce((s, i) => s + instantWeight(i, l), 0);
    near(sum, MOMENT.weight, 1e-9, `at level ${l.toFixed(2)}`);
  }
  assert.equal(level(MOMENT.finer[0]), 3);
  assert.equal(level(MOMENT.finer[1]), 6);
});

test('the depth and the camera: none at the window, opened, held, closed slowest last', () => {
  const W = 1440, H = 900;
  assert.equal(depthAt(MOMENT.depth[0], W, H), 0);
  assert.equal(depthAt(MOMENT.close[2], W, H), 0);
  const Dm = depthAt(0.6, W, H);
  near(Dm, MOMENT.depthOf * W, 1e-6);
  const a = depthAt(MOMENT.close[2] - 0.05, W, H), b = depthAt(MOMENT.close[2] - 0.01, W, H);
  assert.ok(a < 0.02 * Dm && b < a, 'thinner than glass, then paper');
  // At rest the camera sees the window exactly: a ray through screen point s meets z = 0 at s.
  const v = viewAt(-0.2);
  assert.deepEqual([v.yaw, v.pitch, v.dolly], [0, 0, 1]);
  for (const s of [[0, 0], [W / 2, H / 2], [W, H], [300, 700]]) {
    const { o, d } = rayAt(s, W, H, 0, v), l = -o[2] / d[2];
    near(o[0] + d[0] * l, s[0], 1e-6); near(o[1] + d[1] * l, s[1], 1e-6);
  }
  const held = viewAt(0.58);
  assert.ok(held.yaw > 0.3 && held.dolly > 1.2, 'beside it while held');
  const back = viewAt(MOMENT.close[1]);
  assert.deepEqual([back.yaw, back.pitch, back.dolly], [0, 0, 1]);
});

test('the crossing integral: an edge\'s exposure is w√π/|f′|, brighter the slower it is crossed', () => {
  const w = 0.05, N = 400, u0 = 0, u1 = 1;
  for (const k of [2, 8, 30]) {
    const fs = Array.from({ length: N + 1 }, (_, i) => (u0 + (u1 - u0) * i / N - 0.5) * k);
    near(crossingIntegral(fs, u0, u1, w), w * Math.sqrt(Math.PI) / k, 1e-9, `slope ${k}`);
    // the same as integrating e^(−(f/w)²) directly
    let s = 0;
    for (let i = 0; i < 20000; i++) { const u = (i + 0.5) / 20000, f = (u - 0.5) * k; s += Math.exp(-((f / w) ** 2)) / 20000; }
    near(crossingIntegral(fs, u0, u1, w), s, 1e-3);
  }
});

test('development and the meniscus: the paper\'s curve, darkest first, from the lower corner', () => {
  let prev = -1;
  for (let x = 0; x <= 1; x += 0.05) { const D = hdDensity(x); assert.ok(D > prev && D <= HD.dmax); prev = D; }
  assert.ok(induction(0.9) < induction(0.3));
  for (const x of [0.2, 0.5, 0.8]) {
    assert.equal(densityAt(x, 0), 0);
    assert.ok(densityAt(x, 1) > 0.95 * hdDensity(x));
  }
  assert.ok(densityAt(0.85, 0.25) > densityAt(0.35, 0.25) * 3, 'the deep tones gather first');
  near(grainFraction(0), 0, 1e-12); near(grainFraction(HD.dmax), 1, 1e-12);
  assert.equal(wetAt(0, 1), 0, 'it meets the developer at its lower left corner');
  assert.ok(wetAt(1, 0) >= 0.9, 'and the far corner last');
  for (let s = 0.1; s < 1; s += 0.1) assert.ok(wetAt(s, 1 - s) > wetAt(s - 0.1, 1 - s + 0.1));
  assert.ok(wetAt(0.5, 0.5) < wetAt(0, 0) && wetAt(0.5, 0.5) < wetAt(1, 1), 'its front bowed, the middle ahead');
});

test('the shader: its clock, path, weights and curves from the plan, and the hold\'s pace', () => {
  const f = x => Number(x).toFixed(4).replace('.', '\\.').replace('-', '\\-');
  for (const [k, v] of [['MO_REM', MOMENT.remember], ['MO_DEP', MOMENT.depth], ['MO_SHUT', MOMENT.shutter], ['MO_WET', MOMENT.wet]]) {
    assert.match(MOMENT_GLSL, new RegExp(`${k} = vec2\\(${f(v[0])}, ${f(v[1])}\\)`), k);
  }
  assert.match(MOMENT_GLSL, new RegExp(`MO_W = ${f(MOMENT.weight)}`));
  assert.match(MOMENT_GLSL, /float e = \.6 \* t \* t \* \(3\.0 - 2\.0 \* t\) \+ \.4 \* t;\n  return R \* vec2\(\.88 - \.78 \* e, \.8 - \.44 \* e \+ \.055 \* sin\(6\.2831853 \* 1\.25 \* t \+ \.4\)\);/, 'the lantern\'s path mirrors lampAt');
  assert.match(MOMENT_GLSL, /return clamp\(\.92 \* a \+ \.08 \* 4\.0 \* b \* b, 0\.0, 1\.0\);/, 'the meniscus mirrors wetAt');
  assert.match(MOMENT_GLSL, /float ti = \.04 \+ \.34 \* \(1\.0 - smoothstep\(\.2, \.9, x\)\);/, 'the induction time mirrors');
  assert.match(MOMENT_GLSL, /MO_DMAX = 2\.0000, MO_GAMMA = 5\.5000, MO_X0 = 0\.6000, MO_TAU = 0\.1600/);
  assert.equal(easeFor('darkroom'), darkroomEase);
  assert.ok(HOLD.by.darkroom.pin >= 3);
  let prev = -1;
  for (let r = 0; r <= 1; r += 0.01) { const p = darkroomEase(r); assert.ok(p >= prev); prev = p; near(darkroomRaw(-0.2 + 1.4 * p), r, 2e-3); }
  const per = (a, b) => (darkroomRaw(b) - darkroomRaw(a)) / (b - a);
  assert.ok(per(0.86, MOMENT.close[2]) > per(MOMENT.shutter[0], MOMENT.shutter[1]), 'time closes slower than the shutter falls');
  assert.ok(per(MOMENT.drift[0], MOMENT.drift[1]) > per(MOMENT.remember[0], MOMENT.remember[1]), 'the held moment unhurried');
});
