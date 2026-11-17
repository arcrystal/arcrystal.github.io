// Outdoors' world (Naturalist's Folio): the White Mountains as a Frank Lloyd Wright art-glass window,
// seen from inside at dusk. The region's contour map (the plate, terrain-plan.js makePlate, on unit 7)
// in the top view's framing (glsl/peaks.js), its heights stepped into bands on a square module and
// leaded: each band's edge is marching squares on the module's corners with its vertices at the edges'
// midpoints, so every line of came runs square or at 45°, the Prairie geometry. Mostly clear antique
// glass as his windows are, the colour gathered high up: amber, sage and forest green, cream
// opalescent, iridized gold; a Cherokee-red square at each of the 48 summits; iridized jewels at the
// named tarns. Through it a dusk forest: the last light low behind a far ridge of spruce, trunks near
// the window, leaves whose shadows drift across the glass. The lantern (the pointer) catches the came,
// the solder and the opalescent glass.
//   Physical: light through the glass is the light outside times the glass's transmission; antique
//   glass refracts it a little (its waviness) and carries seeds (bubbles); opalescent glass scatters
//   it; iridized glass adds a thin film's colours, which shift with the angle to the lantern.
//   Artistic: the module, the bands and their colours, the dusk, the lantern.
import { PEAKS48, HIKED, TARNS, TERRAIN, FT } from '../terrain-plan.js';
const f = x => Number(x).toFixed(4);
const order = name => HIKED.indexOf(name);
export const GLASS = Object.freeze({ module: 1.6, bands: [1200, 1700, 2400, 3200, 4000, 4800], top: 62, focal: 1.07 });
const NB = GLASS.bands.length;
// The summits' red glass: each square on the half-module grid, sized by height; summits whose squares
// would touch are one rectangle (as the Twins, the Bonds, the Tripyramids are), lit when the first of
// them was climbed. The tarns' jewels, but none on a summit's glass.
export const REDS = (() => {
  const g = GLASS.module / 2, C = TERRAIN.size / 2, snap = v => C + Math.round((v - C) / g) * g;
  const groups = [];
  for (const p of PEAKS48) {
    const c = [snap(p.p[0]), snap(p.p[1])], hs = GLASS.module * (0.14 + 0.12 * (p.ft - 4000) / 2300);
    const near = groups.find(q => q.cells.some(([x, z]) => Math.max(Math.abs(x - c[0]), Math.abs(z - c[1])) <= g + 1e-6));
    if (near) { near.cells.push(c); near.hs = Math.max(near.hs, hs); near.order = Math.min(near.order, order(p.name)); }
    else groups.push({ cells: [c], hs, order: order(p.name) });
  }
  return groups.map(q => {
    const xs = q.cells.map(c => c[0]), zs = q.cells.map(c => c[1]);
    const x0 = Math.min(...xs) - q.hs, x1 = Math.max(...xs) + q.hs, z0 = Math.min(...zs) - q.hs, z1 = Math.max(...zs) + q.hs;
    return { c: [(x0 + x1) / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2, (z1 - z0) / 2], order: q.order, n: q.cells.length };
  });
})();
// One module cell's leading for one band edge (as fgMS draws it): corner heights v (00, 10, 11, 01, so
// round the square), the middle's, the edge's height. Returns the region above it as polygons and the
// came as segments, in the cell's unit square (corners and the sides' midpoints only).
export function leadCell(v, mid, thr) {
  const c = [[0, 0], [1, 0], [1, 1], [0, 1]], m = k => [(c[k][0] + c[(k + 1) % 4][0]) / 2, (c[k][1] + c[(k + 1) % 4][1]) / 2];
  const up = v.map(h => h > thr), n = up.filter(Boolean).length, polys = [], segs = [];
  if (!n) return { polys, segs };
  if (n === 4) return { polys: [c], segs };
  const saddle = n === 2 && up[0] === up[2];
  if (saddle && mid > thr) {
    const poly = [];
    for (let s = 0; s < 4; s++) { if (up[s]) poly.push(c[s]); else { poly.push(m((s + 3) % 4), m(s)); segs.push([m((s + 3) % 4), m(s)]); } }
    polys.push(poly);
  } else if (saddle) {
    for (let s = 0; s < 4; s++) if (up[s]) { polys.push([m((s + 3) % 4), c[s], m(s)]); segs.push([m((s + 3) % 4), m(s)]); }
  } else {
    const poly = [];
    for (let s = 0; s < 4; s++) { if (up[s]) poly.push(c[s]); if (up[s] !== up[(s + 1) % 4]) poly.push(m(s)); }
    polys.push(poly);
    segs.push([0, 1, 2, 3].filter(s => up[s] !== up[(s + 1) % 4]).map(m));
  }
  return { polys, segs };
}
export const JEWELS = TARNS.filter(t => !REDS.some(r => Math.abs(t.p[0] - r.c[0]) < r.h[0] + 0.6 && Math.abs(t.p[1] - r.c[1]) < r.h[1] + 0.6));
export const FOLIO = /* glsl */ `
const vec3 FOL_BG = vec3(0.071, 0.114, 0.086);
const vec3 FOL_DEEP = vec3(0.027, 0.055, 0.039);
const vec3 FOL_LINE = vec3(0.196, 0.302, 0.235);
const vec3 FOL_FERN = vec3(0.035, 0.071, 0.047);
const vec3 BRASS = vec3(0.804, 0.647, 0.384);
const vec3 EMBER = vec3(0.910, 0.706, 0.396);

uniform sampler2D uPlate;
uniform float uPlateOn;
// The last low sun through the glass (glsl/fire.js): gSun, how far it has come up at this point. What
// fgShade found here, for the fire that follows: the glass's tint and how near the came is (px).
float gSun = 0.0, gFgNear = 1e3;
vec3 gFgTint = vec3(1.0);
const float FG_S = ${f(TERRAIN.size)}, FG_M = ${f(GLASS.module)}, FG_KM = ${f(FT)};
const int FG_NB = ${NB};
const float FG_T[${NB}] = float[${NB}](${GLASS.bands.map(b => f(b)).join(', ')});
// The summits' glass: (middle, half size) km, and when it lights (the order climbed); the jewels.
const int FG_NR = ${REDS.length}, FG_NJ = ${JEWELS.length};
const vec4 FG_RED[FG_NR] = vec4[FG_NR](${REDS.map(r => `vec4(${f(r.c[0])}, ${f(r.c[1])}, ${f(r.h[0])}, ${f(r.h[1])})`).join(', ')});
const float FG_REDT[FG_NR] = float[FG_NR](${REDS.map(r => f(r.order)).join(', ')});
const vec3 FG_TARN[FG_NJ] = vec3[FG_NJ](${JEWELS.map(t => `vec3(${f(t.p[0])}, ${f(t.p[1])}, ${f(t.r)})`).join(', ')});
vec3 fgLin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 fgDisp(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
// The window's framing: the map as the top view frames it, km a pixel, and the map point at px.
float fgSpan() { return min(${f(GLASS.top)}, 1.07 * FG_S * min(1.0, R.y / R.x) * .97) / ${f(GLASS.focal)}; }
vec2 fgMap(vec2 px) { return vec2(FG_S * .5) + vec2(px.x - R.x * .5, R.y * .5 - px.y) / R.y * fgSpan(); }
float fgFt(vec2 xz) { return textureLod(uPlate, xz / FG_S, 0.0).r / FG_KM; }
// One band's edge in a module cell: signed distance (module units, < 0 inside the band and above).
// c: the corners' heights (00, 10, 01, 11), mid: the middle's (for the saddles).
float fgMS(vec2 uv, vec4 c, float mid, float thr) {
  bvec4 b = greaterThan(c, vec4(thr));
  int n = int(b.x) + int(b.y) + int(b.z) + int(b.w);
  if (n == 0) return 1.0;
  if (n == 4) return -1.0;
  vec4 dd = (vec4(uv.x + uv.y, 1.0 - uv.x + uv.y, uv.x + 1.0 - uv.y, 2.0 - uv.x - uv.y) - .5) * .70711;
  if (n == 1) return b.x ? dd.x : b.y ? dd.y : b.z ? dd.z : dd.w;
  if (n == 3) return -(!b.x ? dd.x : !b.y ? dd.y : !b.z ? dd.z : dd.w);
  if (b.x && b.y) return uv.y - .5;
  if (b.z && b.w) return .5 - uv.y;
  if (b.x && b.z) return uv.x - .5;
  if (b.y && b.w) return .5 - uv.x;
  bool up = mid > thr;
  if (b.x) return up ? -min(dd.y, dd.z) : min(dd.x, dd.w);
  return up ? -min(dd.x, dd.w) : min(dd.y, dd.z);
}
// The leading at map point xz: each band edge's signed distance (module units); solder: how near a
// joint (where bands pinch together, two or more edges crossing the same side of a cell).
void fgLeading(vec2 xz, out float sd[FG_NB], out float solder) {
  vec2 m = (xz - vec2(FG_S * .5)) / FG_M, id = floor(m), uv = m - id;
  vec2 o = vec2(FG_S * .5) + id * FG_M;
  vec4 c = vec4(fgFt(o), fgFt(o + vec2(FG_M, 0.0)), fgFt(o + vec2(0.0, FG_M)), fgFt(o + vec2(FG_M)));
  float mid = fgFt(o + FG_M * .5);
  for (int k = 0; k < FG_NB; k++) sd[k] = fgMS(uv, c, mid, FG_T[k]);
  vec4 bc = vec4(0.0);
  for (int k = 0; k < FG_NB; k++) bc += vec4(greaterThan(c, vec4(FG_T[k])));
  solder = 1e3;
  if (abs(bc.x - bc.y) > 2.5) solder = min(solder, length(uv - vec2(.5, 0.0)));
  if (abs(bc.z - bc.w) > 2.5) solder = min(solder, length(uv - vec2(.5, 1.0)));
  if (abs(bc.x - bc.z) > 2.5) solder = min(solder, length(uv - vec2(0.0, .5)));
  if (abs(bc.y - bc.w) > 2.5) solder = min(solder, length(uv - vec2(1.0, .5)));
}
// The light outside at screen point p (linear), as glass shows it, soft: the dusk sky deep blue-green
// above, its last warm light low behind the far trees (dark soft masses), and the shadows of leaves
// near the window drifting and swaying across it.
vec3 fgOutside(vec2 p) {
  vec2 u = p / R;
  float hz = .7 + .04 * (noise(vec2(p.x / 420.0, 3.0)) - .5);
  vec3 col = mix(vec3(.046, .028, .016), vec3(.012, .028, .035), smoothstep(-.03, .14, hz - u.y));
  col = mix(col, vec3(.005, .013, .018), smoothstep(.2, .7, hz - u.y));
  col = mix(col, vec3(.011, .014, .011), smoothstep(.0, .1, u.y - hz));
  // The far trees: soft dark masses along the glow.
  float trees = smoothstep(.42, .72, fbm3(vec2(p.x / 210.0, u.y * 3.2) + 4.0)) * smoothstep(.3, .0, abs(u.y - hz + .05));
  col *= 1.0 - .6 * trees;
  // Leaves near the window: their shadows drift and sway.
  vec2 lp = p / 190.0 + vec2(T * .012 + .2 * sin(T * .19), T * .005);
  float leaf = smoothstep(.52, .76, fbm3(lp + .25 * vec2(sin(T * .33 + p.y / 340.0), cos(T * .27))));
  return col * (1.0 - .35 * leaf);
}
// The glass of each band (0 the lowland, clear antique) and of the summits and tarns: its transmission
// and how opalescent it is.
// The lowland clear, as Wright's fields are (0 clear antique, 1 seedy, 2 champagne); the colour
// gathered on the mountains (3 sage, 4 forest green, 5 cream opalescent, 6 iridized gold). glow: how
// much of the window's backlight a coloured glass gathers.
const vec3 FG_TINT[7] = vec3[7](vec3(.78, .86, .84), vec3(.84, .9, .9), vec3(.95, .86, .66), vec3(.6, .78, .56), vec3(.1, .4, .2), vec3(.98, .91, .76), vec3(1.0, .72, .28));
const float FG_OPAL[7] = float[7](.06, .12, .2, .25, .35, .85, .5), FG_GLOW[7] = float[7](0.0, 0.0, .005, .008, .014, .014, .02);
// The window lit, at screen point px over map point xz with the leading sd. lead: how far the lines are
// came (0 a drawn line, 1 leaded); fill: how far the backlight has come up the bands (0..6); reds: how
// many summits glow, in the order they were climbed; under: what shows through glass not yet lit (the
// map, while it turns to glass; linear). Linear.
vec3 fgShade(vec2 px, vec2 xz, float sd[FG_NB], float solder, float lead, float fill, float reds, vec3 under) {
  float kpx = fgSpan() / R.y, mpx = FG_M / kpx;
  int band = 0;
  float came = 1e3;
  for (int k = 0; k < FG_NB; k++) { band += sd[k] < 0.0 ? 1 : 0; came = min(came, abs(sd[k])); }
  // The lantern.
  vec2 idle = R * vec2(.8, .9) + vec2(sin(T * .21), cos(T * .17)) * 34.0;
  vec2 lamp = mix(idle, PTR, uPtrOn);
  // (Left to itself, with no pointer to carry it, it is turned low.)
  float light = exp(-pow(length(px - lamp) / 420.0, 2.0)) * mix(.35, 1.0, uPtrOn);
  // The glass: which sheet (summit square, tarn jewel, or the band's), refracting what is outside.
  vec3 tint = FG_TINT[band];
  float opal = FG_OPAL[band], gain = FG_GLOW[band], irid = band == 6 ? .6 : 0.0, glow = 0.0, edge = came * FG_M;
  // (The last light comes from the west-south-west, low: it reaches the window's right side first.)
  float sweep = .8 * (1.0 - px.x / R.x);
  float lit = clamp(fill - float(band) - sweep, 0.0, 1.0);
  for (int k = 0; k < FG_NR; k++) {
    vec2 d = abs(xz - FG_RED[k].xy) - FG_RED[k].zw;
    if (max(d.x, d.y) > FG_M) continue;
    float s = max(d.x, d.y);
    edge = min(edge, abs(s));
    if (s < 0.0) { tint = vec3(.7, .12, .06); opal = .4; gain = .08; irid = 0.0; lit = clamp(reds - FG_REDT[k], 0.0, 1.0); glow = 1.0; }
  }
  for (int k = 0; k < FG_NJ; k++) {
    vec2 d = abs(xz - FG_TARN[k].xy);
    float s = d.x + d.y - max(.3, FG_TARN[k].z * 1.1);
    if (s > FG_M) continue;
    edge = min(edge, abs(s) * .70711);
    if (s < 0.0) { tint = vec3(.5, .78, .82); opal = .2; gain = .06; irid = 1.0; lit = clamp(fill - .5 - sweep, 0.0, 1.0); }
  }
  float seed = float(band) * 7.3 + glow * 3.1;
  vec2 wav = vec2(noise(px / 70.0 + seed), noise(px / 70.0 + seed + 11.0)) - .5;
  vec2 q = px + wav * 9.0 + (vec2(noise(px / 9.0 + seed), noise(px / 9.0 - seed)) - .5) * 2.0;
  vec3 out_ = fgOutside(q);
  // A coloured glass glows with the window's backlight gathered (warmer low, where the last light is).
  vec3 diffuse = mix(vec3(1.0, .82, .6), vec3(.7, .8, .82), smoothstep(R.y * .8, R.y * .1, px.y)) * mix(.42, 1.0, smoothstep(R.x * .12, R.x * .8, px.x));
  // (Cathedral glass: its density streaks and swirls a little through each sheet.)
  vec2 sw = xz / 1.7 + .6 * vec2(noise(xz / 2.3 + seed), noise(xz / 2.3 - seed));
  float dens = .8 + .4 * noise(sw + seed) * (.7 + .3 * noise(sw * 2.6 - seed));
  vec3 through = tint * (mix(out_, out_ * .4 + vec3(.01, .014, .014), opal) + diffuse * gain * dens);
  // Antique glass: faint striations; the seedy glass hammered as well.
  through *= 1.0 + .06 * (noise(vec2(px.x / 380.0, px.y / 3.5) + seed) - .5);
  if (band == 1) through *= .9 + .25 * noise(px / 4.0 + seed);
  vec2 bi = floor(px / 7.0);
  vec2 bo = (hash2(bi + seed) - .5) * 4.0;
  float bub = step(band == 1 ? .95 : .99, hash(bi + seed * 3.0)) * (1.0 - opal) * step(float(band), 2.5);
  float bd = length(px - (bi + .5) * 7.0 - bo), br = .7 + .9 * hash(bi + 5.0);
  through += (out_ * .6 + vec3(1.0, .82, .55) * light * .2) * bub * smoothstep(.6, .0, abs(bd - br * .7)) * .5;
  // Iridized glass: a thin film whose colours turn with the angle to the lantern.
  vec2 tl = normalize(px - lamp + vec2(1e-3));
  float film = .35 + .5 * noise(xz / 2.6) + .18 * tl.x + .3 * light;
  through += irid * (.5 + .5 * cos(6.2832 * (film + vec3(0.0, .33, .67)))) * (.015 + .12 * light + .2 * luma(out_));
  // The red glows like an ember with light behind it.
  through += glow * vec3(.2, .022, .008) * (.7 + .3 * sin(T * .7 + xz.x)) * (.8 + .4 * noise(xz * 3.0)) * luma(diffuse);
  // The lantern's light on the glass from inside: opalescent glass takes it up; clear glass shows its
  // reflection.
  through += tint * vec3(1.0, .8, .55) * light * (.025 + opal * .1 + gain * 2.0) + vec3(1.0, .86, .62) * pow(light, 3.0) * .03 * (1.0 - opal);
  // Near the came the glass sits in its channel: a little shadow, and a fine bright line where its edge
  // turns the light.
  float near = edge / kpx;
  gFgTint = tint; gFgNear = near;
  // The last low sun comes level through the glass: strongest in the amber, the gold and the ruby, and
  // gathering along each pane's edge, so the ridges and the forest seem lit from within.
  if (gSun > 0.0) {
    float warm = max(tint.r - tint.b, 0.0), rim = exp(-near / 9.0);
    through += tint * vec3(1.0, .56, .2) * gSun * (.1 + 2.4 * warm * warm + 1.6 * glow) * dens * (.75 + .6 * rim);
    through += vec3(1.0, .4, .08) * gSun * gSun * rim * (.05 + .22 * step(2.5, float(band)) + .5 * glow) * dens;
  }
  through *= .78 + .22 * smoothstep(1.5, 6.0, near);
  through += tint * (.03 + gain * .25) * smoothstep(3.0, 1.6, near) * smoothstep(1.0, 1.8, near);
  // Each pane sits at its own slight angle, so each catches the room's light a little differently.
  through += vec3(.012, .014, .013) * (noise(xz / 4.0 + seed * 1.7) - .3);
  // (As a glass first takes the light it flares, then settles.)
  // (The last light, passing through: each glass flares as it takes it, then settles into the night.)
  float flare = 4.0 * lit * (1.0 - lit);
  through += tint * vec3(1.0, .6, .28) * flare * (.2 + .6 * gain + .3 * glow) + through * flare * 1.2;
  vec3 col = mix(under, through, lit);
  // The came: dark bronze, rounded, the lantern catching its crown; a joint's solder brighter.
  float w = clamp(mpx * .09, 1.1, 2.2) * mix(.35, 1.0, lead);
  float dl = edge / kpx;
  float aa = fwidth(edge) / kpx + .5;
  float cameA = smoothstep(w + aa, w - aa, dl);
  float prof = 1.0 - clamp(dl / max(w, 1e-3), 0.0, 1.0);
  vec3 bronze = vec3(.007, .006, .005) + BRASS * pow(prof, 6.0) * (.05 + light * .55) * lead;
  // (The glass's light halates a little over the came's edge.)
  bronze += through * lit * .18 * pow(1.0 - prof, 3.0);
  col = mix(col, mix(vec3(.36, .22, .1), bronze, lead), cameA * mix(.55, 1.0, lead));
  float sol = smoothstep(w * 1.6 + aa, w * 1.6 - aa, solder * FG_M / kpx) * lead;
  col = mix(col, vec3(.03, .028, .024) + vec3(.9, .82, .65) * pow(light, 2.0) * .3, sol);
  return col;
}
// The world, at rest: the window lit, every summit glowing. Linear, and as displayed.
vec3 sceneFolioLin(vec2 px) {
  vec2 xz = fgMap(px);
  float sd[FG_NB], solder = 1e3;
  for (int k = 0; k < FG_NB; k++) sd[k] = 1.0;
  if (uPlateOn > .5) fgLeading(xz, sd, solder);
  vec3 col = fgShade(px, xz, sd, solder, 1.0, 8.0, 48.0, vec3(0.0));
  vec2 uv = px / R;
  col *= 1.0 - .5 * pow(length((uv - vec2(.5, .48)) * vec2(1.0, 1.15)), 2.4);
  return col;
}
vec3 sceneFolio(vec2 px) { return fgDisp(sceneFolioLin(px)); }
`;
