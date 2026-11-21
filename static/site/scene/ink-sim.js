// Photography → Chess: the live ink. Through the mist's main event one fluid runs on the screen's own grid
// (glsl/ink-sim.js, live-ink.js) and every material is a field in it. It steps on the clock, every frame,
// whether or not the page is scrolled: the scroll steers it (where each plume head is, what it is doing)
// and stirs it (how fast it is scrolled), but scrolling back does not play it backward.
//
// This module is the part with no GPU in it: the grid's size, when the sim runs and shows, the steering
// (each head's carrier, its one-off vortex impulses), the scroll's stir, the large-scale forcing and the
// thermostat that holds the flow's energy. All of it is seeded and stepped, never periodic: amplitudes
// are Ornstein–Uhlenbeck processes, phases random walks, impulses a Poisson process; nothing is sin(ωt).
//
// Units on the grid: a cell is 1, a step is 1 (h = 1/60 s), so velocities are cells per step.
import { smooth } from './ink-tank.js';

export const SIM = Object.freeze({
  // It runs inside window; it shows by `show` (P), each change of what shows eased over `fade` seconds of the
  // clock, so a jump in the scroll fades rather than cuts. (From .565: the camera is still from there.)
  window: Object.freeze([.555, .80]),
  show: Object.freeze([.565, .59, .765, .80]),
  fade: .5,
  // Cells on the grid (the bake's mist is 101×63 on desktop, 38×72 on a phone: this is several times finer).
  cells: Object.freeze({ desktop: 98304, phone: 55296 }),
  h: 1 / 60,
  // (One step a frame at most: a late frame never brings on another by doubling the work.)
  maxSteps: 1,
  // A jump of P (a reload mid-event, a link): the sim starts again there, hidden, and runs a second ahead
  // (preroll steps, catchUp.page a frame); the tools replay it from the window's start at the standard
  // forward pace instead (P per step: the event in 1300 steps, about 22 s; catchUp.tools a frame).
  jump: .02,
  catchUp: Object.freeze({ page: 12, tools: 30 }),
  preroll: 60,
  pace: (.80 - .555) / 1300,
  speed: 2,
  pressure: Object.freeze({ desktop: 8, phone: 8, warm: .85 }),
  // Its own governor: when frames keep missing (more than `misses` frames later than `late` s, counted with
  // a memory of about two seconds) the fluid steps every other frame, carrying two steps (as fast, half the
  // work), for the rest of the event.
  governor: Object.freeze({ late: .021, memory: .992, misses: 3 }),
  confinement: .22,
  // A slow drag on the water (per step): eddies live a few seconds, then the forcing makes new ones.
  damping: .003,
  // Black mist is a little heavier than the water, ivory a little lighter (cells per step², per unit of dye).
  buoyancy: Object.freeze({ black: -1e-4, ivory: 1e-4 }),
  // The mist: diffused along the flow ten times faster than across it; drawn back to the baked mist, per step,
  // slowly near a live head, faster far from one, fast at the handoff; carried by the heads at this share.
  mist: Object.freeze({ along: .06, across: .004, near: 1 / 700, far: 1 / 260, handoff: 1 / 24, carried: .75 }),
  // Fine detail rides the flow (D_t + u·∇D = u − D/τ), τ in seconds; never more than `max` of the screen.
  detail: Object.freeze({ tau: 3, max: .06 }),
  // The veils take this share of the carried detail's large scales (more folds them over themselves); and
  // inside this window (P) their depth prepass is skipped (living-ink.js draw).
  veils: .55,
  sheetDepthOff: Object.freeze([.575, .775]),
  // The glossy bodies, on a grid 1.5× the fluid's each way: held sharp by a gentle contrast (per step);
  // surface tension σ (fluid cells, per step²); sinking (black more than ivory: Rayleigh–Taylor between
  // them); fed per step toward the schedule's fill at each head's core, by the mist condensing round it, and
  // melted back to mist as it dissolves.
  body: Object.freeze({ scale: 1.5, sharpen: .02, width: 0, tension: .04, black: -2e-4, ivory: -5e-5, feed: .045, condense: .02, melt: .03,
    // Viscosity (ν per step, cells²) by Jacobi sweeps: black thick, ivory thicker at rest (it thins under shear: step 3).
    nu: Object.freeze([3, 5]), sweeps: 2, water: .035,
    // Ivory thins under shear (Carreau): ν∞ as a share of ν at rest, λ (steps), n.
    carreau: Object.freeze([.06, 8, .3]),
    // Black's memory (FENE-P, in the black bodies only): λ (steps), L², G (the polymer's modulus), the most
    // a stress may be, and a little diffusion of A (stability).
    polymer: Object.freeze({ lambda: 45, L2: 30, G: .0015, most: .06, diffuse: .05 }),
    // Shear strips a body's skin into mist: rate per unit of strain rate over the threshold (per step).
    erode: Object.freeze([.12, .14]) }),
  // Large-scale forcing: curl noise from a few modes, wavelengths in screen heights.
  forcing: Object.freeze({ modes: 6, wave: Object.freeze([.22, .65]), tau: 3.2, walk: .55, amp: 2.6e-3 }),
  // The scroll's stir: speed in screen heights a second, saturating; quick to rise, slow to settle.
  stir: Object.freeze({ scale: .9, attack: .15, release: 1.2 }),
  // The flow's energy (mean |u|², cells²/step²) held in a band by P; overdamped, proportional only.
  thermostat: Object.freeze({ tau: 4, gain: 1.4, min: .25, max: 3.5 }),
  // The convection: heat lifts the water and the vents' ink weighs it down (cells per step², per unit); heat
  // cools (per step) and spreads; cold vent ink condenses into the bodies below `condenseBelow`, hot bodies
  // melt into vent ink above `meltAbove` (per step: quick, so a phase change is seen); bodies sheared hard
  // heat up; vent ink also thins into the water (`fade`, per step), so not all of it returns to the bodies.
  // The screen's mist kept: the live mist holds this share of the bake's (its haze cleared).
  convect: Object.freeze({ lift: 7e-4, weight: 2.5e-4, cool: 1 / 70, spread: .06, condense: .011, condenseBelow: .22, melt: .03, meltAbove: .5, shearHeat: .8, fade: .013 }),
  thin: .55,
  // The motes: how many (a square of side² on desktop, phone), how often a dead one is thrown again (per
  // step, while a vent fires), how much pigment each, and the shutter of its motion blur (steps).
  motes: Object.freeze({ desktop: 128, phone: 96, respawn: .02, mass: .22, shutter: 2.5 }),
  // The vents: from each live body, now and then (per second, more when stirred), a jet of hot ink, mostly
  // sideways (the plumes already fall), its way drifting as it runs (so it snakes), for `life` seconds.
  jet: Object.freeze({ rate: .3, most: 6, spread: .45, turn: 1.4, life: Object.freeze([.6, 1.4]), push: .022, heat: .09, ink: .035, radius: .28 }),
  // Each live head: a carrier (radius × the head's size), a drag on the water toward the head's velocity,
  // and vortex impulses: a Poisson process (per second), each a pair of Lamb–Oseen cores.
  head: Object.freeze({ reach: 1.6, drag: .012, rate: .22, gamma: 60, core: .35, spread: .55 }),
});

