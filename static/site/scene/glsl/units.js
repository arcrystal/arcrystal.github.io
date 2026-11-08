// Transit units: the pieces that fly across a seam, one program per kind, drawn instanced over the
// seam's ground (transit.js). Each unit's place is computed from its seed and the seam's progress
// alone (no state), so scrolling back un-builds it. A unit carries the upper world's colour where it
// leaves and the lower world's where it lands, read from the snapshots (uTexA, uTexB).
//
// Space: the strip in CSS px (x right, y down) with z toward the viewer; project() adds the
// perspective of a camera FOCAL px in front of the screen's centre.
import { NOISE } from './common.js';
import { FLIGHT, SEAM_TEX } from './flight.js';

const HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
#define PI 3.14159265
#define TAU 6.28318531
uniform vec4 uRegion;
uniform vec2 uView;
uniform float uTime;
uniform float uH;         // the seam's progress p
uniform float uVel;
uniform vec4 uGrid;
uniform vec4 uGrid2;
uniform int uFirst;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
`;

const VHEAD = HEAD + NOISE + FLIGHT + SEAM_TEX + /* glsl */ `
const float FOCAL = 1100.0;
vec4 project(vec3 p) {
  vec2 v = uRegion.xy + p.xy;
  vec2 c = uView * 0.5;
  float w = (FOCAL - min(p.z, 700.0)) / FOCAL;
  vec2 s = c + (v - c) / w;
  return vec4(vec2(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0) * w, 0.0, w);
}
const vec4 GONE = vec4(2.0, 2.0, 2.0, 1.0);
vec2 tUV(vec2 q) { return vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w); }
vec3 rotAxis(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
float smoother(float x) { x = clamp(x, 0.0, 1.0); return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }
ivec2 cellOf(int id, int cols) { return ivec2(id % cols, id / cols); }
// The two triangles of a quad, corners 0..1.
const vec2 QUAD[6] = vec2[6](vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 0), vec2(1, 1), vec2(0, 1));
`;

const FHEAD = HEAD + /* glsl */ `
out vec4 o;
vec2 tUV(vec2 q) { return vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w); }
vec3 spectrum(float x) { return 0.5 + 0.5 * cos(TAU * (x + vec3(0.0, 0.33, 0.67))); }
const vec3 EMBER = vec3(0.910, 0.706, 0.396);
const vec3 BRASS = vec3(0.804, 0.647, 0.384);
const vec3 DR_RED = vec3(0.78, 0.19, 0.16);
const vec3 INK_BLACK = vec3(0.110, 0.102, 0.090);
const vec3 INK_INDIGO = vec3(0.184, 0.290, 0.420);
`;

// ---- About Me → Science: tiny cubes ----------------------------------------------------------
// The paper breaks into cubes in the order a Hilbert curve passes through them (flight.js). Each lifts toward you, tumbles through the flow and
// turns half over (plus a whole turn for some), so its paper face goes under and its other face,
// carrying the sky of the cell it is bound for, comes up; its sides are liquid chrome.
const CUBES_VS = VHEAD + /* glsl */ `
out vec2 vQ;
flat out int vFace;
out vec3 vN;
out vec2 vL;
out float vMid;
const vec3 NRM[6] = vec3[6](vec3(0, 0, 1), vec3(0, 0, -1), vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 1, 0), vec3(0, -1, 0));
const vec3 TU[6] = vec3[6](vec3(1, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 1, 0), vec3(1, 0, 0), vec3(1, 0, 0));
const vec3 TV[6] = vec3[6](vec3(0, 1, 0), vec3(0, 1, 0), vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1));
void main() {
  int cols = int(uGrid.x);
  ivec2 c = cellOf(gl_InstanceID + uFirst, cols);
  vec2 cell = uGrid.zw;
  vec2 home = (vec2(c) + 0.5) * cell;
  float u = hilbertU(hilbertA(home, uRegion.zw), hash(vec2(c) + 0.37), transitP(uH));
  if (u <= 0.0 || u >= 1.0 || c.y >= int(uGrid.y)) { gl_Position = GONE; return; }
  vec2 dest = (vec2(float(shiftCol(c.x, c.y, cols, 1.0, 1)), float(c.y)) + 0.5) * cell;
  float r1 = hash(vec2(c) + 1.7), r2 = hash(vec2(c) + 5.3), r3 = hash(vec2(c) + 9.1);
  float e = smoother(u);
  float mid = sin(PI * u);
  vec3 pos = vec3(mix(home, dest, e), 0.0);
  pos.xy += mid * (swirl(home * 0.9 + r1 * 40.0, uTime * 0.5) * (70.0 + 130.0 * r1) + vec2(0.0, 40.0 + 160.0 * r2));
  pos.xy += mid * vec2(sin(uTime * 1.3 + r1 * 6.3), cos(uTime * 1.1 + r2 * 6.3)) * 5.0;
  pos.y += mid * clamp(uVel, -3.0, 3.0) * 30.0;
  pos.z = mid * (60.0 + 380.0 * r3 * r3);
  float ax = r1 * TAU;
  vec3 axis = vec3(cos(ax), sin(ax), 0.0);
  float ang = e * (PI + TAU * floor(r2 * 2.0));
  float yaw = mid * (r3 - 0.5) * 2.4;
  int f = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6] * 2.0 - 1.0;
  vec3 n = NRM[f];
  vec3 half_ = vec3(cell * 0.5, min(cell.x, cell.y) * 0.5) * (1.0 - 0.34 * mid);
  vec3 rn = rotAxis(rotAxis(n, axis, ang), vec3(0, 0, 1), yaw);
  vec3 faceC = pos + rotAxis(rotAxis(n * half_, axis, ang), vec3(0, 0, 1), yaw);
  vec3 eye = vec3(uView * 0.5 - uRegion.xy, FOCAL);
  if (dot(rn, eye - faceC) <= 0.0) { gl_Position = GONE; return; }
  vec3 local = (n + TU[f] * k.x + TV[f] * k.y) * half_;
  vec3 P = pos + rotAxis(rotAxis(local, axis, ang), vec3(0, 0, 1), yaw);
  vec2 off = k * cell * 0.5;
  vFace = f == 0 ? 0 : f == 1 ? 1 : 2;
  // Half a turn about an axis in the screen's plane mirrors the back face across that axis.
  vQ = f == 0 ? home + off : dest + (2.0 * dot(off, axis.xy) * axis.xy - off);
  vN = rn;
  vL = k;
  vMid = mid;
  gl_Position = project(P);
}`;

const CUBES_FS = FHEAD + /* glsl */ `
in vec2 vQ;
flat in int vFace;
in vec3 vN;
in vec2 vL;
in float vMid;
vec3 chrome(vec3 n) {
  float up = -n.y;
  vec3 c = mix(vec3(0.02, 0.025, 0.06), vec3(0.36, 0.23, 1.0) * 0.85, smoothstep(-0.3, 0.9, up));
  c += vec3(0.13, 0.9, 1.0) * pow(max(n.x, 0.0), 3.0) * 0.85;
  c += vec3(1.0, 0.24, 0.8) * pow(max(-n.x, 0.0), 4.0) * 0.45;
  c += spectrum(n.z * 1.3 + up * 0.4) * 0.16;
  return c;
}
void main() {
  vec3 n = normalize(vN);
  vec3 base = vFace == 0 ? texture(uTexA, tUV(vQ)).rgb : vFace == 1 ? texture(uTexB, tUV(vQ)).rgb : chrome(n);
  vec3 L = normalize(vec3(-0.35, -0.6, 0.72));
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  vec3 lit = base * (0.6 + 0.52 * dif) + spec * 0.4;
  float edge = smoothstep(0.78, 1.0, max(abs(vL.x), abs(vL.y)));
  lit += spectrum(dot(n, vec3(0.6, 0.3, 0.5)) + vMid) * edge * 0.24;
  o = vec4(mix(base, lit, smoothstep(0.0, 0.25, vMid)), 1.0);
}`;

// ---- Racing → Outdoors: sheets ------------------------------------------------------------------
// Brick-laid panes of ice peel in a diagonal sweep from the bottom-left (flight.js paneA). Each peels
// back from one corner (a page curl: half a turn around a cylinder, then laid flat over itself), its
// underside bright gilt pressed with the engraving; the lantern runs along the fold, facets in the
// ice glitter as it turns, and the folded sheet tumbles up and away. Panes that peel first draw last, so a
// flying tube passes over the panes still lying flat.
const SHEETS_VS = VHEAD + /* glsl */ `
const int NS = 34, NW = 12;
out vec2 vQ;
out vec3 vN;
out vec3 vP;
out vec2 vSW;
out float vMid;
out float vCrease;
out float vLift;
void main() {
  int cols = int(uGrid.x) + 1, rows = int(uGrid.y);
  int id = gl_InstanceID;
  ivec2 c = ivec2(cols - 1 - id % cols, id / cols);
  if (c.y >= rows) { gl_Position = GONE; return; }
  vec2 cell = uGrid.zw;
  if (c.y % 2 == 0 && c.x == cols - 1) { gl_Position = GONE; return; }
  vec2 ctr = paneCentre(c, uGrid);
  float u = flightAt(paneA(ctr, uRegion.zw, hash(vec2(c) + 0.61)), 0.5, transitP(uH));
  if (u <= 0.0 || u >= 1.0) { gl_Position = GONE; return; }
  float r1 = hash(vec2(c) + 2.9), r2 = hash(vec2(c) + 7.7);
  int qd = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  float w = (float(qd % NW) + k.x) / float(NW);
  float s = (float(qd / NW) + k.y) / float(NS);
  float roll = paneRoll(u), fly = paneFly(u);
  float side = step(0.5, r1);
  float f = paneFront(roll, w, side);
  float L = cell.y, R = L * 0.12;
  float x = ctr.x - cell.x * 0.5 + w * cell.x, hinge = ctr.y + cell.y * 0.5;
  float yf = hinge - f * L;
  vec3 P, N;
  // A page curl: flat up to the fold, half a turn around a cylinder, then laid back flat over itself,
  // underside up.
  float a = (s - f) * L;
  if (s <= f) { P = vec3(x, hinge - s * L, 0.0); N = vec3(0.0, 0.0, 1.0); }
  else if (a < PI * R) {
    float th = a / R;
    P = vec3(x, yf - R * sin(th), R * (1.0 - cos(th)));
    N = vec3(0.0, sin(th), cos(th));
  } else {
    P = vec3(x, yf + (a - PI * R), 2.0 * R);
    N = vec3(0.0, 0.0, -1.0);
  }
  vCrease = exp(-abs(s - f) * L / 5.0) * smoothstep(0.0, 0.06, roll) * (1.0 - fly);
  // The tube lifts and tumbles away, up and toward you, fluttering.
  if (fly > 0.0) {
    vec3 piv = vec3(ctr.x, hinge, R);
    vec3 ax = normalize(vec3(1.0, (r2 - 0.5) * 0.8, 0.0));
    float ang = fly * PI * (1.2 + r2);
    P = piv + rotAxis(P - piv, ax, ang);
    N = rotAxis(N, ax, ang);
    P += vec3((r1 - 0.5) * 160.0 * fly + sin(uTime * 2.0 + r2 * 9.0) * 6.0 * fly, -fly * fly * (hinge + L * 1.5), fly * 320.0);
  }
  vQ = vec2(x, hinge - s * L);
  vN = N;
  vP = P;
  vSW = vec2(s, w);
  vMid = sin(PI * u);
  // Only what has curled up (or is flying) catches the light; the rest still lies as ice.
  vLift = max(smoothstep(f, f + 0.03, s), fly);
  gl_Position = project(P);
}`;

const SHEETS_FS = FHEAD + /* glsl */ `
in vec2 vQ;
in vec3 vN;
in vec3 vP;
in vec2 vSW;
in float vMid;
in float vCrease;
in float vLift;
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(vec3(uView * 0.5 - uRegion.xy, 1100.0) - vP);
  bool front = dot(n, V) > 0.0;
  if (!front) n = -n;
  float nv = abs(dot(n, V));
  float fres = pow(1.0 - nv, 3.0);
  vec3 lamp = normalize(vec3(0.35, -0.55, 0.75));
  vec3 H = normalize(lamp + V);
  float dif = max(dot(n, lamp), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 70.0);
  // Glitter: tiny facets in the ice, each at its own tilt, flashing as the sheet turns.
  vec2 gc = floor(vQ * 0.42);
  vec3 gn = normalize(n + vec3(vec2(h21(gc), h21(gc + 7.3)) - 0.5, 0.0) * 0.9);
  float glit = pow(max(dot(gn, H), 0.0), 380.0) * step(0.8, h21(gc + 3.1)) * 7.0;
  float e = min(min(vSW.x, 1.0 - vSW.x), min(vSW.y, 1.0 - vSW.y));
  vec3 col;
  if (front) {
    vec3 ice = texture(uTexA, tUV(vQ)).rgb;
    vec3 lit = ice * vec3(0.62, 0.8, 0.96) * (0.55 + 0.5 * dif);
    lit = mix(lit, vec3(0.16, 0.42, 0.74), smoothstep(0.22, 0.0, e) * 0.5);
    lit += vec3(0.9, 0.97, 1.0) * (fres * 0.45 + smoothstep(0.025, 0.0, e) * 0.8) + vec3(1.0, 0.95, 0.85) * spec * 1.3;
    lit += spectrum(nv * 2.2 + vSW.y * 0.7) * fres * 0.4;
    lit += vec3(0.9, 0.97, 1.0) * glit;
    col = mix(ice + vec3(0.9, 0.97, 1.0) * glit * 0.4, lit, max(vLift, smoothstep(0.0, 1.0, vCrease)));
  } else {
    // The underside: bright gilt, brushed along the roll, with the plate's engraving pressed in.
    vec3 plate = texture(uTexB, tUV(vQ)).rgb;
    float l = dot(plate, vec3(0.299, 0.587, 0.114));
    vec3 gold = mix(vec3(0.42, 0.29, 0.11), vec3(0.95, 0.76, 0.4), 0.25 + 0.75 * dif);
    float brushed = pow(max(dot(n, H), 0.0), 18.0) * (0.6 + 0.4 * sin(vQ.x * 0.9 + vQ.y * 0.15));
    col = gold * (0.3 + 2.2 * l) + vec3(1.0, 0.93, 0.76) * (brushed * 0.22 + spec * 0.55 + glit * 0.9) + spectrum(fres * 1.5 + vSW.x) * fres * 0.3;
    col = mix(col, BRASS * 1.3, smoothstep(0.03, 0.0, e) * 0.7);
  }
  col += vec3(1.0, 0.96, 0.86) * vCrease * 0.7;
  o = vec4(col, 1.0);
}`;

// Ice dust: where a sheet's roll passes, a few of its facets break loose and drift down, twinkling,
// then fade. uGrid2 holds the panes, uGrid the dust's own grid.
const GLITTER_VS = VHEAD + /* glsl */ `
out vec2 vK;
out vec3 vCol;
void main() {
  int cols = int(uGrid.x);
  ivec2 c = cellOf(gl_InstanceID + uFirst, cols);
  if (c.y >= int(uGrid.y) || hash(vec2(c) + 6.6) > 0.22) { gl_Position = GONE; return; }
  vec2 home = (vec2(c) + hash2(vec2(c) + 2.2)) * uGrid.zw;
  ivec2 pc = paneCell(home, uGrid2);
  vec2 ctr = paneCentre(pc, uGrid2);
  float u = flightAt(paneA(ctr, uRegion.zw, hash(vec2(pc) + 0.61)), 0.5, transitP(uH));
  if (u <= 0.0 || u >= 1.0) { gl_Position = GONE; return; }
  float L = uGrid2.w;
  float sh = clamp((ctr.y + L * 0.5 - home.y) / L, 0.0, 1.0), wh = clamp((home.x - ctr.x) / uGrid2.z + 0.5, 0.0, 1.0);
  float side = step(0.5, hash(vec2(pc) + 2.9));
  // It breaks loose when the roll's front passes it.
  float roll = paneRoll(u);
  float loose = (1.0 - sh + PEEL_K * mix(wh, 1.0 - wh, side)) / (1.0 + PEEL_K);
  float a = (roll - loose) / 0.35;
  if (a <= 0.0 || a >= 1.0) { gl_Position = GONE; return; }
  float r = hash(vec2(c) + 4.4);
  vec2 p = home + swirl(home * 1.3 + r * 20.0, uTime * 0.6) * a * 40.0 + vec2((r - 0.5) * 30.0, 70.0 * a * a);
  float tw = pow(0.5 + 0.5 * sin(uTime * (9.0 + 14.0 * r) + r * 40.0), 6.0);
  vec3 col = mix(vec3(0.85, 0.95, 1.0), spectrum(r + uTime * 0.2), 0.35);
  vCol = col * (0.25 + 1.6 * tw) * (1.0 - a) * smoothstep(0.0, 0.08, a) * (1.0 - smoothstep(0.85, 1.0, u));
  vK = QUAD[gl_VertexID % 6] * 2.0 - 1.0;
  gl_Position = project(vec3(p + vK * (1.2 + 2.2 * r) * (1.0 + tw), a * 120.0 * r));
}`.replace('spectrum(', 'gspec(').replace('void main() {', 'vec3 gspec(float x) { return 0.5 + 0.5 * cos(TAU * (x + vec3(0.0, 0.33, 0.67))); }\nvoid main() {');

const GLITTER_FS = FHEAD + /* glsl */ `
in vec2 vK;
in vec3 vCol;
void main() {
  float d = dot(vK, vK);
  // A small star: a soft core and a cross of rays.
  float g = exp(-d * 7.0) + (exp(-abs(vK.x) * 14.0) + exp(-abs(vK.y) * 14.0)) * exp(-d * 1.5) * 0.35;
  o = vec4(vCol * g, 0.0);
}`;

// ---- Photography → Chess: ink filaments ------------------------------------------------------
// The darkroom lets go of its black as ink dropped in water: from each seed a tapering stroke sinks
// along the flow, curling, its head swelling, then bleeds wider and fades into the wash.
const FILAMENTS_VS = VHEAD + /* glsl */ `
const int NSEG = 16;
out float vSide;
out float vS;
out vec3 vCol;
out float vAl;
out vec2 vQ;
void main() {
  int cols = int(uGrid.x);
  ivec2 c = cellOf(gl_InstanceID + uFirst, cols);
  if (c.y >= int(uGrid.y) || hash(vec2(c) + 5.5) > 0.72) { gl_Position = GONE; return; }
  vec2 seed = (vec2(c) + hash2(vec2(c) + 7.3)) * uGrid.zw;
  float u = seamU(seed, hash(vec2(c) + 0.8), transitP(uH));
  if (u <= 0.1 || u >= 1.0) { gl_Position = GONE; return; }
  float r = hash(vec2(c) + 2.6);
  float grow = smoothstep(0.1, 0.62, u);
  float fade = 1.0 - smoothstep(0.7, 1.0, u);
  float bleed = smoothstep(0.55, 1.0, u);
  float len = (70.0 + 170.0 * r) * grow;
  float ds = len / float(NSEG);
  int seg = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  int vi = seg + int(k.x);
  vec2 p = seed, v = vec2(0.0, 1.0);
  for (int j = 0; j < NSEG; j++) {
    if (j >= vi) break;
    v = normalize(swirl(p * 1.15 + r * 70.0, uTime * 0.35) * 1.7 + vec2(0.0, 0.75));
    p += v * ds;
  }
  vec2 nrm = vec2(-v.y, v.x);
  float s = float(vi) / float(NSEG);
  float wid = (0.3 + 3.4 * pow(s, 2.5)) * (1.0 + 3.0 * bleed) * (0.7 + 0.6 * r);
  float side = k.y * 2.0 - 1.0;
  p += nrm * side * wid;
  vec3 from = texture(uTexA, tUV(seed)).rgb;
  vec3 tone = mix(INK_BLACK_V, INK_INDIGO_V, r * 0.7);
  vCol = mix(from, tone, smoothstep(0.12, 0.5, u));
  vAl = (0.4 + 0.35 * r) * fade * (0.25 + 0.75 * s) * smoothstep(0.0, 0.1, grow) / (1.0 + 1.5 * bleed);
  vSide = side;
  vS = s;
  vQ = p;
  gl_Position = project(vec3(p, 0.0));
}`.replace('INK_BLACK_V', 'vec3(0.110, 0.102, 0.090)').replace('INK_INDIGO_V', 'vec3(0.184, 0.290, 0.420)');

const FILAMENTS_FS = FHEAD + /* glsl */ `
in float vSide;
in float vS;
in vec3 vCol;
in float vAl;
in vec2 vQ;
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  float edge = exp(-vSide * vSide * 2.6);
  float gran = 0.75 + 0.25 * h21(floor(vQ * 1.1));
  float al = vAl * edge * gran * (0.8 + 0.2 * vS);
  o = vec4(vCol * al, al);
}`;

// blend: 'opaque', 'over' (premultiplied) or 'add'. grid: which uniform holds the instance grid.
export const UNIT_PROGRAMS = {
  cubes: { vs: CUBES_VS, fs: CUBES_FS, verts: 36, blend: 'opaque' },
  sheets: { vs: SHEETS_VS, fs: SHEETS_FS, verts: 34 * 12 * 6, blend: 'opaque' },   // instances: rows × (cols + 1)
  glitter: { vs: GLITTER_VS, fs: GLITTER_FS, verts: 6, blend: 'add' },
  filaments: { vs: FILAMENTS_VS, fs: FILAMENTS_FS, verts: 16 * 6, blend: 'over' },
};

// ---- The fluid: stable fluids on a coarse grid over the Science → Racing seam --------------------
// Velocity in CSS px per second (y down) on an RG16F grid; one pass advects and adds the forces
// (the swirl, the scroll and the pointer, all near the front), then a pressure projection keeps it
// divergence-free. The ground only borrows its velocity to stir the flow, so it never decides
// where anything ends up.
const SIM_HEAD = /* glsl */ `#version 300 es
precision highp float;
#define PI 3.14159265
#define TAU 6.28318531
uniform vec2 uCells;
out vec4 o;
`;
export const SIM = {
  step: SIM_HEAD + NOISE + /* glsl */ `
