// Photography → Chess: ink finding order (ink-plan.js holds the clock and the maths this mirrors).
// Three passes of their own (transit.js draws them into float targets), then the ground:
//   PLUME_MAP: a flow's backward map. Each texel's point stepped backward through a frame of four cores
//     and a body to its material coordinates; rg where it came from, less where it is. Drawn once for the
//     whorls (over the screen) and once a drop (a tile each: the half plane through its axis).
//   PLUME_INK: the ink, seen. Each pixel is carried back through the whorls, and then, for each drop, the
//     light lost along its line of sight through the drop (a figure of revolution about the drop's axis):
//     samples out from the axis, each read through the drop's map into the ink as it lay before anything
//     moved. r the black ink's optical depth, g the white's; mipmapped.
//   PLUME_GLSL: the ground (mode 8): the tray rising over the darkroom, the lit water, the ink, the board
//     found in it, its pieces, the tile's own picture of the board, the paper the water lay over.
// Flow units: the screen's shorter side 1, its middle the origin, y down.
import { INK, RING, SHAPES, GLYPH } from '../ink-plan.js';
import { NOISE } from './common.js';
const f = x => Number(x).toFixed(4);
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;
const I = INK, G = RING;

export const PLUME_MAP = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uRect;        // the viewport being drawn, in the target's px
uniform vec4 uSpan;        // the coordinates at its top left (xy) and bottom right (zw)
uniform int uK;            // backward substeps
uniform float uBodyR2;     // the body's radius squared
uniform vec4 uCells[${I.steps[0] * 4}];    // a substep's four cores: x, y, the turn of its centre, its radius squared
uniform vec4 uBodies[${I.steps[0]}];       // its body: x, y, how far it moves
out vec4 o;
// A body moving through the fluid by D (ink-plan.js bodyVel): its velocity at r.
vec2 pmBody(vec2 r, vec2 D) {
  float q = dot(r, r) / uBodyR2, g = inversesqrt(1.0 + q * q), dg = -q * g * g * g / uBodyR2, cr = D.x * r.y - D.y * r.x;
  return vec2(D.x * g + 2.0 * cr * dg * r.y, D.y * g - 2.0 * cr * dg * r.x);
}
void main() {
  vec2 t = (gl_FragCoord.xy - uRect.xy) / uRect.zw;
  vec2 z = mix(uSpan.xy, uSpan.zw, vec2(t.x, 1.0 - t.y)), x = z;
  for (int k = 0; k < uK; k++) {
    for (int i = 3; i >= 0; i--) {
      vec4 c = uCells[k * 4 + i];
      vec2 r = x - c.xy;
      float s = max(dot(r, r) / c.w, 1e-5), ang = -c.z * (1.0 - exp(-s)) / s, cs = cos(ang), sn = sin(ang);
      x = c.xy + vec2(r.x * cs - r.y * sn, r.x * sn + r.y * cs);
    }
    vec4 b = uBodies[k];
    if (dot(b.zw, b.zw) > 0.0) {
      vec2 v = pmBody(x - b.xy, b.zw);
      x -= pmBody(x - .5 * v - b.xy, b.zw);
    }
  }
  o = vec4(x - z, 0.0, 1.0);
}`;

export const PLUME_INK = /* glsl */ `#version 300 es
precision highp float;
#define PI 3.14159265
uniform vec2 uSize;        // the screen, CSS px
uniform vec2 uTexel;       // the target, px
uniform vec3 uCam;         // the view: its centre (CSS px) and how far it has closed
uniform sampler2D uWhorl;  // the whorls' map, over the screen
uniform sampler2D uRings;  // the drops' maps, a tile each, side by side
uniform float uWhorlOn;
uniform int uSight;        // samples along a line of sight
uniform vec4 uDrop[4];     // a drop: its axis's x, the y it fell from, its size, how far it has come on
uniform vec4 uRing[4];     // its ring now (its radius and depth) and its canopy's rim (likewise), in its own units
out vec4 o;
${NOISE}
const vec3 RG_SPAN = vec3(${f(G.span[0])}, ${f(G.span[1])}, ${f(G.span[2])});
// The ink of a drop as it lay before anything moved, at the point m of the half plane through its axis
// (x from the axis, y down from where it fell): a body of it, densest at its middle, in thin nested shells
// (they are what is drawn out into veils); and, up the axis from it, the thread it fell by, a thin tube
// (seen through, two strands) with a fainter one round it. lobe: −1 … 1 round the axis, by which the
// shells are heavier in some directions than others (a ring's lobes).
//   The shells and threads are far thinner than the line of sight's steps, which would step over them or
// land on them, pixel by pixel (bands; with jitter, a halftone). So each is seen as the samples see it:
// dm, how far the material moved between this sample and the last, widens a sheet across which it moved
// to that span, its peak lowered to keep the ink it holds (pmSheet). Where the sight grazes a sheet (its limb)
// the material hardly moves across it, and the sheet stays as thin as it is. (Sampled h apart, a sheet
// exp(−x²/w²) is summed to within 2·exp(−π²w²/h²) of its integral: w ≥ .77 h keeps that under 1%.) And
// none is drawn thinner than about the target's texel (pmPx2), which would step along it in turn.
float pmPx2;
float pmSheet(float x, float w, float dx) { float w2 = w * w + .6 * dx * dx + pmPx2; return exp(-x * x / w2) * w * inversesqrt(w2); }
// A map read smoothly between its texels (a cubic B-spline, in four bilinear reads): read linearly, a map
// that shears hard bends a thin thread into steps at every texel's edge.
vec2 pmSmooth(sampler2D t, vec2 uv) {
  vec2 n = vec2(textureSize(t, 0)), p = uv * n - .5, f = fract(p), i = p - f, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i + w1 / g0 - .5) / n, b = (i + w3 / g1 + 1.5) / n;
  return g0.y * (g0.x * texture(t, a).rg + g1.x * texture(t, vec2(b.x, a.y)).rg)
       + g1.y * (g0.x * texture(t, vec2(a.x, b.y)).rg + g1.x * texture(t, b).rg);
}
float pmDrop(vec2 m, vec2 dm, float lobe, float seed) {
  float stem = 0.0;
  if (m.y < .2) {
    float rt = .024 + .01 * sin(m.y * 7.0 + seed * 3.0), drt = .07 * cos(m.y * 7.0 + seed * 3.0) * dm.y;
    stem = pmSheet(m.x - rt, .008, dm.x - drt) * 13.0 * smoothstep(.2, .04, m.y)
         + pmSheet(m.x - rt * 2.4, .01, dm.x - 2.4 * drt) * 4.5 * smoothstep(.16, -.08, m.y) * (.5 + .5 * sin(m.y * 13.0 + seed));
  }
  // The film it left as it came through the surface: a thin sheet out from the thread, which is drawn
  // down behind the ring as its canopy, its edge rolled under.
  stem += pmSheet(m.y - .01 - .1 * m.x, .009, dm.y - .1 * dm.x) * 5.5 * smoothstep(.4, .3, m.x) * smoothstep(.02, .06, m.x) * (1.0 + .5 * lobe);
  vec2 e = vec2(m.x, (m.y - .15) * .9);
  float le = length(e), d = le - .2;
  if (d > .06) return stem;
  // (How far the sight moved across the shells, and round them.)
  float dd = dot(e * vec2(1.0, .9), dm) / max(le, 1e-4), da = length(dm) / max(le, .02);
  d += (noise(m * 9.0 + seed * 7.0) - .5) * .03;
  float veil = smoothstep(.01, -.06, d) * .45, sh = 0.0;
  for (int j = 0; j < 3; j++) { float fj = float(j); sh += pmSheet(d + .062 * fj, .009, dd) * (9.5 - 1.8 * fj); }
  // (The shells are streaked, as ink drawn out is; to their mean where the samples are too far apart to see it.)
  float streak = .55 + .9 * mix(noise(vec2(atan(m.x, m.y - .15) * 7.0 + seed, d * 30.0)), .5, smoothstep(.35, 1.0, max(abs(dd) * 30.0, da * 7.0)));
  return stem + veil + sh * streak * (1.0 + .6 * lobe);
}
// The ink at s along the line of sight past the drop's axis at X (ax = |X|), Y (its own units), weighted
// for the sum (the Abel kernel). last: the sample before, where it was and in the material (none for the
// first, i = 0, whose step is as far as r goes there).
float pmInk(float s, float ds, int i, float X, float ax, float Y, float fk, float uneven, vec4 g, inout vec4 last) {
  float r = ax + s * s;
  float ca = clamp(X / max(r, 1e-4), -1.0, 1.0), c3 = ca * (4.0 * ca * ca - 3.0), c5 = ca * (16.0 * ca * ca * ca * ca - 20.0 * ca * ca + 5.0);
  float rr = r * (1.0 + uneven * (.13 * c3 * cos(fk * 2.3 + .7) + .07 * c5 * sin(fk * 1.7 + 2.0)));
  float yy = Y + uneven * r * (.2 * ca * cos(fk * 1.3 + .4) + .1 * c3 * sin(fk * 2.9));
  vec2 m = vec2(rr, yy) + texture(uRings, vec2((fk + clamp(rr / RG_SPAN.x, .004, .996)) * .25, 1.0 - (yy - RG_SPAN.y) / (RG_SPAN.z - RG_SPAN.y))).rg;
  // The step here, where it is and in the material: from the last sample, as far as r goes in a step
  // here (dr/ds = 2s; it went (2s − ds)·ds since the last); the first, as far as r went.
  float on = i == 0 ? 1.0 : 2.0 * s / (2.0 * s - ds);
  vec2 dq = i == 0 ? vec2(2.0 * s * ds, 0.0) : (vec2(rr, yy) - last.xy) * on, dm = i == 0 ? dq : (m - last.zw) * on;
  last = vec4(rr, yy, m);
  float ink = pmDrop(m, dm, c5 * cos(4.0 * m.y + fk * 2.1), fk * 3.7 + 1.0);
  // The ink the ring has gathered into its core, where it is now (a ring seen edge on is a bar, dark at
  // its ends), likewise as wide as the step at least.
  float cw = .0024 + .6 * dot(dq, dq) + pmPx2;
  ink += exp(-(pow(rr - g.x, 2.0) + pow(yy - g.y, 2.0)) / cw) * 13.0 * sqrt(.0024 / cw) * (1.0 + .45 * c5 * cos(fk * 1.9 + 1.0));
  return ink * r * inversesqrt(2.0 * ax + s * s + 1e-5);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uTexel;
  vec2 q = vec2(gl_FragCoord.x, uTexel.y - gl_FragCoord.y) / uTexel * uSize;
  q = uCam.xy + (q - uCam.xy) / uCam.z;
  vec2 z = (q - uSize * .5) / min(uSize.x, uSize.y);
  if (uWhorlOn > .5) z += pmSmooth(uWhorl, uv);
  vec2 depth = vec2(0.0);
  for (int k = 0; k < 4; k++) {
    vec4 d = uDrop[k];
    if (d.w <= 0.0) continue;
    float X = (z.x - d.x) / d.z, Y = (z.y - d.y) / d.z, ax = abs(X), rmax = RG_SPAN.x - .03;
    if (ax >= rmax || Y <= RG_SPAN.y + .01 || Y >= RG_SPAN.z - .01) continue;
    // Along the line of sight, out from where it passes nearest the axis: r = |X| + s², whose integrand
    // is smooth (the light lost through a figure of revolution: 2 ∫ ρ r dr / √(r² − X²)).
    float S = sqrt(rmax - ax), ds = S / float(uSight), sum = 0.0, fk = float(k), px = uSize.x / (uTexel.x * uCam.z * min(uSize.x, uSize.y) * d.z);
    pmPx2 = .3 * px * px;
    vec4 g = uRing[k];
    // (It does not stay a figure of revolution: as it slows it leans, and its ring and veils grow lobes
    // round the axis, three and five, more as it goes.)
    float uneven = smoothstep(.15, .9, g.y);
    // Each sample at the middle of its step, the same for every pixel. (Not jittered: the ink is densest
    // where the sight is nearest the axis, at a thread's edge seen along its length, so a sum whose steps
    // began a random fraction from there would differ pixel to pixel by that fraction of it, a halftone;
    // and with its sheets as wide as its steps, a fixed sum has no bands to break up.)
    vec4 last = vec4(0.0);
    for (int i = 0; i < uSight; i++) sum += pmInk(ds * (float(i) + .5), ds, i, X, ax, Y, fk, uneven, g, last);
    float through = 4.0 * d.z * sum * ds * d.w;
    if (k == 0 || k == 2) depth.x += through; else depth.y += through;
  }
  o = vec4(depth, 0.0, 1.0);
}`;

// A piece's place in the order (ink-plan.js pieceAt), as the shader works it out.
const PIECES = /* glsl */ `
// The piece on (file, row) at the start (row 0 the top): x its silhouette (-1: none), y 1 if white, z when
// it begins to form (0 … 1).
vec3 pmPiece(float file, float row) {
  if (row > 1.5 && row < 5.5) return vec3(-1.0);
  float white = step(5.5, row), mid = abs(file - 3.5);
  bool back = row < .5 || row > 6.5;
  // R N B Q K B N R, as silhouettes K Q B N R P (0 … 5)
  float shape = 5.0, when = .52 + .1 * mid;
  if (back) {
    if (mid > 3.0) { shape = 4.0; when = .26; }
    else if (mid > 2.0) { shape = 3.0; when = 0.0; }
    else if (mid > 1.0) { shape = 2.0; when = .36; }
    else { shape = file < 3.5 ? 1.0 : 0.0; when = .12; }
  }
  return vec3(shape, white, clamp(when + .06 * white, 0.0, 1.0));
}
`;

export const PLUME_GLSL = PIECES + /* glsl */ `
uniform sampler2D uFlow;     // the ink, seen (PLUME_INK; unit 8)
uniform sampler2D uGlyph;    // the silhouettes' signed distances (unit 9)
uniform sampler2D uBoard;    // the tile's own picture of its card and board (unit 10)
uniform float uBoardOn;
uniform float uCardRot;      // the card's turn (rad)
uniform vec3 uCam;           // the view: its centre (CSS px) and how far it has closed
const vec2 PM_WATER = ${v2(I.water)}, PM_LIGHT = ${v2(I.light)}, PM_ENTER = ${v2(I.enter)}, PM_FOLD = ${v2(I.fold)};
const vec2 PM_LAT = ${v2(I.lattice)}, PM_CARD = ${v2(I.card)}, PM_SQ = ${v2(I.squares)}, PM_TIGHT = ${v2(I.tighten)};
const vec2 PM_RISE = ${v2(I.rise)}, PM_PIECES = ${v2(I.pieces)}, PM_FINISH = ${v2(I.finish)}, PM_LOOSE = ${v2(I.loose)}, PM_STILL = ${v2(I.still)};
const float PM_SPAN = ${f(I.span)}, PM_GLYPH = ${f(2 * GLYPH.range / GLYPH.cell)}, PM_NSHAPE = ${f(SHAPES.length)};
const vec3 PM_INK = vec3(.11, .102, .09), PM_PEARL = vec3(.984, .973, .945);
float pmS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }

