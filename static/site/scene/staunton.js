// Chess in three dimensions (scene/board3d.js draws it; glsl/board3d.js shades it): the pieces' shapes, the
// starting position, the Scotch as a function of time, and the camera that frames the board.
//   The pieces are turned from the ink that becomes them: the outlines tools/site/ink_profiles.mjs measures
// on the vapor figures' own studies (staunton-ink.js), kept in the sprite's units. Each row of an outline
// gives the radius of the solid at that height, and the solid is that profile turned about its axis. A profile is kept as a signed distance over its half plane (r, y), so the shader's
// piece is exactly a distance in space: the profile's distance at (|xz|, y). The knight's head is not turned
// but cut: its silhouette's distance, drawn out to a thickness. Details the profile cannot hold (the king's
// cross, the queen's coronet, the bishop's ball and mitre, the rook's crenels) are added in the shader from
// the sprite's own figures, given here in the same units.
//   World units: a square is 1; the board's top is y = 0; files run along x (a … h, −3.5 … 3.5), ranks
// along z (rank 1 nearest the camera, at z = 3.5).
import { distances } from './ink-plan.js';
import { INK_PATHS, INK_DETAIL } from './staunton-ink.js';

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

// The outlines (sprite units): each turned piece's, the knight's plinth and then its head.
export const PATHS = INK_PATHS;

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
export const PROF = Object.freeze({ cell: 0.0014, w: 328, h: 1000, y0: -0.02 });
export const HEAD = Object.freeze({ cell: 0.0014, w: 657, h: 1000, x0: -0.46, y0: -0.02 });
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

// The knight's carved head: its silhouette's distance and, beside it, half its thickness at each point of
// its face, from the relief measured on the knight study (staunton-relief.js: its outline inflated, its
// fine ink cut in). The rays for both the floating knight and the board sample the same section.
export function decodeRelief(meta, base64) {
  const bin = globalThis.atob ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  return { ...meta, data: Uint8Array.from(bin, c => c.charCodeAt(0)) };
}
export function sculptedHeadField(relief) {
  const d = headField(), field = new Float32Array(d.length * 2), { w, h, x0, y0, cell, max, data } = relief;
  const at = (x, y) => {
    const u = clamp((x - x0) / cell - .5, 0, w - 1.001), v = clamp((y - y0) / cell - .5, 0, h - 1.001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const s = (a, b) => data[b * w + a];
    return max / 255 * ((s(i, j) * (1 - fu) + s(i + 1, j) * fu) * (1 - fv) + (s(i, j + 1) * (1 - fu) + s(i + 1, j + 1) * fu) * fv);
  };
  for (let row = 0; row < HEAD.h; row++) {
    const y = HEAD.y0 + (row + .5) * HEAD.cell;
    for (let col = 0; col < HEAD.w; col++) {
      const k = row * HEAD.w + col;
      field[2 * k] = d[k];
      // (A rounded edge everywhere, however thin the ink was there.)
      field[2 * k + 1] = d[k] < .07 ? Math.max(.034, at(HEAD.x0 + (col + .5) * HEAD.cell, y)) : .08;
    }
  }
  return field;
}

// ---- the details, measured on the studies (world units: staunton-ink.js) ------------------------------
// cross: the king's cross pattée: its arms' centre height, half-length, half-height by the upright and at
//   their ends; the upright's top, its half-width there and at its narrowest, its foot; its half-thickness.
// tines: the queen's: a pearl's centre (reach from the axis, height), its radius; the rim they rise from
//   (radius, height). Eight round the cup.
// slit: the bishop's: two points across its mitre (x, y) and its width.
// crenel: the rook's: the merlons' height, a gap's width, the top's radius. Six round the top.
// stem: where each turned piece's stem runs (its foot and its collar), for the spiral fold the ink left in it.
export const DETAIL = INK_DETAIL;
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
