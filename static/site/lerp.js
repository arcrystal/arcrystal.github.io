// Motion and colour maths: pure functions shared by the homepage (home.js) and the Node tests
// (tools/site/tests/lerp.test.mjs). No DOM.
//
// approach() is the frame-rate independent chase every eased value uses (the crystal's fill, the
// scroll velocity the scene smears by). seamAt() places the boundary inside a seam between two
// bands. Colours mix in OKLab.

export const clamp01 = x => Math.max(0, Math.min(1, x));
export const smoothstep = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const easeInOutCubic = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// ---- Colour ----------------------------------------------------------------------------------

// '#RRGGBB' or '#RRGGBBAA' → [r, g, b, a] with channels 0..1.
export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex).trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
}

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// sRGB → OKLab (Björn Ottosson's matrices). → [L, a, b, alpha]
export function toOklab(hex) {
  const [r8, g8, b8, alpha] = parseHex(hex);
  const r = toLinear(r8), g = toLinear(g8), b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    alpha,
  ];
}

const fix = (x, d) => Number(x.toFixed(d));
export const oklabCss = ([L, a, b, alpha]) =>
  `oklab(${fix(L, 4)} ${fix(a, 4)} ${fix(b, 4)}${alpha < 1 ? ` / ${fix(alpha, 3)}` : ''})`;

// Two OKLab colours mixed by t → CSS.
export const mixOklab = (u, v, t) => oklabCss(u.map((x, i) => x + (v[i] - x) * clamp01(t)));

// ---- Motion --------------------------------------------------------------------------------

// Exponential approach of a value to its target: frame-rate independent.
export function approach(current, target, dt, tau) {
  if (!(tau > 0)) return target;
  const next = target + (current - target) * Math.exp(-dt / tau);
  return Math.abs(next - target) < 1e-4 ? target : next;
}

// Where the boundary sits inside a seam (0 = its top, 1 = its bottom) when the bands' meeting line
// is at h of the viewport (0 = top, 1 = bottom): centred, leaning against the scroll so the front
// sweeps as it passes (the next world gains ground as the line rises), and always inside the seam.
// Mirrors seamEdge() in scene/glsl/seams.js.
export const seamAt = h => 0.26 + 0.48 * clamp01(h);

// ---- Transits ----------------------------------------------------------------------------------
// Mirrors scene/glsl/flight.js: a seam's hold, where its front is and how far a point is through its
// flight.

