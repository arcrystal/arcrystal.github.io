// The nebulae Science's stars leave (Science → Racing): one shared model, evaluated here for the plan
// (dew-plan.js beads their filaments into pearls of water) and in GLSL (glsl/dew.js draws them), the
// same analytic functions both sides, so every pearl forms on a filament the shader draws.
//
// Massive stars end as supernovae: the Crab (a pulsar wind nebula, blue-white synchrotron light in a
// cage of red filaments), Cassiopeia A (a young, knotty, lop-sided shell with a jet), the Veil (an old
// shell seen as braided arcs). Lower-mass, cooler giants shed their envelopes as planetary nebulae:
// the Cat's Eye (nested, mutually tilted shells, jets with knots at their ends), a butterfly (two
// lobes pinched by a dusty waist), the Ring (a tilted torus with comet-shaped knots on its inner edge).
//
// Each is drawn in its own frame: u = R(−angle)(q − S) / R(P), with x shrunk by its aspect. A filament
// is the zero set of a family g(u) where its mask m(u) is on; the shader draws |g| / |∇g| as a line,
// the plan traces g = 0 and beads it (Rayleigh–Plateau: a thread of radius a breaks into drops λ ≈
// 9.02 a apart, each of radius ≈ 1.89 a, with small satellites between).

export const NEB = Object.freeze({ crab: 0, catseye: 1, butterfly: 2, casA: 3, veil: 4, ring: 5 });
export const NEB_KINDS = Object.freeze(['crab', 'catseye', 'butterfly', 'casA', 'veil', 'ring']);
export const SUPERNOVA = new Set([NEB.crab, NEB.casA, NEB.veil]);
// How many filament families each type has.
export const FAMILIES = Object.freeze([3, 5, 3, 3, 4, 3]);
// The thread's radius a (px) when it beads, by type, and the RP wavelength factor.
export const THREAD = Object.freeze([1.15, 1.0, 1.1, 1.2, 0.95, 1.05]);
export const RP = Object.freeze({ lambda: 9.02, bead: 1.89, satellite: 0.32 });

const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const len = (x, y) => Math.sqrt(x * x + y * y);
// An ellipse's scaled radius − 1: zero on the ellipse of semi-axes (a, b) turned by d.
const ell = (x, y, a, b, d) => { const c = Math.cos(d), s = Math.sin(d); return len((c * x + s * y) / a, (-s * x + c * y) / b) - 1; };

