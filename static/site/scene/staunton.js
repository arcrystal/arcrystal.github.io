// Chess in three dimensions (scene/board3d.js draws it; glsl/board3d.js shades it): the pieces' shapes, the
// starting position, the Scotch as a function of time, and the camera that frames the board.
//   The pieces are turned from the site's own silhouettes (the sprite's #sK … #sP, Staunton in front view):
// each row of a silhouette gives the radius of the solid at that height, and the solid is that profile
// turned about its axis. A profile is kept as a signed distance over its half plane (r, y), so the shader's
// piece is exactly a distance in space: the profile's distance at (|xz|, y). The knight's head is not turned
// but cut: its silhouette's distance, drawn out to a thickness. Details the profile cannot hold (the king's
// cross, the queen's coronet, the bishop's ball and mitre, the rook's crenels) are added in the shader from
// the sprite's own figures, given here in the same units.
//   World units: a square is 1; the board's top is y = 0; files run along x (a … h, −3.5 … 3.5), ranks
// along z (rank 1 nearest the camera, at z = 3.5).
import { distances } from './ink-plan.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

// ---- the sprite's units → the world --------------------------------------------------------------
// The sprite draws a piece in a 45-unit square, its foot at y = 43.5, its axis at x = 22.5. Turned, it is
// drawn a little wider and taller than the diagram's glyph (a Staunton king stands about 1.2 squares).
export const SQ = 45, AXIS = 22.5, FOOT = 43.5, SR = 1.27, SY = 1.42;
export const toR = x => (x - AXIS) / SQ * SR;
export const toY = y => (FOOT - y) / SQ * SY;
export const fromY = yw => FOOT - yw * SQ / SY;
export const fromR = rw => AXIS + rw * SQ / SR;
export const TYPES = 'KQBNRP';   // a piece's type is its index here

