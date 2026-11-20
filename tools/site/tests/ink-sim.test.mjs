// Photography → Chess's live ink: the part of the fluid with no GPU in it (static/site/scene/ink-sim.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIM, live, showAt, energyAt, simSize, rng, createStir, createForcing, createThermostat, createImpulses } from '../../../static/site/scene/ink-sim.js';
import { formSchedule, FORMS } from '../../../static/site/scene/living-forms.js';
import { HOLD } from '../../../static/site/lerp.js';

test('it runs only inside the event, shows from where the camera is still, and is gone before the window ends', () => {
  assert.ok(!live(.55) && live(.556) && live(.79) && !live(.80));
  assert.equal(showAt(SIM.show[0]), 0);
  assert.equal(showAt(.64), 1);
  assert.ok(showAt(SIM.window[1]) === 0, 'nothing shows at the window\'s end');
  assert.ok(SIM.show[0] >= .565, 'the tank camera is still from .565');
});

test('the grid: square cells, about the budgeted count, finer than the bake', () => {
  for (const [w, h, mobile] of [[1440, 900, false], [2560, 1440, false], [390, 844, true], [844, 390, true]]) {
    const { nx, ny } = simSize(w, h, mobile), n = mobile ? SIM.cells.phone : SIM.cells.desktop;
    assert.ok(Math.abs(nx * ny / n - 1) < .03, `${w}x${h}: ${nx}×${ny}`);
    assert.ok(Math.abs(nx / ny - w / h) < .02 * w / h);
    // (The bake's mist: 101×63 on desktop, 38×72 on a phone.)
    assert.ok(mobile ? nx > 38 && ny > 72 : nx > 3 * 101 && ny > 3 * 63);
  }
});

test('the step stays inside its limits: one a frame at most, advection, pressure sweeps, relaxation and diffusion', () => {
  assert.equal(SIM.maxSteps, 1);
  assert.ok(SIM.speed <= 2, 'CFL: at most two cells a step (MacCormack, limited)');
  const { along, across, near, far, handoff } = SIM.mist;
  // Explicit diffusion on a 5-point stencil: stable below ¼.
  assert.ok(along < .25 && across <= along);
  for (const k of [near, far, handoff]) assert.ok(k > 0 && k < 1);
  assert.ok(near < far, 'freer near a live head');
  assert.ok(SIM.pressure.warm < 1 && SIM.pressure.desktop >= SIM.pressure.phone);
  assert.ok(SIM.damping > 0 && SIM.damping < .01);
  assert.ok(SIM.detail.max <= .08 && SIM.veils <= .6);
});

test('the scroll\'s stir: bounded, quick to rise and slow to settle, its sense the scroll\'s', () => {
  const s = createStir();
  let up = 0;
  for (let t = 0; t < .5; t += 1 / 60) up = s.update(3, 1 / 60).amount;
  assert.ok(up > .85 && up <= 1, `rises: ${up}`);
  assert.ok(s.sense > .8);
  let down = up;
  for (let t = 0; t < .5; t += 1 / 60) down = s.update(0, 1 / 60).amount;
  assert.ok(down > .5 * up, `settles slowly: ${down}`);
  for (let t = 0; t < 6; t += 1 / 60) down = s.update(0, 1 / 60).amount;
  assert.ok(down < .02);
  for (let t = 0; t < 2; t += 1 / 60) s.update(-2, 1 / 60);
  assert.ok(s.sense < -.7, 'turns the other way when scrolled back');
});

