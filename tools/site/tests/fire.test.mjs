// Outdoors → Photography, and the click into Photography: fire becoming memory. The clock, the sun and
// the hold, the ignition plan, the flow, the torus's locking, the veil's folds, the waves, development,
// and what the shaders mirror.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './source.mjs';
import {
  FIRE, FIREC, PALETTE, GOLDEN, blackBody, bandEdge, makeIgnition, ignitionAt, ignitionTexels, sunStart, sunAt,
  flowTime, abc, flowVel, flowAt, slip, coupling, torusPoint, foldLight, frontAhead, frontBirth, DEVELOP, induction, developed,
} from '../../../static/site/scene/fire-plan.js';
import { FIRE_SHARED, FIRE_GLSL, FIRE_UNITS } from '../../../static/site/scene/glsl/fire.js';
import { UNIT_PROGRAMS } from '../../../static/site/scene/glsl/units.js';
import { GLASS } from '../../../static/site/scene/glsl/folio.js';
import { HOLD, HELD, holdFor, holdAt, darkroomEase, darkroomRaw, easeFor, transitP } from '../../../static/site/lerp.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const plate = (() => {
  const buf = readFileSync(join(ROOT, 'static', 'site', 'scene', 'data', 'plate.bin'));
  const ft = new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2);
  return { n: Math.round(Math.sqrt(ft.length)), km: Float32Array.from(ft, v => v * 0.0003048) };
})();

test('the clock: sun, fire, embers, ribbons, torus, veil, waves, grains, development, in that order', () => {
  const F = FIRE;
  assert.ok(F.sun < F.ignite[0] && F.ignite[0] < F.ignite[1], 'the sun, then the fire');
  assert.ok(F.release[1] + F.ignite[1] < F.out[0], 'every ember has left before the lumps burn down');
  assert.ok(F.ribbon.on[0] < F.hero.grow[1] && F.hero.out[0] >= F.lock[0] - 1e-9, 'the ribbons while we watch the one ember; it goes out as they wind on');
  assert.ok(F.lock[0] < F.lock[1] && F.lock[1] <= F.face[1] && F.face[0] < F.through[0], 'locked, face on, then through');
  assert.ok(F.through[0] < F.veil[0] && F.veil[1] <= F.ribbonOff[1] + 0.02 && F.ribbonOff[1] <= F.fronts[0][0], 'the veil is up before the waves come');
  for (let j = 1; j < 3; j++) assert.ok(F.fronts[j][0] > F.fronts[j - 1][0] && F.fronts[j][1] > F.fronts[j - 1][1], 'the waves follow one another');
  assert.ok(F.bead[1] <= F.settle[0] + 0.01 && F.settle[0] < F.ripple[0] && F.ripple[0] < F.develop[0], 'seams gone, grains settle, the ripple, the picture');
  assert.ok(F.ripple[1] <= F.develop[1] && F.develop[1] < 1.2, 'the liquid is still and the picture whole before the hold ends');
  for (const d of F.frontDir) near(Math.hypot(...d), 1, 1e-3, 'a wave direction is a unit vector');
  // The tile surfaces over the developing picture and is whole as the hold ends.
  const [s0, ds] = HELD.darkroom;
  assert.ok(s0 > F.develop[0] && s0 + ds <= 1.2 + 1e-9);
  assert.equal(easeFor('darkroom'), darkroomEase);
  assert.equal(holdFor('darkroom').leadOut, 0, 'the band is held to the very end');
  for (const P of [-0.1, 0.3, 0.9, 1.15]) near(transitP(darkroomEase(darkroomRaw(P))), P, 2e-3);
});

test('the sun creeps up from the foot: it stays below the strip\'s top edge while the strip comes in', () => {
  for (const pin of [HOLD.pin, HOLD.pinTouch]) for (const vh of [900, 844]) {
    const L = holdFor('darkroom', pin), H = vh * (1 + pin * L.pin), T = 5000;
    for (let sy = T - L.leadIn * vh; sy <= T; sy += 4) {
      const { y, p } = holdAt(sy, T, H, vh, L.leadIn, L.leadOut), P = transitP(darkroomEase(p));
      for (const xn of [0, 0.5, 1]) assert.equal(sunAt(xn, y / vh, P), 0, `pin ${pin} top ${y / vh} P ${P}`);
    }
    // Held before anything has caught.
    assert.ok(transitP(darkroomEase(holdAt(T, T, H, vh, L.leadIn, L.leadOut).p)) < FIRE.ignite[0] - 0.05);
  }
  assert.ok(sunStart(1, 1) <= FIRE.sun + 1e-9, 'the lower right first');
  assert.ok(sunStart(0, 0) > sunStart(1, 1) && sunStart(0, 0) + FIRE.sunUp < FIRE.ignite[1], 'the upper left last, and lit before the fire is done');
});