export const PATHS = Object.freeze({
  K: 'M22.5 43.5 L34.47 43.5 L34.9 43.16 L34.9 42.06 L35.1 41.42 L34.97 40.77 L34.54 40.2 L33.85 39.76 L32.44 39.23 L32.22 39.05 L32.25 38.81 L32.9 38.44 L32.88 37.99 L30.49 36.99 L30.28 36.82 L29.23 33.84 L28.34 30.76 L27.65 27.68 L27.25 25.22 L27.03 22.14 L27.46 21.88 L30.27 21.49 L30.49 21.33 L30.48 21.09 L30.31 20.97 L28.43 20.74 L28.38 20.66 L28.45 20.58 L29.31 20.41 L29.38 20.32 L29.35 20.09 L27.45 19.54 L27.32 19.36 L27.72 17.68 L28.52 15.84 L29.38 14.37 L30.41 12.89 L30.68 12.53 L31.22 12.18 L31.23 11.73 L30.5 11.41 L29.97 10.92 L29.32 10.5 L28.16 10.05 L26.87 9.84 L25.98 9.85 L25.1 9.96 L24.79 9.65 L25.34 9.14 L25.35 8.77 L25.23 8.65 L22.5 8.43 L19.77 8.65 L19.65 8.77 L19.66 9.14 L20.21 9.65 L19.9 9.96 L18.58 9.83 L17.69 9.88 L16.84 10.05 L15.68 10.5 L15.03 10.92 L14.5 11.41 L13.77 11.73 L13.78 12.18 L14.32 12.53 L14.59 12.89 L15.62 14.37 L16.48 15.84 L17.28 17.68 L17.68 19.36 L17.55 19.54 L15.65 20.09 L15.62 20.32 L15.69 20.41 L16.55 20.58 L16.62 20.66 L16.57 20.74 L14.69 20.97 L14.52 21.09 L14.51 21.33 L14.73 21.49 L17.54 21.88 L17.97 22.14 L17.75 25.22 L17.35 27.68 L16.66 30.76 L15.77 33.84 L14.72 36.82 L14.51 36.99 L12.12 37.99 L12.1 38.44 L12.75 38.81 L12.78 39.05 L12.56 39.23 L11.15 39.76 L10.46 40.2 L10.03 40.77 L9.9 41.42 L10.1 42.06 L10.1 43.16 L10.53 43.5Z',
  Q: 'M22.5 43.5 L33.87 43.5 L34.28 43.17 L34.28 42.12 L34.47 41.5 L34.35 40.89 L33.94 40.34 L33.28 39.92 L31.94 39.42 L31.73 39.24 L31.76 39.01 L32.38 38.66 L32.36 38.23 L30.13 37.29 L29.91 37.12 L28.9 34.13 L28.04 31.04 L27.37 27.96 L27 25.49 L26.78 22.41 L27.19 22.16 L29.84 21.78 L30.06 21.62 L30.05 21.41 L29.87 21.28 L28.1 21.07 L28.06 20.99 L28.13 20.92 L28.94 20.75 L29 20.66 L28.98 20.45 L27.19 19.93 L27.04 19.76 L27.32 18.32 L28.12 16.29 L29.47 13.85 L30.56 12.23 L30.92 11.89 L30.92 11.52 L30.81 11.43 L29.94 11.23 L28.87 10.62 L28.02 10.33 L27.12 10.17 L25.72 10.16 L24.37 9.82 L23.86 9.56 L22.5 9.47 L21.14 9.56 L20.63 9.82 L19.28 10.16 L17.88 10.17 L16.98 10.33 L16.13 10.62 L15.06 11.23 L14.19 11.43 L14.08 11.52 L14.08 11.89 L14.44 12.23 L15.53 13.85 L16.88 16.29 L17.68 18.32 L17.96 19.76 L17.81 19.93 L16.02 20.45 L16 20.66 L16.06 20.75 L16.87 20.92 L16.94 20.99 L16.9 21.07 L15.13 21.28 L14.95 21.41 L14.94 21.62 L15.16 21.78 L17.81 22.16 L18.22 22.41 L18 25.49 L17.63 27.96 L16.96 31.04 L16.1 34.13 L15.09 37.12 L14.87 37.29 L12.64 38.23 L12.62 38.66 L13.24 39.01 L13.27 39.24 L13.06 39.42 L11.72 39.92 L11.06 40.34 L10.65 40.89 L10.53 41.5 L10.72 42.12 L10.72 43.17 L11.13 43.5Z',
  B: 'M22.5 43.5 L32.67 43.5 L33.04 43.19 L33.04 42.23 L33.21 41.65 L33.1 41.09 L32.73 40.58 L32.15 40.19 L30.95 39.72 L30.76 39.56 L30.78 39.35 L31.33 39.02 L31.3 38.6 L30.62 38.28 L29.28 37.94 L29.03 37.79 L28.17 35.76 L27.59 34.17 L26.95 32.04 L26.59 30.44 L26.33 28.85 L26.22 27.25 L26.59 27.02 L29.07 26.67 L29.23 26.57 L29.26 26.37 L29.06 26.21 L27.45 26.01 L27.47 25.87 L28.24 25.72 L28.31 25.59 L28.27 25.42 L26.42 24.9 L26.05 24.69 L25.97 24.41 L26.12 24.14 L27.51 22.76 L28.16 21.93 L28.43 21.37 L28.59 20.82 L28.64 20.27 L28.59 19.72 L28.44 19.16 L28.07 18.34 L27.09 16.95 L25.46 15.3 L23.38 13.64 L23.43 12.58 L21.57 12.58 L21.62 13.64 L19.85 15.02 L18.4 16.4 L17.27 17.78 L16.66 18.89 L16.41 19.72 L16.36 20.27 L16.41 20.82 L16.57 21.37 L16.84 21.93 L17.24 22.48 L18.63 23.86 L19.03 24.41 L18.95 24.69 L18.58 24.9 L16.73 25.42 L16.69 25.59 L16.76 25.72 L17.53 25.87 L17.55 26.01 L15.9 26.22 L15.77 26.32 L15.75 26.51 L15.97 26.68 L18.41 27.02 L18.78 27.25 L18.67 28.85 L18.3 30.97 L17.41 34.17 L16.83 35.76 L15.97 37.79 L15.72 37.94 L14.38 38.28 L13.7 38.6 L13.67 39.02 L14.22 39.35 L14.24 39.56 L14.05 39.72 L12.85 40.19 L12.44 40.43 L12 40.91 L11.8 41.46 L11.82 41.84 L11.96 42.23 L11.96 43.19 L12.33 43.5Z',
  N: 'M22.5 43.5 L32.67 43.5 L33.04 43.18 L33.04 42.18 L33.21 41.59 L33.16 41.19 L33 40.82 L32.56 40.33 L30.95 39.59 L30.76 39.42 L30.78 39.2 L31.33 38.86 L31.35 38.51 L30.62 38.09 L29.93 37.31 L29.98 37.13 L30.55 36.74 L30.56 36.33 L30.42 36.19 L28.97 35.85 L15.95 35.86 L14.48 36.26 L14.46 36.77 L15.02 37.13 L15.08 37.28 L14.38 38.09 L13.66 38.49 L13.67 38.86 L14.22 39.2 L14.24 39.42 L14.05 39.59 L12.64 40.19 L12 40.82 L11.84 41.19 L11.79 41.59 L11.96 42.18 L12 43.25 L12.33 43.5ZM15.4 36.8 C13.9 33.0 13.6 28.4 14.9 24.4 C15.9 21.2 17.6 18.4 19.6 16.2 C20.0 14.4 20.4 12.4 21.2 10.4 C22.4 11.4 23.4 12.8 23.8 14.0 C26.4 14.2 29.0 15.6 31.0 17.6 C32.8 19.4 34.4 21.2 35.2 22.8 C35.8 24.0 35.4 25.6 34.2 26.0 C33.0 26.4 31.6 26.2 30.6 26.0 C29.4 26.4 28.6 27.4 28.2 28.8 C27.8 30.6 28.0 32.8 28.6 34.6 C28.8 35.4 29.0 36.2 29.2 36.8 Z',
  R: 'M22.5 43.5 L32.67 43.5 L33.04 43.16 L33.04 42.1 L33.21 41.46 L33.16 41.04 L33 40.64 L32.73 40.28 L32.36 39.97 L30.95 39.33 L30.76 39.15 L30.78 38.92 L31.33 38.55 L31.35 38.18 L31.28 38.08 L30.62 37.73 L30.3 37.24 L29.31 32.18 L28.97 29.9 L28.73 27.61 L28.7 27.04 L29.05 26.72 L30.54 26.25 L30.68 26.09 L30.62 25.52 L29.57 25.08 L29.45 24.89 L29.58 24.08 L29.98 22.82 L31.06 20.61 L31.12 20.2 L31.12 15.75 L30.94 15.52 L29.48 15.5 L29.29 15.55 L29.2 15.69 L29.18 16.76 L29.07 16.9 L28.82 16.97 L31.12 16.97 L27.77 16.97 L27.77 19.53 L24.17 19.53 L24.17 16.97 L20.83 16.97 L20.83 19.53 L17.23 19.53 L17.23 16.97 L13.88 16.97 L16.18 16.97 L15.97 16.93 L15.82 16.76 L15.8 15.69 L15.68 15.54 L14.15 15.5 L13.89 15.68 L13.88 20.2 L13.94 20.61 L15.02 22.82 L15.42 24.08 L15.55 24.89 L15.43 25.08 L14.38 25.52 L14.32 26.09 L14.46 26.25 L15.95 26.72 L16.3 27.04 L16.27 27.61 L16.03 29.9 L15.69 32.18 L14.7 37.24 L14.38 37.73 L13.72 38.08 L13.65 38.18 L13.67 38.55 L14.22 38.92 L14.24 39.15 L14.05 39.33 L12.64 39.97 L12.27 40.28 L12 40.64 L11.84 41.04 L11.79 41.46 L11.96 42.1 L11.97 43.19 L12.33 43.5Z',
  P: 'M22.5 43.5 L31.18 43.5 L31.48 43.22 L31.49 42.3 L31.63 41.76 L31.54 41.22 L31.23 40.75 L30.73 40.38 L29.7 39.94 L29.54 39.78 L29.57 39.58 L30.03 39.27 L30.02 38.9 L29.43 38.58 L28.56 38.31 L28.39 38.16 L27.55 36.32 L26.98 34.84 L26.5 33.37 L26.14 31.89 L25.91 30.41 L25.85 29.43 L26.49 29.03 L28.74 28.59 L28.94 28.4 L28.94 27.98 L28.83 27.84 L26.11 27.1 L25.94 26.96 L25.76 26.47 L25.82 26.32 L26.82 25.45 L27.09 25.08 L27.5 24.29 L27.62 23.88 L27.71 23.03 L27.67 22.61 L27.42 21.78 L27.22 21.38 L26.67 20.65 L25.52 19.77 L24.09 19.2 L22.5 19 L20.91 19.2 L19.48 19.77 L18.33 20.65 L18.03 21.01 L17.58 21.78 L17.43 22.19 L17.29 23.03 L17.31 23.46 L17.5 24.29 L17.68 24.7 L18.18 25.45 L19.18 26.32 L19.24 26.47 L19.06 26.96 L18.89 27.1 L16.17 27.84 L16.06 27.98 L16.06 28.4 L16.26 28.59 L18.51 29.03 L19.15 29.43 L19.09 30.41 L18.86 31.89 L18.5 33.37 L18.02 34.84 L17.45 36.32 L16.61 38.16 L16.44 38.31 L15.57 38.58 L14.98 38.9 L14.97 39.27 L15.43 39.58 L15.46 39.78 L15.3 39.94 L14.27 40.38 L13.77 40.75 L13.46 41.22 L13.37 41.76 L13.51 42.3 L13.52 43.22 L13.82 43.5Z',
});

