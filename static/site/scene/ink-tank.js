// Tank coordinates are horizontal position, distance below the free surface,
// and distance from the back of the bath towards the camera. Screen Y points up.
export const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const CAMERA={start:.416,end:.565,above:[.30,.60,.76,0],below:[1.072,.092,.99,1]};
// The drain's first part (ink-drain.js D1): the surface falls as it rose. A
// level just below zero carries the near meniscus, crests included, past the
// bottom of the screen; the board's own plane then takes the surface over.
export const DRAIN=Object.freeze([1.04,1.105]);
const emptyLevel=-.04;
const tiltTakeup=.10;
const perspective=.66;
export function tankCamera(P){
  const level=smooth(CAMERA.start,CAMERA.end,P)+(emptyLevel-1)*smooth(...DRAIN,P);
  // Ease the first few degrees of pitch into a level camera track. Its
  // vertical velocity continues through the original opening height.
  const u=Math.max(0,Math.min(1,level/tiltTakeup));
  const pitch=level<tiltTakeup?tiltTakeup*u*u*(2-u):level;
  return CAMERA.above.map((v,i)=>mix(v,CAMERA.below[i],i===0?level:pitch));
}
function cameraDistance(z,view){return 1+perspective*(1-view[3])*(1-z);}
export function projectTank(x,d,z,view,aspect){
  const w=cameraDistance(z,view);
  return [.5+(x-.5)*(1+.22*(1-view[3]))/w+(z-.5)*.072*view[3]/Math.max(1,aspect),
    view[0]+view[1]*(.5-z/w)-d*view[2]/w,.22+.60*z-.13*d];
}
export const TANK_GLSL=`
float tankW(float z,vec4 cam){return 1.+${perspective}*(1.-cam.w)*(1.-z);}
vec3 tankPoint(vec3 p,vec4 cam,float aspect){
  float w=tankW(p.z,cam);
  return vec3(.5+(p.x-.5)*(1.+.22*(1.-cam.w))/w+(p.z-.5)*.072*cam.w/max(1.,aspect),
    cam.x+cam.y*(.5-p.z/w)-p.y*cam.z/w,.22+.60*p.z-.13*p.y);
}
vec2 waterXZ(vec2 uv,vec4 cam,float aspect){
  float fraction=clamp((cam.x+.5*cam.y-uv.y)/cam.y,0.,1.);
  float k=${perspective}*(1.-cam.w),z=fraction*(1.+k)/(1.+k*fraction);
  return vec2(.5+(uv.x-.5-(z-.5)*.072*cam.w/max(1.,aspect))*tankW(z,cam)/(1.+.22*(1.-cam.w)),z);
}
// The same plane continued behind its far wall toward its horizon: the drain's
// open far side (ink-drain.js). In front of the near meniscus it stops at the glass.
vec2 waterXZOpen(vec2 uv,vec4 cam,float aspect){
  float k=${perspective}*(1.-cam.w);
  float fraction=clamp((cam.x+.5*cam.y-uv.y)/cam.y,-.98/max(k,.001),1.);
  float z=fraction*(1.+k)/(1.+k*fraction);
  return vec2(.5+(uv.x-.5-(z-.5)*.072*cam.w/max(1.,aspect))*tankW(z,cam)/(1.+.22*(1.-cam.w)),z);
}
vec4 waterCamera(float P){
  const vec4 above=vec4(${CAMERA.above.map(v=>v.toFixed(4))}),below=vec4(${CAMERA.below.map(v=>v.toFixed(4))});
  float level=smoothstep(${CAMERA.start},${CAMERA.end},P)${(emptyLevel-1).toFixed(4)}*smoothstep(${DRAIN[0]},${DRAIN[1]},P);
  float u=clamp(level/${tiltTakeup},0.,1.);
  float pitch=level<${tiltTakeup}?${tiltTakeup}*u*u*(2.-u):level;
  vec4 view=mix(above,below,pitch);
  view.x=mix(above.x,below.x,level);
  return view;
}
`;
export function seeded(seed){
  return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

// Invert the opening camera on its free surface and on the overhead lip.
// Stratifying impact *area in the image* keeps the far half from bunching up.
function surfacePoint(screenX,screenY){
  const f=(.60-screenY)/.60,z=f*(1+perspective)/(1+perspective*f);
  return [.5+(screenX-.5)*cameraDistance(z,CAMERA.above)/1.22,z];
}
function dropVolume(radius){
  const metres=.085,wetting=.81,density=1140,tension=.045,gravity=9.81;
  const volume=4*Math.PI*radius**3/3;
  const outletRadius=density*gravity*volume*metres**3/(2*Math.PI*tension*wetting);
  return {volume,outletRadius};
}
function sources(){
  const rng=seeded(6473),out=[],cells=Array.from({length:32},(_,i)=>i).filter(c=>c!==18&&c!==29);
  for(let i=cells.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];
  }
  for(let i=0;i<32;i++){
    const pool=(i+2*Math.floor(i/8))%8;
    const cell=i===0?18:i===1?29:cells[i-2];
    const screenX=i===0?.337:i===1?.628:clamp((cell%8+.09+.82*rng())/8,.043,.957);
    const screenY=i===0?.407:i===1?.503:.15+.45*(Math.floor(cell/8)+.08+.84*rng())/4;
    const [x,z]=surfacePoint(screenX,screenY);
    const detach=i===0?.078:i===1?.105:.111+(i-2)*.00438+.005*rng();
    const radius=i===0?.028:i===1?.024:.010+.011*rng();
    const nozzleZ=clamp(z+.10*(rng()-.5),.008,.91);
    const nozzleScreen=clamp(screenX+.064*(rng()-.5),.045,.955);
    const nozzleX=.5+(nozzleScreen-.5)*cameraDistance(nozzleZ,CAMERA.above)/1.22;
    const rootX=nozzleX+.012*(rng()-.5),rootZ=nozzleZ;
    const lip=.995+.008*rng();
    const ceiling=(lip-projectTank(nozzleX,0,nozzleZ,CAMERA.above,1)[1])*cameraDistance(nozzleZ,CAMERA.above)/CAMERA.above[2];
    const span=.050*Math.sqrt(ceiling/.94);
    out.push({id:i,parent:i,pool,white:pool%2,x,z,rootX,rootZ,nozzleX,nozzleZ,ceiling,
      gather:Math.max(0,detach-(i<2?.077:.036+.011*rng())),detach,span,hit:detach+span,
      radius,...dropVolume(radius),seed:rng()*6.283,
      plunge:i===0?.68:i===1?.52:.22+.65*rng(),bulk:i===0?.115:i===1?.074:.018+.037*rng()});
  }
  return out;
}
// Six late heads, black and ivory in turn, fall while the water envelops the screen. They are large and
// plunge deep, and their plumes come down from the top edge once the camera is under, each the shape of
// one of the four plume studies (data/ink-density.webp; living-ink-plan.js lateRail), two of them mirrored.
export const LATE=Object.freeze([{id:8,study:0,flip:0},{id:25,study:1,flip:0},{id:30,study:2,flip:0},
  {id:19,study:3,flip:0},{id:26,study:1,flip:1},{id:13,study:0,flip:1}].map(Object.freeze));
