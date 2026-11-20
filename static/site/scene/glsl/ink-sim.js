// Photography → Chess: the live ink's passes (ink-sim.js, live-ink.js). One fluid on the screen's own grid:
// a cell is 1 and a step is 1, so velocity is cells per step; y is up, as gl_FragCoord's. Every pass draws
// the whole grid with the shared triangle (glsl/index.js VERTEX), reads by texelFetch or by texture at cell
// centres (i + ½), and writes no NaN or Inf (clean). Pressure and divergence are 32-bit: they are
// differences of large numbers.
export const HEADS_MAX = 14, VORTICES_MAX = 16;

const head = outs => /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler2DArray;
uniform vec2 uCells;
${outs}
bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
vec4 clean(vec4 v) { return vec4(bad(v.x) ? 0. : v.x, bad(v.y) ? 0. : v.y, bad(v.z) ? 0. : v.z, bad(v.w) ? 0. : v.w); }
vec4 at(sampler2D t, ivec2 c) { return texelFetch(t, clamp(c, ivec2(0), ivec2(uCells) - 1), 0); }
vec4 lin(sampler2D t, vec2 x) { return texture(t, x / uCells); }
`;
const HEAD = head('out vec4 o;');

// The live heads: each is where its plume's head is (cells), its size (cells) and how alive it is, and its
// velocity (cells per step). A head's carrier is the curl of ψ = (v⊥·d)·e^{−|d|²/R²}: divergence-free, the
// head's own velocity at its middle, nothing far away. Materials ride it, so a body keeps to its plume
// however fast the scroll moves the plume, while the water's own flow shapes it.
const HEADS = /* glsl */ `
uniform vec4 uHead[${HEADS_MAX}];  // x, y (cells), radius (cells), weight
uniform vec4 uHeadV[${HEADS_MAX}]; // vx, vy (cells per step), drag, 0
uniform vec4 uHeadB[${HEADS_MAX}]; // ivory (1) or black (0), the schedule's fill, how far it has melted, depth
uniform int uHeads;
vec2 carrier(vec2 x) {
  vec2 c = vec2(0);
  for (int i = 0; i < ${HEADS_MAX}; i++) {
    if (i >= uHeads) break;
    vec4 h = uHead[i];
    vec2 d = x - h.xy, n = vec2(-uHeadV[i].y, uHeadV[i].x);
    float R = h.z * ${(1.6).toFixed(2)}, w = h.w * exp(-dot(d, d) / (R * R));
    if (w < 1e-4) continue;
    vec2 g = w * (n - 2. / (R * R) * dot(n, d) * d);
    c += vec2(g.y, -g.x);
  }
  return c;
}
`;

// The bake's mist, as columns: (black, ivory, black·depth, ivory·depth) per screen point, one tile a key
// (live-ink.js builds it once from the volume). Read as the volume is: between two keys, the circling pairs
// turned back and on (glsl/living-ink.js orbitKey), so the keys meet instead of ghosting.
export const MOMENTS = /* glsl */ `
uniform sampler2D uMoments;
uniform vec3 uBake;              // the bake's cells (nx, ny) and its key (fractional)
uniform vec4 uOrbit[2];
uniform vec2 uOrbitTurn[2];
uniform float uAspect;
vec2 orbitTurned(vec2 xy, bool later) {
  vec2 q = vec2(xy.x * uAspect, xy.y);
  for (int i = 0; i < 2; i++) {
    if (uOrbit[i].w < .5) continue;
    vec2 d = q - uOrbit[i].xy;
    float h = uOrbit[i].z, r = length(d), x = max(0., r - 1.2 * h) / (.8 * h);
    float t = (later ? uOrbitTurn[i].y : -uOrbitTurn[i].x) * exp(-x * x), c = cos(t), s = sin(t);
    q = uOrbit[i].xy + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  }
  return vec2(q.x / uAspect, q.y);
}
vec4 momentTile(vec2 xy, float k) {
  vec2 tile = vec2(mod(k, 10.), floor(k / 10.)), cells = uBake.xy;
  return texture(uMoments, (tile + clamp(xy, .5 / cells, 1. - .5 / cells)) / vec2(10, 8));
}
// The baked columns at a screen point (uv, y up).
vec4 moments(vec2 xy) {
  float k = uBake.z;
  if (uOrbit[0].w < .5 && uOrbit[1].w < .5) return mix(momentTile(xy, floor(k)), momentTile(xy, ceil(k)), fract(k));
  return mix(momentTile(orbitTurned(xy, false), floor(k)), momentTile(orbitTurned(xy, true), ceil(k)), fract(k));
}
`;

export const SIM_PASSES = {
  // The columns of every key, from the volume: mean density over depth, and the density-weighted depth.
  moments: HEAD + /* glsl */ `
