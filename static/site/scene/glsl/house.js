// House: warm paper, and on the homepage the crystal. It is a flat hexagonal gem whose six outer
// facets are windows onto the six destinations, in the order the sentence and the bands follow,
// each refracted toward its own corner of its world, around a pale table, with prism edges, a soft
// shadow and a little spectrum cast on the paper. Pointing at a phrase (uHover) fills the whole gem
// with that world (uE), spreading from its facet behind a prismatic front.
export const HOUSE = /* glsl */ `
const vec3 PAPER = vec3(0.957, 0.949, 0.933);
const float SECTOR = TAU / 6.0;

vec3 housePaper(vec2 px) {
  float g = noise(px * 0.9) * 0.6 + noise(px * 0.23) * 0.4;
  return PAPER * (0.988 + 0.024 * (g - 0.5));
}

// About Me's world: paper ruled with the AI Power Map's ticks, one of them iridescent.
vec3 aboutWorld(vec2 px) {
  vec3 col = housePaper(px);
  float x = px.x / 7.0;
  float id = floor(x);
  float base = R.y * 0.64;
  float h = 24.0 + 150.0 * pow(hash(vec2(id, 1.0)), 2.0);
  float tick = step(fract(x), 0.26) * step(base - h, px.y) * step(px.y, base);
  float hot = max(step(0.985, hash(vec2(id, 4.0))), step(0.72, hash(vec2(id, 4.0))) * uPtrOn * smoothstep(150.0, 20.0, abs(px.x - PTR.x)));
  col = mix(col, mix(vec3(0.12), spectrum(px.y * 0.004 + T * 0.05) * 0.8, hot), tick * 0.8);
  col = mix(col, vec3(0.08), smoothstep(1.2, 0.0, abs(px.y - base - 3.0)) * 0.4);
  return col;
}

// Facet k's world: About Me, Science, Racing, Outdoors, Photography, Chess.
vec3 sceneRoom(int k, vec2 px) {
  if (k == 0) return aboutWorld(px);
  if (k == 1) return sceneCosmos(px);
  if (k == 2) return sceneGlacier(px);
  if (k == 3) return sceneFolio(px);
  if (k == 4) return sceneDarkroom(px);
  return sceneInk(px);
}

// Where each facet looks into its world: a point that shows it at its best.
vec2 roomFocus(int k) {
  if (k == 0) return R * vec2(0.5, 0.6);
  if (k == 1) return R * vec2(0.74, 0.34);
  if (k == 2) return R * vec2(0.5, 0.42);
  if (k == 3) return R * vec2(0.14, 0.78);
  if (k == 4) return R * vec2(0.5, 0.82);
  return R * vec2(0.62, 0.6);
}

float crystalTilt() { return 0.04 * sin(T * 0.13); }

vec2 facetCentroid(int k, vec3 cr) {
  float phi = crystalTilt() + (float(k) + 0.5) * SECTOR;
  return cr.xy + vec2(sin(phi), -cos(phi)) * cr.z * 0.866 * 0.71;
}

// The crystal at p (cr: centre and radius). fillK, fill: the world that fills the gem, and how far.
vec3 crystal(vec2 p, vec3 cr, int fillK, float fill) {
  vec2 d = p - cr.xy;
  float tilt = crystalTilt();
  float ang = mod(atan(d.x, -d.y) - tilt, TAU);
  int k = int(floor(ang / SECTOR));
  float phi = tilt + (float(k) + 0.5) * SECTOR;
  vec2 nk = vec2(sin(phi), -cos(phi));
  float apo = cr.z * 0.866;
  float dn = dot(d, nk);
  float lw = 1.1 + 2.2 * fill;
  vec3 col = housePaper(p);
  // The shadow, and the spectrum it casts.
  vec2 ds = d - vec2(16.0, 26.0);
  float a2 = mod(atan(ds.x, -ds.y) - tilt, TAU);
  float ph2 = tilt + (floor(a2 / SECTOR) + 0.5) * SECTOR;
  float sdP = dot(ds, vec2(sin(ph2), -cos(ph2))) - apo;
  col *= 1.0 - 0.13 * smoothstep(60.0, -20.0, sdP);
  float ca = atan(d.x, -d.y);
  float wedge = smoothstep(0.32, 0.0, abs(ca + 2.3)) * smoothstep(cr.z * 0.95, cr.z * 1.4, length(d)) * smoothstep(cr.z * 3.2, cr.z * 1.6, length(d));
  col = mix(col, col * (0.82 + 0.3 * spectrum((ca + 2.3) * 1.6 + 0.1)), wedge * 0.55);
  if (dn > apo + lw * 2.0) return col;
  // Inside the gem: the table, or a facet's window.
  float tableR = apo * 0.42;
  vec3 g;
  if (dn < tableR) {
    g = mix(vec3(0.985), spectrum(ang / TAU * 2.0 + T * 0.03), 0.14);
    g *= 0.96 + 0.04 * noise(p * 0.05);
  } else {
    vec2 c = facetCentroid(k, cr);
    float zoom = 2.3 * R.y / (cr.z * 3.0);
    g = sceneRoom(k, roomFocus(k) + (p - c) * zoom + nk * 18.0);
    float lightK = dot(nk, normalize(vec2(-0.55, -0.83))) * 0.5 + 0.5;
    g *= 0.9 + 0.16 * lightK;
    g += (1.0 - (dn - tableR) / (apo - tableR)) * 0.05;
  }
  // The chosen world floods the gem from its facet, behind a prismatic front.
  float flood = 0.0, front = 1e3;
  if (fillK >= 0 && fill > 0.001) {
    vec2 fc = facetCentroid(fillK, cr);
    float dist = length(p - fc) / (cr.z * 1.9) + (noise(p * 0.03 + T * 0.2) - 0.5) * 0.12;
    float r = fill * 1.25;
    front = (dist - r) * cr.z * 1.9;
    flood = smoothstep(1.5, -1.5, front);
    if (flood > 0.0) {
      float zoomAll = 1.25 * R.y / (cr.z * 2.0);
      vec3 w = sceneRoom(fillK, R * 0.5 + (p - cr.xy) * zoomAll);
      g = mix(g, w * (1.0 + 0.06 * (1.0 - dn / apo)), flood);
    }
  }
  // Edges: the six spokes, the table rim and the outline, white with a prism fringe. Inside the
  // flood only the outline stays.
  float spoke = length(d) * sin(min(mod(ang, SECTOR), SECTOR - mod(ang, SECTOR)));
  float eInner = min(spoke * step(tableR, dn), abs(dn - tableR));
  float eOut = abs(dn - apo);
  float e = min(mix(eInner, 1e3, flood), eOut);
  float lineA = smoothstep(lw + 1.0, lw - 0.5, e);
  vec3 fringe = spectrum(ang / TAU * 3.0 + fill * 0.5);
  g = mix(g, mix(vec3(1.0), fringe, 0.35 + 0.3 * fill), lineA * 0.85);
  g += spectrum(front * 0.02 + T * 0.1) * exp(-abs(front) / 5.0) * 0.55;
  g = mix(g, g * 0.55, smoothstep(lw * 2.6, lw, eOut) * (1.0 - lineA) * 0.25);
  return mix(col, g, smoothstep(apo + 1.0, apo - 1.0, dn));
}

vec3 sceneHouse(vec2 px) { return housePaper(px); }

// The homepage hero: paper, and the crystal where there is one.
vec3 heroScene(vec2 px) {
  if (uCrystal.z <= 0.0) return housePaper(px);
  return crystal(px, uCrystal, uHover < -0.5 ? -1 : int(uHover + 0.5), uE);
}
`;
