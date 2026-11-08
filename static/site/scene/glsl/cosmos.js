// Liquid Cosmos (Science): deep space and liquid metal, watched by instruments. An emission nebula
// in violet and teal over a dark field; stars at three depths that shift a little with the pointer;
// drops of liquid chrome drifting like cells or small worlds, reflecting the nebula with thin-film
// colour (one follows the pointer and merges with the rest); and the instruments: brackets that
// track the larger drops, a faint coordinate grid and a slow scan.
export const COSMOS = /* glsl */ `
const vec3 COS_BG = vec3(0.020, 0.024, 0.059);
const vec3 COS_CYAN = vec3(0.133, 0.902, 1.0);
const vec3 COS_MAG = vec3(1.0, 0.239, 0.796);
const vec3 COS_VIOLET = vec3(0.357, 0.231, 1.0);

vec3 cosmosSky(vec2 px) {
  vec2 uv = px / R;
  vec2 q = vec2(px.x / R.y, uv.y);
  float n1 = fbm(q * 1.6 + vec2(T * 0.006, 0.0));
  float n2 = fbm(q * 3.1 - vec2(0.0, T * 0.004) + n1);
  float cloud = smoothstep(0.42, 0.9, n2) * smoothstep(1.15, 0.1, length((uv - vec2(0.72, 0.3)) * vec2(1.0, 1.4)));
  vec3 col = COS_BG + COS_VIOLET * cloud * 0.48 + vec3(0.9, 0.3, 0.7) * cloud * cloud * 0.3;
  // The nebula's core: a warm, bright heart where the cloud is thickest.
  col += vec3(1.0, 0.62, 0.86) * pow(cloud, 3.0) * 0.22;
  float teal = smoothstep(0.5, 0.95, fbm3(q * 2.2 + 7.0)) * smoothstep(0.9, 0.0, length(uv - vec2(0.15, 0.85)));
  col += COS_CYAN * teal * 0.12;
  col *= 1.0 - 0.5 * smoothstep(0.55, 0.8, fbm3(q * 5.0 + 3.0)) * cloud;
  return col;
}

vec3 cosmosStars(vec2 px) {
  vec3 c = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 46.0 - fl * 12.0;
    vec2 p = (px + (PTR - R * 0.5) * (0.004 + fl * 0.006) * uPtrOn) / sc;
    vec2 id = floor(p), f = fract(p) - 0.5;
    float b = hash(id + fl * 3.1);
    if (b < 0.86 - fl * 0.05) continue;
    float d = length(f - (hash2(id + fl * 17.0) - 0.5) * 0.8) * sc;
    float tw = 0.65 + 0.35 * sin(T * (1.2 + b * 3.0) + b * 40.0);
    vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.75), hash(id + 9.0));
    c += tint * exp(-d * d / (0.9 + fl * 0.6)) * (0.5 + fl * 0.35) * tw;
  }
  return c;
}

// What the chrome reflects: the nebula overhead, a black horizon, a cyan rim light from the right.
vec3 spaceEnv(vec3 r) {
  float y = -r.y;
  vec3 c = mix(vec3(0.03, 0.03, 0.08), vec3(0.42, 0.33, 0.95), smoothstep(-0.2, 0.9, y));
  c += vec3(0.95, 0.5, 0.85) * smoothstep(0.55, 0.95, y) * 0.5;
  c += COS_CYAN * pow(max(r.x, 0.0), 6.0) * 0.8;
  return mix(c, vec3(0.01), exp(-pow((y + 0.05) / 0.08, 2.0)) * 0.7);
}

vec3 cosmosDrop(int i) {
  float t = T * 0.16;
  if (i == 0) return vec3(R * vec2(0.78, 0.32) + vec2(sin(t), cos(t * 0.8)) * 26.0, R.y * 0.15);
  if (i == 1) return vec3(R * vec2(0.62, 0.62) + vec2(cos(t * 0.9), sin(t * 1.1)) * 40.0, R.y * 0.07);
  if (i == 2) return vec3(R * vec2(0.92, 0.74) + vec2(sin(t * 1.3) * 30.0, cos(t) * 20.0), R.y * 0.055);
  if (i == 3) return vec3(R * vec2(0.88, 0.1) + vec2(sin(t * 1.7), cos(t * 1.4)) * 18.0, R.y * 0.04);
  if (i == 4) return vec3(R * vec2(0.1, 0.86) + vec2(cos(t * 1.2), sin(t)) * 22.0, R.y * 0.05);
  return vec3(mix(R * vec2(0.7, 0.46) + vec2(sin(t * 2.0), cos(t * 1.6)) * 50.0, PTR, uPtrOn * 0.85), R.y * 0.035);
}

float cosmosField(vec2 px, out vec2 grad) {
  float F = 0.0;
  grad = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    vec3 b = cosmosDrop(i);
    vec2 d = px - b.xy;
    float d2 = dot(d, d) + 1.0;
    float k = b.z * b.z / d2;
    F += k;
    grad += -2.0 * k / d2 * d;
  }
  return F;
}

// Liquid metal with a given surface slope: the space it reflects, a thin-film fringe, a highlight.
vec3 cosmosMetal(vec3 n) {
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float fres = pow(1.0 - n.z, 1.6);
  return spaceEnv(r) * 1.1 + spectrum(fres * 1.2 + n.x * 0.4 + T * 0.02) * fres * 0.5
    + pow(max(dot(r, normalize(vec3(-0.4, -0.7, 0.6))), 0.0), 40.0) * 0.9;
}

vec3 sceneCosmos(vec2 px) {
  vec3 col = cosmosSky(px) + cosmosStars(px);
  vec2 G;
  float F = cosmosField(px, G);
  float w = fwidth(F) + 1e-4;
  float inside = smoothstep(1.0 - w, 1.0 + w, F);
  col += COS_VIOLET * smoothstep(0.35, 1.0, F) * 0.12 * (1.0 - inside);
  if (inside > 0.0) {
    float flat_ = 1.0 - 0.7 * smoothstep(1.3, 3.2, F);
    col = mix(col, cosmosMetal(normalize(vec3(-G * 70.0 * flat_, 1.0))), inside);
  }
  // Brackets track the three larger drops.
  for (int i = 0; i < 3; i++) {
    vec3 b = cosmosDrop(i);
    vec2 ad = abs(px - b.xy);
    float half_ = b.z * 1.45;
    float onEdge = smoothstep(1.2, 0.0, abs(max(ad.x, ad.y) - half_));
    col += COS_CYAN * onEdge * step(half_ - 14.0, min(ad.x, ad.y)) * 0.6;
  }
  vec2 g = abs(fract(px / 96.0) - 0.5) * 96.0;
  col += COS_CYAN * smoothstep(0.9, 0.0, min(g.x, g.y)) * 0.035 * smoothstep(0.0, 0.5, px.x / R.x);
  // Now and then a meteor: a thin streak with a cyan head, every 11 s, somewhere new each time.
  float mk = floor(T / 11.0), mt = fract(T / 11.0) * 11.0;
  if (mt < 0.9) {
    vec2 m0 = R * vec2(0.2 + 0.7 * hash(vec2(mk, 1.0)), 0.05 + 0.35 * hash(vec2(mk, 2.0)));
    vec2 md = normalize(vec2(-0.85, 0.5));
    vec2 head = m0 + md * mt * 900.0;
    vec2 rel = px - head;
    float along = dot(rel, -md), across = abs(dot(rel, vec2(-md.y, md.x)));
    float trail = smoothstep(260.0, 0.0, along) * step(0.0, along) * exp(-across * across / 1.6);
    col += (COS_CYAN * 0.6 + vec3(0.8)) * (trail * 0.7 + exp(-dot(rel, rel) / 10.0)) * sin(PI * mt / 0.9);
  }
  float sy = mod(T * 60.0, R.y * 1.6) - R.y * 0.3;
  col += COS_CYAN * exp(-pow((px.y - sy) / 30.0, 2.0)) * 0.03;
  vec2 uv = px / R;
  return col * (1.0 - 0.3 * pow(length(uv - 0.5) * 1.2, 2.0));
}
`;