// A seam's hold (home.js): PIN screens of scroll with the seam held full screen. Its transit is
// drawn as if it were already held, on the whole screen; the strip's real place only reveals it. So
// it begins LEAD_IN screens before the hold, as soon as the strip's top comes on screen under the
// band above (the transit grows from the foot of the screen, right there), and ends LEAD_OUT after,
// as the next band's heading arrives. holdAt gives, for a hold whose page top is T and whose length
// is H (CSS px, so H - vh of it is held), the strip's top on screen and the progress p.
// pinTouch: phones and touch screens, where a long hold costs more thumb. by: a style's own (pin: a
// scale on the pin; leadIn, leadOut). A negative leadOut finishes before the next band enters.
export const HOLD = {
  pin: 1.75, pinTouch: 0.9, leadIn: 0.95, leadOut: 0.2,
  by: { cosmos: { pin: 1.6, leadOut: 0.75 }, glass: { pin: 4.0 }, folio: { pin: 1.25, leadOut: 0.06 }, darkroom: { pin: 1.25, leadOut: 0.06 }, ink: { pin: 1.2 } },
};
// Racing's band surfaces in place inside its transition (home.js wraps it with its hold): the hold
// ends, and the band scrolls on, at the transition's very end.
export const GLASS_RELEASE = 1.2;
export const holdFor = (style, pin = HOLD.pin) => {
  const h = { pin: 1, leadIn: HOLD.leadIn, leadOut: HOLD.leadOut, ...HOLD.by[style] };
  if (style === 'glass') h.leadOut = 0;
  return h;
};
export function holdAt(sy, T, H, vh, leadIn = HOLD.leadIn, leadOut = HOLD.leadOut) {
  const R = Math.max(1, H - vh), a = leadIn * vh, b = leadOut * vh;
  const y = sy < T ? T - sy : sy > T + R ? T + R - sy : 0;
  return { y, p: clamp01((sy - T + a) / (R + a + b)) };
}
// Every transit starts slowly, giving time at the foot of the band above: the progress it plays at.
export const holdEase = p => clamp01(p) ** 1.35;
// Racing's hold paces its transition by stretch: how much scroll each part of P gets, relative. It
// starts from rest, the nebulae and the stardust unhurried, the freezing a little brisker, and the
// ending (the rift, the field lines, the card) slowest. glassEase maps the hold's raw progress to p
// as holdEase does for the others; glassRaw inverts it (for the tools that seek a P).
const GLASS_PACE = [[-0.2, 3.2], [-0.1, 1.25], [0.46, 1.25], [0.5, 1.0], [0.8, 1.0], [0.88, 2.4], [1.2, 2.4]];
const GLASS_TABLE = (() => {
  const N = 2048, Ps = new Float64Array(N + 1), raw = new Float64Array(N + 1);
  const w = x => {
    for (let i = 1; i < GLASS_PACE.length; i++) if (x <= GLASS_PACE[i][0]) {
      const [a, wa] = GLASS_PACE[i - 1], [b, wb] = GLASS_PACE[i], t = (x - a) / (b - a);
      return wa + (wb - wa) * t * t * (3 - 2 * t);
    }
    return GLASS_PACE[GLASS_PACE.length - 1][1];
  };
  for (let k = 0; k <= N; k++) {
    Ps[k] = -0.2 + 1.4 * k / N;
    if (k) raw[k] = raw[k - 1] + (w(Ps[k - 1]) + w(Ps[k])) / 2;
  }
  for (let k = 0; k <= N; k++) raw[k] /= raw[N];
  return { Ps, raw, N };
})();
export function glassEase(r) {
  const { Ps, raw, N } = GLASS_TABLE, x = clamp01(r);
  let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (raw[m] <= x) lo = m; else hi = m; }
  const t = raw[hi] > raw[lo] ? (x - raw[lo]) / (raw[hi] - raw[lo]) : 0;
  return (Ps[lo] + (Ps[hi] - Ps[lo]) * t + 0.2) / 1.4;
}
export function glassRaw(P) {
  const { raw, N } = GLASS_TABLE, k = Math.max(0, Math.min(N, (P + 0.2) / 1.4 * N)), i = Math.min(N - 1, Math.floor(k));
  return raw[i] + (raw[i + 1] - raw[i]) * (k - i);
}
export const easeFor = style => (style === 'glass' ? glassEase : holdEase);

// Mirrors scene/glsl/flight.js. A seam's progress p → P, past both ends so p = 0 and p = 1 are at rest.
export const transitP = p => -0.2 + 1.4 * clamp01(p);

// A point's flight from its arrival A (0..1, when the reach fills it) and its own lean jit (0..1):
// 0 = at home in the upper world, 1 = landed in the lower one.
export const flightAt = (A, P, jit = 0.5) => clamp01(0.5 + (P - A + (jit - 0.5) * 0.1) / 0.3);

// Where arrivals can fall at rn (0 at the strip's foot, 1 at its top): the branches grow out at
// 0.55 × (0.85..1.15) of rn, and the gaps fill up to 0.36 later, ±0.02 of noise.
export const arrivalRange = rn => [Math.max(0, 0.4675 * rn - 0.02), Math.min(1, 0.6325 * rn + 0.38)];

// ---- The processes' pure parts (mirrors of scene/glsl/flight.js and opens.js) ----------------------

// Outdoors: three layers of sheets (flight.js layerA): when a sheet of layer k centred at rn (0 at the
// foot of the screen) and xn (0 at the left) is mid-peel; jit 0..1 its own beat.
export const layerArrival = (k, rn, xn, jit = 0.5) => 0.04 + 0.31 * clamp01(rn) + 0.1 * clamp01(xn) + (jit - 0.5) * 0.12 + 0.26 * k;

