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
uniform float uClick;     // 1: a click's cover (only Science's cubes read it)
uniform vec2 uO;          // the click's origin
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

// ---- About Me → Science, and a click into Science: cubes in a vortex --------------------------------
// Where a cube is (flight.js vortexAt). For a seam, instance rows run from the top to kd rows below
// the screen (cubes rising from there), and each cube flies from its cell to the mirror cell kd rows
// up (thrown out over the top, for the top rows). For a click
// (uClick), out of the axis between the click and the cell it builds, on away from the click. False
// when it is not in flight. Shared by the cubes and the streamlines.
const VORTEX_UNIT = /* glsl */ `
bool vortexUnit(inout ivec2 c, out vec2 home, out vec2 dest, out float drop, out float ax, out float u) {
  vec2 cell = uGrid.zw, S = uRegion.zw;
  if (uClick > 0.5) {
    if (c.y >= int(uGrid.y)) return false;
    ax = uO.x;
    dest = (vec2(c) + 0.5) * cell;
    drop = (dest.y - uO.y) * VX_CLICK_DROP;
    home = vec2(2.0 * ax - dest.x, dest.y - drop);
    float far = dest.y > uO.y ? S.y - uO.y : uO.y;
    float along = abs(dest.y - uO.y) / max(far, 1.0), across = abs(dest.x - ax) / max(max(ax, S.x - ax), 1.0);
    float v = vortexClickV(vortexClickA(along, across, vortexJit(dest, vec2(c))), uH);
    u = mix(VX_CLICK_U0, 1.0, v);
    return v > 0.0 && v < 1.0;
  }
  int kd = vortexDrop(int(uGrid.y));
  if (c.y >= int(uGrid.y) + kd) return false;
  ax = S.x * 0.5;
  home = (vec2(c) + 0.5) * cell;
  drop = -float(kd) * cell.y;
  dest = vec2(S.x - home.x, home.y + drop);
  u = vortexU(vortexSeamA(home, S, vortexJit(home, vec2(c))), transitP(uH));
  return u > 0.0 && u < 1.0;
}
`;

// Each cube rides the flow: it turns with it about the leaning axis, so after its odd number of half
// turns its paper face is underneath and its other face, carrying the sky of the cell it lands in,
// is up, and it rocks about its own radius on the way. Mid-flight it takes the colour of its speed
// (vortexHue); its sides are liquid chrome. A click's cubes have no paper face.
const CUBES_VS = VHEAD + VORTEX_UNIT + /* glsl */ `
out vec2 vQ;
flat out int vFace;
out vec3 vN;
out vec2 vL;
out float vMid;
out vec3 vHue;
const vec3 NRM[6] = vec3[6](vec3(0, 0, 1), vec3(0, 0, -1), vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 1, 0), vec3(0, -1, 0));
const vec3 TU[6] = vec3[6](vec3(1, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 1, 0), vec3(1, 0, 0), vec3(1, 0, 0));
const vec3 TV[6] = vec3[6](vec3(0, 1, 0), vec3(0, 1, 0), vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1));
float gTh, gTilt, gWob, gTum;
vec3 gTax;
// The cube's frame: tumbled about its own axis (whole turns, so it lands square), rocked about its
// radius, turned with the flow about the axis, leant with it.
vec3 orient(vec3 v) {
  v = rotAxis(v, gTax, gTum);
  v = rotAxis(v, vec3(1.0, 0.0, 0.0), gWob);
  v = rotAxis(v, vec3(0.0, -1.0, 0.0), gTh);
  float ct = cos(gTilt), st = sin(gTilt);
  return vec3(v.x, v.y * ct + v.z * st, v.z * ct - v.y * st);
}
void main() {
  ivec2 c = cellOf(gl_InstanceID + uFirst, int(uGrid.x));
  vec2 home, dest; float drop, ax, u;
  if (!vortexUnit(c, home, dest, drop, ax, u)) { gl_Position = GONE; return; }
  vec2 cell = uGrid.zw;
  float r1 = hash(vec2(c) + 1.7), r2 = hash(vec2(c) + 5.3), r3 = hash(vec2(c) + 9.1);
  float turns = r2 < 0.5 ? 3.0 : 5.0;
  vec3 pos = vortexAt(home, drop, ax, vortexRc(uRegion.zw) * (0.18 + 0.82 * r1), turns, u, gTh, gTilt);
  float k = vortexDepth(u);
  pos.y += k * clamp(uVel, -3.0, 3.0) * 20.0;
  gWob = sin(PI * u) * (r3 - 0.5) * 2.2;
  gTax = normalize(vec3(hash(vec2(c) + 3.1) - 0.5, hash(vec2(c) + 4.2) - 0.5, hash(vec2(c) + 6.4) - 0.5) + 1e-3);
  gTum = TAU * smoother(u) * (r3 < 0.5 ? 1.0 : 2.0);
  // A click's cubes grow out of the core.
  float grow = uClick > 0.5 ? smoothstep(VX_CLICK_U0, VX_CLICK_U0 + 0.12, u) : 1.0;
  int f = gl_VertexID / 6;
  vec2 kq = QUAD[gl_VertexID % 6] * 2.0 - 1.0;
  vec3 n = NRM[f];
  vec3 half_ = vec3(cell * 0.5, min(cell.x, cell.y) * 0.5) * (1.0 - 0.3 * k) * grow;
  vec3 rn = orient(n);
  vec3 faceC = pos + orient(n * half_);
  vec3 eye = vec3(uView * 0.5 - uRegion.xy, FOCAL);
  if (dot(rn, eye - faceC) <= 0.0) { gl_Position = GONE; return; }
  vec3 P = pos + orient((n + TU[f] * kq.x + TV[f] * kq.y) * half_);
  vec2 off = kq * cell * 0.5;
  vFace = f == 0 ? (uClick > 0.5 ? 2 : 0) : f == 1 ? 1 : 2;
  // Half a turn about the upright axis mirrors the back face left to right.
  vQ = f == 0 ? home + off : dest + vec2(-off.x, off.y);
  vN = rn;
  vL = kq;
  vMid = k;
  vHue = vortexHue(vortexSpin(u));
  gl_Position = project(P);
}`;

