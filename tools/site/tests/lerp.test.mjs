// node --test tools/site/tests/*.test.mjs    Motion and colour maths (static/site/lerp.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHex, toOklab, oklabCss, mixOklab, approach, seamAt, smoothstep, easeInOutCubic,
  transitP, flightAt, arrivalRange, HOLD, holdAt, holdFor, holdEase,
  layerArrival, filmArrival, filmU, filmNeg, carveMaze, VORTEX, vortexDrop, vortexSeamA, vortexU, coreEase, vortexTurn, vortexAt,
} from '../../../static/site/lerp.js';

const { order, styles } = JSON.parse(readFileSync(new URL('../../../static/site/styles.json', import.meta.url), 'utf8'));

test('hex parsing, with and without alpha', () => {
  assert.deepEqual(parseHex('#FF0000'), [1, 0, 0, 1]);
  assert.deepEqual(parseHex('#00000080').map(v => Number(v.toFixed(3))), [0, 0, 0, 0.502]);
  assert.throws(() => parseHex('red'));
});

test('OKLab reference points and the mix', () => {
  const [L0] = toOklab('#000000');
  const [L1, a1, b1] = toOklab('#FFFFFF');
  assert.ok(Math.abs(L0) < 1e-6);
  assert.ok(Math.abs(L1 - 1) < 1e-4 && Math.abs(a1) < 1e-4 && Math.abs(b1) < 1e-4);
  assert.equal(oklabCss([0.5, 0.1, -0.1, 1]), 'oklab(0.5 0.1 -0.1)');
  assert.equal(oklabCss([0.5, 0, 0, 0.25]), 'oklab(0.5 0 0 / 0.25)');
  const ink = toOklab(styles.ink.colors.ink), neon = toOklab(styles.cosmos.colors.ink);
  assert.equal(mixOklab(ink, neon, 0), oklabCss(ink));
  assert.equal(mixOklab(ink, neon, 1), oklabCss(neon));
  assert.equal(mixOklab(ink, neon, 7), oklabCss(neon));
});

test('every style has the six colours and a scene id', () => {
  const ids = new Set();
  for (const id of order) {
    for (const key of ['bg', 'surface', 'ink', 'mute', 'accent', 'rule']) assert.ok(styles[id].colors[key], `${id}.${key}`);
    assert.ok(Number.isInteger(styles[id].scene));
    ids.add(styles[id].scene);
  }
  assert.equal(ids.size, order.length);
  assert.equal(styles.house.scene, 0);
});

test('approach is independent of frame rate', () => {
  assert.equal(approach(0, 1, 0.016, 0), 1);
  let a = 0, b = 0;
  for (let k = 0; k < 60; k++) a = approach(a, 1, 1 / 60, 0.11);
  for (let k = 0; k < 30; k++) b = approach(b, 1, 1 / 30, 0.11);
  assert.ok(Math.abs(a - b) < 1e-3, `${a} vs ${b}`);
  assert.ok(a > 0.99);
  let c = 0;
  for (let k = 0; k < 6; k++) c = approach(c, 1, 1 / 60, 0.11);
  assert.ok(c > 0.4 && c < 0.7, `after 100 ms: ${c}`);
  assert.equal(approach(0.99995, 1, 1 / 60, 0.11), 1);
});

test('a seam\'s edge stays inside the seam and moves with the meeting line', () => {
  assert.equal(seamAt(0.5), 0.5);
  assert.ok(seamAt(0) > 0.2 && seamAt(1) < 0.8);
  assert.equal(seamAt(-3), seamAt(0));
  assert.equal(seamAt(9), seamAt(1));
  for (let h = 0; h < 1; h += 0.05) assert.ok(seamAt(h + 0.05) > seamAt(h));
});

test('the six styles: house, the four destination worlds and the two new ones, in scene order', () => {
  assert.deepEqual(order, ['house', 'ink', 'glass', 'cosmos', 'folio', 'darkroom']);
  assert.deepEqual(order.map(id => styles[id].scene), [0, 1, 2, 3, 4, 5]);
});

test('eases', () => {
  assert.equal(smoothstep(-1), 0);
  assert.equal(smoothstep(2), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
});

// Arrivals a point at height rn (0 foot, 1 top) can have, sampled across their range.
const arrivals = rn => { const [lo, hi] = arrivalRange(rn); return [lo, (lo + hi) / 2, hi]; };

test('transits: at rest at either end of the hold, and the strip’s edges meet their bands', () => {
  const jits = [0, 0.5, 1];
  for (let rn = 0; rn <= 1; rn += 0.02) for (const A of arrivals(rn)) for (const j of jits) {
    assert.equal(flightAt(A, transitP(0), j), 0, `start rn=${rn}`);
    assert.equal(flightAt(A, transitP(1), j), 1, `end rn=${rn}`);
  }
  // Scrolling down (p rising) only ever moves a point forward: the transit is reversible.
  for (const A of [0, 0.3, 0.7, 1]) {
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.02) { const u = flightAt(A, transitP(p)); assert.ok(u >= prev); prev = u; }
  }
});

