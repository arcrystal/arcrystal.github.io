// node --test tools/site/tests/*.test.mjs    Motion and colour maths (static/site/lerp.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHex, toOklab, oklabCss, mixOklab, approach, seamAt, smoothstep, easeInOutCubic,
  transitP, flightAt, arrivalRange, activeRows, HOLD, holdAt,
  paneArrival, irisOpen, carveMaze, VORTEX, vortexDrop, vortexSeamA, vortexU, coreEase, vortexTurn, vortexAt,
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
  // While the strip's top is on screen above the hold its top edge is still the upper world; while
  // its foot is on screen below, the foot is the lower world.
  const vh = 900, H = vh * (1 + HOLD.pin), T = 5000;
  for (let sy = T - vh; sy <= T + H; sy += 10) {
    const { y, p } = holdAt(sy, T, H, vh);
    const P = transitP(p);
    if (y > 0) for (let rn = 0.95; rn <= 1; rn += 0.01) for (const A of arrivals(rn)) for (const j of jits) assert.equal(flightAt(A, P, j), 0, `top sy=${sy}`);
    if (y < 0) for (let rn = 0; rn <= 0.05; rn += 0.01) for (const A of arrivals(rn)) for (const j of jits) assert.equal(flightAt(A, P, j), 1, `foot sy=${sy}`);
    if (sy >= T && sy <= T + H - vh) assert.equal(y, 0);
  }
  // Scrolling down (p rising) only ever moves a point forward: the transit is reversible.
  for (const A of [0, 0.3, 0.7, 1]) {
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.02) { const u = flightAt(A, transitP(p)); assert.ok(u >= prev); prev = u; }
  }
});

test('transits: every row with a unit in flight is drawn', () => {
  for (const rows of [5, 37, 85, 120]) for (let p = 0; p <= 1; p += 0.05) {
    const P = transitP(p);
    const [from, to] = activeRows(P, rows);
    for (let r = 0; r < rows; r++) {
      const rn = 1 - (r + 0.5) / rows;
      const [lo, hi] = arrivalRange(rn);
      for (let A = lo; A <= hi; A += 0.01) for (const j of [0, 1]) {
        const u = flightAt(A, P, j);
        if (u > 0 && u < 1) assert.ok(r >= from && r < to, `rows=${rows} r=${r} p=${p}`);
      }
    }
  }
});

// The other processes keep the same promise: at rest at both ends of the hold, the strip's top
// untouched while it is on screen above the hold, its foot settled while it is on screen below.
const holdEdges = () => {
  const vh = 900, H = vh * (1 + HOLD.pin), T = 5000, out = [];
  for (let sy = T - vh; sy <= T + H; sy += 10) out.push(holdAt(sy, T, H, vh));
  return out;
};

test('processes: the panes peel within the hold, and both edges keep their bands', () => {
  for (let rn = 0.05; rn <= 0.95; rn += 0.05) for (let xn = 0; xn <= 1; xn += 0.1) for (const jit of [0, 0.5, 1]) {
    const A = paneArrival(rn, xn, jit);
    assert.equal(flightAt(A, transitP(0)), 0);
    assert.equal(flightAt(A, transitP(1)), 1);
  }
  for (const { y, p } of holdEdges()) {
    const P = transitP(p);
    // The top row of panes (centres from 0.9 of the strip up) and the bottom row (to 0.1).
    if (y > 0) for (let xn = 0; xn <= 1; xn += 0.1) for (const jit of [0, 1]) assert.equal(flightAt(paneArrival(0.9, xn, jit), P), 0);
    if (y < 0) for (let xn = 0; xn <= 1; xn += 0.1) for (const jit of [0, 1]) assert.equal(flightAt(paneArrival(0.1, xn, jit), P), 1);
  }
});

test('processes: the iris is wide open before and after the hold, and shut at its middle', () => {
  for (const { y, p } of holdEdges()) if (y !== 0) assert.equal(irisOpen(p), 1, `p=${p}`);
  assert.equal(irisOpen(0.5), 0);
  let prev = 2;
  for (let p = 0; p <= 0.5; p += 0.01) { assert.ok(irisOpen(p) <= prev); prev = irisOpen(p); }
  for (let p = 0.5; p <= 1; p += 0.01) { assert.ok(irisOpen(p) >= prev); prev = irisOpen(p); }
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

test('processes: every cell of a vortex seam sends one cube and receives one (some from the band above)', () => {
  for (const [cols, rows] of [[1, 1], [7, 5], [120, 75], [30, 53]]) {
    const kd = vortexDrop(rows), got = new Map();
    for (let r = -kd; r < rows; r++) for (let c = 0; c < cols; c++) {
      const d = [cols - 1 - c, r + kd];
      if (d[1] < rows) got.set(d.join(), (got.get(d.join()) || 0) + 1);
    }
    assert.equal(got.size, cols * rows);
    assert.ok([...got.values()].every(n => n === 1));
  }
});

test('processes: the vortex turns and sinks fastest at its core', () => {
  for (const [f, K] of [[vortexTurn, VORTEX.spin], [u => coreEase(u, VORTEX.sink), VORTEX.sink]]) {
    assert.equal(f(0), 0);
    assert.ok(Math.abs(f(1) - 1) < 1e-12);
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.01) { assert.ok(f(u) > prev); prev = f(u); }
    const rate = u => (f(u + 1e-6) - f(u)) / 1e-6;
    assert.ok(Math.abs(rate(0.5) / rate(1e-6) - (1 + K)) < 1e-3);
  }
});

test('processes: the vortex travels down toward Science, at rest at both ends, its edge rows outside the pinned hold', () => {
  const S = [1440, 900], rows = 75, ch = S[1] / rows, kd = vortexDrop(rows), drop = kd * ch;
  const cube = r => { const home = [500, (r + 0.5) * ch]; return [home, [S[0] - 500, home[1] + drop]]; };
  // Higher cells go first, from the band above down (until the bottom rows, which must settle before
  // the strip's foot shows); and each cell's own cube leaves before the one bound for it lands.
  for (let r = -kd; r < rows - kd - 12; r++) assert.ok(vortexSeamA(...cube(r), S) < vortexSeamA(...cube(r + 1), S), `r=${r}`);
  for (let r = 0; r < rows; r++) for (const j of [0, 1]) {
    const own = vortexSeamA(...cube(r), S, j), inc = vortexSeamA(...cube(r - kd), S, 1 - j);
    assert.ok(own - VORTEX.d / 2 < inc + VORTEX.d / 2, `r=${r}`);
  }
  for (let r = -kd; r < rows; r++) for (const jit of [0, 0.5, 1]) {
    const A = vortexSeamA(...cube(r), S, jit);
    assert.equal(vortexU(A, transitP(0)), 0, `r=${r}`);
    assert.equal(vortexU(A, transitP(1)), 1, `r=${r}`);
  }
  // Its longer hold (HOLD.longer.cosmos) pins the strip until P1: on a phone, the shortest, a cube
  // leaving or landing in the bottom row has finished by then, before the foot shows above Science.
  const L = HOLD.longer.cosmos, vh = 844, H = vh * (1 + HOLD.pinTouch * L.pin), R = H - vh, lead = L.lead * vh;
  const P1 = transitP(1 - lead / (R + 2 * lead));
  for (const jit of [0, 1]) for (const r of [rows - kd - 1, rows - 1]) {
    assert.equal(vortexU(vortexSeamA(...cube(r), S, jit), P1), 1, `r=${r}`);
  }
  assert.equal(vortexU(vortexSeamA(...cube(rows - 1 - kd), S, 0), P1), 1);
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