test('the window as the shader leads it: a band edge is inside above its height, outside below', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 400; k++) {
    const c = [rnd(), rnd(), rnd(), rnd()].map(x => 1000 + 4000 * x), mid = (c[0] + c[1] + c[2] + c[3]) / 4, thr = 3000;
    const corners = [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]];
    corners.forEach(([u, v], i) => assert.equal(bandEdge(u, v, c, mid, thr) < 0, c[i] > thr, `corner ${i}`));
  }
});

test('the ignition plan: every point catches, the summits first, the sunlit side before the far side', () => {
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const p = makeIgnition(plate.km, plate.n, W, H);
    assert.equal(p.w, Math.ceil(W / FIRE.cell) + 1);
    assert.equal(p.data.length, p.w * p.h);
    assert.ok(p.seeds > 0, 'some summit glass is on screen');
    let lo = 1, hi = 0, right = 0, left = 0, n = 0;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const v = p.data[j * p.w + i];
      assert.ok(v >= 0 && v <= 1, `${v}`);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
      if (i > p.w * 0.75) { right += v; n++; } else if (i < p.w * 0.25) left += v;
    }
    assert.ok(lo < 0.02 && hi === 1, 'from the first to the last');
    assert.ok(right < left, 'the sunlit side catches first');
    near(ignitionAt(p, 3 * FIRE.cell, 2 * FIRE.cell), p.data[2 * p.w + 3], 1e-9, 'read as the GPU reads it');
    assert.equal(ignitionTexels(p).length, p.data.length);
  }
});

test('the palette: a black body ramp, black to white-gold', () => {
  let prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) { const c = blackBody(t), l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; assert.ok(l >= prev - 1e-9, `brighter with heat at ${t}`); prev = l; }
  assert.deepEqual(blackBody(0), [0, 0, 0]);
  assert.deepEqual(blackBody(1), PALETTE.white);
  assert.ok(PALETTE.ember[0] > PALETTE.ember[2] * 3 && PALETTE.violet[2] > PALETTE.violet[0], 'ember warm, violet cool');
});

test('the flow: no sources or sinks, fast at first then all but still', () => {
  const h = 0.01;
  for (const p of [[10, -40, 90], [300, 220, -150], [-512, 77, 5]]) {
    const d = [0, 1, 2].reduce((s, k) => { const a = p.slice(), b = p.slice(); a[k] += h; b[k] -= h; return s + (abc(a)[k] - abc(b)[k]) / (2 * h); }, 0);
    near(d, 0, 1e-9, 'divergence');
  }
  assert.deepEqual(flowAt([5, 6, 7], 0), [5, 6, 7]);
  assert.ok(flowVel([0, 0, 0], 0)[1] < -FIRE.flow.lift * 0.5, 'it leaves upward (y is down)');
  assert.equal(flowTime(FIRE.ignite[0]), 0);
  const early = flowTime(0.1) - flowTime(0.05), late = flowTime(0.6) - flowTime(0.55);
  assert.ok(late < early / 10, 'slowing into weightlessness');
  assert.ok(flowTime(1.2) < FIRE.tau.max);
  // The midpoint rule converges: twice the steps, nearly the same place.
  const a = flowAt([120, -60, 0], 3, 40, 8), b = flowAt([120, -60, 0], 3, 40, 64);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 40);
});

