// Liquid Chrome (About): pearl with drifting iridescence, and liquid metal: metaballs whose normals
// reflect a studio sky with thin-film colour. One drop follows the pointer and merges with the rest.
// gMerge gathers them into a single drop that evaporates into paper (the exit to the house style).
export const CHROME = /* glsl */ `
const vec3 PEARL = vec3(0.925, 0.922, 0.957);
const vec3 HOUSE_PAPER = vec3(0.957, 0.949, 0.933);

vec3 chromeEnv(vec3 r) {
  float y = -r.y;
  vec3 c = mix(vec3(0.19, 0.2, 0.28), vec3(0.97, 0.97, 1.0), smoothstep(-0.35, 0.5, y));
  c += smoothstep(0.6, 0.7, y) * 0.45;
  c *= 0.82 + 0.18 * smoothstep(-1.0, 0.3, r.x);
  c = mix(c, vec3(0.12, 0.13, 0.19), exp(-pow((y + 0.04) / 0.07, 2.0)) * 0.65);
  return c;
}

vec3 ball(int i) {
  float t = T * 0.22;
  vec3 b;
  if (i == 0) b = vec3(R * vec2(0.05, 0.08) + vec2(sin(t), cos(t * 0.8)) * 30.0, R.y * 0.17);
  else if (i == 1) b = vec3(R * vec2(0.9, 0.84) + vec2(cos(t * 0.9), sin(t * 1.1)) * 40.0, R.y * 0.17);
  else if (i == 2) b = vec3(R * vec2(0.44, 0.97) + vec2(sin(t * 1.3) * 60.0, 0.0), R.y * 0.07);
  else if (i == 3) b = vec3(R * vec2(0.96, 0.1) + vec2(sin(t * 1.7), cos(t * 1.4)) * 22.0, R.y * 0.065);
  else if (i == 4) b = vec3(R * vec2(0.03, 0.8) + vec2(cos(t * 1.2), sin(t)) * 30.0, R.y * 0.105);
  else b = vec3(mix(R * vec2(0.24, 0.3) + vec2(sin(t * 2.0), cos(t * 1.6)) * 60.0, PTR, uPtrOn), R.y * 0.05);
  float m = gMerge;
  b.xy = mix(b.xy, R * 0.5, smoothstep(0.0, 0.6, m));
  b.z *= mix(1.0, 0.55, smoothstep(0.0, 0.6, m)) * (1.0 - smoothstep(0.6, 0.95, m));
  return b;
}

float metaField(vec2 px, out vec2 grad) {
  float F = 0.0;
  grad = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    vec3 b = ball(i);
    vec2 d = px - b.xy;
    float d2 = dot(d, d) + 1.0;
    float k = b.z * b.z / d2;
    F += k;
    grad += -2.0 * k / d2 * d;
  }
  return F;
}

vec3 sceneChrome(vec2 px) {
  vec2 uv = px / R;
  float t = T * 0.05;
  vec3 col = PEARL;
  col = mix(col, vec3(1.0, 0.82, 0.95), 0.55 * exp(-pow(length(uv - vec2(0.22 + 0.04 * sin(t), 0.26)) / 0.32, 2.0)));
  col = mix(col, vec3(0.78, 0.95, 1.0), 0.55 * exp(-pow(length(uv - vec2(0.8, 0.22 + 0.04 * cos(t))) / 0.3, 2.0)));
  col = mix(col, vec3(0.86, 0.82, 1.0), 0.5 * exp(-pow(length(uv - vec2(0.62 + 0.03 * cos(t * 1.3), 0.86)) / 0.34, 2.0)));
  col = mix(col, vec3(0.79, 1.0, 0.91), 0.45 * exp(-pow(length(uv - vec2(0.14, 0.8)) / 0.26, 2.0)));
  col = mix(col, HOUSE_PAPER, smoothstep(0.35, 1.0, gMerge));
  vec2 gs;
  float Fs = metaField(px - vec2(-12.0, 30.0), gs);
  col = mix(col, col * vec3(0.78, 0.76, 0.9), smoothstep(0.35, 1.0, Fs) * 0.32);
  vec2 G;
  float F = metaField(px, G);
  float w = fwidth(F) + 1e-4;
  float inside = smoothstep(1.0 - w, 1.0 + w, F);
  if (inside > 0.0) {
    float flat_ = 1.0 - 0.7 * smoothstep(1.3, 3.2, F);
    vec3 n = normalize(vec3(-G * 70.0 * flat_, 1.0));
    vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
    vec3 metal = chromeEnv(r);
    float fres = pow(1.0 - n.z, 1.6);
    metal += spectrum(fres * 1.1 + n.x * 0.35 + T * 0.02) * fres * 0.32;
    metal += pow(max(dot(r, normalize(vec3(-0.4, -0.7, 0.6))), 0.0), 40.0) * 0.9;
    col = mix(col, metal, inside);
  }
  // Glints that twinkle beside the drops.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = R * vec2(hash(vec2(fi, 2.0)), hash(vec2(fi, 5.0)) * 0.9 + 0.05);
    vec2 d = abs(px - c);
    float tw = pow(0.5 + 0.5 * sin(T * (1.6 + fi * 0.4) + fi * 2.0), 3.0);
    float star = (exp(-d.x / 1.4) * exp(-d.y / 13.0) + exp(-d.y / 1.4) * exp(-d.x / 13.0)) * tw;
    col += star * 0.85 * (1.0 - gMerge);
  }
  return col;
}
`;
