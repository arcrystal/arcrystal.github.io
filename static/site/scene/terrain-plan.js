// The White Mountains (Racing → Outdoors): a heightfield of New Hampshire's 48 four-thousand footers
// at their true places and heights, with their ponds and tarns, built once in terrain-worker.js and read
// by glsl/peaks.js and glsl/folio.js. Deterministic: the same field every time.
//
// What it is made of (the tests check each):
//   The 48 summits at their latitudes and longitudes (projected to km, equirectangular about the
//   region's middle) and their heights (outdoors/page/peaks.json, the Wikipedia list). Each is a
//   massif whose flanks fall away concave, broader the higher it stands; neighbours in a range (within
//   6.5 km) are joined by a ridge that sags to a col between them; the lowland between the ranges rolls
//   at 1,000–1,600 ft. Detail is ridged fractal noise, domain-warped, strongest high up.
//   Running water then carves it: hydraulic erosion by droplets (Beyer 2015, as in Lague's model). Each
//   droplet runs downhill with a little inertia, picks up sediment while it is fast and carrying less
//   than its capacity (∝ slope × speed × water), drops it where it slows or climbs, and evaporates; so
//   gullies and ravines cut into the slopes and the valleys fill. The water's passage is kept as the
//   flow that draws the rivers.
//   Water lies level: the tarns are cut where they really are (a bowl, a lip of moraine below it, a
//   headwall above, as a glacier leaves them) and the lowland's hollows hold ponds; each is filled to a
//   flat surface by a priority flood (Barnes, Lehman & Mulla 2014), so its shore follows the contour.
//   The land's cover (what the paint and the glass read): water; the white of granite, tundra and
//   rime and snow above about 3,900 ft; the green of spruce and fir; the autumn of the hardwoods below
//   about 2,400 ft, whose hue (yellow birch and beech to orange and red maple) is a smooth field of its own.
//   Artistic: the gentle sag of the cols, the lowland's roll, the amount of erosion, the size of the
//   water (drawn larger than life, as the heights are), and the vertical exaggeration.
export const TERRAIN = Object.freeze({ N: 512, size: 74, droplets: 90000 });
// The middle of the region (lat, lon) and km per degree there.
const LAT0 = 44.215, LON0 = -71.485;
const KM_LAT = 110.57, KM_LON = 111.32 * Math.cos(LAT0 * Math.PI / 180);
// km east and north of the region's south-west corner (the map is TERRAIN.size km square).
export const toMap = (lat, lon) => [(lon - LON0) * KM_LON + TERRAIN.size / 2, (lat - LAT0) * KM_LAT + TERRAIN.size / 2];

