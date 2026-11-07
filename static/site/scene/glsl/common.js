// Shared GLSL: the uniforms, coordinates and noise every scene uses. Coordinates are CSS pixels with
// y down (px), the same space as getBoundingClientRect, so rectangles pass straight through.
export const HEADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uRes;        // drawing buffer, device px
uniform float uDpr;       // device px per CSS px
uniform float uTime;
uniform int uMode;        // 0 scene, 2 cover, 3 reveal, 4 fade in, 5 plain crossfade, 6 seam, 7 the homepage hero
uniform int uA;           // style ids: 0 house, 1 ink, 2 glacier, 3 cosmos, 4 folio, 5 darkroom
uniform int uB;
uniform float uH;         // seam: where the bands' meeting line is on screen, 0..1; crossfade: 0..1
uniform float uVel;       // scroll velocity, viewport heights per second
uniform vec2 uPointer;    // CSS px
uniform float uPtrOn;     // 1 while a fine pointer is over the page
uniform vec4 uCard;       // the resting card (x, y, w, h) in CSS px; w = 0 for none
uniform float uCardR;     // its corner radius
uniform float uCardMix;   // how much of that card the glacier scene draws as glass
uniform vec4 uRegion;     // the region being drawn (x, y, w, h) in CSS px
uniform vec3 uCrystal;    // the homepage crystal (cx, cy, r) in CSS px
uniform float uHover;     // the world filling the crystal, or -1
uniform float uE;         // effect progress 0..1
uniform vec2 uPoint;      // the click, CSS px

out vec4 outColor;

#define PI 3.14159265
#define TAU 6.28318531

vec2 R;          // the viewport in CSS px
float T;         // time, s
vec2 PTR;        // the smoothed pointer
float gGrow = 1.0;     // folio: how far the fern fronds have unfurled
float gCardMix = 1.0;  // glacier: how much of the frosted card the scene draws
`;

export const COMMON = /* glsl */ `
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < Q; i++) { s += a * noise(p); p = OCT * p; a *= 0.5; } return s; }
float fbm3(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * noise(p); p = OCT * p; a *= 0.5; } return s; }
// x: distance to the nearest cell centre, y: to the second nearest, zw: the nearest centre.
vec4 voronoi(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 c = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + hash2(n + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; c = n + g + hash2(n + g); } else if (d < d2) { d2 = d; }
  }
  return vec4(sqrt(d1), sqrt(d2), c);
}
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float ease(float x) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
vec3 spectrum(float x) { return 0.5 + 0.5 * cos(TAU * (x + vec3(0.0, 0.33, 0.67))); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// Distance from c to the farthest corner of the viewport.
float farCorner(vec2 c) { return length(vec2(max(c.x, R.x - c.x), max(c.y, R.y - c.y))); }
`;
