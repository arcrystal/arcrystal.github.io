// Stars, nebulae, stardust, drops, ice (Science → Racing): the plan. Simulated once per screen size in
// dew-worker.js (never per frame) and read by glsl/dew.js and glsl/units.js. Deterministic from a seed
// and the size; coordinates are CSS px (y down), time is the seam's progress P.
//
// The story and its physics (the tests check each):
//   Nebulae. A few of Science's giants end, spaced so that each nebula stays whole and only the outer
//   fringes of their shock waves cross. The hot supergiants explode as supernovae: a breakout flash,
//   then the ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe light curve (mean lives 8.8 d : 111.3 d), and a remnant expanding
//   freely, then as a Sedov–Taylor blast wave (R ∝ t^⅖): the Crab (a pulsar wind nebula in a cage of
//   filaments), Cassiopeia A (a knotty ring), the Veil (braided arcs, hydrogen inside, oxygen outside),
//   SN 1987A (a ring of hot spots, two outer rings). The cooler giants shed planetary nebulae instead:
//   the Cat's Eye (nested shells, jets, a halo of rings), the Ring, the Butterfly.
//   Stardust. Behind each shock the gas is unstable and breaks into cores; each core's gas falls in on
//   itself. A grain starting at r₀ falls as a shell of a cloud in free fall, r = r₀ cos²β with
//   t/t_ff = (β + sin β cos β)/(π/2), and keeps its angular momentum, so r² dθ/dt is constant and
//   θ − θ₀ = Ω tan β: an exact spiral, quickening as it closes. The outer shells arrive later (inside-
//   out collapse), at a steady rate (Shu 1977: Ṁ constant), so each drop's volume grows linearly as
//   its grains arrive. Its colour is its gas's light. A fine mist condenses between the cores (classical
//   nucleation, J ∝ exp(−B / ln²S)); drops grow and merge, keeping volume (r³ = r₁³ + r₂³) at the
//   volume-weighted centroid and mixing their colours by volume.
//   Stars. Science's small stars condense too, each into a bead of clear water with its light at its
//   heart (the plan repeats the sky's hash, so each bead is where its star was).
//   Accretion. The base fracture plan is immediately available to clicks. dew-worker.js then adds
//   the gravitational/cooling bake from accretion-plan.js: cached polar histories, measured collection,
//   lens tables and a circle-to-stadium settlement. Only scroll progress evaluates the finished plan.
//   The compact cubic entries below remain the base plan used by the static share-card tools.

import { packAccretion } from './accretion-plan.js';
import { packOptics } from './accretion-optics.js';
import { TRACK, trackFrame, trackLocal, trackToWorld, trackPoint, trackTangent, trackDistance, trackShardAt } from './track-plan.js';
import { HOLD, holdFor, glassEase, transitP } from '../lerp.js';
import { GIANTS, giantCount } from './giants.js';
import { PALETTE, lineRGB, rgb, toLinear } from './palette.js';

export const DEW = Object.freeze({
  seed: 41,
  // A click's ring of dawn (scene.js's DOM aperture is built on it): from the click at clear0, at the
  // farthest corner clearUp later, each point clear clearD after the ring.
  click: Object.freeze({ clear0: 0.84, clearUp: 0.18, clearD: 0.08 }),
});
// ---- Science's stars ----------------------------------------------------------------------------------
// The small stars of Science's sky (glsl/cosmos.js cosmosStars), mirrored here so each can condense into
// a drop of its own: three layers of cells (46, 34, 22 px), a star in a cell whose hash clears the
// layer's threshold, placed and tinted by more hashes. The hash is Hoskins' sine-free one, worked in
// float32 as the GPU does, so the plan's stars are the sky's. Each condenses at its own time between c0
// and c0 + span (the same hash in the shader dims it from the sky), its light gathering for grow into a
// bead r px across by layer (a brighter star, a larger bead); frozen, the bead keeps the star's light,
// and when its piece of the pane breaks away it leaves as a shard of its own (makeFragments).
export const SKY = Object.freeze({ c0: 0.35, span: 0.12, grow: 0.03, r: Object.freeze([2.2, 3.0, 3.8]), shard: 0.8 });
const f32 = Math.fround, fr32 = v => f32(v - Math.floor(v));
const mix3 = (x, y) => { let a = fr32(f32(x * f32(0.1031))), b = fr32(f32(y * f32(0.1031))), c = a; return [a, b, c]; };
function hoskins(p3) {
  let [a, b, c] = p3;
  const k = f32(33.33);
  const d = f32(f32(f32(a * f32(b + k)) + f32(b * f32(c + k))) + f32(c * f32(a + k)));
  return [f32(a + d), f32(b + d), f32(c + d)];
}
// glsl/common.js hash(vec2), hash2(vec2).
export function hashG(x, y) {
  const [a, b, c] = hoskins(mix3(f32(x), f32(y)));
  return fr32(f32(f32(a + b) * c));
}
export function hash2G(x, y) {
  x = f32(x); y = f32(y);
  const [a, b, c] = hoskins([fr32(f32(x * f32(0.1031))), fr32(f32(y * f32(0.103))), fr32(f32(x * f32(0.0973)))]);
  return [fr32(f32(f32(a + b) * c)), fr32(f32(f32(a + c) * b))];
}
// Each hash read through a triangle wave (glsl/cosmos.js tri): uniform still, and continuous where it
// wraps, so the GPU's last bits (its rounding is not quite float32's) never move a star far.
export const tri = h => 1 - Math.abs(2 * h - 1);
// Every star whose centre is in the W × H view: its place, layer, brightness hash, tint (0 cool .. 1
// warm) and when it condenses.
export function skyStars(W, H) {
  const out = [];
  for (let l = 0; l < 3; l++) {
    const sc = 46 - l * 12, cut = 0.86 - l * 0.05, o3 = f32(l * 3.1), o17 = f32(l * 17), o7 = f32(l * 7.7);
    for (let j = 0; j <= Math.ceil(H / sc); j++) for (let i = 0; i <= Math.ceil(W / sc); i++) {
      const b = tri(hashG(f32(i + o3), f32(j + o3)));
      if (b < cut) continue;
      const h = hash2G(f32(i + o17), f32(j + o17));
      const c = [(i + 0.5 + (tri(h[0]) - 0.5) * 0.8) * sc, (j + 0.5 + (tri(h[1]) - 0.5) * 0.8) * sc];
      if (c[0] < 0 || c[1] < 0 || c[0] >= W || c[1] >= H) continue;
      out.push({ c, l, b, tint: tri(hashG(i + 9, j + 9)), t: SKY.c0 + SKY.span * tri(hashG(f32(i + o7), f32(j + 23))) });
    }
  }
  return out;
}

