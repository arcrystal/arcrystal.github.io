// Racing → Outdoors begins as paint (glsl/peaks.js draws it): Racing's white ice settles into a primed
// canvas seen from straight above, and thick paint lands on it a drop at a time, green, white-ish,
// yellow, orange and red; the blotches look random, but each is the colour of the land where it falls,
// and soon the paint creeps out along its own kind of land until the canvas is the painted map of the
// White Mountains, and the painting rises into them. This works out, for a screen's shape, where and
// when each drop lands and how it splashes, and when the paint reaches every part of the map.
//   Physical: a drop of paint hitting a dry surface spreads to β ≈ 0.9 We^¼ times its own radius
//   (Clanet et al. 2004), its rim breaking into N ≈ √We / (4√3) fingers (Allen 1975, the
//   Rayleigh–Taylor instability of the decelerating rim), whose tips pinch off satellite drops
//   (Rayleigh–Plateau); an oblique drop stretches its splash and throws its spray downrange.
//   The spread of the paint is a multi-source Dijkstra on a 256² grid of the map (fronts that stop
//   where another arrived first), fast through land of the paint's own kind and slow across others,
//   so each blotch's paint fills the shapes of its own: the forest's green up the slopes, the
//   hardwoods' colours down the valleys, the white along the high ridges. The lakes are struck in
//   last, in blue.
//   Artistic: the count, sizes and colours of the drops, the pace, the cost of crossing, the canvas.
import { TERRAIN, FAMILY, coverAt } from './terrain-plan.js';
import { HOLD, holdFor, folioEase, transitP } from '../lerp.js';

// The clock (P), and the shapes.
//   start: no drop lands before the hold has begun (the strip still coming in) and this long after;
//   first, last: the first drop's latest landing, the last drop's; quicken: landings come quicker,
//   t_i = first + (last − first)·(i/n)^quicken; fall: a drop's last moments in the air;
//   spread, fingers, pinch: from landing to its full spread, its fingers grown, its satellites free;
//   own: a blotch draws back onto its own kind of land over this long after landing, and in melt more it
//   has melted into the paint around it;
//   mold: the paint's fronts leave the blotches no earlier than mold[0] and have reached everything by
//   cover[1] (all but the last half percent of the view; the rest by mold[1]); lakes: when the blue
//   goes in; real: the painting turning into the land; heave: it rising from flat into relief.
export const PAINT = Object.freeze({
  seed: 48, grid: 256, desk: 52, phone: 32, canvas: 0.03, start: 0.03, first: -0.04, last: 0.15, quicken: 0.62,
  fall: 0.008, spread: 0.007, fingers: 0.012, pinch: 0.016, own: [0.04, 0.1], melt: 0.06, mold: [0.06, 0.3], lakes: [0.215, 0.255],
  real: [0.26, 0.44], heave: [0.12, 0.4], cross: 2.6, cover: [0.995, 0.28], top: 62, focal: 1.07, exag: 2.0, quota: [0, 0.18, 0.34, 0.48], maxSplash: 80,
});
// P at which the hold begins (the strip moving until then).
export function paintHoldP(phone) {
  const pin = phone ? HOLD.pinTouch : HOLD.pin, L = holdFor('folio', pin);
  const R = pin * L.pin, p = L.leadIn / (R + L.leadIn + L.leadOut);
  return transitP(folioEase(p));
}
// The landings' clock for this kind of screen: [first landing, last landing].
export function paintClock(phone) {
  return [Math.max(PAINT.first, paintHoldP(phone) + PAINT.start), PAINT.last];
}
// What the top view shows of the map (km), the camera straight above the middle as glsl/peaks.js
// places it: height min(top, 1.07·size·min(1, h/w)·.97), focal length `focal`.
export function paintWindow(W, H) {
  const S = TERRAIN.size, y = Math.min(PAINT.top, 1.07 * S * Math.min(1, H / W) * 0.97), hy = y * 0.5 / PAINT.focal, hx = hy * W / H;
  return { x0: Math.max(0, S / 2 - hx), x1: Math.min(S, S / 2 + hx), z0: Math.max(0, S / 2 - hy), z1: Math.min(S, S / 2 + hy), hx, hy, kmPerPx: y / (PAINT.focal * H) };
}
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Paint (linear RGB): titanium and zinc whites, a little cool or warm, and a granite grey; sap green,
// viridian, Hooker's green, olive; the cadmiums from yellow through orange to red, and a crimson;
// ultramarine and cerulean for the water.
const WHITES = [[0.84, 0.87, 0.9], [0.9, 0.88, 0.82], [0.76, 0.8, 0.86], [0.6, 0.62, 0.64]];
const GREENS = [[0.1, 0.26, 0.04], [0.02, 0.2, 0.12], [0.03, 0.13, 0.05], [0.2, 0.24, 0.05]];
const AUTUMN = [[0.88, 0.64, 0.04], [0.82, 0.44, 0.03], [0.86, 0.25, 0.02], [0.64, 0.05, 0.02], [0.44, 0.02, 0.04]];
const BLUES = [[0.03, 0.08, 0.42], [0.04, 0.26, 0.52]];
export function paintColour(family, hue, r) {
  if (family === FAMILY.water) return mix(BLUES[0], BLUES[1], r);
  if (family === FAMILY.white) return r < 0.82 ? mix(WHITES[0], WHITES[(r * 4.5 | 0) % 3], (r * 7.3) % 1 * 0.8) : WHITES[3];
  if (family === FAMILY.green) { const i = Math.min(3, r * 4 | 0); return mix(GREENS[i], GREENS[(i + 1) % 4], (r * 9.1) % 1 * 0.5); }
  const x = Math.min(0.999, Math.max(0, hue + (r - 0.5) * 0.35)) * (AUTUMN.length - 1), i = Math.floor(x);
  return mix(AUTUMN[i], AUTUMN[i + 1], x - i);
}
// Allen's fingers for a Weber number, and Clanet's spread.
export const fingerCount = We => Math.max(4, Math.min(13, Math.round(Math.sqrt(We) / (4 * Math.sqrt(3)))));
export const spreadFactor = We => 0.9 * Math.pow(We, 0.25);