// The 48: name, latitude, longitude, height (ft).
export const PEAKS48 = Object.freeze([
  ['Washington', 44.2705, -71.3033, 6288], ['Adams', 44.3203, -71.2914, 5774], ['Jefferson', 44.3042, -71.3167, 5712],
  ['Monroe', 44.2550, -71.3214, 5384], ['Madison', 44.3284, -71.2775, 5367], ['Eisenhower', 44.2405, -71.3503, 4780],
  ['Pierce', 44.2273, -71.3656, 4310], ['Jackson', 44.2034, -71.3754, 4052], ['Isolation', 44.2148, -71.3091, 4004],
  ['Lafayette', 44.1608, -71.6444, 5249], ['Lincoln', 44.1486, -71.6447, 5089], ['Liberty', 44.1158, -71.6420, 4459],
  ['Flume', 44.1085, -71.6283, 4328], ['Garfield', 44.1873, -71.6107, 4500], ['Galehead', 44.1854, -71.5732, 4024],
  ['South Twin', 44.1878, -71.5547, 4902], ['North Twin', 44.2023, -71.5583, 4761], ['Bond', 44.1529, -71.5313, 4698],
  ['West Bond', 44.1544, -71.5440, 4540], ['Bondcliff', 44.1414, -71.5410, 4265], ['Zealand', 44.1937, -71.5134, 4260],
  ['Hale', 44.2229, -71.5180, 4054], ['Owl’s Head', 44.1408, -71.6011, 4025], ['Willey', 44.1831, -71.4209, 4285],
  ['Field', 44.1984, -71.4351, 4340], ['Tom', 44.2121, -71.4318, 4051], ['Carrigain', 44.0938, -71.4467, 4700],
  ['Hancock', 44.0813, -71.4890, 4420], ['South Hancock', 44.0705, -71.4836, 4319], ['North Tripyramid', 43.9733, -71.4426, 4180],
  ['Middle Tripyramid', 43.9677, -71.4419, 4140], ['Whiteface', 43.9339, -71.4060, 4020], ['Passaconaway', 43.9545, -71.3786, 4043],
  ['Tecumseh', 43.9661, -71.5568, 4003], ['Osceola', 44.0012, -71.5367, 4340], ['East Osceola', 44.0064, -71.5233, 4156],
  ['Moosilauke', 44.0244, -71.8312, 4802], ['North Kinsman', 44.1342, -71.7353, 4293], ['South Kinsman', 44.1227, -71.7393, 4358],
  ['Cannon', 44.1564, -71.6981, 4100], ['Wildcat', 44.2588, -71.2009, 4422], ['Wildcat D', 44.2464, -71.2226, 4070],
  ['Carter Dome', 44.2672, -71.1789, 4832], ['South Carter', 44.2898, -71.1774, 4430], ['Middle Carter', 44.3027, -71.1689, 4610],
  ['Moriah', 44.3407, -71.1314, 4049], ['Cabot', 44.5054, -71.4093, 4170], ['Waumbek', 44.4338, -71.4120, 4006],
].map(([name, lat, lon, ft]) => Object.freeze({ name, lat, lon, ft, p: toMap(lat, lon) })));
// The Pemi Loop, as the camera flies it: round the Pemigewasset Wilderness from Flume to Bondcliff.
export const PEMI = Object.freeze(['Flume', 'Liberty', 'Lincoln', 'Lafayette', 'Garfield', 'Galehead', 'South Twin', 'Bond', 'Bondcliff']);
export const peak = name => PEAKS48.find(p => p.name === name);
// Ponds and tarns at their real places (approximately), each drawn with radius r km (larger than life).
export const TARNS = Object.freeze([
  ['Lakes of the Clouds', 44.2588, -71.3187, 0.3], ['Star Lake', 44.3255, -71.2830, 0.22], ['Hermit Lake', 44.2595, -71.2877, 0.2],
  ['Spaulding Lake', 44.2917, -71.2958, 0.22], ['Carter Lakes', 44.2593, -71.1953, 0.24], ['Eagle Lake', 44.1608, -71.6585, 0.24],
  ['Kinsman Pond', 44.1335, -71.7415, 0.26], ['Lonesome Lake', 44.1384, -71.7037, 0.42], ['Profile Lake', 44.1660, -71.6845, 0.28],
  ['Echo Lake', 44.1780, -71.6930, 0.38], ['Garfield Pond', 44.1859, -71.6025, 0.2], ['Zealand Pond', 44.2025, -71.4968, 0.28],
  ['Ethan Pond', 44.1801, -71.4186, 0.34], ['Shoal Pond', 44.1561, -71.4642, 0.3], ['Saco Lake', 44.2179, -71.4067, 0.26],
  ['Greeley Ponds', 44.0125, -71.5150, 0.28], ['Russell Pond', 44.0137, -71.6466, 0.4], ['Echo Lake, Conway', 44.0598, -71.1570, 0.45],
  ['Chocorua Lake', 43.9280, -71.2330, 0.55], ['Conway Lake', 43.9800, -71.0600, 1.0],
].map(([name, lat, lon, r]) => Object.freeze({ name, lat, lon, r, p: toMap(lat, lon) })));
// The land's cover by height (ft) and water: the families the paint, the ground and the glass share.
// glsl/peaks.js pkCover is written from these numbers.
export const COVER = Object.freeze({ white: 3900, green: 2400, wet: 0.0004 });
export const FAMILY = Object.freeze({ water: 0, white: 1, green: 2, autumn: 3 });