// Photography: film (flight.js filmA, filmU, filmNeg): when a strip at rn is pulled; how far its pull
// has gone at P; how far it has turned to a negative.
export const filmArrival = (rn, jit = 0.5) => 0.1 + 0.74 * clamp01(rn) + (jit - 0.5) * 0.04;
export const filmU = (A, P) => clamp01((P - A + 0.2) / 0.5);
export const filmNeg = (A, P) => smoothstep((P - A + 0.28) / 0.08);

// Science: a vortex (flight.js) standing up the middle of the screen. A click's cubes come out of
// its axis (coreEase eases them through the core; vortexAt is where they are). A seam's vortex stands
// on the foot of the screen and grows taller, and the page is gathered up the screen behind its
// growing top, each height over a long window (some cubes lag), so the foot is still giving up its
// last cubes while the upper middle starts. Each cube goes round the vortex, rising with it, and is
// thrown down and out onto a cell: the bottom corners are built first, then upward and inward, the
// middle top last (vortexPlan). vortexOrbit: where a seam's cube is (x across, y down, z toward the
// viewer). Science comes in blurred, and the vortex's tendrils sharpen it (vortexSharp).
export const VORTEX = {
  spin: 2.5, sink: 6, tilt: 0.42,
  // The gathering: the foot's starts at c0, the front climbs a screen in c1, each height over lc.
  c0: -0.15, c1: 0.5, lc: 0.375,
  // A cube's flight; how soon after a cell's paper goes a cube may land on it.
  d: 0.17, gap: 0.04,
  // The building order: up, then in.
  byUp: 0.45, byIn: 0.55,
  // The wind's base leaves the foot at base0 and reaches the top base1 later. A built cell stays
  // blurred blurWait, then sharpens over blurD as the base ring's front (reachW deep) reaches it.
  base0: 0.78, base1: 0.35, blurWait: 0.08, blurD: 0.14, reachW: 0.025,
  in: 0.12, out: 0.2, v0: 0.08,
  swarms: 5, clump: 0.82, wave: 80, lzN: 32, lzT: 0.8, lzPx: 2.4,
};
// A cube's own pace through a click's vortex: a warp of u (a within ±0.7) that leaves both ends in place.
export const vortexPace = (u, a) => u + a * u * (1 - u);
export const coreEase = (u, K) => (u * (1 + 0.5 * K) - K * Math.sin(2 * Math.PI * u) / (4 * Math.PI)) / (1 + 0.5 * K);
export const vortexTurn = u => coreEase(u, VORTEX.spin);
export function vortexAt([hx, hy], drop, ax, rc, turns, u, phase = 0) {
  const r0 = hx - ax, k = smoothstep(Math.sin(Math.PI * u));
  const r = r0 + (Math.sign(r0) * Math.min(Math.abs(r0), rc) - r0) * k ** 1.7;
  const th = turns * Math.PI * vortexTurn(u) + phase * Math.sin(Math.PI * u) ** 2, tilt = VORTEX.tilt * smoothstep(k / 0.4);
  const X = r * Math.cos(th), Z = r * Math.sin(th) * 0.75;
  return [ax + X, hy + drop * coreEase(u, VORTEX.sink) + Z * Math.sin(tilt), Z * Math.cos(tilt)];
}
// The wind (up: 0 at the foot of the screen, 1 at the top): it reaches a height a little before the
// gathering there starts; it dies there once the cubes there have landed. Its band at P ([top,
// base], CSS px, y down) and its widest radius.
export const vortexWindOn = up => VORTEX.c0 - 0.07 + VORTEX.c1 * up;
export const vortexWindOff = up => VORTEX.base0 + VORTEX.base1 * up;
export function vortexBand(P, [, H]) {
  const top = (P - vortexWindOn(0)) / VORTEX.c1, base = (P - VORTEX.base0) / VORTEX.base1;
  return [H * (1 - Math.min(top, 1.7)), base <= 0 ? H + 20 : H * (1 - base)];
}
export const vortexWide = ([top, base], [W]) => Math.min(W * 0.48, 150 + (base - top) * 0.5);
// The visible lower edge of the base ring, including its tilt and perspective (units.js flowAt).
// Solve the projected ellipse at x; outside its silhouette, continue from its side. The lower of
// the front/back intersections stays below the whole ring as it rises past the screen centre.
export function vortexClearY(x, P, S) {
  const band = vortexBand(P, S), R = vortexWide(band, S);
  const a = 0.8 * R * Math.cos(VORTEX.tilt) / 1100;
  const cap = 700 / 1100, side = Math.min(a, cap / a);
  const k = Math.min(Math.abs(x - S[0] * 0.5) / R, Math.sqrt(1 - side * side) / (1 - a * side));
  const d = Math.sqrt(Math.max(0, 1 - k * k * (1 - a * a)));
  const project = sign => {
    let sn = (k * k * a + sign * d) / (1 + k * k * a * a);
    const clipped = Math.sqrt(Math.max(0, 1 - (k * (1 - cap)) ** 2));
    if (sign > 0 && a * clipped >= cap) sn = clipped;
    return S[1] * 0.5 + (band[1] - S[1] * 0.5 + 0.8 * R * sn * Math.sin(VORTEX.tilt)) / (1 - Math.min(a * sn, cap));
  };
  return Math.max(project(-1), project(1)) + 0.008 * S[1];
}
// How sharp a cell is (0 blurred, 1 sharp): after its wait and just below the visible base.
export function vortexSharp([qx, qy], land, P, S, n = 0.5) {
  const V = VORTEX, t = (P - land - V.blurWait) / V.blurD;
  if (t <= 0) return 0;
  const front = ((qy - vortexClearY(qx, P, S)) / S[1] + 0.004 * (n - 0.5)) / V.reachW;
  return smoothstep(Math.min(t, front));
}
// How much of the wind's widest a cube orbits at, at height y in the band: a trumpet, wide at the
// foot, closed into the core by halfway up (never closer in than vortexHug).
export function vortexFunnel(y, [top, base]) {
  const k = clamp01((base - y) / Math.max(base - top, 1));
  return 1 - 0.9 * (1 - (1 - Math.min(k / 0.55, 1)) ** 2.6);
}
export const vortexHug = 0.35;

