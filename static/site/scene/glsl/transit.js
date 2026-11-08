// Transit grounds (mode 8): what lies under a seam's flying units. Wherever a point is at rest it is
// its live world, drawn exactly as the band beside it, so the strip has no edges. Only what moves
// or has been torn open reads the half-resolution snapshots (uTexA above, uTexB below). q is the
// point in the strip (CSS px, y down), px the same point on screen (for the worlds), F the front.
export const TRANSIT = /* glsl */ `
vec2 tUV(vec2 q) { return vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w); }
vec3 texA(vec2 q) { return texture(uTexA, tUV(q)).rgb; }
vec3 texB(vec2 q) { return texture(uTexB, tUV(q)).rgb; }

// Each seam is told apart by its process (flight.js, reach.js): the Hilbert line for Science, crystal
// growth for Racing, peeling sheets for Outdoors, a camera iris for Photography, a branching reach of
// ink for Chess. P = transitP(p); uH is p itself.
const float BLEAD = 0.22;
// The ink's reach at a seam point, where it matters: false where the point's height alone says
// nothing has grown there yet (u = 0) or it settled long ago (u = 1).
bool seamReach(vec2 q, int s, float P, out Reach Rq, out float u) {
  float rn = clamp(1.0 - q.y / uRegion.w, 0.0, 1.0);
  Rq = Reach(1e9, 1.0, 1.0, 1.0, 1.0);
  if (P + BLEAD < 0.4675 * rn - 0.01) { u = 0.0; return false; }
  if (P > 0.6325 * rn + 0.58) { u = 1.0; return false; }
  Rq = seamReachAt(q);
  u = flightAt(Rq.A, 0.5, P);
  return true;
}

// About Me → Science. A liquid-chrome line snakes through every block of the strip along a Hilbert
// curve, and the paper breaks into cubes in the order it passes. A cell is paper until its cube
// leaves, space once the cube bound for it has landed; between, the hole shows the dark beneath.
vec3 groundCubes(vec2 q, vec2 px, float P) {
  ivec2 n = ivec2(uGrid.xy);
  ivec2 c = clamp(ivec2(floor(q / uGrid.zw)), ivec2(0), n - 1);
  vec2 home = (vec2(c) + 0.5) * uGrid.zw;
  float uX = hilbertU(hilbertA(home, uRegion.zw), hash(vec2(c) + 0.37), P);
  int src = shiftCol(c.x, c.y, n.x, 1.0, -1);
  vec2 sc = vec2(float(src), float(c.y));
  vec2 from = (sc + 0.5) * uGrid.zw;
  float uY = hilbertU(hilbertA(from, uRegion.zw), hash(sc + 0.37), P);
  vec3 col;
  if (uX <= 0.0) col = sceneHouse(px);
  else if (uY >= 1.0) col = sceneCosmos(px);
  else {
    vec2 f = abs(fract(q / uGrid.zw) - 0.5) * 2.0;
    float rim = smoothstep(0.6, 1.0, max(f.x, f.y));
    float k = max(uX, uY);
    col = texB(q) * (0.28 + 0.6 * k);
    col += COS_CYAN * rim * 0.07 * (1.0 - k) + COS_MAG * rim * 0.04 * k;
  }
  // The head runs a little ahead of the cubes; the line drains away behind them.
  float head = (P + 0.06 - 0.2) / 0.6;
  if (head < -0.01 || head > 1.3) return col;
  Look L = hilbertSnake(q, uRegion.zw, head, 0.24, px);
  return mix(col, L.c, L.m) + L.glow;
}

// Science → Racing. Space liquefies and swirls (the vortex field, stirred by the fluid sim) while ice
// crystals nucleate across it and grow as six-armed stars until they meet (flight.js crystalAt,
// baked). Each crystal holds the swirl at its own tilt, its arms bright, its grain boundaries
// glowing; then it flashes and clears to the glacier.
vec2 flowBack(vec2 q, float amt, float t) {
  vec2 p = q;
  for (int i = 0; i < 4; i++) {
    vec2 v = swirl(p, t * 0.8);
    if (uSimOn > 0.5) v += texture(uSim, tUV(p)).xy * 0.006;
    p -= v * amt * 22.0;
  }
  return p;
}
vec3 crystalLook(vec4 X, float age, vec2 q, vec3 liquid) {
  vec2 tilt = (vec2(hash(vec2(X.z, 1.0)), hash(vec2(X.z, 2.0))) - 0.5) * 40.0;
  vec3 ice = texA(q + tilt + (q - uRegion.zw * 0.5) * 0.04 * (X.z - 0.5));
  ice = mix(ice, vec3(luma(ice)) * vec3(0.75, 0.9, 1.0) + vec3(0.08, 0.16, 0.26), 0.45);
  ice *= 0.82 + 0.36 * X.z;
  ice += vec3(0.85, 0.95, 1.0) * X.x * 0.6;
  return ice;
}
vec3 groundCrystal(vec2 q, vec2 px, float P) {
  vec4 X = seamRaw(q);
  float A = X.w, age = P - A;
  float u = flightAt(A, 0.5, P);
  if (u >= 1.0) return sceneGlacier(px);
  float melt = smoothstep(-0.2, 0.0, age);
  if (melt <= 0.0) return sceneCosmos(px);
  vec3 col;
  if (age < 0.0) {
    vec2 lq = flowBack(q, melt, T);
    col = texA(lq) + spectrum(length(lq - q) * 0.012 + T * 0.05) * 0.08 * melt;
    col = mix(col, col * vec3(0.8, 0.92, 1.05) + vec3(0.02, 0.05, 0.08), melt * 0.5);
  } else {
    col = crystalLook(X, age, q, vec3(0.0));
    float ct = 0.05 + 0.05 * X.z;
    float clear = smoothstep(ct, ct + 0.04, age);
    col = mix(col, texB(q), clear) + vec3(0.9, 0.97, 1.0) * exp(-abs(age - ct) * 60.0) * 0.55;
  }
  float front = exp(-abs(age) * 70.0);
  col += vec3(0.75, 0.92, 1.0) * front * 0.75 + spectrum(age * 12.0 + X.z) * front * 0.2;
  float gb = X.y * step(0.0, age) * (1.0 - smoothstep(0.05, 0.14, age));
  col += (vec3(1.0, 0.35, 0.6) * 0.15 + vec3(0.85, 0.97, 1.0) * 0.5) * gb;
  return col;
}

// Racing → Outdoors. Panes of ice crack along their edges, then peel back and fly (units.js sheets).
// Where a pane has peeled away, the engraving shows, shaded under the fold, and the light the curl
// focuses pools beside it in a shimmering caustic net.
vec3 groundSheets(vec2 q, vec2 px, float P) {
  ivec2 c = paneCell(q, uGrid);
  vec2 ctr = paneCentre(c, uGrid);
  float jit = hash(vec2(c) + 0.61);
  float raw = 0.5 + (P - paneA(ctr, uRegion.zw, jit)) / 0.3;
  float u = clamp(raw, 0.0, 1.0);
  if (u <= 0.0) {
    vec3 col = sceneGlacier(px);
    float pre = smoothstep(-0.7, 0.0, raw);
    if (pre > 0.0) {
      vec2 l = q - (ctr - uGrid.zw * 0.5);
      float e = min(min(l.x, uGrid.z - l.x), min(l.y, uGrid.w - l.y));
      col = mix(col, vec3(0.42, 0.62, 0.86), smoothstep(1.4, 0.0, e) * pre * 0.4);
      col += vec3(0.9, 0.97, 1.0) * smoothstep(5.0, 2.0, e) * smoothstep(1.2, 2.0, e) * pre * 0.18;
      // Frost glints wake along the cracks as the sweep nears.
      col += vec3(0.95, 0.98, 1.0) * step(0.985, hash(floor(q * 0.5))) * smoothstep(8.0, 0.0, e) * pre * (0.5 + 0.5 * sin(T * 7.0 + q.x));
    }
    return col;
  }
  vec3 col = sceneFolio(px);
  float L = uGrid.w, R = L * 0.12;
  float s = clamp((ctr.y + L * 0.5 - q.y) / L, 0.0, 1.0), w = clamp((q.x - ctr.x) / uGrid.z + 0.5, 0.0, 1.0);
  float roll = paneRoll(u), fly = paneFly(u);
  float f = paneFront(roll, w, step(0.5, hash(vec2(c) + 2.9)));
  float past = max(s - f, 0.0) * L;
  col *= 1.0 - 0.55 * exp(-past / (R * 2.2)) * (1.0 - fly) * step(f, s);
  float band = exp(-past / (4.0 * R)) * (1.0 - exp(-past / R)) * (1.0 - fly) * step(f, s);
  // A caustic net: the bright seams of a slowly drifting Voronoi field, as light through rippled ice.
  vec4 cv = voronoi(q * 0.06 + vec2(T * 0.25, -T * 0.18));
  float caus = smoothstep(0.12, 0.0, cv.y - cv.x);
  col += (vec3(0.85, 0.94, 1.0) * (0.06 + 0.45 * caus) + vec3(1.0, 0.85, 0.55) * 0.08) * band;
  return col;
}

// Outdoors → Photography. A camera iris: nine blades close over the plate while the light inside
// warms through sunset and overexposes; when they meet, a diffraction star flares; they open again
// onto the darkroom, which develops from a halftone screen through ordered dithering to full tone,
// the safelight blooming and nine-sided bokeh drifting through. p: the seam's progress (uH).
float irisOpen(float p) {
  return p < 0.5 ? 1.0 - smoothstep(0.16, 0.46, p) : smoothstep(0.54, 0.84, p);
}
vec3 groundIris(vec2 q, vec2 px, float p) {
  vec2 C = uRegion.zw * 0.5;
  float far = length(C) * 1.02;
  float open = irisOpen(p);
  bool closing = p < 0.5;
  float x = smoothstep(0.16, 0.46, p), dv = smoothstep(0.54, 0.86, p);
  vec3 light = closing ? mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 0.55, 0.3), x) : mix(DR_RED * 1.4, EMBER, 0.25);
  vec4 I = irisAt(q, C, far, open, light);
  float a = open * far * 1.15, r = length(q - C);
  vec3 inside;
  if (closing) {
    inside = sceneFolio(px);
    if (x > 0.0) {
      inside = mix(inside, inside * 0.5 + sunset(x * 0.7) * 0.7, x * 0.85);
      inside += vec3(1.0, 0.85, 0.6) * pow(x, 4.0) * exp(-r / (a + 20.0)) * 0.9;
    }
  } else {
    inside = develop(sceneDarkroom(px), q, dv);
    inside += DR_RED * 0.4 * exp(-r / (a * 0.7 + 30.0)) * (1.0 - dv) + bokeh(q, sin(PI * dv) * 0.9);
  }
  vec3 col = mix(I.rgb, inside, I.a);
  col += starburst(q, C, far, exp(-pow((p - 0.5) / 0.03, 2.0)), vec3(1.0, 0.92, 0.75));
  col += (hash(px + fract(T) * 31.0) - 0.5) * 0.05 * (1.0 - open);
  return col;
}

// Photography → Chess. Ink fingers climb from the foot and fork; behind them the developer clears
// into wash along a soft, granulating wet edge; the tray's red lingers in the dark side.
vec3 withBranches(int sb, vec3 col, Reach Rq, float P, float u, vec2 q, vec2 px) {
  Look L = branchLook(sb, Rq, P + BLEAD, px, vec2(uRegion.w - q.y, q.x));
  float fade = 1.0 - smoothstep(0.55, 1.0, u);
  return mix(col, L.c, L.m * fade) + L.glow * fade;
}
vec3 groundInk(vec2 q, vec2 px, float P) {
  Reach Rq; float u;
  bool live = seamReach(q, 1, P, Rq, u);
  vec3 col;
  if (u <= 0.0) col = sceneDarkroom(px);
  else if (u >= 1.0) col = sceneInk(px);
  else {
    float ub = u + (fbm3(q * 0.007 + vec2(0.0, T * 0.02)) - 0.5) * 0.6 * sin(PI * u);
    float w = smoothstep(0.42, 0.58, ub);
    vec3 dark = w < 1.0 ? sceneDarkroom(px) + DR_RED * smoothstep(0.1, 0.45, ub) * 0.16 : vec3(0.0);
    vec3 wash = w > 0.0 ? sceneInk(px) : vec3(0.0);
    if (w > 0.0) {
      float gran = 0.75 + 0.5 * noise(q * 0.35);
      float wet = exp(-max(ub - 0.5, 0.0) * 16.0);
      wash = mix(wash, INK_BLACK, clamp(wet * 0.8 * gran, 0.0, 0.9));
    }
    col = mix(dark, wash, w);
  }
  return live ? withBranches(1, col, Rq, P, u, q, px) : col;
}

vec3 transitGround(int a, vec2 q, vec2 px) {
  gCardMix = 0.0;
  float P = transitP(uH);
  if (a == 0) return groundCubes(q, px, P);
  if (a == 3) return groundCrystal(q, px, P);
  if (a == 2) return groundSheets(q, px, P);
  if (a == 4) return groundIris(q, px, uH);
  return groundInk(q, px, P);
}
`;