uniform sampler2DArray uVolume;
uniform int uDepth;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 s = vec2(0), sz = vec2(0);
  for (int k = 0; k < 64; k++) {
    if (k >= uDepth) break;
    vec2 d = texelFetch(uVolume, ivec3(c, k), 0).rg;
    float z = (float(k) + .5) / float(uDepth);
    s += d; sz += d * z;
  }
  s /= float(uDepth); sz /= float(uDepth);
  o = vec4(s, sz);
}`,
  // The mist at the start: the bake's own.
  init: HEAD + MOMENTS + /* glsl */ `
void main() { o = clean(moments(gl_FragCoord.xy / uCells)); }`,
  // Vorticity and strain rate (sqrt(2 D:D)) for the forces.
  aux: HEAD + /* glsl */ `
uniform sampler2D uU;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 l = at(uU, c - ivec2(1, 0)).xy, r = at(uU, c + ivec2(1, 0)).xy, b = at(uU, c - ivec2(0, 1)).xy, t = at(uU, c + ivec2(0, 1)).xy;
  vec2 dx = .5 * (r - l), dy = .5 * (t - b);
  float w = dx.y - dy.x, shear = sqrt(2. * (dx.x * dx.x + dy.y * dy.y) + (dy.x + dx.y) * (dy.x + dx.y));
  o = clean(vec4(w, abs(w), shear, 0));
}`,
  // The forces, as this step's change of velocity: vorticity confinement (small eddies kept alive), the dye's
  // buoyancy, the large-scale curl-noise forcing (its gain the thermostat's), each head's drag on the water
  // toward its own velocity and the scroll's stir turning the water round it, and this step's impulses.
  forces: HEAD + HEADS + /* glsl */ `