function lateHeads(drops){
  LATE.forEach((late,k)=>{
    const s=drops[late.id],radius=.027+.0006*k,detach=.40+.0132*k;
    Object.assign(s,{detach,gather:detach-.04,hit:detach+s.span,radius,...dropVolume(radius),
      plunge:.85+.015*k,bulk:.11+.004*k});
  });
  return drops;
}
export const DROPS=lateHeads(sources());

// Viscous paint refills these pores slowly. A pore pinches off and recoils,
// then the next pendant can swell while the previous drop is already falling.
function precipitation(){
  const rng=seeded(17715),all=DROPS.slice();
  // Two passes as the camera looks at the open water, and a third falling as it envelops the screen.
  for(let pass=1;pass<=3;pass++)for(const s of DROPS){
    const previous=all[(pass-1)*32+s.id];
    const detach=previous.detach+.042+.021*rng(),gather=previous.detach+.012+.004*rng();
    const radius=s.radius*(.52+.31*rng()),span=s.span*(.96+.08*rng());
    const [sx,sy]=projectTank(s.x,0,s.z,CAMERA.above,1);
    const reach=.020+.010*rng(),theta=rng()*6.283;
    const [x,z]=surfacePoint(clamp(sx+reach*Math.cos(theta),.037,.963),clamp(sy+reach*Math.sin(theta),.154,.595));
    all.push({...s,id:all.length,parent:s.id,x,z,gather,detach,span,hit:detach+span,
      radius,...dropVolume(radius),seed:6.283*rng(),plunge:.16+.20*rng()});
  }
  return all;
}
export const PRECIPITATION=precipitation();
export const PIGMENT_TOTALS=DROPS.map(s=>PRECIPITATION.reduce((v,d)=>v+(d.parent===s.id?d.volume:0),0));
export const poolsOfPaint=Array.from({length:8},(_,i)=>PRECIPITATION.reduce((v,s)=>v+(s.pool===i?s.volume:0),0));
export function dropLedger(s,P){
  const fed=s.volume*smooth(mix(s.gather,s.detach,.27),s.detach,P);
  return {film:s.volume-fed,pendant:P<s.detach?fed:0,air:P>=s.detach&&P<s.hit?fed:0,
    water:P>=s.hit?s.volume:0};
}
export function dropDepth(s,P){
  const u=clamp((P-s.detach)/s.span,0,1);
  return -s.ceiling*(1-u*u);
}
