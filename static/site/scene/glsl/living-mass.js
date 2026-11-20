// The living ink (living-mass.js): one body a draw, sphere-traced through the water along the view (the
// camera under the surface sees the tank square on), into the figures' target with its depth, so the mist
// splits round it and the sheets behind it are hidden as they are behind a piece (glsl/living-ink.js).
//   Its distance: a drop breathing in Rayleigh's modes, globs merged into it by a smooth union, tendrils as
// chains of tapering capsules; sharp, the 40³ noise tile's cellular channel raises spikes where its feature
// points meet the skin; gaseous, the tile's fractal channels eat it away and it fades into the mist the
// worker splats round it.
import { TENDRILS, POINTS, SATELLITES } from '../living-mass.js';

export const INK_MASS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform vec2 uSize;        // the target, px (a screen height is uSize.y)
uniform vec4 uBody;        // centre (x scaled by the aspect, y up, tank depth z), radius: screen heights
uniform vec4 uState;       // smooth, sharp, gaseous, spin
uniform vec4 uClock;       // the modes' clock, time (s), ivory (1) or black (0), how much it is there
uniform vec4 uSat[${SATELLITES}];
uniform vec4 uTen[${TENDRILS * POINTS}];
uniform int uTens;
out vec4 o;
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
mat3 spin(float a) {
  float c = cos(a), s = sin(a), c2 = cos(.7 * a + 1.), s2 = sin(.7 * a + 1.);
  return mat3(c, 0., -s, 0., 1., 0., s, 0., c) * mat3(1., 0., 0., 0., c2, s2, 0., -s2, c2);
}
float capsule(vec3 p, vec4 a, vec4 b) {
  vec3 ab = b.xyz - a.xyz;
  float h = clamp(dot(p - a.xyz, ab) / max(dot(ab, ab), 1e-8), 0., 1.);
  return length(p - a.xyz - h * ab) - mix(a.w, b.w, h);
}
float gSpike = 0.;
// Which globs and tendrils this pixel's ray can meet at all (it runs straight into the screen, so a part
// further across than its own thickness never touches it): bits 0 … 5 the globs, 8 … the tendrils.
int gNear = 0;
float seg2(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0., 1.); return length(p - a - h * ab); }
// The Rosensweig lattice: under a field strong enough a magnetic fluid's surface stands up in a near-
// hexagonal array of cones. Over the body, a lattice of cone axes on the faces of a cube projected to the
// sphere, rows offset a half cell; each cone falls straight to its foot (a sharp tip).
float coneField(vec3 n) {
  vec3 a = abs(n);
  vec2 uv = a.x >= a.y && a.x >= a.z ? n.yz / a.x : a.y >= a.z ? n.xz / a.y : n.xy / a.z;
  vec2 g = uv * 2.3;
  g.x += .5 * mod(floor(g.y), 2.);
  vec2 f = fract(g) - .5;
  return pow(max(0., 1. - length(f * vec2(1., 1.12)) / .44), 1.3);
}
float mass(vec3 q) {
  vec3 c = uBody.xyz, d = q - c;
  float R = uBody.w, r = length(d);
  vec3 n = d / max(r, 1e-5);
  // A free drop's shape modes, l = 2, 3, 4, ringing at frequencies in the ratio 1 : 1.94 : 3.
  vec3 ax = normalize(vec3(sin(.7 * uState.w), cos(.5 * uState.w), .4 * sin(uState.w)));
  float x = dot(n, ax), x2 = x * x, t = uClock.x * .9;
  float modes = .10 * .5 * (3. * x2 - 1.) * cos(t) + .06 * .5 * (5. * x2 * x - 3. * x) * cos(1.94 * t + 1.) + .035 * (35. * x2 * x2 - 30. * x2 + 3.) / 8. * cos(3. * t + 2.);
  float dist = r - R * (1. + modes * (.55 + .45 * uState.x));
  // Globs merging into it.
  for (int i = 0; i < ${SATELLITES}; i++) if ((gNear & (1 << i)) != 0) dist = smin(dist, length(q - uSat[i].xyz) - uSat[i].w * uClock.w, R * (.6 + .3 * uState.x));
  // Its tendrils (below) and detail only matter near it: far off, a bound short of all of it is enough.
  vec3 w;
  // Tendrils, each tested against its own reach before its links are.
  for (int k = 0; k < ${TENDRILS}; k++) {
    if (k >= uTens) break;
    if ((gNear & (1 << (8 + k))) == 0) continue;
    float arm = 1e3;
    for (int i = 0; i < ${POINTS - 1}; i++) arm = smin(arm, capsule(q, uTen[k * ${POINTS} + i], uTen[k * ${POINTS} + i + 1]), .012);
    dist = smin(dist, arm, .03 + .02 * uState.x);
  }
  gSpike = 0.;
  float detail = R * (.04 + .95 * uState.y + .3 * uState.z);
  if (dist > detail + .012) return dist - detail;
  // A viscous skin: slow, warped folds over it, deepest where it is smooth.
  w = texture(uNoise, q * 3.3 + vec3(.0, .0, .03 * uClock.y)).rgb;
  dist -= R * .07 * (texture(uNoise, q * 7.5 + w * .9).r - .5) * (1. - .5 * uState.y);
  // Sharp: jammed, it stands up in spikes over its feature points.
  if (uState.y > .01) {
    gSpike = coneField(spin(uState.w) * n);
    // (Only near the skin: its cones are measured from the surface out.)
    dist -= uState.y * R * .95 * gSpike * smoothstep(R * 2.2, R * .6, r);
  }
  // Gaseous: eaten into wisps.
  if (uState.z > .01) {
    vec3 g = texture(uNoise, q * 2.4 + vec3(0., 0., .05 * uClock.y)).rgb;
    vec3 h = texture(uNoise, q * 6.3 + g * .7).rgb;
    dist += uState.z * R * .55 * (g.x + .45 * h.y - .62);
  }
  return dist;
}
void main() {
  vec2 xy = gl_FragCoord.xy / uSize.y;
  float R = uBody.w;
  // What this ray can meet; nothing, and it is done.
  float k = R * (.6 + .3 * uState.x), reachBody = R * (1.35 + .95 * uState.y);
  bool any = length(xy - uBody.xy) < reachBody + .02;
  for (int i = 0; i < ${SATELLITES}; i++) if (length(xy - uSat[i].xy) < uSat[i].w + k + .01) { gNear |= 1 << i; any = true; }
  for (int t = 0; t < ${TENDRILS}; t++) {
    if (t >= uTens) break;
    float best = 1e3;
    for (int i = 0; i < ${POINTS - 1}; i++) best = min(best, seg2(xy, uTen[t * ${POINTS} + i].xy, uTen[t * ${POINTS} + i + 1].xy) - uTen[t * ${POINTS} + i].w);
    if (best < .045) { gNear |= 1 << (8 + t); any = true; }
  }
  if (!any) discard;
  float z = min(${(0.92).toFixed(2)}, uBody.z + 2.6 * R + .05), zEnd = max(0., uBody.z - 2.6 * R - .05), d = 1.;
  // Along the view (toward the far wall), a step a time, a little short (its spikes and erosion bend
  // the distance).
  for (int i = 0; i < 52; i++) {
    d = mass(vec3(xy, z));
    if (d < .0012 || z < zEnd) break;
    z -= max(d * (.66 - .2 * uState.y), .0014);
  }
  if (d > .002 || z < zEnd) discard;
  vec3 p = vec3(xy, z);
  vec2 e = vec2(.0025, -.0025);
  vec3 n = normalize(e.xyy * mass(p + e.xyy) + e.yyx * mass(p + e.yyx) + e.yxy * mass(p + e.yxy) + e.xxx * mass(p + e.xxx));
  float spike = gSpike;
  mass(p);
  spike = gSpike;
  // Lit from the bright ceiling of the water, reflecting its chamber: wet obsidian, or milky ivory (a
  // cornstarch suspension, oobleck). Jammed, it goes matte and its spikes' tips catch the light.
  vec3 v = vec3(0., 0., 1.), L = normalize(vec3(-.3, .85, .42)), refl = reflect(-v, n);
  float nv = max(dot(n, v), 0.), fres = .04 + .96 * pow(1. - nv, 5.), nl = dot(n, L);
  vec3 chamber = mix(vec3(.09, .10, .11), vec3(.88, .86, .82), smoothstep(-.3, .9, refl.y)) + vec3(.5, .48, .45) * pow(max(0., dot(refl, normalize(vec3(.35, .8, .45)))), 40.);
  float sharp = uState.y, gloss = mix(90., 18., sharp), wetness = 1. - .7 * sharp;
  float spec = pow(max(0., dot(refl, L)), gloss) * mix(1.4, .5, sharp);
  // The flow over its skin: streaks drawn along by the current, catching the light in bands.
  vec3 fl = texture(uNoise, p * 2.2 + vec3(0., .02 * uClock.y, 0.)).rgb;
  float streak = .5 + .5 * sin(dot(p, vec3(31., 47., 13.)) + 9. * fl.x + .7 * uClock.x);
  vec3 c;
  if (uClock.z < .5) {
    c = vec3(.008, .007, .009) * (.4 + .6 * max(nl, 0.)) + fres * chamber * (.75 + .25 * streak) * wetness + spec * vec3(.92, .9, .86);
    c += vec3(.20, .19, .20) * spike * sharp * max(nl + .2, 0.);
    // Thin at its rims, the ink lets the chamber's light through brown-black, as ink does.
    c += vec3(.09, .06, .07) * pow(1. - nv, 2.5) * (1. - sharp);
  } else {
    // Milk: light carried into it comes out softer and warmer where it is thin; its shade is cool.
    float wrap = max((nl + .5) / 1.5, 0.);
    c = mix(vec3(.50, .52, .54), vec3(.94, .925, .88), wrap) * (.92 + .08 * streak);
    c += vec3(.22, .18, .14) * pow(1. - nv, 1.8) * (1. - sharp) + vec3(.06, .05, .04) * fl.y;
    c = c * (1. - .3 * fres * wetness) + fres * chamber * .35 * wetness + spec * .5;
    c *= 1. - .3 * spike * sharp * (1. - max(nl, 0.));
  }
  // Its rims thin to smoke; re-misting, its skin breaks into holes and wisps the volume carries on.
  float gas = uState.z, rim = mix(1., smoothstep(.02, .42, nv), .5 * (1. - sharp));
  float erode = texture(uNoise, p * 5.5 + vec3(0., .04 * uClock.y, 0.)).g + .35 * texture(uNoise, p * 13.).b;
  float a = uClock.w * rim * smoothstep(gas * 1.2 - .1, gas * 1.2 + .12, erode * .9);
  c = mix(c, uClock.z < .5 ? vec3(.10, .095, .1) : vec3(.88, .87, .82), .45 * gas);
  c *= .82; c = pow(clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.), vec3(1. / 2.2));
  if (a < .004) discard;
  gl_FragDepth = 1. - clamp(z, .01, .98);
  o = vec4(c * a, a);
}`;

// The bodies are traced at a little over half the figures' resolution; this lays them into the figures'
// target with their depth, so pieces, mist and sheets meet them as they meet a piece.
export const INK_MASS_BLIT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uMassColor, uMassDepth;
uniform vec2 uSize;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 c = texture(uMassColor, uv);
  if (c.a < .004) discard;
  gl_FragDepth = texture(uMassDepth, uv).r;
  o = c;
}`;
