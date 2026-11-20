// Register each density study to the lathe or carved head it becomes. Height
// anchors identify the same collar, crown, muzzle and foot in both materials.
import { TALL, TYPES, DETAIL, bodyOf, headOf, crossings, fromY, toR } from './staunton.js';

const charts=[
  {height:[[0,.902],[.13,.790],[.55,.417],[.77,.261],[.92,.133],[1,.065]],
    edges:[48,52,48,52,44,53,45,57,48,54,38,63,44,60,44,57,42,60,43,58,45,56,45,56,44,57,45,56,40,61,37,62,38,66,36,66,34,68,48,52,48,52]},
  {height:[[0,.899],[.15,.793],[.55,.426],[.81,.273],[.925,.157],[1,.086]],
    edges:[48,52,48,52,48,52,38,61,33,67,36,64,37,63,42,59,41,58,42,59,44,54,45,54,48,57,44,59,38,59,35,64,34,66,32,68,28,73,48,52,48,52]},
  {height:[[0,.897],[.15,.798],[.52,.492],[.77,.315],[.91,.160],[1,.078]],
    edges:[48,52,48,52,46,53,47,52,42,57,39,61,36,62,35,61,37,61,42,56,36,61,42,57,43,54,42,57,39,55,37,62,32,65,34,69,32,66,48,52,48,52]},
  {height:[[0,.955],[.19,.790],[.36,.635],[.535,.507],[.755,.249],[.89,.136],[1,.030]],
    edges:[60,68,31,70,30,68,18,69,18,72,22,75,13,78,21,80,13,83,11,87,11,87,12,84,15,64,28,70,26,75,16,80,24,78,23,69,21,64,27,63,60,68]},
  {height:[[0,.874],[.18,.759],[.61,.406],[.85,.281],[1,.141]],
    edges:[48,52,48,52,48,52,33,71,34,71,34,69,42,71,42,63,38,66,41,63,44,63,42,63,39,62,35,59,36,57,37,70,31,70,31,75,37,71,48,52,48,52]},
  {height:[[0,.863],[.17,.738],[.615,.435],[.69,.372],[.839,.253],[1,.122]],
    edges:[48,52,48,52,48,52,39,54,36,61,35,63,35,60,38,59,40,57,35,61,41,55,40,56,40,58,35,63,31,67,29,69,28,71,32,74,50,56,48,52,48,52]},
  {height:[[0,.880],[.17,.741],[.615,.407],[.69,.350],[.839,.234],[1,.113]],
    edges:[48,52,48,52,45,52,39,59,40,61,34,62,36,60,40,55,35,60,41,55,42,56,40,57,41,66,34,64,26,70,24,72,28,75,25,76,29,48,48,52,48,52]}
];
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
    for(const [x,j,r,half] of DETAIL.cross)if(Math.abs(y-j)<=half){
      lo=Math.min(lo,x-r);hi=Math.max(hi,x+r);depth=Math.max(depth,DETAIL.crossDepth);
    }
  }else if(type==='Q'||type==='B'){
    const balls=type==='B'?[[0,...DETAIL.finial]]:[DETAIL.coronet,[0,...DETAIL.crown]];
    for(const [offset,j,r] of balls)if(Math.abs(y-j)<r)radius=Math.max(radius,offset+Math.sqrt(r*r-(y-j)**2));
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
