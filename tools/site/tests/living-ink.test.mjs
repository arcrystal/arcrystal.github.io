import assert from 'node:assert/strict';
import test from 'node:test';
import { KEYS,END,bakeLivingInk,birthSites,piecePoses,decodePosition,pocketFlow } from '../../../static/site/scene/living-ink-plan.js';
import { CAMERA,DROPS,PRECIPITATION,PIGMENT_TOTALS,LATE,poolsOfPaint,dropDepth,dropLedger,tankCamera,projectTank } from '../../../static/site/scene/ink-tank.js';
import { INK_DRIP_INSTANCES } from '../../../static/site/scene/glsl/ink-impact.js';
import { BODIES, MASS, SAMPLES, GLASS, BOX } from '../../../static/site/scene/living-mass.js';
import { frameCamera,project,TALL,TYPES } from '../../../static/site/scene/staunton.js';

// Four optical rails at the end of each row carry the depth and footprint of
// a vapor figure before its separate solid pass draws any pixels.
function railEnvelope(meta,mesh,instance){
  let left=Infinity,right=-Infinity,low=Infinity,high=-Infinity,back=Infinity,front=-Infinity;
  for(let row=0;row<meta.rows;row++)for(let rail=0;rail<4;rail++){
    const at=4*((instance*meta.rows+row)*(meta.cols+4)+meta.cols+rail);
    if(mesh[at+3]<32768)continue;
    const x=decodePosition(mesh[at]),y=decodePosition(mesh[at+1]),z=decodePosition(mesh[at+2]);
    left=Math.min(left,x);right=Math.max(right,x);
    low=Math.min(low,y);high=Math.max(high,y);
    back=Math.min(back,z);front=Math.max(front,z);
  }
  return {left,right,low,high,depth:front-back};
}

test('discrete viscous drips leave the upper lip, strike the pool, and keep falling as the water envelops the screen',()=>{
  assert.equal(DROPS.length,32);
  assert.equal(PRECIPITATION.length,128);
  assert.equal(new Set(PRECIPITATION.map(s=>s.hit)).size,PRECIPITATION.length);
  const view=tankCamera(0);
  assert.equal(projectTank(.5,0,0,view,1)[1],.60);
  assert.equal(projectTank(.5,0,1,view,1)[1],0);
  const half=projectTank(.5,0,.5,view,1)[1];
  assert.ok(half>.30 && half<.45,'a metre at the back occupies less screen space');
  assert.equal(poolsOfPaint.length,8);
  for(const side of [0,1]){
    assert.equal(DROPS.filter(s=>s.white===side).length,16);
    assert.equal(PRECIPITATION.filter(s=>s.white===side).length,64);
  }
  const landingCells=new Set();
  for(const s of PRECIPITATION){
    assert.equal(s.white,DROPS[s.parent].white);
    assert.ok(s.gather<s.detach && s.detach<s.hit && s.outletRadius>0);
    for(const P of [0,(s.gather+s.detach)/2,s.detach,s.hit,1.2]){
      const balance=dropLedger(s,P);
      assert.ok(Object.values(balance).every(v=>v>=0));
      assert.ok(Math.abs(Object.values(balance).reduce((a,b)=>a+b)-s.volume)<1e-12);
    }
    assert.ok(Math.abs(dropDepth(s,s.hit))<1e-12);
    assert.ok(Math.abs(dropDepth(s,s.detach)-dropDepth(s,s.detach+1e-6))<1e-6);
    // (Drops landing on the open pool; later ones meet the rising surface or enter above the screen.)
    if(s.hit<CAMERA.start)for(const aspect of [.46,1.6]){
      const cam=tankCamera(s.hit),[ix,iy]=projectTank(s.x,dropDepth(s,s.hit),s.z,cam,aspect);
      const [x,y]=projectTank(s.nozzleX,-s.ceiling,s.nozzleZ,tankCamera(s.detach),aspect);
      assert.ok(x>.025&&x<.98&&y>.975&&y<1.015,'viscous source is attached to the top border');
      assert.ok(ix>.01&&ix<.99&&iy>=.15&&iy<=.60,'contact lies inside intended wet area');
      assert.ok(iy<y-.3,'the airborne fall reads from the side');
      landingCells.add(Math.min(7,Math.floor(ix*8))+8*Math.min(3,Math.floor((iy-.15)*4/.45)));
    }
  }
  assert.ok(landingCells.size>=25,'impacts cover many different patches of the pool');
  const hits=PRECIPITATION.map(d=>d.hit);
  assert.ok(hits.filter(h=>h>CAMERA.start && h<CAMERA.end).length>=15,'drops keep landing as the surface rises over the camera');
  assert.ok(hits.filter(h=>h>=CAMERA.end).length>=8 && Math.max(...hits)<.68,'and enter from above once it is under, before the air drops are let go');
  for(const late of LATE){
    const d=DROPS[late.id];
    assert.ok(d.hit>CAMERA.start && d.hit<CAMERA.end && d.radius>=.027 && d.plunge>=.85,'late head '+late.id);
  }
  assert.equal(new Set(LATE.map(l=>DROPS[l.id].white)).size,2);
  for(const primary of DROPS){
    const group=PRECIPITATION.filter(d=>d.parent===primary.id);
    assert.ok(Math.abs(PIGMENT_TOTALS[primary.id]-group.reduce((v,d)=>v+d.volume,0))<1e-15);
    for(let i=1;i<group.length;i++)assert.ok(group[i].gather>group[i-1].detach+.009,'pinch off before the pore refills');
  }
  const submerged=tankCamera(CAMERA.end);
  assert.ok(projectTank(.5,0,1,submerged,1)[1]>1);
});