export const live = P => P > SIM.window[0] && P < SIM.window[1];
// The handoff to the figures (0 … 1): the water calms, the vents and kicks stop, the live mist is drawn onto
// the bake's and the carried detail and the veils go home, all before what shows of it fades: so the fade
// has nothing left to morph, and the figures gather from still water, as they did before the live ink.
export const HANDOFF = Object.freeze([.705, .765]);
export const handoffAt = P => smooth(HANDOFF[0], HANDOFF[1], P);
// What should show at P (0 … 1).
export const showAt = P => smooth(SIM.show[0], SIM.show[1], P) * (1 - smooth(SIM.show[2], SIM.show[3], P));
// The energy the flow is held at (P, stir 0 … 1): quiet as it takes over, fullest while the bodies live.
export const energyAt = (P, stir = 0) => (.016 + .065 * smooth(.575, .63, P)) * (1 - .85 * handoffAt(P)) * (1 + 1.6 * stir * (1 - handoffAt(P)));

// The grid for a CSS-px viewport: cells of one size in x and y, about SIM.cells of them.
export function simSize(w, h, mobile) {
  const n = mobile ? SIM.cells.phone : SIM.cells.desktop, aspect = w / h;
  return { nx: Math.max(16, Math.round(Math.sqrt(n * aspect))), ny: Math.max(16, Math.round(Math.sqrt(n / aspect))) };
}

// A seeded generator (mulberry32) and a standard normal from it.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.normal = () => { const u = Math.max(1e-12, next()), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return next;
}

// The scroll's stir from the page's scroll speed (screen heights a second, signed): how much (0 … 1) and
// which way (−1 … 1), each eased (quick up, slow down).
export function createStir() {
  let amount = 0, sense = 0;
  return {
    update(vel, dt) {
      const target = 1 - Math.exp(-Math.abs(vel) / SIM.stir.scale);
      const tau = target > amount ? SIM.stir.attack : SIM.stir.release;
      amount += (target - amount) * (1 - Math.exp(-dt / tau));
      sense += (Math.sign(vel) * target - sense) * (1 - Math.exp(-dt / tau));
      return { amount, sense };
    },
    get amount() { return amount; },
    get sense() { return sense; },
  };
}

