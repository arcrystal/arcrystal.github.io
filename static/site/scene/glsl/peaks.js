// Racing → Outdoors: paint into the White Mountains into art glass. Racing's ice settles into a canvas
// seen from straight above; thick paint lands on it and molds itself into the painted map of the region
// (glsl/paint.js, paint-plan.js); the painting rises into the land as the camera dives, and flies the
// Pemi Loop round the Pemigewasset Wilderness to the Presidential Range in an October afternoon; then it
// rises to look straight down: the contour lines draw themselves in, low to high, the summits are
// marked, the land settles flat into its map, and the map is leaded into Outdoors' art-glass window
// (glsl/folio.js) as the last light passes through it. A pure function of the screen point and P,
// raymarched against the heightfield terrain-plan.js builds (uTerrain: height, the level water stands
// at, flow, the autumn's hue).
//   Physical: the summits' places and heights; the terrain's erosion and its level water; the forest's
//   crowns, the treeline, rock and the first snow; sunlight with soft shadows, sky light and aerial
//   perspective; lakes by depth and Fresnel, mirroring the mountains; contour lines at true heights.
//   Artistic: the vertical exaggeration, the pace, the season, the camera.
import { PEAKS48, PEMI, peak, landform, FT, TERRAIN, COVER } from '../terrain-plan.js';
import { PAINT } from '../paint-plan.js';
import { PAINT_GLSL } from './paint.js';
const f = x => Number(x).toFixed(4);
// How much taller than life it is drawn.
export const EXAG = 2.0;
const S = TERRAIN.size;
// The camera: keyframes every .02 of P from −.2 to 1.2, position and where it looks (km; x east, y up,
// z north), so the shader only interpolates.
const H = (x, z) => landform(x, z) * FT * EXAG;
const pemi = PEMI.map(n => peak(n).p), mid = pemi.reduce((a, p) => [a[0] + p[0] / pemi.length, a[1] + p[1] / pemi.length], [0, 0]);
// The path: inside the loop, 1.5 km in from each summit toward the wilderness, a little below the
// ridge's crest, so the ridge stands beside and ahead.
const path = pemi.map((p, k) => {
  const d = [mid[0] - p[0], mid[1] - p[1]], l = Math.hypot(...d), o = [p[0] + d[0] / l * 1.5, p[1] + d[1] / l * 1.5];
  let top = 0;
  for (let a = 0; a < 12; a++) for (const r of [0, 0.5]) top = Math.max(top, H(o[0] + r * Math.cos(a / 2), o[1] + r * Math.sin(a / 2)));
  return [o[0], Math.max(top + 0.35, peak(PEMI[k]).ft * FT * EXAG - 0.25), o[1]];
});
const cr = (p0, p1, p2, p3, t) => p1.map((_, i) => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t * t * t));
const spline = pts => s => {
  const n = pts.length - 1;
  if (s > 1) { const a = spline(pts)(1), b = spline(pts)(0.97); return a.map((v, i) => v + (v - b[i]) * (s - 1) / 0.03); }
  const x = Math.max(s, 0) * n, i = Math.min(n - 1, Math.floor(x));
  return cr(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n, i + 2)], x - i);
};
// The camera flies the outside of the loop; it looks along the ridge at the summits a stretch ahead.
const along = spline(path);
const ridge = spline(PEMI.map(n => { const pk = peak(n); return [pk.p[0], pk.ft * FT * EXAG - 0.15, pk.p[1]]; }));
const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const mixv = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const C = [S / 2, S / 2];
// Its shots, all from the west so the low sun is behind it and the slopes are lit: over the valley
// south-west of Franconia Ridge looking up at Lincoln and Lafayette; across Franconia Notch at the
// ridge; past Lafayette's north shoulder along the Garfield Ridge to the Twins; over Garfield across the
// Pemigewasset Wilderness to the Bonds; then turning east to the Presidential Range in the last
// light, rising.
const SHOTS = [
  [[19.5, 2.3, 22.0], [24.4, 2.9, 30.0]],
  [[21.2, 2.75, 27.2], [24.4, 3.0, 31.4]],
  [[22.6, 3.55, 34.0], [30.2, 2.4, 33.6]],
  [[26.8, 3.75, 36.8], [32.8, 2.3, 29.4]],
  [[29.0, 5.4, 33.0], [51.5, 3.4, 43.1]],
];
const shot = (k, s) => spline(SHOTS.map(w => w[k]))(s);
// When it moves: over the whole region looking down while the paint lands and molds (to DIVE), a dive
// to the first shot (to FLY), the shots (to RISE), then up to look straight down again (by .94).
export const DIVE = 0.16, FLY = 0.42, RISE = 0.76;
export function camera(P) {
  const top = [C[0], 62, C[1]], down = [C[0], 0, C[1] + 0.001];
  const start = shot(0, 0), look0 = shot(1, 0);
  // Over the whole region, looking down; then a long dive to the first shot.
  if (P < FLY) {
    const e = sm((P - DIVE) / (FLY - DIVE)), arc = Math.pow(e, 0.55);
    const pos = [top[0] + (start[0] - top[0]) * e, top[1] + (start[1] - top[1]) * arc, top[2] + (start[2] - top[2]) * e];
    return [pos, mixv(down, look0, sm((P - DIVE - 0.06) / (FLY - DIVE - 0.06)))];
  }
  // The shots, one into the next.
  if (P < RISE) { const u = (P - FLY) / (RISE - FLY), s = sm(u) * 0.7 + u * 0.3; return [shot(0, s), shot(1, s)]; }
  // Up, turning to look straight down on the whole region.
  const e = sm((P - RISE) / (0.94 - RISE)), end = shot(0, 1), endLook = shot(1, 1);
  const pos = [end[0] + (top[0] - end[0]) * e, end[1] + (top[1] - end[1]) * Math.pow(e, 2.2), end[2] + (top[2] - end[2]) * e];
  return [pos, mixv(endLook, down, sm((P - RISE - 0.06) / 0.11))];
}
const KEYS = Array.from({ length: 71 }, (_, k) => camera(-0.2 + k * 0.02));
const v3 = a => `vec3(${a.map(f).join(', ')})`;
export const PEAKS_GLSL = /* glsl */ `
uniform sampler2D uTerrain;
uniform sampler2D uTerrainDetail;
const float PK_SIZE = ${f(S)}, PK_EX = ${f(EXAG)}, PK_FT = ${f(FT * EXAG)}, PK_KMFT = ${f(FT)};
const vec3 PK_CAM[71] = vec3[71](${KEYS.map(k => v3(k[0])).join(', ')});
const vec3 PK_LOOK[71] = vec3[71](${KEYS.map(k => v3(k[1])).join(', ')});
const vec4 PK_48[48] = vec4[48](${PEAKS48.map(p => `vec4(${f(p.p[0])}, ${f(p.p[1])}, ${f(p.ft)}, 0.0)`).join(', ')});
const vec2 PK_PEMI[${pemi.length}] = vec2[${pemi.length}](${pemi.map(p => `vec2(${f(p[0])}, ${f(p[1])})`).join(', ')});
// The camera at P: Catmull–Rom through the keyframes.
vec3 pkKey(bool look, float P) {
  float x = clamp((P + .2) / .02, 0.0, 69.999);
  int i = int(floor(x));
  float t = x - float(i);
  vec3 p0 = look ? PK_LOOK[max(i - 1, 0)] : PK_CAM[max(i - 1, 0)], p1 = look ? PK_LOOK[i] : PK_CAM[i];
  vec3 p2 = look ? PK_LOOK[i + 1] : PK_CAM[i + 1], p3 = look ? PK_LOOK[min(i + 2, 70)] : PK_CAM[min(i + 2, 70)];
  return .5 * (2.0 * p1 + (p2 - p0) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t + (3.0 * p1 - p0 - 3.0 * p2 + p3) * t * t * t);
}
// The field (terrain-plan.js): r the height (km), g the level water stands at, b the flow, a the
// autumn's hue. The land rises from flat as the heave comes, with fine relief (the detail tile) where
// it is mountainous; water lies level over it.
// gPkFp: km a pixel spans where the surface is being sampled (the detail tile's mipmap level).
float gPkHeave = 1.0, gPkRelief = 1.0, gPkFp = .001, gPkFpk = .001;
const float PK_HEAVE0 = ${f(PAINT.heave[0])}, PK_HEAVE1 = ${f(PAINT.heave[1])};
vec4 pkT(vec2 xz) { return textureLod(uTerrain, xz / PK_SIZE, 0.0); }
vec4 pkDT(vec2 xz, float s, float fp) { return textureLod(uTerrainDetail, xz / s, log2(max(fp * 256.0 / s, 1.0))); }
float pkD(vec2 xz, float s) { vec4 d = pkDT(xz, s, gPkFp); return d.r * .5 + d.g * .5; }
float pkMtn(float h) { return .12 + .88 * smoothstep(.4, 1.1, h); }
// The surface (drawn km): the ground or the water over it (water: how deep, drawn km; < 0 dry).
// fine: the second, finer scale of relief too (for normals and close views).
float pkSurf(vec2 xz, out float water, bool fine) {
  vec4 t = pkT(xz);
  float d = pkD(xz, 2.4) * .11;
  if (fine) d += pkD(xz, .55) * .022;
  float g = (t.r * PK_EX + pkMtn(t.r) * d) * gPkHeave, l = t.g * PK_EX * gPkHeave;
  water = l - g;
  return max(g, l);
}
float pkSurf(vec2 xz) { float w; return pkSurf(xz, w, false); }
float pkSurfF(vec2 xz) { float w; return pkSurf(xz, w, true); }
// The land's normal at a point a distance t off: the field's slope taken over a texel (so its cells
// do not show as facets), the fine relief's over a few pixels.
vec3 pkNormal(vec2 xz, float t) {
  float e1 = .085, e2 = .012 + t * .0009;
  vec4 c = pkT(xz);
  float gx = (pkT(xz + vec2(e1, 0.0)).r - pkT(xz - vec2(e1, 0.0)).r) * PK_EX / (2.0 * e1);
  float gz = (pkT(xz + vec2(0.0, e1)).r - pkT(xz - vec2(0.0, e1)).r) * PK_EX / (2.0 * e1);
  float m = t < 5.0 ? 1.0 : 0.0;
  float dx = (pkD(xz + vec2(e2, 0.0), 2.4) * .11 + pkD(xz + vec2(e2, 0.0), .55) * .022 * m) - (pkD(xz - vec2(e2, 0.0), 2.4) * .11 + pkD(xz - vec2(e2, 0.0), .55) * .022 * m);
  float dz = (pkD(xz + vec2(0.0, e2), 2.4) * .11 + pkD(xz + vec2(0.0, e2), .55) * .022 * m) - (pkD(xz - vec2(0.0, e2), 2.4) * .11 + pkD(xz - vec2(0.0, e2), .55) * .022 * m);
  vec2 g = (vec2(gx, gz) + pkMtn(c.r) * vec2(dx, dz) / (2.0 * e2)) * gPkRelief;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
// The land's cover (terrain-plan.js coverAt, the same numbers): 0 water, 1 white, 2 green, 3 autumn.
const float PK_WHITE = ${f(COVER.white)}, PK_GREEN = ${f(COVER.green)}, PK_WET = ${f(COVER.wet)};
int pkCover(vec4 t) { float ft = t.r / PK_KMFT; return t.g - t.r > PK_WET ? 0 : ft > PK_WHITE ? 1 : ft > PK_GREEN ? 2 : 3; }
// The light: the studio's, from the upper left (north-west), while the paint lands; as the painting
// rises it becomes the sun, coming round to the west-south-west and sinking toward evening by the end
// of the flight, a late afternoon in October (set per P by groundPeaks).
vec3 PK_SUN = vec3(-.78, .3, -.5) / 0.97391;
vec3 pkSunAt(float P) {
  float az = mix(2.3562, 3.73, smoothstep(.12, .5, P)), el = mix(.625, .2, smoothstep(.22, .74, P));
  return vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
}
vec3 pkSky(vec3 rd) {
  float s = max(dot(rd, PK_SUN), 0.0), h = max(rd.y, 0.0);
  vec3 c = mix(mix(vec3(.82, .8, .82), vec3(1.0, .76, .52), pow(s, 2.0)), vec3(.16, .34, .7), pow(h, .5));
  c += vec3(1.0, .66, .36) * pow(s, 6.0) * .6 + vec3(1.0, .92, .75) * pow(s, 900.0) * 10.0;
  return c;
}
// A cell of trees or stones sp km apart about xz: xy the offset from its middle (in cells), z its id
// (0..1), w a second random.
vec4 pkCell(vec2 p) {
  vec2 n = floor(p), f = fract(p), o = vec2(0.0), c = vec2(0.0);
  float d1 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)), r = g + .15 + .7 * hash2(n + g) - f;
    float d = dot(r, r);
    if (d < d1) { d1 = d; o = -r; c = n + g; }
  }
  return vec4(o, hash(c + 17.31), hash(c - 4.7));
}
// The hardwoods in October: red maple, sugar maple's orange, the gold of birch and aspen, beech's
// bronze, oak's russet, a few still green; hue 0 yellow to 1 red (the field), r a random.
vec3 pkLeaf(float hue, float r) {
  float red = .1 + .5 * hue, orange = .26, gold = .44 - .32 * hue;
  r *= red + orange + gold + .2;
  if (r < red) return mix(vec3(.36, .035, .025), vec3(.55, .07, .035), fract(r * 37.0));
  r -= red;
  if (r < orange) return mix(vec3(.6, .16, .025), vec3(.7, .26, .04), fract(r * 41.0));
  r -= orange;
  if (r < gold) return mix(vec3(.55, .36, .045), vec3(.68, .5, .08), fract(r * 43.0));
  r -= gold;
  return r < .1 ? vec3(.36, .2, .06) : r < .16 ? vec3(.24, .1, .04) : vec3(.12, .16, .045);
}
vec3 pkLeafAvg(float hue) { return mix(vec3(.55, .3, .06), vec3(.5, .13, .045), hue); }
const vec3 PK_SPRUCE = vec3(.016, .04, .032), PK_FIR = vec3(.024, .054, .04), PK_HEMLOCK = vec3(.022, .05, .032);
const vec3 PK_SNOW = vec3(.82, .85, .9), PK_GRANITE = vec3(.37, .35, .32), PK_SEDGE = vec3(.34, .25, .1);
// The ground at a point: its colour (linear) and the normal it is lit by (a crown's dome where trees
// stand near). n: the land's normal; fp: km a pixel spans there (the detail fades as it shrinks below
// a few pixels); near: whether to draw single trees and stones at all.
vec3 pkLand(vec2 xz, vec3 n, vec4 t, float fp, bool near, out vec3 nl) {
  nl = n;
  float ft = t.r / PK_KMFT, slope = 1.0 - n.y;
  vec4 D1 = pkDT(xz, 1.1, fp), D0 = pkDT(xz, .17, fp);
  float d2 = D1.g, dd = D0.g;
  // Zones: the hardwoods below about 2,400 ft, spruce and fir above with birch among them, krummholz
  // at the treeline (about 4,400 ft), alpine tundra and granite above, and October's first snow and
  // rime from about 3,900 ft.
  float hw = ${f(COVER.green)} + 380.0 * d2, tl = 4400.0 + 330.0 * D1.r;
  float hard = 1.0 - smoothstep(hw - 220.0, hw + 220.0, ft);
  float alpine = smoothstep(tl - 140.0, tl + 160.0, ft + 120.0 * dd);
  float snowL = 4550.0 + 260.0 * d2;
  float snow = smoothstep(snowL, snowL + 900.0, ft + 150.0 * dd) * .85;
  float cliff = smoothstep(.5, .72, slope + .14 * dd);
  float rock = max(cliff, alpine * smoothstep(.08, .3, slope + .25 * dd + .15 * D1.r));
  // Stands: patches of a kind of tree a hundred metres or so across, in groves of a few hundred;
  // hemlock and pine along the streams. (Each scale fades out as it shrinks below a few pixels.)
  vec2 wq = xz + .25 * (vec2(noise(xz / .4 + 2.0), noise(xz / .4 - 7.0)) - .5);
  float fS = smoothstep(.025, .008, fp), fG = smoothstep(.09, .03, fp);
  float stand = mix(.5, noise(wq / .09 + 3.7), fS), grove = mix(.5, fbm3(wq / .5 - 8.1), fG);
  float con = clamp(.06 + .6 * smoothstep(.5, .72, grove + .25 * (stand - .5)) + .45 * smoothstep(.45, .8, t.b), 0.0, .85);
  float hue = clamp(t.a + .45 * (stand - .5) + .5 * (grove - .5) * fG, 0.0, 1.0);
  vec3 hardAvg = mix(pkLeafAvg(hue), PK_HEMLOCK, con);
  float birch = .05 + .2 * (1.0 - smoothstep(hw, hw + 900.0, ft));
  vec3 softAvg = mix(mix(PK_SPRUCE, PK_FIR, .5), vec3(.5, .4, .1), birch * .5);
  softAvg = mix(softAvg, mix(softAvg, PK_SNOW * .9, .55), snow);
  vec3 forest = mix(softAvg, hardAvg, hard) * .82;
  // Single crowns, where they span a few pixels.
  float sp = mix(.011, .015, hard) * mix(1.0, .6, smoothstep(tl - 400.0, tl, ft));
  float vis = near ? smoothstep(2.2, 5.0, sp / fp) : 0.0;
  if (vis > 0.0 && rock < .99) {
    vec4 c = pkCell(xz / sp);
    float isCon = step(c.w, mix(1.0 - birch, con, hard));
    float a = atan(c.y, c.x), r = length(c.xy);
    float rc = (.5 + .14 * c.z) * mix(1.0 + .1 * sin(a * 5.0 + c.z * 30.0), 1.0 + .2 * abs(sin(a * 4.0 + c.w * 20.0)), isCon);
    // (The treeline: fewer, lower trees; the krummholz.)
    rc *= (1.0 - .55 * smoothstep(tl - 300.0, tl + 100.0, ft)) * (1.0 - .8 * snow);
    float inside = smoothstep(rc, rc - .1, r);
    vec3 crownC = isCon > .5 ? mix(PK_SPRUCE, PK_FIR, c.z) * (.85 + .3 * fract(c.z * 7.0)) : hard > .5 ? pkLeaf(hue, c.z) : vec3(.5, .4, .1) * (.8 + .4 * c.z);
    // (A dead fir here and there, grey; rime white on the windward tops high up.)
    crownC = mix(crownC, vec3(.2, .19, .17), step(.985, fract(c.w * 13.0)) * (1.0 - hard));
    vec2 o = c.xy / max(rc, .05);
    float h2 = max(1.0 - dot(o, o), 0.0);
    vec3 nc = isCon > .5 ? normalize(vec3(o * 1.1, .7 + .5 * h2)) : normalize(vec3(o * .7, sqrt(h2) + .45));
    crownC = mix(crownC, PK_SNOW, snow * smoothstep(.3, .9, nc.y + .3 * dot(o, normalize(vec2(-.7, .7)))) * .85);
    // The gap: the forest floor, in the crown's shadow away from the sun.
    float shadowed = smoothstep(rc + .05, rc - .05, length(c.xy + PK_SUN.xz / max(PK_SUN.y, .25) * .32));
    vec3 floorC = mix(crownC * .55, crownC * .22, shadowed);
    floorC = mix(floorC, PK_SNOW * .7, snow * .8);
    vec3 crowns = mix(floorC, crownC, inside);
    forest = mix(forest, crowns, vis);
    nl = normalize(mix(n, normalize(n + nc - vec3(0.0, 1.0, 0.0)), inside * vis));
  }
  // Above the trees: sedge gold, grey lichen, krummholz in clumps.
  vec3 tundra = mix(PK_SEDGE, vec3(.42, .32, .14), .5 + .5 * dd);
  tundra = mix(tundra, vec3(.3, .32, .28), smoothstep(.2, .6, D0.r) * .6);
  tundra = mix(tundra, PK_SPRUCE * 1.6, mix(.15, smoothstep(.64, .8, noise(xz / .03)) * .8, smoothstep(.008, .003, fp)) * (1.0 - smoothstep(tl, tl + 400.0, ft)) * (1.0 - snow));
  // Granite: pale and pinkish, darker where wet streaks run down the slabs and in the joints.
  vec3 granite = mix(PK_GRANITE * .78, vec3(.52, .47, .43), .5 + .5 * dd) * (.88 + .24 * d2);
  vec2 down = length(n.xz) > 1e-4 ? normalize(n.xz) : vec2(0.0, 1.0);
  float streak = textureLod(uTerrainDetail, vec2(dot(xz, vec2(-down.y, down.x)) / .05, dot(xz, down) / 1.4), log2(max(fp * 256.0 / .05, 1.0))).g;
  granite *= 1.0 - .45 * smoothstep(.1, .6, streak) * cliff;
  if (near && fp < .004) {
    vec4 v = voronoi(xz / .022);
    granite *= mix(1.0, .55, smoothstep(.06, .0, v.y - v.x) * smoothstep(.004, .0015, fp));
    // Boulder fields (felsenmeer) on the high, gentler slopes.
    vec4 b = pkCell(xz / .006);
    float bl = smoothstep(.45, .3, length(b.xy)) * smoothstep(1.5, 3.0, .006 / fp);
    granite = mix(granite, granite * (.75 + .5 * b.z), bl * alpine * (1.0 - cliff));
  }
  vec3 land = mix(forest, tundra, alpine);
  land = mix(land, granite, rock);
  // Snow: on the flatter ground high up, thinning on the steep.
  land = mix(land, PK_SNOW * (.92 + .08 * dd), min(1.0, snow * 1.2) * smoothstep(.6, .3, slope + .2 * dd) * mix(.55, 1.0, alpine));
  return land;
}
// Rivers along the water's paths (white where they fall steeply).
float pkRiver(vec4 t, float slope, out float foam) {
  float r = smoothstep(.86, .93, t.b) * smoothstep(.45, .15, slope);
  foam = r * smoothstep(.06, .2, slope);
  return r;
}
// Wind on the water: small ripples, calm slicks between gusts. Returns the water's normal.
vec3 pkRipple(vec2 xz, float fp) {
  float amp = .05 * smoothstep(.0012, .0004, fp) * (.25 + .75 * smoothstep(.35, .7, noise(xz / .35 + T * .03)));
  if (amp <= 0.0) return vec3(0.0, 1.0, 0.0);
  vec2 p = xz / .009 + vec2(T * .5, T * .2), e = vec2(.15, 0.0);
  float h0 = noise(p) + .5 * noise(p * 2.3 + 4.0);
  float hx = noise(p + e) + .5 * noise((p + e) * 2.3 + 4.0), hz = noise(p + e.yx) + .5 * noise((p + e.yx) * 2.3 + 4.0);
  return normalize(vec3((h0 - hx) * amp / .15, 1.0, (h0 - hz) * amp / .15));
}
// What the water reflects: a short march back up from it; the land it meets lit simply (no shadow).
vec3 pkReflect(vec3 p, vec3 rr) {
  float t = .03, f0 = gPkFp;
  for (int i = 0; i < 44; i++) {
    vec3 q = p + rr * t;
    gPkFp = f0 + t * gPkFpk;
    float dy = q.y - pkSurf(q.xz);
    if (dy < .0015 * t) {
      float e = .06 + t * .002;
      vec3 n = normalize(vec3(pkSurf(q.xz - vec2(e, 0.0)) - pkSurf(q.xz + vec2(e, 0.0)), 2.0 * e, pkSurf(q.xz - vec2(0.0, e)) - pkSurf(q.xz + vec2(0.0, e))));
      vec3 nl;
      vec3 alb = pkLand(q.xz, n, pkT(q.xz), 1.0, false, nl);
      vec3 lit = alb * (vec3(2.1, 1.5, 1.0) * max(dot(n, PK_SUN), 0.0) + vec3(.13, .2, .36) * (.55 + .45 * n.y));
      return mix(lit, mix(vec3(.42, .56, .8), vec3(1.0, .78, .55), pow(max(dot(rr, PK_SUN), 0.0), 5.0)), 1.0 - exp(-t * .03));
    }
    t += max(dy * .55, .012 + t * .03);
    if (t > 40.0 || q.y > 6.0) break;
  }
  return pkSky(rr);
}
// Drifting cloud shadows.
float pkCloud(vec2 xz) { return smoothstep(.5, .7, fbm3(xz * .05 + vec2(T * .006, T * .002) + 3.0)); }
${PAINT_GLSL}
// The trail of the Pemi Loop as far as upto (0..1 of its length): the distance to it, and how far
// along it the nearest point is (km).
float pkTrail(vec2 xz, float upto, out float along) {
  float d = 1e9, acc = 0.0, total = 0.0;
  along = 0.0;
  for (int i = 0; i + 1 < ${pemi.length}; i++) total += length(PK_PEMI[i + 1] - PK_PEMI[i]);
  for (int i = 0; i + 1 < ${pemi.length}; i++) {
    vec2 a = PK_PEMI[i], b = PK_PEMI[i + 1], ab = b - a;
    float L = length(ab), u = clamp(dot(xz - a, ab) / (L * L), 0.0, 1.0);
    float s = (acc + u * L) / total, dd = length(xz - a - ab * u);
    if (s <= upto && dd < d) { d = dd; along = acc + u * L; }
    acc += L;
  }
  return d;
}
// Narkowicz's fit of the ACES filmic curve, and its inverse (so the engraving, already in display
// terms, passes through it unchanged).
vec3 pkTone(vec3 x) { x *= .9; return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0.0, 1.0); }
vec3 pkUntone(vec3 y) {
  y = clamp(y, 0.0, .985);
  vec3 a = 2.43 * y - 2.51, b = .59 * y - .03, c = .14 * y;
  return (-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a) / .9;
}
// The map's marks as it is seen from straight above: contour lines drawing themselves in, low to high
// (every 200 ft, stronger every 1,000), the Pemi Loop's trail, the 48; fading as the window is leaded.
// kpx: pixels a km; plan: how straight down the camera looks.
vec3 pkMarks(vec3 col, vec2 xz, float ft, float P, float kpx, float plan) {
  if (plan <= 0.0 || P < .6) return col;
  float lead = smoothstep(1.0, 1.08, P);
  float rise = mix(600.0, 6600.0, smoothstep(.8, .97, P));
  float w = fwidth(ft);
  float c200 = abs(fract(ft / 200.0 + .5) - .5) * 200.0, c1000 = abs(fract(ft / 1000.0 + .5) - .5) * 1000.0;
  float line = max(smoothstep(w * 1.2, w * .2, c200) * .5, smoothstep(w * 2.0, w * .5, c1000)) * (1.0 - lead);
  float drawn = step(ft, rise) * plan;
  vec3 ink = mix(vec3(.3, .16, .06), vec3(.98, .86, .6), smoothstep(.9, 1.02, P));
  col = mix(col, ink, line * drawn * .7);
  col += vec3(1.0, .85, .55) * exp(-pow((ft - rise) / 40.0, 2.0)) * line * plan * 2.0;
  float along, dT = pkTrail(xz, smoothstep(.84, .96, P), along);
  float dash = step(.4, fract(along * 2.2));
  col = mix(col, vec3(.85, .12, .06), smoothstep(2.2, .8, dT * kpx) * dash * plan * (1.0 - lead));
  float tri = 0.0;
  for (int k = 0; k < 48; k++) {
    vec2 d = (xz - PK_48[k].xy) * kpx;
    if (dot(d, d) > 100.0) continue;
    float s = 3.0 + 2.5 * (PK_48[k].z - 4000.0) / 2300.0;
    tri = max(tri, smoothstep(1.0, -.5, max(abs(d.x) * .866 + d.y * .5, -d.y) - s * .5));
  }
  return mix(col, mix(vec3(.12, .08, .05), vec3(.98, .84, .5), smoothstep(.92, 1.02, P)), tri * plan * smoothstep(.84, .9, P) * (1.0 - lead));
}
// The finale, flat (the land has settled into its map): the map at dusk, its band contours straightening
// onto the module as came, the backlight coming up the bands, the summits glowing in the order they
// were climbed, until it is Outdoors' window (sceneFolio, exactly, by 1.2). Display colour.
vec3 pkFinale(vec2 px, float P) {
  vec2 xz = fgMap(px);
  float kpx = R.y / fgSpan(), fp = 1.0 / kpx;
  vec4 tt = pkT(xz);
  vec3 n = pkNormal(xz, 50.0), nl;
  vec3 alb = pkLand(xz, n, tt, fp, true, nl);
  float wet = step(.0004, tt.g - tt.r);
  float sh = 1.0 - .5 * pkCloud(xz) * .3;
  vec3 lit = alb * (vec3(2.1, 1.5, 1.0) * max(dot(n, PK_SUN), 0.0) * sh + vec3(.13, .2, .36) * (.55 + .45 * n.y));
  lit = mix(lit, mix(vec3(.006, .022, .03), pkSky(vec3(0.0, 1.0, 0.0)) * .02, .5), wet);
  vec3 M = pkTone(pkMarks(lit, xz, tt.r / PK_KMFT, P, kpx, 1.0));
  // Dusk falls on the map.
  M *= mix(1.0, .2, smoothstep(.99, 1.1, P));
  // The leading: the band edges (the map's own contours at the bands' heights) straighten onto the
  // module.
  float lead = smoothstep(1.0, 1.09, P);
  float sdM[FG_NB], solder, sd[FG_NB];
  fgLeading(xz, sdM, solder);
  float ft = tt.r / PK_KMFT, e = .2;
  float gft = length(vec2(pkT(xz + vec2(e, 0.0)).r - pkT(xz - vec2(e, 0.0)).r, pkT(xz + vec2(0.0, e)).r - pkT(xz - vec2(0.0, e)).r)) / (2.0 * e) / PK_KMFT;
  for (int k = 0; k < FG_NB; k++) sd[k] = mix((FG_T[k] - ft) / max(gft, 30.0) / FG_M, sdM[k], lead);
  float fill = 8.0 * smoothstep(1.03, 1.18, P), reds = 48.5 * smoothstep(1.075, 1.19, P);
  vec3 col = fgShade(px, xz, sd, solder, lead, fill, reds, M);
  vec2 uv = px / R;
  col *= 1.0 - .5 * smoothstep(1.03, 1.17, P) * pow(length((uv - vec2(.5, .48)) * vec2(1.0, 1.15)), 2.4);
  return fgDisp(col);
}
vec3 groundPeaks(vec2 q, vec2 px, float P) {
  vec2 Sz = uRegion.zw;
  if (uIceReady < .5) return P < .5 ? sceneGlacier(px) : sceneFolio(px);
  if (P >= 1.2) return sceneFolio(px);
  // Racing's ice until the hold has begun, then it settles into the canvas.
  float first = ptHead().y, cf = smoothstep(first - .045, first - .01, P);
  if (cf <= 0.0) return sceneGlacier(px);
  gPkHeave = smoothstep(PK_HEAVE0, PK_HEAVE1, P) * (1.0 - smoothstep(.94, 1.02, P));
  gPkRelief = max(gPkHeave, smoothstep(.86, .95, P));
  PK_SUN = pkSunAt(P);
  // The camera, never inside a hill.
  vec3 ro = pkKey(false, P), ta = pkKey(true, P);
  vec3 fw = normalize(ta - ro);
  ro.y = max(ro.y, max(max(pkSurf(ro.xz), pkSurf(ro.xz + fw.xz * .5)), max(pkSurf(ro.xz + fw.xz * 1.1), pkSurf(ro.xz + fw.xz * 1.8) - .1)) + .42);
  // (High up, looking down: no higher than shows the map edge to edge.)
  ro.y = min(ro.y, 1.07 * PK_SIZE * min(1.0, Sz.y / Sz.x) * .97);
  fw = normalize(ta - ro);
  vec3 upH = normalize(mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), smoothstep(.97, .75, -fw.y)));
  vec3 rt = normalize(cross(upH, fw)), up = cross(fw, rt);
  vec2 uv = vec2(q.x - Sz.x * .5, Sz.y * .5 - q.y) / Sz.y;
  float focal = mix(1.07, 1.35, smoothstep(.32, .44, P) * (1.0 - smoothstep(.76, .84, P)));
  vec3 rd = normalize(fw * focal + rt * uv.x + up * uv.y);
  gPkFpk = 1.0 / (Sz.y * focal);
  // The canvas's thread: a few pixels at the top view.
  float pitch = 3.2 * min(${f(PAINT.top)}, 1.07 * PK_SIZE * min(1.0, Sz.y / Sz.x) * .97) / (${f(PAINT.focal)} * Sz.y);
  // Before it rises, the painting is flat under the camera straight above it: drawn in two dimensions.
  if (gPkHeave <= 0.0 && P > .5) return pkFinale(px, P);
  if (gPkHeave <= 0.0) {
    vec2 xz = ro.xz + uv * ro.y / focal;
    float fp = ro.y / (focal * Sz.y);
    vec4 tt = pkT(xz);
    vec2 g = vec2(pkT(xz + vec2(.15, 0.0)).r - pkT(xz - vec2(.15, 0.0)).r, pkT(xz + vec2(0.0, .15)).r - pkT(xz - vec2(0.0, .15)).r) * PK_EX / .3;
    vec3 c = pkTone(ptStudio(xz, P, fp, pitch, tt, g));
    if (cf < 1.0) c = mix(dewLinear(sceneGlacier(px)), c, cf);
    return dewDisplay(c);
  }
  // March to the surface, then refine.
  float t = 0.02, hitT = -1.0, tmax = 260.0, prevT = 0.0;
  for (int i = 0; i < 150; i++) {
    vec3 p = ro + rd * t;
    gPkFp = t * gPkFpk;
    float dy = p.y - (t < 5.0 ? pkSurfF(p.xz) : pkSurf(p.xz));
    if (dy < .0005 * t) { hitT = t; break; }
    prevT = t;
    t += max(dy * .4, .004 + t * .0016);
    if (t > tmax || (rd.y > 0.0 && p.y > 6.0)) break;
  }
  vec3 col;
  float plan = smoothstep(-.9, -.995, fw.y);
  float sunAmt = pow(max(dot(rd, PK_SUN), 0.0), 5.0);
  vec3 haze = mix(vec3(.42, .56, .8), vec3(1.0, .78, .55), sunAmt);
  float wet = 0.0;
  vec3 n = vec3(0.0, 1.0, 0.0);
  if (hitT > 0.0) {
    float a = prevT, b = hitT;
    for (int i = 0; i < 5; i++) { float m = .5 * (a + b); vec3 p = ro + rd * m; if (p.y - (m < 5.0 ? pkSurfF(p.xz) : pkSurf(p.xz)) > 0.0) a = m; else b = m; }
    t = .5 * (a + b);
    vec3 p = ro + rd * t;
    float water;
    gPkFp = t * gPkFpk;
    pkSurf(p.xz, water, true);
    n = pkNormal(p.xz, t);
    vec4 tt = pkT(p.xz);
    float fp = t / (Sz.y * focal);
    // Soft shadow: march toward the sun.
    float sh = 1.0, st = .06;
    for (int i = 0; i < 18; i++) {
      vec3 sp = p + PK_SUN * st;
      gPkFp = (t + st) * gPkFpk;
      float d = sp.y - pkSurf(sp.xz);
      sh = min(sh, 8.0 * d / st);
      st += max(d * .6, .05 + st * .09);
      if (sh < 0.0 || st > 30.0) break;
    }
    sh = clamp(sh, 0.0, 1.0);
    sh *= 1.0 - .5 * pkCloud(p.xz) * (1.0 - plan * .7);
    // Light: the sun, the sky (less in the hollows), the warm light bounced off the far slopes.
    float hc = tt.r, ha = .25 * (pkT(p.xz + vec2(.6, 0.0)).r + pkT(p.xz - vec2(.6, 0.0)).r + pkT(p.xz + vec2(0.0, .6)).r + pkT(p.xz - vec2(0.0, .6)).r);
    float ao = clamp(.7 + (hc - ha) * 5.0, .3, 1.0);
    vec3 sunC = vec3(2.1, 1.5, 1.0), skyC = vec3(.13, .2, .36);
    if (water > .0004 * gPkHeave && P > PT_REAL0 + .04) {
      // A lake: level, rippled by the wind; its colour by depth, the bed showing in the shallows; the
      // sky and the mountains in it, and the sun's glints.
      wet = 1.0;
      float dep = water / (PK_EX * max(gPkHeave, .05));
      vec3 nw = pkRipple(p.xz, fp);
      vec3 rr = reflect(rd, nw);
      rr.y = abs(rr.y);
      float F = .02 + .98 * pow(1.0 - max(dot(-rd, nw), 0.0), 5.0);
      vec3 bed = mix(vec3(.3, .26, .18), vec3(.16, .15, .12), smoothstep(.002, .006, dep));
      vec3 body = mix(vec3(.006, .022, .03), vec3(.03, .1, .085), exp(-dep / .005));
      vec3 under = mix(body, bed * .6, exp(-dep / .0018)) * (sunC * max(PK_SUN.y, 0.0) * sh * .5 + skyC * 1.4);
      vec3 refl = pkReflect(vec3(p.x, p.y + .001, p.z), rr);
      col = mix(under, refl, F) + sunC * 2.5 * pow(max(dot(rr, PK_SUN), 0.0), 350.0) * sh;
    } else {
      vec3 nl;
      vec3 alb = pkLand(p.xz, n, tt, fp, true, nl);
      // The painting, while it is still paint: its colours, its relief, its gloss.
      float real = smoothstep(PT_REAL0, PT_REAL1, P);
      float pGloss = 0.0;
      if (real < 1.0) {
        vec2 g = vec2(-n.x, -n.z) / max(n.y, .2);
        float hw;
        vec3 pc = ptCanvas(p.xz, pitch, smoothstep(.0, .2, pitch / fp - 2.0) * (1.0 - gPkHeave), hw);
        float ph = 0.0, sh_ = 0.0;
        ptPaint(p.xz, P, fp, tt.r / PK_KMFT, tt.g - tt.r, ptLand(p.xz, tt, g, fp), pc, ph, pGloss, sh_);
        float relief = (ph * 2.2 + hw * .35) * (1.0 - gPkHeave);
        vec2 dh = vec2(dFdx(relief), dFdy(relief));
        nl = normalize(mix(nl, normalize(n - (rt * dh.x + up * dh.y) * .8), 1.0 - real));
        alb = mix(pc * (1.0 - sh_), alb, real);
        pGloss *= 1.0 - real;
      }
      // The shore: wet and dark just above the water (where there is water near).
      float real_ = smoothstep(PT_REAL0, PT_REAL1, P);
      alb *= 1.0 - .35 * smoothstep(-.004 * gPkHeave, -.0005 * gPkHeave, water) * step(-.01, tt.g - tt.r) * real_;
      float foam, river = pkRiver(tt, 1.0 - n.y, foam) * real_;
      float dif = max(dot(nl, PK_SUN), 0.0) * sh;
      vec3 lit = alb * (sunC * dif + skyC * (.55 + .45 * nl.y) * ao + vec3(.07, .045, .03) * clamp(-dot(n, PK_SUN) + .3, 0.0, 1.0) * ao);
      // (While it is paint, the studio's light: as the painting is lit from above, in 2D.)
      if (real < 1.0) {
        float difS = max(dot(nl, PK_SUN), 0.0) / max(PK_SUN.y, .35) * mix(1.0, sh, gPkHeave);
        vec3 studio = alb * (.2 + .88 * difS) + vec3(1.0, .97, .9) * pow(max(dot(reflect(rd, nl), PK_SUN), 0.0), 160.0) * pGloss * .7;
        lit = mix(studio, lit, real);
      }
      if (river > 0.0) {
        float F = .02 + .98 * pow(1.0 - max(-rd.y, 0.0), 5.0);
        vec3 rv = mix(vec3(.01, .03, .04) * (sunC * .3 + skyC), pkSky(reflect(rd, vec3(0.0, 1.0, 0.0))) * .8, F);
        rv = mix(rv, vec3(.75, .8, .82) * (sunC * dif + skyC), foam * (.5 + .5 * noise(p.xz / .01 + T)));
        lit = mix(lit, rv, river * .9);
        wet = river;
      }
      col = lit;
    }
    // Aerial perspective, and mist pooling in the valleys at the end of the day.
    // (Exponential height fog: the air thins with height, integrated along the ray.)
    float fb = .45, fogInt = .026 * exp(-fb * ro.y) * (1.0 - exp(-fb * rd.y * t)) / max(fb * rd.y, 1e-4);
    if (abs(rd.y) < 1e-3) fogInt = .026 * exp(-fb * ro.y) * t;
    float fog = 1.0 - exp(-fogInt);
    float mist = exp(-max(p.y, 0.0) / (.28 * PK_EX)) * .3 * (1.0 - wet) * (1.0 - plan) * smoothstep(.36, .5, P) * (1.0 - smoothstep(.78, .9, P)) * smoothstep(.0, 1.5, t);
    col = mix(col, haze, clamp(fog + mist * (1.0 - fog), 0.0, 1.0));
    // The map (plan view): contour lines draw themselves in, low to high; the trail; the 48.
    col = pkMarks(col, p.xz, tt.r / PK_KMFT, P, Sz.y * focal / t, plan);
  } else col = pkSky(rd);
  // (A filmic curve on the land and sky; the worlds either side are drawn as they are.)
  col = pkTone(col);
  // The start: Racing's glacier; the end: the folio itself (each drawn only while it shows).
  return dewDisplay(col);
}
`;