test('localized breathing strain has zero numerical divergence',()=>{
  for(const [x,y,z] of [[.2,.1,-.32],[0,0,0],[-.07,.22,.41]]){
    const h=1e-5,p=[x,y,z];let div=0;
    for(let j=0;j<3;j++){const lo=p.slice(),hi=p.slice();lo[j]-=h;hi[j]+=h;
      div+=(pocketFlow(...hi,.8)[j]-pocketFlow(...lo,.8)[j])/(2*h);}
    assert.ok(Math.abs(div)<1e-7);
  }
});

test('airborne paint and water waves receive one matching GPU record per crossing',()=>{
  const stride=12;
  assert.equal(INK_DRIP_INSTANCES.length,(PRECIPITATION.length+1)*stride);
  assert.ok(INK_DRIP_INSTANCES.slice(0,stride).every(n=>n===0),'the first instance is the wet filter lip');
  for(const [index,drop] of PRECIPITATION.entries()){
    const at=(index+1)*stride;
    const expected=[drop.x,drop.z,drop.ceiling,drop.radius,drop.gather,drop.detach,
      drop.hit,drop.white,drop.nozzleX,drop.nozzleZ,drop.seed,drop.parent];
    assert.deepEqual(INK_DRIP_INSTANCES.slice(at,at+stride),Float32Array.from(expected));
  }
});

test('the hero knight and all other plumes land on their own board squares',()=>{
  for(const [W,H,rect] of [[1280,800,[630,180,550,460]],[390,844,[20,400,350,292]]]){
    const sites=birthSites(W/H),cam=frameCamera(rect[2]/rect[3]);
    assert.deepEqual(sites,birthSites(W/H));
    assert.equal(sites[0].piece.type,TYPES.indexOf('N'));
    assert.equal(sites[1].piece.type,TYPES.indexOf('P'));
    assert.equal(new Set(sites.map(s=>s.slot)).size,32);
    assert.ok(sites.some((s,i)=>i>0 && s.land<sites[i-1].land));
    assert.ok(new Set(sites.map(s=>s.birth)).size===32);
    const poses=piecePoses(sites,END,W,H,rect,null,cam);
    for(const [i,s] of sites.entries()){
      assert.equal(Number(!s.piece.black),DROPS[i].white);
      assert.ok(s.land>s.depart && s.depart>=s.birth+s.duration && s.land<END);
      assert.ok(s.nuclei.every(Number.isFinite));
      const [u,v]=project(cam,[s.piece.x,TALL[TYPES[s.piece.type]]/2,s.piece.z]);
      assert.ok(Math.hypot(poses[i].x-(rect[0]+(1+u)*rect[2]/2),poses[i].y-(H-rect[1]-(1-v)*rect[3]/2))<.5);
    }
  }
});

