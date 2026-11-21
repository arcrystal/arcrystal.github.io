import { PIECE_SHAPES, PIECE_MATERIAL } from './board3d.js';
import { LATE } from '../ink-tank.js';
import { PHASES } from './ink-sim.js';

// Each draw is scissored to one posed piece. Its optical depth travels with
// the shaded hit, so the participating medium can be integrated on either side.
export const INK_PIECE = PIECE_SHAPES + PIECE_MATERIAL + /* glsl */ `
uniform vec4 uPose; // center px, px per model unit, camera distance
uniform vec4 uTurn; // yaw, roll, camera elevation, growth
uniform vec4 uModel; // type, black, height, optical depth
uniform vec2 uSlope;
uniform vec3 uNuclei[3];
uniform float uSeed;
uniform vec2 uInkOrientation; // index of the pigment study and its birth yaw
uniform vec2 uCure; // the liquid front's radius (model units: living-ink-plan.js fillRadius), how far it has set
uniform float uInkStage; // the ink stage (0 … 1): the plume, unmixed, has become the piece's own shape in ink
vec3 rotatePiece(vec3 p) {
  float c=cos(uTurn.y), s=sin(uTurn.y);
  p.xy=mat2(c,s,-s,c)*p.xy;
  c=cos(uTurn.x); s=sin(uTurn.x);
  p.xz=mat2(c,s,-s,c)*p.xz;
  return p;
}
// The solid fills its own shape as a liquid (living-ink-plan.js FILL): a front leaves the three
// landmarks (the second and third wet a little later), its radius set by the pigment deposited, so the
// volume filled is that share of the solid. It seeps: the dense folds of the piece's own study fill ahead,
// its clear gaps last, and it advances in viscous fingers (a less viscous ink pushing into a more viscous
// one breaks into lobes, Saffman–Taylor). Where it meets the walls it wets them (a smooth union's
// meniscus). Then it sets (uCure.y), from the landmarks outward: the rounding goes and every carved edge
// snaps sharp.
float frontAt(vec3 c){
  return min(length(c-uNuclei[0]),min(length(c-uNuclei[1])+.03,length(c-uNuclei[2])+.07));
}
float deposit(vec3 p) {
  float t=uModel.x, h=uModel.z;
  vec3 q=rotatePiece(p); q.y+=h*.5;
  float d=shape(int(t),q);
  if(uCure.y>.999) return d;
  vec3 c=q-vec3(0.,h*.5,0.);
  float r=frontAt(c),g=uTurn.w;
  // Viscous fingers about the piece's axis, winding as they climb, gone as it fills.
  float ang=atan(c.z,c.x)+2.4*c.y/h+uSeed;
  float lobes=(pow(max(0.,cos(11.*ang+5.*c.y/h+3.*g)),4.)*.07+pow(max(0.,cos(23.*ang-9.*c.y/h+uSeed)),6.)*.03)*(1.-g);
  // Its own ink: the study's density (clear gaps fill last).
  vec2 off,uv=studyUV(int(t),uInkOrientation.x,uInkOrientation.y,q,q.y/h,off);
  float ink=int(t)==3?textureLod(uKnightPigment,uv,2.).r:textureLod(uFigurePigment,uv,2.).r;
  float front=r-uCure.x-lobes-.15*(.55-ink)*(1.-g);
  // Unset, the liquid's tension rounds the carving: a softer surface over a swelling of low ripples.
  float soft=1.-uCure.y;
  float fold=sin(q.y*15.+4.1*q.x+uSeed*.7+.7*sin(13.*q.z));
  float ridge=cos(17.*q.x-12.*q.z+3.2*fold);
  float liquid=d-soft*(.004+.006*fold+.004*ridge);
  float k=.045*soft+.004;
  float hk=clamp(.5-.5*(front-liquid)/k,0.,1.);
  return mix(front,liquid,hk)+k*hk*(1.-hk);
}
vec2 pigmentAt(int type,vec3 q,float y,out vec2 towardLight){
  return studyUV(type,uInkOrientation.x,uInkOrientation.y,q,y,towardLight);
}
void main(){
  vec2 offset=(gl_FragCoord.xy-uPose.xy)/uPose.z;
  float el=uTurn.z;
  vec3 right=vec3(1,0,0), up=vec3(0,cos(el),-sin(el)), fwd=vec3(0,-sin(el),-cos(el));
  vec3 centerRay=fwd+uSlope.x*right+uSlope.y*up;
  vec3 origin=-uPose.w*centerRay, ray=normalize(centerRay+(offset.x*right+offset.y*up)/uPose.w);
  float along=-dot(origin,ray), R=.94;
  float chord=R*R-dot(origin+along*ray,origin+along*ray);
  if(chord<=0.) discard;
  float t=along-sqrt(chord),end=along+sqrt(chord),d=1.;
  vec3 p;
  // Thin tines and the cross's arms need small steps near them; the hit is relative to the pixel's size.
  float hitAt=max(.0007,.6/uPose.z);
  // The ink stage: the plume the vortex ink drew here, played backward, gathers into the piece's own whole
  // shape, in its own ink (the piece's study, registered to it): translucent, its dense folds darkest. The
  // liquid then fills it from its landmarks and sets inside it (below), and the ink is let go as it sets: so
  // the piece is made of the ink that came to it, never revealed from behind it.
  vec4 inkLayer=vec4(0);float inkZ=0.;
  bool black=uModel.y>.5;
  if(uInkStage>.001){
    float ti=t,di=1.;vec3 pi;
    for(int i=0;i<72;i++){
      pi=origin+ti*ray;vec3 qi=rotatePiece(pi);qi.y+=uModel.z*.5;di=shape(int(uModel.x),qi);
      if(di<hitAt || ti>end)break;
      ti+=max(.0008,di*.8);
    }
    if(di<=1.5*hitAt && ti<=end){
      vec3 qi=rotatePiece(pi)+vec3(0.,uModel.z*.5,0.);
      vec2 si=studyInk(int(uModel.x),uInkOrientation.x,uInkOrientation.y,qi,uModel.z);
      float dense=clamp(1.-si.x,0.,1.),a=uInkStage*clamp(.22+1.05*dense,0.,1.);
      vec3 ink=black?mix(vec3(.16,.155,.15),vec3(.012,.011,.013),dense):mix(vec3(.64,.63,.61),vec3(.9,.88,.83),dense);
      ink*=.82;ink=pow(clamp((ink*(2.51*ink+.03))/(ink*(2.43*ink+.59)+.14),0.,1.),vec3(1./2.2));
      inkLayer=vec4(ink*a,a);inkZ=clamp(uModel.w+.021*dot(pi,-fwd),.01,.98);
    }
  }
  if(uTurn.w>.001)for(int i=0;i<96;i++){
    p=origin+t*ray; d=deposit(p); if(d<hitAt || t>end)break;
    t+=max(.0006,d*(uTurn.w>.98?.8:.64));
  }
  if(uTurn.w<=.001 || d>1.2*hitAt || t>end){
    if(inkLayer.a<.002)discard;
    gl_FragDepth=1.-inkZ;o=inkLayer;return;
  }
  vec2 e=vec2(.003,0);
  vec3 n=normalize(vec3(deposit(p+e.xyy)-deposit(p-e.xyy),deposit(p+e.yxy)-deposit(p-e.yxy),deposit(p+e.yyx)-deposit(p-e.yyx)));
  vec3 q=rotatePiece(p)+vec3(0.,uModel.z*.5,0.);
  int type=int(uModel.x);
  // (The same ink under the lacquer as the board's own piece: glsl/board3d.js studyInk.)
  gInk=studyInk(type,uInkOrientation.x,uInkOrientation.y,q,uModel.z);
  vec3 c=finishPiece(black,q,n,-ray,1.,.9,0.);
  if(uCure.y<.999){
    // Where the ink has not set it is liquid: wet black ink, or milky ivory (cornstarch, oobleck), its
    // edge a bright meniscus. The setting front runs out from the landmarks; in a band behind it the
    // jammed suspension is matte and creased, and a glint rides it. Behind that, the lacquer.
    vec3 local=q-vec3(0.,uModel.z*.5,0.),v=-ray;
    float r=frontAt(local),R=uCure.x;
    float setR=mix(-.05,R+.06,uCure.y);
    float behind=setR-r;
    float nv=max(dot(n,v),0.),fres=.04+.96*pow(1.-nv,5.);
    vec3 refl=env(reflect(-v,n));
    vec3 wet=black?vec3(.006,.006,.008)*(.4+.6*max(dot(n,LKEY),0.))+fres*refl*.9+lamp(n,v,LKEY,KEY,vec3(.04),.06)*1.5
                 :vec3(.80,.78,.72)*(.55+.45*max((dot(n,LKEY)+.4)/1.4,0.))+fres*refl*.35+lamp(n,v,LKEY,KEY,vec3(.04),.18)*.6;
    // A crease network of the jammed suspension (cells over the piece's own surface).
    vec2 cell=vec2(atan(local.z,local.x)*1.3,local.y*7.)*3.;
    vec2 fc=fract(cell),ic=floor(cell);float d1=8.,d2=8.;
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
      vec2 g2=vec2(float(i),float(j)),o2=fract(sin(vec2(dot(ic+g2,vec2(127.1,311.7)),dot(ic+g2,vec2(269.5,183.3))))*43758.5453);
      float dd=length(g2+o2-fc);if(dd<d1){d2=d1;d1=dd;}else if(dd<d2)d2=dd;
    }
    float crease=1.-smoothstep(0.,.07,d2-d1);
    vec3 matte=(black?vec3(.05,.048,.05):vec3(.70,.68,.63))*(.55+.45*max(dot(n,LKEY),0.));
    matte=mix(matte,black?vec3(.012):vec3(.42,.40,.37),.65*crease);
    float jam=smoothstep(0.,.025,behind)*(1.-smoothstep(.05,.12,behind));
    float lacquer=smoothstep(.06,.12,behind);
    c=mix(mix(wet,matte,jam),c,lacquer);
    // The glint riding the setting front, and the meniscus where the liquid meets the air.
    c+=vec3(1.,.96,.88)*exp(-pow(behind/.012,2.))*step(.001,uCure.y)*.55;
    float edge=pow(1.-nv,3.);
    c+=(black?vec3(.18,.18,.2):vec3(.12,.11,.1))*edge*(1.-lacquer);
  }
  // Exposed as the board exposes its own pieces (glsl/board3d.js tone), so a solid is the same at touchdown.
  c*=.82; c=pow(clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.),vec3(1./2.2));
  float coverage=1.;
  float depth=clamp(uModel.w+.021*dot(p,-fwd),.01,.98);
  gl_FragDepth=1.-depth;
  // (Its ink, while it lasts, over the solid filling it.)
  o=vec4(inkLayer.rgb+c*coverage*(1.-inkLayer.a),coverage);
}`;

