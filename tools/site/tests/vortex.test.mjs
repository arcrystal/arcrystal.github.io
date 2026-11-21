// Photography → Chess's vortex rings: their physics and their choreography (static/site/scene/vortex-plan.js),
// and the run time's map back from the underwater camera (vortex-ink.js fromV).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RINGS, selfSpeed, induced, bakeRings, ringAt, toV } from '../../../static/site/scene/vortex-plan.js';
import { fromV } from '../../../static/site/scene/vortex-ink.js';
import { birthSites } from '../../../static/site/scene/living-ink-plan.js';

const aspects = [1.6, 390 / 844];

test('a ring moves by Kelvin\'s law, and its own flow at its centre is Biot–Savart\'s Γ/2R', () => {
  const G = .01, R = .1, a = .01;
  assert.ok(Math.abs(selfSpeed(G, R, a) - G / (4 * Math.PI * R) * (Math.log(80) - .25)) < 1e-12);
  // (A thin-cored ring: at its centre the flow is Γ/2R along its axis; twelve straight segments, a polygon
  // through the circle, come within 7%.)
  const v = induced({ c: [0, 0, 0], n: [0, 1, 0], R, G, a: .001 }, [0, 0, 0]);
  assert.ok(Math.abs(Math.abs(v[1]) / (G / (2 * R)) - 1) < .07, `${v[1]} vs ${G / (2 * R)}`);
  assert.ok(Math.abs(v[0]) < 1e-9 && Math.abs(v[2]) < 1e-9);
});

test('the bake is quick, finite and the same every time', () => {
  for (const aspect of aspects) {
    const sites = birthSites(aspect), t0 = performance.now(), a = bakeRings(aspect, sites), ms = performance.now() - t0, b = bakeRings(aspect, sites);
    assert.ok(ms < 2500, `${aspect}: ${ms.toFixed(0)} ms`);
    assert.ok(a.track.every(Number.isFinite));
    assert.deepEqual(a.track, b.track, 'deterministic');
  }
});

test('every family unmixes into its piece: at its site, the piece\'s size, upright, by its formPeak', () => {
  for (const aspect of aspects) {
    const sites = birthSites(aspect), plan = bakeRings(aspect, sites);
    for (const r of plan.rings.filter(r => r.kind === 'late' || r.kind === 'primary')) {
      const site = sites[r.family], s = ringAt(plan, r, site.formPeak + .002);
      assert.ok(s, `family ${r.family} has a ring at its formPeak`);
      assert.ok(Math.hypot(s.c[0] - site.x * aspect, s.c[1] - site.y, s.c[2] - site.z) < 2e-3, `family ${r.family} at its site`);
      assert.ok(Math.abs(s.R - RINGS.unmix.size * site.size * Math.min(1, aspect)) < 2e-3, `family ${r.family} the piece's size`);
      assert.ok(s.n[1] > .99, 'upright');
    }
  }
});

test('through the dance the hero rings stay in the frame, and keep moving', () => {
  for (const aspect of aspects) {
    const plan = bakeRings(aspect, birthSites(aspect)), heroes = plan.rings.filter(r => r.kind === 'late' || RINGS.trunks.includes(r.family) && r.kind === 'primary');
    for (const r of heroes) {
      let travel = 0, last = null;
      for (let P = .58; P <= .70; P += .004) {
        const s = ringAt(plan, r, P);
        assert.ok(s.c[0] > -.05 && s.c[0] < aspect + .05 && s.c[1] > -.05 && s.c[1] < 1.15, `family ${r.family} at ${P.toFixed(3)}: ${s.c.map(v => v.toFixed(2))}`);
        if (last) travel += Math.hypot(s.c[0] - last[0], s.c[1] - last[1]);
        last = s.c;
      }
      assert.ok(travel > .02, `family ${r.family} moves: ${travel.toFixed(3)}`);
    }
  }
});

test('the run time\'s map back from the underwater camera is exact', () => {
  for (const aspect of aspects) for (const [x, d, z] of [[.3, .2, .4], [.8, .7, .9], [.05, .95, .1]]) {
    const back = fromV(toV(x, d, z, aspect), aspect);
    assert.ok(Math.hypot(back[0] - x, back[1] - d, back[2] - z) < 1e-9, `${aspect}: ${back}`);
  }
});
