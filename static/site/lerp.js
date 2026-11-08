// Motion and colour maths: pure functions shared by the homepage (home.js) and the Node tests
// (tools/site/tests/lerp.test.mjs). No DOM.
//
// approach() is the frame-rate independent chase every eased value uses (the crystal's fill, the
// scroll velocity the scene smears by). seamAt() places the boundary inside a seam between two
// bands. Colours mix in OKLab.

export const clamp01 = x => Math.max(0, Math.min(1, x));
export const smoothstep = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const easeInOutCubic = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// ---- Colour ----------------------------------------------------------------------------------

// '#RRGGBB' or '#RRGGBBAA' → [r, g, b, a] with channels 0..1.
export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex).trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
}

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// sRGB → OKLab (Björn Ottosson's matrices). → [L, a, b, alpha]
export function toOklab(hex) {
  const [r8, g8, b8, alpha] = parseHex(hex);
  const r = toLinear(r8), g = toLinear(g8), b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    alpha,
  ];
}

const fix = (x, d) => Number(x.toFixed(d));
export const oklabCss = ([L, a, b, alpha]) =>
  `oklab(${fix(L, 4)} ${fix(a, 4)} ${fix(b, 4)}${alpha < 1 ? ` / ${fix(alpha, 3)}` : ''})`;

// Two OKLab colours mixed by t → CSS.
export const mixOklab = (u, v, t) => oklabCss(u.map((x, i) => x + (v[i] - x) * clamp01(t)));

// ---- Motion --------------------------------------------------------------------------------

// Exponential approach of a value to its target: frame-rate independent.
export function approach(current, target, dt, tau) {
  if (!(tau > 0)) return target;
  const next = target + (current - target) * Math.exp(-dt / tau);
  return Math.abs(next - target) < 1e-4 ? target : next;
}

// Where the boundary sits inside a seam (0 = its top, 1 = its bottom) when the bands' meeting line
// is at h of the viewport (0 = top, 1 = bottom): centred, leaning against the scroll so the front
// sweeps as it passes (the next world gains ground as the line rises), and always inside the seam.
// Mirrors seamEdge() in scene/glsl/seams.js.
export const seamAt = h => 0.26 + 0.48 * clamp01(h);

// ---- Transits ----------------------------------------------------------------------------------
// Mirrors scene/glsl/flight.js: where a seam's front is, how far a point is through its flight, which
// rows of units can be in flight, and the shuffle that sends each unit to its landing cell.

// A seam's hold (home.js): PIN screens of scroll with the seam held full screen; the transit starts
// LEAD screens before the hold and ends LEAD after. holdAt gives, for a hold whose page top is T and
// whose length is H (CSS px, so H - vh of it is held), the strip's top on screen and the progress p.
export const HOLD = { pin: 1.75, lead: 0.35 };
export function holdAt(sy, T, H, vh) {
  const R = Math.max(1, H - vh), lead = HOLD.lead * vh;
  const y = sy < T ? T - sy : sy > T + R ? T + R - sy : 0;
  return { y, p: clamp01((sy - T + lead) / (R + 2 * lead)) };
}

// Mirrors scene/glsl/flight.js. A seam's progress p → P, past both ends so p = 0 and p = 1 are at rest.
export const transitP = p => -0.2 + 1.4 * clamp01(p);

// A point's flight from its arrival A (0..1, when the reach fills it) and its own lean jit (0..1):
// 0 = at home in the upper world, 1 = landed in the lower one.
export const flightAt = (A, P, jit = 0.5) => clamp01(0.5 + (P - A + (jit - 0.5) * 0.1) / 0.3);

// Where arrivals can fall at rn (0 at the strip's foot, 1 at its top): the branches grow out at
// 0.55 × (0.85..1.15) of rn, and the gaps fill up to 0.36 later, ±0.02 of noise.
export const arrivalRange = rn => [Math.max(0, 0.4675 * rn - 0.02), Math.min(1, 0.6325 * rn + 0.38)];

// The rows [from, to) of a grid (row 0 at the top) whose units can be in flight at P.
export function activeRows(P, rows, pad = 1) {
  // In flight: P - 0.2 < A < P + 0.2.
  const lo = (P - 0.6) / 0.6325, hi = (P + 0.22) / 0.4675;   // the range of rn
  return [Math.max(0, Math.floor((1 - hi) * rows) - pad), Math.min(rows, Math.ceil((1 - lo) * rows) + pad)];
}

// Within blocks of 12 columns, a cyclic shift by r (0..1, the row's hash): dir 1 gives where col's
// unit lands, dir -1 whose unit lands in col.
export function shiftCol(col, r, cols, dir) {
  const b0 = col - (col % 12);
  const len = Math.min(12, cols - b0);
  const k = Math.min(Math.floor(r * len), len - 1);
  const l = col - b0;
  return b0 + (dir > 0 ? (l + k) % len : (l + len - k) % len);
}

// ---- The processes' pure parts (mirrors of scene/glsl/flight.js and opens.js) ----------------------

// Outdoors: panes peel in a diagonal sweep from the strip's bottom-left (rn 0 at the foot, xn 0 at
// the left; jit 0..1 the pane's own beat).
export const paneArrival = (rn, xn, jit = 0.5) => 0.1 + 0.46 * clamp01(rn) + 0.16 * clamp01(xn) + (jit - 0.5) * 0.08;

// Photography: how open the iris is at seam progress p (1 wide open, 0 shut).
export function irisOpen(p) {
  const s = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  return p < 0.5 ? 1 - s(0.16, 0.46, p) : s(0.54, 0.84, p);
}

// Science: a Hilbert curve's index of block (x, y) on an n × n grid (n a power of two, y up), from
// (0, 0) to (n - 1, 0).
export function hilbertIndex(n, x, y) {
  let d = 0;
  for (let s = n >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = n - 1 - x; y = n - 1 - y; }
      [x, y] = [y, x];
    }
  }
  return d;
}

// About Me, Résumé, Contact: a maze carved by depth-first backtracking from start ([col, row]) over
// cols × rows cells, seeded. order: when each cell was first reached (0 the start); from: the side it
// was entered from (0 the start, 1 left, 2 right, 3 above, 4 below). A spanning tree: every cell is
// reached exactly once, through one opened wall.
export function carveMaze(cols, rows, start, seed = 1) {
  let a = seed >>> 0 || 1;
  const rand = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
  const N = cols * rows;
  const order = new Int32Array(N).fill(-1), from = new Uint8Array(N);
  const at = (c, r) => r * cols + c;
  // Neighbours: [dc, dr, the side the neighbour is entered from].
  const STEPS = [[-1, 0, 2], [1, 0, 1], [0, -1, 4], [0, 1, 3]];
  const stack = [start];
  let next = 0;
  order[at(start[0], start[1])] = next++;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const open = STEPS.filter(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc >= 0 && rr >= 0 && cc < cols && rr < rows && order[at(cc, rr)] < 0; });
    if (!open.length) { stack.pop(); continue; }
    const [dc, dr, side] = open[Math.floor(rand() * open.length)];
    const cc = c + dc, rr = r + dr;
    order[at(cc, rr)] = next++;
    from[at(cc, rr)] = side;
    stack.push([cc, rr]);
  }
  return { order, from };
}
