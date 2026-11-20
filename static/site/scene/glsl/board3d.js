// Chess in three dimensions (scene/board3d.js runs it; staunton.js gives the shapes and the camera). One
// sample per pixel per pass, jittered within the pixel; board3d.js averages the passes while nothing moves.
//   The pieces are distances: each turned piece is its profile's distance at (|xz|, y) (unit 0, a layer a
// type), the knight's head its silhouette's distance drawn out to a thickness (unit 1), with the details
// the profiles cannot hold added as primitives. A ray walks the board square by square (a 2D DDA) and in
// each square marches only the piece standing on it, never past the square's far side: no piece reaches
// out of its square, so this is the whole scene's distance at one evaluation a step. Pieces between
// squares (gliding, leaping) are marched on their own, inside their bounding cylinders.
//   Light: a key from the front left (soft shadows marched the same way), the sky and a broad softbox as
// the environment, a cool rim from behind. Black pieces are obsidian (GGX specular, a clear coat, Fresnel
// reflections of the environment); white are pearl-ivory (wrapped diffuse for the light that passes into
// the surface and out, a soft sheen); the board is lacquered paper and ink wash, reflecting the pieces
// once; its frame is ink with an indigo inlay. Output is premultiplied sRGB over the page: where there is
// no board, only the board's shadow.
//   uMode 1: the picture's ink instead (black and white pigment: R, G), for the fluid that dissolves it.
import { PROF, HEAD, DETAIL, BOARD, TALL } from '../staunton.js';

const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(6)));
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;

export const PIECE_SHAPES = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform vec2 uSize;          // the target, px
uniform vec2 uJit;           // this sample's place in its pixel (px, -.5 … .5)
uniform vec3 uEye, uRight, uUp, uFwd;
uniform vec2 uTan;           // tan(fov / 2) across (× aspect) and up
uniform vec4 uView;          // the target's place on the box's view: −1 … 1 across the target → × xy + zw
uniform vec4 uP[32];         // a piece: x, z, code (type + 8 if black; < 0 gone), lift
uniform vec4 uQ[32];         // its melt (0 … 1 melting, 1 … 2 its pool soaking away), its spin
uniform int uOcc[64];        // the piece standing on each square (file + 8 × row, row 0 the far rank), −1 none
uniform int uLoose[6];       // pieces off their squares, marched on their own
uniform int uNLoose;
uniform vec4 uMarks;         // the last move: from (file, row), to (file, row); x < 0: none
uniform vec2 uMarkAge;       // its wash (0 … 1) and its drop of ink's age (0 … 1)
uniform int uMode;
uniform sampler2DArray uProf;
uniform sampler2D uHead;
layout(location = 0) out vec4 o;

const float PI = 3.14159265;
const float PC = ${f(PROF.cell)}, PY0 = ${f(PROF.y0)};
const vec2 PEXT = vec2(${f(PROF.w * PROF.cell)}, ${f(PROF.h * PROF.cell)});
const vec2 HEXT = vec2(${f(HEAD.w * HEAD.cell)}, ${f(HEAD.h * HEAD.cell)});
const float HX0 = ${f(HEAD.x0)};
const float HALF = ${f(BOARD.half)}, FRAME = ${f(BOARD.half + BOARD.frame)}, SLAB = ${f(BOARD.slab)};
const float HTOP = ${f(BOARD.top + 0.04)}, LIFT = .7;
const vec3 LKEY = normalize(vec3(-.46, .8, .44));
const vec3 KEY = vec3(1.0, .965, .91) * 1.75;
const vec3 RIMD = normalize(vec3(.55, .35, -.76));
const vec3 RIM = vec3(.62, .72, 1.0) * .9;
const float TALLS[6] = float[6](${['K','Q','B','N','R','P'].map(k => f(TALL[k])).join(', ')});

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= .5; } return s; }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }

