// What the transitions draw, shared by the click covers (opens.js) and the seams (transit.js). Each
// destination is told apart by its process, not its colours (flight.js has the maths):
//   Chess        ink: a branching reach of soft fingers (branchLook)
//   Science      a Hilbert curve: one liquid-chrome line snaking through every block (hilbertSnake)
//   Photography  a camera iris, then a print developing from halftone to dither to tone (irisAt, develop)
// A Look is a colour c, its coverage m, and light it gives off (glow, added over everything, so it
// also lights the old page through the gaps).
export const REACH_LOOK = /* glsl */ `
struct Look { vec3 c; float m; vec3 glow; };

vec3 liquidMetal(vec2 px, float height) {
  return cosmosMetal(normalize(vec3(-vec2(dFdx(height), dFdy(height)) * 50.0, 1.0)));
}

// Sunset, for the iris's light: 0 the first warm light, 1 the safelight's dark.
vec3 sunset(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(vec3(1.0, 0.86, 0.52), vec3(0.98, 0.56, 0.22), smoothstep(0.0, 0.35, x));
  c = mix(c, vec3(0.78, 0.17, 0.16), smoothstep(0.3, 0.7, x));
  return mix(c, DR_BG + DR_RED * 0.12, smoothstep(0.65, 1.0, x));
}

// ---- Chess: ink --------------------------------------------------------------------------------------
// Soft fingers that swell as they age and pool darker at their edges. R: the reach here; P: how far
// the transition has gone on the reach's clock.
Look branchLook(int s, Reach Rr, float P, vec2 px, vec2 ra) {
  float grown = smoothstep(Rr.tb - 0.004, Rr.tb + 0.01, P);
  float age = max(P - Rr.tb, 0.0);
  float wk = Rr.d / (Rr.w * (1.0 + 2.5 * min(age * 3.0, 1.0)));
  float m = smoothstep(1.2, 0.3, wk) * grown * (0.8 + 0.2 * noise(px * 0.3));
  vec3 c = mix(INK_BLACK, INK_INDIGO, 0.25 + 0.35 * smoothstep(0.2, 1.0, wk) * noise(px * 0.02));
  return Look(c * (0.85 + 0.3 * smoothstep(0.6, 1.0, wk)), m, vec3(0.0));
}

// ---- Science: the Hilbert line ---------------------------------------------------------------------
// The stretch of the line between head - trail and head (0..1 along it), as a tube of liquid chrome
// whose head sparks. Each block draws half-segments from its centre to the neighbours next to it on
// the line.
Look hilbertSnake(vec2 q, vec2 size, float head, float trail, vec2 px) {
  ivec2 b = hBlock(q, size);
  vec2 bs = hBlockSize(size);
  float D = hIndex(b, size);
  float step1 = 1.0 / (hPanels(size) * float(HN * HN) - 1.0);
  int nx = int(hPanels(size)) * HN;
  vec2 c = (vec2(b) + 0.5) * bs;
  float best = 1e9, along = D;
  for (int k = 0; k < 4; k++) {
    ivec2 o = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
    ivec2 nb = b + o;
    if (nb.x < 0 || nb.y < 0 || nb.x >= nx || nb.y >= HN) continue;
    float Dn = hIndex(nb, size);
    if (abs(Dn - D) > step1 * 1.5) continue;
    vec2 m = (c + (vec2(nb) + 0.5) * bs) * 0.5;
    vec2 pa = q - c, ba = m - c;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float dd = length(pa - ba * h);
    if (dd < best) { best = dd; along = D + (Dn - D) * 0.5 * h; }
  }
  const float W = 3.1;
  float alive = smoothstep(head - trail, head - trail + 0.03, along) * step(along, head);
  float hgt = sqrt(max(1.0 - best * best / (W * W), 0.0));
  float tip = exp(-max(head - along, 0.0) / (step1 * 10.0)) * step(along, head);
  vec3 glow = (COS_CYAN * 0.55 + spectrum(along * 30.0 + T * 0.5) * 0.5) * tip * exp(-best / 9.0) * 0.9
            + COS_CYAN * 0.12 * exp(-best / 5.0) * alive;
  return Look(liquidMetal(px, hgt * 0.12) + spectrum(along * 12.0) * 0.08, smoothstep(W + 0.7, W - 0.5, best) * alive, glow);
}

// ---- Photography: a camera iris --------------------------------------------------------------------
// Nine curved blades around C: open 1 is wide open (past far), 0 is shut, and they turn as they
// close. rgb: the blades, lit at their lips by light; a: how much of this point is inside the
// aperture (where the blades are not).
const float BLADES = 9.0;
vec4 irisAt(vec2 q, vec2 C, float far, float open, vec3 light) {
  float a = open * far * 1.15;
  float rot = (1.0 - open) * 1.1;
  vec2 v = q - C;
  float r = length(v);
  float th = atan(v.y, v.x) - rot;
  float seg = TAU / BLADES;
  float phi = mod(th + seg * 0.5, seg) - seg * 0.5;
  // Distance past the aperture's edge: a nonagon whose sides bow in between its corners.
  float sd = r * cos(phi) - a * (1.0 + 0.12 * pow(phi / (seg * 0.5), 2.0));
  float inside = smoothstep(1.0, -1.0, sd);
  // The blades overlap along spiral seams; each is lit a little differently, with a sheen that
  // slides as they turn.
  float sp = th / seg + log(max(r, 1.0)) * 1.4;
  float bc = fract(sp);
  float seam = smoothstep(0.04, 0.0, min(bc, 1.0 - bc));
  float shade = 0.05 + 0.045 * (0.5 + 0.5 * cos(floor(sp) * 2.4 + 1.0)) + 0.05 * bc;
  shade += 0.07 * pow(max(cos(th + rot * 3.0 - 0.9), 0.0), 10.0);
  vec3 blade = vec3(0.92, 0.9, 0.86) * shade - seam * 0.03;
  float lip = exp(-max(sd, 0.0) / 2.5) * (1.0 - inside);
  blade += light * (lip * 0.7 + seam * exp(-max(sd, 0.0) / 60.0) * 0.3);
  blade += (hash(floor(q * 0.7)) - 0.5) * 0.015;
  return vec4(blade, inside);
}
// The flare when the blades meet: eighteen diffraction spikes (two per blade) and a hot core.
vec3 starburst(vec2 q, vec2 C, float far, float k, vec3 light) {
  vec2 v = q - C;
  float r = length(v), th = atan(v.y, v.x);
  float spikes = pow(abs(cos(BLADES * th)), 90.0) * exp(-r / (far * 0.45));
  return light * (spikes * 1.3 + exp(-r / 22.0) * 1.2 + exp(-r / (far * 0.12)) * 0.25) * k;
}
// Out-of-focus highlights, nine-sided like the aperture, drifting up.
vec3 bokeh(vec2 q, float amount) {
  if (amount <= 0.0) return vec3(0.0);
  vec3 col = vec3(0.0);
  vec2 p = q + vec2(0.0, T * 14.0);
  vec2 g = floor(p / 150.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = g + vec2(float(i), float(j));
    if (hash(c + 1.9) < 0.45) continue;
    vec2 o = (c + 0.2 + 0.6 * hash2(c + 4.1)) * 150.0;
    float rad = 14.0 + 30.0 * hash(c + 8.3);
    vec2 v = p - o;
    float r = length(v), th = atan(v.y, v.x) - 0.3;
    float seg = TAU / BLADES;
    float sd = r * cos(mod(th + seg * 0.5, seg) - seg * 0.5) - rad;
    float disc = smoothstep(1.5, -1.5, sd), ring = exp(-abs(sd) / 1.8);
    col += mix(DR_RED, EMBER, hash(c + 2.7)) * (disc * 0.22 + ring * 0.3);
  }
  return col * amount;
}

// ---- Photography: a print developing --------------------------------------------------------------
// d 0..1: a coarse halftone screen that grows finer, then ordered (Bayer) dithering whose levels
// multiply, then continuous tone.
float bayer8(ivec2 p) {
  int x = p.x & 7, y = p.y & 7, xy = x ^ y;
  int v = ((xy & 1) << 5) | ((y & 1) << 4) | ((xy & 2) << 2) | ((y & 2) << 1) | ((xy & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}
vec3 develop(vec3 img, vec2 px, float d) {
  d = clamp(d, 0.0, 1.0);
  if (d >= 1.0) return img;
  // Halftone: dots on a screen at 45°, each as big as the tone it stands for.
  float cs = mix(18.0, 4.0, smoothstep(0.0, 0.45, d));
  vec2 rp = mat2(0.7071, 0.7071, -0.7071, 0.7071) * px / cs;
  vec2 cc = floor(rp) + 0.5;
  vec2 cpx = mat2(0.7071, -0.7071, 0.7071, 0.7071) * cc * cs;
  float l = clamp(luma(img) * 1.6, 0.0, 1.0);
  float dotR = sqrt(l) * 0.72;
  float dotM = smoothstep(dotR + 0.06, dotR - 0.06, length(rp - cc));
  vec3 tint = img / max(luma(img), 0.02) * 0.6;
  vec3 half_ = mix(DR_BG * 0.7, clamp(tint, 0.0, 1.6) * 0.75, dotM);
  // Ordered dithering, 2 levels per channel rising to 32.
  float lv = exp2(mix(1.0, 5.0, smoothstep(0.45, 0.85, d)));
  vec3 dith = floor(img * lv + bayer8(ivec2(floor(px / 2.0)))) / lv;
  vec3 col = mix(half_, dith, smoothstep(0.38, 0.52, d));
  return mix(col, img, smoothstep(0.8, 1.0, d));
}
`;
