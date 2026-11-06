// The style blend: pure functions that turn two styles of static/site/styles.json and a mix t into
// the custom properties the homepage writes while it scrolls. Colours mix in OKLab, so a blend
// from lacquer black to ice white passes through clean greys instead of muddy browns. No DOM:
// the homepage and the Node tests (tools/site/tests/lerp.test.mjs) share it.

export const clamp01 = x => Math.max(0, Math.min(1, x));
export const smoothstep = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

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

const mix = (x, y, t) => x + (y - x) * t;
const mixVec = (u, v, t) => u.map((x, i) => mix(x, v[i], t));

// Colour tokens (custom property → path in a style) and numeric panel tokens.
export const COLORS = {
  '--l-bg': 'colors.bg', '--l-surface': 'colors.surface', '--l-ink': 'colors.ink', '--l-mute': 'colors.mute',
  '--l-accent': 'colors.accent', '--l-accent-2': 'colors.accent2', '--l-rule': 'colors.rule',
  '--p-bg': 'panel.bg', '--p-ink': 'panel.ink', '--p-mute': 'panel.mute',
  '--p-border': 'panel.border', '--p-outline': 'panel.outline', '--p-shadow-color': 'panel.shadowColor',
};
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

// A style compiled once: OKLab colours and the panel numbers as flat arrays.
export function compile(style) {
  const colors = {};
  for (const [prop, path] of Object.entries(COLORS)) colors[prop] = toOklab(get(style, path));
  const p = style.panel;
  return {
    colors,
    radii: [...p.rh, ...p.rv],
    shadow: [...p.shadow],
    scalars: [p.borderW, p.outlineW, p.outlineOff, p.blur, p.rot],
  };
}

// Blend of two compiled styles → { '--prop': 'css value' }.
export function blend(a, b, t) {
  t = clamp01(t);
  const out = {};
  for (const prop of Object.keys(COLORS)) out[prop] = oklabCss(mixVec(a.colors[prop], b.colors[prop], t));
  const r = mixVec(a.radii, b.radii, t).map(v => `${fix(v, 2)}%`);
  out['--p-radius'] = `${r.slice(0, 4).join(' ')} / ${r.slice(4).join(' ')}`;
  const [sx, sy, sb, ss] = mixVec(a.shadow, b.shadow, t).map(v => fix(v, 1));
  out['--p-shadow'] = `${sx}px ${sy}px ${sb}px ${ss}px`;
  const [bw, ow, oo, blur, rot] = mixVec(a.scalars, b.scalars, t);
  out['--p-border-w'] = `${fix(bw, 2)}px`;
  out['--p-outline-w'] = `${fix(ow, 2)}px`;
  out['--p-outline-off'] = `${fix(oo, 1)}px`;
  out['--p-blur'] = `${fix(blur, 1)}px`;
  out['--p-rot'] = `${fix(rot, 2)}deg`;
  return out;
}

// Each tile holds its own style for `hold` of its scroll; the change happens in between.
// frac: 0..1 from one tile to the next → mix 0..1.
export function holdEase(frac, hold = 0.6) {
  const edge = hold / 2;
  return smoothstep((frac - edge) / (1 - hold));
}

// Continuous position p over a sequence of n styles → the pair to blend and the mix.
export function pairAt(p, n) {
  const x = Math.max(0, Math.min(n - 1, p));
  const i = Math.min(n - 2, Math.floor(x));
  return { i, j: i + 1, frac: x - i };
}

// Crossfade of the two tiles in view: the outgoing one fades out over the first half of the mix,
// the incoming one in over the second, so two sets of text never overlap.
export function crossfade(t) {
  return { out: 1 - smoothstep(t * 2), in: smoothstep(t * 2 - 1) };
}