// The lit water at z: white light from above, falling off into the deep and to its sides; faint shafts;
// motes hanging in it. lit: how far the white light has come on.
vec3 pmWater(vec2 z, vec2 h, float lit) {
  float down = clamp((z.y + h.y) / (2.0 * h.y), 0.0, 1.0);
  float pool = exp(-pow(length(vec2(z.x * .55, (z.y + h.y * 1.25) * .8)) / .95, 2.0));
  vec3 col = mix(vec3(.02, .022, .026), vec3(.5, .51, .53), pool * lit) * mix(1.0, .5, down * down);
  col += vec3(.035, .037, .04) * lit;
  float shaft = noise(vec2(z.x * 4.0 - z.y * .7, T * .04)) * noise(vec2(z.x * 9.0 - z.y * 1.6 + 5.0, T * .03));
  col *= 1.0 + .55 * lit * (shaft - .25) * (1.0 - down);
  vec2 g = z * 44.0 + vec2(T * .02, -T * .03), id = floor(g);
  float tw = hash(id);
  if (tw > .92) col += vec3(.55, .56, .58) * lit * exp(-pow(length(fract(g) - .5 - (hash2(id) - .5) * .6) / .07, 2.0)) * (.3 + .7 * pool) * (.5 + .5 * sin(T * 1.3 + tw * 40.0));
  return col;
}
// The card's frame: a point of the screen in the card's own px (its top left the origin), the card turned
// about its middle.
vec2 pmCard(vec2 q) { vec2 c = uCard.xy + uCard.zw * .5; return rot(-uCardRot) * (q - c) + uCard.zw * .5; }
// The tile's picture of the card at card px X.
vec3 pmPicture(vec2 X) { return texture(uBoard, X / uCard.zw).rgb; }
// A silhouette's signed distance at p of its square (0 … 1), in squares (< 0 inside).
float pmGlyph(float shape, vec2 p) { return (texture(uGlyph, vec2((shape + clamp(p.x, .01, .99)) / PM_NSHAPE, clamp(p.y, 0.0, 1.0))).r - .5) * PM_GLYPH; }

