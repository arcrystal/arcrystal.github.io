// Outdoors → Photography, "the thickness of a moment" (glsl/moment.js draws it). Outdoors' art-glass
// window opens into the depth of a whole evening; we move through that suspended time, then watch it
// become a photograph and develop. Nothing in it is one photograph: it is what any exposure is.
//   1. The glass remembers. The lantern makes one slow sweep across the window; its earlier light
//      lingers where it was (a leaf passing leaves translucent echoes, a glint a hairline), the newest
//      light cool, the remembered still warm, as dusk deepens.
//   2. The evening acquires depth. Time becomes depth: the window at each instant t lies at z = tD
//      behind the glass (the oldest nearest). The view eases aside and the echoes part in
//      perspective; their intervals halve until they join, and every moving light is a form in space-
//      time: the lantern's reflection a twisted ribbon, a falling leaf a curved veil, each fixed summit
//      a ruby thread through the whole evening.
//   3. Time closes into an image. D shrinks to nothing (last, slowest) and the view comes back to the
//      front: the volume seen straight on is its integral over time, the long exposure,
//      E(x, y) = ∫ L(x, y, t) dt. A focal-plane shutter's curtain ends it; one red reflection stays
//      above the frame and becomes the darkroom's safelight.
//   4. The evening returns beneath water. The exposure is a sheet of paper: it tips into the
//      developer from a corner, the meniscus crossing it, and develops behind it (the paper's
//      characteristic curve, the darkest first), then settles into Photography's tray.
//   Physical: exposure as the time integral of irradiance; a thin emitting sheet seen at a grazing
//   angle brightens as 1/|cos| (its crossing integral, below); the lamp's reflection in wavy antique
//   glass is a caustic, bright at its rim; the focal-plane shutter; the H&D curve, induction and
//   grains; reflectance 10^(−D). Artistic: the lantern's path, the leaves, the colour of time, the
//   camera's moves, the pace.

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// The scroll's clock (P, −.2 … 1.2). remember: the evening's clock τ runs 0 → 1 (the lantern's sweep,
// the leaves, the dusk); lamp: the world's lantern handed to the story; depth: D opening; view: the
// camera easing aside, drift: its slow turn while held; finer: the echoes' intervals halving (8 → 64);
// join: discrete instants into a continuum; baseOut/baseIn: the still window fading from the depth and
// back as it flattens; close: the camera returning [0] … [1], D closing to [2] (slowest last);
// shutter: the curtain's travel; red: the last reflection becoming the safelight; then the paper.
export const MOMENT = Object.freeze({
  remember: [-0.07, 0.21], lamp: [-0.07, 0.02], dusk: [-0.04, 0.21],
  depth: [0.21, 0.5], view: [0.22, 0.5], drift: [0.5, 0.66],
  finer: [0.25, 0.45], join: [0.43, 0.52], baseOut: [0.21, 0.42], baseIn: [0.72, 0.9],
  close: [0.66, 0.85, 0.93], shutter: [0.925, 0.965], red: [0.968, 1.04],
  edge: [0.98, 1.02], tip: [1.0, 1.07], wet: [1.008, 1.06], develop: 0.07, withdraw: [1.1, 1.18], sink: [1.15, 1.2],
  exposure: 0.93,     // P at which the exposure ends (the print's image)
  echoes: 8, slices: 64, weight: 4.0, steps: 40, ribbon: 40,
  depthOf: 0.95,      // Dmax: this much of the screen's longer side
  yaw: 0.5, yaw2: 0.36, pitch: -0.06, pitch2: 0.1, dolly: 1.45, focal: 1.5,
});
// The click's clocks: the cover (E) and the reveal (e).
export const MOMENTC = Object.freeze({
  sweep: [0.0, 0.62], dusk: [0.05, 0.6], shutter: [0.66, 0.92], red: [0.8, 1.0],
  wet: [0.04, 0.6], develop: 0.36, settle: [0.62, 1.0],
});

