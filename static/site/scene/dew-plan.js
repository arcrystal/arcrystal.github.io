// Stars, nebulae, stardust, drops, ice (Science → Racing): the plan. Simulated once per screen size in
// dew-worker.js (never per frame) and read by glsl/dew.js and glsl/units.js. Deterministic from a seed
// and the size; coordinates are CSS px (y down), time is the seam's progress P.
//
// The story and its physics (the tests check each):
//   Nebulae. A few of Science's giants end, spaced so that each nebula stays whole and only the outer
//   fringes of their shock waves cross. The hot supergiants explode as supernovae: a breakout flash,
//   then the ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe light curve (mean lives 8.8 d : 111.3 d), and a remnant expanding
//   freely, then as a Sedov–Taylor blast wave (R ∝ t^⅖): the Crab (a pulsar wind nebula in a cage of
//   filaments), Cassiopeia A (a knotty ring), the Veil (braided arcs, red inside, blue-green outside),
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
//   Freezing, a chain reaction (interdroplet ice bridging, Boreyko & Collier 2013): seeds of ice at the
//   frame's edges; each frozen drop grows a frost bridge across the gap to its neighbours at a steady
//   rate, and a drop freezes when the first bridge reaches it (first-passage percolation over the
//   drops), so the freeze runs across the pane as a branching tree, the middle last; where the drops
//   are too far apart for a bridge, the frost front reaches them on the bare glass. A growing drop that
//   touches a frozen one freezes on contact.
//   Crystals: the larger drops (spaced apart) seed six-fold snow crystals in their own colour as the
//   freeze reaches them, each of its habit (the Nakaya diagram); each grows out across its Voronoi cell
//   until it meets its neighbours, and the grain boundaries split into fissures. One run of boundaries
//   across the middle (a least-cost path through the Voronoi graph) becomes the main crack; it opens
//   (Griffith–Irwin), and the pane comes apart from it outward, its pieces streaming along the field
//   lines into Racing's card (makeFragments).
//   Artistic, and said so on the algorithms page: liquid water and coloured ice from stardust, the speeds.
// The drop simulation runs on a 1 px label grid: 0 bare glass, k+1 drop k.

import { HOLD, holdFor, glassEase, transitP } from '../lerp.js';
import { GIANTS, giantCount } from './giants.js';