// The board found in the water, over col at screen point qc (the view's own px): the white pooled as the
// card; black along the lines between the squares, spreading into every other one and tightening; the
// frame's line; the pieces, each a plume carved to its silhouette; then the tile's own picture of it all.
// light: the white light there. cover: how far the card hides what is behind it.
vec3 pmBoardOver(vec3 col, vec2 qc, float P, float light, out float cover) {
  cover = 0.0;
  if (P < PM_LAT.x) return col;
  vec2 X = pmCard(qc), half_ = uCard.zw * .5;
  float pad = uCardR, sq = (uCard.z - 2.0 * pad) / 8.0, tight = pmS(PM_TIGHT, P);
  // The card: it gathers from its middle, its edge unsettled until it tightens.
  float grow = pmS(PM_CARD, P), finish = pmS(PM_FINISH, P) * uBoardOn;
  float dc = max(abs(X.x - half_.x) - half_.x, abs(X.y - half_.y) - half_.y);
  float edge = (fbm3(X / (sq * 1.6) + vec2(T * .05, -T * .04)) - .5) * sq * 2.2 * (1.0 - tight);
  cover = smoothstep(1.2, -1.2, dc + (1.0 - grow) * (max(half_.x, half_.y) * 1.25) + edge * grow);
  if (cover <= 0.0) return col;
  vec3 card = mix(PM_PEARL * (.42 + .58 * light), PM_PEARL, pmS(PM_RISE, P));
  // On the board: squares, files and rows.
  vec2 b = (X - pad) / sq;
  bool on = all(greaterThan(b, vec2(0.0))) && all(lessThan(b, vec2(8.0)));
  float ink = 0.0;
  if (on) {
    // (What is left of the lattice's stir moves the lines a little, less as they tighten.)
    vec2 st = vec2(sin(PI * b.x) * cos(PI * b.y), -cos(PI * b.x) * sin(PI * b.y));
    vec2 bs = b + st * .09 * (1.0 - tight) * sin(T * .6 + 6.0 * P) + (vec2(noise(b * 1.7 + T * .07), noise(b * 1.7 + 9.0 - T * .06)) - .5) * .22 * (1.0 - tight);
    vec2 fr = fract(bs), cell = floor(bs);
    float e = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
    // Threads along the lines, knotted where they cross (where strain beats rotation: Okubo–Weiss).
    float lat = pmS(PM_LAT, P), fill = pmS(PM_SQ, P);
    float ow = pow(cos(PI * bs.x) * cos(PI * bs.y), 2.0);
    float thread = exp(-pow(e * sq / mix(1.4, 3.6, lat), 2.0)) * (.55 + .7 * ow) * lat * (1.0 - fill);
    // Every other square fills from its edges inward, and soaks in, down to the tile's wash.
    float dark = mod(cell.x + cell.y, 2.0);
    float fills = dark * smoothstep(-.06, .06, fill * .62 - e + (noise(bs * 5.0 + 3.0) - .5) * .3 * (1.0 - tight));
    ink = thread * 1.6 + fills * mix(1.5, .225, pmS(vec2(PM_SQ.y - .04, PM_PIECES.y), P));
    // The frame's line.
    float df = abs(max(abs(b.x - 4.0), abs(b.y - 4.0)) - 4.0) * sq;
    ink += smoothstep(sq * .05, sq * .02, df) * 2.4 * pmS(vec2(PM_SQ.x + .04, PM_SQ.y), P);
  }
  vec3 face = card * exp(-ink) + PM_INK * (1.0 - exp(-ink));
  // The pieces.
  if (on && P > PM_PIECES.x) {
    vec2 cell = floor(b), p = fract(b);
    vec3 pc = pmPiece(cell.x, cell.y);
    float t = (P - mix(PM_PIECES.x, PM_PIECES.y, pc.z)) / PM_SPAN;
    if (pc.x >= 0.0 && t > 0.0) {
      // A plume rising in its square: a stem and a cap, swelling; then clear water carves it.
      float up = smoothstep(0.0, .35, t), swell = smoothstep(.15, .6, t), carve = smoothstep(.42, .9, t);
      vec2 c0 = vec2(.5, mix(.98, .5, up));
      float cap = length((p - c0) * vec2(1.0, 1.25)) - mix(.05, .34, swell);
      vec2 sp = p - vec2(.5 + .03 * sin(p.y * 9.0 + T), 0.0);
      float stem = max(abs(sp.x) - mix(.035, .1, swell), c0.y - p.y);
      float dp = min(cap, stem) + (noise(qc * .07 + cell * 3.0 + vec2(0.0, -T * .2)) - .5) * .12;
      float dg = pmGlyph(pc.x, p);
      float d = mix(dp, dg, carve);
      float aa = mix(.045, 1.2 / sq, carve);
      float cov = smoothstep(aa, -aa, d) * smoothstep(0.0, .1, t);
      // Black: dense, absorbing, a little light on its near side. White: lit pigment, a dark hairline
      // where the water left it.
      float deep = smoothstep(0.0, -.12, d);
      vec3 body = pc.y < .5 ? PM_INK * mix(1.5, .5, deep) : mix(PM_PEARL * (.55 + .45 * light) * mix(.82, 1.0, deep), PM_INK, .7 * carve * exp(-pow(d / .022, 2.0)));
      face = mix(face, body, cov);
    }
  }
  // The tile's own picture: its washes' edges, its pieces' ivory and obsidian, their gloss.
  if (finish > 0.0) face = mix(face, pmPicture(X), finish);
  return mix(col, face, cover);
}

