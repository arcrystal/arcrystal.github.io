// Click to expand. cover(): from the clicked link or card the destination's own process plays out
// across the whole screen, the old page showing through until it is covered (premultiplied alpha).
// reveal(): on the new page, the same process lets go onto its scene. Each style by its process:
//   0 About Me, Résumé, Contact  a maze carved by depth-first backtracking from the click
//   1 Chess                      ink: a branching reach of soft fingers
//   2 Racing                     crystal growth: six-armed ice stars nucleating and meeting
//   3 Science                    a Hilbert curve: cubes flipping up in the order one line snakes past
//   4 Outdoors                   sheets unrolling, gilt rolls travelling across brick-laid panes
//   5 Photography                a camera iris, then the print developing (halftone, dither, tone)
// uH = 1: fog (fbm), for steps through history. A click's reach, crystals or maze are baked once
// per click by transit.js (uBaked, in uReach); without them the cover computes what it can.
export const OPENS = /* glsl */ `
uniform float uBaked;
vec2 cardCentre() { return uCard.z > 0.0 ? uCard.xy + uCard.zw * 0.5 : R * 0.5; }
float cardSd(vec2 px) { return uCard.z > 0.0 ? sdBox(px - cardCentre(), uCard.zw * 0.5, uCardR) : length(px - R * 0.5) - 40.0; }
vec4 bakedAt(vec2 px) { return textureLod(uReach, vec2(px.x / R.x, 1.0 - px.y / R.y), 0.0); }
Reach clickReach(vec2 px, vec2 O, float far, int s) {
  if (uBaked < 0.5) return reachPolar(px, O, far, s, 0.0);
  vec4 t = bakedAt(px);
  return Reach(t.x * 64.0, t.y * 24.0, t.z, t.w, 1.0);
}
vec3 frostAt(vec2 px) {
  vec4 v = voronoi(px * 0.03);
  vec3 c = vec3(0.925, 0.96, 0.982) + (hash(v.zw) - 0.5) * 0.045;
  c += smoothstep(0.07, 0.0, v.y - v.x) * 0.05;
  c += smoothstep(0.985, 1.0, noise(px * 0.4)) * 0.25;
  return c;
}

// ---- 0: a maze --------------------------------------------------------------------------------------
// transit.js carves it on the CPU (lerp.js carveMaze) and bakes, per cell: its visit order (16 bits
// in r, g) and the side it was entered from (b: 0 the start, 1 left, 2 right, 3 above, 4 below). The
// corridors open in visit order, so the carving runs down long winding passages and backs up
// out of dead ends; behind it they fill with paper, inked at their walls, and last the walls fill.
const float MCELL = 34.0;
vec2 mazeCell(ivec2 c, ivec2 n) {
  if (c.x < 0 || c.y < 0 || c.x >= n.x || c.y >= n.y) return vec2(2.0, -1.0);
  vec4 t = texelFetch(uReach, c, 0);
  return vec2((floor(t.r * 255.0 + 0.5) * 256.0 + floor(t.g * 255.0 + 0.5)) / 65535.0, floor(t.b * 255.0 + 0.5));
}
// x: signed distance (px) to the carved corridor here at time E; y: when this point was carved.
vec2 mazeAt(vec2 px, float E) {
  ivec2 n = textureSize(uReach, 0);
  ivec2 c = ivec2(floor(px / MCELL));
  vec2 l = (px / MCELL - vec2(c) - 0.5) * MCELL;
  vec2 me = mazeCell(c, n);
  float hw = MCELL * 0.3;
  float tc = 0.04 + 0.76 * me.x;
  float sd = 1e9, when = 2.0;
  if (E > tc) { sd = sdBox(l, vec2(hw), 2.0); when = tc; }
  // Passages: to the cell it came from, and to each cell that came from it.
  for (int k = 0; k < 4; k++) {
    ivec2 o = k == 0 ? ivec2(-1, 0) : k == 1 ? ivec2(1, 0) : k == 2 ? ivec2(0, -1) : ivec2(0, 1);
    vec2 nb = mazeCell(c + o, n);
    float into = k == 0 ? 2.0 : k == 1 ? 1.0 : k == 2 ? 4.0 : 3.0;   // nb entered from me
    float back = k == 0 ? 1.0 : k == 1 ? 2.0 : k == 2 ? 3.0 : 4.0;   // I entered from nb
    float t = me.y == back ? tc : nb.y == into ? 0.04 + 0.76 * nb.x : 2.0;
    if (t > 1.5 || E <= t) continue;
    vec2 dir = vec2(o);
    float d = sdBox(l - dir * MCELL * 0.25, abs(dir) * MCELL * 0.25 + (1.0 - abs(dir)) * hw, 0.0);
    if (d < sd) { sd = d; when = min(when, t); }
  }
  return vec2(sd, when);
}
vec4 mazeCover(vec2 px, float E) {
  if (uBaked < 0.5) { float a = smoothstep(0.0, 1.0, E); return vec4(sceneOf(0, px) * a, a); }
  vec2 M = mazeAt(px, E);
  vec3 paper = sceneOf(0, px);
  float inkW = 1.3;
  float corridor = smoothstep(0.5, -0.5, M.x);
  float wall = smoothstep(0.88 + 0.08 * hash(floor(px / MCELL)), 1.0, E);
  float line = smoothstep(inkW + 0.6, inkW - 0.4, abs(M.x)) * step(M.y, 1.5);
  vec3 col = paper * max(corridor, wall);
  float a = max(corridor, wall);
  col = mix(col, vec3(0.16, 0.16, 0.19), line * 0.9);
  a = max(a, line * 0.9);
  // The carving's head: a warm nib of light where a corridor has just opened.
  vec3 glow = vec3(1.0, 0.7, 0.35) * exp(-max(E - M.y, 0.0) * 120.0) * step(M.y, 1.5) * exp(-max(M.x, 0.0) / 6.0) * 0.8;
  return vec4(col + glow, a);
}

// ---- 3: cubes along a Hilbert line ---------------------------------------------------------------
// The screen's blocks in the order a Hilbert curve visits them, starting at the corner nearest the
// click; each cell of cubes flips up (a chrome side turning away as a face of space turns toward
// you) as the line reaches it, and a liquid-chrome snake leads.
const float CUBE = 14.0;
vec2 hFlip(vec2 q, vec2 O) { return vec2(O.x > R.x * 0.5 ? R.x - q.x : q.x, O.y < R.y * 0.5 ? R.y - q.y : q.y); }
vec4 cubeFill(vec2 px, vec2 O, float E) {
  vec2 cell = floor(px / CUBE);
  vec2 cc = (cell + 0.5) * CUBE;
  float A = 0.82 * hIndex(hBlock(hFlip(cc, O), R), R);
  float h = hash(cell + 0.37);
  float f = clamp((E - A) / 0.07 + (h - 0.5) * 0.3, 0.0, 1.0);
  if (f <= 0.0) return vec4(0.0);
  vec2 l = px / CUBE - cell - 0.5;
  bool alongX = h > 0.5;
  float la = alongX ? l.x : l.y, lo = alongX ? l.y : l.x;
  float phi = (1.0 - f) * PI * 0.5;
  float cw = cos(phi), sw = sin(phi);
  float x = (la + 0.5) * (cw + sw);
  float g = 0.5 * (0.84 + 0.16 * f);
  if (abs(lo) > g || x > cw + sw) return vec4(0.0);
  if (x < sw) return vec4(cosmosMetal(normalize(alongX ? vec3(-cw, 0.0, sw) : vec3(0.0, -cw, sw))) * 0.9, 1.0);
  return vec4(sceneCosmos(px) * (0.55 + 0.45 * cw) + spectrum(f + h) * 0.12 * (1.0 - f), 1.0);
}

// ---- 2: crystals ----------------------------------------------------------------------------------
vec4 crystalsAt(vec2 px, vec2 O, float far) { return uBaked > 0.5 ? bakedAt(px) : crystalAt(px, R, true, O, far); }
vec3 iceOf(vec4 X, vec2 px, vec3 world) {
  vec3 ice = mix(world, frostAt(px + X.z * 300.0), 0.55);
  ice *= 0.86 + 0.28 * X.z;
  return ice + vec3(0.85, 0.95, 1.0) * X.x * 0.5;
}

// ---- 4: sheets -------------------------------------------------------------------------------------
// Brick-laid panes over the screen, five rows. Each unrolls from its top edge down, laying the
// folio's plate as a gilt roll travels across it, one corner leading; the panes go in rings from the
// click. x: how far laid (1 = this point is covered); rgb: the roll, if it is here.
vec4 sheetUnroll(vec2 px, vec2 O, float far, float E, out float laid) {
  vec4 g = vec4(0.0, 5.0, 0.0, R.y / 5.0);
  g.z = R.x / max(3.0, floor(R.x / g.w + 0.5));
  g.x = R.x / g.z;
  ivec2 c = paneCell(px, g);
  vec2 ctr = paneCentre(c, g);
  float A = 0.7 * clamp(length(ctr - O) / far, 0.0, 1.0) + 0.06 * hash(vec2(c) + 0.61);
  float lp = clamp((E - A) / 0.26, 0.0, 1.0);
  float L = g.w, Rr = L * 0.08;
  float s = clamp((ctr.y + L * 0.5 - px.y) / L, 0.0, 1.0), w = clamp((px.x - ctr.x) / g.z + 0.5, 0.0, 1.0);
  float f = clamp(1.0 - lp * 1.5 + 0.5 * mix(w, 1.0 - w, step(0.5, hash(vec2(c) + 2.9))), 0.0, 1.0);
  laid = lp >= 1.0 ? 1.0 : step(f, s);
  // The roll: a cylinder lying across the pane at f, its gilt underside lit by the lantern.
  float t = (f - s) * L / (2.0 * Rr);
  if (lp <= 0.0 || lp >= 1.0 || t < 0.0 || t > 1.0) return vec4(0.0);
  float an = PI * t;
  vec3 n = normalize(vec3(0.0, cos(an), sin(an)));
  float dif = max(dot(n, normalize(vec3(0.35, -0.55, 0.75))), 0.0);
  float spec = pow(max(dot(n, normalize(vec3(0.2, -0.3, 1.0))), 0.0), 40.0);
  vec3 gold = mix(vec3(0.3, 0.2, 0.08), vec3(1.0, 0.8, 0.45), 0.25 + 0.75 * dif) + vec3(1.0, 0.94, 0.8) * spec;
  return vec4(gold, 1.0);
}

// ---- fog -------------------------------------------------------------------------------------------
float fogField(vec2 px) {
  float edge = length((px - R * 0.5) / (R * 0.5)) * 0.7071;
  return clamp(fbm3(px * 0.0026 + vec2(T * 0.06, -T * 0.04)) * 0.7 + (1.0 - edge) * 0.45 - 0.1, 0.0, 1.0);
}
vec3 fogged(int s, vec2 px) {
  vec3 w = sceneOf(s, px);
  return mix(w, vec3(luma(w)) * 1.15 + 0.1, 0.55);
}

vec4 cover(int s, vec2 px, float e) {
  if (uH > 0.5) {
    float c = smoothstep(fogField(px) - 0.14, fogField(px) + 0.02, e * 1.3 - 0.15);
    return vec4(fogged(s, px) * c, c);
  }
  vec2 O = cardCentre();
  float far = farCorner(O) * 1.02;
  float E = e * 1.04;
  if (s == 0) return mazeCover(px, E);
  if (s == 1) {
    Reach Rr = clickReach(px, O, far, 1);
    float fill = max(smoothstep(Rr.A - 0.035, Rr.A, E), smoothstep(0.0, 0.1, E) * step(cardSd(px), 0.0));
    vec3 f = mix(sceneOf(1, px), INK_BLACK, 0.18 + 0.1 * noise(px * 0.01));
    vec4 o = vec4(f * fill, fill);
    Look L = branchLook(1, Rr, E, px, vec2(length(px - O), 0.0));
    return vec4(mix(o.rgb, L.c, L.m), mix(o.a, 1.0, L.m));
  }
  if (s == 2) {
    vec4 X = crystalsAt(px, O, far);
    float age = E - X.w;
    float fz = smoothstep(0.0, 0.012, age);
    vec3 col = iceOf(X, px, sceneOf(2, px)) * fz;
    col += vec3(0.85, 0.95, 1.0) * X.y * fz * 0.6;
    float front = exp(-abs(age) * 80.0);
    col += (vec3(0.7, 0.9, 1.0) * 0.8 + spectrum(age * 10.0 + X.z) * 0.25) * front;
    // A cold haze runs just ahead of the ice.
    float haze = smoothstep(-0.1, 0.0, age) * (1.0 - fz) * 0.18;
    return vec4(col + vec3(0.8, 0.9, 1.0) * haze, max(fz, haze));
  }
  if (s == 3) {
    vec4 o = cubeFill(px, O, E);
    Look L = hilbertSnake(hFlip(px, O), R, E / 0.82 + 0.02, 0.25, px);
    return vec4(mix(o.rgb, L.c, L.m) + L.glow, max(o.a, L.m));
  }
  if (s == 4) {
    float laid;
    vec4 roll = sheetUnroll(px, O, far, E, laid);
    vec3 col = sceneOf(4, px) * laid;
    float a = laid;
    col = mix(col, roll.rgb, roll.a);
    a = max(a, roll.a);
    return vec4(col, a);
  }
  // 5: the iris closes on the click as the light inside warms and overexposes.
  float open = 1.0 - smoothstep(0.0, 1.0, e);
  vec3 light = mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 0.55, 0.3), e);
  vec4 I = irisAt(px, O, far, open, light);
  float r = length(px - O), a = open * far * 1.15;
  vec3 warm = sunset(e * 0.6) * pow(e, 3.0) * exp(-r / (a + 30.0)) * 0.6;
  vec3 col = I.rgb * (1.0 - I.a) + warm * I.a + starburst(px, O, far, smoothstep(0.85, 1.0, e), light);
  return vec4(col, 1.0 - I.a);
}

vec3 reveal(int s, vec2 px, float e) {
  vec3 scene = sceneOf(s, px);
  if (uH > 0.5) {
    float c = 1.0 - smoothstep(fogField(px) - 0.02, fogField(px) + 0.14, e * 1.3 - 0.15);
    return mix(scene, fogged(s, px), c);
  }
  vec2 O = uPoint;
  float far = farCorner(O) * 1.02;
  if (s == 0) {
    // The maze's ink lines fade, the last carved first.
    if (uBaked < 0.5) return scene;
    vec2 M = mazeAt(px, 1.04);
    float t = 0.75 * (1.0 - (M.y - 0.04) / 0.76);
    float line = smoothstep(1.9, 0.9, abs(M.x)) * (1.0 - smoothstep(t, t + 0.12, e));
    return mix(scene, vec3(0.16, 0.16, 0.19), line * 0.9);
  }
  if (s == 1) {
    float E = (1.0 - e) * 1.04;
    Reach Rr = clickReach(px, O, far, 1);
    float keep = smoothstep(Rr.A - 0.035, Rr.A, E);
    vec3 col = mix(scene, mix(scene, INK_BLACK, 0.18 + 0.1 * noise(px * 0.01)), keep);
    Look L = branchLook(1, Rr, E, px, vec2(0.0));
    return mix(col, L.c, L.m);
  }
  if (s == 2) {
    // Each crystal flashes and clears, in its own time.
    vec4 X = crystalsAt(px, O, far);
    float ct = 0.1 + 0.65 * X.z;
    float clear = smoothstep(ct, ct + 0.1, e);
    vec3 col = mix(iceOf(X, px, scene) + vec3(0.85, 0.95, 1.0) * X.y * 0.6, scene, clear);
    return col + vec3(0.9, 0.97, 1.0) * exp(-abs(e - ct) * 40.0) * 0.4;
  }
  if (s == 3) {
    // The line's tail drains away over the new page.
    Look L = hilbertSnake(hFlip(px, O), R, 1.0 + e * 0.32, 0.25, px);
    return mix(scene, L.c, L.m) + L.glow;
  }
  if (s == 4) {
    // The panes' gilt seams catch the light once more, then fade.
    vec4 g = vec4(0.0, 5.0, 0.0, R.y / 5.0);
    g.z = R.x / max(3.0, floor(R.x / g.w + 0.5));
    g.x = R.x / g.z;
    ivec2 c = paneCell(px, g);
    vec2 l = px - (paneCentre(c, g) - g.zw * 0.5);
    float edge = min(min(l.x, g.z - l.x), min(l.y, g.w - l.y));
    float sweep = exp(-pow((px.x + px.y * 0.6) / (R.x + R.y * 0.6) - e * 1.4 + 0.2, 2.0) * 60.0);
    return scene + BRASS * smoothstep(1.5, 0.0, edge) * (1.0 - e) * 0.6 + vec3(1.0, 0.9, 0.7) * sweep * smoothstep(3.0, 0.0, edge) * 0.5;
  }
  // 5: the iris opens from the click onto the darkroom, which develops as it goes.
  float open = smoothstep(0.0, 0.85, e);
  vec3 light = mix(DR_RED * 1.4, EMBER, 0.25);
  vec4 I = irisAt(px, O, far, open, light);
  float r = length(px - O), a = open * far * 1.15;
  vec3 inside = develop(scene, px, smoothstep(0.1, 1.0, e)) + DR_RED * 0.4 * exp(-r / (a * 0.7 + 30.0)) * (1.0 - e) + bokeh(px, sin(PI * e) * 0.8);
  return mix(I.rgb, inside, I.a) + starburst(px, O, far, 1.0 - smoothstep(0.0, 0.15, e), vec3(1.0, 0.92, 0.75));
}
`;