const CUBES_FS = FHEAD + /* glsl */ `
in vec2 vQ;
flat in int vFace;
in vec3 vN;
in vec2 vL;
in float vMid;
in vec3 vHue;
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
  // The chrome sides glow only in the flow; settling, they darken, so a cube seen edge-on near the
  // screen's edge is a shadow, not a bright bar.
  // A paper cube's sides are paper until it is deep in the flow, so cubes lifting off the page read
  // as paper, not dark bars.
  vec3 side = uClick > 0.5 ? chrome(n) * (0.3 + 0.7 * vMid) : mix(texture(uTexA, tUV(vQ)).rgb * (0.82 + 0.18 * n.z), chrome(n), smoothstep(0.2, 0.7, vMid));
  vec3 base = vFace == 0 ? texture(uTexA, tUV(vQ)).rgb : vFace == 1 ? texture(uTexB, tUV(vQ)).rgb : side;
  vec3 L = normalize(vec3(-0.35, -0.6, 0.72));
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  vec3 lit = base * (0.6 + 0.52 * dif) + spec * 0.4;
  // Its speed, in the flow's colours: strongest on the chrome sides, a wash over the faces.
  vec3 hued = vHue * (0.45 + 0.75 * dif) + spec * 0.55;
  lit = mix(lit, hued, (vFace == 2 ? 0.75 : 0.35) * vMid);
  float edge = smoothstep(0.78, 1.0, max(abs(vL.x), abs(vL.y)));
  lit += vHue * edge * 0.3 * vMid;
  o = vec4(mix(base, lit, smoothstep(0.0, 0.25, vMid)), 1.0);
}`;

