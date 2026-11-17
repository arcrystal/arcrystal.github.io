// Photography → Chess, "ink, unmixed" (unmix-plan.js has the clock and the story; ink-sim.js bakes the
// fluid; board3d.js draws the board). Two parts:
//   UNMIX_SEEN  a pass of its own (transit.js): the ink as the screen sees it now, black (R) and white (G),
//               into a float target that is then mipmapped. Each run's ink is its first picture carried
//               through its flow map (where the water here was at the start): the rain's played forward,
//               the dissolve's backward; the map read smoothly (a cubic B-spline in space, its two nearest
//               keyframes mixed in time). As the ink lands its outline trembles (capillary ripples, dying).
//   groundUnmix the seam's ground (in the scene's shader): the tray of water and its light; the ink as
//               diffused as P has it (its blurred levels: diffusion, then diffusion undone); the light
//               from above through it (what lies toward the light shades a point, shafts where it gets
//               through); black ink absorbing (Beer–Lambert, a little indigo where thin), white ink lit;
//               a pulse of light at the still point; grains catching the light as the ink gathers; and,
//               where the board's ink has landed, the board itself: each piece cured from its foot to its
//               crown (its slot and height from the board's mask), a glint at the front, behind it the
//               board's own picture. Then the water clears to the band's world.
import { UNMIX, SLOTS } from '../unmix-plan.js';
import { MARGIN } from '../staunton.js';

const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(5)));
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;

