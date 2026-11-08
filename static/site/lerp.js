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
// Mirrors scene/glsl/flight.js: a seam's hold, where its front is and how far a point is through its
// flight.

// A seam's hold (home.js): PIN screens of scroll with the seam held full screen. Its transit is
// drawn as if it were already held, on the whole screen; the strip's real place only reveals it. So
// it begins LEAD_IN screens before the hold, as soon as the strip's top comes on screen under the
// band above (the transit grows from the foot of the screen, right there), and ends LEAD_OUT after,
// as the next band's heading arrives. holdAt gives, for a hold whose page top is T and whose length
// is H (CSS px, so H - vh of it is held), the strip's top on screen and the progress p.
// pinTouch: phones and touch screens, where a long hold costs more thumb. by: a style's own (pin: a
// scale on the pin; leadIn, leadOut).
export const HOLD = {
  pin: 1.75, pinTouch: 0.9, leadIn: 0.95, leadOut: 0.2,
  by: { cosmos: { pin: 1.6 }, glass: { leadOut: 0.06 }, folio: { pin: 1.25, leadOut: 0.06 }, darkroom: { pin: 1.25, leadOut: 0.06 }, ink: { pin: 1.2 } },
};
export const holdFor = style => ({ pin: 1, leadIn: HOLD.leadIn, leadOut: HOLD.leadOut, ...HOLD.by[style] });
export function holdAt(sy, T, H, vh, leadIn = HOLD.leadIn, leadOut = HOLD.leadOut) {
  const R = Math.max(1, H - vh), a = leadIn * vh, b = leadOut * vh;
  const y = sy < T ? T - sy : sy > T + R ? T + R - sy : 0;
  return { y, p: clamp01((sy - T + a) / (R + a + b)) };
}
// Every transit starts slowly, giving time at the foot of the band above: the progress it plays at.
export const holdEase = p => clamp01(p) ** 1.35;

// Mirrors scene/glsl/flight.js. A seam's progress p → P, past both ends so p = 0 and p = 1 are at rest.
export const transitP = p => -0.2 + 1.4 * clamp01(p);

// A point's flight from its arrival A (0..1, when the reach fills it) and its own lean jit (0..1):
// 0 = at home in the upper world, 1 = landed in the lower one.
export const flightAt = (A, P, jit = 0.5) => clamp01(0.5 + (P - A + (jit - 0.5) * 0.1) / 0.3);

// Where arrivals can fall at rn (0 at the strip's foot, 1 at its top): the branches grow out at
// 0.55 × (0.85..1.15) of rn, and the gaps fill up to 0.36 later, ±0.02 of noise.
export const arrivalRange = rn => [Math.max(0, 0.4675 * rn - 0.02), Math.min(1, 0.6325 * rn + 0.38)];

// ---- The processes' pure parts (mirrors of scene/glsl/flight.js and opens.js) ----------------------

// Outdoors: three layers of sheets (flight.js layerA): when a sheet of layer k centred at rn (0 at the
// foot of the screen) and xn (0 at the left) is mid-peel; jit 0..1 its own beat.
export const layerArrival = (k, rn, xn, jit = 0.5) => 0.04 + 0.31 * clamp01(rn) + 0.1 * clamp01(xn) + (jit - 0.5) * 0.12 + 0.26 * k;

// Photography: film (flight.js filmA, filmU, filmNeg): when a strip at rn is pulled; how far its pull
// has gone at P; how far it has turned to a negative.
export const filmArrival = (rn, jit = 0.5) => 0.1 + 0.74 * clamp01(rn) + (jit - 0.5) * 0.04;
export const filmU = (A, P) => clamp01((P - A + 0.2) / 0.5);
export const filmNeg = (A, P) => smoothstep((P - A + 0.28) / 0.08);

// Science: a vortex (flight.js) standing up the middle of the screen, its flow running up the axis.
// A seam's cube leaves its cell and lands mirrored across the axis, vortexDrop(rows) rows higher
// (thrown out over the top, for the top rows; the bottom rows are filled from below the screen).
// vortexSeamA: when a cube is at the core (home in CSS px, size the screen's); vortexU its flight at
// P; coreEase eases through the core; vortexAt where it is (x across, y down, z toward the viewer).
export const VORTEX = { spin: 2.5, sink: 6, d: 0.5, drop: 0.38, tilt: 0.42, climb: 0.5, lead: 0.3 };
// The wind's clock by height (flight.js): when it starts to blow at up (0 the foot), and when it dies.
export const vortexWindOn = up => -0.2 + VORTEX.climb * up;
export const vortexWindOff = up => vortexWindOn(up - VORTEX.drop) + VORTEX.lead + VORTEX.d + 0.09;
export const vortexDrop = rows => Math.floor(rows * VORTEX.drop + 0.5);
export function vortexSeamA([hx, hy], [W, H], jit = 0.5) {
  const up = 1 - hy / H, rn = Math.abs(hx / W - 0.5) * 2;
  const A = vortexWindOn(up) + VORTEX.lead + 0.5 * VORTEX.d + 0.03 * Math.min(rn, 1) + (jit - 0.5) * 0.06;
  return Math.min(Math.max(A, -0.2 + 0.5 * VORTEX.d), 1.2 - 0.5 * VORTEX.d);
}
// A cube's own pace through the vortex: a warp of u (a within ±0.7) that leaves both ends in place.
export const vortexPace = (u, a) => u + a * u * (1 - u);
export const vortexU = (A, P) => clamp01(0.5 + (P - A) / VORTEX.d);
export const coreEase = (u, K) => (u * (1 + 0.5 * K) - K * Math.sin(2 * Math.PI * u) / (4 * Math.PI)) / (1 + 0.5 * K);
export const vortexTurn = u => coreEase(u, VORTEX.spin);
export function vortexAt([hx, hy], drop, ax, rc, turns, u, phase = 0) {
  const r0 = hx - ax, k = smoothstep(Math.sin(Math.PI * u));
  const r = r0 + (Math.sign(r0) * Math.min(Math.abs(r0), rc) - r0) * k ** 1.7;
  const th = turns * Math.PI * vortexTurn(u) + phase * Math.sin(Math.PI * u) ** 2, tilt = VORTEX.tilt * smoothstep(k / 0.4);
  const X = r * Math.cos(th), Z = r * Math.sin(th) * 0.75;
  return [ax + X, hy + drop * coreEase(u, VORTEX.sink) + Z * Math.sin(tilt), Z * Math.cos(tilt)];
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
