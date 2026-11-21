import { UNMIX, SLOTS } from '../unmix-plan.js';
import { CAMERA, TANK_GLSL, DRAIN } from '../ink-tank.js';
import { MARGIN, BOARD } from '../staunton.js';
import { FRONT } from '../ink-drain.js';
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
// few facets align with it. warm: the first's colour (the safelight; white once the lights are on).
vec3 umGlints(vec3 N,vec3 V,vec2 p,vec2 slope,float farDistance,vec3 warm,float silver){
  float softCosine=max(dot(N,normalize(V+normalize(vec3(-.24,.32,-.89)))),0.);
  vec3 c=warm*pow(softCosine,43.);
  vec3 H=normalize(V+normalize(vec3(.14,.49,-.87)));
  float broaden=.48+.4*noise(p*vec2(6.8,14.));
  vec2 specSlope=H.xz/max(.10,H.y)+slope;
  float gloss=exp(-dot(specSlope*vec2(7.3,38.),specSlope*vec2(7.3,38.)))*broaden;
  return c+vec3(.23,.237,.23)*silver*gloss*(.47+.53*farDistance);
}
vec3 umReflection(vec3 r,vec2 plane,float rough,float lights){
  // Intersect the reflected ray with the surrounding room. Translating the
  // intersection from each patch on the water gives the distant lights their
  // correct parallax. The photographic plate is in top-down image coordinates.
  vec2 wall=vec2(plane.x-.5,0.)+r.xy*(1.02+.46*(1.-plane.y))/max(.22,-r.z);
  vec2 look=clamp(vec2(.50+.57*wall.x,.92-.85*wall.y),.003,.997);
  vec3 incident=textureLod(uBathRoom,look,1.1+5.*rough+.65*plane.y).rgb;
  // When the darkroom's lights come on (the water returning) its red lamps turn white lamps; its dark
  // walls stay dark: the brighter a patch, the more it takes the white of its brightest channel.
  float m=max(max(incident.r,incident.g),incident.b);
  vec3 lit=mix(vec3(dot(incident,vec3(.2126,.7152,.0722)))*1.1,vec3(m)*vec3(1.,.98,.95)*1.25,smoothstep(.35,.7,m));
  incident=mix(incident,lit,lights);
  return mix(vec3(.055,.069,.076),vec3(.066),lights)+1.65*incident;
}
// Transmission samples the world under the tank at the displaced ray. On
// the return journey this includes the actual wood, moving pieces and paper.
// Under water (wet) the board and the pieces keep the bath's grey, as the print does in the tray; out of
// it they have their colour.
vec3 umSubstrate(vec2 px,vec2 uv,bool returning,bool wet){
  if(!returning)return sceneDarkroom(px);
  vec3 col=sceneInk(px);
  float grey=wet?.85:0.;
  if(uB3On>.5){
    vec2 boardPx=uRegion.xy+vec2(uv.x,1.-uv.y)*uRegion.zw;
    vec4 board=umBoard(boardPx);
    col=mix(board.rgb,vec3(dot(board.rgb,vec3(.2126,.7152,.0722))),grey)+col*(1.-board.a);
  }
  vec4 piece=texture(uTexA,uv);
  return mix(piece.rgb,vec3(dot(piece.rgb,vec3(.2126,.7152,.0722))),grey)+col*(1.-piece.a);
}
// ---- The return (ink-drain.js) ------------------------------------------------------------------------
// The same water, the same code: the tank plays the rise backward (ink-tank.js DRAIN), pauses while the
// darkroom's lights come on, and falls on past the bottom; the board's world under it, dimmed as the
// darkroom floor was, and above the far contact line, dry, under the safelight until the lights come on.
${PIECE_ENV}
uniform sampler2D uB3Geo; // what each pixel of the board's picture sees: world y (R) and z (G) (board3d.js, unit 13)
uniform vec3 uB3Eye;      // the board camera's eye (staunton.js frameCamera at the box's proportion)
uniform vec4 uDrain;      // the falling plane's height over the board's world and its tilt; the lights (fill, highlights)
const vec3 UM_FWD = vec3(0.0, ${f(-Math.sin(0.9))}, ${f(-Math.cos(0.9))}), UM_UP = vec3(0.0, ${f(Math.cos(0.9))}, ${f(-Math.sin(0.9))});
const float UM_TAN = ${f(Math.tan(0.21))}, UM_SLAB = ${f(BOARD.slab)}, UM_FRONT = ${f(FRONT)};
const vec2 UM_LAST = ${v2(DRAIN.last)};
// The dry page under the safelight, and the Chess world seen through the water: dim and warm as the
// darkroom's floor was under the same lamp; neutral once the lights are on.
const vec3 UM_SAFE = vec3(.93, .79, .73), UM_WET = vec3(.135, .112, .10);
const float UM_WET_ON = .118;
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
// Two views of one free surface. The near meniscus separates the bath from
// the reflecting plane; the far wall separates that plane from the dry world.
vec3 umFill(vec2 uv,vec2 px,float P,bool returning,out vec3 surface,out float underwater,
            out float pigmentThrough,out float lip){
  vec4 cam=waterCamera(P);
  // (Returning, the waves run on: forward as the camera rises back out, then with the scroll.)
  float phase=(returning?16.*${CAMERA.start}+tankDrain(P,1):16.*min(P,${CAMERA.start})+3.1*(cam.x-${CAMERA.above[0]}))+.23*T;
  float near=umNear(uv,cam,phase),farEdge=umBack(uv,cam,phase),distanceUnder=near-uv.y;
  // The lights: the fill, and the highlights a beat ahead of it (ink-drain.js LIGHTS).
  float fill=returning?uDrain.z:0.,highlights=returning?uDrain.w:0.;
  // The water comes in as an exposure at the start, and goes out as one at the end.
  float exposure=smoothstep(0.,.078,P)*(1.-smoothstep(UM_LAST.x,UM_LAST.y,P));
  float shortSide=min(uRegion.z,uRegion.w),aa=max(1./uRegion.w,.0005);
  vec2 plane=waterXZ(uv,cam,uRegion.z/uRegion.w);
  // Where the water stands: below the far contact line, and (returning) where the falling plane is still
  // over what this pixel sees (ink-drain.js): crowns, then bodies, then the board come out of it ahead of
  // the line. One signed distance (uv, > 0 in the water) for the edge and its lines; on the page the far
  // line alone, so the two never double. (Taken here, in uniform control flow, for its derivatives.)
  float edge=farEdge-uv.y,depth=1e3,shallow=1.,lineAt=1.;
  bool object=false;
  if(returning){
    vec2 seen=umSeen(px,umRay(px));
    depth=uDrain.x+uDrain.y*(seen.y-UM_FRONT)-seen.x;
    float slope=length(vec2(dFdx(depth),dFdy(depth))),rows=length(vec2(dFdx(uv.y),dFdy(uv.y)));
    object=seen.x>-UM_SLAB+.004;
    // (Close above the near meniscus the camera is at the glass: the water stands there, whatever is under it.)
    float glass=smoothstep(.03,.0,uv.y-near);
    float planeEdge=depth/max(slope,1e-5)*rows;
    if(object)edge=min(edge,max(planeEdge,glass*.01));
    // Only where the depth is smooth across the pixel does its zero line get the contact line; across a
    // silhouette it is a plain step.
    lineAt=object?smoothstep(.07,.025,fwidth(depth)):1.;
    // Under a thin film the world shows almost as it is, and bends little.
    shallow=object?1.-exp(-max(depth,0.)/.3):1.;
  }
  float water=smoothstep(-aa,aa,edge);
  underwater=smoothstep(-.012,.018,distanceUnder)*smoothstep(.015,.37,cam.w);
  float throughUnder=exp(-max(0.,distanceUnder)*16.)*.22*(1.-smoothstep(.94,1.,cam.w));
  surface=vec3(0);
  // Fully immersed rays skip the reflection, refraction and substrate lookup.
  if(underwater<.999 || throughUnder>.001){
    // Above the far contact line, the dry world: the darkroom; on the way back, Chess's, its page under
    // the safelight until the lights come on, a dark wet line along the water's edge.
    float distanceToWall=edge;
    vec3 dry=umSubstrate(px,uv,returning,false);
    if(returning){
      // Just uncovered, it is still wet: darker, a fading sheen of the white room, the drying front ragged
      // (fixed to what it lies on); and a dark wet line along the water's edge.
      float above=object?-depth:-distanceToWall*6.;
      float wet=exp(-max(above,0.)/.35)*(.75+.25*noise(px*.045+vec2(0.,depth*7.)))*exposure;
      dry*=mix(UM_SAFE,vec3(1.),fill)*(1.-.16*wet)*(1.-.35*lineAt*exp(-abs(distanceToWall+.0012)/max(aa,.0006))*exposure);
      dry+=vec3(.035,.035,.034)*wet*(.5+.5*sin(px.y*.9+noise(px*.02)*6.))*fill;
    }
    if(water<=.001){
      surface=dry;
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
      vec2 offset=(swell*vec2(28.,-34.)+impact*vec2(62.,-52.))*shortSide/800.*water*exposure*shallow;
      vec3 refracted=umSubstrate(px+offset,uv+offset*vec2(1.,-1.)/uRegion.zw,returning,true);
      // The Photography floor is already lit by the safelight. Bring the
      // daylight material of Chess under the same dim lamp while covered;
      // its open-air exposure returns at the far contact line.
      vec3 floorLight=returning?refracted*mix(UM_WET,vec3(UM_WET_ON),fill):refracted;
      vec3 body=mix(vec3(.070,.092,.104),vec3(.094),fill*.8)+floorLight*mix(vec3(.51,.39,.37),vec3(.42),fill);
      float farDistance=1.-plane.y;
      body=mix(body,mix(vec3(.159,.165,.166),vec3(.164),fill),.37*farDistance*farDistance);
      float rough=.095+.14*noise(p*vec2(4.2,7.3));
      vec3 environment=umReflection(refl,plane,rough,highlights);
      // The dark substrate and lit room give small Fresnel reflections high
      // contrast. Below the far edge the actual water has a double contact line.
      vec3 top=body*(1.-fresnel)+environment*(fresnel+.115);
      // A thin film over a crown, a collar or the board: the thing itself, a little darker, glossy.
      if(returning && object)top=mix(refracted*mix(UM_SAFE,vec3(1.),fill)*.8+environment*(fresnel*.6+.03),top,shallow);
      // The overhead safelight produces a broad weak warmth. A second long
      // silver source is broken by fine crests; only a few facets align with it.
      top+=umGlints(N,V,p,slope,farDistance,mix(vec3(.155,.097,.082),vec3(.155),highlights),1.+.3*highlights);
      top*=1.-.32*lineAt*exp(-abs(distanceToWall-.0025)/.0024);
      top+=mix(vec3(.39,.32,.26),vec3(.39),highlights)*lineAt*exp(-abs(distanceToWall-.0009)/max(.00065,aa))*(.69+.31*cos(plane.x*8.));
      surface=mix(returning?dry:refracted,top,water*exposure);
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
  bath+=mix(vec3(.19,.049,.025),vec3(.19,.186,.18),highlights)*ceilingGlow;
  float shaft=sin(4.9*uv.x+1.4*uv.y+.21*sin(6.*uv.y+phase*.10));
  bath+=vec3(.032,.030,.027)*shaft*ceilingGlow;
  float veil=sin(25.*uv.x+17.*distanceUnder+2.1*sin(12.*uv.x-phase*.13)+phase*.20);
  bath+=mix(vec3(.059,.048,.038),vec3(.049),fill)*pow(max(veil,0.),4.)*exp(-9.*abs(distanceUnder))*smoothstep(.1,.60,cam.w);
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
  vec3 lipColour=mix(vec3(.52,.41,.34),vec3(.52,.51,.49),returning?uDrain.w:0.);
  if(returning && underwater<=.001)return surface+lipColour*lip;
  // Keep the wet board and the last flying figures on the underwater side
  // of the meniscus. On the free surface the same figures are seen in
  // refracted light. In dry air their full colour comes straight through.
  vec3 col=returning?bath:mix(surface,bath,underwater);
  if(returning)pigmentThrough=1.;
  // Light from the surface shafts down through the water, a little from the lit side; every plume above a
  // point shades it (the mist's own opacity, along the way up toward the light): bright columns between
  // the plumes, their shadows slanting below them. A few percent, in the bath's own ivory-pink.
  if(P>.52 && P<.95){
    float on=smoothstep(.52,.585,P)*(1.-smoothstep(.86,.95,P))*underwater;
    vec2 step=vec2(.22*S.y/S.x,1.)*.034;
    float lit=1.;
    for(int k=1;k<=10;k++){
      vec2 t=uv+step*(float(k)-.5+.5*hash(q+float(k)));
      if(t.y>.995)break;
      lit*=1.-.6*texture(uFlow,t).a;
    }
    float beams=.62+.38*noise(vec2(uv.x*7.+uv.y*1.5,.04*T+P*3.));
    // (A little stronger while the live ink holds the screen: its clear water between the plumes is lit.)
    col+=vec3(.088,.080,.074)*(1.+.3*smoothstep(.57,.61,P)*(1.-smoothstep(.72,.78,P)))*on*lit*beams*smoothstep(-.1,.85,uv.y);
  }
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
  return col+lipColour*lip;
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
