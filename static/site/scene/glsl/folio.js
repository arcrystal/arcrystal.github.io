// Naturalist's Folio (Mountains): a dark forest drawn as a copperplate engraving. Line hatching
// thickens with the light; a lantern follows the pointer and brings up warm detail; fern fronds sway
// in from both edges; motes drift up.
export const FOLIO = /* glsl */ `
const vec3 FOL_BG = vec3(0.071, 0.114, 0.086);
const vec3 FOL_DEEP = vec3(0.027, 0.055, 0.039);
const vec3 FOL_LINE = vec3(0.196, 0.302, 0.235);
const vec3 FOL_FERN = vec3(0.035, 0.071, 0.047);
const vec3 BRASS = vec3(0.804, 0.647, 0.384);
const vec3 EMBER = vec3(0.910, 0.706, 0.396);

// One frond: a bent rachis with tapering, upswept leaflets. 0..1 coverage.
float frond(vec2 p, vec2 base, float ang, float len, float curl) {
  vec2 q = rot(ang) * (p - base);
  float x = -q.y;
  float L = len * gGrow;
  float y = q.x - curl * x * x / len;
  float s = x / L;
  if (s < 0.0 || s > 1.0) return 0.0;
  float w = len * 0.19 * pow(1.0 - s, 0.75) + 1.5;
  float ay = abs(y);
  if (ay > w + 2.0) return 0.0;
  float k = s * 24.0 - ay / w * 1.7;
  float e = 0.43 * pow(max(1.0 - ay / w, 0.0), 0.7) - abs(fract(k) - 0.5);
  float leaf = smoothstep(0.0, 0.05, e);
  float rachis = smoothstep(1.8, 0.7, ay) * step(s, 0.98);
  return max(leaf, rachis);
}

vec3 sceneFolio(vec2 px) {
  vec2 uv = px / R;
  vec3 col = mix(FOL_BG, FOL_DEEP, smoothstep(0.15, 1.05, length((uv - vec2(0.5, 0.3)) * vec2(1.0, 1.25))));
  vec2 idle = R * vec2(0.7, 0.34) + vec2(sin(T * 0.21), cos(T * 0.17)) * 34.0;
  vec2 lamp = mix(idle, PTR, uPtrOn);
  float light = exp(-pow(length(px - lamp) / 320.0, 2.0));
  float terr = fbm(px * 0.003 + vec2(3.0, 9.0));
  float shade = clamp(terr * 1.3 - 0.22 + light * 0.5, 0.0, 1.0);
  // Hatching: light lines on the dark plate, thicker where the light is.
  float u1 = dot(px, vec2(0.866, 0.5)) / 5.2 + terr * 7.0;
  float w1 = 0.05 + 0.34 * shade;
  float a1 = fwidth(u1) * 0.8;
  float line1 = smoothstep(w1 + a1, w1 - a1, abs(fract(u1) - 0.5));
  float u2 = dot(px, vec2(-0.5, 0.866)) / 6.0 + terr * 5.0;
  float w2 = max(shade - 0.55, 0.0) * 0.5;
  float a2 = fwidth(u2) * 0.8;
  float line2 = smoothstep(w2 + a2, w2 - a2, abs(fract(u2) - 0.5)) * step(0.001, w2);
  vec3 lineCol = mix(FOL_LINE, BRASS * 0.85, light * 0.75);
  col = mix(col, lineCol, max(line1, line2) * (0.55 + 0.35 * shade));
  // Ferns from both edges, swaying.
  float sway = sin(T * 0.4) * 0.025;
  float fern = 0.0;
  fern = max(fern, frond(px, vec2(R.x * 0.05, R.y + 12.0), -0.12 + sway, R.y * 0.78, 0.32));
  fern = max(fern, frond(px, vec2(R.x * -0.02, R.y + 12.0), 0.32 + sway * 1.3, R.y * 0.62, 0.42));
  fern = max(fern, frond(px, vec2(R.x * 0.13, R.y + 12.0), -0.42 - sway, R.y * 0.48, -0.3));
  fern = max(fern, frond(px, vec2(R.x * 0.95, R.y + 12.0), 0.14 - sway, R.y * 0.8, -0.32));
  fern = max(fern, frond(px, vec2(R.x * 1.02, R.y + 12.0), -0.34 - sway * 1.2, R.y * 0.6, -0.4));
  fern = max(fern, frond(px, vec2(R.x * 0.86, R.y + 12.0), 0.44 + sway, R.y * 0.42, 0.3));
  col = mix(col, FOL_FERN + BRASS * 0.12 * light, fern * 0.92);
  // Motes rising through the lantern light.
  vec2 g = px / 120.0 + vec2(sin(T * 0.1) * 0.3, T * 0.12);
  vec2 id = floor(g);
  float d = length(fract(g) - hash2(id)) * 120.0;
  float mote = smoothstep(2.6, 0.4, d) * step(0.82, hash(id + 4.2)) * (0.5 + 0.5 * sin(T * 2.3 + hash(id) * 6.0));
  col += EMBER * mote * (0.35 + 0.65 * light);
  col += EMBER * light * 0.05;
  col *= 1.0 - 0.45 * pow(length((uv - vec2(0.5, 0.45)) * vec2(1.0, 1.1)), 2.2);
  return col;
}
`;