export const UNMIX_SEEN = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform vec2 uTexel;            // the target, px
uniform sampler2DArray uKeys1;  // the rain's map, its keyframes
uniform sampler2DArray uKeys2;  // the dissolve's
uniform sampler2D uDye1, uDye2; // their first pictures
uniform vec2 uN;                // keyframes in each
uniform vec2 uK;                // where each is now, in keyframes
uniform vec2 uW;                // how much of each shows
uniform float uAbove;           // the rain's grid reaches this share of the screen above it
uniform vec2 uTremble;          // the outline's trembling: how much (domain units), its time
out vec4 o;
// A keyframe's way back at uv, read with a cubic B-spline (four bilinear reads).
vec2 key(sampler2DArray t, vec2 uv, float l) {
  vec2 n = vec2(textureSize(t, 0).xy), p = uv * n - .5, f = fract(p), i = p - f, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i + w1 / g0 - .5) / n, b = (i + w3 / g1 + 1.5) / n;
  return g0.y * (g0.x * texture(t, vec3(a, l)).xy + g1.x * texture(t, vec3(b.x, a.y, l)).xy)
       + g1.y * (g0.x * texture(t, vec3(a.x, b.y, l)).xy + g1.x * texture(t, vec3(b, l)).xy);
}
vec2 mapAt(sampler2DArray t, vec2 uv, float k, float n) {
  float l0 = clamp(floor(k), 0.0, n - 1.0), l1 = min(l0 + 1.0, n - 1.0);
  return mix(key(t, uv, l0), key(t, uv, l1), clamp(k - l0, 0.0, 1.0));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uTexel, ink = vec2(0.0);
  if (uW.x > 0.0) {
    vec2 u1 = vec2(uv.x, uv.y / (1.0 + uAbove));
    ink += uW.x * texture(uDye1, u1 + mapAt(uKeys1, u1, uK.x, uN.x)).xy;
  }
  if (uW.y > 0.0) {
    vec2 m = uv + mapAt(uKeys2, uv, uK.y, uN.y);
    m += uTremble.x * vec2(sin(m.y * 95.0 + uTremble.y * 9.0) + .5 * sin(m.x * 61.0 - uTremble.y * 13.0), cos(m.x * 83.0 - uTremble.y * 7.0) + .5 * cos(m.y * 57.0 + uTremble.y * 11.0));
    ink += uW.y * texture(uDye2, m).xy;
  }
  o = vec4(ink, 0.0, 1.0);
}`;

export const UNMIX_GLSL = /* glsl */ `
uniform sampler2D uB3;       // Chess's board in three dimensions (board3d.js): its box, a margin round it (unit 11)
uniform sampler2D uB3Mask;   // its ink over the screen: pigment (R, G), which piece (B: slot + 1 over 64, the board 1), how high (A) (unit 12)
uniform vec4 uB3Box;         // the board's box on the screen (CSS px)
uniform float uB3On;
const vec2 UM_WATER = ${v2(UNMIX.water)}, UM_LIGHT = ${v2(UNMIX.light)}, UM_DIFFUSE = ${v2(UNMIX.diffuse)}, UM_FOCUS = ${v2(UNMIX.focus)};
const vec2 UM_PULSE = ${v2(UNMIX.pulse)}, UM_UNMIX = ${v2(UNMIX.unmix)}, UM_HARDEN = ${v2(UNMIX.harden)}, UM_SQUARES = ${v2(UNMIX.squares)}, UM_CLEAR = ${v2(UNMIX.clear)};
const float UM_SPAN = ${f(UNMIX.span)}, UM_LODMAX = ${f(UNMIX.lodMax)}, UM_MARGIN = ${f(MARGIN)};
const float UM_ORDER[32] = float[32](${SLOTS.map(s => f(s.order)).join(', ')});
const float UM_TALL[32] = float[32](${SLOTS.map(s => f(s.tall)).join(', ')});
float umS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }
float umLod(float P) { return UM_LODMAX * umS(UM_DIFFUSE, P) * (1.0 - umS(UM_FOCUS, P)); }
// The ink at a level of its mipmaps, read smoothly (a cubic B-spline at the two nearest levels, mixed):
// diffused, it stays a haze rather than showing its texels.
vec2 umLevel(vec2 uv, float l) {
  vec2 n = vec2(textureSize(uFlow, int(l))), p = uv * n - .5, f = fract(p), i = p - f, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i + w1 / g0 - .5) / n, b = (i + w3 / g1 + 1.5) / n;
  return g0.y * (g0.x * textureLod(uFlow, a, l).rg + g1.x * textureLod(uFlow, vec2(b.x, a.y), l).rg)
       + g1.y * (g0.x * textureLod(uFlow, vec2(a.x, b.y), l).rg + g1.x * textureLod(uFlow, b, l).rg);
}
vec2 umSoft(vec2 uv, float lod) { float l0 = floor(lod); return mix(umLevel(uv, l0), umLevel(uv, l0 + 1.0), lod - l0); }
// The board's picture at screen point px (premultiplied).
vec4 umBoard(vec2 px) {
  vec2 t = ((px - uB3Box.xy) / uB3Box.zw + UM_MARGIN) / (1.0 + 2.0 * UM_MARGIN);
  return texture(uB3, vec2(t.x, 1.0 - t.y));
}
// The board where its ink has landed, cured into the board itself at P: the squares outward from the
// middle (a ring of light at the front), then each piece from its foot to its crown (its slot and height
// from the board's mask at screen uv), a glint at its front. Outside the board, as the world comes (clear),
// the board's shadow on it.
vec3 umCure(vec3 col, vec2 q, vec2 px, vec2 uv, float P, float clear) {
  vec4 bd = umBoard(px);
  vec4 mk = texelFetch(uB3Mask, ivec2(uv * vec2(textureSize(uB3Mask, 0))), 0);
  vec2 bc = uB3Box.xy + .5 * uB3Box.zw;
  float cured = 0.0, glint = 0.0;
  if (mk.b > .99) {
    float r = length((q - bc) / uB3Box.zw) * 1.6, t = umS(UM_SQUARES, P) * 1.15;
    cured = smoothstep(-.05, .05, t - r);
    glint = exp(-pow((r - t) / .02, 2.0)) * step(.001, t) * step(t, 1.14);
  } else if (mk.b > .5 / 64.0) {
    int s = clamp(int(mk.b * 64.0 + .5) - 1, 0, 31);
    float t = clamp((P - (UM_HARDEN.x + UM_ORDER[s] * (UM_HARDEN.y - UM_HARDEN.x - UM_SPAN))) / UM_SPAN, 0.0, 1.0);
    float y = mk.a * 1.5, fy = t * (UM_TALL[s] + .08);
    cured = smoothstep(-.015, .015, fy - y);
    glint = exp(-pow((y - fy) / .014, 2.0)) * step(.001, t) * step(t, .999);
  } else col *= 1.0 - .6 * bd.a * clear;
  col = mix(col, bd.rgb + col * (1.0 - bd.a), cured);
  return col + vec3(1.0, .96, .88) * glint * (.8 + .6 * hash(floor(q * .5) + floor(P * 200.0)));
}
vec3 groundUnmix(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  if (P <= UM_WATER.x || uIceReady < .5) return P < .5 ? sceneDarkroom(px) : sceneInk(px);
  float m = min(S.x, S.y);
  vec2 h = .5 * S / m, z = (q - .5 * S) / m;
  float lit = umS(UM_LIGHT, P), clear = umS(UM_CLEAR, P);
  float level = S.y * (1.06 - 1.14 * umS(UM_WATER, P)) + 5.0 * sin(q.x * .013 + T * 1.1) + 3.0 * sin(q.x * .031 - T * 1.6);
  if (q.y < level - 6.0) return sceneDarkroom(px);
  vec2 uv = vec2(q.x / S.x, 1.0 - q.y / S.y);
  // The ink, as diffused as P has it.
  float lod = umLod(P);
  vec2 ink = lod < .02 ? pmSeen(uv) : umSoft(uv, lod);
  // The light from above, through the ink: what lies toward it shades this point; shafts where it gets through.
  float sh = 0.0;
  for (int i = 1; i <= 7; i++) { vec2 r = textureLod(uFlow, uv + vec2(-.008, .05) * float(i), 2.5 + .3 * float(i)).rg; sh += (r.x + .35 * r.y) * (1.0 - float(i) / 8.0); }
  float shade = exp(-.55 * sh);
  vec3 col = pmWater(z, h, lit) * mix(.42, 1.0, shade);
  float shaft = noise(vec2(z.x * 5.0 - z.y * .8, T * .04)) * noise(vec2(z.x * 11.0 - z.y * 1.7 + 4.0, T * .03));
  col += vec3(.16, .165, .17) * lit * shaft * shade * (1.0 - clear);
  // The still point: a pulse of light from where the board will be.
  vec2 bc = uB3Box.xy + .5 * uB3Box.zw;
  float pr = length(q - bc) / m, pp = umS(UM_PULSE, P), pw = pp * (1.0 - pp) * 4.0;
  col += vec3(.75, .78, .86) * exp(-pow((pr - pp * 1.3) / .07, 2.0)) * pw * .6 + vec3(.3, .31, .33) * exp(-pr * 2.5) * pw;
  // Black takes the light out (where thin it lets a little indigo through); white is lit pigment.
  float light = lit * shade * (.35 + .65 * exp(-pow(length(vec2(z.x * .5, z.y + h.y * 1.2)) / 1.3, 2.0)));
  // (Diffused, the same ink spreads over more water: thicker for it, a cloud rather than a stain.)
  float thick = 1.0 + 1.6 * smoothstep(.5, 4.0, lod);
  float B = ink.x * 2.3 * thick, W = ink.y * 2.0 * thick;
  col *= exp(-B * vec3(1.08, 1.0, .82));
  col = mix(col, PM_INK * .5, (1.0 - exp(-1.4 * B)) * .55);
  col = mix(col, PM_PEARL * (.2 + .9 * light), 1.0 - exp(-W));
  col += PM_PEARL * .1 * smoothstep(.2, 1.5, W) * light;
  // Grains of pigment catching the light as the ink gathers.
  float um = umS(vec2(UM_UNMIX.x, UM_UNMIX.x + .06), P) * (1.0 - umS(vec2(UM_HARDEN.x, UM_HARDEN.x + .08), P));
  if (um > 0.0) {
    vec2 g = q * .22, id = floor(g);
    float hs = hash(id), tw = pow(max(0.0, sin(P * 70.0 + hs * 6.283)), 24.0) * step(.82, hs);
    col += vec3(1.0, .97, .9) * tw * um * smoothstep(.15, .6, ink.x + ink.y) * exp(-pow(length(fract(g) - .5) / .08, 2.0));
  }
  // The band's world, as the water clears.
  col = mix(col, sceneInk(px), clear);
  // The board: where its ink has landed, cured into the board itself.
  if (uB3On > .5) col = umCure(col, q, px, uv, P, clear);
  // The tray's surface, while it is on screen.
  col += vec3(.75, .76, .8) * exp(-pow((q.y - level) / 3.0, 2.0)) * .5 * (.4 + .6 * lit);
  return mix(col, sceneDarkroom(px), smoothstep(level + 6.0, level - 6.0, q.y));
}

