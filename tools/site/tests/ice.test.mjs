import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeIcePlan,packIce,tileCandidates,ownerAt,localArrival,arrivalAt,coldAt,clearAt,crackOpen,facetAt,fractureAt,spectralTransmission,iceFlare,ICE,ICE_BASE,ICE_RELIEF,ICE_RINGS,ICE_GLOW} from '../../../static/site/scene/ice-plan.js';
import {HOLD,holdFor,holdAt,holdEase,transitP} from '../../../static/site/lerp.js';
import {integral,spectrum} from '../ice_spectrum.mjs';
const screens=[[1440,900],[390,844],[908,978],[2560,1440]],plans=screens.map(([w,h])=>makeIcePlan(w,h));
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('ice plans reproduce exactly, have finite convex cells and obey topology/budget bounds',()=>{
 assert.deepEqual(makeIcePlan(390,844),plans[1]);
 for(const p of plans){assert.equal(p.grains.length,p.phone?24:48);assert.ok(p.cracks.length>100&&p.cracks.length<=(p.phone?768:1536));let area=0;
  p.grains.forEach((g,i)=>p.grains.slice(i+1).forEach(h=>assert.ok(distance(g.n,h.n)>=g.exclusion+h.exclusion-1e-5)));
  p.grains.forEach((g,id)=>{assert.equal(ownerAt(p,g.n),id);assert.ok(g.poly.length>=3);assert.ok(g.atlasError<.01);let a=0;g.poly.forEach((v,k)=>{const w=g.poly[(k+1)%g.poly.length];a+=v[0]*w[1]-w[0]*v[1];assert.ok(v.every(Number.isFinite));});assert.ok(a>0);area+=a/2;
   g.arms.forEach((e,j)=>{if(e.parent>=0){assert.ok(e.parent<j);near(e.t,distance(e.a,g.n),1e-5);}});
  });near(area,p.W*p.H,1e-3);
  p.cracks.forEach((e,i)=>{assert.ok(e.start>=.52);assert.ok(e.finish+ICE.open<=.84+1e-8);assert.ok(e.width>0&&e.width<=(p.phone?1.5:2.5));if(e.parent>=0){assert.ok(e.parent<i);near(distance(e.a,p.cracks[e.parent].b),0,1e-5);assert.ok(e.start>=p.cracks[e.parent].finish);}
   if(e.hit>=0){const old=p.cracks[e.hit];near(distance(e.b,old.b),0,1e-4);}
  });
 }
});
test('grain and fracture spatial lists are conservative against exhaustive queries',()=>{
 for(const p of plans){const index=tileCandidates(p);for(let y=3;y<p.H;y+=43)for(let x=5;x<p.W;x+=47){const q=[x,y],tile=index.tiles[Math.floor(y/ICE.tile)*index.cols+Math.floor(x/ICE.tile)];assert.equal(ownerAt(p,q,tile.grains),ownerAt(p,q));}
  for(let i=0;i<p.cracks.length;i+=3){const e=p.cracks[i];for(const q of [e.a,e.b,[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2]]){const x=Math.min(index.cols-1,Math.max(0,Math.floor(q[0]/ICE.tile))),y=Math.min(index.rows-1,Math.max(0,Math.floor(q[1]/ICE.tile)));assert.ok(index.tiles[y*index.cols+x].cracks.includes(i));}}
 }
});
test('ice freezes before cracks, and parent-following propagation is monotone and reversible',()=>{
 for(const p of plans){for(let y=0;y<=p.H;y+=29)for(let x=0;x<=p.W;x+=31){const q=[x,y],A=arrivalAt(p,q);assert.ok(A>-.2&&A+ICE.fill<.72);let last=0;for(const P of [-.2,0,.2,.4,.6,.72,.84,1.0,1.12]){const c=clearAt(p,q,P);assert.ok(c>=last);last=c;}assert.equal(clearAt(p,q,1.12),1);}
  p.cracks.forEach(e=>{for(let k=0;k<=8;k++){const s=k/8,q=e.a.map((v,j)=>v+(e.b[j]-v)*s);assert.ok(e.start+(e.finish-e.start)*s>=arrivalAt(p,q)+ICE.fill+ICE.fractureWait-1e-6);let prev=0;for(const P of [-.2,.52,.6,.68,.76,.84]){const v=crackOpen(e,P,s);assert.ok(v>=prev);prev=v;}assert.equal(crackOpen(e,.84,s),1);}});
 }
});
test('grooves preserve a connected floor and their normals derive from the recessed surface',()=>{
 const p=plans[0];for(let i=0;i<p.cracks.length;i+=23){const e=p.cracks[i],v=[e.b[0]-e.a[0],e.b[1]-e.a[1]],L=Math.hypot(...v);const q=[(e.a[0]+e.b[0])/2-v[1]/L*e.width*.4,(e.a[1]+e.b[1])/2+v[0]/L*e.width*.4];const f=facetAt(p,q),g=fractureAt(p,q,.84);assert.ok(g.groove>=0&&g.groove<=f.height*.65+1e-6);assert.ok(g.height>=f.height*.35-1e-6);
  const eps=1e-4,dx=(fractureAt(p,[q[0]+eps,q[1]],.84).height-fractureAt(p,[q[0]-eps,q[1]],.84).height)/(2*eps),dy=(fractureAt(p,[q[0],q[1]+eps],.84).height-fractureAt(p,[q[0],q[1]-eps],.84).height)/(2*eps);
  // Away from max-union ridges and the local-depth cap, analytical normals match finite differences.
  if(g.groove>0){near(g.gradient[0],dx,.01);near(g.gradient[1],dy,.01);}
 }
});
test('glints are supported by opened cracks and have bounded simultaneous counts',()=>{
 for(const p of plans){for(const g of p.glints)assert.ok(g.start>=p.cracks[g.edge].finish+ICE.open);for(let P=.5;P<.9;P+=.001)assert.ok(p.glints.filter(g=>P>g.start&&P<g.end).length<=(p.phone?3:6));}
});
test('arrival atlas error and packed float metadata stay within the schedule tolerance',()=>{
 const p=plans[1],packed=packIce(p),A=ICE.atlas;
 for(const g of p.grains)for(let j=0;j<13;j++){const u=(j*.317)%1,v=(j*.733)%1,q=[g.box[0]+u*g.box[2],g.box[1]+v*g.box[3]],x=u*(A-1),y=v*(A-1),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const at=(dx,dy)=>packed.atlas[((g.atlas[1]+iy+dy)*packed.aw+g.atlas[0]+ix+dx)*4];
  const a=at(0,0)*(1-fx)*(1-fy)+at(1,0)*fx*(1-fy)+at(0,1)*(1-fx)*fy+at(1,1)*fx*fy;near(a,localArrival(g,q)[0],.01);
 }
 assert.ok([...packed.data].every(Number.isFinite));assert.equal(packed.data[4],24);
});
test('spectral transmission satisfies extinction, range, periodicity and complementary analysers',()=>{
 for(const G of [0,120,275,550,830,1700,2200])for(const phi of [0,.3,Math.PI/4,1.2])for(let lambda=380;lambda<=780;lambda+=5){const x=spectralTransmission(G,phi,Math.PI/2,lambda),y=spectralTransmission(G,phi,0,lambda);assert.ok(x>=-1e-12&&x<=1+1e-12);near(x+y,1,1e-12);near(x,spectralTransmission(G,phi+Math.PI,Math.PI/2,lambda),1e-12);if(G===0||phi===0)near(x,0,1e-12);for(const alpha of [.2,.7,1.1]){const v=spectralTransmission(G,phi,alpha,lambda);assert.ok(v>=-1e-12&&v<=1+1e-12);}}
});
test('the shipped spectrum reproduces the builder and agrees with 1 nm quadrature',()=>{
 const bytes=readFileSync(new URL('../../../static/site/scene/data/ice-spectrum.bin',import.meta.url));const stored=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),fresh=spectrum();assert.deepEqual(stored,fresh);
 for(let G=0;G<=2200;G+=3.7){const x=G/2200*2047,i=Math.floor(x),f=x-i,ref=integral(G,1);for(let k=0;k<3;k++)near(stored[i*4+k]*(1-f)+stored[Math.min(i+1,2047)*4+k]*f,ref[k],.005);}
});
// Retired with the ice transition: Racing now plays dew-plan.js, and its hold releases at GLASS_RELEASE.
test.skip('cinematic hold releases at P=.88 on desktop and touch; heading enters fully cleared ice',()=>{
 for(const p of plans){const pin=p.phone?HOLD.pinTouch:HOLD.pin,L=holdFor('glass',pin),H=p.H*(1+pin*L.pin),T=4000;const release=T+H-p.H;
  near(transitP(holdEase(holdAt(release,T,H,p.H,L.leadIn,L.leadOut).p)),.88,1e-12);
  for(let sy=T-L.leadIn*p.H;sy<release;sy+=13){const {y,p:raw}=holdAt(sy,T,H,p.H,L.leadIn,L.leadOut),P=transitP(holdEase(raw));if(y>0){const q=[p.W/2,y];assert.ok(coldAt(p,q)-.045>=P-1e-6,`exposed edge cool at ${p.W},${P}`);}}
  for(let delta=.12*p.H;delta<L.leadOut*p.H;delta+=7){const P=transitP(holdEase(holdAt(release+delta,T,H,p.H,L.leadIn,L.leadOut).p)),y=p.H-delta+.10*p.H;for(let x=0;x<p.W*.5;x+=19)assert.equal(clearAt(p,[x,y],P),1);}
 }
});
test('radial click begins uncovered, swaps fully covered, and ends clear for corner and keyboard origins',()=>{
 for(const p of plans)for(const O of [[0,0],[p.W/2,p.H/2],[p.W-1,p.H-1]])for(let y=0;y<=p.H;y+=73)for(let x=0;x<=p.W;x+=79){const q=[x,y],A=arrivalAt(p,q,ownerAt(p,q),O);assert.ok(A+ICE.fill<.72);assert.equal(clearAt(p,q,.84,O),0);assert.equal(clearAt(p,q,1.12,O),1);}
});

