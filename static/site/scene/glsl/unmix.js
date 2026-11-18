// Photography → Chess: the two cached flow maps transport the original high-resolution
// pigment textures. The first carries sixteen wet drops across the red tray. The second
// gathers ink onto the back ranks. A moving meniscus uncovers the tile's own board.
import { UNMIX, SLOTS } from '../unmix-plan.js';
import { MARGIN } from '../staunton.js';

const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(5)));
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;

export const UNMIX_SEEN = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform vec2 uTexel;            // the target, px
uniform sampler2DArray uKeys1;  // the rain's map, its keyframes
uniform sampler2DArray uKeys2;  // the dissolve's
uniform sampler2D uDye1, uDye2; // their first pictures
uniform vec2 uN;                // keyframes in each
uniform vec2 uK;                // where each is now, in keyframes
uniform vec2 uW;                // how much of each shows
uniform float uProgress;
uniform vec4 uDrop[16]; // centers, radii and piece slots in rain-grid coordinates
uniform float uAbove;           // the rain's grid reaches this share of the screen above it
uniform vec2 uTremble;          // the outline's trembling: how much (domain units), its time
out vec4 o;
// A keyframe's way back at uv, read with a cubic B-spline (four bilinear reads).
vec4 key(sampler2DArray t, vec2 uv, float l) {
  vec2 n = vec2(textureSize(t, 0).xy), p = uv * n - .5, f = fract(p), i = p - f, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, a = (i + w1 / g0 - .5) / n, b = (i + w3 / g1 + 1.5) / n;
  return g0.y * (g0.x * texture(t, vec3(a, l)) + g1.x * texture(t, vec3(b.x, a.y, l)))
       + g1.y * (g0.x * texture(t, vec3(a.x, b.y, l)) + g1.x * texture(t, vec3(b, l)));
}
vec4 mapAt(sampler2DArray t, vec2 uv, float k, float n) {
  float l0 = clamp(floor(k), 0.0, n - 1.0), l1 = min(l0 + 1.0, n - 1.0);
  return mix(key(t, uv, l0), key(t, uv, l1), clamp(k - l0, 0.0, 1.0));
}
// Sample the same source texture during the fall and after entry. Stretch a
// tapered neck behind each heavy head, relaxing exactly to the solver's seed.
vec4 dripping(vec2 c, vec2 cells) {
  vec4 pigment = vec4(0);
  for (int i=0; i<16; ++i) {
    vec4 d = uDrop[i];
    float start = mix(${f(UNMIX.drops[0])}, ${f(UNMIX.drops[1])}, float((i*7)%16)/15.0);
    if (uProgress <= start || abs(c.x-d.x)>1.4*d.z) continue;
    float t = clamp((uProgress-start)/(${f(UNMIX.rain[0])}-start),0.0,1.0);
    float lift = 1.0-t*t*(2.0-t);
    vec2 head = vec2(d.x, mix(d.y, cells.y/(1.0+uAbove)+1.6*d.z,lift));
    float stretch = sin(3.141593*t);
    vec2 p = (c-head)/d.z;
    float tail = max(0.0,p.y);
    vec2 local = vec2(p.x*(1.0+.22*stretch),p.y/(1.0+.42*stretch));
    local.x += .1*stretch*sin(tail*1.4+float(i))*tail;
    local.y /= 1.0+stretch*min(tail,4.0);
    local.x *= 1.0+stretch*tail*tail;
    if (dot(local,local)>=1.0) continue;
    vec4 seed = textureLod(uDye1,(d.xy+local*d.z)/cells,0.0);
    if (seed.r+seed.g > pigment.r+pigment.g)
      pigment = vec4(seed.rg,sqrt(max(0.0,1.0-dot(local,local))),seed.b);
  }
  return pigment;
}

