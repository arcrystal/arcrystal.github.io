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
// A seam's vortex stands on the foot of the screen and grows taller, and the page is gathered up the
// screen behind its growing top, each height over a long window (some cubes lag), so the foot is
// still giving up its last cubes while the upper middle starts. Each cube goes round the vortex with
// the swarms, rising with the wind, and is thrown down and out onto a cell: the bottom corners are
// built first, then upward and inward, the middle top last. When each cube leaves, where it lands and
// when are planned ahead (lerp.js vortexPlan) and read from uReach, a texel a cell. Science comes in
// blurred (vortexBlur), and the vortex's tendrils sharpen it (vortexSharp). lerp.js mirrors these
// numbers.
const float VX_SPIN = 2.5;      // a click's: how much faster the core turns than the rim (1 + VX_SPIN times)
const float VX_SINK = 6.0;      // a click's: how much faster it travels along the axis at the core than at the rim
const float VX_TILT = 0.42;     // the orbits lean back so they read as ellipses
const float VX_C0 = -0.15, VX_C1 = 0.5;       // the gathering's front: at the foot at VX_C0, climbing a screen in VX_C1
const float VX_BASE0 = 0.78, VX_BASE1 = 0.35;  // the wind's base leaves the foot at VX_BASE0, reaching the top VX_BASE1 later
// A cell's lean on a click's schedule: mostly a smooth field, so the page breaks along soft,
// wandering edges rather than cell by cell. p: the cell's centre (CSS px); c: the cell.
float vortexJit(vec2 p, vec2 c) { return clamp(0.5 + (noise(p * 0.009) - 0.5) * 1.8 + (hash(c + 0.37) - 0.5) * 0.06, 0.0, 1.0); }
// The wind (up: 0 at the foot of the screen, 1 at the top) reaches a height a little before the
// gathering there starts, and dies there once its cubes have landed. Its band at P (CSS px, y down):
// x its top, y its base.
float vortexWindOn(float up) { return VX_C0 - 0.07 + VX_C1 * up; }
vec2 vortexBand(float P, vec2 S) {
  float top = (P - vortexWindOn(0.0)) / VX_C1, base = (P - VX_BASE0) / VX_BASE1;
  return vec2(S.y * (1.0 - min(top, 1.7)), base <= 0.0 ? S.y + 20.0 : S.y * (1.0 - base));
}
// Its widest radius, at the base: wider as it grows.
float vortexWide(vec2 band, vec2 S) { return min(S.x * 0.48, 150.0 + (band.y - band.x) * 0.5); }
// The share of that a cube orbits at, at height y: a trumpet, wide at the foot, closed into the core
// by halfway up; the cubes hug the core no closer than VX_HUG.
const float VX_HUG = 0.35;
float vortexFunnel(float y, vec2 band) {
  float k = clamp((band.y - y) / max(band.y - band.x, 1.0), 0.0, 1.0);
  return 1.0 - 0.9 * (1.0 - pow(1.0 - min(k / 0.55, 1.0), 2.6));
}
// A cube's own way through the vortex, so no two in a row move as one: its pace (a warp of u that
// leaves both ends where they are), how far ahead of or behind the flow it rides round the axis
// mid-flight, and its number of half turns. c: its cell.
vec3 vortexCharacter(vec2 c) {
  float h1 = hash(c + 11.3), h2 = hash(c + 13.7), h3 = hash(c + 5.3);
  return vec3((h1 - 0.5) * 1.4, (h2 - 0.5) * TAU, h3 < 0.35 ? 5.0 : h3 < 0.75 ? 7.0 : 9.0);
}
float vortexPace(float u, float a) { return u + a * u * (1.0 - u); }
// Eased through the core: 0 at u = 0, 1 at u = 1, moving 1 + K times faster at u = 0.5.
float coreEase(float u, float K) { return (u * (1.0 + 0.5 * K) - K * sin(TAU * u) / (4.0 * PI)) / (1.0 + 0.5 * K); }
float vortexTurn(float u) { return coreEase(u, VX_SPIN); }
// Its angular speed, 0 at the rim to 1 at the core.
float vortexSpin(float u) { float s = sin(PI * u); return s * s; }
// How deep into the vortex it is (0 at rest, 1 at the core).
float vortexDepth(float u) { return smoothstep(0.0, 1.0, sin(PI * u)); }
// Where it is at u: x across, y down, z toward the viewer (CSS px). home: where it left; drop: how
// far along the axis it is carried (down, or up if negative); ax: the axis (x); rc: the radius it
// closes in to; turns: an odd number of half turns; phase: how far ahead of the flow it rides round
// the axis mid-flight (none at either end). th: its angle about the axis; tilt: how far its orbit
// leans.
vec3 vortexAt(vec2 home, float drop, float ax, float rc, float turns, float phase, float u, out float th, out float tilt) {
  float r0 = home.x - ax;
  float k = vortexDepth(u);
  // It turns from the moment it leaves but closes in later, so the outer flow sweeps wide arcs.
  float r = mix(r0, sign(r0) * min(abs(r0), rc), pow(k, 1.7));
  th = turns * PI * vortexTurn(u) + phase * vortexSpin(u);
  tilt = VX_TILT * smoothstep(0.0, 0.4, k);
  float X = r * cos(th), Z = r * sin(th) * 0.75;
  float y = home.y + drop * coreEase(u, VX_SINK);
  return vec3(ax + X, y + Z * sin(tilt), Z * cos(tilt));
}
// The radius a click's cubes close in to (each its own share of it).
float vortexRc(vec2 size) { return min(size.x, size.y) * 0.2; }

