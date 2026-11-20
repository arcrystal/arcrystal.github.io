// Photography → Chess's misty main event (static/site/scene/ink-swirl.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAYLEIGH, SPIN, rollUp, breath, BREATH, swell } from '../../../static/site/scene/ink-swirl.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);

test('a drop breathes in Rayleigh\'s modes: ω_l ∝ √(l(l−1)(l+2)), 1 : 1.94 : 3', () => {
  near(RAYLEIGH[1] / RAYLEIGH[0], Math.sqrt(30 / 8), 1e-12);
  near(RAYLEIGH[2] / RAYLEIGH[0], 3, 1e-12);
});

test('the caps roll up only forward, and are wound by the time the figures gather', () => {
  let prev = 0;
  for (let P = .5; P < .8; P += .0005) { const r = rollUp(P); assert.ok(r >= prev - 1e-12, 'never back'); prev = r; }
  assert.equal(rollUp(SPIN[0] - .001), 0);
  near(rollUp(.722), 1, 1e-6);
  // At rest it does not spin: the roll is the scroll's alone.
  assert.equal(rollUp(.65), rollUp(.65));
});

test('a breathing cap keeps its pigment: what it gains in area it loses in thickness', () => {
  for (const P of [.62, .65, .68, .71]) for (const time of [0, 7.3]) {
    const b = breath(P, time);
    assert.ok(b[0] >= 0 && b[0] <= 1);
    // The shader scales the study about the cap's centre by 1 + swell and thins it by (1 + swell)²: the
    // pigment through a disc of the cap is its area times its thickness, the same whatever the swell.
    // (Numerically, for a cap of pigment f(r) = e^{−r²/σ²} swelling by s: ∫ f(r/(1+s)) (1+s)^−2 dA = ∫ f dA.)
    const s = swell(b, .4, 1.3, P > .66 ? 1 : 0), f = r => Math.exp(-r * r / .02);
    assert.ok(Math.abs(s) < .15, 'a breath, not a burst');
    let before = 0, after = 0;
    for (let r = .0005; r < 1; r += .001) { before += f(r) * r; after += f(r / (1 + s)) / (1 + s) ** 2 * r; }
    near(after / before, 1, 1e-3);
  }
  assert.equal(breath(BREATH.window[0] - .01)[0], 0);
  assert.equal(breath(BREATH.window[3] + .01)[0], 0);
  // Black and ivory out of step: one draws in as the other lets go.
  const b = breath(.66);
  assert.ok(Math.sign(swell(b, 0, 0, 0) - 0) !== Math.sign(swell(b, 0, 0, 1)) || Math.abs(swell(b, 0, 0, 0)) < 1e-3);
});
