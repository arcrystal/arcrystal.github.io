// Schwarzschild null geodesics in the ray plane: u'' + u = 3u²/2, u=r_s/r.
// Observer at infinity: u(0)=0, u'(0)=1/b. Tables are shared by surface, shards and ribbons.
export const OPTICS=Object.freeze({ impact:384, angle:384, maxB:18, forwardR:96, forwardAngle:128, minR:1.86,maxR:100,shadow:Math.sqrt(27)/2 });
const TAU=2*Math.PI;
export const impactAt = x => {const u=x/(OPTICS.impact-1);return u<.08?2.3*u/.08:u<.65?2.3+(u-.08)*1.1/.57:3.4+(u-.65)*14.6/.35;};
export const impactIndex = b => (b<2.3?b/2.3*.08:b<3.4?.08+(b-2.3)/1.1*.57:.65+(b-3.4)/14.6*.35)*(OPTICS.impact-1);
export function rayStep(u,v,h){
 const f=x=>-x+1.5*x*x,a=v,b=f(u),c=v+h*b/2,d=f(u+h*a/2),e=v+h*d/2,g=f(u+h*c/2),j=v+h*g,k=f(u+h*e);
 return [u+h*(a+2*c+2*e+j)/6,v+h*(b+2*d+2*g+k)/6];
}
export function referenceRay(b,angle,dt=.001){
 let u=0,v=1/b;const n=Math.ceil(angle/dt),h=angle/n;
 for(let i=0;i<n;i++){[u,v]=rayStep(u,v,h);if(u>=1||u<0)return -1;}return u;
}
let cached;
export function makeOptics(){
 if(cached)return cached;
 const O=OPTICS,ray=new Float32Array(O.impact*O.angle),dA=TAU/(O.angle-1),deflection=new Float32Array(O.impact).fill(-1);
 for(let x=0;x<O.impact;x++){
  const b=impactAt(x);let u=0,v=1/Math.max(b,.001),dead=false;
  for(let y=0;y<O.angle;y++){
   ray[y*O.impact+x]=dead?-1:u;
   for(let k=0;k<8&&!dead;k++){const before=u;[u,v]=rayStep(u,v,dA/8);if(u<0)deflection[x]=y*dA+(k+1)*dA/8-u/(u-before)*dA/8-Math.PI;if(u>=1||u<0)dead=true;}
  }
 }
 const sample=(b,angle)=>{
  const x=Math.max(0,Math.min(O.impact-1.001,impactIndex(b))),y=Math.max(0,Math.min(O.angle-1.001,angle/TAU*(O.angle-1))),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const a=ray[iy*O.impact+ix],b0=ray[iy*O.impact+ix+1],c=ray[(iy+1)*O.impact+ix],d=ray[(iy+1)*O.impact+ix+1];
  if(Math.min(a,b0,c,d)<0)return -1;return (a*(1-fx)+b0*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
 };
 const forward=new Float32Array(O.forwardR*O.forwardAngle*2);
 for(let y=0;y<O.forwardAngle;y++){
  const psi=.001+(Math.PI-.002)*y/(O.forwardAngle-1);
  for(let x=0;x<O.forwardR;x++){
   const r=O.minR*(O.maxR/O.minR)**(x/(O.forwardR-1)),target=1/r;
   for(let image=0;image<2;image++){
    const angle=image?TAU-psi:psi;let found=0;
    // Find the outermost ray connecting this emitter and the observer, then refine in its cell.
    let last=-1;
    for(let j=1;j<O.impact;j++){
     const b=impactAt(j),u=sample(b,angle);
     if(u>=0&&last>=0&&(u-target)*(last-target)<=0){let lo=impactAt(j-1),hi=b;
      for(let k=0;k<18;k++){const m=(lo+hi)/2,v=sample(m,angle);if((v-target)*(last-target)>0)lo=m;else hi=m;}found=(lo+hi)/2;}
     last=u;
    }
    forward[(y*O.forwardR+x)*2+image]=found|| (image?O.shadow:r*Math.sin(psi));
   }
  }
 }
 return cached={ray,forward,sample,deflection};
}
export function packOptics(cells){
 const {ray,forward,deflection}=makeOptics(),base=cells.length,O=OPTICS;
 cells[3]=[base,O.impact,O.angle,O.maxB];
 for(let i=0;i<ray.length;i+=4)cells.push(Array.from(ray.subarray(i,i+4)));
 const f=cells.length;cells[26]=[f,O.forwardR,O.forwardAngle,0];
 for(let i=0;i<forward.length;i+=4)cells.push(Array.from(forward.subarray(i,i+4)));
 cells[26][3]=cells.length;for(let i=0;i<deflection.length;i+=4)cells.push(Array.from(deflection.subarray(i,i+4)));
}
// Caller supplies acData(int); use the same packed texture as all existing dew resources.
export const OPTICS_GLSL=/* glsl */`
float acScalar(int base,int i){return acData(base+i/4)[i%4];}
float acImpact(float b){return b<2.3?b/2.3*.08:b<3.4?.08+(b-2.3)/1.1*.57:.65+(b-3.4)/14.6*.35;}
float acDeflection(float b){float z=clamp(acImpact(b),0.0,.99999)*(acData(3).y-1.0);int at=int(z);float a=acScalar(int(acData(26).w),at),c=acScalar(int(acData(26).w),at+1);return max(0.0,mix(a,c,fract(z)));}
float acRay(float b,float psi){
 vec4 h=acData(3);vec2 z=clamp(vec2(acImpact(b),psi/6.28318530718),0.0,.99999)*(h.yz-1.0);ivec2 i=ivec2(z);vec2 f=fract(z);
 int at=i.y*int(h.y)+i.x;float a=acScalar(int(h.x),at),b0=acScalar(int(h.x),at+1),c=acScalar(int(h.x),at+int(h.y)),d=acScalar(int(h.x),at+int(h.y)+1);
 if(min(min(a,b0),min(c,d))<0.0)return -1.0;return mix(mix(a,b0,f.x),mix(c,d,f.x),f.y);
}
vec2 acImageB(float r,float psi){
 vec4 h=acData(26);vec2 z=clamp(vec2(log(max(r,1.86)/1.86)/log(100.0/1.86),(psi-.001)/(3.14159265359-.002)),0.0,.99999)*(h.yz-1.0);ivec2 i=ivec2(z);vec2 f=fract(z);int at=(i.y*int(h.y)+i.x)*2;
 vec2 a=vec2(acScalar(int(h.x),at),acScalar(int(h.x),at+1)),b=vec2(acScalar(int(h.x),at+2),acScalar(int(h.x),at+3));at+=int(h.y)*2;
 vec2 c=vec2(acScalar(int(h.x),at),acScalar(int(h.x),at+1)),d=vec2(acScalar(int(h.x),at+2),acScalar(int(h.x),at+3));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
vec2 acLens(vec2 plane,float strength,bool secondary){
 float r=length(plane),inc=1.2217304764;vec2 projected=plane*vec2(1.0,cos(inc));float b=length(projected);
 float psi=acos(clamp(sin(inc)*plane.y/max(r,.001),-.99999,.99999));vec2 imageB=acImageB(r,psi);
 float target=secondary?-imageB.y:imageB.x;
 return projected*mix(1.0,target/max(b,.001),strength);
}
`;
