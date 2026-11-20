#!/usr/bin/env node
// Chess's solid pieces, measured from the ink that becomes them (static/site/scene/data/ink-figure-density.webp
// and ink-knight-density.webp, the studies the vapor figures are drawn with). Writes
// static/site/scene/staunton-ink.js: each turned piece's outline as a path in the sprite's units (so
// staunton.js turns it exactly as it turned the sprite's), the details the lathe cannot hold (the king's
// cross pattée, the queen's tines, the bishop's finial and slit, the rook's crenels), the knight's head and
// its carved relief, and the registration of each study to its solid.
//   node tools/site/ink_profiles.mjs [--base URL]        (needs the site served: node tools/site/serve.mjs)
//   node tools/site/ink_profiles.mjs --gray DIR          (from figure.gray / knight.gray dumped earlier)
// Each study is optical depth τ = −ln T. Its dense body (τ > BODY) is opened to drop the wisps, the
// largest piece kept and its holes filled; then per row, from the measured axis, the run of ink either side
// (gaps of a few pixels bridged) gives the half-width, the two sides averaged. A median and a light blur
// along the height smooth the ink's tremor but keep every collar's step.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const BODY = 0.18, CELL = 512;
// The sprite's units (staunton.js): a 45-unit square, foot at y = 43.5, axis at x = 22.5.
const SQ = 45, AXIS = 22.5, FOOT = 43.5, SR = 1.27, SY = 1.42;
const spriteX = r => AXIS + r * SQ / SR, spriteY = y => FOOT - y * SQ / SY;
// The heights the pieces keep (the board's framing and the tile's look are measured in them).
export const HEIGHTS = { K: 1.2846266666666666, Q: 1.1896444444444445, B: 1.074151111111111, N: 1.044488888888889, R: 0.8835555555555555, P: 0.773111111111111 };
// The figure atlas: three by two cells, top row K Q B, bottom R P P (living-ink.js pigmentAt).
export const CELLS = { K: [0, 0], Q: [1, 0], B: [2, 0], R: [0, 1], P: [1, 1], P2: [2, 1] };

// ---- raster helpers --------------------------------------------------------------------------------
function opticalDepth(gray, W, x0, y0, w, h) {
  const t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[y * w + x] = -Math.log(Math.max(0.01, gray[(y0 + y) * W + x0 + x] / 255));
  return t;
}
function morph(mask, w, h, r, grow) {
  // A disc: erode (grow false) or dilate (grow true), separably approximated by a square then a cross.
  const out = new Uint8Array(w * h), offs = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (const [dx, dy] of offs) {
      const X = x + dx, Y = y + dy, m = X >= 0 && Y >= 0 && X < w && Y < h ? mask[Y * w + X] : 0;
      if (grow ? m : !m) { v = grow ? 1 : 0; break; }
    }
    out[y * w + x] = v;
  }
  return out;
}
function largest(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1), sizes = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = sizes.length, stack = [s];
    let n = 0;
    label[s] = id;
    while (stack.length) {
      const k = stack.pop(), x = k % w, y = (k - x) / w;
      n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X;
        if (mask[j] && label[j] < 0) { label[j] = id; stack.push(j); }
      }
    }
    sizes.push(n);
  }
  const best = sizes.indexOf(Math.max(...sizes)), out = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) out[k] = label[k] === best ? 1 : 0;
  return out;
}
function fillHoles(mask, w, h) {
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (!mask[y * w + x]) { seen[y * w + x] = 1; stack.push(y * w + x); }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (!mask[y * w + x] && !seen[y * w + x]) { seen[y * w + x] = 1; stack.push(y * w + x); }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k - x) / w;
    for (const [X, Y] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const j = Y * w + X;
      if (!mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  const out = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) out[k] = mask[k] || !seen[k] ? 1 : 0;
  return out;
}
export function bodyMask(tau, w, h, open = 3) {
  let m = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) m[k] = tau[k] > BODY ? 1 : 0;
  m = fillHoles(m, w, h);
  m = morph(morph(m, w, h, open, false), w, h, open, true);
  return fillHoles(largest(m, w, h), w, h);
}
// Per row, the run of ink through the axis (gaps up to `gap` px bridged): its left and right ends, or null.
function runThrough(mask, w, y, axis, gap = 4) {
  const a = Math.round(axis);
  let hit = -1;
  for (let d = 0; d <= 3 && hit < 0; d++) for (const x of [a - d, a + d]) if (x >= 0 && x < w && mask[y * w + x]) { hit = x; break; }
  if (hit < 0) return null;
  let l = hit, r = hit, miss = 0;
  for (let x = hit - 1; x >= 0; x--) { if (mask[y * w + x]) { l = x; miss = 0; } else if (++miss > gap) break; }
  miss = 0;
  for (let x = hit + 1; x < w; x++) { if (mask[y * w + x]) { r = x; miss = 0; } else if (++miss > gap) break; }
  return [l, r + 1];
}
function median(a) { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }
// Smooth along the height, keeping steps (a jump of more than `step` px between neighbours is a ledge).
function smoothSteps(v, step = 3.5) {
  const n = v.length, med = v.map((_, i) => median(v.slice(Math.max(0, i - 2), Math.min(n, i + 3)))), out = med.slice();
  for (let i = 1; i < n - 1; i++) {
    if (Math.abs(med[i + 1] - med[i]) > step || Math.abs(med[i] - med[i - 1]) > step) continue;
    let s = 0, wsum = 0;
    for (let d = -3; d <= 3; d++) {
      const j = i + d;
      if (j < 0 || j >= n) continue;
      let blocked = false;
      for (let k = Math.min(i, j); k < Math.max(i, j); k++) if (Math.abs(med[k + 1] - med[k]) > step) blocked = true;
      if (blocked) continue;
      const wt = Math.exp(-d * d / (2 * 1.4 * 1.4));
      s += med[j] * wt; wsum += wt;
    }
    out[i] = s / wsum;
  }
  return out;
}

