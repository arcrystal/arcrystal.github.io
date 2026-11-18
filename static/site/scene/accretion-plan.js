// Worker-only reduced-order accretion. Units: r_s = G M = 1; mass of the visible disc = .01.
// No state advances in the renderer. See design/accretion.md for physical/artistic boundaries.
import { TRACK, trackEase, trackFrame } from './track-plan.js';
export const ACCRETION = Object.freeze({ inclination: 70*Math.PI/180, inner: 3.6, outer: 12,
  absorb: 1.85, h: .7, gamma: 5, sound: .06, dt: .12, bins: 64, maxSegments: 256, tolerance: .22 });
const TAU=2*Math.PI, clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const potential = r => -1/(r-1);
export const omega = r => 1/Math.sqrt(r*(r-1)**2);
export const circularL = r => r*r*omega(r);
export const epicyclic2 = r => (r-3)/(r*(r-1)**3);
export function gravity(x,y) { const r=Math.hypot(x,y), k=-1/(r*(r-1)**2);return [k*x,k*y]; }
export function orbitStep(s,dt) {
  let [ax,ay]=gravity(s[0],s[1]);let vx=s[2]+ax*dt/2,vy=s[3]+ay*dt/2;
  const x=s[0]+vx*dt,y=s[1]+vy*dt;[ax,ay]=gravity(x,y);
  return [x,y,vx+ax*dt/2,vy+ay*dt/2];
}
// Exact central pair friction. An impulse on the line of centres conserves both momenta.
export function dissipativeImpulse(mi,mj,relative,gamma,w,dt) {
  const mu=mi*mj/(mi+mj),factor=Math.exp(-gamma*w*w*dt);
  return { impulse:mu*relative*(factor-1), heat:.5*mu*relative*relative*(1-factor*factor) };
}
export function hermite(a,b,t) {
  const d=b[0]-a[0],u=clamp((t-a[0])/Math.max(d,1e-12)),v=1-u;
  return [1,2].map(k=>(1+2*u)*v*v*a[k]+u*v*v*d*a[k+2]+u*u*(3-2*u)*b[k]-u*u*v*d*b[k+2]);
}
export function historyAt(h,t) {
  const N=h.length/6;let lo=0,hi=N-1;
  if(t<=h[0])return h.slice(0,6);if(t>=h[(N-1)*6])return h.slice((N-1)*6,N*6);
  while(hi-lo>1){const m=(lo+hi)>>1;if(h[m*6]<=t)lo=m;else hi=m;}
  const a=h.slice(lo*6,lo*6+6),b=h.slice(hi*6,hi*6+6),u=(t-a[0])/(b[0]-a[0]),p=hermite(a,b,t);
  // Derivative of the same cubic, not an interpolated angular velocity.
  const d=b[0]-a[0],v=1-u,der=[1,2].map(k=>6*u*v*(b[k]-a[k])/d+(1-4*u+3*u*u)*a[k+2]+(3*u*u-2*u)*b[k+2]);
  return [t,...p,...der,a[5]+(b[5]-a[5])*u];
}
export function fitHistory(h,duration,scale) {
  const bins=[],segments=[],error=ACCRETION.tolerance/scale;
  for(let k=0;k<ACCRETION.bins;k++) {
    const from=duration*k/ACCRETION.bins,to=duration*(k+1)/ACCRETION.bins,start=segments.length;
    const fit=(a,b,depth)=>{
      let worst=0;for(const f of [.25,.5,.75]){const t=a[0]+(b[0]-a[0])*f,q=historyAt(h,t),p=hermite(a,b,t);worst=Math.max(worst,Math.hypot(p[0]*Math.cos(p[1])-q[1]*Math.cos(q[2]),p[0]*Math.sin(p[1])-q[1]*Math.sin(q[2])));}
      if(worst>error&&depth<8){const m=at((a[0]+b[0])/2);fit(a,m,depth+1);fit(m,b,depth+1);}
      else {if(worst>error*1.05)throw new Error(`Accretion trajectory fit exceeds ${ACCRETION.tolerance}px: ${worst*scale}, a=${a}, b=${b}, first=${h.slice(0,12)}, last=${h.slice(-12)}`);segments.push([a,b]);}
    };
    // Extend the stationary pre-birth and absorbed state with zero derivative.
    const at=t=>{const q=historyAt(h,t);if(t<h[0]||t>h[h.length-6])return [t,q[1],q[2],0,0,q[5]];return q;};
    fit(at(from),at(to),0);bins.push([start,segments.length-start]);
  }
  return {bins,segments};
}
export function seedForces(bodies,epsilon=.18) {
  const f=bodies.map(()=>[0,0]);
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
    const a=bodies[i],b=bodies[j],dx=a.x-b.x,dy=a.y-b.y,k=-a.m*b.m/(dx*dx+dy*dy+epsilon*epsilon)**1.5;
    f[i][0]+=k*dx;f[i][1]+=k*dy;f[j][0]-=k*dx;f[j][1]-=k*dy;
  }return f;
}
function bakeSeeds(plan,ids,center,scale) {
  const selected=plan.shards.filter(s=>ids.has(s.rec));
  const mass=selected.reduce((a,s)=>a+s.mass,0);
  const bodies=selected.map(s=>{const dx=(s.start[0]-center[0])/scale,dy=(s.start[1]-center[1])/scale;return {x:Math.cos(TRACK.tilt)*dx+Math.sin(TRACK.tilt)*dy,y:(-Math.sin(TRACK.tilt)*dx+Math.cos(TRACK.tilt)*dy)/Math.cos(ACCRETION.inclination),m:s.mass/mass,vx:0,vy:0};});
  const com=[bodies.reduce((a,b)=>a+b.x*b.m,0),bodies.reduce((a,b)=>a+b.y*b.m,0)];
  bodies.forEach(b=>{b.vx=-.15*(b.x-com[0]);b.vy=-.15*(b.y-com[1]);});
  const paths=bodies.map(()=>[]),dt=.025;
  for(let k=0;k<=600;k++){
    if(k%4===0)bodies.forEach((b,i)=>paths[i].push([k*dt,b.x,b.y]));
    const f=seedForces(bodies);bodies.forEach((b,i)=>{b.vx+=dt*.5*f[i][0]/b.m;b.vy+=dt*.5*f[i][1]/b.m;b.x+=dt*b.vx;b.y+=dt*b.vy;});
    // Soft local collisions exchange momentum and dissipate relative approach, never apply a swirl force.
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
      if(d>.00001&&d<.45){const ex=dx/d,ey=dy/d,w=1-d/.45,rel=(a.vx-b.vx)*ex+(a.vy-b.vy)*ey;
        const impulse=dissipativeImpulse(a.m,b.m,rel,5,w,dt).impulse+a.m*b.m/(a.m+b.m)*.05*w*dt;
        a.vx+=impulse*ex/a.m;a.vy+=impulse*ey/a.m;b.vx-=impulse*ex/b.m;b.vy-=impulse*ey/b.m;}
    }
    const ff=seedForces(bodies);bodies.forEach((b,i)=>{b.vx+=dt*.5*ff[i][0]/b.m;b.vy+=dt*.5*ff[i][1]/b.m;});
  }
  selected.forEach((s,i)=>{s.seedPath=paths[i];s.acSeed=true;s.t0=.502;s.t1=.582;s.mass/=mass;});
  return {mass:1,parents:[...ids],momentum:bodies.reduce((v,b)=>[v[0]+b.m*b.vx,v[1]+b.m*b.vy],[0,0])};
}
// Deterministic integer spatial hash, unique unordered pairs. Cell order never depends on a random seed.
function neighborPairs(x,y,alive,N,h,bodies,radii,frequencies,halfStep) {
  const cells=new Map(),pairs=[];
  for(let i=0;i<N;i++)if(alive[i]){const key=(Math.floor(x[i]/h)+2048)*4096+Math.floor(y[i]/h)+2048;let c=cells.get(key);if(!c)cells.set(key,c=[]);c.push(i);}
  for(let i=0;i<N;i++)if(alive[i]){
    const gx=Math.floor(x[i]/h)+2048,gy=Math.floor(y[i]/h)+2048;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const j of cells.get((gx+a)*4096+gy+b)||[]){
      if(j<=i)continue;const dx=x[i]-x[j],dy=y[i]-y[j],d=Math.hypot(dx,dy);
      if(d<h&&d>1e-8){
        const w=1-d/h,mi=bodies[i].mass,mj=bodies[j].mass,mu=mi*mj/(mi+mj),ri=radii[i],rj=radii[j];
        const gamma=ACCRETION.gamma*Math.sqrt(frequencies[i]*frequencies[j]);
        const factor=Math.exp(-gamma*w*w*halfStep);
        const pressure=mu*ACCRETION.sound**2*(ri*ri*frequencies[i]**2+rj*rj*frequencies[j]**2)/2/h*w*halfStep;
        pairs.push(i,j,dx/d,dy/d,mu,factor,pressure);
      }
    }
  }return pairs;
}
export async function prepareAccretion(plan,{dt=ACCRETION.dt,cancelled=()=>false,yieldEvery=80,maxTime=null,onProgress}={}) {
  if(plan.accretion)return plan.accretion;
  const start=performance.now(),frame=trackFrame(plan.W,plan.H,plan.cardRect,0),center=frame.slice(0,2),scale=frame[2]/24;
  const seedIds=new Set(plan.records.map((r,i)=>({i,r,d:Math.hypot(r.c[0]-center[0],r.c[1]-center[1])})).filter(x=>x.r.science===undefined&&x.r.core!==undefined).sort((a,b)=>a.d-b.d).slice(0,5).map(x=>x.i));
  // Sector volume fractions sum exactly to the parent volume, including every concentric piece.
  const sums=new Map();for(const s of plan.shards){s.mass=(s.a1-s.a0)*(s.r**3-s.rin**3);sums.set(s.rec,(sums.get(s.rec)||0)+s.mass);}
  for(const s of plan.shards){const r=plan.records[s.rec],volume=Math.max(r.V0+r.q*Math.max(0,Math.min(r.tg,.5)-r.t0),1e-8);s.mass=s.mass/sums.get(s.rec)*Math.cbrt(volume);}
  const seeds=bakeSeeds(plan,seedIds,center,scale),shards=plan.shards.filter(s=>!s.acSeed),N=shards.length;
  const total=shards.reduce((a,s)=>a+s.mass,0);shards.forEach(s=>s.mass=.01*s.mass/total);
  const x=new Float64Array(N),y=new Float64Array(N),vx=new Float64Array(N),vy=new Float64Array(N),alive=new Uint8Array(N),born=new Float64Array(N),heat=new Float64Array(N),theta=new Float64Array(N),hist=Array.from({length:N},()=>[]);
  let maxR=0,initialEnergy=0,initialL=0;
  for(let i=0;i<N;i++){
    const s=shards[i],dx=(s.start[0]-center[0])/scale,dy=(s.start[1]-center[1])/scale;
    x[i]=Math.cos(TRACK.tilt)*dx+Math.sin(TRACK.tilt)*dy;y[i]=(-Math.sin(TRACK.tilt)*dx+Math.cos(TRACK.tilt)*dy)/Math.cos(ACCRETION.inclination);
    const r=Math.hypot(x[i],y[i]);maxR=Math.max(maxR,r);theta[i]=Math.atan2(y[i],x[i]);
    // A bound, prograde apocentre. Angular momentum is initial data, never a tangential gravity force.
    const guiding=Math.min(r,clamp(r*.75,8.2,11.2)),L=Math.min(circularL(guiding),.94*r*Math.sqrt(2/Math.max(r-1,.3))),v=L/r;
    vx[i]=v*y[i]/r;vy[i]=-v*x[i]/r;
    initialL+=s.mass*(x[i]*vy[i]-y[i]*vx[i]);
    initialEnergy+=s.mass*(.5*v*v+potential(Math.max(r,1.85)));
  }
  const estimated=.95*maxR**1.5,limit=maxTime??Math.max(1600,estimated*3),saveEvery=4;
  for(let i=0;i<N;i++)born[i]=estimated*.12*Math.hypot(x[i],y[i])/maxR;
  let time=0,trigger=null,absorbedMass=0,absorbedL=0,dissipated=0,radiated=0,collectedCount=0,collectedMass=0,step=0;
  const save=i=>{const r=Math.hypot(x[i],y[i]),a=Math.atan2(y[i],x[i]);theta[i]+=Math.atan2(Math.sin(a-theta[i]),Math.cos(a-theta[i]));if(hist[i][hist[i].length-6]===time)hist[i].length-=6;hist[i].push(time,r,theta[i],alive[i]?(x[i]*vx[i]+y[i]*vy[i])/r:0,alive[i]?(x[i]*vy[i]-y[i]*vx[i])/(r*r):0,heat[i]);};
  const midR=new Float64Array(N),midOmega=new Float64Array(N);
  const interact=(pairs,reverse)=>{
    // Positions stay fixed during the two pair sweeps. Share their expensive coefficients;
    // impulses and heat are still evaluated with each sweep's current relative velocity.
    for(let p=reverse?pairs.length-7:0;reverse?p>=0:p<pairs.length;p+=reverse?-7:7){
      const i=pairs[p],j=pairs[p+1],ex=pairs[p+2],ey=pairs[p+3],mu=pairs[p+4],factor=pairs[p+5];
      const mi=shards[i].mass,mj=shards[j].mass,rel=(vx[i]-vx[j])*ex+(vy[i]-vy[j])*ey;
      const J=mu*rel*(factor-1)+pairs[p+6],removed=.5*mu*rel*rel*(1-factor*factor);
      vx[i]+=J*ex/mi;vy[i]+=J*ey/mi;vx[j]-=J*ex/mj;vy[j]-=J*ey/mj;
      dissipated+=removed;heat[i]+=removed*.5;heat[j]+=removed*.5;
    }
  };
  while(time<limit){
    if(step%yieldEvery===0){
      if(cancelled())throw new Error('Accretion preparation cancelled');
      // The gate requires both this minimum integration span and collection of the swarm.
      const span = Math.min(1, time / (estimated * 1.3));
      const collection = Math.min(1, collectedCount / (N * .85), collectedMass / .0085);
      onProgress?.(.8 * (.8 * span + .2 * collection));
      await new Promise(r=>setTimeout(r,0));
    }
    for(let i=0;i<N;i++){
      if(!alive[i]&&!hist[i].length&&time>=born[i]){alive[i]=1;save(i);}
      if(!alive[i])continue;
      const r=Math.hypot(x[i],y[i]);if(r<ACCRETION.absorb){alive[i]=0;shards[i].absorbed=time;absorbedMass+=shards[i].mass;absorbedL+=shards[i].mass*(x[i]*vy[i]-y[i]*vx[i]);save(i);continue;}
      const g=-1/(r*(r-1)**2);vx[i]+=dt*.5*g*x[i];vy[i]+=dt*.5*g*y[i];
      x[i]+=dt*.5*vx[i];y[i]+=dt*.5*vy[i];
    }
    for(let i=0;i<N;i++)if(alive[i]){midR[i]=Math.hypot(x[i],y[i]);midOmega[i]=omega(midR[i]);}
    const pairs=neighborPairs(x,y,alive,N,ACCRETION.h,shards,midR,midOmega,dt*.5);interact(pairs,false);interact(pairs,true);
    for(let i=0;i<N;i++)if(alive[i]){
      x[i]+=dt*.5*vx[i];y[i]+=dt*.5*vy[i];const r=Math.hypot(x[i],y[i]),g=-1/(r*Math.max(r-1,.5)**2);vx[i]+=dt*.5*g*x[i];vy[i]+=dt*.5*g*y[i];
      const cool=heat[i]*(1-Math.exp(-dt/12));heat[i]-=cool;radiated+=cool;
    }
    time+=dt;step++;
    if(step%saveEvery===0)for(let i=0;i<N;i++)if(alive[i])save(i);
    if(step%20===0){
      collectedCount=0;collectedMass=0;
      for(let i=0;i<N;i++)if(alive[i]){const r=Math.hypot(x[i],y[i]),vr=(x[i]*vx[i]+y[i]*vy[i])/r,vt=(x[i]*vy[i]-y[i]*vx[i])/r,vk=r*omega(r);
        if(.5*(vr*vr+vt*vt)+potential(r)<0&&r>=3.3&&r<=13&&Math.abs(vr)<.30*vk&&Math.abs(Math.abs(vt)-vk)<.30*vk){collectedCount++;collectedMass+=shards[i].mass;}}
      if(time>=estimated*1.3&&collectedCount/N>=.85&&collectedMass/.01>=.85){trigger=time;break;}
    }
  }
  if(trigger===null)throw new Error(`Accretion did not collect: count=${collectedCount/N}, mass=${collectedMass/.01}, absorbed=${absorbedMass/.01}, T=${time}`);
  // Organize only after the physical collection event. Ordered guiding radii avoid radial crossings.
  const order=shards.map((s,i)=>({s,i,r:Math.hypot(x[i],y[i])})).filter(a=>!a.s.absorbed).sort((a,b)=>a.r-b.r||a.i-b.i);
  order.forEach((a,k)=>{a.s.lane=clamp(Math.floor(k/order.length*8),0,7)+((k/order.length*8)%1-.5)*.5+(a.s.seed-.5)*.1/order.length;a.s.guideRadius=a.r;});
  for(let i=0;i<N;i++){
    if (i % 32 === 0) onProgress?.(.8 + .15 * i / N);
    const s=shards[i];if(alive[i])save(i);
    // Simulation time is mapped once after event detection; the scene has no threshold branches.
    s.t0=.56+.30*hist[i][0]/trigger;s.t1=s.absorbed?.56+.30*s.absorbed/trigger:1.105+.075*s.seed;
    s.join=.86;s.fly=s.t1-s.t0;s.acHistory=hist[i];s.acFit=fitHistory(hist[i],trigger,scale);
    const last=hist[i].slice(-6);s.acFinal=last.slice(1);s.phase=(-last[2]-Math.PI/2)/TAU;s.laps=0;
    const r=plan.records[s.rec];if(!r.acTime||s.t0<r.acTime)r.acTime=s.t0;
  }
  for(const id of seedIds){const r=plan.records[id];r.acTime=.502;}
  plan.records.forEach(r=>{if(r.freeze&&r.acTime){r.freeze.tf=r.acTime-.012;r.freeze.tc=r.acTime-.002;}});
  const far=Math.max(...[[0,0],[plan.W,0],[0,plan.H],[plan.W,plan.H]].map(q=>Math.hypot(q[0]-center[0],q[1]-center[1])));
  plan.vFreeze=far/.045;
  plan.field.grid=plan.field.grid.map((_,i)=>{const px=(i%plan.field.cols)*plan.field.cell,py=Math.floor(i/plan.field.cols)*plan.field.cell,dx=center[0]-px,dy=center[1]-py,d=Math.hypot(dx,dy)||1;return [dx/d,dy/d,.10,.55+d/plan.vFreeze+.10];});
  const stats={seedParents:seeds.parents,seedMomentum:seeds.momentum,steps:step,maxR,estimated,dt,triggerTime:trigger,collectedCount:collectedCount/N,collectedMass:collectedMass/.01,discMass:.01,initialL,finalL:shards.reduce((v,s,i)=>v+(alive[i]?s.mass*(x[i]*vy[i]-y[i]*vx[i]):0),absorbedL),absorbedMass,absorbedL,dissipated,radiated,retainedHeat:heat.reduce((a,b)=>a+b,0),initialEnergy,prepareMs:performance.now()-start};
  return plan.accretion={center,scale,duration:trigger,seeds,stats};
}
// Append to the existing single transferable float texture; no extra GL texture units or uploads.
export function packAccretion(plan,cells) {
  const ac=plan.accretion;if(!ac)return;
  const meta=cells.length;cells[23]=[meta,ac.duration,ac.scale,1];cells[24]=[...ac.center,ACCRETION.bins,.86];
  for(const s of plan.shards)cells.push([0,0,0,0],[0,0,0,0]);
  plan.shards.forEach((s,i)=>{
    const at=meta+i*2;
    if(s.acSeed){const base=cells.length;for(const p of s.seedPath)cells.push([...p,0]);cells[at]=[base,s.seedPath.length,-1,0];cells[at+1]=[0,0,0,0];return;}
    const bins=cells.length;for(const b of s.acFit.bins)cells.push([0,b[1],0,0]);
    const base=cells.length;
    for(const [a,b] of s.acFit.segments)cells.push([a[0],b[0],a[1],a[2]],[a[3],a[4],b[1],b[2]],[b[3],b[4],a[5]/s.mass,b[5]/s.mass]);
    s.acFit.bins.forEach((b,k)=>cells[bins+k][0]=base+b[0]*3);
    const end=s.acFinal;cells[at]=[bins,s.lane,end[4]/s.mass,s.t0];cells[at+1]=[end[0],end[1],end[2],end[3]];
  });
}
