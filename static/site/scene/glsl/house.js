// House: warm paper, and on the homepage the crystal. It is a flat pentagonal gem whose five outer
// facets are windows onto the five rooms, each refracted toward its own corner of the scene, with
// a pale table in the middle, prism edges, a soft shadow and a little spectrum cast on the paper.
export const HOUSE = /* glsl */ `
const vec3 PAPER = vec3(0.957, 0.949, 0.933);
const float SECTOR = TAU / 5.0;

vec3 housePaper(vec2 px) {
  float g = noise(px * 0.9) * 0.6 + noise(px * 0.23) * 0.4;
  return PAPER * (0.988 + 0.024 * (g - 0.5));
}

// Rooms only (no house), so the crystal can call it without a cycle.
vec3 sceneRoom(int k, vec2 px) {
  if (k == 0) return sceneInk(px);
  if (k == 1) return sceneGlacier(px);
  if (k == 2) return sceneSignal(px);
  if (k == 3) return sceneFolio(px);
  return sceneChrome(px);
}

// Where each facet looks into its room: a point that shows the room at its best.
vec2 roomFocus(int k) {
  if (k == 0) return R * vec2(0.62, 0.6);
  if (k == 1) return R * vec2(0.5, 0.42);
  if (k == 2) return R * vec2(0.5, 0.5);
  if (k == 3) return R * vec2(0.12, 0.78);
  return R * vec2(0.13, 0.2);
}

float crystalTilt() { return 0.04 * sin(T * 0.13); }

// The facet's outward normal angle and its centroid.
vec2 facetCentroid(int k, vec3 cr) {
  float phi = crystalTilt() + (float(k) + 0.5) * SECTOR;
  return cr.xy + vec2(sin(phi), -cos(phi)) * cr.z * 0.809 * 0.71;
}

// The crystal at p. dive: 0..1 how far the view has fallen into the first facet; inside that facet
// the room's coordinates slide from the facet's window to the full screen (screenPx).
vec3 crystal(vec2 p, vec3 cr, float dive, float scale, vec2 screenPx) {
  vec2 d = p - cr.xy;
  float tilt = crystalTilt();
  float theta = atan(d.x, -d.y);
  float ang = mod(theta - tilt, TAU);
  int k = int(floor(ang / SECTOR));
  float phi = tilt + (float(k) + 0.5) * SECTOR;
  vec2 nk = vec2(sin(phi), -cos(phi));
  float apo = cr.z * 0.809;
  float dn = dot(d, nk);
  float px1 = 1.0 / scale;                       // one screen pixel in crystal space
  float lw = px1 * (1.1 + 4.0 * dive);           // edge width, flaring as the view dives
  vec3 col = housePaper(p);
  // The shadow and the spectrum it casts.
  vec2 ds = d - vec2(16.0, 26.0);
  float sdP = 0.0;
  {
    float a2 = mod(atan(ds.x, -ds.y) - tilt, TAU);
    float ph2 = tilt + (floor(a2 / SECTOR) + 0.5) * SECTOR;
    sdP = dot(ds, vec2(sin(ph2), -cos(ph2))) - apo;
  }
  col *= 1.0 - 0.13 * smoothstep(60.0, -20.0, sdP);
  float ca = atan(d.x, -d.y);
  float wedge = smoothstep(0.32, 0.0, abs(ca + 2.3)) * smoothstep(cr.z * 0.95, cr.z * 1.4, length(d)) * smoothstep(cr.z * 3.2, cr.z * 1.6, length(d));
  col = mix(col, col * (0.82 + 0.3 * spectrum((ca + 2.3) * 1.6 + 0.1)), wedge * 0.55);
  if (dn > apo + lw * 2.0) return col;
  // Inside the gem.
  float tableR = apo * 0.42;
  vec3 g;
  if (dn < tableR) {
    g = mix(vec3(0.985), spectrum(ang / TAU * 2.0 + T * 0.03), 0.14);
    g *= 0.96 + 0.04 * noise(p * 0.05);
  } else {
    vec2 c = facetCentroid(k, cr);
    float zoom = 2.3 * R.y / (cr.z * 3.0);
    vec2 rp = roomFocus(k) + (p - c) * zoom + nk * 18.0;
    if (k == 0) rp = mix(rp, screenPx, dive);
    g = sceneRoom(k, rp);
    float lightK = dot(nk, normalize(vec2(-0.55, -0.83))) * 0.5 + 0.5;
    g *= 0.9 + 0.16 * lightK * (1.0 - dive);
    g += (1.0 - (dn - tableR) / (apo - tableR)) * 0.05 * (1.0 - dive);
    if (abs(uHover - float(k)) < 0.5) g = g * 1.06 + 0.04;
  }
  // Edges: the five spokes, the table rim and the outline, white with a prism fringe.
  float spoke = length(d) * sin(min(mod(ang, SECTOR), SECTOR - mod(ang, SECTOR)));
  float eTable = abs(dn - tableR);
  float eOut = abs(dn - apo);
  float e = min(min(spoke * step(tableR, dn), eTable), eOut);
  float lineA = smoothstep(lw + px1, lw - px1 * 0.5, e);
  vec3 fringe = spectrum(ang / TAU * 3.0 + dive * 0.5);
  g = mix(g, mix(vec3(1.0), fringe, 0.35 + 0.4 * dive), lineA * 0.85);
  g = mix(g, g * 0.55, smoothstep(lw * 2.6, lw, eOut) * (1.0 - lineA) * 0.25);
  float inside = smoothstep(apo + px1, apo - px1, dn);
  return mix(col, g, inside);
}

vec3 sceneHouse(vec2 px) { return housePaper(px); }

// House → Ink: the view falls into the Ink facet, its edges flaring, and the wash spreads.
vec3 diveInk(vec2 px, float h) {
  vec3 cr = uCrystal;
  if (cr.z <= 0.0) cr = vec3(R * vec2(0.72, 0.48), R.y * 0.3);
  float e = ease(h);
  vec2 f = facetCentroid(0, cr);
  float S = 3.2 * length(R) / cr.z;
  float s = exp(mix(0.0, log(S), e));
  vec2 anchor = mix(f, R * 0.5, e);
  vec2 p = f + (px - anchor) / s;
  vec3 col = crystal(p, cr, e, s, px);
  if (h > 0.6) {
    float w = (h - 0.6) / 0.4;
    float n = fbm3(px * 0.005) - 0.5;
    float front = w * 1.35 - 0.2 + n * 0.35 - length(px - R * 0.5) / length(R) * 0.5;
    float m = smoothstep(0.0, 0.03, front);
    vec3 ink = sceneInk(px);
    col = mix(col, ink, m);
    col = mix(col, col * 0.7, exp(-abs(front) * 70.0) * (1.0 - m) * 0.6);
  }
  return col;
}
`;
