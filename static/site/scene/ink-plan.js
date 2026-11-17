// Photography → Chess, "ink finding order" (glsl/plume.js draws it). Black and white ink fall into a
// deep volume of water, fold into each other, and find the order of the board:
//   1. The darkroom's tray rises from the foot of the screen and we are under its surface; the safelight
//      gives way to white light from above.
//   2. Two drops fall through the surface, the black first and heavier, the white a beat later and
//      lighter. Each sinks as a vortex ring, slowing: a dark ring of ink carried in a body of fluid, a
//      thin membrane of ink drawn round that body, a canopy left behind it whose rim rolls under, and a
//      stem back up to where it fell from. Then a lobe of each ring falls away as a smaller ring of its
//      own (the cascade a drop of ink makes in still water).
//   3. Four slow whorls, alternating in sense, stand round where the board will be and wind the two
//      clouds into each other: fold, rest, fold.
//   4. Inside, currents align to the board's axes (a Taylor–Green array, a square to a cell); black
//      gathers along the lines between the cells; the white pools as the board's card.
//   5. The threads spread into every other cell and their edges tighten into the squares.
//   6. The pieces form in the starting position, each a plume that clear water carves to its silhouette.
//   7. The pigment takes the tile's own surfaces, the water stills, and the paper it lay over is the tile.
// A kinematic model, not a time-stepped fluid simulation: every frame is a function of the scroll's P.
// A drop's flow is given in the half plane through its axis (its section: two counter-rotating cores
// either side of the axis, and the body they carry), and the ink, which lies on that section as thin
// shells, is seen through the whole of it: the light lost along each line of sight through a figure of
// revolution, so a sheet seen edge on is dark and seen face on a faint veil. Ink is carried in material
// coordinates, found by stepping each point backward through the flow, each core's step an exact
// rotation. Physical: the vortex ring and its Kelvin body (the doublet round a body moving through
// fluid), the Lamb–Oseen core, a ring's lobes falling away as rings, the Taylor–Green array, inertial
// grains leaving rotation for strain (Okubo–Weiss), Beer–Lambert absorption, the Abel integral of a
// figure of revolution. Artistic: where the drops fall and how far, the whorls' stations and turns, the
// hand from fluid to the board (a phase field's front, steered), the order the pieces come in.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// The scroll's clock (P, −.2 … 1.2).
export const INK = Object.freeze({
  // 1: the waterline climbs the screen over water; the red gives way to white light over light.
  water: [-0.075, 0.07], light: [-0.03, 0.12],
  // 2, 3: flow time τ runs 0 → 1 while the drops fall (enter), 1 → tauMax while the whorls wind them
  // (fold), and creeps on after.
  enter: [0.08, 0.33], fold: [0.33, 0.6], tauMax: 3.4,
  // The whorls: how far each has turned at its centre by τ (rad), a fold, a rest, a fold; their cores; where
  // they stand: this far either side of the board's middle, and above and below.
  turns: Object.freeze([[1, 0], [1.3, 0.8], [2.0, 5.6], [2.45, 6.2], [3.2, 10.6], [3.4, 11.0]]),
  core: [0.12, 0.17], station: [0.37, 0.22],
  // 4: the lattice's threads; the card; 5: the squares fill and tighten; the paper rises under the water.
  lattice: [0.56, 0.74], card: [0.6, 0.8], squares: [0.72, 0.9], tighten: [0.8, 0.94], rise: [0.58, 1.1],
  // 6: the pieces, each over span, the first at pieces[0] and the last begun by pieces[1]; the view
  // closes on the board by zoom[0..1] and is back by zoom[2..3].
  pieces: [0.86, 1.0], span: 0.085, zoom: [0.72, 0.88, 1.0, 1.065], zoomBy: [0.6, 0.25],
  // 7: the tile's own picture of the board replaces the pigment; the loose pigment lets go; still water.
  finish: [1.04, 1.1], loose: [0.92, 1.1], still: [1.02, 1.12],
  steps: [20, 14],       // backward substeps (fine pointer, touch)
  sight: [24, 12],       // samples along each line of sight through a drop
});
// A drop of ink sinking through water, in its own units (its axis r = 0; z down from where it entered),
// by its own time u.
export const RING = Object.freeze({
  r0: 0.17, grow: 0.75,             // its ring's radius as it forms, and how much it widens as it slows
  depth: 1.25, slow: 0.9,           // how deep it sinks, slowing as e^(−u/slow)
  canopy: [1.65, 0.5],              // the canopy's rim: this many ring radii out, this far behind
  body: 0.3, core: [0.07, 0.09],    // the body of fluid it carries; its ring's core and its rim's
  turn: [7.5, 3.4],                 // how far its ring and its rim have rolled at their centres, in all (rad)
  span: [1.0, -0.25, 1.75],         // its tile: r 0 … span[0], z span[1] … span[2]
  pace: 1.9,                        // its time for a unit of flow time
});
// The starting position, the top row first (black's back rank), and the six silhouettes' order in the atlas.
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const SHAPES = 'KQBNRP';
// The atlas: a cell's side (px), and the distance it keeps either way (px).
export const GLYPH = Object.freeze({ cell: 96, range: 20 });
// The piece on (file, row) at the start (row 0 the top): its silhouette (index in SHAPES), whether it is
// white, and when it begins to form (0 … 1 of the pieces' time); null on an empty square. The order: the
// knights (the most legible silhouette), kings and queens, rooks, bishops, then the pawns as a ripple out
// from the middle of each rank; black a beat before white.
export function pieceAt(file, row) {
  if (row > 1 && row < 6) return null;
  const white = row >= 6, back = row === 0 || row === 7, mid = Math.abs(file - 3.5);
  const shape = back ? SHAPES.indexOf('RNBQKBNR'[file]) : 5;
  const order = !back ? 0.52 + 0.1 * mid : shape === 3 ? 0 : shape === 0 || shape === 1 ? 0.12 : shape === 4 ? 0.26 : 0.36;
  return { shape, white, when: clamp(order + (white ? 0.06 : 0)) };
}

