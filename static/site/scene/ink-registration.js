// Register each density study to the lathe or carved head it becomes. Height
// anchors identify the same collar, crown, muzzle and foot in both materials.
import { TALL, TYPES, DETAIL, bodyOf, headOf, crossings, fromY, toR } from './staunton.js';
import { INK_CHARTS } from './staunton-ink.js';

// Measured with the solids themselves (tools/site/ink_profiles.mjs): each study's height in its solid's,
// and its wet outline every twentieth of its height.
const charts=INK_CHARTS;
const count=160;
export const registrationRank=(type,id)=>type===5?5+(Math.floor(id/2)%2):type;
const mix=(a,b,t)=>a+(b-a)*t;
function heightMap(chart,value,from){
  const to=1-from,knots=chart.height;
  let i=1;
  while(i<knots.length-1 && (from===0?value>knots[i][0]:value<knots[i][1]))i++;
  const a=knots[i-1],b=knots[i];
  return mix(a[to],b[to],(value-a[from])/(b[from]-a[from]));
}
function bounds(type,body,head,y){
  const xs=crossings(body,fromY(y));
  let radius=xs.length?Math.max(toR(xs[xs.length-1]),-toR(xs[0]),0):0;
  let lo=-radius,hi=radius,depth=radius;
  if(type==='N'){
    const face=crossings(head,fromY(y));
    if(face.length>=2){
      lo=Math.min(radius?lo:Infinity,toR(face[0]));hi=Math.max(radius?hi:-Infinity,toR(face[face.length-1]));
      depth=Math.max(depth,.103-.023*y/TALL.N);
    }
  }else if(type==='K'){
    // The cross pattée: its upright, and its arms about their centre.
    const [cy,L,hm,,top,wt,,ft,thick]=DETAIL.cross;
    if(y>=ft && y<=top){lo=Math.min(lo,-wt);hi=Math.max(hi,wt);depth=Math.max(depth,thick);}
    if(Math.abs(y-cy)<=hm){lo=Math.min(lo,-L);hi=Math.max(hi,L);depth=Math.max(depth,thick);}
  }else if(type==='Q'){
    // The tines splay from the rim to their pearls.
    const [reach,py,pr,rimR,rimY]=DETAIL.tines;
    if(y>=rimY && y<=py+pr)radius=Math.max(radius,rimR*.9+(reach-rimR*.9)*Math.min(1,(y-rimY)/(py-rimY))+(y>py-pr?pr:.012));
    lo=-radius;hi=radius;depth=radius;
  }
  return [lo,hi,depth];
}
export function buildInkRegistration(){
  // Two adjacent rows per portrait. The first gives the model and optical
  // horizontal intervals. The second records the atlas ordinate and chord.
  const data=new Float32Array(4*count*2*charts.length),head=headOf();
  charts.forEach((chart,rank)=>{
    const type=TYPES[Math.min(rank,5)],body=bodyOf(type);
    for(let i=0;i<count;i++){
      const height=i/(count-1),v=heightMap(chart,height,0);
      const row=Math.max(0,Math.min(19,Math.floor(v*20))),frac=v*20-row;
      const u0=mix(chart.edges[row*2],chart.edges[row*2+2],frac)*.01;
      const u1=mix(chart.edges[row*2+1],chart.edges[row*2+3],frac)*.01;
      const [lo,hi,depth]=bounds(type,body,head,Math.max(.0001,Math.min(TALL[type]-.0001,height*TALL[type])));
      // The last sample may only touch an ear or finial. Maintain an
      // invertible section even when its physical width falls below a pixel.
      const center=(lo+hi)*.5,half=Math.max(.012,(hi-lo)*.5);
      const beg=4*(2*rank*count+i);
      data.set([center-half,center+half,u0,u1],beg);
      data.set([v,depth,0,0],beg+count*4);
    }
  });
  return {width:count,height:charts.length*2,data};
}
export function modelSection(table,rank,v){
  const h=heightMap(charts[rank],v,1),x=Math.max(0,Math.min(count-1,h*(count-1)));
  const i=Math.min(count-2,Math.floor(x)),base=4*(2*rank*count+i);
  const read=n=>mix(table.data[base+n],table.data[base+4+n],x-i);
  return {height:h,lo:read(0),hi:read(1),u0:read(2),u1:read(3),depth:read(4*count+1)};
}