// Streamlines: thin ribbons along the same flow, each the last stretch of a path a cube would take,
// as in the figure the vortex follows: teal and wide where it turns slowly, thin and orange at the
// core. They fade in and out with their flight, so the strip is clean at rest.
const STREAKS_VS = VHEAD + VORTEX_UNIT + /* glsl */ `
const int NSEG = 18;
const float TRAIL = 0.24;
out vec3 vCol;
out float vAl;
out float vSide;
float gTh, gTilt;
// A point of the path on screen (CSS px) and how far it stands from the camera (w).
vec3 onScreen(vec2 home, float drop, float ax, float rc, float turns, float u) {
  vec3 p = vortexAt(home, drop, ax, rc, turns, u, gTh, gTilt);
  vec2 v = uRegion.xy + p.xy, ctr = uView * 0.5;
  float w = (FOCAL - min(p.z, 700.0)) / FOCAL;
  return vec3(ctr + (v - ctr) / w, w);
}
void main() {
  ivec2 c = cellOf(gl_InstanceID + uFirst, int(uGrid.x));
  vec2 home, dest; float drop, ax, u;
  if (!vortexUnit(c, home, dest, drop, ax, u)) { gl_Position = GONE; return; }
  float r1 = hash(vec2(c) + 1.7), r2 = hash(vec2(c) + 5.3);
  float turns = r2 < 0.5 ? 3.0 : 5.0;
  float rc = vortexRc(uRegion.zw) * (0.18 + 0.82 * r1);
  int seg = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  float i = float(seg) + k.x;
  float lo = uClick > 0.5 ? VX_CLICK_U0 : 0.0;
  float du = TRAIL / float(NSEG);
  float raw = u - TRAIL + i * du;
  float ui = max(raw, lo);
  vec3 a = onScreen(home, drop, ax, rc, turns, ui);
  vec3 b = onScreen(home, drop, ax, rc, turns, max(ui - du, lo));
  vec3 b2 = onScreen(home, drop, ax, rc, turns, min(ui + du, u));
  vec2 dir = b2.xy - b.xy;
  dir = dot(dir, dir) > 1e-4 ? normalize(dir) : vec2(1.0, 0.0);
  float spin = vortexSpin(ui);
  float side = k.y * 2.0 - 1.0;
  float hw = mix(2.2, 0.8, spin) / a.z;
  vec2 px = a.xy + vec2(-dir.y, dir.x) * side * hw;
  float t = i / float(NSEG);
  float ends = uClick > 0.5 ? smoothstep(VX_CLICK_U0, VX_CLICK_U0 + 0.1, ui) : smoothstep(0.0, 0.06, ui);
  ends *= 1.0 - smoothstep(0.93, 1.0, ui);
  vCol = vortexHue(spin) * (0.85 + 0.35 * t);
  // Nothing before the path began (its tail would bunch up there).
  vAl = pow(t, 1.3) * ends * 0.85 * step(lo, raw);
  vSide = side;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}`;

const STREAKS_FS = FHEAD + /* glsl */ `
in vec3 vCol;
in float vAl;
in float vSide;
void main() {
  float al = vAl * exp(-vSide * vSide * 2.2);
  o = vec4(vCol * al, al);
}`;