// The evening's clock while the glass remembers.
export const evening = P => smooth(MOMENT.remember[0], MOMENT.remember[1], P);
// The lantern's path, one slow sweep from the lower right (where the world's lantern rests) up and
// across to the upper left, bobbing as it is carried: its place at evening time t, as fractions of
// the screen.
export function lampAt(t) {
  const e = 0.6 * t * t * (3 - 2 * t) + 0.4 * t;
  return [0.88 - 0.78 * e, 0.8 - 0.44 * e + 0.055 * Math.sin(2 * Math.PI * 1.25 * t + 0.4)];
}
// The colour of the light at evening time t: amber, then copper, sage, and midnight blue (Outdoors'
// brass, oxblood and moss, into the night). Linear.
export const TIME_COLOURS = Object.freeze([
  [0.0, [1.0, 0.66, 0.3]], [0.32, [0.95, 0.42, 0.22]], [0.58, [0.46, 0.74, 0.5]], [1.0, [0.26, 0.38, 0.95]],
]);
export function timeColour(t) {
  t = clamp(t);
  for (let i = 1; i < TIME_COLOURS.length; i++) {
    const [b, cb] = TIME_COLOURS[i];
    if (t <= b) {
      const [a, ca] = TIME_COLOURS[i - 1], s = smooth(a, b, t);
      return ca.map((v, k) => v + (cb[k] - v) * s);
    }
  }
  return TIME_COLOURS[TIME_COLOURS.length - 1][1].slice();
}
// The leaves falling past the window: each through part of the evening [a, b], from → to (fractions
// of the screen), swinging as a falling leaf does (f swings, of width swing), turning (spin, rad);
// size (of the screen's shorter side); kind 0 a maple, 1 a birch.
export const LEAVES = Object.freeze([
  Object.freeze({ a: 0.06, b: 0.5, from: [0.22, -0.14], to: [0.47, 1.14], swing: 0.1, f: 1.6, phase: 0.3, spin: 1.1, size: 0.062, kind: 0 }),
  Object.freeze({ a: 0.34, b: 0.8, from: [0.84, -0.12], to: [0.62, 1.12], swing: 0.075, f: 1.3, phase: 2.1, spin: -0.9, size: 0.05, kind: 1 }),
  Object.freeze({ a: 0.58, b: 0.98, from: [0.5, -0.13], to: [0.2, 1.13], swing: 0.085, f: 1.5, phase: 4.0, spin: 1.4, size: 0.056, kind: 0 }),
]);
// A leaf at evening time t: [x, y] (fractions), its angle, or null before and after.
export function leafAt(L, t) {
  const s = (t - L.a) / (L.b - L.a);
  if (s < 0 || s > 1) return null;
  const sw = Math.sin(2 * Math.PI * L.f * s + L.phase);
  return { p: [L.from[0] + (L.to[0] - L.from[0]) * s + L.swing * sw, L.from[1] + (L.to[1] - L.from[1]) * s], angle: 0.75 * Math.cos(2 * Math.PI * L.f * s + L.phase) + L.spin * s };
}

