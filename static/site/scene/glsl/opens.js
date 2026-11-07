// Click to expand. cover(): the room's material spreads from the clicked card until it covers the
// screen (premultiplied alpha; the old page shows through where it has not reached). reveal(): on
// the new page, the cover recedes in the room's own way onto its scene.
export const OPENS = /* glsl */ `
vec2 cardCentre() { return uCard.z > 0.0 ? uCard.xy + uCard.zw * 0.5 : R * 0.5; }
float cardSd(vec2 px) { return uCard.z > 0.0 ? sdBox(px - cardCentre(), uCard.zw * 0.5, uCardR) : length(px - R * 0.5) - 40.0; }

vec3 frostAt(vec2 px) {
  vec4 v = voronoi(px * 0.03);
  vec3 c = vec3(0.925, 0.96, 0.982) + (hash(v.zw) - 0.5) * 0.045;
  c += smoothstep(0.07, 0.0, v.y - v.x) * 0.05;
  c += smoothstep(0.985, 1.0, noise(px * 0.4)) * 0.25;
  return c;
}

vec3 parchmentAt(vec2 px) {
  vec3 c = vec3(0.933, 0.894, 0.808) * (0.97 + 0.05 * noise(px * 0.6) + 0.04 * fbm3(px * 0.01));
  float frame = min(abs(sdBox(px - R * 0.5, R * 0.5 - 26.0, 0.0)), abs(sdBox(px - R * 0.5, R * 0.5 - 36.0, 0.0)));
  c = mix(c, vec3(0.655, 0.514, 0.29), smoothstep(1.4, 0.4, frame) * 0.8);
  return c;
}

vec3 liquidMetal(vec2 px, float height) {
  return cosmosMetal(normalize(vec3(-vec2(dFdx(height), dFdy(height)) * 50.0, 1.0)));
}

vec4 cover(int s, vec2 px, float e) {
  vec2 c = cardCentre();
  float far = farCorner(c) * 1.12;
  float sd = cardSd(px);
  if (s == 1) {
    float rad = mix(-24.0, far, ease(e));
    float n = (fbm3(px * 0.006 + 3.1) - 0.5) * (40.0 + max(rad, 0.0) * 0.32) + (noise(px * 0.05) - 0.5) * 10.0;
    float q = sd + n - rad;
    float a = smoothstep(2.0, -2.0, q);
    vec3 ink = INK_BLACK * (0.9 + 0.2 * noise(px * 0.3));
    ink = mix(ink, INK_INDIGO, exp(-abs(q) / 16.0) * 0.5);
    return vec4(ink * a, a);
  }
  if (s == 2) {
    float rad = mix(-20.0, far, ease(e));
    vec4 v = voronoi(px * 0.03);
    float q = sd - rad + (v.x - 0.5) * 36.0 + (fbm3(px * 0.004) - 0.5) * 90.0;
    float a = smoothstep(2.0, -2.0, q);
    vec3 f = frostAt(px) + exp(-abs(q) / 3.0) * 0.35;
    f += vec3(1.0, 0.3, 0.6) * exp(-abs(q + 5.0) / 2.0) * 0.12 + vec3(0.1, 0.6, 1.0) * exp(-abs(q - 4.0) / 2.0) * 0.15;
    return vec4(f * a, a);
  }
  if (s == 3) {
    // Liquid chrome swells out of the card, wobbling, with drops orbiting into it, mirroring space.
    float rad = mix(-12.0, far, ease(e));
    float ang = atan(px.y - c.y, px.x - c.x);
    float q = sd - rad + sin(ang * 5.0 + T * 5.0) * 10.0 * (1.0 - e) + (noise(px * 0.01 + T) - 0.5) * 16.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float aa = fi / 6.0 * TAU + e * 2.0;
      vec2 bp = c + vec2(cos(aa), sin(aa)) * (max(rad, 0.0) + min(uCard.z, uCard.w) * 0.55) * (1.0 + 0.15 * sin(e * 9.0 + fi));
      q = smin(q, length(px - bp) - (26.0 + 34.0 * sin(e * PI)), 46.0);
    }
    float a = smoothstep(1.5, -1.5, q);
    // A swelling rim, and slow ripples across the body so it reads as liquid, not paint.
    float body = clamp(-q / 90.0, 0.0, 1.0);
    float ripple = fbm3(px * 0.0035 + vec2(T * 0.25, -T * 0.18)) * 0.7 + 0.1 * sin(length(px - c) * 0.02 - T * 4.0);
    vec3 m = liquidMetal(px, body * 0.55 + ripple * body);
    return vec4(m * a, a);
  }
  if (s == 4) {
    // A page turns in from the left; its curling edge leads, casting a shadow ahead.
    float X = mix(-120.0, R.x + 140.0, ease(e));
    float u = (X - px.x) / 110.0;
    if (u < 0.0) {
      float sh = exp(u * 3.0) * 0.32;
      return vec4(vec3(0.0), sh);
    }
    vec3 p = parchmentAt(px);
    if (u < 1.0) p *= 0.72 + 0.4 * sin(u * PI * 0.5 + 0.35) + 0.1 * pow(sin(u * PI), 8.0);
    return vec4(p, 1.0);
  }
  // The safelight floods out from the print: red-black, its front glowing.
  float rad = mix(-16.0, far, ease(e));
  float q = sd - rad + (fbm3(px * 0.006) - 0.5) * 50.0;
  float a = smoothstep(2.0, -2.0, q);
  vec3 col = DR_BG + DR_RED * 0.35 * exp(-length(px - c) / (far * 0.6)) + DR_RED * exp(-abs(q) / 18.0) * 0.6;
  return vec4(col * a, a);
}

vec3 reveal(int s, vec2 px, float e) {
  vec3 scene = sceneOf(s, px);
  if (s == 1) {
    float f = fbm(px * 0.004) * 0.7 + 0.3 * length(px / R - 0.5) * 1.4;
    float th = ease(e) * 1.3 - 0.12;
    vec3 col = mix(scene, mix(scene, INK_BLACK, 0.45), smoothstep(th - 0.18, th - 0.04, f));
    return mix(col, INK_BLACK * (0.9 + 0.2 * noise(px * 0.3)), smoothstep(th - 0.03, th + 0.03, f));
  }
  if (s == 2) {
    float r = ease(e) * (farCorner(uPoint) + 240.0);
    float dd = length(px - uPoint) + (fbm3(px * 0.01) - 0.5) * 70.0;
    float clear = smoothstep(r - 10.0, r - 170.0, dd);
    vec3 col = mix(frostAt(px), scene, clear);
    vec4 v = voronoi(px * 0.12);
    float bead = smoothstep(0.32, 0.18, v.x) * smoothstep(r - 200.0, r - 40.0, dd) * smoothstep(r + 20.0, r - 20.0, dd);
    return col + bead * 0.22;
  }
  if (s == 3) {
    // The chrome bursts into drops that scatter and fall away into space.
    float far = farCorner(uPoint) * 1.15;
    float hr = ease(e) * far;
    float dd = length(px - uPoint) + (noise(px * 0.02) - 0.5) * 12.0;
    float open_ = smoothstep(hr + 1.5, hr - 1.5, dd);
    float hgt = clamp((dd - hr) / 90.0, 0.0, 1.0) * (0.55 + 0.9 * fbm3(px * 0.0035 + vec2(T * 0.25, -T * 0.18)));
    vec3 metal = liquidMetal(px, hgt);
    vec3 col = mix(metal, scene, open_);
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float aa = fi / 14.0 * TAU + hash(vec2(fi, 1.0)) * 0.4;
      vec2 bp = uPoint + vec2(cos(aa), sin(aa)) * (hr * (1.05 + 0.4 * hash(vec2(fi, 2.0))) + 30.0) + vec2(0.0, 140.0 * e * e);
      float br = (8.0 + 18.0 * hash(vec2(fi, 3.0))) * sin(min(1.0, e * 1.4) * PI);
      float dm = length(px - bp) - br;
      col = mix(col, cosmosMetal(normalize(vec3((px - bp) / max(br, 1.0), 1.0))), smoothstep(1.0, -1.0, dm) * open_);
    }
    col += spectrum(dd / 300.0 + T * 0.1) * 0.22 * open_ * (1.0 - e) * exp(-abs(dd - hr) / 60.0);
    return col;
  }
  if (s == 4) {
    float X = mix(-120.0, R.x + 140.0, ease(e));
    float u = (px.x - X) / 110.0;
    if (u < 0.0) return scene;
    vec3 p = parchmentAt(px);
    if (u < 1.0) p *= 0.72 + 0.4 * sin(u * PI * 0.5 + 0.35);
    return mix(p, scene * 0.7, exp(-u * 3.0) * 0.0);
  }
  // The page comes up like a print in the developer: shadows first, warm, then full colour.
  float dev = clamp(ease(e) * 1.25 - (fbm3(px * 0.004) - 0.5) * 0.35 - 0.1, 0.0, 1.0);
  vec3 print = pow(scene, vec3(1.0 + 3.0 * (1.0 - dev)));
  print = mix(print * vec3(1.0, 0.55, 0.5), print, smoothstep(0.55, 1.0, dev));
  return mix(DR_BG + DR_RED * 0.08, print, smoothstep(0.0, 0.35, dev));
}
`;

export const MAIN = /* glsl */ `
void main() {
  R = uRes / uDpr;
  T = uTime;
  PTR = uPointer;
  gCardMix = uCardMix;
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  // Scrolling fast smears the scene a little along the direction of travel.
  px.y += clamp(uVel, -3.0, 3.0) * 14.0 * (noise(px * 0.008 + T) - 0.5);
  vec4 o;
  if (uMode == 0) o = vec4(sceneOf(uA, px), 1.0);
  else if (uMode == 2) o = cover(uA, px, uE);
  else if (uMode == 3) o = vec4(reveal(uA, px, uE), 1.0);
  else if (uMode == 4) o = vec4(sceneOf(uA, px), 1.0) * uE;
  else if (uMode == 6) o = vec4(seam(uA, uB, px), 1.0);
  else if (uMode == 7) o = vec4(heroScene(px), 1.0);
  else o = vec4(mix(sceneOf(uA, px), sceneOf(uB, px), smoothstep(0.3, 0.7, uH)), 1.0);
  o.rgb += (hash(gl_FragCoord.xy + fract(T) * 17.0) - 0.5) / 255.0 * o.a;
  outColor = o;
}
`;