// ---- Racing → Outdoors: sheets, layer under layer ---------------------------------------------------
// One draw per layer (uLayer, the lowest first, so the sheets above pass over them), one instance per
// sheet (flight.js sheetAt). Each peels from one corner of its free edge (a page curl: half a turn
// round a cylinder, then laid back over itself), its underside bright gilt; once it lets go it flies
// up and away like paper: unrolling, cupping across, twisting along its length and fluttering as it
// tumbles. Its normal comes from the surface itself, so every bend catches the light. Its face: the
// ice (uTexA), the trail map, the vellum over the Outdoors page (uTexB).
const SHEETS_VS = VHEAD + /* glsl */ `
uniform int uLayer;
const int NS = 30, NW = 12;
out vec2 vQ;
out vec3 vN;
out vec3 vP;
out vec2 vSW;
out float vMid;
out float vCrease;
out float vLift;
vec3 gR;
vec2 gCtr, gCell;
float gRoll, gFly, gSide, gK, gCurl;
vec3 sheetPoint(float s, float w) {
  float rr = gRoll * (1.0 - 0.6 * gFly);
  float f = sheetFront(rr, w, gSide, gK);
  float L = gCell.y, R = L * gCurl;
  float x = gCtr.x - gCell.x * 0.5 + w * gCell.x, hinge = gCtr.y + gCell.y * 0.5;
  float yf = hinge - f * L, a = (s - f) * L;
  vec3 P;
  if (s <= f) P = vec3(x, hinge - s * L, 0.0);
  else if (a < PI * R) { float th = a / R; P = vec3(x, yf - R * sin(th), R * (1.0 - cos(th))); }
  else P = vec3(x, yf + (a - PI * R), 2.0 * R);
  if (gFly > 0.0) {
    vec3 c0 = vec3(gCtr.x, hinge - L * 0.5, R);
    vec3 d = P - c0;
    d.z += (w - 0.5) * (w - 0.5) * gCell.x * 1.4 * gFly * (gR.x - 0.35);
    d = rotAxis(d, vec3(0.0, 1.0, 0.0), gFly * (gR.y - 0.5) * 2.6 * (s - 0.5));
    d.z += gFly * (12.0 + 26.0 * gR.z) * sin(TAU * (s * 1.3 + w * 0.35) - uTime * 5.0 + gR.x * 6.3);
    vec3 ax = normalize(vec3(1.0, (gR.y - 0.5) * 1.2, (gR.z - 0.5) * 0.6));
    d = rotAxis(d, ax, gFly * PI * (1.0 + 1.4 * gR.y));
    P = c0 + d + vec3((gR.x - 0.5) * 240.0 * gFly + sin(uTime * 1.7 + gR.z * 9.0) * 10.0 * gFly,
                      -gFly * gFly * (hinge + L * 2.0), gFly * 300.0);
  }
  return P;
}
void main() {
  vec2 S = uRegion.zw;
  vec4 g = layerGrid(uLayer, S);
  int cols = int(g.x) + 1, rows = int(g.y);
  int id = gl_InstanceID;
  ivec2 c = ivec2(cols - 1 - id % cols, id / cols);
  if (c.y >= rows || (c.y % 2 == 0 && c.x == cols - 1)) { gl_Position = GONE; return; }
  gCtr = paneCentre(c, g);
  gCell = g.zw;
  float u = flightAt(layerA(uLayer, gCtr, S, sheetSeed(uLayer, c)), 0.5, transitP(uH));
  if (u <= 0.0 || u >= 1.0) { gl_Position = GONE; return; }
  gR = vec3(hash(vec2(c) + 2.9 + float(uLayer)), hash(vec2(c) + 7.7 + float(uLayer)), hash(vec2(c) + 4.4 + float(uLayer)));
  gSide = step(0.5, hash(vec2(c) + 2.9 + float(uLayer)));
  gK = sheetLead(uLayer, c);
  gCurl = sheetCurl(uLayer, c);
  gRoll = paneRoll(u);
  gFly = sheetFly(u);
  int qd = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  float w = (float(qd % NW) + k.x) / float(NW);
  float s = (float(qd / NW) + k.y) / float(NS);
  vec3 P = sheetPoint(s, w);
  float e = 0.004;
  vec3 Ps = sheetPoint(min(s + e, 1.0), w) - sheetPoint(max(s - e, 0.0), w);
  vec3 Pw = sheetPoint(s, min(w + e, 1.0)) - sheetPoint(s, max(w - e, 0.0));
  vec3 N = normalize(cross(Ps, Pw) + vec3(0.0, 0.0, 1e-6));
  float f = sheetFront(gRoll * (1.0 - 0.6 * gFly), w, gSide, gK);
  vCrease = exp(-abs(s - f) * gCell.y / 5.0) * smoothstep(0.0, 0.06, gRoll) * (1.0 - gFly);
  vQ = vec2(gCtr.x - gCell.x * 0.5 + w * gCell.x, gCtr.y + gCell.y * 0.5 - s * gCell.y);
  vN = N;
  vP = P;
  vSW = vec2(s, w);
  vMid = sin(PI * u);
  vLift = max(smoothstep(f, f + 0.03, s), gFly);
  gl_Position = project(P);
}`;