export const DEW = Object.freeze({
  seed: 41, tile: 24, epoch0: -0.2, epochLen: 0.04, epochs: 26, dt: 0.002,
  // A click keeps the quick radial front its DOM aperture is built on (scene.js).
  click: Object.freeze({ clear0: 0.84, clearUp: 0.18, clearD: 0.08, flash: 0.035 }),
  // The fraction of the pane a breath figure covers; how long a merge takes to snap; the smallest drop
  // drawn; when the drop simulation ends (every drop has frozen by then).
  eps: 0.55, merge: 0.035, vis: 0.6, end: 0.8,
  // The freezing chain: when it starts, how fast a bridge grows (px per unit P at 900 px tall), the
  // longest gap a bridge spans, and by when the frost front has crossed the pane.
  chain0: 0.5, bridge: 2000, bridgeMax: 40, freezeBy: 0.72,
  // Crystals: chosen from the drops at seedAt, at least this far apart (desktop, phone); how fast a
  // crystal grows (px per unit P at 900 px); how long after two crystals meet their boundary splits.
  seedAt: 0.5, spacing: [80, 62], grow: 900, crack: 0.015,
  // How long a frozen drop's halo and the bridge that froze it stay lit.
  iceFade: 0.14,
  // The main crack's surge, peaking at split; a click's pieces each fall over fall.
  surge: 0.78, split: 0.86, fall: 0.07,
  // The rift (the scroll): the main crack opens from riftOpen, wide (riftWidth × H at its middle) by
  // riftWide; a fracture front runs out from it at a steady speed (it passes a point lead before its
  // piece's farthest corner, and the piece breaks away once the front has run round it), detach0 to
  // detach1; the pane is photographed for the fragments, still, at still.
  riftOpen: 0.86, riftWide: 1.0, riftWidth: 0.12, detach0: 0.95, detach1: 1.03, lead: 0.03, still: 0.88,
});
// ---- supernovae ---------------------------------------------------------------------------------------
// end: the last explosion; cover: by when the nebulae reach their full size; cool: how long a swept-up
// gas takes to cool enough for its mist to condense.
export const SN = Object.freeze({
  end: 0.16, cover: 0.28, xst: 0.15, cool: 0.24,
  tauNi: 0.006, tauCo: 0.006 * 111.3 / 8.8, rise: 0.0022, epsCo: 0.174,
  cnt: Object.freeze({ tauS: 0.03, lnSmax: 2.2, B: 2.0, J0: 55 }),
});
const ST_K = Math.pow(SN.xst, 0.6);
// A remnant's radius as a fraction of its final one, x = time since the explosion over its span:
// free expansion x, Sedov–Taylor κx^0.4 (κ puts the change at x = .15), joined smoothly.
const rRaw = x => x <= 0 ? 0 : Math.pow(Math.pow(x, -3) + Math.pow(ST_K * Math.pow(x, 0.4), -3), -1 / 3);
export const remnantFrac = x => rRaw(x) / rRaw(1);
// A planetary nebula's shell: the old giant's envelope (a tenth of the final size) blown out by the
// fast wind of the hot core at a steady, slowly easing speed.
export const shellFrac = x => x <= 0 ? 0 : 0.1 + 0.9 * (1 - Math.pow(1 - Math.min(x, 1), 1.3));
function invert(f, y) {
  if (y <= 0) return 0;
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (f(m) < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export const remnantInverse = y => invert(remnantFrac, y);
// Its light curve (peak about 1): the breakout spike, then the decay heating (Arnett), with a short rise
// as the light diffuses out.
export function lightCurve(s) {
  if (s <= 0) return 0;
  const decay = (1 - SN.epsCo) * Math.exp(-s / SN.tauNi) + SN.epsCo * Math.exp(-s / SN.tauCo);
  return 2.2 * Math.exp(-s / 0.0012) + decay * (1 - Math.exp(-((s / SN.rise) ** 2)));
}
// The cumulative nucleation hazard τ ↦ Λ(τ) (time since the gas cooled), tabulated; a site's delay is
// Λ⁻¹ of a unit exponential.
const CNT_TABLE = (() => {
  const { tauS, lnSmax, B, J0 } = SN.cnt, dt = 0.0005, out = [0];
  let L = 0;
  for (let k = 1; k <= 800; k++) {
    const tau = k * dt, lnS = lnSmax * (1 - Math.exp(-tau / tauS));
    L += J0 * Math.exp(-B / Math.max(lnS * lnS, 1e-6)) * dt;
    out.push(L);
  }
  return { dt, out };
})();
export const nucleationRate = tau => { const { tauS, lnSmax, B, J0 } = SN.cnt, lnS = lnSmax * (1 - Math.exp(-tau / tauS)); return J0 * Math.exp(-B / Math.max(lnS * lnS, 1e-6)); };
export function nucleationDelay(u) {
  const { dt, out } = CNT_TABLE, e = -Math.log(Math.max(1e-9, 1 - u));
  for (let k = 1; k < out.length; k++) if (out[k] >= e) return (k - 1 + (e - out[k - 1]) / (out[k] - out[k - 1])) * dt;
  return out.length * dt;
}

// ---- the nebulae ----------------------------------------------------------------------------------------
// Kinds: four supernova remnants, three planetary nebulae (glsl/dew.js dewNebula draws each).
export const NEB = Object.freeze({ crab: 0, casA: 1, veil: 2, sn1987a: 3, catseye: 4, ring: 5, butterfly: 6 });
export const NEB_NAMES = Object.freeze(['Crab', 'Cassiopeia A', 'Veil', 'SN 1987A', "Cat's Eye", 'Ring', 'Butterfly']);
export const isPlanetary = type => type >= NEB.catseye;
// Each kind's elongation (its frame's x stretched by it).
export const NEB_ASPECT = Object.freeze([1.32, 1.06, 1.0, 1.0, 1.0, 1.24, 1.0]);
const ranksOf = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
const combos = (a, k) => { const out = [], c = []; const rec = s => { if (c.length === k) { out.push(c.slice()); return; } for (let i = s; i < a.length; i++) { c.push(a[i]); rec(i + 1); c.pop(); } }; rec(0); return out; };
export function makeEvents(W, H, holdP, seed) {
  const random = rng(seed * 977 + W * 3 + H), phone = W < 700;
  // The hot giants explode, the cool ones shed their envelopes. Which of them: the set (four and three,
  // two and two on a phone) spread farthest apart, so each nebula has room of its own.
  const n = giantCount(W), hot = [], cool = [];
  for (let i = 0; i < n; i++) (GIANTS[i].T >= 5000 ? hot : cool).push(i);
  const pos = i => [W * GIANTS[i].x, H * GIANTS[i].y];
  let set = null, best = -1;
  for (const A of combos(hot, phone ? 2 : 4)) for (const B of combos(cool, phone ? 2 : 3)) {
    const s = [...A, ...B];
    let score = Infinity;
    for (let a = 0; a < s.length; a++) {
      const p = pos(s[a]);
      score = Math.min(score, 2.6 * Math.min(p[0], W - p[0], p[1], H - p[1]) + 0.18 * Math.min(W, H));
      for (let b = a + 1; b < s.length; b++) { const q = pos(s[b]); score = Math.min(score, Math.hypot(p[0] - q[0], p[1] - q[1])); }
    }
    if (score > best) { best = score; set = s; }
  }
  // Each nebula's radius: .6 of the way to its nearest neighbour along its longest axis, so two
  // neighbours' outer tenths cross and no more.
  const nn = set.map(i => Math.min(...set.filter(j => j !== i).map(j => Math.hypot(pos(i)[0] - pos(j)[0], pos(i)[1] - pos(j)[1]))));
  // Kinds: the Crab to the hot giant with the most room; the rest shuffled.
  const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const hotSet = set.filter(i => GIANTS[i].T >= 5000), coolSet = set.filter(i => GIANTS[i].T < 5000);
  hotSet.sort((a, b) => nn[set.indexOf(b)] - nn[set.indexOf(a)]);
  const snr = [NEB.crab, ...shuffle(phone ? [NEB.casA] : [NEB.casA, NEB.veil, NEB.sn1987a])];
  const pn = shuffle(phone ? [NEB.catseye, NEB.ring] : [NEB.catseye, NEB.ring, NEB.butterfly]);
  const typeOf = new Map([...hotSet.map((g, k) => [g, snr[k]]), ...coolSet.map((g, k) => [g, pn[k]])]);
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
    const G = GIANTS[g], t = t0 + span * (rank + 0.2 + 0.6 * random()) / m, type = typeOf.get(g);
    return { giant: g, S: pos(g), t, span: SN.cover - t, type, Rmax: 0.6 * nn[set.indexOf(g)] / NEB_ASPECT[type], L: G.L, T: G.T, seed: random(),
      angle: random() * Math.PI * 2, aspect: NEB_ASPECT[type], spin: random() < 0.5 ? -1 : 1, phase: [0, 1, 2, 3].map(() => random() * Math.PI * 2) };
  });
}
// A nebula's radius at P, and its inverse: when it reaches distance d from its star.
export const expandFrac = (e, x) => isPlanetary(e.type) ? shellFrac(x) : remnantFrac(x);
export const nebulaRadius = (e, P) => e.Rmax * expandFrac(e, (P - e.t) / e.span);
const reachTime = (e, d) => e.t + e.span * invert(x => expandFrac(e, x), d / e.Rmax);
// The frame of nebula e: u = rotate(−angle)(q − S) / R, its x shrunk by its aspect.
export function nebFrame(e, q, R = e.Rmax) {
  const c = Math.cos(e.angle), s = Math.sin(e.angle), dx = q[0] - e.S[0], dy = q[1] - e.S[1];
  return [(c * dx + s * dy) / (R * e.aspect), (-s * dx + c * dy) / R];
}
const G = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const sst = (a, b, x) => smooth((x - a) / (b - a));
const ell = (x, y, a, b, d) => { const c = Math.cos(d), s = Math.sin(d); return Math.hypot((c * x + s * y) / a, (-s * x + c * y) / b) - 1; };
// How much gas a nebula holds at a point of its frame when grown: its main structures as glsl/dew.js
// dewNebula draws them (without their noise), where the cores and the mist form.
export function nebDensity(e, q) {
  const [x, y] = nebFrame(e, q), r = Math.hypot(x, y), th = Math.atan2(y, x), p = e.phase;
  if (r > 1.25) return 0;
  switch (e.type) {
    case NEB.crab: {
      const rho = r / (1 + 0.07 * Math.sin(3 * th + p[0]) + 0.05 * Math.sin(5 * th + p[1]));
      return sst(0.3, 0.62, rho) * (1 - sst(0.93, 1.04, rho)) * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(9 * th + 2 * Math.sin(4 * rho + p[2])))) + 0.35 * (1 - sst(0.05, 0.6, rho));
    }
    case NEB.casA: {
      const rho = r / (1 + 0.1 * Math.sin(2 * th + p[0]) + 0.07 * Math.sin(3 * th + p[1]));
      return 1.3 * G(rho, 0.78, 0.1) * (0.7 + 0.3 * Math.sin(5 * th + p[2])) + 0.12 * (1 - sst(0.6, 0.8, rho));
    }
    case NEB.veil: {
      const arc = sst(0.15, 0.55, Math.abs(Math.cos(th - p[0])));
      return arc * (1.3 * G(r, 0.95, 0.06) + 0.18 * (1 - sst(0.75, 0.9, r)));
    }
    case NEB.sn1987a: {
      const rr = Math.hypot(x, y / 0.72), up = Math.hypot(x, (y - 0.34) / 0.62), dn = Math.hypot(x, (y + 0.34) / 0.62);
      return 1.5 * G(rr, 0.42, 0.05) + 0.6 * (G(up, 0.6, 0.04) + G(dn, 0.6, 0.04)) + 0.7 * Math.exp(-((x / 0.09) ** 2 + (y / 0.14) ** 2));
    }
    case NEB.catseye: {
      const e1 = ell(x, y, 0.44, 0.24, 0), e2 = ell(x, y, 0.36, 0.27, 0.5), e3 = ell(x, y, 0.24, 0.16, -0.35);
      const halo = sst(0.5, 0.56, r) * (1 - sst(0.96, 1.02, r)) * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (r - 0.5) / 0.05), 6);
      return 0.9 * (G(e1, 0, 0.08) + G(e2, 0, 0.08) + G(e3, 0, 0.1)) + 0.45 * (e1 < 0 ? 1 : 0) + 0.4 * halo;
    }
    case NEB.ring: {
      const rb = 0.86 + 0.08 * Math.sin(9 * th + p[0]);
      return 1.25 * G(r, 0.58, 0.12) + 0.2 * (1 - sst(0.3, 0.5, r)) + 0.3 * G(r, rb, 0.04);
    }
    default: {   // the Butterfly: two lobes pinched at a dusty waist
      const rb = 0.12 + 0.9 * Math.pow(Math.abs(Math.cos(th)), 0.55), rl = r / rb;
      return (1 - sst(0.8, 1.0, rl)) * (0.4 + 0.6 * sst(0.4, 0.95, rl)) * (1 - 0.9 * Math.exp(-((x / 0.07) ** 2)));
    }
  }
}
// The colours of the nebulae's light (linear sRGB, brightest channel 1): Hα with [N II], [S II],
// [O III], synchrotron, and the mixes the eye sees.
export const NEB_RGB = Object.freeze({
  ha: [1, 0.2, 0.22], s2: [1, 0.45, 0.2], o3: [0.12, 0.95, 0.72], syn: [0.5, 0.62, 1], gold: [1, 0.7, 0.26], pink: [1, 0.5, 0.64],
  blue: [0.36, 0.55, 1], violet: [0.64, 0.4, 1], green: [0.42, 1, 0.42], yellow: [1, 0.86, 0.32], white: [0.86, 0.9, 1],
});
const mixC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// What colour the gas is at q (h: a uniform draw for the variety within a zone), its brightest channel 1.
export function nebColour(e, q, h) {
  const c = nebMix(e, q, h), m = Math.max(...c);
  return c.map(v => v / m);
}
function nebMix(e, q, h) {
  const [x, y] = nebFrame(e, q), r = Math.hypot(x, y), th = Math.atan2(y, x), p = e.phase, C = NEB_RGB;
  switch (e.type) {
    case NEB.crab: return r < 0.45 ? mixC(C.syn, C.blue, h) : h < 0.25 ? C.green : h < 0.4 ? C.yellow : mixC(C.ha, C.s2, h);
    case NEB.casA: { const s = 0.5 + 0.5 * Math.sin(1.5 * th + p[0]); return s < 0.42 ? mixC(C.o3, C.green, h * 0.5) : s > 0.68 ? mixC(C.ha, C.s2, h) : h < 0.6 ? C.blue : C.violet; }
    case NEB.veil: return r > 0.95 ? mixC(C.o3, C.blue, h) : h < 0.3 ? C.violet : C.ha;
    case NEB.sn1987a: { const rr = Math.hypot(x, y / 0.72); return Math.abs(rr - 0.42) < 0.09 ? mixC(C.pink, C.white, h * 0.6) : r < 0.2 ? C.gold : mixC(C.ha, C.violet, h); }
    case NEB.catseye: return r < 0.5 ? mixC(C.o3, C.green, h * 0.6) : h < 0.3 ? C.yellow : mixC(C.ha, C.s2, h * 0.6);
    case NEB.ring: return r < 0.5 ? mixC(C.blue, C.violet, h * 0.5) : r < 0.6 ? mixC(C.o3, C.green, h) : r < 0.66 ? C.yellow : C.ha;
    default: return Math.abs(x) < 0.2 ? C.white : x > 0 ? mixC(C.ha, C.pink, h) : mixC(C.violet, C.blue, h);
  }
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

// ---- stardust: cores and their grains --------------------------------------------------------------------
// Each core is the gas of its basin falling in on itself; its grains spiral in (glsl/units.js grains)
// and it ends as a drop (its volume its basin's gas): a few large, many small (n(r) ∝ r^−2.2).
export const CORE = Object.freeze({ cell: 48, rMin: 4, rMax: 34, slope: 2.0, basin: 2.6, delay: [0.03, 0.08], fall: [0.1, 0.16], after: 0.2, by: 0.48, grains: [12000, 5000] });
// The free fall of a shell of a uniform cloud: r/r₀ = cos²β with t/t_ff = (β + sin β cos β)/(π/2),
// solved for β by Newton's method.
export function fallAngle(tau) {
  const tg = Math.min(1, Math.max(0, tau)) * Math.PI / 2;
  let b = tg * 0.8;
  for (let i = 0; i < 30; i++) b = Math.min(Math.PI / 2, Math.max(0, b - (b + 0.5 * Math.sin(2 * b) - tg) / Math.max(1 + Math.cos(2 * b), 0.05)));
  return b;
}
export const freeFall = tau => Math.cos(fallAngle(tau)) ** 2;
// A grain's place at P (glsl/units.js grains, the same): u0 its start as a fraction of the gathering
// radius Rg, θ0 its start angle, w its spin. Arrivals spread evenly over the core's fall (inside-out),
// the outer shells falling longer. Returns [x, y, r, θ, β].
export function grainAt(core, u0, th0, w, P) {
  const D = core.td - core.ts, Rg = core.Rg, r0 = core.r + (Rg - core.r) * u0;
  const ta = core.ts + D * (0.2 + 0.8 * u0), Tff = D * (0.35 + 0.3 * u0), b = fallAngle((P - (ta - Tff)) / Tff);
  const r = r0 * Math.cos(b) ** 2, th = th0 + w * Math.tan(Math.min(b, 1.55));
  return [core.c[0] + r * Math.cos(th), core.c[1] + r * Math.sin(th), r, th, b];
}
// Its drop's volume at P: grains arriving at a steady rate from ts + .2D to td.
export const coreVolume = (core, P) => core.r ** 3 * clamp((P - core.ts - 0.2 * (core.td - core.ts)) / (0.8 * (core.td - core.ts)));
export function makeCores(plan) {
  const { W, H, events } = plan, random = rng(plan.seed * 389 + W * 11 + H * 5);
  const k = Math.max(0.8, Math.min(1.5, H / 900));
  // Radii from the power law (inverse CDF), placed by dart throwing so basins do not overlap, far more
  // where the nebula is dense.
  const a = 1 - CORE.slope, lo = CORE.rMin * k, hi = CORE.rMax * k;
  const draw = () => Math.pow(Math.pow(lo, a) + random() * (Math.pow(hi, a) - Math.pow(lo, a)), 1 / a);
  const cell = CORE.cell, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), grid = Array.from({ length: cols * rows }, () => []);
  const cores = [];
  const tries = Math.round(W * H / 20);
  for (let i = 0; i < tries; i++) {
    const r = draw(), R = CORE.basin * r + 4 * k, p = [random() * W, random() * H];
    const ev = nebulaAt(plan, p);
    if (ev < 0) continue;
    const dens = nebDensity(events[ev], p);
    if (random() > Math.min(1, (dens / 0.8) ** 3)) continue;
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), span = Math.ceil((R + hi * CORE.basin + 4 * k) / cell);
    let ok = true;
    for (let y = Math.max(0, cy - span); y <= Math.min(rows - 1, cy + span) && ok; y++) for (let x = Math.max(0, cx - span); x <= Math.min(cols - 1, cx + span) && ok; x++)
      for (const j of grid[y * cols + x]) { const o = cores[j]; if (Math.hypot(o.c[0] - p[0], o.c[1] - p[1]) < (R + o.R) * 0.82) { ok = false; break; } }
    if (!ok) continue;
    // It starts to fall once its gas has been swept up and has cooled a little, and not before the
    // explosions have had their moment; it is a drop well before the gems.
    let ts = Math.max(shockAt(plan, p) + CORE.delay[0] + (CORE.delay[1] - CORE.delay[0]) * random(), CORE.after + 0.05 * random());
    let td = ts + CORE.fall[0] + (CORE.fall[1] - CORE.fall[0]) * random();
    if (td > CORE.by) { const k2 = (CORE.by - 0.04) / td; ts *= k2; td = CORE.by - 0.04 * random(); }
    grid[cy * cols + cx].push(cores.length);
    const e = events[ev];
    // Its grains gather from well beyond its basin (the gas between the cores is shared out).
    cores.push({ c: p, r, R, Rg: Math.max(R * 3, r * 8, 34 * k), ts, td, spin: e.spin * (0.7 + 0.8 * random()), ev, col: nebColour(e, p, random()) });
  }
  // Each nebula's gas drains into its cores: from its first core's fall to its last's.
  events.forEach((e, i) => {
    const own = cores.filter(c => c.ev === i);
    e.drain = own.length ? [Math.min(...own.map(c => c.ts)), Math.max(...own.map(c => c.td))] : [CORE.after, CORE.by];
  });
  // Grains: more for the larger drops (a share of the volume), within the budget.
  const want = cores.map(c => 6 + 54 * (c.r / hi) ** 2), budget = CORE.grains[plan.phone ? 1 : 0], sum = want.reduce((s, v) => s + v, 0);
  cores.forEach((c, i) => { c.grains = Math.max(4, Math.round(want[i] * budget / sum)); });
  plan.cores = cores;
  plan.coreGrid = { cols, rows, cell, grid };
  return cores;
}

