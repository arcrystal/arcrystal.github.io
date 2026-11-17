// Outdoors → Photography, "fire becoming memory" (glsl/fire.js draws it). Outdoors' art-glass window
// burns from within and what is left of it is carried, abstractly, all the way to silver:
//   1. The last low sunlight rakes the window from its foot and its right, bringing up its amber, gold
//      and ruby; ignition fronts start at the summits' red glass and race along the came, through the
//      ridge and forest glass, and slowly in across the clear lowland panes. Each pane's colour heats
//      to molten light, then darkens to char crossed by glowing seams, its shape kept for a beat.
//   2. The char lets go as embers: lumps of charcoal with incandescent seams, and sparks.
//   3. We close on one ember as the others lift round it. A swirling flow with no sources or sinks
//      (an ABC flow) draws their paths out into long copper-and-gold ribbons, ever more slowly. The one
//      we followed cools and goes out: where it was is the empty centre.
//   4. The ribbons wind onto a torus, two families crossing as warp and weft. Each strand slips
//      against its place in the weave until the coupling is strong enough to hold it (Adler's
//      equation, the Kuramoto model's locking); the families roll against each other at the golden
//      ratio, so the gaps between them never repeat.
//   5. The torus turns face on, we pass through it, and it unrolls into a veil: folded sheets of
//      light, bright where they fold, their colour by how obliquely each is seen.
//   6. Three broad waves cross the veil, each carrying off what it sweeps as a brilliant seam; the
//      sparks they shed cool to fine silver grains, hanging.
//   7. The grains settle, one ripple crosses the dark liquid, and Photography's own world develops
//      out of the grain, the most exposed first (the H&D curve), already where the tile shows it.
//   Physical: fire runs fastest along fine fuel and uphill; a black body's colour by temperature; an
//   ABC flow is an exact steady solution of Euler's equations; phase locking; a folded sheet's
//   brightness 1/|dX/dx|; development's induction and characteristic curve. Artistic: everything else.
import { TERRAIN, FT, toHalf } from './terrain-plan.js';
import { GLASS, REDS } from './glsl/folio.js';
import { plateAt, spanOf } from './lead-plan.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = 2 * Math.PI;
export const GOLDEN = (Math.sqrt(5) - 1) / 2;

// The scroll's clock (P, −.2 … 1.2).
export const FIRE = Object.freeze({
  cell: 6,                       // the ignition plan's grid, CSS px
  // 1: the sun reaches the foot of the screen at sun[0], the top sunRise later, the far left sunSide
  // later still, coming up over sunUp; the fronts arrive over ignite; a pane is molten for about heat,
  // and its char has let go between gone[0] and gone[1] after its front.
  sun: -0.18, sunRise: 0.11, sunSide: 0.03, sunUp: 0.1,
  ignite: [0.0, 0.2], heat: 0.03, gone: [0.07, 0.15],
  // 2: an ember leaves release after its front; the lumps have burnt down to sparks by out.
  release: [0.03, 0.1], out: [0.34, 0.46],
  // 3: flow time τ(P) = max (1 − e^(−(P − ignite₀)/k)): fast at first, then all but still.
  tau: Object.freeze({ max: 5.0, k: 0.16 }),
  flow: Object.freeze({ A: 1, B: Math.sqrt(2 / 3), C: Math.sqrt(1 / 3), wave: 820, v: 150, lift: 230, vz: 260, focal: 1400 }),
  hero: Object.freeze({ at: [0.57, 0.52], pick: 0.105, grow: [0.2, 0.36], out: [0.42, 0.53], zoom: [0.2, 0.42], zoomBy: 0.9, r: 0.2 }),
  ribbon: Object.freeze({ on: [0.2, 0.36], len: 1.5, seg: 20 }),
  // 4: the coupling comes up over lock; the torus (R of the screen's shorter side, tube a of R, wind
  // turns of the tube a turn) turns face on over face.
  lock: [0.42, 0.6], face: [0.56, 0.66],
  torus: Object.freeze({ R: 0.3, a: 0.42, wind: 3, tilt: 1.08, sigma: 1.0, kmax: 0.86, slip: 40 }),
  // 5: through it and out into the veil; the ribbons give way to it.
  through: [0.63, 0.76], veil: [0.66, 0.76], ribbonOff: [0.69, 0.775],
  // 6: the three waves; their seams bead and go; 7: the grains settle, the ripple, development.
  fronts: Object.freeze([[0.79, 0.9], [0.82, 0.93], [0.85, 0.955]]),
  frontDir: Object.freeze([[0.944, 0.33], [-0.8, 0.6], [0.196, -0.981]]),
  bead: [0.9, 0.975],
  settle: [0.97, 1.06], ripple: [1.0, 1.15], develop: [1.02, 1.17], surface: [1.08, 1.2],
  // How fast the fire runs (screen diagonals a unit of plan time): along came, through each band's
  // glass (the clear lowland slow, the ridge and forest glass fast), through a summit's red.
  speed: Object.freeze({ came: 4.0, band: [0.3, 0.36, 0.6, 0.85, 1.0, 1.05, 1.1], red: 1.3 }),
});
// A click's clock: the same fire from the click, P = by × the cover's E; it reaches a point at start +
// radial × its distance (of the farthest corner's), ± finger, so all of it has let go by the cover's end.
export const FIREC = Object.freeze({ by: 0.34, start: 0.03, radial: 0.46, finger: 0.1 });