const SHEETS_FS = FHEAD + NOISE + FLIGHT + /* glsl */ `
uniform int uLayer;
in vec2 vQ;
in vec3 vN;
in vec3 vP;
in vec2 vSW;
in float vMid;
in float vCrease;
in float vLift;
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  // Still lying under a sheet of the layer above: hidden.
  float P = transitP(uH);
  for (int j = 0; j < SHEET_LAYERS; j++) {
    if (j >= uLayer) break;
    if (vLift < 0.5 && sheetHere(sheetAt(j, vQ, uRegion.zw, P))) discard;
  }
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
  vec2 gc = floor(vQ * 0.42);
  vec3 gn = normalize(n + vec3(vec2(h21(gc), h21(gc + 7.3)) - 0.5, 0.0) * 0.9);
  float glit = pow(max(dot(gn, H), 0.0), 380.0) * step(0.8, h21(gc + 3.1)) * 7.0;
  float e = min(min(vSW.x, 1.0 - vSW.x), min(vSW.y, 1.0 - vSW.y));
  vec3 col;
  if (front) {
    vec3 face = uLayer == 0 ? texture(uTexA, tUV(vQ)).rgb : uLayer == 1 ? topoMap(vQ) : vellum(texture(uTexB, tUV(vQ)).rgb, vQ);
    vec3 tint = uLayer == 0 ? vec3(0.62, 0.8, 0.96) : vec3(1.0);
    vec3 lit = face * tint * (0.55 + 0.5 * dif);
    if (uLayer == 0) lit = mix(lit, vec3(0.16, 0.42, 0.74), smoothstep(0.22, 0.0, e) * 0.5);
    lit += vec3(0.9, 0.97, 1.0) * (fres * 0.4 + smoothstep(0.025, 0.0, e) * 0.6) + vec3(1.0, 0.95, 0.85) * spec * (uLayer == 0 ? 1.3 : 0.5);
    if (uLayer == 0) lit += spectrum(nv * 2.2 + vSW.y * 0.7) * fres * 0.4 + vec3(0.9, 0.97, 1.0) * glit;
    col = mix(face + (uLayer == 0 ? vec3(0.9, 0.97, 1.0) * glit * 0.4 : vec3(0.0)), lit, max(vLift, smoothstep(0.0, 1.0, vCrease)));
  } else if (uLayer == 0) {
    // The ice's underside: gilt, brushed along the roll, with the engraving pressed in.
    vec3 plate = texture(uTexB, tUV(vQ)).rgb;
    float l = dot(plate, vec3(0.299, 0.587, 0.114));
    vec3 gold = mix(vec3(0.42, 0.29, 0.11), vec3(0.95, 0.76, 0.4), 0.25 + 0.75 * dif);
    float brushed = pow(max(dot(n, H), 0.0), 18.0) * (0.6 + 0.4 * sin(vQ.x * 0.9 + vQ.y * 0.15));
    col = gold * (0.25 + 1.6 * l) + vec3(1.0, 0.93, 0.76) * (brushed * 0.2 + spec * 0.5 + glit * 0.9) + spectrum(fres * 1.5 + vSW.x) * fres * 0.3;
    col = mix(col, BRASS * 1.3, smoothstep(0.03, 0.0, e) * 0.6);
  } else {
    // Paper's back: the map's cream, its printing showing faintly through, mirrored; the vellum's pale
    // and translucent. Shaded by how it faces the lamp, so a curl reads by its light.
    vec3 back = uLayer == 1 ? mix(vec3(0.9, 0.87, 0.79), topoMap(vec2(2.0 * floor(vQ.x / 400.0) * 400.0 + 400.0 - vQ.x, vQ.y)), 0.18)
                            : vellum(texture(uTexB, tUV(vQ)).rgb * 0.6, vQ) * 1.05;
    col = back * (0.5 + 0.55 * dif) + vec3(1.0, 0.97, 0.9) * (spec * 0.35 + fres * 0.18);
  }
  col += vec3(1.0, 0.96, 0.86) * vCrease * 0.7;
  o = vec4(col, 1.0);
}`;