// P at which Racing's hold begins (the strip moves until then): the supernovae wait for it, so while
// the strip comes in its top edge is Science as it is.
export function holdStartP(phone) {
  const pin = phone ? HOLD.pinTouch : HOLD.pin, L = holdFor('glass', pin);
  const R = pin * L.pin, p = L.leadIn / (R + L.leadIn + L.leadOut);
  return transitP(glassEase(p));
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

// ---- a click's schedules (shared with glsl/dew.js) -----------------------------------------------------
export const dewFar = (W, H, O) => hypot(Math.max(O[0], W - O[0]), Math.max(O[1], H - O[1]));
// 0 at the click, 1 at the farthest corner.
export const upOf = (plan, q, O) => hypot(q[0] - O[0], q[1] - O[1]) / dewFar(plan.W, plan.H, O);
export const coldAt = (plan, q, O) => -0.18 + 0.62 * upOf(plan, q, O);
const wobble = (q, up) => 0.006 * Math.sin(q[0] * 0.008) * Math.sin(q[1] * 0.007) * up;
// A click's radial front (scene.js's DOM aperture follows it).
export function clearStart(plan, q, O) {
  const up = upOf(plan, q, O);
  return DEW.click.clear0 + DEW.click.clearUp * up + wobble(q, up);
}
// How clear q is at P: on a click the radial front; on the scroll, once its piece (and every piece
// that could lie over it) has broken away.
export function clearAt(plan, q, P, O = null) {
  if (O) return smooth((P - clearStart(plan, q, O)) / DEW.click.clearD);
  let last = -Infinity;
  for (const c of plan.cells) if (Math.hypot(q[0] - c.centroid[0], q[1] - c.centroid[1]) < c.radius + 45) last = Math.max(last, c.detach);
  return P >= last ? 1 : 0;
}
// By when a click's front freezes q.
export const freezeAt = (plan, q, O) => clearStart(plan, q, O) - DEW.click.flash;

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
// Where the freezing chain starts: seeds of ice round the frame's edges, the middle last.
export const chainSeeds = (W, H, phone) => (phone ? [[0.02, 0.15], [0.98, 0.85], [0.5, 0.995]] : [[0.008, 0.5], [0.992, 0.45], [0.5, 0.008], [0.45, 0.992]])
  .map(([x, y], k) => ({ p: [W * x, H * y], t: DEW.chain0 + 0.012 * k }));
// The frost front's speed: it crosses the bare glass from its seeds, reaching the farthest point by
// freezeBy (the bridges between drops run ahead of it).
export function frontSpeed(W, H, seeds) {
  let far = 0;
  for (let y = 0; y <= H; y += 20) for (let x = 0; x <= W; x += 20) far = Math.max(far, Math.min(...seeds.map(sd => Math.hypot(x - sd.p[0], y - sd.p[1]) + (sd.t - DEW.chain0) * 1e4)));
  return far / (DEW.freezeBy - 0.01 - DEW.chain0);
}
// When the front reaches q (its seeds and speed): the shader's analytic front too.
export const chainAt = (plan, q) => Math.min(...plan.seeds.map(sd => sd.t + Math.hypot(q[0] - sd.p[0], q[1] - sd.p[1]) / plan.vFront));

// ---- the drop simulation ----------------------------------------------------------------------------------
export function makeDewPlan(W, H, { seed = DEW.seed, phone = W < 700, card = null } = {}) {
  W = Math.round(W); H = Math.round(H);
  const random = rng(seed + W * 7 + H * 13);
  const plan = { W, H, phone, seed, records: [], science: [] };
  const lab = new Int32Array(W * H);
  const recs = plan.records;
  // The fine mist between the cores: a lattice at spacing s0, inside the nebulae only.
  const s0 = 2.4 * Math.max(phone ? 9 : 8, Math.sqrt(W * H / (phone ? 7000 : 24000)));
  const J = 520 / 64;                         // condensation flux per px² per unit P: an isolated drop on the desktop lattice reaches 3.7 px at τ = .1
  const qPrim = J * s0 * s0;
  plan.s0 = s0; plan.J = J;
  plan.seeds = chainSeeds(W, H, phone);
  plan.vFront = frontSpeed(W, H, plan.seeds);

  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : lab[y * W + x];
  // Paint the ring r0 < |p − c| ≤ r1 with label L over bare pixels; every other label met is reported.
  function paint(c, r0, r1, L, hits) {
    const y0 = Math.max(0, Math.floor(c[1] - r1)), y1 = Math.min(H - 1, Math.ceil(c[1] + r1));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - c[1], o2 = r1 * r1 - dy * dy;
      if (o2 < 0) continue;
      const wo = Math.sqrt(o2), wi = r0 * r0 > dy * dy ? Math.sqrt(r0 * r0 - dy * dy) : -1;
      const spans = wi < 0 ? [[c[0] - wo, c[0] + wo]] : [[c[0] - wo, c[0] - wi], [c[0] + wi, c[0] + wo]];
      for (const [a, b] of spans) {
        const x0 = Math.max(0, Math.ceil(a - 0.5)), x1 = Math.min(W - 1, Math.floor(b - 0.5));
        for (let x = x0; x <= x1; x++) {
          const k = y * W + x, v = lab[k];
          if (v === 0) lab[k] = L;
          else if (v !== L) hits.add(v);
        }
      }
    }
  }
  function erase(rec, id) {
    const r = rec.painted + 1.5, c = rec.c, L = id + 1;
    const y0 = Math.max(0, Math.floor(c[1] - r)), y1 = Math.min(H - 1, Math.ceil(c[1] + r));
    const x0 = Math.max(0, Math.floor(c[0] - r)), x1 = Math.min(W - 1, Math.ceil(c[0] + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lab[y * W + x] === L) lab[y * W + x] = 0;
  }
  const active = [];
  function add(rec) {
    rec.end = Infinity; rec.tg = rec.tg ?? Infinity; rec.tf = Infinity; rec.painted = rec.painted ?? 0;
    recs.push(rec);
    return recs.length - 1;
  }
  const kill = (id, t) => { recs[id].end = Math.min(recs[id].end, t); };

  // Science's chrome drops stay where they are, in Science's space behind the pane (cosmos.js draws
  // them); the dew forms over them like anywhere else. Records kept for a click.
  const holdP = holdStartP(phone);
  plan.events = makeEvents(W, H, holdP, seed);
  const sci = scienceDrops(W, H);
  for (const d of sci) d.rec = add({ kind: KIND.stopped, c: d.c.slice(), V0: d.r ** 3, q: 0, t0: -1, science: d.i, col: [1, 1, 1] });

  // The mist: a jittered lattice inside the nebulae, each site born a random delay after its gas has
  // condensed (nucleationDelay, the classical rate as the supersaturation climbs).
  const sites = [];
  for (let y = s0 / 2; y < H; y += s0) for (let x = s0 / 2; x < W; x += s0) {
    const p = [x + (random() - 0.5) * s0 * 0.9, y + (random() - 0.5) * s0 * 0.9], ev = nebulaAt(plan, p), u = random(), h = random(), keep = random();
    // Where the gas is thick, not where it is thin.
    if (ev < 0 || keep > Math.min(1, nebDensity(plan.events[ev], p) / 0.6)) continue;
    const t = condensedAt(plan, p);
    if (Number.isFinite(t)) sites.push({ p, t: t + nucleationDelay(u), col: nebColour(plan.events[ev], p, h) });
  }
  // The cores: each a drop that swells as its grains arrive, in its gas's colour.
  makeCores(plan);
  plan.cores.forEach((c, i) => {
    const D = c.td - c.ts;
    sites.push({ p: c.c, t: c.ts + 0.2 * D, V0: 0, q: c.r ** 3 / (0.8 * D), tg: c.td, col: c.col, core: i });
  });
  sites.sort((a, b) => a.t - b.t);
  let nextSite = 0;

  // Frozen drops, by 48 px cell, for the chain to reach out from. Big frozen drops are few: kept apart
  // and always checked, so the grid search stays small.
  const FC = 48, FW = Math.ceil(W / FC) + 1, FH = Math.ceil(H / FC) + 1;
  const frozenGrid = Array.from({ length: FW * FH }, () => []);
  const cellOf = c => Math.min(FH - 1, Math.max(0, Math.floor(c[1] / FC))) * FW + Math.min(FW - 1, Math.max(0, Math.floor(c[0] / FC)));
  const bigFrozen = [];
  function freeze(id, t, parent = -1) {
    const r = recs[id];
    if (r.tf !== Infinity) return;
    r.tf = t; r.parent = parent;
    if (radiusAt(r, t) > 40) bigFrozen.push(id); else frozenGrid[cellOf(r.c)].push(id);
  }
  // The first frozen drop whose bridge, grown since it froze, now spans the gap to a drop of radius r
  // at c; -1 if none yet.
  const vb = DEW.bridge * H / 900;
  function bridgeTo(c, r, t, self) {
    const n = Math.ceil((r + 40 + DEW.bridgeMax) / FC), cx = Math.floor(c[0] / FC), cy = Math.floor(c[1] / FC);
    let best = -1, when = Infinity;
    const check = i => {
      if (i === self) return;
      const o = recs[i], ro = radiusAt(o, o.tf), gap = hypot(c[0] - o.c[0], c[1] - o.c[1]) - ro - r;
      if (gap > DEW.bridgeMax) return;
      const arrive = o.tf + Math.max(0, gap) / vb;
      if (arrive <= t && arrive < when) { when = arrive; best = i; }
    };
    for (const i of bigFrozen) check(i);
    for (let y = Math.max(0, cy - n); y <= Math.min(FH - 1, cy + n); y++) for (let x = Math.max(0, cx - n); x <= Math.min(FW - 1, cx + n); x++) for (const i of frozenGrid[y * FW + x]) check(i);
    return best;
  }

  // A merge keeps volume at the volume-weighted centroid; colours mix by volume; the drops still
  // gathering grains keep gathering them.
  function merge(i, j, t) {
    const a = recs[i], b = recs[j];
    const ra = radiusAt(a, t), rb = radiusAt(b, t), Va = ra ** 3, Vb = rb ** 3, V = Va + Vb;
    const c = [(a.c[0] * Va + b.c[0] * Vb) / V, (a.c[1] * Va + b.c[1] * Vb) / V];
    kill(i, t); kill(j, t);
    erase(a, i); erase(b, j);
    const live = r => t < r.tg;
    const q = (live(a) ? a.q : 0) + (live(b) ? b.q : 0), tg = Math.max(live(a) ? a.tg : -Infinity, live(b) ? b.tg : -Infinity);
    const col = a.col.map((v, k) => (v * Va + b.col[k] * Vb) / V);
    const k = add({ kind: KIND.merged, c, V0: V, t0: t, q, tg: Number.isFinite(tg) ? tg : t, pa: a.c.slice(), ra, rb, col, core: a.core ?? b.core, painted: 0 });
    active.push(k);
    grow(k, t);
    return k;
  }
  const sciLabel = new Set(sci.map(d => d.rec + 1));
  // Paint drop id out to its radius at t and settle whatever it touches: a live drop merges with it, a
  // frozen one freezes it.
  function grow(id, t) {
    const rec = recs[id];
    if (rec.end <= t || rec.tf <= t) return;
    const r = radiusAt(rec, t);
    if (r <= rec.painted + 0.3 && rec.painted > 0) return;
    const hits = new Set();
    paint(rec.c, rec.painted, r, id + 1, hits);
    rec.painted = Math.max(rec.painted, r);
    for (const h of hits) {
      if (rec.end <= t || rec.tf <= t) return;
      const j = h - 1, o = recs[j];
      if (o.end <= t) continue;
      if (sciLabel.has(h)) continue;   // Science's drops are behind the pane
      if (o.tf <= t) { freeze(id, t, j); return; }
      merge(id, j, t); return;
    }
  }

  for (let t = DEW.epoch0; t < DEW.end - 1e-9; t += DEW.dt) {
    while (nextSite < sites.length && sites[nextSite].t <= t) {
      const { p, t: tn, V0 = 0, q = qPrim, tg, col, core } = sites[nextSite++];
      if (tn >= chainAt(plan, p)) continue;
      if (at(Math.floor(p[0]), Math.floor(p[1])) !== 0 && core === undefined) continue;
      const id = add({ kind: KIND.drop, c: p, V0, q, t0: tn, tg, col, core, painted: 0 });
      active.push(id);
    }
    // The chain's seeds: the drop nearest each freezes first.
    for (const sd of plan.seeds) if (!sd.done && t >= sd.t) {
      let best = -1, bd = Infinity;
      for (const id of active) { const rec = recs[id]; if (rec.end <= t || rec.tf <= t) continue; const d = hypot(rec.c[0] - sd.p[0], rec.c[1] - sd.p[1]) - radiusAt(rec, t); if (d < bd) { bd = d; best = id; } }
      if (best >= 0 && bd < 0.25 * Math.max(W, H)) { freeze(best, t, -1); recs[best].seed = true; sd.drop = best; }
      sd.done = true;
    }
    for (let k = 0; k < active.length; k++) {
      const id = active[k], rec = recs[id];
      if (rec.end <= t || rec.tf <= t) { active[k] = active[active.length - 1]; active.pop(); k--; continue; }
      // The frost front on the bare glass, behind the bridges.
      if (t >= (rec.dl ??= chainAt(plan, rec.c) + 0.012 * random())) { freeze(id, t); continue; }
      if (t >= DEW.chain0) { const by = bridgeTo(rec.c, radiusAt(rec, t), t, id); if (by >= 0) { freeze(id, t, by); continue; } }
      grow(id, t);
    }
  }
  for (const rec of recs) { delete rec.painted; delete rec.dl; rec.tg = Math.min(rec.tg, DEW.end); }
  makeCrystals(plan, phone);
  makeFragments(plan, card);
  plan.science = sci.map(d => ({ c: d.c, r: d.r, amp: d.amp, rec: d.rec }));
  plan.label = lab;
  return plan;
}

// ---- crystals, their cells, the main crack ----------------------------------------------------------
function clipPoly(poly, n, k) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a[0] * n[0] + a[1] * n[1] - k, db = b[0] * n[0] + b[1] * n[1] - k;
    if (da <= 1e-7) out.push(a);
    if ((da < 0) !== (db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
// The ice where no drop froze: pale blue, or the colour of the gas there.
const ICE = [0.78, 0.9, 1];
export function makeCrystals(plan, phone) {
  const { W, H, records } = plan;
  const spacing = DEW.spacing[phone ? 1 : 0] * Math.max(0.85, Math.min(1.3, H / 900));
  const random = rng(plan.seed * 31 + W);
  // The larger drops at seedAt, largest first, kept at least spacing apart; then the gaps filled.
  const cand = [];
  for (const rec of records) {
    if (rec.science !== undefined || !(rec.t0 <= DEW.seedAt && rec.end > DEW.seedAt)) continue;
    const r = radiusAt(rec, DEW.seedAt);
    if (r >= 3) cand.push({ c: rec.c.slice(), r, col: rec.col });
  }
  cand.sort((a, b) => b.r - a.r);
  const seeds = [];
  const near = (c, d) => seeds.some(s => Math.hypot(s.c[0] - c[0], s.c[1] - c[1]) < d);
  for (const c of cand) if (!near(c.c, c.r > 60 ? spacing * 1.3 : spacing)) seeds.push(c);
  for (let y = spacing * 0.4; y < H; y += spacing * 0.7) for (let x = spacing * 0.4; x < W; x += spacing * 0.7) {
    const c = [x + (random() - 0.5) * spacing * 0.3, y + (random() - 0.5) * spacing * 0.3];
    if (near(c, spacing * 0.95)) continue;
    const ev = nebulaAt(plan, c), h = random();
    seeds.push({ c, r: 0, col: ev >= 0 ? nebColour(plan.events[ev], c, h).map((v, k) => v * 0.55 + ICE[k] * 0.45) : ICE });
  }
  // Voronoi cells, clipped to the screen.
  const cells = seeds.map((sd, i) => {
    let poly = [[0, 0], [W, 0], [W, H], [0, H]];
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const o = seeds[j].c;
      if (Math.hypot(o[0] - sd.c[0], o[1] - sd.c[1]) > spacing * 4) continue;
      const n = [o[0] - sd.c[0], o[1] - sd.c[1]];
      poly = clipPoly(poly, n, (o[0] * o[0] + o[1] * o[1] - sd.c[0] * sd.c[0] - sd.c[1] * sd.c[1]) / 2);
    }
    let A = 0, cx = 0, cy = 0;
    poly.forEach((a, k) => { const b = poly[(k + 1) % poly.length], x = a[0] * b[1] - b[0] * a[1]; A += x; cx += (a[0] + b[0]) * x; cy += (a[1] + b[1]) * x; });
    const centroid = Math.abs(A) > 1e-6 ? [cx / (3 * A), cy / (3 * A)] : sd.c.slice();
    const radius = Math.max(...poly.map(v => Math.hypot(v[0] - sd.c[0], v[1] - sd.c[1])));
    const tc = chainAt(plan, sd.c) + 0.004 * random();
    // Its habit (the Nakaya diagram): the conditions vary smoothly over the pane, the details per crystal.
    const cond = 0.5 + 0.3 * Math.sin(sd.c[0] * 0.004 + 1.3) * Math.sin(sd.c[1] * 0.005 + 0.7) + 0.24 * (random() - 0.5);
    // (Mostly dendrites, stellar and fernlike, the finest; plates rarer.)
    const habit = cond < 0.3 ? 1 : cond < 0.56 ? 0 : cond < 0.7 ? 4 : cond < 0.86 ? 3 : 2;
    return { seed: sd.c, r: sd.r, col: sd.col, poly, centroid, radius, tc, angle: random() * Math.PI / 3, habit, hseed: random(), main: [] };
  });
  // The Voronoi graph: vertices (snapped), edges with the cells either side.
  const key = v => `${Math.round(v[0] * 4)},${Math.round(v[1] * 4)}`;
  const verts = new Map(), edges = new Map();
  const vid = v => { const k = key(v); if (!verts.has(k)) verts.set(k, { p: v, id: verts.size, adj: [] }); return verts.get(k); };
  cells.forEach((c, i) => c.poly.forEach((a, k) => {
    const b = c.poly[(k + 1) % c.poly.length], va = vid(a), vb = vid(b);
    if (va === vb) return;
    const ek = va.id < vb.id ? `${va.id}-${vb.id}` : `${vb.id}-${va.id}`;
    const e = edges.get(ek) ?? { a: va, b: vb, cells: [] };
    e.cells.push(i); edges.set(ek, e);
  }));
  for (const e of edges.values()) if (e.cells.length === 2) { e.a.adj.push(e); e.b.adj.push(e); }
  // The main crack: the least-cost run of boundaries from the left edge to the right, kept near the
  // middle (a gentle wave about it).
  const mid = x => H * (0.5 + 0.05 * Math.sin(x / W * 5.0 + 1.3));
  const all = [...verts.values()];
  const dist = new Map(all.map(v => [v, Infinity])), prev = new Map();
  const open = all.filter(v => v.p[0] < 1.5 && Math.abs(v.p[1] - H / 2) < H * 0.25);
  for (const v of open) dist.set(v, Math.abs(v.p[1] - mid(0)) * 2);
  const done = new Set();
  let end = null;
  while (true) {
    let u = null, du = Infinity;
    for (const v of open) if (!done.has(v) && dist.get(v) < du) { du = dist.get(v); u = v; }
    if (!u) break;
    done.add(u);
    if (u.p[0] > W - 1.5) { end = u; break; }
    for (const e of u.adj) {
      const w = e.a === u ? e.b : e.a;
      if (done.has(w)) continue;
      const len = Math.hypot(w.p[0] - u.p[0], w.p[1] - u.p[1]);
      const ym = (u.p[1] + w.p[1]) / 2, xm = (u.p[0] + w.p[0]) / 2;
      const cost = du + len * (1 + 6 * Math.abs(ym - mid(xm)) / H) + (w.p[0] < u.p[0] ? len * 2 : 0);
      if (cost < dist.get(w)) { dist.set(w, cost); prev.set(w, { u, e }); if (!open.includes(w)) open.push(w); }
    }
  }
  const crack = [];
  for (let v = end; v; v = prev.get(v)?.u) {
    crack.unshift(v.p);
    const step = prev.get(v);
    if (step) { const [i, j] = step.e.cells; cells[i].main.push(j); cells[j].main.push(i); }
  }
  // Each cell's side of the crack (which way the rift carries it).
  const sideOf = q => {
    let yAt = H / 2;
    for (let k = 0; k + 1 < crack.length; k++) {
      const a = crack[k], b = crack[k + 1];
      if (q[0] >= Math.min(a[0], b[0]) && q[0] <= Math.max(a[0], b[0]) && Math.abs(b[0] - a[0]) > 1e-6) yAt = a[1] + (b[1] - a[1]) * (q[0] - a[0]) / (b[0] - a[0]);
    }
    return q[1] < yAt ? -1 : 1;
  };
  for (const c of cells) c.side = sideOf(c.centroid);
  // The pieces break away as a fracture front runs out from the main crack at a steady speed: the
  // front reaches distance d from the crack at detach0 − lead + (detach1 − detach0)·d/dMax, and a
  // piece goes once it has passed its farthest corner. Its ring (breadth-first over the cells'
  // neighbours, the crack's own cells 0) is kept for the order's test.
  plan.crack = crack;
  const nb = cells.map(() => new Set());
  for (const e of edges.values()) if (e.cells.length === 2) { nb[e.cells[0]].add(e.cells[1]); nb[e.cells[1]].add(e.cells[0]); }
  const ring = cells.map(c => (c.main.length ? 0 : Infinity));
  const queue = cells.map((_, i) => i).filter(i => ring[i] === 0);
  for (let k = 0; k < queue.length; k++) for (const j of nb[queue[k]]) if (ring[j] === Infinity) { ring[j] = ring[queue[k]] + 1; queue.push(j); }
  const maxRing = queue.reduce((m, i) => Math.max(m, ring[i]), 0);
  const far = cells.map(c => c.poly.reduce((m, v) => Math.max(m, Math.abs(v[1] - crackY(plan, v[0]))), 0));
  plan.frontMax = far.reduce((m, v) => Math.max(m, v), 1);
  cells.forEach((c, i) => {
    c.ring = Number.isFinite(ring[i]) ? ring[i] : maxRing + 1;
    c.detach = DEW.detach0 + (DEW.detach1 - DEW.detach0) * far[i] / plan.frontMax + 0.004 * random();
  });
  plan.cells = cells; plan.crack = crack; plan.spacing = spacing;
}
// When the fracture front passes q.
export const frontAt = (plan, q) => DEW.detach0 - DEW.lead + (DEW.detach1 - DEW.detach0) * Math.abs(q[1] - crackY(plan, q[0])) / plan.frontMax;
// How far the rift has opened at x (Griffith–Irwin: an elliptical crack-opening profile, widest in the
// middle), and where the crack runs at x.
export const riftOpening = (plan, x, P) => DEW.riftWidth * plan.H * Math.pow(smooth((P - DEW.riftOpen) / (DEW.riftWide - DEW.riftOpen)), 1.5)
  * Math.sqrt(Math.max(0, 1 - ((x - plan.W / 2) / (0.53 * plan.W)) ** 2));
export function crackY(plan, x) {
  const c = plan.crack;
  for (let k = 0; k + 1 < c.length; k++) if (x >= Math.min(c[k][0], c[k + 1][0]) && x <= Math.max(c[k][0], c[k + 1][0])) {
    const t = (x - c[k][0]) / Math.max(1e-9, c[k + 1][0] - c[k][0]);
    return c[k][1] + (c[k + 1][1] - c[k][1]) * t;
  }
  return x < c[0][0] ? c[0][1] : c.at(-1)[1];
}

// ---- the break-apart: fragments vacuumed along field lines into Racing's card ------------------------
// The crack's charge (the electricity that ran in it) drives the pieces: the main crack is charged +,
// Racing's card −, a little more strongly (so every field line ends on the card). Each piece breaks into
// fragments (its fan triangles, each split at a random point inside, then again); each, overdamped,
// moves along the field line through where it was when its piece broke away, turning to lie along the
// field (the torque on its induced dipole), spinning about it, and fuses into the card where its line
// ends. card: the band's card on screen during the hold [x, y, w, h] (home.js); a guess from the layout
// until it is measured.
export const defaultCard = (W, H, phone) => phone ? [W * 0.04, H * 0.36, W * 0.92, H * 0.5] : [W * 0.406, H * 0.167, W * 0.34, H * 0.483];
export const zoomAt = P => 1 + 0.3 * Math.pow(smooth((P - 0.1) / 1.02), 1.3);
export const FRAG = Object.freeze({ path: 16, step: 7, maxSteps: 480, sink: 1.4, speed: 11, minFly: 0.035, maxFly: 0.1, spread: 4200, frostCell: 8 });
export function makeFragments(plan, card) {
  const { W, H } = plan;
  card = (card ?? defaultCard(W, H, plan.phone)).map(Number);
  const random = rng(plan.seed * 131 + W * 5 + H * 3);
  const zc = [W * 0.5, H * 0.52];
  // Charges: + along the main crack where it lies outside the card (as it is when the pieces go), −
  // over the card's face and round its edge.
  const z1 = zoomAt(1.0), pad = 30;
  const inCard = (p, m = 0) => p[0] > card[0] - m && p[0] < card[0] + card[2] + m && p[1] > card[1] - m && p[1] < card[1] + card[3] + m;
  const src = [];
  for (let k = 0; k <= 40; k++) { const x = W * k / 40, p = [zc[0] + (x - zc[0]) * z1, zc[1] + (crackY(plan, x) - zc[1]) * z1]; if (!inCard(p, pad)) src.push(p); }
  const sink = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) sink.push([card[0] + card[2] * (i + 0.5) / 5, card[1] + card[3] * (j + 0.5) / 4]);
  for (let k = 0; k < 16; k++) { const t = k / 16 * 2 * (card[2] + card[3]); sink.push(t < card[2] ? [card[0] + t, card[1]] : t < card[2] + card[3] ? [card[0] + card[2], card[1] + t - card[2]] : t < 2 * card[2] + card[3] ? [card[0] + card[2] - (t - card[2] - card[3]), card[1] + card[3]] : [card[0], card[1] + card[3] - (t - 2 * card[2] - card[3])]); }
  const qs = 1 / Math.max(1, src.length), qk = -FRAG.sink / sink.length, e2 = 36;
  const N = src.length + sink.length, cx = new Float64Array(N), cy = new Float64Array(N), cq = new Float64Array(N);
  src.forEach((p, i) => { cx[i] = p[0]; cy[i] = p[1]; cq[i] = qs; });
  sink.forEach((p, i) => { cx[src.length + i] = p[0]; cy[src.length + i] = p[1]; cq[src.length + i] = qk; });
  const dir = (x, y) => {
    let ex = 0, ey = 0;
    for (let i = 0; i < N; i++) { const dx = x - cx[i], dy = y - cy[i], r2 = dx * dx + dy * dy + e2; ex += cq[i] * dx / r2; ey += cq[i] * dy / r2; }
    const l = Math.hypot(ex, ey) || 1;
    return [ex / l, ey / l];
  };
  const trace = start => {
    const pts = [start.slice()];
    let [x, y] = start;
    const h = FRAG.step, inner = [card[0] + 8, card[1] + 8, card[2] - 16, card[3] - 16];
    for (let k = 0; k < FRAG.maxSteps; k++) {
      if (x > inner[0] && x < inner[0] + inner[2] && y > inner[1] && y < inner[1] + inner[3] && k > 0) break;
      const a = dir(x, y), b = dir(x + a[0] * h / 2, y + a[1] * h / 2), c = dir(x + b[0] * h / 2, y + b[1] * h / 2), d = dir(x + c[0] * h, y + c[1] * h);
      x += h * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6; y += h * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6;
      pts.push([x, y]);
    }
    // A line that has not reached the card in time ends straight into it.
    if (!(x > inner[0] && x < inner[0] + inner[2] && y > inner[1] && y < inner[1] + inner[3])) pts.push([card[0] + card[2] / 2, card[1] + card[3] / 2]);
    // Resampled evenly along its length.
    const acc = [0];
    for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const L = acc.at(-1), out = [];
    for (let i = 0, k = 0; i < FRAG.path; i++) {
      const s = L * i / (FRAG.path - 1);
      while (k + 1 < acc.length - 1 && acc[k + 1] < s) k++;
      const t = acc[k + 1] > acc[k] ? (s - acc[k]) / (acc[k + 1] - acc[k]) : 0, a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return { path: out, L };
  };
  const frags = [];
  plan.cells.forEach((c, ci) => {
    const n = c.poly.length, cc = c.centroid;
    const zd = zoomAt(c.detach);
    for (let i = 0; i < n; i++) {
      const a = c.poly[i], b = c.poly[(i + 1) % n];
      let w1 = 0.2 + 0.4 * random(), w2 = 0.2 + 0.4 * random();
      if (w1 + w2 > 0.85) { w1 *= 0.85 / (w1 + w2); w2 *= 0.85 / (w1 + w2); }
      const m = [cc[0] + (a[0] - cc[0]) * w1 + (b[0] - cc[0]) * w2, cc[1] + (a[1] - cc[1]) * w1 + (b[1] - cc[1]) * w2];
      // Each of the three split again across its longest side, near its middle (not on the largest
      // screens, whose pieces are already many).
      const pieces = [];
      for (const t of [[cc, a, m], [a, b, m], [b, cc, m]]) {
        if (W * H > 2.5e6) { pieces.push(t); continue; }
        let k = 0, best = -1;
        for (let j = 0; j < 3; j++) { const l = Math.hypot(t[(j + 1) % 3][0] - t[j][0], t[(j + 1) % 3][1] - t[j][1]); if (l > best) { best = l; k = j; } }
        const p0 = t[k], p1 = t[(k + 1) % 3], p2 = t[(k + 2) % 3], f = 0.35 + 0.3 * random(), mid = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
        pieces.push([p0, mid, p2], [mid, p1, p2]);
      }
      for (const tri of pieces) {
        const fc = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
        const area = Math.abs((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])) / 2;
        if (area < 4) continue;
        // Where the ground drew it as its piece broke away: parted with its half of the rift, pushed.
        const start = [zc[0] + (fc[0] - zc[0]) * zd, zc[1] + (fc[1] + c.side * 0.5 * riftOpening(plan, fc[0], c.detach) - zc[1]) * zd];
        const { path, L } = trace(start);
        // Its long axis (its longest side), to turn along the field.
        let best = 0, axis = 0;
        for (let k = 0; k < 3; k++) { const p = tri[k], q = tri[(k + 1) % 3], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; axis = Math.atan2(q[1] - p[1], q[0] - p[0]); } }
        const fly = Math.min(FRAG.maxFly, Math.max(FRAG.minFly, FRAG.minFly + L / (FRAG.speed * H)));
        frags.push({ cell: ci, tri: tri.map(v => v.slice()), c: fc, zd, t0: c.detach, t1: c.detach + fly, axis, spin: (random() < 0.5 ? -1 : 1) * (2 + 4 * random()) * Math.PI * 2, roll0: random() * Math.PI * 2, path, L });
      }
    }
  });
  // When the card's frost reaches each of its points: from where the fragments land, spreading.
  const fc = FRAG.frostCell, cols = Math.ceil(card[2] / fc) + 1, rows = Math.ceil(card[3] / fc) + 1, frost = new Float64Array(cols * rows).fill(9);
  for (const f of frags) {
    const end = f.path.at(-1);
    if (!inCard(end, 2)) continue;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const t = f.t1 + Math.hypot(card[0] + i * fc - end[0], card[1] + j * fc - end[1]) / FRAG.spread;
      if (t < frost[j * cols + i]) frost[j * cols + i] = t;
    }
  }
  plan.card = card;
  plan.frags = frags;
  plan.frost = { cols, rows, cell: fc, t: frost };
  return frags;
}

