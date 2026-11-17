// Outdoors → Photography, and the click into Photography: fire becoming memory (fire-plan.js holds the
// clock, the palette and the maths this mirrors). Outdoors' window burns from within, lets go as embers,
// whose paths are drawn out into ribbons, wound onto a torus and unrolled into a veil; waves gather the
// veil into seams, the sparks cool to silver grains, and Photography's own world develops out of them.
//   FIRE_SHARED: the clock, the palette, the flow, an ember's look, the waves; shared with the units.
//   FIRE_GLSL: the ground (mode 8) and the click's cover and reveal.
//   FIRE_UNITS: the embers, the ribbons, the grains (instanced, glsl/units.js conventions).
import { FIRE, FIREC, PALETTE, DEVELOP, GOLDEN } from '../fire-plan.js';
const f = x => Number(x).toFixed(4);
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;
const v3 = a => `vec3(${a.map(f).join(', ')})`;
const F = FIRE, HE = F.hero, FL = F.flow, TO = F.torus, P = PALETTE;

export const FIRE_SHARED = /* glsl */ `
const float FI_CELL = ${f(F.cell)}, FI_SUN0 = ${f(F.sun)}, FI_SUNRISE = ${f(F.sunRise)}, FI_SUNSIDE = ${f(F.sunSide)}, FI_SUNUP = ${f(F.sunUp)};
const vec2 FI_IGN = ${v2(F.ignite)}, FI_GONE = ${v2(F.gone)}, FI_REL = ${v2(F.release)}, FI_OUT = ${v2(F.out)};
const float FI_HEAT = ${f(F.heat)}, FI_TAUMAX = ${f(F.tau.max)}, FI_TAUK = ${f(F.tau.k)};
const float FI_A = ${f(FL.A)}, FI_B = ${f(FL.B)}, FI_C = ${f(FL.C)}, FI_K = ${f(2 * Math.PI / FL.wave)}, FI_V = ${f(FL.v)}, FI_LIFT = ${f(FL.lift)}, FI_VZ = ${f(FL.vz)}, FI_F = ${f(FL.focal)};
const vec2 FI_HERO0 = ${v2(HE.at)}, FI_HGROW = ${v2(HE.grow)}, FI_HOUT = ${v2(HE.out)}, FI_ZOOM = ${v2(HE.zoom)};
const float FI_HPICK = ${f(HE.pick)}, FI_ZOOMBY = ${f(HE.zoomBy)}, FI_HR = ${f(HE.r)};
const vec2 FI_RIB = ${v2(F.ribbon.on)};
const float FI_RLEN = ${f(F.ribbon.len)};
const vec2 FI_LOCK = ${v2(F.lock)}, FI_FACE = ${v2(F.face)}, FI_THRU = ${v2(F.through)}, FI_VEIL = ${v2(F.veil)}, FI_ROFF = ${v2(F.ribbonOff)};
const vec2 FI_BEAD = ${v2(F.bead)}, FI_SET = ${v2(F.settle)}, FI_RIP = ${v2(F.ripple)}, FI_DEV = ${v2(F.develop)};
const float FI_TR = ${f(TO.R)}, FI_TA = ${f(TO.a)}, FI_WIND = ${f(TO.wind)}, FI_TILT = ${f(TO.tilt)}, FI_SIG = ${f(TO.sigma)}, FI_KMAX = ${f(TO.kmax)}, FI_SLIP = ${f(TO.slip)}, FI_GOLDEN = ${f(GOLDEN)};
const vec2 FI_FT[3] = vec2[3](${F.fronts.map(v2).join(', ')});
const vec2 FI_FN[3] = vec2[3](${F.frontDir.map(v2).join(', ')});
const float FI_CBY = ${f(FIREC.by)}, FI_CSTART = ${f(FIREC.start)}, FI_CRAD = ${f(FIREC.radial)}, FI_CFIN = ${f(FIREC.finger)};
const float FI_DLEAD = ${f(DEVELOP.lead)}, FI_DLAG = ${f(DEVELOP.lag)}, FI_DTAU = ${f(DEVELOP.tau)};
const vec3 FI_DEEP = ${v3(P.deep)}, FI_EMBER = ${v3(P.ember)}, FI_COPPER = ${v3(P.copper)}, FI_GOLD = ${v3(P.gold)}, FI_WHITE = ${v3(P.white)};
const vec3 FI_ROSE = ${v3(P.rose)}, FI_VIOLET = ${v3(P.violet)}, FI_BLUE = ${v3(P.blue)}, FI_SILVER = ${v3(P.silver)};

float fiS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }
// A black body's ramp (fire-plan.js blackBody): 0 black, deep red, ember orange, gold, 1 white-gold.
vec3 fiBlack(float t) {
  vec3 c = mix(vec3(0.0), FI_DEEP, smoothstep(0.0, .22, t));
  c = mix(c, FI_EMBER, smoothstep(.18, .5, t));
  c = mix(c, FI_GOLD, smoothstep(.45, .8, t));
  return mix(c, FI_WHITE, smoothstep(.75, 1.0, t));
}
// Cells: x the distance to the nearest centre, y to the second nearest, zw the nearest's id.
vec4 fiVoro(vec2 p) {
  vec2 n = floor(p), fr = fract(p), id = vec2(0.0);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)), r = g + hash2(n + g) - fr;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = n + g; } else if (d < d2) d2 = d;
  }
  return vec4(sqrt(d1), sqrt(d2), id);
}
// ---- the flow (fire-plan.js flowTime, abc, flowVel, flowAt) --------------------------------------------
float fiTau(float P) { return FI_TAUMAX * (1.0 - exp(-max(P - FI_IGN.x, 0.0) / FI_TAUK)); }
// An ember's velocity s after it left: the lift it left with, dying away, and an ABC flow (no sources, no
// sinks), which sways a little on the clock (tm).
vec3 fiVel(vec3 p, float s, float zb, float tm) {
  vec3 q = p * FI_K + vec3(.3 * sin(tm * .21), .3 * cos(tm * .17), 1.3);
  vec3 a = vec3(FI_A * sin(q.z) + FI_C * cos(q.y), FI_B * sin(q.x) + FI_A * cos(q.z), FI_C * sin(q.y) + FI_B * cos(q.x));
  float lift = exp(-s / 1.1);
  return a * FI_V * (.35 + .65 * (1.0 - lift)) + vec3(0.0, -FI_LIFT * lift, zb * exp(-s / 1.5));
}
vec3 fiFlow(vec3 p, float s, float zb, float tm) {
  const int N = 8;
  float h = s / float(N), si = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 v1 = fiVel(p, si, zb, tm);
    p += fiVel(p + v1 * h * .5, si + h * .5, zb, tm) * h;
    si += h;
  }
  return p;
}
// The one ember we follow: where it is on screen (strip px), and how far the view has closed on it.
vec2 fiHeroAt(float P, vec2 S) { return mix(FI_HERO0 * S, S * .5, fiS(FI_ZOOM, P)); }
float fiZoom(float P) { return 1.0 + FI_ZOOMBY * fiS(FI_ZOOM, P); }
// A point of the flow (centred px, z toward the viewer) on screen: xy strip px, z its scale. click: a
// click's embers are seen as they are (nothing is followed).
vec3 fiScreen(vec3 p, vec2 S, float P, float click) {
  float w = 1.0 / max(1.0 - p.z / FI_F, .2);
  vec2 xy = S * .5 + p.xy * w;
  if (click > .5) return vec3(xy, w);
  float Z = fiZoom(P);
  return vec3(fiHeroAt(P, S) + (xy - FI_HERO0 * S) * Z, w * Z);
}
// A click's fire (fire-plan.js FIREC): when it reaches px, as a fraction of the cover.
float fiClickArrive(vec2 px, vec2 O, float far) {
  return max(.01, FI_CSTART + FI_CRAD * length(px - O) / far + FI_CFIN * (fbm3(px * .004 + 3.0) - .5));
}
float fiFar(vec2 O, vec2 S) { return length(max(O, S - O)) * 1.02; }

// ---- an ember ----------------------------------------------------------------------------------------------
// A lump of charcoal, k in its own radii (its outline near 1, its glow out to about 2.4), rpx its radius
// on screen, temp 0 … 1 how hot. A rounded, uneven outline; a dome; fire under a crust: the crust in
// plates of near-black char (more of them as it cools), grey ash on it, fissures wandering across it
// where the fire shows through; the fire itself breathing, hotter in its hollows and at its rim, where
// the air reaches; a halo. Seen close, finer fissures and pores. Small ones are only sparks. Premultiplied.
vec4 fiLump(vec2 k, float rpx, float seed, float temp, float tm) {
  float ang = atan(k.y, k.x), rr = length(k);
  float Rs = .8 + .12 * sin(ang * 2.0 + seed * 20.0) + .06 * sin(ang * 5.0 - seed * 31.0) + .045 * sin(ang * 3.0 + seed * 7.0);
  float aa = 1.4 / max(rpx, 1.0);
  float m = smoothstep(Rs + aa, Rs - aa, rr);
  float halo = (exp(-pow(rr / (Rs * 1.3), 2.0) * 1.4) * .5 + exp(-rr * 2.4) * .45) * temp;
  vec3 col = fiBlack(.34 + .5 * temp) * halo * (1.0 - m);
  if (m > 0.0) {
    float nz = sqrt(max(1.0 - (rr / Rs) * (rr / Rs), 0.0));
    vec3 body;
    if (rpx > 4.5) {
      vec2 uv = k * (1.0 + .3 * (1.0 - nz)) + fract(seed * vec2(.731, .377)) * 40.0;
      float fine = smoothstep(40.0, 110.0, rpx);
      float n1 = noise(uv * 2.3), n2 = noise(uv * 5.1 + 3.0), n3 = noise(uv * 11.0 + 7.0);
      float breath = .78 + .22 * sin(tm * (1.3 + 1.7 * fract(seed)) + n1 * 9.0 + seed);
      float heat = clamp(temp * (.3 + n1) * (.85 + .55 * pow(1.0 - nz, 2.0)) * breath, 0.0, 1.0);
      float r1 = 1.0 - abs(2.0 * noise(uv * 3.1 + 5.0) - 1.0), r2 = 1.0 - abs(2.0 * noise(uv * 7.3 - 2.0) - 1.0);
      float fiss = smoothstep(.84, .98, r1) + .6 * smoothstep(.88, .985, r2);
      if (fine > 0.0) fiss += fine * .45 * smoothstep(.9, .99, 1.0 - abs(2.0 * noise(uv * 17.0 + 1.0) - 1.0));
      fiss = min(fiss, 1.0);
      float cf = n2 * .65 + n1 * .35, cv = cf + .34 * (1.0 - temp) - .1;
      float crust = smoothstep(.34, .6, cv);
      // (The plates stand a little proud of the fire: their slopes, where it is large enough to see.)
      vec2 slope = vec2(0.0);
      if (rpx > 14.0) {
        vec2 ux = uv + vec2(.07, 0.0), uy = uv + vec2(0.0, .07);
        slope = (vec2(noise(ux * 5.1 + 3.0) * .65 + noise(ux * 2.3) * .35, noise(uy * 5.1 + 3.0) * .65 + noise(uy * 2.3) * .35) - cf) / .07;
      }
      vec3 n = normalize(vec3(k * .95 - slope * .4 * crust + (vec2(n3, n2) - .5) * .35, nz + .3));
      float lit = clamp(dot(n, normalize(vec3(-.5, -.62, .6))), 0.0, 1.0);
      float pits = smoothstep(.6, .8, noise(uv * 23.0 - 9.0)) * fine;
      vec3 charc = vec3(.1, .085, .075) * (.14 + 1.25 * lit) * (.6 + .6 * n3) * (1.0 - .6 * pits) * (.45 + .55 * nz);
      // Ash, where it has cooled; the fire's own light on the plates' edges and on its underside.
      charc = mix(charc, vec3(.46, .44, .42) * (.2 + lit), smoothstep(.66, .86, n3 + .2 * n2) * .6 * (1.0 - heat));
      charc += fiBlack(.5) * temp * (.55 * (1.0 - smoothstep(.34, .8, cv)) + .12 * (1.0 - lit));
      // The fire in the hollows between them, hottest at their deepest.
      float deep = 1.0 - smoothstep(0.0, .34, cv);
      body = mix(fiBlack(clamp(heat * (.75 + .55 * deep), 0.0, 1.0)) * (1.0 + .7 * heat), charc, crust);
      body += fiBlack(clamp(.45 + .55 * heat, 0.0, 1.0)) * fiss * crust * smoothstep(.04, .3, temp) * (1.0 + heat);
      body += fiBlack(.5 + .4 * heat) * pow(1.0 - nz, 3.0) * .5 * heat;
    } else body = fiBlack(clamp(.5 + .5 * temp, 0.0, 1.0)) * (.55 + .95 * nz) * (.25 + .75 * temp);
    col += body * m;
  }
  return vec4(col, m);
}

// ---- the liquid ----------------------------------------------------------------------------------------
// One broad ripple crossing the liquid from the lower left (rp 0 … 1): its slope (to bend what lies under
// it by), and the sheen on the faces it turns to the light.
vec2 fiRipple(vec2 q, vec2 S, float rp, out float sheen) {
  vec2 dir = normalize(vec2(1.0, -.42));
  float span = dot(S, abs(dir)), u = dot(q - vec2(0.0, S.y), dir) - mix(-.2, 1.2, rp) * span;
  u += 26.0 * sin(dot(q, vec2(-.42, -1.0)) * .006 + 1.0);
  float kw = TAU / 190.0, w2 = 250.0 * 250.0, env = exp(-u * u / w2);
  float dh = env * (-sin(kw * u) - 2.0 * u / (w2 * kw) * cos(kw * u));
  sheen = pow(max(dh, 0.0), 3.0);
  return dir * dh;
}
float fiRippleAmp(float rp) { return smoothstep(0.0, .12, rp) * (1.0 - smoothstep(.72, 1.0, rp)); }

// ---- the waves (fire-plan.js frontAhead, frontBirth) --------------------------------------------------
// Wave j's crest: how far ahead of it q is at P (< 0: swept).
vec2 fiFrontGeom(int j, vec2 q, vec2 S) {
  vec2 n = FI_FN[j], c = q - S * .5;
  float along = dot(c, vec2(-n.y, n.x)), fj = float(j);
  float d = dot(c, n) + 46.0 * sin(along * .0052 + fj * 2.1) + 22.0 * sin(along * .013 - fj * 1.3 + 1.0);
  return vec2(d, (.5 * (abs(n.x) * S.x + abs(n.y) * S.y) + 70.0) * 1.2);
}
float fiFrontD(int j, vec2 q, vec2 S, float P) {
  vec2 g = fiFrontGeom(j, q, S);
  return g.x - g.y * (2.0 * fiS(FI_FT[j], P) - 1.0);
}
float fiFrontBirth(int j, vec2 q, vec2 S) {
  vec2 g = fiFrontGeom(j, q, S);
  float y = clamp((g.x / g.y + 1.0) * .5, 0.0, 1.0);
  return mix(FI_FT[j].x, FI_FT[j].y, .5 - sin(asin(1.0 - 2.0 * y) / 3.0));
}
`;