uniform sampler2D uU, uAux, uMist, uB, uTension, uC;
uniform vec3 uElastic;          // G (the polymer's modulus), L², the most a stress may be
uniform vec2 uBodyBuoy;         // black body's and ivory body's buoyancy (cells per step², per unit)
uniform vec4 uMode[6];          // a mode of the stream function: k (per cell), phase, amplitude
uniform float uGain;            // the thermostat's gain on the forcing
uniform vec4 uVortex[${VORTICES_MAX}]; // this step's impulses: x, y (cells), Γ (cells² per step), core (cells)
uniform int uVortices;
uniform sampler2D uThermo;      // the thermostat (thermo): its gain in .y
uniform float uSwirl;           // the stir's turn round each head (signed: the scroll's direction)
uniform vec3 uFluid;            // confinement, black's and ivory's buoyancy
uniform float uSpeed, uDamp, uTarget; // the most |u|, the drag (as a factor), the energy the thermostat holds
mat2 stress(ivec2 c, vec2 x) {
  // (From the tensor smoothed over its neighbours: the stress never carries a pattern of the grid's own.)
  vec4 Bv = .5 * at(uC, c) + .125 * (at(uC, c + ivec2(1, 0)) + at(uC, c - ivec2(1, 0)) + at(uC, c + ivec2(0, 1)) + at(uC, c - ivec2(0, 1)));
  mat2 A = mat2(1. + Bv.x, Bv.y, Bv.y, 1. + Bv.z);
  float L2 = uElastic.y, tr = min(A[0][0] + A[1][1], .9 * L2), spring = (L2 - 2.) / max(L2 - tr, .1 * L2);
  float w = clamp(lin(uB, x).r, 0., 1.);
  mat2 t = uElastic.x * w * (spring * A - mat2(1));
  return mat2(clamp(t[0], -uElastic.z, uElastic.z), clamp(t[1], -uElastic.z, uElastic.z));
}
void main() {
  vec2 x = gl_FragCoord.xy;
  ivec2 c = ivec2(x);
  vec2 u = at(uU, c).xy;
  vec2 g = .5 * vec2(at(uAux, c + ivec2(1, 0)).y - at(uAux, c - ivec2(1, 0)).y, at(uAux, c + ivec2(0, 1)).y - at(uAux, c - ivec2(0, 1)).y);
  float w = at(uAux, c).x;
  vec2 N = g / (length(g) + 1e-5), f = uFluid.x * w * vec2(N.y, -N.x);
  vec4 m = at(uMist, c), body = lin(uB, x);
  f.y += uFluid.y * m.r + uFluid.z * m.g + uBodyBuoy.x * body.r + uBodyBuoy.y * body.g;
  f += at(uTension, c).xy;
  // The polymer's stress, τ = G w (f A − I) (w: how much black ink is there), and its divergence.
  if (uElastic.x > 0.) {
    mat2 tl = stress(c - ivec2(1, 0), x - vec2(1, 0)), tr = stress(c + ivec2(1, 0), x + vec2(1, 0)), tb = stress(c - ivec2(0, 1), x - vec2(0, 1)), tt = stress(c + ivec2(0, 1), x + vec2(0, 1));
    f += .5 * vec2(tr[0][0] - tl[0][0] + tt[0][1] - tb[0][1], tr[1][0] - tl[1][0] + tt[1][1] - tb[1][1]);
  }
  vec4 th = texelFetch(uThermo, ivec2(0), 0);
  float gain = uGain * th.y;
  // (Over its band the forcing alone cannot bring it back, the kicks keep coming: the water drags more.)
  float drag = uDamp - .004 * clamp(th.x / max(uTarget, 1e-6) - 1., 0., 2.);
  for (int i = 0; i < 6; i++) { vec4 k = uMode[i]; f += gain * k.w * sin(dot(k.xy, x) + k.z) * vec2(k.y, -k.x); }
  for (int i = 0; i < ${HEADS_MAX}; i++) {
    if (i >= uHeads) break;
    vec4 h = uHead[i];
    vec2 d = x - h.xy;
    float R = h.z * 1.6, e = h.w * exp(-dot(d, d) / (R * R));
    f += e * (uHeadV[i].z * (uHeadV[i].xy - u) + uSwirl * vec2(-d.y, d.x) / R);
  }
  u = u * drag + f;
  for (int i = 0; i < ${VORTICES_MAX}; i++) {
    if (i >= uVortices) break;
    vec4 v = uVortex[i];
    vec2 d = x - v.xy;
    float r2 = dot(d, d) + 1e-3;
    u += v.z / (6.2831853 * r2) * (1. - exp(-r2 / (v.w * v.w))) * vec2(-d.y, d.x);
  }
  float s = length(u);
  if (s > uSpeed) u *= uSpeed / s;
  o = clean(vec4(u, 0, 0));
}`,
  // The bodies' viscosity: (1 − ν∇²)u = u* by Jacobi sweeps, ν by how much body is here (black's and ivory's
  // own), so a body moves as one thick thing, folding and stretching slowly, while the water round it stays
  // free. (ν per step, in cells²; implicit, so any ν is stable.)
  // (Ivory thins under shear, Carreau's law: ν = ν∞ + (ν0 − ν∞)(1 + (λγ̇)²)^((n − 1)/2), γ̇ the strain rate.)
  viscous: HEAD + /* glsl */ `
