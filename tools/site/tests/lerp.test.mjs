// node --test tools/site/tests/*.test.mjs    Motion and colour maths (static/site/lerp.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHex, toOklab, oklabCss, mixOklab, approach, seamAt, smoothstep, easeInOutCubic,
  transitP, flightAt, arrivalRange, HOLD, holdAt, holdFor, holdEase,
  layerArrival, filmArrival, filmU, filmNeg, carveMaze, VORTEX, vortexWindOn, vortexWindOff, vortexPace, coreEase, vortexTurn, vortexAt,
  vortexBand, vortexWide, vortexSharp, vortexFunnel, vortexHug, vortexSweep, vortexSwarm, vortexSwerve, vortexRise, vortexOrbit,
  vortexPlan, vortexPlanTexels,
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

test('processes: a click\'s vortex cube leaves its cell flat and lands flat, mirrored across the axis and lower', () => {
  const ax = 720;
  for (const home of [[20, 30], [700, -120], [1430, 890], [300, 600], [1100, 120]]) for (const turns of [3, 5, 7, 11]) for (const drop of [0, 342, -200]) for (const phase of [0, -2.9, 3.1]) {
    const a = vortexAt(home, drop, ax, 117, turns, 0, phase), b = vortexAt(home, drop, ax, 117, turns, 1, phase);
    for (const [got, want] of [[a, [home[0], home[1], 0]], [b, [2 * ax - home[0], home[1] + drop, 0]]]) {
      got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-6, `${home} turns=${turns}: ${got} vs ${want}`));
    }
  }
});

test('processes: each cube keeps its own pace through the vortex, starting and ending with the rest', () => {
  for (const a of [-0.7, -0.3, 0, 0.4, 0.7]) {
    assert.equal(vortexPace(0, a), 0);
    assert.equal(vortexPace(1, a), 1);
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.01) { assert.ok(vortexPace(u, a) > prev); prev = vortexPace(u, a); }
  }
});

test('processes: a click\'s cube turns fastest at the core', () => {
  assert.equal(vortexTurn(0), 0);
  assert.ok(Math.abs(vortexTurn(1) - 1) < 1e-12);
  let prev = -1;
  for (let u = 0; u <= 1.0001; u += 0.01) { assert.ok(vortexTurn(u) > prev); prev = vortexTurn(u); }
  const K = VORTEX.sink, f = u => coreEase(u, K);
  assert.equal(f(0), 0);
  assert.ok(Math.abs(f(1) - 1) < 1e-12);
  assert.ok(Math.abs((f(0.5 + 1e-6) - f(0.5)) / (f(1e-6) - f(0)) - (1 + K)) < 1e-3);
});

