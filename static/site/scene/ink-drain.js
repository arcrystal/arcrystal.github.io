// Photography → Chess: the water leaves, as it came and then in the board's own world.
//   D1 (ink-tank.js tankCamera, DRAIN): the tank's free surface falls exactly as it rose, its near
// meniscus sliding down the screen until it has left the bottom. Its far side is open (glsl/unmix.js
// waterXZOpen), so above the meniscus there is only surface, seen ever more from above.
//   D2: once the whole screen is surface, it is handed over (MORPH) to a plane in the board's world
// (staunton.js units: the board's top y = 0, the page under it y = −SLAB, z toward the viewer). The plane
// sinks through the crowns, the board and the page, tipping a few degrees toward the back as it drains
// away behind them, so each flat surface dries from its far edge toward the viewer.
//   The shader reads all of it from one uniform (drainUniforms); home.js reads dryEdge for the band's words.
import { BOARD, TALL, TYPES, frameCamera, project, startSlots } from './staunton.js';
import { tankCamera, DRAIN } from './ink-tank.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smoother = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (10 + t * (-15 + 6 * t)); };

export const D1 = DRAIN;
export const MORPH = Object.freeze([1.100, 1.115]);
// The front edge of the board's frame: the surface keeps its height there and tips down behind it.
export const FRONT = BOARD.half + BOARD.frame;
export const SLOPE = Math.tan(3 * Math.PI / 180);
export const TILT = Object.freeze([1.13, 1.165]);
// The water's height over the board (world units) at its landmarks: deep over the board as the camera
// clears the surface, just over the king's crown once the surface is the board's own, level with the
// board, level with the page, then well below it. The knots keep their order whatever the pieces' heights.
export function drainKnots() {
  const slab = BOARD.slab, crown = Math.max(...Object.values(TALL)) + 0.05;
  return [[1.040, 8.6], [1.100, 3.2], [1.140, crown], [1.168, 0], [1.180, -slab], [1.196, -(slab + 0.6)]];
}
// A monotone cubic through the knots (Fritsch–Carlson): the level never pauses between them and never
// turns back.
function monotone(knots) {
  const n = knots.length, x = knots.map(k => k[0]), y = knots.map(k => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return P => {
    if (P <= x[0]) return y[0];
    if (P >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (P > x[i + 1]) i++;
    const h = x[i + 1] - x[i], t = (P - x[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
let level = null, levelKey = '';
export function drainLevel(P) {
  const key = Object.values(TALL).join(',');
  if (key !== levelKey) { level = monotone(drainKnots()); levelKey = key; }
  return level(P);
}
export const drainSlope = P => SLOPE * smoother(TILT[0], TILT[1], P);
export const drainMorph = P => smoother(MORPH[0], MORPH[1], P);
// The surface's height over the point (x, z) of the board's world.
export const waterHeight = (z, P) => drainLevel(P) + drainSlope(P) * (z - FRONT);

// ---- the board's camera over the whole screen ----------------------------------------------------
// The board is framed in its box (CSS px [x, y, w, h], y from the top) by frameCamera at the box's
// proportion; a screen point outside the box is the same camera's ray, extended.
const cams = new Map();
export function boxCamera(box) {
  const aspect = box[2] / box[3], key = aspect.toFixed(5);
  if (!cams.has(key)) { if (cams.size > 8) cams.clear(); cams.set(key, frameCamera(aspect)); }
  return cams.get(key);
}
export function screenRay(cam, box, x, y) {
  const u = (2 * (x - box[0]) / box[2] - 1) * cam.tanY * cam.aspect, v = (1 - 2 * (y - box[1]) / box[3]) * cam.tanY;
  const d = [cam.fwd[0] + cam.right[0] * u + cam.up[0] * v, cam.fwd[1] + cam.right[1] * u + cam.up[1] * v, cam.fwd[2] + cam.right[2] * u + cam.up[2] * v];
  const l = Math.hypot(...d);
  return d.map(c => c / l);
}
// A world point's place on the screen (CSS px, y from the top), or null behind the camera.
export function toScreen(cam, box, p) {
  const [u, v, depth] = project(cam, p);
  if (depth <= 1e-6) return null;
  return [box[0] + (u + 1) * box[2] / 2, box[1] + (1 - v) * box[3] / 2];
}
// Where the page under the board is dry: the screen row (CSS px from the top) of the waterline across
// it. Everything above the row is dry, everything below still under water. 0: none of the page is dry;
// H: all of it.
export function dryEdge(P, box, H) {
  const h = drainLevel(P), s = drainSlope(P), page = -BOARD.slab;
  if (s < 1e-9) return h > page ? 0 : H;
  const z = FRONT + (page - h) / s;
  const cam = boxCamera(box), at = toScreen(cam, box, [0, page, z]);
  // (A waterline nearer than the camera's own plane is below every row.)
  if (!at) return H;
  return clamp(at[1], 0, H);
}

// ---- matching the tank's waves -----------------------------------------------------------------
// The tank's open plane under a screen point (glsl/unmix.js waterXZOpen) in its wave units.
function tankWaves(cam, aspect, x, y) {
  const k = 0.66 * (1 - cam[3]), f = Math.max((cam[0] + 0.5 * cam[1] - y) / cam[1], -0.98 / Math.max(k, 1e-3));
  const z = f * (1 + k) / (1 + k * f), w = 1 + k * (1 - z);
  const px = 0.5 + (x - 0.5 - (z - 0.5) * 0.072 * cam[3] / Math.max(1, aspect)) * w / (1 + 0.22 * (1 - cam[3]));
  return [px * clamp(aspect, 0.65, 2.2), z];
}
// The board's plane at height h under a screen point (x, y as fractions, y up), world (x, z).
function boardPlane(cam, box, W, H, h, x, y) {
  const d = screenRay(cam, box, x * W, (1 - y) * H), t = (h - cam.eye[1]) / d[1];
  return [cam.eye[0] + d[0] * t, cam.eye[2] + d[2] * t];
}
// Wave units per world unit (k) and the offset (o) that put the board's plane on the tank's at the
// middle of the screen as the surface is handed over: the same waves, the same size there.
const fits = new Map();
export function waveFit(box, W, H) {
  const key = `${box.map(v => Math.round(v)).join(' ')} ${W} ${H}`;
  if (fits.has(key)) return fits.get(key);
  const P = MORPH[0], tank = tankCamera(P), aspect = W / H, cam = boxCamera(box), h = drainLevel(P), e = 0.02;
  const a = tankWaves(tank, aspect, 0.5, 0.5 - e), b = tankWaves(tank, aspect, 0.5, 0.5 + e);
  const A = boardPlane(cam, box, W, H, h, 0.5, 0.5 - e), B = boardPlane(cam, box, W, H, h, 0.5, 0.5 + e);
  const k = Math.abs((b[1] - a[1]) / (B[1] - A[1]));
  const c = tankWaves(tank, aspect, 0.5, 0.5), C = boardPlane(cam, box, W, H, h, 0.5, 0.5);
  const fit = { k, o: [c[0] - C[0] * k, c[1] - C[1] * k] };
  if (fits.size > 8) fits.clear();
  fits.set(key, fit);
  return fit;
}
// Everything the shader needs at P: [height, tilt, wave units per world unit, hand-over] and the offset.
export function drainUniforms(P, box, W, H) {
  const { k, o } = waveFit(box, W, H);
  return { drain: [drainLevel(P), drainSlope(P), k, drainMorph(P)], offset: o };
}

// ---- the crowns breaking the surface ----------------------------------------------------------------
// Each piece of the starting position, where it stands, and the moment the sinking surface first
// uncovers its crown: a ring of capillary waves leaves it then (glsl/ink-impact.js INK_EMERGE).
export function emergence() {
  return startSlots().map(s => {
    const top = TALL[TYPES[s.type]];
    let lo = MORPH[0], hi = 1.2;
    if (waterHeight(s.z, lo) <= top) return { x: s.x, z: s.z, P: lo, top };
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (waterHeight(s.z, m) > top) lo = m; else hi = m; }
    return { x: s.x, z: s.z, P: (lo + hi) / 2, top };
  });
}