// ---- supernovae ---------------------------------------------------------------------------------------
// end: the last explosion; cover: by when the nebulae reach their full size; cool: how long a swept-up
// gas takes to cool enough for its mist to condense.
export const SN = Object.freeze({
  end: 0.16, cover: 0.28, xst: 0.15, cool: 0.24,
  tauNi: 0.006, tauCo: 0.006 * 111.3 / 8.8, rise: 0.0035, epsCo: 0.174,
});
const ST_K = Math.pow(SN.xst, 0.6);
// A remnant's radius as a fraction of its final one, x = time since the explosion over its span:
// free expansion x, Sedov–Taylor κx^0.4 (κ puts the change at x = .15), joined smoothly.
const rRaw = x => x <= 0 ? 0 : Math.pow(Math.pow(x, -3) + Math.pow(ST_K * Math.pow(x, 0.4), -3), -1 / 3);
export const remnantFrac = x => rRaw(x) / rRaw(1);
function invert(f, y) {
  if (y <= 0) return 0;
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (f(m) < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export const remnantInverse = y => invert(remnantFrac, y);
// Its light curve (peak about 1): a soft breakout glow, then the decay heating (Arnett), with a rise as
// the light diffuses out (eased, so the flash swells rather than pops).
export function lightCurve(s) {
  if (s <= 0) return 0;
  const decay = (1 - SN.epsCo) * Math.exp(-s / SN.tauNi) + SN.epsCo * Math.exp(-s / SN.tauCo);
  return 0.45 * Math.exp(-s / 0.004) * (1 - Math.exp(-((s / 0.0015) ** 2))) + decay * (1 - Math.exp(-((s / SN.rise) ** 2)));
}
// ---- the remnants ---------------------------------------------------------------------------------------
// Every chosen giant ends as a supernova (the red supergiants too: they are the progenitors of type
// II-P), and each leaves a spherical remnant: a shell of swept-up gas between the reverse shock and the
// forward shock, filamentary, its inner edge rippled into Rayleigh–Taylor fingers, knots of ejecta
// within (glsl/dew.js dewSphere draws it). They differ by their physics, not their shapes: a hot (blue)
// progenitor's remnant glows more in [O III], a cool (red) one's in Hα and [S II]; each its own seed.
const ranksOf = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
const combos = (a, k) => { const out = [], c = []; const rec = s => { if (c.length === k) { out.push(c.slice()); return; } for (let i = s; i < a.length; i++) { c.push(a[i]); rec(i + 1); c.pop(); } }; rec(0); return out; };
// How hot a progenitor was, 0 (red, 3,400 K) to 1 (blue, 25,000 K and over).
export const hotOf = T => smooth((Math.log(T) - Math.log(3400)) / (Math.log(25000) - Math.log(3400)));
export function makeEvents(W, H, holdP, seed) {
  const random = rng(seed * 977 + W * 3 + H), phone = W < 700;
  // Which giants end: the set (seven, four on a phone) spread farthest apart, so each remnant has room
  // of its own.
  const n = giantCount(W), all = Array.from({ length: n }, (_, i) => i);
  const pos = i => [W * GIANTS[i].x, H * GIANTS[i].y];
  let set = null, best = -1;
  for (const s of combos(all, phone ? 4 : 7)) {
    let score = Infinity;
    for (let a = 0; a < s.length; a++) {
      const p = pos(s[a]);
      score = Math.min(score, 2.6 * Math.min(p[0], W - p[0], p[1], H - p[1]) + 0.18 * Math.min(W, H));
      for (let b = a + 1; b < s.length; b++) { const q = pos(s[b]); score = Math.min(score, Math.hypot(p[0] - q[0], p[1] - q[1])); }
    }
    if (score > best) { best = score; set = s; }
  }
  // Each remnant's radius: .6 of the way to its nearest neighbour, so two neighbours' outer tenths
  // cross and no more.
  const nn = set.map(i => Math.min(...set.filter(j => j !== i).map(j => Math.hypot(pos(i)[0] - pos(j)[0], pos(i)[1] - pos(j)[1]))));
  // A random order of endings that is not a sweep: of every order, one of those whose ranks are least
  // correlated with the stars' heights and with their places across the screen (|ρ| < .3 where any
  // order allows it).
  const m = set.length;
  const rho = (order, f) => { const c = (m - 1) / 2; let a = 0, b = 0, d = 0; const r = ranksOf(order.map(g => f(GIANTS[g]))); order.forEach((_, k) => { a += (k - c) * (r[k] - c); b += (k - c) ** 2; d += (r[k] - c) ** 2; }); return a / Math.sqrt(b * d); };
  const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(q => [x, ...q]));
  const scored = perms(set).map(o => [o, Math.max(Math.abs(rho(o, g => g.y)), Math.abs(rho(o, g => g.x)))]);
  const least = Math.max(0.3, Math.min(...scored.map(x => x[1])) + 1e-9), fit = scored.filter(x => x[1] < least);
  const order = fit[Math.floor(random() * fit.length)][0];
  const t0 = holdP + 0.03, span = SN.end - t0;
  return order.map((g, rank) => {
    const G = GIANTS[g], t = t0 + span * (rank + 0.2 + 0.6 * random()) / m;
    return { giant: g, S: pos(g), t, span: SN.cover - t, type: 0, Rmax: 0.6 * nn[set.indexOf(g)], L: G.L, T: G.T, hot: hotOf(G.T), seed: random(),
      angle: random() * Math.PI * 2, aspect: 1, spin: random() < 0.5 ? -1 : 1, phase: [0, 1, 2, 3].map(() => random() * Math.PI * 2) };
  });
}
// A remnant's radius at P, and its inverse: when it reaches distance d from its star.
export const expandFrac = (e, x) => remnantFrac(x);
export const nebulaRadius = (e, P) => e.Rmax * expandFrac(e, (P - e.t) / e.span);
const reachTime = (e, d) => e.t + e.span * invert(x => expandFrac(e, x), d / e.Rmax);
// The frame of remnant e: u = rotate(−angle)(q − S) / R (|u| = 1 at its forward shock).
export function nebFrame(e, q, R = e.Rmax) {
  const c = Math.cos(e.angle), s = Math.sin(e.angle), dx = q[0] - e.S[0], dy = q[1] - e.S[1];
  return [(c * dx + s * dy) / (R * e.aspect), (-s * dx + c * dy) / R];
}
// The shell's reach: its inner edge (the contact discontinuity, about .8 of the forward shock) and the
// ejecta's sphere (.7).
export const SHELL = Object.freeze({ inner: 0.8, ejecta: 0.7 });
// How much gas remnant e holds along the line of sight through frame point u, grown: the shell's column
// (both halves, √(1 − ρ²) − √(a² − ρ²) each: the limb brightening) and the ejecta's, without the
// filaments' noise (glsl/dew.js dewSphere).
export function nebDensity(e, q) {
  const [x, y] = nebFrame(e, q), r2 = x * x + y * y;
  if (r2 > 1.25) return 0;
  const outer = Math.sqrt(Math.max(1 - r2, 0)), inner = Math.sqrt(Math.max(SHELL.inner ** 2 - r2, 0)), ej = Math.sqrt(Math.max(SHELL.ejecta ** 2 - r2, 0));
  return 1.4 * (outer - inner) + 0.3 * ej;
}
// The colours of the remnants' light (linear sRGB, brightest channel 1): Hα with [N II], [S II],
// [O III], and the mixes the eye sees, as Science's palette maps them (palette.js).
export const NEB_RGB = lineRGB(PALETTE);
const mixC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// What colour the gas is at q (h: a uniform draw for the variety within a zone), its brightest channel 1:
// the outer shocked gas gold and amber, the ejecta teal (more of it from a hotter progenitor), cream
// between.
export function nebColour(e, q, h) {
  const c = nebMix(e, q, h), m = Math.max(...c);
  return c.map(v => v / m);
}
function nebMix(e, q, h) {
  const [x, y] = nebFrame(e, q), r = Math.hypot(x, y), C = NEB_RGB, hot = e.hot ?? 0.5;
  if (r < SHELL.ejecta - 0.05) return h < 0.3 + 0.4 * hot ? mixC(C.o3, C.blue, h) : mixC(C.o3, C.green, h);
  if (r < SHELL.inner) return h < 0.5 ? C.yellow : mixC(C.white, C.o3, 0.3 * hot);
  return h < 0.2 * hot ? mixC(C.o3, C.green, h) : h < 0.55 ? mixC(C.ha, C.gold, h) : mixC(C.ha, C.s2, h);
}
// Which nebula q is in (its densest there), or -1.
export function nebulaAt(plan, q) {
  let best = -1, bd = 0.02;
  plan.events.forEach((e, k) => { const d = nebDensity(e, q); if (d > bd) { bd = d; best = k; } });
  return best;
}
// When q's gas is reached and swept up (Infinity outside every nebula).
export function shockAt(plan, q) {
  let best = Infinity;
  for (const e of plan.events) {
    const [x, y] = nebFrame(e, q);
    const u = Math.hypot(x, y);
    if (u > 1.3) continue;
    best = Math.min(best, reachTime(e, u * e.Rmax));
  }
  return best;
}
// When q's gas has cooled and its mist condenses; when the pane at q comes alive (the shader's clock).
export const condensedAt = (plan, q) => shockAt(plan, q) + SN.cool;
export const paneAt = (plan, q) => shockAt(plan, q) + 0.02;

// P at which Racing's hold begins (the strip moves until then): the supernovae wait for it, so while
// the strip comes in its top edge is Science as it is.
export function holdStartP(phone) {
  const pin = phone ? HOLD.pinTouch : HOLD.pin, L = holdFor('glass', pin);
  const R = pin * L.pin, p = L.leadIn / (R + L.leadIn + L.leadOut);
  return transitP(glassEase(p, pin));
}
export const KIND = Object.freeze({ drop: 0, merged: 1, slider: 2, pearl: 3, stopped: 4 });

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hypot = Math.hypot;
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- a click into Racing (shared with glsl/dew.js and glsl/units.js) ------------------------------------
// The scroll's story, quicker and about the click (P −.2 → .84 covers the old page; it changes; .84 →
// 1.2 reveals the new one). A star dies at the click: its flash, then its light racing out (echo), lighting
// the remnants' gas over the page as it passes, which covers it. The gas falls into its clumps, nearest
// the click first (spots after the light; the falls kappa as long); the stars condense into beads (bead:
// their times compressed). The cold spreads from the click (freeze), each drop freezing and splitting
// split later. The click draws everything in: a point sink, whose field in two dimensions falls as 1/r,
// so an overdamped shard's r² falls steadily, r = r₀√(1 − t/T), T = fly[0] + fly[1]·up²; a place shows
// Racing's night once what was there has gone (open). The light gathers at the click, a new star; once
// the page has changed it goes out as a ring of dawn, the front the new page opens behind (clearStart,
// which scene.js's DOM aperture follows).
export const CLICK = Object.freeze({ echo: Object.freeze([-0.13, 0.25]), spots: 0.1, kappa: 0.5, bead: 0.35, freeze: Object.freeze([0.3, 0.24]), split: 0.02, lag: 0.006, stagger: 0.01, fly: Object.freeze([0.04, 0.16]), open: 0.012 });
export const dewFar = (W, H, O) => hypot(Math.max(O[0], W - O[0]), Math.max(O[1], H - O[1]));
// 0 at the click, 1 at the farthest corner.
export const upOf = (plan, q, O) => hypot(q[0] - O[0], q[1] - O[1]) / dewFar(plan.W, plan.H, O);
export const clickEcho = up => CLICK.echo[0] + CLICK.echo[1] * up;
export const clickSpots = up => clickEcho(up) + CLICK.spots;
export const clickFreeze = up => CLICK.freeze[0] + CLICK.freeze[1] * up;
export const clickFlight = up => CLICK.fly[0] + CLICK.fly[1] * up * up;
// When a click's drop at up has gone (its shards' latest start, plus their flight) and its place shows
// Racing's night.
export const clickOpen = up => clickFreeze(up) + CLICK.split + CLICK.lag + CLICK.stagger + clickFlight(up) + CLICK.open;
// Where a shard pulled from home into the click O is, u of the way through its flight.
export const clickPull = (home, O, u) => { const k = Math.sqrt(Math.max(0, 1 - u)); return [O[0] + (home[0] - O[0]) * k, O[1] + (home[1] - O[1]) * k]; };
const wobble = (q, up) => 0.006 * Math.sin(q[0] * 0.008) * Math.sin(q[1] * 0.007) * up;
// The ring of dawn (scene.js's DOM aperture follows it).
export function clearStart(plan, q, O) {
  const up = upOf(plan, q, O);
  return DEW.click.clear0 + DEW.click.clearUp * up + wobble(q, up);
}
// How clear a click has left q at P: the new page there, behind the ring.
export const clearAt = (plan, q, P, O) => smooth((P - clearStart(plan, q, O)) / DEW.click.clearD);

// Science's six chrome drops (glsl/cosmos.js cosmosDrop) at their resting places: centre, radius and
// how far they wobble (the sixth also follows the pointer).
export function scienceDrops(W, H) {
  return [
    [0.78, 0.32, 0.15, 26], [0.62, 0.62, 0.07, 40], [0.92, 0.74, 0.055, 30],
    [0.88, 0.1, 0.04, 18], [0.1, 0.86, 0.05, 22], [0.7, 0.46, 0.035, 50],
  ].map(([x, y, r, amp], i) => ({ c: [W * x, H * y], r: H * r, amp, i }));
}

// A drop's radius at P: its volume grows at q from t0 until tg (its growth's end) or it freezes (tf).
export function radiusAt(rec, P) {
  const t = Math.min(P, rec.tg, rec.tf ?? Infinity);
  return Math.cbrt(Math.max(0, rec.V0 + rec.q * Math.max(0, t - rec.t0)));
}
// ---- the remnants' gas, mirrored ---------------------------------------------------------------------------
// glsl/dew.js dewN3, dewTurb3, dewFbm3 and dewSphere's light, here in double precision (each lattice
// value is read through a triangle wave, so the GPU's float32 rounding moves it by a few thousandths at
// most), so the plan's gas is the screen's and its clumps form on the filaments that are drawn.
const fract = v => v - Math.floor(v);
export function hash3G(x, y, z) {
  x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
  const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  return fract((x + d + y + d) * (z + d));
}
const t3 = (x, y, z) => 1 - Math.abs(2 * hash3G(x, y, z) - 1);
const lerp = (a, b, t) => a + (b - a) * t;
export function noise3G(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(lerp(t3(ix, iy, iz), t3(ix + 1, iy, iz), ux), lerp(t3(ix, iy + 1, iz), t3(ix + 1, iy + 1, iz), ux), uy),
    lerp(lerp(t3(ix, iy, iz + 1), t3(ix + 1, iy, iz + 1), ux), lerp(t3(ix, iy + 1, iz + 1), t3(ix + 1, iy + 1, iz + 1), ux), uy), uz);
}
export function turb3G(x, y, z) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 4; i++) { s += a * Math.abs(2 * noise3G(x, y, z) - 1); x = x * 2.07 + 1.7; y = y * 2.07 + 9.2; z = z * 2.07 + 4.4; a *= 0.5; }
  return s;
}
export function fbm3G(x, y, z) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 3; i++) { s += a * noise3G(x, y, z); x = x * 2.03 + 5.1; y = y * 2.03 + 2.3; z = z * 2.03 + 7.9; a *= 0.5; }
  return s;
}
const sstep = (a, b, x) => smooth((x - a) / (b - a));
// How much light remnant e's gas gives at frame point u (|u| = 1 at its shock) and its colour's
// weights: [total, shell (gold), teal (the shell's [O III] patches and the ejecta)]. dewSphere's terms,
// without the rim and the young glow.
export function sphereGas(u, x, sd, hot) {
  const r2 = u[0] * u[0] + u[1] * u[1], r = Math.sqrt(r2);
  if (r > 1.1) return [0, 0, 0];
  sd = Math.fround(sd);
  const o = [sd * 37.1, sd * 19.7, sd * 7.3 + x * 0.5];
  const zm = Math.sqrt(Math.max(0.88 * 0.88 - r2, 0));
  const one = (z, k) => {
    const L = Math.max(Math.hypot(u[0], u[1], z), 1e-3);
    const a = 0.8 + 0.1 * (2 * noise3G(u[0] / L * 3.4 + o[0] + k * 3, u[1] / L * 3.4 + o[1] + k * 3, z / L * 3.4 + o[2] + k * 3) - 1);
    const col = Math.max(Math.sqrt(Math.max(1 - r2, 0)) - Math.sqrt(Math.max(a * a - r2, 0)), 0);
    const w = Math.max(1 - turb3G(u[0] * 3.4 + o[0] + 5 * k, u[1] * 3.4 + o[1] + 5 * k, z * 3.4 + o[2] + 5 * k), 0) ** 5;
    const b = sstep(0.35, 0.75, fbm3G(u[0] * 2.6 + o[0] + 9 + 4 * k, u[1] * 2.6 + o[1] + 9 + 4 * k, z * 2.6 + o[2] + 9 + 4 * k));
    const limb = 1 - 0.7 * sstep(0.84, 0.99, r);
    return col * ((0.03 + 0.3 * b) * limb + 4.8 * w * (0.35 + 0.65 * b)) * (k ? 0.7 : 1);
  };
  const shell = one(zm, 0) + one(-zm, 1);
  const teal = hot * 0.55 * sstep(0.4, 0.7, noise3G(u[0] * 1.9 + o[0] + 21, u[1] * 1.9 + o[1] + 21, zm * 1.9 + o[2] + 21));
  const ce = Math.sqrt(Math.max(0.49 - r2, 0));
  const kn = fbm3G(u[0] * 5.2 + o[0], u[1] * 5.2 + o[1], sd * 3 + o[2]);
  const knots = sstep(0.5 - 0.06 * hot, 0.72, kn) * (0.4 + 0.6 * Math.max(1 - turb3G(u[0] * 7 + o[0] + 40, u[1] * 7 + o[1] + 40, sd + o[2] + 40), 0) ** 2) * ce * (1 + 1.6 * hot);
  return [shell + knots, shell * (1 - teal), shell * teal + knots];
}
// Remnant e's size and age when its gas is drawn for the last time (SPOTS.still; transit.js GAS_STILL).
const ageAt = (e, P) => (P - e.t) / e.span;
// The gas at screen point q as the clumps start to form: its light (the remnants' at their age then,
// as bright as dewGasField draws them, plus the faint gas between) and its colour.
export function gasAt(plan, q, P = SPOTS.still) {
  let rho = SPOTS.ism, gold = 0, teal = 0;
  for (const e of plan.events) {
    const x = ageAt(e, P), R = e.Rmax * remnantFrac(x), dx = q[0] - e.S[0], dy = q[1] - e.S[1];
    if (R < 1 || Math.hypot(dx, dy) > R * 1.1) continue;
    const lit = (1 + 2.5 * Math.exp(-x / 0.06)) / (1 + 1.2 * x), k = lit * e.L * 1.2;
    const [t, g, c] = sphereGas([dx / R, dy / R], clamp(x, 0, 1), e.seed, e.hot);
    rho += t * k; gold += g * k; teal += c * k;
  }
  return { rho, gold, teal };
}