// Where the fire's plan says it reaches q (strip px): 0 … 1 of the ignition (fire-plan.js makeIgnition,
// in uReach, a texel every FI_CELL px).
const FIRE_ARRIVE = /* glsl */ `
float fiArrive(vec2 q) { return textureLod(uReach, (q / FI_CELL + .5) / vec2(textureSize(uReach, 0)), 0.0).r; }
`;

export const FIRE_GLSL = FIRE_SHARED + FIRE_ARRIVE + /* glsl */ `
// ---- 1, 2: the window burns -----------------------------------------------------------------------------
// How far the last sun has come up at q: from the foot of the screen, and from its right.
float fiSunAt(vec2 q, vec2 S, float P) {
  float ps = FI_SUN0 + FI_SUNRISE * (1.0 - q.y / S.y) + FI_SUNSIDE * (1.0 - q.x / S.x);
  return smoothstep(ps, ps + FI_SUNUP, P);
}
// The fire at a point tb (of P) after its front: the glass's own colour (tint) heated to molten light;
// then a dark crust, glowing where it is thin and along wandering cracks, cooling; then gone, as its
// embers lift. The came (cameNear px away) is the fire's fuse: white-orange as it passes, and the last
// seams to go dark, so the landscape stays drawn in them a moment longer. k: how far the fire has
// replaced what was there; pre: the glow ahead of the front.
vec3 fiBurn(vec3 tint, float cameNear, float tb, vec2 q, out float k, out vec3 pre) {
  float hot = exp(-max(tb, 0.0) / FI_HEAT);
  float charT = smoothstep(FI_HEAT * .6, FI_HEAT * 2.6, tb);
  float n0 = noise(q * .06 + 3.0);
  float tl = max(max(tint.r, tint.g), max(tint.b, .001));
  vec3 hue = mix(vec3(1.0), tint / tl, .6);
  float flow = .5 * noise(q * .045 + vec2(0.0, -T * .9)) + .5 * noise(q * .11 + vec2(T * .4, -T * 1.3));
  vec3 molten = fiBlack(clamp(.34 + .36 * hot * (.6 + .7 * flow), 0.0, 1.0)) * hue * (1.0 + .2 * hot);
  float cool = exp(-max(tb - FI_HEAT, 0.0) / .06);
  float r1 = 1.0 - abs(2.0 * noise(q / 26.0 + 11.0) - 1.0), r2 = 1.0 - abs(2.0 * noise(q / 11.0 - 4.0) - 1.0);
  float crack = min(smoothstep(.86, .985, r1) + .55 * smoothstep(.9, .99, r2), 1.0);
  float under = noise(q / 34.0 + 2.0), breath = .78 + .22 * sin(T * 2.0 + under * 12.0);
  vec3 charc = vec3(.05, .04, .034) * (.5 + .9 * noise(q * .4))
             + fiBlack(clamp(cool * (.25 + .75 * under) * breath, 0.0, 1.0)) * (.35 + .65 * smoothstep(.45, .8, under)) * cool
             + fiBlack(clamp(.35 + .6 * cool, 0.0, 1.0)) * crack * cool * 1.2;
  vec3 fire = mix(molten, charc, charT) * (1.0 - smoothstep(FI_GONE.x, FI_GONE.y, tb + .03 * (n0 - .5)));
  float line = smoothstep(3.2, .7, cameNear);
  float lineHeat = exp(-max(tb, 0.0) / .1) * (.8 + .2 * sin(T * 3.0 + q.x * .05 + q.y * .03));
  float lineGone = smoothstep(FI_GONE.x + .02, FI_GONE.y + .03, tb + .03 * (n0 - .5));
  fire += fiBlack(.55) * exp(-cameNear / 7.0) * lineHeat * .35 * (1.0 - line) * (1.0 - lineGone);
  fire = mix(fire, fiBlack(clamp(.3 + .7 * lineHeat, 0.0, 1.0)) * (1.0 + .5 * lineHeat) * (1.0 - lineGone), line);
  // The front itself: a thin line of white-gold.
  fire += FI_WHITE * exp(-pow(tb / .0022, 2.0)) * .45;
  k = smoothstep(-.003, .003, tb);
  pre = fiBlack(.36) * exp(min(tb, 0.0) / .012) * (1.0 - k) * .45;
  return fire;
}
vec3 fiWindow(vec2 q, vec2 px, float P, vec2 S) {
  float tb = P - mix(FI_IGN.x, FI_IGN.y, fiArrive(q));
  if (tb > FI_GONE.y + .06) return vec3(0.0);
  // Heat shimmer about the fire.
  float near = exp(-abs(tb) / .045) * step(tb, FI_HEAT * 2.0);
  vec2 sh = (vec2(noise(q * .035 + vec2(0.0, -T * 1.7)), noise(q * .035 + vec2(7.0, -T * 1.4))) - .5) * 10.0 * near;
  gSun = fiSunAt(q, S, P);
  vec3 col = fgDisp(sceneFolioLin(px + sh));
  gSun = 0.0;
  if (tb < -.2) return col;
  float k; vec3 pre;
  vec3 fire = fiBurn(gFgTint, gFgNear, tb, q, k, pre);
  return mix(col + pre, fire, k);
}

// ---- 3: the one ember -----------------------------------------------------------------------------------
vec3 fiHeroOver(vec3 col, vec2 q, vec2 S, float P) {
  float grow = fiS(FI_HGROW, P), gone = fiS(FI_HOUT, P), born = smoothstep(FI_HPICK, FI_HPICK + .03, P);
  float r = mix(7.0, FI_HR * min(S.x, S.y), grow) * born * (1.0 - .5 * gone);
  if (r < .5) return col;
  vec2 k = (q - fiHeroAt(P, S)) / r;
  if (dot(k, k) > 6.5) return col;
  k = rot(.4 + P * 2.2 + T * .03) * k;
  // It cools as we watch, then goes out.
  vec4 L = fiLump(k, r, .37, (.86 - .26 * grow) * (1.0 - gone), T);
  return col * (1.0 - L.a) + L.rgb * (1.0 - smoothstep(.7, 1.0, gone));
}

// ---- 5: the veil ------------------------------------------------------------------------------------------
// A folded sheet seen face on (fire-plan.js foldLight): the light at X, and mat, the material coordinate
// of its brightest fold there (for its threads).
float fiFold(float X, float A, float kf, float ph, out float mat) {
  const int NS = 9;
  float x0 = X - A, dx = 2.0 * A / float(NS), gp = x0 + A * sin(kf * x0 + ph) - X, sum = 0.0, best = 0.0;
  mat = X;
  for (int i = 1; i <= NS; i++) {
    float x = x0 + dx * float(i), g = x + A * sin(kf * x + ph) - X;
    if ((g < 0.0) != (gp < 0.0)) {
      float xr = x - dx * g / (g - gp);
      float w = 1.0 / max(abs(1.0 + A * kf * cos(kf * xr + ph)), .06);
      sum += w;
      if (w > best) { best = w; mat = xr; }
    }
    gp = g;
  }
  return sum;
}
// Its colour round the interference (x, repeating): ember orange, rose, violet and back.
vec3 fiVeilHue(float x) {
  x = fract(x);
  vec3 c = mix(FI_EMBER, FI_ROSE, smoothstep(.22, .46, x));
  c = mix(c, FI_VIOLET, smoothstep(.54, .78, x));
  return mix(c, FI_EMBER, smoothstep(.88, 1.0, x));
}
// Two sheets hanging a little off the vertical, their folds travelling and opening; fine threads and
// rays along them. Two wave trains cross the whole veil, and where they overlap they interfere: bands
// of colour with dark between; blue only as a flash, on the brightest folds of a few of them.
vec3 fiVeil(vec2 q, vec2 S, float P) {
  vec2 p = (q - S * .5) / S.y;
  float t = T * .1 + P * 4.0;
  float w1 = sin(dot(p, vec2(3.1, 1.3)) + t * .9 + .8 * sin(p.y * 2.1 - t * .4));
  float w2 = sin(dot(p, vec2(-1.9, 2.6)) - t * .7 + .7 * sin(p.x * 1.7 + t * .5));
  float delta = 2.4 * (w1 - w2) + 1.5 * sin(dot(p, vec2(.9, -1.4)) + t * .3);
  float lum = 0.0, path = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l), an = .16 - .34 * fl;
    vec2 d = vec2(cos(an), sin(an)), e = vec2(-d.y, d.x);
    float X = dot(p, d) + .05 * w1 * (1.0 - fl) + .04 * w2 * fl, Y = dot(p, e);
    float kf = 15.0 + 7.0 * fl;
    float A = (.11 - .04 * fl) * (1.0 + .35 * sin(Y * 2.6 + t * .8 + fl * 2.0) + .2 * sin(Y * 5.3 - t * .5));
    float ph = Y * (1.6 - .7 * fl) + t * (1.1 + .3 * fl) * (l == 1 ? -1.0 : 1.0) + 1.1 * sin(Y * 2.7 - t * .6 + fl);
    float mat;
    float sum = fiFold(X, A, kf, ph, mat);
    float thread = .58 + .42 * cos(mat * S.y * 1.05 + fl);
    float rays = .55 + .75 * noise(vec2(mat * 14.0 + fl * 9.0, Y * 1.2));
    float band = .4 + .6 * smoothstep(.2, .8, noise(vec2(Y * 1.4 + t * .12 + fl * 5.0, mat * .8)));
    lum += pow(sum, 1.2) * .24 * mix(1.0, thread, 1.0 / (1.0 + sum * .6)) * rays * band * (1.0 - .25 * fl);
    path += sum * (1.0 - .4 * fl);
  }
  float fringe = .16 + .84 * pow(.5 + .5 * cos(delta), 1.3);
  vec3 hue = fiVeilHue(.16 * delta + .05 * path + .08);
  hue = mix(hue, FI_BLUE, smoothstep(6.0, 11.0, path) * smoothstep(.7, .88, noise(p * 2.3 + t * .1)) * .75);
  return 1.0 - exp(-hue * lum * fringe * 2.6);
}
// ---- 6: the waves gather it into seams --------------------------------------------------------------------
vec3 fiSeams(vec2 q, vec2 S, float P, out float keep) {
  keep = 1.0;
  vec3 col = vec3(0.0);
  float bead = fiS(FI_BEAD, P);
  for (int j = 0; j < 3; j++) {
    float prog = fiS(FI_FT[j], P);
    if (prog <= 0.0) continue;
    float d = fiFrontD(j, q, S, P);
    // Behind a crest, darkness: the veil is only what none of them has reached.
    keep *= smoothstep(-10.0, 10.0, d);
    vec2 n = FI_FN[j];
    float along = dot(q - S * .5, vec2(-n.y, n.x)), fj = float(j);
    // (What it has swept rides its crest: it brightens as it goes.)
    float B = (.5 + 1.3 * prog) * smoothstep(0.0, .06, prog) * (1.0 - smoothstep(.93, 1.0, prog));
    float beads = mix(1.0, pow(.5 + .5 * cos(along * .11 + fj * 2.0 + 30.0 * prog), 6.0) * 2.2, bead);
    float core = exp(-pow(d / 2.2, 2.0)), glow = exp(-abs(d) / 12.0), wide = exp(-abs(d) / 46.0), wake = exp(min(d, 0.0) / 70.0) * step(d, 0.0);
    // Its colour, gathered from the veil: ember, rose and violet along it.
    vec3 hue = fiVeilHue(along * .0011 + fj * .37 + .1);
    float glint = pow(.5 + .5 * sin(along * .23 + T * 3.0 + fj), 8.0);
    col += (FI_WHITE * core * (1.6 + 1.2 * glint) + hue * glow * .7 + hue * wide * .16 + hue * wake * .06) * B * beads;
  }
  return col;
}

// ---- 7: the picture develops --------------------------------------------------------------------------------
// How far a point of exposure x has come up at t (fire-plan.js developed).
float fiDeveloped(float x, float t) {
  float ti = FI_DLEAD + FI_DLAG * (1.0 - clamp(x, 0.0, 1.0));
  float fr = (1.0 - exp(-max(t - ti, 0.0) / FI_DTAU)) / (1.0 - exp(-(1.0 - FI_DLEAD - FI_DLAG) / FI_DTAU));
  return max(clamp(fr, 0.0, 1.0), smoothstep(.9, 1.0, t));
}
// Photography's world coming up through the liquid, over what is left (under): t the development, rp the
// ripple. Silver first, as grains, each turning as the developed fraction passes its own threshold, then
// tone; all there, and the liquid still, by the end: sceneDarkroom, exactly.
vec3 fiDevelop(vec3 under, vec2 q, vec2 px, float t, float rp) {
  vec2 S = uRegion.zw;
  float amp = fiRippleAmp(rp);
  float sheen = 0.0;
  vec2 slope = amp > 0.0 ? fiRipple(q, S, rp, sheen) * amp : vec2(0.0);
  vec3 col = under + vec3(.5, .52, .58) * sheen * amp * .16;
  if (t <= 0.0) return col;
  vec3 world = sceneDarkroom(px + slope * 30.0);
  float fr = fiDeveloped(luma(world) * 3.2, t);
  vec2 gq = px / 1.3;
  float u = hash(floor(gq) + floor(hash2(floor(gq * .37)) * 8.0));
  float grainy = smoothstep(u - .12, u + .12, fr * 1.12);
  float tone = mix(grainy, fr, smoothstep(.25, .8, t));
  vec3 silver = FI_SILVER * grainy * (1.0 - smoothstep(0.0, .4, fr)) * .22 * (1.0 - smoothstep(.45, .9, t));
  return col * (1.0 - tone) + world * tone + silver + world * sheen * amp * 1.2 * tone;
}

vec3 groundFire(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  if (P <= FI_SUN0 || uIceReady < .5) return P < .5 ? sceneFolio(px) : sceneDarkroom(px);
  if (P >= FI_DEV.y) return sceneDarkroom(px);
  vec3 col = vec3(0.0);
  if (P < FI_IGN.y + FI_GONE.y + .07) col = fiWindow(q, px, P, S);
  if (P > FI_HPICK && P < FI_HOUT.y) col = fiHeroOver(col, q, S, P);
  if (P > FI_VEIL.x && P < FI_BEAD.y + .01) {
    float keep;
    vec3 seams = fiSeams(q, S, P, keep);
    // The veil opens outward from where we came through; the waves take it.
    float on = smoothstep(0.0, 1.0, fiS(FI_VEIL, P) * 1.9 - length((q - S * .5) / S.y) * .8) * keep * (1.0 - fiS(FI_BEAD, P));
    if (on > 0.0) col += fiVeil(q, S, P) * on;
    col += seams;
  }
  if (P > FI_RIP.x) col = fiDevelop(col, q, px, clamp((P - FI_DEV.x) / (FI_DEV.y - FI_DEV.x), 0.0, 1.0), clamp((P - FI_RIP.x) / (FI_RIP.y - FI_RIP.x), 0.0, 1.0));
  return col;
}

// ---- the click into Photography -------------------------------------------------------------------------
// The cover (E): the same fire from the click, over the page: a glow ahead of its front, the page turned
// to molten light, then char, then dark as its embers lift (the embers: glsl/units.js, on the click's
// clock). Premultiplied.
vec4 fireCover(vec2 px, vec2 O, float far, float E) {
  float tb = (E - fiClickArrive(px, O, far)) * FI_CBY;
  if (tb < -.08) return vec4(0.0);
  float k; vec3 pre;
  vec3 fire = fiBurn(vec3(1.0, .82, .56), 1e3, tb, px, k, pre);
  return vec4(fire * k + pre * (1.0 - k), k);
}
// The reveal (e), behind the new page: silver grains hanging in the dark, one ripple, and the darkroom
// develops out of them.
vec3 fireReveal(vec2 px, float e) {
  float t = smoothstep(.06, .92, e);
  vec2 g = floor(px / 2.4);
  float speck = step(.982, hash(g)) * pow(.5 + .5 * sin(T * (2.0 + 5.0 * hash(g + 3.0)) + hash(g + 7.0) * 60.0), 3.0);
  vec3 under = FI_SILVER * speck * .8 * (1.0 - smoothstep(.2, .7, e)) * smoothstep(0.0, .08, e);
  return fiDevelop(under, px, px, t, clamp(e * 1.05, 0.0, 1.0));
}
`;