// Ice dust: where a sheet of ice rolls, a few of its facets break loose and drift down, twinkling,
// then fade. uGrid is the dust's own grid.
const GLITTER_VS = VHEAD + /* glsl */ `
out vec2 vK;
out vec3 vCol;
void main() {
  int cols = int(uGrid.x);
  ivec2 c = cellOf(gl_InstanceID + uFirst, cols);
  if (c.y >= int(uGrid.y) || hash(vec2(c) + 6.6) > 0.22) { gl_Position = GONE; return; }
  vec2 home = (vec2(c) + hash2(vec2(c) + 2.2)) * uGrid.zw;
  SheetAt a = sheetAt(0, home, uRegion.zw, transitP(uH));
  if (a.u <= 0.0 || a.u >= 1.0) { gl_Position = GONE; return; }
  // It breaks loose when the roll's front passes it.
  float roll = paneRoll(a.u);
  float loose = (1.0 - a.s + a.K * mix(a.w, 1.0 - a.w, a.side)) / (1.0 + a.K);
  float t = (roll - loose) / 0.35;
  if (t <= 0.0 || t >= 1.0) { gl_Position = GONE; return; }
  float r = hash(vec2(c) + 4.4);
  vec2 p = home + swirl(home * 1.3 + r * 20.0, uTime * 0.6) * t * 40.0 + vec2((r - 0.5) * 30.0, 70.0 * t * t);
  float tw = pow(0.5 + 0.5 * sin(uTime * (9.0 + 14.0 * r) + r * 40.0), 6.0);
  vec3 col = mix(vec3(0.85, 0.95, 1.0), gspec(r + uTime * 0.2), 0.35);
  vCol = col * (0.25 + 1.6 * tw) * (1.0 - t) * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.85, 1.0, a.u));
  vK = QUAD[gl_VertexID % 6] * 2.0 - 1.0;
  gl_Position = project(vec3(p + vK * (1.2 + 2.2 * r) * (1.0 + tw), t * 120.0 * r));
}`.replace('void main() {', 'vec3 gspec(float x) { return 0.5 + 0.5 * cos(TAU * (x + vec3(0.0, 0.33, 0.67))); }\nvoid main() {');

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
  if (c.y >= int(uGrid.y) || hash(vec2(c) + 5.5) > 0.55) { gl_Position = GONE; return; }
  vec2 seed = (vec2(c) + hash2(vec2(c) + 7.3)) * uGrid.zw;
  float P = transitP(uH);
  float u = seamU(seed, hash(vec2(c) + 0.8), P);
  // Once grown, a stroke stays, bled into the wash, until the ink lets go as Chess arrives.
  if (u <= 0.1 || P > 1.02) { gl_Position = GONE; return; }
  float r = hash(vec2(c) + 2.6);
  float grow = smoothstep(0.1, 0.62, u);
  float fade = 1.0 - smoothstep(0.86, 1.02, P);
  float bleed = smoothstep(0.55, 1.0, u);
  float len = (110.0 + 260.0 * r) * grow;
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
  float wid = (0.4 + 3.8 * pow(s, 2.5)) * (1.0 + 2.2 * bleed) * (0.7 + 0.6 * r);
  float side = k.y * 2.0 - 1.0;
  p += nrm * side * wid;
  vec3 from = texture(uTexA, tUV(seed)).rgb;
  vec3 tone = mix(INK_BLACK_V, INK_INDIGO_V, r * 0.7);
  vCol = mix(from, tone, smoothstep(0.12, 0.5, u));
  vAl = (0.45 + 0.35 * r) * fade * (0.25 + 0.75 * s) * smoothstep(0.0, 0.1, grow) * (1.0 - 0.82 * bleed);
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

