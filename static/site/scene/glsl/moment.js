// Outdoors → Photography, and the click into Photography: the thickness of a moment (moment-plan.js
// holds the clock and the maths this mirrors). Outdoors' window opens into the depth of a whole
// evening, time as depth; seen straight on again, the volume is its own long exposure, which a
// focal-plane shutter ends and the darkroom develops.
//   The evening is one emission field e(x, y, t) on the window: the lantern's light on the came and the
//   glass (what the window adds under it, baked: uWinB), the lantern's reflection (a caustic, an
//   ellipse turning in the wavy glass), the glint at its heart (a hairline), the falling leaves, the
//   summits' red glass. Shown as instants (echoes), they are slices of it at t; joined, its moving
//   edges are found where a ray crosses them (the crossing integral: w√π/|f′| each), so a sheet seen
//   edge-on is bright and the same sum seen straight on is the exposure.
// Passes (transit.js): the window baked still (mode 10: its colour, and what the lantern adds), the
// evening in depth (mode 11, while D > 0, at a reduced resolution), the exposure (mode 12, once).
import { MOMENT, MOMENTC, LEAVES, TIME_COLOURS, HD } from '../moment-plan.js';
const f = x => Number(x).toFixed(4);
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;
const v3 = a => `vec3(${a.map(f).join(', ')})`;
const M = MOMENT, C = MOMENTC;
export const MOMENT_GLSL = /* glsl */ `
uniform sampler2D uWinA;   // the window still (display), unit 8, mipmapped
uniform sampler2D uWinB;   // what the lantern's light adds to it at full strength (encoded), unit 9
uniform sampler2D uVol;    // the evening in depth as seen (display), unit 3
uniform sampler2D uExp;    // the exposure (display), unit 10, mipmapped
uniform float uWinOn, uVolOn, uExpOn;
const vec2 MO_REM = ${v2(M.remember)}, MO_LMP = ${v2(M.lamp)}, MO_DUSK = ${v2(M.dusk)}, MO_DEP = ${v2(M.depth)};
const vec2 MO_VIEW = ${v2(M.view)}, MO_DRIFT = ${v2(M.drift)}, MO_FINER = ${v2(M.finer)}, MO_JOIN = ${v2(M.join)};
const vec2 MO_BOUT = ${v2(M.baseOut)}, MO_BIN = ${v2(M.baseIn)}, MO_SHUT = ${v2(M.shutter)}, MO_RED = ${v2(M.red)};
const vec3 MO_CLOSE = ${v3(M.close)};
const vec2 MO_EDGE = ${v2(M.edge)}, MO_TIP = ${v2(M.tip)}, MO_WET = ${v2(M.wet)}, MO_WD = ${v2(M.withdraw)}, MO_SINK = ${v2(M.sink)};
const float MO_DEV = ${f(M.develop)}, MO_EXPP = ${f(M.exposure)}, MO_W = ${f(M.weight)}, MO_DOF = ${f(M.depthOf)};
const float MO_YAW = ${f(M.yaw)}, MO_YAW2 = ${f(M.yaw2)}, MO_PIT = ${f(M.pitch)}, MO_PIT2 = ${f(M.pitch2)}, MO_DOLLY = ${f(M.dolly)}, MO_FOCAL = ${f(M.focal)};
const int MO_N = ${M.slices}, MO_STEPS = ${M.steps}, MO_NR = ${M.ribbon};
const vec2 MC_SWEEP = ${v2(C.sweep)}, MC_DUSK = ${v2(C.dusk)}, MC_SHUT = ${v2(C.shutter)}, MC_RED = ${v2(C.red)}, MC_WET = ${v2(C.wet)}, MC_SET = ${v2(C.settle)};
const float MC_DEV = ${f(C.develop)};
const float MO_DMAX = ${f(HD.dmax)}, MO_GAMMA = ${f(HD.gamma)}, MO_X0 = ${f(HD.x0)}, MO_TAU = ${f(HD.tau)};
const vec4 MO_TC = vec4(${TIME_COLOURS.map(c => f(c[0])).join(', ')});
const vec3 MO_T0 = ${v3(TIME_COLOURS[0][1])}, MO_T1 = ${v3(TIME_COLOURS[1][1])}, MO_T2 = ${v3(TIME_COLOURS[2][1])}, MO_T3 = ${v3(TIME_COLOURS[3][1])};
const int MO_NL = ${LEAVES.length};
const vec4 MO_LA[MO_NL] = vec4[MO_NL](${LEAVES.map(l => `vec4(${f(l.a)}, ${f(l.b)}, ${f(l.f)}, ${f(l.phase)})`).join(', ')});
const vec4 MO_LB[MO_NL] = vec4[MO_NL](${LEAVES.map(l => `vec4(${f(l.from[0])}, ${f(l.from[1])}, ${f(l.to[0])}, ${f(l.to[1])})`).join(', ')});
const vec4 MO_LC[MO_NL] = vec4[MO_NL](${LEAVES.map(l => `vec4(${f(l.swing)}, ${f(l.spin)}, ${f(l.size)}, ${f(l.kind)})`).join(', ')});
// The lantern's light (gain), its reflection (interior, rim), the leaves (interior, rim, rim width in
// leaf units), the caustic's flattening; what the bake stores of the lantern's light (scale).
const float MO_LGAIN = .85, MO_DIN = .14, MO_DCORE = .5, MO_DRIM = .2, MO_XIN = .07, MO_XRIM = .75, MO_LIN = .1, MO_LRIM = .55, MO_LW = .045, MO_Q = .42, MO_BK = 1.5;
// The lantern's light on the glass is remembered more faintly than its reflection (MO_WM of MO_W).
const float MO_WM = .9;
// Safelit paper: white paper under the red lamp (display).
const vec3 MO_PAPER = vec3(.5, .15, .12);

float moS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }
// ---- the evening --------------------------------------------------------------------------------------
// The colour of the light at evening time t: amber, copper, sage, midnight blue. Linear.
vec3 moTime(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t <= MO_TC.y) return mix(MO_T0, MO_T1, smoothstep(MO_TC.x, MO_TC.y, t));
  if (t <= MO_TC.z) return mix(MO_T1, MO_T2, smoothstep(MO_TC.y, MO_TC.z, t));
  return mix(MO_T2, MO_T3, smoothstep(MO_TC.z, MO_TC.w, t));
}
// Light of time t on the window's materials (which already carry the lantern's warmth).
vec3 moTint(float t) { return mix(vec3(1.0), moTime(t) * 1.4, .72); }
// The lantern's path (moment-plan.js lampAt), px.
vec2 moLamp(float t) {
  float e = .6 * t * t * (3.0 - 2.0 * t) + .4 * t;
  return R * vec2(.88 - .78 * e, .8 - .44 * e + .055 * sin(6.2831853 * 1.25 * t + .4));
}
// It comes up as the story takes it and goes as its sweep ends.
float moLampOn(float t) { return smoothstep(0.0, .05, t) * (1.0 - smoothstep(.86, 1.0, t)); }
float moLampRad() { return min(420.0, .32 * length(R)); }
float moLight(vec2 x, float t) { vec2 d = (x - moLamp(t)) / moLampRad(); return exp(-dot(d, d)) * MO_LGAIN * moLampOn(t); }
// Its reflection in the wavy glass: a caustic, an ellipse (axes 1 and MO_Q of its radius) turning as
// the glass under it does; f < 0 inside, in units of its radius.
float moDiscR() { return .05 * min(R.x, R.y) + 6.0; }
float moTwist(float t) { return 1.2 + 3.4 * t + .4 * sin(7.3 * t); }
// (Its rim waves, as the caustic of a wavy sheet does: three lobes and seven turning against each other.)
float moDiscF(vec2 x, float t) {
  vec2 d = rot(moTwist(t)) * ((x - moLamp(t)) / moDiscR());
  float a = atan(d.y, d.x);
  return length(vec2(d.x, d.y / MO_Q)) / (1.0 + .1 * sin(3.0 * a + 9.0 * t) + .05 * sin(7.0 * a - 13.0 * t)) - 1.0;
}
vec3 moDiscCol(float t) { return moTime(t) * moLampOn(t); }
vec3 moDiscE(vec2 x, float t) {
  // (Nothing beyond twice its radius, the rim's waves and flattening allowed for.)
  if (length(x - moLamp(t)) > moDiscR() * 2.6) return vec3(0.0);
  float fd = moDiscF(x, t);
  if (fd > 1.0) return vec3(0.0);
  vec3 c = moDiscCol(t);
  return c * (MO_DIN * smoothstep(.1, -.15, fd) + MO_DRIM * exp(-pow(fd / .09, 2.0))) + mix(c, vec3(1.0, .9, .75), .5) * MO_DCORE * exp(-pow((fd + 1.0) / .28, 2.0));
}
// ---- the leaves -----------------------------------------------------------------------------------------
bool moLeafAtS(int i, float s, out vec2 pos, out float ang) {
  vec4 A = MO_LA[i], B = MO_LB[i], Cc = MO_LC[i];
  float ph = 6.2831853 * A.z * s + A.w;
  pos = R * vec2(mix(B.x, B.z, s) + Cc.x * sin(ph), mix(B.y, B.w, s));
  ang = .75 * cos(ph) + Cc.y * s;
  return true;
}
bool moLeafAt(int i, float t, out vec2 pos, out float ang) {
  vec4 A = MO_LA[i], B = MO_LB[i], Cc = MO_LC[i];
  float s = (t - A.x) / (A.y - A.x);
  pos = vec2(-1e5); ang = 0.0;
  if (s < 0.0 || s > 1.0) return false;
  return moLeafAtS(i, s, pos, ang);
}
float moLeafR(int i) { return MO_LC[i].z * min(R.x, R.y); }
// A leaf's outline (leaf units, its tip toward +y): a maple's five pointed lobes, the lower two smaller,
// toothed; or a birch's toothed oval; and its stem.
float moLeafSd(vec2 p, float kind) {
  float a = atan(p.x, p.y), r = length(p), sd;
  if (kind < .5) {
    float lobe = pow(abs(cos(a * 2.5)), 2.5);
    float rr = (.48 + .52 * lobe) * mix(1.0, .7, smoothstep(1.9, 2.6, abs(a)));
    rr += .03 * sin(a * 26.0) * (.4 + .6 * lobe);
    sd = r - rr * .95;
  } else {
    vec2 q = (p - vec2(0.0, .05)) * vec2(1.55, 1.0);
    sd = (length(q) - .86) / 1.3 + .022 * sin(a * 34.0) - .12 * smoothstep(.5, 1.0, p.y) * (1.0 - smoothstep(0.0, .3, abs(p.x)));
  }
  float sy = clamp(p.y, -1.05, -.45);
  return min(sd, length(p - vec2(.05 * (sy + .45) * (sy + .45), sy)) - .024);
}
float moLeafVein(vec2 p, float kind) {
  float a = atan(p.x, p.y), r = length(p);
  if (kind < .5) return exp(-pow(abs(sin(a * 2.5)) * r / .028, 2.0));
  float mid = exp(-pow(p.x / .02, 2.0)), lat = exp(-pow((fract(p.y * 4.0 - abs(p.x) * 2.6) - .5) / .06, 2.0)) * smoothstep(.04, .1, abs(p.x));
  return max(mid, lat * .6);
}
vec3 moLeafCol(float kind) { return kind < .5 ? vec3(1.0, .3, .1) : vec3(1.0, .62, .16); }
// The leaves at instant t, as the window shows them: backlit, translucent, their edges bright.
vec3 moLeafE(vec2 x, float t) {
  vec3 e = vec3(0.0);
  for (int i = 0; i < MO_NL; i++) {
    vec4 A = MO_LA[i], B = MO_LB[i];
    float s = (t - A.x) / (A.y - A.x), r = moLeafR(i);
    if (s < 0.0 || s > 1.0 || abs(x.y - R.y * mix(B.y, B.w, s)) > r * 1.2) continue;
    vec2 pos; float ang;
    moLeafAtS(i, s, pos, ang);
    vec2 d = x - pos;
    if (dot(d, d) > r * r * 1.4) continue;
    vec2 p = rot(-ang) * d / r;
    p.y = -p.y;
    float kind = MO_LC[i].w, sd = moLeafSd(p, kind);
    float inside = smoothstep(.02, -.02, sd);
    e += mix(moLeafCol(kind), moTime(t), .2) * (MO_LIN * inside * (1.0 - .45 * moLeafVein(p, kind)) + MO_LRIM * exp(-pow(sd / MO_LW, 2.0)));
  }
  return e;
}
// The crossing integral of f along a ray through the evening (moment-plan.js crossingIntegral): for a
// point X0 + Xd t, t in [t0, t1], each place f crosses zero adds w√π/|f′| of exposure (at most a
// sample's worth), and the time inside (f < 0) is summed.
// Each leaf: only where its height and the ray's agree, a window around that moment.
vec3 moLeafX(vec2 X0, vec2 Xd, float t0, float t1) {
  vec3 e = vec3(0.0);
  for (int i = 0; i < MO_NL; i++) {
    vec4 A = MO_LA[i], B = MO_LB[i];
    float r = moLeafR(i), dur = A.y - A.x;
    // The leaf's height is linear in t: y = R.y (B.y + (B.w - B.y)(t − a)/dur); the ray's, X0.y + Xd.y t.
    float vy = R.y * (B.w - B.y) / dur, y0 = R.y * B.y - vy * A.x;
    float rel = vy - Xd.y;
    float tc = (X0.y - y0) / (abs(rel) > 1e-3 ? rel : 1e-3), hw = 1.25 * r / max(abs(rel), 1e-3);
    float a = max(max(t0, A.x), tc - hw), b = min(min(t1, A.y), tc + hw);
    if (b <= a) continue;
    float kind = MO_LC[i].w, h = (b - a) / 24.0, fprev = 0.0, rim = 0.0, ins = 0.0;
    for (int k = 0; k <= 24; k++) {
      float t = a + h * float(k);
      vec2 pos; float ang;
      moLeafAt(i, t, pos, ang);
      vec2 p = rot(-ang) * (X0 + Xd * t - pos) / r;
      p.y = -p.y;
      float fl = moLeafSd(p, kind);
      if (k > 0) {
        if ((fl < 0.0) != (fprev < 0.0)) rim += MO_LW * 1.7725 / max(abs(fl - fprev) / h, MO_LW / h);
        ins += h * .5 * (smoothstep(.04, -.04, fl) + smoothstep(.04, -.04, fprev));
      }
      fprev = fl;
    }
    e += mix(moLeafCol(kind), moTime(.5 * (a + b)), .2) * (MO_LIN * ins + MO_LRIM * rim);
  }
  return e;
}
// The lantern's reflection: a coarse pass finds where the ray comes near it, a fine one integrates.
vec3 moDiscX(vec2 X0, vec2 Xd, float t0, float t1) {
  vec3 e = vec3(0.0);
  float rr = moDiscR();
  const int NC = 28;
  float hc = (t1 - t0) / float(NC);
  float gprev = 1e9;
  for (int k = 0; k <= NC; k++) {
    float t = t0 + hc * float(k);
    float g = length(X0 + Xd * t - moLamp(t)) / rr;
    if (k > 0 && min(g, gprev) < 2.2 + (hc * 1700.0) / rr) {
      // The fine pass over this coarse step.
      float h = hc / 8.0, fprev = moDiscF(X0 + Xd * (t - hc), t - hc);
      for (int j = 1; j <= 8; j++) {
        float u = t - hc + h * float(j);
        float fd = moDiscF(X0 + Xd * u, u);
        vec3 c = moDiscCol(u);
        // (Joined, its edges are the ribbon's brilliant edge, its inside smoke; the hot heart of it is
        // the glint, drawn as its hairline.)
        if ((fd < 0.0) != (fprev < 0.0)) e += mix(c, vec3(1.0, .92, .8), .3) * MO_XRIM * .09 * 1.7725 / max(abs(fd - fprev) / h, .09 / h);
        e += c * MO_XIN * h * .5 * (smoothstep(.05, -.05, fd) + smoothstep(.05, -.05, fprev)) * (.7 + .6 * noise((X0 + Xd * u) * .03 + u * 4.0));
        fprev = fd;
      }
    }
    gprev = g;
  }
  return e;
}
// The glint at the heart of the reflection: its track, a hairline (amber). In space-time: the distance
// from a ray (o, d) to the track's segments, where the evening is D deep; t ≤ tmax.
vec3 moHair(vec3 o, vec3 d, float D, float tmax) {
  float best = 1e9, bt = 0.0;
  vec3 A = vec3(moLamp(0.0), 0.0);
  for (int k = 1; k <= MO_NR; k++) {
    float tb = float(k) / float(MO_NR);
    if (tb - 1.0 / float(MO_NR) >= tmax) break;
    tb = min(tb, tmax);
    vec3 B = vec3(moLamp(tb), tb * D);
    vec3 u = B - A, w = A - o;
    float a = dot(u, u), b = dot(u, d), dw = dot(d, w), uw = dot(u, w);
    float s = clamp((b * dw - uw) / max(a - b * b, 1e-6), 0.0, 1.0);
    float l = max(0.0, s * b + dw);
    float dist = length(w + u * s - d * l);
    if (dist < best) { best = dist; bt = tb - (1.0 - s) / float(MO_NR); }
    A = B;
  }
  vec3 c = mix(moTime(bt), vec3(1.0, .66, .3), .55) * moLampOn(bt);
  return c * (exp(-pow(best / 1.1, 2.0)) * 1.1 + exp(-best / 6.0) * .1);
}
// The same seen straight on (the window plane), at full resolution: the lantern's path runs across the
// screen, so the time it passes a column is found by inverting its x (Newton), and only the track
// near that time is measured.
float moLampT(float xpx) {
  float e = clamp((.88 - xpx / R.x) / .78, 0.0, 1.0), t = e;
  for (int i = 0; i < 4; i++) {
    float g = .6 * t * t * (3.0 - 2.0 * t) + .4 * t - e, dg = 3.6 * t * (1.0 - t) + .4;
    t = clamp(t - g / dg, 0.0, 1.0);
  }
  return t;
}
vec3 moHairFront(vec2 x, float tmax) {
  float tc = moLampT(x.x), a = max(tc - .1, 0.0), b = min(tc + .1, tmax);
  float best = 1e9, bt = tmax;
  if (b <= a) { best = length(x - moLamp(tmax)); }
  else {
    vec2 A = moLamp(a);
    for (int k = 1; k <= 14; k++) {
      float tb = mix(a, b, float(k) / 14.0);
      vec2 B = moLamp(tb), u = B - A;
      float s = clamp(dot(x - A, u) / max(dot(u, u), 1e-6), 0.0, 1.0), dd = length(x - A - u * s);
      if (dd < best) { best = dd; bt = tb; }
      A = B;
    }
  }
  vec3 c = mix(moTime(bt), vec3(1.0, .66, .3), .55) * moLampOn(bt);
  return c * (exp(-pow(best / 1.1, 2.0)) * 1.1 + exp(-best / 6.0) * .1);
}
// ---- the window ----------------------------------------------------------------------------------------
// From the bake: the window still (linear) and what the lantern's light adds to it; mip level lod.
vec2 moTex(vec2 x) { return vec2(x.x / R.x, 1.0 - x.y / R.y); }
vec3 moBase(vec2 x, float lod) { return uWinOn > .5 ? fgLin(textureLod(uWinA, moTex(x), lod).rgb) : vec3(.006, .01, .009); }
vec3 moAdds(vec2 x, float lod) { return uWinOn > .5 ? pow(textureLod(uWinB, moTex(x), lod).rgb, vec3(2.2)) / MO_BK : vec3(.02, .018, .012); }
vec2 moScreen(vec2 xz) { float k = R.y / fgSpan(); return vec2(R.x * .5 + (xz.x - FG_S * .5) * k, R.y * .5 - (xz.y - FG_S * .5) * k); }
// The instants shown at level l (moment-plan.js instantWeight).
int moLev(int i) {
  int k = i + 1, lev = 6;
  for (int j = 0; j < 3; j++) { if (k % 2 == 0) { k /= 2; lev--; } else break; }
  return lev;
}
float moWeight(int i, float l) {
  float L = floor(l), fr = l - L, lev = float(moLev(i));
  if (L >= 6.0) return lev <= L ? MO_W / 64.0 : 0.0;
  if (lev <= L) return MO_W / exp2(L) * (1.0 - fr * .5);
  if (lev == L + 1.0) return MO_W / exp2(L + 1.0) * fr;
  return 0.0;
}
// What instant t adds at x: the lantern's light on the window, its reflection, the leaves.
vec3 moInstant(vec2 x, float t, vec3 adds) { return adds * moLight(x, t) * moTint(t) * (MO_WM / MO_W) + moDiscE(x, t) + moLeafE(x, t); }
vec3 moTone(vec3 c) { return c / (1.0 + c * .32); }

// ---- the scroll ----------------------------------------------------------------------------------------
float moEvening(float P) { return moS(MO_REM, P); }
float moDepth(float P) {
  return MO_DOF * max(R.x, R.y) * moS(MO_DEP, P) * pow(1.0 - smoothstep(MO_CLOSE.x, MO_CLOSE.z, P), 3.0);
}
float moLevel(float P) { return 3.0 + 3.0 * moS(MO_FINER, P); }
// How bright the evening's light is drawn while it has depth (its light is spread through it).
float moGain(float P) { return 1.0 + 5.0 * moS(MO_DEP, P) * (1.0 - smoothstep(MO_CLOSE.x, MO_CLOSE.z - .02, P)); }
float moBaseW(float P) { return 1.0 - moS(MO_BOUT, P) * (1.0 - moS(MO_BIN, P)); }
// The camera (moment-plan.js viewAt, rayAt): a ray from it through screen point s.
void moRay(vec2 s, float D, float P, out vec3 o, out vec3 d) {
  float a = moS(MO_VIEW, P), dr = moS(MO_DRIFT, P), c = smoothstep(MO_CLOSE.x, MO_CLOSE.y, P);
  float yaw = (MO_YAW * a + (MO_YAW2 - MO_YAW) * dr) * (1.0 - c);
  float pit = (MO_PIT * a + (MO_PIT2 - MO_PIT) * dr) * (1.0 - c);
  float dolly = 1.0 + (MO_DOLLY - 1.0) * a * (1.0 - c);
  float F = MO_FOCAL * R.y;
  vec3 ctr = vec3(R * .5, D * .5);
  float cp = cos(pit), sp = sin(pit), cy = cos(yaw), sy = sin(yaw);
  vec3 e0 = vec3(0.0, 0.0, -F * dolly - D * .5), d0 = normalize(vec3(s - R * .5, F));
  // pitch about x, then yaw about y
  vec3 e1 = vec3(e0.x, e0.y * cp - e0.z * sp, e0.y * sp + e0.z * cp);
  vec3 d1 = vec3(d0.x, d0.y * cp - d0.z * sp, d0.y * sp + d0.z * cp);
  o = vec3(e1.x * cy + e1.z * sy, e1.y, -e1.x * sy + e1.z * cy) + ctr;
  d = vec3(d1.x * cy + d1.z * sy, d1.y, -d1.x * sy + d1.z * cy);
}
// The room around the window, once we are beside it: night, a little light from the evening.
vec3 moRoom(vec2 s) {
  vec2 u = s / R - .5;
  return vec3(.0018, .0026, .0042) * (1.0 - .6 * dot(u, u)) + vec3(.0012, .0008, .0004) * exp(-dot(u, u) * 4.0);
}
// The summits' red glass through the evening: a thin prism each, bright as the length of it a ray
// passes through (saturating), with a soft halo.
vec3 moRuby(vec3 o, vec3 d, float D, float thin) {
  float k = R.y / fgSpan(), sum = 0.0, halo = 0.0;
  vec3 inv = 1.0 / vec3(abs(d.x) > 1e-5 ? d.x : 1e-5, abs(d.y) > 1e-5 ? d.y : 1e-5, d.z);
  for (int i = 0; i < FG_NR; i++) {
    vec2 c = moScreen(FG_RED[i].xy), h = FG_RED[i].zw * k * thin + .6;
    vec3 lo = vec3(c - h, 0.0), hi = vec3(c + h, D);
    vec3 a = (lo - o) * inv, b = (hi - o) * inv;
    vec3 mn = min(a, b), mx = max(a, b);
    float tn = max(max(mn.x, mn.y), mn.z), tf = min(min(mx.x, mx.y), mx.z);
    float hr = max(h.x, h.y);
    // (Brightest at the evening's start, nearest, dimming into the night behind.)
    float tm = clamp((o.z + d.z * .5 * (tn + tf)) / D, 0.0, 1.0);
    if (tf > tn) sum += (1.0 - exp(-(tf - tn) / (3.0 * hr))) * mix(1.0, .25, tm);
    // The halo: the ray's nearest approach to the prism's axis.
    vec3 A = vec3(c, 0.0), u = vec3(0.0, 0.0, D), w = A - o;
    float bb = dot(u, d), dw = dot(d, w), aa = D * D;
    float s = clamp((bb * dw - dot(u, w)) / max(aa - bb * bb, 1e-6), 0.0, 1.0);
    float dist = length(w + u * s - d * max(0.0, s * bb + dw));
    halo += exp(-pow(dist / (5.0 * hr + 6.0), 2.0));
  }
  return vec3(.55, .045, .03) * (sum * .7 + halo * .025);
}
// The echoes of the instants past while the glass remembers (front on), at the pass's resolution:
// encoded as e/(1 + e) (moMemory reads them back).
vec3 moEchoes(vec2 px, float tau) {
  vec3 adds = moAdds(px, 0.0), e = vec3(0.0);
  for (int i = 7; i < MO_N; i += 8) {
    float t = float(i + 1) / float(MO_N);
    float on = smoothstep(t, t + .02, tau);
    if (on <= 0.0) break;
    e += on * (MO_W / 8.0) * moInstant(px, t, adds);
  }
  return e;
}
vec3 moMemory(vec2 q) {
  vec3 m = texture(uVol, vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w)).rgb;
  m = pow(m, vec3(2.2));
  return m / max(1.0 - m, 1e-3);
}
// The evening in depth, as the camera sees it at P (mode 11). Display colour. (Before it has depth: the
// echoes, encoded.)
vec4 momentVolume(vec2 s, float P) {
  if (P < MO_DEP.x) { vec3 e = moEchoes(s, moEvening(P)); return vec4(pow(e / (1.0 + e), vec3(1.0 / 2.2)), 1.0); }
  gDusk = 1.0;
  float D = max(moDepth(P), .5);
  vec3 o, d;
  moRay(s, D, P, o, d);
  vec3 col = moRoom(s);
  float lev = moLevel(P), join = moS(MO_JOIN, P), wb = moBaseW(P), G = moGain(P);
  float open = moS(MO_DEP, P) * (1.0 - smoothstep(MO_CLOSE.x, MO_CLOSE.z, P));
  // The slab: the window, D deep.
  vec3 inv = 1.0 / vec3(abs(d.x) > 1e-5 ? d.x : 1e-5, abs(d.y) > 1e-5 ? d.y : 1e-5, d.z);
  vec3 a = (vec3(0.0) - o) * inv, b = (vec3(R, D) - o) * inv;
  vec3 mn = min(a, b), mx = max(a, b);
  float tn = max(max(mn.x, mn.y), mn.z), tf = min(min(mx.x, mx.y), mx.z);
  vec3 e = vec3(0.0);
  // A point at evening time t on this ray: X0 + Xd t.
  vec2 X0 = o.xy - d.xy * o.z / d.z, Xd = d.xy * D / d.z;
  if (tf > max(tn, 0.0)) {
    float t0 = clamp((o.z + d.z * max(tn, 0.0)) / D, 0.0, 1.0), t1 = clamp((o.z + d.z * tf) / D, 0.0, 1.0);
    // The window's edge, soft (its glass fades toward the frame rather than ending in a hard line).
    float lodStep = log2(max(length(Xd) / float(MO_N), 1.0));
    if (join < 1.0) {
      for (int i = 0; i < MO_N; i++) {
        float w = moWeight(i, lev);
        if (w <= 0.0) continue;
        float t = float(i + 1) / float(MO_N);
        if (t < t0 - 1e-4 || t > t1 + 1e-4) continue;
        vec2 x = X0 + Xd * t;
        vec2 m2 = min(x, R - x);
        float m = smoothstep(0.0, .07 * min(R.x, R.y), min(m2.x, m2.y));
        float lod = min(lodStep, 2.0) * .5;
        vec3 ad = moAdds(x, lod);
        e += (1.0 - join) * (moBase(x, lod) * wb * w / MO_W * m + w * (G * (moDiscE(x, t) + moLeafE(x, t)) + (1.0 + 2.2 * open) * (MO_WM / MO_W) * ad * moLight(x, t) * moTint(t)));
      }
    }
    if (join > 0.0) {
      float dt = (t1 - t0) / float(MO_STEPS), h = fract(52.9829189 * fract(dot(s, vec2(.06711056, .00583715))));
      float lod = log2(max(length(Xd) * dt, 1.0));
      vec3 acc = vec3(0.0);
      for (int k = 0; k < MO_STEPS; k++) {
        float t = t0 + dt * (float(k) + h);
        vec2 x = X0 + Xd * t;
        vec2 m2 = min(x, R - x);
        float m = smoothstep(0.0, .07 * min(R.x, R.y), min(m2.x, m2.y));
        acc += (moBase(x, lod) * wb * m + MO_WM * (1.0 + 2.2 * open) * moAdds(x, lod) * moLight(x, t) * moTint(t)) * dt;
      }
      e += join * (acc + MO_W * G * (moDiscX(X0, Xd, t0, t1) + moLeafX(X0, Xd, t0, t1)));
    }
  }
  e += moHair(o, d, D, 1.0) * (.6 + .9 * open);
  e += moRuby(o, d, D, mix(1.0, .16, open)) * smoothstep(2.0, 60.0, D) * .4;
  return vec4(fgDisp(moTone(col + e)), 1.0);
}
// The exposure (mode 12): the evening seen straight on, whole, its integral over time.
vec4 momentExposure(vec2 x) {
  gDusk = 1.0;
  vec3 adds = moAdds(x, 0.0), acc = vec3(0.0);
  const int NE = 64;
  float h = fract(52.9829189 * fract(dot(x, vec2(.06711056, .00583715))));
  for (int k = 0; k < NE; k++) { float t = (float(k) + h) / float(NE); acc += moLight(x, t) * moTint(t); }
  vec3 e = moBase(x, 0.0) + MO_WM * adds * acc / float(NE) + MO_W * (moDiscX(x, vec2(0.0), 0.0, 1.0) + moLeafX(x, vec2(0.0), 0.0, 1.0));
  e += moHairFront(x, 1.0) * .6;
  return vec4(fgDisp(moTone(e)), 1.0);
}
// The window baked still (mode 10): layer 0 its colour with the lantern out, 1 what a lantern's light
// of 1 everywhere adds to it (encoded). At the evening's end (the dusk deepened).
vec4 momentBake(vec2 px, int layer) {
  gDusk = 1.0;
  gLampMode = 2;
  gLampK = 0.0;
  vec3 b = sceneFolioLin(px);
  if (layer == 0) return vec4(fgDisp(b), 1.0);
  gLampK = 1.0;
  vec3 l = sceneFolioLin(px);
  return vec4(pow(clamp((l - b) * MO_BK, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
// The glass remembering (front on, the evening at τ, at full resolution): the window itself live, its
// lantern handed from the world to the story; the instants that have passed, as echoes; the glint's
// hairline. Linear.
vec3 moRemember(vec2 px, float P) {
  float tau = moEvening(P), hand = moS(MO_LMP, P);
  gDusk = moS(MO_DUSK, P);
  vec2 idle = R * vec2(.8, .9) + vec2(sin(T * .21), cos(T * .17)) * 34.0;
  gLampMode = 1;
  gLampAt = mix(idle, PTR, uPtrOn);
  gLampK = mix(.35, 1.0, uPtrOn) * (1.0 - hand);
  gLampR = 420.0;
  vec3 col = sceneFolioLin(px);
  gLampMode = 0;
  vec3 adds = moAdds(px, 0.0);
  // The present.
  col += hand * (adds * moLight(px, tau) * moTint(tau) + moDiscE(px, tau) + moLeafE(px, tau));
  // The instants past: echoes, each as it was, where it was (drawn by the pass, uVol).
  if (uVolOn > .5) col += moMemory(px - uRegion.xy);
  col += moHairFront(px, tau) * hand;
  return col;
}

// ---- the shutter, the safelight, the paper -------------------------------------------------------------
// The focal-plane shutter's curtain, at y (px, y down): above it the dark, its edge a narrow line of
// deeper dark ahead of it. Returns how much of the light still shows at q.
float moCurtain(vec2 q, float y) {
  float ahead = 1.0 - .75 * exp(-max(q.y - y, 0.0) / 5.0);
  return smoothstep(y - 1.5, y + 1.5, q.y) * ahead;
}
vec3 moCurtainFace(vec2 q, float y) {
  float slat = .5 + .5 * sin(q.y * .9);
  return vec3(.006, .005, .005) * (1.0 + .4 * slat) + vec3(.05, .04, .035) * exp(-max(y - q.y, 0.0) / 2.5);
}
// The one red reflection left above the frame, opening into the darkroom's safelight.
vec3 moRedGlint(vec2 q, float k, float rise) {
  vec2 c = R * vec2(.5, mix(.065, -.1, rise));
  float dd = length(q - c);
  return vec3(1.0, .22, .14) * k * (exp(-pow(dd / 2.6, 2.0)) * 1.6 + exp(-dd / 16.0) * .35 + exp(-dd / 90.0) * .08) * (1.0 - rise * .8);
}
// Development (moment-plan.js densityAt): the print's reflectance for darkness x at progress t, with
// grains first (q px) that merge into tone. Display.
float moPrint(float x, float t, vec2 q) {
  float dInf = MO_DMAX / (1.0 + exp(-MO_GAMMA * (x - MO_X0)));
  float ti = .04 + .34 * (1.0 - smoothstep(.2, .9, x));
  float Dn = dInf * (1.0 - exp(-max(t - ti, 0.0) / MO_TAU));
  float fr = (1.0 - pow(10.0, -Dn)) / (1.0 - pow(10.0, -MO_DMAX));
  vec2 gq = q / 1.15;
  float u = hash(floor(gq) + floor(hash2(floor(gq * .37)) * 8.0));
  float grainy = smoothstep(u - .1, u + .1, fr) * (.75 + .25 * hash(floor(gq) + 3.1));
  float tone = mix(mix(fr, grainy, .6), fr, smoothstep(.15, .55, t));
  return pow(mix(1.0, pow(10.0, -MO_DMAX), tone), 1.0 / 2.2);
}
// The meniscus: when the developer reaches (u, v) of the sheet (moment-plan.js wetAt).
float moWetAt(vec2 uv) {
  float a = (uv.x + 1.0 - uv.y) * .5, b = (uv.x - 1.0 + uv.y) * .5;
  return clamp(.92 * a + .08 * 4.0 * b * b, 0.0, 1.0);
}
// The developer's surface: small ripples and a slow rocking swell. Its slope.
vec2 moLiquid(vec2 q, float rock) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i), an = 1.1 + fi * 2.1;
    vec2 k = vec2(cos(an), sin(an)) * (.035 + .02 * fi);
    g += k * cos(dot(k, q) - T * (1.1 + .4 * fi) + fi * 1.7) * (.8 - .2 * fi) * .35;
  }
  vec2 ks = vec2(.005, .0016);
  g += ks * cos(dot(ks, q) - T * .7) * 14.0 * rock;
  return g;
}
// The sheet's place at P (act 4): the camera at the origin looking along +z, units of the screen's
// height, y down. It is pulled back to show its edge, tips away about its lower edge (rolled, so a
// lower corner leads), and is laid in the tray. C its middle, U and V its across and down, hs half size.
void moSheet(float P, out vec3 Cn, out vec3 U, out vec3 V, out vec2 hs) {
  float A = R.x / R.y, wd = moS(MO_WD, P), tip = moS(MO_TIP, P);
  float k0 = mix(1.0, .86, moS(MO_EDGE, P)), k = mix(k0, .5, wd);
  hs = vec2(A, 1.0) * .5 * k;
  float phi = mix(.95 * tip, 1.5708, wd), psi = -.07 * sin(3.1415927 * tip) * (1.0 - wd);
  vec3 v = vec3(0.0, cos(phi), -sin(phi)), u = vec3(1.0, 0.0, 0.0);
  U = u * cos(psi) + v * sin(psi);
  V = -u * sin(psi) + v * cos(psi);
  vec3 B = mix(vec3(0.0, .5 * k0, MO_FOCAL), vec3(0.0, .52, 1.9), wd);
  Cn = B - V * hs.y;
}
// The sheet at screen point q: its (u, v), and false off it.
bool moSheetUV(vec2 q, vec3 Cn, vec3 U, vec3 V, vec2 hs, out vec2 uv) {
  vec3 d = normalize(vec3((q - R * .5) / R.y, MO_FOCAL)), N = cross(U, V);
  float dn = dot(d, N);
  uv = vec2(-1.0);
  if (abs(dn) < 1e-5) return false;
  float lam = dot(Cn, N) / dn;
  if (lam <= 0.0) return false;
  vec3 p = d * lam - Cn;
  uv = vec2(dot(p, U) / hs.x, dot(p, V) / hs.y) * .5 + .5;
  return true;
}
// Where on screen a point of the sheet is (for its rings).
vec2 moSheetScreen(vec3 p) { return R * .5 + p.xy / p.z * MO_FOCAL * R.y; }
vec3 moExposure(vec2 uv, float lod) {
  return uExpOn > .5 ? textureLod(uExp, vec2(uv.x, 1.0 - uv.y), lod).rgb : vec3(.03);
}
// The print on the sheet at (u, v), screen point q, at P: blank safelit paper until the developer
// reaches it; then under the liquid (which bends it) it comes up, the darkest first. lit: the safelight.
vec3 moSheetFace(vec2 uv, vec2 q, float wetS, float t0, float dev, float rock, float lit) {
  float arr = moWetAt(uv);
  float wet = smoothstep(arr - .006, arr + .006, wetS);
  vec2 slope = moLiquid(q, rock) * wet;
  vec3 img = moExposure(clamp(uv + slope * .006, vec2(.001), vec2(.999)), .5);
  float x = 1.0 - clamp(luma(img) * 2.2 - .05, 0.0, 1.0);
  float t = clamp(t0 - arr * dev, 0.0, 1.0);
  float refl = mix(1.0, moPrint(x, t, q), wet);
  float tooth = .93 + .07 * noise(q * .7);
  vec3 col = MO_PAPER * refl * tooth * lit * mix(.58, .7, wet);
  // The liquid's glints where it faces the lamp, and the meniscus carrying its reflection.
  // (The lamp is above: the sheet is lit more toward its top.)
  col *= mix(1.0, .78, uv.y);
  vec3 n = normalize(vec3(-slope * 3.0, 1.0));
  col += vec3(1.0, .45, .35) * pow(max(dot(n, normalize(vec3(0.0, -.42, 1.0))), 0.0), 80.0) * .22 * lit * wet;
  float front = exp(-pow((arr - wetS) / .007, 2.0)) * step(wetS, 1.04);
  float along = (uv.x - 1.0 + uv.y) * .5;
  float spot = exp(-pow((along - mix(-.4, .4, fract(wetS * 1.3))) / .12, 2.0));
  col += vec3(1.0, .5, .4) * front * lit * (.35 + 1.1 * spot);
  return col;
}
vec3 groundMoment(vec2 q, vec2 px, float P) {
  if (P <= MO_REM.x) return sceneFolio(px);
  vec2 S = uRegion.zw;
  // 1: the glass remembering, live; 2 and 3: the evening in depth (uVol) and, flat again, the exposure.
  float D = moDepth(P);
  vec3 col;
  if (P < MO_DEP.x || uVolOn < .5) col = fgDisp(moTone(moRemember(px, min(P, MO_DEP.x - 1e-4))));
  else if (P < MO_DEP.x + .02) {
    // (The handoff: the pass now draws the evening whole, at its resolution; the live window's finer
    // detail, over the window it baked, lets go.)
    col = texture(uVol, vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w)).rgb;
    gDusk = 1.0;
    col += (sceneFolio(px) - textureLod(uWinA, moTex(px), 0.0).rgb) * (1.0 - moS(vec2(MO_DEP.x, MO_DEP.x + .02), P));
  } else if (P < MO_SHUT.y + .01) {
    col = uVolOn > .5 ? texture(uVol, vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w)).rgb : vec3(0.0);
    float flat_ = (1.0 - smoothstep(1.5, 8.0, D)) * step(MO_CLOSE.y, P);
    if (flat_ > 0.0 && uExpOn > .5) col = mix(col, moExposure(q / S, 0.0), flat_);
  } else col = vec3(0.0);
  // The curtain ends the exposure; the red reflection stays above the frame and opens into the
  // darkroom's safelight.
  float shut = moS(MO_SHUT, P), yc = mix(-.04, 1.04, shut) * S.y;
  if (P > MO_SHUT.x && P < MO_SHUT.y + .01) col = mix(moCurtainFace(q, yc), col, moCurtain(q, yc));
  float saf = moS(MO_RED, P), glint = smoothstep(MO_SHUT.x + .01, MO_SHUT.y, P) * (1.0 - saf);
  if (P < MO_SHUT.y + .01) return col + moRedGlint(q, glint, saf);
  // 4: the evening returns beneath water.
  float sink = moS(MO_SINK, P);
  vec3 Cn, U, V; vec2 hs;
  moSheet(P, Cn, U, V, hs);
  // The rings of its settling run on into the tray's ripples.
  float wd = moS(MO_WD, P);
  if (wd > .6) gDrRing = vec4(moSheetScreen(Cn), (P - MO_WD.x - .07) * 30.0, smoothstep(.6, .9, wd) * (1.0 - smoothstep(1.17, 1.2, P)));
  vec3 world = sceneDarkroom(px);
  vec3 bg = world * saf * (1.0 - .3 * (1.0 - sink)) + moRedGlint(q, glint, saf);
  vec2 uv;
  if (!moSheetUV(px, Cn, U, V, hs, uv) || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return bg;
  float wetS = moS(MO_WET, P) * 1.05;
  float t0 = (P - MO_WET.x) / MO_DEV, dev = (MO_WET.y - MO_WET.x) / MO_DEV;
  vec3 sheet = moSheetFace(uv, px, wetS, t0, dev, 1.0 - sink, saf);
  // Its edge, lit from above; a soft line where it meets what is behind it.
  vec2 fw = max(fwidth(uv), vec2(1e-5));
  vec2 ed = min(uv, 1.0 - uv) / fw;
  float edge = min(ed.x, ed.y);
  sheet += vec3(1.0, .4, .3) * exp(-ed.y / 1.2) * step(uv.y, .5) * .35 * saf;
  sheet = mix(sheet, world, sink * sink);
  return mix(bg, sheet, smoothstep(0.0, 1.2, edge));
}

// ---- the click into Photography ------------------------------------------------------------------------
// The cover (E): a light from the click sweeps away across the page, its earlier reflections lingering
// (echoes, and the glint's hairline), the page dimming into evening; then the curtain ends it and the
// red reflection is left above. Premultiplied.
vec2 mcLamp(vec2 O, float t) {
  vec2 V = R * .5 - O;
  if (length(V) < .15 * min(R.x, R.y)) V = vec2(-.32 * R.x, -.12 * R.y);
  float e = .6 * t * t * (3.0 - 2.0 * t) + .4 * t;
  vec2 n = vec2(-V.y, V.x);
  return O + V * 1.55 * e + n * .22 * sin(3.1415927 * e);
}
vec3 mcDisc(vec2 x, vec2 O, float t) {
  vec2 L = mcLamp(O, t);
  if (length(x - L) > moDiscR() * 2.6) return vec3(0.0);
  vec2 d = rot(moTwist(t)) * ((x - L) / moDiscR());
  float a = atan(d.y, d.x);
  float fd = length(vec2(d.x, d.y / MO_Q)) / (1.0 + .1 * sin(3.0 * a + 9.0 * t) + .05 * sin(7.0 * a - 13.0 * t)) - 1.0;
  vec3 c = moTime(t) * smoothstep(0.0, .05, t);
  return c * (MO_DIN * smoothstep(.1, -.15, fd) + MO_DRIM * exp(-pow(fd / .09, 2.0))) + mix(c, vec3(1.0, .9, .75), .5) * MO_DCORE * exp(-pow((fd + 1.0) / .28, 2.0));
}
vec3 mcHair(vec2 x, vec2 O, float tmax) {
  float best = 1e9, bt = 0.0;
  vec2 A = mcLamp(O, 0.0);
  for (int k = 1; k <= 32; k++) {
    float tb = min(float(k) / 32.0, tmax);
    vec2 B = mcLamp(O, tb), u = B - A;
    float s = clamp(dot(x - A, u) / max(dot(u, u), 1e-6), 0.0, 1.0), dd = length(x - A - u * s);
    if (dd < best) { best = dd; bt = tb; }
    A = B;
    if (tb >= tmax) break;
  }
  return mix(moTime(bt), vec3(1.0, .66, .3), .55) * (exp(-pow(best / 1.1, 2.0)) * 1.1 + exp(-best / 6.0) * .1);
}
vec4 momentCover(vec2 px, vec2 O, float far, float E) {
  float tau = moS(MC_SWEEP, E), dusk = moS(MC_DUSK, E);
  vec3 e = mcDisc(px, O, tau) + mcHair(px, O, tau);
  for (int i = 1; i <= 8; i++) {
    float t = float(i) / 8.0, on = smoothstep(t, t + .03, tau);
    if (on <= 0.0) break;
    e += on * .5 * mcDisc(px, O, t);
  }
  // The page dims into the evening: deep blue-green, then night.
  float a = .9 * dusk;
  vec3 col = vec3(.008, .016, .02) * a + fgDisp(moTone(e)) * (1.0 - .15 * a);
  float shut = moS(MC_SHUT, E), yc = mix(-.04, 1.04, shut) * R.y;
  if (E > MC_SHUT.x) {
    float keep = moCurtain(px, yc);
    col = mix(moCurtainFace(px, yc), col, keep);
    a = mix(1.0, a, keep);
  }
  col += moRedGlint(px, moS(MC_RED, E), 0.0);
  return vec4(col, a);
}
// The reveal (e), behind the new page: under the safelight the screen is a sheet in the developer; the
// meniscus crosses it from a lower corner, behind it Photography's world comes up (the darkest first),
// bent a little by the liquid rocking; and settles.
vec3 momentReveal(vec2 px, float e) {
  vec2 uv = px / R;
  float saf = smoothstep(0.0, .18, e), settle = moS(MC_SET, e);
  float wetS = moS(MC_WET, e) * 1.05, arr = moWetAt(uv);
  float wet = smoothstep(arr - .006, arr + .006, wetS);
  float rock = 1.0 - settle;
  vec2 slope = moLiquid(px, rock) * wet * rock;
  vec3 world = sceneDarkroom(px + slope * 6.0);
  float t = clamp((e - MC_WET.x - arr * (MC_WET.y - MC_WET.x)) / MC_DEV, 0.0, 1.0);
  float x = clamp(1.0 - luma(world) * 3.0, 0.0, 1.0);
  float ti = .04 + .34 * (1.0 - smoothstep(.2, .9, x));
  float dev = smoothstep(ti, ti + .6, t) * wet;
  vec3 paper = MO_PAPER * .55 * saf * (.93 + .07 * noise(px * .7)) + moRedGlint(px, 1.0 - saf, saf);
  vec3 col = mix(paper, world, max(dev, settle));
  float front = exp(-pow((arr - wetS) / .006, 2.0)) * step(wetS, 1.04) * (1.0 - settle);
  col += vec3(1.0, .5, .4) * front * .8 * saf;
  return col;
}
`;