// The plan for a seam's cube grid (cols × rows, on screen S): for each cell (row-major from the top
// left), when its own cube leaves (leave), the cell its cube lands on (dest) and when the cube bound
// for it lands (land). Gathering: by height from the foot up, each cell lagging by a mix of a smooth
// field and its own chance. Building: every cube flies for VORTEX.d; landing slots come in the order
// cubes leave, and each goes to the cell first in the building order (its key: low and outward
// first) of those whose paper has been gone at least VORTEX.gap. Seeded, so the same screen always
// builds the same way.
const vrand = seed => { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; };
function vfield(cols, rows, scale, rand) {
  const gw = Math.ceil(cols / scale) + 2, gh = Math.ceil(rows / scale) + 2, g = Array.from({ length: gw * gh }, rand);
  return (c, r) => {
    const x = c / scale, y = r / scale, i = Math.floor(x), j = Math.floor(y), fx = smoothstep(x - i), fy = smoothstep(y - j), v = (a, b) => g[b * gw + a];
    return (v(i, j) * (1 - fx) + v(i + 1, j) * fx) * (1 - fy) + (v(i, j + 1) * (1 - fx) + v(i + 1, j + 1) * fx) * fy;
  };
}
export function vortexPlan(cols, rows, seed = 7) {
  const V = VORTEX, rand = vrand(seed), scale = Math.max(3, cols / 12), lagField = vfield(cols, rows, scale, rand), keyField = vfield(cols, rows, scale * 0.7, rand);
  const N = cols * rows, leave = new Float64Array(N), land = new Float64Array(N), key = new Float64Array(N), dest = new Int32Array(N);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, up = 1 - (r + 0.5) / rows, inward = 1 - Math.abs((c + 0.5) / cols - 0.5) * 2;
    const lag = clamp01(0.5 + 1.32 * (lagField(c, r) - 0.5) + 0.4 * (rand() - 0.5)) ** 1.3;
    leave[i] = V.c0 + V.c1 * up + V.lc * lag;
    key[i] = V.byUp * up + V.byIn * inward + 0.06 * (keyField(c, r) - 0.5);
  }
  const bySrc = [...Array(N).keys()].sort((a, b) => leave[a] - leave[b]);
  const heap = [];
  const less = (a, b) => key[heap[a]] < key[heap[b]];
  const swap = (a, b) => { const t = heap[a]; heap[a] = heap[b]; heap[b] = t; };
  const push = i => { heap.push(i); for (let k = heap.length - 1; k > 0;) { const p = (k - 1) >> 1; if (!less(k, p)) break; swap(k, p); k = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && less(l, m)) m = l; if (r < heap.length && less(r, m)) m = r; if (m === k) break; swap(m, k); k = m; }
    }
    return top;
  };
  let j = 0;
  for (const s of bySrc) {
    const t = leave[s] + V.d;
    while (j < N && leave[bySrc[j]] <= t - V.gap) push(bySrc[j++]);
    const d = pop();
    dest[s] = d;
    land[d] = t;
  }
  return { cols, rows, leave, land, dest };
}
// The plan as an RGBA float texture's data, a texel a cell: the cell its cube lands on (as an index,
// row-major), when it leaves, when the cube bound for it lands, and the latest landing round it (it
// and its eight neighbours), which the blur's timing is read from, smoothly across cells, so it
// clears without showing the cells and never before a cell's own cube is down.
export function vortexPlanTexels({ cols, rows, leave, land, dest }) {
  const out = new Float32Array(cols * rows * 4);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    let near = land[i];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) near = Math.max(near, land[rr * cols + cc]);
    }
    out.set([dest[i], leave[i], land[i], near], i * 4);
  }
  return out;
}