// ---- the units ---------------------------------------------------------------------------------------------
// VHEAD and FHEAD (glsl/units.js) come before these. An ember's cell c of the embers' grid G (columns,
// rows, cell size): its home, when it leaves, and its own draws.
const EMBER_ID = /* glsl */ `
struct Ember { vec2 home; float Pr; float h1; float h2; float h3; float h4; };
Ember fiEmber(vec2 c, vec4 G, vec2 S) {
  Ember e;
  e.home = (c + .1 + .8 * hash2(c + 3.7)) * G.zw;
  e.h1 = hash(c + 9.1); e.h2 = hash(c + 5.3); e.h3 = hash(c + 1.7); e.h4 = hash(c + 7.9);
  float a = uClick > .5 ? fiClickArrive(e.home, uO, fiFar(uO, S)) * FI_CBY / (FI_IGN.y - FI_IGN.x) : fiArrive(e.home);
  e.Pr = mix(FI_IGN.x, FI_IGN.y, a) + mix(FI_REL.x, FI_REL.y, e.h1);
  return e;
}
// (A click plays on the cover's clock: uH carries E × FIREC.by as P.)
vec4 toClip(vec2 xy) { xy += uRegion.xy; return vec4(xy.x / uView.x * 2.0 - 1.0, 1.0 - xy.y / uView.y * 2.0, 0.0, 1.0); }
`;