// Horizontal differential motion is expressed in screen-height units, then
// projected into UV. Both sides of an optical chord and the mist that came
// off it travel in the same two counter-rotating currents when scroll stops.
const suspendedCurrent=/* glsl */`
vec2 suspendedDrift(vec2 uv,float depth,float aspect,float P,float t){
  float live=smoothstep(.43,.557,P)*(1.-smoothstep(.721,.853,P));
  vec2 p=vec2((uv.x-.5)*aspect,uv.y-.5);
  float along=4.5*p.y+2.1*p.x+.71*t;
  float across=5.8*p.x-2.7*p.y-.54*t;
  // These modes are tangential to their own wave vectors (zero divergence).
  return live*(vec2(.026,-.0121)*sin(along)*(.62+.63*depth)
    +vec2(.0084,.018)*sin(across)*(.95-.36*depth))/vec2(aspect,1.);
}
`;

export const INK_VOLUME=/* glsl */`#version 300 es
precision highp float;
precision highp sampler3D;
precision highp sampler2DArray;
uniform sampler2DArray uVolume;
uniform sampler3D uNoise;
uniform sampler2D uFigureDepth,uSheetDepth;
uniform vec2 uSize;
uniform vec3 uCells;
uniform float uProgress,uKey,uBreath,uAspect,uFlowPhase;
${suspendedCurrent}
uniform float uSpin; // the event's clock (ink-swirl.js spinAt): only ever forward
// The live ink (live-ink.js): its mist's columns (black, ivory, black·depth, ivory·depth), its larger
// scales; how far the flow has carried the mist's texture in each of its two phases (screen units), and
// their clock (glsl/ink-sim.js PHASES); the bake's own columns; and how much of it shows.
uniform sampler2D uMoments,uLiveMist,uLivePhases;
uniform float uLive,uPhase;
${PHASES}
layout(location=0) out vec4 rear;
layout(location=1) out vec4 front;
vec3 coord(vec3 p,float k){
  vec2 tile=vec2(mod(k,10.),floor(k/10.));
  return vec3((tile+clamp(p.xy,.5/uCells.xy,1.-.5/uCells.xy))/vec2(10,8),clamp(p.z,.5/uCells.z,1.-.5/uCells.z));
}
vec2 readVolume(vec3 p,float key){
  vec3 uv=coord(p,key);
  float z=uv.z*uCells.z-.5,base=floor(z);
  return mix(texture(uVolume,vec3(uv.xy,base)).rg,texture(uVolume,vec3(uv.xy,min(base+1.,uCells.z-1.))).rg,fract(z));
}
// The foreground pairs circle one another (ink-swirl.js ORBIT) in the baked keys. Between two keys, read
// each where the mist was then: turned back by the turn since the earlier key, on by the turn still to
// come before the later, so the two meet instead of ghosting.
uniform vec4 uOrbit[2];     // a pair's middle (x·aspect, y), half the distance between its heads, on
uniform vec2 uOrbitTurn[2]; // the turn since the earlier key, the turn still to come before the later
vec2 orbitKey(vec2 xy,bool later){
  vec2 q=vec2(xy.x*uAspect,xy.y);
  for(int i=0;i<2;i++){
    if(uOrbit[i].w<.5)continue;
    vec2 d=q-uOrbit[i].xy;
    float h=uOrbit[i].z,r=length(d),x=max(0.,r-1.2*h)/(.8*h);
    float t=(later?uOrbitTurn[i].y:-uOrbitTurn[i].x)*exp(-x*x),c=cos(t),s=sin(t);
    q=uOrbit[i].xy+vec2(c*d.x-s*d.y,s*d.x+c*d.y);
  }
  return vec2(q.x/uAspect,q.y);
}
// The bake's columns at a screen point, between its two keys as density() reads them.
vec4 bakedColumn(vec2 xy){
  vec2 a=coord(vec3(xy,.5),floor(uKey)).xy,b=coord(vec3(xy,.5),ceil(uKey)).xy;
  if(uOrbit[0].w>.5 || uOrbit[1].w>.5){a=coord(vec3(orbitKey(xy,false),.5),floor(uKey)).xy;b=coord(vec3(orbitKey(xy,true),.5),ceil(uKey)).xy;}
  return mix(texture(uMoments,a),texture(uMoments,b),fract(uKey));
}
// The mist's noise at a point of its material: every octave, each warped by the ones below.
struct Grain{vec3 v,f,g,fold,curl;vec4 fine;float cavity;};
Grain grainAt(vec3 material,vec2 rolling,float boil){
  Grain q;
  q.v=texture(uNoise,material*.91+vec3(rolling,.023*uBreath)+vec3(.0025*boil,.044*uProgress+.006*boil,.003*boil)).rgb-.5;
  q.f=texture(uNoise,material*2.7+q.v*.81+vec3(-.002*boil,-.13*uProgress-.009*boil,.027*uBreath+.005*boil)).rgb-.5;
  q.g=texture(uNoise,material*5.5+q.v*1.24+q.f*.89).rgb-.5;
  q.cavity=texture(uNoise,material*2.65+1.1*q.v+.48*q.f).a;
  q.fold=texture(uNoise,material*5.1+q.v*1.45+q.f*.54).rgb;
  q.fine=texture(uNoise,material*8.4+1.8*q.v+.94*q.f+.75*q.g);
  q.curl=texture(uNoise,material*12.+2.4*q.v+1.5*q.f+1.2*q.g).rgb;
  return q;
}
// Two phases of it blended keeping its contrast (each about its mean, the weights over the root of their
// sum of squares): mid-blend the texture is as crisp as either alone, so nothing breathes.
Grain blendGrain(Grain a,Grain b,float wa,float wb){
  float k=inversesqrt(wa*wa+wb*wb);
  Grain q;
  q.v=(wa*a.v+wb*b.v)*k;q.f=(wa*a.f+wb*b.f)*k;q.g=(wa*a.g+wb*b.g)*k;
  q.fold=.5+(wa*(a.fold-.5)+wb*(b.fold-.5))*k;q.curl=.5+(wa*(a.curl-.5)+wb*(b.curl-.5))*k;
  q.fine=.5+(wa*(a.fine-.5)+wb*(b.fine-.5))*k;q.cavity=.42+(wa*(a.cavity-.42)+wb*(b.cavity-.42))*k;
  // (Kept in range: what is read from them later assumes it.)
  q.v=clamp(q.v,-.5,.5);q.f=clamp(q.f,-.5,.5);q.g=clamp(q.g,-.5,.5);
  q.fold=clamp(q.fold,0.,1.);q.curl=clamp(q.curl,0.,1.);q.fine=clamp(q.fine,0.,1.);q.cavity=clamp(q.cavity,0.,1.);
  return q;
}
// The vortex ink (vortex-ink.js): across its span it takes the bake's place (uVortex 1).
uniform float uVortex;
vec2 density(vec3 p);
// The ink at p: the bake's, or the vortex ink's across its span.
// The ring heads (vortex-ink.js): each plume's head is a vortex ring, its ink drawn here exactly, at the
// screen's own resolution. In a ring's meridian (its cross-section) the ink turns round the core as a
// Lamb–Oseen vortex does, the core fastest, so read backward (unwound by the angle turned at its distance
// from the core) every point finds where its ink began: the drop's ink, a sheet with sharp edges. Wound,
// those edges are the alternating dark and clear layers of a real ink scroll. Its Widnall wave lobes it
// round the ring, ahead and behind. Units: screen heights (x by the aspect), depth one to one.
// The heads (uHeads: a column each, five texels: centre (x·aspect, y, depth) and radius; axis (the way it
// travels) and core radius; how far it rolls at its core in a cycle, wave mode, amplitude, phase; ivory,
// density, the sheet's half-thickness, seed; its stem's length, its plume study (0 … 3), its rolling's
// clock (cycles)), the most important first. Each pixel finds, once, the few whose reach covers it (the
// head round its centre, its stem back up its way, and what the shading reads to one side), and the
// march reads only those.
uniform int uHeadCount;
uniform sampler2D uHeads;
// A head's reach about its axis in its own radii: the study covers about 3.3 round it, lobes and all, 3.7
// back up its stem and 1.2 ahead. 1 at the edge of its reach: its ink is let go smoothly before it, so no
// edge of a reach is ever drawn.
float headReach(vec2 at,vec4 A,vec4 B){
  vec2 a0=A.xy+B.xy*1.2*A.w,a1=A.xy-B.xy*3.7*A.w,ab=a0-a1;
  float t=clamp(dot(at-a1,ab)/max(dot(ab,ab),1e-8),0.,1.);
  return length(at-a1-t*ab)/(3.3*A.w);
}
int gList[24];
int gCount=0;
void findHeads(vec2 uv){
  vec2 at=vec2(uv.x*uAspect,uv.y);
  for(int i=0;i<64;i++){
    if(i>=uHeadCount || gCount>=24)break;
    vec4 A=texelFetch(uHeads,ivec2(i,0),0),B=texelFetch(uHeads,ivec2(i,1),0);
    // (Its reach (headReach), and the mist's drift past the pixel, a little more.)
    if(headReach(at,A,B)<1.+.04/A.w){gList[gCount]=i;gCount++;}
  }
}
uniform sampler2D uStudy; // the plume studies (data/ink-density.webp: transmission, 2 × 2 tiles)
// The study's darkness at a point of a ring's meridian (m: from its core, outward and forward, screen
// heights): never quite round, each azimuth reading the study a little further out or in (lob), higher or
// lower (tvShift), by lobes of its own.
float studyDark(vec2 m,float lob,float tvShift,float R,float variant,float right,out float inside){
  float ks=.225/R,tv=.80+m.y*ks+tvShift,reach=(.225+m.x*ks)*(1.+lob);
  vec2 tile=vec2(mod(variant,2.),floor(variant*.5)),uvR=vec2(.5+reach,tv),uvL=vec2(.5-reach,tv);
  // (Feathered well inside its tile's edges, and the photograph's paper white taken off: only its ink.)
  inside=smoothstep(.01,.12,min(min(uvR.x,1.-uvR.x),min(tv,1.-tv)))*smoothstep(-.02,.06,reach);
  // (Read soft, a few mip levels down: revolved, a thin line of the photograph would be a thin shell, and
  // a thin shell seen edge-on draws as a hard line. Its fine grain is the volume's own noise. Its left half
  // toward the screen's left, its right toward the right, met smoothly.)
  float tr=mix(textureLod(uStudy,(tile+clamp(uvL,.003,.997))*.5,1.7).r,textureLod(uStudy,(tile+clamp(uvR,.003,.997))*.5,1.7).r,right);
  return inside*max(0.,1.-tr-.07)/.93;
}
// (A complex product: the azimuth's powers without sines.)
vec2 cmul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
// sin(kφ + a), from z = e^{ikφ} and e = (cos a, sin a).
float sinOf(vec2 z,vec2 e){return z.y*e.x+z.x*e.y;}
vec2 headInkAt(vec3 p,out vec3 mat,out float near){
  vec3 x=vec3(p.x*uAspect,p.y,p.z);
  vec2 ink=vec2(0);near=0.;mat=vec3(0);
  for(int j=0;j<24;j++){
    if(j>=gCount)break;
    int i=gList[j];
    vec4 A=texelFetch(uHeads,ivec2(i,0),0);
    vec3 q=x-A.xyz;float R=A.w;
    // (Only near its own depth: most of the ray passes in front of it or behind.)
    if(abs(q.z)>3.8*R)continue;
    vec4 B=texelFetch(uHeads,ivec2(i,1),0);
    float reach=headReach(x.xy,A,B);
    if(reach>=1.)continue;
    vec4 C=texelFetch(uHeads,ivec2(i,2),0),D=texelFetch(uHeads,ivec2(i,3),0),E=texelFetch(uHeads,ivec2(i,4),0);
    float a=B.w;
    vec4 F=texelFetch(uHeads,ivec2(i,5),0),G=texelFetch(uHeads,ivec2(i,6),0); // its phases, as cos and sin
    vec3 n=B.xyz,e1=normalize(cross(n,abs(n.z)<.9?vec3(0,0,1):vec3(1,0,0))),e2=cross(n,e1);
    float s=dot(q,n);vec3 rv=q-s*n;
    // (Behind it, its stem wanders as a real one does, and is never thinner than a thread: the study's stem,
    // revolved, would lie exactly on the axis, a ruled line.)
    float behind=smoothstep(-.3*R,-1.2*R,s);
    if(behind>0.)rv-=behind*R*(.22*sin(4.1*s/R+D.w)*e1+.16*sin(2.7*s/R-1.3*D.w)*e2);
    float r=sqrt(dot(rv,rv)+.004*R*R*behind);
    // (Its azimuth, as a complex number, and its powers: every lobe below without a sine.)
    vec2 z=vec2(dot(rv,e1),dot(rv,e2))/max(r,1e-5),z2=cmul(z,z),z3=cmul(z2,z),z4=cmul(z2,z2),z5=cmul(z4,z),z8=cmul(z4,z4);
    // (Its Widnall wave: the ring's radius and its place along its way, lobed round it.)
    float wave=C.z*(z5.x*G.z-z5.y*G.w);
    float u=r-R*(1.+wave),w=s-.8*R*C.z*sinOf(z5,G.zw),rho2=u*u+w*w,a2=a*a;
    // It rolls: its ink streams round each core, the core fastest (a Lamb–Oseen vortex), read in two phases
    // half a cycle apart, each started over where its weight is nothing, and each azimuth at its own moment:
    // the photograph flows round the rim and never winds up into rings, and nothing pulses.
    float roll=C.x*a2/max(rho2,1e-7)*(1.-exp(-rho2/a2));
    float cyc=E.z+.15*sinOf(z,F.xy),f0=fract(cyc),f1=fract(cyc+.5),w0=sin(3.14159265*f0);w0*=w0;
    float a0=roll*f0,a1=roll*f1,c0=cos(a0),s0=sin(a0),c1=cos(a1),s1=sin(a1);
    vec2 m=vec2(u*c0-w*s0,u*s0+w*c0),m1=vec2(u*c1-w*s1,u*s1+w*c1);
    // Read from a photograph: the plume study's own head (data/ink-density.webp, its tile E.y), revolved
    // about its axis, so the ring's cross-section is the study's at every azimuth and its rolled cores are
    // the study's own cauliflower lobes, at (.5 ± .225, .80) of the tile for a ring of radius R; the
    // photograph's stem and tendrils trail behind it.
    float lob=.16*sinOf(z3,F.xy)+.09*sinOf(z5,F.zw)+.05*sinOf(z8,G.xy),tvShift=.04*sinOf(z4,F.xy);
    float variant=E.y,right=.5+.5*dot(rv,vec3(1,0,0))/max(r,1e-5),inside,inside1;
    float dark=w0*studyDark(m,lob,tvShift,R,variant,right,inside)+(1.-w0)*studyDark(m1,lob,tvShift,R,variant,right,inside1);
    inside=max(inside,inside1);
    // (A ring is hollow at its axis, its ink in its rolled rim: only its stem, behind it, runs down the axis.)
    // (Behind it, the photograph's own stem would revolve to a hairline on the axis, which the march would
    // catch only now and then: it is let go, and the wisps round it are the trail.)
    float hollow=mix(.25,1.,smoothstep(.15*R,.75*R,r)),stemOnly=smoothstep(-.2*R,-.7*R,s)*smoothstep(.05*R,.3*R,r);
    float d=D.y*pow(max(dark,0.),1.4)*max(hollow*(1.-smoothstep(-.2*R,-.7*R,s)),stemOnly)*(1.+.25*z5.x);
    // (Its axis is the clear eye of the torus, and the one line where its azimuth means nothing: a soft
    // tube along it is let go, so no hairline of chance reads is ever drawn there.)
    d*=smoothstep(.04*R,.3*R,r)*(1.-smoothstep(.72,1.,reach));
    float hold=inside;
    ink+=d*vec2(1.-D.x,D.x);
    // (Its texture is the noise's where its ink is, only; where two overlap, theirs blend by their ink,
    // so the texture never jumps from one to the other.)
    float k=clamp(2.*d,0.,1.)*hold;
    near+=k;mat+=k*(vec3(m.x/a,m.y/a,z.x*R/a)*.1+D.w);
  }
  mat/=max(near,1e-4);near=min(near,1.);
  return ink;
}
vec2 headInk(vec3 p,out vec3 mat,out float near){return headInkAt(p,mat,near);}
// The ink at p: the bake's, or the vortex ink's across its span (h: the heads' there, already read).
vec2 inkAt(vec3 p,vec2 h){
  if(uVortex>=1.)return h;
  return density(p)+h;
}
vec2 density(vec3 p){
  if(uOrbit[0].w<.5 && uOrbit[1].w<.5)return mix(readVolume(p,floor(uKey)),readVolume(p,ceil(uKey)),fract(uKey));
  return mix(readVolume(vec3(orbitKey(p.xy,false),p.z),floor(uKey)),readVolume(vec3(orbitKey(p.xy,true),p.z),ceil(uKey)),fract(uKey));
}
void main(){
  vec2 uv=gl_FragCoord.xy/uSize;
  // What stands in the water here (a piece, a living form, a veil), from four taps of its depth at the
  // figures' finer resolution, so the mist parts round an edge by how much of the pixel it covers, not by
  // a hard step.
  vec2 cell=.5/uSize;
  float sheetZ=texture(uSheetDepth,uv).a;
  vec4 pz=vec4(max(1.-texture(uFigureDepth,uv+vec2(-cell.x,-cell.y)).r,sheetZ),max(1.-texture(uFigureDepth,uv+vec2(cell.x,-cell.y)).r,sheetZ),
               max(1.-texture(uFigureDepth,uv+vec2(-cell.x,cell.y)).r,sheetZ),max(1.-texture(uFigureDepth,uv+vec2(cell.x,cell.y)).r,sheetZ));
  float pieceZ=max(max(pz.x,pz.y),max(pz.z,pz.w));
  rear=vec4(0);front=vec4(0);
  if(uProgress<.131 || uProgress>1.145)return;
  // Sample in optical order, from the far wall toward the observer. The
  // high-frequency structure is attached to the transported density envelope.
  float stagger=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
  vec2 currentNear=suspendedDrift(uv,1.,uAspect,uProgress,uFlowPhase);
  vec2 currentFar=suspendedDrift(uv,0.,uAspect,uProgress,uFlowPhase);
  float flicker=smoothstep(.46,.55,uProgress)*(1.-smoothstep(.71,.84,uProgress));
  vec2 rolling=flicker*vec2(.028*sin(.76*uFlowPhase+uv.y*4.),.023*cos(.59*uFlowPhase+uv.x*5.));
  // The mist's fine detail drifts on, steadily, with the event's clock: it streams, it does not pulse.
  float boil=uSpin;
  // The live mist moves the bake's. It says how much mist is here (its ratio to the bake's column, or where
  // the bake has none, to a plume's core); the mist's own noise says where its edges are. So where the live
  // mist gathers, the bake's is denser and whole; where it thins, the bake's thins too and breaks up into
  // shreds along its own noise (a threshold on it that rises as the mist thins), so thin mist is torn wisps,
  // never an even grey veil, and the live field's smooth contours are never drawn. What the flow has carried
  // where the bake has none is laid in at the live mist's own depth, and breaks up alike. Its texture is
  // read where the flow carried it from, in its two phases, blended: it travels with the water.
  if(uHeadCount>0)findHeads(uv);
  vec2 gain=vec2(1),cut=vec2(-1),extra=vec2(0),zLive=vec2(.5),carried=vec2(0),carried2=vec2(0);
  float wa=1.,wb=0.;
  if(uLive>0.){
    // (Its larger scales only: live-ink.js smooths it, so the flow's own striations never draw.)
    vec4 L=texture(uLiveMist,uv);
    vec4 B=bakedColumn(uv);
    vec2 cover=smoothstep(.0015,.012,B.xy);
    vec2 ratio=clamp(mix(L.xy/.06,L.xy/max(B.xy,vec2(1e-4)),cover),0.,3.);
    vec2 dense=mix(sqrt(min(ratio,1.)),pow(max(ratio,1.),vec2(.7)),step(1.,ratio));
    gain=mix(vec2(1),cover*dense,uLive);
    cut=mix(vec2(-1),.8-smoothstep(0.,1.,ratio),uLive);
    // (Only what reads: a trace of live mist where the bake has none would fill empty samples for nothing.)
    extra=uLive*(1.-cover)*min(max(L.xy-.004,vec2(0)),vec2(.07));
    zLive=clamp(L.zw/max(L.xy,vec2(1e-4)),.05,.95);
    vec4 E=uLive*texture(uLivePhases,uv);
    carried=E.xy;carried2=E.zw;
    wa=sin(3.14159265*fract(phaseAt(uv,uPhase)));wa*=wa;wb=1.-wa;
    // (Where one phase is all but gone, the other alone: half the noise to read.)
    if(wa<.02){carried=carried2;wa=1.;wb=0.;}else if(wb<.02){wa=1.;wb=0.;}
  }
  // Front to back (from the observer toward the far wall), each half kept by its own transmittance, which is
  // the same picture as compositing back to front; once both are spent nothing behind can show, so stop.
  float Tf=1.,Tr=1.;
  float pzLow=min(min(pz.x>0.?pz.x:2.,pz.y>0.?pz.y:2.),min(pz.z>0.?pz.z:2.,pz.w>0.?pz.w:2.));
  // (The heads, smooth in depth, are read on every other step and held for the one between.)
  vec2 headsHeld=vec2(0);float nhHeld=0.;
  for(int i=35;i>=0;i--){
    float z=(float(i)+.5+.10*stagger)/36.;
    if(Tr<.004 && (Tf<.004 || pieceZ<=0. || z<pzLow))break;
    vec2 drift=mix(currentFar,currentNear,z);
    vec3 p=vec3(uv-drift,z);

    // (A live column with no bake under it: spread over depth round the live mist's own, σ .08.)
    vec2 dz=(z-zLive)/.08,laid=extra*exp(-.5*dz*dz)*4.99;
    // (The heads here, once: their ink, and where it began, for the noise: the texture is wound with it.)
    vec3 mh;float nh=nhHeld;
    vec2 heads=headsHeld;
    if(gCount>0 && (i&1)==1){heads=1.-exp(-headInk(p,mh,nh));headsHeld=heads;nhHeld=nh;}
    vec2 coarse=inkAt(p,heads)*gain+laid;
    if(max(coarse.x,coarse.y)<.003)continue;
    // (The noise's fine detail in the water's own coordinates: the heads carry their own structure, from
    // the photograph; two heads' coordinates blended would squeeze the noise into stripes where they meet.)
    vec3 place=vec3((p.x-carried.x)*uAspect,p.y-carried.y,p.z*.67);
    Grain q=grainAt(place,rolling,boil);
    if(wb>0.)q=blendGrain(q,grainAt(vec3((p.x-carried2.x)*uAspect,p.y-carried2.y,p.z*.67),rolling,boil),wa,wb);
    vec3 v=q.v,f=q.f,g=q.g;
    vec3 warp=v*.104+f*.045+g*.022;
    // (Where the live mist thins, only its noise's crests are left: torn shreds of it.)
    float n=.5+2.5*(.7*f.g+.3*g.b);
    vec2 keep=smoothstep(cut-.18,cut+.18,vec2(n));
    float cavity=q.cavity;
    // (Mist the flow has carried off its plume is drawn as wisps along the noise's ridges, tendrils of
    // smoke: never a flat, even cloud.)
    float strand=.5+2.2*(f.r+.35*g.g);
    laid*=.2+1.8*pow(max(0.,1.-abs(2.*strand-1.)),3.);
    vec2 dye=(inkAt(p+warp/vec3(uAspect,1,1),heads)*gain+laid)*keep;
    vec3 fold=q.fold,curl=q.curl;
    vec4 fine=q.fine;
    float grain=fine.g+.24*(curl.r-.5);
    // Ridged turbulence (the valleys of |2n − 1|): thin wisps and threads instead of grey haze; the far
    // water softer than the near (aerial depth).
    float ridge=pow(max(0.,1.-abs(2.*fine.g-1.)),4.)*mix(.55,1.,z);
    float lip=exp(-17.*abs(cavity+.21*fine.a-.61));
    float foldPhase=fold.r+.37*grain+.15*f.y;
    float sheets=.24+1.24*smoothstep(.42,.80,foldPhase)+.72*exp(-28.*abs(foldPhase-.66));
    float carved=smoothstep(.31,.72,cavity+.26*fine.a);
    // A folded lamella catches grazing light along one face and absorbs on
    // the other. Keeping a diffuse fraction gives a veil behind the wet core.
    float pleat=fold.r+.33*fine.b+.17*g.r+.09*sin(17.*f.g+7.*v.b);
    float membrane=exp(-25.*abs(pleat-.70));
    sheets*=.52+.87*smoothstep(.48,.80,pleat)+1.15*membrane;
    sheets*=.78+.62*ridge;
    // (A ring's head is ink rolled, not the bake's folded lamellae: its body billows, its layers are its own.)
    sheets=mix(sheets,1.,.75*nh);
    float black=dye.x*sheets*(.15+1.4*carved), white=dye.y*sheets*(.25+1.3*carved),total=black+white;
    // (Toward the light. The heads' own shading is in their photograph: a share of their ink here stands for
    // what lies toward the light, so they are not read twice.)
    vec3 lp=p+vec3(-.026,.036,.092)+warp*.6;
    vec2 light=(inkAt(lp,.55*heads)*gain+laid)*keep;
    float transmission=exp(-2.65*(light.x+.56*light.y));
    vec2 held=coarse*keep;
    float edge=clamp((held.x+held.y-light.x-light.y)*2.8,0.,1.);
    float incidence=clamp(.46+1.7*(fold.r-fine.g)+.62*(curl.b-curl.g),.08,1.);
    vec3 soot=mix(vec3(.010,.010,.012),vec3(.158,.152,.148),transmission*.39+edge*.66);
    vec3 steam=mix(vec3(.17,.19,.22),vec3(.85,.84,.79),transmission);
    float ivoryShare=white/max(.0001,total);
    // (The warm rim belongs to the lit steam: on thin soot it reads as a mauve cast.) Thin edges facing
    // the bath's backlight catch it, forward-scattered: a silver lining.
    vec2 toLamp=(p.xy-vec2(.68,.72))*vec2(.95,.86);
    float backlight=exp(-1.45*dot(toLamp,toLamp));
    vec3 emission=mix(soot,steam,ivoryShare)
              +vec3(.12,.052,.035)*edge*(1.-z*.65)*ivoryShare+vec3(.14,.14,.15)*lip*transmission+.10*membrane*edge
              +vec3(.21,.2,.19)*backlight*edge*(1.-.6*(1.-transmission))*mix(.45,1.,ivoryShare);
    emission*=.72+.34*incidence;
    float envelope=smoothstep(.003,.10,max(held.x,held.y));
    float a=1.-exp(-total*.55*envelope);
    vec4 sampleLight=vec4(emission*a,a);
    // (In front of what stands here in how many of the four taps.)
    float inFront=pieceZ>0.?.25*(float(pz.x>0.&&z>pz.x)+float(pz.y>0.&&z>pz.y)+float(pz.z>0.&&z>pz.z)+float(pz.w>0.&&z>pz.w)):0.;
    front+=Tf*sampleLight*inFront;Tf*=1.-a*inFront;
    rear+=Tr*sampleLight*(1.-inFront);Tr*=1.-a*(1.-inFront);
  }
}`;