// A held seam is drawn on the whole screen as if held, and the strip's place only reveals it: from the
// foot of the screen up as it scrolls in, down to it as it leaves. Each transition starts at the foot
// (right beneath the band above) and gives it time: while the strip comes in, whatever lies at its top
// edge, beside the band above, is still at rest; while it leaves, what lies at its foot, beside the
// band below, has settled. edges(style) walks a hold on a desktop and on a phone, giving the progress
// p it plays at (eased) and where the strip's top edge (yn, 0 the top of the screen) or foot is.
const edges = (style, phone = true) => {
  const out = [];
  for (const [vh, pin] of phone ? [[900, HOLD.pin], [844, HOLD.pinTouch]] : [[900, HOLD.pin]]) {
    const L = holdFor(style), H = vh * (1 + pin * L.pin), T = 5000;
    for (let sy = T - L.leadIn * vh; sy <= T + H; sy += 5) {
      const { y, p } = holdAt(sy, T, H, vh, L.leadIn, L.leadOut);
      out.push({ P: transitP(holdEase(p)), top: y > 0 ? y / vh : null, foot: y < 0 ? 1 + y / vh : null });
    }
  }
  return out;
};

test('holds: a transit begins as its strip comes on screen, and plays slowly at first', () => {
  for (const style of ['cosmos', 'glass', 'folio', 'darkroom', 'ink']) {
    const L = holdFor(style), vh = 900, H = vh * (1 + HOLD.pin * L.pin), T = 5000;
    assert.equal(holdAt(T - L.leadIn * vh, T, H, vh, L.leadIn, L.leadOut).p, 0);
    assert.ok(Math.abs(holdAt(T - L.leadIn * vh, T, H, vh, L.leadIn, L.leadOut).y - L.leadIn * vh) < 1e-9);
    assert.ok(Math.abs(holdAt(T + H - vh + L.leadOut * vh, T, H, vh, L.leadIn, L.leadOut).p - 1) < 1e-9);
    let prev = -1;
    for (let sy = T - vh; sy <= T + H; sy += 7) { const { p } = holdAt(sy, T, H, vh, L.leadIn, L.leadOut); assert.ok(p >= prev); prev = p; }
  }
  assert.equal(holdEase(0), 0);
  assert.equal(holdEase(1), 1);
  assert.ok(holdEase(0.2) < 0.2);
});

test('processes: the ink rests at the strip\'s top edge while it comes in, and has let go by its foot', () => {
  for (const { P, top } of edges('ink')) if (top !== null) {
    const rn = 1 - top;
    for (const A of [arrivalRange(rn)[0], arrivalRange(rn)[1]]) for (const j of [0, 1]) assert.equal(flightAt(A, P, j), 0, `top=${top} P=${P}`);
  }
  // The ink lets go (glsl/transit.js inkLetGo) by P 1.02, before the strip's foot shows.
  for (const { P, foot } of edges('ink')) if (foot !== null) assert.ok(P >= 1.02, `P=${P}`);
});

test('processes: the sheets rest at the top edge while the strip comes in, and are gone from its foot as it leaves', () => {
  // (On a desktop. A phone's shorter hold lets the sweep reach the top edge just before it is held.)
  for (const { P, top } of edges('folio', false)) if (top !== null) {
    for (let xn = 0; xn <= 1; xn += 0.1) for (const jit of [0, 1]) assert.equal(flightAt(layerArrival(0, 1 - top, xn, jit), P), 0, `top=${top} P=${P}`);
  }
  for (const { P, foot } of edges('folio')) if (foot !== null) {
    const rn = 1 - foot;
    for (let k = 0; k < 3; k++) for (let xn = 0; xn <= 1; xn += 0.1) for (const jit of [0, 1]) assert.equal(flightAt(layerArrival(k, rn, xn, jit), P), 1, `foot=${foot} k=${k}`);
  }
  // Every sheet of every layer peels within the transit, each layer after the one above it.
  for (let rn = 0; rn <= 1; rn += 0.05) for (let xn = 0; xn <= 1; xn += 0.1) for (const jit of [0, 1]) for (let k = 0; k < 3; k++) {
    assert.equal(flightAt(layerArrival(k, rn, xn, jit), transitP(0)), 0);
    assert.equal(flightAt(layerArrival(k, rn, xn, jit), transitP(1)), 1);
    if (k) assert.ok(layerArrival(k, rn, xn, 0.5) > layerArrival(k - 1, rn, xn, 0.5) + 0.2);
  }
});

test('processes: film is exposed and pulled from the foot up, resting at the top edge while it comes in', () => {
  for (const { P, top } of edges('darkroom')) if (top !== null) for (const jit of [0, 1]) {
    const A = filmArrival(1 - top, jit);
    assert.equal(filmNeg(A, P), 0, `top=${top}`);
    assert.equal(filmU(A, P), 0, `top=${top}`);
  }
  for (const { P, foot } of edges('darkroom')) if (foot !== null) for (const jit of [0, 1]) assert.equal(filmU(filmArrival(1 - foot, jit), P), 1);
  for (let rn = 0; rn <= 1; rn += 0.05) for (const jit of [0, 1]) {
    const A = filmArrival(rn, jit);
    assert.equal(filmNeg(A, transitP(0)), 0);
    assert.equal(filmU(A, transitP(1)), 1);
    // Exposed to a negative before it is pulled.
    assert.equal(filmNeg(A, A - 0.2), 1);
  }
});

