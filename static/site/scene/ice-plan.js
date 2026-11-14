// Ice, illuminated: seeded ARTISTIC growth/fracture geometry, not a thermodynamic solver.
// All coordinates are CSS pixels. Plans and atlases are prepared by ice-worker.js, never per frame.
export const ICE = Object.freeze({ seed: 29, tile: 64, atlas: 128, fill: .055, fractureWait: .025,
  open: .018, end: .84, clear0: .84, clearUp: .18, clearD: .08, grains: 48, phoneGrains: 24 });
export const clamp = (x,a=0,b=1)=>Math.max(a,Math.min(b,x));
// A grain's cut: base height at its boundary, relief to its nucleus, interior rings (fractions of
// the way from nucleus to boundary).
export const ICE_GLOW=phone=>phone?4:6;
export const ICE_BASE=5, ICE_RELIEF=18, ICE_RINGS=phone=>phone?[.55]:[.38,.72];
export const smooth = x => {x=clamp(x);return x*x*(3-2*x);};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k];
const len=a=>Math.hypot(...a), dist=(a,b)=>len(sub(a,b));
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function clip(poly,n,k){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=dot(a,n)-k,db=dot(b,n)-k;if(da<=1e-7)out.push(a);if((da<0)!==(db<0))out.push(add(a,mul(sub(b,a),da/(da-db))));}return out;}
export function ownerAt(plan,q,candidates){let best=Infinity,id=0;for(const i of candidates??plan.grains.map((_,i)=>i)){const d=dot(sub(q,plan.grains[i].n),sub(q,plan.grains[i].n));if(d<best){best=d;id=i;}}return id;}
function rayLimit(poly,a,dir,L){let t=L;for(let i=0;i<poly.length;i++){const p=poly[i],b=poly[(i+1)%poly.length],e=sub(b,p);const n=[e[1],-e[0]],v=dot(dir,n);if(v>1e-10)t=Math.min(t,Math.max(0,dot(sub(p,a),n)/v));}return t;}
function bounds(poly){const x=Math.min(...poly.map(p=>p[0])),y=Math.min(...poly.map(p=>p[1]));return[x,y,Math.max(...poly.map(p=>p[0]))-x,Math.max(...poly.map(p=>p[1]))-y];}
// Exact min of tau(s)+distance/vFill on a segment, with vTip = 1 and vFill = .28.
export function segmentArrival(q,e){const v=sub(e.b,e.a),L=len(v),u=mul(v,1/Math.max(L,1e-9)),p=sub(q,e.a),x=dot(p,u),h=Math.sqrt(Math.max(0,dot(p,p)-x*x));const s=clamp(x-h*.28/Math.sqrt(1-.28**2),0,L);return e.t+s+dist(q,add(e.a,mul(u,s)))/.28;}
export function localArrival(g,q){
 let t=Math.hypot(q[0]-g.n[0],q[1]-g.n[1])/.28,sk=Infinity;
 for(const e of g.arms){
  const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],L=Math.hypot(dx,dy);if(L<1e-8)continue;
  const px=q[0]-e.a[0],py=q[1]-e.a[1],x=(px*dx+py*dy)/L,h=Math.sqrt(Math.max(0,px*px+py*py-x*x));
  const s=clamp(x-h*.28/Math.sqrt(1-.28**2),0,L);
  t=Math.min(t,e.t+s+Math.hypot(x-s,h)/.28);sk=Math.min(sk,Math.hypot(x-clamp(x,0,L),h));
 }return[t*g.rate,sk];
}
export const iceFar = (plan,origin) => Math.hypot(Math.max(origin[0],plan.W-origin[0]),Math.max(origin[1],plan.H-origin[1]));
export function coldAt(plan,q,origin){return -.18+.62*(origin?dist(q,origin)/iceFar(plan,origin):1-q[1]/plan.H);}
export function birthAt(plan,g,origin){return -.11+.39*(origin?dist(g.n,origin)/iceFar(plan,origin):1-g.n[1]/plan.H)+g.lag;}
export function arrivalAt(plan,q,id=ownerAt(plan,q),origin=plan.origin){const g=plan.grains[id];return Math.max(coldAt(plan,q,origin),birthAt(plan,g,origin)+localArrival(g,q)[0]);}
export function clearAt(plan,q,P,origin=plan.origin){const up=origin?dist(q,origin)/iceFar(plan,origin):1-q[1]/plan.H;const n=.006*Math.sin(q[0]*.008)*Math.sin(q[1]*.007)*(origin?up:1);return smooth((P-ICE.clear0-ICE.clearUp*up-n)/ICE.clearD);}
export function crackOpen(e,P,s=1){return smooth((P-e.start-(e.finish-e.start)*s)/ICE.open);}
export function spectralTransmission(G,phi,alpha,lambda){return Math.cos(alpha)**2-Math.sin(2*phi)*Math.sin(2*(phi-alpha))*Math.sin(Math.PI*G/lambda)**2;}
function intersect(a,b,c,d){const r=sub(b,a),s=sub(d,c),den=cross(r,s);if(Math.abs(den)<1e-8)return null;const t=cross(sub(c,a),s)/den,u=cross(sub(c,a),r)/den;return t>1e-5&&t<=1&&u>=0&&u<=1?{t,u,p:add(a,mul(r,t))}:null;}
export function makeIcePlan(W,H,{seed=ICE.seed,phone=W<700,origin=null}={}){
  const random=rng(seed),N=phone?24:48,heroes=phone?2:3,grains=[];
  const r0=Math.sqrt(W*H/N)*.31;
  for(let i=0;i<N;i++){
    let n,exclusion=i<heroes?r0*3.5:r0;
    if(i<heroes){const p=[[.24,.79],[.73,.49],[.38,.18]][i];n=[W*(p[0]+(random()-.5)*.045),H*(p[1]+(random()-.5)*.045)];}
    else{let score=-1;for(let j=0;j<384;j++){const p=[W*(.025+.95*random()),H*(.02+.96*random())];const s=Math.min(...grains.map(g=>dist(p,g.n)/(exclusion+g.exclusion)));if(s>score){score=s;n=p;}}}
    grains.push({n,exclusion,hero:i<heroes,phi:random()*Math.PI,angle:random()*Math.PI/3,lag:random()*.035,arms:[]});
  }
  const plan={W,H,seed,phone,origin,far:origin?Math.hypot(Math.max(origin[0],W-origin[0]),Math.max(origin[1],H-origin[1])):Math.hypot(W,H),grains,cracks:[],glints:[]};
  for(let i=0;i<N;i++){
    const g=grains[i];let poly=[[0,0],[W,0],[W,H],[0,H]];
    for(let j=0;j<N;j++)if(j!==i){const h=grains[j];poly=clip(poly,sub(h.n,g.n),(dot(h.n,h.n)-dot(g.n,g.n))/2);}
    g.poly=poly;g.box=bounds(poly);g.radius=Math.max(...poly.map(p=>dist(p,g.n)));
    for(let k=0;k<6;k++){
      const angle=g.angle+k*Math.PI/3,u=[Math.cos(angle),Math.sin(angle)],L=rayLimit(poly,g.n,u,g.radius);
      g.arms.push({a:g.n,b:add(g.n,mul(u,L)),t:0,parent:-1});const trunk=g.arms.length-1;
      for(let station=1;station<=4;station++)for(const sign of [-1,1]){
        const s=L*station/5,a=add(g.n,mul(u,s)),v=[Math.cos(angle+sign*Math.PI/3),Math.sin(angle+sign*Math.PI/3)];
        const l=rayLimit(poly,a,v,(L-s)*(.48+.18*random()));if(l>1)g.arms.push({a,b:add(a,mul(v,l)),t:s,parent:trunk});
      }
    }
    // Nested facets: rings of interior vertices on the rays to the cell's vertices (homothetic to the
    // cell), their heights seeded within 8% of the grain's relief. Shared by every triangle that uses
    // them; the cell's boundary stays at the base height, so neighbouring grains meet continuously.
    const ringRandom=rng(seed*7919+i*104729);
    g.rings=ICE_RINGS(phone);
    g.ringH=poly.map(()=>g.rings.map(f=>ICE_BASE+ICE_RELIEF*(1-f)+(ringRandom()-.5)*2*.08*ICE_RELIEF));
    g.rate=1;
    // Distance envelopes are bounded by nucleus-fill; using the farthest vertex is conservative.
    g.rate=.18/(g.radius/.28);
    // localArrival is (.18/radius)-Lipschitz. Bilinear interpolation's expected sample
    // distance is bounded by half a texel diagonal, plus float upload/arithmetic allowance.
    g.atlasError=.5*Math.hypot(g.box[2],g.box[3])/(ICE.atlas-1)*.18/g.radius+1e-5;
  }
  const maxSegments=phone?768:1536,generations=phone?3:4;
  let contacts=0;
  // Reserve a bounded subdivision quota for each limb so later generations retain budget.
  // Midpoint amplitudes use the original limb length at every scale.
  function rough(a,b,depth=0,originalLength=dist(a,b)){const v=sub(b,a),L=len(v);if(depth>=4||L<2)return[a,b];const mid=mul(add(a,b),.5),offset=(random()-.5)*2*.08*originalLength*2**(-.72*depth),m=add(mid,mul([-v[1],v[0]],offset/Math.max(L,1)));const l=rough(a,m,depth+1,originalLength),r=rough(m,b,depth+1,originalLength);return[...l.slice(0,-1),...r];}
  function grow(a,angle,L,width,depth,gen,grain,parent,principal,rootTime){
    if(L<3||gen>=generations||plan.cracks.length+contacts+16>maxSegments)return;
    const g=grains[grain],dir=[Math.cos(angle),Math.sin(angle)],reach=rayLimit(g.poly,a,dir,L),ends=rough(a,add(a,mul(dir,reach)));
    let last=parent,stopped=false,mid=-1;
    for(let j=1;j<ends.length;j++){
      let aa=ends[j-1],bb=ends[j];
      // Roughening must also respect the containing grain.
      const vv=sub(bb,aa),ll=len(vv);if(ll<.01)continue;
      const clipped=rayLimit(g.poly,aa,mul(vv,1/ll),ll);if(clipped<ll-.001){bb=add(aa,mul(vv,clipped/ll));stopped=true;}
      let hit=null;
      for(let k=0;k<plan.cracks.length;k++){if(k===last)continue;const old=plan.cracks[k],h=intersect(aa,bb,old.a,old.b);if(h&&(!hit||h.t<hit.t))hit={...h,id:k};}
      if(hit){bb=hit.p;stopped=true;contacts++;}
      const length=dist(aa,bb);if(length<.02)break;
      let start=last<0?rootTime:plan.cracks[last].finish;
      // Sample + Lipschitz allowance bounds arrival over the whole edge, not just endpoints.
      let frozen=-Infinity;const samples=Math.max(2,Math.ceil(length/2));
      for(let k=0;k<=samples;k++){const p=add(aa,mul(sub(bb,aa),k/samples));frozen=Math.max(frozen,arrivalAt(plan,p));}
      const allowance=Math.max(.62/H,.18/g.radius)*length/samples;
      start=Math.max(start,frozen+ICE.fill+ICE.fractureWait+g.atlasError+allowance);
      const finish=start+length/(Math.max(W,H)*5);
      if(finish+ICE.open>ICE.end)break;
      const e={a:aa,b:bb,width,depth,gen,grain,parent:last,start,finish,hit:hit?.id??-1,principal};
      plan.cracks.push(e);last=plan.cracks.length-1;if(j===Math.floor(ends.length*.55))mid=last;
      if(stopped)break;
    }
    if(last===parent)return;
    if(mid<0)mid=last;
    const tip=plan.cracks[last].b;
    // A principal crossing is an explicit shared vertex, then a deflected continuation.
    if(principal&&!stopped&&reach<L-.1){const next=ownerAt(plan,add(tip,mul(dir,.1)));if(next!==grain)grow(tip,angle+(random()-.5)*.22,L*.6,width*.9,depth*.9,gen+1,next,last,true,rootTime);}
    grow(tip,angle+(random()-.5)*.42,L*(.55+.17*random()),width*.62,depth*.70,gen+1,grain,last,false,rootTime);
    const fork=plan.cracks[mid].b,sign=random()<.5?-1:1;
    grow(fork,angle+sign*(25+30*random())*Math.PI/180,L*(.55+.17*random()),width*.62,depth*.70,gen+1,grain,mid,false,rootTime);
  }
  // Principal systems get the budget first; small systems follow.
  for(let i=0;i<N;i++)if(i<heroes||random()<.33){const g=grains[i],a=add(g.n,[g.radius*.06,g.radius*.03]);const start=.52+.16*(1-g.n[1]/H);grow(a,g.angle+(random()-.5)*24*Math.PI/180,g.radius*(g.hero?1.6:.95),phone?1.4:2.2,g.hero?6:3,0,i,-1,g.hero,start);}
  // Split contacted edges at every shared junction. The resulting topology has exact shared
  // endpoints, while preserving each edge's arc-length schedule and parent arrival.
  const original=plan.cracks,cuts=original.map(()=>[]),pieces=[];
  original.forEach(e=>{if(e.hit>=0)cuts[e.hit].push(e.b);});
  original.forEach((e,id)=>{
    const L=dist(e.a,e.b),points=cuts[id].filter(p=>dist(p,e.a)>1e-5&&dist(p,e.b)>1e-5)
      .sort((a,b)=>dist(a,e.a)-dist(b,e.a));
    const unique=points.filter((p,i)=>!i||dist(p,points[i-1])>1e-5);
    const route=[e.a,...unique,e.b],ids=[];
    for(let k=1;k<route.length;k++){
      ids.push(pieces.length);
      pieces.push({...e,a:route[k-1],b:route[k],start:e.start+(e.finish-e.start)*dist(e.a,route[k-1])/L,
        finish:e.start+(e.finish-e.start)*dist(e.a,route[k])/L,parent:k>1?pieces.length-1:e.parent,originalParent:k===1?e.parent:-1,hit:-1});
    }
    e.pieces=ids;
  });
  pieces.forEach(e=>{if(e.originalParent>=0)e.parent=original[e.originalParent].pieces.at(-1);delete e.originalParent;});
  original.forEach(e=>{if(e.hit>=0){const junction=original[e.hit].pieces.find(i=>dist(pieces[i].b,e.b)<1e-5);pieces[e.pieces.at(-1)].hit=junction??original[e.hit].pieces.at(-1);}});
  plan.cracks=pieces;
  // Three disjoint waves, at most 6/3 glints alive at a time; all supported by opened geometry.
  const slots=phone?3:6,candidates=plan.cracks.map((e,i)=>({e,i})).filter(({e})=>e.gen<2).sort((a,b)=>a.e.finish-b.e.finish);
  for(let wave=0;wave<3;wave++)for(let j=0;j<slots;j++){
    const start=.68+wave*.053,ok=candidates.filter(({e})=>e.finish+ICE.open<=start);
    if(!ok.length)continue;const c=ok[Math.floor((j+.5)/slots*ok.length)];plan.glints.push({p:c.e.b,start,end:start+.045,edge:c.i});
  }
  return plan;
}
// Conservative exact grain candidates: distance-to-box lower bounds and a corner upper bound.
// Crack lists contain every expanded segment AABB intersecting the tile. No fixed list cap.
export function tileCandidates(plan){const {W,H,grains,cracks}=plan,cols=Math.ceil(W/ICE.tile),rows=Math.ceil(H/ICE.tile),tiles=[];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const lo=[x*ICE.tile,y*ICE.tile],hi=[Math.min(W,lo[0]+ICE.tile),Math.min(H,lo[1]+ICE.tile)];
  const corners=[lo,hi,[lo[0],hi[1]],[hi[0],lo[1]]];
  const upper=Math.min(...grains.map(g=>Math.max(...corners.map(q=>dist(q,g.n)))));
  const ids=[];grains.forEach((g,i)=>{if(dist(g.n,[clamp(g.n[0],lo[0],hi[0]),clamp(g.n[1],lo[1],hi[1])])<=upper+1e-4)ids.push(i);});
  const edges=[];cracks.forEach((e,i)=>{const r=e.width+ICE_GLOW(plan.phone)+1;if(Math.min(e.a[0],e.b[0])-r<=hi[0]&&Math.max(e.a[0],e.b[0])+r>=lo[0]&&Math.min(e.a[1],e.b[1])-r<=hi[1]&&Math.max(e.a[1],e.b[1])+r>=lo[1])edges.push(i);});
  tiles.push({grains:ids,cracks:edges});
 }return{cols,rows,tiles};}
