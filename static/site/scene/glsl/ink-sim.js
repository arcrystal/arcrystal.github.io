// The ink's fluid, baked once (scene/ink-sim.js runs it; glsl/plume.js plays it back by scroll). A 2D
// incompressible flow on a grid of square cells, y up, velocity in cells per second:
//   velocity  carried along itself (semi-Lagrangian, its foot found by RK2), then pushed: ink is heavier
//             than water (Boussinesq buoyancy, from the ink's density), vorticity confinement puts back
//             the small curls the grid smears away (and makes them fiercer), and stirrers turn the water
//   project   the divergence, its pressure (Jacobi), and the pressure's gradient taken off: the flow
//             keeps no sources or sinks
//   rho       the ink's density on the grid, carried, for the buoyancy only
//   map       where the water at each point was at the start: D(x) = Ψ(x) − x (domain units), carried by
//             Ψ'(x) = Ψ(x − u dt): the picture is then drawn sharp from its first frame, dye0(Ψ(x))
// Each pass draws the whole grid (the full-screen triangle of glsl/index.js VERTEX).
import { NOISE } from './common.js';

const HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler2DArray;
uniform vec2 uCells;
out vec4 o;
vec2 at(sampler2D t, vec2 c) { return texture(t, c / uCells).xy; }
`;

export const INKSIM = {
  // The vorticity, ω = ∂v/∂x − ∂u/∂y.
  curl: HEAD + /* glsl */ `
uniform sampler2D uVel;
void main() {
  vec2 c = gl_FragCoord.xy;
  o = vec4(.5 * ((at(uVel, c + vec2(1, 0)).y - at(uVel, c - vec2(1, 0)).y) - (at(uVel, c + vec2(0, 1)).x - at(uVel, c - vec2(0, 1)).x)), 0.0, 0.0, 1.0);
}`,
  velocity: HEAD + /* glsl */ `
uniform sampler2D uVel, uRho, uCurl;
uniform float uDt, uGrav, uEps, uDamp;
uniform vec4 uStir[8];   // a stirrer: its middle (cells), its reach (cells), how hard it turns (cells / s²)
uniform int uNStir;
void main() {
  vec2 c = gl_FragCoord.xy;
  vec2 v = at(uVel, c), back = clamp(c - uDt * at(uVel, c - .5 * uDt * v), vec2(.5), uCells - .5);
  vec2 u = at(uVel, back);
  vec2 rho = at(uRho, c);
  u.y -= uGrav * (rho.x + .8 * rho.y) * uDt;
  // Vorticity confinement: f = ε (N × ω), N toward stronger vorticity.
  float w = texture(uCurl, c / uCells).x;
  vec2 g = .5 * vec2(abs(texture(uCurl, (c + vec2(1, 0)) / uCells).x) - abs(texture(uCurl, (c - vec2(1, 0)) / uCells).x),
                     abs(texture(uCurl, (c + vec2(0, 1)) / uCells).x) - abs(texture(uCurl, (c - vec2(0, 1)) / uCells).x));
  u += uEps * w * vec2(g.y, -g.x) / (length(g) + 1e-4) * uDt;
  for (int i = 0; i < 8; i++) {
    if (i >= uNStir) break;
    vec4 s = uStir[i];
    vec2 r = c - s.xy;
    u += s.w * vec2(-r.y, r.x) / s.z * exp(-dot(r, r) / (s.z * s.z)) * uDt;
  }
  u *= uDamp;
  if (c.x < 1.0 || c.x > uCells.x - 1.0) u.x = 0.0;
  if (c.y < 1.0 || c.y > uCells.y - 1.0) u.y = 0.0;
  o = vec4(u, 0.0, 1.0);
}`,
  divergence: HEAD + /* glsl */ `
uniform sampler2D uVel;
void main() {
  vec2 c = gl_FragCoord.xy;
  o = vec4(.5 * ((at(uVel, c + vec2(1, 0)).x - at(uVel, c - vec2(1, 0)).x) + (at(uVel, c + vec2(0, 1)).y - at(uVel, c - vec2(0, 1)).y)), 0.0, 0.0, 1.0);
}`,
  jacobi: HEAD + /* glsl */ `