// ---- reading a path --------------------------------------------------------------------------------
// The sprite's paths use absolute M, L, C, H, V and Z: each subpath becomes a polygon (curves flattened).
export function parsePath(d, steps = 16) {
  const tok = d.match(/[MLCHVZmlchvz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const polys = [];
  let i = 0, cmd = '', poly = null, x = 0, y = 0;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z' || cmd === 'z') { if (poly) polys.push(poly); poly = null; continue; }
    if (cmd === 'M') { if (poly) polys.push(poly); x = num(); y = num(); poly = [[x, y]]; cmd = 'L'; continue; }
    if (cmd === 'L') { x = num(); y = num(); poly.push([x, y]); continue; }
    if (cmd === 'H') { x = num(); poly.push([x, y]); continue; }
    if (cmd === 'V') { y = num(); poly.push([x, y]); continue; }
    if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, s = 1 - t;
        poly.push([s * s * s * x + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t * t * t * x3, s * s * s * y + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t * t * t * y3]);
      }
      x = x3; y = y3;
      continue;
    }
    throw new Error(`staunton: path command ${cmd} not read`);
  }
  if (poly) polys.push(poly);
  return polys;
}
// Where a horizontal line at y crosses the polygons' edges, left to right (each edge counts on
// [lower, upper), so a vertex is crossed once).
export function crossings(polys, y) {
  const xs = [];
  for (const p of polys) for (let k = 0; k < p.length; k++) {
    const [x0, y0] = p[k], [x1, y1] = p[(k + 1) % p.length];
    if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) xs.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0));
  }
  return xs.sort((a, b) => a - b);
}
// The silhouette's reach from the axis at height y (sprite units): its outermost edge either side.
export function halfWidth(polys, y) {
  const xs = crossings(polys, y);
  return xs.length < 2 ? 0 : Math.max(AXIS - xs[0], xs[xs.length - 1] - AXIS, 0);
}
// A polygon's area (shoelace), for the tests.
export const area = polys => polys.reduce((a, p) => a + Math.abs(p.reduce((s, [x0, y0], k) => { const [x1, y1] = p[(k + 1) % p.length]; return s + x0 * y1 - x1 * y0; }, 0)) / 2, 0);

