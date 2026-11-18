// Racing → Outdoors: paint into the White Mountains into art glass. The 48 at their true places and
// heights, the terrain's erosion and its level water, the half floats it travels in; the paint's drops
// and fronts; the camera's flight and the hold's pace; Outdoors' plate, leading and glass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PEAKS48, PEMI, peak, TERRAIN, FT, makeTerrain, makeDetail, sample, toHalf, landform, erode, flood, TARNS, COVER, FAMILY, coverAt, HIKED, makePlate, mipChain } from '../../../static/site/scene/terrain-plan.js';
import { PAINT, makeSplashes, makeMold, makePaint, paintClock, paintHoldP, paintWindow, fingerCount, spreadFactor } from '../../../static/site/scene/paint-plan.js';
import { camera, EXAG, DIVE, FLY, RISE, PEAKS_GLSL } from '../../../static/site/scene/glsl/peaks.js';
import { GLASS, REDS, JEWELS, leadCell, FOLIO } from '../../../static/site/scene/glsl/folio.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const T = makeTerrain({ N: 256, droplets: 90000 });

test('the 48: every four-thousand footer on Outdoors\' list, at its height, inside the map', () => {
  const list = JSON.parse(readFileSync(new URL('../../../outdoors/page/peaks.json', import.meta.url), 'utf8')).peaks;
  assert.equal(PEAKS48.length, 48);
  assert.deepEqual(new Set(PEAKS48.map(p => p.name)), new Set(list.map(p => p.name)));
  for (const p of list) assert.equal(peak(p.name).ft, p.ft, p.name);
  for (const p of PEAKS48) {
    assert.ok(p.ft >= 4000 && p.lat > 43.9 && p.lat < 44.55 && p.lon > -71.9 && p.lon < -71.1, p.name);
    assert.ok(p.p[0] > 4 && p.p[0] < TERRAIN.size - 4 && p.p[1] > 4 && p.p[1] < TERRAIN.size - 4, `${p.name} inside the map`);
  }
  // Their layout: Washington the highest; Mount Washington north-east of Franconia Ridge, the Sandwich
  // Range to the south, Cabot farthest north.
  assert.equal(PEAKS48.reduce((m, p) => p.ft > m.ft ? p : m).name, 'Washington');
  assert.ok(peak('Washington').p[0] > peak('Lafayette').p[0] + 20 && peak('Washington').p[1] > peak('Lafayette').p[1]);
  assert.ok(peak('Whiteface').p[1] < peak('Carrigain').p[1] && peak('Cabot').p[1] === Math.max(...PEAKS48.map(p => p.p[1])));
  // The Pemi Loop's summits are all on the list, round the wilderness.
  for (const n of PEMI) assert.ok(peak(n), n);
});

test('the terrain: each summit at its surveyed height, the highest point near it; ranges joined; the lowland low', () => {
  for (const p of PEAKS48) {
    near(sample(T, p.p[0], p.p[1]) / FT, p.ft, p.ft * 0.012, p.name);
    // Nothing within 400 m stands much higher (a summit is a summit).
    for (let a = 0; a < 8; a++) assert.ok(sample(T, p.p[0] + 0.4 * Math.cos(a), p.p[1] + 0.4 * Math.sin(a)) / FT < p.ft + 120, `${p.name} is a top`);
  }
  // Franconia Ridge holds high between Lincoln and Lafayette (a col, not a valley).
  const a = peak('Lincoln').p, b = peak('Lafayette').p;
  assert.ok(sample(T, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) / FT > 4000, 'the ridge between them');
  // Far from every summit, the land is low.
  assert.ok(sample(T, 2, 2) / FT < 2500 && sample(T, 72, 3) / FT < 2500, 'the corners are low');
});