test('processes: a seam\'s cube is swept onto the wind, goes round the vortex 2 to 4½ times with the swarms, and is thrown onto its new cell', () => {
  // Its sweep: slow as it lifts off, steady round the vortex, easing as it is thrown.
  assert.equal(vortexSweep(0), 0);
  assert.ok(Math.abs(vortexSweep(1) - 1) < 1e-12);
  let prev = -1;
  for (let u = 0; u <= 1.0001; u += 0.01) { assert.ok(vortexSweep(u) > prev); prev = vortexSweep(u); }
  const rate = u => (vortexSweep(u + 1e-6) - vortexSweep(u)) / 1e-6;
  for (let u = VORTEX.in + 0.01; u <= 1 - VORTEX.out - 0.01; u += 0.05) assert.ok(Math.abs(rate(u) - rate(0.5)) < 1e-3, `u=${u}`);
  assert.ok(rate(0.5) > 8 * rate(0.001));
  // The swarms draw a cube toward the nearest clump, never past it: its angle still only advances,
  // and cubes spread evenly round the ring bunch up five times over.
  for (let phi = 0; phi < 7; phi += 0.01) assert.ok(vortexSwarm(phi + 0.01, 0.4, 3, 0.9) > vortexSwarm(phi, 0.4, 3, 0.9));
  const bins = new Array(40).fill(0);
  for (let i = 0; i < 4000; i++) bins[Math.floor((((vortexSwarm(i / 4000 * 2 * Math.PI, 0.4, 3, 0.9) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * 40)]++;
  assert.ok(Math.max(...bins) > 4 * Math.max(1, Math.min(...bins)), `${Math.max(...bins)} vs ${Math.min(...bins)}`);
  // A throw's swerve along the Lorenz attractor is nothing at either end and real in between.
  for (const p0 of [[2, 3, 22], [-4, 9, 18], [8, -3, 26]]) {
    for (const tau of [0, 1]) vortexSwerve(p0, tau).forEach(v => assert.ok(Math.abs(v) < 1e-9));
    assert.ok(Math.hypot(...vortexSwerve(p0, 0.5)) > 3, `${p0}`);
  }
  // The funnel the cubes ride: wide at the wind's foot, closed in to the core by halfway up.
  const band = vortexBand(0.4, [1440, 900]);
  assert.ok(Math.abs(vortexFunnel(band[1], band) - 1) < 1e-9);
  assert.ok(Math.abs(vortexFunnel((band[0] + band[1]) / 2, band) - 0.1) < 0.02);
  for (let y = band[1]; y > band[0]; y -= 10) assert.ok(vortexFunnel(y - 10, band) <= vortexFunnel(y, band) + 1e-12);
  const S = [1440, 900], ax = 720;
  for (const home of [[20, 600], [700, 880], [1430, 500], [300, 40], [1100, 120]]) for (const dest of [[900, 520], [100, 840]]) for (const whole of [2, 3, 4]) for (const P of [0.2, 0.5, 0.8, 1.0]) {
    const o = { f: 0.9, whole, lift: 0.2, seed: [0.3, 0.6, 0.8] };
    const a = vortexOrbit(home, dest, o, 0, P, 4, S), b = vortexOrbit(home, dest, o, 1, P, 4, S);
    for (const [got, want] of [[a.at, [...home, 0]], [b.at, [...dest, 0]]]) got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-9, `${home} → ${got} vs ${want}`));
    // Its other face up: an odd number of half turns of its own, and 2 to 4½ times round the vortex.
    assert.ok(Math.abs(Math.cos(b.th) + 1) < 1e-9);
    assert.ok(b.turns >= 4 && b.turns <= 9);
    // Round the vortex while the wind holds it, behind the axis and in front of it.
    let behind = false, front = false, first = null, last = null;
    for (let u = 0; u <= 1; u += 0.004) {
      const q = vortexOrbit(home, dest, o, u, P, 4, S);
      if (q.grip > 0.95) {
        first ??= q.phi; last = q.phi;
        if (q.at[2] < -0.3 * q.rad) behind = true;
        if (q.at[2] > 0.3 * q.rad) front = true;
        assert.ok(q.rad >= vortexHug * 0.8 * vortexWide(vortexBand(P, S), S) - 1e-9);
      }
    }
    assert.ok(last - first > 1.3 * 2 * Math.PI, `${home} whole=${whole}: ${(last - first) / 2 / Math.PI}`);
    assert.ok(behind && front, `${home} whole=${whole} P=${P}`);
  }
});

// Science's plan on the grids transit.js makes (18 px cells, 22 on touch screens).
const PLAN_GRIDS = [[80, 50], [18, 38], [107, 49], [44, 33], [5, 3], [1, 1]];
const rowUp = (r, rows) => 1 - (r + 0.5) / rows;

test('processes: every cell of a vortex seam sends one cube and receives one, after its paper has gone, and is sharp before the wind there dies', () => {
  for (const [cols, rows] of PLAN_GRIDS) {
    const p = vortexPlan(cols, rows), N = cols * rows, got = new Uint8Array(N), tx = vortexPlanTexels(p);
    // The blur's timing anywhere in a cell: at most the latest landing round it or its neighbours.
    const nearMax = i => {
      const r = Math.floor(i / cols), c = i % cols;
      let m = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) m = Math.max(m, tx[(rr * cols + cc) * 4 + 3]); }
      return m;
    };
    for (let i = 0; i < N; i++) {
      const d = p.dest[i];
      got[d]++;
      // Every flight is the same length, and none is still going at either end of the hold.
      assert.ok(Math.abs(p.land[d] - p.leave[i] - VORTEX.d) < 1e-9);
      assert.ok(p.leave[i] > transitP(0) && p.land[d] < transitP(1) - 0.1, `${cols}×${rows} ${i}`);
    }
    assert.ok(got.every(n => n === 1), `${cols}×${rows}`);
    for (let i = 0; i < N; i++) {
      const up = rowUp(Math.floor(i / cols), rows);
      assert.ok(p.land[i] >= p.leave[i] + VORTEX.gap - 1e-9, `${cols}×${rows} cell ${i} built before its paper went`);
      // Blurred as it lands and for a while after; sharp by the time the wind there dies, and at the end.
      const q = [((i % cols) + 0.5) / cols * 1440, (Math.floor(i / cols) + 0.5) / rows * 900];
      assert.ok(tx[i * 4 + 3] >= Math.fround(p.land[i]));
      for (const n of [0, 1]) {
        assert.equal(vortexSharp(q, tx[i * 4 + 3], Math.fround(p.land[i]) + VORTEX.blurWait - 1e-7, [1440, 900], n), 0);
        const late = nearMax(i), wind = vortexWindOff(Math.max(0, up - 0.5 / rows));
        // (Any real screen has at least 16 rows of cells; on fewer a cell's neighbours span the screen.)
        if (rows >= 16) assert.equal(vortexSharp(q, late, wind, [1440, 900], n), 1, `${cols}×${rows} cell ${i} still blurred when the wind there dies`);
        assert.equal(vortexSharp(q, late, transitP(1), [1440, 900], n), 1);
      }
    }
    // The texture: a texel a cell, as the shaders read it.
    for (let i = 0; i < N; i += 7) assert.deepEqual([...tx.slice(i * 4, i * 4 + 3)], [p.dest[i], Math.fround(p.leave[i]), Math.fround(p.land[i])]);
  }
  // Only ever sharper as the vortex works: at the foot soon after it is built; higher up, not until
  // the wind's base has lifted and its ring's front climbs to it.
  const S = [1440, 900];
  for (const q of [[100, 880], [720, 860], [1300, 450], [720, 450], [200, 60], [720, 30]]) for (const land of [0.1, 0.4, 0.7]) {
    let prev = 0;
    for (let P = land; P <= 1.2; P += 0.005) { const s = vortexSharp(q, land, P, S); assert.ok(s >= prev - 1e-12, `${q} ${land} ${P}`); prev = s; }
  }
  assert.equal(vortexSharp([720, 860], 0.1, 0.1 + VORTEX.blurWait + VORTEX.blurD, S), 1);
  assert.equal(vortexSharp([1300, 450], 0.3, 0.7, S), 0);
  assert.ok(vortexSharp([1300, 450], 0.3, 1.0, S) > 0.99);
  // The same screen always builds the same way.
  assert.deepEqual([...vortexPlan(44, 33).dest], [...vortexPlan(44, 33).dest]);
});