// ---- a turned piece -----------------------------------------------------------------------------------
// The body: its mask, top and foot rows, axis, and per row the half-width (px) of the run through the axis
// and the outer half-width of the row (both sides averaged), and how many runs the row has.
export function measureBody(tau, w, h, open = 3) {
  const mask = bodyMask(tau, w, h, open);
  let top = h, foot = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { top = Math.min(top, y); foot = Math.max(foot, y); }
  const mids = [];
  for (let y = Math.round(top + .3 * (foot - top)); y < top + .7 * (foot - top); y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (l < 0) l = x; r = x; }
    if (l >= 0) mids.push((l + r + 1) / 2);
  }
  const axis = median(mids), run = [], outer = [], runs = [];
  for (let y = 0; y < h; y++) {
    const t = runThrough(mask, w, y, axis, 6);
    run.push(t ? ((axis - t[0]) + (t[1] - axis)) / 2 : 0);
    let l = -1, r = -1, n = 0, prev = 0;
    for (let x = 0; x < w; x++) { const v = mask[y * w + x]; if (v) { if (l < 0) l = x; r = x + 1; } if (v && !prev) n++; prev = v; }
    outer.push(l < 0 ? 0 : ((axis - l) + (r - axis)) / 2);
    runs.push(n);
  }
  return { mask, top, foot, axis, run, outer, runs, w, h };
}
// A clean foot: the widest row of the base (in its lowest fifth) becomes its rim, rounded over `rim` px
// into a flat bottom; above it the flare only widens downward. Rows below the rim (the ink's splash) go.
function regularFoot(half, top, foot) {
  const n = foot - top + 1, from = Math.round(top + .8 * n);
  let yMax = from;
  for (let y = from; y <= foot; y++) if (half[y] > half[yMax]) yMax = y;
  // Where the base begins: the narrowest row of the stem above it.
  let waist = Math.round(top + .45 * n);
  for (let y = waist; y < yMax; y++) if (half[y] < half[waist]) waist = y;
  const out = half.slice();
  let run = out[waist];
  for (let y = waist; y <= yMax; y++) { run = Math.max(run, out[y]); out[y] = run; }
  const R = out[yMax], rim = Math.max(4, .022 * n);
  for (let k = 1; k <= Math.ceil(rim); k++) out[yMax + k] = R - rim + Math.sqrt(Math.max(0, rim * rim - k * k));
  return { half: out, foot: yMax + Math.ceil(rim) };
}
// A path in the sprite's units: the outline at `scale` world units per px, from its foot (px) up to `y1`.
function turnedPath(half, axisFoot, y1, scale, every = 3) {
  const pts = [];
  for (let y = axisFoot; y >= y1; y -= every) pts.push([spriteX(Math.max(0, half[y]) * scale), spriteY((axisFoot + 1 - y) * scale)]);
  if (pts.at(-1)[1] !== spriteY((axisFoot + 1 - y1) * scale)) pts.push([spriteX(Math.max(0, half[y1]) * scale), spriteY((axisFoot + 1 - y1) * scale)]);
  const f = v => +v.toFixed(3);
  const right = pts.map(([x, y]) => `L${f(x)} ${f(y)}`), left = pts.slice().reverse().map(([x, y]) => `L${f(2 * AXIS - x)} ${f(y)}`);
  return `M${AXIS} ${FOOT} ${right.join(' ')} L${AXIS} ${f(pts.at(-1)[1])} ${left.join(' ')}Z`;
}
// Smooth a profile between rows a and b (inclusive), keeping its steps.
function smoothRange(half, a, b, step = 3.5) {
  const s = smoothSteps(half.slice(a, b + 1), step), out = half.slice();
  for (let y = a; y <= b; y++) out[y] = s[y - a];
  return out;
}
// The registration's chart for a study (ink-registration.js): its height knots (model height 0 … 1 →
// the study's v) and the wet outline's extents (u0, u1 in % of the study's width) every twentieth of v.
function chart(m, width, vFoot, vTop, below = null) {
  const height = below ? [[0, vFoot + .004], [below, vFoot], [1, vTop]] : [[0, vFoot], [1, vTop]];
  const edges = [];
  for (let k = 0; k <= 20; k++) {
    const y = Math.min(m.h - 1, Math.round(k / 20 * (m.h - 1)));
    let l = -1, r = -1;
    for (let x = 0; x < m.w; x++) if (m.mask[y * m.w + x]) { if (l < 0) l = x; r = x + 1; }
    if (l < 0 || r - l < 2) edges.push(48, 52);
    else edges.push(Math.round(100 * l / width), Math.round(100 * r / width));
  }
  return { height: height.map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]), edges };
}