uniform sampler2D uPres, uDiv;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy), m = ivec2(uCells) - 1;
  float l = texelFetch(uPres, clamp(c - ivec2(1, 0), ivec2(0), m), 0).x, r = texelFetch(uPres, clamp(c + ivec2(1, 0), ivec2(0), m), 0).x;
  float b = texelFetch(uPres, clamp(c - ivec2(0, 1), ivec2(0), m), 0).x, t = texelFetch(uPres, clamp(c + ivec2(0, 1), ivec2(0), m), 0).x;
  o = vec4((l + r + b + t - texelFetch(uDiv, c, 0).x) * .25, 0.0, 0.0, 1.0);
}`,
  gradient: HEAD + /* glsl */ `
uniform sampler2D uPres, uVel;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy), m = ivec2(uCells) - 1;
  float l = texelFetch(uPres, clamp(c - ivec2(1, 0), ivec2(0), m), 0).x, r = texelFetch(uPres, clamp(c + ivec2(1, 0), ivec2(0), m), 0).x;
  float b = texelFetch(uPres, clamp(c - ivec2(0, 1), ivec2(0), m), 0).x, t = texelFetch(uPres, clamp(c + ivec2(0, 1), ivec2(0), m), 0).x;
  vec2 u = texelFetch(uVel, c, 0).xy - .5 * vec2(r - l, t - b);
  if (c.x < 1 || c.x > m.x - 1) u.x = 0.0;
  if (c.y < 1 || c.y > m.y - 1) u.y = 0.0;
  o = vec4(u, 0.0, 1.0);
}`,
  // The ink's density and the map, carried together (two targets): where the water here was at the start
  // is where the water at the foot of its step was (D, the way back to it, in domain units).
  carry: HEAD.replace('out vec4 o;', 'layout(location = 0) out vec4 o;\nlayout(location = 1) out vec4 o2;') + /* glsl */ `
uniform sampler2D uVel, uRho, uMap;
uniform float uDt;
void main() {
  vec2 c = gl_FragCoord.xy, v = at(uVel, c);
  vec2 back = clamp(c - uDt * at(uVel, c - .5 * uDt * v), vec2(.5), uCells - .5);
  vec2 ub = back / uCells;
  o = vec4(at(uRho, back), 0.0, 1.0);
  o2 = vec4(ub + texture(uMap, ub).xy - c / uCells, 0.0, 1.0);
}`,
  // The start: the ink's density from its picture (read at about the grid's resolution), and the drops'
  // own fall (S1: each drop already falling at uV0, down).
  initRho: HEAD + /* glsl */ `
uniform sampler2D uDye;
uniform float uLod;
void main() { o = vec4(textureLod(uDye, gl_FragCoord.xy / uCells, uLod).xy, 0.0, 1.0); }`,
  initVel: HEAD + /* glsl */ `
uniform sampler2D uRho;
uniform float uV0;
void main() { vec2 r = at(uRho, gl_FragCoord.xy); o = vec4(0.0, -uV0 * min(1.0, 1.6 * (r.x + r.y)), 0.0, 1.0); }`,
  zero: HEAD + /* glsl */ `void main() { o = vec4(0.0, 0.0, 0.0, 1.0); }`,
  // A frame of the map, kept (into a layer of the keyframes).
  copy: HEAD + /* glsl */ `
uniform sampler2D uSrc;
void main() { o = vec4(texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0).xy, 0.0, 1.0); }`,
  // The drops (S1's picture at the start), each a body of ink in nested shells, mottled; R black, G white.
  // uCells here: the grid the drops are placed on; the picture is drawn at uSize.
  drops: HEAD + NOISE + /* glsl */ `
uniform vec2 uSize;
uniform vec4 uDrop[64];   // its middle (cells), its radius (cells), 1 black / 0 white
uniform int uN;
void main() {
  vec2 c = gl_FragCoord.xy / uSize * uCells;
  vec2 ink = vec2(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= uN) break;
    vec4 d = uDrop[i];
    float r = length(c - d.xy);
    if (r > d.z + 2.0) continue;
    float body = smoothstep(d.z + .6, d.z - .6, r);
    float k = r / d.z, shells = .72 + .28 * sin(k * 19.0 + float(i) * 1.7) * sin(k * 7.0 + 2.0);
    float mottle = .78 + .44 * noise(c * 1.3 + float(i) * 11.0);
    float a = body * clamp(shells * mottle, 0.0, 1.0) * (1.0 - .25 * k * k);
    if (d.w > .5) ink.x = max(ink.x, a); else ink.y = max(ink.y, a);
  }
  o = vec4(ink, 0.0, 1.0);
}`,
};