// A cube's turn round the axis by u (its angular speed a trapezoid); the swarms' pull on its angle;
// a throw's Lorenz swerve (a bridge, none at either end).
export function vortexSweep(u) {
  u = clamp01(u);
  const a = VORTEX.in, b = VORTEX.out, v0 = VORTEX.v0;
  const I = u < a ? u * u / (2 * a) : u > 1 - b ? 1 - 0.5 * a - 0.5 * b - (1 - u) ** 2 / (2 * b) : u - 0.5 * a;
  return (v0 * u + (1 - v0) * I) / (v0 + (1 - v0) * (1 - 0.5 * a - 0.5 * b));
}
export const vortexSwarm = (phi, P, t, f) =>
  phi - VORTEX.clump * Math.sin(VORTEX.swarms * (phi - (VORTEX.wave * P + 1.4 * t + 2 * (f - 0.9) / 0.1))) / VORTEX.swarms;
const lorenz = ([x, y, z]) => [10 * (y - x), x * (28 - z) - y, x * y - 8 / 3 * z];
export function vortexSwerve(p0, tau) {
  const N = VORTEX.lzN, dt = VORTEX.lzT / N, k = tau * N;
  let p = p0, at = p0;
  for (let i = 0; i < N; i++) {
    const d1 = lorenz(p), m = p.map((v, j) => v + 0.5 * dt * d1[j]), d2 = lorenz(m), q = p.map((v, j) => v + dt * d2[j]);
    if (i < k && k <= i + 1) at = p.map((v, j) => v + (q[j] - v) * (k - i));
    p = q;
  }
  return at.map((v, j) => v - p0[j] - tau * (p[j] - p0[j]));
}
// How high (CSS px, y down) a seam's cube orbits at u: from its own cell's height it rises with the
// wind to a little above the higher of its two cells, so it is always thrown down onto its new one.
export const vortexRise = (home, dest, u, [, H]) => {
  const top = Math.min(home[1], dest[1]) - 0.07 * H;
  return home[1] + (top - home[1]) * smoothstep((u - 0.1) / 0.75);
};
// Where a seam's cube is at u. o: its own draw (flight.js hashes the cell for these): f its place
// across the funnel (0.8..1), whole its whole turns (2..4), lift (-0.5..0.5) its height in the
// swarm, seed [3] (0..1) its Lorenz start and turn.
export function vortexOrbit(home, dest, o, u, P, t, S) {
  const ax = 0.5 * S[0], sm = (a, b, x) => smoothstep((x - a) / (b - a));
  const band = vortexBand(P, S), y = vortexRise(home, dest, u, S);
  const rad = vortexWide(band, S) * o.f * Math.max(vortexFunnel(y, band), vortexHug);
  const across = (home[0] < ax) !== (dest[0] < ax);
  const turns = 2 * o.whole + (across ? 1 : 0);
  const a = turns * Math.PI * vortexSweep(u);
  const th = a + (across ? 0 : Math.PI * sm(0.1, 0.9, u));
  const c0 = sm(0, 1.4 * VORTEX.in, u), tau = clamp01((u - 1 + VORTEX.out) / VORTEX.out), wz = smoothstep(tau);
  const grip = c0 * (1 - wz);
  let phi = a + (home[0] < ax ? Math.PI : 0);
  phi += (vortexSwarm(phi, P, t, o.f) - phi) * grip;
  const Z = rad * Math.sin(phi) * 0.8;
  const ring = [ax + rad * Math.cos(phi), y + Z * Math.sin(VORTEX.tilt) + o.lift * 26, Z * Math.cos(VORTEX.tilt)];
  const p = [home[0], home[1], 0].map((v, i) => v + (ring[i] - v) * c0);
  const wxy = tau * tau * (10 - 16 * tau + 7 * tau * tau);
  const at = [p[0] + (dest[0] - p[0]) * wxy, p[1] + (dest[1] - p[1]) * wxy, p[2] * (1 - wz)];
  if (tau > 0 && tau < 1) {
    const [h2, h3, h5] = o.seed;
    const L = vortexSwerve([2 + (h2 - 0.5) * 14, 3 + (h3 - 0.5) * 14, 22 + (h5 - 0.5) * 10], tau);
    const psi = h5 * 2 * Math.PI, e = VORTEX.lzPx * Math.sin(Math.PI * tau);
    at[0] += (Math.cos(psi) * L[0] - Math.sin(psi) * L[1]) * e;
    at[1] += -0.8 * L[2] * e;
    at[2] += (Math.sin(psi) * L[0] + Math.cos(psi) * L[1]) * e;
  }
  return { at, th, phi, grip, rad, turns, ring };
}