// The vortex's body (About Me → Science): flow lines on a perpetual loop, from wide at its base at
// the foot of the screen, in and up the core, quickening and stretching, to its top (flight.js
// vortexTop), where they spray out. They run on the clock, so the vortex keeps turning while the page
// is still, and reach as high as the seam has grown it: one vortex from base to top, never in pieces.
// uGrid.x * uGrid.y lines.
const FLOW_VS = VHEAD + /* glsl */ `
const int NSEG = 20;
const float TRAIL = 0.16;
out vec3 vCol;
out float vAl;
out float vSide;
vec3 flowAt(float s, float R0, float th0, float turns, float yb, float yt, float ax) {
  float k = smoothstep(0.0, 0.5, s);
  float r = mix(R0, R0 * 0.1 + 5.0, k) + smoothstep(0.84, 1.0, s) * R0 * 0.8;
  float y = mix(yb, yt, pow(s, 1.5));
  float th = th0 + turns * TAU * (0.3 * s + 0.7 * smoothstep(0.05, 0.92, s));
  float Z = r * sin(th) * 0.75;
  return vec3(ax + r * cos(th), y + Z * sin(VX_TILT), Z * cos(VX_TILT));
}
vec3 onScreen(vec3 p) {
  vec2 v = uRegion.xy + p.xy, ctr = uView * 0.5;
  float w = (FOCAL - min(p.z, 700.0)) / FOCAL;
  return vec3(ctr + (v - ctr) / w, w);
}
void main() {
  float id = float(gl_InstanceID);
  float r1 = hash(vec2(id, 1.3)), r2 = hash(vec2(id, 2.9)), r3 = hash(vec2(id, 4.1)), r4 = hash(vec2(id, 6.7));
  vec2 S = uRegion.zw;
  float P = transitP(uH);
  float life = smoothstep(-0.2, -0.04, P) * (1.0 - smoothstep(0.85, 1.02, P));
  if (life <= 0.0 || gl_InstanceID >= int(uGrid.x * uGrid.y)) { gl_Position = GONE; return; }
  float yb = S.y + 20.0, yt = vortexTop(P, S), span = yb - yt;
  // Its base widens as it grows; it starts as a small swirl at the foot.
  float R0 = (0.15 + 0.85 * r1) * min(S.x * 0.48, 60.0 + span * 0.55);
  float turns = 1.5 + 2.0 * r2, th0 = r4 * TAU;
  float s = fract(uTime * (0.07 + 0.06 * r2) + r3);
  int seg = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  float i = float(seg) + k.x, du = TRAIL / float(NSEG);
  float si = s - TRAIL + i * du;
  float sc = clamp(si, 0.0, 1.0);
  vec3 a = onScreen(flowAt(sc, R0, th0, turns, yb, yt, S.x * 0.5));
  vec3 b = onScreen(flowAt(clamp(sc - du, 0.0, 1.0), R0, th0, turns, yb, yt, S.x * 0.5));
  vec3 b2 = onScreen(flowAt(clamp(sc + du, 0.0, 1.0), R0, th0, turns, yb, yt, S.x * 0.5));
  vec2 dir = b2.xy - b.xy;
  dir = dot(dir, dir) > 1e-4 ? normalize(dir) : vec2(1.0, 0.0);
  float spin = smoothstep(0.08, 0.6, sc) * (1.0 - smoothstep(0.85, 1.0, sc) * 0.6);
  float side = k.y * 2.0 - 1.0;
  float hw = mix(1.8, 0.7, spin) / a.z;
  vec2 px = a.xy + vec2(-dir.y, dir.x) * side * hw;
  float t = i / float(NSEG);
  vCol = vortexHue(spin) * (0.85 + 0.35 * t);
  vAl = pow(t, 1.3) * life * 0.75 * step(0.0, si) * smoothstep(0.0, 0.05, sc) * (1.0 - smoothstep(0.92, 1.0, sc));
  vSide = side;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}`;

