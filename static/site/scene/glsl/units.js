// Transit units: the pieces that fly across a seam, one program per kind, drawn instanced over the
// seam's ground (transit.js). Each unit's place is computed from its seed and the seam's progress
// alone (no state), so scrolling back un-builds it. A unit carries the upper world's colour where it
// leaves and the lower world's where it lands, read from the snapshots (uTexA, uTexB).
//
// Space: the strip in CSS px (x right, y down) with z toward the viewer; project() adds the
// perspective of a camera FOCAL px in front of the screen's centre.
import { NOISE } from './common.js';
import { FLIGHT, SEAM_TEX } from './flight.js';
import { DEW, FIELD, FREEZE, CLICK, SKY } from '../dew-plan.js';
import { PALETTE, rgb } from '../palette.js';
import { FIRE_UNITS } from './fire.js';
const pv3 = h => `vec3(${rgb(h).map(x => x.toFixed(4)).join(', ')})`;

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
uniform int uPass;        // Science's cubes: 0 those behind the axis, 1 those in front, 2 all
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
// Which cube an instance is, where it leaves and where it lands, and its flight u; false when it is
// not in flight. A seam's: one a cell, as planned (lerp.js vortexPlan, in uReach: the cell it lands
// on, when it leaves, and, at that cell, when it lands). A click's: out of the axis between the click
// and the cell it builds, on away from the click (vortexAt). Shared by the cubes and a click's
// streamlines.
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
  if (c.y >= int(uGrid.y)) return false;
  vec4 plan = texelFetch(uReach, c, 0);
  int di = int(plan.x + 0.5), cols = int(uGrid.x);
  ivec2 d = ivec2(di % cols, di / cols);
  float land = texelFetch(uReach, d, 0).z;
  ax = S.x * 0.5;
  home = (vec2(c) + 0.5) * cell;
  dest = (vec2(d) + 0.5) * cell;
  drop = 0.0;
  u = clamp((transitP(uH) - plan.y) / max(land - plan.y, 1e-3), 0.0, 1.0);
  return u > 0.0 && u < 1.0;
}
`;

// Each cube rides the flow: it turns with it about the leaning axis, so after its odd number of half
// turns its paper face is underneath and its other face, carrying the sky of the cell it lands in,
// is up, and it rocks about its own radius on the way; its sides are liquid chrome. A click's take
// the colour of their speed (vortexHue) and have no paper face. A seam's ride the ring (vortexOrbit),
// a little larger in the wind, their edges catching a warm light against the cool wind, drawn in two
// passes round it (uPass): those behind the axis first, as a see-through shell of pale glass, and
// those in front after it, solid.
const CUBES_VS = VHEAD + VORTEX_UNIT + /* glsl */ `
out vec2 vQ;
flat out int vFace;
out vec3 vN;
out vec2 vL;
out float vMid;
out vec3 vHue;
out float vBack;
out float vAl;
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
  float r1 = hash(vec2(c) + 1.7), r3 = hash(vec2(c) + 9.1);
  // Its own pace and place round the axis, so the cubes swirl through the vortex, not as rows.
  vec3 ch = vortexCharacter(vec2(c));
  u = vortexPace(u, ch.x);
  vec3 pos;
  float k, spin;
  vAl = 1.0;
  vBack = 0.0;
  if (uClick > 0.5) {
    pos = vortexAt(home, drop, ax, vortexRc(uRegion.zw) * (0.35 + 0.65 * r1), ch.z, ch.y, u, gTh, gTilt);
    k = vortexDepth(u);
    spin = vortexSpin(u);
  } else {
    float rad;
    pos = vortexOrbit(home, dest, vec2(c), u, transitP(uH), uTime, uRegion.zw, gTh, k, rad);
    gTilt = VX_TILT * k;
    spin = 0.3 + 0.2 * r1;
    // Restless in the wind, even while the page is still.
    float ph = r3 * TAU;
    pos += k * vec3(sin(uTime * 1.7 + ph) * 6.0, sin(uTime * 2.3 + ph * 1.3) * 8.0, sin(uTime * 1.3 + ph * 0.7) * 6.0);
    if ((uPass == 0 && pos.z >= 0.0) || (uPass == 1 && pos.z < 0.0)) { gl_Position = GONE; return; }
    // Solid in front of the axis; round the back, a see-through shell.
    vBack = k * (1.0 - smoothstep(-0.35 * rad, 0.05 * rad, pos.z));
    vAl = 1.0 - 0.62 * vBack;
  }
  pos.y += k * clamp(uVel, -3.0, 3.0) * 20.0;
  gWob = sin(PI * u) * (r3 - 0.5) * 2.2;
  gTax = normalize(vec3(hash(vec2(c) + 3.1) - 0.5, hash(vec2(c) + 4.2) - 0.5, hash(vec2(c) + 6.4) - 0.5) + 1e-3);
  gTum = TAU * smoother(u) * (r3 < 0.5 ? 1.0 : 2.0);
  // A click's cubes grow out of the core.
  float grow = uClick > 0.5 ? smoothstep(VX_CLICK_U0, VX_CLICK_U0 + 0.12, u) : 1.0;
  int f = gl_VertexID / 6;
  vec2 kq = QUAD[gl_VertexID % 6] * 2.0 - 1.0;
  vec3 n = NRM[f];
  vec3 half_ = vec3(cell * 0.5, min(cell.x, cell.y) * 0.5) * (uClick > 0.5 ? 1.0 - 0.3 * k : 1.0 + 0.12 * k) * grow;
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
  vHue = vortexHue(spin);
  gl_Position = project(P);
}`;

const CUBES_FS = FHEAD + NOISE + FLIGHT + /* glsl */ `
in vec2 vQ;
flat in int vFace;
in vec3 vN;
in vec2 vL;
in float vMid;
in vec3 vHue;
in float vBack;
in float vAl;
// Science's chrome (palette.js): what it reflects, a rim light each side, its thin film's sheen.
vec3 chrome(vec3 n) {
  float up = -n.y;
  vec3 c = mix(${pv3(PALETTE.env.low)}, ${pv3(PALETTE.env.high)} * 0.85, smoothstep(-0.3, 0.9, up));
  c += ${pv3(PALETTE.env.rim)} * pow(max(n.x, 0.0), 3.0) * 0.85;
  c += ${pv3(PALETTE.env.top)} * pow(max(-n.x, 0.0), 4.0) * 0.45;
  float fz = fract(n.z * 1.3 + up * 0.4) * 2.0;
  c += mix(mix(${pv3(PALETTE.film[0])}, ${pv3(PALETTE.film[2])}, smoothstep(0.0, 1.0, fz)), ${pv3(PALETTE.film[0])}, smoothstep(1.0, 2.0, fz)) * 0.16;
  return c;
}
void main() {
  vec3 n = normalize(vN);
  // The chrome sides glow only in the flow; settling, they darken, so a cube seen edge-on near the
  // screen's edge is a shadow, not a bright bar.
  // A paper cube's sides are paper until it is deep in the flow, so cubes lifting off the page read
  // as paper, not dark bars.
  vec3 side = uClick > 0.5 ? chrome(n) * (0.3 + 0.7 * vMid) : mix(texture(uTexA, tUV(vQ)).rgb * (0.82 + 0.18 * n.z), chrome(n), smoothstep(0.2, 0.7, vMid));
  // A seam's cube carries Science blurred, as its cell will be until the vortex sharpens it.
  vec3 base = vFace == 0 ? texture(uTexA, tUV(vQ)).rgb : vFace == 1 ? (uClick > 0.5 ? texture(uTexB, tUV(vQ)).rgb : vortexBlur(uTexB, vQ, uRegion.zw, 1.0)) : side;
  vec3 L = normalize(vec3(-0.35, -0.6, 0.72));
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  vec3 lit = base * (0.6 + 0.52 * dif) + spec * 0.4;
  // Its speed, in the flow's colours: strongest on the chrome sides, a wash over the faces. A seam's
  // keep more of their chrome, and their edges catch a warm light.
  bool seam = uClick < 0.5;
  vec3 hued = vHue * (0.45 + 0.75 * dif) + spec * 0.55;
  lit = mix(lit, hued, (vFace == 2 ? (seam ? 0.4 : 0.75) : (seam ? 0.18 : 0.35)) * vMid);
  float edge = smoothstep(seam ? 0.7 : 0.78, 1.0, max(abs(vL.x), abs(vL.y)));
  lit += (seam ? vec3(1.0, 0.6, 0.22) * 0.65 : vHue * 0.3) * edge * vMid;
  if (seam) lit += spec * 0.35 * vMid;
  vec3 col = mix(base, lit, smoothstep(0.0, 0.25, vMid));
  // Round the back: pale glass in the wind's colours.
  col = mix(col, vHue * 0.55 + 0.42, 0.6 * vBack);
  o = vec4(col * vAl, vAl);
}`;

// A click's streamlines: thin ribbons along the same flow, each the last stretch of a path a cube
// would take, as in the figure the vortex follows: teal and wide where it turns slowly, thin and
// orange at the core. They fade in and out with their flight, so the screen is clean at rest.
const STREAKS_VS = VHEAD + VORTEX_UNIT + /* glsl */ `
const int NSEG = 18;
const float TRAIL = 0.24;
out vec3 vCol;
out float vAl;
out float vSide;
float gTh, gTilt;
vec3 gCh;
// A point of the path on screen (CSS px) and how far it stands from the camera (w).
vec3 onScreen(vec2 home, float drop, float ax, float rc, float turns, float u) {
  vec3 p = vortexAt(home, drop, ax, rc, turns, gCh.y, vortexPace(u, gCh.x), gTh, gTilt);
  vec2 v = uRegion.xy + p.xy, ctr = uView * 0.5;
  float w = (FOCAL - min(p.z, 700.0)) / FOCAL;
  return vec3(ctr + (v - ctr) / w, w);
}
void main() {
  ivec2 c = cellOf(gl_InstanceID + uFirst, int(uGrid.x));
  vec2 home, dest; float drop, ax, u;
  if (!vortexUnit(c, home, dest, drop, ax, u)) { gl_Position = GONE; return; }
  float r1 = hash(vec2(c) + 1.7);
  gCh = vortexCharacter(vec2(c));
  float turns = gCh.z;
  float rc = vortexRc(uRegion.zw) * (0.35 + 0.65 * r1);
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
  float spin = vortexSpin(vortexPace(ui, gCh.x));
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

// The vortex's body (About Me → Science): flow lines on a perpetual loop, from wide at its base at
// the foot of the screen, in and up the core, quickening and stretching, to its top (flight.js
// vortexBand), where they spray out. They run on the clock, so the vortex keeps turning while the page
// is still, and reach as high as the seam has grown it: one vortex from base to top, never in pieces.
// uGrid.x * uGrid.y lines.
const FLOW_VS = VHEAD + /* glsl */ `
const int NSEG = 22;
const float TRAIL = 0.2;
out vec3 vCol;
out float vAl;
out float vSide;
float gSpin, gBuf;
// A line of wind at s along its loop: in from wide at the base, closing in fast like a trumpet (the
// shape the cubes ride: flight.js vortexFunnel), up the core, quickening, and out at the top into the
// whirling rim the vortex climbs by. All of it turns with the vortex's spin (gSpin: the clock and the
// scroll), and gusts shake it.
vec3 flowAt(float s, float R0, float th0, float turns, float yb, float yt, float ax) {
  float k = min(s / 0.85, 1.0);
  float y = mix(yb, yt, pow(k, 1.15));
  float r = mix(R0, R0 * 0.1 + 6.0, 1.0 - pow(1.0 - min(k / 0.55, 1.0), 2.6));
  float rim = smoothstep(0.78, 1.0, s);
  r = mix(r, R0 * (0.85 + 0.3 * gBuf), rim);
  // The rim lifts a little as it flares.
  y -= rim * 0.07 * uRegion.w;
  float th = th0 + gSpin + turns * TAU * (0.3 * s + 0.7 * smoothstep(0.05, 0.92, s)) + rim * 2.5;
  // Gusts.
  r += sin(s * 31.0 + uTime * 9.0 + th0 * 7.0) * (4.0 + 0.04 * R0);
  y += sin(s * 23.0 - uTime * 7.0 + th0 * 5.0) * 5.0;
  float Z = r * sin(th) * 0.8;
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
  // Its spin: on the clock and with the scroll, so scrolling winds it up.
  gSpin = uTime * 1.4 + P * 50.0;
  // The wind's band: its base on the foot and its top climbing, until its base subsides up behind the
  // built page.
  vec2 band = vortexBand(P, S);
  float yb = band.y, yt = band.x, span = yb - yt;
  float life = smoothstep(0.0, 24.0, span) * step(-0.2 * S.y, yb);
  if (life <= 0.0) { gl_Position = GONE; return; }
  // It is born a ring of wind spinning flat at the foot, and the funnel rises from that ring's edge.
  float R0 = (0.25 + 0.75 * r1) * vortexWide(band, S);
  float turns = 1.5 + 2.5 * r2, th0 = r4 * TAU;
  gBuf = r3;
  float s = fract(uTime * (0.11 + 0.09 * r2) + P * 1.5 + r3);
  int seg = gl_VertexID / 6;
  vec2 k = QUAD[gl_VertexID % 6];
  float i = float(seg) + k.x, du = TRAIL / float(NSEG);
  float si = s - TRAIL + i * du;
  float sc = clamp(si, 0.0, 1.0);
  vec3 p3 = flowAt(sc, R0, th0, turns, yb, yt, S.x * 0.5);
  vec3 a = onScreen(p3);
  vec3 b = onScreen(flowAt(clamp(sc - du, 0.0, 1.0), R0, th0, turns, yb, yt, S.x * 0.5));
  vec3 b2 = onScreen(flowAt(clamp(sc + du, 0.0, 1.0), R0, th0, turns, yb, yt, S.x * 0.5));
  vec2 dir = b2.xy - b.xy;
  dir = dot(dir, dir) > 1e-4 ? normalize(dir) : vec2(1.0, 0.0);
  float spin = smoothstep(0.08, 0.6, sc) * (1.0 - smoothstep(0.85, 1.0, sc) * 0.5);
  float side = k.y * 2.0 - 1.0;
  float hw = mix(2.2, 0.9, spin) / a.z;
  vec2 px = a.xy + vec2(-dir.y, dir.x) * side * hw;
  float t = i / float(NSEG);
  // Behind the axis it dims, so you see the wind go round the back.
  float front = smoothstep(-R0 * 0.6, R0 * 0.4, p3.z);
  vCol = vortexHue(spin) * (0.85 + 0.45 * t) * (0.45 + 0.55 * front);
  vAl = pow(t, 1.2) * life * 0.85 * (0.5 + 0.5 * front) * step(0.0, si) * smoothstep(0.0, 0.04, sc) * (1.0 - smoothstep(0.95, 1.0, sc));
  // A little fainter round the core's foot, where most cubes ride, so they stand out.
  vAl *= 1.0 - 0.3 * exp(-pow((sc - 0.22) / 0.12, 2.0));
  vSide = side;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}`;

// ---- Science → Racing: the drops, cold from the card, the vacuum ------------------------------------
// The clumps' drops and the stars' beads (the plan's records); each freezing as the front from Racing's
// card reaches it and splitting into shards; the shards pulled along the field into the card, the
// lines they ride lit behind them. Positions in plan px, drawn in the strip's px.
const SNOW_FS = /* glsl */ `
uniform sampler2D uGas;
vec3 snowLin(vec3 c) { return c * c; }
vec3 snowDisp(vec3 c) { return sqrt(max(c, 0.0)); }
`;
const SNOW_HEAD = /* glsl */ `
vec4 dd(int i) { return texelFetch(uReach, ivec2(i % 1024, i / 1024), 0); }
int shardBase() { return int(dd(18).y); }
// A click's clocks (dew-plan.js CLICK): how far out from the click (0 .. 1 at the farthest corner).
float clickUp(vec2 p) { return clamp(length(p - uO) / max(length(max(uO, uView - uO)), 1.0), 0.0, 1.0); }
float clickSpots(float up) { return ${CLICK.echo[0].toFixed(4)} + ${CLICK.echo[1].toFixed(4)} * up + ${CLICK.spots.toFixed(4)}; }
float clickFreeze(float up) { return ${CLICK.freeze[0].toFixed(4)} + ${CLICK.freeze[1].toFixed(4)} * up; }
float clickFlight(float up) { return ${CLICK.fly[0].toFixed(4)} + ${CLICK.fly[1].toFixed(4)} * up * up; }
int shardCount() { return int(dd(18).z); }
// Point i (0..15) of shard k's path (equal steps of its time), plan px.
vec2 shardPt(int base, int i) { vec4 t = dd(base + 3 + i / 2); return (i & 1) == 0 ? t.xy : t.zw; }
// Where it is u of the way through its flight, its direction there and its speed (Catmull–Rom through
// the points; their spacing is its speed).
vec2 shardAt(int base, float u, out vec2 tang, out float speed) {
  float f = clamp(u, 0.0, 1.0) * 15.0;
  int i = int(min(floor(f), 14.0));
  float t = f - float(i);
  vec2 p0 = shardPt(base, max(i - 1, 0)), p1 = shardPt(base, i), p2 = shardPt(base, i + 1), p3 = shardPt(base, min(i + 2, 15));
  vec2 a = 2.0 * p1, b = p2 - p0, c = 2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3, d = -p0 + 3.0 * p1 - 3.0 * p2 + p3;
  tang = .5 * (b + 2.0 * c * t + 3.0 * d * t * t);
  speed = length(tang);
  tang = speed > 1e-4 ? tang / speed : vec2(1.0, 0.0);
  return .5 * (a + b * t + c * t * t + d * t * t * t);
}
`;
// The drops: water lenses (each a spherical cap: what is behind it, inverted and minified, its colour
// deepest at its middle, a crescent of gathered light, a glint, the bright thread of its contact line);
// a star's bead with the star's light at its heart. A nucleus gives way to its ice; every other drop
// shrinks as its water goes.
const DROPS_VS = VHEAD + SNOW_HEAD + /* glsl */ `
out vec2 vL;
out vec2 vC;
out float vR;
out vec4 vCol;
out vec4 vStar;
out float vAge;
out vec3 vChrome;
out float vGasK;
out float vGlow;
out vec4 vF;
void main() {
  int id = gl_InstanceID;
  if (id >= int(dd(1).x)) { gl_Position = GONE; return; }
  int rb = int(dd(2).x);
  vec4 A = dd(rb + id * 5), B = dd(rb + id * 5 + 1), E = dd(rb + id * 5 + 4);
  float code = floor(A.w / 1000.0), P = transitP(uH);
  if (mod(floor(code / 8.0), 2.0) > .5 || P >= A.z) { gl_Position = GONE; return; }
  bool star = code >= 32.0, core = mod(floor(code / 16.0), 2.0) > .5;
  vec2 WH = dd(0).xy, toS = uRegion.zw / WH, c = A.xy * toS;
  vec4 C3 = dd(rb + id * 5 + 2);
  // Its freezing (dew-plan.js makeShards): when the front reaches it, when it splits (its shards take
  // over), its first crack's angle, how many pieces. Pg: P on its own clock (the scroll's), for its
  // growth: on a click a clump falls kappa as long, from when the click's light has passed, a star's
  // bead condenses bead as long.
  vec4 Fz = dd(int(dd(18).x) + id);
  float Pg = P, tf = Fz.x, tc = Fz.y;
  if (uClick > .5) {
    float up = clickUp(c);
    if (core) Pg = C3.y + (P - clickSpots(up)) / ${CLICK.kappa.toFixed(4)};
    else if (star) Pg = B.w + (P - clickSpots(up) - .03 - (B.w - ${SKY.c0.toFixed(4)}) * ${CLICK.bead.toFixed(4)}) / ${CLICK.bead.toFixed(4)};
    tf = clickFreeze(up); tc = tf + ${CLICK.split.toFixed(4)};
  }
  if (Pg < B.w || P >= tc) { gl_Position = GONE; return; }
  vF = vec4(P - tf, tc - tf, Fz.z, Fz.w);
  float r = pow(max(B.x + B.y * max(0.0, min(Pg, B.z) - B.w), 0.0), 1.0 / 3.0), a = 1.0;
  float rs = r * toS.y;
  if (rs < .35 || a <= 0.0) { gl_Position = GONE; return; }
  // A clump's drop is its gas's light condensed: it glows, brightest as it snaps in.
  vGlow = core ? .6 + .7 * exp(-max(Pg - C3.z, 0.0) / .035) : .25;
  float half_ = rs * (star ? 2.2 : core ? 2.1 : 1.25) + 1.5;
  vec2 k = QUAD[gl_VertexID] * 2.0 - 1.0;
  vL = k * half_ / rs;
  vC = c; vR = rs;
  vCol = vec4(E.rgb, a);
  vStar = star ? dd(rb + id * 5 + 2) : vec4(-1.0);
  vAge = (Pg - B.w) * (uClick > .5 ? ${CLICK.bead.toFixed(4)} : 1.0);
  vGasK = 1.0 - .85 * smoothstep(.4, .6, uClick > .5 ? Pg : P);
  // Science's chrome drop behind it, if any (falling with everything, shrinking as it freezes), so the
  // lens shows its mirror.
  vChrome = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    vec4 sd = dd(4 + i);
    vec2 cc = sd.xy * toS;
    float cr = sd.z * toS.y;
    if (cr > 1.0 && length(c - cc) < cr + rs) vChrome = vec3(cc, cr);
  }
  gl_Position = project(vec3(c + k * half_, 0.0));
}`;
const DROPS_FS = FHEAD + NOISE + SNOW_FS + /* glsl */ `
in vec2 vL;
in vec2 vC;
in float vR;
in vec4 vCol;
in vec4 vStar;
in float vAge;
in vec3 vChrome;
in float vGasK;
in float vGlow;
in vec4 vF;
void main() {
  float rr = length(vL), aa = max(fwidth(rr) * 1.2, .02);
  float cov = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  vec3 tint = vCol.rgb / max(max(vCol.r, max(vCol.g, vCol.b)), 1e-3);
  bool star = vStar.x >= 0.0;
  if (cov > 0.0 && !star) {
    vec2 look = vC - vL * vR * .85;
    vec3 bg = snowLin(texture(uTexA, tUV(look)).rgb);
    vec4 g = texture(uGas, tUV(look));
    bg = bg * (1.0 - g.a * .75 * vGasK) + g.rgb * g.rgb * 4.0 * .8 * vGasK;
    if (vChrome.z > 0.0) {
      vec2 cn = (look - vChrome.xy) / vChrome.z;
      if (dot(cn, cn) < 1.0) {
        // Dew on the chrome: what the bead shows is the bright mirror under it (its sky-blue, gold
        // overhead, the film's fringe toward its rim), not the sky the snapshot holds there.
        float rc = length(cn);
        vec3 m = mix(${pv3(PALETTE.env.high)}, ${pv3(PALETTE.frost)}, .45 - .35 * cn.y);
        m = mix(m, ${pv3(PALETTE.env.top)}, .3 * smoothstep(.2, .9, -cn.y));
        m = mix(m, ${pv3(PALETTE.film[2])}, .35 * smoothstep(.6, 1.0, rc));
        bg = snowLin(m) * .85;
      }
    }
    float h = sqrt(max(1.0 - rr * rr, 0.0));
    vec3 w = bg * mix(vec3(1.0), tint, .35 + .45 * h) * (1.0 - .55 * smoothstep(.62, 1.0, rr));
    vec2 Ld = normalize(vec2(-.45, -.62));
    w += snowLin(tint) * exp(-dot(vL + Ld * .5, vL + Ld * .5) / .06) * (.25 + .9 * vGlow) * (1.0 - smoothstep(.8, 1.0, rr));
    w += vec3(1.0, .98, .95) * exp(-dot(vL - Ld * .5, vL - Ld * .5) / max(.01, .3 / max(vR * vR, 1.0))) * 1.1;
    w += mix(vec3(.55, .7, .9), tint, .4) * exp(-pow((rr - .95) / .045, 2.0)) * .35;
    // Lit from within by the gas it condensed from: deepest at its middle, a jewel.
    w += snowLin(tint) * (.12 + .5 * h * h) * vGlow;
    col = w * cov; alpha = cov;
  }
  if (!star && vGlow > .5) {
    // The glow round a clump's drop (the light of its gas, scattered), fading to nothing at its square.
    float halo = exp(-max(rr - 1.0, 0.0) * 2.2) * (1.0 - smoothstep(1.3, 2.0, rr)) * (1.0 - cov) * (vGlow - .5) * .35;
    col += snowLin(tint) * halo;
  }
  if (star) {
    // A star's bead: a drop full of the star's light. The star burns at its heart; the water around
    // it glows its colour, brightest where its surface gathers the light (a ring inside the rim, a
    // glint up and to the left); a soft round glow around it that ends well inside its square. It
    // flashes as it condenses and twinkles as the star did.
    vec3 sc = snowLin(mix(${pv3(PALETTE.stars[0])}, ${pv3(PALETTE.stars[1])}, vStar.z));
    float tw = .8 + .2 * sin(uTime * (1.3 + vStar.x * 3.0) + vStar.x * 40.0);
    float L = (.55 + .45 * vStar.y) * (1.0 + 2.0 * exp(-max(vAge, 0.0) / .012)) * tw;
    float h = sqrt(max(1.0 - rr * rr, 0.0));
    float d2 = rr * rr * vR * vR;
    float core = exp(-d2 / (.35 + .04 * vR * vR));
    float body = cov * (.32 + .25 * h);
    float ring = cov * exp(-pow((rr - .82) / .12, 2.0)) * .45;
    vec2 Ld = normalize(vec2(-.45, -.62));
    float glint = cov * exp(-dot(vL - Ld * .5, vL - Ld * .5) / .04) * .9;
    float halo = exp(-pow(max(rr - .9, 0.0) / .45, 2.0)) * (1.0 - smoothstep(1.4, 2.0, rr)) * (1.0 - cov) * .22;
    vec3 lit = sc * L * (core * 2.2 + body + ring + halo) + vec3(1.0, .99, .96) * glint * L;
    col = lit;
    alpha = clamp(cov * .6 + halo * L * 1.5, 0.0, 1.0);
  }
  if (vF.x >= 0.0 && cov > 0.0) {
    // Freezing: ice shoots through it (recalescence: milky white at once), then it freezes through
    // from its contact line inward, clear and glassy behind the front; the last water, expanding,
    // pushes up into a point (a glint at its apex); then cracks along its prism planes, 60° apart, run
    // out from the point. (A star's bead flashes and keeps its light.)
    float x = vF.x, through = max(vF.y - ${FREEZE.cleave.toFixed(4)}, .002);
    float z = clamp(x / through, 0.0, 1.0);
    float flash = exp(-x / .004) * smoothstep(0.0, .0015, x);
    float milky = (1.0 - smoothstep(1.0 - z - .08, 1.0 - z + .02, rr)) * (1.0 - .4 * z);
    vec3 tintL = snowLin(tint);
    float hh = sqrt(max(1.0 - rr * rr, 0.0));
    // Clear ice: its gas's light locked in, deepest at its middle, dark toward its rim, a cool rim light.
    vec3 ice = tintL * (.12 + .95 * hh * hh) * (.8 + .5 * vGlow) + vec3(.55, .78, 1.0) * pow(rr, 6.0) * .3;
    vec3 frozen = mix(ice, vec3(.9, .94, .98) * (.45 + .4 * hh), milky * .8);
    frozen += vec3(1.0, .98, .95) * exp(-pow((rr - (1.0 - z)) / .05, 2.0)) * .3 * (1.0 - z);
    float tip = smoothstep(.75, 1.0, z) * exp(-rr * rr * vR * vR / 1.6);
    frozen += vec3(1.0) * tip * 1.6;
    float crack = 0.0;
    if (x > through && vF.w > 1.5) {
      float grow = clamp((x - through) / ${FREEZE.cleave.toFixed(4)}, 0.0, 1.0);
      float th = atan(vL.y, vL.x) - vF.z, n = vF.w;
      for (int k = 0; k < 6; k++) {
        float fk = float(k);
        // (Which of the six, by how many pieces: dew-plan.js CLEAVE.)
        bool on = n > 5.5 ? true : n > 4.5 ? k < 5 : n > 3.5 ? (k != 2 && k != 5) : n > 2.5 ? (k == 0 || k == 2 || k == 4) : (k == 0 || k == 3);
        if (!on) continue;
        float a = th - fk * 1.0471976;
        vec2 dir = vec2(cos(a), sin(a)) * rr;
        float along = dir.x, dist = abs(dir.y) * vR;
        crack += exp(-dist * dist / .35) * step(0.0, along) * step(along, grow);
      }
    }
    frozen += mix(vec3(.7, .9, 1.0), tintL + .4, .4) * crack * 1.2;
    if (vStar.x >= 0.0) frozen = col + vec3(.8, .9, 1.0) * flash * 2.0;
    else frozen += vec3(1.0, .99, .97) * flash * 1.4;
    col = mix(col, frozen, vStar.x >= 0.0 ? 1.0 : smoothstep(0.0, .0015, x));
    alpha = max(alpha, cov * .95);
  }
  float a = vCol.a;
  o = vec4(snowDisp(col) * a, alpha * a);
}`;
// The shards: each a sector of its frozen drop (between two of its cracks), sitting a moment where it
// split, then pulled along its line into the card: turning to lie along the field (the torque on an
// induced dipole), spinning about it so its face flashes as it sweeps the light, stretched by its speed,
// lifted toward the camera mid-flight, flaring as it fuses. A water drop's shard is its ice, tinted, its
// cleavage faces catching the light in spectral colours; a star's keeps its star's white-hot light; a
// chrome drop's is mirror, with the film's colours.
const SHARDS_VS = VHEAD + SNOW_HEAD + /* glsl */ `
out vec2 vL;
out vec4 vSec;
out vec3 vN;
out vec4 vCol;
out vec2 vU;
void main() {
  int k = gl_InstanceID;
  if (k >= shardCount()) { gl_Position = GONE; return; }
  int base = shardBase() + k * 11;
  vec4 S0 = dd(base), S1 = dd(base + 1), S2 = dd(base + 2);
  float P = transitP(uH), lag = ${FIELD.lag.toFixed(4)};
  vec2 WH = dd(0).xy, toS = uRegion.zw / WH;
  // When it is pulled and when it fuses: the plan's, or on a click, the click's (its drop split as the
  // click's cold reached it, its flight as long as a point sink's from there).
  float t0 = S1.y, t1 = S1.z;
  bool click = uClick > .5;
  if (click) {
    float up = clickUp(S0.xy * toS);
    lag = ${CLICK.lag.toFixed(4)};
    t0 = clickFreeze(up) + ${CLICK.split.toFixed(4)} + lag + fract(float(k) * .618034) * ${CLICK.stagger.toFixed(4)};
    t1 = t0 + clickFlight(up);
  }
  float u = (P - t0) / max(t1 - t0, 1e-4);
  if (P < t0 - lag || u > 1.04) { gl_Position = GONE; return; }
  float r = S0.z, a0 = S0.w, a1 = S1.x, D = a1 - a0, mid = .5 * (a0 + a1), kind = floor(S2.w + .0001), r1 = (S2.w - kind) * 1000.0;
  bool whole = D > 6.0 && r1 < .5;
  float dc = whole ? 0.0 : 4.0 * sin(D * .5) * (r * r * r - r1 * r1 * r1) / (3.0 * D * (r * r - r1 * r1));
  vec2 bd = vec2(cos(mid), sin(mid)), nd = vec2(-bd.y, bd.x);
  // Its box in its own frame (along its bisector from its apex to its arc; across it).
  vec2 kq = QUAD[gl_VertexID] * 2.0 - 1.0;
  float hw = whole ? r + 1.5 : r * sin(min(D * .5, 1.5708)) + 1.5;
  float b0 = whole ? -r - 1.5 : r1 * cos(min(D * .5, 1.5708)) - dc - 1.5, b1 = whole ? r + 1.5 : r - dc + 1.5;
  float bb = mix(b0, b1, kq.x * .5 + .5), nn = kq.y * hw;
  vec2 l = bd * bb + nd * nn;
  vL = l + bd * dc;
  // Before its pull: where it split, the crack opening a little.
  float open = smoothstep(-lag, 0.0, P - t0) * 1.2;
  vec2 tang = bd, home = S0.xy + bd * (dc + open);
  float speed = 0.0;
  vec2 pos = home;
  if (u > 0.0) {
    if (click) {
      // r = r₀√(1 − u): the point sink's overdamped fall.
      vec2 hs = home * toS, to = uO - hs;
      float kk = sqrt(max(1.0 - min(u, 1.0), 0.0));
      pos = (uO - to * kk) / toS;
      tang = normalize(to + 1e-4);
      speed = length(to) / (2.0 * max(kk, .15)) / 15.0 / toS.y;
    } else pos = shardAt(base, u, tang, speed);
  }
  float uu = clamp(u, 0.0, 1.0);
  // Turning toward lying along the field (an axis: either way), spinning about it.
  float target = atan(tang.y, tang.x) - mid;
  target = mod(target + PI * .5, PI) - PI * .5;
  float th = target * (1.0 - exp(-uu / .14)) * step(0.0, u);
  l = mat2(cos(th), sin(th), -sin(th), cos(th)) * l;
  float roll = S1.w * TAU * uu * .55 + S2.w * 1.3;
  vec2 T = tang, Nn = vec2(-T.y, T.x);
  float a = dot(l, T), b = dot(l, Nn);
  float stretch = 1.0 + 1.6 * smoothstep(.45, 1.0, uu) * min(speed / max(15.0 * r, 1.0), 1.5);
  float shrink = (1.0 - .7 * smoothstep(.9, 1.02, u));
  a *= stretch * shrink; b *= shrink;
  // Lifted toward the camera mid-flight, larger as it comes.
  float lift = sin(PI * uu);
  a *= 1.0 + .9 * lift; b *= 1.0 + .9 * lift;
  vec3 p3 = vec3((pos + T * a + Nn * b * cos(roll)) * toS, (b * sin(roll)) * toS.y + 30.0 * lift);
  vN = vec3(-Nn * sin(roll), cos(roll));
  vSec = vec4(r, a0, D, fract(float(k) * .618034));
  vCol = vec4(S2.rgb, kind + r1 / 1000.0);
  vU = vec2(u, P - t0 + lag);
  gl_Position = project(p3);
}`;
const SHARDS_FS = FHEAD + NOISE + SNOW_FS + /* glsl */ `
in vec2 vL;
in vec4 vSec;
in vec3 vN;
in vec4 vCol;
in vec2 vU;
void main() {
  float r = vSec.x, rr = length(vL) / r, D = vSec.z, kind = floor(vCol.a + .0001), r1 = (vCol.a - kind) * 1000.0;
  float da = mod(atan(vL.y, vL.x) - vSec.y, TAU);
  bool whole = D > 6.0;
  // How far in from its edges (px): its arc, its inner arc (a ring's piece), its two cleavage faces.
  vec2 e0 = vec2(cos(vSec.y), sin(vSec.y)), e1 = vec2(cos(vSec.y + D), sin(vSec.y + D));
  float dArc = (1.0 - rr) * r;
  float dCut = whole ? 1e3 : min(dot(vL, vec2(-e0.y, e0.x)), dot(vL, vec2(e1.y, -e1.x)));
  if (r1 > .5) dCut = min(dCut, length(vL) - r1);
  float dIn = min(dArc, dCut);
  float aa = max(fwidth(dIn), .3);
  float cov = smoothstep(-aa, aa, dIn) * (whole || da < D ? 1.0 : 0.0);
  if (cov <= 0.0) discard;
  vec3 n = normalize(vN + vec3(vL / r * .45, 0.0));
  if (n.z < 0.0) n = -n;
  vec3 L = normalize(vec3(-.45, -.6, .66)), H = normalize(L + vec3(0.0, 0.0, 1.0));
  float dif = max(dot(n, L), 0.0), spec = pow(max(dot(n, H), 0.0), 48.0), fres = pow(1.0 - abs(n.z), 3.0);
  float dome = sqrt(max(1.0 - rr * rr, 0.0)), u = vU.x;
  vec3 tint = snowLin(vCol.rgb / max(max(vCol.r, max(vCol.g, vCol.b)), 1e-3));
  vec3 col;
  float core = exp(-rr * rr * 4.5);
  if (kind > 1.5) {
    // A star's: a point of its light, white-hot at its heart, soft round it (no edge of its own).
    col = mix(tint, vec3(1.0), .55) * core * 2.6;
  } else if (kind > .5) {
    // A chrome drop's: mirror. Each piece keeps the curve of the sphere it was (its normal there),
    // tilted as it turns, so it reflects Science's sky as that part of the sphere did: dark below, teal
    // above, the gold of the bright cloud overhead, the film's fringe toward its rim.
    vec3 ns = normalize(vec3(vL / r * .95, dome + .05));
    ns = normalize(ns + vec3(vN.xy * .8, 0.0));
    vec3 rf = reflect(vec3(0.0, 0.0, -1.0), ns);
    float y = -rf.y;
    col = snowLin(mix(${pv3(PALETTE.env.low)}, ${pv3(PALETTE.env.high)}, smoothstep(-.25, .75, y)) + ${pv3(PALETTE.env.top)} * smoothstep(.45, .95, y) * .8 + ${pv3(PALETTE.env.rim)} * pow(max(rf.x, 0.0), 5.0) * .7);
    vec3 film = snowLin(mix(mix(${pv3(PALETTE.film[0])}, ${pv3(PALETTE.film[1])}, .5 + .5 * sin(rr * 11.0 + vSec.w * 6.0)), ${pv3(PALETTE.film[2])}, .5 + .5 * sin(rr * 7.0 - vSec.w * 4.0)));
    col = mix(col, film, .5 * pow(rr, 3.0)) + vec3(1.0, .97, .9) * pow(max(dot(ns, H), 0.0), 60.0) * 2.0;
  } else {
    // A water drop's: clear ice holding its gas's light, deepest at its middle (the cap's depth), lit
    // as it turns, glassy at its rim.
    col = tint * (.1 + .85 * dome * dome) * (.75 + .6 * dif) + vec3(.55, .78, 1.0) * pow(rr, 5.0) * .25 + vec3(1.0, .98, .94) * (spec * 1.8 + fres * .2);
  }
  // The cleavage faces: bright, splitting the light into its colours along them.
  float t = rr * 5.0 + vSec.w * 9.0 + u * 3.0;
  vec3 prism = .5 + .5 * cos(TAU * (vec3(0.0, .33, .67) + t));
  col += (prism * .8 + .4) * exp(-max(dCut, 0.0) / 1.1) * (.35 + .9 * spec + .5 * fres) * (kind > 1.5 ? .3 : 1.0);
  col += vec3(.85, .93, 1.0) * exp(-max(dArc, 0.0) / 1.4) * .25;
  // Its flare as it fuses into the card.
  float fuse = smoothstep(.86, 1.0, u) * (1.0 - smoothstep(1.0, 1.04, u));
  col += mix(tint, vec3(1.0), .6) * fuse * 1.6;
  float a = cov * (1.0 - smoothstep(1.0, 1.04, u)) * (kind > 1.5 ? clamp(core * 1.4, 0.0, 1.0) : 1.0);
  o = vec4(snowDisp(min(col, vec3(3.0))) * a, a);
}`;
// The field lines the shards ride: each shard's path as a ribbon of 15 segments, its glow across it
// Gaussian; bright just behind its shard (the line it is riding, lit), and, for one shard in four, the
// whole line glowing faintly as the field builds (the pattern of a magnet's filings).
const FIELDLINES_VS = VHEAD + SNOW_HEAD + /* glsl */ `
out float vAcross;
out float vB;
out vec3 vCol;
void main() {
  int k = gl_InstanceID;
  if (k >= shardCount()) { gl_Position = GONE; return; }
  int base = shardBase() + k * 11;
  vec4 S0 = dd(base), S1 = dd(base + 1), S2 = dd(base + 2);
  vec2 WH = dd(0).xy, toS = uRegion.zw / WH;
  float P = transitP(uH), t0 = S1.y, t1 = S1.z;
  bool click = uClick > .5;
  if (click) {
    float up = clickUp(S0.xy * toS);
    t0 = clickFreeze(up) + ${(CLICK.split + CLICK.lag).toFixed(4)} + fract(float(k) * .618034) * ${CLICK.stagger.toFixed(4)};
    t1 = t0 + clickFlight(up);
  }
  float u = (P - t0) / max(t1 - t0, 1e-4);
  float build = smoothstep(-.06, 0.0, P - t0) * (1.0 - smoothstep(1.0, 1.2, u)) * (k % 4 == 0 ? 1.0 : 0.0);
  float lit0 = u > 0.0 && u < 1.15 ? 1.0 : 0.0;
  if (build <= 0.0 && lit0 <= 0.0) { gl_Position = GONE; return; }
  int seg = gl_VertexID / 6;
  vec2 q = QUAD[gl_VertexID % 6];
  float sp = (float(seg) + q.x) / 15.0;
  vec2 tang, pos;
  float speed, head = u;
  if (click) {
    // (A straight line into the click; the shard is 1 − √(1 − u) of the way along it.)
    vec2 hs = S0.xy * toS;
    pos = mix(hs, uO, sp);
    tang = normalize(uO - hs + 1e-4);
    head = 1.0 - sqrt(max(1.0 - clamp(u, 0.0, 1.0), 0.0));
  } else pos = shardAt(base, sp, tang, speed) * toS;
  pos += vec2(-tang.y, tang.x) * (q.y - .5) * 4.0;
  float behind = head - sp;
  float lit = lit0 * smoothstep(0.0, .02, behind + .01) * (1.0 - smoothstep(0.0, .22, behind));
  vB = build * .03 + lit * (S2.a > 1.5 ? .5 : .32);
  vAcross = (q.y - .5) * 2.0;
  vCol = mix(sqrt(S2.rgb / max(max(S2.r, max(S2.g, S2.b)), 1e-3)), vec3(.8, .92, 1.0), .45);
  gl_Position = project(vec3(pos, 0.0));
}`;
const FIELDLINES_FS = FHEAD + /* glsl */ `
in float vAcross;
in float vB;
in vec3 vCol;
void main() {
  float g = exp(-vAcross * vAcross * 6.0);
  o = vec4(vCol * g * vB, 0.0);
}`;

// blend: 'opaque', 'over' (premultiplied) or 'add'. grid: which uniform holds the instance grid.
export const UNIT_PROGRAMS = {
  cubes: { vs: CUBES_VS, fs: CUBES_FS, verts: 36, blend: 'over' },
  streaks: { vs: STREAKS_VS, fs: STREAKS_FS, verts: 18 * 6, blend: 'over' },
  flow: { vs: FLOW_VS, fs: STREAKS_FS, verts: 22 * 6, blend: 'over' },
  sheets: { vs: SHEETS_VS, fs: SHEETS_FS, verts: 30 * 12 * 6, blend: 'opaque' },   // per layer, instances: rows × (cols + 1)
  glitter: { vs: GLITTER_VS, fs: GLITTER_FS, verts: 6, blend: 'add' },
  fieldlines: { vs: FIELDLINES_VS, fs: FIELDLINES_FS, verts: 15 * 6, blend: 'add' },   // instances: the lines the shards ride
  drops: { vs: DROPS_VS, fs: DROPS_FS, verts: 6, blend: 'over' },                         // instances: the clumps' drops, the stars' beads
  shards: { vs: SHARDS_VS, fs: SHARDS_FS, verts: 6, blend: 'over' },                      // instances: the frozen drops' shards
  // Outdoors → Photography (glsl/fire.js): the embers, the ribbons their paths become, the silver grains.
  ...Object.fromEntries(Object.entries(FIRE_UNITS).map(([name, u]) => [name, { vs: VHEAD + u.vs, fs: FHEAD + (u.noise ? NOISE : '') + u.fs, verts: u.verts, blend: u.blend }])),
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