// ---- gravity's spots ------------------------------------------------------------------------------------
// Once the remnants' gas has cooled it is unstable to its own gravity (Jeans): a region larger than the
// Jeans length λ_J = c √(π / Gρ) collapses, a smaller one is held up by its pressure and turbulence (c²
// = c_s² + σ²/3, the sound speed and the turbulent motions together). So the gas breaks into clumps
// about λ_J apart, closer where it is dense (λ_J ∝ ρ^−½): many clumps along the bright filaments, a few
// in the thin gas between; larger where the gas is hotter (the [O III] gas) or more turbulent, whose
// Jeans mass, ρλ_J², is larger. Each clump gathers the gas of its own
// cell (the points nearer it than any other, measured in Jeans lengths, so a larger clump owns more)
// and falls in on itself in free fall, t_ff = √(3π / 32Gρ), the dense first (r = r₀ cos²β with
// t/t_ff = (β + sin β cos β)/(π/2): a uniform sphere falls in all at once). Its gas becomes a drop of
// its volume, in its colours. Here ρ is the light the gas gives (dewSphere), a stand-in for its
// density.
//   still: when the gas is drawn for the last time (transit.js GAS_STILL); grow0: when the pattern
//   begins to show (it grows as e^{σt} until its clumps start to fall, start ± jitter); tff: the free
//   fall at ρ0, between tffMin and tffMax; ell0: λ_J at ρ0 (px at 900 px tall), between ellMin and
//   ellMax; grid: the sampling of the gas (px); beta: the drop's volume per unit of gathered light;
//   rMax: the largest drop as a share of its λ_J; ism: the faint gas between the remnants; residual:
//   how much of the gas is left behind.
export const SPOTS = Object.freeze({
  still: 0.3, grow0: 0.22, start: 0.29, jitter: 0.02, tff: 0.055, tffMin: 0.035, tffMax: 0.16,
  ell0: 22, ellMin: 15, ellMax: 110, rho0: 1, grid: 8, beta: 0.2, rMax: 0.38, ism: 0.06, residual: 0.15, tile: 32,
});
// The Jeans length at light ρ (px, k the screen's scale).
export const jeansLength = (rho, k = 1, c2 = 1) => clamp(SPOTS.ell0 * Math.sqrt(c2 * SPOTS.rho0 / Math.max(rho, 1e-4)), SPOTS.ellMin, SPOTS.ellMax) * k;
// c² at q over the cold gas's: hotter where the gas glows in [O III] (teal: its share of the light),
// more turbulent in patches.
export const supportAt = (q, tealShare) => 1 + 1.4 * tealShare + 3 * Math.max(0, 2 * fbm3G(q[0] / 140, q[1] / 140, 3.3) - 0.8) ** 2;
// The free-fall time at light ρ.
export const freeFallTime = rho => clamp(SPOTS.tff * Math.sqrt(SPOTS.rho0 / Math.max(rho, 1e-4)), SPOTS.tffMin, SPOTS.tffMax);
// Free fall: the angle β at time τ = t/t_ff (Kepler's equation for a radial orbit), and the shell's
// radius over its first, cos²β.
export function fallAngle(tau) {
  if (tau <= 0) return 0;
  if (tau >= 1) return Math.PI / 2;
  let b = tau * Math.PI / 4;
  for (let k = 0; k < 30; k++) b -= (b + Math.sin(b) * Math.cos(b) - tau * Math.PI / 2) / (1 + Math.cos(2 * b));
  return b;
}
export const freeFall = tau => Math.cos(fallAngle(tau)) ** 2;
export function makeClumps(plan, random) {
  const { W, H } = plan, k = clamp(H / 900, 0.8, 1.5), g = SPOTS.grid * k;
  const cols = Math.ceil(W / g), rows = Math.ceil(H / g), n = cols * rows;
  const rho = new Float64Array(n), gold = new Float64Array(n), teal = new Float64Array(n);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = gasAt(plan, [(i + 0.5) * g, (j + 0.5) * g]), m = j * cols + i;
    rho[m] = a.rho; gold[m] = a.gold; teal[m] = a.teal;
  }
  // Sites, densest first: each placed at a jittered sampling point, at least the mean of its own and
  // each neighbour's Jeans length from every site before it (a Poisson disc of varying radius).
  const order = Array.from({ length: n }, (_, m) => [rho[m] * (0.8 + 0.4 * random()), m]).sort((a, b) => b[0] - a[0]);
  const G = SPOTS.ellMin * k, hc = Math.ceil(W / G) + 1, hash = new Map(), sites = [];
  const reach = Math.ceil(SPOTS.ellMax * k / G);
  for (const [, m] of order) {
    const i = m % cols, j = (m - i) / cols, c = [(i + 0.5 + (random() - 0.5) * 0.9) * g, (j + 0.5 + (random() - 0.5) * 0.9) * g];
    const c2 = supportAt(c, teal[m] / Math.max(gold[m] + teal[m], 1e-9));
    const ell = jeansLength(rho[m], k, c2), gx = Math.floor(c[0] / G), gy = Math.floor(c[1] / G), jit = 0.9 + 0.2 * random();
    let ok = true;
    for (let y = gy - reach; y <= gy + reach && ok; y++) for (let x = gx - reach; x <= gx + reach && ok; x++) {
      for (const s of hash.get(y * hc + x) ?? []) if (Math.hypot(s.c[0] - c[0], s.c[1] - c[1]) < 0.5 * (ell + s.ell) * jit) { ok = false; break; }
    }
    if (!ok) continue;
    const s = { c, ell, c2, rho: rho[m], mass: 0, gold: 0, teal: 0, R: 0 };
    sites.push(s);
    const key = gy * hc + gx;
    if (!hash.has(key)) hash.set(key, []);
    hash.get(key).push(s);
  }
  // Each sampling point's gas goes to the site nearest it in Jeans lengths (its cell).
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const p = [(i + 0.5) * g, (j + 0.5) * g], gx = Math.floor(p[0] / G), gy = Math.floor(p[1] / G);
    let best = null, bd = Infinity;
    for (let y = gy - reach; y <= gy + reach; y++) for (let x = gx - reach; x <= gx + reach; x++) {
      for (const s of hash.get(y * hc + x) ?? []) { const d = Math.hypot(s.c[0] - p[0], s.c[1] - p[1]) / s.ell; if (d < bd) { bd = d; best = s; } }
    }
    if (!best) continue;
    const m = j * cols + i, w = g * g * (1 - SPOTS.residual);
    best.mass += rho[m] * w; best.gold += gold[m] * w; best.teal += teal[m] * w;
    best.R = Math.max(best.R, Math.hypot(best.c[0] - p[0], best.c[1] - p[1]) + g * 0.71);
  }
  // Its drop: the volume of the gas it gathered (no larger than rMax of its Jeans length): what its
  // cell shows is a column, and the clump's depth along it is its Jeans length too, so its mass is its
  // cell's light times λ_J (the Jeans mass, ρλ_J³ ∝ c³ρ^−½: larger clumps where the gas is thin or hot).
  // Its colour the gas's (gold where the shell's light was, teal where the [O III]); its fall.
  const C = NEB_RGB;
  for (const s of sites) {
    s.mass *= s.ell / (SPOTS.ell0 * k);
    const r = Math.min(Math.cbrt(SPOTS.beta * s.mass / k ** 2) * k, SPOTS.rMax * s.ell);
    const tg = s.teal / Math.max(s.gold + s.teal, 1e-9), h = random();
    const goldC = mixC(mixC(C.ha, C.gold, h), C.s2, 0.25 * random()), tealC = mixC(C.o3, h < 0.5 ? C.blue : C.green, 0.35 * random());
    const col = mixC(goldC, tealC, sstep(0.25, 0.75, tg)), mx = Math.max(...col);
    s.r = Math.max(0.9, r); s.col = col.map(v => v / mx);
    s.ts = SPOTS.start + (random() - 0.5) * 2 * SPOTS.jitter;
    s.tsnap = s.ts + freeFallTime(s.rho);
  }
  plan.spotGrid = { cols, rows, cell: g };
  return sites;
}