// The embers: one a cell, leaving just behind the front that passes its home, carried by the flow,
// tumbling, burning down to a spark.
const EMBERS_VS = FIRE_SHARED + FIRE_ARRIVE + EMBER_ID + /* glsl */ `
out vec2 vK;
out vec4 vA;
void main() {
  int cols = int(uGrid.x);
  ivec2 ci = cellOf(gl_InstanceID + uFirst, cols);
  if (ci.y >= int(uGrid.y)) { gl_Position = GONE; return; }
  vec2 S = uRegion.zw;
  float P = transitP(uH);
  Ember e = fiEmber(vec2(ci), uGrid, S);
  vec2 out_ = uClick > .5 ? vec2(.22, .345) : FI_OUT;
  float burn = smoothstep(out_.x, out_.y, P + (e.h3 - .5) * .08);
  if (P <= e.Pr || burn >= 1.0) { gl_Position = GONE; return; }
  // (The one we follow is drawn by the ground.)
  if (uClick < .5 && distance(e.home, FI_HERO0 * S) < uGrid.z * .9) { gl_Position = GONE; return; }
  float s = fiTau(P) - fiTau(e.Pr);
  vec3 p = fiFlow(vec3(e.home - S * .5, 0.0), s, (e.h4 - .5) * 2.0 * FI_VZ, uTime);
  vec3 sc = fiScreen(p, S, P, uClick);
  float r0 = 2.4 + 7.5 * e.h2 * e.h2 + 20.0 * pow(e.h2, 9.0);
  float born = smoothstep(e.Pr, e.Pr + .025, P);
  float r = r0 * sc.z * (1.0 - .82 * burn) * (.35 + .65 * born);
  if (any(lessThan(sc.xy, vec2(-3.0 * r))) || any(greaterThan(sc.xy, S + 3.0 * r))) { gl_Position = GONE; return; }
  float ang = e.h3 * TAU + s * (1.2 + 3.0 * e.h1) * (e.h4 > .5 ? 1.0 : -1.0);
  float squash = mix(1.0, .5 + .5 * abs(cos(s * (1.5 + 2.0 * e.h2) + e.h1 * 9.0)), smoothstep(0.0, .4, s));
  vK = (QUAD[gl_VertexID % 6] * 2.0 - 1.0) * 2.4;
  // Small ones run hotter; all flare as they burn down.
  float temp = clamp(.5 + .38 * (1.0 - smoothstep(4.0, 16.0, r0)) + .35 * burn - .12 * smoothstep(0.0, 2.5, s), 0.0, 1.0);
  vA = vec4(r, e.h1 * 31.0 + e.h2, temp * (.6 + .4 * born), 0.0);
  gl_Position = toClip(sc.xy + rot(ang) * (vK * vec2(1.0, squash)) * r);
}`;
const EMBERS_FS = FIRE_SHARED + /* glsl */ `
in vec2 vK;
in vec4 vA;
void main() { o = fiLump(vK, vA.x, vA.y, vA.z, uTime); }`;

