// Signal (Coding): a near-black field of tiny dot-matrix glyphs. Data pulses ring out from the
// pointer, a scan sweep passes, and now and then a band of rows glitches sideways with an RGB split.
export const SIGNAL = /* glsl */ `
const vec3 SIG_BG = vec3(0.027, 0.024, 0.055);
const vec3 SIG_CYAN = vec3(0.133, 0.902, 1.0);
const vec3 SIG_MAG = vec3(1.0, 0.239, 0.796);
const vec3 SIG_ACID = vec3(0.784, 1.0, 0.302);
const float CELL = 14.0;

vec3 signalAt(vec2 px) {
  vec2 id = floor(px / CELL);
  vec2 f = fract(px / CELL);
  vec2 cc = (id + 0.5) * CELL;
  float tq = floor(T * (0.8 + 2.6 * hash(id)));
  // A 4×5 dot matrix with the last column and row left empty: a 3×4 glyph and a gap.
  vec2 g = floor(f * vec2(4.0, 5.0));
  vec2 gf = fract(f * vec2(4.0, 5.0)) - 0.5;
  float dotOn = step(0.5, hash(g + id * 7.31 + tq)) * step(g.x, 2.5) * step(g.y, 3.5);
  float dotShape = smoothstep(0.46, 0.2, length(gf));
  float field = fbm3(id * 0.055 + vec2(T * 0.05, -T * 0.03));
  float d = length(cc - PTR);
  float ring = uPtrOn * exp(-pow((d - mod(T * 320.0, 1500.0)) / 46.0, 2.0)) * exp(-d / 800.0);
  float near = uPtrOn * exp(-pow(d / 150.0, 2.0));
  float sweepY = mod(T * 120.0, R.y * 1.8) - R.y * 0.4;
  float sweep = exp(-pow((cc.y - sweepY) / 36.0, 2.0));
  float lit = smoothstep(0.55, 0.82, field) * 0.55 + ring + near * 0.7 + sweep * 0.55;
  float sel = hash(id + 3.3);
  vec3 tint = sel < 0.8 ? SIG_CYAN : (sel < 0.965 ? SIG_MAG : SIG_ACID);
  float base = 0.06 + 0.05 * hash(id + tq * 1.7);
  vec3 col = SIG_BG + tint * dotOn * dotShape * (base + lit * 0.85);
  col += SIG_CYAN * sweep * 0.025;
  return col;
}

vec3 sceneSignal(vec2 px) {
  float slot = floor(T * 1.7);
  float bandY = hash(vec2(slot, 1.0)) * R.y;
  float bandH = 8.0 + 64.0 * hash(vec2(slot, 2.0));
  float glitch = step(0.6, hash(vec2(slot, 3.0))) * step(abs(px.y - bandY), bandH) * step(fract(T * 1.7), 0.16);
  float sh = glitch * (hash(vec2(slot, 4.0)) - 0.5) * 70.0 + clamp(uVel, -2.0, 2.0) * 6.0;
  vec3 col;
  if (abs(sh) > 0.5) {
    col = vec3(signalAt(px + vec2(sh, 0.0)).r, signalAt(px).g, signalAt(px - vec2(sh, 0.0)).b);
  } else {
    col = signalAt(px);
  }
  vec2 uv = px / R;
  col += SIG_CYAN * 0.06 * exp(-pow(length((uv - vec2(0.86, 0.16)) * vec2(1.6, 1.0)) * 2.2, 2.0));
  col += SIG_MAG * 0.05 * exp(-pow(length((uv - vec2(0.08, 0.94)) * vec2(1.6, 1.0)) * 2.2, 2.0));
  col *= 0.92 + 0.08 * sin(px.y * 2.1);
  col *= 1.0 - 0.32 * pow(length(uv - 0.5) * 1.25, 2.0);
  return col;
}
`;