// A junction flares when a branch leaves a principal path there: its first piece starts at its
// parent's end, a generation deeper. Shared by the shader (packed flag) and the tests.
export const iceFlare=(plan,e)=>e.parent>=0&&e.gen<=2&&plan.cracks[e.parent].gen<e.gen&&plan.cracks[e.parent].principal!==false&&(e.principal||plan.cracks[e.parent].gen===0);
export function packIce(plan){
 const {grains,cracks}=plan,tile=tileCandidates(plan),A=ICE.atlas,cols=8,rows=Math.ceil(grains.length/cols),aw=cols*(A+2),ah=rows*(A+2),atlas=new Float32Array(aw*ah*4);
 for(let id=0;id<grains.length;id++){const g=grains[id],ox=(id%cols)*(A+2),oy=Math.floor(id/cols)*(A+2);g.atlas=[ox+1,oy+1];
  for(let y=-1;y<=A;y++)for(let x=-1;x<=A;x++){const q=[g.box[0]+clamp(x,0,A-1)/(A-1)*g.box[2],g.box[1]+clamp(y,0,A-1)/(A-1)*g.box[3]],v=localArrival(g,q),k=((oy+y+1)*aw+ox+x+1)*4;atlas.set([v[0],v[1],0,1],k);}
 }
 // Header: tile dimensions; fixed metadata blocks then tile headers and variable index lists.
 const cells=[[plan.W,plan.H,tile.cols,tile.rows],[grains.length,cracks.length,plan.glints.length,plan.phone?1:0],[0,0,0,0],[0,0,0,0]];
 const grainBase=cells.length;
 for(const g of grains)cells.push([...g.n,g.phi,g.angle],g.box,[...g.atlas,g.lag,g.hero?1:0],[g.radius,g.rate,0,0]);
 // The cut: one cell per polygon vertex, its position and its ring vertices' heights.
 grains.forEach((g,id)=>{
  const start=cells.length;
  g.poly.forEach((v,i)=>cells.push([v[0],v[1],g.ringH[i][0],g.ringH[i][1]??0]));
  cells[grainBase+id*4+3][2]=start;cells[grainBase+id*4+3][3]=g.poly.length;
 });
 const crackBase=cells.length;
 for(const e of cracks)cells.push([...e.a,...e.b],[e.start,e.finish,e.width,e.depth],[e.gen,e.grain,e.parent,iceFlare(plan,e)?1:0]);
 const glintBase=cells.length;for(const e of plan.glints)cells.push([...e.p,e.start,e.end]);
 const tileBase=cells.length;for(const t of tile.tiles)cells.push([0,0,0,0]);
 tile.tiles.forEach((t,i)=>{const a=cells.length;for(const id of t.grains)cells.push([id,0,0,0]);const b=cells.length;for(const id of t.cracks)cells.push([id,0,0,0]);cells[tileBase+i]=[a,t.grains.length,b,t.cracks.length];});
 cells[2]=[grainBase,crackBase,glintBase,tileBase];cells[3]=[aw,ah,A,ICE.tile];
 const width=1024,height=Math.ceil(cells.length/width),data=new Float32Array(width*height*4);cells.forEach((v,i)=>data.set(v,i*4));
 return{width,height,data,aw,ah,atlas,stats:{grains:grains.length,cracks:cracks.length,glints:plan.glints.length,bytes:data.byteLength+atlas.byteLength,maxCrackCandidates:Math.max(...tile.tiles.map(t=>t.cracks.length))}};
}
// Reference surface in material height units (2.2 CSS px vertically per unit), the same planar
// triangles as ice.js iceFacet: the sector between the rays to two neighbouring vertices, then its
// band between rings (homothetic, so a band is a fraction t of the way to the boundary), then the
// half of that band's quad on q's side of its diagonal. Returns height, gradient, and the facet.
const planeOf=(p0,h0,p1,h1,p2,h2,q)=>{const a=sub(p1,p0),b=sub(p2,p0),det=cross(a,b),d1=h1-h0,d2=h2-h0,gx=(d1*b[1]-d2*a[1])/det,gy=(d2*a[0]-d1*b[0])/det;return{height:h0+gx*(q[0]-p0[0])+gy*(q[1]-p0[1]),gradient:[gx,gy]};};
export function facetAt(plan,q){
 const id=ownerAt(plan,q),g=plan.grains[id],N=g.n,dq=sub(q,N),n=g.poly.length,rings=g.rings;
 let k=0;for(let j=0;j<n;j++){const a=g.poly[j],b=g.poly[(j+1)%n];if(cross(sub(a,N),dq)>=0&&cross(dq,sub(b,N))>=0){k=j;break;}}
 const Va=g.poly[k],Vb=g.poly[(k+1)%n],e=sub(Vb,Va),inward=mul([-e[1],e[0]],1/len(e)),dN=dot(sub(N,Va),inward),t=1-dot(sub(q,Va),inward)/dN;
 const at=(V,f)=>add(N,mul(sub(V,N),f)),top=ICE_BASE+ICE_RELIEF;
 const pts=[[N,top,N,top]];rings.forEach((f,r)=>pts.push([at(Va,f),g.ringH[k][r],at(Vb,f),g.ringH[(k+1)%n][r]]));pts.push([Va,ICE_BASE,Vb,ICE_BASE]);
 let band=0;while(band<rings.length&&t>=rings[band])band++;
 const [A,hA,B,hB]=pts[band],[C,hC,D,hD]=pts[band+1];
 let face,half=0;
 if(band===0)face=planeOf(N,top,C,hC,D,hD,q);
 else{const side=cross(sub(D,A),sub(q,A)),ref=cross(sub(D,A),sub(B,A));half=side*ref>=0?0:1;face=half?planeOf(A,hA,D,hD,C,hC,q):planeOf(A,hA,B,hB,D,hD,q);}
 return{...face,facet:[id,k,band,half]};
}
export function fractureAt(plan,q,P,candidates){const facet=facetAt(plan,q);let groove=0,gradient=[0,0];for(const index of candidates??plan.cracks.map((_,i)=>i)){const e=plan.cracks[index],v=sub(e.b,e.a),L=len(v),u=mul(v,1/L),projection=dot(sub(q,e.a),u),along=clamp(projection,0,L),s=along/L,delta=sub(q,add(e.a,mul(u,along))),d=len(delta),z=clamp((P-e.start-(e.finish-e.start)*s)/ICE.open),open=smooth(z),depth=Math.min(e.depth,facet.height*.65),cut=depth*Math.max(0,open-d/e.width);if(cut>groove){groove=cut;const dop=-6*z*(1-z)*(e.finish-e.start)/(ICE.open*L);gradient=mul(sub(mul(u,projection>=0&&projection<=L?dop:0),mul(delta,1/Math.max(.001,d)/e.width)),depth);if(e.depth>facet.height*.65)gradient=add(gradient,mul(facet.gradient,.65*Math.max(0,open-d/e.width)));}}return{height:facet.height-groove,groove,gradient:sub(facet.gradient,gradient)};}