// ---- reference queries ---------------------------------------------------------------------------------
// Drops live at P (born, not yet merged away), Science's excepted.
export function liveAt(rec, P) { return P >= rec.t0 && P < rec.end && rec.science === undefined; }

// ---- optics (mirrored in glsl/dew.js) ---------------------------------------------------------------
// Water's index across the visible (Hale & Querry), red, green, blue.
export const WATER = Object.freeze([1.3310, 1.3345, 1.3390]);
// A sessile drop is a spherical cap of contact angle θc. A ray from the eye meets the cap at
// s = ρ/a, refracts into the water (Snell), crosses the pane and leaves into the air beyond: the
// drop sees the direction δ off its axis, toward −ρ̂ (the image is inverted).
export function lensTrace(s, thetaC, n) {
  const alpha = Math.asin(clamp(s * Math.sin(thetaC), 0, 1));
  const beta = Math.asin(Math.sin(alpha) / n);
  const gamma = alpha - beta;
  const delta = Math.asin(clamp(n * Math.sin(gamma), 0, 1));
  return { alpha, beta, gamma, delta, tan: Math.tan(delta) };
}
// The height of a cap of base radius a and contact angle θc at distance ρ from its axis (for its
// colour: Beer–Lambert, T = tint^(h/ℓ)).
export const capHeight = (rho, a, thetaC) => { const R = a / Math.sin(thetaC); return Math.max(0, Math.sqrt(Math.max(0, R * R - rho * rho)) - R * Math.cos(thetaC)); };

