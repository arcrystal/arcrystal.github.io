// The stage's motion maths: pure functions shared by the homepage (tiles.js) and the Node tests
// (tools/site/tests/lerp.test.mjs). No DOM.
//
// Scrolling sets a target position p; the visible position chases it (approach), which is what makes
// the stage glide instead of step. Each tile holds its style for HOLD of its segment, and the
// handoff to the next style runs in between; the outgoing title leaves over the first part of the
// handoff and the incoming one arrives over the last part, overlapping in the middle so the screen
// is never empty. The header and rail inks mix in OKLab.

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

// ---- The stage -------------------------------------------------------------------------------

// Fraction of each segment a tile holds its style before the handoff starts (split between the
// two ends), and the scroll length of a segment in viewport heights.
export const HOLD = 0.45;
export const SEGMENT = 1.5;

// frac: 0..1 from one tile to the next → handoff 0..1, flat at both ends.
export function handoff(frac, hold = HOLD) {
  return smoothstep((frac - hold / 2) / (1 - hold));
}

// Continuous position p over a sequence of n styles → the pair in view and the fraction between.
export function pairAt(p, n) {
  const x = Math.max(0, Math.min(n - 1, p));
  const i = Math.min(n - 2, Math.floor(x));
  return { i, j: i + 1, frac: x - i };
}

// The outgoing title leaves over [0, OUT_END] of the handoff; the incoming one arrives over
// [IN_START, 1]. They overlap, so some letters are always on screen.
export const OUT_END = 0.6;
export const IN_START = 0.3;
export const exitOf = h => clamp01(h / OUT_END);
export const enterOf = h => clamp01((h - IN_START) / (1 - IN_START));

// Exponential approach of the visible position to the target: frame-rate independent.
export function approach(current, target, dt, tau) {
  if (!(tau > 0)) return target;
  const next = target + (current - target) * Math.exp(-dt / tau);
  return Math.abs(next - target) < 1e-4 ? target : next;
}

// After scrolling stops inside a handoff, the stage glides to the nearer tile. In the entry (the
// dive from the hero, p in (-1, 0)) it glides on to the first tile once past most of the way.
// Returns the tile index, or null to stay put.
export function settleTarget(p, n) {
  if (p <= -1 || p >= n - 1 + 1e-3) return null;
  if (p < 0) return p > -0.55 && p < -0.02 ? 0 : null;
  const k = Math.floor(p), frac = p - k;
  const edge = HOLD / 2;
  if (frac <= edge + 0.02 || frac >= 1 - edge - 0.02) return null;
  return frac < 0.5 ? k : k + 1;
}

// A jump (rail, hero index, keyboard focus) glides through the handoffs in between.
export const glideMs = tiles => Math.min(1400, 450 + 250 * Math.abs(tiles));