// A dyed parcel has a concentrated core, thin folded sheets at its edge,
// and a diffuse suspension transported and mixed by the Eulerian grid.
vec2 pigmentAt(sampler2D dye, vec2 source, vec2 dissolved, float mixing) {
  vec2 core = textureLod(dye,source,0.0).rg;
  vec2 skirt = textureLod(dye,source,4.2).rg;
  float phase = source.y*318.0 + 4.0*sin(source.x*45.0+source.y*26.0)
              + 1.4*sin(source.x*83.0-source.y*32.0);
  float resolved = 1.0-smoothstep(.65,3.14,fwidth(phase));
  float sheets = .62 + .38*cos(phase)*resolved;
  float fine = 2.63*phase + 1.5*sin(source.y*270.0+source.x*65.0);
  sheets += .17*cos(fine)*(1.0-smoothstep(.65,3.14,fwidth(fine)));
  return mix(core, core*.54 + skirt*sheets*.73 + dissolved*1.42, mixing);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uTexel, ink = vec2(0.0);
  float height = 0.0, slotTag = 0.0;
  vec2 u1 = vec2(uv.x, uv.y / (1.0 + uAbove));
  if (uProgress < ${f(UNMIX.rain[0])}) {
    vec2 cells = vec2(textureSize(uKeys1,0).xy);
    o = dripping(u1*cells,cells);
    return;
  }
  if (uW.x > 0.0) {
    vec4 flow = mapAt(uKeys1, u1, uK.x, uN.x);
    vec2 source = u1 + flow.xy;
    vec4 seed = textureLod(uDye1,source,0.0);
    ink += uW.x*pigmentAt(uDye1,source,flow.zw,smoothstep(.145,.34,uProgress));
    slotTag = uW.x*seed.b;
    height = sqrt(max(0.0,1.0-seed.a*seed.a))*step(.01,seed.r+seed.g);
  }
  if (uW.y > 0.0) {
    vec4 flow = mapAt(uKeys2, uv, uK.y, uN.y);
    vec2 m = uv + flow.xy;
    m += uTremble.x * vec2(sin(m.y * 95.0 + uTremble.y * 9.0) + .5 * sin(m.x * 61.0 - uTremble.y * 13.0), cos(m.x * 83.0 - uTremble.y * 7.0) + .5 * cos(m.y * 57.0 + uTremble.y * 11.0));
    ink += uW.y * pigmentAt(uDye2,m,flow.zw,1.0-smoothstep(.72,.91,uProgress));
    slotTag += uW.y * textureLod(uDye2,m,0.0).b;
  }
  o = vec4(ink, height, slotTag);
}`;

export const UNMIX_GLSL = /* glsl */ `
uniform sampler2D uB3;       // Chess's board in three dimensions (board3d.js): its box, a margin round it (unit 11)
uniform sampler2D uB3Mask;   // its ink over the screen: pigment (R, G), which piece (B: slot + 1 over 64, the board 1), how high (A) (unit 12)
uniform vec4 uB3Box;         // the board's box on the screen (CSS px)
uniform float uB3On;
const vec2 UM_DIFFUSE = ${v2(UNMIX.diffuse)}, UM_FOCUS = ${v2(UNMIX.focus)};
const vec2 UM_HARDEN = ${v2(UNMIX.harden)}, UM_SQUARES = ${v2(UNMIX.squares)}, UM_CLEAR = ${v2(UNMIX.clear)};
const float UM_SPAN = ${f(UNMIX.span)}, UM_LODMAX = ${f(UNMIX.lodMax)}, UM_MARGIN = ${f(MARGIN)};
const float UM_ORDER[32] = float[32](${SLOTS.map(s => f(s.order)).join(', ')});
const float UM_TALL[32] = float[32](${SLOTS.map(s => f(s.tall)).join(', ')});
float umS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }
float umLod(float P) { return UM_LODMAX * umS(UM_DIFFUSE, P) * (1.0 - umS(UM_FOCUS, P)); }
// The board's picture at screen point px (premultiplied).
vec4 umBoard(vec2 px) {
  vec2 t = ((px - uB3Box.xy) / uB3Box.zw + UM_MARGIN) / (1.0 + 2.0 * UM_MARGIN);
  return texture(uB3, vec2(t.x, 1.0 - t.y));
}
// The board where its ink has landed, cured into the board itself at P: the squares outward from the
// middle (a ring of light at the front), then each piece from its foot to its crown (its slot and height
// from the board's mask at screen uv), a glint at its front. Outside the board, as the world comes (clear),
// the board's shadow on it.
vec3 umCure(vec3 col, vec2 q, vec2 px, vec2 uv, float P, float clear) {
  vec4 bd = umBoard(px);
  vec4 mk = texelFetch(uB3Mask, ivec2(uv * vec2(textureSize(uB3Mask, 0))), 0);
  vec2 bc = uB3Box.xy + .5 * uB3Box.zw;
  float cured = 0.0, glint = 0.0;
  if (mk.b > .99) {
    float r = length((q - bc) / uB3Box.zw) * 1.6, t = umS(UM_SQUARES, P) * 1.15;
    cured = smoothstep(-.05, .05, t - r);
    glint = exp(-pow((r - t) / .02, 2.0)) * step(.001, t) * step(t, 1.14);
  } else if (mk.b > .5 / 64.0) {
    int s = clamp(int(mk.b * 64.0 + .5) - 1, 0, 31);
    float t = clamp((P - (UM_HARDEN.x + UM_ORDER[s] * (UM_HARDEN.y - UM_HARDEN.x - UM_SPAN))) / UM_SPAN, 0.0, 1.0);
    float y = mk.a * 1.5, fy = t * (UM_TALL[s] + .08);
    cured = smoothstep(-.015, .015, fy - y);
    glint = exp(-pow((y - fy) / .014, 2.0)) * step(.001, t) * step(t, .999);
  } else col *= 1.0 - .6 * bd.a * clear;
  col = mix(col, bd.rgb + col * (1.0 - bd.a), cured);
  return col + vec3(1.0, .96, .88) * glint * (.8 + .6 * hash(floor(q * .5) + floor(P * 200.0)));
}
vec3 groundUnmix(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  if (P <= ${f(UNMIX.drops[0])} || uIceReady < .5) return P < .5 ? sceneDarkroom(px) : sceneInk(px);
  vec2 uv = vec2(q.x / S.x, 1.0 - q.y / S.y);
  float bath = smoothstep(.27,.58,P);
  vec3 grey = vec3(.505,.516,.523) + .022*(.5-uv.x+.7*uv.y);
  // Wide filtered samples represent suspended pigment around the sharp transported
  // cores. The veil first spreads out of each plume; eventually it spans the tray.
  vec2 cloud = textureLod(uFlow,uv,mix(3.0,7.0,bath)).rg;
  float suspended = 1.0-exp(-6.0*(cloud.r+cloud.g));
  float veil = bath + (1.0-bath)*smoothstep(.13,.36,P)*suspended*.91;
  grey += vec3(.064,.061,.057)*(cloud.g-cloud.r);
  vec3 col = grey;
  if (bath < 1.0) col = mix(sceneDarkroom(px), grey, veil);

  vec4 film = textureLod(uFlow,uv,0.0);
  vec2 ink = mix(film.rg, textureLod(uFlow,uv,umLod(P)).rg, .6);
  float still = smoothstep(.43,.555,P)*(1.0-smoothstep(.56,.74,P));
  ink *= 1.0 - .73*still;
  // Trace two short paths toward a broad studio light. Dense folds throw a soft
  // shadow through the suspension while their free edges transmit the safelight.
  vec2 lightStep = vec2(-.004,.007);
  vec2 over = textureLod(uFlow,uv+lightStep,2.0).rg*.65
            + textureLod(uFlow,uv+lightStep*2.7,3.0).rg*.35;
  float shadow = exp(-(.8*over.r+.46*over.g)*(1.0-still));
  float body = ink.r + ink.g, bead = 1.0-smoothstep(.145,.24,P);
  float relief = mix(body*.10, film.b, bead);
  vec2 slope = vec2(dFdx(relief),dFdy(relief)) * min(S.x,S.y)*.038;
  vec3 normal = normalize(vec3(-slope,1.0));
  vec3 lamp = normalize(vec3(-.54,.58,.61));
  float diffuse = max(0.0,dot(normal,lamp));
  float highlight = pow(max(0.0,dot(normal,normalize(lamp+vec3(0,0,1)))),64.0);
  float rim = pow(1.0-normal.z,2.0);
  col *= mix(1.0,shadow,.42);
  vec3 black = mix(vec3(.010,.014,.023),vec3(.09,.11,.14),diffuse*.55+rim*.35);
  vec3 pearl = mix(vec3(.48,.51,.55),vec3(.99,.97,.92),diffuse*shadow);
  col = mix(black,col,exp(-4.7*ink.r));
  col = mix(col,pearl,1.0-exp(-4.0*ink.g));
  // Each recipient inherits the slightly different lustre of its original drop.
  float lustre = .81+.17*cos(round(film.a*64.0)*2.4);
  col += vec3(.92,.86,.76)*(highlight*lustre*(.18+.82*bead)+rim*(.04+.18*bead))*smoothstep(.02,.25,body);

  // The submerged back ranks take on the relief of the tile's actual pieces.
  vec4 board = vec4(0.0);
  if (uB3On > .5 && P > .79) {
    board = umBoard(px);
    float value = dot(board.rgb, vec3(.2126,.7152,.0722));
    col = mix(col,vec3(value),smoothstep(.87,.945,P)*smoothstep(.15,.85,body));
  }

  if (P >= UM_CLEAR.x) {
    float drain = umS(UM_CLEAR,P);
    float ripple = sin(q.x*.016 + drain*12.0) + .35*sin(q.x*.035-drain*17.0);
    float surface = mix(-12.0,S.y+12.0,drain) + 2.4*ripple;
    float depth = q.y-surface;
    vec3 dry = sceneInk(px);
    dry = board.rgb + dry*(1.0-board.a);
    float wet = smoothstep(-1.25,1.25,depth);
    col = mix(dry,col,wet);
    // A narrow silver lip and its softer submerged shadow travel down the page together.
    col *= 1.0-.16*wet*exp(-abs(depth-3.0)/2.5);
    col += vec3(.32,.34,.34)*exp(-depth*depth/2.8);
  }
  return col;
}

