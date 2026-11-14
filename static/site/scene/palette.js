// Science's palette: one set of colours for the Liquid Cosmos page (styles.json, styles/cosmos.css and
// the experiments read the same hexes), its sky (glsl/cosmos.js) and Science → Racing (the nebulae's
// lines in dew-plan.js and glsl/dew.js, so the stardust, the drops and the ice all inherit it).
//
// Narrowband astronomy maps emission lines to colours: the Hubble palette sends [S II], Hα and [O III]
// to red, green and blue, and the result is the familiar gold and teal. The nebulae here keep their real
// lines and structure (outer shocked gas in Hα, [N II], [S II]; inner hot gas in [O III]); only the
// mapping from line to colour is the palette's.
//
// Every colour is a display (sRGB) hex. The sky is drawn in display space; the nebulae are lit in linear
// light, so their colours are converted (linear) and normalised to a brightest channel of 1.

// Gold and teal on a navy night, as in Hubble's Pillars of Creation and Carina: warm dense gas, a cool
// haze. (Webb's copper and ice blue and the bicolour hydrogen–oxygen crimson and cyan were tried too.)
export const PALETTE = Object.freeze({
  name: 'Hubble', lines: 'Hα and [S II] to gold and amber, [O III] to teal',
  css: { bg: '#04080F', surface: '#0B1621', ink: '#EAF3F3', mute: '#95ABB2', accent: '#3FDCD2', accent2: '#F5B451', accent3: '#F1DCAE', soft: '#C2D4D6' },
  // The sky's cloud: thin haze (body), dense filaments (dense), the bright heart (core, its added
  // light at full density), the far cloud low on the left (far, its added light), dust lanes (dust,
  // what they multiply by).
  sky: { body: '#18677B', dense: '#D49846', core: '#4A3A26', far: '#1B4A50', dust: '#6E5A48' },
  stars: ['#C6DCFF', '#FFE4BE'],
  // What the chrome reflects: below the horizon, overhead, the bright cloud overhead, the rim light.
  env: { low: '#05080E', high: '#5AAEBC', top: '#FFDDA0', rim: '#7FF4EC' },
  // The chrome's thin-film fringe (an oxide's interference, as on anodised titanium), a cycle through these.
  film: ['#F6C46A', '#FFF1D2', '#56E0D6', '#3C8FC0'],
  glow: '#1C8C9C',
  // Ice where no nebula coloured it.
  frost: '#C4EEF0',
  neb: { ha: '#FFB547', s2: '#FF9A3C', o3: '#2FDED6', syn: '#8AD4F5', gold: '#FFC873', pink: '#FFB36B', blue: '#3FC6F0', violet: '#2FB7D9', green: '#66F0D4', yellow: '#FFDD8C', white: '#FFF5E4' },
  bolt: ['#7FE9FF', '#FFE3A6'],
});

// sRGB hex → display [0, 1]; display → linear; normalised so the brightest channel is 1.
export const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const toLinear = c => c.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const unit = c => { const m = Math.max(...c); return c.map(v => v / m); };
// The nebulae's line colours, linear, brightest channel 1 (dew-plan.js NEB_RGB).
export const lineRGB = (p = PALETTE) => Object.freeze(Object.fromEntries(Object.entries(p.neb).map(([k, h]) => [k, unit(toLinear(rgb(h)))])));

const f = x => Number(x).toFixed(5);
const v3 = c => `vec3(${c.map(f).join(', ')})`;
const d3 = h => v3(rgb(h));
// GLSL: the sky's colours (display space) and the instruments' (glsl/cosmos.js), the bolts' (linear).
export const paletteGLSL = (p = PALETTE) => `
const vec3 COS_BG = ${d3(p.css.bg)};
const vec3 COS_ACCENT = ${d3(p.css.accent)};
const vec3 COS_ACCENT2 = ${d3(p.css.accent2)};
const vec3 COS_GLOW = ${d3(p.glow)};
const vec3 SKY_BODY = ${d3(p.sky.body)}, SKY_DENSE = ${d3(p.sky.dense)}, SKY_CORE = ${d3(p.sky.core)}, SKY_FAR = ${d3(p.sky.far)}, SKY_DUST = ${d3(p.sky.dust)};
const vec3 STAR_COOL = ${d3(p.stars[0])}, STAR_WARM = ${d3(p.stars[1])};
const vec3 ENV_LOW = ${d3(p.env.low)}, ENV_HIGH = ${d3(p.env.high)}, ENV_TOP = ${d3(p.env.top)}, ENV_RIM = ${d3(p.env.rim)};
const vec3 FILM_0 = ${d3(p.film[0])}, FILM_1 = ${d3(p.film[1])}, FILM_2 = ${d3(p.film[2])}, FILM_3 = ${d3(p.film[3])};
const vec3 BOLT_A = ${v3(toLinear(rgb(p.bolt[0])))}, BOLT_B = ${v3(toLinear(rgb(p.bolt[1])))};
// The chrome's fringe: a smooth cycle through the palette's four film colours.
vec3 cosFilm(float x) {
  float t = fract(x) * 4.0, k = floor(t), u = smoothstep(0.0, 1.0, t - k);
  vec3 a = k < 1.0 ? FILM_0 : k < 2.0 ? FILM_1 : k < 3.0 ? FILM_2 : FILM_3;
  vec3 b = k < 1.0 ? FILM_1 : k < 2.0 ? FILM_2 : k < 3.0 ? FILM_3 : FILM_0;
  return mix(a, b, u);
}
`;