test('erosion: water gathers into channels; what it takes it mostly lays down again', () => {
  // A valley between two slopes, falling to the south: the water gathers in its floor, and the volume
  // is nearly kept.
  const N = 96, map = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) map[j * N + i] = 0.2 + Math.abs(i - N / 2) * 0.012 + j * 0.004 + 0.002 * Math.sin(i * 0.7 + j * 1.3);
  const before = map.reduce((s, v) => s + v, 0);
  const flow = erode(map, N, 6000, 3);
  const after = map.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(after - before) / before < 0.05, `volume ${before} → ${after}`);
  const sorted = [...flow].sort((x, y) => y - x), total = sorted.reduce((s, v) => s + v, 0);
  const top = sorted.slice(0, Math.round(N * N * 0.05)).reduce((s, v) => s + v, 0);
  assert.ok(top / total > 0.2, `the busiest 5% of cells carry ${(top / total * 100).toFixed(0)}% of the water`);
  // The real field: rivers and lakes are a small part of it.
  let wet = 0;
  for (let k = 0; k < T.N * T.N; k++) if (T.data[k * 4 + 2] > 0.9) wet++;
  assert.ok(wet / (T.N * T.N) < 0.12, `${(wet / T.N / T.N * 100).toFixed(1)}% water`);
});

test('half floats: the texture keeps heights to a few metres', () => {
  const v = new Float32Array([0, 0.3048, 1.9166, 0.5, 1e-5, -0.25, 3.14159]);
  const h = toHalf(v);
  const back = x => { const s = x >> 15 ? -1 : 1, e = (x >> 10) & 31, m = x & 1023; return e === 0 ? s * m * 2 ** -24 : s * (1 + m / 1024) * 2 ** (e - 15); };
  v.forEach((x, i) => near(back(h[i]), x, Math.max(1e-4, Math.abs(x) * 1e-3), `${x}`));
  const d = makeDetail(32, 4);
  for (let k = 0; k < 32; k++) near(d.data[k * 4], d.data[(31 * 32 + k) * 4], 0.35, 'the detail tile repeats');
});

test('water: lakes lie level, held in their hollows; the tarns where they really are; no summit cut', () => {
  // A flood fills every hollow to its spill point: never below the ground, and from every cell water
  // can run off the map without climbing.
  const N = 24, h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = 0.3 + 0.2 * Math.sin(i * 0.7) * Math.cos(j * 0.5) + 0.01 * ((i * 7 + j * 3) % 5);
  const F = flood(h, N);
  for (let k = 0; k < N * N; k++) assert.ok(F[k] >= h[k] - 1e-7);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = j * N + i;
    assert.ok([k - 1, k + 1, k - N, k + N].some(q => F[q] <= F[k] + 1e-7), 'every filled cell drains');
  }
  // In the field, water is level wherever it stands (its level the same at the cells about it), and
  // every tarn holds water within 1.3 km of its real place.
  const t = makeTerrain({ N: 512 }), M = t.N, lev = (i, j) => t.data[(j * M + i) * 4 + 1], dep = (i, j) => lev(i, j) - t.data[(j * M + i) * 4];
  let wet = 0;
  for (let j = 1; j < M - 1; j++) for (let i = 1; i < M - 1; i++) {
    if (dep(i, j) <= 0.0004) continue;
    wet++;
    for (const [a, b] of [[1, 0], [0, 1]]) if (dep(i + a, j + b) > 0.0004) near(lev(i + a, j + b), lev(i, j), 1e-6, 'level');
  }
  assert.ok(wet / (M * M) > 0.005 && wet / (M * M) < 0.04, `${(wet / M / M * 100).toFixed(1)}% water`);
  for (const tn of TARNS) {
    let found = false;
    for (let y = -1.3; y <= 1.3 && !found; y += 0.05) for (let x = -1.3; x <= 1.3 && !found; x += 0.05) if (Math.hypot(x, y) <= 1.3 && sample(t, tn.p[0] + x, tn.p[1] + y, 1) - sample(t, tn.p[0] + x, tn.p[1] + y, 0) > 0.002) found = true;
    assert.ok(found, `${tn.name} holds water`);
  }
  for (const p of PEAKS48) near(sample(t, p.p[0], p.p[1]) / FT, p.ft, p.ft * 0.012, `${p.name} uncut`);
});