export const FT = 0.0003048;   // km per foot
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Value noise and its ridged fractal sum (deterministic hashes).
const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const fbm = (x, y, o = 5) => { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * noise(x, y); [x, y] = [1.6 * x - 1.2 * y + 3.1, 1.2 * x + 1.6 * y - 1.7]; a *= 0.5; } return s; };
const ridged = (x, y, o = 6) => { let s = 0, a = 0.5, w = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(2 * noise(x, y) - 1); n *= n * w; w = Math.min(1, n * 2); s += a * n; [x, y] = [1.7 * x - 1.1 * y + 5.3, 1.1 * x + 1.7 * y + 2.9]; a *= 0.5; } return s; };
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

// Neighbours in a range, joined by ridges.
const RIDGES = (() => {
  const out = [];
  for (let i = 0; i < PEAKS48.length; i++) for (let j = i + 1; j < PEAKS48.length; j++) {
    const A = PEAKS48[i], B = PEAKS48[j], L = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1]);
    if (L <= 6.5) out.push([A, B, L]);
  }
  return out;
})();
// The height (ft) at map point (x, y) km before erosion.
export function landform(x, y) {
  // The lowland, and among the big peaks a highland of lesser mountains (ridged noise: a network of
  // ridges and valleys), 1,500–3,500 ft, fading out toward the region's edges.
  const wx = x + 6 * (fbm(x * 0.05, y * 0.05) - 0.5), wy = y + 6 * (fbm(x * 0.05 + 7, y * 0.05 - 3) - 0.5);
  let near = Infinity;
  for (const pk of PEAKS48) near = Math.min(near, Math.hypot(x - pk.p[0], y - pk.p[1]));
  const m = Math.min(1, Math.max(0, (16 - near) / 11));
  const hill = 0.55 * ridged(wx * 0.09, wy * 0.09, 5) + 0.45 * fbm(wx * 0.07 + 11, wy * 0.07 - 4, 4);
  let h = 850 + 450 * fbm(wx * 0.06, wy * 0.06) + Math.pow(hill, 1.25) * (500 + 3000 * m * m * (3 - 2 * m));
  // The massifs: concave flanks, broader the higher.
  for (const pk of PEAKS48) {
    const d = Math.hypot(x - pk.p[0], y - pk.p[1]), s = 1.5 + 0.8 * (pk.ft - 4000) / 1000;
    if (d > s * 5) continue;
    h = smax(h, 1100 + (pk.ft - 1100) * Math.exp(-Math.pow(d / s, 1.3)), 300);
  }
  // Ridges between neighbours, sagging to a col.
  for (const [A, B, L] of RIDGES) {
    const ab = [(B.p[0] - A.p[0]) / L, (B.p[1] - A.p[1]) / L], t = Math.max(0, Math.min(L, (x - A.p[0]) * ab[0] + (y - A.p[1]) * ab[1]));
    const d = Math.hypot(x - A.p[0] - ab[0] * t, y - A.p[1] - ab[1] * t);
    if (d > 6) continue;
    const u = t / L, top = A.ft + (B.ft - A.ft) * u - (260 + 170 * L) * Math.sin(Math.PI * u);
    h = smax(h, 1100 + (top - 1100) * Math.exp(-Math.pow(d / 1.1, 1.3)), 180);
  }
  // Ridged detail, strongest high up (spurs, ravines, knobs), fading out at the summits themselves.
  const hi = Math.min(1, Math.max(0, (h - 1300) / 3500)), keep = 1 - Math.exp(-((near / 0.7) ** 2));
  h += ((ridged(wx * 0.32, wy * 0.32) - 0.42) * (240 + 700 * hi) + (fbm(wx * 1.3, wy * 1.3, 3) - 0.5) * 90) * keep;
  return h;
}