// ---- A click into Chess (opens.js) -------------------------------------------------------------------
// The same story at the click, in two and a half seconds: black and white ink bloom out from it over the
// old page as one front rolling up into mushroom pairs (glsl/plume.js pmcBack), over lit water; as the
// bloom covers the screen, the same board the scroll builds cures in where it stands (its squares from the
// middle, then each piece from its foot); the water clears to Chess's world. On the new page (umClickReveal)
// the board soaks into it, from its middle out. E: the cover's clock (0 … 1.04); a: how much it covers.
vec4 umClickLook(vec2 px, vec2 O, float far, float E, float relax) {
  float front = far * (.04 + 1.02 * smoothstep(0.0, .5, E));
  vec2 X = pmcBack(px, O, front, E);
  float rX = length(X - O), dye = smoothstep(front + 5.0, front - 5.0, rX);
  float a = max(dye, smoothstep(.55, .8, E));
  vec2 wq = (X - O) * .0045;
  wq += (vec2(fbm3(wq * 1.6 + 2.0), fbm3(wq * 1.6 + 7.3)) - .5) * 1.6;
  float white = smoothstep(.42, .58, fbm3(wq + 11.0)), billow = smoothstep(.3, .75, fbm3(wq * 1.8 + 4.0));
  float dens = dye * ((.25 + .9 * billow) * (.45 + .55 * smoothstep(.1, 1.0, rX / max(front, 1.0))) + 1.3 * exp(-pow((rX - front * .94) / (front * .05 + 3.0), 2.0)));
  // The ink diffuses, then lets go of the board's place.
  dens *= 1.0 - .75 * smoothstep(.5, .85, E);
  float m = min(R.x, R.y), clear = smoothstep(.82, 1.04, E);
  vec3 col = pmWater((px - R * .5) / m, R * .5 / m, 1.0);
  float B = dens * (1.0 - white) * 2.0, W = dens * white * 1.8;
  col *= exp(-B * vec3(1.08, 1.0, .82));
  col = mix(col, PM_INK * .5, (1.0 - exp(-1.4 * B)) * .55);
  col = mix(col, PM_PEARL, 1.0 - exp(-W));
  col = mix(col, sceneOf(1, px), clear);
  if (uB3On > .5) {
    vec2 uv = vec2(px.x / R.x, 1.0 - px.y / R.y);
    // (the cure on the scroll's own clock, from its start to its end)
    float P = mix(UM_SQUARES.x - .01, UM_HARDEN.y, smoothstep(.45, 1.0, E));
    col = umCure(col, px, px, uv, P, clear);
    // On the new page: the board soaks in, from its middle out, and is gone.
    vec2 bc = uB3Box.xy + .5 * uB3Box.zw;
    float r = length((px - bc) / uB3Box.zw), go = smoothstep(r * .6, r * .6 + .4, relax);
    col = mix(col, sceneOf(1, px), go);
  }
  return vec4(col, a);
}
vec4 umClickCover(vec2 px, vec2 O, float far, float E) { vec4 l = umClickLook(px, O, far, E, 0.0); return vec4(l.rgb * l.a, l.a); }
vec3 umClickReveal(vec2 px, vec2 O, float far, float e) { return umClickLook(px, O, far, 1.04, e).rgb; }
`;