// ---- the pieces ---------------------------------------------------------------------------------------
// A turned profile's distance at (r, y): its field, and outside the field's box the way out to it.
float prof(float L, vec2 ry) {
  vec2 uv = vec2(ry.x, ry.y - PY0) / PEXT, c = clamp(uv, 0.0, 1.0);
  return texture(uProf, vec3(c, L)).r + length((uv - c) * PEXT);
}
// About the axis, into one of n sectors: (along the sector's middle, across it).
vec2 sector(vec2 xz, float n) {
  float a = atan(xz.y, xz.x), s = 2.0 * PI / n;
  a = mod(a + .5 * s, s) - .5 * s;
  return length(xz) * vec2(cos(a), sin(a));
}
// A shallow spiral in the stem reads as a broad fold in the wet ink. Its
// ends meet the lathed collars with zero displacement and zero slope.
const vec2 STEMS[6] = vec2[6](${['K', 'Q', 'B', 'N', 'R', 'P'].map(k => v2(DETAIL.stem[k] ?? [0, 0])).join(', ')});
vec2 stemSection(int type, vec3 q, vec2 ry) {
  vec2 st = STEMS[type];
  if (type == 3 || q.y <= st.x || q.y >= st.y || ry.x < .04) return ry;
  float t = (q.y - st.x) / (st.y - st.x);
  float twist = .20 - 1.08 * t;
  vec2 axis = vec2(cos(twist), sin(twist));
  float u = dot(q.xz, axis) / ry.x;
  float folds = u * (4.0 * u * u - 3.0);
  float waist = 4.0 * t * (1.0 - t);
  ry.x += .014 * waist * waist * folds;
  return ry;
}
// An isosceles trapezoid along y (half-widths r1 at y = −he, r2 at y = he): its distance (Quílez).
float sdTrap(vec2 p, float r1, float r2, float he) {
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
// A plane figure drawn out to a half-thickness, its arrises rounded by r.
float extrude(float d2, float z, float thick, float r) {
  vec2 w = vec2(d2, abs(z) - thick) + r;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;
}
const float CROSS[9] = float[9](${DETAIL.cross.map(f).join(', ')});
const float TINES[5] = float[5](${DETAIL.tines.map(f).join(', ')});
const vec4 SLIT = vec4(${DETAIL.slit.slice(0, 4).map(f).join(', ')});
const float SLIT_W = ${f(DETAIL.slit[4])};
const vec3 CRENEL = vec3(${DETAIL.crenel.map(f).join(', ')});
float shape(int type, vec3 q) {
  vec2 ry = vec2(length(q.xz), q.y);
  if (type == 3) {
    float base = prof(3.0, ry);
    vec2 uv = vec2(q.x - HX0, q.y - PY0) / HEXT, c = clamp(uv, 0.0, 1.0);
    vec2 section = texture(uHead, c).rg;
    float d2 = section.x + length((uv - c) * HEXT);
    // The carved relief (the study's outline inflated, its fine ink cut in) gives the half-thickness;
    // a broad bevel rolls over every edge of it.
    float bevel = min(.06, section.y * .8);
    float head = extrude(d2, q.z, section.y, bevel);
    return smin(base, head * .86, .03);
  }
  float d = prof(float(type), stemSection(type, q, ry));
  if (type == 0) {
    // The cross pattée: an upright flaring to its top and foot, two arms flaring to their ends.
    float cy = CROSS[0], L = CROSS[1], hm = CROSS[2], he = CROSS[3], top = CROSS[4], wt = CROSS[5], wn = CROSS[6], ft = CROSS[7];
    float up = sdTrap(vec2(q.x, q.y - .5 * (cy + top)), wn, wt, .5 * (top - cy));
    float down = sdTrap(vec2(q.x, q.y - .5 * (ft + cy)), wt * .92, wn, .5 * (cy - ft));
    float arms = sdTrap(vec2(q.y - cy, abs(q.x) - .5 * L), hm, he, .5 * L);
    float cross = extrude(min(min(up, down), arms), q.z, CROSS[8], .009);
    return smin(d, cross, .012);
  }
  if (type == 1) {
    // Eight tines leave the cup's rim, splaying out to their pearls; the middle spike is turned.
    vec2 s = sector(q.xz, 8.0);
    vec3 a = vec3(TINES[3] * .9, TINES[4] - .012, 0.0), b = vec3(TINES[0], TINES[1], 0.0);
    vec3 p = vec3(s.x, q.y, s.y), ab = b - a;
    float k = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    float finger = length(p - a - k * ab) - mix(.024, .011, k);
    float pearl = length(p - b) - TINES[2];
    return smin(d, smin(finger, pearl, .008), .014);
  }
  if (type == 2) {
    // The slit across the mitre, measured on the study: deeper at its upper end, cut from the front.
    vec2 A = SLIT.xy, B = SLIT.zw, t = normalize(B - A), n = vec2(-t.y, t.x);
    float along = dot(q.xy - A, t), len = length(B - A);
    float wedge = max(abs(dot(q.xy - A, n)) - SLIT_W * (.35 + .5 * clamp(along / len, 0.0, 1.0)), max(-along, along - len));
    // The front lip is beveled around the diagonal cut so the recessed
    // wall and the outer lip catch opposite values of the same key light.
    return -smin(-d, max(wedge, -q.z - .047), .011);
  }
  if (type == 4) {
    // The rook's top: hollowed inside its merlons, cut between them.
    float top = ${f(TALL.R)};
    d = -smin(-d, max(ry.x - CRENEL.z * .74, top - CRENEL.x * .8 - q.y), .012);
    vec2 s = sector(q.xz, 6.0);
    float slot = max(abs(s.y) - .5 * CRENEL.y, top - CRENEL.x - q.y);
    return -smin(-d, slot, .012);
  }
  return d;
}
`;

export const PIECE_ENV = /* glsl */ `
vec3 roomEnv(vec3 d) {
  vec3 sky = mix(vec3(.42, .4, .37), vec3(.95, .92, .87), smoothstep(-.05, .85, d.y));
  vec3 c = mix(vec3(.05, .046, .042), sky, smoothstep(-.3, .06, d.y));
  vec2 s = d.xz / max(d.y, .08) - vec2(-.42, .34);
  c += vec3(3.4, 3.3, 3.1) * smoothstep(.62, .42, max(abs(s.x) * .8, abs(s.y))) * step(0.0, d.y);
  c += vec3(.62, .72, 1.0) * .63 * smoothstep(.16, 0.0, abs(d.y - .22)) * smoothstep(-.1, -.7, d.z);
  return c;
}
`;

export const PIECE_MATERIAL = PIECE_ENV + /* glsl */ `
vec3 env(vec3 d) { return roomEnv(d); }
// The ink each piece was made of, suspended under its lacquer: its own study (living-ink.js), registered
// to the solid by height and across its face (ink-registration.js). gInk: the study's transmission at the
// point being shaded and a little toward the light, or < 0 for the plain grain.
uniform sampler2D uRegistration, uKnightPigment, uFigurePigment;
uniform float uStudies;
vec2 gInk = vec2(-1.0);
// A study's coordinates for model point q of a piece of this type, at y (0 … 1 of its height). variant: the
// pawns alternate two studies; yaw: the study's facing about the piece's axis.
vec2 studyUV(int type, float variant, float yaw, vec3 q, float y, out vec2 towardLight) {
  float rank = float(type);
  if (type == 5) rank += mod(floor(variant * .5), 2.0);
  vec2 dims = vec2(textureSize(uRegistration, 0));
  vec2 uv = (vec2(.5 + clamp(y, 0.0, 1.0) * (dims.x - 1.0), 2.0 * rank + .5)) / dims;
  vec4 section = textureLod(uRegistration, uv, 0.0);
  float v = textureLod(uRegistration, uv + vec2(0.0, 1.0 / dims.y), 0.0).r;
  float across = type == 3 ? q.x : dot(q.xz, vec2(cos(yaw), sin(yaw)));
  float x = mix(section.z, section.w, clamp((across - section.x) / max(.02, section.y - section.x), 0.0, 1.0));
  vec2 tissue = clamp(vec2(x, v), .002, .998);
  towardLight = vec2(-.003, -.004);
  if (type == 3) return tissue;
  float cell = rank - (rank > 3.0 ? 1.0 : 0.0);
  vec2 grid = vec2(3, 2);
  towardLight /= grid;
  return (vec2(mod(cell, 3.0), floor(cell / 3.0)) + tissue) / grid;
}
vec2 studyInk(int type, float variant, float yaw, vec3 q, float tall) {
  vec2 off, uv = studyUV(type, variant, yaw, q, q.y / tall, off);
  return type == 3 ? vec2(textureLod(uKnightPigment, uv, 1.0).r, textureLod(uKnightPigment, uv + off, 1.0).r)
                   : vec2(textureLod(uFigurePigment, uv, 1.0).r, textureLod(uFigurePigment, uv + off, 1.0).r);
}
float ggx(float nh, float a) { float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float vis(float nv, float nl, float a) { float k = a * .5; return .25 / ((nv * (1.0 - k) + k) * (nl * (1.0 - k) + k)); }
vec3 fres(vec3 f0, float c) { return f0 + (1.0 - f0) * pow(1.0 - c, 5.0); }
// A glossy surface's light from one lamp.
vec3 lamp(vec3 n, vec3 v, vec3 l, vec3 col, vec3 f0, float a) {
  vec3 h = normalize(l + v);
  float nl = max(dot(n, l), 0.0), nv = max(dot(n, v), 1e-3);
  return col * nl * ggx(max(dot(n, h), 0.0), a) * vis(nv, nl, a) * fres(f0, max(dot(h, v), 0.0));
}
vec3 finishPiece(bool black, vec3 p, vec3 n, vec3 v, float sun, float ao, float m) {
  float nv = max(dot(n, v), 0.0), nl = dot(n, LKEY);
  vec3 r = reflect(-v, n), amb = mix(vec3(.12, .11, .1), vec3(.62, .6, .57), .5 + .5 * n.y);
  // Obsidian.
  // Broad coalesced pigment and narrow folded membranes remain visible
  // beneath the varnish. The noise is sampled in the piece's own frame;
  // the grain travels with a turning horse or a pawn on its way to e4.
  vec2 flow = vec2(p.x + .58*p.z, p.y - .32*p.z);
  float fold = noise(flow*5.7 + vec2(.8,-.5));
  float stream = 16.0*flow.x - 6.7*flow.y + 8.5*fold + 1.4*sin(8.0*flow.y-.6);
  float channel = .5+.5*sin(stream);
  float fibre = smoothstep(.66,.98,channel) * (.42+.58*fold);
  if (gInk.x >= 0.0) {
    // The study's own veils and folds: clear windows read lighter through the lacquer, dense folds
    // darker, a fold's lit edge as a fibre.
    fold = mix(fold, .12 + .95 * gInk.x, .8);
    fibre = mix(fibre, smoothstep(.015, .22, gInk.y - gInk.x) + .35 * smoothstep(.5, .1, gInk.x), .75);
  }
  vec3 F = fres(vec3(.048), nv);
  vec3 soot = mix(vec3(.019,.018,.021), vec3(.062,.056,.057), .27*fold+.68*fibre);
  vec3 dark = soot * (amb * ao + KEY * max(nl, 0.0) * sun);
  float window = smoothstep(-.50,.84, dot(r,normalize(vec3(-.76,.24,.50))));
  dark += F * (env(r)*.77 + window*vec3(.36,.32,.29)) * mix(.35, 1.0, ao);
  dark += lamp(n, v, LKEY, KEY, vec3(.043), .21) * sun + lamp(n, v, RIMD, RIM, vec3(.043), .245);
  dark += vec3(.05, .07, .12) * pow(1.0 - nv, 3.0) * .6;   // (an indigo sheen at its edges)
  // A piece being taken is wet with ink where it goes into the board, a band that climbs it as it sinks.
  float ink = m > 0.0 ? smoothstep(.22 + .1 * m, .02, p.y) : 0.0;
  vec3 wet = vec3(.004, .0042, .005) * (amb * ao + KEY * max(nl, 0.0) * sun) + F * env(r) * mix(.35, 1.0, ao) + lamp(n, v, LKEY, KEY, vec3(.04), .06) * sun * 1.4;
  if (black) return mix(dark, wet, ink * .6);
  // Pearl-ivory.
  vec3 alb = mix(vec3(.56,.455,.335), vec3(.83,.735,.581), .23+.48*fold+.28*fibre);
  float wrap = max((nl + .26) / 1.26, 0.0);
  vec3 c = alb * (amb * ao * .5 + KEY * wrap * mix(.2, 1.0, sun));
  // (Light carried into the surface comes out warmer where it is thin: the silhouette's edge.)
  c += alb * vec3(1.0, .82, .6) * KEY * .12 * pow(1.0 - nv, 2.0) * max(-nl + .3, 0.0);
  vec3 Fi = fres(vec3(.04), nv);
  c += Fi * env(r) * .45 * ao + lamp(n, v, LKEY, KEY, vec3(.04), .32) * sun + lamp(n, v, RIMD, RIM, vec3(.04), .3);
  return mix(c, wet, ink);
}
`;

export const BOARD3D_FS = PIECE_SHAPES + /* glsl */ `
// What the pixel sees, for the water draining off the board (glsl/unmix.js umSeen): its world y and z.
// Averaged over the passes like the picture, so the waterline across a piece is smooth at its edge.
layout(location = 1) out vec4 g;
// A piece in place: its own frame (lifted, turned), and melted: sinking and spreading into a pool of ink,
// then the pool soaking away.
float piece(int s, vec3 p) {
  vec4 a = uP[s], b = uQ[s];
  vec3 q = p - vec3(a.x, a.w, a.y);
  float cs = cos(b.y), sn = sin(b.y);
  q.xz = mat2(cs, sn, -sn, cs) * q.xz;
  int type = int(mod(a.z, 8.0));
  float m = b.x;
  if (m <= 0.0) return shape(type, q);
  // Taken: it sinks into the board as into ink (what is under the board's face is not seen), a thin
  // meniscus of ink round it where it goes in; then (melt 1 … 2) the board drinks the stain it leaves.
  if (m >= 1.0) return 1e3;
  float tall = TALLS[type];
  vec3 qs = q + vec3(0.0, m * tall * 1.04, 0.0);
  float d = shape(type, qs);
  float R = .36 * (1.0 - .6 * m) + .02, t = .012 * sin(3.14159 * min(m * 3.0, 1.0)) + .001;
  float men = (length(vec3(q.x / R, q.y / t, q.z / R)) - 1.0) * t;
  return smin(d, men, .03);
}
// The piece standing on square c (file, row), or −1.
int standing(ivec2 c) {
  if(c.x<0 || c.y<0 || c.x>7 || c.y>7) return -1;
  return uOcc[c.x+8*c.y];
}

// ---- walking the board ------------------------------------------------------------------------------
// The ray's span inside the slab of space the pieces stand in.
vec2 slab(vec3 ro, vec3 rd, float hTop) {
  vec3 lo = vec3(-HALF, 0.0, -HALF), hi = vec3(HALF, hTop, HALF);
  vec3 inv = 1.0 / rd, a = (lo - ro) * inv, b = (hi - ro) * inv;
  vec3 mn = min(a, b), mx = max(a, b);
  return vec2(max(max(mn.x, mn.y), max(mn.z, 0.0)), min(min(mx.x, mx.y), mx.z));
}
// A hit found by stepping can lie a little inside the surface (a step over-reached): bisect back to it
// between the last point outside (a) and the first not (b).
float settle(int s, vec3 ro, vec3 rd, float a, float b) {
  for (int i = 0; i < 6; i++) { float m = .5 * (a + b); if (piece(s, ro + rd * m) > 0.0) a = m; else b = m; }
  return .5 * (a + b);
}
// The nearest piece standing on its square along the ray (t, slot), or t = 1e9. soft: also the shadow's
// softness seen on the way (k·d/t at its smallest), for a ray toward the light.
vec2 walk(vec3 ro, vec3 rd, float tMax, bool shadow, inout float soft) {
  vec2 span = slab(ro, rd, HTOP);
  span.y = min(span.y, tMax);
  if (span.x >= span.y) return vec2(1e9, -1.0);
  vec3 p0 = ro + rd * span.x;
  ivec2 c = clamp(ivec2(floor(p0.xz + HALF)), ivec2(0), ivec2(7));
  vec2 dir = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
  vec2 inv = 1.0 / max(abs(rd.xz), vec2(1e-5));
  vec2 edge = vec2(c) - HALF + max(dir, 0.0);
  vec2 tn = span.x + abs(edge - p0.xz) * inv;
  float t = span.x;
  for (int n = 0; n < 16; n++) {
    float tExit = min(min(tn.x, tn.y), span.y);
    int s = standing(c);
    if (s >= 0) {
      float tl = t;
      for (int k = 0; k < 40; k++) {
        float d = piece(s, ro + rd * t);
        if (shadow && t > .03) soft = min(soft, 9.0 * d / t);
        if (d < .00025 * t + .0004) return vec2(d < 0.0 && !shadow ? settle(s, ro, rd, tl, t) : t, float(s));
        tl = t;
        t += shadow ? clamp(d, .006, .2) : d;
        if (t > tExit) break;
      }
    }
    if (tExit >= span.y) break;
    t = tExit;
    if (tn.x < tn.y) { c.x += int(dir.x); tn.x += inv.x; } else { c.y += int(dir.y); tn.y += inv.y; }
    if (c.x < 0 || c.y < 0 || c.x > 7 || c.y > 7) break;
  }
  return vec2(1e9, -1.0);
}
// The pieces off their squares, each inside its bounding cylinder.
vec2 loose(vec3 ro, vec3 rd, float tMax, bool shadow, inout float soft) {
  vec2 best = vec2(1e9, -1.0);
  for (int i = 0; i < 6; i++) {
    if (i >= uNLoose) break;
    int s = uLoose[i];
    vec4 a = uP[s];
    vec2 oc = ro.xz - a.xy;
    float A = dot(rd.xz, rd.xz), B = dot(oc, rd.xz), C = dot(oc, oc) - .44 * .44, h = B * B - A * C;
    if (h < 0.0 || A < 1e-8) continue;
    h = sqrt(h);
    float t0 = max((-B - h) / A, 0.0), t1 = min((-B + h) / A, tMax);
    // (and between its foot and the top of its leap)
    float y0 = a.w - .02, y1 = a.w + HTOP;
    if (abs(rd.y) > 1e-5) {
      float ta = (y0 - ro.y) / rd.y, tb = (y1 - ro.y) / rd.y;
      t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb));
    }
    float t = t0, tl = t0;
    for (int k = 0; k < 48; k++) {
      if (t > t1 || t > best.x) break;
      float d = piece(s, ro + rd * t);
      if (shadow && t > .03) soft = min(soft, 9.0 * d / t);
      if (d < .00025 * t + .0004) { best = vec2(d < 0.0 && !shadow ? settle(s, ro, rd, tl, t) : t, float(s)); break; }
      tl = t;
      t += shadow ? clamp(d, .006, .2) : d;
    }
  }
  return best;
}
vec2 pieces(vec3 ro, vec3 rd, float tMax) {
  float soft = 1.0;
  vec2 a = walk(ro, rd, tMax, false, soft), b = loose(ro, rd, min(tMax, a.x), false, soft);
  return b.x < a.x ? b : a;
}
// How much of the key light reaches p (soft).
float sunlit(vec3 p) {
  float soft = 1.0;
  vec2 a = walk(p, LKEY, 6.0, true, soft);
  if (a.x < 1e8) return 0.0;
  vec2 b = loose(p, LKEY, 6.0, true, soft);
  if (b.x < 1e8) return 0.0;
  return clamp(soft, 0.0, 1.0);
}
float sceneAt(vec3 p) {
  int s = standing(ivec2(floor(p.xz + HALF)));
  float d = s >= 0 ? piece(s, p) : 1e3;
  for (int i = 0; i < 6; i++) { if (i >= uNLoose) break; d = min(d, piece(uLoose[i], p)); }
  return d;
}
vec3 normalOf(int s, vec3 p) {
  // (Wider than a row of the fields, so their cells do not ripple it; narrow enough for the tines.)
  vec2 e = vec2(.0035, -.0035);
  return normalize(e.xyy * piece(s, p + e.xyy) + e.yyx * piece(s, p + e.yyx) + e.yxy * piece(s, p + e.yxy) + e.xxx * piece(s, p + e.xxx));
}
// Light lost near other surfaces (pieces, and the board under them).
float occlusion(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = .025 * float(i * i);
    o += w * (h - min(sceneAt(p + n * h), p.y + n.y * h));
    w *= .6;
  }
  return clamp(1.0 - 2.4 * o, 0.0, 1.0);
}

