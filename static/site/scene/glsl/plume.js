// Photography → Chess's water and ink (glsl/unmix.js draws the transition; it reads these), and the click
// into Chess as it is drawn before the board's picture is in (pmcCover: ink blooming from the click, finding a
// board of squares; with the board in, glsl/unmix.js umClickCover cures the board itself instead).
//   uFlow: the ink as the screen sees it (unit 8: unmix.js UNMIX_SEEN), black R, white G, mipmapped.
export const PLUME_GLSL = /* glsl */ `
uniform sampler2D uFlow;
const vec3 PM_INK = vec3(.11, .102, .09), PM_PEARL = vec3(.984, .973, .945);
float pmS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }

// The lit water at z: white light from above, falling off into the deep and to its sides; faint shafts;
// motes hanging in it. lit: how far the white light has come on.
vec3 pmWater(vec2 z, vec2 h, float lit) {
  float down = clamp((z.y + h.y) / (2.0 * h.y), 0.0, 1.0);
  float pool = exp(-pow(length(vec2(z.x * .55, (z.y + h.y * 1.25) * .8)) / .95, 2.0));
  vec3 col = mix(vec3(.02, .022, .026), vec3(.5, .51, .53), pool * lit) * mix(1.0, .5, down * down);
  col += vec3(.035, .037, .04) * lit;
  float shaft = noise(vec2(z.x * 4.0 - z.y * .7, T * .04)) * noise(vec2(z.x * 9.0 - z.y * 1.6 + 5.0, T * .03));
  col *= 1.0 + .55 * lit * (shaft - .25) * (1.0 - down);
  vec2 g = z * 44.0 + vec2(T * .02, -T * .03), id = floor(g);
  float tw = hash(id);
  if (tw > .92) col += vec3(.55, .56, .58) * lit * exp(-pow(length(fract(g) - .5 - (hash2(id) - .5) * .6) / .07, 2.0)) * (.3 + .7 * pool) * (.5 + .5 * sin(T * 1.3 + tw * 40.0));
  return col;
}
// The ink as seen (uFlow), read smoothly between its texels: it is drawn at a fraction of the screen's
// pixels, and read linearly a few times its size each texel's own error shows as a dot (a cubic B-spline,
// in four bilinear reads, is as soft as the ink and has none).
vec2 pmSeen(vec2 uv) {
  vec2 n = vec2(textureSize(uFlow, 0)), p = uv * n - .5, f = fract(p), i = p - f, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i + w1 / g0 - .5) / n, b = (i + w3 / g1 + 1.5) / n;
  return g0.y * (g0.x * textureLod(uFlow, a, 0.0).rg + g1.x * textureLod(uFlow, vec2(b.x, a.y), 0.0).rg)
       + g1.y * (g0.x * textureLod(uFlow, vec2(a.x, b.y), 0.0).rg + g1.x * textureLod(uFlow, b, 0.0).rg);
}
// ---- A click into Chess (opens.js) ------------------------------------------------------------------
// The same story at the click, seen from above: black and white ink let fall there bloom out over the
// old page as one front, which rolls up into mushroom pairs as it goes (a ring of Lamb–Oseen vortices of
// alternating sign riding just behind it, each turning the water about it, the more the nearer its
// core: the material map undone, as PLUME_MAP does). The water is lit grey under it. Then order spreads
// out from the board's middle: the ink is gathered onto eight by eight squares, lines first and every
// other square filling, straightening as the stir dies, while the paper rises through the water. On the
// new page (pmcReveal) the squares soften and soak into it, from the middle out.
const int PMC_N = 10;
// The board: its middle (the click's, kept clear of the screen's edges and the header) and its square.
vec3 pmcBoard(vec2 O) {
  float c = clamp(min(R.x, R.y) * .085, 26.0, 64.0);
  vec2 lo = vec2(4.0 * c + 12.0, 4.0 * c + 76.0), hi = R - 4.0 * c - 12.0;
  return vec3(hi.x > lo.x ? clamp(O.x, lo.x, hi.x) : R.x * .5, hi.y > lo.y ? clamp(O.y, lo.y, hi.y) : R.y * .5, c);
}
// Where the ink at px lay when it fell: the vortices' turnings undone, the last first (the front's ring,
// then three of one sign about the middle, which turn the inside of the bloom slowly round). front: the
// bloom's radius now.
vec2 pmcTurn(vec2 x, vec2 c, float core, float G) {
  vec2 r = x - c;
  float s = max(dot(r, r) / (core * core), 1e-5);
  return c + rot(-G * (1.0 - exp(-s)) / s) * r;
}
vec2 pmcBack(vec2 px, vec2 O, float front, float E) {
  float spin = smoothstep(0.0, .5, E) * (1.0 - .5 * smoothstep(.6, 1.0, E));
  vec2 x = px;
  for (int k = 2; k >= 0; k--) {
    float a = float(k) * TAU / 3.0 + 1.1 + .6 * E;
    x = pmcTurn(x, O + vec2(cos(a), sin(a)) * front * .38, front * .3 + 8.0, 2.2 * spin);
  }
  for (int k = PMC_N - 1; k >= 0; k--) {
    float fk = float(k), h = hash(vec2(fk, 7.3));
    float a = (fk + .5 * h) * TAU / float(PMC_N) + .35 * E;
    vec2 c = O + vec2(cos(a), sin(a)) * front * (.84 + .1 * h);
    x = pmcTurn(x, c, front * (.09 + .05 * h) + 8.0, (mod(fk, 2.0) < .5 ? 1.0 : -1.0) * (2.4 + 1.6 * h) * spin);
  }
  return x;
}
// The click's ink at E (its clock, 0 … 1.04 over the old page; on, as the new page lets it go), and
// relax (0 … 1, the new page's own): its colour, and how much of the old page it covers.
vec4 pmcLook(vec2 px, vec2 O, float far, float E, float relax) {
  vec3 Bd = pmcBoard(O);
  vec2 C = Bd.xy;
  float c = Bd.z, front = far * (.04 + 1.02 * smoothstep(0.0, .62, E));
  vec2 X = pmcBack(px, O, front, E);
  float rX = length(X - O), dye = smoothstep(front + 5.0, front - 5.0, rX);
  float a = max(dye, smoothstep(.72, .96, E));
  // The bloom: billows of black and of white (warped fbm, in the ink's own place, so the turning folds
  // them into each other), thin sheets where they meet (ridged noise), thinner at its middle and pooled
  // at its front.
  vec2 wq = (X - O) * .0045;
  wq += (vec2(fbm3(wq * 1.6 + 2.0), fbm3(wq * 1.6 + 7.3)) - .5) * 1.6;
  float white = smoothstep(.42, .58, fbm3(wq + 11.0)), billow = smoothstep(.3, .75, fbm3(wq * 1.8 + 4.0));
  float sheet = pow(1.0 - abs(2.0 * noise(wq * 7.0) - 1.0), 10.0);
  float dens = dye * ((.2 + .9 * billow + .25 * sheet) * (.45 + .55 * smoothstep(.1, 1.0, rX / max(front, 1.0))) + 1.3 * exp(-pow((rX - front * .94) / (front * .05 + 3.0), 2.0)));
  // Order, from the board's middle out; then (relax) its letting go, likewise.
  float d = clamp(length(px - C) / far, 0.0, 1.0), to = .4 + .3 * d, k = smoothstep(to, to + .3, E);
  float gone = smoothstep(.05 + .4 * d, .5 + .4 * d, relax), soft = relax * relax;
  vec2 b = (px - C) / c + 4.0, bs = b + (X - px) / c * .3 * (1.0 - k);
  float Bo = .1 * (.6 + .8 * noise(px * .01)) * (1.0 - gone), Wo = 0.0;
  if (all(greaterThan(bs, vec2(-.3))) && all(lessThan(bs, vec2(8.3)))) {
    vec2 fr = fract(bs), cell = floor(bs);
    bool on = all(greaterThan(bs, vec2(0.0))) && all(lessThan(bs, vec2(8.0)));
    float e = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
    float lat = smoothstep(to - .06, to + .12, E), fill = smoothstep(to + .06, to + .3, E);
    float ow = pow(cos(PI * bs.x) * cos(PI * bs.y), 2.0);
    float thread = exp(-pow(e * c / mix(1.4, 3.0, lat) / (1.0 + 4.0 * soft), 2.0)) * (.55 + .7 * ow) * lat * (1.0 - fill);
    float dark = mod(cell.x + cell.y, 2.0), w = .06 + .3 * soft;
    float fills = dark * smoothstep(-w, w, fill * .62 - e + (noise(bs * 5.0 + 3.0) - .5) * .3 * (1.0 - k));
    float df = abs(max(abs(bs.x - 4.0), abs(bs.y - 4.0)) - 4.0) * c;
    float frame = smoothstep(c * .05 * (1.0 + 6.0 * soft), c * .02, df) * fill;
    if (on) { Bo += (thread * 1.6 + fills * 1.5) * (1.0 - gone); Wo = (1.0 - dark) * fill * .5 * (1.0 - gone); }
    Bo += frame * 2.2 * (1.0 - gone);
  }
  float Bk = mix(dens * (1.0 - white) * 1.7, Bo, k), Wt = mix(dens * white * 1.5, Wo, k);
  // Under it the lit water, and the paper rising through it.
  float m = min(R.x, R.y);
  vec3 col = mix(pmWater((px - R * .5) / m, R * .5 / m, 1.0), sceneOf(1, px), smoothstep(to + .1, to + .45, E));
  col = col * exp(-Bk) + PM_INK * .4 * (1.0 - exp(-Bk));
  col = col * exp(-.4 * Wt) + PM_PEARL * (1.0 - exp(-Wt));
  return vec4(col, a);
}
vec4 pmcCover(vec2 px, vec2 O, float far, float E) { vec4 l = pmcLook(px, O, far, E, 0.0); return vec4(l.rgb * l.a, l.a); }
vec3 pmcReveal(vec2 px, vec2 O, float far, float e) { return pmcLook(px, O, far, 1.04 + .3 * e, e).rgb; }
`;