// Racing's card has moved (the same screen): what depends on where it is, redone (dew-worker.js).
export function aimShards(plan, card) {
  plan.cardRect = card.map(Number);
  if (!plan.accretion) makeShards(plan);
}

// ---- the plan ---------------------------------------------------------------------------------------------
export function makeDewPlan(W, H, { seed = DEW.seed, phone = W < 700, card = null } = {}) {
  W = Math.round(W); H = Math.round(H);
  const random = rng(seed + W * 7 + H * 13);
  const plan = { W, H, phone, seed, records: [], science: [] };
  const recs = plan.records;
  const add = rec => { rec.end = rec.end ?? Infinity; rec.tg = rec.tg ?? Infinity; rec.tf = rec.tf ?? Infinity; recs.push(rec); return recs.length - 1; };

  // Science's chrome drops stay where they are, in Science's space (cosmos.js draws them). Records kept
  // for a click.
  plan.events = makeEvents(W, H, holdStartP(phone), seed);
  for (const e of plan.events) e.drain = [SPOTS.start, SPOTS.start + SPOTS.tffMax];
  const sci = scienceDrops(W, H);
  for (const d of sci) d.rec = add({ kind: KIND.stopped, c: d.c.slice(), V0: d.r ** 3, q: 0, t0: -1, science: d.i, col: [1, 1, 1] });

  // The clumps, each a drop whose volume arrives over the last fifth of its fall (Shu's inside-out
  // collapse: the inner shells first, at a steady rate).
  const sites = makeClumps(plan, random);
  plan.clumps = [];
  for (const s of sites) {
    const t0 = s.tsnap - 0.2 * (s.tsnap - s.ts);
    s.rec = add({ kind: KIND.drop, core: plan.clumps.length, c: s.c, V0: 0, q: s.r ** 3 / (s.tsnap - t0), t0, tg: s.tsnap, col: s.col });
    plan.clumps.push(s);
  }
  // Science's stars: each condenses into a bead of its own (its colour the star's, a pale water); one
  // over a clump's drop falls into it.
  const starCol = t => toLinear(PALETTE.stars.map(rgb).reduce((a, c) => a.map((v, k) => v + (c[k] - v) * t)));
  const G = 48, near = new Map();
  for (const s of sites) { const key = `${Math.floor(s.c[0] / G)},${Math.floor(s.c[1] / G)}`; if (!near.has(key)) near.set(key, []); near.get(key).push(s); }
  for (const st of skyStars(W, H)) {
    const r = SKY.r[st.l] * (0.85 + 0.3 * (st.b - 0.76) / 0.24), gx = Math.floor(st.c[0] / G), gy = Math.floor(st.c[1] / G);
    let inside = false;
    for (let y = gy - 1; y <= gy + 1 && !inside; y++) for (let x = gx - 1; x <= gx + 1 && !inside; x++) for (const s of near.get(`${x},${y}`) ?? []) if (Math.hypot(s.c[0] - st.c[0], s.c[1] - st.c[1]) < s.r + r + 1) { inside = true; break; }
    if (inside) continue;
    add({ kind: KIND.drop, c: st.c, V0: 0, q: r ** 3 / SKY.grow, t0: st.t, tg: st.t + SKY.grow, col: starCol(st.tint), sky: st });
  }
  plan.cardRect = (card ?? defaultCard(W, H, phone)).map(Number);
  makeShards(plan);
  plan.science = sci.map(d => ({ c: d.c, r: d.r, amp: d.amp, rec: d.rec }));
  return plan;
}