test('the forcing: Ornstein–Uhlenbeck amplitudes, random-walk phases: bounded, seeded, and not periodic', () => {
  const ny = 248, a = createForcing(1009, ny), b = createForcing(1009, ny);
  const series = [];
  for (let i = 0; i < 60 * 120; i++) { a.step(); b.step(); series.push(a.data[3]); }
  assert.deepEqual([...a.data], [...b.data], 'seeded: the same each time');
  const sd = Math.sqrt(series.reduce((s, v) => s + v * v, 0) / series.length);
  assert.ok(sd > .5 * SIM.forcing.amp && sd < 1.6 * SIM.forcing.amp, `amplitude's spread ${sd}`);
  // Its autocorrelation decays (about e^{−t/τ}) and never comes back: no period.
  const mean = series.reduce((s, v) => s + v, 0) / series.length, ac = lag => {
    let n = 0, d = 0;
    for (let i = 0; i + lag < series.length; i++) n += (series[i] - mean) * (series[i + lag] - mean);
    for (const v of series) d += (v - mean) ** 2;
    return n / d;
  };
  const tau = Math.round(SIM.forcing.tau * 60);
  assert.ok(ac(tau) < .6 && ac(tau) > .1, `at τ: ${ac(tau)}`);
  for (let lag = 3 * tau; lag < 30 * tau; lag += 7) assert.ok(Math.abs(ac(lag)) < .35, `lag ${lag}: ${ac(lag)}`);
  // Wavelengths within the band (screen heights).
  for (let m = 0; m < SIM.forcing.modes; m++) {
    const k = Math.hypot(a.data[4 * m], a.data[4 * m + 1]), lambda = 2 * Math.PI / k / ny;
    assert.ok(lambda >= SIM.forcing.wave[0] - 1e-9 && lambda <= SIM.forcing.wave[1] + 1e-9);
  }
});

test('the thermostat is overdamped: it settles on its target without overshooting', () => {
  // A toy flow: energy relaxes toward gain × e0 over two seconds; the thermostat reads it.
  const t = createThermostat(), target = .06, dt = 8 / 60;
  let e = .005, peak = 0;
  for (let i = 0; i < 60 * 40 / 8; i++) {
    const g = t.update(e, target, dt);
    e += (g * .03 - e) * dt / 2;
    if (i > 5) peak = Math.max(peak, e);
  }
  assert.ok(Math.abs(e - target) / target < .35, `settles near: ${e}`);
  assert.ok(peak < 1.25 * Math.max(e, target), `no ringing: peak ${peak}`);
  assert.ok(t.gain >= SIM.thermostat.min && t.gain <= SIM.thermostat.max);
  assert.ok(energyAt(.66, 1) > energyAt(.66, 0) && energyAt(.66) > energyAt(.57));
});

test('impulses: each head is kicked when it comes alive, then at random; a kick is an opposite pair', () => {
  const imp = createImpulses(7), heads = [{ id: 0, x: 100, y: 100, radius: 30, weight: 1 }, { id: 1, x: 300, y: 120, radius: 25, weight: 1 }];
  const first = imp.step(heads, 0);
  assert.equal(first.length, 4, 'both heads, a pair each, on waking');
  for (let i = 0; i < first.length; i += 2) {
    assert.ok(Math.sign(first[i][2]) === -Math.sign(first[i + 1][2]), 'opposite');
    assert.ok(Math.abs(Math.abs(first[i][2]) - Math.abs(first[i + 1][2])) > 0, 'a little unequal');
  }
  let n = 0, stirred = 0;
  for (let i = 0; i < 60 * 2000; i++) n += imp.step(heads, 0).length / 2;
  const imp2 = createImpulses(7); imp2.step(heads, 1);
  for (let i = 0; i < 60 * 2000; i++) stirred += imp2.step(heads, 1).length / 2;
  const rate = n / 2 / 2000;
  assert.ok(Math.abs(rate - SIM.head.rate) < .03, `a Poisson rate of ${SIM.head.rate}/s: ${rate}`);
  assert.ok(stirred > 2 * n, 'quicker when stirred');
  // A head that fades and wakes again is kicked again.
  const once = createImpulses(3);
  once.step([{ ...heads[0], weight: 1 }], 0); once.step([{ ...heads[0], weight: 0 }], 0);
  assert.equal(once.step([{ ...heads[0], weight: 1 }], 0).length, 2);
});

test('every live head\'s body is gone before its figure starts to gather, on desktop and phone', () => {
  // The bake's sites as formSchedule reads them (formStart only): here from the schedule's own rule.
  const sites = Array.from({ length: 32 }, () => ({ formStart: .74 }));
  for (const f of formSchedule(sites)) {
    // The head stops steering by d1 + .02 (live-ink.js placeHeads); its body is the mist's again by then.
    assert.ok(f.d1 <= sites[f.id].formStart - .004 + 1e-9);
  }
  assert.ok(FORMS.length <= 14);
  void HOLD; void rng;
});
