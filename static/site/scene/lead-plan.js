// A click into Outdoors (glsl/opens.js): molten lead runs out from the click along the window's came
// (glsl/folio.js), round its corners, cooling behind its glowing tip, while dark glass sets in the
// panes; then the last light passes through it. This works out, for a click, when the lead reaches
// each joint of the leading: the module's cells on screen, each band edge's segments joining the
// midpoints of their sides (leadCell, as the shader leads them), a Dijkstra over that network. The
// lead runs along the network twice as fast as anything spreads straight out from the click, so it
// races round the leading; each separate piece of it is lit where it comes nearest the click, when the
// straight-out front gets there.
import { TERRAIN, FT } from './terrain-plan.js';
import { GLASS, leadCell } from './glsl/folio.js';

// Clock (the cover's E): the first joints at start; straight out from the click it takes `radial` to
// reach the far corner, along the lead `line` per far-corner distance; nothing later than `last`.
export const LEAD = Object.freeze({ start: 0.02, radial: 0.85, line: 0.4, last: 0.86 });

// The plate's height (km) at map point (x, z), as the GPU filters it (bilinear between texel centres,
// clamped at the edges). km: the plate's texels (as stored: half floats, decoded).
export function plateAt(km, n, x, z) {
  const u = Math.max(0, Math.min(n - 1, x / TERRAIN.size * n - 0.5)), v = Math.max(0, Math.min(n - 1, z / TERRAIN.size * n - 0.5));
  const i = Math.min(n - 2, Math.floor(u)), j = Math.min(n - 2, Math.floor(v)), fu = u - i, fv = v - j, k = j * n + i;
  return km[k] * (1 - fu) * (1 - fv) + km[k + 1] * fu * (1 - fv) + km[k + n] * (1 - fu) * fv + km[k + n + 1] * fu * fv;
}
// The top view's framing (glsl/folio.js fgSpan, fgMap): km a screen height.
export const spanOf = (W, H) => Math.min(GLASS.top, 1.07 * TERRAIN.size * Math.min(1, H / W) * 0.97) / GLASS.focal;

// The plan, as float texels: row 0 a header (i0, j0, columns, rows), then per module cell (i0 + x,
// j0 + y) at (x, 1 + y): when the lead reaches the middle of its bottom side and of its left side
// (-1 where no came crosses it). O: the click (CSS px); far: its farthest corner (px).
export function makeLead(km, n, O, far, W, H) {
  const S = TERRAIN.size, M = GLASS.module, C = S / 2, span = spanOf(W, H), kmPx = span / H;
  const toMap = (px, py) => [C + (px - W / 2) * kmPx, C + (H / 2 - py) * kmPx];
  const toPx = (x, z) => [W / 2 + (x - C) / kmPx, H / 2 - (z - C) / kmPx];
  const [xa, za] = toMap(0, H), [xb, zb] = toMap(W, 0);
  const i0 = Math.floor((xa - C) / M) - 1, j0 = Math.floor((za - C) / M) - 1;
  const nx = Math.ceil((xb - C) / M) + 2 - i0, ny = Math.ceil((zb - C) / M) + 2 - j0;
  const ft = (x, z) => plateAt(km, n, x, z) / FT;
  // Vertices: the bottom side's middle of cell (x, y) is 2(y·nx + x), its left side's 2(y·nx + x) + 1.
  const V = 2 * nx * ny, adj = Array.from({ length: V }, () => []), live = new Uint8Array(V);
  const vid = (x, y, [u, w]) => (w === 0 ? 2 * (y * nx + x) : w === 1 ? 2 * ((y + 1) * nx + x) : u === 0 ? 2 * (y * nx + x) + 1 : 2 * (y * nx + x + 1) + 1);
  for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const ox = C + (i0 + x) * M, oz = C + (j0 + y) * M;
    const v = [ft(ox, oz), ft(ox + M, oz), ft(ox + M, oz + M), ft(ox, oz + M)], mid = ft(ox + M / 2, oz + M / 2);
    for (const thr of GLASS.bands) for (const [a, b] of leadCell(v, mid, thr).segs) {
      const A = vid(x, y, a), B = vid(x, y, b), len = Math.hypot(a[0] - b[0], a[1] - b[1]) * M / kmPx;
      live[A] = live[B] = 1;
      adj[A].push([B, len]); adj[B].push([A, len]);
    }
  }
  // Each joint's place on screen, its straight-out time, then the lead's along the network.
  const T = new Float64Array(V).fill(Infinity), heap = [];
  const push = (k, t) => { heap.push([t, k]); for (let i = heap.length - 1; i;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let k = 0; k < V; k++) {
    if (!live[k]) continue;
    const c = k >> 1, x = c % nx, y = (c / nx) | 0, side = k & 1;
    const [px, py] = toPx(C + (i0 + x + (side ? 0 : 0.5)) * M, C + (j0 + y + (side ? 0.5 : 0)) * M);
    T[k] = LEAD.start + LEAD.radial * Math.hypot(px - O[0], py - O[1]) / far;
    push(k, T[k]);
  }
  while (heap.length) {
    const [t, k] = pop();
    if (t > T[k]) continue;
    for (const [q, len] of adj[k]) { const tt = t + LEAD.line * len / far; if (tt < T[q]) { T[q] = tt; push(q, tt); } }
  }
  const w = nx, h = ny + 1, data = new Float32Array(w * h * 4);
  data.set([i0, j0, nx, ny], 0);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const c = y * nx + x, o = ((1 + y) * w + x) * 4;
    data[o] = live[2 * c] ? Math.min(T[2 * c], LEAD.last) : -1;
    data[o + 1] = live[2 * c + 1] ? Math.min(T[2 * c + 1], LEAD.last) : -1;
  }
  return { w, h, data, i0, j0, nx, ny, T, live, adj };
}
