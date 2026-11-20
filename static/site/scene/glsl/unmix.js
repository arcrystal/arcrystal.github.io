import { UNMIX, SLOTS } from '../unmix-plan.js';
import { CAMERA, TANK_GLSL } from '../ink-tank.js';
import { MARGIN, BOARD } from '../staunton.js';
import { D1, FRONT } from '../ink-drain.js';
import { PIECE_ENV } from './board3d.js';

const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(5)));
const v2 = a => `vec2(${f(a[0])}, ${f(a[1])})`;

export const UNMIX_GLSL = /* glsl */ `
uniform sampler2D uBathRoom; // Darkroom wall used by reflected rays
uniform sampler2D uInkAir;   // Separate free-falling paint above the reflective surface
uniform sampler2D uB3;       // Chess's board in three dimensions (board3d.js): its box, a margin round it (unit 11)
uniform sampler2D uB3Mask;   // its ink over the screen: pigment (R, G), which piece (B: slot + 1 over 64, the board 1), how high (A) (unit 12)
uniform vec4 uB3Box;         // the board's box on the screen (CSS px)
uniform float uB3On;
const vec2 UM_HARDEN = ${v2(UNMIX.harden)}, UM_SQUARES = ${v2(UNMIX.squares)}, UM_CLEAR = ${v2(UNMIX.clear)};
const float UM_SPAN = ${f(UNMIX.span)}, UM_MARGIN = ${f(MARGIN)};
const float UM_ORDER[32] = float[32](${SLOTS.map(s => f(s.order)).join(', ')});
const float UM_TALL[32] = float[32](${SLOTS.map(s => f(s.tall)).join(', ')});
float umS(vec2 r, float x) { return smoothstep(r.x, r.y, x); }
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
${TANK_GLSL}
// A shallow presentation tank, viewed across its actual free surface. The
// opposite wall and near meniscus use the camera that projects the impacts.
float umSurfaceChop(float x,float t){
  return .60*sin(x*7.7+t)+.24*sin(x*16.8-1.6*t+.7)+.13*cos(x*31.+2.*t);
}
float umNear(vec2 uv,vec4 cam,float phase){
  return cam.x-.5*cam.y+(.002+.005*cam.w)*umSurfaceChop(uv.x,phase);
}
float umBack(vec2 uv,vec4 cam,float phase){
  return cam.x+.5*cam.y+.0018*umSurfaceChop(uv.x,phase+.8);
}
// An analytically differentiated small wave spectrum on the plane. Its high
// frequencies run across the long swell and are filtered at grazing angles.
vec2 umSwell(vec2 p,float phase){
  // More wind shear along the short dimension of each crest, with two
  // nonparallel capillary trains crossing the primary swell.
  float tide=4.2*p.x+11.4*p.y+.37*phase;
  float crosswave=-9.6*p.x+25.8*p.y-.57*phase+.8*sin(tide);
  float fine=11.4*p.x+73.3*p.y+.82*phase+1.34*sin(crosswave)+.77*cos(tide);
  float glimmer=-29.2*p.x+157.4*p.y-1.06*phase+1.7*sin(fine);
  // A projected pixel covers more of the back surface. Taper its capillary
  // spectrum there, and on small drawing buffers.
  float filterFine=smoothstep(170.,570.,uRegion.w*(.54+.46*p.y));
  return vec2(.015,.028)*cos(tide)+vec2(-.010,.017)*cos(crosswave)
    +vec2(.0041,.016)*cos(fine)+filterFine*vec2(-.0022,.0082)*cos(glimmer);

}
// The two lamps the waves catch: a broad warm one and a long silver one broken by fine crests; only a
// few facets align with it. warm: the first's colour (the safelight, or Chess's day on the drain).
vec3 umGlints(vec3 N,vec3 V,vec2 p,vec2 slope,float farDistance,vec3 warm){
  float softCosine=max(dot(N,normalize(V+normalize(vec3(-.24,.32,-.89)))),0.);
  vec3 c=warm*pow(softCosine,43.);
  vec3 H=normalize(V+normalize(vec3(.14,.49,-.87)));
  float broaden=.48+.4*noise(p*vec2(6.8,14.));
  vec2 specSlope=H.xz/max(.10,H.y)+slope;
  float gloss=exp(-dot(specSlope*vec2(7.3,38.),specSlope*vec2(7.3,38.)))*broaden;
  return c+vec3(.23,.237,.23)*gloss*(.47+.53*farDistance);
}
vec3 umReflection(vec3 r,vec2 plane,float rough){
  // Intersect the reflected ray with the surrounding room. Translating the
  // intersection from each patch on the water gives the distant lights their
  // correct parallax. The photographic plate is in top-down image coordinates.
  vec2 wall=vec2(plane.x-.5,0.)+r.xy*(1.02+.46*(1.-plane.y))/max(.22,-r.z);
  vec2 look=clamp(vec2(.50+.57*wall.x,.92-.85*wall.y),.003,.997);
  vec3 incident=textureLod(uBathRoom,look,1.1+5.*rough+.65*plane.y).rgb;
  return vec3(.055,.069,.076)+1.65*incident;
}
// Transmission samples the world under the tank at the displaced ray. On
// the return journey this includes the actual wood, moving pieces and paper.
vec3 umSubstrate(vec2 px,vec2 uv,bool returning){
  if(!returning)return sceneDarkroom(px);
  vec3 col=sceneInk(px);
  if(uB3On>.5){
    vec2 boardPx=uRegion.xy+vec2(uv.x,1.-uv.y)*uRegion.zw;
    vec4 board=umBoard(boardPx);
    col=board.rgb+col*(1.-board.a);
  }
  vec4 piece=texture(uTexA,uv);
  return piece.rgb+col*(1.-piece.a);
}
// ---- The drain (ink-drain.js) ------------------------------------------------------------------------
// D1: the tank's surface falls as it rose, its far side open. D2: a plane in the board's world sinks
// through the crowns, the board and the page, tipping toward the back as it drains away behind them.
${PIECE_ENV}
uniform sampler2D uB3Geo; // what each pixel of the board's picture sees: world y (R) and z (G) (board3d.js, unit 13)
uniform vec3 uB3Eye;      // the board camera's eye (staunton.js frameCamera at the box's proportion)
uniform vec4 uDrain;      // the water's height over the board, its tilt, wave units per world unit, hand-over 0 … 1
uniform vec2 uDrainO;     // the board's plane's place in the tank's wave units
const vec3 UM_FWD = vec3(0.0, ${f(-Math.sin(0.9))}, ${f(-Math.cos(0.9))}), UM_UP = vec3(0.0, ${f(Math.cos(0.9))}, ${f(-Math.sin(0.9))});
const float UM_TAN = ${f(Math.tan(0.21))}, UM_SLAB = ${f(BOARD.slab)}, UM_FRONT = ${f(FRONT)};
const vec2 UM_D1 = ${v2(D1)};
// The board camera's ray through a screen point (CSS px from the top left), the box framing the board.
vec3 umRay(vec2 px) {
  vec2 t = (px - uB3Box.xy) / uB3Box.zw;
  vec2 s = vec2(2.0 * t.x - 1.0, 1.0 - 2.0 * t.y) * UM_TAN * vec2(uB3Box.z / uB3Box.w, 1.0);
  return normalize(UM_FWD + vec3(s.x, 0.0, 0.0) + UM_UP * s.y);
}
// The point of the board's world a screen point sees (y, z): within the picture's margin its own
// geometry, piece, board or page; beyond it the page under the board.
vec2 umSeen(vec2 px, vec3 rd) {
  vec3 page = uB3Eye + rd * ((-UM_SLAB - uB3Eye.y) / min(rd.y, -1e-4));
  vec2 t = ((px - uB3Box.xy) / uB3Box.zw + UM_MARGIN) / (1.0 + 2.0 * UM_MARGIN);
  if (uB3On < .5 || any(lessThan(t, vec2(.002))) || any(greaterThan(t, vec2(.998)))) return page.yz;
  vec4 g = textureLod(uB3Geo, vec2(t.x, 1.0 - t.y), 0.0);
  return g.a > .5 ? g.rg / g.a : page.yz;
}
// The surface over the drained Chess world, and where it has gone, that world drying.
vec3 umDrainSurface(vec2 uv, vec2 px, float P, vec4 cam, float phase) {
  float aspect = uRegion.z / uRegion.w, shortSide = min(uRegion.z, uRegion.w);
  float m = uDrain.w, day = mix(.35, 1.0, smoothstep(UM_D1.x, UM_D1.y - .01, P));
  vec3 rd = umRay(px);
  vec2 seen = umSeen(px, rd);
  float h = uDrain.x, s = uDrain.y;
  // Water over the point seen (world units; < 0: that point is out of the water by so much).
  float depth = h + s * (seen.y - UM_FRONT) - seen.x;
  // The surface over it: the tank's, open behind its old far wall, handed over to the board's plane
  // while the whole screen is surface.
  vec2 plane = waterXZOpen(uv, cam, aspect);
  vec2 pT = plane * vec2(clamp(aspect, .65, 2.2), 1.0);
  // (Behind its old far wall the view keeps grazing lower toward the horizon, never below it.)
  float lift = plane.y < 0.0 ? .27 * exp(1.556 * plane.y) : .27 + .42 * plane.y;
  vec3 VT = normalize(vec3((.5 - uv.x) * .47, lift, 1.0 - .23 * plane.y));
  float tw = (h + s * (uB3Eye.z - UM_FRONT) - uB3Eye.y) / min(rd.y - s * rd.z, -1e-4);
  vec3 hit = uB3Eye + rd * tw;
  vec2 p = mix(pT, hit.xz * uDrain.z + uDrainO, m);
  vec3 V = normalize(mix(VT, -rd, m));
  float farDistance = mix(clamp(1.0 - plane.y, 0.0, 1.6), 0.0, m);
  vec4 waves = texture(uReach, uv);
  vec2 impact = vec2(waves.r - waves.g, waves.b - waves.a);
  // Seen from above, the same swell must lean further to be seen: the draining water is stirred, more
  // and more as the camera comes over it.
  float over = smoothstep(UM_D1.y - .02, UM_D1.y + .025, P), stir = mix(1.0, 2.1, over);
  vec2 swell = umSwell(p, phase) * stir;
  vec2 slope = swell + vec2(.27, .31) * impact;
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  float cosine = clamp(dot(V, N), 0.0, 1.0), fresnel = .0204 + .9796 * pow(1.0 - cosine, 5.0);
  // What lies under the surface, bent by the waves the more water there is over it, dimmed and cooled
  // by that water; lit by the darkroom's safelight giving way to Chess's day.
  float bend = clamp(depth / 3.2, 0.0, 1.5) / stir;
  vec2 offset = (swell * vec2(28.0, -34.0) + impact * vec2(62.0, -52.0)) * shortSide / 800.0 * bend;
  vec3 floorC = umSubstrate(px + offset, uv + offset * vec2(1.0, -1.0) / uRegion.zw, true);
  if (over > 0.0) {
    // Caustics: each crest is a weak lens, gathering the daylight into bright webs on what lies under
    // it (intensity 1 / |1 − d (1 − 1/n) ∇²η|), sharpest a little under the surface, gone in the deep.
    vec2 e = vec2(.004, 0.0);
    float lap = (umSwell(p + e.xy, phase).x - umSwell(p - e.xy, phase).x + umSwell(p + e.yx, phase).y - umSwell(p - e.yx, phase).y) / (2.0 * e.x) * stir;
    float focus = clamp(depth, 0.0, 3.0) * .25 * uDrain.z * lap * 5.5;
    float caustic = 1.0 / clamp(abs(1.0 + focus), .28, 3.0);
    floorC *= mix(1.0, .84 + .2 * caustic, over * exp(-max(depth, 0.0) / 2.4) * smoothstep(0.0, .25, depth));
  }
  vec3 through = exp(-max(depth, 0.0) * vec3(.17, .115, .088));
  vec3 body = floorC * mix(vec3(.405, .338, .31), vec3(1.0), day) * through + vec3(.075, .098, .122) * (1.0 - through);
  body = mix(body, mix(vec3(.159, .165, .166), vec3(.60, .63, .64), day), .37 * farDistance * farDistance);
  float rough = .095 + .14 * noise(p * vec2(4.2, 7.3));
  vec3 refl = reflect(-V, N);
  vec3 environment = mix(umReflection(refl, plane, rough), roomEnv(refl) * .62, day);
  vec3 top = body * (1.0 - fresnel) + environment * (fresnel + mix(.115, .035, day));
  top += umGlints(N, V, p, slope, farDistance, mix(vec3(.155, .097, .082), vec3(.13, .125, .115), day));
  // From above, a tall window behind the board lies on the water, broken by the waves into glitter.
  vec3 Hw = normalize(V + normalize(vec3(-.20, .70, -.69)));
  vec2 lean = Hw.xz / max(.10, Hw.y) + slope;
  float glitter = exp(-dot(lean * vec2(7.5, 20.0), lean * vec2(7.5, 20.0))) * (.5 + .5 * noise(p * vec2(9.0, 23.0)));
  top += vec3(.24, .236, .226) * glitter * over * (1.0 - exp(-max(depth, 0.0) * 6.0));
  if (m <= 0.0) return top;
  // The meniscus where the plane meets what stands in it, a hair above its line, and the sheen it
  // leaves on what it has uncovered.
  float w = clamp(fwidth(depth) * 1.5, .0025, .02);
  vec3 dry = umSubstrate(px, uv, true);
  float wet = exp(min(depth, 0.0) / .12) * m;
  dry = dry * (1.0 - .17 * wet) + roomEnv(reflect(rd, vec3(0.0, 1.0, 0.0))) * .045 * wet;
  vec3 col = mix(dry, top, smoothstep(-w, w, depth));
  float meniscus = exp(-pow((depth + .012) / max(w, .006), 2.0));
  return col + vec3(.62, .6, .55) * meniscus * m * .5;
}
// Two views of one free surface. The near meniscus separates the bath from
// the reflecting plane; the far wall separates that plane from the dry world.
vec3 umFill(vec2 uv,vec2 px,float P,bool returning,out vec3 surface,out float underwater,
            out float pigmentThrough,out float lip){
  vec4 cam=waterCamera(P);
  float phase=16.*min(P,${CAMERA.start})+3.1*(cam.x-${CAMERA.above[0]})+.23*T;
  float near=umNear(uv,cam,phase),farEdge=umBack(uv,cam,phase),distanceUnder=near-uv.y;
  float exposure=smoothstep(0.,.078,P);
  float shortSide=min(uRegion.z,uRegion.w),aa=max(1./uRegion.w,.0005);
  vec2 plane=waterXZ(uv,cam,uRegion.z/uRegion.w);
  // (Draining, the far side is open: there is only surface above the near meniscus.)
  float water=returning?1.:smoothstep(-aa,aa,farEdge-uv.y);
  underwater=smoothstep(-.012,.018,distanceUnder)*smoothstep(.015,.37,cam.w);
  float throughUnder=exp(-max(0.,distanceUnder)*16.)*.22*(1.-smoothstep(.94,1.,cam.w));
  surface=vec3(0);
  // Fully immersed rays skip the reflection, refraction and substrate lookup.
  if(returning){
    // (Once the plane has the surface, the near meniscus is below the screen and every pixel comes
    // here, so the meniscus's derivatives are taken in uniform control flow.)
    if(underwater<.999 || throughUnder>.001)surface=umDrainSurface(uv,px,P,cam,phase);
  }else if(underwater<.999 || throughUnder>.001){
    if(water<=.001){
      surface=umSubstrate(px,uv,returning);
    }else{
      vec4 waves=texture(uReach,uv);
      vec2 impact=vec2(waves.r-waves.g,waves.b-waves.a);
      vec2 p=plane*vec2(clamp(uRegion.z/uRegion.w,.65,2.2),1.);
      vec2 swell=umSwell(p,phase);
      // A replayed impact perturbs the local normal and the transmitted ray.
      // Breaking its crest into small highlights prevents dark concentric rims.
      vec2 slope=swell+vec2(.27,.31)*impact;
      vec3 N=normalize(vec3(-slope.x,1.,-slope.y));
      vec3 V=normalize(vec3((.5-uv.x)*.47,.27+.42*plane.y,1.-.23*plane.y));
      vec3 refl=reflect(-V,N);
      float cosine=clamp(dot(V,N),0.,1.);
      float fresnel=.0204+.9796*pow(1.-cosine,5.);
      vec2 offset=(swell*vec2(28.,-34.)+impact*vec2(62.,-52.))*shortSide/800.*water*exposure;
      vec3 refracted=umSubstrate(px+offset,uv+offset*vec2(1.,-1.)/uRegion.zw,returning);
      // The Photography floor is already lit by the safelight. Bring the
      // daylight material of Chess under the same dim lamp while covered;
      // its open-air exposure returns at the far contact line.
      vec3 floorLight=returning?refracted*vec3(.30,.25,.23):refracted;
      vec3 body=vec3(.070,.092,.104)+floorLight*vec3(.51,.39,.37);
      float farDistance=1.-plane.y;
      body=mix(body,vec3(.159,.165,.166),.37*farDistance*farDistance);
      float rough=.095+.14*noise(p*vec2(4.2,7.3));
      vec3 environment=umReflection(refl,plane,rough);
      // The dark substrate and lit room give small Fresnel reflections high
      // contrast. Below the far edge the actual water has a double contact line.
      vec3 top=body*(1.-fresnel)+environment*(fresnel+.115);
      // The overhead safelight produces a broad weak warmth. A second long
      // silver source is broken by fine crests; only a few facets align with it.
      top+=umGlints(N,V,p,slope,farDistance,vec3(.155,.097,.082));
      float distanceToWall=farEdge-uv.y;
      top*=1.-.32*exp(-abs(distanceToWall-.0025)/.0024);
      top+=vec3(.39,.32,.26)*exp(-abs(distanceToWall-.0009)/max(.00065,aa))*(.69+.31*cos(plane.x*8.));
      surface=mix(refracted,top,water*exposure);
    }
  }
  // Keep most of the plunging pigment behind the reflecting water. When the
  // near lip moves overhead the same folded and dispersed ink becomes visible.
  float glance=mix(.22,.38,plane.y);
  pigmentThrough=mix(glance*water,1.,underwater);
  vec2 light=(uv-vec2(.68,.72))*vec2(.95,.86);
  float transmission=exp(-1.45*dot(light,light));
  vec3 bath=mix(vec3(.235,.258,.267),vec3(.82,.79,.752),transmission);
  // A cool lateral fill silhouettes the pale ink. The opposite, lit wall
  // stays warm behind the large carbon plume while the camera is immersed.
  float chamber=smoothstep(.47,.565,P)*(1.-smoothstep(.92,1.065,P));
  float falloff=smoothstep(.22,.92,uv.x+.16*(.5-uv.y));
  bath=mix(bath,vec3(.225,.286,.307),chamber*(.045+.28*falloff));
  float ceilingGlow=exp(-4.7*max(.03,distanceUnder));
  bath+=vec3(.19,.049,.025)*ceilingGlow;
  float shaft=sin(4.9*uv.x+1.4*uv.y+.21*sin(6.*uv.y+phase*.10));
  bath+=vec3(.032,.030,.027)*shaft*ceilingGlow;
  float veil=sin(25.*uv.x+17.*distanceUnder+2.1*sin(12.*uv.x-phase*.13)+phase*.20);
  bath+=vec3(.059,.048,.038)*pow(max(veil,0.),4.)*exp(-9.*abs(distanceUnder))*smoothstep(.1,.60,cam.w);
  bath=mix(bath,surface,throughUnder);
  lip=exp(-abs(distanceUnder)/.0025)*smoothstep(.04,.51,cam.w);
  return bath;
}
vec3 groundUnmix(vec2 q, vec2 px, float P) {
  vec2 S = uRegion.zw;
  if (P <= 0.0 || uIceReady < .5) return P < .5 ? sceneDarkroom(px) : sceneInk(px);
  vec2 uv = vec2(q.x / S.x, 1.0 - q.y / S.y);
  bool returning=P>=UM_CLEAR.x;
  vec3 surface;
  float underwater,pigmentThrough,lip;
  vec3 bath=umFill(uv,px,P,returning,surface,underwater,pigmentThrough,lip);
  if(returning && underwater<=.001)return surface+vec3(.52,.41,.34)*lip;
  // Keep the wet board and the last flying figures on the underwater side
  // of the meniscus. On the free surface the same figures are seen in
  // refracted light. In dry air their full colour comes straight through.
  vec3 col=returning?bath:mix(surface,bath,underwater);
  if(returning)pigmentThrough=1.;
  if (P>.875 && uB3On>.5) {
    vec4 board=umBoard(uRegion.xy+q);
    float grey=dot(board.rgb,vec3(.2126,.7152,.0722));
    // The wet board develops beneath the flights. At the knight's touchdown
    // it already has the exposure of the solid taking over its square.
    float appear=smoothstep(.875,.931,P);
    col=mix(col,mix(board.rgb,vec3(grey),.85)+col*(1.-board.a),appear);
  }
  vec4 rear=texture(uFlow,uv)*pigmentThrough, front=texture(uGas,uv)*pigmentThrough;
  vec4 piece=texture(uTexA,uv), lines=texture(uTexB,uv)*pigmentThrough;
  col=rear.rgb+col*(1.-rear.a);
  col=mix(piece.rgb,vec3(dot(piece.rgb,vec3(.2126,.7152,.0722))),.85)+col*(1.-piece.a);
  col=lines.rgb+col*(1.-lines.a);
  col=front.rgb+col*(1.-front.a);

  if(P>0. && P<.68){
    vec4 air=texture(uInkAir,uv);
    col=air.rgb+col*(1.-air.a);
  }
  if(returning)col=mix(surface,col,underwater);
  return col+vec3(.52,.41,.34)*lip;
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
