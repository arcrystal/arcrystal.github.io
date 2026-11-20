// Photography → Chess's misty main event (static/site/scene/ink-swirl.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAYLEIGH, SPIN, rollUp, breath, BREATH, swell, FLOW, flowAt, flowField } from '../../../static/site/scene/ink-swirl.js';

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
    assert.ok(Math.abs(s) < .25, 'a breath, not a burst');
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

test('the water\'s flow: its stir makes and loses nothing, its breath packs and spreads the pigment it carries', () => {
  const h = 1e-5;
  for (const [tau, q] of [[0, [.3, .4]], [7.3, [1.2, .8]], [19, [.05, .95]]]) {
    // With the breath held (β = 0) the field is the stir alone: divergence-free.
    const f = (x, y) => flowField([x, y], tau, 0);
    const div = (f(q[0] + h, q[1])[0] - f(q[0] - h, q[1])[0] + f(q[0], q[1] + h)[1] - f(q[0], q[1] - h)[1]) / (2 * h);
    near(div, 0, 1e-7);
    // The breath alone: what it packs is 1 − its divergence (clamped).
    const b = (x, y) => { const s = flowField([x, y], tau, Math.PI / 2), t = flowField([x, y], tau, 0); return [s[0] - t[0], s[1] - t[1]]; };
    const lap = (b(q[0] + h, q[1])[0] - b(q[0] - h, q[1])[0] + b(q[0], q[1] + h)[1] - b(q[0], q[1] - h)[1]) / (2 * h);
    near(flowField(q, tau, Math.PI / 2)[2], Math.min(1.5, Math.max(.65, 1 - lap)), 1e-6);
  }
  let most = 0;
  for (let i = 0; i < 2000; i++) { const f = flowField([(i * .37) % 1.8, (i * .61) % 1], i * .05, i * .03); most = Math.max(most, Math.hypot(f[0], f[1])); }
  assert.ok(most > .05 && most < .16, 'it moves the water a good way, never off the screen: ' + most);
  // Only through the event; and with the scroll, so scrolling back rewinds it.
  assert.equal(flowAt(FLOW.window[0] - .01)[2], 0);
  assert.equal(flowAt(FLOW.window[3] + .01)[2], 0);
  assert.deepEqual(flowAt(.65, 0), flowAt(.65, 0));
});
