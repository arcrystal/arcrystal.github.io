// The living ink (living-forms.js): its threads. Each form's motes lie along short material lines; a line
// is drawn as the soft thread through its motes, segment by segment (two triangles each, no attributes:
// everything hashes from gl_VertexID), into an order-independent target: R the black ink's optical depth,
// G the ivory's, both added, so no sorting. A segment's ink is its share of the line's pigment spread over
// its length, so a thread drawn out thins as it stretches.
import { MOTE } from '../living-forms.js';

const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(6)));
const SEGMENTS = MOTE.line - 1;

export const INK_MOTES_VERTEX = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uSize;     // the target, px
uniform float uAspect;
uniform int uFirst;     // the form's first vertex
uniform vec4 uForm;     // centroid (x·aspect, y: screen heights), depth, size (screen heights)
uniform vec4 uState;    // orbit scale g, winding W, how much shows, ivory (1) or black (0)
uniform float uSpinAxis;// the form's own slow turn (radians): the axis its two cores lie on
uniform float uMass;    // each mote's share of the form's pigment
uniform float uSeed;    // the form's own seed (its lines are its own, whatever its size)
out float density;
out float across;
flat out float ivory;
flat out float halfWidth;
float hash(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
// The j-th mote of line L (screen heights, x·aspect).
vec2 mote(float L, float j) {
  float side = hash(L) < .5 ? -1. : 1.;
  float r0 = mix(.25, 1.25, pow(hash(L + 1.7), .65)), len = .9 + .8 * hash(L + 3.1);
  float rr = max(.03, r0 + (j / ${f(SEGMENTS)} - .5) * len);
  float theta0 = 6.2831853 * hash(L + 5.9);
  float a2 = ${f(MOTE.core * MOTE.core)}, r2 = rr * rr;
  float om = ${f(MOTE.spin)} * (1. - exp(-r2 / a2)) * a2 / r2 / ${f(1 - Math.exp(-1 / (MOTE.core * MOTE.core)))};
  float th = theta0 + side * om * uState.y;
  vec2 axis = vec2(cos(uSpinAxis), sin(uSpinAxis));
  vec2 core = uForm.xy + side * ${f(MOTE.cores)} * uForm.w * axis;
  vec2 q = core + rr * uState.x * uForm.w * vec2(cos(th), .82 * sin(th));
  // The water's own eddies bend every thread off its circle (a smooth field, fixed in the water).
  vec2 e = vec2(sin(7.3 * q.y + 2.1 * q.x + 1.3 * uSeed) + .5 * sin(15.7 * q.y - 9.1 * q.x + uSeed),
                cos(6.1 * q.x - 3.3 * q.y + .7 * uSeed) + .5 * cos(13.9 * q.x + 11.3 * q.y - uSeed));
  return q + .045 * uForm.w * (.4 + rr) * e;
}
void main() {
  int v = gl_VertexID - uFirst, seg = v / 6, corner = v - seg * 6;
  int line = seg / ${SEGMENTS}, j = seg - line * ${SEGMENTS};
  float L = float(line) + 17.31 * uSeed;
  vec2 a = mote(L, float(j)), b = mote(L, float(j + 1));
  // In pixels: along the segment, and across it by the thread's half width.
  vec2 pa = vec2(a.x / uAspect, a.y) * uSize, pb = vec2(b.x / uAspect, b.y) * uSize, d = pb - pa;
  float len = max(length(d), .5);
  vec2 n = vec2(-d.y, d.x) / len;
  // Hair-fine to broad and faint; and every thread wider as it winds (it diffuses).
  float h = hash(L + 9.3);
  halfWidth = (${f(MOTE.width)} + 9. * h * h) * (1. + .09 * uState.y) + 1.;
  float t = (corner == 1 || corner == 2 || corner == 4) ? 1. : 0.;
  across = (corner == 2 || corner == 4 || corner == 5) ? 1. : -1.;
  vec2 px = mix(pa, pb, t) + n * across * halfWidth;
  // The line's pigment along its length: thin where drawn out, fading at its two ends.
  float u = (float(j) + .5) / ${f(SEGMENTS)}, ends = smoothstep(0., .35, u) * smoothstep(1., .55, u);
  density = uMass * uState.z * ends * (.6 + .4 * hash(L + 2.3)) / len;
  ivory = uState.w;
  gl_Position = vec4(px / uSize * 2. - 1., 0., 1.);
  if (density < 1e-6) gl_Position = vec4(-2., -2., 0., 1.);
}`;

export const INK_MOTES_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float density;
in float across;
flat in float ivory;
flat in float halfWidth;
out vec4 o;
void main() {
  // A Gaussian across the thread, energy-normalised: what a segment carries is spread, not lost.
  float x = across * halfWidth, s = max(${f(MOTE.sigma)}, .4 * (halfWidth - 1.));
  float w = exp(-x * x / (2. * s * s)) / (2.5066283 * s);
  o = vec4(density * w * (1. - ivory), density * w * ivory, 0., 0.);
}`;

// ---- the forms ----------------------------------------------------------------------------------------
// Every living form at once, sphere-traced along the view (the underwater camera sees the tank square on),
// at part of the canvas's resolution, into a target with its depth that is then laid into the figures',
// so pieces, veils and mist meet the forms as they meet a piece.
//   A form is a drop with two slow lobes (l = 2, 3, on an axis that turns with it) and a viscous skin. The
// black forms are one smooth union, the ivory another, so forms of an ink that meet join with a neck and
// part again; where the two inks meet they marble: which ink shows is decided by which union is nearer,
// its boundary warped into swirled bands that turn on. The material is the old living ink's (wet obsidian,
// milky ivory): only its shading, none of its cycles.
export const FORMS_MAX = 14;
export const INK_FORMS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform vec2 uSize;               // the target, px (a screen height is uSize.y)
uniform int uCount;
uniform vec4 uForm[${FORMS_MAX}];   // centre (x·aspect, y: screen heights), depth, radius
uniform vec4 uLook[${FORMS_MAX}];   // ivory (1) or black (0), its turn (radians), how eroded (0 … 1), seed
uniform float uTime, uSwirl;      // seconds; the marbling's own turn (only ever forward)
out vec4 o;
int gNear = 0;
float gShare = 0.;
// A form's arms lie in the view's plane, so along this pixel's ray only their depth changes: their planar
// distance and thickness are found once per pixel (main) and reused at every step.
float gArmPlane[${FORMS_MAX}], gArmThick[${FORMS_MAX}];
float smin(float a, float b, float k) { if (k <= 0.) return min(a, b); float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float form(vec3 q, int i) {
  vec4 F = uForm[i], L = uLook[i];
  vec3 d = q - F.xyz;
  float r = length(d), R = F.w;
  vec3 n = d / max(r, 1e-5);
  // Two slow lobes on an axis that turns with the form.
  vec3 ax = normalize(vec3(cos(L.y), sin(L.y), .35 * sin(.6 * L.y + L.w)));
  float x = dot(n, ax), x2 = x * x;
  float lobes = .16 * .5 * (3. * x2 - 1.) + .08 * .5 * (5. * x2 * x - 3. * x);
  float body = r - R * (1. + lobes);
  float arm = length(vec2(gArmPlane[i], d.z * 1.4)) - gArmThick[i];
  return smin(body, arm, .3 * R);
}
// Two arms wound out of a form as logarithmic spirals (r = R e^{bφ}), turning with it, tapering to threads:
// their part in the view's plane at this pixel.
void armPlane(vec2 xy, int i) {
  vec4 F = uForm[i];
  vec2 dp = xy - F.xy;
  float R = F.w, rp = max(length(dp), 1e-4), phi = atan(dp.y, dp.x) - uLook[i].y;
  float delta = mod(phi - log(rp / R) / .32 + 1.5708, 3.14159265) - 1.5708;
  // (Inside the body there are no arms: the planar distance is kept from the body's inner part.)
  gArmPlane[i] = max(abs(rp * delta * .55), R * .7 - rp);
  gArmThick[i] = .3 * R * exp(-max(0., rp - R) / (1.3 * R)) * smoothstep(3.4 * R, 2.2 * R, rp);
}
float field(vec3 q) {
  float dB = 1e3, dW = 1e3, kB = 0., kW = 0.;
  for (int i = 0; i < ${FORMS_MAX}; i++) {
    if (i >= uCount) break;
    if ((gNear & (1 << i)) == 0) continue;
    float d = form(q, i), k = .55 * uForm[i].w;
    if (uLook[i].x > .5) { dW = smin(dW, d, max(kW, k)); kW = k; } else { dB = smin(dB, d, max(kB, k)); kB = k; }
  }
  // The two inks meet: the nearer union shows, its boundary swirled into bands.
  vec2 sw = vec2(cos(uSwirl), sin(uSwirl));
  float band = sin(dot(q.xy, sw) * 38. + 6. * texture(uNoise, q * 2.1 + vec3(0., 0., .02 * uTime)).r);
  gShare = smoothstep(-.006, .006, (dB - dW) + .018 * band);
  float d = smin(dB, dW, .25 * max(kB, kW));
  // A viscous skin: slow warped folds over it (only near it: far off, the bound is enough).
  if (d > .02) return d - .006;
  vec3 w = texture(uNoise, q * 3.3 + vec3(0., 0., .03 * uTime)).rgb;
  return d - .012 * (texture(uNoise, q * 7.5 + w * .9).r - .5);
}
float erosion(vec3 q) {
  float e = 0.;
  for (int i = 0; i < ${FORMS_MAX}; i++) {
    if (i >= uCount) break;
    if ((gNear & (1 << i)) == 0) continue;
    float w = exp(-pow(length(q - uForm[i].xyz) / max(uForm[i].w * 1.6, 1e-4), 2.));
    e = max(e, uLook[i].z * w);
  }
  return e;
}
void main() {
  vec2 xy = gl_FragCoord.xy / uSize.y;
  float zTop = 0., zBottom = 1.;
  bool any = false;
  for (int i = 0; i < ${FORMS_MAX}; i++) {
    if (i >= uCount) break;
    // (Its arms reach far across the view but lie nearly flat in it: the depth to march is the body's.)
    float reach = uForm[i].w * 3.5 + .01, deep = uForm[i].w * 1.6 + .01;
    float rp = length(xy - uForm[i].xy);
    if (rp < reach) {
      armPlane(xy, i);
      // (Outside its body this ray can meet the form only if it passes through an arm.)
      if (rp > uForm[i].w * 1.45 && gArmPlane[i] > gArmThick[i] + .32 * uForm[i].w) continue;
      gNear |= 1 << i; any = true;
      zTop = max(zTop, uForm[i].z + deep); zBottom = min(zBottom, uForm[i].z - deep);
    }
  }
  if (!any) discard;
  float z = min(.92, zTop), d = 1., dMin = 1e3, zMin = z;
  // Toward the far wall, over-relaxed a little (the lobes and skin bend the distance); the nearest the ray
  // came is kept, so a ray that grazes a skin shades a soft edge rather than a hard step.
  for (int i = 0; i < 32; i++) {
    d = field(vec3(xy, z));
    if (d < dMin) { dMin = d; zMin = z; }
    if (d < .0014 || z < zBottom) break;
    z -= max(d * .9, .0016);
  }
  float pixel = 1.6 / uSize.y, edge = 1.;
  if (d > .0026 || z < zBottom) {
    if (dMin > pixel) discard;
    z = zMin; edge = 1. - dMin / pixel;
  }
  vec3 p = vec3(xy, z);
  // Eroding, the skin breaks into holes as the form goes back to mist and motes.
  float ero = erosion(p);
  float holes = texture(uNoise, p * 5.5 + vec3(0., .04 * uTime, 0.)).g + .35 * texture(uNoise, p * 13.).b;
  float a = smoothstep(ero * 1.25 - .1, ero * 1.25 + .1, holes * .9) * edge;
  if (a < .004) discard;
  vec2 e = vec2(.0025, -.0025);
  vec3 n = normalize(e.xyy * field(p + e.xyy) + e.yyx * field(p + e.yyx) + e.yxy * field(p + e.yxy) + e.xxx * field(p + e.xxx));
  field(p);
  float ivory = gShare;
  // Lit from the bright ceiling of the water, reflecting its chamber: wet obsidian, or milky ivory.
  vec3 v = vec3(0., 0., 1.), L = normalize(vec3(-.3, .85, .42)), refl = reflect(-v, n);
  float nv = max(dot(n, v), 0.), fres = .04 + .96 * pow(1. - nv, 5.), nl = dot(n, L);
  vec3 chamber = mix(vec3(.09, .10, .11), vec3(.88, .86, .82), smoothstep(-.3, .9, refl.y)) + vec3(.5, .48, .45) * pow(max(0., dot(refl, normalize(vec3(.35, .8, .45)))), 40.);
  float spec = pow(max(0., dot(refl, L)), 90.) * 1.6 + pow(max(0., dot(refl, normalize(vec3(.55, .5, .67)))), 220.) * 1.2;
  vec3 fl = texture(uNoise, p * 2.2 + vec3(0., .02 * uTime, 0.)).rgb;
  float streak = .5 + .5 * sin(dot(p, vec3(31., 47., 13.)) + 9. * fl.x);
  vec3 black = vec3(.008, .007, .009) * (.4 + .6 * max(nl, 0.)) + (.06 + fres) * chamber * (.75 + .25 * streak) + spec * vec3(.95, .93, .9)
             + vec3(.11, .08, .085) * pow(1. - nv, 2.2);
  float wrap = max((nl + .5) / 1.5, 0.);
  vec3 milk = mix(vec3(.50, .52, .54), vec3(.94, .925, .88), wrap) * (.92 + .08 * streak);
  milk += vec3(.26, .21, .16) * pow(1. - nv, 1.6) + vec3(.06, .05, .04) * fl.y;
  milk *= .88 + .12 * smoothstep(-.4, .8, n.y);
  milk = milk * (1. - .3 * fres) + fres * chamber * .35 + spec * .5;
  vec3 c = mix(black, milk, ivory);
  // Its rims thin to smoke.
  a *= mix(1., smoothstep(.02, .42, nv), .5);
  c *= .82; c = pow(clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.), vec3(1. / 2.2));
  gl_FragDepth = 1. - clamp(z, .01, .98);
  o = vec4(c * a, a);
}`;
// The forms' target laid into the figures', with its depth.
export const INK_FORMS_BLIT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uFormColor, uFormDepth;
uniform vec2 uSize;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 c = texture(uFormColor, uv);
  if (c.a < .004) discard;
  // The colour is drawn up smoothly; its depth is the nearest of the four texels round it, so an edge
  // never takes the empty water's depth and drops out.
  vec2 t = .5 / vec2(textureSize(uFormDepth, 0));
  gl_FragDepth = min(min(texture(uFormDepth, uv + vec2(-t.x, -t.y)).r, texture(uFormDepth, uv + vec2(t.x, -t.y)).r),
                     min(texture(uFormDepth, uv + vec2(-t.x, t.y)).r, texture(uFormDepth, uv + vec2(t.x, t.y)).r));
  o = c;
}`;