// About Me, Résumé, Contact: a maze carved by depth-first backtracking from start ([col, row]) over
// cols × rows cells, seeded. order: when each cell was first reached (0 the start); from: the side it
// was entered from (0 the start, 1 left, 2 right, 3 above, 4 below). A spanning tree: every cell is
// reached exactly once, through one opened wall.
export function carveMaze(cols, rows, start, seed = 1) {
  let a = seed >>> 0 || 1;
  const rand = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
  const N = cols * rows;
  const order = new Int32Array(N).fill(-1), from = new Uint8Array(N);
  const at = (c, r) => r * cols + c;
  // Neighbours: [dc, dr, the side the neighbour is entered from].
  const STEPS = [[-1, 0, 2], [1, 0, 1], [0, -1, 4], [0, 1, 3]];
  const stack = [start];
  let next = 0;
  order[at(start[0], start[1])] = next++;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const open = STEPS.filter(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc >= 0 && rr >= 0 && cc < cols && rr < rows && order[at(cc, rr)] < 0; });
    if (!open.length) { stack.pop(); continue; }
    const [dc, dr, side] = open[Math.floor(rand() * open.length)];
    const cc = c + dc, rr = r + dr;
    order[at(cc, rr)] = next++;
    from[at(cc, rr)] = side;
    stack.push([cc, rr]);
  }
  return { order, from };
}