// ---- cold from the card ----------------------------------------------------------------------------------
// Racing's card appears in its own place as a ghost of cold glass, and a freezing front spreads out
// from it: it reaches q at freezeTime (f0 at the card's edge, f1 at the screen's farthest corner; its
// isochrones the card's own rounded rectangle, a little wavy). A drop it reaches is supercooled: ice
// shoots through it at once (recalescence: it flashes milky), then it freezes through from its contact
// line up, which takes τ = stefan·r² (the Stefan problem: the latent heat goes out through what has
// frozen); water expands as it freezes, so the last of it pushes up into a point at its apex (the tip
// singularity, Marín et al. 2014); a moment later (cleave) it splits along ice's prism planes, 60°
// apart (ice Ih is hexagonal), into a few sectors: shards.
export const FREEZE = Object.freeze({ f0: 0.52, f1: 0.78, stefan: 1.1e-4, through: 0.024, cleave: 0.006, wobble: 0.03 });
export const frontSpeed = (W, H, card) => Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(q => trackDistance(q, trackFrame(W, H, card)))) / (FREEZE.f1 - FREEZE.f0);
// (Its waviness: two crossed swells, nothing at the card's edge.)
export const frontWave = q => 0.6 * Math.sin(q[0] * 0.0061 + q[1] * 0.0037) * Math.sin(q[1] * 0.0053 - q[0] * 0.0029) + 0.4 * Math.sin(q[0] * 0.0113 - q[1] * 0.0071 + 1.3);
export const freezeTime = (plan, q) => { const d = trackDistance(q, trackFrame(plan.W, plan.H, plan.cardRect)); return FREEZE.f0 + d / plan.vFreeze + FREEZE.wobble * frontWave(q) * Math.min(1, d / 160); };
// How its crack lines are chosen of the six prism directions θ₀ + 60°k, by how many pieces it splits
// into (a star's bead cleaves in two).
export const CLEAVE = Object.freeze({ 1: [], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] });
export const pieceCount = (r, k, sky) => sky ? 2 : clamp(Math.floor(r / (3.2 * k)) + 2, 2, 6);
// A large drop also cracks across its sectors (concentric, where its freezing front paused): the radii
// its pieces are cut at, as shares of its radius.
export const ringsOf = (r, k, sci) => sci ? [0, 0.32, 0.58, 0.8, 1] : r > 9 * k ? [0, 0.55, 1] : [0, 1];