// ---- tile lists and packing -------------------------------------------------------------------------
const epochOf = t => clamp(Math.floor((t - DEW.epoch0) / DEW.epochLen), 0, DEW.epochs - 1);
// What each drop can cover in its life: its last radius, with the frost halo once frozen and the
// bridge back to the drop that froze it, and both parents' union while a merge snaps.
export function extentOf(plan, rec) {
  const rEnd = radiusAt(rec, Math.min(rec.end, DEW.end));
  let ext = rEnd * 2.25 + 1.5;
  if (rec.tf < rec.end) {
    ext = Math.max(ext, rEnd + 6);
    const p = rec.parent >= 0 ? plan.records[rec.parent] : null;
    if (p) ext = Math.max(ext, hypot(rec.c[0] - p.c[0], rec.c[1] - p.c[1]) + 2);
  }
  if (rec.kind === KIND.merged) {
    const Va = rec.ra ** 3, Vb = rec.rb ** 3, cb = [(rec.c[0] * (Va + Vb) - rec.pa[0] * Va) / Vb, (rec.c[1] * (Va + Vb) - rec.pa[1] * Va) / Vb];
    ext = Math.max(ext, hypot(rec.c[0] - rec.pa[0], rec.c[1] - rec.pa[1]) + rec.ra + 1.5, hypot(rec.c[0] - cb[0], rec.c[1] - cb[1]) + rec.rb + 1.5);
  }
  return ext;
}
export function visibleFrom(rec) {
  const v3 = DEW.vis ** 3;
  if (rec.V0 >= v3) return rec.t0;
  return rec.q > 0 ? rec.t0 + (v3 - rec.V0) / rec.q : Infinity;
}
export function tileLists(plan) {
  const T = DEW.tile, cols = Math.ceil(plan.W / T), rows = Math.ceil(plan.H / T), E = DEW.epochs;
  const drops = Array.from({ length: E * cols * rows }, () => []);
  const box = (e, x0, y0, x1, y1, id) => {
    const a = clamp(Math.floor(x0 / T), 0, cols - 1), b = clamp(Math.floor(x1 / T), 0, cols - 1);
    const c = clamp(Math.floor(y0 / T), 0, rows - 1), d = clamp(Math.floor(y1 / T), 0, rows - 1);
    if (x1 < 0 || y1 < 0 || x0 > plan.W || y0 > plan.H) return;
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) drops[(e * rows + y) * cols + x].push(id);
  };
  plan.records.forEach((rec, id) => {
    if (rec.science !== undefined) return;
    const t0 = visibleFrom(rec), t1 = Math.min(rec.end, DEW.end + DEW.epochLen);
    if (!(t1 > t0)) return;
    const ext = extentOf(plan, rec), late = radiusAt(rec, Math.min(rec.end, DEW.end)) * 1.12 + 1.5;
    for (let e = epochOf(t0); e <= epochOf(t1 - 1e-9); e++) {
      // Long after it froze its halo and bridge have faded (glsl/dew.js): only the bead itself.
      const x = DEW.epoch0 + e * DEW.epochLen > rec.tf + DEW.iceFade ? late : ext;
      box(e, rec.c[0] - x, rec.c[1] - x, rec.c[0] + x, rec.c[1] + x, id);
    }
  });
  return { cols, rows, drops };
}