uniform sampler2D uStar, uU, uB, uAux;
uniform vec2 uNu;               // black's ν, ivory's ν at rest
uniform float uNuWater;         // the water's own (a whisper: it damps any pattern of the grid's own)
uniform vec3 uCarreau;          // ivory's ν∞ (as a share of its ν at rest), λ (steps), n
void main() {
  vec2 x = gl_FragCoord.xy;
  ivec2 c = ivec2(x);
  vec4 b = lin(uB, x);
  float shear = at(uAux, c).z, thin = uCarreau.x + (1. - uCarreau.x) * pow(1. + uCarreau.y * uCarreau.y * shear * shear, .5 * (uCarreau.z - 1.));
  float a = uNuWater + uNu.x * b.r + uNu.y * thin * b.g;
  vec2 n = at(uU, c - ivec2(1, 0)).xy + at(uU, c + ivec2(1, 0)).xy + at(uU, c - ivec2(0, 1)).xy + at(uU, c + ivec2(0, 1)).xy;
  o = clean(vec4((at(uStar, c).xy + a * n) / (1. + 4. * a), 0, 0));
}`,
  // Black ink's memory (FENE-P): the conformation tensor A (kept as A − I: near I a half float would lose
  // a small stretch), carried by the flow (bilinear: anything sharper can break A's positiveness), stretched
  // by it (A ← F A Fᵀ, F = I + ∇u, a step's deformation, held to ‖∇u‖ ≤ .5) and relaxing toward I, implicitly,
  // with the FENE-P spring f = (L² − 2)/(L² − tr A): positive weights of positive matrices, so A stays
  // positive. It remembers only in black ink (bodies, and its mist a little); elsewhere it forgets at once.
  conform: HEAD + /* glsl */ `
uniform sampler2D uC, uU, uB, uM;
uniform vec3 uPolymer;          // λ (steps), L², artificial diffusion
uniform float uSteps;
void main() {
  vec2 x = gl_FragCoord.xy;
  ivec2 c = ivec2(x);
  vec2 u = uSteps * at(uU, c).xy;
  vec4 Bv = lin(uC, x - u);
  vec4 nb = .25 * (lin(uC, x - u + vec2(1, 0)) + lin(uC, x - u - vec2(1, 0)) + lin(uC, x - u + vec2(0, 1)) + lin(uC, x - u - vec2(0, 1)));
  Bv = mix(Bv, nb, uPolymer.z);
  mat2 A = mat2(1. + Bv.x, Bv.y, Bv.y, 1. + Bv.z);
  vec2 l = at(uU, c - ivec2(1, 0)).xy, r = at(uU, c + ivec2(1, 0)).xy, b = at(uU, c - ivec2(0, 1)).xy, t = at(uU, c + ivec2(0, 1)).xy;
  // ∇u: column j is ∂u/∂x_j; F = I + ∇u (one step's), mat2 is column-major.
  mat2 L = uSteps * mat2(.5 * (r - l), .5 * (t - b));
  float big = max(max(abs(L[0][0]), abs(L[0][1])), max(abs(L[1][0]), abs(L[1][1])));
  if (big > .5) L *= .5 / big;
  mat2 F = mat2(1) + L;
  A = F * A * transpose(F);
  float L2 = uPolymer.y, tr = min(A[0][0] + A[1][1], .9 * L2);
  float spring = (L2 - 2.) / max(L2 - tr, .1 * L2);
  vec4 body = lin(uB, x), mist = lin(uM, x);
  float black = clamp(body.r, 0., 1.);
  float lambda = mix(1., uPolymer.x, black) / uSteps;
  A = (A + mat2(1) / lambda) / (1. + spring / lambda);
  o = clean(vec4(A[0][0] - 1., A[0][1], A[1][1] - 1., 0));
}`,
  // Advection, MacCormack: the forward semi-Lagrangian step (this pass), then a correction by the backward
  // one, limited to the values round where it came from (advectCorrect). Materials also ride the heads'
  // carriers (uCarry: how much).
  advect: HEAD + HEADS + /* glsl */ `
uniform sampler2D uVel, uSrc;
uniform float uCarry, uScale;    // (uScale: this grid's cells to a fluid cell: about 1.5 for the bodies)
uniform float uSteps;            // how many of the fluid's steps this one carries (2 when the bodies skip one)
void main() {
  vec2 x = gl_FragCoord.xy, u = uSteps * uScale * (lin(uVel, x).xy + (uCarry > 0. ? uCarry * carrier(x / uScale) : vec2(0)));
  o = clean(lin(uSrc, x - u));
}`,
  advectCorrect: HEAD + HEADS + /* glsl */ `