// Family k of type t at u = (x, y): [g, mask, colour index (0 Hα/[N II]/[S II] red, 1 [O III] teal,
// 2 the mix between, 3 synchrotron white)]. p: the event's four phases.
export function family(t, k, x, y, p) {
  const r = len(x, y), th = Math.atan2(y, x);
  switch (t) {
    case NEB.crab: {
      const b = 1 + 0.08 * Math.sin(3 * th + p[0]) + 0.05 * Math.sin(5 * th + p[1]), rho = r / b;
      if (k === 0) return [Math.sin(9 * th + 1.4 * Math.sin(4 * rho + p[2]) + p[3]), sst(0.3, 0.55, rho) * (1 - sst(0.92, 1.02, rho)) * sst(-0.2, 0.4, Math.sin(5 * th + 7 * rho + p[0])), 0];
      if (k === 1) return [Math.sin(10 * rho + 1.2 * Math.sin(3 * th + p[2])), sst(0.45, 0.7, rho) * (1 - sst(0.95, 1.03, rho)) * sst(-0.3, 0.3, Math.sin(7 * th + p[3])), 2];
      return [rho - 0.97, 0.8 * sst(-0.5, 0.2, Math.sin(4 * th + p[1])), 0];
    }
    case NEB.catseye: {
      if (k === 0) return [ell(x, y, 1.0, 0.55, 0), sst(-0.7, 0.0, Math.sin(2 * th + p[0])) * 0.9 + 0.1, 0];
      if (k === 1) return [ell(x, y, 0.8, 0.62, 0.5), 1, 0];
      if (k === 2) return [ell(x, y, 0.55, 0.38, -0.35), 1, 1];
      if (k === 3) return [ell(x, y, 0.32, 0.2, 0.15), 1, 1];
      return [(y - 0.03 * Math.sin(6 * x + p[1])) * 6, sst(0.55, 0.7, Math.abs(x)) * (1 - sst(1.05, 1.2, Math.abs(x))), 0];
    }
    case NEB.butterfly: {
      const rb = 0.14 + 0.95 * Math.pow(Math.abs(Math.cos(th)), 0.55), rho = r / rb;
      if (k === 0) return [rho - 1, sst(-0.6, 0.1, Math.sin(5 * th + p[0])) * 0.85 + 0.15, 0];
      if (k === 1) return [Math.sin(13 * r + 2 * Math.sin(3 * th + p[1]) + p[2]), (1 - sst(0.85, 1, rho)) * sst(0.15, 0.3, r), 2];
      return [rho - 0.62, 0.7, 1];
    }
    case NEB.casA: {
      const b = 1 + 0.1 * Math.sin(2 * th + p[0]) + 0.07 * Math.sin(3 * th + p[1]) + 0.05 * Math.sin(7 * th + p[2]), rho = r / b;
      if (k === 0) return [rho - 0.95, 0.9, 0];
      if (k === 1) return [Math.sin(21 * th + 3 * Math.sin(5 * rho + p[3])), sst(0.62, 0.8, rho) * (1 - sst(0.97, 1.02, rho)) * sst(-0.2, 0.5, Math.sin(9 * th + p[1])), 2];
      const c = Math.cos(p[3]), s = Math.sin(p[3]), jx = c * x + s * y, jy = -s * x + c * y;
      return [jy * 10, sst(0.8, 1, rho) * (1 - sst(1.45, 1.6, r)) * (jx > 0 ? 1 : 0), 1];
    }
    case NEB.veil: {
      const b = 1 + 0.08 * Math.sin(2 * th + p[0]), arc = sst(-0.25, 0.25, 0.7 * Math.sin(2 * th + p[1]) + 0.5 * Math.sin(th + 2 * p[1]));
      return [(r - b * (1 - 0.045 * k)) * 14 + 0.6 * Math.sin(7 * th + k * 1.7 + p[2]), arc * (0.5 + 0.5 * sst(-0.6, 0.6, Math.sin(11 * th + k + p[3]))), k < 2 ? 1 : 0];
    }
    default: {   // the Ring
      if (k === 0) return [r - 1 - 0.04 * Math.sin(3 * th + p[0]), 0.8, 0];
      if (k === 1) return [r - 0.55 - 0.03 * Math.sin(4 * th + p[1]), 0.9, 2];
      return [Math.sin(36 * th + p[2]), sst(0.5, 0.6, r) * (1 - sst(0.72, 0.8, r)) * sst(0.3, 0.6, Math.sin(5 * th + p[3])), 0];
    }
  }
}

// The colours of the lines (linear sRGB): Hα with [N II] and [S II]; [O III]; their mix; synchrotron.
export const LINE_RGB = Object.freeze([[1.0, 0.24, 0.3], [0.2, 1.0, 0.78], [1.0, 0.72, 0.42], [0.62, 0.75, 1.0]]);

// Where event e's frame puts plan point q, at its visible radius R.
export function frame(e, q, R) {
  const c = Math.cos(e.angle), s = Math.sin(e.angle), dx = q[0] - e.S[0], dy = q[1] - e.S[1];
  return [(c * dx + s * dy) / (R * e.aspect), (-s * dx + c * dy) / R];
}
export function unframe(e, u, R) {
  const c = Math.cos(e.angle), s = Math.sin(e.angle), x = u[0] * R * e.aspect, y = u[1] * R;
  return [e.S[0] + c * x - s * y, e.S[1] + s * x + c * y];
}