test('the packed sheets grow into tall submerged plumes and all 32 vapor pieces, conserving both pigments',()=>{
  let meta,issued=0,finished,massPaths;
  const vaporFrames=new Map(),seenSlots=new Set();
  const aspect=.46,dt=END/(KEYS-1);
  const freeFrames=[.55,.62,.69].map(P=>Math.round(P/dt)),freeSheets=[];
  const volume=[0,1].map(side=>PRECIPITATION.reduce((n,d)=>n+(d.white===side?d.volume:0),0));
  bakeLivingInk(aspect,true,packet=>{
    if(packet.meta){
      meta=packet.meta;
      assert.equal(meta.vaporFigures.length,4*meta.sites.length);
      for(const [i,site] of meta.sites.entries()){
        const frame=Math.ceil(site.formPeak/dt);
        assert.ok(site.formStart<site.formPeak && frame*dt<site.birth,'a wet silhouette exists for at least one stored frame before solidification');
        vaporFrames.set(site.slot,frame);
        const [rank,start,peak,birth]=meta.vaporFigures.subarray(4*i,4*i+4);
        assert.equal(Math.abs(rank)-1,site.piece.type,'the shader selects the rank of board slot '+site.slot);
        assert.deepEqual([start,peak,birth],[site.formStart,site.formPeak,site.birth].map(Math.fround));
      }
      return;
    }
    if(packet.ledger){finished=packet;return;}
    if(packet.mass){
      // The living ink's paths: one per body, every sample, in the frame (living-mass.js).
      assert.equal(issued,Math.ceil(MASS.start/dt),'seeded where the trunks are as it congeals');
      assert.equal(packet.mass.length,SAMPLES*BODIES.length*4);
      for(let k=0;k<packet.mass.length;k+=4){
        const [x,y,z,r]=packet.mass.subarray(k,k+4);
        assert.ok(x>=BOX.x[0]-1e-6 && x<=BOX.x[1]+1e-6 && y>=BOX.y[0]-1e-6 && y<=BOX.y[1]+1e-6 && z<GLASS-.1 && r>.03 && r<.14,'in view and behind the glass');
      }
      massPaths=packet.mass;return;
    }
    const {frame,density,mesh}=packet;
    assert.equal(frame,issued++);
    assert.equal(mesh.length,4*(meta.cols+4)*meta.rows*32);
    assert.equal(density.length,meta.nx*meta.ny*meta.nz*2);
    if(frame===0 || frame===KEYS-1)assert.ok(!density.some(Boolean));
    const tallPigments=[];
    const thickness=freeFrames.includes(frame)?[]:null;
    for(let n=0;n<32;n++){
      const row=(meta.rows*n+Math.floor(meta.rows*.6))*(meta.cols+4);
      assert.deepEqual(mesh.slice(4*row,4*row+4),mesh.slice(4*(row+meta.cols-1),4*(row+meta.cols-1)+4));
      const at=row*4;
      assert.ok(Number.isFinite(decodePosition(mesh[at])));
      const id=meta.order[n],site=meta.sites[id];
      if(thickness){
        // The same four material points on each outer sheet are followed
        // through the free current, independently of its screen position.
        for(const [u,v] of [[.07,.2],[.29,.42],[.56,.66],[.82,.85]]){
          const r=Math.round(v*(meta.rows-1)),c=Math.round(u*(meta.cols-1));
          const vertex=(n*meta.rows+r)*(meta.cols+4)+c;
          thickness.push(mesh[4*vertex+3]/65535);
        }
      }
      if(frame===Math.round(CAMERA.end/dt)){
        const {low,high}=railEnvelope(meta,mesh,n);
        if(Math.min(1,high)-Math.max(0,low)>.50)tallPigments.push(DROPS[id].white);
      }
      if(frame===vaporFrames.get(site.slot)){
        const {left,right,low,high,depth}=railEnvelope(meta,mesh,n);
        const bodyHeight=site.size*Math.min(1,aspect);
        assert.ok(high-low>.66*bodyHeight && (right-left)*aspect>.20*bodyHeight,'a substantial wet silhouette for '+site.slot);
        assert.ok(left<site.x && right>site.x && low<site.y && high>site.y,'pigment gathers at its own birth site '+site.slot);
        assert.ok(depth>.012,'distinguishable front and back sections for '+site.slot);
        seenSlots.add(site.slot);
      }
    }
    if(frame===Math.round(CAMERA.end/dt)){
      assert.ok(tallPigments.length>=3,'several distinct plumes span more than half the visible water');
      assert.equal(new Set(tallPigments).size,2,'both black and ivory pigment make tall plumes');
    }
    if(thickness)freeSheets.push(thickness);
  });
  assert.equal(issued,KEYS);
  assert.ok(massPaths,'the living ink was seeded');
  assert.equal(seenSlots.size,32);
  const [enter,current,leave]=freeSheets;
  const knots=current.filter((v,i)=>v>Math.max(enter[i],leave[i])+.06);
  const veils=current.filter((v,i)=>v<Math.min(enter[i],leave[i])-.06);
  assert.ok(knots.length>=8 && veils.length>=8,'thickened folds shed pigment while other folds regather it');
  for(const [id,site] of meta.sites.entries()){
    const f=vaporFrames.get(site.slot);
    assert.equal(finished.ledger[f*32+id],0,'a recognizable vapor stage precedes lacquer at slot '+site.slot);
  }
  for(let f=0;f<KEYS;f++){
    for(let side=0;side<2;side++){
      const n=6*f+3*side,b=finished.massBook, deposited=meta.sites.reduce((v,site,k)=>
        v+(Number(!site.piece.black)===side?finished.ledger[32*f+k]*meta.depositedMass[k]:0),0);
      assert.ok(Math.abs(b[n]+b[n+1]+b[n+2]-volume[side])<volume[side]*1e-5);
      assert.ok(Math.abs(deposited-b[n+2])<volume[side]*1e-5);
    }
    for(let i=0;i<32;i++){
      const g=finished.ledger[32*f+i];
      assert.ok(g>=0 && g<=1.00003 && (f===0||g>=finished.ledger[32*(f-1)+i]-1e-6));
      if(f===KEYS-1)assert.ok(Math.abs(g-1)<3e-5);
    }
  }
});