// ---- the fields --------------------------------------------------------------------------------------
// A profile's half plane: r 0 … w·cell, y y0 … y0 + h·cell (row 0 the lowest). The knight's head: x
// x0 … x0 + w·cell across its face. Square cells, so the transform's distances are true distances.
export const PROF = Object.freeze({ cell: 0.0028, w: 164, h: 500, y0: -0.02 });
export const HEAD = Object.freeze({ cell: 0.0028, w: 276, h: 500, x0: -0.3864, y0: -0.02 });
export const LAYERS = 'KQBNRP';   // the profiles' layers (N: the knight's turned base)

// A mask's signed distance, world units: negative inside. (Cell centres: half a cell to the edge between.)
export function signedField(mask, w, h, cell) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
  const dout = distances(mask, w, h), din = distances(inv, w, h), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] ? -(din[i] - 0.5) * cell : (dout[i] - 0.5) * cell;
  return out;
}
// The polygons that make a piece's turned body: all of a path but the knight's, whose first subpath is its
// base (its head is the second).
export const bodyOf = type => { const polys = parsePath(PATHS[type]); return type === 'N' ? polys.slice(0, 1) : polys; };
export const headOf = () => parsePath(PATHS.N).slice(1);
// Replace the raster distance near a surface with distance to the original vector
// edges. Half-cell rounding is useful in the empty region, but on a polished
// bevel its variation between neighboring rows produces a comb of highlights.
function polishField(field, P, segments) {
  const { w, h, cell, y0 } = P, x0 = P.x0 || 0, reach = .086;
  const exact = new Float32Array(w * h).fill(reach * reach);
  for (const [[ax, ay], [bx, by]] of segments) {
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    if (len2 < 1e-15) continue;
    const col0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - x0) / cell));
    const col1 = Math.min(w - 1, Math.ceil((Math.max(ax, bx) + reach - x0) / cell));
    const row0 = Math.max(0, Math.floor((Math.min(ay, by) - reach - y0) / cell));
    const row1 = Math.min(h - 1, Math.ceil((Math.max(ay, by) + reach - y0) / cell));
    for (let j = row0; j <= row1; j++) {
      const y = y0 + (j + .5) * cell - ay;
      for (let i = col0; i <= col1; i++) {
        const x = x0 + (i + .5) * cell - ax;
        const t = clamp((x * dx + y * dy) / len2, 0, 1);
        const ux = x - dx * t, uy = y - dy * t, k = j * w + i;
        exact[k] = Math.min(exact[k], ux * ux + uy * uy);
      }
    }
  }
  for (let k = 0; k < field.length; k++) {
    const d = Math.sqrt(exact[k]), weight = smooth((reach - d) / .058);
    field[k] += weight * (Math.sign(field[k]) * d - field[k]);
  }
  return field;
}
// The outer envelope of a horizontal slice is linear between successive
// path vertices. Take its one-sided limits too, so horizontal ledges and
// crowns stay sharp. The cap extends through the axis of revolution.
function turnedContour(polys) {
  const rows = Array.from(new Set(polys.flat().map(p => p[1]))).sort((a, b) => b - a);
  const contour = [[-.05, toY(rows[0])]];
  for (let i = 1; i < rows.length; i++) {
    const lo = rows[i - 1], hi = rows[i], step = (lo - hi) * 1e-6;
    for (const [y, sample] of [[lo, lo - step], [hi, hi + step]]) {
      contour.push([halfWidth(polys, sample) * SR / SQ, toY(y)]);
    }
  }
  contour.push([-.05, toY(rows.at(-1))]);
  return contour.slice(1).map((end, i) => [contour[i], end]);
}
// A turned profile's signed distance over its half plane.
export function profileField(polys, P = PROF) {
  const { w, h, cell, y0 } = P, mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const yw = y0 + (j + 0.5) * cell, R = yw <= 0 ? 0 : toR(AXIS + halfWidth(polys, fromY(yw)));
    for (let i = 0; i < w; i++) mask[j * w + i] = (i + 0.5) * cell < R ? 1 : 0;
  }
  return polishField(signedField(mask, w, h, cell), P, turnedContour(polys));
}
// The knight's head: its silhouette's signed distance over its face (even–odd inside).
export function headField(polys = headOf(), H = HEAD) {
  const { w, h, cell, x0, y0 } = H, mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const yw = y0 + (j + 0.5) * cell;
    if (yw <= 0) continue;
    const xs = crossings(polys, fromY(yw));
    for (let i = 0; i < w; i++) {
      const xs_ = fromR(x0 + (i + 0.5) * cell);
      let n = 0;
      for (const x of xs) if (x < xs_) n++;
      mask[j * w + i] = n & 1;
    }
  }
  const segments = polys.flatMap(poly => poly.map(([x, y], i) => {
    const [xx, yy] = poly[(i + 1) % poly.length];
    return [[toR(x), toY(y)], [toR(xx), toY(yy)]];
  }));
  return polishField(signedField(mask, w, h, cell), H, segments);
}

