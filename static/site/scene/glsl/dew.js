// Stars, nebulae, stardust, drops, ice (Science → Racing). Shared by the scroll seam and the click into
// Racing; a pure function of q and P, read from the plan dew-plan.js prepared (uReach, a 1024-wide
// RGBA32F texture: the nebulae, cores, drops and their tile lists, the crystals, the main crack, the
// fragments).
//   Physical: the nebulae's shapes and their emission lines; the stardust's collapse; each drop a
//   spherical cap traced exactly (Snell at the cap, out through the flat pane), so it shows the nebula
//   behind it inverted and minified, with water's dispersion at the rim, tinted by its depth of
//   coloured water (Beer–Lambert); recalescence and frost halos as the pane freezes; the snow crystals'
//   habits; the rift's elliptical opening.
//   Artistic: what condenses (water from a nebula) and how fast; the electricity; the light in the rift.
// Names uIceReady / uIceDetail are kept from the transition this replaces (scene.js sets them).
import { DEW, SN, CORE, NEB_RGB } from '../dew-plan.js';
const f = x => Number(x).toFixed(6);
const v3 = c => `vec3(${c.map(f).join(', ')})`;
const C = NEB_RGB;
export const DEW_GLSL = /* glsl */ `
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

// ---- a click's schedules (dew-plan.js) ---------------------------------------------------------------
float dewUp(vec2 q) { return clamp(length(q - uPoint) / farCorner(uPoint), 0.0, 1.0); }
float dewCold(vec2 q) { return -.18 + .62 * dewUp(q); }
float dewClearStart(vec2 q) { float up = dewUp(q); return .84 + .18 * up + .006 * sin(q.x * .008) * sin(q.y * .007) * up; }
float dewClear(vec2 q, float P, bool click) { if (!click) return 0.0; float c = dewClearStart(q); return smoothstep(c, c + .08, P); }

// ---- the nebulae ------------------------------------------------------------------------------------
// When the gas at a pane point (plan px) was swept up: the plan's 12 px grid, interpolated.
float dewCond(vec2 qp) {
  vec4 m = dewData(25), m2 = dewData(26);
  vec2 g = clamp(qp / m.w, vec2(0.0), m2.xy - 1.001);
  ivec2 i = ivec2(floor(g));
  vec2 fr = fract(g);
  int base = int(m.z), cols = int(m2.x), o = base + i.y * cols + i.x;
  return mix(mix(dewData(o).x, dewData(o + 1).x, fr.x), mix(dewData(o + cols).x, dewData(o + cols + 1).x, fr.x), fr.y);
}
// A remnant's radius over its final one: free expansion joined onto Sedov–Taylor (plan: remnantFrac);
// a planetary nebula's shell (plan: shellFrac).
float dewRemnant(float x) {
  if (x <= 0.0) return 0.0;
  float k = ${f(Math.pow(SN.xst, 0.6))};
  return pow(pow(x, -3.0) + pow(k * pow(x, .4), -3.0), -1.0 / 3.0) / pow(1.0 + pow(k, -3.0), -1.0 / 3.0);
}
float dewShell(float x) { return x <= 0.0 ? 0.0 : .1 + .9 * (1.0 - pow(1.0 - min(x, 1.0), 1.3)); }
// A supernova's light curve: the breakout spike, then ⁵⁶Ni → ⁵⁶Co decay heating (plan: lightCurve).
float dewLight(float s) {
  if (s <= 0.0) return 0.0;
  float decay = ${f(1 - SN.epsCo)} * exp(-s / ${f(SN.tauNi)}) + ${f(SN.epsCo)} * exp(-s / ${f(SN.tauCo)});
  return 2.2 * exp(-s / .0012) + decay * (1.0 - exp(-pow(s / ${f(SN.rise)}, 2.0)));
}
uniform sampler2D uGas;   // the lit gas over the screen at a fraction of its resolution (transit.js)
// Which giants have ended by P (the supernovae at once; the planetaries' giants shrink to white dwarfs).
void dewGiantsGone(float P) {
  vec4 m = dewData(25);
  int n = int(m.x), eb = int(m.y);
  for (int k = 0; k < 7; k++) {
    if (k >= n) break;
    float s = P - dewData(eb + 5 * k).z;
    bool pn = dewData(eb + 5 * k + 2).w > 3.5;
    if (s > -.003) gGiantGone[int(dewData(eb + 5 * k + 1).y)] = pn ? smoothstep(0.0, .06, s) : s < 0.0 ? smoothstep(-.003, 0.0, s) * .85 : 1.0;
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
const vec3 N_BLUE = ${v3(C.blue)}, N_VIOLET = ${v3(C.violet)}, N_GREEN = ${v3(C.green)}, N_YEL = ${v3(C.yellow)}, N_WHITE = ${v3(C.white)};
// A nebula of kind t at frame point u (|u| = 1 at its radius; plan: nebFrame), x its age over its
// growth, p its phases, sd a seed: its light (linear) and its dust. The plan's nebDensity is each
// kind's main structure here without its noise.
vec4 dewNebula(int t, vec2 u, float x, vec4 p, float sd) {
  float r = length(u), th = atan(u.y, u.x);
  vec2 o = vec2(sd * 37.1, sd * 19.7);
  vec3 em = vec3(0.0);
  float dust = 0.0;
  if (t == 0) {
    // The Crab: a pulsar wind nebula, blue-white synchrotron light streaked round the pulsar, its
    // wisps running outward; round it a cage of red and orange filaments, Rayleigh–Taylor fingers
    // pointing in, a few green with oxygen.
    float rho = r / (1.0 + .07 * sin(3.0 * th + p.x) + .05 * sin(5.0 * th + p.y) + .12 * (fbm3(u * 2.2 + o) - .5));
    float syn = pow(max(1.0 - rho, 0.0), 1.2) * (.45 + .55 * fbm3(u * vec2(3.0, 5.5) + o + 4.0));
    float wisp = pow(.5 + .5 * sin(60.0 * r - x * 30.0 + 4.0 * noise(u * 8.0 + o)), 8.0) * exp(-r / .2) * smoothstep(.03, .09, r);
    vec2 w = u * 3.2 + .9 * vec2(fbm3(u * 1.8 + o), fbm3(u * 1.8 + o + 9.0));
    float net = pow(max(1.0 - dewTurb(w), 0.0), 5.0);
    float fing = pow(dewRidge(vec2(th * 3.0, rho * 2.2) + o), 10.0) * smoothstep(.45, .95, rho);
    float shell = smoothstep(.3, .62, rho) * (1.0 - smoothstep(.93, 1.04, rho));
    float fil = (net * 2.2 + fing * .8) * shell * (.55 + .45 * (.5 + .5 * sin(9.0 * th + 2.0 * sin(4.0 * rho + p.z))));
    vec3 fc = mix(N_HA, N_S2, noise(u * 4.0 + o + 2.0));
    fc = mix(fc, N_GREEN, smoothstep(.62, .8, noise(u * 3.0 + o - 5.0)) * .7);
    em = N_SYN * syn * .3 + N_WHITE * wisp * .22 + fc * fil * 1.5;
  } else if (t == 1) {
    // Cassiopeia A: a lop-sided ring of fast knots, oxygen-green on one side, sulphur-red on the
    // other, iron-blue between; a thin blue rim where the forward shock runs; a jet of oxygen fingers
    // out through the rim and a weaker one opposite.
    float rho = r / (1.0 + .1 * sin(2.0 * th + p.x) + .07 * sin(3.0 * th + p.y) + .08 * (fbm3(u * 3.0 + o) - .5));
    float ring = dewG(rho, .78, .11);
    float knots = smoothstep(.5, .85, fbm(u * 9.0 + o));
    float fil = pow(max(1.0 - dewTurb(u * 5.0 + o), 0.0), 4.0);
    float sect = .5 + .5 * sin(1.5 * th + p.x);
    vec3 kc = mix(mix(N_O3, mix(N_BLUE, N_O3, .4), smoothstep(.3, .45, sect)), mix(N_HA, N_S2, noise(u * 6.0 + o)), smoothstep(.55, .7, sect));
    em = kc * ring * (knots * 3.2 + fil * 1.2 + .12) * (.7 + .3 * sin(5.0 * th + p.z));
    em += vec3(.45, .6, 1.0) * dewG(rho, 1.0, .02) * (.25 + .75 * noise(vec2(th * 14.0, 1.0) + o)) * .5;
    vec2 j = vec2(cos(p.w) * u.x + sin(p.w) * u.y, -sin(p.w) * u.x + cos(p.w) * u.y);
    float jet = exp(-pow(j.y / (.05 + .12 * max(abs(j.x) - .7, 0.0)), 2.0)) * smoothstep(.7, .9, abs(j.x)) * (1.0 - smoothstep(1.2, 1.45, abs(j.x))) * (j.x > 0.0 ? 1.0 : .4);
    em += N_O3 * jet * pow(dewRidge(vec2(j.x * 6.0, j.y * 30.0) + o), 3.0) * 1.2;
    em += kc * .1 * (1.0 - smoothstep(.5, .75, rho)) * knots;
  } else if (t == 2) {
    // The Veil: an old shell seen edge-on as two long arcs of braided strands, each strand red with
    // hydrogen on its inside and blue-green with oxygen just outside it (the layering of a cooling
    // shock), and a faint lace within.
    float arc = smoothstep(.15, .55, abs(cos(th - p.x))) * (.4 + .6 * smoothstep(.3, .7, noise(vec2(th * 3.0, 2.0) + o)));
    float ha = 0.0, oo = 0.0;
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      float rk = .9 + .028 * fk + .022 * sin(5.0 * th + fk * 1.7 + p.y) + .014 * sin(13.0 * th + fk * 2.3 + p.z) + .03 * (noise(vec2(th * 6.0 + fk * 3.0, fk) + o) - .5);
      float w = .014 + .008 * noise(vec2(th * 9.0, fk) + o);
      ha += dewG(r, rk, w) * (.5 + .5 * noise(vec2(th * 20.0 + fk, fk) + o));
      oo += dewG(r, rk + .02, w * 1.3) * (.5 + .5 * noise(vec2(th * 18.0 - fk, fk + 5.0) + o));
    }
    float lace = pow(max(1.0 - dewTurb(u * 4.0 + o), 0.0), 6.0) * (1.0 - smoothstep(.75, .92, r)) * .5;
    em = (N_HA * (ha + lace) * 1.1 + mix(N_O3, N_BLUE, .4) * oo) * arc;
  } else if (t == 3) {
    // SN 1987A: its equatorial ring (tilted, so an ellipse; its hot spots are drawn sharp in
    // dewFlashes), two fainter outer rings above and below (an hourglass), and the ejecta's keyhole
    // glowing gold within.
    vec2 ue = vec2(u.x, u.y / .72);
    float ring = dewG(length(ue), .42, .03) * .5;
    vec2 up = vec2(u.x, (u.y - .34) / .62), dn = vec2(u.x, (u.y + .34) / .62);
    float outer = (dewG(length(up), .6, .022) + dewG(length(dn), .6, .022)) * (.4 + .6 * noise(vec2(th * 8.0, 3.0) + o));
    vec2 ke = u / vec2(.09, .15);
    float ej = exp(-dot(ke, ke)) * (.6 + .4 * fbm3(u * 12.0 + o));
    em = mix(N_HA, N_PINK, .5) * ring + N_HA * outer * .6 + N_GOLD * ej * .9 + N_HA * (1.0 - smoothstep(.2, .95, r)) * .06;
  } else if (t == 4) {
    // The Cat's Eye: nested, mutually tilted bubbles, bright at their limbs, filled with oxygen's
    // green; knots of nitrogen at the ends of the long axis and jets beyond them; round it all a halo
    // of faint rings, one blown off every few thousand years.
    float e1 = dewEll(u, .44, .24, 0.0), e2 = dewEll(u, .36, .27, .5), e3 = dewEll(u, .24, .16, -.35), e4 = dewEll(u, .15, .1, .15);
    float lim = dewG(e1, 0.0, .06) + dewG(e2, 0.0, .07) * .9 + dewG(e3, 0.0, .09) * .8 + dewG(e4, 0.0, .12) * .6;
    float fill = (1.0 - smoothstep(-.3, 0.0, e1)) * (.4 + .6 * fbm3(u * 7.0 + o));
    lim *= .6 + .7 * fbm3(u * 9.0 + o + 3.0);
    vec3 c = N_O3 * (fill * .2 + lim * .9) + N_HA * lim * .3;
    vec2 a = vec2(abs(u.x) - .46, u.y);
    c += N_S2 * exp(-dot(a, a) / .0025) * 1.4;
    float jet = exp(-pow(u.y - .05 * sin(8.0 * u.x + p.y), 2.0) / .0006) * smoothstep(.45, .5, abs(u.x)) * (1.0 - smoothstep(.62, .68, abs(u.x)));
    c += N_HA * jet * .8 + N_S2 * exp(-pow(abs(u.x) - .66, 2.0) / .0008 - u.y * u.y / .002) * 1.2;
    float hr = length(u + .015 * vec2(sin(r * 40.0 + p.z), cos(r * 37.0 + p.w)));
    float rings = pow(.5 + .5 * cos(TAU * (hr - .5) / .055 + .6 * noise(u * 5.0 + o)), 10.0) * smoothstep(.48, .56, hr) * (1.0 - smoothstep(.9, 1.02, hr));
    em = c + mix(N_HA, N_S2, .3) * rings * .5 * (.6 + .4 * fbm3(u * 4.0 + o));
  } else if (t == 5) {
    // The Ring: a thick torus seen nearly pole-on, layered by what is ionised where (helium and
    // oxygen blue-green inside, then hydrogen, nitrogen red at its outer edge); dark knots on its
    // inner edge with tails pointing away from the star; a faint petalled halo.
    float rho = r * (1.0 + .05 * (fbm3(u * 4.0 + o) - .5));
    float band = dewG(rho, .58, .12) * (.45 + .55 * fbm3(u * 8.0 + o)) * (.75 + .5 * pow(max(1.0 - dewTurb(u * 6.0 + o), 0.0), 3.0));
    vec3 c = mix(mix(N_BLUE, N_O3, .5), N_O3, smoothstep(.42, .54, rho));
    c = mix(c, mix(N_HA, N_S2, .35), smoothstep(.57, .68, rho));
    float knots = pow(dewRidge(vec2(th * 14.0, rho * 1.5) + o), 12.0) * dewG(rho, .5, .07);
    em = c * band * 1.2 * (1.0 - .75 * knots) + N_BLUE * (1.0 - smoothstep(.15, .5, rho)) * .18;
    float rb = .86 + .08 * sin(9.0 * th + p.x);
    em += N_HA * dewG(r, rb, .03) * .35 * (.5 + .5 * noise(vec2(th * 10.0, 1.0) + o)) + N_HA * pow(max(1.0 - dewTurb(u * 3.0 + o), 0.0), 5.0) * smoothstep(.7, .8, r) * (1.0 - smoothstep(.9, 1.0, r)) * .3;
    dust = knots * .6;
  } else {
    // The Butterfly: two lobes blown out either side of a dark, dusty waist that hides the star, hot
    // and white near it, red and violet out in the wings, streaked along the outflow.
    float rb = .12 + .9 * pow(abs(cos(th)), .55), rl = r / rb;
    float lobe = 1.0 - smoothstep(.8, 1.0, rl);
    float edge = dewG(rl, .92, .1);
    float streak = pow(dewRidge(vec2(th * 9.0, log(r + .02) * 3.0) + o), 4.0);
    float body = lobe * (.1 + .9 * streak * streak) * (.45 + .55 * fbm3(u * 6.0 + o)) + edge * (.5 + .7 * noise(vec2(th * 12.0, 1.0) + o));
    vec3 c = mix(N_WHITE, u.x > 0.0 ? mix(N_HA, N_PINK, .5) : mix(N_VIOLET, N_BLUE, .4), smoothstep(.06, .25, abs(u.x)));
    float waist = exp(-pow(u.x / .07, 2.0)) * (1.0 - smoothstep(.15, .35, abs(u.y)));
    em = c * body * (1.0 - .9 * waist);
    dust = waist * .8;
  }
  return vec4(em, dust);
}
// The lit gas at a sky point (plan px), linear light, and its dust (rendered by transit.js into uGas).
// Each supernova's flash lights the dust in a thin echo racing out at the speed of light and ionises
// the gas near it (its [O III] flares, then it glows in Hα as it recombines); each nebula grows in its
// own frame, bright as it is lit, fading as its gas drains into its cores.
vec4 dewGasField(vec2 qp, float P) {
  vec4 m = dewData(25);
  int n = int(m.x), eb = int(m.y);
  vec2 WH = dewData(0).xy;
  float sc = WH.y / 900.0;
  float ha, o3, dust;
  dewISM(qp, ha, o3, dust);
  float ism = smoothstep(dewData(eb).z - .02, dewData(eb).z + .1, P);
  vec3 em = vec3(.03, .025, .06) * ha * ism;
  float ionH = 0.0, ionO = 0.0, dd = 0.0;
  for (int k = 0; k < 7; k++) {
    if (k >= n) break;
    int b = eb + 5 * k;
    vec4 E0 = dewData(b);
    float s = P - E0.z;
    if (s <= 0.0) continue;
    vec4 E1 = dewData(b + 1), E2 = dewData(b + 2);
    int type = int(E2.w + .5);
    bool pn = type >= 4;
    vec2 d = qp - E0.xy;
    float r = length(d), L = E1.z, Rm = E1.x;
    if (!pn) {
      float c = 26000.0 * sc, since = s - r / c;
      float reach = 1.0 - smoothstep(1.0, 1.6, r / Rm);
      float arrive = smoothstep(-.008, .01, since);
      if (arrive > 0.0) {
        float sp = max(since, 0.0);
        ionO = max(ionO, arrive * exp(-sp / .07) * reach * L);
        ionH = max(ionH, arrive * (1.0 - exp(-sp / .02)) * exp(-sp / .4) * reach * L);
      }
      em += vec3(.62, .76, 1.0) * exp(-pow((r - c * s) / (16.0 * sc + .07 * c * s), 2.0)) * exp(-s / .03) * dust * 1.4 * L;
    }
    float x = s / E0.w, R = Rm * (pn ? dewShell(x) : dewRemnant(x));
    if (R < 1.0 || r > R * 1.5 * E2.y + 4.0) continue;
    float ca = cos(E2.x), sa = sin(E2.x);
    vec2 u = vec2((ca * d.x + sa * d.y) / E2.y, -sa * d.x + ca * d.y) / R;
    vec4 E3 = dewData(b + 3), E4 = dewData(b + 4);
    vec4 neb = dewNebula(type, u, clamp(x, 0.0, 1.0), E3, E1.w);
    float lit = pn ? smoothstep(0.0, .35, x) * 1.2 : (1.0 + 2.5 * exp(-x / .06)) / (1.0 + 1.2 * x);
    float drain = 1.0 - .62 * smoothstep(E4.x, E4.y + .04, P);
    em += neb.rgb * lit * drain * L * 1.2;
    dd = max(dd, neb.a * drain);
  }
  em += (N_O3 * o3 * ionO * .9 + N_HA * ha * ionH * .85 + N_S2 * ha * ionH * smoothstep(.3, .9, dust) * .4) * .6;
  return vec4(em, max(dust * .5 * ism, dd));
}
vec4 dewGasPacked(vec2 px, float P) {
  vec4 g = dewGasField(px * dewData(0).xy / R, P);
  return vec4(sqrt(clamp(g.rgb / 4.0, 0.0, 1.0)), g.a);
}
vec4 dewGasAt(vec2 qs, vec2 S) {
  vec4 g = textureLod(uGas, vec2(clamp(qs.x / S.x, 0.0, 1.0), 1.0 - clamp(qs.y / S.y, 0.0, 1.0)), 0.0);
  return vec4(g.rgb * g.rgb * 4.0, g.a);
}
// The free fall of a uniform cloud's shell: r/r0 = cos²β, with t/t_ff = (β + sin β cos β)/(π/2).
float dewFreeFall(float tau) {
  float tg = clamp(tau, 0.0, 1.0) * 1.5707963, b = tg * .8;
  for (int i = 0; i < 3; i++) b = clamp(b - (b + .5 * sin(2.0 * b) - tg) / max(1.0 + cos(2.0 * b), .05), 0.0, 1.5707963);
  return cos(b) * cos(b);
}
// The gas drawn in by the cores falling near plan point qp: where the gas now here started (src), how
// much it is squeezed, and the cores' own light. Each core pulls its own gas: the shell now at r
// started at r0 (the free fall above, its outer shells a little later, turning as they fall with what
// angular momentum they had), fading smoothly past its basin; the pulls of neighbouring cores add.
void dewCollapse(vec2 qp, float P, out vec2 src, out float squeeze, out float glow) {
  src = qp; squeeze = 1.0; glow = 0.0;
  vec4 m = dewData(17);
  int head = int(m.z), ent = int(m.w);
  vec2 WH = dewData(0).xy;
  int cols = int(ceil(WH.x / ${f(CORE.cell)})), rows = int(ceil(WH.y / ${f(CORE.cell)}));
  ivec2 c = ivec2(floor(qp / ${f(CORE.cell)}));
  vec2 disp = vec2(0.0);
  float lsq = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 g = c + ivec2(i, j);
    if (g.x < 0 || g.y < 0 || g.x >= cols || g.y >= rows) continue;
    vec4 h = dewData(head + g.y * cols + g.x);
    for (int k = 0; k < 10; k++) {
      if (k >= int(h.y)) break;
      int e = ent + (int(h.x) + k) * 3;
      vec4 a = dewData(e);
      float t0 = (P - a.z) / max(a.w - a.z, 1e-4);
      if (t0 <= 0.0 || t0 > 1.6) continue;
      vec4 b = dewData(e + 1);
      vec2 d = qp - a.xy;
      float r = max(length(d), .3), R = min(b.y, ${f(CORE.cell / 1.85)});
      if (r > 1.8 * R) continue;
      float r0 = r;
      for (int it = 0; it < 2; it++) { float tau = clamp(t0 / (.7 + .4 * min(r0 / R, 1.6)), 0.0, 1.0); r0 = r / max(dewFreeFall(tau), .04); }
      float w = 1.0 - smoothstep(.9 * R, 1.8 * R, r0);
      float tw = b.z * 2.0 * (1.0 - r / r0);
      disp += ((mat2(cos(tw), sin(tw), -sin(tw), cos(tw)) * d) * (r0 / r) - d) * w;
      lsq += log(r0 / r) * 1.5 * w;
      float rc = b.x * (1.0 + 2.0 * (1.0 - min(t0, 1.0)));
      glow += exp(-pow(r / rc, 2.0)) * smoothstep(.1, .9, t0) * (1.0 - smoothstep(1.0, 1.05, t0));
    }
  }
  src = qp + disp;
  squeeze = min(exp(lsq), 8.0);
}
// Science's sky behind the pane with its gas (linear): the dust dims the stars, the gas glows, drawn
// into the cores as they fall. q: the screen point, qp: the pane point (plan px).
vec3 dewGasLook(vec3 sky, vec2 q, vec2 qp, vec2 S, float P, float zoom, vec2 zc) {
  vec2 toScreen = S / dewData(0).xy;
  vec2 src = qp;
  float squeeze = 1.0, glow = 0.0;
  if (P > .05 && P < ${f(CORE.by + 0.06)}) dewCollapse(qp, P, src, squeeze, glow);
  vec4 g = dewGasAt(zc + (src * toScreen - zc) * zoom, S);
  vec3 col = sky * (1.0 - g.a * .75) + g.rgb * squeeze;
  return col + g.rgb * 2.0 * glow;
}
// What is drawn sharp over the gas (screen px): each supernova's giant pulses, falls in on itself, then
// breaks out in a flash (a white-hot point with diffraction spikes and a long anamorphic streak,
// fading along the nickel–cobalt light curve); the Crab's pulsar flickering at its heart; SN 1987A's
// ring of hot spots lighting one by one as its ejecta reach it; and each planetary nebula's new white
// dwarf, hot and blue-white.
vec3 dewFlashes(vec2 px, float P) {
  vec4 m = dewData(25);
  int n = int(m.x), eb = int(m.y);
  vec2 toPlan = dewData(0).xy / R;
  vec3 c = vec3(0.0);
  for (int k = 0; k < 7; k++) {
    if (k >= n) break;
    int b = eb + 5 * k;
    vec4 E0 = dewData(b);
    float s = P - E0.z;
    if (s < -.022) continue;
    vec4 E1 = dewData(b + 1), E2 = dewData(b + 2);
    int type = int(E2.w + .5);
    vec2 d = px - E0.xy / toPlan;
    float r2 = dot(d, d), L = E1.z;
    if (r2 > 160000.0 && type != 3) continue;
    vec2 ad = abs(d), dg = abs(vec2(d.x + d.y, d.x - d.y) * .7071);
    if (type >= 4) {
      // A planetary's white dwarf, uncovered as the envelope lifts.
      float wd = smoothstep(0.0, .12, s) * L;
      float sp = exp(-ad.y / .7) * exp(-ad.x / 14.0) + exp(-ad.x / .7) * exp(-ad.y / 14.0);
      c += vec3(.75, .85, 1.0) * (exp(-r2 / 2.2) * 2.2 + exp(-sqrt(r2) / 5.0) * .25 + sp * .35) * wd;
      continue;
    }
    vec3 tint = mix(vec3(1.0, .75, .55), vec3(.7, .82, 1.0), smoothstep(.4, 2.5, E2.z));
    if (s < 0.0) {
      float beat = .5 + .5 * sin(TAU * (s + .022) * (60.0 + 900.0 * (s + .022)));
      c += tint * exp(-r2 / 22.0) * beat * smoothstep(-.022, -.01, s) * (1.0 - smoothstep(-.004, 0.0, s)) * 1.6 * L;
      continue;
    }
    if (s < .09) {
      float Lc = min(dewLight(s), 1.6);
      float core = exp(-r2 / (2.0 * pow(1.5 + 4.0 * Lc, 2.0)));
      float bloom = exp(-sqrt(r2) / (8.0 + 30.0 * Lc));
      float len = 40.0 + 150.0 * Lc;
      float spikes = exp(-ad.y / .8) * exp(-ad.x / len) + exp(-ad.x / .8) * exp(-ad.y / len) + .4 * (exp(-dg.y / .9) * exp(-dg.x / (len * .5)) + exp(-dg.x / .9) * exp(-dg.y / (len * .5)));
      float streak = exp(-ad.y / 1.4) * exp(-ad.x / (len * 2.5)) * .5;
      vec3 hot = mix(vec3(.8, .88, 1.0), vec3(1.0, .9, .75), smoothstep(0.0, .02, s));
      c += hot * (core * 2.4 + bloom * .4 + spikes * .7) * Lc * L + vec3(.55, .7, 1.0) * streak * Lc * L;
    }
    if (type == 0 && s > .015) {
      // The pulsar: a point flickering at its heart, its beam sweeping past us.
      float beat = pow(.5 + .5 * sin(T * 9.0), 6.0);
      c += vec3(.75, .85, 1.0) * (exp(-r2 / 1.6) * (1.2 + 2.0 * beat) + (exp(-ad.y / .6) * exp(-ad.x / 10.0) + exp(-ad.x / .6) * exp(-ad.y / 10.0)) * .4 * beat) * smoothstep(.015, .04, s);
    }
    if (type == 3 && s > .04) {
      // SN 1987A's hot spots: twenty-four on its equatorial ring, each lighting as the ejecta reach it.
      float R0 = E1.x * dewRemnant(s / E0.w) / toPlan.y;
      vec2 dp = d;
      float ca = cos(E2.x), sa = sin(E2.x);
      vec2 u = vec2(ca * dp.x + sa * dp.y, -sa * dp.x + ca * dp.y) / max(R0, 1.0);
      if (abs(length(vec2(u.x, u.y / .72)) - .42) < .12) {
        float ang = atan(u.y / .72, u.x), slot = floor(ang / (TAU / 24.0) + .5);
        for (int j = -1; j <= 1; j++) {
          float sj = slot + float(j), hj = hash(vec2(sj, E1.w * 13.0));
          float aj = sj * TAU / 24.0 + (hj - .5) * .12;
          vec2 sp = vec2(cos(aj), sin(aj) * .72) * .42 * max(R0, 1.0);
          vec2 sp2 = vec2(ca * sp.x - sa * sp.y, sa * sp.x + ca * sp.y);
          vec2 dd = dp - sp2;
          float on = smoothstep(.04 + .14 * hj, .07 + .14 * hj, s);
          c += mix(vec3(1.0, .82, .86), vec3(1.0), .5) * (exp(-dot(dd, dd) / 1.8) * 1.8 + exp(-length(dd) / 4.0) * .25) * on * L;
        }
      }
    }
  }
  return c;
}

// ---- the drops ------------------------------------------------------------------------------------
// A ray from the eye meets a cap at incidence α, refracts into the water and leaves through the flat
// pane at δ off the axis (tan δ per channel): the drop looks toward −ρ̂, so its image is inverted.
vec3 dewTanAlpha(float a) {
  float sa = sin(a);
  vec3 g = a - asin(sa / DEW_WATER);
  vec3 sd = clamp(DEW_WATER * sin(g), 0.0, .9995);
  return sd / sqrt(1.0 - sd * sd);
}
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
// A click's drop: Racing in a window about its axis, Science's night past it; the frosted pane on a
// live click (no snapshots).
float dewSee(vec2 p, vec2 dir, float t, float F, vec2 S, float lod, int c) {
  vec2 o = p + dir * F * t;
  float w = smoothstep(gDewTan0 * 1.04, gDewTan0 * .96, t);
  float r = w > 0.0 ? dewRacing(o, S, lod)[c] : 0.0;
  float n = w < 1.0 ? dewNight(p + dir * F * .35 * t, S, lod + 1.0)[c] : 0.0;
  return mix(n, r, w);
}
vec3 dewLens(vec3 n, vec2 p, float a, vec2 S, bool live) {
  float alpha = acos(clamp(n.z, 0.0, 1.0));
  vec2 dir = length(n.xy) > 1e-5 ? -normalize(n.xy) : vec2(0.0);
  vec3 t = dewTanAlpha(alpha);
  float F = .55 * S.y;
  vec3 col;
  if (live) {
    float w = smoothstep(gDewTan0 * 1.04, gDewTan0 * .96, t.g);
    vec3 r = w > 0.0 ? dewLinear(glacierAt(clamp(p + dir * F * t.g, vec2(0.0), S), 1.0)) : vec3(0.0);
    r = mix(dewJewel(r), r, gDewDawn);
    col = mix(DEW_FROST * .2 + vec3(.004, .01, .025), r, w);
  } else {
    float lod = clamp(log2(F * .3 / max(a, 1.0) * .6), 0.0, 5.0);
    col = vec3(dewSee(p, dir, t.r, F, S, lod, 0), dewSee(p, dir, t.g, F, S, lod, 1), dewSee(p, dir, t.b, F, S, lod, 2));
  }
  float fr = .02 + .98 * pow(1.0 - n.z, 5.0);
  vec3 rf = reflect(vec3(0.0, 0.0, -1.0), n);
  float sp = max(dot(rf, dewLightDir()), 0.0);
  return col * (1.0 - fr) + vec3(.02, .025, .05) * fr + vec3(1.0, .97, .92) * (pow(sp, 90.0) * 9.0 + pow(sp, 18.0) * .12);
}
// The scroll's drop: coloured water. What it sees behind it is Science's night and the nebulae, through
// the lens (inverted, minified, each channel bent its own amount); the light is filtered by the depth
// of water it crosses, h(ρ)/ℓ in Beer–Lambert's law, so a small drop is pale and a large one deep, its
// middle deepest; at its faces Fresnel reflects the dark room and the window. s: ρ/a, h: the water's
// depth here in units of ℓ.
vec3 dewDrop(vec3 n, vec2 p, float a, vec2 S, vec3 tint, float h) {
  float alpha = acos(clamp(n.z, 0.0, 1.0));
  vec2 dir = length(n.xy) > 1e-5 ? -normalize(n.xy) : vec2(0.0);
  vec3 t = dewTanAlpha(alpha);
  float F = .55 * S.y, lod = clamp(log2(F * .3 / max(a, 1.0) * .6), 0.0, 5.0);
  vec3 col = vec3(dewNight(p + dir * F * .35 * t.r, S, lod).r, dewNight(p + dir * F * .35 * t.g, S, lod).g, dewNight(p + dir * F * .35 * t.b, S, lod).b);
  vec4 g = dewGasAt(p + dir * F * .35 * t.g, S);
  col = col * (1.0 - g.a * .75) + g.rgb * 1.15;
  col *= pow(max(tint, vec3(.02)), vec3(h));
  col += tint * .02 * (1.0 + h);
  float fr = .02 + .98 * pow(1.0 - n.z, 5.0);
  vec3 rf = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 env = vec3(.012, .016, .035) + dewWindow(rf) + dewGasAt(p - rf.xy * F * .2, S).rgb * .3;
  return col * (1.0 - fr) + env * fr;
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
// Science's drops (cosmos.js): on a click, water once the click's cold reaches them; on the scroll they
// stay chrome behind the pane.
void dewScience(float P, vec2 S, bool click) {
  for (int i = 0; i < 6; i++) {
    vec2 base = dewData(4 + i).xy * S / dewData(0).xy;
    float coldC = dewCold(base);
    gDrop[i] = vec4(0.0, 0.0, click ? 1.0 - smoothstep(coldC + .02, coldC + .1, P) : 1.0, click ? smoothstep(coldC + .02, coldC + .07, P) : 0.0);
    gDropScale[i] = 1.0;
  }
}

float dewCbrt(float v) { return v <= 0.0 ? 0.0 : pow(v, 1.0 / 3.0); }
struct DewHit { float d; vec2 c; vec2 g; float a; float kind; float seed; float s; float t0; vec3 col; float spin; float tf; };
float dewSeg(vec2 p, vec2 a, vec2 b, out float u) { vec2 ab = b - a; u = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0); return length(p - a - ab * u); }

// ---- the ice's cells, the main crack, the rift ------------------------------------------------------
// The ice's cells as a point sees them (dewShatter): which piece covers it and where on the pane that
// piece's point came from, its own cell and the next across the boundary, the distance to that
// boundary, the piece's fall, and the electric light on its rim.
struct DewCell { float cov; vec2 qz0; float rim; int ci; int cj; float e; float fall; };
// Every point lies in its own cell (the nearest seed), and the boundary to the next is that cell's
// edge. On the scroll a piece covers its cell until it breaks away (its fragments fly from there:
// glsl/units.js frags). On a click, once its piece falls, the point shows whichever falling piece now
// covers it: each shrinks into the distance about its centroid, turns, drifts and drops, fading; past
// all of them, the new page.
DewCell dewShatter(vec2 qz, vec2 S, float P, bool click) {
  DewCell r; r.cov = 1.0; r.qz0 = qz; r.rim = 0.0; r.ci = -1; r.cj = -1; r.e = 1e9; r.fall = 0.0;
  vec4 h0 = dewData(0), m0 = dewData(22), m1 = dewData(23);
  if (m0.y < 1.0) return r;
  vec2 toPlan = h0.xy / S, toScreen = S / h0.xy;
  vec2 qp = qz * toPlan;
  ivec2 t = clamp(ivec2(qp / m0.z), ivec2(0), ivec2(m1.xy) - 1);
  vec4 hd = dewData(int(m0.w) + t.y * int(m1.x) + t.x);
  int start = int(hd.x), nAll = int(floor(hd.y / 1000.0)), n = int(mod(hd.y, 1000.0)), eb = int(dewData(2).w), sb = int(m0.x);
  float d1 = 1e9, d2 = 1e9; int i1 = -1, i2 = -1;
  for (int k = 0; k < 24; k++) {
    if (k >= n) break;
    int e = start + k;
    int id = int(dewData(eb + (e >> 2))[e & 3]);
    vec2 dq = qp - dewData(sb + id * 5).xy;
    float d = dot(dq, dq);
    if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = id; } else if (d < d2) { d2 = d; i2 = id; }
  }
  r.ci = i1; r.cj = i2;
  if (i1 < 0) return r;
  vec4 C1 = dewData(sb + i1 * 5);
  if (i2 >= 0) { vec4 C2 = dewData(sb + i2 * 5); r.e = (d2 - d1) / (2.0 * max(length(C2.xy - C1.xy), 1e-3)); }
  // The scroll: a piece covers its own cell until it breaks away (then its fragments fly: glsl/units.js).
  if (!click) { if (P >= dewData(sb + i1 * 5 + 3).z) r.cov = 0.0; return r; }
  float far = farCorner(uPoint);
  // When a click's piece falls: from the click outward, each starting before the radial front reaches
  // its nearest point.
  #define DEW_FALL(B) clamp(((P - (.84 + .18 * clamp((length(B.xy * toScreen - uPoint) - B.z * toScreen.y) / far, 0.0, 1.0))) / ${f(DEW.fall)}), 0.0, 1.0)
  float u1 = DEW_FALL(dewData(sb + i1 * 5 + 1));
  if (u1 <= 0.0) return r;
  // Its own piece is falling: which falling piece covers this point now?
  r.cov = 0.0; r.rim = 0.0;
  for (int k = 0; k < 48; k++) {
    if (k >= nAll) break;
    int e = start + k;
    int id = int(dewData(eb + (e >> 2))[e & 3]);
    vec4 A = dewData(sb + id * 5), B = dewData(sb + id * 5 + 1);
    float u = DEW_FALL(B);
    if (u <= 0.0 || u >= 1.0) continue;
    float h = hash(vec2(float(id), 3.3)), sc = 1.0 - .9 * u * u, th = (h - .5) * 1.8 * u;
    vec2 Tr = vec2((hash(vec2(float(id), 5.1)) - .5) * 50.0 * u, B.w * 26.0 * u + 120.0 * u * u);
    vec2 v = qp - B.xy - Tr;
    vec2 q0 = B.xy + mat2(cos(th), sin(th), -sin(th), cos(th)) * v / sc;
    // Is q0 inside piece id's cell (nearer its seed than any other)?
    vec2 dq0 = q0 - A.xy;
    float dOwn = dot(dq0, dq0), eMin = 1e9;
    bool inside = true;
    for (int m = 0; m < 48; m++) {
      if (m >= nAll) break;
      int e2 = start + m;
      int jd = int(dewData(eb + (e2 >> 2))[e2 & 3]);
      if (jd == id) continue;
      vec2 cj = dewData(sb + jd * 5).xy, dj = q0 - cj;
      float dd = dot(dj, dj);
      if (dd < dOwn) { inside = false; break; }
      eMin = min(eMin, (dd - dOwn) / (2.0 * max(length(cj - A.xy), 1e-3)));
    }
    if (!inside) continue;
    float alpha = 1.0 - smoothstep(.55, 1.0, u);
    if (alpha > r.cov) {
      r.cov = alpha; r.qz0 = q0 / toPlan; r.ci = id; r.e = eMin; r.fall = u;
      r.rim = exp(-eMin * sc / 1.3) * (1.0 - u) * 1.2 + exp(-eMin * sc / 6.0) * .25 * (1.0 - u);
    }
  }
  return r;
}
// Where the main crack runs at plan x (the plan's 128-sample table).
float dewCrackY(float x) {
  vec2 WH = dewData(0).xy;
  float u = clamp(x / WH.x, 0.0, 1.0) * 127.0;
  int k = int(min(floor(u), 126.0)), b = int(dewData(24).w);
  return mix(dewData(b + k).x, dewData(b + k + 1).x, u - float(k));
}
float dewRiftS(float P) { float s = clamp((P - ${f(DEW.riftOpen)}) / ${f(DEW.riftWide - DEW.riftOpen)}, 0.0, 1.0); return pow(s * s * (3.0 - 2.0 * s), 1.5); }
// Its opening at x, plan px (Griffith–Irwin: a crack under tension opens in an ellipse along its
// length, widest mid-span).
float dewRiftAt(float x) { vec2 WH = dewData(0).xy; return ${f(DEW.riftWidth)} * WH.y * sqrt(max(0.0, 1.0 - pow((x - .5 * WH.x) / (.53 * WH.x), 2.0))); }
// When the fracture front running out from the crack passes plan point qp (plan: frontAt).
float dewFront(vec2 qp) { return ${f(DEW.detach0 - DEW.lead)} + ${f(DEW.detach1 - DEW.detach0)} * abs(qp.y - dewCrackY(qp.x)) / dewData(24).z; }
// The light pouring through: Racing's day, warm against the ice.
const vec3 DEW_DAY = vec3(1.0, .93, .80);
// Day breaking through the rift: Racing first in deep blue twilight, then a sunrise low on the rift
// (rose and violet above it, gold along it, the sun's glow at its middle and its rays fanning out
// past the flying fragments), then Racing's own day (linear; qp: plan px).
float dewDawn(float P) { return smoothstep(${f(DEW.riftOpen + 0.02)}, 1.17, P); }
vec3 dewDaybreak(vec3 g, float P, vec2 qp) {
  vec2 WH = dewData(0).xy;
  float d = dewDawn(P);
  // The sun rises on the far side of the rift from Racing's card, so the card forms against the sky.
  float sx = uCard.z > 0.0 && uCard.x + uCard.z * .5 < R.x * .5 ? .84 : .16;
  vec2 sun = vec2(sx * WH.x, dewCrackY(sx * WH.x));
  vec2 rv = (qp - sun) / WH.y;
  float r = length(rv), near = exp(-abs(rv.y) / .2);
  vec3 night = g * vec3(.05, .11, .24) + vec3(.004, .01, .03);
  vec3 rise = g * mix(vec3(.32, .2, .5), vec3(1.0, .52, .32), near) + vec3(1.0, .62, .3) * exp(-r / .07) * .7;
  float rays = pow(noise(vec2(atan(rv.y, rv.x) * 9.0, T * .05)), 3.0) * 2.2 * exp(-r / .7);
  rise += vec3(1.0, .78, .5) * rays * .3;
  return d < .3 ? mix(night, rise, smoothstep(0.0, .3, d)) : mix(rise, g, smoothstep(.6, 1.0, d));
}
// Ice dust: grains of the pane blown out from the rift, drifting and glinting (plan px).
vec3 dewDust(vec2 qp, float cy, float P) {
  float on = smoothstep(.9, .95, P) * (1.0 - smoothstep(1.08, 1.16, P));
  if (on <= 0.0) return vec3(0.0);
  vec2 WH = dewData(0).xy;
  float dy = qp.y - cy, sd = sign(dy);
  vec3 c = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float gs = k == 0 ? 22.0 : 13.0, sp = (k == 0 ? .9 : .55) * WH.y;
    vec2 w = vec2(qp.x + float(k) * 7.3, abs(dy) - sp * (P - .9));
    vec2 id = floor(w / gs), fq = fract(w / gs);
    float h = hash(id + float(k) * 17.0 + sd * 3.0);
    if (h < .8) continue;
    vec2 at = .2 + .6 * vec2(hash(id + 4.4), hash(id + 9.9));
    float d = length((fq - at) * gs);
    float tw = .5 + .5 * sin(T * (5.0 + 9.0 * h) + h * 60.0);
    c += mix(vec3(.6, .85, 1.0), DEW_DAY, dewDawn(P)) * (exp(-d * d / 1.2) * 1.6 + exp(-d / 4.0) * .15) * tw * exp(-abs(dy) / (.5 * WH.y));
  }
  return c * on;
}
// Bolts across the opening rift (plan px): each leaps from the upper lip to the lower some way along
// it (a jagged seven-step channel with one branch, re-striking several times a second), holds the
// lips together, straightening as they part, until the gap passes its own breaking width; then it
// snaps, its two ends whipping back into the lips with a flash where it broke.
vec3 dewBolts(vec2 qp, float P) {
  vec2 WH = dewData(0).xy;
  bool narrow = WH.x < 700.0;
  int n = narrow ? 5 : 9;
  float sP = dewRiftS(P), fT = floor(T * 9.0);
  vec3 c = vec3(0.0);
  for (int k = 0; k < 9; k++) {
    if (k >= n) break;
    float fk = float(k);
    float h1 = hash(vec2(fk, 61.7)), h2 = hash(vec2(fk, 13.1)), h3 = hash(vec2(fk, 7.9)), h4 = hash(vec2(fk, 29.3));
    float xa = WH.x * (fk + .2 + .6 * h1) / float(n);
    float xb = clamp(xa + (h4 < .5 ? -1.0 : 1.0) * (50.0 + 110.0 * h3) * (narrow ? .5 : 1.0), 0.0, WH.x);
    float Wa = dewRiftAt(xa), Wb = dewRiftAt(xb), da = Wa * sP, db = Wb * sP;
    if (min(da, db) < .5) continue;
    vec2 A = vec2(xa, dewCrackY(xa) - .5 * da), B = vec2(xb, dewCrackY(xb) + .5 * db);
    if (any(lessThan(qp, min(A, B) - 45.0)) || any(greaterThan(qp, max(A, B) + 45.0))) continue;
    // When it snaps: the mean opening under it reaches its breaking width (smoothstep inverted).
    float W0 = .5 * (Wa + Wb), wb = WH.y * (.025 + .06 * h2), sb = pow(min(wb / W0, 1.0), 2.0 / 3.0);
    float Psnap = wb < W0 ? ${f(DEW.riftOpen)} + (.5 - sin(asin(1.0 - 2.0 * sb) / 3.0)) * ${f(DEW.riftWide - DEW.riftOpen)} : 9.0;
    float r = clamp((P - Psnap) / .014, 0.0, 1.0), vb = .3 + .4 * h3;
    if (r >= 1.0) continue;
    vec2 AB = B - A;
    float L = length(AB);
    vec2 t = AB / L, nr = vec2(-t.y, t.x);
    float amp = (.13 * L + 3.0) * mix(1.3, .6, min(.5 * (da + db) / wb, 1.0));
    float d = 1e9, dB = 1e9;
    vec2 a = A, p3 = A;
    for (int i = 1; i <= 7; i++) {
      float u = float(i) / 7.0;
      vec2 bb = i == 7 ? B : A + AB * u + nr * (hash(vec2(float(i) + fk * 13.0, fT)) - .5) * 2.0 * amp;
      float uu, dd = dewSeg(qp, a, bb, uu), pu = (float(i - 1) + uu) / 7.0;
      // Snapped: the channel is gone between its two retreating ends.
      if (!(r > 0.0 && pu > vb * (1.0 - r) && pu < 1.0 - (1.0 - vb) * (1.0 - r))) d = min(d, dd);
      if (i == 3) p3 = bb;
      a = bb;
    }
    if (r <= 0.0) {
      float ang = (h2 < .5 ? -1.0 : 1.0) * .6;
      vec2 bt = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * t;
      vec2 ba = p3;
      for (int i = 1; i <= 3; i++) {
        vec2 bb = p3 + bt * L * .11 * float(i) + vec2(-bt.y, bt.x) * (hash(vec2(float(i) + fk * 7.0, fT + 3.0)) - .5) * L * .08;
        float uu;
        dB = min(dB, dewSeg(qp, ba, bb, uu) + float(i) * .6);
        ba = bb;
      }
    }
    // Lightning strobes: return strokes down the same channel.
    float flick = .35 + .65 * step(.4, noise(vec2(T * 31.0, fk * 5.0)));
    vec3 elec = mix(vec3(.45, .7, 1.0), vec3(.8, .55, 1.0), h2);
    float st = exp(-length(qp - A) / 6.0) + exp(-length(qp - B) / 6.0);
    c += (vec3(1.0) * (exp(-d / .8) * 2.0 + exp(-dB / .7) * .9) + elec * (exp(-d / 3.5) * .9 + exp(-d / 18.0) * .3 + exp(-dB / 4.0) * .35)
          + vec3(.9, .95, 1.0) * st * .8) * flick * (1.0 - r);
    if (r > 0.0) c += DEW_DAY * exp(-length(qp - mix(A, B, vb)) / 12.0) * 2.5 * (1.0 - r);
  }
  return c;
}
// God rays: the day behind the ice fanning out from the rift through the cold air (plan px).
float dewRays(vec2 qp, float cy, float dl, float P) {
  vec2 WH = dewData(0).xy;
  float dy = qp.y - cy, out_ = max(abs(dy) - .5 * dl, 0.0);
  float u = (qp.x - .5 * WH.x) / (1.0 + abs(dy) / (.45 * WH.y));
  float streak = pow(noise(vec2(u * .022, sign(dy) * 3.0 + T * .04)), 4.0) * 3.0 + .25 * pow(noise(vec2(u * .09, sign(dy) * 7.0 - T * .07)), 2.0);
  float on = smoothstep(${f(DEW.riftOpen + 0.02)}, ${f(DEW.riftOpen + 0.12)}, P) * (1.0 - smoothstep(1.08, 1.16, P));
  return on * streak * exp(-out_ / (.32 * WH.y)) * (.25 + .75 * dewRiftAt(qp.x) / (${f(DEW.riftWidth)} * WH.y));
}
// A snow crystal of the habit hab (integer part; the fraction seeds its details) grown to arm length L
// of its final Lf about the origin, turned by ang (the card's frost). x: its lines, y: how near its
// tips, z: plate, w: the growing tips' glow.
vec4 dewCrystal(vec2 p, float L, float Lf, float ang, float hab) {
  int habit = int(hab);
  float sd = fract(hab) * 97.0;
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  float rr = length(p), th = atan(p.y, p.x);
  float arm = floor((th + PI / 6.0) / (PI / 3.0)), a = th - arm * PI / 3.0, side = a < 0.0 ? -1.0 : 1.0;
  vec2 w = vec2(cos(a), abs(sin(a))) * rr;
  float La = L * (1.0 + .08 * (hash(vec2(arm + sd, 3.1)) - .5));
  float d = 1e3, plate = 0.0, tips = 0.0;
  float armW = habit == 3 ? mix(.25 * La * .3, .5, clamp(w.x / max(La, 1.0), 0.0, 1.0)) : 0.0;
  d = w.x < La ? (habit == 3 ? min(abs(w.y - armW), w.y + .25) : w.y) : length(w - vec2(La, 0.0));
  if (habit == 3) plate = max(plate, smoothstep(armW + .5, armW - .5, w.y) * step(w.x, La) * .8);
  tips += exp(-dot(w - vec2(La, 0.0), w - vec2(La, 0.0)) / 3.0) * step(La, Lf * .98);
  if (habit != 2) {
    bool fern = habit == 1;
    float cum = (fern ? .09 : .13) + .08 * hash(vec2(sd, 1.0));
    for (int k = 0; k < 14; k++) {
      if (cum > .93) break;
      float x0 = cum * Lf;
      if (x0 >= La - .5) break;
      float hk = hash(vec2(sd + float(k), 7.3)), hj = hash(vec2(sd + float(k) * 3.0 + arm * 11.0 + side * 5.0, 9.1));
      float target = min(1.0 - cum, cum * (fern ? 1.5 : 1.05)) * Lf * (.3 + .7 * hk) * (habit == 4 ? .4 : habit == 3 ? .55 : 1.0) * (1.0 + .22 * (hj - .5));
      float bl = min(target, (La - x0) * .8);
      vec2 bq = w - vec2(x0 + (hj - .5) * 1.2, 0.0);
      float tb = dot(bq, vec2(.5, .866)), nb = dot(bq, vec2(-.866, .5));
      float br = tb < 0.0 ? length(bq) : (tb < bl ? abs(nb) : length(bq - vec2(.5, .866) * bl));
      d = min(d, br);
      vec2 tip = vec2(.5, .866) * bl;
      if (bl < target) tips += exp(-dot(bq - tip, bq - tip) / 2.0);
      if (habit < 2 && bl > 5.0 && tb > 0.0 && tb < bl && nb > -.5) {
        float bs = 2.4 + 1.8 * hk, kb = floor(tb / bs);
        float hb = hash(vec2(kb + sd, float(k) + 3.3 + side));
        float bx = kb * bs + bs * .3 * hb, bll = min(bl - bx, bx) * (fern ? .55 : .4) * (.5 + .5 * hb);
        vec2 cq = vec2(tb - bx, nb);
        float tc = dot(cq, vec2(.5, .866)), nc = dot(cq, vec2(-.866, .5));
        if (tc > 0.0 && tc < bll) d = min(d, abs(nc) + .12);
      }
      if (habit == 4 && bl > 1.0) { vec2 tq = bq - tip; float hx = max(abs(dot(tq, vec2(.866, .5))), max(abs(dot(tq, vec2(.866, -.5))), abs(tq.y))); plate = max(plate, smoothstep(bl * .45, bl * .3, hx)); }
      cum += fern ? .035 + .045 * hk : .06 + .11 * hk;
    }
  }
  float hexR = dot(w, vec2(.866, .5));
  if (habit == 2) {
    float Lp = La * .866;
    float inside = smoothstep(Lp + .5, Lp - .5, hexR + .6 * (noise(vec2(th * 6.0 + sd, sd)) - .5));
    plate = max(plate, inside);
    float steps = abs(fract(hexR / (2.6 + 1.2 * fract(sd))) - .5) * 2.0;
    d = min(d, w.y + .2);
    d = min(d, abs(hexR - Lp) + .1);
    tips += exp(-pow(hexR - Lp, 2.0) / 2.0) * step(La, Lf * .98);
    plate *= .75 + .25 * smoothstep(.0, .3, steps);
  } else if (habit == 3) plate = max(plate, smoothstep(La * .3 + .5, La * .3 - .5, hexR));
  else if (habit == 4) { vec2 tq = w - vec2(La, 0.0); float hx = max(abs(dot(tq, vec2(.866, .5))), max(abs(dot(tq, vec2(.866, -.5))), abs(tq.y))); plate = max(plate, smoothstep(La * .2, La * .14, hx)); }
  float lines = exp(-d / .55);
  return vec4(lines, smoothstep(La * .6, La, rr), max(plate, smoothstep(La * .95, La * .45, rr) * smoothstep(0.0, 30.0, L) * (habit == 2 ? 0.0 : .6)), tips);
}
// When the card's frost reaches screen point px (the plan's clock over the card: from where the
// fragments land, spreading), 9 off the card.
float dewFrostClock(vec2 px) {
  int fb = int(dewData(26).w);
  vec4 h0 = dewData(fb), h1 = dewData(fb + 1);
  if (h0.z < 2.0) return 9.0;
  vec2 g = (px - h1.xy) / h1.z;
  if (g.x < 0.0 || g.y < 0.0 || g.x > h0.z - 1.0 || g.y > h0.w - 1.0) return 9.0;
  g = min(g, h0.zw - 1.001);
  ivec2 i = ivec2(floor(g));
  vec2 fr = fract(g);
  int cols = int(h0.z), o = int(h0.y) + i.y * cols + i.x;
  return mix(mix(dewData(o).x, dewData(o + 1).x, fr.x), mix(dewData(o + cols).x, dewData(o + cols + 1).x, fr.x), fr.y);
}
// Racing's glass card crystallizing in its own place (uCard, the stuck band's card) out of the
// fragments fusing into it: frost spreads from where each lands, snow crystals of every habit
// nucleating in it and growing into one another, a flash as the last closes, then it anneals clear
// into the glacier's glass card (gCardMix, set by the caller).
vec3 dewCardFrost(vec3 col, vec2 px, float P) {
  if (uCard.z <= 0.0 || P < .96) return col;
  vec2 c = uCard.xy + uCard.zw * .5;
  float sd = sdBox(px - c, uCard.zw * .5, uCardR);
  if (sd > 40.0) return col;
  float inside = clamp(.5 - sd, 0.0, 1.0);
  float anneal = 1.0 - smoothstep(1.15, 1.18, P);
  float frost = 0.0, tips = 0.0, plate = 0.0;
  if (sd < 2.0 && anneal > 0.0) {
    vec2 g0 = floor(px / 44.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 id = g0 + vec2(float(i), float(j)), sp = (id + .2 + .6 * vec2(hash(id + 3.1), hash(id + 7.7))) * 44.0;
      vec2 dp = px - sp;
      if (dot(dp, dp) > 40.0 * 40.0) continue;
      float tS = dewFrostClock(sp);
      if (tS > 8.0) continue;
      float L = clamp((P - tS) * 1300.0, 0.0, 36.0);
      if (L <= 0.0) continue;
      float hab = floor(hash(id + 2.2) * 4.99) + .999 * hash(id + 9.4);
      vec4 dd = dewCrystal(dp, L, 36.0, hash(id + 5.3) * 1.0472, hab);
      frost = max(frost, dd.x); tips = max(tips, dd.w); plate = max(plate, dd.z);
    }
  }
  float tF = dewFrostClock(px) + (noise(px * .05) - .5) * .006;
  float haze = smoothstep(tF, tF + .025, P);
  vec3 ice = vec3(.86, .94, 1.0);
  vec3 base = col * mix(1.0, .55, inside * smoothstep(.97, 1.0, P)) * vec3(.85, .92, 1.0);
  vec3 fc = mix(base, ice * .8, (haze * .3 + plate * .2) * inside);
  fc += ice * (frost * .75 + tips * 1.0) * inside;
  float flash = exp(-pow((P - 1.148) / .008, 2.0));
  fc += vec3(1.0, .97, .92) * flash * (exp(-abs(sd) / 3.0) * 1.4 + inside * .35);
  return mix(col, fc, anneal) + vec3(.8, .92, 1.0) * exp(-abs(sd) / 2.0) * flash * (1.0 - anneal);
}

// ---- the pane at a point -------------------------------------------------------------------------
// q: the screen point (where the pane point was, for what it looks through); qz: the pane point.
vec4 dewPane(vec2 q, vec2 qz, vec2 px, vec2 S, float P, bool click, vec3 sci, DewCell cell, float zoom) {
  float clear = dewClear(q, P, click);
  float cold = click ? dewCold(q) : dewCond(qz * dewData(0).xy / S), tau = P - cold;
  float aa = max(fwidth(q.x) + fwidth(q.y), .5) * .6;
  gDewLight = -.6 + 1.3 * P;
  vec4 h0 = dewData(0), h1 = dewData(1), h2 = dewData(2), h3 = dewData(3);
  vec2 toPlan = h0.xy / S, toScreen = S / h0.xy;
  vec2 qp = qz * toPlan;
  float aaP = aa * toPlan.y / zoom;
  bool full = uIceDetail > .5;
  int cols = int(h0.z), rows = int(h0.w), recBase = int(h2.x);
  ivec2 tile = clamp(ivec2(qp / h3.x), ivec2(0), ivec2(cols - 1, rows - 1));
  // A click's cold spreads from the click: each point reads the plan at the time its own cold arrived.
  float Pp = click ? min(P + dewCond(qp) - cold, .8) : P;
  if (click) {
    gDewTan0 = tan(radians(3.0 + 13.0 * smoothstep(.08, 1.0, tau)));
    gDewDawn = .1 + .15 * smoothstep(.3, .8, P);
  }
  int epoch = clamp(int(floor((Pp - h3.y) / h3.z)), 0, int(h1.z) - 1);
  vec4 head = dewData(int(h2.z) + (epoch * rows + tile.y) * cols + tile.x);
  int entryBase = int(h2.w);
  float vb = ${f(DEW.bridge)} * h0.y / 900.0;

  // The drop this point lies in (the deepest inside); the two nearest icy ones, for their frost.
  DewHit hit; hit.d = 1e9; hit.kind = -1.0; hit.t0 = 0.0; hit.col = vec3(1.0); hit.spin = 0.0; hit.seed = 0.0; hit.tf = 9.0;
  float halo = 0.0, bridge = 0.0, spark = 0.0, bloom = 0.0;
  float meltShrink = sqrt(max(0.0, 1.0 - smoothstep(.45, .95, clear)));
  vec4 ice1 = vec4(1e9, 0.0, 9.0, 9.0), ice2 = ice1, ice1c = vec4(0.0), ice2c = vec4(0.0);
  vec4 star1 = vec4(1e9, 0.0, 0.0, 0.0), star2 = star1;
  int lastT = -1;
  vec4 ev = vec4(0.0);
  for (int j = 0; j < int(head.y); j++) {
    int e = int(head.x) + j, et = e >> 2, ec = e & 3;
    if (et != lastT) { ev = dewData(entryBase + et); lastT = et; }
    int id = int(ec == 0 ? ev.x : ec == 1 ? ev.y : ec == 2 ? ev.z : ev.w);
    vec4 A = dewData(recBase + id * 5);
    if (Pp >= A.z) continue;
    if (length(qp - A.xy) > mod(A.w, 1000.0)) continue;
    vec4 B = dewData(recBase + id * 5 + 1);
    float t0 = B.w;
    if (Pp < t0) continue;
    float kind = mod(floor(A.w / 1000.0), 8.0);
    float r = dewCbrt(B.x + B.y * max(0.0, min(Pp, B.z) - t0));
    vec2 dq = qp - A.xy;
    float dist = length(dq);
    if (dist > max(r * 2.3, r + 34.0)) continue;
    // When it freezes: the plan's chain, or the click's front, from its centre.
    vec4 E = dewData(recBase + id * 5 + 4);
    float tfE = click ? dewClearStart(A.xy * toScreen) - .035 : E.w;
    r *= meltShrink;
    if (r < .35 && !(!click && E.w < 8.0 && Pp > E.w - .03)) continue;
    // Icy: frozen, or about to be reached by a bridge. Only the two nearest are dressed with frost,
    // halo, bloom and bridge (what any one point can show).
    if (full && ((!click && E.w < 8.0 && Pp > E.w - .03) || (click && P > tfE))) {
      float ed = dist - r;
      if (ed < ice1.x) { ice2 = ice1; ice2c = ice1c; ice1 = vec4(ed, r, tfE, E.w); ice1c = vec4(A.xy, float(id), 0.0); }
      else if (ed < ice2.x) { ice2 = vec4(ed, r, tfE, E.w); ice2c = vec4(A.xy, float(id), 0.0); }
    }
    if (r < .35) continue;
    if (r > 3.5 && dist - r < 26.0) {
      if (dist - r < star1.x) { star2 = star1; star1 = vec4(dist - r, r, A.xy); }
      else if (dist - r < star2.x) star2 = vec4(dist - r, r, A.xy);
    }
    vec2 g = dist > 1e-4 ? dq / dist : vec2(0.0);
    // The contact line is pinned on the glass's defects (contact-angle hysteresis): a larger drop's
    // outline keeps a little irregularity, never quite a circle.
    float hs = hash(vec2(float(id), 8.3)), ang = atan(dq.y, dq.x);
    float pin = (.05 * sin(3.0 * ang + hs * 40.0) + .03 * sin(5.0 * ang + hs * 70.0)) * smoothstep(3.0, 10.0, r);
    float d = dist - r * (1.0 + pin);
    float kd = d;
    float sNow = clamp(dist / (r * (1.0 + pin)), 0.0, 1.0);
    if (kind == 1.0 && r > 2.0) {
      // A merge: the parents' bridged union snaps into the child with a damped wobble (Rayleigh's
      // l = 2 mode), and, pinned, never relaxes all the way: it keeps some of its length along the
      // line the parents met on.
      vec4 C = dewData(recBase + id * 5 + 2);
      float Va = C.z * C.z * C.z, Vb = C.w * C.w * C.w;
      vec2 pb = (A.xy * (Va + Vb) - C.xy * Va) / Vb;
      float u = (Pp - t0) / ${f(DEW.merge)};
      vec2 ax = normalize(pb - C.xy + 1e-5);
      float th = dot(g, ax), c2 = 2.0 * th * th - 1.0;
      float keep = (.1 + .12 * hs) * sqrt(min(C.z, C.w) / max(max(C.z, C.w), 1e-3));
      float osc = (keep + .16 * exp(-3.5 * min(u, 4.0)) * cos(TAU * 1.7 * u)) * c2;
      float dC = dist - r * (1.0 + osc + pin);
      kd = dC;
      if (u < 1.0) {
        float dA = length(qp - C.xy) - C.z, dB = length(qp - pb) - C.w;
        float k = (C.z + C.w) * (.15 + .6 * sqrt(u));
        float hmin = clamp(.5 + .5 * (dB - dA) / k, 0.0, 1.0);
        float br = mix(dB, dA, hmin) - k * hmin * (1.0 - hmin);
        kd = mix(br, dC, smoothstep(.1, .75, u));
      }
      if (kd < hit.d) sNow = clamp(1.0 + kd / max(r, 1.0), 0.0, 1.0);
    }
    if (kd < hit.d) {
      hit.d = kd; hit.c = A.xy; hit.a = r; hit.kind = kind; hit.seed = float(id); hit.g = g; hit.s = sNow; hit.t0 = t0; hit.tf = tfE;
      hit.col = E.rgb; hit.spin = floor(A.w / 1000.0) >= 16.0 ? (hash(vec2(float(id), 1.9)) < .5 ? -1.0 : 1.0) : 0.0;
    }
  }

  // Frost, halos, blooms and bridges round the two nearest icy drops.
  for (int k = 0; k < 2; k++) {
    vec4 I = k == 0 ? ice1 : ice2, Ic = k == 0 ? ice1c : ice2c;
    if (I.x > 1e8) continue;
    int id = int(Ic.z);
    vec2 dq = qp - Ic.xy;
    float dist = length(dq), r = I.y, tfE = I.z;
    // The bridge that froze it, grown from the drop it came from at a steady rate since that froze,
    // its tip a travelling spark: a feathered filament, a core with short barbs at 60°.
    if (!click && I.w < 8.0 && Pp > I.w - .03) {
      vec4 D = dewData(recBase + id * 5 + 3);
      if (D.w >= 0.0 && Pp > D.w) {
        vec2 dir = normalize(Ic.xy - D.xy + 1e-5);
        vec2 s0 = D.xy + dir * D.z;
        float L = max(0.0, length(Ic.xy - D.xy) - D.z - r);
        float tip = min(L, vb * (Pp - D.w));
        float u;
        float db = dewSeg(qp, s0, s0 + dir * tip, u);
        float fade = 1.0 - smoothstep(${f(DEW.iceFade - 0.05)}, ${f(DEW.iceFade)}, Pp - D.w);
        vec2 lq = vec2(dot(qp - s0, dir), dot(qp - s0, vec2(-dir.y, dir.x)));
        float xw = lq.x + 1.8 * noise(vec2(lq.x * .35, float(id) * .13)), bi = floor((xw + abs(lq.y) * .577) / 3.0);
        float barbs = exp(-abs(abs(lq.y) - abs(fract((xw + abs(lq.y) * .577) / 3.0) - .5) * 1.2) * 3.0) * step(abs(lq.y), 1.0 + 2.2 * hash(vec2(bi, float(id)))) * step(0.0, lq.x) * step(lq.x, tip);
        bridge = max(bridge, (exp(-db / .45) + .3 * exp(-db / 2.5) + .25 * barbs) * fade);
        if (tip < L) spark += exp(-dot(qp - s0 - dir * tip, qp - s0 - dir * tip) / 1.4) * 1.3;
      }
    }
    if (P > tfE && r >= .35) {
      // The moment it freezes: a bloom of light, a burst of sparks.
      float fa = P - tfE;
      bloom += dewPulse(fa / .014) * (exp(-max(dist - r, 0.0) / max(r * .6, 3.0)) * .8 + step(dist, r) * .5);
      if (fa < .045) {
        for (int m = 0; m < 7; m++) {
          float hk = hash(vec2(float(id), float(m) * 1.7));
          float an = (float(m) + hk) * TAU / 7.0;
          vec2 sp = Ic.xy + vec2(cos(an), sin(an)) * (r + (500.0 + 700.0 * hk) * h0.y / 900.0 * fa);
          vec2 dd = qp - sp;
          spark += exp(-dot(dd, dd) / 1.2) * (1.0 - fa / .045) * 1.4;
        }
      }
      // The frost halo (Jung et al. 2012): the frozen drop's latent heat evaporates the drops around it
      // and the vapour freezes out in a ring, 1.4 to 2 radii out, blooming outward.
      float grow = smoothstep(0.0, .03, fa);
      float hang = atan(dq.y, dq.x), hid = float(id) * .37;
      float band = exp(-pow((dist / max(r, .5) - mix(1.15, 1.7, grow) * (1.0 + .3 * (noise(vec2(hang * 2.5 + hid, hid)) - .5))) / (.22 + .2 * grow), 2.0)) * grow;
      band *= smoothstep(.35, .6, noise(vec2(hang * 1.6 + hid * 3.0, 4.0 + hid)));
      if (band > .01) {
        vec2 cid = floor(qp / 2.4);
        float hh = hash(cid + float(id) * .37);
        vec2 cp = fract(qp / 2.4) - (.25 + .5 * hash2(cid + 5.0));
        float glit = step(.78, hh) * exp(-dot(cp, cp) * 22.0) * (.4 + .6 * hash(cid + 3.1));
        halo += band * glit * (.6 + .8 * dewPulse((fa - .004 * hh) / .05)) * (1.0 - smoothstep(${f(DEW.iceFade - 0.05)}, ${f(DEW.iceFade)}, fa));
      }
    }
  }

  // ---- composition, in linear light -----------------------------------------------------------
  vec3 col;
  float alphaOut = 1.0;
  vec3 glass;
  if (click) {
    // Over any page: frosted glass, opaque by the time the cover swaps.
    float fog = smoothstep(0.0, .06, tau) * (1.0 - .62 * smoothstep(.14, .5, tau));
    glass = DEW_FROST * mix(.2, .5, fog) + vec3(.01, .02, .05);
    alphaOut = smoothstep(-.02, .2, tau);
  } else glass = sci;
  float cover = hit.kind >= 0.0 ? smoothstep(aaP, -aaP, hit.d) : 0.0;
  bool onDrop = cover > 0.0;
  vec3 tint = hit.col / max(max(hit.col.r, max(hit.col.g, hit.col.b)), 1e-3);
  // Science's drops on a click: water lenses over the frost once the click's cold reaches them.
  float wetSci = 0.0;
  vec3 n = vec3(0.0, 0.0, 1.0);
  float a = 60.0;
  if (click && !onDrop) {
    dewScience(P, S, true);
    vec2 G;
    float Fd = cosmosField(px, G);
    wetSci = smoothstep(.97, 1.03, Fd) * gWet;
    if (wetSci > 0.0) { n = dewMetaNormal(G, Fd); a = R.y * .06; }
  }
  col = glass;
  if (wetSci > 0.0) { col = mix(col, dewLens(n, q, a, S, true), wetSci); alphaOut = max(alphaOut, wetSci); }
  if (onDrop) {
    // The cap: the incidence at this point from its distance in (s = ρ/a): sin α = s·sin θc; each
    // drop's own contact angle.
    float thc = radians(50.0 + 25.0 * hash(vec2(hit.seed, 2.7)));
    float al = asin(clamp(hit.s * sin(thc), 0.0, 1.0));
    n = vec3(hit.g * sin(al), cos(al));
    a = hit.a * toScreen.y * zoom;
    vec3 drop;
    if (click) drop = dewLens(n, q, a, S, true);
    else {
      // Its depth here (a spherical cap), in units of 3.5 px, for its colour.
      float Rs = 1.0 / sin(thc), hgt = .6 + hit.a * max(sqrt(max(Rs * Rs - hit.s * hit.s, 0.0)) - Rs * cos(thc), 0.0) / 3.5;
      drop = dewDrop(n, q, a, S, tint, hgt);
      // The rim goes dark where the lens looks far off its axis; light gathered inside it shows as a
      // bright crescent opposite the window.
      drop *= 1.0 - .5 * pow(smoothstep(.72, 1.0, hit.s), 1.5);
      vec3 L = dewLightDir();
      vec2 cres = -normalize(L.xy + 1e-4) * .62;
      vec2 sl = (qp - hit.c) / max(hit.a, 1.0);
      drop += tint * exp(-dot(sl - cres, sl - cres) / .035) * .28 * smoothstep(1.0, .8, hit.s);
      // The stardust it gathered still turning inside it, settling (until it freezes).
      if (hit.spin != 0.0 && Pp < hit.tf) {
        float age = Pp - hit.t0;
        if (age < .3) for (int k = 0; k < 5; k++) {
          float hk = hash(vec2(hit.seed, float(k) * 3.1)), rr = (.15 + .7 * hk) * hit.a;
          float an = hash(vec2(hit.seed, float(k) + 7.7)) * TAU + hit.spin * age * 30.0 / (.3 + rr / max(hit.a, 1.0));
          vec2 mp = hit.c + rr * vec2(cos(an), sin(an));
          float dm = length(qp - mp);
          drop += (tint * 1.3 + .35) * exp(-dm * dm / .45) * exp(-age / .12) * 1.4;
        }
      }
    }
    // The contact line: a thin bright thread just inside the rim.
    drop += vec3(.55, .7, .9) * exp(-pow((hit.d + 1.0) / .55, 2.0)) * .45 * (.35 + .65 * noise(vec2(atan(qp.y - hit.c.y, qp.x - hit.c.x) * 3.0 + hit.seed, hit.seed)));
    // Freezing: recalescence fills the drop with dendritic ice in a flash, milky; then it clears to a
    // bead of coloured ice, faceted, with a glint at its tip (the point a freezing drop pushes up).
    if (P > hit.tf) {
      float age = P - hit.tf;
      float flash = dewPulse(age / .016);
      float milky = smoothstep(0.0, .002, age) * (1.0 - smoothstep(.004, .014, age)) * .35;
      vec2 lq = (qp - hit.c) / max(hit.a, 1.0);
      float fern = 0.0;
      for (int k = 0; k < 3; k++) {
        vec2 dir = vec2(cos(float(k) * 1.0472 + hit.seed), sin(float(k) * 1.0472 + hit.seed));
        float along = dot(lq, dir), across = dot(lq, vec2(-dir.y, dir.x));
        fern = max(fern, exp(-abs(across) * 18.0) + .5 * exp(-abs(abs(across) - .12 - .3 * abs(fract(along * 4.0) - .5)) * 26.0));
      }
      float thaw = smoothstep(.3, .55, clear);
      float lum = dot(drop, vec3(.2126, .7152, .0722)), facet = .85 + .3 * hash(vec2(floor(atan(lq.y, lq.x) * 1.9 + hit.seed), hit.seed));
      vec3 iceTint = click ? vec3(.85, .93, 1.0) : mix(vec3(1.0), tint, .7);
      vec3 frozen = mix(drop, (vec3(lum) * .8 + .08) * iceTint + DEW_FROST * .08, .55) * facet;
      vec3 ice = mix(frozen * .95 + mix(DEW_FROST, iceTint, .5) * fern * .16, mix(DEW_FROST, iceTint, .4) * (.4 + .45 * fern), milky * .85);
      ice += mix(vec3(.5, .88, 1.0), iceTint, .5) * flash * .9;
      float tip = exp(-dot(lq, lq) * 60.0) * (.5 + .5 * smoothstep(.02, .05, age));
      ice += vec3(1.0) * tip * 2.0 * (1.0 - milky);
      drop = mix(ice, drop, thaw);
    }
    col = mix(col, drop, cover);
    alphaOut = max(alphaOut, cover);
  }
  vec3 frostTint = !click && hit.kind >= 0.0 ? mix(vec3(1.0), tint, .45) : vec3(1.0);
  col += DEW_FROST * frostTint * halo * .8 + vec3(.45, .85, 1.0) * bloom;
  // The bridges of frost glow and their tips spark.
  if (!click) col += vec3(.55, .88, 1.0) * bridge * .55 + vec3(.9, .97, 1.0) * spark;
  else col += vec3(.9, .97, 1.0) * spark;

  // ---- crystals, fissures, electricity ---------------------------------------------------------------
  if (cell.ci >= 0) {
    vec4 m0 = dewData(22), m1 = dewData(23);
    int sb = int(m0.x);
    vec4 A0 = dewData(sb + cell.ci * 5), A2 = dewData(sb + cell.ci * 5 + 2), A4 = dewData(sb + cell.ci * 5 + 4);
    float vc = m1.z, reach = dewData(sb + cell.ci * 5 + 1).z * 1.05;
    // The crystal: six arms from its seed, branching at 60° and branching again, growing at vc since
    // the freeze reached it; behind its tips the ice plate fills in. Coloured by the drop it grew from.
    float L = clamp(vc * (Pp - A0.z), 0.0, reach);
    // Where its cell meets the next before the next crystal has grown there, it fades out rather than
    // stopping at a straight edge.
    float edgeK = 1.0;
    if (cell.cj >= 0) { vec4 N0 = dewData(sb + cell.cj * 5); edgeK = Pp < N0.z + length(qp - N0.xy) / vc ? smoothstep(0.0, 9.0, cell.e) : 1.0; }
    if (L > 0.0 && edgeK > 0.0) {
      vec4 dd = dewCrystal(qp - A0.xy, L, reach, A2.w, A0.w) * edgeK;
      float age = Pp - A0.z;
      vec3 ct = A4.rgb / max(max(A4.r, max(A4.g, A4.b)), 1e-3);
      vec3 iceC = mix(mix(vec3(.55, .85, 1.0), ct, .65), mix(vec3(.95, .99, 1.0), ct, .3), dd.y);
      // Behind its arms, as the crystal passes, hoarfrost: fine feathers of ice at 60°, turned with the
      // crystal, catching the nebula's light in its colour.
      vec2 hq = mat2(cos(A2.w), -sin(A2.w), sin(A2.w), cos(A2.w)) * (qp - A0.xy);
      float hoar = 0.0;
      float passed = smoothstep(0.0, .03, Pp - A0.z - length(qp - A0.xy) / vc);
      if (passed > 0.0) for (int k = 0; k < 3; k++) {
        vec2 hk = mat2(cos(float(k) * 1.0472), -sin(float(k) * 1.0472), sin(float(k) * 1.0472), cos(float(k) * 1.0472)) * hq;
        float cw = k == 0 ? 7.0 : k == 1 ? 5.0 : 9.0, ci = floor(hk.x / cw), hh = hash(vec2(ci + A0.w * 13.0, float(k)));
        float across = hk.x - (ci + .5 + .3 * (hh - .5)) * cw, v = hk.y + abs(across) * .577;
        float barb = exp(-abs(fract(v / (2.6 + hh)) - .5) * 4.5 / .6) * step(abs(across), 1.2 + 2.0 * hh);
        hoar = max(hoar, max(exp(-abs(across) / .45) * .6, barb * .5) * step(.35, hash(vec2(ci, floor(hk.y / 24.0) + float(k) * 7.0))));
      }
      hoar *= passed;
      // The ice over what lies behind: a frosted veil, lit faintly in the crystal's colour; the beads
      // beneath dim into it.
      float cl = dot(col, vec3(.2126, .7152, .0722));
      vec3 veil = mix(vec3(cl), ct * (cl + .04), .6) * .7 + ct * .035 + vec3(.018, .028, .055);
      col = mix(col, veil, clamp(dd.z * .55 + passed * .25, 0.0, .8));
      col += mix(vec3(.75, .9, 1.0), ct, .55) * hoar * .1;
      // Its plates shimmer with a thin film's colours where the light catches them.
      col += spectrum(dd.y * .8 + A0.w * .37 + gDewLight * .3) * dd.z * .06;
      // The arms, fresh ones bright, with a soft glow along them; the growing tips.
      col += iceC * (dd.x * (.9 + .9 * exp(-age / .05)) + pow(dd.x, .25) * .07);
      col += mix(vec3(.6, .9, 1.0), ct, .5) * dd.w * 1.4 * smoothstep(.0, .02, age) * (1.0 - smoothstep(.08, .12, age));
      // Glitter: grains of frost catching the light, twinkling.
      vec2 gc = floor(qp / 3.0);
      float gh = hash(gc + A0.w * 7.0);
      if (gh > .955) {
        vec2 gp = (gc + .25 + .5 * hash2(gc + 1.3)) * 3.0;
        col += mix(vec3(1.0), ct, .3) * exp(-dot(qp - gp, qp - gp) / .5) * (.5 + .5 * sin(T * (2.0 + 5.0 * gh) + gh * 90.0)) * (dd.x * 2.0 + hoar + dd.z * .6) * 1.4;
      }
    }
    // The fissure: where two crystals have met, their boundary splits, and electricity crackles in it.
    if (cell.cj >= 0) {
      vec4 B0 = dewData(sb + cell.cj * 5);
      float tEdge = max(A0.z + length(qp - A0.xy) / vc, B0.z + length(qp - B0.xy) / vc);
      float open = smoothstep(tEdge + ${f(DEW.crack)}, tEdge + ${f(DEW.crack + 0.025)}, Pp);
      bool main = A2.x == float(cell.cj) || A2.y == float(cell.cj) || A2.z == float(cell.cj);
      // The fracture front (the scroll's rift): every boundary splits as it passes, white-hot at the
      // running tip, then a dark seam lit at its lips.
      if (!click && !main && P > ${f(DEW.detach0 - DEW.lead - 0.01)}) {
        float tf = dewFront(qp), since = P - tf;
        if (since > -.004) {
          float wF = 1.6 * smoothstep(0.0, .01, since), eF = cell.e;
          col = mix(col, vec3(.0, .004, .02), exp(-pow(eF / max(wF, .3), 2.0)) * .9 * smoothstep(-.002, .004, since));
          col += DEW_DAY * exp(-pow((eF - wF) / .7, 2.0)) * .8 * smoothstep(0.0, .006, since);
          float tipF = exp(-pow(since / .0035, 2.0));
          col += (vec3(1.0) * exp(-eF / .8) * 2.5 + vec3(.6, .85, 1.0) * exp(-eF / 6.0) * .8) * tipF;
        }
      }
      float pairH = hash(vec2(float(min(cell.ci, cell.cj)), float(max(cell.ci, cell.cj))));
      // Not every boundary splits: about two in three. The main crack is drawn along its own path below.
      if (main || pairH < .35) open = 0.0;
      if (open > 0.0) {
        float surge = smoothstep(${f(DEW.surge)}, ${f(DEW.split)}, P);
        vec2 lo = cell.ci < cell.cj ? A0.xy : B0.xy, hi = cell.ci < cell.cj ? B0.xy : A0.xy;
        vec2 tn = normalize(vec2(lo.y - hi.y, hi.x - lo.x));
        float sAl = dot(qp, tn), es = cell.ci < cell.cj ? cell.e : -cell.e;
        es -= (noise(vec2(sAl * .09, pairH * 50.0)) - .5) * 6.0 + (noise(vec2(sAl * .45, pairH * 31.0)) - .5) * 1.6;
        float w = 1.0 * open;
        float e = abs(es);
        col = mix(col, vec3(.0, .006, .025), exp(-pow(e / max(w, .3), 2.0)) * .9);
        col += vec3(.75, .93, 1.0) * exp(-pow((e - w) / .5, 2.0)) * open * .35;
        float charge = smoothstep(.6, .7, P) * (.45 + .6 * surge) * step(.62, pairH);
        float flick = smoothstep(.28, .58, noise(vec2(sAl * .025 + T * 2.3, T * 7.0 + pairH * 40.0)));
        float o1 = (noise(vec2(sAl * .08, T * 6.0 + pairH * 9.0)) - .5) * 6.0 + (noise(vec2(sAl * .32, T * 14.0)) - .5) * 2.0;
        float arc = exp(-abs(es - o1) / .4);
        vec3 elec = mix(vec3(.3, .72, 1.0), vec3(.82, .55, 1.0), noise(vec2(sAl * .05, T * 3.0)));
        col += (elec * (arc * 2.4 + exp(-e / 5.0) * .5) + vec3(1.0) * arc * arc * 1.1) * charge * flick * open;
      }
    }
  }
  // The main crack, along its path (the plan's least-cost run of boundaries): it opens as its
  // crystals meet, takes the charge, carries surges and splits the pane.
  if (!click) {
    vec4 cm = dewData(24), c0 = dewData(22), c1 = dewData(23);
    ivec2 ct = clamp(ivec2(qp / c0.z), ivec2(0), ivec2(c1.xy) - 1);
    vec4 chd = dewData(int(c0.w) + ct.y * int(c1.x) + ct.x);
    float dm = 1e9, sm = 1.0, xs = q.x / S.x;
    for (int j = 0; j < 24; j++) {
      if (j >= int(chd.w)) break;
      int e = int(chd.z) + j;
      int k = int(dewData(entryBase + (e >> 2))[e & 3]);
      vec2 a = dewData(int(cm.x) + k).xy, b = dewData(int(cm.x) + k + 1).xy, ab = b - a;
      float t = clamp(dot(qp - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      vec2 dv = qp - a - ab * t;
      float d = length(dv);
      if (d < dm) { dm = d; sm = sign(ab.x * dv.y - ab.y * dv.x); }
    }
    float open = smoothstep(.66, .72, P), surge = smoothstep(${f(DEW.surge)}, ${f(DEW.split)}, P);
    if (open > 0.0 && dm < 60.0) {
      float sAl = qp.x;
      float es = dm * sm - ((noise(vec2(sAl * .05, 17.0)) - .5) * 7.0 + (noise(vec2(sAl * .3, 5.0)) - .5) * 2.0);
      float e = abs(es), w = (2.2 + 3.0 * surge) * open;
      col = mix(col, vec3(.0, .004, .02), exp(-pow(e / w, 2.0)) * .95);
      col += vec3(.8, .95, 1.0) * exp(-pow((e - w) / .6, 2.0)) * .7 * open;
      float o1 = (noise(vec2(sAl * .07, T * 7.0)) - .5) * 8.0 + (noise(vec2(sAl * .35, T * 15.0)) - .5) * 2.2;
      float o2 = (noise(vec2(sAl * .05 + 3.0, T * 8.0)) - .5) * 12.0 + (noise(vec2(sAl * .4, T * 18.0)) - .5) * 2.6;
      float o3 = (noise(vec2(sAl * .04 + 7.0, T * 5.0)) - .5) * 18.0 + (noise(vec2(sAl * .5, T * 22.0)) - .5) * 3.0;
      float arc = max(exp(-abs(es - o1) / .42), max(exp(-abs(es - o2) / .5) * .85, exp(-abs(es - o3) / .45) * .7 * surge));
      float pulse = 0.0;
      for (int k = 0; k < 3; k++) { float c = fract(P * 22.0 + float(k) * .33) * 1.3 - .15; pulse += exp(-pow((xs - c) / .035, 2.0)); }
      float charge = (.7 + 2.0 * surge) * (1.0 + pulse * 2.2 * surge) * mix(smoothstep(.3, .6, noise(vec2(sAl * .02 + T * 2.0, T * 6.0))), 1.0, .5 + .5 * surge);
      vec3 elec = mix(vec3(.35, .75, 1.0), vec3(.85, .55, 1.0), noise(vec2(sAl * .04, T * 2.5)));
      col += (elec * (arc * 2.4 + exp(-e / 9.0) * (.25 + .7 * surge)) + vec3(1.0) * arc * arc * 1.2) * charge * open * (1.0 - smoothstep(${f(DEW.riftOpen)}, ${f(DEW.riftOpen + 0.04)}, P));
    }
  }
  // A click's pieces carry a charge on their rims as they fall.
  col += mix(vec3(.4, .8, 1.0), vec3(.9, .7, 1.0), .3) * cell.rim * 1.6;

  // Glints on the two nearest drops: a core and diffraction spikes, twinkling.
  if (full && clear < 1.0) {
    vec3 Lg = normalize(dewLightDir() + vec3(0.0, 0.0, 1.0));
    vec2 hd = length(Lg.xy) > 1e-4 ? normalize(Lg.xy) : vec2(0.0);
    for (int k = 0; k < 2; k++) {
      vec4 st = k == 0 ? star1 : star2;
      if (st.x > 1e8) continue;
      vec2 gp = st.zw + hd * st.y * .5;
      vec2 dd = (qp - gp) * zoom;
      float len = st.y * zoom * 1.6 + 6.0;
      float tw = .55 + .45 * sin(T * 2.3 + hash(st.zw) * 40.0);
      vec2 r45 = vec2(dd.x + dd.y, dd.x - dd.y) * .7071;
      float spikes = exp(-abs(dd.y) * 1.6) * exp(-abs(dd.x) / len) + exp(-abs(dd.x) * 1.6) * exp(-abs(dd.y) / len)
                   + .35 * (exp(-abs(r45.y) * 1.8) * exp(-abs(r45.x) / (len * .6)) + exp(-abs(r45.x) * 1.8) * exp(-abs(r45.y) / (len * .6)));
      float core = exp(-dot(dd, dd) / max(st.y * zoom * .12, .6));
      col += vec3(1.0, .96, .9) * (spikes * .15 + core * 1.1) * tw * smoothstep(5.0, 10.0, st.y) * (1.0 - smoothstep(.3, .8, clear));
    }
  }
  // As the main crack takes its charge, flashes light the whole pane.
  if (!click) col += vec3(.25, .35, .6) * pow(noise(vec2(T * 13.0, 2.0)), 10.0) * .45 * smoothstep(${f(DEW.surge)}, ${f(DEW.split)}, P) * (1.0 - smoothstep(.9, .97, P));
  // A click: fern frost grows up the pane from the freezing front, a stem every 12–26 px with barbs at
  // 60° on both sides, short at each advancing tip, longer behind it.
  if (full && click) {
    float tfz = dewClearStart(q) - .035;
    if (P > tfz - .04 && clear < 1.0) {
      float fr = 0.0;
      for (int k = 0; k < 3; k++) {
        float cw = k == 0 ? 26.0 : k == 1 ? 17.0 : 12.0;
        vec2 fq = qp + vec2(float(k) * 13.0, 0.0);
        float ci = floor(fq.x / cw);
        float hs = hash(vec2(ci, float(k) * 7.0 + 1.0));
        float tilt = (hash(vec2(ci, float(k) + 3.0)) - .5) * 1.5;
        float sx = (ci + .5 + .3 * (hs - .5)) * cw + tilt * (fq.y - S.y * toPlan.y * .5);
        float across = fq.x - sx;
        float lead = P - (tfz - .04 * (.35 + .65 * hs) * (k == 0 ? 1.0 : .75));
        if (lead <= 0.0) continue;
        float age = clamp(lead / .03, 0.0, 1.0);
        float stem = exp(-abs(across) / .9) * smoothstep(0.0, .15, age);
        float v = fq.y + abs(across) * .577;
        float dBarb = abs(fract(v / 4.0) - .5) * 4.0 * .866;
        float L = (k == 0 ? 13.0 : k == 1 ? 8.0 : 5.0) * age;
        float barb = exp(-dBarb / .6) * step(abs(across), L) * (1.0 - .7 * abs(across) / max(L, 1e-3));
        fr = max(fr, max(stem, barb * .85) * (k == 0 ? 1.0 : k == 1 ? .8 : .6));
      }
      float sparkle = step(.9, hash(floor(qp / 2.5) + 1.3)) * fr * (.6 + .4 * sin(T * 3.0 + hash(floor(qp / 2.5)) * 30.0));
      col = mix(col, DEW_FROST * .95, fr * .75 * (1.0 - clear)) + DEW_FROST * sparkle * 1.4 * (1.0 - clear);
    }
  }
  return vec4(dewCompress(col), alphaOut);
}

// The material. The camera pushes slowly into the pane while the world behind stays; at the surge the
// pane shakes; then it shatters (dewShatter). Science (behind the pane) and the glacier (behind the
// shattered pane) are each drawn once at most.
vec4 dewMaterial(vec2 q, vec2 px, vec2 S, float P, bool click, bool reveal) {
  if (P <= -.2) return click ? vec4(0.0) : vec4(sceneCosmos(px), 1.0);
  if (click && P >= 1.12) return vec4(0.0);
  // The scroll's end: Racing, its glass card in place (the band's own world draws the same).
  if (!click && P >= 1.18) { gCardMix = 1.0; return vec4(sceneGlacier(px), 1.0); }
  float tau = click ? P - dewCold(q) : 0.0;
  if (uIceReady < .5) {
    float clear = dewClear(q, P, click);
    if (click) { float f = smoothstep(-.2, .72, P) * (1.0 - clear); return vec4(dewDisplay(DEW_FROST * .55) * f, f); }
    return vec4(mix(sceneCosmos(px), sceneGlacier(px), smoothstep(-.2, 1.12, P)), 1.0);
  }
  // The fragments' still (transit.js iceSnap): the pane as it is, without the push, the shake or the rift.
  bool still = !click && uE > .5;
  float zoom = click || still ? 1.0 : 1.0 + .3 * pow(smoothstep(.1, 1.12, P), 1.3);
  vec2 zc = S * vec2(.5, .52);
  float shakeA = click || still ? 0.0 : 7.0 * smoothstep(${f(DEW.surge)}, ${f(DEW.split)}, P) * (1.0 - smoothstep(.9, .99, P));
  vec2 shake = shakeA * (vec2(noise(vec2(T * 37.0, 1.3)), noise(vec2(T * 41.0, 7.7))) - .5) * 2.0;
  vec2 qz = zc + (q + shake - zc) / zoom;
  vec2 toPlan = dewData(0).xy / S;
  // The scroll: before the first ending, Science as it is. Then the nebulae and the gas they light, and
  // its collapse; where a point's gas has not yet been swept up (until the freeze), only that.
  if (!click) {
    if (P < dewData(int(dewData(25).y)).z - .025) return vec4(sceneCosmos(px), 1.0);
    dewGiantsGone(P);
    tau = P - dewCond(qz * toPlan);
    if (tau < -.045 && P < ${f(DEW.chain0 - 0.02)}) {
      vec3 sky = dewLinear(sceneCosmos(px));
      sky = dewGasLook(sky, q, qz * toPlan, S, P, zoom, zc);
      return vec4(dewDisplay(sky + dewFlashes(px, P)), 1.0);
    }
  }
  // The rift: the main crack's two halves part (the upper up, the lower down), each by half the
  // opening; in the gap, and wherever a piece has broken away, Racing's day.
  bool gap = false;
  vec3 riftLight = vec3(0.0);
  float lip = 1e9;
  vec2 qpz = qz * toPlan;
  if (!click && !still && P > ${f(DEW.riftOpen)}) {
    vec2 qp = qz * toPlan;
    float cy = dewCrackY(qp.x), dl = dewRiftAt(qp.x) * dewRiftS(P), dy = qp.y - cy;
    lip = abs(dy) - .5 * dl;
    gap = lip < 0.0;
    if (!gap) qz.y -= sign(dy) * .5 * dl / toPlan.y;
    if (abs(dy) < .5 * dl + 60.0) riftLight += dewBolts(qp, P);
    // The day itself, a blaze along the rift's middle where the light comes through first.
    if (gap) riftLight += mix(vec3(.5, .75, 1.0), DEW_DAY, dewDawn(P)) * exp(-abs(dy) / (.1 * dl + 1.5)) * (1.0 - smoothstep(.98, 1.06, P));
    riftLight += DEW_DAY * dewRays(qp, cy, dl, P) * .22 + dewDust(qp, cy, P);
  }
  DewCell cell;
  cell.cov = 1.0; cell.qz0 = qz; cell.rim = 0.0; cell.ci = -1; cell.cj = -1; cell.e = 1e9; cell.fall = 0.0;
  if (gap) cell.cov = 0.0;
  else if (click ? P > .8 : P > ${f(DEW.chain0 - 0.03)}) cell = dewShatter(qz, S, P, click);
  // Past every piece: Racing (on a click, the new page beneath), on the scroll lit by the rift and
  // overexposed as the light first floods in.
  if (cell.cov <= 0.0) {
    if (click) return vec4(0.0);
    gCardMix = smoothstep(1.13, 1.18, P);
    vec3 g = dewDaybreak(dewLinear(sceneGlacier(px)), P, qpz);
    return vec4(dewDisplay(dewCardFrost(g, px, P) + riftLight), 1.0);
  }
  // Where this pane point was on the screen: what it looks through travels with its piece.
  vec2 qs = zc + (cell.qz0 - zc) * zoom - shake;
  vec2 px0 = px + (qs - q);
  if (!click) dewScience(P, S, false);
  // Science behind the pane, its gas and the nebulae, the flashes.
  vec3 sci = vec3(0.0);
  if (!click) {
    float cheap = smoothstep(.22, .32, tau);
    if (cheap < 1.0) sci = sceneCosmos(px0);
    if (cheap > 0.0) sci = mix(sci, cosmosDrops(textureLod(uTexA, vec2(qs.x / S.x, 1.0 - qs.y / S.y), 0.0).rgb, px0), cheap);
    sci = dewLinear(sci);
    sci = dewGasLook(sci, qs, cell.qz0 * toPlan, S, P, zoom, zc);
    if (P < .5) sci += dewFlashes(px0, P);
  }
  vec4 o = dewPane(qs, cell.qz0, px0, S, P, click, sci, cell, zoom);
  if (click) {
    float alphaOut = (reveal ? 1.0 : o.a) * cell.cov;
    return vec4(dewDisplay(o.rgb) * alphaOut, alphaOut);
  }
  vec3 col = o.rgb;
  // The lips of the rift, lit from behind through the ice's edge.
  if (lip < 1e8) col += mix(vec3(.45, .8, 1.0), DEW_DAY, dewDawn(P)) * (exp(-lip / 2.5) * .9 + exp(-lip / 18.0) * .18) * smoothstep(${f(DEW.riftOpen)}, ${f(DEW.riftOpen + 0.03)}, P);
  return vec4(dewDisplay(col + riftLight), 1.0);
}
`;