// Where the tray's surface is at P, as a fraction of the screen's height (1 its foot; it starts below the
// foot and ends above the top): above it the darkroom is still as it was.
export const waterLevel = P => 1.06 - 1.14 * smooth(INK.water[0], INK.water[1], P);

// ---- the flow --------------------------------------------------------------------------------------------
// Flow time by P.
export function flowTime(P) {
  const I = INK;
  if (P <= I.enter[0]) return 0;
  if (P < I.enter[1]) return (P - I.enter[0]) / (I.enter[1] - I.enter[0]);
  return 1 + (I.tauMax - 1) * (1 - (1 - clamp((P - I.fold[0]) / (I.fold[1] - I.fold[0]))) ** 1.6) + 0.2 * clamp((P - I.fold[1]) / 0.3);
}
// A Lamb–Oseen core: the angle a point r from its centre turns when its centre turns dA (core a).
export const lamb = (r2, a2) => { const s = Math.max(r2 / a2, 1e-5); return (1 - Math.exp(-s)) / s; };
// The screen in the flow's own units (its shorter side 1, the middle the origin, y down): half extents.
export const extent = (W, H) => { const m = Math.min(W, H); return [0.5 * W / m, 0.5 * H / m, m]; };

// A drop at its own time u: its ring (radius R, depth z), its canopy's rim (Rc, zc).
export function ringAt(u) {
  const G = RING, e = 1 - Math.exp(-Math.max(u, 0) / G.slow), c = smooth(0.1, 1.5, u);
  const z = G.depth * e, R = G.r0 * (1 + G.grow * e);
  return { z, R, zc: z - G.canopy[1] * c * (0.5 + 0.5 * e), Rc: R * (1 + (G.canopy[0] - 1) * c) };
}
export const ringTurn = u => RING.turn[0] * (1 - Math.exp(-Math.max(u, 0) / 0.85));
export const rimTurn = u => RING.turn[1] * smooth(0.25, 2.2, u);
// What the flow pass reads for a drop at u: for each of K backward substeps (the latest first; even in how
// far it has sunk, so its quick start is as well resolved as its slow end), its four cores (the ring's two
// and the rim's two, either side of the axis: x, z, the turn of its centre over the substep, its radius
// squared) and its body (x, z, how far it moves). The cores turn so the fluid goes down the axis between
// them (a turn θ about a centre moves a point by θ · (−ry, rx)).
export function ringFrame(u, K, cells, bodies) {
  const G = RING, E = 1 - Math.exp(-Math.max(u, 0) / G.slow), at = e => -G.slow * Math.log(Math.max(1 - e, 1e-9));
  for (let k = 0; k < K; k++) {
    const t1 = at(E * (1 - k / K)), t0 = at(E * (1 - (k + 1) / K)), a = ringAt(at(E * (1 - (k + 0.5) / K)));
    const d1 = ringTurn(t1) - ringTurn(t0), d2 = rimTurn(t1) - rimTurn(t0), c1 = G.core[0] ** 2, c2 = G.core[1] ** 2;
    cells.set([a.R, a.z, -d1, c1, -a.R, a.z, d1, c1, a.Rc, a.zc, -d2, c2, -a.Rc, a.zc, d2, c2], k * 16);
    bodies.set([0, a.z, 0, ringAt(t1).z - ringAt(t0).z], k * 4);
  }
}
// The whorls: how far each has turned at its centre by τ, and its core's radius then.
export function whorlTurn(tau) {
  const T = INK.turns;
  if (tau <= T[0][0]) return 0;
  for (let i = 1; i < T.length; i++) if (tau <= T[i][0]) { const [a, va] = T[i - 1], [b, vb] = T[i]; return va + (vb - va) * smooth(a, b, tau); }
  return T[T.length - 1][1];
}
export const coreAt = tau => INK.core[0] + (INK.core[1] - INK.core[0]) * smooth(1, INK.tauMax, tau);
// The stage for a screen W × H whose board's middle is at (bx, by) (CSS px): the four whorls' stations
// round the board (x, y, sense), and the four drops: the black and the white (where each falls from, its
// size, when it falls, its pace) and, from a lobe of each one's ring, a smaller one.
export function stage(W, H, bx, by) {
  const [hx, hy, m] = extent(W, H), zb = [(bx - W / 2) / m, (by - H / 2) / m];
  const sx = Math.min(INK.station[0], hx - 0.2), sy = INK.station[1], cx = clamp(zb[0], -hx + sx + 0.08, hx - sx - 0.08);
  const stations = [[cx - sx, zb[1] - sy + 0.05, 1], [cx - sx, zb[1] + sy + 0.05, -1], [cx + sx, zb[1] - sy - 0.05, -1], [cx + sx, zb[1] + sy - 0.05, 1]];
  const sigma = 0.6 * Math.max(1, (hy / 0.5) ** 0.75), top = -hy - 0.03, dx = Math.min(0.31, 0.6 * hx);
  const drops = [
    { x: cx - dx, y: top, sigma, born: 0, rate: 1, white: 0 },
    { x: cx + 0.92 * dx, y: top, sigma: 1.08 * sigma, born: 0.14, rate: 0.82, white: 1 },
  ];
  for (const [p, born, side] of [[0, 0.62, 1], [1, 0.8, -1]]) {
    const d = drops[p], r = ringAt(dropTime(d, born));
    drops.push({ x: d.x + side * 0.95 * r.R * d.sigma, y: d.y + r.z * d.sigma, sigma: 0.5 * d.sigma, born, rate: 1.2 * d.rate, white: d.white });
  }
  return { hx, hy, m, zb, stations, drops };
}
export const dropTime = (d, tau) => Math.max(0, tau - d.born) * d.rate * RING.pace;
// The whorls' frame at τ: for each of K backward substeps, the four of them (as ringFrame's cores).
export function whorlFrame(St, tau, K, cells, sway = 0) {
  const span = Math.max(tau - 1, 0), dt = span / K;
  for (let k = 0; k < K; k++) {
    const t = 1 + span * (1 - (k + 0.5) / K), dA = whorlTurn(t + dt / 2) - whorlTurn(t - dt / 2), a = coreAt(t);
    for (let i = 0; i < 4; i++) {
      const s = St.stations[i];
      cells.set([s[0] + 0.008 * Math.sin(sway * 0.5 + i * 1.7), s[1] + 0.008 * Math.cos(sway * 0.43 + i * 2.3), dA * s[2], a * a], (k * 4 + i) * 4);
    }
  }
}
// A body moving through the fluid by D: the streamfunction ψ = (D × r) g(r²), g = 1 inside (it carries
// its own fluid with it) and R²/r² far away (the doublet round a moving body). Its velocity at r.
export function bodyVel(rx, ry, Dx, Dy, R2) {
  const q = (rx * rx + ry * ry) / R2, g = 1 / Math.sqrt(1 + q * q), dg = -q / (R2 * (1 + q * q) ** 1.5), cr = Dx * ry - Dy * rx;
  return [Dx * g + 2 * cr * dg * ry, Dy * g - 2 * cr * dg * rx];
}
// A point's material coordinates: z stepped backward through a frame (as the flow pass does it): K
// substeps of four cores and, where given, a body.
export function carryBack(z, K, cells, bodies = null, R2 = RING.body ** 2) {
  let [x, y] = z;
  for (let k = 0; k < K; k++) {
    for (let i = 3; i >= 0; i--) {
      const o = (k * 4 + i) * 4, rx = x - cells[o], ry = y - cells[o + 1], ang = -cells[o + 2] * lamb(rx * rx + ry * ry, cells[o + 3]);
      const c = Math.cos(ang), s = Math.sin(ang);
      x = cells[o] + rx * c - ry * s; y = cells[o + 1] + rx * s + ry * c;
    }
    if (bodies) {
      const o = k * 4, v = bodyVel(x - bodies[o], y - bodies[o + 1], bodies[o + 2], bodies[o + 3], R2);
      const w = bodyVel(x - 0.5 * v[0] - bodies[o], y - 0.5 * v[1] - bodies[o + 1], bodies[o + 2], bodies[o + 3], R2);
      x -= w[0]; y -= w[1];
    }
  }
  return [x, y];
}
// The light lost along a line of sight through a figure of revolution of density ρ(r), passing x from its
// axis (the Abel integral), 2 ∫ ρ(r) r dr / √(r² − x²) from x to rmax, taken as the shader takes it: with
// r = x + s², whose integrand is smooth, in n steps.
export function sightThrough(rho, x, rmax, n = 64) {
  const ax = Math.abs(x);
  if (ax >= rmax) return 0;
  const S = Math.sqrt(rmax - ax), ds = S / n;
  let sum = 0;
  for (let i = 0; i < n; i++) { const s = ds * (i + 0.5), r = ax + s * s; sum += rho(r) * r / Math.sqrt(2 * ax + s * s); }
  return 4 * sum * ds;
}