// Low relief for the two cheeks of the horse, measured in model units.
// Store this once beside the silhouette distance. The rays for both the
// floating knight and the board then sample the same shaped cross section.
function cheekDepth(x, y) {
  // A rotated, raised or sunken oval, with a smooth edge at two radii.
  function relief(cx, cy, rx, ry, angle, height) {
    const dx = x - cx, dy = y - cy, c = Math.cos(angle), s = Math.sin(angle);
    const u = (dx * c + dy * s) / rx, v = (dy * c - dx * s) / ry;
    const t = Math.max(0, 1 - .5 * (u * u + v * v));
    return height * t * t * t;
  }
  // A breast broad enough to round into the plinth, a narrowing poll and
  // muzzle, and a long jaw muscle turning up from the breast to the eye.
  let depth = .065 + .052 * (1 - smooth((y - .30) / .71));
  depth += relief(-.027, .53, .144, .29, -.37, .075);
  depth += relief(.057, .763, .111, .15, -.38, .060);
  depth += relief(.147, .815, .089, .029, -.44, .033);
  depth += relief(.217, .736, .128, .048, -.68, .035);
  depth += relief(.278, .638, .068, .058, -.40, .028);
  depth += relief(.282, .666, .030, .014, -.73, -.030);
  depth += relief(.24, .606, .101, .009, -.11, -.012);
  // The eye sits within a swept almond lid, with a convex iris catching
  // the key. The chisel leaves wider, tapered locks along the mane.
  depth += relief(.145, .778, .043, .026, -.23, -.045);
  depth += relief(.147, .777, .021, .015, -.26, .042);
  const along = clamp((y - .25) / .60, 0, 1);
  const centre = -.19 + .15 * along * along;
  const spread = Math.max(0, 1 - ((x - centre) / .12) ** 2);
  const mane = Math.sin(Math.PI * along) * spread * spread;
  const curl = 34 * y + 27 * x + 3.3 * Math.sin(4.7 * y - 5 * x);
  const lock = .5 + .5 * Math.cos(curl);
  return depth + mane * (.014 + .043 * lock * lock) - .034 * smooth((y - .91) / .13);
}
export function sculptedHeadField() {
  const d = headField(), field = new Float32Array(d.length * 2);
  for (let row = 0; row < HEAD.h; row++) {
    const y = HEAD.y0 + (row + .5) * HEAD.cell;
    for (let col = 0; col < HEAD.w; col++) {
      const k = row * HEAD.w + col;
      field[2 * k] = d[k];
      field[2 * k + 1] = d[k] < .07 ? cheekDepth(HEAD.x0 + (col + .5) * HEAD.cell, y) : .08;
    }
  }
  return field;
}