// The ribbons: the paths of some of the embers, drawn out behind them; then each winds onto the torus,
// in two families, slipping against its place in the weave until the coupling holds it; then the torus
// unrolls into the veil's threads. uGrid: strands a family, ribbons a strand; uGrid2: the embers' grid.
const RIBBONS_VS = FIRE_SHARED + FIRE_ARRIVE + EMBER_ID + /* glsl */ `
const int NSEG = ${F.ribbon.seg};
out vec3 vCol;
out float vSide;
// Strand (fam, slot) at arc u back from its ribbon's head (m of M round the ring): where it is on the
// torus, as it loosens in, turns face on and unrolls (centred px, z toward the viewer). useg: the arc
// its segment starts at, which fixes where the unrolled sheet wraps.
vec3 fiStrand(float fam, float slot, float m, float fid, float u, float useg, float P, float tm, vec2 S) {
  float Ns = uGrid.x, M = uGrid.y, dir = fam < .5 ? 1.0 : -1.0;
  float lk = fiS(FI_LOCK, P), face = fiS(FI_FACE, P), thru = fiS(FI_THRU, P);
  // Round the ring: the whole weave turns.
  float phiH = TAU * (m + .5 * fam) / M + .06 * tm + 1.6 * P, arc = TAU / M * 1.18;
  float phi = phiH - u * arc, phiS = phiH - useg * arc;
  // Round the tube: its slot, its slip against it (Adler), and its family's roll, the two families
  // against each other at the golden ratio.
  float dw = (hash(vec2(fid, 6.1)) - .5) * 2.0 * FI_SIG, K = FI_KMAX * lk;
  float nu = sqrt(max(dw * dw - K * K, 0.0));
  float psi = abs(dw) <= K ? asin(dw / max(K, 1e-4)) : 2.0 * atan((K + nu * tan(.5 * nu * P * FI_SLIP + fid)) / dw);
  float alpha = TAU * slot / Ns + psi + (fam < .5 ? 1.0 : -FI_GOLDEN) * (tm * .11 + P * 3.0);
  float theta = dir * FI_WIND * phi + alpha, thetaS = dir * FI_WIND * phiS + alpha;
  float R0 = FI_TR * min(S.x, S.y * 1.25) * (1.35 - .35 * lk) * (1.0 + .45 * thru), a = R0 * FI_TA * (1.3 - .3 * lk);
  vec3 t3 = vec3((R0 + a * cos(theta)) * cos(phi), (R0 + a * cos(theta)) * sin(phi), a * sin(theta));
  float tilt = (FI_TILT + .1 * sin(tm * .13)) * (1.0 - face);
  t3.yz = rot(tilt) * t3.yz;
  if (thru <= 0.0) return t3;
  // The sheet it unrolls into: wider than the screen, rippling; we pass through on the way.
  vec2 w = vec2(phi / TAU - floor(phiS / TAU) - .5, theta / TAU - floor(thetaS / TAU) - .5);
  vec3 sheet = vec3((w + .035 * vec2(sin(w.y * 13.0 + tm * .6 + fam * 2.0), sin(w.x * 11.0 - tm * .5))) * 1.5 * S, 60.0 * sin(w.x * 9.0 + tm * .7) + 40.0 * sin(w.y * 11.0 - tm * .5));
  vec3 p = mix(t3, sheet, thru * thru * (3.0 - 2.0 * thru));
  p.z += sin(PI * thru) * 420.0;
  return p;
}
vec3 fiStrandScreen(vec3 p, vec2 S) { float w = 1.0 / max(1.0 - p.z / FI_F, .2); return vec3(S * .5 + p.xy * w, w); }
void main() {
  float Ns = uGrid.x, M = uGrid.y;
  int id = gl_InstanceID, rest = id >> 1;
  float fam = float(id & 1), slot = float(rest % int(Ns)), m = float(rest / int(Ns)), fid = float(id);
  vec2 S = uRegion.zw;
  float P = transitP(uH);
  float on = fiS(FI_RIB, P) * (1.0 - fiS(FI_ROFF, P));
  if (m >= M || on <= 0.0) { gl_Position = GONE; return; }
  // Its ember.
  vec2 c = floor(vec2(hash(vec2(fid, 1.3)), hash(vec2(fid, 2.9))) * uGrid2.xy);
  Ember e = fiEmber(c, uGrid2, S);
  if (P <= e.Pr) { gl_Position = GONE; return; }
  int seg = gl_VertexID / 6;
  vec2 kq = QUAD[gl_VertexID % 6];
  float j = float(seg) + kq.x, u = j / float(NSEG), useg = float(seg) / float(NSEG), du = .5 / float(NSEG);
  // How far it has gone over to the torus: each at its own moment.
  float t0 = mix(FI_LOCK.x, FI_LOCK.y - .08, hash(vec2(fid, 4.4)));
  float lock = smoothstep(t0, t0 + .08, P);
  vec3 a = vec3(0.0), b = vec3(0.0);   // here, and a little toward the head (screen px, scale)
  float zn = 0.0;
  if (lock < 1.0) {
    float sHead = fiTau(P) - fiTau(e.Pr), len = min(FI_RLEN * fiS(FI_RIB, P) * (.5 + .5 * e.h2), sHead);
    float s = sHead - len * u, zb = (e.h4 - .5) * 2.0 * FI_VZ;
    vec3 p = fiFlow(vec3(e.home - S * .5, 0.0), s, zb, uTime);
    a = fiScreen(p, S, P, 0.0);
    b = fiScreen(p + fiVel(p, s, zb, uTime) * .03, S, P, 0.0);
  }
  if (lock > 0.0) {
    vec3 p = fiStrand(fam, slot, m, fid, u, useg, P, uTime, S);
    vec3 ta = fiStrandScreen(p, S), tb = fiStrandScreen(fiStrand(fam, slot, m, fid, u - du, useg, P, uTime, S), S);
    a = mix(a, ta, lock); b = mix(b, tb, lock);
    zn = p.z / (FI_TR * min(S.x, S.y * 1.25) * FI_TA);
  }
  vec2 dir = b.xy - a.xy;
  dir = dot(dir, dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
  float side = kq.y * 2.0 - 1.0;
  vec2 xy = a.xy + vec2(-dir.y, dir.x) * side * 7.5 * clamp(a.z, .5, 2.6) * (.75 + .5 * hash(vec2(fid, 9.4)));
  // Copper and gold, a few white-gold; toward the veil's colours as it unrolls. Bright at its head while
  // it is a path; even, with soft ends, once it is a strand; dimmer round the back of the torus.
  float hc = hash(vec2(fid, 3.3)), thru = fiS(FI_THRU, P);
  vec3 col = mix(mix(FI_EMBER, FI_COPPER, .6), FI_GOLD, hc * hc);
  col = mix(col, FI_WHITE, smoothstep(.92, 1.0, hc) * .6);
  col = mix(col, mix(FI_EMBER, mix(FI_ROSE, FI_VIOLET, hc), .6), thru * .7);
  float al = mix(pow(1.0 - u, 1.3) * (.35 + .65 * smoothstep(0.0, .25, u * float(NSEG) + 1.0)), pow(sin(PI * clamp(u, 0.0, 1.0)), .45) * .8, lock);
  al *= mix(1.0, .4 + .6 * smoothstep(-1.0, 1.0, zn), lock * (1.0 - thru));
  vCol = col * al * on * (.55 + .45 * hc);
  vSide = side;
  gl_Position = toClip(xy);
}`;
const RIBBONS_FS = /* glsl */ `
in vec3 vCol;
in float vSide;
void main() {
  float d = abs(vSide);
  o = vec4(vCol * (exp(-pow(d / .2, 2.0)) + .2 * exp(-d * 3.0) * (1.0 - d)), 0.0);
}`;

