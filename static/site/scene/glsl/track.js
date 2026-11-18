// The same surface is revealed by the finale and drawn in the resting tile. Display-space colour.
export const TRACK_SURFACE = /* glsl */ `
float trShapePhase(vec2 p,float a,float r) {
 float s;
 if(p.x>a)s=4.0*a+3.14159265359*r+(1.57079632679-atan(p.y,p.x-a))*r;
 else if(p.x<-a){float th=atan(p.y,p.x+a);if(th>0.0)th-=6.28318530718;s=2.0*a+(-1.57079632679-th)*r;}
 else s=p.y<0.0?a-p.x:3.0*a+3.14159265359*r+p.x;
 return fract(s/(4.0*a+6.28318530718*r));
}
vec3 trFlow(vec2 p,float a,float inner,float laneWidth,float scale,float clock) {
 if(clock<0.0)return vec3(0.0);
 float r=length(vec2(max(abs(p.x)-a,0.0),p.y));
 if(r<inner||r>inner+8.0*laneWidth)return vec3(0.0);
 float at=trShapePhase(p,a,r);vec3 light=vec3(0.0);
 // Three slender comets: ivory leading facets, amber cores, subordinate red wakes.
 for(int i=0;i<3;i++){
   float lane=1.0+floor(float(i)*2.5),phase=clock*(.055+float(i)*.006)+float(i)*.317;
   float behind=fract(phase-at),delta=min(behind,1.0-behind);
   float radial=(r-inner-(lane+.5)*laneWidth)*scale;
   float stripe=exp(-radial*radial/2.4),head=exp(-pow(delta/.0035,2.0));
   float wake=exp(-behind/.025)*(1.0-smoothstep(.07,.10,behind));
   light+=stripe*(vec3(.8,.64,.38)*head+vec3(.24,.065,.028)*wake);
 }
 return light;
}
vec3 trSurface(vec3 col,vec2 q,vec3 frame,float appear,float solid,float energy,float clock) {
 if(appear<=0.0)return col;
 vec2 p=trLocal(q,frame);
 float r=trRadius(p),aa=max(fwidth(r),.0004),edge=r-.25;
 if(abs(p.x)>.54||abs(p.y)>.29)return col;
 float outer=1.0-smoothstep(-aa,aa,edge),inside=1.0-smoothstep(TR_IN-aa,TR_IN+aa,r);
 float band=outer*(1.0-inside);
 float lane=clamp(floor((r-TR_IN)/TR_LANE),0.0,7.0);
 float grain=(noise(p*frame.z*.7)-.5)*.035;
 vec3 rubber=mix(vec3(.62,.285,.225),vec3(.72,.365,.285),.5+.5*sin(lane*2.1));
 rubber+=grain+vec3(.025)*p.y;
 vec3 grass=vec3(.245,.335,.275)+(noise(p*frame.z*.12)-.5)*.025;
 float mowing=.5+.5*sin(p.x*75.0);grass+=vec3(.01,.015,.009)*mowing;
 vec3 surface=mix(rubber,grass,inside);
 float body=appear*mix(.07,1.0,solid)*outer;
 col=mix(col,surface,body);
 // A delicate ground shadow, never a rectangular plate.
 col*=1.0-appear*solid*.16*exp(-max(edge,0.0)*frame.z/5.0)*(1.0-outer);
 float radial=(r-TR_IN)/TR_LANE;
 float d=abs(radial-floor(radial+.5))*TR_LANE;
 float paint=(1.0-smoothstep(.0006,.0006+aa,d))*step(TR_IN-aa,r)*step(r,.25+aa);
 float finish=(1.0-smoothstep(.0016,.0016+aa,abs(p.x-.11)))*step(p.y,0.0)*band;
 paint=max(paint,finish*solid);
 col=mix(col,vec3(.95,.93,.875),paint*appear*mix(.28,.88,solid));
 float halo=exp(-d*frame.z/1.6)*band;
 col+=vec3(.22,.075,.045)*halo*energy*appear;
 if(solid>.99)col+=trFlow(p,TR_A,TR_IN,TR_LANE,frame.z,clock)*appear;
 return col;
}
`;