// One palette for every pass (display colour): Outdoors' own amber, gold and ruby heated along a
// black body's ramp; rose, violet and a little blue only in the veil; then silver, and Photography's
// black and safelight.
export const PALETTE = Object.freeze({
  deep: [0.42, 0.05, 0.02], ember: [0.95, 0.36, 0.1], copper: [0.82, 0.47, 0.24], gold: [1.0, 0.74, 0.32], white: [1.0, 0.93, 0.78],
  rose: [0.93, 0.38, 0.52], violet: [0.5, 0.3, 0.86], blue: [0.25, 0.48, 1.0], silver: [0.84, 0.86, 0.9],
});
// The ramp: 0 black, deep red, ember orange, gold, 1 white-gold.
export function blackBody(t) {
  const P = PALETTE, mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  let c = mix([0, 0, 0], P.deep, smooth(0, 0.22, t));
  c = mix(c, P.ember, smooth(0.18, 0.5, t));
  c = mix(c, P.gold, smooth(0.45, 0.8, t));
  return mix(c, P.white, smooth(0.75, 1, t));
}

// ---- 1: ignition -------------------------------------------------------------------------------------
// One band's edge in a module cell (glsl/folio.js fgMS): signed distance in module units, < 0 inside
// the band and above. c: the corners' heights (00, 10, 01, 11); mid: the middle's.
export function bandEdge(u, v, c, mid, thr) {
  const b = [c[0] > thr, c[1] > thr, c[2] > thr, c[3] > thr], n = b[0] + b[1] + b[2] + b[3];
  if (n === 0) return 1;
  if (n === 4) return -1;
  const dd = [u + v, 1 - u + v, u + 1 - v, 2 - u - v].map(x => (x - 0.5) * 0.70711);
  if (n === 1) return b[0] ? dd[0] : b[1] ? dd[1] : b[2] ? dd[2] : dd[3];
  if (n === 3) return -(!b[0] ? dd[0] : !b[1] ? dd[1] : !b[2] ? dd[2] : dd[3]);
  if (b[0] && b[1]) return v - 0.5;
  if (b[2] && b[3]) return 0.5 - v;
  if (b[0] && b[2]) return u - 0.5;
  if (b[1] && b[3]) return 0.5 - u;
  const up = mid > thr;
  if (b[0]) return up ? -Math.min(dd[1], dd[2]) : Math.min(dd[0], dd[3]);
  return up ? -Math.min(dd[0], dd[3]) : Math.min(dd[1], dd[2]);
}
const cellHash = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };

