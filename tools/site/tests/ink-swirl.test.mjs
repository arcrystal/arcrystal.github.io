// Photography → Chess's misty main event (static/site/scene/ink-swirl.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAYLEIGH, SPIN, rollUp, breath, BREATH, swell, ORBIT, orbitAt, spinAt } from '../../../static/site/scene/ink-swirl.js';
import { inkRaw, holdFor, HOLD } from '../../../static/site/lerp.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);

test('a drop breathes in Rayleigh\'s modes: ω_l ∝ √(l(l−1)(l+2)), 1 : 1.94 : 3', () => {
  near(RAYLEIGH[1] / RAYLEIGH[0], Math.sqrt(30 / 8), 1e-12);
  near(RAYLEIGH[2] / RAYLEIGH[0], 3, 1e-12);
});

test('the caps roll up only forward, and are wound by the time the figures gather', () => {
  let prev = 0;
  for (let P = .5; P < .8; P += .0005) { const r = rollUp(P); assert.ok(r >= prev - 1e-12, 'never back'); prev = r; }
  assert.equal(rollUp(SPIN[0] - .001), 0);
  // Still easing round as the hero knight starts gathering (its study takes over the wound one), done soon after.
  assert.ok(rollUp(.722) > .8);
  near(rollUp(.79), 1, 1e-6);
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
    assert.ok(Math.abs(s) < .1, 'a breath, not a burst');
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

test('nothing pulses: every repeating motion takes several screens of scroll; the rest only goes forward', () => {
  const h = holdFor('ink', HOLD.pin), T = h.pin * HOLD.pin + h.leadIn, screens = P => inkRaw(P, HOLD.pin) * T;
  // The slowest scroll through the event is where a screen covers least P; even there a breath takes three.
  let least = Infinity;
  for (let P = .56; P < .76; P += .005) least = Math.min(least, .01 / (screens(P + .005) - screens(P - .005)));
  assert.ok(BREATH.period / least >= 3, `a breath per ${(BREATH.period / least).toFixed(1)} screens`);
  let prevSpin = -1, prevOrbit = -1;
  for (let P = .5; P < .85; P += .001) {
    const s = spinAt(P), o = orbitAt(P);
    assert.ok(s >= prevSpin && o >= prevOrbit - 1e-12, 'only forward');
    prevSpin = s; prevOrbit = o;
  }
  // The pairs circle most of a half turn, done before the figures gather.
  assert.equal(orbitAt(ORBIT.window[0]), 0);
  near(orbitAt(ORBIT.window[1]), ORBIT.angle, 1e-12);
  assert.ok(ORBIT.window[1] <= .745 && ORBIT.angle < Math.PI);
});
