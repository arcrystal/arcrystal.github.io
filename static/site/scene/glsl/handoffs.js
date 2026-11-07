// The handoffs between neighbouring rooms, scrubbed by scroll (h: 0..1). Each is a moving boundary
// between two complete worlds with an edge of its own; scrolling back plays it in reverse.
export const HANDOFFS = /* glsl */ `
vec3 sceneOf(int s, vec2 px) {
  if (s == 0) return sceneHouse(px);
  return sceneRoom(s - 1, px);
}

// Ink → Glacier. A frost front of crystal lattice grows up from the bottom; ahead of it the ink
// cools, behind it caustics shine; a bright rim with a chromatic fringe rides the front.
vec3 thaw(vec2 px, float h) {
  vec2 uv = px / R;
  float F = mix(-0.25, 1.3, h);
  vec4 v = voronoi(px * 0.022);
  float lattice = smoothstep(0.09, 0.0, v.y - v.x);
  float y = (1.0 - uv.y) + 0.17 * (fbm3(px * 0.0028 + 2.0) - 0.5);
  float s = F - y;
  s += 0.035 * lattice * smoothstep(0.1, 0.0, abs(s));
  float m = smoothstep(-0.004, 0.004, s);
  vec3 col = vec3(0.0);
  if (m < 0.999) {
    vec3 a = sceneInk(px);
    float cool = smoothstep(0.32, 0.0, -s) * smoothstep(0.0, 0.12, h);
    a = mix(a, mix(vec3(luma(a)), vec3(0.74, 0.85, 0.95), 0.55), cool * 0.6);
    col = a * (1.0 - m);
  }
  if (m > 0.001) col += sceneGlacier(px) * m;
  col += vec3(0.86, 0.95, 1.0) * (exp(-abs(s) * 240.0) * 0.85 + lattice * exp(-abs(s) * 16.0) * 0.45);
  col += vec3(1.0, 0.3, 0.55) * exp(-abs(s - 0.007) * 420.0) * 0.2 + vec3(0.15, 0.65, 1.0) * exp(-abs(s + 0.007) * 420.0) * 0.25;
  return col;
}

// Glacier → Signal. A crack starts at the card; shards refract and drift, then flip to the signal
// in order of distance, each with a cyan flash.
vec3 shatter(vec2 px, float h) {
  vec2 O = uCard.z > 0.0 ? uCard.xy + uCard.zw * 0.5 : R * vec2(0.62, 0.5);
  float sc = 5.5 / R.y;
  vec4 v = voronoi(px * sc);
  vec2 ctr = v.zw / sc;
  float dn = length(ctr - O) / length(R);
  float tc = 0.14 + 0.62 * dn + 0.1 * hash(v.zw);
  float lc = clamp((h - tc) / 0.1, 0.0, 1.0);
  float crack = smoothstep(dn * 0.85, dn * 0.85 + 0.06, h * 1.35);
  float edge = smoothstep(0.07, 0.0, v.y - v.x);
  vec3 col;
  if (lc < 0.5) {
    vec2 drift = (ctr - O) * 0.07 * crack + (hash2(v.zw) - 0.5) * 18.0 * crack;
    gCardMix = uCardMix * (1.0 - crack);
    col = sceneGlacier(px - drift);
    gCardMix = uCardMix;
    col = mix(col, col * 0.82 + vec3(0.02, 0.05, 0.09), crack * 0.5);
    col += vec3(0.9, 1.0, 1.0) * edge * crack * 0.9;
  } else {
    col = sceneSignal(px);
    col += SIG_CYAN * edge * (1.0 - smoothstep(0.5, 1.0, lc)) * 0.9;
  }
  float flash = 1.0 - abs(lc * 2.0 - 1.0);
  col += SIG_CYAN * flash * 0.5 + pow(flash, 6.0) * 0.45;
  col.r += SIG_MAG.r * edge * flash * 0.4;
  return col;
}

// Signal → Folio. The screen collapses to one glowing line (a CRT switching off); the line warms
// from cyan to brass and becomes the gutter of a book that opens up and down onto the forest.
vec3 powerDown(vec2 px, float h) {
  float cy = R.y * 0.5;
  float dy = px.y - cy;
  float s = 1.0 - smoothstep(0.0, 0.46, h);
  float o = smoothstep(0.5, 1.0, h);
  vec3 col = vec3(0.0);
  if (s > 0.002 && abs(dy) < s * R.y * 0.5) {
    col = sceneSignal(vec2(px.x, cy + dy / s)) * (1.0 + (1.0 - s) * 1.6);
  }
  float openH = o * R.y * 0.5;
  if (o > 0.0 && abs(dy) < openH + 1.0) {
    gGrow = 0.3 + 0.7 * o;
    vec3 b = sceneFolio(px);
    gGrow = 1.0;
    b *= 0.5 + 0.5 * smoothstep(0.0, 70.0 * o + 1.0, abs(dy));
    b *= 0.75 + 0.25 * smoothstep(openH, openH - 50.0, abs(dy));
    col = mix(col, b, smoothstep(openH + 1.0, openH - 1.0, abs(dy)));
  }
  float lineW = 1.2 + 34.0 * s * s + 5.0 * o;
  float line = exp(-abs(dy) / lineW) * smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.82, 1.0, h));
  float lineX = smoothstep(0.0, 0.25, 1.0 - abs(px.x / R.x - 0.5) * 2.0 * (1.0 - 0.5 * (1.0 - s)));
  vec3 lc = mix(SIG_CYAN, BRASS, smoothstep(0.32, 0.6, h));
  col += lc * line * lineX * 1.2;
  return col;
}

// Folio → Chrome. Molten brass drips down from the top and swallows the forest, turning to chrome
// behind its front; then it thins into drops that part onto the pearl.
vec3 giltMelt(vec2 px, float h) {
  vec2 uv = px / R;
  float F = mix(-0.4, 1.95, h);
  float drip = 0.17 * pow(noise(vec2(px.x * 0.011, 3.0)), 3.0) + 0.05 * noise(vec2(px.x * 0.043, 7.0));
  float d = F + drip - uv.y;
  float band = 0.34;
  float holes = fbm3(px * 0.0055 + vec2(0.0, T * 0.05)) + (d - band) * 2.4;
  float showB = smoothstep(0.62, 0.72, holes) * step(0.0, d);
  float metal = smoothstep(-0.003, 0.003, d) * (1.0 - showB);
  float hgt = smoothstep(0.0, 0.05, d) * (1.0 - smoothstep(0.55, 0.72, holes));
  vec3 n = normalize(vec3(-vec2(dFdx(hgt), dFdy(hgt)) * 46.0, 1.0));
  vec3 env = chromeEnv(reflect(vec3(0.0, 0.0, -1.0), n));
  vec3 brass = env * mix(BRASS, vec3(1.0, 0.9, 0.66), 0.35) * 1.25;
  vec3 metalCol = mix(brass, env + spectrum(n.x * 0.6 + d) * 0.08, smoothstep(0.02, band, d));
  vec3 col = vec3(0.0);
  float a = 1.0 - metal - showB;
  if (a > 0.001) col += sceneFolio(px) * a;
  if (showB > 0.001) col += sceneChrome(px) * showB;
  col += metalCol * metal;
  col += vec3(1.0, 0.82, 0.5) * exp(-abs(d) * 320.0) * 0.55;
  return col;
}

// Chrome → House. The drops gather into one, which shrinks to a glint and leaves paper.
vec3 evaporate(vec2 px, float h) {
  gMerge = h;
  vec3 c = sceneChrome(px);
  gMerge = 0.0;
  float g = smoothstep(0.75, 0.9, h) * smoothstep(1.0, 0.9, h);
  vec2 d = abs(px - R * 0.5);
  c += (exp(-d.x / 1.6) * exp(-d.y / 26.0) + exp(-d.y / 1.6) * exp(-d.x / 26.0)) * g * 1.2;
  return c;
}

vec3 handoff(int a, int b, float h, vec2 px) {
  if (a == 0 && b == 1) return diveInk(px, h);
  if (a == 1 && b == 2) return thaw(px, h);
  if (a == 2 && b == 3) return shatter(px, h);
  if (a == 3 && b == 4) return powerDown(px, h);
  if (a == 4 && b == 5) return giltMelt(px, h);
  if (a == 5 && b == 0) return evaporate(px, h);
  float m = smoothstep(h - 0.12, h + 0.12, fbm3(px * 0.004));
  return mix(sceneOf(b, px), sceneOf(a, px), m);
}
`;