test('processes: the vortex stands on the foot and grows, and the page is gathered up the screen behind it, the lower heights still giving up cubes as higher ones start', () => {
  for (const [cols, rows] of PLAN_GRIDS.slice(0, 4)) {
    const p = vortexPlan(cols, rows);
    const win = (lo, hi) => {
      let a = Infinity, b = -Infinity;
      for (let r = 0; r < rows; r++) { const up = rowUp(r, rows); if (up < lo || up >= hi) continue; for (let c = 0; c < cols; c++) { a = Math.min(a, p.leave[r * cols + c]); b = Math.max(b, p.leave[r * cols + c]); } }
      return [a, b];
    };
    const bottom = win(0, 0.1), midBottom = win(0.2, 0.3), middle = win(0.45, 0.55), upperMid = win(0.7, 0.8), top = win(0.9, 1.01);
    // The bottom starts, then the middle bottom, the middle, the upper middle; then the bottom
    // finishes, then the top starts, and the middle bottom finishes after it.
    assert.ok(bottom[0] < midBottom[0] && midBottom[0] < middle[0] && middle[0] < upperMid[0] && upperMid[0] < top[0], `${cols}×${rows}`);
    assert.ok(upperMid[0] < bottom[1] && bottom[1] < top[0] + 0.02 && top[0] < midBottom[1] + 0.02, `${cols}×${rows}: ${bottom} ${upperMid} ${top} ${midBottom}`);
    // The wind reaches every height first.
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) assert.ok(vortexWindOn(rowUp(r, rows)) < p.leave[r * cols + c]);
  }
  // The wind stands on the foot until the gathering is done, its top climbing; then its base subsides.
  const S = [1440, 900];
  for (let P = -0.15; P < VORTEX.base0; P += 0.05) assert.equal(vortexBand(P, S)[1], S[1] + 20);
  for (let P = -0.15; P < 0.3; P += 0.05) assert.ok(vortexBand(P + 0.05, S)[0] < vortexBand(P, S)[0]);
  // The cells at the strip's top edge while it comes in are still paper.
  const [cols, rows] = PLAN_GRIDS[0], p = vortexPlan(cols, rows);
  for (const { P, top } of edges('cosmos')) if (top !== null) {
    const r = Math.min(rows - 1, Math.max(0, Math.floor(top * rows)));
    for (let c = 0; c < cols; c++) assert.ok(P < p.leave[r * cols + c], `top=${top} P=${P}`);
  }
});