export const MAIN = /* glsl */ `
void main() {
  R = uView;
  T = uTime;
  PTR = uPointer;
  gCardMix = uCardMix;
  vec2 px0 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr + uOrigin;
  // Scrolling fast smears the scene a little along the direction of travel.
  vec2 px = px0 + vec2(0.0, clamp(uVel, -3.0, 3.0) * 14.0 * (noise(px0 * 0.008 + T) - 0.5));
  vec4 o;
  if (uMode == 0) {
    o = vec4(sceneOf(uA, px), 1.0);
    // A band's arrival: a prismatic sheen sweeps across its world once (uE 0..1).
    if (uE > 0.0 && uE < 1.0) {
      float s = (px.x + (px.y - uRegion.y) * 0.6) / (R.x + uRegion.w * 0.6);
      float w = exp(-pow((s - mix(-0.25, 1.25, uE)) / 0.08, 2.0));
      o.rgb = o.rgb * mix(vec3(1.0), 0.8 + 0.4 * spectrum(s * 1.6 + uE), w * 0.55) + w * 0.05;
    }
  }
  else if (uMode == 2) o = cover(uA, px, uE);
  else if (uMode == 3) o = vec4(reveal(uA, px, uE), 1.0);
  else if (uMode == 4) o = vec4(sceneOf(uA, px), 1.0) * uE;
  else if (uMode == 6) o = vec4(seam(uA, uB, px), 1.0);
  else if (uMode == 7) o = vec4(heroScene(px), 1.0);
  else if (uMode == 8) o = vec4(transitGround(uA, px0 - uRegion.xy, px), 1.0);
  else o = vec4(mix(sceneOf(uA, px), sceneOf(uB, px), smoothstep(0.3, 0.7, uH)), 1.0);
  o.rgb += (hash(gl_FragCoord.xy + fract(T) * 17.0) - 0.5) / 255.0 * o.a;
  outColor = o;
}
`;