test('the land\'s cover: water, white, green and autumn by height, the same numbers in the shader', () => {
  assert.equal(coverAt(T, peak('Washington').p[0], peak('Washington').p[1]).family, FAMILY.white);
  assert.equal(coverAt(T, 2, 2).family, FAMILY.autumn);
  for (const [k, v] of [['PK_WHITE', COVER.white], ['PK_GREEN', COVER.green], ['PK_WET', COVER.wet]]) assert.match(PEAKS_GLSL, new RegExp(`${k} = ${v.toFixed(4).replace('.', '\\.')}`));
  assert.match(PEAKS_GLSL, /int pkCover\(vec4 t\) \{ float ft = t\.r \/ PK_KMFT; return t\.g - t\.r > PK_WET \? 0 : ft > PK_WHITE \? 1 : ft > PK_GREEN \? 2 : 3; \}/);
  // The hue is a field of its own, between yellow and red.
  let lo = 1, hi = 0;
  for (let k = 0; k < T.N * T.N; k++) { lo = Math.min(lo, T.data[k * 4 + 3]); hi = Math.max(hi, T.data[k * 4 + 3]); }
  assert.ok(lo >= 0 && hi <= 1 && hi - lo > 0.6);
});

test('the drops: none before the hold, landing quicker and quicker, each the colour of where it lands, splashing as drops do', () => {
  for (const [W, Hh, phone] of [[1440, 900, false], [390, 844, true], [2560, 1440, false]]) {
    const s = makeSplashes(T, W, Hh, phone), [t0, t1] = paintClock(phone), win = paintWindow(W, Hh);
    assert.ok(t0 >= paintHoldP(phone) + 0.02, 'the hold has begun');
    assert.equal(s.length, phone ? PAINT.phone : PAINT.desk);
    near(s[0].t, t0, 1e-9); near(s.at(-1).t, t1, 1e-9);
    for (let i = 2; i < s.length; i++) assert.ok(s[i].t - s[i - 1].t <= s[i - 1].t - s[i - 2].t + 1e-9, 'quickening');
    for (const d of s) {
      assert.ok(d.x > win.x0 && d.x < win.x1 && d.z > win.z0 && d.z < win.z1, 'in view');
      assert.equal(coverAt(T, d.x, d.z).family, d.family, 'its colour is its land\'s');
      assert.equal(d.N, fingerCount(d.We));
    }
    const fams = new Set(s.map(d => d.family));
    for (const f of [FAMILY.white, FAMILY.green, FAMILY.autumn]) assert.ok(fams.has(f), `family ${f}`);
  }
  // Allen's fingers and Clanet's spread.
  near(fingerCount(48 * 64), 8, 0); near(spreadFactor(16 * 600) / spreadFactor(600), 2, 1e-9);
});