uniform sampler2D uVel, uSrc, uFwd;
uniform float uCarry, uScale;    // (uScale: this grid's cells to a fluid cell: about 1.5 for the bodies)
uniform float uSteps;            // how many of the fluid's steps this one carries (2 when the bodies skip one)
void main() {
  vec2 x = gl_FragCoord.xy, u = uSteps * uScale * (lin(uVel, x).xy + (uCarry > 0. ? uCarry * carrier(x / uScale) : vec2(0)));
  vec4 r = at(uFwd, ivec2(x)) + .5 * (at(uSrc, ivec2(x)) - lin(uFwd, x + u));
  vec2 p = x - u - .5;
  ivec2 i = ivec2(floor(p));
  vec4 a = at(uSrc, i), b = at(uSrc, i + ivec2(1, 0)), c = at(uSrc, i + ivec2(0, 1)), d = at(uSrc, i + ivec2(1, 1));
  o = clean(clamp(r, min(min(a, b), min(c, d)), max(max(a, b), max(c, d))));
}`,
  divergence: HEAD + /* glsl */ `
uniform sampler2D uU;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  o = vec4(.5 * (at(uU, c + ivec2(1, 0)).x - at(uU, c - ivec2(1, 0)).x + at(uU, c + ivec2(0, 1)).y - at(uU, c - ivec2(0, 1)).y), 0, 0, 0);
}`,
  // Pressure, by Jacobi. Outside the grid the pressure is 0 (open: the water goes on past the screen). The
  // first sweep of a step scales the last step's answer (uWarm), so its constant part cannot drift.
  jacobi: HEAD + /* glsl */ `
uniform sampler2D uP, uDiv;
uniform float uWarm;
float p(ivec2 c) { return any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, ivec2(uCells))) ? 0. : texelFetch(uP, c, 0).x; }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float v = uWarm * (p(c - ivec2(1, 0)) + p(c + ivec2(1, 0)) + p(c - ivec2(0, 1)) + p(c + ivec2(0, 1))) - texelFetch(uDiv, c, 0).x;
  o = vec4(bad(v) ? 0. : .25 * v, 0, 0, 0);
}`,
  project: HEAD + /* glsl */ `
uniform sampler2D uU, uP;
float p(ivec2 c) { return any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, ivec2(uCells))) ? 0. : texelFetch(uP, c, 0).x; }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 u = at(uU, c).xy - .5 * vec2(p(c + ivec2(1, 0)) - p(c - ivec2(1, 0)), p(c + ivec2(0, 1)) - p(c - ivec2(0, 1)));
  o = clean(vec4(u, 0, 0));
}`,
  // The mist and its fine detail, carried one step (one pass, two targets). The mist comes from where the
  // flow (and the heads' carriers) bring it, diffused there ten times faster along the flow than across it
  // (never below 0), and is drawn back toward the bake's own mist: slowly near a live head, faster far from
  // one. The detail: where the flow carried it from, D_t + u·∇D = u − D/τ (screen units), held within uTau.y.
  carry: head('layout(location = 0) out vec4 mist;\nlayout(location = 1) out vec4 detail;') + HEADS + MOMENTS + /* glsl */ `