// Material sheets are indexed periodic grids. Their thickness and folds travel
// with the mesh. Brightness comes from transmission and the grazing wet rim.
// Each late head's study (ink-tank.js LATE): its tile in data/ink-density.webp and whether it is mirrored;
// −1 for the other drops.
const lateStudy=Array.from({length:32},(_,id)=>{const l=LATE.find(l=>l.id===id);return l?l.study+4*l.flip:-1;});
const LATE_GLSL=`const float LATE[32]=float[32](${lateStudy.map(v=>v.toFixed(1)).join(',')});`;
export const INK_SHEET_VERTEX=/* glsl */`#version 300 es
precision highp float;
uniform highp usampler2DArray uMesh;
uniform int uOrder[32],uCols,uRows;
uniform vec4 uVaporFigure[32];
uniform float uKey,uProgress,uBreath,uFlowPhase;
uniform vec2 uSize;
// The live ink's flow carries the veils too (live-ink.js): each point of a sheet sits where the flow has
// carried it, a little way from where the bake put it, and is drawn back as the flow lets go.
uniform highp sampler2D uLiveDetail;
uniform float uLive;
${suspendedCurrent}
out vec3 position;
out vec2 cloth;
out float amount;out vec3 surfaceNormal;
flat out float ivory,seed,section,sourceId;
flat out vec4 figure;
vec4 material(ivec2 uv){
 return mix(vec4(texelFetch(uMesh,ivec3(uv,int(floor(uKey))),0)),vec4(texelFetch(uMesh,ivec3(uv,int(ceil(uKey))),0)),fract(uKey))/65535.;
}
void main(){
 int slab=gl_VertexID/(uCols*uRows),i=gl_InstanceID,col=gl_VertexID%uCols,row=(gl_VertexID/uCols)%uRows;
 ivec2 uv=ivec2(col,row+uRows*i);
 vec4 data=vec4(0);vec3 p=vec3(0);surfaceNormal=vec3(0,0,1);
 if(slab==4){data=material(uv);
 int rowBase=uRows*i;
 vec3 da=material(ivec2((col+1)%(uCols-1),uv.y)).xyz-material(ivec2((col+uCols-2)%(uCols-1),uv.y)).xyz;
 vec3 dv=material(ivec2(col,rowBase+min(row+1,uRows-1))).xyz-material(ivec2(col,rowBase+max(row-1,0))).xyz;
 vec3 axisScale=vec3(uSize.x/uSize.y,1,1);
 surfaceNormal=normalize(cross(da*axisScale,dv*axisScale)+vec3(0,0,1e-9));
 p=data.xyz*2.-.5;
 }
 cloth=vec2(float(col)/float(uCols-1),float(row)/float(uRows-1));
 int id=uOrder[i];ivory=float(id%2);seed=float(id)*1.719;sourceId=float(id);section=float(slab);figure=uVaporFigure[id];
 if(slab<4){
   vec4 left=material(ivec2(uCols,uv.y)),right=material(ivec2(uCols+1,uv.y));
   vec4 far=material(ivec2(uCols+2,uv.y)),near=material(ivec2(uCols+3,uv.y));
   float x=cloth.x*2.-1.,layer=(float(slab)-1.5)/1.75;
   float chord=sqrt(max(0.,1.-x*x));
   vec4 rail=mix(left,right,cloth.x);
   rail.xyz+=.5*(near.xyz-far.xyz)*layer*chord;
   p=rail.xyz*2.-.5;data.w=min(rail.w,mix(far.w,near.w,.5+.5*layer));
 }
 float swing=smoothstep(.36,.51,uProgress)*(1.-smoothstep(.70,.82,uProgress));
 float angle=6.2831853*cloth.x;
 p.xy+=swing*(.0045+.0025*cos(angle*2.))*vec2(sin(6.*cloth.y+angle+seed+uBreath)*uSize.y/uSize.x,cos(5.*cloth.y-angle+seed+uBreath));
 p.xy+=suspendedDrift(p.xy,p.z,uSize.x/uSize.y,uProgress,uFlowPhase);
 // (Its large scales only, never bent sharper than a sheet can bend (live-ink.js smooths and eases them): a
 // sheet bends with the flow; the fine detail is the mist's.)
 if(uLive>0.)p.xy+=uLive*textureLod(uLiveDetail,p.xy,0.).xy;
 position=vec3(p.xy*vec2(uSize.x/uSize.y,1.),p.z);
 gl_Position=vec4(2.*p.xy-1.,0.,1.);
 // (Thinner while the live ink runs: the screen cleared for it, its trunks less of a wall of falling lines.)
 amount=data.w*(1.-.75*.55*uLive);
}`;
export const INK_SHEET_FRAGMENT=/* glsl */`#version 300 es
precision highp float;
// A folded sheet seen face on (as glsl/fire.js fiFold): the light through it at X is the sum, over every
// layer of the sheet folded over X, of 1/|1 + A k cos(k x + φ)|: bright crease lines where a fold turns
// edge-on, fainter between. (Five samples: enough for the few folds here.)
float inkFold(float X,float A,float k,float ph){
  float x0=X-A,dx=2.*A/5.,gp=x0+A*sin(k*x0+ph)-X,sum=0.;
  for(int i=1;i<=5;i++){
    float x=x0+dx*float(i),g=x+A*sin(k*x+ph)-X;
    if((g<0.)!=(gp<0.)){float xr=x-dx*g/(g-gp);sum+=1./max(abs(1.+A*k*cos(k*xr+ph)),.08);}
    gp=g;
  }
  return sum;
}
${LATE_GLSL}
uniform sampler2D uFigures,uFigureDepth,uMist,uPigment,uKnightPigment,uFigurePigment;
uniform bool uDepthOnly;
uniform vec2 uSize;uniform float uProgress,uBreath,uFlowPhase;
uniform float uRollUp; // how far the plume heads' caps have rolled up (ink-swirl.js rollUp): 0 … 1, never back
uniform float uClockP; // the event's clock (living-forms.js clockP): the waves turn with it, not with P
uniform vec4 uBreathe; // the caps' breath (ink-swirl.js breath): its depth, then the phases of l = 0, 2, 3
in vec3 position;in vec2 cloth;in float amount;in vec3 surfaceNormal;
flat in float ivory,seed,section,sourceId;
flat in vec4 figure;
out vec4 o;
void main(){
 if(amount<.002)discard;
 vec2 uv=gl_FragCoord.xy/uSize;
 float visible=1.;
 if(!uDepthOnly && 1.-texture(uFigureDepth,uv).r>position.z){
   visible=1.-texture(uFigures,uv).a;
   if(visible<.002)discard;
 }
 if(section<3.5){
   float layer=(section-1.5)/1.75,v=cloth.y;
   float phase=seed+uClockP*5.4+.22*uBreath;
   vec2 dyeUV=cloth;
   float envelope=sin(3.14159*v)*sin(3.14159*cloth.x);
   dyeUV.x+=envelope*(.038*sin(v*10.+phase)+.027*sin(v*19.+cloth.x*8.-phase)*layer);
   dyeUV.y+=envelope*(.035*layer*cos(8.*cloth.x+phase)+.023*sin(cloth.x*11.-v*7.+phase));
   // Inverse-map a pair of finite-core vortex rolls into the density study.
   // The dark nose rolls one way; its solvent-rich skirt rises past it on
   // the other side. Sampling material coordinates keeps the narrow stem
   // connected as the sheet folds and opens.
   float free=smoothstep(.43,.555,uProgress)*(1.-smoothstep(.682,.778,uProgress));
   // A late head is its study: the rolls only stir it, so it stays the picture it was drawn as.
   float lateStudy=LATE[int(sourceId)],isLate=lateStudy>=0.?smoothstep(.50,.53,uProgress)*(1.-smoothstep(.635,.70,uProgress)):0.;
   free*=1.-.6*isLate;
   float turn=(uClockP-.505)*34.+seed*.35+.57*uFlowPhase;
   float left=.33+.077*sin(turn*.64);
   vec2 leftCore=vec2(left,.68+.094*cos(turn*.83+seed));
   vec2 rightCore=vec2(.68-.062*cos(turn*.70),.57+.13*sin(turn*.69+seed));
   vec2 l=dyeUV-leftCore,r=dyeUV-rightCore;
   vec2 core=(dyeUV-vec2(.50,.81))*vec2(3.8,4.6);
   float rim=1.-.72*exp(-dot(core,core));
   float leftRoll=free*rim*(.53+.37*sin(turn+v*4.))*exp(-dot(l,l)*15.);
   float rightRoll=-free*rim*(.60+.41*cos(turn*.86+seed))*exp(-dot(r,r)*19.);
   leftRoll*=smoothstep(0.,.11,envelope);
   rightRoll*=smoothstep(0.,.11,envelope);
   // The cap rolls up: each of its two cores winds the study's filaments round itself, a turn and more by
   // the end of the event, the core faster than its rim (a Lamb–Oseen core, falling as 1/r² outside it),
   // so the filaments are drawn into spiral curls; it never turns back.
   float wind=6.2831853*uRollUp*(1.8+.8*fract(seed*.37))*rim*smoothstep(0.,.11,envelope);
   float lr=dot(l,l),rr=dot(r,r);
   leftRoll+=wind*(lr<1e-8?1.:(1.-exp(-lr/.0072))*.0072/lr);
   rightRoll-=wind*(rr<1e-8?1.:(1.-exp(-rr/.0056))*.0056/rr);
   float cs=cos(leftRoll),sn=sin(leftRoll);
   dyeUV+=mat2(cs-1.,sn,-sn,cs-1.)*l;
   cs=cos(rightRoll);sn=sin(rightRoll);
   dyeUV+=mat2(cs-1.,sn,-sn,cs-1.)*r;
   // Lower down, the skirt the cap drags behind it rolls the other way (Kelvin–Helmholtz curls on the
   // shear between the falling plume and the water it leaves), a turn and a half or so by the end.
   vec2 skirtL=vec2(.27+.04*sin(seed),.36),skirtR=vec2(.71-.04*cos(seed),.30);
   vec2 sl=dyeUV-skirtL,sr=dyeUV-skirtR;
   float slr=dot(sl,sl),srr=dot(sr,sr),curl=6.2831853*uRollUp*(1.25+.6*fract(seed*.61))*smoothstep(0.,.11,envelope);
   float aL=-curl*(slr<1e-8?1.:(1.-exp(-slr/.0045))*.0045/slr),aR=curl*(srr<1e-8?1.:(1.-exp(-srr/.004))*.004/srr);
   cs=cos(aL);sn=sin(aL);dyeUV+=mat2(cs-1.,sn,-sn,cs-1.)*sl;
   cs=cos(aR);sn=sin(aR);dyeUV+=mat2(cs-1.,sn,-sn,cs-1.)*(dyeUV-skirtR);
   // The cap breathes (ink-swirl.js): it swells and settles (l = 0) and wobbles in a free drop's l = 2 and
   // l = 3 modes, their axes slowly turning; the two inks out of step, so black draws in as ivory lets go.
   // Swollen, the same pigment covers more: it thins by the swell's area.
   vec2 bc=dyeUV-vec2(.5,.7);
   float ba=atan(bc.y,bc.x),bp=seed*1.3+3.14159*ivory;
   float swell=uBreathe.x*(.12*sin(uBreathe.y+bp)+.065*cos(2.*(ba-.4*uBreathe.y-seed))*sin(uBreathe.z+bp)
     +.05*cos(3.*(ba+.3*uBreathe.y+seed))*sin(uBreathe.w+bp))*smoothstep(.3,.75,v);
   dyeUV=vec2(.5,.7)+bc/(1.+swell);
   float thinned=1./((1.+swell)*(1.+swell));
   bool mirrored=mod(sourceId,3.)>1.5;
   float variant=mod(floor(sourceId*.5)+mod(sourceId,2.)+floor(sourceId*.2),4.);
   if(sourceId==10.)variant=2.;
   if(lateStudy>=0.){variant=mod(lateStudy,4.);mirrored=lateStudy>=4.;}
   if(mirrored)dyeUV.x=1.-dyeUV.x;
   vec2 tile=vec2(mod(variant,2.),floor(variant*.5));
   float border=smoothstep(0.,.026,min(min(dyeUV.x,dyeUV.y),min(1.-dyeUV.x,1.-dyeUV.y)));
   vec2 texUV=(tile+clamp(dyeUV,.003,.997))*.5;
   float transmission=texture(uPigment,texUV).r;
   float lit=texture(uPigment,texUV+vec2(-.0025,-.0040)*(1.3-.4*layer)).r;
   float formed=0.;
   if(uProgress>figure.y){
     // A local front passes through the carrier. Thin flanks continue to
     // move after the dense landmark has acquired its optical thickness.
     float type=abs(figure.x)-1.;
     bool knight=type>2.5 && type<3.5;
     vec2 q=cloth;
     float phase=26.*(uProgress-figure.y)+.26*uBreath+.32*mod(seed,5.);
     vec2 focus=knight?vec2(.65,.34):vec2(.51,type>3.5?.31:.19);
     float distanceToLandmark=length((q-focus)*vec2(.93,.85));
     float at=(uProgress-figure.y)/max(.015,figure.z-figure.y);
     float gather=smoothstep(.34*distanceToLandmark,.72+.28*distanceToLandmark,at);
     formed=gather;
     float core=exp(-10.*distanceToLandmark*distanceToLandmark);
     float lock=smoothstep(figure.z,figure.w+.90*(figure.w-figure.z),uProgress);
     float loose=(1.-.76*core)*(1.-lock);
     float roll=sin(10.*q.y-5.*q.x-phase+.9*sin(8.*q.x+phase));
     vec2 warp=vec2(.048*roll+.024*sin(15.*q.y+phase+layer),.045*cos(6.*q.x+7.*q.y-phase)+.018*layer);
     q+=warp*loose+(1.-lock)*vec2(.021*layer*sin(6.*q.y-phase*.5),.012*layer*cos(8.*q.x+phase));
     q+=(1.-gather)*vec2(.13*sin(5.*q.y+phase),-.097*cos(5.*q.x-phase*.72));
     vec2 towardsLight=vec2(-.004,-.005);
     float kt,kLight;
     if(knight){
       kt=texture(uKnightPigment,clamp(q,.002,.998)).r;
       kLight=texture(uKnightPigment,clamp(q+towardsLight,.002,.998)).r;
     }else{
       // Two distinct pawns share the same spherical head and collar.
       // A helical shear and a second pawn's loose skirt break repetition.
       float cell=type<3.?type:type<4.5?3.:4.+mod(floor(sourceId*.5),2.);
       vec2 tile=vec2(mod(cell,3.),floor(cell/3.));
       vec2 grid=vec2(3,2);
       q.x+=loose*.032*sin(6.*q.y+phase+seed)*sin(3.14*q.y);
       kt=texture(uFigurePigment,(tile+clamp(q,.003,.997))/grid).r;
       kLight=texture(uFigurePigment,(tile+clamp(q+towardsLight,.003,.997))/grid).r;
     }
     // Interpolating optical depth leaves clear openings in the bishop and
     // between the rook's battlements while their side walls gain pigment.
     transmission=pow(max(.012,transmission),1.-gather)*pow(max(.012,kt),gather);
     lit=mix(lit,kLight,gather);
   }
   float optical=-log(max(.012,transmission));
   float filling=smoothstep(.013,.13,optical);
   float share=mix(sourceId<1.5?1.12:.28+.54*fract(seed),sourceId<.5?1.12:1.30,formed);
   // Dense material is concentrated toward one internal sheet; thinner
   // sections carry the displaced, translucent wake through optical depth.
   float column=section<.5?.11:section<1.5?.21:section<2.5?.92:.18;
   // One in-focus section carries the little membranes around the eye. The
   // other three supply softer extinction through the cheek and wet mane.
   column=mix(column,section>1.5&&section<2.5?1.34:.074,formed);
   float packet=.5+.5*cos(30.*(uClockP-.50)-7.8*v+seed+.53*uFlowPhase);
   float suspending=free*packet*smoothstep(.16,.52,v);
   float foreground=sourceId<1.5||sourceId==10.||sourceId==23.||lateStudy>=0.?1.:0.;
   // Fewer dense axes keep the water between the four foreground plumes clear.
   share=mix(share,mix(share*.53,max(.98,share)*1.18,foreground),free);
   float thick=amount*border*filling*optical*share*column*mix(1.,.57,suspending)*thinned;
   float lift=free*smoothstep(.36,.88,v)*smoothstep(-.35,.88,cos((uClockP-.622)*69.+sourceId*.86+(v-.78)*5.4));
   // Solvent opens channels through the head, leaving its wet filaments
   // connected. The lofted portion is shaded in the companion mist volume.
   float channel=.5+.5*sin(12.*dyeUV.x+7.*dyeUV.y+2.2*sin(8.*dyeUV.y-.47*turn)+.30*layer);
   thick*=1.-lift*(.66+.31*smoothstep(.15,.83,channel));
   float alpha=(1.-exp(-thick))*visible;
   if(alpha<.001)discard;
   if(uDepthOnly){
     if(alpha<.06)discard;
     gl_FragDepth=1.-position.z;o=vec4(0,0,0,position.z);return;
   }
   // A short extinction sample toward the safelight shades the folded
   // interior. Ivory scatters through dilute pigment and reds recede at depth.
   float shade=smoothstep(.09,.92,lit);
   vec3 milk=mix(vec3(.54,.56,.57),vec3(.997,.976,.902),.34+.66*shade);
   // Dense milk scatters the incident light back out. A translucent fold
   // behind a dense upstream fold sits in its cooler, localized shadow.
   float backscatter=1.-exp(-1.25*optical);
   float crease=smoothstep(.040,.44,transmission-lit)*backscatter;
   vec3 pearl=mix(vec3(.53,.59,.62),vec3(.999,.974,.897),.22+.78*backscatter);
   pearl*=1.-.25*crease;
   milk=mix(milk,pearl,max(formed,.57*free));
   milk+=vec3(.060,.057,.050)*max(0.,lit-transmission);
   vec3 soot=mix(vec3(.012,.009,.015),vec3(.19,.15,.16),.15+.60*lit+.10*layer);
   float foldedLight=.48*sqrt(max(0.,lit))+.62*max(0.,lit-transmission);
   soot+=free*vec3(.26,.237,.228)*foldedLight;
   vec3 c=mix(soot,milk,ivory);
   c+=vec3(.105,.035,.021)*(1.-smoothstep(.29,.56,uProgress));
   o=vec4(c*alpha,alpha);gl_FragDepth=1.-position.z;return;
 }
 if(uDepthOnly)discard;
 gl_FragDepth=1.-position.z;
 vec3 normal=normalize(surfaceNormal+vec3(0,0,1e-7));
 vec2 m=vec2(cloth.x*6.2831853,cloth.y);
 float a=m.x,v=m.y,lip=smoothstep(.55,.83,v);
 float free=smoothstep(.43,.555,uProgress)*(1.-smoothstep(.682,.778,uProgress));
 float twist=(uClockP-.51)*32.+seed+.51*uFlowPhase;
 a+=free*(.71*sin(twist-6.*v)+.32*sin(11.*v-.61*twist));
 v+=free*.032*sin(3.*a+twist-8.*v);
 float whirl=sin(3.*a+seed+9.*v+1.3*sin(a-10.*v));
 a+=.35*sin(7.*v+whirl)+.24*sin(2.*a+5.*v+seed);
 v+=.033*sin(4.*a+seed+v*13.);
 float meander=sin(2.*a+v*9.+seed)+.57*sin(3.*a-v*16.+seed)+.31*cos(6.*a+v*23.);
 // The skin's folds: crease lines where the sheet turns edge-on, travelling as the event runs, in place of
 // a combed fibre (which read as hair).
 float folds=inkFold(a*.32+.06*meander,.105,15.,7.*v+1.3*meander+seed+9.*uRollUp);
 float crease=smoothstep(1.35,3.2,folds);
 float fiber=2.*crease-1.;
 float vein=.35*crease*crease;
 float lace=.53+.47*sin(4.*a-v*22.+2.*meander+.60*sin(9.*a+v*16.));
 float micro=.50+.50*cos(25.*a+v*55.+6.*meander+2.*fiber);
 float pleat=.5+.5*normal.y,graze=pow(1.-abs(normal.z),1.25);
 float thickness=.009+.059*pow(pleat,1.7)+.072*graze+.35*lip+.11*pow(max(0.,fiber),6.)+.063*vein;
 thickness*=mix(.20,1.,smoothstep(.06,.78,lace+lip*.37));
 thickness+=.018*micro*micro;
 float veil=sin(2.5*a+18.*v+3.3*meander);
 thickness+=.27*exp(-13.*abs(veil+.14*fiber))+.075*exp(-10.*abs(veil+.55+.28*micro));
 thickness*=mix(.11,1.16,smoothstep(-.71,.41,veil+.46*lip+.31*micro));
 // At grazing incidence a sparse, edge-on skin covers a small fraction
 // of a pixel. Feather that coverage and keep only its thick rolled fibers.
 float rimCoverage=smoothstep(.012,.19,abs(normal.z));
 float fiberCoverage=.09+.91*smoothstep(.23,.79,vein+.43*lip);
 float optical=amount*(sourceId<1.5?.15:.072)*thickness*fiberCoverage*rimCoverage/(.38+.62*abs(normal.z));
 // A traveling high-curvature ridge catches the light as a veil is drawn
 // to a point. Its opaque shoulder is carried by the interior optical sheets.
 float tendon=exp(-14.*abs(sin(2.*a+13.*v+.90*meander-.72*twist)));
 optical+=free*amount*(.12+.13*ivory)*tendon*rimCoverage*pow(lip,.7);
 float alpha=(1.-exp(-optical*mix(1.20,1.09,ivory)))*visible;
 vec3 key=normalize(vec3(-.43,.69,.56));
 float shade=.5+.5*dot(normal,gl_FrontFacing?key:-key);
 float edge=graze*(.19+.81*shade)*(.39+.61*micro);
 vec3 black=mix(vec3(.012,.008,.015),vec3(.105,.067,.076),shade*.73);
 vec3 milk=mix(vec3(.46,.40,.39),vec3(.99,.96,.87),.23+.72*shade);
 vec3 color=mix(black,milk,ivory)+vec3(.17,.12,.105)*edge;
 float fog=texture(uMist,uv).a;
 alpha*=1.-.29*fog*(1.-position.z);
 o=vec4(color*alpha,alpha);
}`;
export const INK_THREAD_FRAGMENT=/* glsl */`#version 300 es
precision highp float;
uniform sampler2D uFigureDepth;
uniform vec2 uSize;
in float edge,depth,opacity,pearl;
out vec4 o;
void main(){
  if(1.-texture(uFigureDepth,gl_FragCoord.xy/uSize).r>depth)discard;
  float a=opacity*(1.-smoothstep(.1,1.,abs(edge)))*.43;
  vec3 col=mix(vec3(.042,.037,.046),vec3(.82,.79,.73),pearl);
  o=vec4(col*a,a);
}`;