// The drops: where (km), when (P), how big their splash (R km), Weber number, fingers, skew, colour.
export function makeSplashes(field, W, H, phone) {
  const random = rng(PAINT.seed + (phone ? 7 : 0)), win = paintWindow(W, H);
  const n = phone ? PAINT.phone : PAINT.desk, [t0, t1] = paintClock(phone);
  const area = (win.x1 - win.x0) * (win.z1 - win.z0), sizeK = Math.sqrt(area / 3240);
  // How many of each kind: by quota, but none of a kind the view has (almost) none of.
  const counts = [0, 0, 0, 0], present = [0, 0, 0, 0];
  for (let k = 0; k < 4000; k++) present[coverAt(field, win.x0 + random() * (win.x1 - win.x0), win.z0 + random() * (win.z1 - win.z0)).family]++;
  const want = PAINT.quota.map((q, f) => (present[f] > 12 ? q : 0)), sum = want.reduce((a, b) => a + b, 0);
  const quota = want.map(q => Math.round(q / sum * n));
  const out = [], dmin0 = 0.75 * Math.sqrt(area / n);
  for (let f = 1; f <= 3; f++) {
    let dmin = dmin0, tries = 0;
    while (counts[f] < quota[f] && tries < 40000) {
      tries++;
      if (tries % 4000 === 0) dmin *= 0.85;
      const x = win.x0 + 1.5 + random() * (win.x1 - win.x0 - 3), z = win.z0 + 1.5 + random() * (win.z1 - win.z0 - 3);
      const c = coverAt(field, x, z);
      if (c.family !== f || out.some(s => Math.hypot(s.x - x, s.z - z) < dmin)) continue;
      out.push({ x, z, family: f, hue: c.hue });
      counts[f]++;
    }
  }
  // The order they land in: shuffled; the first few big, the last small.
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.map((s, i) => {
    const u = out.length > 1 ? i / (out.length - 1) : 0;
    const We = Math.exp(Math.log(700) + random() * Math.log(9000 / 700));
    const R = sizeK * (3.3 - 1.9 * Math.sqrt(u)) * (0.8 + 0.4 * random());
    return {
      ...s, t: t0 + (t1 - t0) * Math.pow(u, PAINT.quicken), R, We, N: fingerCount(We), beta: spreadFactor(We),
      seed: random(), skew: 0.4 * random() ** 2, dir: random() * Math.PI * 2, colour: paintColour(s.family, s.hue, random()),
    };
  });
}

