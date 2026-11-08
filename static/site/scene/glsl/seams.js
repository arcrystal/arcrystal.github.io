// Seams: where two bands of the homepage meet, the scene draws a strip of the screen (uRegion)
// across their boundary: the upper world above an edge, the lower one below it, the edge in each
// pair's own manner. uH is where the meeting line is on the screen (0 top, 1 bottom); the edge
// leans with it, so it sweeps as the page scrolls (seamAt in lerp.js). Near the strip's own edges
// the effects fade, so the strip joins the bands on either side without a line.
export const SEAMS = /* glsl */ `
vec3 sceneOf(int s, vec2 px) {
  if (s == 0) return sceneHouse(px);
  if (s == 1) return sceneInk(px);
  if (s == 2) return sceneGlacier(px);
  if (s == 3) return sceneCosmos(px);
  if (s == 4) return sceneFolio(px);
  return sceneDarkroom(px);
}

float seamEdge() { return 0.26 + 0.48 * clamp(uH, 0.0, 1.0); }

// House → Cosmos. The paper ends in a meniscus of liquid chrome; drops swell from it and fall into
// space, reflecting the nebula they fall through.
vec3 seamChromeDrop(vec2 px, float s, float env) {
  float g = s + 9.0 * sin(px.x * 0.011 + T * 0.8) * env;
  float m = abs(g) - 7.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float cx = R.x * (fi + 0.5) / 6.0 + (hash(vec2(fi, 2.0)) - 0.5) * 120.0;
    float cycle = fract(T * (0.05 + 0.03 * hash(vec2(fi, 5.0))) + hash(vec2(fi, 9.0)));
    float r = (14.0 + 24.0 * hash(vec2(fi, 7.0))) * (0.6 + 0.4 * sin(cycle * PI));
    float fall = cycle * cycle * uRegion.w * 0.42;
    m = smin(m, length(px - vec2(cx, px.y - g + r + 6.0 + fall)) - r, 22.0);
  }
  m = mix(abs(g) - 1.0, m, env);
  vec3 col = g < 0.0 ? sceneHouse(px) : sceneCosmos(px);
  float metal = smoothstep(1.2, -1.2, m);
  if (metal > 0.0) {
    // A dome over each drop and along the meniscus, tilted up so the flat tops mirror the nebula.
    float hgt = sqrt(clamp(-m / 14.0, 0.0, 1.0));
    vec3 n = normalize(vec3(-vec2(dFdx(hgt), dFdy(hgt)) * 22.0, 1.0) + vec3(0.0, -0.5, 0.0));
    col = mix(col, cosmosMetal(n), metal);
  }
  col *= 1.0 - 0.18 * exp(-max(-g, 0.0) / 18.0) * env * (1.0 - metal);
  return col;
}

// Cosmos → Glacier. The liquid freezes: a front of crystal lattice, a bright rim with a chromatic
// fringe; ahead of it the space cools to ice blue.
vec3 seamFreeze(vec2 px, float s, float env) {
  vec4 v = voronoi(px * 0.022);
  float lattice = smoothstep(0.09, 0.0, v.y - v.x);
  float g = s + (fbm3(px * 0.004 + 2.0) - 0.5) * 70.0 * env + lattice * 8.0 * env * smoothstep(40.0, 0.0, abs(s));
  vec3 col;
  if (g < 0.0) {
    col = sceneCosmos(px);
    col = mix(col, mix(vec3(luma(col)), vec3(0.74, 0.86, 0.96), 0.6), smoothstep(-90.0, 0.0, g) * 0.55 * env);
  } else col = sceneGlacier(px);
  col += vec3(0.86, 0.95, 1.0) * (exp(-abs(g) / 1.6) * 0.85 + lattice * exp(-abs(g) / 18.0) * 0.4) * env;
  col += (vec3(1.0, 0.3, 0.55) * exp(-abs(g - 3.0) / 1.2) * 0.2 + vec3(0.15, 0.65, 1.0) * exp(-abs(g + 3.0) / 1.2) * 0.25) * env;
  return col;
}

// Glacier → Folio. The ice melts off in drips, uncovering the engraved forest; each drip catches the
// lantern below it.
vec3 seamMelt(vec2 px, float s, float env) {
  float drip = 60.0 * pow(noise(vec2(px.x * 0.028, 3.0)), 4.0) + 12.0 * noise(vec2(px.x * 0.11, 7.0));
  float g = s - drip * env;
  vec3 col = g < 0.0 ? sceneGlacier(px) : sceneFolio(px);
  col += vec3(0.9, 0.97, 1.0) * exp(-abs(g) / 1.4) * 0.7 * env;
  col += EMBER * exp(-max(g, 0.0) / 26.0) * step(0.0, g) * 0.22 * env;
  return col;
}

// Folio → Darkroom. The lantern gutters: the warm light along the edge turns to safelight red.
vec3 seamLantern(vec2 px, float s, float env) {
  float g = s + (fbm3(px * 0.005 + vec2(T * 0.02, 0.0)) - 0.5) * 90.0 * env;
  float m = smoothstep(-14.0, 14.0, g);
  vec3 col = mix(sceneFolio(px), sceneDarkroom(px), m);
  float flick = 0.85 + 0.15 * sin(T * 9.0 + px.x * 0.02) * sin(T * 5.3);
  col += mix(EMBER, DR_RED, smoothstep(-30.0, 30.0, g)) * exp(-abs(g) / 34.0) * 0.5 * env * flick;
  return col;
}

// Darkroom → Ink. The developer clears into wash: the ink side darkens at its wet edge and
// granulates; the tray's red lingers in the dark side.
vec3 seamDeveloper(vec2 px, float s, float env) {
  float g = s + (fbm(px * 0.006 + vec2(0.0, T * 0.02)) - 0.5) * 110.0 * env;
  vec3 col;
  if (g < 0.0) {
    col = sceneDarkroom(px) + DR_RED * exp(g / 40.0) * 0.18 * env;
  } else {
    col = sceneInk(px);
    float wet = exp(-g / 16.0) * env;
    float gran = 0.75 + 0.5 * noise(px * 0.35);
    col = mix(col, INK_BLACK, clamp(wet * 0.85 * gran + exp(-g / 70.0) * 0.25 * env, 0.0, 0.92));
  }
  return col;
}

vec3 seam(int a, int b, vec2 px) {
  gCardMix = 0.0;
  float t = (px.y - uRegion.y) / max(uRegion.w, 1.0);
  float env = smoothstep(0.0, 0.2, t) * smoothstep(1.0, 0.8, t);
  float s = (t - seamEdge()) * uRegion.w;   // CSS px below the edge (negative above it)
  if (a == 0 && b == 3) return seamChromeDrop(px, s, env);
  if (a == 3 && b == 2) return seamFreeze(px, s, env);
  if (a == 2 && b == 4) return seamMelt(px, s, env);
  if (a == 4 && b == 5) return seamLantern(px, s, env);
  if (a == 5 && b == 1) return seamDeveloper(px, s, env);
  float g = s + (fbm3(px * 0.005) - 0.5) * 80.0 * env;
  return mix(sceneOf(a, px), sceneOf(b, px), smoothstep(-10.0, 10.0, g));
}
`;