// The plan: when the fire reaches each point of the window, 0 … 1 of the ignition (a grid of FIRE.cell
// px, row 0 the top of the screen). The window as the shader leads it (the plate's heights stepped onto
// the module); the fire starts in the summits' red glass, the sunlit (right) side first, and runs by
// Dijkstra over the grid's eight neighbours, each step at the mean of its ends' speeds.
// km: the plate's heights (n × n, km); W, H: the screen (CSS px).
export function makeIgnition(km, n, W, H, cell = FIRE.cell) {
  const S = TERRAIN.size, M = GLASS.module, C = S / 2, kmPx = spanOf(W, H) / H, diag = Math.hypot(W, H);
  const gw = Math.ceil(W / cell) + 1, gh = Math.ceil(H / cell) + 1, N = gw * gh;
  const heights = new Map();
  const ft = (i, j) => { const k = (i + 4096) * 16384 + (j + 4096); let v = heights.get(k); if (v === undefined) { v = plateAt(km, n, C + i * M / 2, C + j * M / 2) / FT; heights.set(k, v); } return v; };
  const speed = new Float32Array(N), T = new Float64Array(N).fill(Infinity), seeds = [];
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = C + (gx * cell - W / 2) * kmPx, z = C + (H / 2 - gy * cell) * kmPx;
    const mx = (x - C) / M, mz = (z - C) / M, i = Math.floor(mx), j = Math.floor(mz), u = mx - i, v = mz - j;
    // (Heights are kept on the half-module lattice: a cell's corners and its middle.)
    const c = [ft(2 * i, 2 * j), ft(2 * i + 2, 2 * j), ft(2 * i, 2 * j + 2), ft(2 * i + 2, 2 * j + 2)], mid = ft(2 * i + 1, 2 * j + 1);
    let band = 0, came = 1e3;
    for (const thr of GLASS.bands) { const sd = bandEdge(u, v, c, mid, thr); if (sd < 0) band++; came = Math.min(came, Math.abs(sd)); }
    let red = false;
    for (const r of REDS) if (Math.abs(x - r.c[0]) < r.h[0] && Math.abs(z - r.c[1]) < r.h[1]) { red = true; break; }
    const k = gy * gw + gx;
    speed[k] = (red ? FIRE.speed.red : came * M / kmPx < cell * 0.6 ? FIRE.speed.came : FIRE.speed.band[band]) * (0.8 + 0.4 * cellHash(gx, gy));
    // The sun strikes the right side first.
    if (red) { T[k] = 0.2 * (1 - gx * cell / W) + 0.04 * cellHash(Math.round(x * 3), Math.round(z * 3)); seeds.push(k); }
  }
  // (No summit on this screen: the fire starts along its right edge.)
  if (!seeds.length) for (let gy = 0; gy < gh; gy++) { const k = gy * gw + gw - 1; T[k] = 0.1 * cellHash(1, gy); seeds.push(k); }
  // A binary heap of (time, node), stale entries skipped.
  const ht = [], hk = [];
  const push = (t, k) => {
    let i = ht.length; ht.push(t); hk.push(k);
    while (i) { const p = (i - 1) >> 1; if (ht[p] <= t) break; ht[i] = ht[p]; hk[i] = hk[p]; i = p; }
    ht[i] = t; hk[i] = k;
  };
  const pop = () => {
    const t0 = ht[0], k0 = hk[0], t = ht.pop(), k = hk.pop(), len = ht.length;
    if (len) {
      let i = 0;
      for (;;) { let m = 2 * i + 1; if (m >= len) break; if (m + 1 < len && ht[m + 1] < ht[m]) m++; if (ht[m] >= t) break; ht[i] = ht[m]; hk[i] = hk[m]; i = m; }
      ht[i] = t; hk[i] = k;
    }
    return [t0, k0];
  };
  for (const k of seeds) push(T[k], k);
  const STEP = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (ht.length) {
    const [t, k] = pop();
    if (t > T[k]) continue;
    const gx = k % gw, gy = (k / gw) | 0;
    for (const [dx, dy, len] of STEP) {
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      const q = y * gw + x, tt = t + len * cell / (diag * 0.5 * (speed[k] + speed[q]));
      if (tt < T[q]) { T[q] = tt; push(tt, q); }
    }
  }
  // 0 … 1: from the first to catch to when all but the last half percent has.
  const sorted = Float64Array.from(T).sort(), first = sorted[0], top = Math.max(sorted[Math.min(N - 1, Math.floor(N * 0.995))], first + 1e-6);
  const data = new Float32Array(N);
  for (let k = 0; k < N; k++) data[k] = Math.min(1, (T[k] - first) / (top - first));
  return { w: gw, h: gh, cell, data, seeds: seeds.length };
}
// As half floats, for an R16F texture the shaders filter.
export const ignitionTexels = plan => toHalf(plan.data);
// The plan at a point of the screen (CSS px), as the GPU filters it.
export function ignitionAt(plan, x, y) {
  const u = clamp(x / plan.cell, 0, plan.w - 1.001), v = clamp(y / plan.cell, 0, plan.h - 1.001);
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, d = plan.data, k = j * plan.w + i;
  return d[k] * (1 - fu) * (1 - fv) + d[k + 1] * fu * (1 - fv) + d[k + plan.w] * (1 - fu) * fv + d[k + plan.w + 1] * fu * fv;
}
// When the sun reaches a point (xn, yn: fractions of the screen, yn 0 at the top), and how far up it is at P.
export const sunStart = (xn, yn) => FIRE.sun + FIRE.sunRise * (1 - yn) + FIRE.sunSide * (1 - xn);
export const sunAt = (xn, yn, P) => smooth(sunStart(xn, yn), sunStart(xn, yn) + FIRE.sunUp, P);