// The king: the cross pattée above `cut`, the turned body below.
function kingCross(m, scale, foot) {
  const top = m.top, H = y => (foot + 1 - y) * scale, R = px => px * scale;
  const head = m.run.slice(top, top + 14), bar = median(head);
  // The arms: the first block of rows (from the top) much wider than the upright.
  let armTop = -1, armBottom = -1;
  for (let y = top; y < top + 140; y++) {
    if (m.run[y] > 2.2 * bar) { if (armTop < 0) armTop = y; armBottom = y; }
    else if (armTop >= 0) break;
  }
  // Below the arms, the cross's foot narrows into the knob: the turned body takes over there.
  let cut = armBottom + 1;
  while (cut < armBottom + 12 && m.run[cut] > 1.4 * bar) cut++;
  // The arms' half-length; their half-height at the end and next to the stem (pattée: they flare).
  let L = 0;
  for (let y = armTop; y <= armBottom; y++) L = Math.max(L, m.run[y]);
  const column = x => { let n = 0; for (let y = armTop - 3; y <= armBottom + 3; y++) n += m.mask[y * m.w + Math.round(m.axis + x)] + m.mask[y * m.w + Math.round(m.axis - x)]; return n / 4; };
  const endH = column(L - 3), midH = column(Math.min(L - 4, 1.6 * bar + 3));
  const topW = Math.max(...m.run.slice(top, top + 6)), neckW = Math.min(...m.run.slice(top + 6, armTop));
  return {
    cut,
    // centre of the arms (x 0, y), their half-length, half-height next to the stem and at the end; the
    // upright's top, its half-width at the top and at its narrowest; its foot; thickness.
    cross: [+H((armTop + armBottom) / 2).toFixed(5), +R(L).toFixed(5), +R(midH).toFixed(5), +R(endH).toFixed(5),
      +H(top).toFixed(5), +R(topW).toFixed(5), +R(neckW).toFixed(5), +H(cut + 3).toFixed(5), +R(.62 * (neckW + topW)).toFixed(5)],
  };
}
// The queen's tines: the outermost tine's pearl (its centre's reach and height, its radius) and where the
// tines leave the cup (the cup's rim: radius and height).
function queenTines(m, scale, foot) {
  const H = y => (foot + 1 - y) * scale;
  let rim = m.top;
  for (let y = m.top + 10; y < m.top + 200; y++) if (m.runs[y] === 1 && m.run[y] > 40) { rim = y; break; }
  // Each side's outermost ink above the rim is its outermost tine's pearl: how far out, and how high
  // (its topmost row reaching within a few px of that).
  const side = sign => {
    const reachAt = y => { let best = 0; for (let x = 0; x < m.w; x++) if (m.mask[y * m.w + x]) best = Math.max(best, sign * (x - m.axis)); return best; };
    let reach = 0;
    for (let y = m.top; y < rim; y++) reach = Math.max(reach, reachAt(y));
    let top = rim;
    for (let y = m.top; y < rim; y++) if (reachAt(y) > reach - 5) { top = y; break; }
    return [reach, top];
  };
  const [rl, tl] = side(-1), [rr, tr] = side(1), pearl = .022;
  return { tines: [+(((rl + rr) / 2) * scale - pearl).toFixed(5), +(H((tl + tr) / 2) - pearl).toFixed(5), pearl, +(m.run[rim + 2] * scale).toFixed(5), +H(rim).toFixed(5)] };
}
// The bishop's slit: the clear stripe across its mitre, as a line (two points, model x and y) and a width.
function bishopSlit(tau, m, scale, foot) {
  const pts = [];
  for (let y = m.top; y < m.top + .55 * (foot - m.top); y++) for (let x = 0; x < m.w; x++) {
    const k = y * m.w + x;
    if (m.mask[k] && tau[k] < .07 && Math.abs(x - m.axis) < .85 * m.run[y]) pts.push([x, y]);
  }
  const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { sxx += (x - cx) ** 2; sxy += (x - cx) * (y - cy); syy += (y - cy) ** 2; }
  const ang = .5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(ang), dy = Math.sin(ang);
  let lo = 1e9, hi = -1e9, wide = 0;
  for (const [x, y] of pts) { const t = (x - cx) * dx + (y - cy) * dy; lo = Math.min(lo, t); hi = Math.max(hi, t); wide += Math.abs(-(x - cx) * dy + (y - cy) * dx); }
  const M = (x, y) => [+((x - m.axis) * scale).toFixed(5), +((foot + 1 - y) * scale).toFixed(5)];
  return { slit: [...M(cx + lo * dx, cy + lo * dy), ...M(cx + hi * dx, cy + hi * dy), +(2 * wide / n * scale).toFixed(5)] };
}
// The rook's crenels: the band of merlons at its top (its depth) and the gaps' width.
function rookCrenels(m, scale) {
  let band = m.top;
  while (band < m.top + 120 && m.runs[band] >= 2 || band < m.top + 4) band++;
  const mid = Math.round((m.top + band) / 2), gaps = [];
  let prev = 0, start = -1;
  for (let x = 0; x < m.w; x++) {
    const v = m.mask[mid * m.w + x];
    if (!v && prev) start = x;
    if (v && !prev && start >= 0) { gaps.push(x - start); start = -1; }
    prev = v;
  }
  const gap = gaps.length ? median(gaps) : 20;
  return { band, crenel: [+((band - m.top) * scale).toFixed(5), +(gap * scale * 1.12).toFixed(5)] };
}

