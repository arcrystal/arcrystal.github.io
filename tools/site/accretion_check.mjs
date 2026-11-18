#!/usr/bin/env node
// Production-size numerical acceptance; deliberately separate from the fast unit suite.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeDewPlan,packDew,aimShards} from '../../static/site/scene/dew-plan.js';
import {prepareAccretion,historyAt,hermite,orbitStep,omega,potential,ACCRETION} from '../../static/site/scene/accretion-plan.js';
import {TRACK} from '../../static/site/scene/track-plan.js';
const out=process.argv[2]||'/tmp/accretion-numerics.json',reports=[];
for(const size of [[1440,900],[390,844]]){
 const runs=[];
 for(const dt of [ACCRETION.dt,ACCRETION.dt/2]){
  const plan=makeDewPlan(...size);await prepareAccretion(plan,{dt});const ac=plan.accretion,stats=ac.stats;
  assert.ok(stats.collectedCount>=.85&&stats.collectedMass>=.85);
  assert.ok(Math.abs(stats.finalL-stats.initialL)<1e-10,'total angular momentum including absorption');
  assert.ok(Math.abs(stats.dissipated-stats.radiated-stats.retainedHeat)<1e-12,'heat ledger');
  const packed=packDew(plan);assert.ok(packed.data.every(Number.isFinite));
  assert.ok(packed.data.byteLength*2<(plan.phone?16:32)*1024**2);
  const parentMass=new Map(),lanes=Array(8).fill(0);let maxFractureError=0,maxFitError=0,maxBin=0;
  for(const s of plan.shards){
   parentMass.set(s.rec,(parentMass.get(s.rec)||0)+s.mass);
   if(s.acSeed)continue;
   const h=s.acHistory,start=historyAt(h,h[0]),x=start[1]*Math.cos(start[2])*ac.scale,y=start[1]*Math.sin(start[2])*ac.scale*Math.cos(ACCRETION.inclination);
   const pixel=[ac.center[0]+Math.cos(TRACK.tilt)*x-Math.sin(TRACK.tilt)*y,ac.center[1]+Math.sin(TRACK.tilt)*x+Math.cos(TRACK.tilt)*y];
   maxFractureError=Math.max(maxFractureError,Math.hypot(pixel[0]-s.start[0],pixel[1]-s.start[1]));
   for(const b of s.acFit.bins)maxBin=Math.max(maxBin,b[1]);
   for(const [a,b] of s.acFit.segments)for(const u of [.125,.375,.625,.875]){
    const t=a[0]+(b[0]-a[0])*u,q=historyAt(h,t),p=hermite(a,b,t);
    maxFitError=Math.max(maxFitError,Math.hypot(p[0]*Math.cos(p[1])-q[1]*Math.cos(q[2]),p[0]*Math.sin(p[1])-q[1]*Math.sin(q[2]))*ac.scale);
   }
   if(!s.absorbed)lanes[Math.round(s.lane)]++;
   else assert.ok(s.t1<.86,'absorbed shards never return');
  }
  assert.equal(parentMass.size,plan.records.filter(r=>r.freeze).length,'every visible parent is represented');
  assert.ok(maxFractureError<.5&&maxFitError<.5);
  assert.ok(maxBin<=ACCRETION.maxSegments);
  assert.ok(Math.max(...lanes)-Math.min(...lanes)<=1);
  const order=plan.shards.filter(s=>!s.acSeed&&!s.absorbed).sort((a,b)=>a.guideRadius-b.guideRadius);
  for(let i=1;i<order.length;i++)assert.ok(order[i].lane>=order[i-1].lane,'radial order');
  const identity=plan.accretion;aimShards(plan,[10,20,400,300]);assert.equal(plan.accretion,identity,'moving tile does not rerun physics');
  runs.push({...stats,bytes:packed.data.byteLength,shards:plan.shards.length,lanes,maxFractureError,maxFitError,maxBin});
 }
 const [a,b]=runs,convergence={countDifference:Math.abs(a.collectedCount-b.collectedCount),massDifference:Math.abs(a.collectedMass-b.collectedMass),eventRelativeDifference:Math.abs(a.triggerTime-b.triggerTime)/b.triggerTime};
 assert.ok(convergence.countDifference<.01&&convergence.massDifference<.01&&convergence.eventRelativeDifference<.01,JSON.stringify(convergence));
 reports.push({size,runs,convergence});fs.writeFileSync(out,JSON.stringify(reports,null,2));console.log(size,convergence);
}
const orbits=[];
for(const r of [3.6,6,12]){
 let s=[r,0,0,-r*omega(r)],E=q=>.5*(q[2]**2+q[3]**2)+potential(Math.hypot(q[0],q[1])),L=q=>q[0]*q[3]-q[1]*q[2],e=E(s),l=L(s),energy=0,angular=0;
 for(let t=0;t<20*Math.PI/omega(r);t+=ACCRETION.dt){s=orbitStep(s,ACCRETION.dt);energy=Math.max(energy,Math.abs((E(s)-e)/e));angular=Math.max(angular,Math.abs((L(s)-l)/l));}
 orbits.push({radius:r,energyRelativeDrift:energy,angularRelativeDrift:angular});
}
fs.writeFileSync(out,JSON.stringify({production:reports,tenOrbitConservation:orbits},null,2));console.log(out);