// ---- 3: the flow ----------------------------------------------------------------------------------------
export const flowTime = P => FIRE.tau.max * (1 - Math.exp(-Math.max(P - FIRE.ignite[0], 0) / FIRE.tau.k));
// The ABC field at p (px): divergence-free by construction (each component is free of its own
// coordinate), in units of the flow's speed.
export function abc([x, y, z], phase = [0, 0, 1.3]) {
  const F = FIRE.flow, k = TAU / F.wave, qx = x * k + phase[0], qy = y * k + phase[1], qz = z * k + phase[2];
  return [F.A * Math.sin(qz) + F.C * Math.cos(qy), F.B * Math.sin(qx) + F.A * Math.cos(qz), F.C * Math.sin(qy) + F.B * Math.cos(qx)];
}
// An ember's velocity s after it left (px a unit of flow time): the lift it left with, dying away, and the flow.
export function flowVel(p, s, zb = 0) {
  const F = FIRE.flow, lift = Math.exp(-s / 1.1), a = abc(p), g = F.v * (0.35 + 0.65 * (1 - lift));
  return [a[0] * g, a[1] * g - F.lift * lift, a[2] * g + zb * Math.exp(-s / 1.5)];
}
// Its place s after it left p0, by the midpoint rule in steps steps (as the shaders integrate it).
export function flowAt(p0, s, zb = 0, steps = 8) {
  const h = s / steps;
  let p = p0.slice(), si = 0;
  for (let i = 0; i < steps; i++) {
    const v1 = flowVel(p, si, zb), mid = p.map((x, k) => x + v1[k] * h * 0.5), v2 = flowVel(mid, si + h * 0.5, zb);
    p = p.map((x, k) => x + v2[k] * h);
    si += h;
  }
  return p;
}