export function packDew(plan) {
  const cells = [];
  const { records } = plan;
  const lists = tileLists(plan);
  cells.push([plan.W, plan.H, lists.cols, lists.rows]);
  cells.push([records.length, 0, DEW.epochs, plan.phone ? 1 : 0]);
  cells.push([0, 0, 0, 0]);
  cells.push([DEW.tile, DEW.epoch0, DEW.epochLen, 0]);
  for (const d of plan.science) cells.push([d.c[0], d.c[1], d.r, d.amp]);
  for (let i = 0; i < 6; i++) cells.push([9, -1, 9, 0]);
  // Cell 16: the grains; 17: the freezing chain (seeds, the front's speed) and the cores, its seeds in
  // 18–21; 22–23: the crystals; 24: the main crack's path; 25–26: the nebulae, the pane's clock and the
  // fragments (filled in below).
  cells.push([0, 0, 0, 0], [plan.seeds.length, plan.vFront, 0, 0]);
  for (let k = 0; k < 4; k++) { const sd = plan.seeds[k]; cells.push(sd ? [sd.p[0], sd.p[1], sd.t, 0] : [0, 0, 9, 0]); }
  const crystalMeta = cells.length;
  cells.push([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
  const recBase = cells.length;
  for (const r of records) {
    const end = Math.min(r.end, 9), tf = Math.min(r.tf, 9), gEnd = Math.min(r.tg, r.tf, 9);
    // A: where, until when, and how far anything it draws can reach, with its kind (so a point far
    // from it is passed over on one fetch). B: its growth, when its growth ends, when it formed. C: a
    // merge's parents. D: the frost bridge that froze it (from the drop it came from: centre, radius
    // when frozen, when). E: its colour, and when it froze.
    const kindCode = r.kind + (r.science !== undefined ? 8 : 0) + (r.core !== undefined ? 16 : 0);
    const ext = Math.min(999, extentOf(plan, r) + 2);
    cells.push([r.c[0], r.c[1], end, ext + 1000 * kindCode]);
    cells.push([r.V0, r.q, gEnd, r.t0]);
    cells.push(r.kind === KIND.merged ? [r.pa[0], r.pa[1], r.ra, r.rb] : [0, 0, 0, 0]);
    const par = r.parent >= 0 ? records[r.parent] : null;
    cells.push(par ? [par.c[0], par.c[1], radiusAt(par, par.tf), par.tf] : [0, 0, 0, -1]);
    cells.push([...(r.col ?? [1, 1, 1]), tf]);
  }
  const headBase = cells.length, n = lists.drops.length;
  for (let i = 0; i < n; i++) cells.push([0, 0, 0, 0]);
  // Index lists, four to a texel.
  const entries = [];
  for (let i = 0; i < n; i++) {
    const a = entries.length; for (const id of lists.drops[i]) entries.push(id);
    cells[headBase + i] = [a, lists.drops[i].length, 0, 0];
  }
  // The crystals: five texels each: its seed, when it starts to grow, its habit (and a seed); its
  // centroid, reach and side of the main crack; the cells across the main crack from it, its arms'
  // angle; its outline, when it breaks away, its ring; its colour.
  const crys = plan.cells, seedBase = cells.length;
  for (const c of crys) {
    cells.push([c.seed[0], c.seed[1], c.tc, c.habit + 0.999 * c.hseed]);
    cells.push([c.centroid[0], c.centroid[1], c.radius, c.side]);
    cells.push([c.main[0] ?? -1, c.main[1] ?? -1, c.main[2] ?? -1, c.angle]);
    cells.push([0, 0, c.detach, c.ring]);
    cells.push([...c.col, c.r]);
  }
  crys.forEach((c, i) => {
    const start = cells.length, poly = c.poly.slice(0, 12);
    for (const v of poly) cells.push([v[0], v[1], 0, 0]);
    cells[seedBase + i * 5 + 3][0] = start; cells[seedBase + i * 5 + 3][1] = poly.length;
  });
  // Where the crack runs across the screen, 128 samples.
  const crackYBase = cells.length;
  for (let k = 0; k < 128; k++) cells.push([crackY(plan, plan.W * k / 127), 0, 0, 0]);
  // The fragments (glsl/units.js frags, fieldlines): a header (their count, where the card's frost
  // clock is and its size; the card's corner and the clock's cell), then eleven texels each: the
  // triangle (pane px), when it leaves and fuses, its long axis, spin, roll and the zoom it left at,
  // and sixteen points along its field line (screen px). Then the frost clock over the card.
  const fragBase = cells.length, F = plan.frags ?? [], fr = plan.frost ?? { cols: 0, rows: 0, cell: 8, t: [] };
  cells.push([F.length, 0, fr.cols, fr.rows], [plan.card?.[0] ?? 0, plan.card?.[1] ?? 0, fr.cell, 0]);
  for (const f of F) {
    cells.push([f.tri[0][0], f.tri[0][1], f.tri[1][0], f.tri[1][1]], [f.tri[2][0], f.tri[2][1], f.t0, f.t1], [f.axis, f.spin, f.roll0, f.zd]);
    for (let k = 0; k < FRAG.path; k += 2) cells.push([f.path[k][0], f.path[k][1], f.path[k + 1][0], f.path[k + 1][1]]);
  }
  cells[fragBase][1] = cells.length;
  for (const t of fr.t) cells.push([t, 0, 0, 0]);
  // The crystals by 64 px tile: every cell within reach (its own extent, a neighbour's width and how
  // far a falling piece drifts), so a point finds its own cell, its neighbours, and any piece over it.
  const CT = 64, ccols = Math.ceil(plan.W / CT), crows = Math.ceil(plan.H / CT), reach = plan.spacing + 60;
  const seedHead = cells.length;
  for (let i = 0; i < ccols * crows; i++) cells.push([0, 0, 0, 0]);
  for (let ty = 0; ty < crows; ty++) for (let tx = 0; tx < ccols; tx++) {
    const lo = [tx * CT, ty * CT], hi = [lo[0] + CT, lo[1] + CT], start = entries.length;
    // Tight first (cells within 24 px: a point's own and the next across any nearby boundary), then
    // the rest within reach (only a falling piece needs them).
    const within = (c, m) => { const xs = c.poly.map(v => v[0]), ys = c.poly.map(v => v[1]); return Math.min(...xs) - m <= hi[0] && Math.max(...xs) + m >= lo[0] && Math.min(...ys) - m <= hi[1] && Math.max(...ys) + m >= lo[1]; };
    crys.forEach((c, i) => { if (within(c, 24)) entries.push(i); });
    const tight = entries.length - start;
    crys.forEach((c, i) => { if (!within(c, 24) && within(c, reach)) entries.push(i); });
    // And the main crack's segments that pass within reach of this tile.
    const cs = entries.length;
    for (let k = 0; k + 1 < plan.crack.length; k++) {
      const a = plan.crack[k], b = plan.crack[k + 1], m = 72;
      if (Math.min(a[0], b[0]) - m <= hi[0] && Math.max(a[0], b[0]) + m >= lo[0] && Math.min(a[1], b[1]) - m <= hi[1] && Math.max(a[1], b[1]) + m >= lo[1]) entries.push(k);
    }
    // x: list start, y: tight count + 1000 × whole count, z, w: the crack's segments.
    cells[seedHead + ty * ccols + tx] = [start, tight + 1000 * (cs - start), cs, entries.length - cs];
  }
  // The nebulae: five texels each: where and when, how long it grows; its size, which giant, its
  // brightness, a seed; its turn, aspect, temperature, kind; its phases; when its gas drains away and
  // which way its gas turns.
  const eventBase = cells.length;
  for (const e of plan.events) cells.push([e.S[0], e.S[1], e.t, e.span], [e.Rmax, e.giant, e.L, e.seed], [e.angle, e.aspect, e.T / 10000, e.type], e.phase, [e.drain[0], e.drain[1], e.spin, 0]);
  // The cores (glsl/dew.js dewCollapse, glsl/units.js grains): a list per 48 px cell (start, count),
  // then three texels a core: where, when it starts to fall and when it is a drop; its drop's radius,
  // its basin, its spin, how far its grains gather from; its colour and nebula.
  const coreHead = cells.length, cg = plan.coreGrid, coreList = [], entryOf = new Map();
  for (const list of cg.grid) { cells.push([coreList.length, list.length, 0, 0]); for (const j of list) { entryOf.set(j, coreList.length); coreList.push(j); } }
  const coreEntries = cells.length;
  for (const j of coreList) { const c = plan.cores[j]; cells.push([c.c[0], c.c[1], c.ts, c.td], [c.r, c.R, c.spin, c.Rg], [...c.col, c.ev]); }
  cells[17][2] = coreHead; cells[17][3] = coreEntries;
  // The grains: each its core's entry, four to a texel.
  const grainList = [];
  plan.cores.forEach((c, j) => { for (let k = 0; k < c.grains; k++) grainList.push(entryOf.get(j)); });
  const grainBase = cells.length;
  for (let k = 0; k < grainList.length; k += 4) cells.push([grainList[k] ?? 0, grainList[k + 1] ?? 0, grainList[k + 2] ?? 0, grainList[k + 3] ?? 0]);
  cells[16] = [grainBase, grainList.length, coreEntries, 0];
  // When each point's gas is swept up, on a 12 px grid (the shader interpolates).
  const TC = 12, tcCols = Math.ceil(plan.W / TC) + 1, tcRows = Math.ceil(plan.H / TC) + 1, tcBase = cells.length;
  for (let j = 0; j < tcRows; j++) for (let i = 0; i < tcCols; i++) { const v = paneAt(plan, [i * TC, j * TC]); cells.push([Number.isFinite(v) ? v : 9, 0, 0, 0]); }
  cells[crystalMeta + 3] = [plan.events.length, eventBase, tcBase, TC];
  cells[crystalMeta + 4] = [tcCols, tcRows, SN.cool, fragBase];
  const crackBase = cells.length;
  for (const v of plan.crack) cells.push([v[0], v[1], 0, 0]);
  cells[crystalMeta + 2] = [crackBase, plan.crack.length, plan.frontMax, crackYBase];
  cells[crystalMeta] = [seedBase, crys.length, CT, seedHead];
  cells[crystalMeta + 1] = [ccols, crows, DEW.grow * plan.H / 900, plan.spacing];
  const entryBase = cells.length;
  for (let k = 0; k < entries.length; k += 4) cells.push([entries[k] ?? 0, entries[k + 1] ?? 0, entries[k + 2] ?? 0, entries[k + 3] ?? 0]);
  cells[2] = [recBase, 0, headBase, entryBase];
  const width = 1024, height = Math.ceil(cells.length / width), data = new Float32Array(width * height * 4);
  cells.forEach((v, i) => data.set(v, i * 4));
  const maxDrops = lists.drops.reduce((m, l) => Math.max(m, l.length), 0);
  return {
    width, height, data,
    stats: { frags: (plan.frags ?? []).length, cores: (plan.cores ?? []).length, grains: grainList.length, crystals: crys.length, records: records.length, entries: entries.length, maxDrops, bytes: data.byteLength },
  };
}