// The echoes' intervals: the level ℓ (8 · 2^(ℓ−3) instants, ℓ 3 … 6) as the evening gains depth.
export const level = P => 3 + 3 * smooth(MOMENT.finer[0], MOMENT.finer[1], P);
// The instants, of the finest set (64): instant i is t = (i + 1)/64, first shown at its level (8 at ℓ 3,
// the halves between at 4, …). Its weight at level ℓ: those shown share the evening's weight W
// evenly, the newest coming in as the others give way, so the total stays W.
export function instantLevel(i, n = MOMENT.slices) {
  let k = i + 1, lev = Math.log2(n);
  while (k % 2 === 0 && lev > 3) { k /= 2; lev--; }
  return lev;
}
export function instantWeight(i, l, W = MOMENT.weight, n = MOMENT.slices) {
  const L = Math.floor(l), f = l - L, lev = instantLevel(i, n);
  if (L >= Math.log2(n)) return lev <= L ? W / n : 0;
  if (lev <= L) return (W / 2 ** L) * (1 - f / 2);
  if (lev === L + 1) return (W / 2 ** (L + 1)) * f;
  return 0;
}
// How deep the evening is (CSS px) at P, for a screen W × H: open, held, and closed slowest last.
export function depthAt(P, W, H) {
  const Dm = MOMENT.depthOf * Math.max(W, H);
  const open = smooth(MOMENT.depth[0], MOMENT.depth[1], P);
  const s = smooth(MOMENT.close[0], MOMENT.close[2], P);
  return Dm * open * (1 - s) ** 3;
}
// The camera: yaw, pitch (rad) and dolly (1 at the window), easing aside, turning a little while held,
// and coming back to the front.
export function viewAt(P) {
  const a = smooth(MOMENT.view[0], MOMENT.view[1], P), d = smooth(MOMENT.drift[0], MOMENT.drift[1], P), c = smooth(MOMENT.close[0], MOMENT.close[1], P);
  const yaw = (MOMENT.yaw * a + (MOMENT.yaw2 - MOMENT.yaw) * d) * (1 - c);
  const pitch = (MOMENT.pitch * a + (MOMENT.pitch2 - MOMENT.pitch) * d) * (1 - c);
  return { yaw, pitch, dolly: 1 + (MOMENT.dolly - 1) * a * (1 - c) };
}
// A ray from the camera through screen point s (CSS px), for a screen W × H and depth D: origin and
// direction (world: x, y as the screen, y down; z into the screen; the window at z = 0).
export function rayAt(s, W, H, D, v) {
  const F = MOMENT.focal * H, c = [W / 2, H / 2, D / 2];
  const rot = p => {
    // pitch about x, then yaw about y
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    const y1 = p[1] * cp - p[2] * sp, z1 = p[1] * sp + p[2] * cp;
    return [p[0] * cy + z1 * sy, y1, -p[0] * sy + z1 * cy];
  };
  const e = rot([0, 0, -F * v.dolly - c[2]]).map((x, k) => x + c[k]);
  const d0 = [s[0] - W / 2, s[1] - H / 2, F], n = Math.hypot(...d0);
  return { o: e, d: rot(d0.map(x => x / n)) };
}
// The crossing integral: for f along a ray (as a function of the evening's time u), the exposure of a
// thin bright edge where f = 0 (∫ e^(−(f/w)²) du) is, at each crossing, w√π / |f′|: so a sheet seen
// edge-on, f changing slowly, is bright. fs: f at n + 1 even samples over [u0, u1].
export function crossingIntegral(fs, u0, u1, w) {
  const h = (u1 - u0) / (fs.length - 1);
  let s = 0;
  for (let k = 0; k + 1 < fs.length; k++) {
    const a = fs[k], b = fs[k + 1];
    if ((a < 0) === (b < 0)) continue;
    const slope = Math.abs(b - a) / h;
    s += (w * Math.sqrt(Math.PI)) / Math.max(slope, 1e-6);
  }
  return s;
}

// ---- development (the paper's characteristic curve) ------------------------------------------------
export const HD = Object.freeze({ dmax: 2.0, gamma: 5.5, x0: 0.6, tau: 0.16 });
export const hdDensity = (x, { dmax, gamma, x0 } = HD) => dmax / (1 + Math.exp(-gamma * (x - x0)));
export const induction = x => 0.04 + 0.34 * (1 - smooth(0.2, 0.9, x));
export function densityAt(x, t, hd = HD) {
  return hdDensity(x, hd) * (1 - Math.exp(-Math.max(0, t - induction(x)) / hd.tau));
}
export const grainFraction = (D, dmax = HD.dmax) => (1 - 10 ** -D) / (1 - 10 ** -dmax);

// ---- the sheet into the developer -----------------------------------------------------------------
// When the developer reaches the point (u, v) of the sheet (0 … 1 from its top left), as a fraction of
// the wetting: the meniscus comes in from the lower left corner and crosses to the upper right, its
// front bowed (the middle of it ahead).
export function wetAt(u, v) {
  const a = (u + 1 - v) / 2, b = (u - 1 + v) / 2;
  return clamp(0.92 * a + 0.32 * b * b);
}