// ---- the track: prepared entries, analytic lane circulation ------------------------------------------
export const FIELD = Object.freeze({ path: 16, lag: 0.012, grid: 32, evac: 0.035 });
export const SHARD_TEXELS = 6;
// Find an entry near the drop, then advance a little so the bend draws it into counterclockwise flow.
function entryPhase(q, frame, lane) {
  const p = trackLocal(q, frame);
  let phase = 0, best = Infinity;
  for (let i = 0; i < 128; i++) { const t = i / 128, v = trackPoint(t, lane), d = (v[0]-p[0])**2+(v[1]-p[1])**2; if(d<best){best=d;phase=t;} }
  return phase + .035;
}
// The freeze, the shards and their flights, the field grid and the fuse clock, for Racing's card where
// it is (redone alone when the card moves: aimShards).
export function makeShards(plan) {
  const { W, H, records } = plan, card = plan.cardRect, k = clamp(H / 900, 0.8, 1.5);
  const random = rng(plan.seed * 131 + W * 5 + H * 3);
  plan.vFreeze = frontSpeed(W, H, card);
  const frame = trackFrame(W, H, card), shards = [];
  // Each drop's freezing and its pieces.
  records.forEach((r, id) => {
    const sci = r.science !== undefined, rr = sci ? Math.cbrt(r.V0) : radiusAt(r, 9);
    r.freeze = null;
    if (rr <= 0 || r.end <= FREEZE.f0) return;
    const tf = freezeTime(plan, r.c), tc = tf + Math.min(FREEZE.stefan * (rr / k) ** 2, FREEZE.through) + FREEZE.cleave;
    const n = sci ? 6 : pieceCount(rr, k, !!r.sky), th0 = random() * Math.PI / 3, dirs = CLEAVE[n];
    r.freeze = { tf, tc, th0, n, first: shards.length };
    const cuts = dirs.map(d => th0 + d * Math.PI / 3), rings = n === 1 ? [0, 1] : ringsOf(rr, k, sci);
    let sectors = n === 1 ? [[0, 2 * Math.PI]] : cuts.map((a, i) => [a, i + 1 < cuts.length ? cuts[i + 1] : cuts[0] + 2 * Math.PI]);
    // (A chrome drop, a mirror, not ice, breaks finer: each sector halved again.)
    if (sci) sectors = sectors.flatMap(([a0, a1]) => [[a0, (a0 + a1) / 2], [(a0 + a1) / 2, a1]]);
    // (They leave one sector after another round it, the outer pieces of each first.)
    sectors.forEach(([a0, a1], si) => { for (let b = 0; b + 1 < rings.length; b++) {
      // Each piece an annular sector between radii r1 and r2; its centroid 4 sin(D/2)(r2³ − r1³) /
      // (3D(r2² − r1²)) out along its bisector.
      const r1 = rings[b] * rr, r2 = rings[b + 1] * rr, D = a1 - a0, mid = (a0 + a1) / 2;
      const dc = n === 1 && r1 === 0 ? 0 : 4 * Math.sin(D / 2) * (r2 ** 3 - r1 ** 3) / (3 * D * (r2 ** 2 - r1 ** 2));
      const start = [r.c[0] + Math.cos(mid) * dc, r.c[1] + Math.sin(mid) * dc];

      shards.push({ rec: id, c: r.c, r: r2, rin: r1, a0, a1, start, t0: tc + FIELD.lag + 0.0015 * si + 0.005 * (rings.length - 2 - b), kind: sci ? 1 : r.sky ? 2 : 0, col: r.col ?? [1, 1, 1], spin: (random() < 0.5 ? -1 : 1) * (1.5 + 3 * random()), seed: random() });
    } });
  });
  // A cubic approach, then constant arc-length circulation. No per-frame integration or lookup paths.
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    s.lane = i % TRACK.lanes + (s.seed - .5) * .28;
    s.phase = entryPhase(s.start, frame, s.lane);
    s.join = s.t0 + .085 + .025 * s.seed;
    s.t1 = .995 + .14 * s.seed;
    s.fly = s.t1 - s.t0;
    s.laps = (s.t1 - s.join) * (4.2 + .5 * s.seed);
    s.entry = trackToWorld(trackPoint(s.phase, s.lane), frame);
    const tangent = trackTangent(s.phase, s.lane), origin = trackToWorld([0,0],frame), td = trackToWorld(tangent,frame).map((v,j)=>v-origin[j]);
    const L = 4*TRACK.straight+2*Math.PI*(TRACK.inner+(s.lane+.5)*TRACK.lane);
    const arm = L*s.laps/(s.t1-s.join)*(s.join-s.t0)/3;
    s.control2 = s.entry.map((v,j)=>v-td[j]*arm);
    s.control = s.start.map((v,j)=>v+(s.control2[j]-v)*.36);
    // Reference samples only for the static share-card tool; never uploaded or read by the renderer.
    s.path = Array.from({length: FIELD.path},(_,k)=>trackShardAt(s,s.t0+s.fly*k/(FIELD.path-1),W,H,card));
  }
  plan.shards = shards;
  const G = FIELD.grid*k, gc = Math.ceil(W/G)+1, gr = Math.ceil(H/G)+1, grid=[];
  for(let j=0;j<gr;j++)for(let i=0;i<gc;i++){
    const q=[i*G,j*G], phase=entryPhase(q,frame,3.5), end=trackToWorld(trackPoint(phase,3.5),frame);
    const d=end.map((v,c)=>v-q[c]), l=Math.hypot(...d)||1, flight=.10;
    grid.push([d[0]/l,d[1]/l,flight,freezeTime(plan,q)+FIELD.evac+flight]);
  }
  plan.field={cols:gc,rows:gr,cell:G,grid};
  // A small lane/arc-length atlas: when each patch receives its first shard.
  const cols=128,rows=8,t=new Float64Array(cols*rows).fill(9),rgb=new Float64Array(cols*rows*3).fill(1);
  for(const s of shards){const lane=Math.max(0,Math.min(7,Math.round(s.lane))),phase=((s.phase+s.laps)%1+1)%1;
    for(let x=0;x<cols;x++){const d=Math.abs(x/cols-phase),arrival=s.t1+Math.min(d,1-d)*.10;const i=lane*cols+x;t[i]=Math.min(t[i],arrival);}}
  plan.fuse={cols,rows,cell:1,t,rgb};
  return plan;
}