// A seam cube's whole turns round the vortex (2 to 4) in half turns, and a half more when it lands
// across the axis, so it is released on its new cell's side.
float vortexSeamTurns(vec2 c, bool across) { float h = hash(c + 5.3); return 2.0 * (h < 0.35 ? 2.0 : h < 0.75 ? 3.0 : 4.0) + (across ? 1.0 : 0.0); }
// How much of its turn it has made by u: its angular speed climbs as it is swept up (over VX_IN),
// holds round the vortex and eases as it is thrown (over VX_OUT): a trapezoid, from VX_V0 at rest.
const float VX_IN = 0.12, VX_OUT = 0.2, VX_V0 = 0.08;
float vortexSweep(float u) {
  u = clamp(u, 0.0, 1.0);
  float a = VX_IN, b = VX_OUT;
  float I = u < a ? u * u / (2.0 * a) : u > 1.0 - b ? 1.0 - 0.5 * a - 0.5 * b - (1.0 - u) * (1.0 - u) / (2.0 * b) : u - 0.5 * a;
  return (VX_V0 * u + (1.0 - VX_V0) * I) / (VX_V0 + (1.0 - VX_V0) * (1.0 - 0.5 * a - 0.5 * b));
}
// The swarms: VX_SWARMS clumps the cubes gather into, a density wave turning with the wind (with the
// scroll, and the clock, so they keep turning while the page is still), its arms twisting a little
// across the funnel. A cube's angle phi round the axis is drawn toward the nearest clump, never past it.
const float VX_SWARMS = 5.0, VX_CLUMP = 0.82, VX_WAVE = 80.0;
float vortexSwarm(float phi, float P, float t, float f) {
  float wave = VX_WAVE * P + 1.4 * t + 2.0 * (f - 0.9) / 0.1;
  return phi - VX_CLUMP * sin(VX_SWARMS * (phi - wave)) / VX_SWARMS;
}
// A throw's swerve: a stretch of the Lorenz attractor (σ 10, ρ 28, β 8/3) from p0, VX_LZ_T long,
// tau (0..1) of the way along, as a bridge: none at either end.
const int VX_LZ_N = 32;
const float VX_LZ_T = 0.8, VX_LZ_PX = 2.4;
vec3 lorenz(vec3 p) { return vec3(10.0 * (p.y - p.x), p.x * (28.0 - p.z) - p.y, p.x * p.y - 8.0 / 3.0 * p.z); }
vec3 vortexSwerve(vec3 p0, float tau) {
  float dt = VX_LZ_T / float(VX_LZ_N), k = tau * float(VX_LZ_N);
  vec3 p = p0, at = p0;
  for (int i = 0; i < VX_LZ_N; i++) {
    vec3 q = p + dt * lorenz(p + 0.5 * dt * lorenz(p));
    if (float(i) < k && k <= float(i + 1)) at = mix(p, q, k - float(i));
    p = q;
  }
  return at - p0 - tau * (p - p0);
}
// How high (CSS px, y down) a seam's cube orbits at u: from its own cell's height it rises with the
// wind to a little above the higher of its two cells, so it is always thrown down onto its new one.
float vortexRise(vec2 home, vec2 dest, float u, vec2 S) { return mix(home.y, min(home.y, dest.y) - 0.07 * S.y, smoothstep(0.1, 0.85, u)); }
// Where a seam cube is at u, from cell c at home to dest: swept off its cell onto the wind by u
// 1.4 VX_IN, carried round the axis as wide as the funnel where it is, with the swarms, rising, then
// thrown off over the last VX_OUT, swerving and overshooting a little as it settles onto dest. P: the
// seam's progress; t: the clock; S: the screen. th: the cube's own turn about the upright axis, an
// odd number of half turns in all, so its other face comes up; grip: how far it is in the wind (0 on
// the page); rad: its orbit's radius.
vec3 vortexOrbit(vec2 home, vec2 dest, vec2 c, float u, float P, float t, vec2 S, out float th, out float grip, out float rad) {
  float ax = 0.5 * S.x;
  float h1 = hash(c + 1.7), h2 = hash(c + 21.1), h3 = hash(c + 23.9), h4 = hash(c + 27.3), h5 = hash(c + 31.7);
  float f = 0.8 + 0.2 * sqrt(h1);
  vec2 band = vortexBand(P, S);
  float y = vortexRise(home, dest, u, S);
  rad = vortexWide(band, S) * f * max(vortexFunnel(y, band), VX_HUG);
  bool across = (home.x < ax) != (dest.x < ax);
  float a = vortexSeamTurns(c, across) * PI * vortexSweep(u);
  th = a + (across ? 0.0 : PI * smoothstep(0.1, 0.9, u));
  float c0 = smoothstep(0.0, 1.4 * VX_IN, u);
  float tau = clamp((u - 1.0 + VX_OUT) / VX_OUT, 0.0, 1.0);
  float wz = smoothstep(0.0, 1.0, tau);
  grip = c0 * (1.0 - wz);
  float phi = a + (home.x < ax ? PI : 0.0);
  phi = mix(phi, vortexSwarm(phi, P, t, f), grip);
  float Z = rad * sin(phi) * 0.8;
  vec3 ring = vec3(ax + rad * cos(phi), y + Z * sin(VX_TILT) + (h4 - 0.5) * 26.0, Z * cos(VX_TILT));
  vec3 p = mix(vec3(home, 0.0), ring, c0);
  float wxy = tau * tau * (10.0 - 16.0 * tau + 7.0 * tau * tau);
  p = vec3(mix(p.xy, dest, wxy), mix(p.z, 0.0, wz));
  if (tau > 0.0 && tau < 1.0) {
    vec3 L = vortexSwerve(vec3(2.0, 3.0, 22.0) + (vec3(h2, h3, h5) - 0.5) * vec3(14.0, 14.0, 10.0), tau);
    float psi = h5 * TAU;
    p += vec3(cos(psi) * L.x - sin(psi) * L.y, -0.8 * L.z, sin(psi) * L.x + cos(psi) * L.y) * VX_LZ_PX * sin(PI * tau);
  }
  return p;
}
// Science arrives blurred. Once the gathering is done the vortex's base lifts and climbs the screen,
// leaving a narrow clearing front immediately beneath it. A slight curve follows the base ring,
// always below it so Science stays blurred throughout the vortex itself. Nothing clears
// until VX_BLUR_WAIT after it is built, so the blur shows with no cubes about, and it then sharpens
// over VX_BLUR_D.
const float VX_BLUR_WAIT = 0.08, VX_BLUR_D = 0.14, VX_REACH_W = 0.025;
// The blur at q (CSS px on the screen S), amt 0 sharp .. 1 fully blurred: the lower world's snapshot
// (tex: uTexB, mipmapped) read at a coarser level the blurrier, in five taps.
vec3 vortexBlur(sampler2D tex, vec2 q, vec2 S, float amt) {
  vec2 uv = vec2(q.x / S.x, 1.0 - q.y / S.y);
  float lod = 5.4 * pow(clamp(amt, 0.0, 1.0), 0.8);
  vec2 o = exp2(lod) * 0.7 / vec2(textureSize(tex, 0));
  vec3 c = textureLod(tex, uv, lod).rgb * 2.0
         + textureLod(tex, uv + vec2(o.x, 0.4 * o.y), lod).rgb + textureLod(tex, uv - vec2(o.x, 0.4 * o.y), lod).rgb
         + textureLod(tex, uv + vec2(-0.4 * o.x, o.y), lod).rgb + textureLod(tex, uv - vec2(-0.4 * o.x, o.y), lod).rgb;
  return c / 6.0;
}
// The visible lower edge of the tilted base ring, projected as in units.js flowAt/onScreen.
// Solve both intersections of its projected ellipse and use the lower one; outside the silhouette,
// continue from the side. This keeps the clearing underneath the tendrils, including perspective.
float vortexClearY(float x, float P, vec2 S) {
  vec2 band = vortexBand(P, S);
  float R = vortexWide(band, S), a = 0.8 * R * cos(VX_TILT) / 1100.0;
  // Match the flow's 700 px depth cap on very wide screens as well.
  float cap = 700.0 / 1100.0, side = min(a, cap / a);
  float k = min(abs(x - S.x * 0.5) / R, sqrt(1.0 - side * side) / (1.0 - a * side));
  float d = sqrt(max(0.0, 1.0 - k * k * (1.0 - a * a)));
  vec2 sn = (k * k * a + vec2(-d, d)) / (1.0 + k * k * a * a);
  float clipped = sqrt(max(0.0, 1.0 - pow(k * (1.0 - cap), 2.0)));
  if (a * clipped >= cap) sn.y = clipped;
  vec2 y = S.y * 0.5 + (band.y - S.y * 0.5 + 0.8 * R * sn * sin(VX_TILT)) / (1.0 - min(a * sn, vec2(cap)));
  return max(y.x, y.y) + 0.008 * S.y;
}
// The latest landing round q (lerp.js vortexPlanTexels' fourth channel, in uReach, on the cube grid
// g), read smoothly across the cells.
float vortexLandNear(sampler2D plan, vec2 q, vec4 g) {
  vec2 f = q / g.zw - 0.5;
  ivec2 i = ivec2(floor(f)), n = ivec2(g.xy) - 1;
  vec2 t = fract(f);
  float a = texelFetch(plan, clamp(i, ivec2(0), n), 0).w, b = texelFetch(plan, clamp(i + ivec2(1, 0), ivec2(0), n), 0).w;
  float c = texelFetch(plan, clamp(i + ivec2(0, 1), ivec2(0), n), 0).w, d = texelFetch(plan, clamp(i + ivec2(1, 1), ivec2(0), n), 0).w;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
// How sharp q is (0 blurred, 1 sharp), built round land: the later of its wait and the ring's front.
float vortexSharp(vec2 q, float land, float P, vec2 S) {
  float t = (P - land - VX_BLUR_WAIT) / VX_BLUR_D;
  if (t <= 0.0) return 0.0;
  float front = ((q.y - vortexClearY(q.x, P, S)) / S.y + 0.004 * (noise(q * 0.006) - 0.5)) / VX_REACH_W;
  return smoothstep(0.0, 1.0, clamp(min(t, front), 0.0, 1.0));
}
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
