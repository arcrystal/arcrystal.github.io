// Glacier (Racing): high-key ice with moving caustics (sunlight through ice), light shafts, faint
// contour lines and snow. The resting card is real glass: the scene is drawn again inside it,
// bent toward the centre near the edge and frosted, with a chromatic rim.
export const GLACIER = /* glsl */ `
const vec3 ICE_TOP = vec3(0.957, 0.976, 0.988);
const vec3 ICE_BOT = vec3(0.737, 0.851, 0.937);
const vec3 ICE_BLUE = vec3(0.624, 0.847, 1.0);
const vec3 ICE_DEEP = vec3(0.090, 0.404, 0.761);
const vec3 ICE_MINT = vec3(0.169, 0.851, 0.659);

// The classic water-caustic web: a few rounds of domain warping.
float caustic(vec2 p, float t, float sharp) {
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), sharp);
}

vec3 glacierAt(vec2 px, float soft) {
  vec2 uv = px / R;
  vec3 col = mix(ICE_TOP, ICE_BOT, smoothstep(-0.1, 1.15, uv.y + 0.16 * (fbm3(px * 0.0016) - 0.5)));
  vec2 p = px / R.y * 3.1 - 250.0;
  float t = T * 0.26 + 23.0;
  float sharp = mix(7.0, 2.4, soft);
  float c = caustic(p, t, sharp) * 0.6 + caustic(p * 1.6 + 3.0, t * 1.25, sharp) * 0.3;
  float glow = uPtrOn * exp(-pow(length(px - PTR) / 300.0, 2.0));
  float k = c * (0.5 + 0.5 * smoothstep(1.05, 0.15, uv.y)) * (1.0 + 0.7 * glow);
  col = mix(col, col * vec3(0.9, 0.95, 1.0), 0.5 * fbm3(px * 0.0012 + T * 0.01));
  col += mix(ICE_BLUE, vec3(1.0), 0.45) * k * mix(0.95, 0.4, soft);
  col += ICE_MINT * 0.07 * smoothstep(0.55, 1.0, uv.y) * (0.5 + 0.5 * sin(px.x * 0.0035 + T * 0.2));
  if (soft < 0.5) {
    float shaft = pow(max(0.0, sin((px.x * 0.55 + px.y) * 0.0032 - T * 0.05 + 1.4 * fbm3(px * 0.0018))), 12.0);
    col += shaft * 0.11;
    float iso = abs(fract(fbm3(px * 0.0021 + 4.0) * 13.0) - 0.5);
    col = mix(col, ICE_DEEP, 0.08 * smoothstep(0.035, 0.0, iso) * smoothstep(0.55, 1.0, uv.y));
    vec2 g = px / 96.0 + vec2(T * 0.04, -T * 0.22);
    vec2 id = floor(g);
    float d = length(fract(g) - hash2(id)) * 96.0;
    col += smoothstep(2.4, 0.6, d) * step(0.74, hash(id + 9.1)) * 0.75;
  }
  return col;
}

vec3 sceneGlacier(vec2 px) {
  vec3 col = glacierAt(px, 0.0);
  if (uCard.z > 0.0 && gCardMix > 0.001) {
    vec2 c = uCard.xy + uCard.zw * 0.5;
    float sd = sdBox(px - c, uCard.zw * 0.5, uCardR);
    if (sd < 8.0) {
      float edge = smoothstep(-70.0, 0.0, sd);
      vec2 dir = normalize(px - c + 0.001);
      vec3 frost = glacierAt(px - dir * edge * edge * 30.0, 1.0);
      frost = mix(frost, vec3(1.0), 0.38);
      float inside = clamp(0.5 - sd / 1.5, 0.0, 1.0);
      col = mix(col, frost, inside * gCardMix);
      float rim = exp(-abs(sd + 1.5) / 1.4);
      col += gCardMix * (rim * 0.55 + vec3(1.0, 0.25, 0.55) * exp(-abs(sd + 6.0) / 2.2) * 0.13 + vec3(0.1, 0.6, 1.0) * exp(-abs(sd - 2.5) / 2.2) * 0.16);
    }
  }
  return col;
}
`;
