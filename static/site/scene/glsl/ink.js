// Ink & Mist (Chess): warm paper with a fine grain, three abstract ink-wash ridges that darken at
// their wet crests and granulate as they fade, mist drifting between them, parting round the pointer.
export const INK = /* glsl */ `
const vec3 INK_PAPER = vec3(0.953, 0.933, 0.890);
const vec3 INK_BLACK = vec3(0.110, 0.102, 0.090);
const vec3 INK_INDIGO = vec3(0.184, 0.290, 0.420);

vec3 inkPaper(vec2 px) {
  float g = noise(px * 0.85) * 0.6 + noise(px * 0.22) * 0.4;
  return INK_PAPER * (0.986 + 0.028 * (g - 0.5));
}

vec3 sceneInk(vec2 px) {
  vec2 uv = px / R;
  float X = px.x / R.y;
  vec3 col = inkPaper(px);
  // A faint wash high up, like a damp sky.
  col = mix(col, INK_PAPER * 0.94, 0.3 * smoothstep(0.5, 0.0, uv.y) * smoothstep(0.35, 0.8, fbm3(vec2(X * 0.7 + T * 0.004, uv.y * 2.2))));
  float part = uPtrOn * exp(-pow(length(px - PTR) / 300.0, 2.0));
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float drift = T * (0.005 + fi * 0.004);
    float x = X * (0.85 + fi * 0.38) + drift + fi * 3.7;
    float ridge = pow(fbm3(vec2(x, fi * 11.0)), 1.5) * 1.9 + 0.1 * noise(vec2(x * 3.2, fi + 7.0));
    float base = 0.53 + fi * 0.13 + 0.07 * (1.0 - uv.x);
    float y = base - ridge * (0.21 - fi * 0.035);
    float depth = uv.y - y;
    if (depth < -0.01) continue;
    float body = smoothstep(-0.002, 0.003, depth) * exp(-depth * (8.5 - fi * 2.2));
    float wet = smoothstep(-0.0015, 0.0015, depth) * exp(-depth * 160.0) * 0.4;
    float gran = 0.78 + 0.44 * noise(px * (0.32 + fi * 0.1) + fi * 5.0);
    float mist = smoothstep(0.38, 0.78, fbm3(vec2(X * 1.25 - T * 0.012 * (fi + 1.0), uv.y * 4.2 + fi * 2.0)));
    float dens = (body * gran + wet * 1.3) * (0.34 + fi * 0.2) * (1.0 - 0.55 * mist) * (1.0 - 0.6 * part);
    // Where the wash pools at the foot of the nearest ridge it blooms a little darker.
    float pool = fi > 1.5 ? smoothstep(0.62, 0.8, fbm3(vec2(x * 1.7, uv.y * 6.0 - T * 0.01))) * exp(-depth * 4.0) * 0.18 : 0.0;
    vec3 tone = mix(INK_BLACK, INK_INDIGO, 0.38 - fi * 0.16);
    // The middle ridge carries an indigo wash that bleeds up from its foot.
    if (fi > 0.5 && fi < 1.5) tone = mix(tone, INK_INDIGO * 1.15, smoothstep(0.02, 0.2, depth) * 0.55 * smoothstep(0.35, 0.7, fbm3(vec2(x * 1.3, 4.0))));
    col = mix(col, tone, clamp(dens + pool, 0.0, 0.9));
  }
  return col;
}
`;