// ---- 4: the torus -----------------------------------------------------------------------------------------
// A strand's phase against its place in the weave, ψ′ = Δω − K sin ψ (Adler): held at arcsin(Δω/K) once
// the coupling K reaches |Δω|, otherwise slipping at √(Δω² − K²), by its closed form. c: its own start.
export function slip(dw, K, t, c = 0) {
  if (Math.abs(dw) <= K) return Math.asin(dw / Math.max(K, 1e-9));
  const nu = Math.sqrt(dw * dw - K * K);
  return 2 * Math.atan((K + nu * Math.tan(0.5 * nu * t + c)) / dw);
}
export const coupling = P => FIRE.torus.kmax * smooth(FIRE.lock[0], FIRE.lock[1], P);
// A point of the torus (axis z): theta round the tube, phi round the ring.
export const torusPoint = (R, a, theta, phi) => [(R + a * Math.cos(theta)) * Math.cos(phi), (R + a * Math.cos(theta)) * Math.sin(phi), a * Math.sin(theta)];

// ---- 5: the veil ------------------------------------------------------------------------------------------
// A folded sheet seen face on: material x is carried to X = x + A sin(kx + ph). The light at X is the sum,
// over every x that lands there, of 1/|dX/dx|. Found as the shader finds it: n samples across [X − A, X + A].
export function foldLight(X, A, k, ph, n = 9, floor = 0.06) {
  const g = x => x + A * Math.sin(k * x + ph) - X, x0 = X - A, dx = 2 * A / n;
  let gp = g(x0), sum = 0, roots = 0;
  for (let i = 1; i <= n; i++) {
    const x = x0 + dx * i, gx = g(x);
    if ((gx < 0) !== (gp < 0)) { const xr = x - dx * gx / (gx - gp); sum += 1 / Math.max(Math.abs(1 + A * k * Math.cos(k * xr + ph)), floor); roots++; }
    gp = gx;
  }
  return { sum, roots };
}

// ---- 6: the waves ----------------------------------------------------------------------------------------
const invSmooth = y => 0.5 - Math.sin(Math.asin(1 - 2 * clamp(y)) / 3);
// Wave j's crest: how far ahead of it a point (CSS px, on a screen W × H) is at P (< 0: swept), and when
// it passes the point. Its line wanders a little along its length.
function frontGeom(j, x, y, W, H) {
  const [nx, ny] = FIRE.frontDir[j], qx = x - W / 2, qy = y - H / 2, along = -qx * ny + qy * nx;
  const d = qx * nx + qy * ny + 46 * Math.sin(along * 0.0052 + j * 2.1) + 22 * Math.sin(along * 0.013 - j * 1.3 + 1);
  return { d, reach: (0.5 * (Math.abs(nx) * W + Math.abs(ny) * H) + 70) * 1.2 };
}
export function frontAhead(j, x, y, W, H, P) {
  const { d, reach } = frontGeom(j, x, y, W, H), [a, b] = FIRE.fronts[j];
  return d - reach * (2 * smooth(a, b, P) - 1);
}
export function frontBirth(j, x, y, W, H) {
  const { d, reach } = frontGeom(j, x, y, W, H), [a, b] = FIRE.fronts[j];
  return a + (b - a) * invSmooth((d / reach + 1) / 2);
}

// ---- 7: development ---------------------------------------------------------------------------------------
// How far a point of exposure x (0 … 1, the safelight's core the most) has come up at t (0 … 1 of the
// development): after an induction shorter the more exposed, 1 − e^(−(t − t_i)/τ), and all there by the end.
export const DEVELOP = Object.freeze({ lead: 0.05, lag: 0.45, tau: 0.16 });
export const induction = x => DEVELOP.lead + DEVELOP.lag * (1 - clamp(x));
export function developed(x, t) {
  const f = (1 - Math.exp(-Math.max(t - induction(x), 0) / DEVELOP.tau)) / (1 - Math.exp(-(1 - DEVELOP.lead - DEVELOP.lag) / DEVELOP.tau));
  return Math.max(clamp(f), smooth(0.9, 1, t));
}