// ---- the details, from the sprite's own figures (world units) --------------------------------------
const W = (x, y) => [toR(x), toY(y)];
export const DETAIL = Object.freeze({
  // The king's cross: two bars [centre x, centre y, half w, half h], a little depth.
  cross: [[...W(22.505, 5.695), 1.365 / SQ * SR, 2.905 / SQ * SY], [...W(22.505, 4.755), 3.845 / SQ * SR, 0.855 / SQ * SY]],
  crossDepth: 0.03,
  // The queen's coronet: eight balls round a ring (its radius, height, a ball's radius) and the one on top.
  coronet: [toR(30.19), toY(10.93), 1.08 / SQ * SR * 1.15],
  crown: [toY(8.09), 2.29 / SQ * SR],
  // The bishop's finial and the slit across its mitre (two points on it, in x and y).
  finial: [toY(11.38), 1.92 / SQ * SR],
  slit: [...W(19.4, 21.4), ...W(26.7, 13.5)],
  // The rook's crown: its top, the hollow in it (radius, depth) and its crenels (count, width, depth).
  rook: [toY(15.5), toR(27.5), 0.074, 6, 0.084, toY(15.5) - toY(19.1)],
});
// How tall each piece stands (for the camera and the dirty rectangles).
export const TALL = Object.freeze({ K: toY(2.79), Q: toY(5.8), B: toY(9.46), N: toY(10.4), R: toY(15.5), P: toY(19) });