// Trace the zero set of family k of event e at visible radius R (plan px) where its mask is over .35:
// marching squares on a grid of step h, the crossings linked into polylines.
export function threads(e, k, R, W, H, h = 1.5) {
  const ext = R * Math.max(e.aspect, 1) * 1.65;
  const x0 = Math.max(0, e.S[0] - ext), x1 = Math.min(W, e.S[0] + ext), y0 = Math.max(0, e.S[1] - ext), y1 = Math.min(H, e.S[1] + ext);
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1;
  if (nx < 2 || ny < 2) return [];
  const G = new Float64Array(nx * ny), M = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const [ux, uy] = frame(e, [x0 + i * h, y0 + j * h], R), f = family(e.type, k, ux, uy, e.phase);
    G[j * nx + i] = f[0]; M[j * nx + i] = f[1];
  }
  // A crossing on each grid edge with a sign change, keyed by the edge.
  const pts = new Map();
  const edge = (i, j, dir) => {
    const key = (j * nx + i) * 2 + dir;
    if (pts.has(key)) return key;
    const a = G[j * nx + i], b = dir ? G[(j + 1) * nx + i] : G[j * nx + i + 1];
    const t = a / (a - b);
    pts.set(key, dir ? [x0 + i * h, y0 + (j + t) * h] : [x0 + (i + t) * h, y0 + j * h]);
    return key;
  };
  const link = new Map();
  const join = (a, b) => { (link.get(a) ?? link.set(a, []).get(a)).push(b); (link.get(b) ?? link.set(b, []).get(b)).push(a); };
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const g00 = G[j * nx + i], g10 = G[j * nx + i + 1], g01 = G[(j + 1) * nx + i], g11 = G[(j + 1) * nx + i + 1];
    const m = (M[j * nx + i] + M[j * nx + i + 1] + M[(j + 1) * nx + i] + M[(j + 1) * nx + i + 1]) / 4;
    if (m < 0.35) continue;
    const c = [];
    if ((g00 < 0) !== (g10 < 0)) c.push(edge(i, j, 0));
    if ((g10 < 0) !== (g11 < 0)) c.push(edge(i + 1, j, 1));
    if ((g01 < 0) !== (g11 < 0)) c.push(edge(i, j + 1, 0));
    if ((g00 < 0) !== (g01 < 0)) c.push(edge(i, j, 1));
    if (c.length === 2) join(c[0], c[1]);
    else if (c.length === 4) { join(c[0], c[1]); join(c[2], c[3]); }
  }
  // Open threads from their ends, then closed loops.
  const seen = new Set(), lines = [];
  const walk = s0 => {
    const line = [];
    let prev = -1, cur = s0;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); line.push(pts.get(cur));
      const nxt = link.get(cur).find(b => b !== prev && !seen.has(b));
      prev = cur; cur = nxt;
    }
    return line;
  };
  for (const [key, nb] of link) if (nb.length === 1 && !seen.has(key)) { const l = walk(key); if (l.length > 3) lines.push(l); }
  for (const key of link.keys()) if (!seen.has(key)) { const l = walk(key); if (l.length > 3) { l.push(l[0]); lines.push(l); } }
  return lines;
}

// Beads along a polyline every λ (±12%), with a small satellite midway, as the instability leaves them.
export function bead(line, a, random) {
  const lam = RP.lambda * a, out = [];
  let next = lam * (0.3 + 0.7 * random()), s = 0, lastMain = null;
  for (let k = 1; k < line.length; k++) {
    const p = line[k - 1], q = line[k], d = len(q[0] - p[0], q[1] - p[1]);
    // A thread folded back on itself across a grid sign flip: a seam, not a filament.
    if (d > 4) { next = s + d + lam * 0.5; s += d; lastMain = null; continue; }
    while (next <= s + d) {
      const t = (next - s) / d, at = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      if (lastMain && random() < 0.7) out.push({ p: [(lastMain[0] + at[0]) / 2, (lastMain[1] + at[1]) / 2], r: RP.bead * a * RP.satellite, sat: true });
      out.push({ p: at, r: RP.bead * a * (0.85 + 0.3 * random()), sat: false });
      lastMain = at;
      next += lam * (0.88 + 0.24 * random());
    }
    s += d;
  }
  return out;
}

