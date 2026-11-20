// Photography → Chess's misty main event (static/site/scene/ink-swirl.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAYLEIGH, SPIN, rollUp, breath, BREATH, swell, ORBIT, orbitAt, spinAt, DISCHARGES, dischargePath, dischargeAt } from '../../../static/site/scene/ink-swirl.js';
import { EVENT_CLOCK } from '../../../static/site/scene/living-forms.js';

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

test('nothing pulses: the waves run once in three screens or slower; the rest only goes forward', () => {
  // (Through the event every wave keeps the event's clock: living-forms.test.mjs holds each to that.)
  assert.ok(BREATH.period * EVENT_CLOCK.screens / RAYLEIGH[1] >= 3, 'the fastest breath mode once in three screens or more');
  let prevSpin = -1, prevOrbit = -1;
  for (let P = .5; P < .85; P += .001) {
    const s = spinAt(P), o = orbitAt(P);
    assert.ok(s >= prevSpin && o >= prevOrbit - 1e-12, 'only forward');
    prevSpin = s; prevOrbit = o;
  }
  assert.equal(orbitAt(ORBIT.window[0]), 0);
  near(orbitAt(ORBIT.window[1]), ORBIT.angle, 1e-12);
  assert.ok(ORBIT.window[1] <= .745 && ORBIT.angle < Math.PI);
});

test('the discharges stream: staggered, never fired together, their trails laid where they stay, hooked at the tip', () => {
  const starts = DISCHARGES.map(d => d.start).sort((a, b) => a - b);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] > 5e-4, 'never two at once');
  for (let i = 3; i < starts.length; i++) assert.ok(starts[i] - starts[i - 3] > .006, 'never a burst of them');
  for (const d of DISCHARGES) {
    // The path is the jet's alone, whatever the moment: what it has laid does not move.
    assert.deepEqual(dischargePath(d), dischargePath(d));
    const p = dischargePath(d), end = p.at(-1), mid = p[Math.floor(p.length / 2)];
    // It runs out before it turns: half way along it is well away from the head; its tip has hooked back.
    assert.ok(Math.hypot(mid[0], mid[1]) > .4 * d.length);
    const out = Math.max(...p.map(q => Math.hypot(q[0], q[1])));
    assert.ok(Math.hypot(end[0], end[1]) < out - 1e-3, 'the tip curls back');
    // It goes forward only, and is gone by the end of its life.
    let prev = 0;
    for (let P = d.start; P < d.start + d.life; P += d.life / 50) { const a = dischargeAt(d, P); if (!a) continue; assert.ok(a.run >= prev); prev = a.run; }
    assert.equal(dischargeAt(d, d.start + d.life + 1e-6), null);
  }
});