// ---- light ------------------------------------------------------------------------------------------
// The room: a warm paper-toned sky, a broad softbox above to the left, a dark floor, a cool strip behind.
${PIECE_MATERIAL}
vec3 pieceColour(int s, vec3 p, vec3 rd, bool cheap) {
  vec3 n = normalOf(s, p);
  float sun = cheap ? 1.0 : sunlit(p + n * (.012 - 1.5 * min(piece(s, p), 0.0)));
  vec4 a = uP[s], b = uQ[s];
  vec3 local = p - vec3(a.x, a.w, a.y);
  local.xz = mat2(cos(b.y),sin(b.y),-sin(b.y),cos(b.y)) * local.xz;
  int type = int(mod(a.z, 8.0));
  gInk = uStudies > .5 && !cheap ? studyInk(type, float(s), 0.0, local, TALLS[type]) : vec2(-1.0);
  return finishPiece(a.z >= 8.0, local, n, -rd, sun, cheap ? 1.0 : occlusion(p,n), b.x);
}
// The board's face at p (on y = 0): its squares, the frame and inlay, the last move's indigo wash, a drop
// of ink where the move landed, the pools pieces melted into.
vec3 boardBase(vec3 p, out float gloss) {
  vec2 g = p.xz + HALF;
  vec3 paper = vec3(.8, .77, .7), ink = vec3(.012, .011, .009), wash = vec3(.15, .138, .124);
  float grain = fbm(p.xz * 6.0);
  if (max(abs(p.x), abs(p.z)) > HALF) {
    // The frame: lacquered ink, and an indigo hairline just inside it.
    gloss = .7;
    float e = max(abs(p.x), abs(p.z)) - HALF;
    vec3 c = ink * (1.4 + .5 * grain);
    c = mix(c, vec3(.012, .03, .075), smoothstep(.016, .006, abs(e - .045)));
    return c;
  }
  ivec2 c = ivec2(floor(g));
  bool dark = ((c.x + c.y) & 1) == 1;
  // Paper: a faint tooth.
  vec3 col = paper * (.975 + .035 * noise(p.xz * 31.0) + .02 * (grain - .5));
  if (dark) {
    // Ink washed on: soft blotches where the pigment pooled, granules where it settled into the paper's
    // tooth, a darker line where the wash dried at its edge.
    vec2 f = fract(g);
    float edge = smoothstep(.07, 0.0, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float blot = fbm(p.xz * 1.7 + vec2(c) * 3.1);
    float gran = smoothstep(.62, .92, noise(p.xz * 47.0)) * .55 + smoothstep(.66, .95, noise(p.xz * 21.0 + 7.0)) * .35;
    float w = .74 + .3 * (blot - .5) + .14 * edge + .16 * gran;
    col = mix(col, wash, clamp(w, 0.0, 1.0));
  }
  gloss = dark ? .8 : .55;
  // The last move: an indigo wash on its squares.
  if (uMarks.x >= 0.0) {
    vec2 cf = vec2(c);
    float on = (all(equal(cf, uMarks.xy)) || all(equal(cf, uMarks.zw))) ? 1.0 : 0.0;
    col = mix(col, vec3(.035, .075, .16), .38 * on * uMarkAge.x);
    vec2 d = p.xz - (uMarks.zw - HALF + .5);
    float r = length(d), age = uMarkAge.y;
    col = mix(col, ink, (1.0 - age) * smoothstep(.12 + .5 * age, .02 + .4 * age, r) * .5);
  }
  // Where a piece is taken: a ring of ink running out over the board as it sinks, and a wet mark that the
  // board drinks.
  for (int s = 0; s < 32; s++) {
    float m = uQ[s].x;
    if (m <= 0.0 || uP[s].z < 0.0) continue;
    float r = length(p.xz - uP[s].xy) + (fbm(p.xz * 6.0 + float(s)) - .5) * .08;
    float ring = exp(-pow((r - .22 - .32 * m) / (.03 + .04 * m), 2.0)) * smoothstep(1.4, .3, m) * .35;
    float wet = smoothstep(.42, .1, r) * smoothstep(0.0, .5, m) * smoothstep(2.0, 1.0, m) * .3;
    col = mix(col, ink, ring + wet);
  }
  return col;
}
vec3 boardColour(vec3 p, vec3 rd) {
  float gloss;
  vec3 base = boardBase(p, gloss), n = vec3(0.0, 1.0, 0.0), v = -rd;
  float sun = sunlit(p + vec3(0.0, .002, 0.0)), ao = occlusion(p, n);
  vec3 c = base * (vec3(.36, .345, .33) * ao + KEY * LKEY.y * sun * .58);
  // The lacquer: the room and the pieces in it.
  float nv = max(v.y, 0.0);
  vec3 F = fres(vec3(.04), nv) * gloss, r = reflect(rd, n);
  vec3 refl = env(r) * .6;
  if (max(abs(p.x), abs(p.z)) <= HALF) {
    vec2 h = pieces(p + n * .002, r, 3.0);
    if (h.x < 1e8) refl = pieceColour(int(h.y), p + r * h.x, r, true) * smoothstep(3.0, .5, h.x);
  }
  c += F * refl * ao + lamp(n, v, LKEY, KEY, vec3(.04), .12) * sun * gloss;
  return c;
}
// The board's sides: ink lacquer, a bright bevel where they meet the top.
vec3 sideColour(vec3 p, vec3 n, vec3 rd) {
  vec3 base = vec3(.014, .013, .011);
  float nv = max(dot(n, -rd), 0.0);
  vec3 c = base * (vec3(.4) + KEY * max(dot(n, LKEY), 0.0) * .5);
  c += fres(vec3(.04), nv) * env(reflect(rd, n)) * .7;
  c += vec3(.5) * smoothstep(-.012, 0.0, p.y) * max(dot(n, LKEY) + .3, 0.0);
  return c;
}
// The board's shadow on the page under it, and how dark (premultiplied black's alpha).
float pageShadow(vec3 p) {
  vec2 off = -LKEY.xz / LKEY.y * SLAB * 2.2;
  vec2 q = abs(p.xz - off) - vec2(FRAME);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  vec2 qc = abs(p.xz) - vec2(FRAME);
  float dc = length(max(qc, 0.0));
  return .42 * (1.0 - smoothstep(-.3, .9, d)) + .3 * (1.0 - smoothstep(0.0, .12, dc));
}
vec3 tone(vec3 c) {
  c *= .82;
  c = (c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 uv = ((gl_FragCoord.xy + uJit) / uSize * 2.0 - 1.0) * uView.xy + uView.zw;
  vec3 ro = uEye, rd = normalize(uFwd + uRight * uv.x * uTan.x + uUp * uv.y * uTan.y);
  // The board's top, and its sides.
  float tb = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  vec3 pb = ro + rd * tb;
  bool onTop = tb < 1e8 && max(abs(pb.x), abs(pb.z)) <= FRAME;
  float ts = 1e9; vec3 ns = vec3(0.0);
  if (!onTop) {
    vec3 lo = vec3(-FRAME, -SLAB, -FRAME), hi = vec3(FRAME, 0.0, FRAME), inv = 1.0 / rd;
    vec3 a = (lo - ro) * inv, b = (hi - ro) * inv, mn = min(a, b), mx = max(a, b);
    float t0 = max(max(mn.x, mn.y), mn.z), t1 = min(min(mx.x, mx.y), mx.z);
    if (t0 < t1 && t0 > 0.0) { ts = t0; ns = t0 == mn.x ? vec3(-sign(rd.x), 0.0, 0.0) : t0 == mn.z ? vec3(0.0, 0.0, -sign(rd.z)) : vec3(0.0, 1.0, 0.0); }
  }
  float tGround = onTop ? tb : ts;
  vec2 hit = pieces(ro, rd, tGround < 1e8 ? tGround : 60.0);
  g = vec4(0.0);
  if (uMode == 1) {
    // The picture's ink: black pigment (R) and white (G); which piece it is (B: its slot + 1, over 64; the
    // board 1) and how high (A: y over 1.5), for the cure that turns it solid (glsl/unmix.js).
    if (hit.x < 1e8) { int s = int(hit.y); bool black = uP[s].z >= 8.0; o = vec4(black ? 1.0 : 0.0, black ? 0.0 : 1.0, (float(s) + 1.0) / 64.0, clamp((ro.y + rd.y * hit.x) / 1.5, 0.0, 1.0)); return; }
    if (onTop) {
      vec2 g = pb.xz + HALF;
      if (max(abs(pb.x), abs(pb.z)) > HALF) { o = vec4(.9, 0.0, 1.0, 0.0); return; }
      bool dark = ((int(floor(g.x)) + int(floor(g.y))) & 1) == 1;
      o = vec4(dark ? .28 : 0.0, dark ? 0.0 : .4, 1.0, 0.0);
      return;
    }
    o = ts < 1e8 ? vec4(.9, 0.0, 1.0, 0.0) : vec4(0.0);
    return;
  }
  vec3 col;
  if (hit.x < 1e8) { vec3 ph = ro + rd * hit.x; g = vec4(ph.y, ph.z, 0.0, 1.0); col = pieceColour(int(hit.y), ph, rd, false); }
  else if (onTop) { g = vec4(0.0, pb.z, 0.0, 1.0); col = boardColour(pb, rd); }
  else if (ts < 1e8) { vec3 ps = ro + rd * ts; g = vec4(ps.y, ps.z, 0.0, 1.0); col = sideColour(ps, ns, rd); }
  else {
    // The page: only the board's shadow on it.
    float tp = rd.y < 0.0 ? (-SLAB - ro.y) / rd.y : 1e9;
    g = vec4(-SLAB, tp < 1e8 ? ro.z + rd.z * tp : -60.0, 0.0, 1.0);
    vec2 e = gl_FragCoord.xy / uSize;
    float a = tp < 1e8 ? pageShadow(ro + rd * tp) * smoothstep(0.0, .1, min(min(e.x, 1.0 - e.x), min(e.y, 1.0 - e.y))) : 0.0;
    o = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  o = vec4(tone(col), 1.0);
}`;

// The picture over the page: the averaged target, premultiplied, where the board's box is on the canvas.
export const BOARD3D_BLIT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec4 uRect;   // the box on the canvas, px from its lower left
uniform float uAlpha;
out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uRect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
  o = texture(uTex, uv) * uAlpha;
}`;