// ---- the knight -------------------------------------------------------------------------------------
// Its head: the knight study's ink, opened and cleaned; an outline (polygons, model units) and a relief:
// half the thickness of the carved head at each point of its face. The relief is the silhouette inflated
// (∇²φ = −1 inside, φ = 0 on the outline; thickness √(2φ), a hemisphere over a disc) less a little of the
// study's own fine density (its eye, nostril, jaw and the locks of its mane cut into it).
function traceOutline(mask, w, h) {
  // Marching squares between pixel centres ((i + ½, j + ½)), each segment walked with the ink on one side,
  // joined into closed loops.
  const segs = new Map(), key = (x, y) => (Math.round(2 * x) + 4) * 8192 + Math.round(2 * y) + 4;
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const code = at(x, y) | at(x + 1, y) << 1 | at(x + 1, y + 1) << 2 | at(x, y + 1) << 3;
    if (!code || code === 15) continue;
    const top = [x + 1, y + .5], right = [x + 1.5, y + 1], bottom = [x + 1, y + 1.5], left = [x + .5, y + 1];
    const add = (p, q) => segs.set(key(...p), { p, q });
    switch (code) {
      case 1: add(left, top); break; case 2: add(top, right); break; case 3: add(left, right); break;
      case 4: add(right, bottom); break; case 5: add(left, top); add(right, bottom); break; case 6: add(top, bottom); break;
      case 7: add(left, bottom); break; case 8: add(bottom, left); break; case 9: add(bottom, top); break;
      case 10: add(top, right); add(bottom, left); break; case 11: add(bottom, right); break; case 12: add(right, left); break;
      case 13: add(right, top); break; case 14: add(top, left); break;
    }
  }
  const loops = [];
  while (segs.size) {
    const [k0, first] = segs.entries().next().value;
    segs.delete(k0);
    const loop = [first.p];
    let q = first.q;
    for (;;) {
      const k = key(...q), next = segs.get(k);
      if (!next) break;
      loop.push(q); segs.delete(k); q = next.q;
    }
    if (loop.length > 12) loops.push(loop);
  }
  return loops.sort((u, v) => v.length - u.length);
}
function simplify(pts, tol) {
  // Douglas–Peucker on a closed loop (split at its farthest pair).
  const dp = (a, b) => {
    let worst = -1, at = -1;
    const [x0, y0] = pts[a], [x1, y1] = pts[b], dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - x0) * dy - (pts[i][1] - y0) * dx) / len; if (d > worst) { worst = d; at = i; } }
    return worst > tol ? [...dp(a, at).slice(0, -1), ...dp(at, b)] : [pts[a], pts[b]];
  };
  const half = pts.length >> 1;
  return [...dp(0, half).slice(0, -1), ...dp(half, pts.length - 1)];
}
function inflate(mask, w, h, iterations = 900) {
  const phi = new Float32Array(w * h), om = 1.92;
  for (let it = 0; it < iterations; it++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x;
    if (!mask[k]) continue;
    const g = (phi[k - 1] + phi[k + 1] + phi[k - w] + phi[k + w] + 1) / 4;
    phi[k] += om * (g - phi[k]);
  }
  return phi;
}
function blur(src, w, h, sigma) {
  const r = Math.ceil(3 * sigma), k = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b), tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += src[y * w + Math.min(w - 1, Math.max(0, x + i))] * k[i + r]; tmp[y * w + x] = s / sum; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * k[i + r]; out[y * w + x] = s / sum; }
  return out;
}
// The knight's plinth (the pawn study's foot, scaled under the head) and its head.
export const KNIGHT = Object.freeze({ plinth: 0.24, plinthR: 0.355, headFoot: 0.13 });
function knightHead(tau) {
  const W = 800, face = measureBody(tau, W, W, 3);
  // The mane's curls are ink, not wood: behind the poll they are opened away harder, so the carved mane
  // is a mass whose locks the relief cuts in; the ears and muzzle keep their fine outline.
  const mane = bodyMask(tau, W, W, 10);
  let mask = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const k = y * W + x, t = Math.min(1, Math.max(0, (x - 360) / 80)); mask[k] = t >= .5 ? face.mask[k] : mane[k]; }
  mask = fillHoles(largest(morph(morph(mask, W, W, 4, true), W, W, 4, false), W, W), W, W);
  // A carver's outline: the mane's edge blurred broadly, the face's finely (its ears stay sharp).
  {
    const soft = blur(Float32Array.from(mask), W, W, 6), fine = blur(Float32Array.from(mask), W, W, 1.8);
    const next = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const k = y * W + x, t = Math.min(1, Math.max(0, (x - 330) / 120)); next[k] = (soft[k] * (1 - t) + fine[k] * t) > .5 ? 1 : 0; }
    mask = fillHoles(largest(next, W, W), W, W);
  }
  const m = { ...face, mask };
  m.top = W; m.foot = -1;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { m.top = Math.min(m.top, y); m.foot = Math.max(m.foot, y); }
  // The chest's lowest rows sit on the plinth; the ears reach the knight's height.
  const hTop = HEIGHTS.N, scale = (hTop - KNIGHT.headFoot) / (m.foot + 1 - m.top);
  // Over the plinth: the middle of the chest's run of ink, a little above its foot.
  const chestRow = m.foot - Math.round(.04 * (m.foot - m.top));
  let l = -1, r = -1;
  for (let x = 0; x < W; x++) if (m.mask[chestRow * W + x]) { if (l < 0) l = x; r = x + 1; }
  let axis = (l + r) / 2 + .06 * (r - l);
  // Within its square: the head reaches no further than .47 either side of the axis (glsl/board3d.js walks
  // the board a square at a time); a head too wide is narrowed, not cropped.
  let left = W, right = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { left = Math.min(left, x); right = Math.max(right, x + 1); }
  axis = Math.min(Math.max(axis, right - .47 / scale), left + .47 / scale);
  const sx = Math.min(scale, .47 / Math.max(axis - left, right - axis));
  const toModel = (x, y) => [(x - axis) * sx, KNIGHT.headFoot + (m.foot + 1 - y) * scale];
  const loops = traceOutline(mask, W, W).map(loop => simplify(loop, .7).map(([x, y]) => toModel(x, y)));
  // Relief: inflation (thickness √(2φ) px), carved by the study's fine density.
  const phi = inflate(mask, W, W), fine = blur(tau, W, W, 5.5), broad = blur(tau, W, W, 22);
  const RELIEF = { cell: 0.0028, x0: -0.46, y0: -0.02, w: 329, h: 500 }, data = new Uint8Array(RELIEF.w * RELIEF.h);
  const thick = (px, py) => {
    const x = Math.min(W - 2, Math.max(0, px)), y = Math.min(W - 2, Math.max(0, py)), i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const s = (a, k) => a[k];
    const bil = a => (s(a, j * W + i) * (1 - fx) + s(a, j * W + i + 1) * fx) * (1 - fy) + (s(a, (j + 1) * W + i) * (1 - fx) + s(a, (j + 1) * W + i + 1) * fx) * fy;
    const t = .62 * Math.sqrt(2 * Math.max(0, bil(phi))) * scale;
    // (Cut in where the head is thick enough to carve; the edges stay smooth.)
    const carve = .0042 * Math.tanh(1.1 * (bil(fine) - bil(broad))) * Math.min(1, t / .05);
    return Math.min(.19, Math.max(0, t - carve));
  };
  const grid = new Float32Array(RELIEF.w * RELIEF.h);
  for (let row = 0; row < RELIEF.h; row++) for (let col = 0; col < RELIEF.w; col++) {
    const x = RELIEF.x0 + (col + .5) * RELIEF.cell, y = RELIEF.y0 + (row + .5) * RELIEF.cell;
    const px = x / sx + axis, py = m.foot + 1 - (y - KNIGHT.headFoot) / scale;
    grid[row * RELIEF.w + col] = thick(px, py);
  }
  // (Smoothed over a couple of cells, so the byte's steps and the mask's stairs do not shade.)
  const smooth = blur(grid, RELIEF.w, RELIEF.h, 1.6);
  for (let k = 0; k < grid.length; k++) data[k] = Math.round(255 * Math.min(1, Math.max(0, grid[k] > 0 ? smooth[k] : 0) / .2));
  return { m, scale, axis, loops, relief: { ...RELIEF, max: .2, data } };
}