// ---- the position ---------------------------------------------------------------------------------
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const FILES = 'abcdefgh';
export const squareOf = (file, rank) => `${FILES[file]}${rank}`;
export const worldOf = (file, rank) => [file - 3.5, 4.5 - rank];
// The 32 pieces at the start, in the order a FEN is read (rank 8 first): each keeps its slot all game.
// A knight faces the middle of the board (spin 0: toward +x).
export function startSlots(fen = START) {
  const out = [];
  fen.split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const rank = 8 - r, [x, z] = worldOf(f, rank), type = TYPES.indexOf(ch.toUpperCase());
      out.push({ type, black: ch === ch.toLowerCase(), file: f, rank, x, z, lift: 0, melt: 0, spin: type === 3 && f >= 4 ? Math.PI : 0 });
      f++;
    }
  });
  return out;
}

// ---- the Scotch, as a function of time -------------------------------------------------------------
// The homepage's game: a lead, each ply in turn (the piece glides, a knight leaps; a piece taken melts into
// a pool of ink that soaks away), a rest, and then the game runs back to the start (the pools gather and
// stand up again) and plays once more. t in ms.
export const PLIES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4'];
export const SCOTCH = Object.freeze({ lead: 700, ply: 900, move: 520, melt: 1100, rest: 2600, back: 1200 });
export const scotchPeriod = (n = PLIES.length) => SCOTCH.lead + n * SCOTCH.ply + SCOTCH.rest + SCOTCH.back;
const fileOf = sq => FILES.indexOf(sq[0]), rankOf = sq => Number(sq[1]);
// The slots at time t; marks: the last move's squares and how long ago it landed (ms), for its wash.
// moving: whether any piece is between squares (or melting) now.
export function scotchAt(t, plies = PLIES) {
  const S = SCOTCH, n = plies.length, period = scotchPeriod(n);
  t = ((t % period) + period) % period;
  const slots = startSlots(), at = new Map(slots.map((s, i) => [squareOf(s.file, s.rank), i]));
  let marks = null, moving = false;
  for (let k = 0; k < n; k++) {
    const t0 = S.lead + k * S.ply;
    if (t < t0) break;
    const from = plies[k].slice(0, 2), to = plies[k].slice(2, 4), i = at.get(from), j = at.get(to);
    const u = clamp((t - t0) / S.move), e = smooth(u), s = slots[i];
    const [x0, z0] = worldOf(fileOf(from), rankOf(from)), [x1, z1] = worldOf(fileOf(to), rankOf(to));
    s.x = x0 + (x1 - x0) * e; s.z = z0 + (z1 - z0) * e;
    s.lift = (s.type === 3 ? 0.62 : 0.07) * Math.sin(Math.PI * u);
    if (u < 1) moving = true;
    if (j !== undefined) {
      // (Taken as the mover lands; it melts, then its pool soaks away: melt 0 → 1 → 2.)
      const m = clamp((t - t0 - S.move * 0.75) / S.melt) * 2;
      slots[j].melt = m;
      if (m > 0 && m < 2) moving = true;
    }
    if (u >= 1) { at.delete(from); at.set(to, i); s.file = fileOf(to); s.rank = rankOf(to); }
    marks = { from, to, age: Math.max(0, t - t0 - S.move) };
  }
  const tb = S.lead + n * S.ply + S.rest;
  if (t > tb) {
    // Back to the start, together.
    const u = clamp((t - tb) / S.back), e = smooth(u), home = startSlots();
    slots.forEach((s, i) => {
      // (Only the pieces that are away from home travel, and those lift a little as they go.)
      const h = home[i], away = Math.hypot(h.x - s.x, h.z - s.z);
      if (!away && !s.melt) return;
      s.x += (h.x - s.x) * e; s.z += (h.z - s.z) * e; s.melt *= 1 - e;
      s.lift = away ? 0.06 * Math.sin(Math.PI * u) : 0;
      if (u >= 1) { s.x = h.x; s.z = h.z; s.file = h.file; s.rank = h.rank; s.lift = 0; }
    });
    if (u < 1) moving = true;
    marks = marks && u < 0.5 ? { ...marks, age: marks.age + 1e6 } : null;
  }
  return { slots, marks, moving };
}
// When the game has been played out (its last piece taken has soaked away), and the position it then rests
// in (with motion paused, and as the DOM's board shows it).
export const builtAt = (n = PLIES.length) => SCOTCH.lead + (n - 1) * SCOTCH.ply + SCOTCH.move * 0.75 + SCOTCH.melt + 40;
export const scotchBuilt = (plies = PLIES) => scotchAt(builtAt(plies.length), plies);