test('the torus: a strand slips until the coupling holds it (Adler), and the families never realign', () => {
  // Held at arcsin(Δω/K); slipping, its closed form obeys ψ′ = Δω − K sin ψ.
  near(slip(0.3, 0.6, 5), Math.asin(0.5), 1e-12);
  for (const [dw, K] of [[0.9, 0.4], [-0.7, 0.2], [0.5, 0]]) for (const t of [0.3, 1.7, 4.1]) {
    const h = 1e-5, a = slip(dw, K, t + h, 0.4), b = slip(dw, K, t - h, 0.4);
    let d = a - b; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    near(d / (2 * h), dw - K * Math.sin(slip(dw, K, t, 0.4)), 1e-4, `Δω ${dw} K ${K}`);
  }
  // Continuous where it locks.
  near(Math.sin(slip(0.5, 0.5 - 1e-9, 2)), 1, 1e-3);
  assert.equal(coupling(FIRE.lock[0]), 0);
  near(coupling(FIRE.lock[1]), FIRE.torus.kmax, 1e-12);
  assert.ok(FIRE.torus.kmax < FIRE.torus.sigma, 'a few strands never lock: the weave keeps slipping');
  near(GOLDEN * (1 + GOLDEN), 1, 1e-12, 'the golden ratio');
  const [x, y, z] = torusPoint(300, 120, 0.7, 2.1);
  near((Math.hypot(x, y) - 300) ** 2 + z * z, 120 * 120, 1e-6, 'on the torus');
  assert.equal(FIRE_UNITS.ribbons.verts, FIRE.ribbon.seg * 6);
});

test('the veil: a folded sheet keeps its light, and is brightest at its folds', () => {
  // Unfolded (A k < 1): one sheet over every point; folded: three between its folds.
  assert.equal(foldLight(0.3, 0.05, 9, 0.4).roots, 1);
  const k = 12, A = 0.15;
  let three = 0;
  for (let X = -1; X <= 1; X += 0.002) if (foldLight(X, A, k, 0, 15).roots === 3) three++;
  assert.ok(three > 50, 'between its folds the sheet lies three deep');
  // ∫ light dX over whole periods = the material's own length (a little is lost to the floor at each fold).
  const L = 4 * 2 * Math.PI / k, N = 4000;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += foldLight(-L / 2 + (i + 0.5) * L / N, A, k, 0, 25).sum * L / N;
  near(sum, L, 0.12 * L);
});

test('the waves: each crest crosses every point of the screen within its time', () => {
  const W = 1440, H = 900;
  for (let j = 0; j < 3; j++) for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, H / 2], [200, 700]]) {
    const b = frontBirth(j, x, y, W, H);
    assert.ok(b > FIRE.fronts[j][0] && b < FIRE.fronts[j][1], `wave ${j} passes (${x}, ${y})`);
    near(frontAhead(j, x, y, W, H, b), 0, 1e-6);
    assert.ok(frontAhead(j, x, y, W, H, b - 0.01) > 0 && frontAhead(j, x, y, W, H, b + 0.01) < 0, 'ahead of it before, swept after');
  }
});

test('development: the most exposed first, everything there by the end', () => {
  assert.ok(induction(1) < induction(0.2));
  assert.ok(developed(1, 0.25) > developed(0.2, 0.25));
  for (const x of [0, 0.3, 1]) {
    assert.equal(developed(x, 0), 0);
    assert.equal(developed(x, 1), 1);
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.02) { const d = developed(x, t); assert.ok(d >= prev - 1e-12); prev = d; }
  }
  near(DEVELOP.lead + DEVELOP.lag, 0.5, 1e-12);
});

test('the shaders mirror the plan', () => {
  const f = x => Number(x).toFixed(4);
  for (const s of [
    `FI_IGN = vec2(${f(FIRE.ignite[0])}, ${f(FIRE.ignite[1])})`, `FI_SUN0 = ${f(FIRE.sun)}`, `FI_TAUMAX = ${f(FIRE.tau.max)}`,
    `FI_KMAX = ${f(FIRE.torus.kmax)}`, `FI_CBY = ${f(FIREC.by)}`, `FI_DLAG = ${f(DEVELOP.lag)}`, `FI_GOLDEN = ${f(GOLDEN)}`,
    `FI_EMBER = vec3(${PALETTE.ember.map(f).join(', ')})`,
  ]) assert.ok(FIRE_SHARED.includes(s), s);
  assert.ok(FIRE_GLSL.includes('vec3 groundFire(') && FIRE_GLSL.includes('vec4 fireCover(') && FIRE_GLSL.includes('vec3 fireReveal('));
  for (const name of ['embers', 'ribbons', 'grains']) assert.ok(UNIT_PROGRAMS[name].vs.includes('#version 300 es') && UNIT_PROGRAMS[name].fs.includes('out vec4 o;'), name);
  // A click's fire has let go of the whole page by the cover's end.
  const latest = FIREC.start + FIREC.radial + FIREC.finger / 2;
  assert.ok((1.04 - latest) * FIREC.by >= FIRE.gone[1], 'gone everywhere by the end of the cover');
  assert.equal(GLASS.bands.length + 1, FIRE.speed.band.length, 'a speed for each band of glass');
});