// ---- Racing's card ---------------------------------------------------------------------------------------
// card: the band's card on screen during the hold [x, y, w, h] (home.js); a guess from the layout until
// it is measured.
export const defaultCard = (W, H, phone) => phone ? [W * 0.04, H * 0.36, W * 0.92, H * 0.5] : [W * 0.406, H * 0.167, W * 0.34, H * 0.483];

// ---- reference queries ---------------------------------------------------------------------------------
// Drops live at P (born, not yet merged away), Science's excepted.
export function liveAt(rec, P) { return P >= rec.t0 && P < rec.end && rec.science === undefined; }

// Which clumps' cells reach each SPOTS.tile px tile (glsl/dew.js dewSpots reads a tile's list), and when
// the last drop has snapped in.
export function spotLists(plan) {
  const T = SPOTS.tile, cols = Math.ceil(plan.W / T), rows = Math.ceil(plan.H / T), lists = Array.from({ length: cols * rows }, () => []);
  let last = 0;
  for (const s of plan.clumps ?? []) {
    const R = s.R * 1.35 + 4;
    last = Math.max(last, s.tsnap);
    for (let y = Math.max(0, Math.floor((s.c[1] - R) / T)); y <= Math.min(rows - 1, Math.floor((s.c[1] + R) / T)); y++)
      for (let x = Math.max(0, Math.floor((s.c[0] - R) / T)); x <= Math.min(cols - 1, Math.floor((s.c[0] + R) / T)); x++) lists[y * cols + x].push(s.rec);
  }
  return { T, cols, rows, lists, last, max: lists.reduce((m, l) => Math.max(m, l.length), 0) };
}
// ---- packing ---------------------------------------------------------------------------------------------
export function packDew(plan) {
  const cells = [];
  const { records } = plan;
  cells.push([plan.W, plan.H, 0, 0]);
  cells.push([records.length, 0, 0, plan.phone ? 1 : 0]);
  cells.push([0, 0, 0, 0]);
  cells.push([0, 0, 0, 0]);
  for (const d of plan.science) cells.push([d.c[0], d.c[1], d.r, d.amp]);
  // 10–15: the chrome drops' freezing: when the front reaches each, when it splits.
  for (let i = 0; i < 6; i++) { const f = records[plan.science[i]?.rec]?.freeze; cells.push(f ? [f.tf, f.tc, 0, 0] : [9, 9, 0, 0]); }
  // Cells 16–24 unused; 25–26: the nebulae, the pane's clock and the snow (filled in below).
  for (let k = 16; k < 25; k++) cells.push([0, 0, 0, 0]);
  const meta = cells.length;
  cells.push([0, 0, 0, 0], [0, 0, 0, 0]);
  const recBase = cells.length;
  for (const r of records) {
    const end = Math.min(r.end, 9), tf = Math.min(r.tf, 9), gEnd = Math.min(r.tg, r.tf, 9);
    // A: where, until when, and its kind (code × 1000: + 8 Science's, + 16 a clump's, + 32 a star's).
    // B: its growth, when its growth ends, when it formed. C: a star's or a clump's (below). D: unused.
    // E: its colour, and when it froze.
    const kindCode = r.kind + (r.science !== undefined ? 8 : 0) + (r.core !== undefined ? 16 : 0) + (r.sky ? 32 : 0);
    cells.push([r.c[0], r.c[1], end, 1000 * kindCode]);
    cells.push([r.V0, r.q, gEnd, r.t0]);
    // (A star's bead: its brightness hash, layer, tint and when it condensed. A clump's drop: its Jeans
    // length, when it starts to fall, when its drop snaps in, and how far its cell reaches.)
    const cl = r.core !== undefined ? plan.clumps?.[r.core] : null;
    cells.push(r.kind === KIND.merged ? [r.pa[0], r.pa[1], r.ra, r.rb] : r.sky ? [r.sky.b, r.sky.l, r.sky.tint, r.sky.t] : cl ? [cl.ell, cl.ts, cl.tsnap, cl.R] : [0, 0, 0, 0]);
    cells.push([0, 0, 0, 0]);
    cells.push([...(r.col ?? [1, 1, 1]), tf]);
  }
  // Cold from the card and the vacuum (glsl/units.js drops, shards, fieldlines; glsl/dew.js): a texel a
  // record (when the front reaches it, when it splits, its first crack's angle, how many pieces); then
  // six texels a shard (where its drop is, its radius and first edge; its last edge, when it is
  // pulled, when it fuses, its spin; its colour and kind (0 a drop's, 1 a chrome drop's, 2 a star's); its
  // cubic entry controls, lane, phase, laps and join time); then the field grid; then the fuse clock.
  const freezeBase = cells.length, SH = plan.shards ?? [];
  records.forEach(r => cells.push(r.freeze ? [r.freeze.tf, r.freeze.tc, r.freeze.th0, r.freeze.n] : [9, 9, 0, 0]));
  const shardBase = cells.length;
  for (const sh of SH) {
    // (Its kind's fraction: its inner radius over a thousand.)
    cells.push([sh.c[0], sh.c[1], sh.r, sh.a0], [sh.a1, sh.t0, sh.t1, sh.spin], [...sh.col, sh.kind + Math.min(sh.rin, 999) / 1000]);
    cells.push([...sh.start, ...sh.control], [...sh.control2, ...sh.entry], [sh.lane, sh.phase, sh.laps, sh.join]);
  }
  const fieldBase = cells.length, fd = plan.field ?? { cols: 0, rows: 0, cell: 1, grid: [] };
  for (const g of fd.grid) cells.push(g);
  const fuseBase = cells.length, fu = plan.fuse ?? { cols: 0, rows: 0, cell: 8, t: [] };
  fu.t.forEach((v, i) => cells.push([v, fu.rgb?.[i * 3] ?? 1, fu.rgb?.[i * 3 + 1] ?? 1, fu.rgb?.[i * 3 + 2] ?? 1]));
  const cardR = plan.cardRect ?? [0, 0, 0, 0];
  cells[18] = [freezeBase, shardBase, SH.length, plan.vFreeze ?? 1];
  cells[19] = [...cardR];
  cells[20] = [fieldBase, fd.cols, fd.rows, fd.cell];
  cells[21] = [fuseBase, fu.cols, fu.rows, fu.cell];
  cells[22] = [plan.accretion?.55:FREEZE.f0, plan.accretion?.004:FREEZE.wobble, SH.length ? Math.max(...SH.map(x => x.t1)) : 9, 0];
  // The nebulae: five texels each: where and when, how long it grows; its size, which giant, its
  // brightness, a seed; its turn, aspect, temperature, kind; its phases; when its gas drains away and
  // which way its gas turns.
  const eventBase = cells.length;
  for (const e of plan.events) cells.push([e.S[0], e.S[1], e.t, e.span], [e.Rmax, e.giant, e.L, e.seed], [e.angle, e.aspect, e.T / 10000, e.type], e.phase, [e.drain[0], e.drain[1], e.spin, 0]);
  // Gravity's spots (glsl/dew.js dewSpots): which clumps' cells reach each tile, a texel a tile (where its
  // list starts, how long it is), then the lists, each clump in them written out whole in three texels
  // (the shader reads a tile's clumps over and over, so no record is looked up on the way): where it is,
  // its Jeans length, how far its cell reaches; when it starts to fall, when its drop snaps in, its drop's
  // radius once grown (the cube root of its record's volume then, from the float32 values the record's
  // texels hold), its record; its colour.
  const sp = spotLists(plan), spotHead = cells.length;
  const spotEntries = [];
  for (const l of sp.lists) { cells.push([spotEntries.length, l.length, 0, 0]); for (const id of l) spotEntries.push(id); }
  const spotEntry = cells.length, f32 = Math.fround;
  for (const id of spotEntries) {
    const r = records[id], cl = plan.clumps[r.core], gEnd = Math.min(r.tg, r.tf, 9);
    cells.push([r.c[0], r.c[1], cl.ell, cl.R], [cl.ts, cl.tsnap, Math.cbrt(Math.max(f32(r.V0) + f32(r.q) * (f32(gEnd) - f32(r.t0)), 0)), id], [...(r.col ?? [1, 1, 1]), 0]);
  }
  cells[16] = [spotHead, spotEntry, sp.T, sp.cols];
  cells[17] = [sp.rows, sp.last, sp.max, 0];
  cells[meta] = [plan.events.length, eventBase, 0, 0];
  cells[meta + 1] = [0, 0, SN.cool, 0];
  cells[2] = [recBase, 0, 0, 0];
  if (plan.accretion) { packAccretion(plan, cells); packOptics(cells); }
  const width = 1024, height = Math.ceil(cells.length / width), data = new Float32Array(width * height * 4);
  cells.forEach((v, i) => data.set(v, i * 4));
  return {
    width, height, data,
    stats: { shards: SH.length, records: records.length, spots: sp.max, bytes: data.byteLength, accretion: plan.accretion?.stats },
  };
}
