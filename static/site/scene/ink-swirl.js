// Photography → Chess: the mist's main event (glsl/living-ink.js INK_SHEET_FRAGMENT).
// One source for the shaders and the tests, as ink-tank.js is for the tank.
//
// Every plume head is a vortex ring seen side on: a mushroom cap with two counter-rotating cores. Through
// the event the cores roll the cap up, winding the plume studies' filaments round themselves into spiral
// curls, the core faster than its rim (a Lamb–Oseen core: solid inside, falling as 1/r² outside), so the
// filaments are drawn out into tendrils. The angle is the integral of a rate that spins up and dies away:
// it only ever grows with the scroll, so nothing turns backward on screen; the wound texture is handed to
// each figure's own study as the figure gathers. Meanwhile the caps breathe.
import { smooth } from './ink-tank.js';

// A free drop's shape modes (Rayleigh, 1879): ω_l ∝ √(l(l−1)(l+2)), so l = 2, 3, 4 ring at 1 : 1.94 : 3.
// The breathing caps borrow l = 2 and l = 3 (l = 4 locks to l = 2 at 1 : 3).
export const RAYLEIGH = [2, 3, 4].map(l => Math.sqrt(l * (l - 1) * (l + 2)) / Math.sqrt(8));

// The roll's rate: easing in over [.565, .60], steady to .725, easing out by .765: a spin, not a burst.
export const SPIN = Object.freeze([.565, .60, .725, .765]);
const rate = P => smooth(SPIN[0], SPIN[1], P) * (1 - smooth(SPIN[2], SPIN[3], P));
const STEPS = 400, lo = SPIN[0], hi = SPIN[3] + .02;
const CUMULATIVE = (() => {
  const c = new Float64Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) {
    const a = lo + (hi - lo) * (i - 1) / STEPS, b = lo + (hi - lo) * i / STEPS;
    c[i] = c[i - 1] + (rate(a) + rate(b)) / 2;
  }
  for (let i = 0; i <= STEPS; i++) c[i] /= c[STEPS];
  return c;
})();
// How far the caps have rolled up at P: 0 … 1, never back.
export function rollUp(P) {
  const x = Math.max(0, Math.min(1, (P - lo) / (hi - lo))) * STEPS, i = Math.min(STEPS - 1, Math.floor(x));
  return CUMULATIVE[i] + (CUMULATIVE[i + 1] - CUMULATIVE[i]) * (x - i);
}
// The caps' breath at P (time: seconds, for a slow breath at rest): its depth, and the phases of the l = 0,
// 2 and 3 modes, their frequencies Rayleigh's (l = 0 slower still); about one slow breath per .09 of P
// (four screens of scroll or so): nothing here may pulse.
export const BREATH = Object.freeze({ window: [.585, .63, .70, .745], period: .09 });
export function breath(P, time = 0) {
  const [a, b, c, d] = BREATH.window, depth = smooth(a, b, P) * (1 - smooth(c, d, P));
  const t = 2 * Math.PI * P / BREATH.period + .3 * time;
  return [depth, .8 * t, RAYLEIGH[0] * t, RAYLEIGH[1] * t];
}
// The cap's swell at angle ϑ round its centre (shader mirror): l = 0, plus l = 2 and l = 3 on turning axes.
export function swell(b, angle, seed = 0, ivory = 0) {
  const phase = seed * 1.3 + Math.PI * ivory;
  return b[0] * (.045 * Math.sin(b[1] + phase) + .028 * Math.cos(2 * (angle - .4 * b[1] - seed)) * Math.sin(b[2] + phase)
    + .022 * Math.cos(3 * (angle + .3 * b[1] + seed)) * Math.sin(b[3] + phase));
}

// The event's clock for what streams on (the mist's fine detail): only ever forward, with the scroll, and
// slowly with time.
export const spinAt = (P, time = 0) => 30 * Math.max(0, P - .55) + .06 * time;

// ---- the plumes circle one another ---------------------------------------------------------------------
// Each foreground pair, a black and an ivory trunk, swings round its own middle: the heads circle each
// other most of a half turn, passing in front of and behind one another at their own depths, the stems
// following less and less up toward the surface so they bend and trail. Baked (living-ink-plan.js), so
// the mist and the veils move as one and each figure gathers from wherever its plume has come to.
export const ORBIT = Object.freeze({
  pairs: Object.freeze([[0, 23, -1], [10, 1, 1]]),
  angle: .8 * Math.PI,
  window: [.575, .74],
});
export const orbitAt = P => ORBIT.angle * smooth(...ORBIT.window, P);

// ---- discharges ---------------------------------------------------------------------------------------
// Now and then a head throws off a jet of ink. It lays a trail along a fixed path that runs nearly straight
// and then turns ever tighter (θ(s) = θ0 + κ0 s + A (s/L)³: its curvature grows as s²), so its tip rolls
// up into a hook, as a vortex-led jet does. The jet slows as it entrains water
// (L = Lmax(1 − e^{−t/τ})); the trail it has laid stays where it was laid and only spreads and thins into
// mist. Staggered, a few at a time, never together: they stream, they do not pulse. Baked into the mist
// (living-ink-plan.js), in screen heights, x scaled by the aspect.
export const DISCHARGE = Object.freeze({ sources: Object.freeze([0, 23, 10, 1, 4, 7, 14, 17, 21, 28]), each: 3, window: [.575, .735], life: [.055, .085], points: 22 });
const rng = seed => () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
export const DISCHARGES = Object.freeze((() => {
  const r = rng(90210), out = [], n = DISCHARGE.sources.length * DISCHARGE.each;
  for (let k = 0; k < n; k++) {
    const id = DISCHARGE.sources[k % DISCHARGE.sources.length];
    // Spread evenly through the window (a golden-ratio stagger: no two close, no gap long).
    const start = DISCHARGE.window[0] + (DISCHARGE.window[1] - DISCHARGE.window[0]) * ((k * .6180339887 + .13) % 1);
    const side = r() < .5 ? -1 : 1, length = .11 + .12 * r();
    // Out to one side and a little up or down; turning one way, tighter toward the tip.
    const theta0 = side > 0 ? -.5 + 1.0 * r() : Math.PI - .5 + 1.0 * r();
    const turn = (r() < .5 ? -1 : 1);
    out.push(Object.freeze({ id, start, life: DISCHARGE.life[0] + (DISCHARGE.life[1] - DISCHARGE.life[0]) * r(), length,
      theta0, k0: turn * (.5 + 1.5 * r()), hook: turn * Math.PI * (1.1 + .6 * r()), width: .012 + .008 * r(), seed: r() * 6.283 }));
  }
  return out;
})());
// The jet's path, from where it leaves the head (0) to the end of its run: points [x, y] and the arc length.
export function dischargePath(d) {
  const pts = [[0, 0, 0]], n = DISCHARGE.points, ds = d.length / (n - 1);
  let x = 0, y = 0;
  for (let i = 1; i < n; i++) {
    const s = (i - .5) * ds, u = s / d.length, th = d.theta0 + d.k0 * s + d.hook * u * u * u;
    x += Math.cos(th) * ds; y += Math.sin(th) * ds;
    pts.push([x, y, i * ds]);
  }
  return pts;
}
// How far along its path the jet has run at P (0 … 1), and how much of its pigment is left in the trail.
export function dischargeAt(d, P) {
  const age = (P - d.start) / d.life;
  if (age <= 0 || age >= 1) return null;
  return { run: 1 - Math.exp(-age * 4.2), fade: smooth(0, .08, age) * (1 - smooth(.62, 1, age)), age };
}