// The ink as seen (uFlow), read smoothly between its texels: it is drawn at a fraction of the screen's
// pixels, and read linearly a few times its size each texel's own error shows as a dot (a cubic B-spline,
// in four bilinear reads, is as soft as the ink and has none).
vec2 pmSeen(vec2 uv) {
  vec2 n = vec2(textureSize(uFlow, 0)), p = uv * n - .5, f = fract(p), i = p - f, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i + w1 / g0 - .5) / n, b = (i + w3 / g1 + 1.5) / n;
  return g0.y * (g0.x * textureLod(uFlow, a, 0.0).rg + g1.x * textureLod(uFlow, vec2(b.x, a.y), 0.0).rg)
       + g1.y * (g0.x * textureLod(uFlow, vec2(a.x, b.y), 0.0).rg + g1.x * textureLod(uFlow, b, 0.0).rg);
}
vec3 groundPlume(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  if (P <= PM_WATER.x || uIceReady < .5) return P < .5 ? sceneDarkroom(px) : sceneInk(px);
  float m = min(S.x, S.y);
  vec2 h = .5 * S / m;
  // The view: closed on the board while its pieces form.
  vec2 qc = uCam.xy + (q - uCam.xy) / uCam.z, pc = px + (qc - q), z = (qc - S * .5) / m;
  float lit = pmS(PM_LIGHT, P), rise = pmS(PM_RISE, P);
  float level = S.y * (1.06 - 1.14 * pmS(PM_WATER, P)) + 5.0 * sin(q.x * .013 + T * 1.1) + 3.0 * sin(q.x * .031 - T * 1.6);
  if (q.y < level - 6.0) return sceneDarkroom(px);
  // The ink, seen: how much black and how much white lies along this line of sight; what lies toward
  // the light shades it; where it thickens it bends what is behind it.
  float flowing = step(PM_ENTER.x, P) * (1.0 - pmS(PM_LOOSE, P));
  vec2 uv = vec2(q.x / S.x, 1.0 - q.y / S.y), ink = vec2(0.0), shade = vec2(0.0), bend = vec2(0.0);
  if (flowing > 0.0) {
    ink = pmSeen(uv) * flowing;
    shade = textureLod(uFlow, uv + vec2(0.0, .04), 3.0).rg * flowing;
    vec2 e = vec2(5.0 / S.x, 0.0), ey = vec2(0.0, 5.0 / S.y);
    vec2 gx = textureLod(uFlow, uv + e, 1.5).rg - textureLod(uFlow, uv - e, 1.5).rg, gy = textureLod(uFlow, uv + ey, 1.5).rg - textureLod(uFlow, uv - ey, 1.5).rg;
    bend = vec2(gx.x + gx.y, -(gy.x + gy.y)) * 9.0 * (1.0 - pmS(PM_STILL, P));
  }
  // What is behind: the lit water, and, rising through it at the end, the paper.
  vec3 col = pmWater(z + bend * .012, h, lit);
  // (White pigment let go into the water lifts all of it toward pearl before the paper shows.)
  col = mix(col, vec3(.6, .6, .59), .5 * smoothstep(.4, .8, P) * (1.0 - rise));
  if (rise > 0.0) col = mix(col, sceneInk(pc + bend * 30.0 * (1.0 - rise)), rise * rise * (3.0 - 2.0 * rise));
  float light = lit * (.3 + .7 * exp(-pow(length(vec2(z.x * .55, (z.y + h.y * 1.2) * .7)) / 1.1, 2.0))) * exp(-.5 * shade.x - .2 * shade.y);
  light = mix(light, 1.0, rise);
  // The board, behind the ink still moving over it.
  float cover;
  col = pmBoardOver(col, qc, P, light, cover);
  // Black takes light out along the sight line (dense where its sheets are seen edge on, a veil where
  // they are seen face on); white is lit grains, shaded by what lies above them.
  float thin = 1.0 - .8 * cover * pmS(PM_SQ, P), grain = .9 + .2 * noise(q * 1.7 + T * .3);
  float B = ink.x * 1.9 * thin * grain, W = ink.y * 1.7 * thin * grain;
  col = col * exp(-B) + PM_INK * .4 * (1.0 - exp(-B));
  col = col * exp(-.5 * W) + PM_PEARL * (.14 + .86 * light) * (1.0 - exp(-W));
  // The tray's surface, where it is still on screen: a bright meniscus, and the darkroom over it.
  col += vec3(.75, .76, .8) * exp(-pow((q.y - level) / 3.0, 2.0)) * .5 * (.4 + .6 * lit);
  return mix(col, sceneDarkroom(px), smoothstep(level + 6.0, level - 6.0, q.y));
}