test('the fronts: every cell reached once, from a front of its own kind where it can be, the view painted on time, the lakes last', () => {
  const W = 1440, Hh = 900, s = makeSplashes(T, W, Hh, false), m = makeMold(T, s, W, Hh), n = m.n, win = paintWindow(W, Hh);
  const Tm = k => m.grid[k * 4];
  let inView = 0, late = 0, own = 0, land = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = (i + 0.5) * m.cell, z = (j + 0.5) * m.cell;
    assert.ok(Tm(k) <= PAINT.mold[1] + 0.02 + 1e-6);
    // Fronts move outward: a cell is a source, or a neighbour was reached no later.
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < n && j + b < n).map(([a, b]) => Tm((j + b) * n + i + a));
    assert.ok(nb.some(v => v <= Tm(k) + 1e-6) || Math.abs(Tm(k) - m.starts[m.src[k]]) < 1e-6 || Tm(k) >= PAINT.mold[1] + 0.02 - 1e-6, 'monotone');
    if (x < win.x0 || x > win.x1 || z < win.z0 || z > win.z1) continue;
    if (m.fam[k] === FAMILY.water) { assert.ok(Tm(k) >= PAINT.lakes[0] - 1e-6, 'the lakes last'); continue; }
    inView++;
    if (Tm(k) > PAINT.cover[1] + 1e-6) late++;
    land++;
    if (m.src[k] >= 0 && m.src[k] < s.length && s[m.src[k]].family === m.fam[k]) own++;
  }
  assert.ok(late / inView <= 1 - PAINT.cover[0] + 1e-3, `${late} of ${inView} late`);
  assert.ok(own / land > 0.75, `${(own / land * 100).toFixed(0)}% painted by their own kind`);
  // The plan travels as texels: the grid, then a header and the drops, then which drops can reach each
  // square of the map (glsl/paint.js reads only those): every point within three radii of a drop, and
  // past the map's edges, finds it in its square, as the shader finds the square.
  const plan = makePaint(T, W, Hh, false), row = n * n * 4, C = PAINT.cells;
  assert.equal(plan.w, n); assert.equal(plan.h, n + 1 + Math.ceil(C * C / n));
  assert.equal(plan.data[row], plan.splashes.length);
  near(plan.data[row + 4 + 2], plan.splashes[0].t, 1e-6);
  assert.ok(plan.splashes.every((q, i) => !i || q.t >= plan.splashes[i - 1].t), 'the drops in the order they land');
  const reach = (x, z) => {
    const cx = Math.min(C - 1, Math.max(0, Math.floor(Math.fround(x / TERRAIN.size * C)))), cz = Math.min(C - 1, Math.max(0, Math.floor(Math.fround(z / TERRAIN.size * C))));
    return plan.data.subarray(n * (n + 1) * 4 + (cz * C + cx) * 4, n * (n + 1) * 4 + (cz * C + cx) * 4 + 4);
  };
  const has = (m, i) => Math.floor(m[Math.floor(i / 20)] / 2 ** (i % 20)) % 2 === 1;
  let listed = 0, bits = 0;
  plan.splashes.forEach((q, i) => {
    for (let k = 0; k < 400; k++) {
      const r = 3 * q.R * Math.sqrt((k * 0.618) % 1), a = k * 2.39996, x = q.x + r * Math.cos(a), z = q.z + r * Math.sin(a);
      assert.ok(has(reach(x, z), i), `drop ${i} listed at ${x.toFixed(2)}, ${z.toFixed(2)}`);
    }
    for (const [x, z] of [[-5, q.z], [TERRAIN.size + 5, q.z], [q.x, -5], [q.x, TERRAIN.size + 5]]) if (Math.hypot(Math.min(Math.max(x, 0), TERRAIN.size) - q.x, Math.min(Math.max(z, 0), TERRAIN.size) - q.z) < 3 * q.R) assert.ok(has(reach(x, z), i), 'past the edge');
    listed++;
  });
  for (let k = 0; k < C * C; k++) for (let i = 0; i < plan.splashes.length; i++) bits += has(plan.data.subarray(n * (n + 1) * 4 + k * 4), i) ? 1 : 0;
  assert.equal(listed, plan.splashes.length);
  assert.ok(bits / (C * C) < plan.splashes.length / 8, `a square lists ${(bits / (C * C)).toFixed(1)} drops on average`);
});

