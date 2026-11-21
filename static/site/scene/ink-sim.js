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
  // Vorticity confinement: a little in clear water, most at the mist's edges (where a shear layer rolls up).
  confinement: Object.freeze({ water: .05, edge: .2 }),
  // A slow drag on the water (per step): eddies live a few seconds, then the forcing makes new ones; and a
  // whisper of viscosity (cells² per step), which damps any pattern of the grid's own.
  damping: .003,
  viscosity: .03,
  // Both inks are heavier than the water, black most (cells per step², per unit of dye): across a plume's
  // edge the difference turns the water (baroclinic), so the edges curl; ivory, sinking slower, shears past.
  buoyancy: Object.freeze({ black: -2e-3, ivory: -7e-4 }),
  // The mist: diffused along the flow, and across it too (as ink does: a stirred dye's striations blur away
  // within a second or so, else it reads as marbled paper); drawn back to the baked mist's cores, per step,
  // slowly near a live head, faster far from one, fast (toward all of it) at the handoff; carried by the heads
  // at this share.
  mist: Object.freeze({ along: .08, across: .03, near: 1 / 700, far: 1 / 300, handoff: 1 / 24, carried: .75 }),
  // Its own haze clears: below a column of `reads` (about a tenth of a plume's core) it dissolves, per step,
  // at `broad` where it is an even veil and at `filament` where it is a tendril.
  clear: Object.freeze({ reads: .025, broad: 1 / 150, filament: 1 / 480 }),
  // The veils ride the flow on a leash (D_t + u·∇D = u − D/τ), τ in seconds, never more than `max` of the
  // screen. The mist's texture rides it all the way, in two phases (glsl/ink-sim.js PHASES) each starting
  // over every `period` seconds, never more than `most` of the screen from home.
  detail: Object.freeze({ tau: 3, max: .06 }),
  ride: Object.freeze({ period: 3, most: .5 }),
  // The veils take this share of the carried detail's large scales, never bent sharper than `fold` (|∇| of
  // their displacement: past about one a sheet folds over itself); and inside this window (P) their depth
  // prepass is skipped (living-ink.js draw).
  veils: .55,
  fold: .45,
  sheetDepthOff: Object.freeze([.575, .775]),
  // Large-scale forcing: curl noise from a few modes, wavelengths in screen heights.
  forcing: Object.freeze({ modes: 6, wave: Object.freeze([.22, .65]), tau: 3.2, walk: .55, amp: 2.6e-3 }),
  // The scroll's stir: speed in screen heights a second, saturating; quick to rise, slow to settle.
  stir: Object.freeze({ scale: .9, attack: .15, release: 1.2 }),
  // The flow's energy (mean |u|², cells²/step²) held in a band by P; overdamped, proportional only.
  thermostat: Object.freeze({ tau: 4, gain: 1.4, min: .25, max: 3.5 }),
  // The screen's mist kept: the live mist holds this share of the bake's (its haze cleared).
  thin: .55,
  // The puffs: now and then (a Poisson process per head, `rate` a second, never within `gap` seconds of its
  // last, at most `most` at once) a head throws out some of its own ink: a push from inside its edge, out and
  // down (`down`: radians below the horizontal, as real ink falls), swelling over `rise` and dying over
  // `fall` seconds, its way drifting a little (`turn`, radians a second) so the stream snakes; and a pair of
  // unequal vortices at its mouth (Γ in cells² per step for a head of 40 cells; the weaker `uneven` of the
  // stronger), so its tip curls to one side as it rolls up. One in `long` is a long throw: twice the push,
  // any way at all.
  puff: Object.freeze({ rate: 1 / 6, gap: 2, most: 2, down: Object.freeze([.35, 1.05]), rise: .25, fall: .7, hold: Object.freeze([.15, .45]), turn: .5,
    push: .03, radius: .32, inset: .6, gamma: 22, uneven: Object.freeze([.6, .85]), long: .25 }),
  // Each live head: a carrier (radius × the head's size), a drag on the water toward the head's velocity,
  // and vortex impulses: a Poisson process (per second), each a pair of Lamb–Oseen cores.
  head: Object.freeze({ reach: 1.6, drag: .012, rate: .22, gamma: 45, core: .5, spread: .55 }),
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
export const energyAt = (P, stir = 0) => (.022 + .09 * smooth(.575, .63, P)) * (1 - .85 * handoffAt(P)) * (1 + 1.6 * stir * (1 - handoffAt(P)));

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

