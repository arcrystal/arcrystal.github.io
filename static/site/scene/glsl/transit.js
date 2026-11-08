// Transit grounds (mode 8): what lies under a seam's flying units. Wherever a point is at rest it is
// its live world, drawn exactly as the band beside it, so the strip has no edges. Only what moves
// or has been torn open reads the half-resolution snapshots (uTexA above, uTexB below). q is the
// point in the strip (CSS px, y down), px the same point on screen (for the worlds), F the front.
export const TRANSIT = /* glsl */ `
vec2 tUV(vec2 q) { return vec2(q.x / uRegion.z, 1.0 - q.y / uRegion.w); }
vec3 texA(vec2 q) { return texture(uTexA, tUV(q)).rgb; }
vec3 texB(vec2 q) { return texture(uTexB, tUV(q)).rgb; }

// Each seam is told apart by its process (flight.js, reach.js): a vortex for Science, crystal
// growth for Racing, peeling sheets for Outdoors, a camera iris for Photography, a branching reach of
// ink for Chess. P = transitP(p); uH is p itself.
const float BLEAD = 0.22;
// The ink's reach at a seam point, where it matters: false where the point's height alone says
// nothing has grown there yet (u = 0) or it settled long ago (u = 1).
bool seamReach(vec2 q, float P, out Reach Rq, out float u) {
  float rn = clamp(1.0 - q.y / uRegion.w, 0.0, 1.0);
  Rq = Reach(1e9, 1.0, 1.0, 1.0, 1.0);
  if (P + BLEAD < 0.4675 * rn - 0.01) { u = 0.0; return false; }
  if (P > 0.6325 * rn + 0.58) { u = 1.0; return false; }
  Rq = seamReachAt(q);
  u = flightAt(Rq.A, 0.5, P);
  return true;
}

// About Me → Science. A vortex stands up the middle of the screen, its base at the foot (right
// beneath About Me as the seam scrolls in), growing up the screen (flight.js vortexBand). Its base
// gathers the paper into cubes from the foot up; they swirl up the core and its top throws them out to
// land, mirrored, kd rows higher, building Science. A cell is paper until its cube leaves, then a
// shaded hollow in the paper, darkening only as the cube bound for it (from the mirror cell kd rows
// down, or from below the screen) comes in to land; Science once it has. The core glows from the
// base to the top.
vec3 groundCubes(vec2 q, vec2 px, float P) {
  ivec2 n = ivec2(uGrid.xy);
  ivec2 c = clamp(ivec2(floor(q / uGrid.zw)), ivec2(0), n - 1);
  vec2 S = uRegion.zw;
  int kd = vortexDrop(n.y);
  vec2 home = (vec2(c) + 0.5) * uGrid.zw;
  float uX = vortexU(vortexSeamA(home, S, vortexJit(home, vec2(c))), P);
  ivec2 sc = ivec2(n.x - 1 - c.x, c.y + kd);
  vec2 from = (vec2(sc) + 0.5) * uGrid.zw;
  float uY = vortexU(vortexSeamA(from, S, vortexJit(from, vec2(sc))), P);
  vec3 col;
  if (uX <= 0.0) col = sceneHouse(px);
  else if (uY >= 1.0) col = sceneCosmos(px);
  else {
    // The paper a shade darker where its cube has gone, until the cube bound for it lands.
    vec3 paper = sceneHouse(px);
    col = mix(paper, paper * 0.9, smoothstep(0.0, 0.12, uX));
  }
  vec2 band = vortexBand(P, S);
  float amt = smoothstep(band.x - 30.0, band.x + 140.0, q.y) * smoothstep(band.y + 30.0, band.y - 140.0, q.y)
            * smoothstep(0.0, 80.0, band.y - band.x);
  return col + vortexCore(q, S.x * 0.5, -1.0, vortexRc(S), amt);
}

// Science → Racing. Space liquefies and swirls (the vortex field, stirred by the fluid sim) while ice
// crystals nucleate across it from the foot of the screen and grow as six-armed stars until they
// meet (flight.js crystalAt, baked). Each crystal holds the world at its own tilt and slowly freezes
// through from space to glacier, its arms bright, glints running along them, a sheen crossing its
// facets and its grain boundaries lit prismatic. The ice covers the screen through the hold, then a
// last sweep up the screen flashes each crystal clear onto the glacier, just as Racing arrives.
vec2 flowBack(vec2 q, float amt, float t) {
  vec2 p = q;
  for (int i = 0; i < 4; i++) {
    vec2 v = swirl(p, t * 0.8);
    if (uSimOn > 0.5) v += texture(uSim, tUV(p)).xy * 0.006;
    p -= v * amt * 22.0;
  }
  return p;
}
vec3 crystalLook(vec4 X, vec2 q, float through) {
  vec2 tilt = (vec2(hash(vec2(X.z, 1.0)), hash(vec2(X.z, 2.0))) - 0.5) * 40.0;
  vec2 lens = (q - uRegion.zw * 0.5) * 0.04 * (X.z - 0.5);
  vec3 held = mix(texA(q + tilt + lens), texB(q + tilt * 0.4 + lens * 0.5), through);
  // Ice deepens what it holds toward glacier blue, so it reads over the white glacier too.
  vec3 ice = mix(held, vec3(luma(held)) * vec3(0.62, 0.8, 1.0) + vec3(0.04, 0.12, 0.24), 0.4 + 0.25 * through);
  ice *= 0.78 + 0.34 * X.z;
  ice += vec3(0.85, 0.95, 1.0) * X.x * 0.95;
  return ice;
}
vec3 groundCrystal(vec2 q, vec2 px, float P) {
  vec4 X = seamRaw(q);
  float A = X.w, age = P - A;
  // When the last sweep clears this crystal: from the foot of the screen to the top.
  float C = 0.93 + 0.17 * (1.0 - q.y / uRegion.w) + 0.03 * X.z;
  float gone = smoothstep(C, C + 0.04, P);
  if (gone >= 1.0) return sceneGlacier(px);
  float melt = smoothstep(-0.2, 0.0, age);
  if (melt <= 0.0) return sceneCosmos(px);
  vec3 col;
  if (age < 0.0) {
    vec2 lq = flowBack(q, melt, T);
    col = texA(lq) + spectrum(length(lq - q) * 0.012 + T * 0.05) * 0.08 * melt;
    col = mix(col, col * vec3(0.8, 0.92, 1.05) + vec3(0.02, 0.05, 0.08), melt * 0.5);
  } else {
    col = crystalLook(X, q, smoothstep(0.15, 0.6, age));
    // Glints: tiny facets along the arms catching the light in turn.
    float g = step(0.965, hash(floor(q * 0.45))) * pow(0.5 + 0.5 * sin(T * (5.0 + 9.0 * hash(floor(q * 0.45) + 3.0)) + X.z * 40.0), 10.0);
    col += vec3(0.95, 0.98, 1.0) * g * (0.3 + 1.6 * X.x) * smoothstep(0.0, 0.05, age);
    // A sheen crossing the facets, each crystal at its own angle.
    float sh = sin(dot(q, vec2(0.0087, 0.005)) * (0.8 + X.z) - T * 1.1 + X.z * 9.0);
    col += vec3(0.8, 0.92, 1.0) * pow(max(sh, 0.0), 14.0) * 0.22;
  }
  float front = exp(-abs(age) * 70.0);
  col += vec3(0.75, 0.92, 1.0) * front * 0.85 + spectrum(age * 12.0 + X.z) * front * 0.25;
  // Grain boundaries: lit prismatic, brightest as the crystals meet, staying lit while the ice holds.
  float gb = X.y * step(0.0, age) * (0.45 + 0.55 * exp(-age * 12.0));
  col += (spectrum(q.x * 0.004 + q.y * 0.003 + T * 0.08) * 0.35 + vec3(0.85, 0.97, 1.0) * 0.45) * gb;
  // The last sweep: each crystal flashes as it clears.
  col = mix(col, sceneGlacier(px), gone) + vec3(0.9, 0.97, 1.0) * exp(-abs(P - C - 0.02) * 55.0) * 0.6 * (1.0 - gone * 0.5);
  return col;
}

// Racing → Outdoors. Three layers of sheets peel from the foot of the screen up (flight.js sheetAt):
// the glacier's ice, then a topographic trail map, then tracing vellum, then the Outdoors page. Here
// is whichever layer still lies at each point: the ice cracking along its sheets' edges as the sweep
// nears, each layer's own face with the seams between its sheets, and under a sheet curling away the
// shade of its fold and the light it focuses, a shimmering caustic net. The sheets that peel and fly
// are units.js sheets.
vec3 underFold(vec3 col, SheetAt a, vec2 q) {
  if (a.u <= 0.0 || a.s <= a.f) return col;
  float L = a.g.w, R = L * 0.12, fly = sheetFly(a.u);
  float past = (a.s - a.f) * L;
  col *= 1.0 - 0.5 * exp(-past / (R * 2.2)) * (1.0 - fly);
  float band = exp(-past / (4.0 * R)) * (1.0 - exp(-past / R)) * (1.0 - fly);
  vec4 cv = voronoi(q * 0.06 + vec2(T * 0.25, -T * 0.18));
  float caus = smoothstep(0.12, 0.0, cv.y - cv.x);
  return col + (vec3(0.85, 0.94, 1.0) * (0.06 + 0.45 * caus) + vec3(1.0, 0.85, 0.55) * 0.08) * band;
}
float sheetSeam(SheetAt a) {
  float e = min(min(a.s, 1.0 - a.s) * a.g.w, min(a.w, 1.0 - a.w) * a.g.z);
  return smoothstep(1.6, 0.0, e);
}
vec3 sheetFace(int k, vec2 q, vec2 px, SheetAt a) {
  if (k == 0) {
    vec3 col = sceneGlacier(px);
    float pre = smoothstep(-0.7, 0.0, a.raw) * step(a.raw, 0.0);
    if (pre > 0.0) {
      float e = min(min(a.s, 1.0 - a.s) * a.g.w, min(a.w, 1.0 - a.w) * a.g.z);
      col = mix(col, vec3(0.42, 0.62, 0.86), smoothstep(1.4, 0.0, e) * pre * 0.4);
      col += vec3(0.9, 0.97, 1.0) * smoothstep(5.0, 2.0, e) * smoothstep(1.2, 2.0, e) * pre * 0.18;
      col += vec3(0.95, 0.98, 1.0) * step(0.985, hash(floor(q * 0.5))) * smoothstep(8.0, 0.0, e) * pre * (0.5 + 0.5 * sin(T * 7.0 + q.x));
    }
    return col;
  }
  vec3 col = k == 1 ? topoMap(q) : vellum(sceneFolio(px), q);
  return col * (1.0 - 0.22 * sheetSeam(a));
}
vec3 groundSheets(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  SheetAt above;
  for (int k = 0; k < SHEET_LAYERS; k++) {
    SheetAt a = sheetAt(k, q, S, P);
    if (sheetHere(a)) {
      vec3 col = sheetFace(k, q, px, a);
      return k > 0 ? underFold(col, above, q) : col;
    }
    above = a;
  }
  return underFold(sceneFolio(px), above, q);
}

// Outdoors → Photography. The page is exposed onto film and pulled away strip by strip (flight.js
// film): on the table each strip is the Outdoors page until a flash crosses it and it turns to a
// negative with sprocket holes; then it is pulled off from one end (units.js film). Where it has gone
// the Photography page develops in the tray: ripples spread from the line where the film lifts, the
// safelight glows, and the print comes up from a halftone screen through ordered dither to full tone.
// The prints in the tray: the film's frames printed positive, white-bordered, each a little askew,
// laid in a loose grid. Each comes up from blank paper through a halftone screen and dither to full
// tone (develop) once the film has left its place, and dissolves near the end. rgb: the print; a: 1 on
// a print, a soft shadow just outside it.
vec4 filmPrint(vec2 q, vec2 S, float P) {
  vec2 cell = vec2(236.0, 172.0);
  vec2 c0 = floor(q / cell);
  vec4 o = vec4(0.0);
  vec4 g = filmGrid(S);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = c0 + vec2(float(i), float(j));
    float h1 = hash(c + 1.9), h2 = hash(c + 4.7), h3 = hash(c + 8.3);
    vec2 ctr = (c + 0.5 + (vec2(h1, h2) - 0.5) * 0.35) * cell;
    float ang = (h3 - 0.5) * 0.2;
    vec2 lp = rot(-ang) * (q - ctr);
    vec2 half_ = vec2(98.0, 70.0);
    vec2 e = abs(lp) - half_;
    float sd = max(e.x, e.y);
    // When its place was uncovered, from its strip's pull.
    int r = clamp(int(floor(ctr.y / g.w)), 0, int(g.y) - 1);
    float A = filmA(r, g, S), side = filmSide(r);
    float l = side > 0.0 ? ctr.x : S.x - ctr.x;
    float Pu = A - 0.2 + 0.5 * pow(clamp(l / (S.x + 700.0), 0.0, 1.0), 1.0 / 1.6);
    float dv = smoothstep(Pu + 0.03, Pu + 0.3, P);
    float gone = smoothstep(0.9 + 0.05 * h1, 0.99 + 0.03 * h1, P);
    float show = step(Pu + 0.02, P) * (1.0 - gone);
    if (show <= 0.0) continue;
    if (sd < 0.0) {
      vec3 col;
      if (min(-e.x, -e.y) < 8.0) col = vec3(0.92, 0.9, 0.86);
      else col = develop(texA(ctr + lp * 1.35) * 1.1, q, dv);
      col = mix(vec3(0.93, 0.91, 0.87), col, smoothstep(0.0, 0.12, dv) * 0.9 + 0.1);
      o = vec4(col * (0.8 + 0.2 * smoothstep(-40.0, 0.0, lp.y)), show);
    } else if (o.a < 0.5) {
      o.a = max(o.a, exp(-sd / 10.0) * 0.5 * show);
    }
  }
  return o;
}
vec3 groundFilm(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  vec4 g = filmGrid(S);
  int r = clamp(int(floor(q.y / g.w)), 0, int(g.y) - 1);
  float A = filmA(r, g, S), u = filmU(A, P), side = filmSide(r);
  float l = side > 0.0 ? q.x : S.x - q.x;
  float pulled = filmPulled(u, S.x);
  if (l >= pulled) {
    float neg = filmNeg(A, P);
    vec3 col = sceneFolio(px);
    if (neg > 0.0) {
      vec4 f = filmLook(col, q, g.w, neg);
      col = f.a > 0.5 ? vec3(0.03, 0.01, 0.01) : f.rgb;
    }
    // The exposure: a flash crossing the strip from its far end.
    float fl = exp(-pow((P - A + 0.24 - 0.03 * (1.0 - l / S.x)) / 0.012, 2.0));
    col += vec3(1.0, 0.9, 0.75) * fl * 0.9;
    // The shadow of the film lifting off just ahead.
    if (pulled > 0.0) col *= 1.0 - 0.45 * exp(-(l - pulled) / 26.0);
    return col;
  }
  // Uncovered: the tray. The developer ripples out from where the film lifts, under the safelight, and
  // the frames come up in it as prints (filmPrint), until they dissolve into the Photography page as
  // it arrives.
  float d = pulled - l;
  vec3 col = sceneDarkroom(px);
  col += DR_RED * (0.1 + 0.18 * (0.5 + 0.5 * sin(d * 0.07 - T * 5.0)) * exp(-d / 260.0));
  vec4 pr = filmPrint(q, S, P);
  col = mix(col * (1.0 - 0.55 * pr.a), pr.rgb, step(0.5, pr.a) * pr.a) + bokeh(q, 0.35 * (1.0 - smoothstep(0.85, 1.0, P)));
  return col;
}


// Photography → Chess. Ink fingers climb from the foot and fork; around them the ink billows into the
// water in clouds (inkVolume: domain-warped noise, thickest near the branches, growing as they do);
// behind them the developer clears into wash along a soft, granulating wet edge; the tray's red
// lingers in the dark side. The ink stays until the end and lets go as Chess arrives.
// Done before the strip's foot comes on screen above Chess (P 1.02, the earliest, on a phone).
float inkLetGo(float P) { return 1.0 - smoothstep(0.86, 1.02, P); }
vec3 inkVolume(vec3 col, Reach Rq, vec2 q, float P) {
  float grown = smoothstep(Rq.tb, Rq.tb + 0.22, P + BLEAD);
  if (grown <= 0.0) return col;
  float near = exp(-max(Rq.d - Rq.w, 0.0) / (18.0 + 34.0 * grown));
  vec2 wq = q * 0.0052 + vec2(0.0, -T * 0.02);
  wq += vec2(fbm3(wq * 1.7 + T * 0.03), fbm3(wq * 1.7 + 5.2 - T * 0.025)) * 0.9;
  float b = fbm3(wq);
  float dens = grown * smoothstep(0.4, 0.95, near + (b - 0.5) * 0.9) * inkLetGo(P) * 0.45;
  vec3 ink = mix(INK_INDIGO, INK_BLACK, smoothstep(0.3, 0.9, near)) * (0.9 + 0.2 * b);
  return mix(col, ink, dens);
}
vec3 groundInk(vec2 q, vec2 px, float P) {
  Reach Rq; float u;
  bool live = seamReach(q, P, Rq, u);
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
  if (P > 1.02) return col;
  // Settled points still carry their ink until it lets go.
  if (!live && u >= 1.0) Rq = seamReachAt(q);
  if (u <= 0.0 && !live) return col;
  col = inkVolume(col, Rq, q, P);
  Look L = branchLook(Rq, P + BLEAD, px);
  float keep = inkLetGo(P);
  return mix(col, L.c, L.m * keep) + L.glow * keep;
}

vec3 transitGround(int a, vec2 q, vec2 px) {
  gCardMix = 0.0;
  float P = transitP(uH);
  if (a == 0) return groundCubes(q, px, P);
  if (a == 3) return groundCrystal(q, px, P);
  if (a == 2) return groundSheets(q, px, P);
  if (a == 4) return groundFilm(q, px, P);
  return groundInk(q, px, P);
}
`;