test('the camera: over the painting looking down, a dive once the paint is moulding, the flight above the ground, then straight down again', () => {
  const H = (x, z) => landform(x, z) * FT * EXAG;
  assert.ok(DIVE > PAINT.mold[0] && DIVE < PAINT.mold[1], 'the dive begins soon after the moulding');
  for (const P of [-0.2, 0, DIVE - 0.001]) { const [pos, look] = camera(P); near(pos[0], TERRAIN.size / 2, 1e-6); assert.ok(pos[1] > 40 && look[1] < 1); }
  for (const P of [0.96, 1.1, 1.2]) { const [pos, look] = camera(P); assert.ok(pos[1] > 40 && Math.abs(pos[0] - look[0]) < 0.01 && Math.abs(pos[2] - look[2]) < 0.01, 'straight down at the end'); }
  for (let P = FLY; P <= RISE - 0.04; P += 0.01) {
    const [pos, look] = camera(P);
    assert.ok(pos[1] > H(pos[0], pos[2]) + 0.25, `above the ground at P=${P.toFixed(2)}`);
    assert.ok(Math.hypot(look[0] - pos[0], look[2] - pos[2]) > 2, 'looking out, not down, while it flies');
  }
  // Its shots are all from the west of what they look at (the low sun behind the camera).
  for (let P = FLY; P <= RISE - 0.04; P += 0.02) { const [pos, look] = camera(P); assert.ok(look[0] > pos[0], `the sun behind at P=${P.toFixed(2)}`); }
});

test('the shader: the summits, the contours at true heights, the hold\'s pace', async () => {
  assert.match(PEAKS_GLSL, /c200 = abs\(fract\(ft \/ 200\.0 \+ \.5\) - \.5\) \* 200\.0, c1000 = abs\(fract\(ft \/ 1000\.0 \+ \.5\) - \.5\) \* 1000\.0/);
  assert.match(PEAKS_GLSL, /const vec4 PK_48\[48\]/);
  const { HOLD, folioEase, folioRaw, easeFor } = await import('../../../static/site/lerp.js');
  assert.ok(HOLD.by.folio.pin >= 3, 'a long enough hold for paint, flight and glass');
  assert.equal(easeFor('folio'), folioEase);
  let prev = -1;
  for (let r = 0; r <= 1; r += 0.01) { const p = folioEase(r); assert.ok(p >= prev); prev = p; near(folioRaw(-0.2 + 1.4 * p), r, 2e-3); }
  // The leading and the light get the most scroll for their share of P; the flight a little less.
  const per = (a, b) => (folioRaw(b) - folioRaw(a)) / (b - a);
  assert.ok(per(0.94, 1.2) > per(0.44, 0.76) * 1.5);
});

test('Outdoors\' plate: shipped, current, and the heights the land has', () => {
  const plate = makePlate(), file = readFileSync(new URL('../../../static/site/scene/data/plate.bin', import.meta.url));
  assert.equal(Buffer.compare(file, Buffer.from(plate.buffer)), 0, 'node tools/site/plate.mjs');
  const n = Math.sqrt(plate.length), c = TERRAIN.size / n;
  let err = 0, cnt = 0;
  for (let j = 4; j < n - 4; j += 3) for (let i = 4; i < n - 4; i += 3) { err += Math.abs(plate[j * n + i] - sample(T, (i + 0.5) * c, (j + 0.5) * c) / FT); cnt++; }
  assert.ok(err / cnt < 150, `the plate within ${(err / cnt).toFixed(0)} ft of the worn land`);
  // The relief tile's mipmaps: each level the mean of the one above.
  const d = makeDetail(16, 4), mips = mipChain(d.data, d.n);
  assert.equal(mips.length, 5); assert.equal(mips.at(-1).length, 4);
  near(mips.at(-1)[0], d.data.filter((_, k) => k % 4 === 0).reduce((a, b) => a + b, 0) / 256, 1e-5);
});

