// Photography → Chess's living ink (static/site/scene/living-mass.js) and the solids filling their own shapes
// (living-ink-plan.js FILL): the flow it rides, its drop modes, its tendrils, and mass for volume.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abc, trajectories, massFrame, stateOf, presence, RAYLEIGH, BODIES, MASS, GLASS, BOX, SAMPLES, POINTS } from '../../../static/site/scene/living-mass.js';
import { fillRadius, filledShare, frontDistance, setOf, birthSites } from '../../../static/site/scene/living-ink-plan.js';

const seeds = [[.3, .4, .5, .09], [.7, .45, .4, .08], [.75, .3, .7, .085], [.2, .55, .55, .08]];

test('the Arnold–Beltrami–Childress flow is divergence-free and a Beltrami field (its curl is itself)', () => {
  const h = 1e-5;
  for (const p of [[.3, 1.2, -.7], [2.1, .4, 5.3], [0, 0, 0]]) {
    let div = 0;
    const d = (j, k) => { const a = p.slice(), b = p.slice(); a[k] -= h; b[k] += h; return (abc(b)[j] - abc(a)[j]) / (2 * h); };
    for (let k = 0; k < 3; k++) div += d(k, k);
    assert.ok(Math.abs(div) < 1e-8, `div ${div}`);
    const curl = [d(2, 1) - d(1, 2), d(0, 2) - d(2, 0), d(1, 0) - d(0, 1)], u = abc(p);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(curl[k] - u[k]) < 1e-6, 'curl u = u');
  }
});

test('the bodies ride their streamlines deterministically, in view and behind the glass', () => {
  for (const aspect of [.46, 1, 1.78]) {
    const a = trajectories(seeds, aspect), b = trajectories(seeds, aspect);
    assert.deepEqual(a, b, 'the same paths every time: scrolling back rewinds them');
    assert.equal(a.length, SAMPLES * BODIES.length * 4);
    for (let k = 0; k < a.length; k += 4) {
      assert.ok(a[k] >= BOX.x[0] - 1e-6 && a[k] <= BOX.x[1] + 1e-6 && a[k + 1] >= BOX.y[0] - 1e-6 && a[k + 1] <= BOX.y[1] + 1e-6);
      assert.ok(a[k + 2] <= BOX.z[1] + 1e-6 && a[k + 2] < GLASS);
    }
    // And they move: the flow carries each a visible way over its life.
    for (let b2 = 0; b2 < BODIES.length; b2++) {
      const at = i => [a[4 * (i * BODIES.length + b2)], a[4 * (i * BODIES.length + b2) + 1]];
      const [x0, y0] = at(0), [x1, y1] = at(SAMPLES - 1);
      assert.ok(Math.hypot((x1 - x0) * aspect, y1 - y0) > .02, `body ${b2} moves`);
    }
  }
});

test('a drop breathes in Rayleigh\'s modes: ω_l ∝ √(l(l−1)(l+2)), 1 : 1.94 : 3', () => {
  assert.ok(Math.abs(RAYLEIGH[1] / RAYLEIGH[0] - Math.sqrt(30 / 8)) < 1e-12);
  assert.ok(Math.abs(RAYLEIGH[2] / RAYLEIGH[0] - 3) < 1e-12);
});

test('each body is smooth, then sharp, then gaseous, and has gone to mist by the end', () => {
  const seen = BODIES.map(() => ({ smooth: 0, sharp: 0, gas: 0 }));
  for (let P = MASS.congeal; P < MASS.remist; P += .001) BODIES.forEach((_, b) => {
    const s = stateOf(b, P);
    for (const k of ['smooth', 'sharp', 'gas']) seen[b][k] = Math.max(seen[b][k], s[k]);
    assert.ok(s.smooth >= 0 && s.sharp >= 0 && s.gas >= 0 && s.smooth + s.sharp + s.gas < 1.0001);
  });
  for (const s of seen) assert.ok(s.smooth > .95 && s.sharp > .9 && s.gas > .9, JSON.stringify(s));
  assert.equal(presence(MASS.start), 0);
  assert.equal(presence(MASS.end), 0);
  assert.ok(stateOf(0, MASS.end - .005).gas > .95);
});

test('the tendrils lash, recoil and bead, the inks never mix, and nothing touches the screen', () => {
  const traj = trajectories(seeds, 1.6);
  let longest = 0;
  for (let P = MASS.start + .01; P < MASS.end; P += .002) for (const time of [0, 3.7]) {
    const frame = massFrame(traj, P, time, 1.6);
    for (const body of frame) {
      for (const t of body.ten) {
        assert.equal(t.length, POINTS);
        for (const p of t) assert.ok(p[2] < GLASS && p[3] >= 0, 'behind the glass');
        longest = Math.max(longest, Math.hypot(t[POINTS - 1][0] - t[0][0], t[POINTS - 1][1] - t[0][1]) / Math.max(1e-6, body.R / Math.max(body.here, 1e-6)));
        // Immiscible: no point of a tendril inside a body of the other colour.
        for (const other of frame) {
          if (other.white === body.white || other.here < .5) continue;
          for (const p of t) assert.ok(Math.hypot(p[0] - other.c[0], p[1] - other.c[1], p[2] - other.c[2]) > other.R * .99, 'the inks stay apart');
        }
      }
      for (const s of body.sat) assert.ok(s[2] < GLASS);
    }
  }
  assert.ok(longest > 1.5, 'tendrils reach well out of their bodies: ' + longest);
});

test('a solid fills exactly the share of its volume its deposited pigment is', () => {
  for (let type = 0; type < 6; type++) {
    let prev = -1;
    for (const g of [0, .1, .25, .5, .75, .9, 1]) {
      const R = fillRadius(type, g);
      assert.ok(R >= prev, 'the front only advances');
      prev = R;
      if (g > 0 && g < 1) assert.ok(Math.abs(filledShare(type, R) - g) < 1e-3, `type ${type}: ${filledShare(type, R)} for ${g}`);
    }
    assert.ok(frontDistance(type, 0, .5, 0) >= 0);
  }
  // And it sets after it has begun to fill, finishing before it flies to the board.
  for (const s of birthSites(1.6)) {
    assert.equal(setOf(s, s.birth + .5 * s.duration), 0);
    assert.equal(setOf(s, s.birth + s.duration), 1);
    assert.ok(s.depart >= s.birth + s.duration);
  }
});
