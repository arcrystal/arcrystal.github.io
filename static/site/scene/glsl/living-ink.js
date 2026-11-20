import { PIECE_SHAPES, PIECE_MATERIAL } from './board3d.js';


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
uniform sampler2D uRegistration,uKnightPigment,uFigurePigment;
vec3 rotatePiece(vec3 p) {
  float c=cos(uTurn.y), s=sin(uTurn.y);
  p.xy=mat2(c,s,-s,c)*p.xy;
  c=cos(uTurn.x); s=sin(uTurn.x);
  p.xz=mat2(c,s,-s,c)*p.xz;
  return p;
}
float deposit(vec3 p) {
  float t=uModel.x, h=uModel.z;
  vec3 q=rotatePiece(p); q.y+=h*.5;
  float d=shape(int(t),q);
  if(uTurn.w>.999) return d;
  // The shell is liquid where the same ink membranes have just laid down.
  // Surface tension damps the last low relief into the shared carved model.
  float gel=1.-smoothstep(.18,.90,uTurn.w);
  float fold=sin(q.y*15.+4.1*q.x+uSeed*.7+.7*sin(13.*q.z));
  float ridge=cos(17.*q.x-12.*q.z+3.2*fold);
  return d-gel*(.005+.008*fold+.006*ridge);
}
vec2 pigmentAt(int type,vec3 q,float y,out vec2 towardLight){
  float rank=float(type);
  if(type==5)rank+=mod(floor(uInkOrientation.x*.5),2.);
  vec2 dims=vec2(textureSize(uRegistration,0));
  vec2 uv=(vec2(.5+clamp(y,0.,1.)*(dims.x-1.),2.*rank+.5))/dims;
  vec4 section=texture(uRegistration,uv);
  float v=texture(uRegistration,uv+vec2(0.,1./dims.y)).r;
  float across=type==3?q.x:dot(q.xz,vec2(cos(uInkOrientation.y),sin(uInkOrientation.y)));
  float x=mix(section.z,section.w,clamp((across-section.x)/max(.02,section.y-section.x),0.,1.));
  vec2 tissue=clamp(vec2(x,v),.002,.998);
  towardLight=vec2(-.003,-.004);
  if(type==3)return tissue;
  float cell=rank-(rank>3.?1.:0.);
  vec2 grid=vec2(3,2);
  towardLight/=grid;
  return (vec2(mod(cell,3.),floor(cell/3.))+tissue)/grid;

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
  float t=along-sqrt(chord),end=along+sqrt(chord),d;
  vec3 p;
  for(int i=0;i<68;i++){
    p=origin+t*ray; d=deposit(p); if(d<.0016 || t>end)break;
    t+=max(.0009,d*(uTurn.w>.98?.78:.62));
  }
  if(d>.0018 || t>end)discard;
  vec2 e=vec2(.003,0);
  vec3 n=normalize(vec3(deposit(p+e.xyy)-deposit(p-e.xyy),deposit(p+e.yxy)-deposit(p-e.yxy),deposit(p+e.yyx)-deposit(p-e.yyx)));
  vec3 q=rotatePiece(p)+vec3(0.,uModel.z*.5,0.);
  bool black=uModel.y>.5;
  int type=int(uModel.x);
  vec3 c=finishPiece(black,q,n,-ray,1.,.9,0.);
  c*=.82; c=pow(clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.),vec3(1./2.2));
  float g=uTurn.w,coverage=1.;
  if(g<.995){
    vec2 offset;
    vec2 material=pigmentAt(type,q,q.y/uModel.z,offset);
    vec2 study=type==3?
      vec2(texture(uKnightPigment,material).r,texture(uKnightPigment,material+offset).r):
      vec2(texture(uFigurePigment,material).r,texture(uFigurePigment,material+offset).r);
    float absorption=-log(max(.012,study.x));
    vec3 local=q-vec3(0.,uModel.z*.5,0.);
    float reach=min(length(local-uNuclei[0]),min(length(local-uNuclei[1])+.03,length(local-uNuclei[2])+.07))/uModel.z;
    // Denser filaments and the three anatomy-specific points wet first.
    // Use true transmittance through all the intervening solvent. The last
    // clear windows close locally before lacquer replaces the wet relief.
    float age=g-.46*reach+.11*min(2.,absorption);
    float gel=smoothstep(.13,.82,age);
    float wet=g*(.22+3.6*absorption)*(.55+.45*smoothstep(-.12,.54,age));
    coverage=mix(1.-exp(-wet),1.,max(gel*smoothstep(.02,.26,g),smoothstep(.68,.97,g)));
    if(coverage<.004)discard;
    float crease=clamp(.7+1.6*(study.y-study.x),.05,1.);
    float edge=pow(1.-max(0.,dot(n,-ray)),2.);
    vec3 graphite=mix(vec3(.032,.024,.033),vec3(.23,.20,.205),.78*study.y+.18*crease);
    vec3 pearl=mix(vec3(.53,.59,.61),vec3(.98,.961,.889),.19+.81*(1.-exp(-1.2*absorption)));
    vec3 film=(black?graphite:pearl)*(.88+.12*crease);
    film+=vec3(.16,.15,.135)*edge*crease;
    float polish=smoothstep(.18,.92,age)*smoothstep(.08,.36,g);
    c=mix(film,c,max(polish,smoothstep(.73,.97,g)));
  }
  float depth=clamp(uModel.w+.021*dot(p,-fwd),.01,.98);
  gl_FragDepth=1.-depth;
  o=vec4(c*coverage,coverage);
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
vec2 density(vec3 p){
  return mix(readVolume(p,floor(uKey)),readVolume(p,ceil(uKey)),fract(uKey));
}
void main(){
  vec2 uv=gl_FragCoord.xy/uSize;
  float pieceZ=max(1.-texture(uFigureDepth,uv).r,texture(uSheetDepth,uv).a);
  rear=vec4(0);front=vec4(0);
  if(uProgress<.131 || uProgress>1.145)return;
  // Sample in optical order, from the far wall toward the observer. The
  // high-frequency structure is attached to the transported density envelope.
  float stagger=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
  vec2 currentNear=suspendedDrift(uv,1.,uAspect,uProgress,uFlowPhase);
  vec2 currentFar=suspendedDrift(uv,0.,uAspect,uProgress,uFlowPhase);
  float flicker=smoothstep(.46,.55,uProgress)*(1.-smoothstep(.71,.84,uProgress));
  vec2 rolling=flicker*vec2(.028*sin(.76*uFlowPhase+uv.y*4.),.023*cos(.59*uFlowPhase+uv.x*5.));
  for(int i=0;i<36;i++){
    float z=(float(i)+.5+.10*stagger)/36.;
    vec3 p=vec3(uv-mix(currentFar,currentNear,z),z);

    vec2 coarse=density(p);
    if(max(coarse.x,coarse.y)<.003)continue;
    vec3 material=vec3(p.x*uAspect,p.y,p.z*.67);
    vec3 v=texture(uNoise,material*.91+vec3(rolling,.023*uBreath)+vec3(0,.044*uProgress,0)).rgb-.5;
    vec3 f=texture(uNoise,material*2.7+v*.81+vec3(0,-.13*uProgress,.027*uBreath)).rgb-.5;
    vec3 warp=v*.104+f*.045;
    vec3 g=texture(uNoise,material*5.5+v*1.24+f*.89).rgb-.5;
    warp+=g*.022;
    vec2 dye=density(p+warp/vec3(uAspect,1,1));
    vec3 fold=texture(uNoise,material*5.1+v*1.45+f*.54).rgb;
    vec4 fine=texture(uNoise,material*8.4+1.8*v+.94*f+.75*g);
    vec3 curl=texture(uNoise,material*12.+2.4*v+1.5*f+1.2*g).rgb;
    float grain=fine.g+.24*(curl.r-.5);
    float cavity=texture(uNoise,material*2.65+1.1*v+.48*f).a;
    float lip=exp(-17.*abs(cavity+.21*fine.a-.61));
    float foldPhase=fold.r+.37*grain+.15*f.y;
    float sheets=.24+1.24*smoothstep(.42,.80,foldPhase)+.72*exp(-28.*abs(foldPhase-.66));
    float carved=smoothstep(.31,.72,cavity+.26*fine.a);
    // A folded lamella catches grazing light along one face and absorbs on
    // the other. Keeping a diffuse fraction gives a veil behind the wet core.
    float pleat=fold.r+.33*fine.b+.17*g.r+.09*sin(17.*f.g+7.*v.b);
    float membrane=exp(-25.*abs(pleat-.70));
    sheets*=.52+.87*smoothstep(.48,.80,pleat)+1.15*membrane;
    float black=dye.x*sheets*(.15+1.4*carved), white=dye.y*sheets*(.25+1.3*carved),total=black+white;
    vec2 light=density(p+vec3(-.026,.036,.092)+warp*.6);
    float transmission=exp(-2.65*(light.x+.56*light.y));
    float edge=clamp((coarse.x+coarse.y-light.x-light.y)*2.8,0.,1.);
    float incidence=clamp(.46+1.7*(fold.r-fine.g)+.62*(curl.b-curl.g),.08,1.);
    vec3 soot=mix(vec3(.011,.012,.019),vec3(.16,.15,.17),transmission*.39+edge*.66);
    vec3 steam=mix(vec3(.17,.19,.22),vec3(.85,.84,.79),transmission);
    vec3 emission=mix(soot,steam,white/max(.0001,total))
              +vec3(.12,.052,.035)*edge*(1.-z*.65)+vec3(.14,.14,.16)*lip*transmission+.10*membrane*edge;
    emission*=.72+.34*incidence;
    float envelope=smoothstep(.003,.10,max(coarse.x,coarse.y));
    float a=1.-exp(-total*.55*envelope);
    vec4 sampleLight=vec4(emission*a,a);
    if(pieceZ>0. && z>pieceZ)front=sampleLight+front*(1.-a);
    else rear=sampleLight+rear*(1.-a);
  }
}`;

// Material sheets are indexed periodic grids. Their thickness and folds travel
// with the mesh. Brightness comes from transmission and the grazing wet rim.
export const INK_SHEET_VERTEX=/* glsl */`#version 300 es
precision highp float;
uniform highp usampler2DArray uMesh;
uniform int uOrder[32],uCols,uRows;
uniform vec4 uVaporFigure[32];
uniform float uKey,uProgress,uBreath,uFlowPhase;
uniform vec2 uSize;
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
 position=vec3(p.xy*vec2(uSize.x/uSize.y,1.),p.z);
 gl_Position=vec4(2.*p.xy-1.,0.,1.);
 amount=data.w;
}`;
export const INK_SHEET_FRAGMENT=/* glsl */`#version 300 es
precision highp float;
uniform sampler2D uFigures,uFigureDepth,uMist,uPigment,uKnightPigment,uFigurePigment;
uniform bool uDepthOnly;
uniform vec2 uSize;uniform float uProgress,uBreath,uFlowPhase;
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
   float phase=seed+uProgress*5.4+.22*uBreath;
   vec2 dyeUV=cloth;
   float envelope=sin(3.14159*v)*sin(3.14159*cloth.x);
   dyeUV.x+=envelope*(.038*sin(v*10.+phase)+.027*sin(v*19.+cloth.x*8.-phase)*layer);
   dyeUV.y+=envelope*(.035*layer*cos(8.*cloth.x+phase)+.023*sin(cloth.x*11.-v*7.+phase));
   // Inverse-map a pair of finite-core vortex rolls into the density study.
   // The dark nose rolls one way; its solvent-rich skirt rises past it on
   // the other side. Sampling material coordinates keeps the narrow stem
   // connected as the sheet folds and opens.
   float free=smoothstep(.43,.555,uProgress)*(1.-smoothstep(.682,.778,uProgress));
   float turn=(uProgress-.505)*34.+seed*.35+.57*uFlowPhase;
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
   float cs=cos(leftRoll),sn=sin(leftRoll);
   dyeUV+=mat2(cs-1.,sn,-sn,cs-1.)*l;
   cs=cos(rightRoll);sn=sin(rightRoll);
   dyeUV+=mat2(cs-1.,sn,-sn,cs-1.)*r;
   if(mod(sourceId,3.)>1.5)dyeUV.x=1.-dyeUV.x;
   float variant=mod(floor(sourceId*.5)+mod(sourceId,2.)+floor(sourceId*.2),4.);
   if(sourceId==10.)variant=2.;
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
   float packet=.5+.5*cos(30.*(uProgress-.50)-7.8*v+seed+.53*uFlowPhase);
   float suspending=free*packet*smoothstep(.16,.52,v);
   float foreground=sourceId<1.5||sourceId==10.||sourceId==23.?1.:0.;
   // Fewer dense axes keep the water between the four foreground plumes clear.
   share=mix(share,mix(share*.53,max(.98,share)*1.18,foreground),free);
   float thick=amount*border*filling*optical*share*column*mix(1.,.57,suspending);
   float lift=free*smoothstep(.36,.88,v)*smoothstep(-.35,.88,cos((uProgress-.622)*69.+sourceId*.86+(v-.78)*5.4));
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
 float twist=(uProgress-.51)*32.+seed+.51*uFlowPhase;
 a+=free*(.71*sin(twist-6.*v)+.32*sin(11.*v-.61*twist));
 v+=free*.032*sin(3.*a+twist-8.*v);
 float whirl=sin(3.*a+seed+9.*v+1.3*sin(a-10.*v));
 a+=.35*sin(7.*v+whirl)+.24*sin(2.*a+5.*v+seed);
 v+=.033*sin(4.*a+seed+v*13.);
 float meander=sin(2.*a+v*9.+seed)+.57*sin(3.*a-v*16.+seed)+.31*cos(6.*a+v*23.);
 float fiber=cos(16.*a+5.9*meander+v*27.+seed);
 float vein=pow(.5+.5*cos(28.*a+6.5*meander+v*41.+2.3*fiber),10.);
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