uniform sampler2D uVelT;
uniform vec2 uSize;     // the strip, CSS px
uniform float uDt;
uniform float uTime;
uniform float uFront;   // the seam's P (flight.js transitP)
uniform float uScroll;  // viewport heights per second
uniform vec4 uPtr;      // the pointer in the strip (CSS px) and its motion (CSS px per second)
` + FLIGHT + /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / uCells;
  vec2 v = texture(uVelT, uv).xy;
  vec2 back = uv - vec2(v.x, -v.y) * uDt / uSize;
  v = texture(uVelT, back).xy * 0.982;
  vec2 q = vec2(uv.x, 1.0 - uv.y) * uSize;
  float zone = exp(-pow((uFront - (0.15 + 0.5 * (1.0 - q.y / uSize.y) + 0.08)) / 0.25, 2.0));
  vec2 f = swirl(q, uTime * 0.8) * 320.0 * zone;
  f += vec2(sin(q.y * 0.018 + uTime) * 900.0, 260.0) * uScroll * zone;
  vec2 d = q - uPtr.xy;
  f += uPtr.zw * 6.0 * exp(-dot(d, d) / (110.0 * 110.0));
  v += f * uDt;
  o = vec4(clamp(v, -900.0, 900.0), 0.0, 1.0);
}`,
  divergence: SIM_HEAD + /* glsl */ `
uniform sampler2D uVelT;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy), m = ivec2(uCells) - 1;
  float l = texelFetch(uVelT, clamp(c - ivec2(1, 0), ivec2(0), m), 0).x;
  float r = texelFetch(uVelT, clamp(c + ivec2(1, 0), ivec2(0), m), 0).x;
  float b = texelFetch(uVelT, clamp(c - ivec2(0, 1), ivec2(0), m), 0).y;
  float t = texelFetch(uVelT, clamp(c + ivec2(0, 1), ivec2(0), m), 0).y;
  // y is down in velocity, up in the grid.
  o = vec4(0.5 * ((r - l) - (t - b)), 0.0, 0.0, 1.0);
}`,
  jacobi: SIM_HEAD + /* glsl */ `
uniform sampler2D uPres;
uniform sampler2D uDiv;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy), m = ivec2(uCells) - 1;
  float l = texelFetch(uPres, clamp(c - ivec2(1, 0), ivec2(0), m), 0).x;
  float r = texelFetch(uPres, clamp(c + ivec2(1, 0), ivec2(0), m), 0).x;
  float b = texelFetch(uPres, clamp(c - ivec2(0, 1), ivec2(0), m), 0).x;
  float t = texelFetch(uPres, clamp(c + ivec2(0, 1), ivec2(0), m), 0).x;
  o = vec4((l + r + b + t - texelFetch(uDiv, c, 0).x) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: SIM_HEAD + /* glsl */ `