// ---- the camera -------------------------------------------------------------------------------------
// The board's picture (board3d.js) reaches this share of its box past each side, so its shadow on the page
// fades out inside it.
export const MARGIN = 0.16;
// The board, its frame and its slab (world units), and the tallest a piece stands.
export const BOARD = Object.freeze({ half: 4, frame: 0.42, slab: 0.22, top: TALL.K });
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addS = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
// From White's side, looking down at elev (radians above the board), with a vertical field of view fov.
// eye, right, up, fwd: the camera; tanY: tan(fov / 2); aspect: width over height.
export function cameraAt(target, dist, elev, fov, aspect) {
  const back = [0, Math.sin(elev), Math.cos(elev)];
  return { eye: addS(target, back, dist), right: [1, 0, 0], up: [0, Math.cos(elev), -Math.sin(elev)], fwd: [0, -Math.sin(elev), -Math.cos(elev)], tanY: Math.tan(fov / 2), aspect, target, dist, elev };
}
// A point's place on the view: −1 … 1 across and up.
export function project(cam, p) {
  const v = sub(p, cam.eye), z = dot(v, cam.fwd);
  return [dot(v, cam.right) / (z * cam.tanY * cam.aspect), dot(v, cam.up) / (z * cam.tanY), z];
}
// What the view must hold: the frame's corners, top and foot, and the far ranks' tallest pieces.
export function framePoints() {
  const E = BOARD.half + BOARD.frame, pts = [];
  for (const x of [-E, E]) for (const z of [-E, E]) pts.push([x, 0, z], [x, -BOARD.slab, z]);
  for (const x of [-3.5, -0.5, 0.5, 3.5]) for (const z of [-3.5, -2.5]) pts.push([x, BOARD.top, z]);
  return pts;
}
// The camera that holds the board in a view of this aspect, a margin round it (a share of the view).
export function frameCamera(aspect, { elev = 0.9, fov = 0.42, margin = 0.04 } = {}) {
  let target = [0, 0.25, 0], dist = 22, cam = null;
  const pts = framePoints();
  for (let it = 0; it < 24; it++) {
    cam = cameraAt(target, dist, elev, fov, aspect);
    const q = pts.map(p => project(cam, p));
    const x0 = Math.min(...q.map(v => v[0])), x1 = Math.max(...q.map(v => v[0]));
    const y0 = Math.min(...q.map(v => v[1])), y1 = Math.max(...q.map(v => v[1]));
    const zc = q.reduce((s, v) => s + v[2], 0) / q.length;
    // Centre it, then bring it to the margin.
    target = addS(addS(target, cam.up, (y0 + y1) / 2 * zc * cam.tanY), cam.right, (x0 + x1) / 2 * zc * cam.tanY * aspect);
    const span = Math.max((x1 - x0) / 2, (y1 - y0) / 2) / (1 - margin);
    dist = Math.max(4, dist * (1 + (span - 1) * 0.9));
  }
  return cameraAt(target, dist, elev, fov, aspect);
}
