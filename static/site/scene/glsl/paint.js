// Racing → Outdoors's first act (glsl/peaks.js): a primed canvas seen from straight above, thick paint
// landing on it a drop at a time, and the paint creeping out along the land until the canvas is the
// painted map (paint-plan.js works out where and when). Read from uReach (unit 5) while the seam draws:
// rows 0..255 the paint's arrival over the map (T, colour), row 256 the drops.
//   Physical: each drop's splash (its spread, Allen's fingers, the satellites their tips pinch off, the
//   spray, an oblique drop's stretch downrange); the paint's thickness lit as impasto (its slope from
//   the height's derivatives, a key light from the upper left, a wet gloss, the shadow its rim casts).
//   Artistic: the canvas's weave, the paint's colours and strokes, the pace.
import { PAINT } from '../paint-plan.js';
const f = x => Number(x).toFixed(4);
export const PAINT_GLSL = /* glsl */ `
const float PT_FALL = ${f(PAINT.fall)}, PT_SPREAD = ${f(PAINT.spread)}, PT_FINGERS = ${f(PAINT.fingers)}, PT_PINCH = ${f(PAINT.pinch)};
const float PT_OWN0 = ${f(PAINT.own[0])}, PT_OWN1 = ${f(PAINT.own[1])}, PT_MELT = ${f(PAINT.melt)}, PT_MOLD1 = ${f(PAINT.mold[1])}, PT_REAL0 = ${f(PAINT.real[0])}, PT_REAL1 = ${f(PAINT.real[1])};
const int PT_N = ${PAINT.grid}, PT_MAX = ${PAINT.maxSplash}, PT_CELLS = ${PAINT.cells};
// The studio's key light, from the upper left (screen: x right, y up, z out of the canvas).
const vec3 PT_L = vec3(-.5735, .5735, .5848);
vec4 ptHead() { return texelFetch(uReach, ivec2(0, PT_N), 0); }
// The place of the lowest bit set (from its float's exponent: GLSL ES 3.00 has no findLSB).
int ptLow(uint bits) { return int(floatBitsToUint(float(bits & (~bits + 1u))) >> 23u) - 127; }
// The drops that can reach map point xz at all (paint-plan.js paintReach): a bit a drop, twenty a channel.
vec4 ptNear(vec2 xz) {
  ivec2 c = clamp(ivec2(floor(xz / PK_SIZE * float(PT_CELLS))), ivec2(0), ivec2(PT_CELLS - 1));
  int k = c.y * PT_CELLS + c.x;
  return texelFetch(uReach, ivec2(k % PT_N, PT_N + 1 + k / PT_N), 0);
}
// The paint's arrival at map point xz (P) and the colour it brings, bilinear between cells.
vec4 ptGrid(vec2 xz) {
  vec2 g = xz / PK_SIZE * float(PT_N) - .5, fr = fract(g);
  ivec2 i = ivec2(floor(g)), a = clamp(i, ivec2(0), ivec2(PT_N - 1)), b = clamp(i + 1, ivec2(0), ivec2(PT_N - 1));
  vec4 v00 = texelFetch(uReach, a, 0), v10 = texelFetch(uReach, ivec2(b.x, a.y), 0);
  vec4 v01 = texelFetch(uReach, ivec2(a.x, b.y), 0), v11 = texelFetch(uReach, b, 0);
  return mix(mix(v00, v10, fr.x), mix(v01, v11, fr.x), fr.y);
}
// Autumn's paints, yellow to crimson (paint-plan.js AUTUMN).
vec3 ptAutumn(float x) {
  x = clamp(x, 0.0, .999) * 4.0;
  vec3 a = vec3(.88, .64, .04), b = vec3(.82, .44, .03), c = vec3(.86, .25, .02), d = vec3(.64, .05, .02), e = vec3(.44, .02, .04);
  return x < 1.0 ? mix(a, b, x) : x < 2.0 ? mix(b, c, x - 1.0) : x < 3.0 ? mix(c, d, x - 2.0) : mix(d, e, x - 3.0);
}
// The land as the painter paints it: its kind's colours, lighter on the slopes that face the light and
// cooler in the shade, laid on in strokes that follow the contours. g: the land's slope (drawn).
vec3 ptLand(vec2 xz, vec4 t, vec2 g, float fp) {
  float gl = length(g);
  vec2 gd = gl > 1e-5 ? g / gl : vec2(0.0, 1.0), tg = vec2(-gd.y, gd.x);
  float fS = smoothstep(.06, .02, fp), fB = smoothstep(.2, .07, fp);
  float s1 = mix(.5, noise(vec2(dot(xz, tg) / .8, dot(xz, gd) / .1) + 3.0), fS);
  float s2 = mix(.5, noise(vec2(dot(xz, tg) / 2.6, dot(xz, gd) / .4) - 5.0), fB);
  float lit = clamp(.55 - dot(g, PT_L.xy) * 1.4, 0.0, 1.0);
  int fam = pkCover(t);
  vec3 c;
  if (fam == 0) {
    float dep = t.g - t.r;
    c = mix(vec3(.04, .26, .52), vec3(.03, .08, .42), smoothstep(.002, .012, dep)) * (.85 + .3 * s1);
    return c;
  }
  if (fam == 1) c = mix(vec3(.46, .5, .64), vec3(.9, .9, .88), lit) * (.92 + .16 * s1);
  else if (fam == 2) c = mix(mix(vec3(.02, .1, .07), vec3(.03, .13, .05), s2), mix(vec3(.1, .26, .04), vec3(.04, .22, .12), s2), lit) * (.85 + .3 * s1);
  else c = ptAutumn(t.a + .38 * (s1 - .5) + .3 * (s2 - .5)) * mix(.62, 1.12, lit);
  return c;
}
// How far (ft) a point is from the band of height that is kind fam's own (water: never theirs).
float ptOff(float fam, float ft, float wet) {
  if (wet > PK_WET) return 3000.0;
  if (fam < 1.5) return max(PK_WHITE - ft, 0.0);
  if (fam < 2.5) return max(max(PK_GREEN - ft, ft - PK_WHITE), 0.0);
  return max(ft - PK_GREEN, 0.0);
}
// The canvas: gesso over a plain linen weave a few pixels a thread (pitch km); its height.
vec3 ptCanvas(vec2 xz, float pitch, float vis, out float hw) {
  vec2 u = xz / pitch;
  vec2 id = floor(u), fu = fract(u) - .5;
  float slubU = .75 + .5 * hash(vec2(id.x, 3.0)), slubV = .75 + .5 * hash(vec2(7.0, id.y));
  float warp = max(1.0 - pow(abs(fu.x) * 2.0 / slubU, 2.0), 0.0), weft = max(1.0 - pow(abs(fu.y) * 2.0 / slubV, 2.0), 0.0);
  float over = mod(id.x + id.y, 2.0);
  hw = mix(mix(weft * .75 + warp * .3, warp * .75 + weft * .3, over), .5, 1.0 - vis);
  return vec3(.6, .53, .42) * (.92 + .14 * hw) * (.96 + .08 * noise(xz / (pitch * 60.0)));
}
// The paint at map point xz: its colour over col, its height h (in strokes' thickness), its gloss, and
// the shadow the splashes' rims and the falling drops cast on what is under them. ft, wet: the land
// there; land: its painted colour; fp: km a pixel spans.
void ptPaint(vec2 xz, float P, float fp, float ft, float wet, vec3 land, inout vec3 col, inout float h, inout float gloss, inout float shadow) {
  vec4 H = ptHead();
  // The fronts: past them the paint has arrived; just at them a glossy bead; behind them the colour
  // they brought gives way to the land's own.
  // (Looked up a little off true, so the fronts' edges wander as paint does rather than follow the grid.)
  float cell = PK_SIZE / float(PT_N);
  vec4 G = ptGrid(xz + cell * .55 * (vec2(noise(xz / (cell * 2.3)), noise(xz / (cell * 2.3) + 17.0)) - .5));
  float since = P - G.x, bw = max(H.w * 3.0 * fp, .0015);
  float mold = smoothstep(-bw, .0, since);
  if (mold > 0.0) {
    float bead = exp(-pow((since - bw) / (bw * 1.1), 2.0)) * mold;
    vec3 mc = mix(mix(land, G.yzw, .4), land, smoothstep(.004, .04, since));
    col = mix(col, mc * (1.0 + .25 * bead), mold);
    h = mix(h, .28 + .5 * bead, mold);
    gloss = mix(gloss, (.25 + .6 * bead) * (1.0 - smoothstep(.0, .08, since)), mold);
  }
  int n = int(H.x);
  // The drops in the order they land, only those that can reach this part of the map (the others are
  // more than three radii away, where a drop draws nothing: the test below).
  vec4 near = ptNear(xz);
  bool done = false;
  for (int ch = 0; ch < (PT_MAX + 19) / 20; ch++) {
    uint bits = uint(near[ch]);
    for (int bit = 0; bit < 20; bit++) {
      if (bits == 0u) break;
      int i = ch * 20 + ptLow(bits);
      bits &= bits - 1u;
      if (i >= n) { done = true; break; }
      vec4 A = texelFetch(uReach, ivec2(1 + 3 * i, PT_N), 0);
      float age = P - A.z;
      if (age < -PT_FALL) { done = true; break; }
      if (age > PT_OWN1 + PT_MELT) continue;
      vec2 d = xz - A.xy;
      float R = A.w;
      if (dot(d, d) > R * R * 9.0) continue;
      vec4 B = texelFetch(uReach, ivec2(2 + 3 * i, PT_N), 0), C = texelFetch(uReach, ivec2(3 + 3 * i, PT_N), 0);
      float N = B.x, sd = B.y * 97.0;
      // A drop in the air: a bead of paint, nearer the eye the higher it is, its shadow closing on it.
      if (age < 0.0) {
        float u = -age / PT_FALL, rd = R / (2.37 * sqrt(N)) * (1.0 + 1.2 * u);
        vec2 so = -PT_L.xy / PT_L.z * u * R * 1.4;
        shadow = max(shadow, smoothstep(rd * 1.4, rd * .5, length(d - so)) * (1.0 - .5 * u) * .55);
        float dd = length(d) / rd;
        if (dd < 1.0) {
          vec3 nd = vec3(d / rd, sqrt(1.0 - dd * dd));
          col = C.rgb * (.35 + .8 * max(dot(nd, PT_L), 0.0)) + pow(max(dot(reflect(-PT_L, nd), vec3(0.0, 0.0, 1.0)), 0.0), 40.0) * .9;
          h = 2.0; gloss = 0.0;
        }
        continue;
      }
      // The splash, in its own frame (stretched downrange along dir if it came in at a slant).
      vec2 ax = vec2(cos(B.w), sin(B.w));
      float skew = B.z;
      vec2 l = vec2(dot(d, ax) - skew * R * .3, dot(d, vec2(-ax.y, ax.x)));
      l.x /= 1.0 + skew;
      float r = length(l), th = atan(l.y, l.x);
      float s = age / PT_SPREAD;
      float Rb = R * (s < 1.0 ? sqrt(s) * 1.08 : 1.08 - .08 * smoothstep(1.0, 2.4, s));
      Rb *= 1.0 + .035 * sin(th * N * 2.0 + sd) + .06 * (noise(vec2(th * 2.0 + sd, sd)) - .5);
      float dist = r - Rb, hh = .55 + .45 * smoothstep(Rb * .45, Rb * .9, r), part = 0.0;
      // Its fingers (N of them, of random lengths, longer downrange), and the satellites their tips
      // pinch off.
      float gf = smoothstep(.3, 1.0, age / PT_FINGERS), pinch = smoothstep(PT_PINCH * .55, PT_PINCH, age);
      float stp = 6.2831853 / N, k0 = floor(th / stp + .5);
      for (int j = -1; j <= 1; j++) {
        float k = k0 + float(j), kk = mod(k, N);
        float hk = hash(vec2(kk, sd)), hk2 = hash(vec2(kk + 31.0, sd)), hk3 = hash(vec2(kk - 17.0, sd));
        float phi = (k + .35 * (hk2 - .5)) * stp;
        vec2 dk = vec2(cos(phi), sin(phi));
        float L = R * (.1 + .6 * hk * hk) * (1.0 + 2.2 * skew * max(dk.x, 0.0)) * gf * (1.0 - .3 * pinch);
        float w = R * (.05 + .06 * hk3);
        vec2 a = dk * Rb * .7, ba = dk * (Rb + L) - a, pa = l - a;
        float u = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float df = length(pa - ba * u) - w * mix(1.0, .5, u);
        dist = smin(dist, df, R * .07);
        if (hk2 > .28 && pinch > 0.0) {
          vec2 sc = dk * (Rb + L + w * (.9 + 2.5 * hk) * pinch + w);
          float rs = w * (.5 + .4 * hk3) * smoothstep(.0, .4, pinch);
          float ds = length(l - sc) - rs;
          if (ds < dist) { dist = ds; part = 1.0; hh = .75 * sqrt(max(1.0 - pow(length(l - sc) / max(rs, 1e-5), 2.0), 0.0)) + .1; }
        }
      }
      // The spray: fine drops thrown out beyond the fingers (more of them downrange).
      float sp = smoothstep(.6, 1.4, s);
      if (sp > 0.0 && r > R * 1.15 && r < R * 2.6) {
        float band = R * .16, ri = floor((r - R * 1.15) / band), ai = floor((th + 3.1415927) / 6.2831853 * 56.0);
        vec2 cid = vec2(ai, ri) + sd;
        float pr = .3 * (1.0 + 1.5 * skew * max(cos(th), 0.0)) * (1.0 - ri / 10.0);
        if (hash(cid) < pr) {
          float rr = R * 1.15 + (ri + .2 + .6 * hash(cid + 1.0)) * band, aa = (ai + .2 + .6 * hash(cid + 2.0)) / 56.0 * 6.2831853 - 3.1415927;
          float rs = R * (.012 + .03 * hash(cid + 3.0)) * sp;
          float ds = length(l - rr * vec2(cos(aa), sin(aa))) - rs;
          if (ds < dist) { dist = ds; part = 1.0; hh = .45; }
        }
      }
      // Drawing back, after it lands, onto its own kind of land: its edge slides along the contours.
      float own = smoothstep(A.z + PT_OWN0, A.z + PT_OWN1, P);
      float off = ptOff(floor(C.w), ft, wet), thr = 3200.0 * pow(1.0 - own, 1.6);
      float keep = 1.0 - smoothstep(thr, thr + 380.0, off);
      float cov = smoothstep(fp * 1.2, -fp * .8, dist) * keep;
      // The rim's shadow on whatever is beneath, away from the light.
      if (dist > 0.0 && part < .5) shadow = max(shadow, (1.0 - smoothstep(0.0, R * .1 + fp * 2.0, dist)) * max(dot(normalize(d), -normalize(PT_L.xy)), 0.0) * .45 * keep);
      if (cov <= 0.0) continue;
      // Its colour: the paint, unevenly mixed, then the land's own as it settles.
      vec3 pc = C.rgb * (.86 + .28 * noise(l / R * 2.5 + sd));
      float melt = smoothstep(A.z + PT_OWN1 - .02, A.z + PT_OWN1 + PT_MELT, P);
      pc = mix(pc, land, melt);
      col = mix(col, pc, cov);
      float edge = smoothstep(.0, R * .06 + fp * 2.0, -dist), settle = 1.0 - melt;
      h = mix(h, max(h * .45, 0.0) + hh * (.35 + .65 * edge) * 1.25 * settle * keep, cov);
      gloss = mix(gloss, mix(.9, .06, smoothstep(.0, .1, age)) * (1.0 - melt), cov);
    }
    if (done) break;
  }
}
// The painting at map point xz, lit in the studio (the top view, before it rises): colour (linear).
// pitch: the canvas's thread; e: the screen's derivative scale for the paint's slope.
vec3 ptStudio(vec2 xz, float P, float fp, float pitch, vec4 t, vec2 g) {
  float hw;
  vec3 col = ptCanvas(xz, pitch, smoothstep(.0, .2, pitch / fp - 2.0), hw);
  float h = 0.0, gloss = 0.0, shadow = 0.0;
  vec3 land = ptLand(xz, t, g, fp);
  ptPaint(xz, P, fp, t.r / PK_KMFT, t.g - t.r, land, col, h, gloss, shadow);
  // The paint's relief and the weave's, as the light sees them (slopes from the screen's derivatives).
  float relief = h * 2.2 + hw * .35 * (1.0 - smoothstep(.0, .4, h));
  vec2 dh = vec2(dFdx(relief), dFdy(relief));
  vec3 n = normalize(vec3(-dh, 1.0));
  float dif = max(dot(n, PT_L), 0.0) / PT_L.z;
  vec3 hv = normalize(PT_L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 70.0) * gloss;
  return col * (.2 + .88 * dif) * (1.0 - shadow) + vec3(1.0, .97, .9) * spec * .9;
}
`;