// ---- Outdoors → Photography: film strips ---------------------------------------------------------
// One instance per strip (flight.js film): the part pulled off the table, from its pulled end to where
// it leaves the table, laid along a rising helix that heads back over the table and up, twisting about
// itself and rippling, so the strips coil up the screen like film off a reel. Glossy celluloid: the
// negative on its face (sprocket holes cut through), the dull base behind.
const FILM_VS = VHEAD + /* glsl */ `
const int NL = 120;
out vec2 vQ;
out vec3 vN;
out vec3 vP;
out float vNeg;
float gRh, gRise, gTw, gE;
vec3 gL;
// The film's centre line d px along it from where it leaves the table, and its frame there.
void filmFrame(float d, out vec3 c, out vec3 T, out vec3 B) {
  float a = d / gRh;
  c = gL + vec3(gE * gRh * sin(a), -d * gRise, gRh * (1.0 - cos(a)) * 0.9);
  T = normalize(vec3(gE * cos(a), -gRise, sin(a) * 0.9));
  vec3 b0 = normalize(vec3(0.0, 1.0, 0.0) - T * T.y);
  B = rotAxis(b0, T, gTw * d);
}
void main() {
  vec2 S = uRegion.zw;
  vec4 g = filmGrid(S);
  int r = gl_InstanceID;
  if (r >= int(g.y)) { gl_Position = GONE; return; }
  float P = transitP(uH), A = filmA(r, g, S), u = filmU(A, P);
  if (u <= 0.0 || u >= 1.0) { gl_Position = GONE; return; }
  float side = filmSide(r), pulled = filmPulled(u, S.x);
  float r1 = hash(vec2(float(r), 1.1)), r2 = hash(vec2(float(r), 2.2)), r3 = hash(vec2(float(r), 3.3));
  gRh = 130.0 + 150.0 * r1; gRise = 0.26 + 0.2 * r2; gTw = (r3 - 0.5) * 0.012; gE = -side;
  float y0 = (float(r) + 0.5) * g.w, h = g.w;
  float lift = min(pulled, S.x);
  gL = vec3(side > 0.0 ? lift : S.x - lift, y0, 0.0);
  int seg = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  // Along the strip from its pulled end (l), across it (v).
  float l = (float(seg) + k.x) / float(NL) * lift;
  float v = k.y - 0.5;
  float d = pulled - l;
  vec3 c, T, B;
  filmFrame(d, c, T, B);
  vec3 N = normalize(cross(T, B));
  c += N * 7.0 * sin(d * 0.028 - uTime * 3.0 + r1 * 6.3) * smoothstep(0.0, 120.0, d);
  vec3 Pp = c + B * v * h;
  vQ = vec2(side > 0.0 ? l : S.x - l, y0 + v * h);
  vN = N;
  vP = Pp;
  vNeg = filmNeg(A, P);
  gl_Position = project(Pp);
}`;

const FILM_FS = FHEAD + NOISE + FLIGHT + /* glsl */ `
in vec2 vQ;
in vec3 vN;
in vec3 vP;
in float vNeg;
void main() {
  vec2 S = uRegion.zw;
  vec4 g = filmGrid(S);
  vec4 f = filmLook(texture(uTexA, tUV(vQ)).rgb, vQ, g.w, max(vNeg, 0.999));
  if (f.a > 0.5) discard;
  vec3 n = normalize(vN);
  vec3 V = normalize(vec3(uView * 0.5 - uRegion.xy, 1100.0) - vP);
  bool front = dot(n, V) > 0.0;
  if (!front) n = -n;
  vec3 lamp = normalize(vec3(0.3, -0.6, 0.74));
  vec3 H = normalize(lamp + V);
  float dif = max(dot(n, lamp), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 90.0);
  float fres = pow(1.0 - abs(dot(n, V)), 4.0);
  vec3 base = front ? f.rgb : vec3(0.16, 0.1, 0.07) + f.rgb * 0.12;
  vec3 col = base * (0.45 + 0.6 * dif) + vec3(1.0, 0.93, 0.85) * (spec * 0.9 + fres * 0.25) + DR_RED * 0.12 * (1.0 - dif);
  o = vec4(col, 1.0);
}`;

// blend: 'opaque', 'over' (premultiplied) or 'add'. grid: which uniform holds the instance grid.
export const UNIT_PROGRAMS = {
  cubes: { vs: CUBES_VS, fs: CUBES_FS, verts: 36, blend: 'opaque' },
  streaks: { vs: STREAKS_VS, fs: STREAKS_FS, verts: 18 * 6, blend: 'over' },
  flow: { vs: FLOW_VS, fs: STREAKS_FS, verts: 20 * 6, blend: 'over' },
  film: { vs: FILM_VS, fs: FILM_FS, verts: 120 * 6, blend: 'opaque' },   // instances: the rows of film
  sheets: { vs: SHEETS_VS, fs: SHEETS_FS, verts: 30 * 12 * 6, blend: 'opaque' },   // per layer, instances: rows × (cols + 1)
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
  if (uPolar == 1) r = reachPolar(q, uO, uFar, 0.0);
  else r = reachFoot(q, uSize, 0.0);
  o = vec4(min(r.d, 63.75) / 64.0, min(r.w, 23.9) / 24.0, r.tb, r.A);
}`;