// The large-scale forcing: modes of a stream function, ψ = Σ a cos(k·x + φ), whose curl the forces pass adds.
// Each amplitude is an Ornstein–Uhlenbeck process (mean 0, correlation time τ), each phase a random walk.
export function createForcing(seed, ny) {
  const r = rng(seed), { modes, wave, tau, walk, amp } = SIM.forcing, h = SIM.h;
  const data = new Float32Array(4 * modes);
  for (let m = 0; m < modes; m++) {
    const lambda = (wave[0] + (wave[1] - wave[0]) * (m + r()) / modes) * ny, k = 2 * Math.PI / lambda, a = 2 * Math.PI * r();
    data.set([k * Math.cos(a), k * Math.sin(a), 2 * Math.PI * r(), amp * r.normal()], 4 * m);
  }
  return {
    data,
    step() {
      const decay = Math.exp(-h / tau), kick = Math.sqrt(1 - decay * decay);
      for (let m = 0; m < modes; m++) {
        const i = 4 * m;
        data[i + 2] += walk * Math.sqrt(h) * r.normal();
        data[i + 3] = data[i + 3] * decay + amp * kick * r.normal();
      }
    },
  };
}

// The thermostat: the energy read back from the grid (late, now and then) eased over τ, and a gain on the
// forcing proportional to how far it is from the target. No integral term (it would ring: a pulse).
export function createThermostat() {
  let mean = null, gain = 1;
  return {
    update(energy, target, dt) {
      if (!(energy >= 0)) return gain;
      mean = mean === null ? energy : mean + (energy - mean) * (1 - Math.exp(-dt / SIM.thermostat.tau));
      const { gain: k, min, max } = SIM.thermostat;
      gain = Math.max(min, Math.min(max, 1 + k * (target - mean) / Math.max(target, 1e-6)));
      return gain;
    },
    get gain() { return gain; },
    get mean() { return mean; },
  };
}

// The vents (SIM.jet): a Poisson process for each live body (one with a fill), each jet starting at its
// body's edge on its own way, mostly sideways (±spread of the horizontal), drifting by its own turn so it
// snakes, swelling in and out over its life (never a cut). Returns this step's jets: [x, y (cells), way,
// push], [radius, heat, ink, ivory].
export function createJets(seed) {
  const r = rng(seed), live = [];
  return {
    step(heads, stir, steps = 1) {
      const J = SIM.jet, dt = steps * SIM.h;
      for (const j of live) j.age += dt;
      for (let i = live.length - 1; i >= 0; i--) if (live[i].age >= live[i].life || !heads.some(h => h.id === live[i].id)) live.splice(i, 1);
      for (const hd of heads) {
        if (hd.fill < .3 || live.length >= J.most || r() >= J.rate * (1 + 2.5 * stir) * dt) continue;
        const side = r() < .5 ? 0 : Math.PI;
        live.push({ id: hd.id, way: side + (r() - .5) * 2 * J.spread, turn: (r() - .5) * 2 * J.turn, age: 0, life: J.life[0] + (J.life[1] - J.life[0]) * r(), push: J.push * (.7 + .6 * r()) * (1 + .6 * stir) });
      }
      return live.map(j => {
        const hd = heads.find(h => h.id === j.id), way = j.way + j.turn * j.age, k = j.age / j.life;
        const rise = Math.min(1, k / .2), swell = rise * rise * (3 - 2 * rise) * (1 - Math.max(0, (k - .7) / .3) ** 2);
        return [[hd.x + Math.cos(way) * .85 * hd.radius, hd.y + Math.sin(way) * .85 * hd.radius, way, j.push * swell],
          [Math.max(2, J.radius * hd.radius), J.heat * swell, J.ink * swell, hd.ivory]];
      });
    },
    reset() { live.length = 0; },
  };
}

// Each head's vortex impulses: when it first comes alive, and then at random (a Poisson process, quicker as
// the scroll stirs). An impulse is a pair of opposite Lamb–Oseen cores, a little unequal, set across the
// way it is thrown (mostly down and out, as a plume's cap is): it rolls the cap up and swims off, and is
// then the fluid's. Returns the cores for this step: [x, y (cells), Γ (cells²/step), core radius (cells)].
export function createImpulses(seed) {
  const r = rng(seed), awake = new Map();
  return {
    step(heads, stir, steps = 1) {
      const out = [];
      for (const hd of heads) {
        const was = awake.get(hd.id) ?? false, now = hd.weight > .5;
        awake.set(hd.id, now);
        const fire = (now && !was) || (now && r() < SIM.head.rate * (1 + 2.2 * stir) * SIM.h * steps);
        if (!fire || out.length >= 16) continue;
        // Thrown mostly downward, ±70°, now and then sideways.
        const theta = -Math.PI / 2 + (r() - .5) * 2.4, along = [Math.cos(theta), Math.sin(theta)], across = [-along[1], along[0]];
        const R = hd.radius, gap = SIM.head.spread * R * (.7 + .6 * r()), uneven = .3 * (r() - .5) * 2;
        const gamma = SIM.head.gamma * (.65 + .7 * r()) * (1 + .8 * stir) * hd.weight * R / 40, core = SIM.head.core * R;
        const c = [hd.x + along[0] * .2 * R, hd.y + along[1] * .2 * R];
        out.push([c[0] + across[0] * gap / 2, c[1] + across[1] * gap / 2, gamma * (1 + uneven), core],
          [c[0] - across[0] * gap / 2, c[1] - across[1] * gap / 2, -gamma * (1 - uneven), core]);
      }
      return out;
    },
    reset() { awake.clear(); },
  };
}