const f6 = x => Number(x).toFixed(6);
// GLSL: the same families. nebFamily(t, k, u, p) → vec3(g, mask, colour index).
export const NEBULAE_GLSL = /* glsl */ `
float nebS(float a, float b, float x) { return smoothstep(a, b, x); }
float nebEll(vec2 u, float a, float b, float d) { float c = cos(d), s = sin(d); return length(vec2((c * u.x + s * u.y) / a, (-s * u.x + c * u.y) / b)) - 1.0; }
vec3 nebFamily(int t, int k, vec2 u, vec4 p) {
  float r = length(u), th = atan(u.y, u.x);
  if (t == ${NEB.crab}) {
    float b = 1.0 + .08 * sin(3.0 * th + p.x) + .05 * sin(5.0 * th + p.y), rho = r / b;
    if (k == 0) return vec3(sin(9.0 * th + 1.4 * sin(4.0 * rho + p.z) + p.w), nebS(.3, .55, rho) * (1.0 - nebS(.92, 1.02, rho)) * nebS(-.2, .4, sin(5.0 * th + 7.0 * rho + p.x)), 0.0);
    if (k == 1) return vec3(sin(10.0 * rho + 1.2 * sin(3.0 * th + p.z)), nebS(.45, .7, rho) * (1.0 - nebS(.95, 1.03, rho)) * nebS(-.3, .3, sin(7.0 * th + p.w)), 2.0);
    return vec3(rho - .97, .8 * nebS(-.5, .2, sin(4.0 * th + p.y)), 0.0);
  }
  if (t == ${NEB.catseye}) {
    if (k == 0) return vec3(nebEll(u, 1.0, .55, 0.0), nebS(-.7, 0.0, sin(2.0 * th + p.x)) * .9 + .1, 0.0);
    if (k == 1) return vec3(nebEll(u, .8, .62, .5), 1.0, 0.0);
    if (k == 2) return vec3(nebEll(u, .55, .38, -.35), 1.0, 1.0);
    if (k == 3) return vec3(nebEll(u, .32, .2, .15), 1.0, 1.0);
    return vec3((u.y - .03 * sin(6.0 * u.x + p.y)) * 6.0, nebS(.55, .7, abs(u.x)) * (1.0 - nebS(1.05, 1.2, abs(u.x))), 0.0);
  }
  if (t == ${NEB.butterfly}) {
    float rb = .14 + .95 * pow(abs(cos(th)), .55), rho = r / rb;
    if (k == 0) return vec3(rho - 1.0, nebS(-.6, .1, sin(5.0 * th + p.x)) * .85 + .15, 0.0);
    if (k == 1) return vec3(sin(13.0 * r + 2.0 * sin(3.0 * th + p.y) + p.z), (1.0 - nebS(.85, 1.0, rho)) * nebS(.15, .3, r), 2.0);
    return vec3(rho - .62, .7, 1.0);
  }
  if (t == ${NEB.casA}) {
    float b = 1.0 + .1 * sin(2.0 * th + p.x) + .07 * sin(3.0 * th + p.y) + .05 * sin(7.0 * th + p.z), rho = r / b;
    if (k == 0) return vec3(rho - .95, .9, 0.0);
    if (k == 1) return vec3(sin(21.0 * th + 3.0 * sin(5.0 * rho + p.w)), nebS(.62, .8, rho) * (1.0 - nebS(.97, 1.02, rho)) * nebS(-.2, .5, sin(9.0 * th + p.y)), 2.0);
    float c = cos(p.w), s = sin(p.w), jx = c * u.x + s * u.y, jy = -s * u.x + c * u.y;
    return vec3(jy * 10.0, nebS(.8, 1.0, rho) * (1.0 - nebS(1.45, 1.6, r)) * step(0.0, jx), 1.0);
  }
  if (t == ${NEB.veil}) {
    float b = 1.0 + .08 * sin(2.0 * th + p.x), arc = nebS(-.25, .25, .7 * sin(2.0 * th + p.y) + .5 * sin(th + 2.0 * p.y));
    return vec3((r - b * (1.0 - .045 * float(k))) * 14.0 + .6 * sin(7.0 * th + float(k) * 1.7 + p.z), arc * (.5 + .5 * nebS(-.6, .6, sin(11.0 * th + float(k) + p.w))), k < 2 ? 1.0 : 0.0);
  }
  if (k == 0) return vec3(r - 1.0 - .04 * sin(3.0 * th + p.x), .8, 0.0);
  if (k == 1) return vec3(r - .55 - .03 * sin(4.0 * th + p.y), .9, 2.0);
  return vec3(sin(36.0 * th + p.z), nebS(.5, .6, r) * (1.0 - nebS(.72, .8, r)) * nebS(.3, .6, sin(5.0 * th + p.w)), 0.0);
}
const int NEB_FAMILIES[6] = int[6](${FAMILIES.join(', ')});
const float NEB_THREAD[6] = float[6](${THREAD.map(f6).join(', ')});
const vec3 NEB_RGB[4] = vec3[4](${LINE_RGB.map(c => `vec3(${c.map(f6).join(', ')})`).join(', ')});
`;
