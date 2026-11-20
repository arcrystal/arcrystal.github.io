import { DROPS,PRECIPITATION,TANK_GLSL,projectTank,tankCamera } from '../ink-tank.js';

// The same instance attributes supply flight and waves. Record zero is the
// wet edge of the filter. Subdraws use local bounds, even during long falls.
export const INK_DRIP_INSTANCES = new Float32Array([
  ...Array(12).fill(0),
  ...PRECIPITATION.flatMap(s => [s.x,s.z,s.ceiling,s.radius, s.gather,s.detach,s.hit,s.white,
    s.nozzleX,s.nozzleZ,s.seed,s.parent])
]);
const attributes=/* glsl */`
layout(location=0) in vec4 outlet;   // impact XZ, ceiling height, capillary radius
layout(location=1) in vec4 clock;    // wetting, detachment, contact, ivory
layout(location=3) in float vertexNumber;
layout(location=2) in vec4 pore;     // XZ at release, optical seed, parent
vec2 corner(int k){
 k=k%6;
 return vec2(k==1||k==2||k==4?1.:0.,k==2||k==4||k==5?1.:0.);
}
`;
// The free edge lies between real pores. Interpolate their pigments, with
// the larger drops making a slightly heavier local hem. Precompile the 1D
// interval lookup to five decisions; there is no per-pixel search for drops.
const filterPores=DROPS.map(s=>({
  x:projectTank(s.nozzleX,-s.ceiling,s.nozzleZ,tankCamera(0),1)[0],
  pigment:(s.white?1:-1)*s.radius
})).sort((a,b)=>a.x-b.x);
filterPores.unshift({...filterPores[0],x:-.1});
filterPores.push({...filterPores.at(-1),x:1.1});
function filterIntervals(first,last){
  if(first===last){
    const a=filterPores[first],b=filterPores[first+1];
    return 'return vec4('+[a.x,b.x,a.pigment,b.pigment].map(x=>x.toFixed(6)).join(',')+');';
  }
  const split=Math.ceil((first+last)/2);
  return 'if(x<'+filterPores[split].x.toFixed(6)+'){'+filterIntervals(first,split-1)+'}else{'+filterIntervals(split,last)+'}';
}
const filter=/* glsl */`
// A common lower contact line joins every pore to the same sheet of paint.
// The film retreats up the glass as the camera goes under the free surface.
vec4 poreSpan(float x){${filterIntervals(0,filterPores.length-2)}}
float filletDepth(float x,float P,vec4 pores){
 float b=sin(15.8*x+1.2*sin(5.6*x)+P*2.);
 float meander=.42*b+.29*sin(36.8*x+.9*b-P*4.)+.14*sin(63.*x+1.4*b+P*7.);
 vec2 dist=(vec2(x)-pores.xy)/(.004+.85*abs(pores.zw));
 vec2 loads=abs(pores.zw)*exp(-dist*dist);
 float extra=mix(loads.x,loads.y,smoothstep(pores.x,pores.y,x));
 return smoothstep(0.,.049,P)*(.025+.012*meander+.58*extra)*(1.-smoothstep(.39,.468,P));
}
float filterEdge(float x,float P){return 1.-filletDepth(x,P,poreSpan(x))+.115*smoothstep(.405,.516,P);}
`;
export const INK_IMPACT_VERTEX=/* glsl */`#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uProgress;
${attributes}
${TANK_GLSL}
${filter}
out vec2 p;
flat out vec4 life,material;
flat out vec2 axis;
flat out int part;
void main(){
 float P=uProgress;
 vec2 scale=uSize/min(uSize.x,uSize.y),uv=corner(int(vertexNumber));
 int draw=int(vertexNumber)/6;
 part=draw+1;
 life=vec4(0);material=vec4(0);axis=vec2(0,-1);p=vec2(0);
 gl_Position=vec4(-2,-2,0,1);
 if(gl_InstanceID==0){
   if(draw!=0 || P>=.525)return;
   part=0;p=vec2(uv.x,mix(.934,1.,uv.y));
   material=vec4(P,uSize.y,scale.x,scale.y);
   gl_Position=vec4(2.*p-1.,0,1);return;
 }
 float dt=clock.z-clock.y,age=P-clock.y;
 if(P<=clock.x || P>=clock.z+.067)return;
 float f=clamp(age/dt,0.,1.),past=P-clock.z,aspect=uSize.x/uSize.y;
 float fed=smoothstep(clock.x,clock.y,P);
 vec4 cam=waterCamera(P);
 vec2 nozzle=tankPoint(vec3(pore.x,-outlet.z,pore.y),cam,aspect).xy;
 vec2 root=vec2(nozzle.x,filterEdge(nozzle.x,P)+.0045);
 vec2 contact=tankPoint(vec3(outlet.x,0.,outlet.y),cam,aspect).xy;
 // Pinch direction follows the oblique image of the tank's gravity vector.
 axis=normalize(vec2(clamp((contact.x-root.x)*scale.x*.7,-.18,.18),-1.));
 // The neck grows under load, then thins quickly. Airborne pigment keeps its
 // release velocity and relaxes toward a sphere with a damped capillary mode.
 float reach=.22+2.56*fed;
 vec3 falling=vec3(mix(pore.x,outlet.x,f),-outlet.z*(1.-f*f),mix(pore.y,outlet.y,f*f));
 vec2 air=tankPoint(falling,cam,aspect).xy+(1.-f*f)*(root-nozzle+axis*reach*outlet.w/scale);
 vec2 pivot=vec2(0),lo=vec2(-1),hi=vec2(1);
 life=vec4(fed,age,f,past);
 material=vec4(clock.w,outlet.w*min(uSize.x,uSize.y),pore.z,outlet.w);
 if(draw==0){
   if(age>=.030)return;
   pivot=root;
   lo=vec2(-2.9,-5.);hi=vec2(2.9,3.25);
 }else if(draw==1){
   if(age<0. || past>=.009)return;
   pivot=air;
   lo=vec2(-1.47,-1.73);hi=-lo;
 }else{
   if(f<.60 || past>=.067)return;
   // Mirror the approaching drop about the contact plane. The contact
   // dimple, crown and submerged wake inherit exactly the same point.
   pivot=contact;
   lo=vec2(-3.5,-3.95);hi=vec2(3.5,2.9);
 }
 p=mix(lo,hi,uv);
 gl_Position=vec4(2.*(pivot+p*outlet.w/scale)-1.,0.,1.);
}`;
export const INK_IMPACT_FRAGMENT=/* glsl */`#version 300 es
precision highp float;
in vec2 p;
flat in vec4 life,material;
flat in vec2 axis;
flat in int part;
uniform vec2 uSize;
uniform float uProgress;
uniform sampler2D uBathRoom;
out vec4 o;
${filter}
const vec3 blackPaint=vec3(.023,.014,.021),ivoryPaint=vec3(.85,.827,.759);
float unite(float a,float b,float k){
 float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;
}
vec3 lacquer(vec3 n,float white,float seed){
 vec3 r=reflect(vec3(0,0,-1),n);
 float grazing=pow(1.-max(n.z,0.),4.);
 vec2 L=(r.xy-vec2(-.43,.59))*vec2(3.3,6.4);
 float sky=exp(-dot(L,L));
 // A long softbox wraps one shoulder. Its smaller reflection stays on the
 // far return of the belly, separated from the brighter shoulder.
 float stroke=r.x+.56+.16*r.y*r.y-.025*r.y;
 float reflection=exp(-stroke*stroke*108.)*smoothstep(-.18,.22,r.y)*(1.-smoothstep(.68,.96,r.y));
 float strip=exp(-pow((r.y+.32+.18*r.x)*14.,2.))*smoothstep(.38,.79,r.x);
 vec3 body=mix(blackPaint,ivoryPaint*(.58+.23*n.y+.17*n.z),white);
 body+=vec3(.30,.058,.036)*(.12+.88*grazing)*(.50+.50*r.x);
 vec2 roomUV=vec2(.5+.37*atan(r.x,max(.13,r.z))+(gl_FragCoord.x/uSize.x-.5)*.17,.54-.40*r.y);
 vec3 room=textureLod(uBathRoom,clamp(roomUV,vec2(.004),vec2(.996)),1.7).rgb;
 float grazingRoom=.065+.35*pow(1.-max(0.,n.z),2.)+.08*sky;
 body+=room*(.53+.47*room)*grazingRoom*(1.-.30*white);
 return body+vec3(.81,.78,.71)*(.50*sky+.53*reflection+.27*strip)+grazing*vec3(.24,.15,.14);
}
vec4 wetLip(vec2 uv){
 float P=material.x,x=uv.x,y=uv.y;
 vec4 pores=poreSpan(x);
 float thick=filletDepth(x,P,pores),edge=1.-thick+.115*smoothstep(.405,.516,P);
 float h=(y-edge)/max(.0003,thick);
 float aa=1./material.y;
 float coverage=smoothstep(-aa,aa,y-edge)*smoothstep(.0,.013,P)*(1.-smoothstep(.416,.50,P));
 if(coverage<=.002)discard;
 // Black and ivory run through the same continuous sheet. Laminae bend
 // toward local drainage, with a thin grazing highlight on the wet hem.
 float bend=sin(13.4*x+.76*sin(6.8*x)-P*2.7);
 float grain=sin(38.*x+1.15*bend+.22*h);
 float u=clamp((x-pores.x)/max(.0001,pores.y-pores.x),0.,1.);
 float t=u+sin(3.14159*u)*(.095*sin(3.*h+bend+P*3.)+.054*grain+.05*h);
 float shape=smoothstep(.24,.77,t);
 float ivory=mix(step(0.,pores.z),step(0.,pores.w),shape);
 float ribbons=exp(-15.*abs(t-.44-.10*sin(3.4*h+bend)))+.46*exp(-19.*abs(t-.65+.07*sin(4.5*h+grain)));
 ivory=mix(ivory,1.-ivory,.24*ribbons*sin(3.14159*u));
 float curved=clamp(h/.65,0.,1.);
 vec3 n=normalize(vec3(.20*cos(28.*x+grain),-(1.-curved)*(1.-curved),.17+curved));
 vec3 col=lacquer(n,ivory,0.);
 float clearLip=exp(-abs(y-edge-.0018)*material.y*.68);
 float crease=exp(-abs(h-.36-.12*bend)*15.);
 col+=vec3(.35,.29,.25)*clearLip*(.39+.61*max(.0,grain));
 col*=1.-.18*crease;
 col*=1.-.30*smoothstep(.60,1.26,h);
 return vec4(col*coverage,coverage);
}
void main(){
 if(part==0){o=wetLip(p);return;}
 float white=material.x,rad=material.y,seed=material.z;
 float fed=life.x,age=life.y,f=life.z,past=life.w;
 float aa=clamp(.78/rad,.012,.55),alpha=0.;
 vec3 col=vec3(0);
 if(part==3){
   // Before impact the reflected silhouette and its glint tighten under the
   // approaching belly. After crossing, a raised wet collar falls back.
   float pre=smoothstep(.59,.98,f)*(1.-smoothstep(-.004,.007,past));
   vec2 echo=(p+vec2(.25*(1.-f),.22+2.48*(1.-f)))/vec2(.93,.42);
   float mirror=(1.-smoothstep(.36,1.52,dot(echo,echo)))*pre*.37;
   float t=clamp(past/.032,0.,1.),slip=smoothstep(-.002,.003,past);
   float crownR=.50+2.5*t;
   vec2 rim=vec2(p.x,p.y/.42);
   float theta=atan(rim.y,rim.x+.00001);
   float fingers=pow(.5+.5*cos(7.*theta+1.2*sin(2.*theta)+seed),3.);
   float rimD=abs(length(rim)-crownR-.11*fingers*(1.-t));
   float lip=exp(-rimD*rimD/max(aa*aa,.034))*slip*(1.-smoothstep(.30,1.,t));
   float eject=sin(3.14159*t);
   float tooth=exp(-pow((length(vec2(p.x,(p.y-.46*fingers*eject)/.42))-crownR)/(.14+aa),2.))
      *fingers*eject*slip;
   float hollow=exp(-dot(rim,rim)/(.34+2.1*t))*slip*(1.-t);
   // A tiny falling head can be seen through the dimple before the pigment
   // enters the worker's underwater volume. Keep this glimpse subordinate.
   float wetAge=clamp(past/.065,0.,1.);
   vec2 under=(p-vec2(.09*sin(wetAge*4.+seed)*wetAge,-.25-2.25*wetAge))/vec2(.36+.48*wetAge,.40+.74*wetAge);
   float below=exp(-dot(under,under)*1.5)*slip*(1.-smoothstep(.14,1.,wetAge))*.21;
   col=mix(vec3(.048,.021,.025),vec3(.65,.56,.51),white);
   alpha=mirror+.32*hollow+below;
   vec3 light=vec3(.81,.72,.64)*(.56+.44*max(0.,-rim.x/max(.0001,length(rim))));
   float shine=clamp(.57*lip+.40*tooth,0.,.87);
   o=vec4(col*alpha*(1.-shine)+light*shine,alpha*(1.-shine)+shine);
   if(o.a<.002)discard;
   return;
 }
 vec2 lateral=vec2(-axis.y,axis.x);
 vec2 q=vec2(dot(p,lateral),dot(p,axis));
 float radius=pow(max(.00001,fed),1./3.);
 float d=5.,bulb=5.;
 vec2 b=vec2(0);float roundness=1.;
 if(part==1){
   float retract=smoothstep(0.,.021,age);
   float reach=mix(.22+2.56*fed,.20,retract);
   float height=clamp(q.y/reach,0.,1.);
   // A viscous thread tapers roughly linearly in the last interval of its
   // life. After separation the upper remnant springs back into the film.
   float pinch=clamp(-age/.016,0.,1.);
   float throat=(.32*pow(2.*abs(height-.57),1.55)+.26*pinch+.012)*radius*(1.-.70*retract);
   vec2 neck=vec2(q.x,q.y-clamp(q.y,-.42,reach));
   float filament=length(neck)-throat;
   // The feed spreads upstream into the film. Its wet shoulders taper
   // continuously into the neck and retain a little paint after release.
   float above=max(0.,-q.y),bend=.17*sin(above*1.9+seed)*above;
   float spread=((.18+.91*exp(-max(0.,q.y+.15)*2.8))*(.25+.75*radius)+.39*above)*(1.-.20*retract);
   float feed=max(abs(q.x-bend)-spread,q.y-1.02*radius);
   d=unite(filament,feed,.24);
   if(age<0.){
     roundness=1.+(.25+7.2*material.w)*fed;
     b=vec2(q.x*sqrt(roundness),(q.y-reach)/roundness);
     // The upper shoulder stretches while the lower hemisphere stays round.
     b.x*=1.+.22*max(0.,-b.y);
     bulb=length(b)-radius;
     d=unite(d,bulb,.12+.06*pinch);
   }
 }else{
   // Viscous-capillary relaxation time scales with radius. Bigger beads
   // retain a long shoulder during their fall; small pearls recover early.
   float stretch=.25+7.2*material.w;
   float relax=exp(-f*(.056/(.007+material.w)));
   roundness=1.+stretch*relax*(.66+.34*cos(3.4*f))+.069*sin(3.14159*f);
   b=vec2(q.x*sqrt(roundness),q.y/roundness);
   b.x*=1.+.22*max(0.,-b.y)*relax;
   bulb=length(b)-1.;d=bulb;
 }
 alpha=1.-smoothstep(-aa,aa,d);
 if(part==2)alpha*=1.-smoothstep(-.001,.007,past);
 if(alpha<.002)discard;
 vec2 edgeNormal=normalize(vec2(dFdx(d),dFdy(d))+vec2(.00001));
 float slope=exp(-max(0.,-d)*2.25);
 vec3 n=normalize(vec3(edgeNormal*slope,sqrt(max(.001,1.-slope*slope))));
 if(bulb<d+.012){
   vec2 face=(b.x*lateral+b.y*axis)/max(.001,radius);
   n=normalize(vec3(face,sqrt(max(.001,1.-dot(face,face)))));
 }
 if(part==1){
   vec2 screen=gl_FragCoord.xy/uSize;
   float above=(screen.y-filterEdge(screen.x,uProgress))*uSize.y/rad;
   // Inside the common wet rim, the pore's own pigment fans gradually
   // through the laminae instead of forming a circular collar.
   float shoulder=smoothstep(-.35,.75,above);
   vec3 sheet=normalize(vec3(.13*sin(q.x*2.+seed),-.80,.34+.3*max(0.,above)));
   n=normalize(mix(n,sheet,shoulder*.81));
   alpha*=(1.-smoothstep(-.06,2.54,above))*smoothstep(0.,.065,fed)*(1.-smoothstep(.016,.030,age));
   if(alpha<.002)discard;
 }
 col=lacquer(n,white,seed);
 o=vec4(col*alpha,alpha);
}`;

