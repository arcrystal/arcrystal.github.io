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
