// Science → Racing: remnant gas, condensation and frost, then a track-shaped drain and a shared
// stadium surface. The worker prepares records and an arrival atlas; every moving element is a
// function of progress. Click navigation keeps its radial point sink and dawn aperture.
import { ACCRETION_SURFACE } from './accretion.js';
import { DEW, SN, NEB_RGB, SKY, SPOTS, FREEZE, CLICK } from '../dew-plan.js';
import { PALETTE, rgb, toLinear } from '../palette.js';
const f = x => Number(x).toFixed(6);
const v3 = c => `vec3(${c.map(f).join(', ')})`;
const C = NEB_RGB;
// The diffuse gas's faint glow: the colour of Science's haze (palette.js), linear, its brightest channel .06.
const ISM = (c => c.map(v => v / Math.max(...c) * 0.06))(toLinear(rgb(PALETTE.sky.body)));
export const DEW_GLSL = ACCRETION_SURFACE + /* glsl */ `
uniform float uIceReady;
uniform float uIceDetail;
// Water's index, red, green, blue (Hale & Querry), its spread about green drawn three times over
// (artistic) so the edge of what each drop sees shows a fringe.
const vec3 DEW_WATER = vec3(1.3345 - 3.0 * .0035, 1.3345, 1.3345 + 3.0 * .0045);
const vec3 DEW_FROST = vec3(.80, .90, 1.0);
const vec3 DEW_LIGHT = vec3(-.4, -.7, .6) / 1.0247;  // the light on Science's chrome (cosmos.js)
vec4 dewData(int i) { return texelFetch(uReach, ivec2(i % 1024, i / 1024), 0); }
vec3 dewLinear(vec3 c) { return mix(c / 12.92, pow(max((c + .055) / 1.055, 0.0), vec3(2.4)), step(vec3(.04045), c)); }
vec3 dewDisplay(vec3 c) { c = max(c, 0.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - .055, step(vec3(.0031308), c)); }
// Hue-preserving roll-off above .7 (the brightest channel, every channel scaled alike).
vec3 dewCompress(vec3 c) { float m = max(c.r, max(c.g, c.b)); return m <= .7 ? c : c * ((.7 + .3 * (1.0 - exp(-(m - .7) / .3))) / m); }
float dewPulse(float x) { if (x <= 0.0 || x >= 1.0) return 0.0; float y = 1.0 - (1.0 - x) * (1.0 - x); return 16.0 * y * y * (1.0 - y) * (1.0 - y); }
float dewG(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }
float dewRidge(vec2 p) { return 1.0 - abs(2.0 * noise(p) - 1.0); }
float dewEll(vec2 u, float a, float b, float d) { float c = cos(d), s = sin(d); return length(vec2((c * u.x + s * u.y) / a, (-s * u.x + c * u.y) / b)) - 1.0; }

// ---- a click's schedules (dew-plan.js CLICK) -----------------------------------------------------------
float gClick = 0.0;   // 1 while a click draws (dewSpots and dewScience read its clocks)
float dewUp(vec2 q) { return clamp(length(q - uPoint) / farCorner(uPoint), 0.0, 1.0); }
float dewClickEcho(float up) { return ${f(CLICK.echo[0])} + ${f(CLICK.echo[1])} * up; }
float dewClickSpots(float up) { return dewClickEcho(up) + ${f(CLICK.spots)}; }
float dewClickFreeze(float up) { return ${f(CLICK.freeze[0])} + ${f(CLICK.freeze[1])} * up; }
float dewClickFlight(float up) { return ${f(CLICK.fly[0])} + ${f(CLICK.fly[1])} * up * up; }
float dewClickOpen(float up) { return dewClickFreeze(up) + ${f(CLICK.split + CLICK.lag + CLICK.stagger + CLICK.open)} + dewClickFlight(up); }
float dewClearStart(vec2 q) { float up = dewUp(q); return .84 + .18 * up + .006 * sin(q.x * .008) * sin(q.y * .007) * up; }
float dewClear(vec2 q, float P, bool click) { if (!click) return 0.0; float c = dewClearStart(q); return smoothstep(c, c + .08, P); }

// ---- the nebulae ------------------------------------------------------------------------------------
// A remnant's radius over its final one: free expansion joined onto Sedov–Taylor (plan: remnantFrac);
// a planetary nebula's shell (plan: shellFrac).
float dewRemnant(float x) {
  if (x <= 0.0) return 0.0;
  float k = ${f(Math.pow(SN.xst, 0.6))};
  return pow(pow(x, -3.0) + pow(k * pow(x, .4), -3.0), -1.0 / 3.0) / pow(1.0 + pow(k, -3.0), -1.0 / 3.0);
}
// A supernova's light curve: a soft breakout glow, then ⁵⁶Ni → ⁵⁶Co decay heating (plan: lightCurve).
float dewLight(float s) {
  if (s <= 0.0) return 0.0;
  float decay = ${f(1 - SN.epsCo)} * exp(-s / ${f(SN.tauNi)}) + ${f(SN.epsCo)} * exp(-s / ${f(SN.tauCo)});
  return .45 * exp(-s / .004) * (1.0 - exp(-pow(s / .0015, 2.0))) + decay * (1.0 - exp(-pow(s / ${f(SN.rise)}, 2.0)));
}
uniform sampler2D uGas;   // the lit gas over the screen at a fraction of its resolution (transit.js)
// Which giants have ended by P (each dims as its core collapses, then is gone in its flash).
void dewGiantsGone(float P) {
  vec4 m = dewData(25);
  int n = int(m.x), eb = int(m.y);
  for (int k = 0; k < 7; k++) {
    if (k >= n) break;
    float s = P - dewData(eb + 5 * k).z;
    if (s > -.003) gGiantGone[int(dewData(eb + 5 * k + 1).y)] = s < 0.0 ? smoothstep(-.003, 0.0, s) * .85 : 1.0;
  }
}
// Turbulence: the sum of |noise| over octaves, whose valleys are thin, wispy filaments.
float dewTurb(vec2 p) { float s = 0.0, a = .5; for (int i = 0; i < 5; i++) { s += a * abs(2.0 * noise(p) - 1.0); p = OCT * p; a *= .5; } return s; }
// Science's interstellar gas (plan px), faint: hydrogen in wispy filaments through its clouds, oxygen
// smoother and patchier, and lanes of dust, twice domain-warped. A supernova's flash lights it.
void dewISM(vec2 p, out float ha, out float o3, out float dust) {
  vec2 q = p / 340.0;
  vec2 w = vec2(fbm(q * 1.2 + 3.1), fbm(q * 1.2 - 7.7)) - .5;
  vec2 w2 = vec2(fbm(q * 2.3 + w * 2.0 + 13.0), fbm(q * 2.3 + w * 2.0 - 5.0)) - .5;
  vec2 sp = q + 1.5 * w + .7 * w2;
  float cloud = smoothstep(.28, .72, fbm(sp * .8 + 2.0));
  float wisp = 1.0 - dewTurb(sp * 2.2);
  ha = cloud * (pow(max(wisp, 0.0), 4.0) * 2.2 + .05);
  o3 = smoothstep(.38, .8, fbm(sp * 1.1 - 9.0)) * (.25 + .75 * pow(max(1.0 - dewTurb(sp * 1.4 + 4.0), 0.0), 3.0));
  dust = smoothstep(.46, .74, fbm(sp * 1.7 + w2 * 3.0 + 21.0)) * (.35 + .65 * cloud);
}
// The lines' colours (linear sRGB; plan: NEB_RGB).
const vec3 N_HA = ${v3(C.ha)}, N_S2 = ${v3(C.s2)}, N_O3 = ${v3(C.o3)}, N_SYN = ${v3(C.syn)}, N_GOLD = ${v3(C.gold)}, N_PINK = ${v3(C.pink)};
const vec3 N_ISM = ${v3(ISM)};   // the faint diffuse gas: the sky's haze colour
const vec3 N_BLUE = ${v3(C.blue)}, N_VIOLET = ${v3(C.violet)}, N_GREEN = ${v3(C.green)}, N_YEL = ${v3(C.yellow)}, N_WHITE = ${v3(C.white)};
// 3D value noise on Hoskins' hash, each lattice value read through a triangle wave (uniform still, and
// continuous where the hash wraps, so the plan's mirror, dew-plan.js noise3G, agrees with it).
float dewH3(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float dewT3(vec3 p) { return 1.0 - abs(2.0 * dewH3(p) - 1.0); }
float dewN3(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dewT3(i), dewT3(i + vec3(1.0, 0.0, 0.0)), u.x), mix(dewT3(i + vec3(0.0, 1.0, 0.0)), dewT3(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(dewT3(i + vec3(0.0, 0.0, 1.0)), dewT3(i + vec3(1.0, 0.0, 1.0)), u.x), mix(dewT3(i + vec3(0.0, 1.0, 1.0)), dewT3(i + vec3(1.0)), u.x), u.y), u.z);
}
// Turbulence in 3D: Σ |2n − 1| over octaves, whose valleys are thin sheets and filaments; and plain fbm.
float dewTurb3(vec3 p) { float s = 0.0, a = .5; for (int i = 0; i < 4; i++) { s += a * abs(2.0 * dewN3(p) - 1.0); p = p * 2.07 + vec3(1.7, 9.2, 4.4); a *= .5; } return s; }
float dewFbm3(vec3 p) { float s = 0.0, a = .5; for (int i = 0; i < 3; i++) { s += a * dewN3(p); p = p * 2.03 + vec3(5.1, 2.3, 7.9); a *= .5; } return s; }
// A supernova remnant at frame point u (|u| = 1 at its forward shock; plan: nebFrame), x its age over
// its growth, sd its seed, hot how hot its progenitor was (0 red .. 1 blue): its light (linear) and its
// dust. A sphere seen through: the shell of swept-up gas between the contact discontinuity and the
// forward shock, limb-brightened as the path through it (√(1 − ρ²) − √(a² − ρ²) through each half;
// plan: nebDensity), its gas in wisps of turbulence in its front half and its back half both (two veils
// of filaments over each other), its inner edge rippled into Rayleigh–Taylor fingers by direction where
// the ejecta push into it; within, knots of ejecta lit by the reverse shock in [O III]; at its edge the
// forward shock's thin bright rim. Its structure is the sphere's own (sampled at u), so it expands with
// the shell (homologous), churning slowly as it ages; young, it is hot and white-blue.
vec4 dewSphere(vec2 u, float x, float sd, float hot) {
  float r2 = dot(u, u), r = sqrt(r2);
  if (r > 1.1) return vec4(0.0);
  vec3 o = vec3(sd * 37.1, sd * 19.7, sd * 7.3 + x * .5);
  float zm = sqrt(max(.88 * .88 - r2, 0.0));
  vec3 pf = vec3(u, zm), pb = vec3(u, -zm);
  // The fingers: the shell's inner edge a in .7 .. .9 by direction.
  float af = .8 + .1 * (2.0 * dewN3(pf / max(length(pf), 1e-3) * 3.4 + o) - 1.0);
  float ab = .8 + .1 * (2.0 * dewN3(pb / max(length(pb), 1e-3) * 3.4 + o + 3.0) - 1.0);
  float outer = sqrt(max(1.0 - r2, 0.0));
  float cf = max(outer - sqrt(max(af * af - r2, 0.0)), 0.0), cb = max(outer - sqrt(max(ab * ab - r2, 0.0)), 0.0);
  // Wisps (the valleys of turbulence) and a softer body of gas, front and back.
  float wf = pow(max(1.0 - dewTurb3(pf * 3.4 + o), 0.0), 5.0), wb = pow(max(1.0 - dewTurb3(pb * 3.4 + o + 5.0), 0.0), 5.0);
  float bf = dewFbm3(pf * 2.6 + o + 9.0), bb = dewFbm3(pb * 2.6 + o + 13.0);
  bf = smoothstep(.35, .75, bf); bb = smoothstep(.35, .75, bb);
  float limb = 1.0 - .7 * smoothstep(.84, .99, r);
  float front = cf * ((.03 + .3 * bf) * limb + 4.8 * wf * (.35 + .65 * bf)), back = cb * ((.03 + .3 * bb) * limb + 4.8 * wb * (.35 + .65 * bb)) * .7;
  // Its light: gold and amber (Hα, [S II]), cream only in its brightest wisps, a hotter progenitor's
  // shell tinged with [O III] in patches.
  float teal = hot * .55 * smoothstep(.4, .7, dewN3(pf * 1.9 + o + 21.0));
  vec3 shellC = mix(mix(N_HA, N_GOLD, smoothstep(.35, .75, dewN3(pf * 2.2 + o + 4.0))), N_S2, bb * .5);
  shellC = mix(shellC, mix(N_O3, N_GREEN, .25), teal);
  vec3 em = shellC * (front + back) + N_WHITE * (pow(wf, 3.0) * cf + pow(wb, 3.0) * cb * .7) * .6;
  // The ejecta: knots in [O III] within, teal, more of them from a hotter star.
  float ce = sqrt(max(.7 * .7 - r2, 0.0));
  float kn = dewFbm3(vec3(u * 5.2, sd * 3.0) + o);
  float knots = smoothstep(.5 - .06 * hot, .72, kn) * (.4 + .6 * pow(max(1.0 - dewTurb3(vec3(u * 7.0, sd) + o + 40.0), 0.0), 2.0));
  em += mix(N_O3, N_BLUE, smoothstep(.4, .7, dewN3(vec3(u * 3.0, 1.0) + o))) * ce * knots * (1.0 + 1.6 * hot);
  // The forward shock: a thin rim, brightest at the limb, rippled.
  float rr = r * (1.0 + .012 * (2.0 * dewN3(vec3(u * 9.0, 2.0) + o) - 1.0));
  float rim = max(sqrt(max(1.0 - rr * rr, 0.0)) - sqrt(max(.982 * .982 - rr * rr, 0.0)), 0.0);
  em += mix(N_HA, N_WHITE, .45) * rim * (.3 + 1.1 * dewN3(vec3(atan(u.y, u.x) * 4.0, 0.0, sd * 9.0))) * 1.3;
  // Young, it is hotter: whiter and bluer.
  em = mix(em, dot(em, vec3(.3, .4, .3)) * mix(N_WHITE, N_BLUE, .4), .3 * exp(-x / .1));
  // Dust in its front half, in lanes.
  float dust = smoothstep(.55, .8, dewFbm3(pf * 2.6 + o + 31.0)) * cf * 1.4;
  return vec4(em, dust);
}
// The lit gas at a sky point (plan px), linear light, and its dust (rendered by transit.js into uGas).
// Each supernova's flash lights the dust in a thin echo racing out at the speed of light and ionises
// the gas near it (its [O III] flares, then it glows in Hα as it recombines); each remnant grows about
// its star, bright as it is young.
vec4 dewGasField(vec2 qp, float P) {
  vec4 m = dewData(25);
  int n = int(m.x), eb = int(m.y);
  vec2 WH = dewData(0).xy;
  float sc = WH.y / 900.0;
  float ha, o3, dust;
  dewISM(qp, ha, o3, dust);
  float ism = smoothstep(dewData(eb).z - .02, dewData(eb).z + .1, P);
  vec3 em = vec3(0.0);
  float ionH = 0.0, ionO = 0.0, dd = 0.0, e1 = 0.0, e2 = 0.0, cav = 0.0;
  for (int k = 0; k < 7; k++) {
    if (k >= n) break;
    int b = eb + 5 * k;
    vec4 E0 = dewData(b);
    float s = P - E0.z;
    if (s <= 0.0) continue;
    vec4 E1 = dewData(b + 1), E2 = dewData(b + 2);
    vec2 d = qp - E0.xy;
    float r = length(d), L = E1.z, Rm = E1.x;
    float c = 26000.0 * sc, since = s - r / c;
    float reach = 1.0 - smoothstep(1.0, 1.6, r / Rm);
    float arrive = smoothstep(-.008, .01, since);
    if (arrive > 0.0) {
      float sp = max(since, 0.0);
      ionO = max(ionO, arrive * exp(-sp / .07) * reach * L);
      ionH = max(ionH, arrive * (1.0 - exp(-sp / .02)) * exp(-sp / .4) * reach * L);
    }
    // The light echo: the flash lighting the dust in a thin ring racing out at c.
    em += mix(N_WHITE, N_O3, .35) * exp(-pow((r - c * s) / (16.0 * sc + .07 * c * s), 2.0)) * exp(-s / .03) * dust * 1.2 * L;
    float x = s / E0.w, R = Rm * dewRemnant(x);
    if (R < 1.0 || r > R * 1.1 + 4.0) continue;
    vec2 u = d / R;
    // The blast wave sweeps the gas round it into its shell, leaving a hot, thin cavity: dark within.
    cav = max(cav, 1.0 - smoothstep(.96, 1.03, length(u)));
    vec4 neb = dewSphere(u, clamp(x, 0.0, 1.0), E1.w, smoothstep(0.0, 1.0, (log(E2.z * 10000.0) - ${f(Math.log(3400))}) / ${f(Math.log(25000 / 3400))}));
    float lit = (1.0 + 2.5 * exp(-x / .06)) / (1.0 + 1.2 * x);
    em += neb.rgb * lit * L * 1.2;
    dd = max(dd, neb.a);
    // Where two shells meet, their gas collides: a brighter arc.
    float edge = smoothstep(.9, .985, length(u)) * (1.0 - smoothstep(.995, 1.04, length(u)));
    e2 = max(e2, min(e1, edge)); e1 = max(e1, edge);
  }
  float open_ = 1.0 - cav;
  em += N_WHITE * e2 * .12 + (N_ISM * ha * ism + (N_O3 * o3 * ionO * .9 + N_HA * ha * ionH * .85 + N_S2 * ha * ionH * smoothstep(.3, .9, dust) * .4) * .6) * open_;
  return vec4(em, max(max(dust * .5 * ism * open_, dd), cav * .62));
}
vec4 dewGasPacked(vec2 px, float P) {
  vec4 g = dewGasField(px * dewData(0).xy / R, P);
  return vec4(sqrt(clamp(g.rgb / 4.0, 0.0, 1.0)), g.a);
}
vec4 dewGasAt(vec2 qs, vec2 S) {
  vec4 g = textureLod(uGas, vec2(clamp(qs.x / S.x, 0.0, 1.0), 1.0 - clamp(qs.y / S.y, 0.0, 1.0)), 0.0);
  return vec4(g.rgb * g.rgb * 4.0, g.a);
}
// ---- gravity's spots (dew-plan.js makeClumps) ---------------------------------------------------------
// Free fall: a shell's radius over its first, cos²β, where β + sin β cos β = τπ/2 (τ = t / t_ff).
float dewFreeFall(float tau) {
  if (tau <= 0.0) return 1.0;
  if (tau >= 1.0) return 0.0;
  float b = tau * PI * .25;
  // (Newton's method, rising to the root from below; done once it has stopped moving.)
  for (int i = 0; i < 8; i++) {
    float was = b;
    b = clamp(b - (b + sin(b) * cos(b) - tau * PI * .5) / max(1.0 + cos(2.0 * b), .02), 0.0, PI * .5);
    if (abs(b - was) < 1e-6) break;
  }
  return cos(b) * cos(b);
}
// The gas as it falls into its clumps (linear light; q: the screen point). Before they fall the pattern
// shows first, faintly, its contrast growing (e^{σt}: each cell brighter at its middle, dimmer at its
// edges). Then each clump's cell of gas falls in on itself, every point toward its middle by the free-
// fall factor (a uniform sphere falls in all at once, homologous), so what was there is seen gathering,
// its light squeezed brighter (the same light in less room) while the lanes between cells go dark; as
// it nears its drop's size its light condenses into the drop (glsl/units.js drops), with a soft bloom.
// A little of the gas is left behind (residual). glow: the light that blooms over its surroundings.
// (Worked a clump at a time, reading the tile's list again rather than keeping it in arrays, which cost
// the GPU more than the reads (each clump is written out whole in the list: dew-plan.js packDew); and only
// where something changes: a clump not yet falling has its cell as it was, so all of them take their
// shares of the gas at q from one sum, and a fallen one has nothing left in its cell. The glow is left
// out only where it is under a millionth.)
// (The list's entry e is three texels from dewData(16).y + 3e: where the clump is, its Jeans length, how
// far its cell reaches; when it starts to fall, when its drop snaps in, the drop's radius, its record;
// its colour.)
vec3 dewSpots(vec2 q, vec2 S, float P) {
  vec3 g0 = dewGasAt(q, S).rgb;
  vec4 h16 = dewData(16), h17 = dewData(17);
  // (A click's clocks: the pattern after its light has passed, the falls nearest the click first.)
  float g0P = gClick > .5 ? dewClickEcho(dewUp(q)) + .01 : ${f(SPOTS.grow0)};
  float g1P = gClick > .5 ? dewClickSpots(dewUp(q)) : ${f(SPOTS.start)};
  float lastP = gClick > .5 ? dewClickSpots(1.0) + ${f(CLICK.kappa * SPOTS.tffMax)} : h17.y;
  if (P < g0P || h16.w < .5) return g0;
  float res = ${f(SPOTS.residual)};
  if (P > lastP + .04) return g0 * res;
  vec2 toPlan = dewData(0).xy / S, qp = q * toPlan;
  int cols = int(h16.w), rows = int(h17.x), eb = int(h16.y);
  ivec2 t = clamp(ivec2(floor(qp / h16.z)), ivec2(0), ivec2(cols - 1, rows - 1));
  vec4 head = dewData(int(h16.x) + t.y * cols + t.x);
  int n = min(int(head.y), 16), e0 = int(head.x);
  if (n == 0) return g0;
  // When each clump falls (τ), the nearest middle, and the pull of every clump at q (each falling off
  // over its Jeans length): the soft partition's sum for the clumps not yet falling.
  float tmax = 0.0, dmin = 1e3, pull = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    vec4 A = dewData(eb + 3 * (e0 + i)), T = dewData(eb + 3 * (e0 + i) + 1);
    vec2 c = A.xy;
    if (gClick > .5) { float ts = dewClickSpots(dewUp(c / toPlan)); T.y = ts + ${f(CLICK.kappa)} * (T.y - T.x); T.x = ts; }
    tmax = max(tmax, clamp((P - T.x) / max(T.y - T.x, 1e-4), 0.0, 1.0));
    float di = length(qp - c) / A.z;
    dmin = min(dmin, di);
    pull += exp(-di * di / .3);
  }
  float grow = smoothstep(g0P, g1P, P);
  // Before any of them falls: only the pattern, each point brighter the nearer its clump's middle.
  float M = 1.0 + grow * .45 * (1.6 * exp(-dmin * dmin / .2) - .5);
  if (tmax <= 0.0) return g0 * M;
  vec3 sum = vec3(0.0), glow = vec3(0.0);
  float still = 0.0;
  for (int j = 0; j < 16; j++) {
    if (j >= n) break;
    int e = eb + 3 * (e0 + j);
    vec4 A = dewData(e), T = dewData(e + 1);
    vec2 cc = A.xy;
    // (As the plan's record has it: its Jeans length, when it starts to fall, when it snaps in, its reach.)
    vec4 cl = vec4(A.z, T.xy, A.w);
    if (gClick > .5) { float ts = dewClickSpots(dewUp(cc / toPlan)); cl.z = ts + ${f(CLICK.kappa)} * (cl.z - cl.y); cl.y = ts; }
    float tau = clamp((P - cl.y) / max(cl.z - cl.y, 1e-4), 0.0, 1.0), d = length(qp - cc);
    // Its core's glow as it nears its drop, and the bloom as the drop snaps in.
    float late = smoothstep(.45, .95, tau) * (1.0 - smoothstep(cl.z, cl.z + .012, P)), bloom = exp(-pow((P - cl.z) / .007, 2.0));
    bool falling = tau > 0.0 && tau < 1.0;
    float rd = T.z;
    vec3 col = vec3(0.0);
    if (falling || late > 0.0 || bloom > 1e-6) {
      col = dewData(e + 2).rgb;
      glow += col * (exp(-d * d / (rd * rd * 5.0)) * late * .5 + exp(-d / (rd * 2.5)) * bloom * .35);
    }
    // Not yet falling: its cell as it was, so its share of the gas at q is its pull over the sum above.
    if (tau <= 0.0) {
      float dj = d / cl.x, own = exp(-dj * dj / .3) / max(pull, 1e-6);
      if (d <= cl.w * 1.3 && own >= .002) still += own;
      continue;
    }
    // Fallen in: its gas is all in its drop.
    if (!falling) continue;
    // Falling, its cell shrinks toward its middle by sc, never below cos²(τπ/4) (β ≥ τπ/4): q beyond what
    // the cell reaches at that size takes none of its gas.
    float least = rd * 1.1 / cl.x;
    if (d > cl.w * 1.3 * max(pow(cos(tau * PI * .25), 2.0), least) * 1.001 + .01) continue;
    float sc = max(dewFreeFall(tau), least);
    vec2 p = cc + (qp - cc) / sc;
    float dp = length(p - cc), dj = dp / cl.x;
    if (dp > cl.w * 1.3) continue;
    // Its share of the gas at p: a soft partition (each clump's pull falling off over its Jeans length),
    // so cells have no hard borders and round off as they fall.
    // (Once the others' pull leaves it under the share it needs, below, the rest need not be added.)
    float wj = exp(-dj * dj / .3), wsum = wj;
    for (int k = 0; k < 16; k++) {
      if (k >= n || wsum * .002 > wj) break;
      if (k != j) { vec4 o = dewData(eb + 3 * (e0 + k)); float dk = length(p - o.xy) / o.z; wsum += exp(-dk * dk / .3); }
    }
    float own = wj / max(wsum, 1e-6);
    if (own < .002) continue;
    // Squeezed, the same light in less room (up to a point), its colours mixing toward its drop's.
    vec3 gp = dewGasAt(p / toPlan, S).rgb;
    float sq = min(1.0 / (sc * sc), 7.0), mixd = smoothstep(.5, .95, tau);
    gp = mix(gp, col * dot(gp, vec3(.3, .5, .2)) * 1.4, mixd * .7);
    sum += gp * own * M * sq * (1.0 - smoothstep(.82, 1.0, tau));
  }
  sum += g0 * M * still;
  return g0 * res + sum * (1.0 - res) + glow;
}
// Science's sky with its gas (linear): the dust dims the stars, the gas glows. q: the screen point.
vec3 dewGasLook(vec3 sky, vec2 q, vec2 S, float k) {
  vec4 g = dewGasAt(q, S);
  return sky * (1.0 - g.a * .75 * k) + g.rgb * k;
}
// What is drawn sharp over the gas (screen px): each supernova's giant pulses faster and faster, dims
// as its core collapses, then breaks out: a white-hot point swelling into a soft bloom with four
// diffraction spikes (the telescope's, as on Science's stars), fading along the nickel–cobalt light
// curve, warm as it cools. Its total light (out) dims the rest of the scene a little, as an eye adapts.
vec3 dewFlashes(vec2 px, float P, out float glare) {
  vec4 m = dewData(25);
  int n = int(m.x), eb = int(m.y);
  vec2 toPlan = dewData(0).xy / R;
  vec3 c = vec3(0.0);
  glare = 0.0;
  for (int k = 0; k < 7; k++) {
    if (k >= n) break;
    int b = eb + 5 * k;
    vec4 E0 = dewData(b);
    float s = P - E0.z;
    if (s < -.022 || s > .09) continue;
    vec4 E1 = dewData(b + 1), E2 = dewData(b + 2);
    vec2 d = px - E0.xy / toPlan;
    float r2 = dot(d, d), L = E1.z;
    vec3 tint = mix(vec3(1.0, .78, .58), vec3(.72, .84, 1.0), smoothstep(.4, 2.5, E2.z));
    if (s < 0.0) {
      float beat = .5 + .5 * sin(TAU * (s + .022) * (60.0 + 900.0 * (s + .022)));
      if (r2 < 400.0) c += tint * exp(-r2 / 22.0) * beat * smoothstep(-.022, -.01, s) * (1.0 - smoothstep(-.004, 0.0, s)) * 1.4 * L;
      continue;
    }
    float Lc = dewLight(s);
    glare += Lc * L;
    if (r2 > 250000.0) continue;
    vec2 ad = abs(d);
    float core = exp(-r2 / (2.0 * pow(1.5 + 3.0 * Lc, 2.0)));
    float bloom = exp(-sqrt(r2) / (10.0 + 34.0 * Lc)) * .55 + exp(-sqrt(r2) / (60.0 + 120.0 * Lc)) * .12;
    float len = 30.0 + 120.0 * Lc;
    float spikes = exp(-ad.y / .8) * exp(-ad.x / len) + exp(-ad.x / .8) * exp(-ad.y / len);
    vec3 hot = mix(vec3(.84, .9, 1.0), mix(vec3(1.0, .93, .82), tint, .5), smoothstep(0.0, .03, s));
    c += hot * (core * 2.0 + bloom + spikes * .55) * Lc * L;
  }
  return c;
}

// ---- Science's chrome drops as water (cosmos.js, on a click from Science) ----------------------------
float gDewTan0 = .1;     // a click: tan δ₀, the window onto Racing at this point
float gDewLight = 0.0;   // the light's turn about the view axis
float gDewDawn = 1.0;    // a click: how far day has come to Racing
vec3 gDewTint = vec3(1.0);
vec3 dewJewel(vec3 c) {
  float l = dot(c, vec3(.2126, .7152, .0722));
  vec3 j = mix(vec3(.008, .05, .2), vec3(.03, .55, 1.0), smoothstep(.4, .92, l));
  return mix(j, vec3(.3, 1.0, .82) * 1.25, smoothstep(.86, 1.0, l) * .55);
}
vec3 dewRacing(vec2 p, vec2 S, float lod) {
  vec3 c = dewLinear(textureLod(uTexB, vec2(clamp(p.x / S.x, 0.0, 1.0), 1.0 - clamp(p.y / S.y, 0.0, 1.0)), lod).rgb);
  return mix(dewJewel(c), c * gDewTint, gDewDawn);
}
vec3 dewNight(vec2 p, vec2 S, float lod) {
  return dewLinear(textureLod(uTexA, vec2(clamp(p.x / S.x, 0.0, 1.0), 1.0 - clamp(p.y / S.y, 0.0, 1.0)), lod).rgb);
}
// The light that lights everything wet or cut: a window (four panes) above and to the left, turning
// slowly with the seam, as the drops show it, with a hot point at its middle.
vec3 dewLightDir() { vec3 L = DEW_LIGHT; L.xy = mat2(cos(gDewLight), sin(gDewLight), -sin(gDewLight), cos(gDewLight)) * L.xy; return L; }
vec3 dewWindow(vec3 rf) {
  vec3 L = dewLightDir();
  float c = dot(rf, L);
  if (c < .75) return vec3(0.0);
  vec3 ax = normalize(cross(L, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0)), ay = cross(L, ax);
  vec2 w = vec2(dot(rf, ax), dot(rf, ay)) / c;
  float box = smoothstep(.2, .17, abs(w.x)) * smoothstep(.15, .12, abs(w.y));
  float bars = 1.0 - .85 * max(exp(-abs(w.x) / .009), exp(-abs(w.y) / .009));
  return vec3(1.0, .98, .95) * box * bars * 2.6 + vec3(1.0, .97, .92) * pow(c, 600.0) * 6.0;
}
// The cap normal at a point of a lone metaball (Science's drops): its field is F = z²/d², so the
// point lies s = 1/√F of the way out, along the field's slope.
vec3 dewMetaNormal(vec2 G, float Fd) {
  float s = clamp(inversesqrt(max(Fd, 1e-4)), 0.0, 1.0);
  vec2 g = length(G) > 1e-6 ? -normalize(G) : vec2(0.0);
  float alpha = asin(clamp(s * sin(radians(62.0)), 0.0, 1.0));
  return vec3(g * sin(alpha), cos(alpha));
}
// Science's chrome drops once water (cosmos.js calls this on a click, so it reads only the snapshots).
vec3 dewLensOne(vec3 n, vec2 p, float a, vec2 S) {
  float alpha = acos(clamp(n.z, 0.0, 1.0));
  vec2 dir = length(n.xy) > 1e-5 ? -normalize(n.xy) : vec2(0.0);
  float sa = sin(alpha), sd = clamp(DEW_WATER.g * sin(alpha - asin(sa / DEW_WATER.g)), 0.0, .9995), t = sd / sqrt(1.0 - sd * sd);
  float F = .55 * S.y, lod = clamp(log2(F * .3 / max(a, 1.0) * .6), 0.0, 5.0);
  float w = smoothstep(gDewTan0 * 1.04, gDewTan0 * .96, t);
  vec3 col = mix(w < 1.0 ? dewNight(p + dir * F * .35 * t, S, lod + 1.0) : vec3(0.0), w > 0.0 ? dewRacing(p + dir * F * t, S, lod) : vec3(0.0), w);
  float fr = .02 + .98 * pow(1.0 - n.z, 5.0);
  vec3 rf = reflect(vec3(0.0, 0.0, -1.0), n);
  float sp = max(dot(rf, dewLightDir()), 0.0);
  return col * (1.0 - fr) + vec3(.02, .025, .05) * fr + vec3(1.0, .97, .92) * (pow(sp, 90.0) * 9.0 + pow(sp, 18.0) * .12);
}
vec3 dewDropWater(vec2 G, float Fd, vec2 px) {
  vec3 c = dewLensOne(dewMetaNormal(G, Fd), px, R.y * .06, R);
  c += vec3(.55, .7, .9) * smoothstep(.93, 1.0, inversesqrt(max(Fd, 1e-4))) * .25;
  return dewDisplay(dewCompress(c));
}
// Science's drops (cosmos.js): they settle where the plan has them; the front of cold (from Racing's
// card on the scroll, from the click on a click) frosts each over, and it splits into mirror shards
// (glsl/units.js shards) as the water drops do.
void dewScience(float P, vec2 S, bool click) {
  for (int i = 0; i < 6; i++) {
    vec2 base = dewData(4 + i).xy * S / dewData(0).xy;
    if (click) {
      // (Settling as the light passes; frosting over as the click's cold reaches it; split, gone.)
      float up = dewUp(base), tf = dewClickFreeze(up);
      gDrop[i] = vec4(0.0, 0.0, 1.0 - smoothstep(dewClickEcho(up), dewClickEcho(up) + .1, P), 0.0);
      gDropIce[i] = smoothstep(tf, tf + ${f(CLICK.split)}, P);
      gDropScale[i] = 1.0 - step(tf + ${f(CLICK.split)}, P);
      continue;
    }
    vec4 ch = dewData(10 + i);
    gDrop[i] = vec4(0.0, 0.0, 1.0 - smoothstep(.12, .3, P), 0.0);
    gDropScale[i] = 1.0 - step(ch.y, P);
    gDropIce[i] = smoothstep(ch.x, ch.y, P);
  }
}
// A chrome drop freezing (cosmos.js calls it where gIce > 0): frost creeping over the mirror, glinting,
// a white flash as it freezes through.
vec3 dewChromeIce(vec3 face, vec2 px) {
  int i = gIceDrop;
  float prog = gDropIce[i];
  vec2 gc = floor(px / 2.5);
  float frost = smoothstep(0.0, .7, prog), flash = exp(-pow((prog - .95) / .06, 2.0)) * .25;
  vec3 f = mix(face, face * .75 + vec3(.55, .66, .74) * (.6 + .4 * noise(px * .04 + float(i))) * .35, frost * .5);
  return f + vec3(1.0, .98, .94) * flash * .9;
}

// ---- cold from the card, the vacuum (the scroll; dew-plan.js makeShards) -----------------------------
// Racing's card where the plan has it (plan px), and how far q is from it (0 inside).
float dewCardDist(vec2 qp) { if(dewData(23).w>.5)return length(qp-dewData(24).xy);return trDistance(qp,trFrame(dewData(0).xy,dewData(19),0.0)); }
// When the front from the card reaches q (dew-plan.js freezeTime).
float dewFreezeAt(vec2 qp) {
  vec4 h = dewData(18), g = dewData(22);
  float d = dewCardDist(qp);
  float wave = .6 * sin(qp.x * .0061 + qp.y * .0037) * sin(qp.y * .0053 - qp.x * .0029) + .4 * sin(qp.x * .0113 - qp.y * .0071 + 1.3);
  return g.x + d / h.w + g.y * wave * min(1.0, d / 160.0);
}
// The field at q (bilinear on the plan's grid): the direction of its line, how long its gas takes to
// reach the card, and when q has been emptied.
vec4 dewFieldAt(vec2 qp) {
  vec4 h = dewData(20);
  vec2 g = clamp(qp / h.w, vec2(0.0), vec2(h.y, h.z) - 1.001);
  ivec2 i = ivec2(floor(g));
  vec2 fr = fract(g);
  int cols = int(h.y), o = int(h.x) + i.y * cols + i.x;
  vec4 v = mix(mix(dewData(o), dewData(o + 1), fr.x), mix(dewData(o + cols), dewData(o + cols + 1), fr.x), fr.y);
  v.xy /= max(length(v.xy), 1e-4);
  return v;
}
// The old world drawn in along the field: what is at q now came from upstream along its line, smeared
// along it (line integral convolution, as iron filings show a magnet's field), thinning as the vacuum
// takes it. k: how far it has gone (0 → 1); dir: the line's direction (toward the card), screen px.
vec3 dewDrain(vec2 q, vec2 S, vec2 dir, float k, out vec3 sky) {
  float d = 6.0 + 90.0 * k * k, L = 10.0 + 70.0 * k;
  vec3 g = vec3(0.0);
  sky = vec3(0.0);
  for (int j = 0; j < 5; j++) {
    vec2 p = q - dir * (d + L * float(j) / 4.0);
    g += dewGasAt(p, S).rgb;
    sky += textureLod(uTexA, vec2(clamp(p.x / S.x, 0.0, 1.0), 1.0 - clamp(p.y / S.y, 0.0, 1.0)), 0.0).rgb;
  }
  sky = dewLinear(sky / 5.0);
  return g / 5.0;
}
// Behind the front from the card the sky is colder, a touch bluer; at the front, a delicate line of
// frost, fibrous (hoar frost's needles), catching the light.
vec3 dewColdFront(vec3 col, vec2 qp, float P, float tf) {
  float behind = smoothstep(tf - .002, tf + .025, P);
  col = mix(col, col * vec3(.8, .94, 1.12) + vec3(.003, .008, .016), behind * .65);
  float x = (P - tf) / .0028;
  float fib = pow(abs(sin(dot(qp, vec2(.83, .55)) * .9 + 6.0 * noise(qp * .045))), 6.0) * .7 + .3 * noise(qp * .4);
  float broken = smoothstep(.35, .75, noise(qp * .02 + 7.0));
  col += vec3(.72, .88, 1.0) * exp(-x * x) * fib * broken * .22;
  return col;
}
// The scroll: Science as it is until its giants end; their remnants and the gas they light; gravity's
// spots gathering the gas into drops (the drops are glsl/units.js's); Racing's card appearing as cold
// glass and its front of frost spreading out from it (each drop freezing and splitting, glsl/units.js);
// the vacuum drawing the old world in along the field (the shards along their lines), emptying it
// outward from the card so Racing's world shows; the card taking in the light and annealing.
// (Science lands live while it shows, its snapshot once its drops have formed.)
vec4 dewScroll(vec2 q, vec2 px, vec2 S, float P) {
  if (P < dewData(int(dewData(25).y)).z - .025) return vec4(sceneCosmos(px), 1.0);
  dewGiantsGone(P);
  dewScience(P, S, false);
  vec2 toPlan = dewData(0).xy / S, qp = q * toPlan;
  float tf = P > ${f(FREEZE.f0)} - .02 ? dewFreezeAt(qp) : 9.0;
  vec4 fd = tf < 8.0 ? dewFieldAt(qp) : vec4(0.0, 0.0, 0.0, 9.0);
  float te = fd.w + .03 * (noise(qp * .006 + 5.0) - .5);
  // (The card's own glass stays dark until its shards' light fills it.)

  float open = smoothstep(te - .02, te + .035, P);
  vec3 col = vec3(0.0);
  if (open < 1.0) {
    float veil = smoothstep(.5, .58, P);
    vec3 sci = vec3(0.0);
    vec4 ga = dewGasAt(q, S);
    vec3 gas;
    if (P > tf) {
      // Drawn in along the field.
      float k = smoothstep(tf, fd.w, P);
      vec3 sky;
      gas = dewDrain(q, S, fd.xy / toPlan * toPlan.y, k, sky) * ${f(SPOTS.residual)} * (1.0 - k * k);
      sci = sky * (1.0 - ga.a * .75) * (1.0 - .6 * k * k);
    } else {
      if (veil < 1.0) sci = sceneCosmos(px);
      if (veil > 0.0) sci = mix(sci, cosmosDrops(textureLod(uTexA, vec2(q.x / S.x, 1.0 - q.y / S.y), 0.0).rgb, px), veil);
      sci = dewLinear(sci) * (1.0 - ga.a * .75);
      gas = dewSpots(q, S, P);
    }
    sci += gas;
    if (P < .5) { float glare; vec3 fl = dewFlashes(px, P, glare); sci = sci / (1.0 + .3 * glare) + fl; }
    col = tf < 8.0 ? dewColdFront(sci, qp, P, tf) : sci;
  }
  if (open > 0.0) {
    // Emptied: Racing's world, at night (deep glacier blue, its caustics faint), a cool light at the
    // edge where the old world has just gone. When the card has taken everything in it gives its light
    // back: dawn sweeps out from it across Racing (a warm front), then its day.
    gCardMix = 0.0;
    vec3 rac = dewLinear(sceneGlacier(px));
    // (Round, from behind the card, as a supernova's shell was.)
    vec4 cr0 = dewData(19);
    float far = max(length(qp - cr0.xy - cr0.zw * .5) - .3 * length(cr0.zw), 0.0) / max(dewData(18).w * ${f(FREEZE.f1 - FREEZE.f0)} + .3 * length(cr0.zw), 1.0);
    // (The card's light goes out as a ring, as the supernovae's did at the start: its front a thin bright
    // rim, day behind it, warm at first.)
    float td = 1.07 + .065 * far, day = smoothstep(td - .004, td + .02, P);
    vec3 night = rac * vec3(.002, .004, .009) + vec3(.0003, .0005, .0013);
    vec3 dawn = rac * vec3(.72, .62, .5) + vec3(.07, .035, .0);
    vec4 cr = dewData(19);
    vec2 dc = qp - cr.xy - cr.zw * .5;
    float rays = .55 + .45 * noise(vec2(atan(dc.y, dc.x) * 7.0, 3.0)) * noise(vec2(atan(dc.y, dc.x) * 23.0, 9.0) + P * 3.0);
    vec3 world = mix(night, mix(dawn, rac, smoothstep(td + .015, td + .07, P)), day) + vec3(1.0, .84, .58) * (exp(-pow((P - td) / .0022, 2.0)) * .12 * rays + exp(-pow((P - td - .005) / .012, 2.0)) * .05) * (1.0 - .45 * far);
    col = mix(col, world, open) + vec3(.6, .82, 1.0) * exp(-pow((P - te - .008) / .016, 2.0)) * .08 * (1.0 - day);
  }
  if(dewData(23).w>.5)return vec4(acSurface(dewDisplay(col),qp,P),1.0);
  vec3 frame=trFrame(dewData(0).xy,dewData(19),P);
  vec2 tp=trLocal(qp,frame);
  float r=trRadius(tp),phase=trShapePhase(tp,TR_A,max(r,TR_IN));
  vec4 fh=dewData(21);
  int lane=int(clamp(floor((r-TR_IN)/TR_LANE),0.0,7.0));
  float land=dewData(int(fh.x)+lane*int(fh.y)+int(phase*(fh.y-1.0))).x;
  float material=smoothstep(.76,1.14,P);
  float energy=smoothstep(.65,.84,P)*(1.0-smoothstep(1.05,1.14,P));
  material=max(material,smoothstep(land-.01,land+.018,P));
  return vec4(trSurface(dewDisplay(col),qp,frame,smoothstep(.48,.56,P),material,energy,P>=1.14?T:-1.0),1.0);
}
// A click into Racing (dew-plan.js CLICK): the scroll's story about the click. A star dies at the click:
// its core beats and collapses, then breaks out (the flash, over the old page); its light races out as a
// thin ring, and behind it the remnants' gas over Science's sky is lit, covering the page, brightest
// just after the light passes. Gravity's spots gather the gas into drops, nearest the click first, as the
// stars condense into beads (glsl/units.js). The cold spreads out from the click as a ring of frost; the
// click draws everything in along its field (a point sink: the old world drains in, line integral
// convolution, the shards fly in along r = r₀√(1 − t/T)), and where everything has gone Racing shows,
// at night. The light gathers at the click, a new star. Once the page has changed (P .84) it goes out as
// a ring of dawn, the new page behind it (clearStart: scene.js's DOM aperture follows it).
// Premultiplied linear light, and alpha.
vec4 dewClick(vec2 q, vec2 px, vec2 S, float P) {
  gClick = 1.0;
  vec2 O = uPoint, dv = q - O, ad = abs(dv);
  float up = dewUp(q), d = length(dv);
  float te = dewClickEcho(up), tf = dewClickFreeze(up), to = dewClickOpen(up);
  // The star at the click: its beat, then its breakout, its light racing out as a ring.
  float s = P + .2;
  vec3 flash = vec3(0.0);
  if (s < .14) {
    float Lc = dewLight((s - .02) * .35), beat = (.5 + .5 * sin(TAU * s * (30.0 + 500.0 * s))) * smoothstep(0.0, .006, s) * (1.0 - smoothstep(.014, .02, s));
    vec3 hot = mix(vec3(.84, .9, 1.0), vec3(1.0, .93, .82), smoothstep(.0, .05, s));
    flash = hot * (exp(-d * d / (2.0 * pow(2.0 + 5.0 * Lc, 2.0))) * 2.0 + exp(-d / (14.0 + 50.0 * Lc)) * .55
      + (exp(-ad.y / .8) * exp(-ad.x / (40.0 + 180.0 * Lc)) + exp(-ad.x / .8) * exp(-ad.y / (40.0 + 180.0 * Lc))) * .5) * Lc
      + vec3(1.0, .85, .7) * exp(-d * d / 30.0) * beat * .9;
  }
  flash += vec3(.75, .88, 1.0) * (exp(-pow((P - te + .004) / .005, 2.0)) * .9 + exp(-pow((P - te + .01) / .015, 2.0)) * .12) * step(P, .3);
  float cover = smoothstep(te - .002, te + .02, P), open = smoothstep(to - .012, to + .02, P);
  vec3 col = vec3(0.0);
  if (cover > 0.0 && open < 1.0) {
    // Science's sky behind the light (its giants long gone, its stars condensing as their beads do
    // here, its chrome drops frosting as the cold reaches them), the remnants' gas lit.
    gSkyP = ${f(SKY.c0)} + (P - dewClickSpots(up) - .03) / ${f(CLICK.bead)};
    for (int k = 0; k < GIANT_N; k++) gGiantGone[k] = 1.0;
    dewScience(P, S, true);
    vec3 sky = dewLinear(sceneCosmos(px));
    vec4 ga = dewGasAt(q, S);
    vec3 gas;
    if (P > tf) {
      // Drawn into the click.
      float k = smoothstep(tf, to, P), dd = 6.0 + 90.0 * k * k, L = 10.0 + 70.0 * k;
      vec2 dir = d > 1.0 ? -dv / d : vec2(0.0);
      gas = vec3(0.0);
      for (int j = 0; j < 5; j++) gas += dewGasAt(q - dir * (dd + L * float(j) / 4.0), S).rgb;
      gas *= .2 * ${f(SPOTS.residual)} * (1.0 - k * k);
      sky *= 1.0 - .7 * k;
    } else gas = dewSpots(q, S, P);
    col = sky * (1.0 - ga.a * .75) + gas * (1.0 + 1.4 * exp(-max(P - te, 0.0) / .03));
    col = dewColdFront(col, q, P, tf);
  }
  if (open > 0.0) col = mix(col, dewLinear(sceneGlacier(px)) * vec3(.07, .15, .27) + vec3(.002, .006, .016), open);
  // The light gathered at the click, a new star, its rays turning; let go as the page changes.
  float th = atan(dv.y, dv.x);
  float gather = smoothstep(.38, .82, P), rel = smoothstep(.84, .9, P);
  float rays = .55 + .45 * noise(vec2(th * 9.0, P * 3.0)) * noise(vec2(th * 23.0, 7.0));
  col += mix(${v3(C.gold)}, vec3(1.0, .96, .9), .55) * (exp(-d / (5.0 + 20.0 * gather)) * 1.6 + exp(-d / (40.0 + 130.0 * gather)) * .22 * rays) * gather * (1.0 - rel);
  // After the change: the light out as a ring of dawn, the new page behind it.
  float cs = dewClearStart(q), clear = P >= .84 ? smoothstep(cs, cs + .08, P) : 0.0;
  col += vec3(1.0, .85, .6) * (exp(-pow((P - cs - .022) / .007, 2.0)) * .8 * rays + exp(-pow((P - cs - .03) / .02, 2.0)) * .12) * step(.84, P);
  float a = cover * (1.0 - clear);
  return vec4(col * a + flash * (1.0 - .6 * cover), a);
}
vec4 dewMaterial(vec2 q, vec2 px, vec2 S, float P, bool click, bool reveal) {
  if (P <= -.2) return click ? vec4(0.0) : vec4(sceneCosmos(px), 1.0);
  if (click && P >= 1.12) return vec4(0.0);
  if (!click) gSkyP = P;
  // The scroll's end: Racing, its track in place (the band's own world draws the same).
  if (!click && P >= 1.18) { gCardMix = 1.0; return vec4(sceneGlacier(px), 1.0); }
  if (uIceReady < .5) {
    float clear = dewClear(q, P, click);
    if (click) { float f = smoothstep(-.2, .72, P) * (1.0 - clear); return vec4(dewDisplay(DEW_FROST * .55) * f, f); }
    return vec4(mix(sceneCosmos(px), sceneGlacier(px), smoothstep(-.2, 1.12, P)), 1.0);
  }
  if (!click) return dewScroll(q, px, S, P);
  vec4 o = dewClick(q, px, S, P);
  // (Premultiplied: shown in display light, kept premultiplied.)
  return vec4(dewDisplay(o.rgb / max(o.a, 1e-4)) * o.a + (o.a <= 0.0 ? dewDisplay(o.rgb) : vec3(0.0)), o.a);
}
`;