// Hydraulic erosion (Beyer 2015): droplets on a heightmap of N × N cells (heights in units of 6,500
// ft, so the slopes are of order one per cell). Returns the water that passed each cell.
export function erode(map, N, count, seed = 7) {
  const random = rng(seed), flow = new Float32Array(N * N);
  const P = { inertia: 0.05, capacity: 4, minSlope: 0.01, erode: 0.3, deposit: 0.3, evaporate: 0.012, gravity: 4, life: 36, radius: 3 };
  // The erosion brush: weights over a disc of the radius.
  const brushes = [];
  for (let dy = -P.radius; dy <= P.radius; dy++) for (let dx = -P.radius; dx <= P.radius; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < P.radius) brushes.push([dx, dy, 1 - d / P.radius]);
  }
  const wsum = brushes.reduce((s, b) => s + b[2], 0);
  const at = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, k = iy * N + ix;
    const a = map[k], b = map[k + 1], c = map[k + N], d = map[k + N + 1];
    return [a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy, (b - a) * (1 - fy) + (d - c) * fy, (c - a) * (1 - fx) + (d - b) * fx];
  };
  for (let n = 0; n < count; n++) {
    let x = 1 + random() * (N - 3), y = 1 + random() * (N - 3), dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
    for (let life = 0; life < P.life; life++) {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, k = iy * N + ix;
      const [h, gx, gy] = at(x, y);
      dx = dx * P.inertia - gx * (1 - P.inertia); dy = dy * P.inertia - gy * (1 - P.inertia);
      const l = Math.hypot(dx, dy);
      if (l < 1e-9) break;
      dx /= l; dy /= l;
      x += dx; y += dy;
      if (x < 1 || y < 1 || x >= N - 2 || y >= N - 2) break;
      flow[k] += water;
      const dh = at(x, y)[0] - h;
      const cap = Math.max(-dh, P.minSlope) * speed * water * P.capacity;
      if (sed > cap || dh > 0) {
        // Deposit: fill the pit it climbs out of, or drop the excess.
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * P.deposit;
        sed -= amt;
        map[k] += amt * (1 - fx) * (1 - fy); map[k + 1] += amt * fx * (1 - fy); map[k + N] += amt * (1 - fx) * fy; map[k + N + 1] += amt * fx * fy;
      } else {
        // Erode with the brush, never more than the drop in height.
        const amt = Math.min((cap - sed) * P.erode, -dh);
        for (const [bx, by, w] of brushes) {
          const X = ix + bx, Y = iy + by;
          if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
          const kk = Y * N + X, e = Math.min(map[kk], amt * w / wsum);
          map[kk] -= e; sed += e;
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed + dh * P.gravity));
      water *= 1 - P.evaporate;
    }
  }
  return flow;
}
// A box blur of radius r cells, done three times (near a Gaussian).
function blur(src, N, r) {
  let a = src.slice(), b = new Float32Array(N * N);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < N; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * N + Math.min(N - 1, Math.max(0, x))]; for (let x = 0; x < N; x++) { b[y * N + x] = s / (2 * r + 1); s += a[y * N + Math.min(N - 1, x + r + 1)] - a[y * N + Math.max(0, x - r)]; } }
    for (let x = 0; x < N; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(N - 1, Math.max(0, y)) * N + x]; for (let y = 0; y < N; y++) { a[y * N + x] = s / (2 * r + 1); s += b[Math.min(N - 1, y + r + 1) * N + x] - b[Math.max(0, y - r) * N + x]; } }
  }
  return a;
}
// A binary min-heap of cells by height (the priority flood's queue).
function heap() {
  const v = [], k = [];
  return {
    get size() { return v.length; },
    push(key, val) {
      v.push(val); k.push(key);
      for (let i = v.length - 1; i;) { const p = (i - 1) >> 1; if (v[p] <= v[i]) break; [v[p], v[i]] = [v[i], v[p]]; [k[p], k[i]] = [k[i], k[p]]; i = p; }
    },
    pop() {
      const key = k[0], lv = v.pop(), lk = k.pop();
      if (v.length) {
        v[0] = lv; k[0] = lk;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < v.length && v[l] < v[m]) m = l;
          if (r < v.length && v[r] < v[m]) m = r;
          if (m === i) break;
          [v[m], v[i]] = [v[i], v[m]]; [k[m], k[i]] = [k[i], k[m]]; i = m;
        }
      }
      return key;
    },
  };
}
const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Where no water stands, its level is this far below the ground (km).
export const DRY = 0.05;
// Priority flood (Barnes et al. 2014): the level water would stand at in every cell, filling each
// hollow to its spill point from the map's edge inward.
export function flood(h, N) {
  const filled = h.slice(), seen = new Uint8Array(N * N), q = heap();
  for (let i = 0; i < N; i++) for (const k of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (!seen[k]) { seen[k] = 1; q.push(k, h[k]); }
  while (q.size) {
    const k = q.pop(), x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of NB4) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const kk = Y * N + X;
      if (seen[kk]) continue;
      seen[kk] = 1; filled[kk] = Math.max(h[kk], filled[k]); q.push(kk, filled[kk]);
    }
  }
  return filled;
}
// Water from a cell at its hollow's bottom, rising until it covers `area` cells or reaches `top` (km):
// the cells it covers and its level (a flood from the bottom, lowest neighbour first).
function pond(h, N, start, area, top, mask) {
  const seen = new Uint8Array(N * N), q = heap(), cells = [];
  let level = h[start];
  seen[start] = 1; q.push(start, h[start]);
  while (q.size && cells.length < area) {
    const k = q.pop();
    if (h[k] > top) break;
    level = Math.max(level, h[k]); cells.push(k);
    const x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of NB4) {
      const X = x + dx, Y = y + dy, kk = Y * N + X;
      if (X < 1 || Y < 1 || X >= N - 1 || Y >= N - 1 || seen[kk] || (mask && !mask[kk])) continue;
      seen[kk] = 1; q.push(kk, h[kk]);
    }
  }
  // Keep the cells under the level (a cell added last may stand on the rim), connected to the start.
  return { level, cells: cells.filter(k => h[k] < level || k === start) };
}
// The autumn's hue over the hardwoods, 0 yellow (birch, beech) to 1 red (maple): stands a few km across,
// redder low and wet (red maple swamps), yellower high (the northern hardwoods).
export function autumnAt(x, y, ft = 1500) {
  const v = 0.5 + 1.7 * (fbm(x * 0.17 + 40, y * 0.17 - 12, 4) - 0.5) + 0.7 * (fbm(x * 0.8 - 5, y * 0.8 + 9, 3) - 0.5) - (ft - 1500) / 4000;
  return Math.min(1, Math.max(0, v));
}
// The field: per cell (row 0 the south edge) the height (km); the level water stands at (km; DRY below
// the ground where it stands nowhere); the water's flow (0..1, log); the autumn's hue.
export function makeTerrain({ N = TERRAIN.N, droplets = TERRAIN.droplets } = {}) {
  const S = TERRAIN.size, cell = S / N, U = 6500;
  const map = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) map[j * N + i] = landform((i + 0.5) * cell, (j + 0.5) * cell) / U;
  const flowRaw = erode(map, N, Math.round(droplets * (N / 512) ** 2));
  const h = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) h[k] = map[k] * U * FT;
  // Each summit back to its surveyed height (the water wears a little off): a gentle correction about it.
  const at = (x, y) => { const g = Math.max(0, Math.min(N - 1.001, x / cell - 0.5)), f = Math.max(0, Math.min(N - 1.001, y / cell - 0.5)), i = Math.floor(g), j = Math.floor(f), u = g - i, v = f - j, k = j * N + i; return h[k] * (1 - u) * (1 - v) + h[k + 1] * u * (1 - v) + h[k + N] * (1 - u) * v + h[k + N + 1] * u * v; };
  for (let pass = 0; pass < 3; pass++) {
    const fix = PEAKS48.map(pk => [pk, pk.ft * FT - at(pk.p[0], pk.p[1])]);
    for (const [pk, dh] of fix) {
      const r = Math.ceil(2.4 / cell), ci = Math.floor(pk.p[0] / cell), cj = Math.floor(pk.p[1] / cell);
      for (let j = Math.max(0, cj - r); j <= Math.min(N - 1, cj + r); j++) for (let i = Math.max(0, ci - r); i <= Math.min(N - 1, ci + r); i++) {
        const d = Math.hypot((i + 0.5) * cell - pk.p[0], (j + 0.5) * cell - pk.p[1]);
        h[j * N + i] += dh * Math.exp(-((d / 0.8) ** 2));
      }
    }
  }
  // The tarns, cut as a glacier leaves them: the level a little below the ground there (between it and
  // the lowest ground near), a bowl beneath, and round it the ground drawn toward a rim just above the
  // level that steepens away from the water: a lip of moraine downhill, a headwall uphill. Each holds
  // water to its level as far as its lip (a fill from its middle through the ground below the level).
  const depth = new Float32Array(N * N), cut = [];
  for (const t of TARNS) {
    // Where it sits: the flattest bench within a kilometre of its place (the least relief over the
    // water's reach), as tarns sit on the benches glaciers left.
    const R = Math.max(t.r, 1.6 * cell), reach = Math.ceil(R * 1.6 / cell), look = Math.ceil(0.9 / cell);
    const ri = Math.floor(t.p[0] / cell), rj = Math.floor(t.p[1] / cell);
    let best = Infinity, ci = ri, cj = rj;
    for (let j = rj - look; j <= rj + look; j += 2) for (let i = ri - look; i <= ri + look; i += 2) {
      if (i - reach < 1 || j - reach < 1 || i + reach > N - 2 || j + reach > N - 2) continue;
      // (Never where cutting it would touch a summit.)
      if (PEAKS48.some(pk => Math.hypot((i + 0.5) * cell - pk.p[0], (j + 0.5) * cell - pk.p[1]) < R + 1.3)) continue;
      let lo = Infinity, hi = -Infinity;
      for (let y = -reach; y <= reach; y += 2) for (let x = -reach; x <= reach; x += 2) if (x * x + y * y <= reach * reach) { const v = h[(j + y) * N + i + x]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const score = hi - lo + 0.04 * Math.hypot(i - ri, j - rj) * cell;
      if (score < best) { best = score; ci = i; cj = j; }
    }
    if (best === Infinity) continue;
    // Its level: no higher than the lowest ground round its shore, so the water is held without a dam;
    // the ground above that is cut back, more gently the more there is to cut.
    const cx = (ci + 0.5) * cell, cy = (cj + 0.5) * cell;
    let ringLow = Infinity, top = -Infinity;
    for (let y = -reach; y <= reach; y++) for (let x = -reach; x <= reach; x++) {
      const d = Math.hypot(x, y) * cell, v = h[(cj + y) * N + ci + x];
      if (d >= R && d <= R * 1.6) ringLow = Math.min(ringLow, v);
      if (d <= R * 1.6) top = Math.max(top, v);
    }
    const L = Math.min(h[cj * N + ci], ringLow) - 0.002, D = 0.012 + 0.02 * R;
    const R2 = R + Math.min(0.5, Math.max(0.35, (top - L) / 0.3)), r = Math.ceil(R2 / cell) + 1;
    for (let j = Math.max(1, cj - r); j <= Math.min(N - 2, cj + r); j++) for (let i = Math.max(1, ci - r); i <= Math.min(N - 2, ci + r); i++) {
      const k = j * N + i, d = Math.hypot((i + 0.5) * cell - cx, (j + 0.5) * cell - cy);
      // A little irregular, as real shores are.
      const wob = R * (0.8 + 0.4 * fbm(i * 0.35 + cx, j * 0.35 - cy, 2));
      if (d < wob) { h[k] = Math.min(h[k], L - D * (1 - (d / wob) ** 2) - 0.001); continue; }
      if (d > R2) continue;
      const w = 1 - Math.min(1, (d - wob) / (R2 - wob)), rim = L + 0.003 + (d - wob) * 0.3;
      h[k] = h[k] + (Math.min(Math.max(h[k], Math.min(L + 0.003, h[k] + 0.004)), rim) - h[k]) * (w * w * (3 - 2 * w));
    }
    cut.push([cj * N + ci, L, R2]);
  }
  for (const [k0, L, R2] of cut) {
    const st = [k0], x0 = k0 % N, y0 = (k0 / N) | 0;
    depth[k0] = Math.max(depth[k0], L - h[k0]);
    while (st.length) {
      const k = st.pop(), x = k % N, y = (k / N) | 0;
      for (const [dx, dy] of NB4) {
        const X = x + dx, Y = y + dy, kk = Y * N + X;
        if (depth[kk] > 0 || h[kk] >= L || Math.hypot(X - x0, Y - y0) * cell > R2) continue;
        depth[kk] = L - h[kk]; st.push(kk);
      }
    }
  }
  // Then a pond in each of the lowland's bigger hollows, at its bottom.
  const filled = flood(h, N);
  const basins = [], seen = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) {
    if (seen[k] || filled[k] - h[k] < 1e-5) continue;
    let area = 0, low = k, wet = false;
    const st = [k];
    seen[k] = 1;
    while (st.length) {
      const c = st.pop(), x = c % N, y = (c / N) | 0;
      area++;
      if (h[c] < h[low]) low = c;
      if (depth[c] > 0) wet = true;
      for (const [dx, dy] of NB4) {
        const X = x + dx, Y = y + dy, kk = Y * N + X;
        if (X < 0 || Y < 0 || X >= N || Y >= N || seen[kk] || filled[kk] - h[kk] < 1e-5) continue;
        seen[kk] = 1; st.push(kk);
      }
    }
    const deep = (filled[low] - h[low]) / FT;
    if (!wet && deep > 20 && area > 30 * (N / 512) ** 2) basins.push({ low, area, top: filled[low] });
  }
  basins.sort((a, b) => b.area - a.area);
  const rand = rng(23);
  for (const b of basins.slice(0, 30)) {
    const want = Math.round(Math.min(240, Math.max(24, b.area * 0.09)) * (0.5 + rand()) * (N / 512) ** 2);
    const { level, cells } = pond(h, N, b.low, want, b.top, null);
    // Its bed shelving down from the shore (each ring of cells in from it a metre and a half deeper).
    const ring = new Map(cells.map(c => [c, 0]));
    let edge = cells.filter(c => NB4.some(([dx, dy]) => !ring.has(c + dx + dy * N)));
    for (let r = 1; edge.length && r <= 5; r++) {
      for (const c of edge) ring.set(c, r);
      edge = cells.filter(c => !ring.get(c) && NB4.some(([dx, dy]) => ring.get(c + dx + dy * N) === r));
    }
    for (const c of cells) { h[c] = Math.min(h[c], level - 0.0006 - 0.0015 * ((ring.get(c) || 6) - 1)); depth[c] = level - h[c]; }
  }
  // The level water stands at: each lake's own level on its cells and the ring of cells round them (so
  // that, filtered, it is the same flat level wherever the shore is), elsewhere well below the ground.
  const level = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) level[k] = depth[k] > 0.0002 ? h[k] + depth[k] : h[k] - DRY;
  for (let k = 0; k < N * N; k++) {
    if (depth[k] > 0.0002) continue;
    const x = k % N, y = (k / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, kk = Y * N + X;
      if (X < 0 || Y < 0 || X >= N || Y >= N || depth[kk] <= 0.0002) continue;
      level[k] = Math.max(level[k], h[kk] + depth[kk]);
    }
  }
  const fl = blur(flowRaw, N, 1);
  let fmax = 0;
  for (const v of fl) fmax = Math.max(fmax, v);
  const out = new Float32Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const x = (k % N + 0.5) * cell, y = (((k / N) | 0) + 0.5) * cell;
    out[k * 4] = h[k];
    out[k * 4 + 1] = level[k];
    out[k * 4 + 2] = Math.log1p(fl[k]) / Math.log1p(fmax);
    out[k * 4 + 3] = autumnAt(x, y, h[k] / FT);
  }
  return { N, size: S, data: out };
}
// The order the 48 were climbed in (outdoors/page/peaks.json, the skyline's order; the tests check).
export const HIKED = Object.freeze(["Lafayette", "Lincoln", "Flume", "Garfield", "Liberty", "South Twin", "Bond", "West Bond", "Bondcliff", "Galehead", "North Tripyramid", "Middle Tripyramid", "Whiteface", "Passaconaway", "Hale", "Tom", "Field", "Willey", "Hancock", "South Hancock", "Carter Dome", "Middle Carter", "South Carter", "Wildcat", "Wildcat D", "Osceola", "East Osceola", "North Twin", "Zealand", "Cannon", "South Kinsman", "North Kinsman", "Moosilauke", "Waumbek", "Owl’s Head", "Isolation", "Cabot", "Moriah", "Carrigain", "Tecumseh", "Washington", "Adams", "Jefferson", "Monroe", "Madison", "Eisenhower", "Pierce", "Jackson"]);
// The plate (Outdoors' world, glsl/folio.js, reads it at rest): the land's height (ft) on a coarse
// n × n grid of cell centres, before the water has worn it (landform), so it can be shipped small
// (static/site/scene/data/plate.bin, made by tools/site/plate.mjs) and drawn the moment a page opens.
export const PLATE = Object.freeze({ n: 128 });
export function makePlate(n = PLATE.n) {
  const out = new Uint16Array(n * n), c = TERRAIN.size / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[j * n + i] = Math.max(0, Math.min(65535, Math.round(landform((i + 0.5) * c, (j + 0.5) * c))));
  return out;
}
// The cover at map point (x, y) km: water, white, green or autumn (FAMILY), and the autumn's hue.
// glsl/peaks.js pkCover does the same with the same numbers.
export function coverAt(t, x, y) {
  const h = sample(t, x, y, 0), ft = h / FT, water = sample(t, x, y, 1) - h;
  const family = water > COVER.wet ? FAMILY.water : ft > COVER.white ? FAMILY.white : ft > COVER.green ? FAMILY.green : FAMILY.autumn;
  return { family, hue: sample(t, x, y, 3), ft };
}
// Fine relief for close views (glsl/peaks.js): a tile of ridged noise, periodic so it repeats without a
// seam, sampled at a few scales over the big field: crags, spurs and gullies smaller than its cells.
export function makeDetail(n = 256, period = 16) {
  const out = new Float32Array(n * n * 4);
  const pn = (x, y, p) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const m = (a, b) => ((a % b) + b) % b, h = (i, j) => hash(m(i, p) + 101, m(j, p) + 37);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0, a = 0.5, w = 1, f = 1, smooth = 0;
    for (let o = 0; o < 5; o++) {
      const x = i / n * period * f, y = j / n * period * f;
      let r = 1 - Math.abs(2 * pn(x, y, period * f) - 1);
      r *= r * w; w = Math.min(1, r * 2);
      s += a * r; smooth += a * pn(x + 17, y + 5, period * f);
      a *= 0.5; f *= 2;
    }
    const k = (j * n + i) * 4;
    out[k] = s * 2 - 0.9; out[k + 1] = smooth * 2 - 1; out[k + 2] = 0; out[k + 3] = 0;
  }
  return { n, data: out };
}
// A repeating RGBA tile's mipmaps (each level the 2 × 2 mean of the one above, wrapping), from n × n
// down to 1 × 1, so it can be drawn far off without shimmering.
export function mipChain(data, n) {
  const out = [data];
  for (let m = n >> 1, src = data, s = n; m >= 1; s = m, m >>= 1) {
    const d = new Float32Array(m * m * 4);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) for (let c = 0; c < 4; c++) {
      const a = (x, y) => src[(((y % s) * s) + (x % s)) * 4 + c];
      d[(j * m + i) * 4 + c] = 0.25 * (a(2 * i, 2 * j) + a(2 * i + 1, 2 * j) + a(2 * i, 2 * j + 1) + a(2 * i + 1, 2 * j + 1));
    }
    out.push(d); src = d;
  }
  return out;
}
// Bilinear lookup in the field (map km), channel c.
export function sample(t, x, y, c = 0) {
  const N = t.N, g = Math.max(0, Math.min(N - 1.001, x / t.size * N - 0.5)), f = Math.max(0, Math.min(N - 1.001, y / t.size * N - 0.5));
  const i = Math.floor(g), j = Math.floor(f), u = g - i, v = f - j, d = t.data, k = (j * N + i) * 4 + c;
  return d[k] * (1 - u) * (1 - v) + d[k + 4] * u * (1 - v) + d[k + N * 4] * (1 - u) * v + d[k + N * 4 + 4] * u * v;
}
// IEEE half floats, for an RGBA16F texture.
export function toHalf(src) {
  const out = new Uint16Array(src.length), f = new Float32Array(1), u = new Uint32Array(f.buffer);
  for (let i = 0; i < src.length; i++) {
    f[0] = src[i];
    const x = u[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
    out[i] = e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | (m >>> 13);
  }
  return out;
}