export const INK_RIPPLE_VERTEX=/* glsl */`#version 300 es
precision highp float;
uniform vec2 uSize;uniform float uProgress;
${TANK_GLSL}
${attributes}
out vec2 plane;
flat out vec3 wave;
void main(){
 vec4 cam=waterCamera(uProgress);
 float age=uProgress-clock.z,extent=.016+1.64*max(0.,age);
 plane=(corner(int(vertexNumber))*2.-1.)*extent;
 float aspect=uSize.x/uSize.y;
 float z=outlet.y+.66*plane.y,w=tankW(z,cam);
 vec2 pt=tankPoint(vec3(outlet.x+plane.x/aspect,0.,z),cam,aspect).xy;
 // Retain clip W so interpolated wave coordinates lie on the water plane.
 gl_Position=vec4((2.*pt-1.)*w,0.,w);wave=vec3(age,outlet.w,pore.z);
 if(gl_InstanceID==0 || age<0. || age>.245)gl_Position=vec4(-2,-2,0,1);
}`;
export const INK_RIPPLE_FRAGMENT=/* glsl */`#version 300 es
precision highp float;
in vec2 plane;flat in vec3 wave;out vec4 o;
void main(){
 float r=length(plane),age=wave.x,signal=0.;
 // At these short wavelengths, capillary and gravity waves separate after the
 // same impulse. The diminishing circular packets refract whatever is below.
 for(int j=0;j<3;j++){
   float k=110.+float(j)*61.,g=75.,cap=.0017;
   float omega=sqrt(g*k+cap*k*k*k),cg=(g+3.*cap*k*k)/(2.*omega);
   float sigma=.013+.084*age,front=(r-cg*age)/sigma;
   signal+=exp(-.5*front*front)*cos(k*r-omega*age)*(.41-.083*float(j));
 }
 signal*=.75*sqrt(wave.y/(wave.y+r))*exp(-11.*age)*smoothstep(0.,.004,age)*(1.-smoothstep(.18,.245,age));
 vec2 grad=plane/max(.0001,r)*signal;
 o=vec4(max(grad.x,0.),max(-grad.x,0.),max(grad.y,0.),max(-grad.y,0.));
}`;