test('nested facets: rings within 8% of the relief, a continuous cut, flat at every grain boundary',()=>{
 for(const p of plans){
  for(const g of p.grains){assert.deepEqual(g.rings,ICE_RINGS(p.phone));g.ringH.forEach(hs=>hs.forEach((h,r)=>assert.ok(Math.abs(h-(ICE_BASE+ICE_RELIEF*(1-g.rings[r])))<=.08*ICE_RELIEF+1e-9)));
   // Neighbouring grains meet at the base height: just inside each edge the cut is within slope × step of it.
   g.poly.forEach((v,k)=>{const w=g.poly[(k+1)%g.poly.length],m=[(v[0]+w[0])/2,(v[1]+w[1])/2],e=[w[0]-v[0],w[1]-v[1]],L=Math.hypot(...e),n=[-e[1]/L,e[0]/L];
    for(const s of [1,-1]){const q=[m[0]+n[0]*s*.01,m[1]+n[1]*s*.01];if(q[0]<0||q[1]<0||q[0]>p.W||q[1]>p.H)continue;const f=facetAt(p,q);near(f.height,ICE_BASE,.01*Math.hypot(...f.gradient)+1e-6);}});
  }
  // Continuity along scan lines: no step larger than the local slope allows.
  for(let y=7.3;y<p.H;y+=p.H/9)for(let x=1;x<p.W-1;x+=.61){const a=facetAt(p,[x,y]),b=facetAt(p,[x+.003,y]);assert.ok(Math.abs(b.height-a.height)<=Math.max(Math.hypot(...a.gradient),Math.hypot(...b.gradient))*.003+1e-6);assert.ok(a.height>=ICE_BASE-1e-9&&a.height<=ICE_BASE+ICE_RELIEF+1e-9);}
  // Gradients are the planes' own: finite differences inside a facet agree.
  for(let i=0;i<300;i++){const q=[(i*137.71)%p.W,(i*91.37)%p.H],f=facetAt(p,q),e=1e-3;const fx=facetAt(p,[q[0]+e,q[1]]),bx=facetAt(p,[q[0]-e,q[1]]),fy=facetAt(p,[q[0],q[1]+e]),by=facetAt(p,[q[0],q[1]-e]);
   if([fx,bx,fy,by].every(o=>o.facet.join()===f.facet.join())){near((fx.height-bx.height)/(2*e),f.gradient[0],1e-6);near((fy.height-by.height)/(2*e),f.gradient[1],1e-6);}}
 }
});
test('fracture lists cover each lip\'s bounded glow; junction flares sit on principal branchings',()=>{
 for(const p of plans){const index=tileCandidates(p),glow=ICE_GLOW(p.phone);
  for(let y=2;y<p.H;y+=17)for(let x=3;x<p.W;x+=19){const tile=index.tiles[Math.floor(y/ICE.tile)*index.cols+Math.floor(x/ICE.tile)];
   p.cracks.forEach((e,i)=>{const v=[e.b[0]-e.a[0],e.b[1]-e.a[1]],L2=v[0]*v[0]+v[1]*v[1],t=Math.max(0,Math.min(1,((x-e.a[0])*v[0]+(y-e.a[1])*v[1])/L2)),d=Math.hypot(x-e.a[0]-v[0]*t,y-e.a[1]-v[1]*t);if(d<=e.width+glow)assert.ok(tile.cracks.includes(i));});}
  const flares=p.cracks.filter(e=>iceFlare(p,e));assert.ok(flares.length>=2&&flares.length<=(p.phone?8:16));
  for(const e of flares){const parent=p.cracks[e.parent];near(distance(e.a,parent.b),0,1e-5);assert.ok(e.start>=parent.finish);assert.ok(e.gen>parent.gen);}
  const pack=packIce(p),crackBase=pack.data[2*4+1];p.cracks.forEach((e,i)=>assert.equal(pack.data[(crackBase+i*3+2)*4+3],iceFlare(p,e)?1:0));
 }
});
