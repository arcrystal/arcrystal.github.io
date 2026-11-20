// Chess's pieces in the order Photography → Chess builds them, and the exact distance transform the pieces'
// shapes are measured with (staunton.js). The transition itself: unmix-plan.js (its clock and story),
// living-ink-plan.js (its fluid), board3d.js (its board), glsl/unmix.js (its drawing).
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

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