uniform sampler2D uM, uD, uU, uB, uAux;
uniform vec2 uExchange;         // per step: mist condensing into a congealing head's body, body melting to mist
uniform vec2 uErode;            // (the bodies pass's shear erosion: what it strips arrives here as mist)
uniform float uCarry;
uniform vec2 uKappa;            // along, across
uniform vec3 uRelax;            // per step: near a head, far from one, and the handoff's floor
uniform vec2 uTau;              // 1/τ (per step), the most D may be
uniform float uSteps;           // how many of the fluid's steps this one carries
void main() {
  vec2 x = gl_FragCoord.xy;
  vec2 u = uSteps * at(uU, ivec2(x)).xy, y = x - u - uSteps * uCarry * carrier(x);
  vec4 m = lin(uM, y), l = lin(uM, y - vec2(1, 0)), r = lin(uM, y + vec2(1, 0)), b = lin(uM, y - vec2(0, 1)), t = lin(uM, y + vec2(0, 1));
  vec4 rt = lin(uM, y + vec2(1, 1)), rb = lin(uM, y + vec2(1, -1)), lt = lin(uM, y + vec2(-1, 1)), lb = lin(uM, y + vec2(-1, -1));
  float s = length(u);
  vec2 e = s > 1e-4 ? u / s : vec2(1, 0);
  float along = mix(uKappa.y, uKappa.x, smoothstep(.02, .2, s));
  float dxx = uKappa.y + (along - uKappa.y) * e.x * e.x, dyy = uKappa.y + (along - uKappa.y) * e.y * e.y, dxy = (along - uKappa.y) * e.x * e.y;
  m = max(m + dxx * (r + l - 2. * m) + dyy * (t + b - 2. * m) + .5 * dxy * (rt - rb - lt + lb), vec4(0));
  float near = 0.;
  vec2 gives = vec2(0), takes = vec2(0);
  vec4 body = lin(uB, x);
  for (int i = 0; i < ${HEADS_MAX}; i++) {
    if (i >= uHeads) break;
    vec2 d = x - uHead[i].xy;
    float R = uHead[i].z * 2., r2 = dot(d, d);
    near = max(near, uHead[i].w * exp(-r2 / (R * R)));
    vec4 hb = uHeadB[i];
    float e = exp(-r2 / (uHead[i].z * uHead[i].z)), ivory = hb.x;
    // (What the bodies pass takes from the mist and gives back to it: the same rates, so ink is conserved.)
    float grow = e * uHead[i].w * hb.y * (1. - hb.z), melt = exp(-r2 / (2.25 * uHead[i].z * uHead[i].z)) * hb.z;
    gives += uExchange.x * grow * vec2(1. - ivory, ivory);
    takes += uExchange.y * melt * vec2(1. - ivory, ivory);
  }
  m.rg -= gives * m.rg; m.ba -= gives * m.ba;
  float bs = body.r + body.g;
  // (What the bodies' skins lose to shear, as the bodies pass strips it: rate × 4φ(1 − φ) of each ink.)
  vec2 stripped = min(.5, uErode.x * max(0., at(uAux, ivec2(x)).z - uErode.y)) * 4. * body.rg * (1. - bs);
  m.rg += takes * body.rg + stripped; m.ba += takes * body.rg * body.b / max(body.r + body.g, 1e-4);
  m += max(mix(uRelax.y, uRelax.x, near), uRelax.z) * (moments(x / uCells) - m);
  // (Never denser than the bake's densest mist: nothing here may pile up without end.)
  m.rg = min(m.rg, vec2(.6)); m.ba = min(m.ba, m.rg);
  mist = clean(m);
  vec2 d = lin(uD, x - u).xy;
  d += u / uCells - uTau.x * d;
  float n = length(d);
  if (n > uTau.y) d *= uTau.y / n;
  detail = clean(vec4(d, 0, 0));
}`,
  // Surface tension on the bodies (CSF), as a force on the fluid's grid: σ(κ + 1/R)∇φ, φ the bodies' share
  // (black and ivory together) read at the fluid's cells, κ the interface's curvature in the screen's plane
  // and 1/R the other one: a thread seen side on is a cylinder of radius R about half its width, and that
  // squeeze is what makes a thread neck and bead (in a plane alone a strip is stable).
  tension: HEAD + /* glsl */ `
uniform sampler2D uB;
uniform float uSigma;
float phi(vec2 c) { vec4 b = texture(uB, (c + .5) / uCells); return b.r + b.g; }
void main() {
  vec2 c = floor(gl_FragCoord.xy);
  float p = phi(c), l = phi(c - vec2(1, 0)), r = phi(c + vec2(1, 0)), b = phi(c - vec2(0, 1)), t = phi(c + vec2(0, 1));
  float lb = phi(c + vec2(-1, -1)), rb = phi(c + vec2(1, -1)), lt = phi(c + vec2(-1, 1)), rt = phi(c + vec2(1, 1));
  float px = .5 * (r - l), py = .5 * (t - b), pxx = r + l - 2. * p, pyy = t + b - 2. * p, pxy = .25 * (rt - rb - lt + lb);
  float g2 = px * px + py * py;
  if (g2 < 1e-5) { o = vec4(0); return; }
  float g = sqrt(g2), kappa = -(pxx * py * py - 2. * px * py * pxy + pyy * px * px) / (g2 * g);
  float mean = (p + l + r + b + t + lb + rb + lt + rt) / 9., R = max(.75, 1.5 * mean * 3.);
  o = clean(vec4(uSigma * (clamp(kappa, -1.5, 1.5) + 1. / R) * vec2(px, py), 0, 0));
}`,
  // The bodies after they are carried (MacCormack keeps their edges; the drawing takes the 0.5 contour, so a
  // soft edge still draws as a clean line): held against the slow blur by a gentle contrast (pointwise, so
  // it can never raise a pattern of the grid's own: φ moves toward 0 or 1 by β φ(1 − φ)(2φ − 1)), fed by the
  // schedule at each live head's core and by the mist condensing onto it, and melted back to mist as the
  // head dissolves. (.b: the bodies' depth × share.)
  bodies: HEAD + HEADS + /* glsl */ `
