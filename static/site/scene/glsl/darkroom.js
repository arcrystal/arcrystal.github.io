// Darkroom (Photography): black walls under a red safelight. The light falls in a soft cone from
// above; at the bottom the developing tray's liquid ripples and catches it in red streaks; dust
// drifts through the beam. The pointer stirs the tray.
export const DARKROOM = /* glsl */ `
const vec3 DR_BG = vec3(0.043, 0.039, 0.035);
const vec3 DR_RED = vec3(0.78, 0.19, 0.16);

vec3 sceneDarkroom(vec2 px) {
  vec2 uv = px / R;
  vec3 col = DR_BG;
  vec2 L = R * vec2(0.5, -0.1);
  vec2 dl = (px - L) / vec2(R.x * 0.6, R.y * 0.8);
  float glow = exp(-dot(dl, dl) * 2.0);
  col += DR_RED * glow * 0.62;
  // The lamp itself, just above the frame, blooming.
  col += vec3(1.0, 0.4, 0.32) * exp(-dot(dl, dl) * 14.0) * 0.3;
  col *= 0.94 + 0.06 * noise(px * 0.02);
  // The tray: a ripple field below 70% of the screen, its crests catching the safelight.
  float tray = smoothstep(0.66, 0.86, uv.y);
  vec2 q = vec2(px.x * 0.005, px.y * 0.016);
  float stir = uPtrOn * exp(-pow(length(px - PTR) / 220.0, 2.0));
  float h = fbm3(q + vec2(T * 0.03, -T * 0.08)) + 0.25 * sin(length(px - PTR) * 0.05 - T * 3.0) * stir;
  float crest = pow(smoothstep(0.45, 0.85, h), 3.0);
  col += DR_RED * tray * (0.1 + crest * 0.75) * (0.4 + glow);
  col += vec3(1.0, 0.55, 0.45) * tray * pow(crest, 6.0) * 0.3;
  // Dust in the beam.
  vec2 p = (px + vec2(0.0, T * 9.0)) / 34.0;
  vec2 id = floor(p), f = fract(p) - 0.5;
  float b = hash(id);
  if (b > 0.9) {
    float d = length(f - (hash2(id) - 0.5) * 0.7) * 34.0;
    col += vec3(1.0, 0.6, 0.5) * exp(-d * d * 0.5) * glow * 0.6 * (0.5 + 0.5 * sin(T + b * 30.0));
  }
  col += (hash(px + fract(T) * 13.0) - 0.5) * 0.018;
  return col * (1.0 - 0.35 * pow(abs(uv.x - 0.5) * 1.6, 2.0));
}
`;
