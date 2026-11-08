// Flight: shared by the scene's fragment shader (transit.js and opens.js) and the unit shaders
// (units.js, the pieces that fly), so a cell and the unit that leaves it always agree.
//
// Chess's transitions grow a structure across the whole screen (the reach): from a point for a click,
// up from the foot of the strip for a seam. A few trunks fork as they go (four levels, each with
// twice the branches of the last), reaching the far edge by about 0.55 of the way through; behind
// them the gaps fill, nearest the branches first, by 1.0. Each style shapes its own branches. A
// point's arrival A (0..1) is when it is filled.
//
// A seam is a pure function of its progress p (0..1, home.js: how far the page has scrolled through
// the seam's hold): scrolling back un-builds it. P = transitP(p) runs past both ends, so p = 0 and
// p = 1 are exactly at rest; each point flies (u 0 → 1) while P passes its arrival, ±0.15 with its
// own jitter. lerp.js mirrors these numbers for the tests.
export const FLIGHT = /* glsl */ `
// The ink's reach: five trunks that wander (curl, wobble) with soft fingers (w0, half-width in px).
const float RN0 = 8.0, RCURL = 0.45, RWOB = 0.6, RW0 = 11.0;
float reachWobble(float r, float id) {
  return noise(vec2(r * 0.0045, id)) - 0.5 + (noise(vec2(r * 0.013, id + 5.0)) - 0.5) * 0.4;
}
// Branch i of level k (N per turn), at distance r: its centre in units of that level's spacing.
float branchC(float i, float k, float N, float r, float seed) {
  float im = mod(i, N);
  return i + 0.5 + (hash(vec2(im, k + seed)) - 0.5) * 0.5 + reachWobble(r, im + k * 97.0 + seed * 13.0) * RWOB;
}
// d: distance to the nearest branch (px); w: its half-width (px); tb: when it grew this far; A: when
// this point is filled; sp: how far apart the branches are here (px).
struct Reach { float d; float w; float tb; float A; float sp; };
Reach reachAt(float r, float a, float circ, float far, float seed) {
  float rn = r / far;
  float aw = a + RCURL * rn * rn * 0.18;
  Reach o = Reach(1e9, 1.0, 0.0, 0.0, circ / RN0);
  float forks = 0.0;   // how many levels have forked here, smoothly, so the spacing never jumps
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float N = RN0 * exp2(fk);
    float rk = k == 0 ? 0.0 : far * 0.13 * pow(1.8, fk - 1.0);
    if (r < rk) break;
    float x = aw * N, i0 = floor(x);
    float born = smoothstep(rk, rk + far * 0.1, r);
    if (k > 0) forks += born;
    float w = RW0 * pow(0.62, fk) * (1.0 - 0.45 * min(rn, 1.0)) + 0.5;
    for (int j = -1; j <= 1; j++) {
      float i = i0 + float(j);
      float c = branchC(i, fk, N, r, seed);
      // A fork: near where its level begins, a branch bends in from its parent's centre.
      if (k > 0 && born < 1.0) c = mix(2.0 * branchC(floor(i * 0.5), fk - 1.0, N * 0.5, r, seed), c, born);
      float d = abs(x - c) / N * circ;
      if (d - w < o.d - o.w) {
        // Every branch of a trunk grows at that trunk's pace, so a fork never jumps ahead.
        float h = hash(vec2(mod(floor(i / exp2(fk)), RN0), 31.0 + seed));
        o.d = d; o.w = w;
        o.tb = rn * 0.55 * (0.85 + 0.3 * h);
      }
    }
  }
  o.sp = circ / (RN0 * exp2(forks));
  float gap = clamp((o.d - o.w) / max(o.sp * 0.5 - o.w, 1.0), 0.0, 1.0);
  o.A = clamp(o.tb + 0.36 * gap + (noise(vec2(r, a * circ) * 0.02 + seed) - 0.5) * 0.04, 0.0, 1.0);
  return o;
}
// From a point O (a click), out to far.
Reach reachPolar(vec2 px, vec2 O, float far, float seed) {
  vec2 v = px - O;
  float r = length(v);
  return reachAt(r, atan(v.y, v.x) / TAU + 0.5, max(r, 1.0) * TAU, far, seed);
}
// Up from the foot of a strip (size, CSS px; q y down).
Reach reachFoot(vec2 q, vec2 size, float seed) {
  return reachAt(clamp(size.y - q.y, 0.0, size.y), q.x / size.x, size.x, size.y, seed);
}

// A seam's progress p → P, which runs past both ends so the strip is at rest at p = 0 and p = 1.
float transitP(float p) { return -0.2 + 1.4 * clamp(p, 0.0, 1.0); }
// A point's flight: 0 at home in the upper world, 1 landed in the lower one.
float flightAt(float A, float jit, float P) { return clamp(0.5 + (P - A + (jit - 0.5) * 0.1) / 0.3, 0.0, 1.0); }

// ---- Racing: ice crystals (crystal growth) ------------------------------------------------------
// Nuclei on a jittered grid, each born on the transition's clock (by its height for a seam, the foot
// first; by its distance from O for a click) and growing as a six-armed star, fastest along its
// arms, until it meets its neighbours along grain boundaries (a Johnson–Mehl tessellation with
// six-fold growth, after Reiter's snowflakes). A front can never outrun the birth schedule, and every
// point is reached by its own cell's nucleus soon after that is born, so a seam's arrivals stay in
// [0.2, 0.8] near its edges. Baked by transit.js: x how near an arm, y how near a grain boundary,
// z the crystal's own number, w when the ice arrives (A).
const float XCELL = 130.0;
vec4 crystalAt(vec2 q, vec2 size, bool polar, vec2 O, float far) {
  vec2 g = floor(q / XCELL);
  float V = 0.9 * (polar ? far : size.y);
  float best = 9.0, second = 9.0, id = 0.0, arm = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 c = g + vec2(float(i), float(j));
    vec2 n = (c + 0.15 + 0.7 * hash2(c + 11.3)) * XCELL;
    float k = polar ? clamp(length(n - O) / far, 0.0, 1.0) : clamp(1.0 - n.y / size.y, 0.0, 1.0);
    float born = polar ? k * 0.68 * (0.85 + 0.3 * hash(c + 3.7)) + 0.05 * hash(c + 9.1)
                       : -0.08 + k * 0.5 * (0.85 + 0.3 * hash(c + 3.7)) + 0.05 * hash(c + 9.1);
    vec2 v = q - n;
    float r = length(v);
    float th = atan(v.y, v.x) + hash(c + 5.5) * 1.0472;
    float t = born + r / (V * (1.0 + 0.9 * pow(abs(cos(3.0 * th)), 6.0)));
    if (t < best) {
      second = best; best = t; id = hash(c + 7.7);
      // Its arms: six spokes, needles at 60° along them, and a small hexagonal plate at the heart.
      float d = mod(th + PI / 6.0, PI / 3.0) - PI / 6.0;
      float along = r * cos(d), perp = r * abs(sin(d));
      float spoke = exp(-perp / 1.3);
      float needle = exp(-abs(fract((along - perp * 0.577) / 15.0) - 0.5) * 13.0) * step(perp, 0.32 * along) * exp(-perp / 26.0);
      float plate = 1.0 - smoothstep(9.0, 11.0, along);
      arm = max(max(spoke, needle * 0.75), plate * 0.6);
    } else if (t < second) second = t;
  }
  return vec4(arm, 1.0 - clamp((second - best) / 0.004, 0.0, 1.0), id, best);
}

// ---- Science: a vortex -------------------------------------------------------------------------------
// After the Burgers vortex, an exact solution of the Navier–Stokes equations: fluid drawn in toward
// an axis spins faster as it closes in (it keeps its angular momentum) and is stretched along the
// axis. Here the axis stands upright through the middle of the screen, and the flow along it runs
// one way: up a seam (with the page, as it scrolls), away from the link for a click. A cube's flight
// u: in along an inward spiral, wide at first; round the core fastest, carried along the axis there
// (the stretching); then thrown out again further along. Its path is a helix that tightens and
// stretches. It turns about the axis by an odd number of half turns, so it lands mirrored across
// the axis, its other face up.
//
// A seam's cubes rise: each lands VX_DROP of the rows above the cell it left. The top rows' cubes are
// thrown out over the top; the bottom rows are filled by cubes rising from below the screen (rows
// rows..rows+kd-1). The schedule runs up from the foot of the screen, where the vortex starts, right
// beneath the band above as the seam scrolls in (a held seam is drawn on the whole screen: home.js):
// its base gathers the paper from the foot up, and its top throws the cubes out to build the next
// page as it grows. lerp.js mirrors these numbers.
const float VX_SPIN = 2.5;      // how much faster the core turns than the rim (1 + VX_SPIN times)
const float VX_SINK = 6.0;      // how much faster it travels along the axis at the core than at the rim
const float VX_D = 0.55;        // a seam cube's flight, in P
const float VX_DROP = 0.38;     // how far up a seam cube lands, as a share of the rows
const float VX_TILT = 0.42;     // the orbits lean back so they read as ellipses
int vortexDrop(int rows) { return int(floor(float(rows) * VX_DROP + 0.5)); }
// A cell's lean on the schedule: mostly a smooth field, so the page breaks along soft, wandering
// edges rather than cell by cell. p: the cell's centre (CSS px); c: the cell.
float vortexJit(vec2 p, vec2 c) { return clamp(0.5 + (noise(p * 0.009) - 0.5) * 1.8 + (hash(c + 0.37) - 0.5) * 0.06, 0.0, 1.0); }
// When a seam cube is at the core: by how high it starts on the screen (the foot first, the top
// last), and a little sooner near the axis, so the paper is gathered along a funnel. The cubes from
// below the screen go at once, at the start, and fill the base. Every flight lies in P's [-0.2, 1.2].
float vortexSeamA(vec2 home, vec2 size, float jit) {
  float up = 1.0 - home.y / size.y;
  if (up < 0.0) return 0.075 + 0.04 * clamp(up / VX_DROP + 1.0, 0.0, 1.0);
  float rn = abs(home.x / size.x - 0.5) * 2.0;
  return clamp(0.1 + 0.56 * up + 0.12 * min(rn, 1.0) + (jit - 0.5) * 0.2, 0.1, 0.925);
}
// The vortex's top at P (CSS px, y down): where the cubes rounding its core now are thrown out to
// land. A third of the way up the screen to begin with, above the top at the end.
float vortexTop(float P, vec2 size) {
  float land = size.y * (1.0 - (P - 0.12) / 0.62 - VX_DROP);
  return clamp(land, -0.2 * size.y, 0.68 * size.y);
}
float vortexU(float A, float P) { return clamp(0.5 + (P - A) / VX_D, 0.0, 1.0); }
// Eased through the core: 0 at u = 0, 1 at u = 1, moving 1 + K times faster at u = 0.5.
float coreEase(float u, float K) { return (u * (1.0 + 0.5 * K) - K * sin(TAU * u) / (4.0 * PI)) / (1.0 + 0.5 * K); }
float vortexTurn(float u) { return coreEase(u, VX_SPIN); }
// Its angular speed, 0 at the rim to 1 at the core.
float vortexSpin(float u) { float s = sin(PI * u); return s * s; }
// How deep into the vortex it is (0 at rest, 1 at the core).
float vortexDepth(float u) { return smoothstep(0.0, 1.0, sin(PI * u)); }
// Where it is at u: x across, y down, z toward the viewer (CSS px). home: where it left; drop: how
// far along the axis it is carried (down, or up if negative); ax: the axis (x); rc: the radius it
// closes in to; turns: an odd number of half turns. th: its angle about the axis; tilt: how far its
// orbit leans.
vec3 vortexAt(vec2 home, float drop, float ax, float rc, float turns, float u, out float th, out float tilt) {
  float r0 = home.x - ax;
  float k = vortexDepth(u);
  // It turns from the moment it leaves but closes in later, so the outer flow sweeps wide arcs.
  float r = mix(r0, sign(r0) * min(abs(r0), rc), pow(k, 1.7));
  th = turns * PI * vortexTurn(u);
  tilt = VX_TILT * smoothstep(0.0, 0.4, k);
  float X = r * cos(th), Z = r * sin(th) * 0.75;
  float y = home.y + drop * coreEase(u, VX_SINK);
  return vec3(ax + X, y + Z * sin(tilt), Z * cos(tilt));
}
// The radius cubes close in to (each its own share of it).
float vortexRc(vec2 size) { return min(size.x, size.y) * 0.13; }
// A click's cubes come out of the axis between the click and the cell they build, and spiral on away
// from the click to land: the cells nearest the click along the axis first, so the page fills from
// the link's side across. along, across: how far the cell is from the click along the axis and from
// the axis (0..1). v (0..1) is the rest of the flight (u from VX_CLICK_U0 to 1) over the cover's E
// (0..1.04); a cube fades in on the last turns of its way in, so they stream rather than clump.
const float VX_CLICK_DROP = 0.6, VX_CLICK_U0 = 0.12;
float vortexClickA(float along, float across, float jit) {
  return clamp(0.03 + 0.4 * clamp(along, 0.0, 1.0) + 0.18 * clamp(across, 0.0, 1.0) + (jit - 0.5) * 0.1, 0.0, 0.64);
}
float vortexClickV(float A, float E) { return clamp((E - A) / 0.36, 0.0, 1.0); }
// Speed as colour, as in the figure it follows: teal where it turns slowly, blue, orange at the core.
vec3 vortexHue(float spin) {
  vec3 c = mix(vec3(0.16, 0.80, 0.86), vec3(0.24, 0.46, 0.92), smoothstep(0.1, 0.55, spin));
  return mix(c, vec3(0.99, 0.62, 0.24), smoothstep(0.55, 0.95, spin));
}

// ---- Outdoors: the panes ----------------------------------------------------------------------------
// Brick-laid panes (odd rows half a pane over) over the strip, uGrid-style (cols, rows, w, h). They
// peel in a diagonal sweep from the strip's bottom-left corner, each on its own beat, arriving in
// [0.06, 0.76]. A pane's flight u: it rolls up from its free (top) edge into a tube (a cylindrical
// page curl) until u = 0.7, and from 0.55 the tube lifts away.
ivec2 paneCell(vec2 q, vec4 g) {
  int row = clamp(int(floor(q.y / g.w)), 0, int(g.y) - 1);
  float shift = row % 2 == 1 ? g.z * 0.5 : 0.0;
  return ivec2(clamp(int(floor((q.x + shift) / g.z)), 0, int(g.x)), row);
}
vec2 paneCentre(ivec2 c, vec4 g) { return (vec2(c) + 0.5) * g.zw - vec2(c.y % 2 == 1 ? g.z * 0.5 : 0.0, 0.0); }
float paneA(vec2 ctr, vec2 size, float jit) {
  float rn = clamp(1.0 - ctr.y / size.y, 0.0, 1.0), xn = clamp(ctr.x / size.x, 0.0, 1.0);
  return 0.1 + 0.46 * rn + 0.16 * xn + (jit - 0.5) * 0.08;
}
float paneRoll(float u) { float x = clamp(u / 0.7, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float paneFly(float u) { return smoothstep(0.55, 1.0, u); }
// How far down the pane the roll has come: s (0 at its hinge, 1 at its free edge) where it leaves
// the surface, at w across; one corner leads.
const float PEEL_K = 0.6;
float paneFront(float roll, float w, float side) {
  return clamp(1.0 - roll * (1.0 + PEEL_K) + PEEL_K * mix(w, 1.0 - w, side), 0.0, 1.0);
}

// ---- Outdoors: layers of sheets ------------------------------------------------------------------
// Three layers lie over the Outdoors page: the glacier's ice, a topographic trail map, tracing
// vellum. Each is brick-laid sheets (layerGrid), smaller toward the top layer, and each peels in a
// sweep from the foot of the screen up and to the right, a little after the layer above it at that
// place, so the sheets come away in waves, layer under layer, and fly. sheetAt: where layer k stands
// at q at P: its sheet there, that sheet's flight u, q's place on it (s from the hinge at its foot up,
// w across) and the fold f (below it the sheet still lies flat).
const int SHEET_LAYERS = 3;
vec4 layerGrid(int k, vec2 size) {
  float rows = max(3.0, floor(size.y / (112.0 + 26.0 * float(k)) + 0.5));
  float ph = size.y / rows;
  float cols = max(3.0, floor(size.x / (ph * 0.9) + 0.5));
  return vec4(cols, rows, size.x / cols, ph);
}
float sheetSeed(int k, ivec2 c) { return hash(vec2(c) + 0.61 + 7.3 * float(k)); }
float layerA(int k, vec2 ctr, vec2 size, float jit) {
  float rn = clamp(1.0 - ctr.y / size.y, 0.0, 1.0), xn = clamp(ctr.x / size.x, 0.0, 1.0);
  return 0.04 + 0.31 * rn + 0.1 * xn + (jit - 0.5) * 0.12 + 0.26 * float(k);
}
// A sheet's own peel: how far one corner leads (0 the whole edge at once, 1 a steep corner) and the
// radius of its curl, as a share of its height.
float sheetLead(int k, ivec2 c) { return 0.15 + 0.85 * hash(vec2(c) + 5.1 + float(k)); }
float sheetCurl(int k, ivec2 c) { return 0.07 + 0.16 * hash(vec2(c) + 8.3 + float(k)); }
float sheetFront(float roll, float w, float side, float K) {
  return clamp(1.0 - roll * (1.0 + K) + K * mix(w, 1.0 - w, side), 0.0, 1.0);
}
// A sheet lets go of the page sooner than a pane: it lifts away still curving, rather than rolled.
float sheetFly(float u) { return smoothstep(0.42, 1.0, u); }
struct SheetAt { float raw; float u; float s; float w; float f; float side; float K; vec2 ctr; vec4 g; ivec2 c; };
SheetAt sheetAt(int k, vec2 q, vec2 size, float P) {
  SheetAt o;
  o.g = layerGrid(k, size);
  o.c = paneCell(q, o.g);
  o.ctr = paneCentre(o.c, o.g);
  o.raw = 0.5 + (P - layerA(k, o.ctr, size, sheetSeed(k, o.c))) / 0.3;
  o.u = clamp(o.raw, 0.0, 1.0);
  o.s = clamp((o.ctr.y + o.g.w * 0.5 - q.y) / o.g.w, 0.0, 1.0);
  o.w = clamp((q.x - o.ctr.x) / o.g.z + 0.5, 0.0, 1.0);
  o.side = step(0.5, hash(vec2(o.c) + 2.9 + float(k)));
  o.K = sheetLead(k, o.c);
  o.f = sheetFront(paneRoll(o.u), o.w, o.side, o.K);
  return o;
}
bool sheetHere(SheetAt a) { return a.u <= 0.0 || (sheetFly(a.u) <= 0.0 && a.s <= a.f); }
// The trail map: contours of a hill (every fifth one heavier), a faint grid, a dashed red trail.
vec3 topoMap(vec2 q) {
  float h = fbm3(q * 0.0034 + vec2(3.1, 7.7)) + 0.25 * fbm3(q * 0.011);
  float d = abs(fract(h * 15.0) - 0.5);
  float line = smoothstep(0.42, 0.48, d);
  float index = step(mod(floor(h * 15.0 + 0.5), 5.0), 0.5);
  vec3 col = vec3(0.94, 0.91, 0.83) - vec3(0.05, 0.05, 0.07) * smoothstep(0.35, 0.75, h);
  col = mix(col, vec3(0.56, 0.4, 0.24), line * (0.45 + 0.4 * index));
  vec2 gd = abs(fract(q / 96.0) - 0.5);
  col = mix(col, vec3(0.45, 0.6, 0.75), smoothstep(0.485, 0.5, max(gd.x, gd.y)) * 0.25);
  float tr = abs(q.y - (470.0 + 160.0 * sin(q.x * 0.0047 + 1.3) + 70.0 * sin(q.x * 0.013)));
  float dash = step(0.45, fract(q.x * 0.035));
  col = mix(col, vec3(0.78, 0.2, 0.15), smoothstep(2.2, 0.8, tr) * dash * 0.85);
  return col;
}
// Tracing vellum: milky, the page beneath only a soft tint through it, with fibres.
vec3 vellum(vec3 under, vec2 q) {
  vec3 milk = vec3(0.9, 0.91, 0.86);
  return mix(milk, milk * (0.75 + 0.5 * under), 0.35) + (noise(q * vec2(0.9, 0.06)) - 0.5) * 0.035;
}

// ---- Photography: film ----------------------------------------------------------------------------
// The page becomes 35 mm film and is pulled away, strip by strip from the foot of the screen up. Each
// strip (a row FILM_H high) is first exposed: a flash crosses it and it turns to a colour negative,
// orange-masked, with sprocket holes along its edges and lines between its frames. Then it is pulled
// off the table from one end (alternate rows from alternate ends), lifting into a rising, twisting
// helix of film; where it has left, the Photography page develops in the tray. filmU: how far the
// pull has gone (0..1); filmPulled: how much of the strip (CSS px) has left the table.
const float FILM_H = 84.0;
vec4 filmGrid(vec2 size) { float rows = max(4.0, floor(size.y / FILM_H + 0.5)); return vec4(1.0, rows, size.x, size.y / rows); }
float filmA(int r, vec4 g, vec2 size) {
  float y0 = (float(r) + 0.5) * g.w;
  return 0.1 + 0.74 * clamp(1.0 - y0 / size.y, 0.0, 1.0) + (hash(vec2(float(r), 3.3)) - 0.5) * 0.04;
}
float filmU(float A, float P) { return clamp((P - A + 0.2) / 0.5, 0.0, 1.0); }
float filmNeg(float A, float P) { return smoothstep(-0.28, -0.2, P - A); }
float filmSide(int r) { return r % 2 == 0 ? 1.0 : -1.0; }   // 1: pulled from the left end
float filmPulled(float u, float len) { return pow(u, 1.6) * (len + 700.0); }
// The film's printing over an image at q (row height h): the negative (neg 0..1 of the way there),
// lines between frames, and in the margins the orange base with sprocket holes. a: 1 in a hole.
vec4 filmLook(vec3 img, vec2 q, float h, float neg) {
  float yr = mod(q.y, h), m = h * 0.15;
  vec3 negc = clamp(vec3(0.9) - img * 1.9, 0.0, 1.0) * vec3(0.98, 0.64, 0.4) + vec3(0.07, 0.03, 0.01);
  vec3 col = mix(img, negc, neg);
  float frameW = (h - 2.0 * m) * 1.5;
  float fx = mod(q.x, frameW);
  col = mix(col, vec3(0.12, 0.05, 0.02), smoothstep(3.0, 1.5, min(fx, frameW - fx)) * neg);
  float inMargin = 1.0 - step(m, yr) * step(yr, h - m);
  if (inMargin > 0.5) {
    float ym = yr < m ? yr : h - yr;
    col = mix(col, vec3(0.6, 0.33, 0.15) + (hash(floor(q * 0.5)) - 0.5) * 0.03, neg);
    // Edge printing: small ticks along the outer margin.
    col = mix(col, vec3(0.95, 0.75, 0.45), neg * step(0.9, fract(q.x / (frameW * 0.25))) * step(ym, m * 0.18) * 0.6);
    float hp = frameW / 8.0;
    float hole = step(abs(mod(q.x, hp) - hp * 0.5), hp * 0.27) * step(abs(ym - m * 0.55), m * 0.3);
    return vec4(col, hole * neg);
  }
  return vec4(col, 0.0);
}

// A divergence-free swirl: three layers of drifting vortex cells (the curl of sin x sin y), about
// unit speed. Every flowing unit and the liquid seam follow it.
vec2 vortexCells(vec2 p, float k, vec2 ph, float a) {
  mat2 r = rot(a);
  vec2 q = r * p * k + ph;
  return vec2(sin(q.x) * cos(q.y), -cos(q.x) * sin(q.y)) * r;
}
vec2 swirl(vec2 p, float t) {
  return vortexCells(p, 0.011, vec2(t * 0.21, -t * 0.17), 0.5)
       + vortexCells(p, 0.023, vec2(-t * 0.31, t * 0.23) + 1.7, -0.9) * 0.6
       + vortexCells(p, 0.047, vec2(t * 0.5, t * 0.4) + 3.1, 2.1) * 0.3;
}
`;

// A seam's reach never changes while it is on screen (it depends only on the strip's size and the
// lower style), so transit.js bakes it once into a texture (BAKE, d/64, w/24, tb, A) and the seam's
// ground and units read it; the crystals are baked the same way, read raw. SEAM_TEX goes after
// FLIGHT in any shader with uRegion.
export const SEAM_TEX = /* glsl */ `
uniform sampler2D uReach;
vec4 seamRaw(vec2 q) { return textureLod(uReach, vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w), 0.0); }
Reach seamReachAt(vec2 q) {
  vec4 t = seamRaw(q);
  return Reach(t.x * 64.0, t.y * 24.0, t.z, t.w, 1.0);
}
// A seam point's flight, skipping the lookup where its height alone settles it: arrivals at rn (0
// the foot, 1 the top) lie in [0.4675 rn - 0.02, 0.6325 rn + 0.38] (lerp.js arrivalRange).
float seamU(vec2 q, float jit, float P) {
  float rn = clamp(1.0 - q.y / uRegion.w, 0.0, 1.0);
  if (P < 0.4675 * rn - 0.22) return 0.0;
  if (P > 0.6325 * rn + 0.58) return 1.0;
  return flightAt(seamReachAt(q).A, jit, P);
}
`;