// Wet threads peel off the moving foot. Their far ends follow a delayed pose,
// so reversing the flight also rewinds the pinch-off.
export const INK_WAKE_VERTEX=/* glsl */`#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec4 uHead,uTail; // xy in pixels, depth, footprint radius
uniform vec4 uClock; // strength, flight, slot and side
out float edge,depth,opacity,pearl;
vec2 wake(float t,float k){
  vec2 chord=uTail.xy-uHead.xy;
  vec2 dir=chord/max(1.,length(chord)),across=vec2(-dir.y,dir.x);
  float phase=k*2.4+uClock.z*.7;
  float amp=sin(t*3.14159)*uHead.w;
  return mix(uHead.xy,uTail.xy,t)+amp*(across*(sin(phase+8.*t)*.52+sin(phase+17.*t)*.14)
    +dir*.23*cos(phase+7.*t));
}
void main(){
  int k=gl_VertexID%6,segment=gl_VertexID/6;
  float t=(float(segment)+float(k==1||k==2||k==4))/24.,i=float(gl_InstanceID);
  edge=(k==2||k==4||k==5)?1.:-1.;
  vec2 pos=wake(t,i), tangent=wake(t+.002,i)-wake(t-.002,i);
  vec2 normal=vec2(-tangent.y,tangent.x)/max(.0001,length(tangent));
  pos+=edge*normal*(.6+.08*uHead.w*(1.-t))*max(.1,sin(3.14159*t));
  depth=mix(uHead.z,uTail.z,t)-.017;pearl=uClock.w;
  opacity=uClock.x*(1.-t)*(.21+.1*sin(i+.4));
  gl_Position=vec4(2.*pos/uSize-1.,0,1);
}`;