// ---- A click into Chess (opens.js) ------------------------------------------------------------------
// The same story at the click, seen from above: black and white ink let fall there bloom out over the
// old page as one front, which rolls up into mushroom pairs as it goes (a ring of Lamb–Oseen vortices of
// alternating sign riding just behind it, each turning the water about it, the more the nearer its
// core: the material map undone, as PLUME_MAP does). The water is lit grey under it. Then order spreads
// out from the board's middle: the ink is gathered onto eight by eight squares, lines first and every
// other square filling, straightening as the stir dies, while the paper rises through the water. On the
// new page (pmcReveal) the squares soften and soak into it, from the middle out.
const int PMC_N = 10;
// The board: its middle (the click's, kept clear of the screen's edges and the header) and its square.
vec3 pmcBoard(vec2 O) {
  float c = clamp(min(R.x, R.y) * .085, 26.0, 64.0);
  vec2 lo = vec2(4.0 * c + 12.0, 4.0 * c + 76.0), hi = R - 4.0 * c - 12.0;
  return vec3(hi.x > lo.x ? clamp(O.x, lo.x, hi.x) : R.x * .5, hi.y > lo.y ? clamp(O.y, lo.y, hi.y) : R.y * .5, c);
}
// Where the ink at px lay when it fell: the vortices' turnings undone, the last first (the front's ring,
// then three of one sign about the middle, which turn the inside of the bloom slowly round). front: the
// bloom's radius now.
vec2 pmcTurn(vec2 x, vec2 c, float core, float G) {
  vec2 r = x - c;
  float s = max(dot(r, r) / (core * core), 1e-5);
  return c + rot(-G * (1.0 - exp(-s)) / s) * r;
}
vec2 pmcBack(vec2 px, vec2 O, float front, float E) {
  float spin = smoothstep(0.0, .5, E) * (1.0 - .5 * smoothstep(.6, 1.0, E));
  vec2 x = px;
  for (int k = 2; k >= 0; k--) {
    float a = float(k) * TAU / 3.0 + 1.1 + .6 * E;
    x = pmcTurn(x, O + vec2(cos(a), sin(a)) * front * .38, front * .3 + 8.0, 2.2 * spin);
  }
  for (int k = PMC_N - 1; k >= 0; k--) {
    float fk = float(k), h = hash(vec2(fk, 7.3));
    float a = (fk + .5 * h) * TAU / float(PMC_N) + .35 * E;
    vec2 c = O + vec2(cos(a), sin(a)) * front * (.84 + .1 * h);
    x = pmcTurn(x, c, front * (.09 + .05 * h) + 8.0, (mod(fk, 2.0) < .5 ? 1.0 : -1.0) * (2.4 + 1.6 * h) * spin);
  }
  return x;
}
// The click's ink at E (its clock, 0 … 1.04 over the old page; on, as the new page lets it go), and
// relax (0 … 1, the new page's own): its colour, and how much of the old page it covers.
vec4 pmcLook(vec2 px, vec2 O, float far, float E, float relax) {
  vec3 Bd = pmcBoard(O);
  vec2 C = Bd.xy;
  float c = Bd.z, front = far * (.04 + 1.02 * smoothstep(0.0, .62, E));
  vec2 X = pmcBack(px, O, front, E);
  float rX = length(X - O), dye = smoothstep(front + 5.0, front - 5.0, rX);
  float a = max(dye, smoothstep(.72, .96, E));
  // The bloom: billows of black and of white (warped fbm, in the ink's own place, so the turning folds
  // them into each other), thin sheets where they meet (ridged noise), thinner at its middle and pooled
  // at its front.
  vec2 wq = (X - O) * .0045;
  wq += (vec2(fbm3(wq * 1.6 + 2.0), fbm3(wq * 1.6 + 7.3)) - .5) * 1.6;
  float white = smoothstep(.42, .58, fbm3(wq + 11.0)), billow = smoothstep(.3, .75, fbm3(wq * 1.8 + 4.0));
  float sheet = pow(1.0 - abs(2.0 * noise(wq * 7.0) - 1.0), 10.0);
  float dens = dye * ((.2 + .9 * billow + .25 * sheet) * (.45 + .55 * smoothstep(.1, 1.0, rX / max(front, 1.0))) + 1.3 * exp(-pow((rX - front * .94) / (front * .05 + 3.0), 2.0)));
  // Order, from the board's middle out; then (relax) its letting go, likewise.
  float d = clamp(length(px - C) / far, 0.0, 1.0), to = .4 + .3 * d, k = smoothstep(to, to + .3, E);
  float gone = smoothstep(.05 + .4 * d, .5 + .4 * d, relax), soft = relax * relax;
  vec2 b = (px - C) / c + 4.0, bs = b + (X - px) / c * .3 * (1.0 - k);
  float Bo = .1 * (.6 + .8 * noise(px * .01)) * (1.0 - gone), Wo = 0.0;
  if (all(greaterThan(bs, vec2(-.3))) && all(lessThan(bs, vec2(8.3)))) {
    vec2 fr = fract(bs), cell = floor(bs);
    bool on = all(greaterThan(bs, vec2(0.0))) && all(lessThan(bs, vec2(8.0)));
    float e = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
    float lat = smoothstep(to - .06, to + .12, E), fill = smoothstep(to + .06, to + .3, E);
    float ow = pow(cos(PI * bs.x) * cos(PI * bs.y), 2.0);
    float thread = exp(-pow(e * c / mix(1.4, 3.0, lat) / (1.0 + 4.0 * soft), 2.0)) * (.55 + .7 * ow) * lat * (1.0 - fill);
    float dark = mod(cell.x + cell.y, 2.0), w = .06 + .3 * soft;
    float fills = dark * smoothstep(-w, w, fill * .62 - e + (noise(bs * 5.0 + 3.0) - .5) * .3 * (1.0 - k));
    float df = abs(max(abs(bs.x - 4.0), abs(bs.y - 4.0)) - 4.0) * c;
    float frame = smoothstep(c * .05 * (1.0 + 6.0 * soft), c * .02, df) * fill;
    if (on) { Bo += (thread * 1.6 + fills * 1.5) * (1.0 - gone); Wo = (1.0 - dark) * fill * .5 * (1.0 - gone); }
    Bo += frame * 2.2 * (1.0 - gone);
  }
  float Bk = mix(dens * (1.0 - white) * 1.7, Bo, k), Wt = mix(dens * white * 1.5, Wo, k);
  // Under it the lit water, and the paper rising through it.
  float m = min(R.x, R.y);
  vec3 col = mix(pmWater((px - R * .5) / m, R * .5 / m, 1.0), sceneOf(1, px), smoothstep(to + .1, to + .45, E));
  col = col * exp(-Bk) + PM_INK * .4 * (1.0 - exp(-Bk));
  col = col * exp(-.4 * Wt) + PM_PEARL * (1.0 - exp(-Wt));
  return vec4(col, a);
}
vec4 pmcCover(vec2 px, vec2 O, float far, float E) { vec4 l = pmcLook(px, O, far, E, 0.0); return vec4(l.rgb * l.a, l.a); }
vec3 pmcReveal(vec2 px, vec2 O, float far, float e) { return pmcLook(px, O, far, 1.04 + .3 * e, e).rgb; }
`;