// ---- all of it ----------------------------------------------------------------------------------------
export function analyse(figure, knight) {
  const FW = 3 * CELL, cells = {}, out = { paths: {}, detail: {}, charts: [], studies: {} };
  for (const name of Object.keys(CELLS)) { const [c, r] = CELLS[name]; cells[name] = opticalDepth(figure, FW, c * CELL, r * CELL, CELL, CELL); }
  const turned = {};
  for (const name of Object.keys(CELLS)) {
    const m = measureBody(cells[name], CELL, CELL);
    // The rook's merlons stand apart: their band is measured edge to edge.
    let half = m.run.slice(), band = null;
    if (name === 'R') { band = rookCrenels(m, 1).band; for (let y = m.top; y <= band; y++) half[y] = m.outer[y]; }
    half = smoothRange(half, m.top, m.foot);
    const reg = regularFoot(half, m.top, m.foot);
    turned[name] = { m, half: reg.half, foot: reg.foot, band };
    out.studies[name] = { mask: m.mask, top: m.top, foot: reg.foot, axis: m.axis, half: reg.half };
  }
  const scaleOf = name => HEIGHTS[name[0]] / (turned[name].foot + 1 - turned[name].m.top);
  // The king: the cross is a detail; the turned body starts under it.
  { const t = turned.K, s = scaleOf('K'), k = kingCross(t.m, s, t.foot);
    out.paths.K = turnedPath(t.half, t.foot, k.cut, s); out.detail.cross = k.cross; }
  { const t = turned.Q, s = scaleOf('Q'), q = queenTines(t.m, s, t.foot);
    out.paths.Q = turnedPath(t.half, t.foot, t.m.top, s); out.detail.tines = q.tines; }
  { const t = turned.B, s = scaleOf('B'), b = bishopSlit(cells.B, t.m, s, t.foot);
    out.paths.B = turnedPath(t.half, t.foot, t.m.top, s); out.detail.slit = b.slit; }
  { const t = turned.R, s = scaleOf('R'), r = rookCrenels(t.m, s);
    out.paths.R = turnedPath(t.half, t.foot, t.m.top, s); out.detail.crenel = [...r.crenel, +(Math.max(...t.half.slice(t.m.top, t.band + 1)) * s).toFixed(5)]; }
  { const t = turned.P, s = scaleOf('P');
    out.paths.P = turnedPath(t.half, t.foot, t.m.top, s); }
  // The knight: the pawn's foot scaled into a plinth, and the study's head.
  const kn = knightHead(opticalDepth(knight, 800, 0, 0, 800, 800));
  { const t = turned.P, n = t.foot + 1 - t.m.top;
    let waist = Math.round(t.m.top + .5 * n);
    for (let y = waist; y < t.foot - .1 * n; y++) if (t.half[y] < t.half[waist]) waist = y;
    const rows = t.foot + 1 - waist, s = KNIGHT.plinth / rows, maxR = Math.max(...t.half.slice(waist, t.foot + 1)) * s, k = KNIGHT.plinthR / maxR;
    const plinth = t.half.map(v => v * k);
    const base = turnedPath(plinth, t.foot, waist, s);
    const f = v => +v.toFixed(3);
    const head = kn.loops.map(loop => 'M' + loop.map(([x, y]) => `${f(spriteX(x))} ${f(spriteY(y))}`).join(' L') + 'Z').join(' ');
    out.paths.N = `${base} ${head}`;
  }
  out.relief = kn.relief;
  // The registration: each study (K Q B N R P P) to its solid, linear in height.
  const figChart = name => { const t = turned[name]; return chart(t.m, CELL, (t.foot + 1) / CELL, t.m.top / CELL); };
  const below = KNIGHT.headFoot / HEIGHTS.N;
  out.charts = [figChart('K'), figChart('Q'), figChart('B'), chart(kn.m, 800, (kn.m.foot + 1) / 800, kn.m.top / 800, +below.toFixed(4)), figChart('R'), figChart('P'), figChart('P2')];
  // Where each turned piece's stem runs (its spiral fold, glsl/board3d.js stemSection): from the top of its
  // foot to the collar under its head, model heights.
  out.detail.stem = {};
  for (const name of ['K', 'Q', 'B', 'R', 'P']) {
    const t = turned[name], n = t.foot + 1 - t.m.top, s = scaleOf(name);
    let waist = Math.round(t.m.top + .5 * n);
    for (let y = Math.round(t.m.top + .3 * n); y < t.foot - .15 * n; y++) if (t.half[y] < t.half[waist]) waist = y;
    let collar = waist;
    for (let y = waist; y > t.m.top + .1 * n; y--) if (t.half[y] > 1.6 * t.half[waist]) { collar = y; break; }
    let foot = waist;
    for (let y = waist; y < t.foot; y++) if (t.half[y] > 1.6 * t.half[waist]) { foot = y; break; }
    out.detail.stem[name] = [+((t.foot + 1 - foot) * s).toFixed(4), +((t.foot + 1 - collar) * s).toFixed(4)];
  }
  out.knight = kn;
  return out;
}