// The grains: sparks shed as a wave passes, thrown on by its crest, cooling from its colour to silver
// and hanging at every depth; then they settle onto the picture's plane and give way to it.
const GRAINS_VS = FIRE_SHARED + /* glsl */ `
out vec2 vK;
out vec3 vCol;
void main() {
  int cols = int(uGrid.x);
  ivec2 ci = cellOf(gl_InstanceID + uFirst, cols);
  vec2 c = vec2(ci), S = uRegion.zw;
  float P = transitP(uH);
  float h1 = hash(c + 1.1), h2 = hash(c + 4.7), h3 = hash(c + 8.3), h4 = hash(c + 2.9);
  if (ci.y >= int(uGrid.y) || h1 > .66) { gl_Position = GONE; return; }
  vec2 home = (c + hash2(c + 2.2)) * uGrid.zw;
  int j = int(floor(h2 * 2.999));
  float Pb = fiFrontBirth(j, home, S), age = P - Pb, dev = fiS(FI_DEV, P);
  float gone = smoothstep(h4 * .55, h4 * .55 + .3, dev);
  if (age <= 0.0 || gone >= 1.0) { gl_Position = GONE; return; }
  float settle = fiS(FI_SET, P - .03 * (1.0 - h3));
  vec2 p = home + FI_FN[j] * (26.0 + 80.0 * h3) * (1.0 - exp(-age / .03));
  p += (vec2(noise(home * .011 + uTime * .05), noise(home * .011 + 5.0 - uTime * .04)) - .5) * 26.0 * (1.0 - settle);
  // Its depth: off the plane it is larger, softer and dimmer; it comes to the plane as it settles.
  float z = (h4 - .5) * 2.0 * (1.0 - settle);
  p = S * .5 + (p - S * .5) * (1.0 + .3 * z);
  // The ripple bends them as it passes, and they catch its sheen.
  float rp = clamp((P - FI_RIP.x) / (FI_RIP.y - FI_RIP.x), 0.0, 1.0), amp = fiRippleAmp(rp), sheen = 0.0;
  if (amp > 0.0) p += fiRipple(p, S, rp, sheen) * amp * 30.0;
  float sz = (.65 + 1.0 * h3 * h3) * (1.0 + 1.8 * abs(z));
  float tw = pow(.5 + .5 * sin(uTime * (2.0 + 5.0 * h1) + h2 * 60.0), 3.0);
  float cool = smoothstep(.008, .075, age);
  vec3 hot = j == 0 ? FI_GOLD : j == 1 ? FI_ROSE : FI_VIOLET;
  vCol = mix(hot * 1.5, FI_SILVER * (.3 + .95 * tw), cool) / (1.0 + 1.4 * abs(z)) * smoothstep(0.0, .012, age) * (1.0 - gone) * (1.0 + 2.5 * sheen * amp);
  vK = QUAD[gl_VertexID % 6] * 2.0 - 1.0;
  vec2 xy = uRegion.xy + p + vK * sz * 2.2;
  gl_Position = vec4(xy.x / uView.x * 2.0 - 1.0, 1.0 - xy.y / uView.y * 2.0, 0.0, 1.0);
}`;
const GRAINS_FS = /* glsl */ `
in vec2 vK;
in vec3 vCol;
void main() { o = vec4(vCol * exp(-dot(vK, vK) * 4.5), 0.0); }`;

// As glsl/units.js builds its own: vs after VHEAD, fs after FHEAD (+ NOISE where noise: true).
export const FIRE_UNITS = {
  embers: { vs: EMBERS_VS, fs: EMBERS_FS, verts: 6, blend: 'over', noise: true },
  ribbons: { vs: RIBBONS_VS, fs: RIBBONS_FS, verts: F.ribbon.seg * 6, blend: 'add' },
  grains: { vs: GRAINS_VS, fs: GRAINS_FS, verts: 6, blend: 'add' },
};