uniform sampler2D uB, uM, uAux;
uniform vec2 uErode;            // shear erosion: rate per step per unit of strain rate over the threshold, threshold
uniform vec2 uSharp;            // the contrast β (per step), unused
uniform vec3 uFeed;             // per step: toward the schedule's fill at a core, condensing, melting
uniform float uScale;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 me = at(uB, c);
  vec2 f = me.rg;
  f = clamp(f + uSharp.x * f * (1. - f) * (2. * f - 1.), 0., 1.);
  float mass = me.r + me.g, z = mass > 1e-4 ? me.b / mass : .5;
  vec2 x = gl_FragCoord.xy / uScale;
  vec4 mist = lin(uM, x);
  vec2 added = vec2(0);
  float zAdded = 0., held = 0.;
  for (int i = 0; i < ${HEADS_MAX}; i++) {
    if (i >= uHeads) break;
    vec2 d = x - uHead[i].xy;
    float R = uHead[i].z, r2 = dot(d, d);
    vec4 hb = uHeadB[i];
    held = max(held, uHead[i].w * (1. - hb.z) * exp(-r2 / (9. * R * R)));
    vec2 ink = vec2(1. - hb.x, hb.x);
    float core = exp(-r2 / (.3 * R * R)), e = exp(-r2 / (R * R)), melt = exp(-r2 / (2.25 * R * R)) * hb.z;
    float fill = hb.y * (1. - hb.z) * uHead[i].w;
    // Fed at its core toward the schedule's fill (so the body regrows where its plume is, however the flow
    // has flung it), and by the mist condensing round it; melted as it dissolves.
    vec2 feed = uFeed.x * core * max(vec2(0), fill * ink - f) + uFeed.y * e * fill * ink * mist.rg * smoothstep(.15, .45, f.r + f.g);
    vec2 loss = uFeed.z * melt * ink * f;
    added += feed;
    zAdded += dot(feed, vec2(1)) * hb.w;
    f += feed - loss;
  }
  // (Flung far from every live head, a body thins back to mist: none outlives the heads.)
  f *= 1. - .006 * (1. - held);
  // Sheared hard, its skin is stripped into mist (only at the edge: 4φ(1 − φ)).
  float shear = lin(uAux, x).z;
  f -= min(.5, uErode.x * max(0., shear - uErode.y)) * 4. * f * (1. - f);
  f = clamp(f, 0., 1.);
  float s = f.r + f.g;
  if (s > 1.) f /= s;
  float now = f.r + f.g, kept = max(0., now - dot(added, vec2(1)));
  o = clean(vec4(f, (kept * z + zAdded) , 0));
}`,
  // The bodies' thickness for the shading's normals, at the fluid's grid: a near one (the rim's roll, ±2
  // body cells) and a wide one (the body's dome, ±7), so a body bulges as a whole and rolls at its edge.
  thickness: HEAD + /* glsl */ `
uniform sampler2D uB;
uniform vec2 uFine;
void main() {
  vec2 x = gl_FragCoord.xy * uFine / uCells;
  vec2 nearT = vec2(0), wide = vec2(0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 q = vec2(float(i) - 1.5, float(j) - 1.5);
    nearT += texture(uB, (x + 1.4 * q) / uFine).rg;
    wide += texture(uB, (x + 4.6 * q) / uFine).rg;
  }
  o = clean(vec4(nearT / 16., wide / 16.));
}`,
  // The bodies' dome: their thickness over ±10 fluid cells, at the fluid's grid, so a whole body bulges,
  // highest in its middle, and catches the light across it.
  dome: HEAD + /* glsl */ `