// ---- A click into Chess (opens.js) -------------------------------------------------------------------
// The same story at the click, in two and a half seconds: black and white ink bloom out from it over the
// old page as one front rolling up into mushroom pairs (glsl/plume.js pmcBack), over lit water; as the
// bloom covers the screen, the same board the scroll builds cures in where it stands (its squares from the
// middle, then each piece from its foot); the water clears to Chess's world. On the new page (umClickReveal)
// the board soaks into it, from its middle out. E: the cover's clock (0 … 1.04); a: how much it covers.
vec4 umClickLook(vec2 px, vec2 O, float far, float E, float relax) {
  float front = far * (.04 + 1.02 * smoothstep(0.0, .5, E));
  vec2 X = pmcBack(px, O, front, E);
  float rX = length(X - O), dye = smoothstep(front + 5.0, front - 5.0, rX);
  float a = max(dye, smoothstep(.55, .8, E));
  vec2 wq = (X - O) * .0045;
  wq += (vec2(fbm3(wq * 1.6 + 2.0), fbm3(wq * 1.6 + 7.3)) - .5) * 1.6;
  float white = smoothstep(.42, .58, fbm3(wq + 11.0)), billow = smoothstep(.3, .75, fbm3(wq * 1.8 + 4.0));
  float dens = dye * ((.25 + .9 * billow) * (.45 + .55 * smoothstep(.1, 1.0, rX / max(front, 1.0))) + 1.3 * exp(-pow((rX - front * .94) / (front * .05 + 3.0), 2.0)));
  // The ink diffuses, then lets go of the board's place.
  dens *= 1.0 - .75 * smoothstep(.5, .85, E);
  float m = min(R.x, R.y), clear = smoothstep(.82, 1.04, E);
  vec3 col = pmWater((px - R * .5) / m, R * .5 / m, 1.0);
  float B = dens * (1.0 - white) * 2.0, W = dens * white * 1.8;
  col *= exp(-B * vec3(1.08, 1.0, .82));
  col = mix(col, PM_INK * .5, (1.0 - exp(-1.4 * B)) * .55);
  col = mix(col, PM_PEARL, 1.0 - exp(-W));
  col = mix(col, sceneOf(1, px), clear);
  if (uB3On > .5) {
    vec2 uv = vec2(px.x / R.x, 1.0 - px.y / R.y);
    // (the cure on the scroll's own clock, from its start to its end)
    float P = mix(UM_SQUARES.x - .01, UM_HARDEN.y, smoothstep(.45, 1.0, E));
    col = umCure(col, px, px, uv, P, clear);
    // On the new page: the board soaks in, from its middle out, and is gone.
    vec2 bc = uB3Box.xy + .5 * uB3Box.zw;
    float r = length((px - bc) / uB3Box.zw), go = smoothstep(r * .6, r * .6 + .4, relax);
    col = mix(col, sceneOf(1, px), go);
  }
  return vec4(col, a);
}
vec4 umClickCover(vec2 px, vec2 O, float far, float E) { vec4 l = umClickLook(px, O, far, E, 0.0); return vec4(l.rgb * l.a, l.a); }
vec3 umClickReveal(vec2 px, vec2 O, float far, float e) { return umClickLook(px, O, far, 1.04, e).rgb; }
`;