// The puffs (SIM.puff): a Poisson process for each live head, never two from one head within the gap, a few
// at a time. Each pushes from inside its head's edge, out and down (or, a long throw, any way), swelling in
// and out (never a cut), its way drifting so the stream snakes; as it starts, a pair of unequal vortices at
// its mouth rolls its tip up, curled to one side. The ink is the head's own: the push carries it out.
// Returns this step's puffs, [x, y (cells), way, push] and [radius], and the vortices thrown as puffs start,
// [x, y, Γ, core].
export function createPuffs(seed) {
  const r = rng(seed), live = [], last = new Map();
  let clock = 0;
  return {
    step(heads, stir, steps = 1) {
      const F = SIM.puff, dt = steps * SIM.h, kicks = [];
      clock += dt;
      for (const p of live) p.age += dt;
      for (let i = live.length - 1; i >= 0; i--) if (live[i].age >= live[i].life || !heads.some(h => h.id === live[i].id)) live.splice(i, 1);
      for (const hd of heads) {
        if (hd.weight < .5 || live.length >= F.most || clock - (last.get(hd.id) ?? -Infinity) < F.gap) continue;
        if (r() >= F.rate * (1 + 1.5 * stir) * dt) continue;
        last.set(hd.id, clock);
        const long = r() < F.long, below = F.down[0] + (F.down[1] - F.down[0]) * r();
        const way = long ? 2 * Math.PI * r() : r() < .5 ? -below : Math.PI + below;
        const p = { id: hd.id, way, turn: (r() - .5) * 2 * F.turn, age: 0, life: F.rise + F.hold[0] + (F.hold[1] - F.hold[0]) * r() + F.fall,
          push: F.push * (.8 + .4 * r()) * (long ? 2 : 1) * (1 + .5 * stir) };
        live.push(p);
        // (The pair at its mouth: the one on the left of its way turning counterclockwise, so between them
        // the water goes out along the way; one of them weaker, so the tip curls to that side.)
        const R = hd.radius, along = [Math.cos(way), Math.sin(way)], across = [-along[1], along[0]];
        const g = F.gamma * R / 40 * (long ? 1.6 : 1) * (.8 + .4 * r()) * hd.weight, weak = F.uneven[0] + (F.uneven[1] - F.uneven[0]) * r(), left = r() < .5;
        const mouth = [hd.x + along[0] * (F.inset + .2) * R, hd.y + along[1] * (F.inset + .2) * R], gap = .25 * R;
        kicks.push([mouth[0] + across[0] * gap, mouth[1] + across[1] * gap, g * (left ? weak : 1), .22 * R],
          [mouth[0] - across[0] * gap, mouth[1] - across[1] * gap, -g * (left ? 1 : weak), .22 * R]);
      }
      const puffs = live.map(p => {
        const hd = heads.find(h => h.id === p.id), way = p.way + p.turn * p.age, end = p.life - p.age;
        const rise = Math.min(1, p.age / F.rise), fall = Math.min(1, end / F.fall);
        const swell = rise * rise * (3 - 2 * rise) * fall * fall * (3 - 2 * fall);
        return [[hd.x + Math.cos(way) * F.inset * hd.radius, hd.y + Math.sin(way) * F.inset * hd.radius, way, p.push * swell], [Math.max(2, F.radius * hd.radius)]];
      });
      return { puffs, kicks };
    },
    reset() { live.length = 0; last.clear(); clock = 0; },
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