// A binary min-heap (time, cell).
function heap() {
  const v = [], k = [];
  return {
    get size() { return v.length; },
    push(key, val) { v.push(val); k.push(key); for (let i = v.length - 1; i;) { const p = (i - 1) >> 1; if (v[p] <= v[i]) break; [v[p], v[i]] = [v[i], v[p]]; [k[p], k[i]] = [k[i], k[p]]; i = p; } },
    pop() {
      const key = k[0], val = v[0], lv = v.pop(), lk = k.pop();
      if (v.length) { v[0] = lv; k[0] = lk; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < v.length && v[l] < v[m]) m = l; if (r < v.length && v[r] < v[m]) m = r; if (m === i) break; [v[m], v[i]] = [v[i], v[m]]; [k[m], k[i]] = [k[i], k[m]]; i = m; } }
      return [key, val];
    },
  };
}
const NB8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]];
// The fronts: from every blotch (its disc, once it may leave it) and every lake (its deepest cell),
// each cell taken by whichever front reaches it first; a front moves k P a km through its own kind of
// land, `cross` times slower through others, never into water (and the blue never out of it).
function fronts(fam, n, cell, sources, k) {
  const T = new Float64Array(n * n).fill(Infinity), src = new Int16Array(n * n).fill(-1), q = heap();
  for (const s of sources) for (const c of s.cells) if (s.t < T[c]) { T[c] = s.t; src[c] = s.id; q.push(c, s.t); }
  const famOf = sources.map(s => s.family);
  while (q.size) {
    const [c, t] = q.pop();
    if (t > T[c]) continue;
    const x = c % n, y = (c / n) | 0, f = famOf[src[c]];
    for (const [dx, dy, l] of NB8) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const cc = Y * n + X, g = fam[cc];
      if ((g === FAMILY.water) !== (f === FAMILY.water)) continue;
      const tt = t + k * l * cell * (g === f ? 1 : PAINT.cross);
      if (tt < T[cc]) { T[cc] = tt; src[cc] = src[c]; q.push(cc, tt); }
    }
  }
  return { T, src };
}
// The grid: when the paint reaches each cell (P) and the colour it brings; the speed k chosen so that
// all but the last half percent of the view is painted by cover[1] (and all of it by mold[1]).
export function makeMold(field, splashes, W, H) {
  const n = PAINT.grid, S = TERRAIN.size, cell = S / n, win = paintWindow(W, H), random = rng(PAINT.seed * 3);
  const fam = new Uint8Array(n * n), hue = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = coverAt(field, (i + 0.5) * cell, (j + 0.5) * cell); fam[j * n + i] = c.family; hue[j * n + i] = c.hue; }
  const sources = splashes.map((s, id) => {
    const cells = [], r = Math.ceil(s.R / cell);
    const ci = Math.floor(s.x / cell), cj = Math.floor(s.z / cell);
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= n || j >= n || Math.hypot((i + 0.5) * cell - s.x, (j + 0.5) * cell - s.z) > s.R * 0.85) continue;
      if (fam[j * n + i] === s.family) cells.push(j * n + i);
    }
    if (!cells.length) cells.push(cj * n + ci);
    return { id, cells, t: Math.max(s.t + 0.02, PAINT.mold[0]), family: s.family, colour: s.colour };
  });
  // The lakes: each body of water its own source, from its deepest cell.
  const seen = new Uint8Array(n * n);
  for (let c0 = 0; c0 < n * n; c0++) {
    if (seen[c0] || fam[c0] !== FAMILY.water) continue;
    const st = [c0], body = [];
    seen[c0] = 1;
    while (st.length) {
      const c = st.pop(), x = c % n, y = (c / n) | 0;
      body.push(c);
      for (const [dx, dy] of NB8) { const X = x + dx, Y = y + dy, cc = Y * n + X; if (X < 0 || Y < 0 || X >= n || Y >= n || seen[cc] || fam[cc] !== FAMILY.water) continue; seen[cc] = 1; st.push(cc); }
    }
    let deep = body[0], dmax = -1;
    for (const c of body) { const x = (c % n + 0.5) * cell, y = (((c / n) | 0) + 0.5) * cell, d = sampleDepth(field, x, y); if (d > dmax) { dmax = d; deep = c; } }
    const id = sources.length;
    sources.push({ id, cells: [deep], t: PAINT.lakes[0] + (PAINT.lakes[1] - PAINT.lakes[0]) * random(), family: FAMILY.water, colour: paintColour(FAMILY.water, 0, random()), lake: true });
  }
  // The speed: a few rounds of the secant, so that all but the last half percent of the view's land is
  // painted by cover[1].
  const inView = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = (i + 0.5) * cell, z = (j + 0.5) * cell; if (x > win.x0 && x < win.x1 && z > win.z0 && z < win.z1 && fam[j * n + i] !== FAMILY.water) inView.push(j * n + i); }
  const p97 = k => { const { T } = fronts(fam, n, cell, sources, k); const v = inView.map(c => T[c]).filter(Number.isFinite).sort((a, b) => a - b); return { T: v[Math.floor(v.length * PAINT.cover[0])] ?? PAINT.mold[1] }; };
  const goal = PAINT.cover[1];
  let ka = 0.002, kb = 0.02, fa = p97(ka).T - goal, fb = p97(kb).T - goal;
  for (let it = 0; it < 6 && Math.abs(fb) > 0.002; it++) {
    const kc = Math.max(1e-4, kb - fb * (kb - ka) / (fb - fa || 1e-9));
    ka = kb; fa = fb; kb = kc; fb = p97(kb).T - goal;
  }
  const { T, src } = fronts(fam, n, cell, sources, kb);
  const grid = new Float32Array(n * n * 4);
  for (let c = 0; c < n * n; c++) {
    const s = sources[src[c]], col = s ? s.colour : paintColour(fam[c], hue[c], 0.5);
    grid[c * 4] = Number.isFinite(T[c]) ? Math.min(T[c], PAINT.mold[1] + 0.02) : PAINT.mold[1] + 0.02;
    grid[c * 4 + 1] = col[0]; grid[c * 4 + 2] = col[1]; grid[c * 4 + 3] = col[2];
  }
  return { n, cell, k: kb, grid, fam, sources: sources.length, src, starts: sources.map(q => q.t) };
}
const sampleDepth = (field, x, y) => {
  const N = field.N, g = Math.max(0, Math.min(N - 1, Math.floor(x / field.size * N))), f = Math.max(0, Math.min(N - 1, Math.floor(y / field.size * N))), k = (f * N + g) * 4;
  return field.data[k + 1] - field.data[k];
};

// The plan as float texels (RGBA32F, 256 wide): rows 0..255 the grid (T, r, g, b), row 256 a header
// (count, first, last, k) then three texels a drop: (x, z, t, R), (N, seed, skew, dir), (r, g, b,
// family + hue · 0.9).
export function makePaint(field, W, H, phone) {
  const splashes = makeSplashes(field, W, H, phone).slice(0, PAINT.maxSplash), mold = makeMold(field, splashes, W, H);
  const n = PAINT.grid, data = new Float32Array(n * (n + 1) * 4);
  data.set(mold.grid);
  const row = n * n * 4, [t0, t1] = paintClock(phone);
  data.set([splashes.length, t0, t1, mold.k], row);
  splashes.forEach((s, i) => {
    const o = row + (1 + 3 * i) * 4;
    data.set([s.x, s.z, s.t, s.R, s.N, s.seed, s.skew, s.dir, ...s.colour, s.family + Math.min(0.99, s.hue) * 0.9], o);
  });
  return { w: n, h: n + 1, data, splashes, mold };
}
export const paintKey = (W, H, phone) => `${(W / H).toFixed(2)} ${phone ? 1 : 0}`;