export function moduleSource(a) {
  const j = v => JSON.stringify(v);
  return `// Chess's solid pieces as the ink draws them: written by tools/site/ink_profiles.mjs from the studies the
// vapor figures are made of (data/ink-figure-density.webp, data/ink-knight-density.webp). Do not edit by hand.
//   INK_PATHS: each piece's outline in the sprite's units (staunton.js turns it as it turned the sprite's; the
// knight's first subpath its plinth, the rest its head). INK_DETAIL: what the lathe cannot hold, model units
// (glsl/board3d.js shape). INK_CHARTS: each study registered to its solid (ink-registration.js).
export const INK_PATHS = Object.freeze(${j(a.paths)});
export const INK_DETAIL = Object.freeze(${j(a.detail)});
export const INK_CHARTS = Object.freeze(${j(a.charts)});
`;
}
export function reliefSource(r) {
  return `// The knight's carved head: half its thickness over its face (model units, 0 … ${r.max} in a byte), on a
// ${r.w} × ${r.h} grid from (${r.x0}, ${r.y0}) every ${r.cell}. Written by tools/site/ink_profiles.mjs from
// the knight study (its outline inflated, its fine ink cut in). Do not edit by hand.
export const KNIGHT_RELIEF = Object.freeze(${JSON.stringify({ w: r.w, h: r.h, x0: r.x0, y0: r.y0, cell: r.cell, max: r.max })});
export const KNIGHT_RELIEF_DATA = '${Buffer.from(r.data).toString('base64')}';
`;
}

