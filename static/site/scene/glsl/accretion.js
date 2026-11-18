import { ACCRETION_GEOMETRY } from '../track-plan.js';
import { OPTICS_GLSL } from '../accretion-optics.js';
export const ACCRETION_COMMON=ACCRETION_GEOMETRY+/* glsl */`
uniform float uOrbitSeconds;
vec4 acData(int i){return texelFetch(uReach,ivec2(i%1024,i/1024),0);}
`+OPTICS_GLSL+/* glsl */`
float acLensStrength(float P){return smoothstep(.55,.62,P)*(1.0-trEase((P-1.0)/.065));}
float acPostTime(float P,float duration){
 float x=max(0.0,P-.86),d=.10,u=min(x/d,1.0);
 // Integral of a smooth velocity change: no phase or tangent reset at the burp.
 float integral=d*(u-u*u*u+.5*u*u*u*u);
 return duration/.30*integral+900.0*(x-integral);
}
float acHeat=0.0,acShift=1.0;
vec4 acOrbit(int k,float P){
 vec4 h=acData(23),m=acData(int(h.x)+k*2),end=acData(int(h.x)+k*2+1);
 if(P>=.86){float t=acPostTime(P,h.y);acHeat=m.z*exp(-t/12.0);return vec4(end.x+end.z*t*exp(-t/12.0),end.y+end.w*t,0.0,end.w);}
 float t=clamp((P-.56)/.30,0.0,1.0)*h.y;
 int bin=min(63,int(t/h.y*64.0));vec4 b=acData(int(m.x)+bin);int lo=0,hi=int(b.y)-1;
 for(int j=0;j<8;j++){if(lo>=hi)break;int mid=(lo+hi)/2;if(t>acData(int(b.x)+mid*3).y)lo=mid+1;else hi=mid;}
 int at=int(b.x)+lo*3;vec4 a=acData(at),c=acData(at+1),d=acData(at+2);
 float dt=max(a.y-a.x,.00001),u=clamp((t-a.x)/dt,0.0,1.0),v=1.0-u;
 vec2 p=(1.0+2.0*u)*v*v*a.zw+u*v*v*dt*c.xy+u*u*(3.0-2.0*u)*c.zw-u*u*v*dt*d.xy;
 vec2 speed=6.0*u*v*(c.zw-a.zw)/dt+(1.0-4.0*u+3.0*u*u)*c.xy+(3.0*u*u-2.0*u)*d.xy;
 acHeat=mix(d.z,d.w,u);return vec4(p,speed);
}
vec2 acPosition(int k,float P,bool secondary){
 vec4 h=acData(23),m=acData(int(h.x)+k*2);vec3 frame=acFrame(acData(0).xy,acData(19),P);
 if(m.z<0.0){
  float u=clamp((P-.502)/.08,0.0,.999999),at=u*(m.y-1.0);int i=int(at);
  vec2 p=mix(acData(int(m.x)+i).yz,acData(int(m.x)+i+1).yz,fract(at));
  p*=1.0-trEase((P-.55)/.032);return acWorld(p/24.0,frame,P);
 }
 vec4 orbit=acOrbit(k,P);float r=orbit.x,phi=orbit.y;
 // A display clock carries the collected material around even while scroll rests.
 // It changes phase only: capture, mass, heating and the two events still use the bake.
 float drift=trEase((P-max(.72,m.w+.04))/.14);
 float spin=clamp(abs(acData(int(h.x)+k*2+1).w)*12.0,.32,.72);
 phi-=uOrbitSeconds*spin*drift;
 float beta=min(.65,sqrt(max(r,1.85))/(max(r-1.0,.85)*1.41421356));
 acShift=sqrt(max(0.0,1.0-1.0/max(r,1.01)))*sqrt(1.0-beta*beta)/(1.0+beta*.93969262*cos(phi));
 float phase=(-phi-1.57079632679)/6.28318530718,q=(m.y+.5)/8.0;
 vec2 plane=r*vec2(cos(phi),sin(phi));
 float organize=trEase((P-.86)/.08);
 vec2 local=mix(plane/24.0,acCapsule(phase,q,P),organize);
 float lens=acLensStrength(P)*smoothstep(m.w,m.w+.025,P);
 vec2 projected=local*vec2(1.0,acSquash(P));
 // The table describes the initial 70° view. Carry only its optical displacement
 // into the lifting camera so a vanishing lens leaves the exact painted lane.
 if(lens>.00001)projected+=acLens(local*24.0,lens,secondary)/24.0-local*vec2(1.0,.34202014);
 return frame.xy+trRotate(projected)*frame.z;
}
`;
export const ACCRETION_SURFACE=ACCRETION_COMMON+/* glsl */`
vec3 acEmission(vec2 source,float P,float secondary){
 float r=length(source),phi=atan(source.y,source.x),edge=smoothstep(3.3,3.7,r)*(1.0-smoothstep(11.8,12.7,r));
 float phase=phi+(P*26.0+uOrbitSeconds*.48*trEase((P-.72)/.14))/pow(max(r/6.0,.6),1.5);
 float filaments=.55+.25*sin(r*25.0+phase*3.0)+.2*sin(r*52.0-phase*7.0);
 float vk=sqrt(r)/max(r-1.0,1.0),beta=min(.65,vk/1.41421356),doppler=sqrt(1.0-beta*beta)/(1.0+beta*.9396926*cos(phi));
 float shift=sqrt(max(0.0,1.0-1.0/max(r,1.01)))*doppler;
 vec3 hot=mix(vec3(.6,.13,.035),vec3(1.0,.77,.43),clamp((shift-.6)*1.3,0.0,1.0));
 float light=edge*(.12+.14*filaments)*pow(shift,2.4)*mix(1.0,.50,secondary);
 return hot*light;
}
vec3 acLaneLight(vec2 source,float P){
 float r=length(source),radial=(r-3.6)/1.05,j=floor(radial+.5),line=3.6+j*1.05;
 float birth=.86+.07*(line-3.35)/(13.6-3.35),written=smoothstep(birth-.001,birth+.004,P);
 float width=max(24.0/acFrame(acData(0).xy,acData(19),P).z,.015),mark=(1.0-smoothstep(.014,.014+width,abs(r-line)))*step(3.57,r)*step(r,12.03)*written;
 float wave=mix(3.35,13.6,clamp((P-.86)/.07,0.0,1.0));
 float pulse=exp(-pow((r-wave)/.25,2.0))*smoothstep(.858,.866,P)*(1.0-smoothstep(.925,.94,P));
 return vec3(.90,.84,.72)*mark*.62+vec3(.8,.45,.20)*pulse*.48;
}
vec3 acSurface(vec3 col,vec2 screen,float P){
 if(P<.50)return col;
 vec3 baseCol=col;
 if(P>=1.14)return trSurface(col,screen,trFrame(acData(0).xy,acData(19),1.2),1.0,1.0,0.0,T);
 vec3 frame=acFrame(acData(0).xy,acData(19),P);vec2 d=screen-frame.xy;
 vec2 image=vec2(dot(d,trRotate(vec2(1,0))),dot(d,trRotate(vec2(0,1))))/frame.z*24.0;

 float lens=acLensStrength(P),formed=smoothstep(.535,.585,P),morph=acMorph(P),solid=trEase((P-.96)/.075);
 vec2 p=acLocal(screen,frame,P);float a=TR_A*morph,r=length(vec2(max(abs(p.x)-a,0.0),p.y)),aa=max(fwidth(r),.0005);
 if(abs(image.x)>16.0||abs(image.y)>10.0)return col;
 float inner=acRadius(0.0,P),outer=acRadius(1.0,P),band=smoothstep(inner-aa,inner+aa,r)*(1.0-smoothstep(outer-aa,outer+aa,r));
 float q=(r-inner)/(outer-inner),radial=clamp(q,0.0,1.0)*8.0;
 // Primary and first secondary image from the same geodesic tables used by the shards.
 float b=length(image),psi=atan(.34202014,.93969262*image.y/max(b,.0001));
 if(lens>.001){
 vec2 skyUV=vec2(screen.x/acData(0).x,1.0-screen.y/acData(0).y);
 vec2 bend=trRotate(image/max(b,.001))*sin(acDeflection(b))*.08*lens;
 vec3 bentSky=textureLod(uTexA,clamp(skyUV+vec2(bend.x,-bend.y),.001,.999),0.0).rgb;
 col+=max(bentSky-.5,0.0)*.025*lens*smoothstep(.65,.75,P);
 }
 vec3 glow=vec3(0.0),lensPaint=vec3(0.0);
 if(lens>.001)for(int j=0;j<2;j++){
  float angle=psi+float(j)*3.14159265359,u=acRay(b,angle);
  if(u>.001){float rr=1.0/u;vec2 source=rr*vec2(sin(angle)*image.x/max(b,.001),cos(angle)*.93969262+sin(angle)*image.y/max(b,.001)*.34202014);
   glow+=acEmission(source,P,float(j));if(P>.855)lensPaint+=acLaneLight(source,P)*mix(1.0,.45,float(j));}
 }
 vec3 plain=acEmission(p*24.0,P,0.0);
 col+=mix(plain,glow,lens)*smoothstep(.57,.78,P)*(1.0-smoothstep(.985,1.035,P));
 // A small knot becomes the shadow; no outburst originates inside this silhouette.
 float pupil=mix(2.5980762,.35,trEase((P-.94)/.03))*formed*(1.0-trEase((P-1.0)/.09));
 float shadow=(1.0-smoothstep(pupil-.035,pupil+.035,b))*formed;
 float ring=exp(-pow((b-pupil-.10)/.085,2.0))*formed*(1.0-solid);
 col=mix(col,vec3(.001,.002,.004),shadow*.995);
 col+=vec3(1.0,.63,.27)*ring*.45;
 float knot=exp(-b*b/1.1)*sin(clamp((P-.50)/.08,0.0,1.0)*3.14159265);col+=vec3(.55,.86,1.0)*knot*.55;
 // One pulse writes each of the nine boundaries as it passes, never nine unrelated flashes.
 float wave1=mix(3.35,13.6,clamp((P-.86)/.07,0.0,1.0)),lineIndex=floor(radial+.5),lineR=mix(inner,outer,lineIndex/8.0);
 float lineDist=abs(r-lineR),lineBirth=.86+.07*((3.6+lineIndex*8.4/8.0)-3.35)/(13.6-3.35);
 float written=smoothstep(lineBirth-.001,lineBirth+.004,P);
 float paint=(1.0-smoothstep(.00065,.00065+aa,lineDist))*step(inner-aa,r)*step(r,outer+aa);
 float pulse=exp(-pow((r*24.0-wave1)/.28,2.0))*smoothstep(.858,.866,P)*(1.0-smoothstep(.925,.94,P));
 col+=vec3(.80,.50,.25)*pulse*.45*(1.0-lens);
 col+=lensPaint*lens;
 float lane=floor(clamp(q,0.0,.9999)*8.0),grain=(noise(p*frame.z*.7)-.5)*.035;
 vec3 rubber=mix(vec3(.62,.285,.225),vec3(.72,.365,.285),.5+.5*sin(lane*2.1))+grain+vec3(.025)*p.y;
 col=mix(col,rubber,band*solid);
 col=mix(col,vec3(.95,.93,.875),paint*written*mix(.48,.88,solid)*(1.0-lens));
 // The emerald membrane is a foreground material, not matter escaping the hole.
 float wave2=3.6*clamp((P-.94)/.06,0.0,1.0),ir=r*24.0;
 float membrane=(1.0-smoothstep(wave2-.15,wave2+.15,ir))*smoothstep(.938,.95,P)*(1.0-smoothstep(inner-aa,inner+aa,r));
 float pupilOpen=1.0-shadow*(1.0-smoothstep(1.0,1.08,P));membrane*=pupilOpen;
 vec3 grass=vec3(.245,.335,.275)+(noise(p*frame.z*.12)-.5)*.025+vec3(.01,.015,.009)*(.5+.5*sin(p.x*75.0));
 float greenFill=max(membrane,solid*(1.0-smoothstep(inner-aa,inner+aa,r)));
 float interference=(1.0+.16*cos(ir*8.0+2.0*atan(p.y,p.x)-P*55.0))*exp(-pow((ir-wave2)/.5,2.0));
 col=mix(col,grass,greenFill*mix(.62,1.0,solid));col+=vec3(.04,.48,.24)*interference*membrane*(1.0-solid)*.22;
 // The light moving through the lanes outlives the individual melting fragments.
 col+=trFlow(p,a,inner,(outer-inner)/8.0,frame.z,T)*trEase((P-1.015)/.085);
 // The last 10% uses the resting renderer exactly, including grain, finish line and glints.
 if(P>1.12){vec3 finalCol=trSurface(baseCol,screen,frame,1.0,1.0,0.0,T);col=mix(col,finalCol,smoothstep(1.12,1.14,P));}
 return col;
}
`;