uniform sampler2D uB;
uniform vec2 uFine;             // the body grid's cells
uniform float uReach;           // the spacing of the taps (body cells)
void main() {
  vec2 x = gl_FragCoord.xy * uFine / uCells;
  vec2 s = vec2(0);
  float w = 0.;
  for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) {
    vec2 q = vec2(float(i) - 2., float(j) - 2.);
    float k = exp(-.35 * dot(q, q));
    s += k * texture(uB, (x + uReach * q) / uFine).rg; w += k;
  }
  o = clean(vec4(s / w, 0, 0));
}`,
  // The bodies' surface slope, per body cell, at the fluid's grid: the height is the dome's square root (round
  // in the middle, steep at the edge), the nearer swell's and the rim's own roll; its slope is kept here so
  // the drawing interpolates slopes (smooth normals), not heights (whose slope would step at every texel).
  slope: HEAD + /* glsl */ `
uniform sampler2D uThick, uDome;
uniform float uPer;             // body cells per fluid cell
float h(ivec2 c) {
  vec4 t = at(uThick, c);
  vec2 d = at(uDome, c).rg;
  return 14. * sqrt(max(d.r + d.g, 0.)) + 4. * sqrt(max(t.b + t.a, 0.)) + 1.2 * (t.r + t.g);
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  o = clean(vec4(.5 * vec2(h(c + ivec2(1, 0)) - h(c - ivec2(1, 0)), h(c + ivec2(0, 1)) - h(c - ivec2(0, 1))) / uPer, 0, 0));
}`,
  // The carried detail's large scales, for the veils (a quarter of the grid each way): a sheet bends with
  // the flow, never with its fine detail, so its own mesh never shows as kinks. 16 taps over ±6 cells.
  smooth: HEAD + /* glsl */ `
uniform sampler2D uD;
uniform vec2 uFine;             // the grid's cells
void main() {
  vec2 x = gl_FragCoord.xy * uFine / uCells;
  vec2 s = vec2(0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) s += texture(uD, (x + 4. * vec2(float(i) - 1.5, float(j) - 1.5)) / uFine).xy;
  o = clean(vec4(s / 16., 0, 0));
}`,
  // The thermostat on the GPU (ink-sim.js createThermostat, the same law): the energy just measured, eased
  // over τ, and a gain proportional to how far it is from the target; nothing is read back to the page.
  thermo: HEAD + /* glsl */ `
uniform sampler2D uHealth, uLast;
uniform vec4 uLaw;              // target energy, easing (1 − e^{−Δt/τ}), gain per unit of shortfall, 1 if starting
uniform vec2 uBounds;           // the gain's least and most
void main() {
  float e = texelFetch(uHealth, ivec2(0), 0).x;
  vec4 last = texelFetch(uLast, ivec2(0), 0);
  float mean = uLaw.w > .5 ? e : last.x + (e - last.x) * uLaw.y;
  if (bad(mean)) mean = uLaw.x;
  o = vec4(mean, clamp(1. + uLaw.z * (uLaw.x - mean) / max(uLaw.x, 1e-6), uBounds.x, uBounds.y), e, 0);
}`,
  // The grid's health, a block at a time: mean |u|², the most |u|, mean mist, mean |ω|.
  reduce: HEAD + /* glsl */ `
uniform sampler2D uU, uM;
uniform ivec2 uBlock;           // input cells per output texel
uniform int uFirst;             // 1: read the grid; 0: average texels of the last reduction (uU)
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy) * uBlock;
  vec4 s = vec4(0);
  float n = 0.;
  for (int j = 0; j < 64; j++) {
    if (j >= uBlock.y) break;
    for (int i = 0; i < 64; i++) {
      if (i >= uBlock.x) break;
      ivec2 q = c + ivec2(i, j);
      if (q.x >= int(uCells.x) || q.y >= int(uCells.y)) continue;
      if (uFirst == 1) {
        vec2 u = texelFetch(uU, q, 0).xy;
        vec4 m = texelFetch(uM, q, 0);
        s.x += dot(u, u); s.y = max(s.y, length(u)); s.z += m.r + m.g;
      } else {
        vec4 v = texelFetch(uU, q, 0);
        s.x += v.x; s.y = max(s.y, v.y); s.z += v.z; s.w += v.w;
      }
      n++;
    }
  }
  o = vec4(s.x / max(n, 1.), s.y, s.z / max(n, 1.), s.w / max(n, 1.));
}`,
};