test('processes: the cubes build the bottom corners first, then upward and inward, the middle top last, thrown down onto their cells', () => {
  const S = [1440, 900];
  for (const [cols, rows] of PLAN_GRIDS.slice(0, 4)) {
    const p = vortexPlan(cols, rows);
    const mean = f => { let s = 0, n = 0; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const up = rowUp(r, rows), x = (c + 0.5) / cols; if (f(up, x)) { s += p.land[r * cols + c]; n++; } } return s / n; };
    const corner = mean((up, x) => up < 0.2 && (x < 0.15 || x > 0.85)), bottomMid = mean((up, x) => up < 0.2 && Math.abs(x - 0.5) < 0.1);
    const side = mean((up, x) => up > 0.45 && up < 0.65 && (x < 0.15 || x > 0.85)), topMid = mean((up, x) => up > 0.8 && Math.abs(x - 0.5) < 0.1);
    assert.ok(corner < bottomMid && corner < side && bottomMid < topMid && side < topMid, `${cols}×${rows}`);
    const last = [...p.land].sort((a, b) => a - b)[Math.floor(cols * rows * 0.9)];
    assert.ok(topMid > last, `${cols}×${rows}`);
    // Every cube rises with the wind above its new cell before it is thrown, so it comes down onto it.
    for (let i = 0; i < cols * rows; i++) {
      const hy = (Math.floor(i / cols) + 0.5) * S[1] / rows, dy = (Math.floor(p.dest[i] / cols) + 0.5) * S[1] / rows;
      assert.ok(vortexRise([0, hy], [0, dy], 1 - VORTEX.out, S) < dy - 0.05 * S[1]);
    }
    // Many cubes in the air at once, but never most of them.
    let most = 0;
    for (let P = -0.2; P <= 1.2; P += 0.01) { let n = 0; for (let i = 0; i < cols * rows; i++) if (P > p.leave[i] && P < p.land[p.dest[i]]) n++; most = Math.max(most, n); }
    assert.ok(most > 0.2 * cols * rows && most < 0.4 * cols * rows, `${cols}×${rows}: ${most}`);
  }
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
