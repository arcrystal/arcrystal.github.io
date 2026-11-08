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
const float RN0 = 5.0, RCURL = 0.45, RWOB = 0.6, RW0 = 10.0;
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
                       : 0.15 + k * 0.5 * (0.85 + 0.3 * hash(c + 3.7)) + 0.05 * hash(c + 9.1);
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

// ---- Science: a Hilbert curve -----------------------------------------------------------------------
// K Hilbert curves side by side, each stretched over a panel of the rect (K = its aspect, rounded),
// each from its panel's bottom-left corner to its bottom-right, so together they are one unbroken
// line through every block. HN blocks per panel side. hIndex: how far along the whole line (0..1)
// block b lies (x across all panels, y down from the top).
const int HN = 32;
int hilbertXY2D(int x, int y) {
  int d = 0;
  for (int s = HN / 2; s > 0; s /= 2) {
    int rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry == 0) {
      if (rx == 1) { x = HN - 1 - x; y = HN - 1 - y; }
      int t = x; x = y; y = t;
    }
  }
  return d;
}
float hPanels(vec2 size) { return max(1.0, floor(size.x / size.y + 0.5)); }
vec2 hBlockSize(vec2 size) { return vec2(size.x / (hPanels(size) * float(HN)), size.y / float(HN)); }
ivec2 hBlock(vec2 q, vec2 size) { return clamp(ivec2(floor(q / hBlockSize(size))), ivec2(0), ivec2(int(hPanels(size)) * HN - 1, HN - 1)); }
float hIndex(ivec2 b, vec2 size) {
  int panel = b.x / HN;
  float d = float(panel * HN * HN + hilbertXY2D(b.x - panel * HN, HN - 1 - b.y));
  return d / (hPanels(size) * float(HN * HN) - 1.0);
}
// A seam's cubes leave in the line's order, over P in [0.2, 0.8].
float hilbertA(vec2 q, vec2 size) { return 0.2 + 0.6 * hIndex(hBlock(q, size), size); }
float hilbertU(float A, float jit, float P) { return clamp(0.5 + (P - A + (jit - 0.5) * 0.03) / 0.18, 0.0, 1.0); }

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

// Where a unit lands: each row is cut into blocks of 12 cells and shuffled within each block by a
// cyclic shift, so every cell sends one unit and receives one. dir 1: where col's unit lands;
// dir -1: whose unit lands in col.
int shiftCol(int col, int row, int cols, float seed, int dir) {
  int b0 = col - col % 12;
  int len = min(12, cols - b0);
  int k = min(int(hash(vec2(float(row) + 0.5, seed * 3.3)) * float(len)), len - 1);
  int l = col - b0;
  return b0 + (dir > 0 ? (l + k) % len : (l + len - k) % len);
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
