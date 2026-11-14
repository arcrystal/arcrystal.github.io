// Science's supergiants: a dozen massive stars in the Liquid Cosmos's sky (glsl/cosmos.js draws them;
// the Science → Racing plan, dew-plan.js, makes them explode). Fixed places as fractions of the view,
// clear of the chrome drops; the first eight are the narrow screens' set.
//
// Their colour is a black body's: Planck's law integrated against the CIE 1931 colour-matching
// functions (the multi-lobe fit of Wyman, Sloan & Shirley 2013), to XYZ, to linear sRGB, normalised.
// Emission lines (the nebulae's) go through the same functions, one wavelength each.

// [x, y] as fractions of the view, effective temperature (K), luminosity (relative), core size (px).
export const GIANTS = Object.freeze([
  [0.07, 0.15, 3500, 1.0, 2.2], [0.24, 0.31, 21000, 0.9, 1.9], [0.43, 0.12, 4000, 0.8, 2.0], [0.53, 0.37, 15000, 0.85, 1.8],
  [0.47, 0.8, 3600, 1.0, 2.3], [0.29, 0.62, 25000, 0.95, 1.9], [0.84, 0.57, 3400, 1.0, 2.4], [0.69, 0.11, 30000, 0.9, 1.8],
  [0.13, 0.5, 9000, 0.7, 1.6], [0.96, 0.44, 18000, 0.75, 1.7], [0.65, 0.88, 6000, 0.7, 1.7], [0.37, 0.93, 4200, 0.75, 1.9],
  [0.22, 0.84, 3800, 0.8, 2.0], [0.88, 0.94, 12000, 0.7, 1.6],
].map(([x, y, T, L, s]) => Object.freeze({ x, y, T, L, s })));
// How many a view of this width shows.
export const giantCount = W => (W < 700 ? 8 : GIANTS.length);

// CIE 1931 2° colour matching functions, Wyman–Sloan–Shirley piecewise-Gaussian fit.
const g = (l, m, s1, s2) => { const t = (l - m) / (l < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
export const cmf = l => [
  1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
  0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
  1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
];
export const toSRGB = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
const norm = c => { const m = Math.max(...c.map(v => Math.max(v, 0))); return c.map(v => Math.max(v, 0) / m); };
// Planck spectral radiance (per nm), up to a constant: λ⁻⁵ / (exp(hc/λkT) − 1), hc/k = 1.4388e7 nm·K.
export const planck = (l, T) => 1 / (l ** 5 * (Math.exp(1.4388e7 / (l * T)) - 1));
// A black body's colour, linear sRGB with its brightest channel 1.
export function blackbody(T) {
  const xyz = [0, 0, 0];
  for (let l = 380; l <= 780; l += 2) { const b = planck(l, T), c = cmf(l); for (let k = 0; k < 3; k++) xyz[k] += b * c[k]; }
  return norm(toSRGB(xyz));
}
// A single emission line's colour (out of gamut lines clipped, then normalised).
export const lineColour = l => norm(toSRGB(cmf(l)));
// The supernova remnants' lines: Hα 656.3, [N II] 658.4, [S II] 671.6/673.1 (the outer, cooler, shocked
// gas) and [O III] 495.9/500.7 (the inner, hotter), weighted by typical relative strengths.
export const REMNANT_LINES = Object.freeze({
  outer: [[656.3, 1.0], [658.4, 0.6], [671.6, 0.35], [673.1, 0.3]],
  inner: [[500.7, 1.0], [495.9, 0.33]],
});
export function blend(lines) {
  const c = [0, 0, 0];
  for (const [l, w] of lines) { const k = lineColour(l); for (let i = 0; i < 3; i++) c[i] += k[i] * w; }
  return norm(c);
}

const f = x => Number(x).toFixed(5);
const v3 = c => `vec3(${c.map(f).join(', ')})`;
// GLSL: positions, sizes, colours; the remnants' two line colours.
export const GIANTS_GLSL = `
const int GIANT_N = ${GIANTS.length};
const vec4 GIANT_POS[${GIANTS.length}] = vec4[${GIANTS.length}](${GIANTS.map(s => `vec4(${f(s.x)}, ${f(s.y)}, ${f(s.L)}, ${f(s.s)})`).join(', ')});
const vec3 GIANT_COL[${GIANTS.length}] = vec3[${GIANTS.length}](${GIANTS.map(s => v3(blackbody(s.T))).join(', ')});
const vec3 NEB_OUTER = ${v3(blend(REMNANT_LINES.outer))};
const vec3 NEB_INNER = ${v3(blend(REMNANT_LINES.inner))};
`;