async function readStudies(base) {
  const { launch } = await import('./cdp.mjs');
  const browser = await launch({ preset: 'gpu' });
  try {
    const page = await browser.newPage({ width: 400, height: 300 });
    await page.goto(`${base}/robots.txt`);
    const got = await page.eval(async () => {
      const read = async url => {
        const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
        const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight), x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data, g = new Uint8Array(c.width * c.height);
        for (let i = 0; i < g.length; i++) g[i] = d[4 * i];
        let s = '';
        for (let i = 0; i < g.length; i += 8192) s += String.fromCharCode(...g.subarray(i, i + 8192));
        return btoa(s);
      };
      return [await read('/static/site/scene/data/ink-figure-density.webp'), await read('/static/site/scene/data/ink-knight-density.webp')];
    });
    return got.map(b => new Uint8Array(Buffer.from(b, 'base64')));
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { values: o } = parseArgs({ options: { base: { type: 'string', default: 'http://127.0.0.1:8100' }, gray: { type: 'string' } } });
  const [figure, knight] = o.gray ? ['figure', 'knight'].map(n => new Uint8Array(fs.readFileSync(path.join(o.gray, `${n}.gray`)))) : await readStudies(o.base);
  const a = analyse(figure, knight);
  fs.writeFileSync(path.join(ROOT, 'static/site/scene/staunton-ink.js'), moduleSource(a));
  fs.writeFileSync(path.join(ROOT, 'static/site/scene/staunton-relief.js'), reliefSource(a.relief));
  console.log('detail', JSON.stringify(a.detail));
  for (const [k, v] of Object.entries(a.paths)) console.log(k, v.length, 'chars');
}
export { opticalDepth, runThrough, fillHoles, largest, morph, spriteX, spriteY, ROOT };
