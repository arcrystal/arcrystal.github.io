import test from 'node:test';
import assert from 'node:assert/strict';
import {potential,omega,epicyclic2,orbitStep,dissipativeImpulse,seedForces,fitHistory,hermite,ACCRETION} from '../../../static/site/scene/accretion-plan.js';
import {makeOptics,referenceRay,impactAt,impactIndex,OPTICS} from '../../../static/site/scene/accretion-optics.js';
import {capsulePoint,trackPoint} from '../../../static/site/scene/track-plan.js';
import {glassRaw,glassEase,HOLD,transitP} from '../../../static/site/lerp.js';
const close=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<e,`${a} versus ${b}`);
test('Paczyński–Wiita orbits: frequency, ISCO, ten-orbit conservation',()=>{
 assert.ok(epicyclic2(2.9)<0&&epicyclic2(3.1)>0);close(epicyclic2(3),0);
 for(const r of [3.6,6,12]){
  const dt=ACCRETION.dt,period=2*Math.PI/omega(r);let s=[r,0,0,-r*omega(r)];
  const E=q=>.5*(q[2]**2+q[3]**2)+potential(Math.hypot(q[0],q[1])),L=q=>q[0]*q[3]-q[1]*q[2],e=E(s),l=L(s);let errE=0,errL=0;
  for(let t=0;t<period*10;t+=dt){s=orbitStep(s,dt);errE=Math.max(errE,Math.abs((E(s)-e)/e));errL=Math.max(errL,Math.abs((L(s)-l)/l));}
  assert.ok(errE<.001&&errL<.001,`${r}: energy ${errE}, angular momentum ${errL}`);
 }
});
test('pair dissipation: symmetric impulse, nonpositive mechanical work, exact heat',()=>{
 const mi=.2,mj=.7,vi=1.4,vj=-.3,result=dissipativeImpulse(mi,mj,vi-vj,5,.8,.12);
 const a=vi+result.impulse/mi,b=vj-result.impulse/mj;
 close(mi*a+mj*b,mi*vi+mj*vj);
 const before=.5*(mi*vi*vi+mj*vj*vj),after=.5*(mi*a*a+mj*b*b);
 assert.ok(after<before);close(before-after,result.heat);
 const bodies=[{x:-1,y:2,m:.3},{x:2,y:-1,m:.7},{x:.4,y:.1,m:.2}],f=seedForces(bodies);
 close(f.reduce((s,v)=>s+v[0],0),0);close(f.reduce((s,v)=>s+v[1],0),0);
 close(bodies.reduce((s,b,i)=>s+b.x*f[i][1]-b.y*f[i][0],0),0);
});
test('Schwarzschild table resolves the shadow and far-side arc against reference rays',()=>{
 const optics=makeOptics();close(OPTICS.shadow,3*Math.sqrt(3)/2);
 for(const b of [2.601,2.62,2.7,3,5,12])for(const angle of [1.4,2.6,4,5.4]){
  const a=optics.sample(b,angle),b0=referenceRay(b,angle,.0004);
  if(a>0&&b0>0)assert.ok(Math.abs(1/a-1/b0)*50<.5,`ray ${b}/${angle}`);
 }
 for(let i=0;i<OPTICS.impact;i+=3)close(impactIndex(impactAt(i)),i,1e-8);
});
test('capsule morph stays nested and finishes at the exact shared track',()=>{
 for(let s=0;s<=1;s+=.05)for(let phase=0;phase<1;phase+=.017){
  const m=s*s*s*(s*(s*6-15)+10),a=.25*m;let prev=-1;
  for(let q=0;q<=1;q+=.125){const p=capsulePoint(phase,q,s),r=Math.hypot(Math.max(Math.abs(p[0])-a,0),p[1]);assert.ok(r>prev);prev=r;}
 }
 for(let lane=0;lane<8;lane++)for(let phase=0;phase<1;phase+=.017){const a=capsulePoint(phase,(lane+.5)/8,1),b=trackPoint(phase,lane);close(a[0],b[0]);close(a[1],b[1]);}
});
test('polar Hermite cache preserves unwrapped revolutions and stationary pre-birth',()=>{
 const h=[];for(let t=2;t<=30;t+=.1)h.push(t,8+.1*Math.sin(t),-t*3,.1*Math.cos(t),-3,0);
 const f=fitHistory(h,30,50);
 for(const [a,b] of f.segments){assert.ok(b[0]>a[0]);const p=hermite(a,b,(a[0]+b[0])/2);assert.ok(Number.isFinite(p[0])&&Number.isFinite(p[1]));}
 assert.ok(h.at(-4)<-80,'angle never wraps');
});
test('extended hold preserves early absolute scroll distances on phone and desktop',()=>{
 assert.equal(HOLD.by.glass.pin,5.4);
 for(const pin of [HOLD.pin,HOLD.pinTouch])for(const P of [-.2,-.1,.1,.4,.5,.7,.9,1.2]){
  const raw=glassRaw(P,pin);close(transitP(glassEase(raw,pin)),P,1e-7);
  if(P<=.5){const desktop=glassRaw(P,HOLD.pin)*(5.4*HOLD.pin+HOLD.leadIn)/(4*HOLD.pin+HOLD.leadIn),mobile=raw*(5.4*pin+HOLD.leadIn)/(4*pin+HOLD.leadIn);close(desktop,mobile);}
 }
});