test('processes: a vortex cube leaves its cell flat and lands flat, mirrored across the axis and lower', () => {
  const ax = 720;
  for (const home of [[20, 30], [700, -120], [1430, 890], [300, 600], [1100, 120]]) for (const turns of [3, 5]) for (const drop of [0, 342, -200]) {
    const a = vortexAt(home, drop, ax, 117, turns, 0), b = vortexAt(home, drop, ax, 117, turns, 1);
    for (const [got, want] of [[a, [home[0], home[1], 0]], [b, [2 * ax - home[0], home[1] + drop, 0]]]) {
      got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-6, `${home} turns=${turns}: ${got} vs ${want}`));
    }
  }
});

test('processes: every cell of a vortex seam sends one cube and receives one (some from below the screen)', () => {
  for (const [cols, rows] of [[1, 1], [7, 5], [120, 75], [30, 53]]) {
    const kd = vortexDrop(rows), got = new Map();
    for (let r = 0; r < rows + kd; r++) for (let c = 0; c < cols; c++) {
      const d = [cols - 1 - c, r - kd];
      if (d[1] >= 0) got.set(d.join(), (got.get(d.join()) || 0) + 1);
    }
    assert.equal(got.size, cols * rows);
    assert.ok([...got.values()].every(n => n === 1));
  }
});

test('processes: the vortex turns and rises fastest at its core', () => {
  for (const [f, K] of [[vortexTurn, VORTEX.spin], [u => coreEase(u, VORTEX.sink), VORTEX.sink]]) {
    assert.equal(f(0), 0);
    assert.ok(Math.abs(f(1) - 1) < 1e-12);
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.01) { assert.ok(f(u) > prev); prev = f(u); }
    const rate = u => (f(u + 1e-6) - f(u)) / 1e-6;
    assert.ok(Math.abs(rate(0.5) / rate(1e-6) - (1 + K)) < 1e-3);
  }
});

test('processes: the vortex gathers the page from the foot up, at rest at both ends and at the strip\'s edges', () => {
  const S = [1440, 900], rows = 90, ch = S[1] / rows, kd = vortexDrop(rows), drop = kd * ch;
  const home = (r, x = 500) => [x, (r + 0.5) * ch];
  // Higher cells go later (away from the noise of the schedule); each cell's own cube leaves before
  // the one bound for it, from kd rows below, lands.
  for (let r = 0; r < rows - 1; r++) assert.ok(vortexSeamA(home(r), S) > vortexSeamA(home(r + 1), S), `r=${r}`);
  for (let r = 0; r < rows; r++) for (const j of [0, 1]) for (const x of [10, 720, 1430]) {
    const own = vortexSeamA(home(r, x), S, j), inc = vortexSeamA(home(r + kd, S[0] - x), S, 1 - j);
    assert.ok(own - VORTEX.d / 2 < inc + VORTEX.d / 2, `r=${r}`);
  }
  for (let r = 0; r < rows + kd; r++) for (const j of [0, 0.5, 1]) {
    const A = vortexSeamA(home(r), S, j);
    assert.equal(vortexU(A, transitP(0)), 0, `r=${r}`);
    assert.equal(vortexU(A, transitP(1)), 1, `r=${r}`);
  }
  // The cells at the strip's top edge while it comes in are still paper.
  for (const { P, top } of edges('cosmos')) if (top !== null) for (const j of [0, 1]) for (const x of [10, 720, 1430]) {
    assert.equal(vortexU(vortexSeamA([x, top * S[1]], S, j), P), 0, `top=${top} P=${P}`);
  }
  void drop;
});

test('processes: the maze is a spanning tree carved from the start', () => {
  for (const [cols, rows, start, seed] of [[1, 1, [0, 0], 1], [7, 5, [3, 2], 9], [43, 27, [40, 0], 4], [12, 30, [0, 29], 77]]) {
    const { order, from } = carveMaze(cols, rows, start, seed);
    const N = cols * rows;
    assert.equal(new Set(order).size, N);
    assert.ok([...order].every(o => o >= 0 && o < N));
    assert.equal(order[start[1] * cols + start[0]], 0);
    // Every other cell was entered from a neighbour reached before it.
    const DELTA = { 1: [-1, 0], 2: [1, 0], 3: [0, -1], 4: [0, 1] };
    for (let i = 0; i < N; i++) {
      if (order[i] === 0) { assert.equal(from[i], 0); continue; }
      const [dc, dr] = DELTA[from[i]];
      const c = (i % cols) + dc, r = Math.floor(i / cols) + dr;
      assert.ok(c >= 0 && r >= 0 && c < cols && r < rows);
      assert.ok(order[r * cols + c] < order[i]);
    }
  }
});