uniform sampler2D uPres;
uniform sampler2D uVelT;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy), m = ivec2(uCells) - 1;
  float l = texelFetch(uPres, clamp(c - ivec2(1, 0), ivec2(0), m), 0).x;
  float r = texelFetch(uPres, clamp(c + ivec2(1, 0), ivec2(0), m), 0).x;
  float b = texelFetch(uPres, clamp(c - ivec2(0, 1), ivec2(0), m), 0).x;
  float t = texelFetch(uPres, clamp(c + ivec2(0, 1), ivec2(0), m), 0).x;
  vec2 v = texelFetch(uVelT, c, 0).xy - 0.5 * vec2(r - l, -(t - b));
  o = vec4(v, 0.0, 1.0);
}`,
};

// Bakes a seam's or a click's reach (flight.js SEAM_TEX): one texel per patch of the strip or screen.
export const REACH_BAKE = /* glsl */ `#version 300 es
precision highp float;
#define PI 3.14159265
#define TAU 6.28318531
uniform vec2 uSize;   // the strip, CSS px
uniform vec2 uTexel;  // the texture, texels
uniform int uStyle;   // the style that reaches
uniform int uPolar;   // 1: a click's, out from uO to uFar (CSS px); 0: a seam's, up from the foot
uniform int uKind;    // 0: the branching reach; 1: ice crystals
uniform vec2 uO;
uniform float uFar;
out vec4 o;
` + NOISE + FLIGHT + /* glsl */ `
void main() {
  vec2 q = vec2(gl_FragCoord.x / uTexel.x, 1.0 - gl_FragCoord.y / uTexel.y) * uSize;
  if (uKind == 1) { o = crystalAt(q, uSize, uPolar == 1, uO, uFar); return; }
  Reach r;
  if (uPolar == 1) r = reachPolar(q, uO, uFar, uStyle, 0.0);
  else r = reachFoot(q, uSize, uStyle, 0.0);
  o = vec4(min(r.d, 63.75) / 64.0, min(r.w, 23.9) / 24.0, r.tb, r.A);
}`;