// ---- the board -------------------------------------------------------------------------------------------
// The Taylor–Green array on the board (X, Y in squares): its streamfunction (zero on every line between
// squares), and its Okubo–Weiss field (strain² − rotation², up to a factor): above zero where a heavy
// grain gathers (the lines and their crossings), below at the cells' middles.
export const greenPsi = (X, Y) => Math.sin(Math.PI * X) * Math.sin(Math.PI * Y) / Math.PI;
export const okuboWeiss = (X, Y) => Math.cos(Math.PI * X) ** 2 * Math.cos(Math.PI * Y) ** 2 - Math.sin(Math.PI * X) ** 2 * Math.sin(Math.PI * Y) ** 2;
// Whether the square (file, row) is dark (row 0 the top: a8 light, a1 dark).
export const darkSquare = (file, row) => (file + row) % 2 === 1;
// The view: how far it has closed on the board at P (1: as the tile is framed).
export function zoomAt(P, phone = false) {
  const Z = INK.zoom;
  return 1 + INK.zoomBy[phone ? 1 : 0] * smooth(Z[0], Z[1], P) * (1 - smooth(Z[2], Z[3], P));
}

// ---- silhouettes -----------------------------------------------------------------------------------------
// The exact Euclidean distance transform (Felzenszwalb and Huttenlocher): for a mask (non-zero inside),
// each cell's distance to the nearest cell inside.
export function distances(mask, w, h) {
  const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), zs = new Float64Array(n + 1);
  const g = new Float64Array(w * h);
  const pass = len => {
    let k = 0; v[0] = 0; zs[0] = -INF; zs[1] = INF;
    const cross = (q, p) => ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
    for (let q = 1; q < len; q++) {
      let s = cross(q, v[k]);
      while (s <= zs[k]) { k--; s = cross(q, v[k]); }
      k++; v[k] = q; zs[k] = s; zs[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (zs[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? 0 : INF;
    pass(h);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
  }
  return g;
}
// A silhouette's signed distance as bytes: 128 on its outline, less inside, range cells either way.
export function signedBytes(alpha, w, h, range) {
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { inside[i] = alpha[i] >= 128 ? 1 : 0; outside[i] = 1 - inside[i]; }
  const dout = distances(inside, w, h), din = distances(outside, w, h), out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.round(255 * clamp(0.5 + (dout[i] - din[i]) / (2 * range)));
  return out;
}