test('the leading: marching squares on the module, every line square or at 45°; the summits\' red glass in the order climbed', () => {
  const list = JSON.parse(readFileSync(new URL('../../../outdoors/page/peaks.json', import.meta.url), 'utf8')).peaks;
  assert.deepEqual([...HIKED], list.map(p => p.name), 'the order climbed');
  for (let k = 0; k < 400; k++) {
    const v = [0, 1, 2, 3].map(i => 1000 + 4000 * (((k * 7 + i * 13) * 2654435761) % 1000) / 1000), mid = 1000 + 4000 * ((k * 31 % 997) / 997);
    for (const thr of GLASS.bands) for (const [a, b] of leadCell(v, mid, thr).segs) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, q = ((ang % 45) + 45) % 45;
      assert.ok(q < 1e-6 || 45 - q < 1e-6, `${ang}°`);
      for (const p of [a, b]) assert.ok(p.every(x => x === 0 || x === 0.5 || x === 1), 'vertices at corners and midpoints');
    }
  }
  // Every summit is in exactly one red glass; each lights when the first of its summits was climbed.
  for (const p of PEAKS48) {
    const inside = REDS.filter(r => Math.abs(p.p[0] - r.c[0]) <= r.h[0] + GLASS.module * 0.26 && Math.abs(p.p[1] - r.c[1]) <= r.h[1] + GLASS.module * 0.26);
    assert.equal(inside.length, 1, p.name);
    assert.ok(inside[0].order <= HIKED.indexOf(p.name));
  }
  assert.ok(JEWELS.length >= 10, 'the tarns\' jewels');
  for (const t of JEWELS) assert.ok(!REDS.some(r => Math.abs(t.p[0] - r.c[0]) < r.h[0] && Math.abs(t.p[1] - r.c[1]) < r.h[1]));
  assert.match(FOLIO, /vec3 sceneFolio\(vec2 px\)/);
});

test('the click: lead runs from the click round the window\'s came, faster than anything straight out', async () => {
  const { makeLead, plateAt, spanOf, LEAD } = await import('../../../static/site/scene/lead-plan.js');
  const ft = makePlate(), n = Math.sqrt(ft.length), km = Float32Array.from(ft, v => v * FT);
  // The plate as the GPU filters it: exact at its texels' centres.
  for (const [i, j] of [[3, 5], [64, 64], [100, 20]]) near(plateAt(km, n, (i + 0.5) / n * TERRAIN.size, (j + 0.5) / n * TERRAIN.size), km[j * n + i], 1e-6);
  near(spanOf(1440, 900), Math.min(GLASS.top, 1.07 * TERRAIN.size * (900 / 1440) * 0.97) / GLASS.focal, 1e-9);
  for (const [W, Hh, O] of [[1440, 900, [400, 14]], [390, 844, [195, 420]]]) {
    const far = Math.hypot(Math.max(O[0], W - O[0]), Math.max(O[1], Hh - O[1])) * 1.02, L = makeLead(km, n, O, far, W, Hh);
    assert.deepEqual([...L.data.slice(0, 4)], [L.i0, L.j0, L.nx, L.ny]);
    let raced = 0, live = 0;
    for (let k = 0; k < L.T.length; k++) {
      if (!L.live[k]) continue;
      live++;
      const T = L.T[k];
      assert.ok(T >= LEAD.start && Number.isFinite(T));
      // No line offers it sooner (the lead takes the quickest way); reached along one, or straight out.
      const along = Math.min(...L.adj[k].map(([q, len]) => L.T[q] + LEAD.line * len / far));
      assert.ok(T <= along + 1e-9, 'quickest');
      if (Math.abs(T - along) < 1e-9) raced++;
    }
    assert.ok(live > 300, `${live} joints`);
    assert.ok(raced / live > 0.5, `${(raced / live * 100).toFixed(0)}% of the leading reached along it, not straight out`);
    // The texels: dead joints -1, live ones by the last moment.
    for (let c = 0; c < L.nx * L.ny; c++) for (const s of [0, 1]) {
      const v = L.data[((1 + Math.floor(c / L.nx)) * L.w + (c % L.nx)) * 4 + s];
      if (L.live[2 * c + s]) assert.ok(v >= 0 && v <= LEAD.last + 1e-6); else assert.equal(v, -1);
    }
  }
});
