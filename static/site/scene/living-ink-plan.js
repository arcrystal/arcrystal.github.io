import { startSlots, frameCamera, project, TYPES, TALL, bodyOf, headOf, halfWidth, crossings, fromY, toR } from './staunton.js';
import { buildInkRegistration, modelSection, registrationRank } from './ink-registration.js';
import { DROPS, PRECIPITATION, PIGMENT_TOTALS, LATE, tankCamera, projectTank, seeded, mix, smooth } from './ink-tank.js';
import { ORBIT, orbitAt, DISCHARGES, dischargePath, dischargeAt } from './ink-swirl.js';
import { clockP, FORMS, formSchedule, solidity } from './living-forms.js';
import { HOLD } from '../lerp.js';

export const KEYS=80, END=1.146, ease=smooth;
const TAU=2*Math.PI;
const formationDistance=5;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
// Model-space landmarks, expressed as fractions of height. The order controls
// which part catches a sheet first. The knight's muzzle and mane precede its foot.
const landmarks={
  N:[[.29,.56,.035],[-.07,.84,-.025],[-.12,.22,.055]], P:[[.07,.63,.04],[-.04,.86,0],[-.09,.15,-.04]],
  B:[[.075,.76,.03],[-.06,.85,-.025],[.04,.18,.08]], R:[[.13,.87,.06],[-.14,.89,-.06],[.05,.23,0]],
  Q:[[.105,.83,.06],[-.09,.81,-.06],[.05,.23,0]], K:[[0,.91,0],[.09,.69,-.025],[-.07,.14,.04]]
};
export const LANDED=Object.freeze({by:1.11,flight:.03});
const landBy=(depart,raw)=>{
  const k=.006,soft=-k*Math.log(Math.exp(-raw/k)+Math.exp(-LANDED.by/k));
  return Math.min(LANDED.by,Math.max(soft,depart+LANDED.flight));
};
export function birthSites(aspect){
  const random=seeded(1987),slots=startSlots(),view=tankCamera(1);
  const order=[1,20,29,12,4,2,19,24,30,8,7,16,27,11,6,28,23,13,26,21,0,9,3,17,31,22,15,5,18,10,25,14];
  const available=order.slice();
  const sites=DROPS.map((drop,i)=>{
    const pick=available.findIndex(k=>Number(!slots[k].black)===drop.white);
    const slot=available.splice(pick,1)[0],piece=slots[slot],type=TYPES[piece.type],h=TALL[type];
    const stagger=i<2?0:.831+.00465*(i-2)+.016*random();
    // D8's crown sweeps across the dark rim of the incoming board. Give
    // its fine prongs their clear-water interval before the first flights.
    const birth=i===0?.802:i===1?.840:type==='Q'&&piece.black?.859:stagger;
    const duration=i===0?.150:.072+.028*random(),depart=birth+duration+.009+.012*random();
    const formPeak=i===0?.768:birth-.027-.010*Math.cos(drop.seed);
    const formStart=i===0?.722:formPeak-.073-.017*Math.sin(1.7*drop.seed);
    // Every piece is down before the water sinks (ink-tank.js DRAIN): the last flights are eased shorter,
    // never under LANDED.flight, all down by LANDED.by, while the waterline is still falling.
    const land=landBy(depart,depart+.071+.029*random());
    const tip=projectTank(drop.x,drop.plunge,drop.z,view,aspect);
    const x=clamp(tip[0]+(i===0?.074*clamp(1.35-aspect)-.006:(random()-.5)*.18),.085,.915);
    // The pale cross rises into open water above the black knight's mane;
    // the nearby a7 pawn gathers in the deeper, quieter water below its foot.
    const clearance=slot===28?.160:slot===8?-.120:0;
    const y=clamp(tip[1]+(i===0?.062:(random()-.5)*.16)+clearance,.125,.84);
    return {slot,piece,x,y,z:tip[2],birth,duration,depart,land,formStart,formPeak,
      size:i===0?.324:i===1?.168:type==='P'?.103+.034*random():.139+.055*random(),
      turn:i===0?-.23:(random()-.5)*1.3,arc:(random()-.5)*.17,
      nuclei:landmarks[type].flatMap(([x,y,z])=>[x*h,(y-.5)*h,z*h])};
  });
  // Closely spaced impacts share a current. Spread their attachment sites
  // just enough to see neighboring silhouettes that form at the same time.
  // All coordinates here are in units of the shorter viewport dimension.
  const sx=Math.max(1,aspect),sy=Math.min(1,aspect);
  for(let pass=0;pass<4;pass++)for(let i=1;i<sites.length;i++){
    const s=sites[i];
    for(let j=0;j<i;j++){
      const t=sites[j];
      if(s.formStart>t.depart || t.formStart>s.depart)continue;
      const dx=(s.x-t.x)*sx,dy=(s.y-t.y)/sy,dist=Math.max(.001,Math.hypot(dx,dy));
      const radius=.53*(s.size+t.size);
      if(dist>=radius)continue;
      const shift=.68*(radius-dist)/dist;
      s.x=clamp(s.x+dx*shift/sx,.035+.49*s.size/sx,.965-.49*s.size/sx);
      s.y=clamp(s.y+dy*shift*sy,.075+.59*s.size*sy,.90-.55*s.size*sy);
    }
  }
  return sites;
}
export function packVaporFigures(sites){
  return Float32Array.from(sites.flatMap(s=>[
    (1+s.piece.type)*(s.piece.type===3&&Math.cos(s.piece.spin)<0?-1:1),
    s.formStart,s.formPeak,s.birth
  ]));
}
// ---- the solid filling its own shape ------------------------------------------------------------------
// The ink sets from its three landmarks outward (glsl/living-ink.js deposit): a point is filled once the
// front's radius passes its distance from the nearest landmark (the second and third wet a little later).
// FILL[type] is that radius for each share of the solid's volume, so the volume the solid fills is the
// share of its pigment deposited (the ledger): mass, not a guess, decides how far the liquid has seeped.
export const nucleusDelay=[0,.03,.07];
export function nucleiOf(type){
  const h=TALL[TYPES[type]];
  return landmarks[TYPES[type]].map(([x,y,z])=>[x*h,(y-.5)*h,z*h]);
}
export function frontDistance(type,x,y,z){
  const c=[x,y-TALL[TYPES[type]]/2,z];
  return Math.min(...nucleiOf(type).map((n,i)=>Math.hypot(c[0]-n[0],c[1]-n[1],c[2]-n[2])+nucleusDelay[i]));
}
// Samples of each solid's volume (a turned profile's rings; the knight's head drawn out to its mean
// thickness), each with its weight.
function volumeSamples(type){
  const name=TYPES[type],tall=TALL[name],out=[],rows=160,rings=14,turns=20,body=bodyOf(name);
  for(let j=0;j<rows;j++){
    const y=(j+.5)/rows*tall,R=toR(22.5+halfWidth(body,fromY(y)));
    if(R<=0)continue;
    for(let i=0;i<rings;i++)for(let k=0;k<turns;k++){
      const r=R*Math.sqrt((i+.5)/rings),a=2*Math.PI*(k+.37*i)/turns;
      out.push([r*Math.cos(a),y,r*Math.sin(a),R*R]);
    }
  }
  if(name==='N'){
    const head=headOf(),half=.09;
    for(let j=0;j<rows;j++){
      const y=(j+.5)/rows*tall,xs=crossings(head,fromY(y)).map(toR);
      for(let q=0;q+1<xs.length;q+=2)for(let i=0;i<24;i++)for(let k=0;k<5;k++){
        const x=xs[q]+(xs[q+1]-xs[q])*(i+.5)/24;
        out.push([x,y,half*(2*(k+.5)/5-1),(xs[q+1]-xs[q])*2*half*rings*turns/(24*5*Math.PI)]);
      }
    }
  }
  return out;
}
// (Built on first use, behind the loader's warm-up draw, not as the page's modules load.)
let fills=null;
const fillTable=type=>volumeSamples(type);
function buildFill(){return TYPES.split('').map((_,type)=>{
  const samples=fillTable(type).map(([x,y,z,w])=>[frontDistance(type,x,y,z),w]).sort((a,b)=>a[0]-b[0]);
  const total=samples.reduce((v,s)=>v+s[1],0),lut=new Float32Array(257);
  let acc=0,k=0;
  for(let i=0;i<=256;i++){
    const want=i/256*total;
    while(k<samples.length && acc+samples[k][1]<want){acc+=samples[k][1];k++;}
    lut[i]=k<samples.length?samples[k][0]:samples[samples.length-1][0];
  }
  return lut;
});}
export function fillRadius(type,g){
  fills??=buildFill();
  const lut=fills[type],x=clamp(g)*256,i=Math.min(255,Math.floor(x));
  return mix(lut[i],lut[i+1],x-i);
}
// The share of a solid's volume a front of radius R has filled (for the tests).
export function filledShare(type,R){
  const samples=volumeSamples(type);let total=0,inside=0;
  for(const [x,y,z,w] of samples){total+=w;if(frontDistance(type,x,y,z)<=R)inside+=w;}
  return inside/total;
}
// How far a site's solid has set (the jammed front, then the polish): from the middle of its deposit to
// its end.
export const setOf=(s,P)=>ease(s.birth+.55*s.duration,s.birth+s.duration,P);

export function piecePoses(sites,P,W,H,box,ledger,camera=frameCamera(box[2]/box[3])){
  const key=clamp(P/END)*(KEYS-1),lo=Math.floor(key),hi=Math.min(KEYS-1,lo+1);
  return sites.map((s,i)=>{
    const piece=s.piece,tall=TALL[TYPES[piece.type]],[u,v,depth]=project(camera,[piece.x,tall*.5,piece.z]);
    const targetX=box[0]+(u+1)*box[2]*.5,targetY=H-box[1]-(1-v)*box[3]*.5;
    const flight=ease(s.depart,s.land,P),bow=4*flight*(1-flight),focal=box[3]/(2*camera.tanY);
    const growth=ledger?mix(ledger[lo*sites.length+i],ledger[hi*sites.length+i],key-lo):ease(s.birth,s.birth+s.duration,P);
    const pixels=mix(s.size*Math.min(W,H)/tall,focal/depth,flight);
    return {x:mix(s.x*W,targetX,flight)+s.arc*Math.min(W,H)*bow,
      y:mix(s.y*H,targetY,flight)+.05*Math.min(W,H)*bow,pixels,tall,slot:s.slot,type:piece.type,black:piece.black,
      fill:fillRadius(piece.type,growth),set:setOf(s,P),
      spin:piece.spin+s.turn*(1-flight),roll:s.turn*.45*(1-flight),growth,flight,nuclei:s.nuclei,z:mix(s.z,.095,flight),
      elev:mix(.28,camera.elev,flight),slopeX:mix((s.x-.5)*.19,u*camera.tanY*camera.aspect,flight),
      slopeY:mix((s.y-.5)*.12,v*camera.tanY,flight),distance:mix(formationDistance,depth,flight)};
  });
}
// The rays of the suspended figure and its depositing sheets share a lens.
// Holding this camera distance at birth keeps the worker bake tile-independent.
function projectFigure(s,aspect,x,y,z){
  const yaw=s.piece.spin+s.turn,roll=.45*s.turn,scale=s.size/TALL[TYPES[s.piece.type]];
  const wx=x*Math.cos(yaw)+z*Math.sin(yaw),wz=-x*Math.sin(yaw)+z*Math.cos(yaw);
  const dx=wx*Math.cos(roll)+y*Math.sin(roll),dy=-wx*Math.sin(roll)+y*Math.cos(roll);
  const depth=-dy*Math.sin(.28)-wz*Math.cos(.28);
  const magnification=formationDistance/(formationDistance+depth);
  const horizontal=dx-(s.x-.5)*.19*depth;
  const vertical=dy*Math.cos(.28)-wz*Math.sin(.28)-(s.y-.5)*.12*depth;
  return [s.x+scale*magnification*horizontal/Math.max(1,aspect),
    s.y+scale*magnification*vertical*Math.min(1,aspect),s.z-.021*depth];
}
function projectLandmarks(s,aspect){
  const points=[];
  for(let k=0;k<9;k+=3)points.push(projectFigure(s,aspect,...s.nuclei.slice(k,k+3)));
  return points;
}
function registeredRails(s,id,v,aspect,table){
  const rank=registrationRank(s.piece.type,id),cut=modelSection(table,rank,v);
  const y=(cut.height-.5)*TALL[TYPES[s.piece.type]],yaw=s.piece.spin+s.turn;
  const center=(cut.lo+cut.hi)*.5;
  const project=(x,z)=>rank===3?projectFigure(s,aspect,x,y,z):
    projectFigure(s,aspect,x*Math.cos(yaw)-z*Math.sin(yaw),y,x*Math.sin(yaw)+z*Math.cos(yaw));
  const left=project(cut.lo,0),right=project(cut.hi,0);
  // The study's wet outline occupies only [u0,u1]. Extrapolating the rails
  // maps that outline onto the two projected flanks, including the jaw.
  const across=u=>left.map((x,i)=>mix(x,right[i],(u-cut.u0)/(cut.u1-cut.u0)));
  return [across(0),across(1),project(center,-cut.depth),project(center,cut.depth)];
}
// Transport the four extremities of each material ring onto the wet knight.
// The crown bends toward the muzzle while the loose rear membrane and chest
// lag. The left and right rails delimit the sheet. The other two set its
// optical chord, thickest through the cheek, thin through the ears and skirt.
function knightSection(s,aspect,v,side,deep,P){
  const release=ease(s.birth+.012,s.birth+s.duration*.84,P);
  const scale=s.size*(1.68-.62*release);
  const wave=13*(P-s.formStart)-6.2*v;
  const flanks=Math.sin(Math.PI*v),loose=(1-release)*flanks;
  const cheek=Math.exp(-((v-.36)**2)/.040);
  const maneLag=(1-side)*.5;
  const curl=loose*(.032*Math.sin(wave+side*.8)+.016*Math.sin(11*v+wave*.65));
  const x=(side*.5-.088+curl*(.3+maneLag)+.065*loose*Math.cos(wave-1)*deep)*scale;
  const y=(.53-v+loose*(.028*Math.sin(wave+1.4)*side+.019*deep)+.030*side*(v-.55))*scale;
  const z=deep*(.031+.067*cheek+.028*flanks)+side*(v-.4)*.031;
  const facing=Math.cos(s.piece.spin)<0?-1:1;
  return [s.x+facing*x/Math.max(1,aspect),s.y+y*Math.min(1,aspect),s.z+z];
}
// Widths measured on the mane, poll, nose, open throat and breast of the
// intermediate horse. Row ordinates span water to water at the two tips.
const horseRows=[
  [.65,.67],[.48,.69],[.33,.74],[.26,.82],[.24,.88],[.23,.86],
  [.23,.60],[.22,.65],[.19,.72],[.20,.72],[.28,.66],[.38,.56]
];
function horseRib(v){
  const at=v*(horseRows.length-1),k=Math.floor(at),t=at-k;
  const [back,front]=horseRows[k],[nextBack,nextFront]=horseRows[Math.min(k+1,horseRows.length-1)];
  return [mix(back,nextBack,t),mix(front,nextFront,t)];
}
// Cross sections of the suspended soot, top to foot. The denser material
// follows these ribs. Thin material can extend past each radius and tear.
const inkRadii={
  K:[.012,.05,.065,.12,.07,.11,.06,.06,.10,.13,.15,.18,.012],
  Q:[.012,.07,.19,.14,.11,.10,.06,.06,.09,.14,.17,.22,.012],
  B:[.012,.03,.06,.12,.14,.11,.12,.07,.08,.13,.17,.19,.012],
  R:[.012,.04,.19,.17,.15,.13,.12,.11,.13,.18,.22,.19,.012],
  P:[.012,.05,.11,.14,.12,.12,.08,.09,.17,.20,.23,.06,.012]
};
function figureRib(type,v){
  if(type==='N')return horseRib(v);
  const width=inkRadii[type],at=v*(width.length-1),k=Math.floor(at);
  const radius=mix(width[k],width[Math.min(width.length-1,k+1)],at-k);
  return [.5-radius,.5+radius];
}
function figureSection(s,aspect,v,side,deep,P){
  if(s.piece.type===3)return knightSection(s,aspect,v,side,deep,P);
  const captured=ease(s.birth,s.birth+s.duration*.83,P);
  const span=s.size*mix(1.52,1.09,captured);
  const theta=s.turn*.42,center=.51-v;
  const phase=(P-s.formStart)*28+s.slot*.82-v*7;
  const floating=Math.sin(Math.PI*v)*(1-captured);
  const shear=floating*(.050*Math.sin(phase)+.024*side*Math.cos(2.2*phase));
  const x=side*.50+shear+(.053*deep*Math.sin(phase*.61)*floating);
  const y=center+.043*side*floating*Math.sin(phase*.7);
  return [s.x+(x*Math.cos(theta)+y*Math.sin(theta))*span/Math.max(1,aspect),
    s.y+(y*Math.cos(theta)-x*Math.sin(theta))*span*Math.min(1,aspect),
    s.z+deep*(.022+.036*Math.sin(Math.PI*v))+.012*side*Math.sin(phase)];
}
// Curl of a Gaussian-windowed vector potential for (x,y,-2z) strain:
// curl(w A) = w curl(A) + grad(w) cross A, with A=(yz,-xz,0).
export function pocketFlow(x,y,z,gain){
  const k=12,w=gain*Math.exp(-k*(x*x+y*y+z*z)),zz=2*k*z*z;
  return [w*x*(1-zz),w*y*(1-zz),w*z*(-2+2*k*(x*x+y*y))];
}
function splat(field,nx,ny,nz,x,y,z,r,amount,white){
  const X=x*nx-.5,Y=y*ny-.5,Z=z*nz-.5,rx=Math.max(1,r*ny),ry=Math.max(1,r*ny),rz=Math.max(1.1,r*nz*1.9);
  for(let k=Math.max(0,Math.ceil(Z-rz));k<=Math.min(nz-1,Z+rz);k++){
    const kz=((k-Z)/rz)**2;
    for(let j=Math.max(0,Math.ceil(Y-ry));j<=Math.min(ny-1,Y+ry);j++){
      const rem=1-kz-((j-Y)/ry)**2;if(rem<=0)continue;
      const span=rx*Math.sqrt(rem);
      for(let i=Math.max(0,Math.ceil(X-span));i<=Math.min(nx-1,X+span);i++){
        const w=rem-((i-X)/rx)**2; field[2*(i+nx*(j+ny*k))+white]+=amount*w*w;
      }
    }
  }
}
// Smaller beads enter at their own crossing and stir a short, curling column.
// As that column entrains water it merges with a nearby plume of the same ink.
// The volume atlas carries the new threads without allocating more sheet grids.
function feedPlumes(P,aspect,cam,extras,available,book,field,nx,ny,nz){
  for(const bead of extras){
    const parent=DROPS[bead.parent],age=P-bead.hit,group=3*bead.white;
    if(age<=0){book[group]+=bead.volume;continue;}
    // A smaller charge has less downward momentum and more drag per unit
    // mass. Some late threads are still shedding pigment as the surface lifts.
    const drag=1-Math.min(1,bead.radius/parent.radius);
    const arrival=Math.max(bead.hit+.15+.23*drag+.035*Math.sin(bead.seed),parent.hit+.065);
    const join=ease(arrival-.045,arrival+.055,P);
    available[parent.id]+=join*bead.volume;
    book[group+1]+=(1-join)*bead.volume;
    if(join===1)continue;
    const parentHead=parent.plunge*(-Math.expm1(-5.7*Math.max(0,P-parent.hit)));
    const immerse=-Math.expm1(-(8.5-3*drag)*age),front=bead.plunge*immerse;
    const side=Math.max(1,aspect),size=bead.radius;
    for(let k=0;k<9;k++){
      const u=k/8;
      const theta=bead.seed+u*5.8-age*19;
      const curl=size*(.16+.98*u*u)*immerse;
      const x=mix(bead.x,parent.x,join)+curl*(Math.cos(theta)-Math.cos(bead.seed))/side;
      const z=mix(bead.z,parent.z,join)+curl*Math.sin(theta);
      const depth=mix(front*(.12+.88*u),parentHead*(.48+.42*u),join);
      const at=projectTank(x,depth,z,cam,aspect);
      const width=(.004+size*(.55+.76*u)*(.6+immerse))*Math.min(1,aspect);
      const opacity=(1-join)*(.3+1.3*u*u)*ease(0,.012,age)*Math.min(1,size/.013);
      splat(field,nx,ny,nz,...at,width,opacity,bead.white);
    }
  }
}
const encode=x=>Math.round(clamp((x+.5)/2)*65535);
export const decodePosition=n=>2*n/65535-.5;

// The long drops occupy different optical depths. Four widely spaced trunks
// carry the close shot. Smaller jets stay in the surrounding water and can be
// entrained by a near neighbour of the same pigment during the underwater turn.
const foregroundColumns = new Map([
  [0,{depth:.985,bulk:.145,tail:.055}], [1,{depth:.82,bulk:.125,tail:.095}],
  [10,{depth:.93,bulk:.119,tail:.082}], [23,{depth:.77,bulk:.094,tail:.11}],
  ...LATE.map((l,k)=>[l.id,{depth:.9+.012*k,bulk:.12,tail:.06}])
]);
// ---- the late heads: plumes the shape of the plume studies -----------------------------------------
// Each late head comes down from the top edge once the camera is under, a sheet the size and shape of its
// study (its texture is that study, glsl/living-ink.js LATE), rolling and swaying as the other plumes do,
// slowing as a vortex ring does, then letting go into the water's own currents.
const LATE_BY_ID=new Map(LATE.map((l,k)=>[l.id,{...l,k}]));
export const lateShown=(drop,P)=>ease(drop.hit+.02,drop.hit+.07,P)*(1-ease(.635,.70,P));
function lateRail(drop,late,v,rail,P,aspect,cam){
  const t=clamp((P-drop.hit-.02)/(.64-drop.hit-.02)),fall=1-(1-t)**2.2;
  const tall=(.60+.05*(late.k%2))*Math.min(1,aspect);
  const yHead=mix(1.10,.30+.07*(late.k%3),fall),y=yHead+(1-v)*tall;
  const x0=Math.max(.2,Math.min(.8,projectTank(drop.x,0,drop.z,cam,aspect)[0]));
  const sway=.022*Math.sin(5*v+9*P+drop.seed)*(.4+.6*v);
  // (The study is square: as wide as it is tall, in screen heights; x is a share of the screen's width.)
  const half=.5*.95*tall/aspect;
  const x=x0+sway/Math.max(1,aspect),side=[-1,1,0,0][rail],deep=[0,0,-1,1][rail];
  return [x+side*half,y,drop.z+.025*deep];
}
function freeColumn(drop,aspect){
  const front=foregroundColumns.get(drop.id);
  const near=DROPS.filter(other=>foregroundColumns.has(other.id)&&other.white===drop.white&&other!==drop)
    .map(other=>({other,d:Math.hypot((other.x-drop.x)*Math.max(1,aspect),.34*(other.z-drop.z))}))
    .sort((a,b)=>a.d-b.d)[0];
  const influence=near?Math.exp(-((near.d/.31)**2)):0;
  const depth=front?.depth??(.12+.80*drop.plunge+.055*drop.z);
  return {
    depth,
    bulk:front?.bulk??drop.bulk*(.69+.47*drop.z),
    tail:front?.tail??clamp(1-(7.8+.95*Math.sin(drop.seed))*drop.bulk/depth,.15,.70),
    neighbourX:near?influence*(near.other.x-drop.x)*Math.max(1,aspect):0,
    weight:front?1:.29+.25*drop.z
  };
}
// The foreground pairs' middles at P (ink-swirl.js ORBIT), from where their heads would be: centre (x by the
// aspect, y up, screen heights), half the distance between the heads, the turn so far (signed). The bake
// turns the plumes about these; the renderer undoes the turn between two keys of the mist (no ghost).
export function orbitCentres(P,aspect){
  const under=ease(.342,.545,P),swing=orbitAt(P),cam=tankCamera(P);
  return ORBIT.pairs.map(([a,c,sense])=>{
    const heads=[a,c].map(id=>{
      const s=DROPS[id],column=freeColumn(s,aspect),life=1-Math.exp(-Math.max(0,P-s.hit)*(id<2?5.4:6.6));
      const at=projectTank(s.x,mix(s.plunge,column.depth,under)*life*.9,s.z,cam,aspect);
      return [at[0]*aspect,at[1]];
    });
    return {pair:[a,c],sense,centre:[(heads[0][0]+heads[1][0])/2,(heads[0][1]+heads[1][1])/2],
      half:Math.hypot(heads[1][0]-heads[0][0],heads[1][1]-heads[0][1])/2,angle:sense*swing};
  });
}
// Where a plume's head is at P (x by the aspect, y up: screen heights; depth), turned with its pair.
export function headAt(id,P,aspect){
  const s=DROPS[id],column=freeColumn(s,aspect),under=ease(.342,.545,P),life=1-Math.exp(-Math.max(0,P-s.hit)*(id<2?5.4:6.6));
  const at=projectTank(s.x,mix(s.plunge,column.depth,under)*life*.9,s.z,tankCamera(P),aspect);
  let x=at[0]*aspect,y=at[1];
  const o=orbitAt(P)>0?orbitCentres(P,aspect).find(o=>o.pair.includes(id)):null;
  if(o){
    const c=Math.cos(o.angle),sn=Math.sin(o.angle),dx=x-o.centre[0],dy=y-o.centre[1];
    x=o.centre[0]+c*dx-sn*dy;y=o.centre[1]+sn*dx+c*dy;
  }
  return [x,y,at[2]];
}
// A stack of material rings spans each drop from its trailing column to its
// overturning nose. Rim stations turn through the meridian as the vortex rolls.
// The moving axis is integrated separately so the thick head has inertia.
export function bakeLivingInk(aspect,mobile,emit,sourceCount=DROPS.length){
  const sites=birthSites(aspect).slice(0,sourceCount),drops=DROPS.slice(0,sourceCount);
  const columns=drops.map(drop=>freeColumn(drop,aspect));
  const portraitWidth=1+.55*clamp((.93-aspect)/.55);
  const extras=PRECIPITATION.slice(DROPS.length).filter(d=>d.parent<sourceCount);
  const sectors=mobile?34:49,rows=mobile?22:30,cols=sectors+1,nx=clamp(Math.round(63*aspect),38,112),ny=mobile?72:63,nz=mobile?16:20;
  const width=cols+4,height=rows*sourceCount,order=drops.map(s=>s.id).sort((a,b)=>drops[a].z-drops[b].z);
  const assigned=new Float64Array(sourceCount),total=new Float64Array(sourceCount), ledger=new Float32Array(KEYS*sourceCount),massBook=new Float64Array(KEYS*6);
  // Neighboring drops share these slow counter-rotating currents. Their
  // circulations are localized in both depth and the plane of the photograph.
  const gyres=[[.31,.55,.50,.064],[.69,.39,.42,-.053],[.50,.72,.64,-.046],[.81,.63,.64,.042]];
  const registration=buildInkRegistration(),vertex=[],ax=[];
  const cutRows=sites.map((s,id)=>Array.from({length:rows},(_,j)=>modelSection(registration,registrationRank(s.piece.type,id),j/(rows-1))));
  const registered=sites.map((s,id)=>Array.from({length:rows},(_,j)=>registeredRails(s,id,j/(rows-1),aspect,registration)));
  const targets=sites.map(s=>projectLandmarks(s,aspect));
  for(const id of order){
    const s=drops[id],neighbor=sites.map((site,i)=>({i,d:Math.hypot((site.x-sites[id].x)*aspect,site.y-sites[id].y)}))
      .filter(p=>p.i!==id&&drops[p.i].white===s.white).sort((a,b)=>a.d-b.d)[0];
    for(let j=0;j<rows;j++){
      const v=j/(rows-1),lip=ease(.52,.93,v);
      ax.push({x:0,z:0,d:0,vx:0,vz:0,vd:0});
      for(let k=0;k<cols;k++){
        const a=TAU*(k%sectors)/sectors,owner=(neighbor&&k%sectors>=sectors-2&&v<.37)?neighbor.i:id;
        const band=(a/TAU+.14*Math.sin(6*v+s.seed)+1)%1;
        const node=band<.39?0:band<.70?1:2,site=sites[owner];
        const weight=(.58+.94*lip)*(k===sectors?0:1);
        const mass=weight;assigned[id]+=mass;
        const delay=clamp(.09+.51*(node/2)+.26*(1-v)+.11*Math.sin(a+s.seed));
        const capture=site.birth+site.duration*(.03+.68*delay);
        vertex.push({a,lip,owner,mass,phase:a+s.seed,capture,end:capture+site.duration*.26,
          target:targets[owner][node],id});
      }
    }
  }
  for(const g of vertex){
    g.mass*=PIGMENT_TOTALS[g.id]/assigned[g.id];
    total[g.owner]+=g.mass;
  }
  // The living forms (living-forms.js): their schedule, sent with the meta so the renderer keeps the same
  // one, and their tracks: per key, each form's centroid (screen x, y up, depth) and spread, from its
  // plume's final rail positions near the head.
  const forms=sourceCount===DROPS.length?formSchedule(sites):[],formOf=new Map(forms.map((f,k)=>[f.id,k]));
  const tracks=new Float32Array(KEYS*FORMS.length*4),trackSums=new Float64Array(FORMS.length*6);
  emit({meta:{nx,ny,nz,rows,cols,order,sites,registration,vaporFigures:packVaporFigures(sites),depositedMass:total,forms}});
  const field=new Float32Array(nx*ny*nz*2),dt=END/(KEYS-1);
  const lut=Uint8Array.from({length:2049},(_,i)=>Math.round(255*(1-Math.exp(-i/256))));
  const jets=new Map();
  // The waves keep the event's clock (living-forms.js): through the event they turn with this device's
  // scroll, not with P, so they neither crawl nor throb.
  const holdPin=mobile?HOLD.pinTouch:HOLD.pin;
  for(let frame=0;frame<KEYS;frame++){
    const P=dt*frame,Pc=clockP(P,holdPin),cam=tankCamera(P),mesh=new Uint16Array(width*height*4);
    field.fill(0);trackSums.fill(0);
    const available=drops.map(drop=>drop.volume);
    feedPlumes(P,aspect,cam,extras,available,massBook.subarray(frame*6,frame*6+6),field,nx,ny,nz);
    // The foreground pairs circle one another (ink-swirl.js ORBIT): each pair's middle, from its heads.
    const orbits=new Map();
    if(orbitAt(P)>0)for(const o of orbitCentres(P,aspect))if(o.pair.every(id=>id<drops.length))for(const id of o.pair)orbits.set(id,o);
    // Turn a projected point about its pair's middle: the head the whole way, the stem less toward the top.
    const circle=(pos,orbit,v)=>{
      if(!orbit)return;
      const t=orbit.angle*ease(.2,.78,v),c=Math.cos(t),sn=Math.sin(t);
      const x=pos[0]*aspect-orbit.centre[0],y=pos[1]-orbit.centre[1];
      pos[0]=(orbit.centre[0]+c*x-sn*y)/aspect;pos[1]=orbit.centre[1]+sn*x+c*y;
    };
    for(let b=0;b<order.length;b++){
      const id=order[b],s=drops[id],age=Math.max(0,P-s.hit),seed=s.seed;
      const supplied=available[id]/PIGMENT_TOTALS[id];
      const life=1-Math.exp(-age*(id<2?5.4:6.6));
      const column=columns[id],under=ease(.342,.545,P);
      const plunge=mix(s.plunge,column.depth,under)*life,bulk=mix(s.bulk,column.bulk,under);
      const reach=1-Math.exp(-age*8.3),ageC=Math.max(0,Pc-s.hit);
      // A countercurrent rises along the rim while its weighted core continues
      // down. As the wave overtakes each row the rim first wets, then pinches
      // into a horn, then sheds a veil. Random phases keep adjoining jets apart.
      const currentTime=(Pc-.475)*32+.79*Math.sin(seed);
      const live=under*(1-ease(.735,.91,P)),gesture=live*column.weight;
      const approach=live*ease(.495,.603,P)*(1-ease(.635,.736,P));
      const born=ease(s.hit,s.hit+.017,P);
      const late=LATE_BY_ID.get(id),shown=late?lateShown(s,P):0;
      // While its living form is solid, the plume gives its pigment to it: its mist thins, and its veils at
      // the cap (never its stem, and not before the caps start rolling).
      const formK=formOf.get(id),solid=formK===undefined?0:solidity(forms[formK],P),veilsGive=solid*ease(.60,.62,P);
      if(P<s.hit-dt){
        // Invisible stations still carry a valid water crossing on direct seeks.
        const p=projectTank(s.x,0,s.z,cam,aspect),packed=p.map(encode);
        const stop=(b+1)*rows*width*4;
        for(let k=b*rows*width*4;k<stop;k+=4){mesh[k]=packed[0];mesh[k+1]=packed[1];mesh[k+2]=packed[2];}
        massBook[frame*6+3*s.white]+=available[id];
        continue;
      }
      for(let j=0;j<rows;j++){
        const v=j/(rows-1),axial=ax[b*rows+j];
        if(age>0){
          for(let sub=0;sub<2;sub++){
            const t=P-(1-sub)*dt/2;
            const flow=pocketFlow(.17*Math.cos(seed+v*4)+axial.x,.20*v-.10,.19*Math.sin(seed+v*6)+axial.z,
              1.15*Math.sin(t*16-v*5+seed));
            const recoil=1.8+.9*(1-v);
            let forceX=.24*Math.sin(6.1*t+seed+v*3)+flow[0]-recoil*axial.x,forceD=0;
            for(const [cx,cd,cz,circ] of gyres){
              const dx=(s.x-cx)*Math.max(1,aspect)+axial.x, dz=s.z-cz+axial.z;
              const dy=plunge*(.16+.84*v)+axial.d-cd;
              const spin=circ/(.012+dx*dx+dy*dy+dz*dz*.7);
              forceX-=dy*spin;forceD+=dx*spin;
            }
            axial.vd+=(forceD-axial.vd)*(1-Math.exp(-dt*3.1));
            axial.d+=axial.vd*dt*.5;
            const forceZ=.20*Math.cos(5*t+seed+v*2.4)+flow[2]-recoil*axial.z;
            const drag=1-Math.exp(-dt*(5.3-2.5*v));
            axial.vx+=(forceX-axial.vx)*drag; axial.vz+=(forceZ-axial.vz)*drag;
            axial.x+=axial.vx*dt/2;axial.z+=axial.vz*dt/2;
          }
        }
        const mistGives=solid*ease(.3,.62,v),capGives=veilsGive*ease(.55,.8,v);
        const roll=clamp((v-.61)/.39),body=Math.min(1,v/.64);
        const stem=id<2?.16:.23+.45*(.5+.5*Math.sin(seed));
        const shortTail=id<2?stem+.16:Math.max(stem+.1,1-4.8*s.bulk/s.plunge);
        const tail=mix(shortTail,column.tail,under)*ease(.035,.40,age);
        const head=ease(.36,.88,v);
        const wave=currentTime-5.7*v+.51*Math.sin(5*v+seed);
        const strain=.063*gesture*Math.sin(Math.PI*v)*Math.sin(wave);
        // The reciprocal square root preserves the local volume of a material
        // sleeve as its axis stretches longitudinally. Smooth bounds keep the
        // reconstruction regular at the top and bottom of the mesh.
        const dzdv=.063*gesture*(Math.PI*Math.cos(Math.PI*v)*Math.sin(wave)
          +Math.sin(Math.PI*v)*Math.cos(wave)*(-5.7+2.55*Math.cos(5*v+seed)));
        const bulge=1/Math.sqrt(1+clamp(dzdv,-.5,.75));
        const gatherX=approach*head*column.neighbourX*.72;
        const curlX=gesture*(.046*Math.sin(wave)+.023*Math.sin(1.5*currentTime-9*v+seed))*Math.sin(Math.PI*v);
        const driftX=gatherX+curlX, driftD=plunge*strain;
        const wetRoll=.5+.5*Math.cos(wave-.7),tear=.5+.5*Math.sin(wave+1.6*v);
        const tearAt=.68+.14*Math.sin(seed)+.070*Math.cos(currentTime+seed);
        const branches=gesture*Math.exp(-(((v-tearAt)/.14)**2))*(.19+.81*tear);
        // Finite-core circulation in the meridional section of a vortex
        // loop. Its local angular speed stays bounded at the vortex core.
        const core=s.bulk*.32,ringR=s.bulk*(.19+.50*roll);
        const omega=1.48*core*core*(-Math.expm1(-ringR*ringR/(2*core*core)))/(ringR*ringR);
        const theta=roll*(4.5+.96*Math.sin(6*ageC+seed))+ageC*(2.35+3.4*omega)+.62*Math.sin(seed);
        const bell=Math.exp(-(((v-.49)/.108)**2));
        const radial=v<.61?.027+.49*body**2+.50*bell+.110*Math.sin(13*v+seed)*Math.sin(Math.PI*body)
          :.58+.42*Math.sin(theta)-.13*roll;
        const depth=v<.61?mix(tail,.83,body):.83+.16*Math.sin(Math.PI*roll)+.07*roll;
        const site=sites[id];
        const anatomical=ease(site.formStart+.016*v,site.formPeak-.013*(1-v),P);
        const rails=anatomical?[[-1,0],[1,0],[0,-1],[0,1]].map(([side,deep])=>figureSection(site,aspect,v,side,deep,P)):null;
        const lock=ease(site.formPeak,site.birth+.90*(site.birth-site.formPeak),P);
        if(lock>0)for(let rail=0;rail<4;rail++)for(let dim=0;dim<3;dim++){
          rails[rail][dim]=mix(rails[rail][dim],registered[id][j][rail][dim],lock);
        }
        const rib=anatomical?figureRib(TYPES[site.piece.type],v):null;
        // A traveling compression shifts suspended pigment into a dense
        // knot, then tears off a cloudy tail. Adjacent rings encounter it
        // at different times. Density and the sheet share this material clock.
        const pulse=Math.sin(23*ageC-8.3*v+seed+.52*Math.sin(5*v+seed));
        const breathing=ease(.12,.27,age)*(1-ease(.64,.91,P));
        // A shear pulse entrains part of the head and carries it back up its
        // flanks. Its optical sections read the same material clock.
        const lift=live*head*ease(-.35,.88,Math.cos((Pc-.622)*69+id*.86+(v-.78)*5.4));
        for(let k=0;k<cols;k++){
          const n=(b*rows+j)*cols+k,g=vertex[n],{a,lip,owner,target}=g;
          const twist=a+seed+1.5*v+.47*Math.sin(ageC*9-4*v+seed);
          const lobe=.34*Math.sin(2*twist+1.1*v+seed)+.23*Math.sin(3*twist-4*v+ageC*3-seed);
          const fold=.19*Math.sin(5*twist+v*11+ageC*6)+.084*Math.sin(9*twist-v*21+.6*Math.sin(twist));
          const fluke=Math.max(0,Math.cos(twist-v*6-seed))**4;
          const flutter=(.54+.46*Math.sin(4*twist+seed+13*v));
          // A secondary roll blossoms at different material heights on each
          // jet. Azimuthal staggering produces lobes with different masses.
          const foldAt=.34+.14*Math.sin(seed)+.064*Math.cos(2*twist+seed);
          const sleeve=Math.exp(-(((v-foldAt)/(.089+.02*Math.cos(seed)))**2));
          const shape=radial*(1+lobe+fold+.57*fluke*bell)+sleeve*(.48+.66*flutter);
          const radius=s.radius*.61*Math.sin(Math.PI*v)*(1-reach)+bulk*reach*shape*bulge;
          // Two sectors peel tangentially off the rolling lip. Their tips rise
          // ahead of the thin connecting membranes, then curl back toward the core.
          const bearing=a+seed+1.6*v-.72*currentTime;
          const leftTongue=Math.max(0,Math.cos(bearing))**5;
          const rightTongue=Math.max(0,-Math.cos(bearing+.5))**8;
          const tongue=branches*(leftTongue+.74*rightTongue);
          const turn=2.35*tear+1.92*v+.27*currentTime;
          const throwX=bulk*1.22*branches*(leftTongue-.74*rightTongue)*Math.sin(turn);
          const throwD=bulk*tongue*(.72*Math.cos(turn)-.64);
          const throwZ=bulk*tongue*.55*Math.cos(turn+seed);
          const lipDepth=s.bulk*reach*(lip*(.40*Math.cos(2*twist+seed)+.24*Math.sin(3*twist+v*7-seed))+
            .15*Math.sin(4*twist+v*14+seed));
          const sway=Math.sin(Math.PI*v)*Math.sin(v*7.4+Pc*9+seed);
          const current=(id<2?.052:.018+.035*flutter)*reach;
          let lateral=axial.x+current*sway+.05*reach*Math.sin(4*v+seed)*Math.sin(ageC*7);
          // Fast near-side lobes turn outward into the countercurrent. The
          // lighter skirt can fold OVER the heavy head as it sweeps sideways.
          const lean=(id===0?-.43:Math.sin(seed*2.1))*.43*reach;
          lateral+=lean*plunge*(v-.30);
          const spiral=twist+.64*Math.sin(v*10+2*twist-seed)*reach;
          const x=s.x+(lateral+driftX+throwX+radius*portraitWidth*Math.cos(spiral))/Math.max(1,aspect);
          const d=plunge*depth+driftD+throwD+axial.d+lipDepth+s.radius*(1-reach)*v+bulk*reach*
            (.58*Math.sin(twist*3+v*18-seed)*bell+.32*Math.cos(twist+v*25)*fluke-
            sleeve*(.70+.50*flutter))-.15*current*sway+lean*radius*.64*Math.cos(spiral);
          const z=s.z+axial.z+throwZ+radius*1.18*Math.sin(spiral)+.045*reach*Math.sin(v*8+seed+ageC*6);
          const pos=projectTank(x,d,z,cam,aspect);
          circle(pos,orbits.get(id),v);
          if(anatomical){
            const twist= a+.17*Math.sin(9*v+age*6+a);
            const modelRib=cutRows[id][j];
            const around=.5+.5*Math.cos(twist);
            const ribU=mix(mix(rib[0],rib[1],around),mix(modelRib.u0,modelRib.u1,around),lock);
            const flex=(1-ease(site.birth,site.birth+.08,P))*.047*Math.sin(8*v+2*a-age*13)*Math.sin(Math.PI*v);
            for(let axis=0;axis<3;axis++){
              const chord=(rails[3][axis]-rails[2][axis])*.46*Math.sin(twist);
              const anatomy=mix(rails[0][axis],rails[1][axis],ribU+flex)+chord;
              pos[axis]=mix(pos[axis],anatomy,anatomical);
            }
          }
          // A local veil touches the corresponding part of its own carved
          // surface. Only the borrowed end of a filament crosses to a neighbour.
          const follow=owner===id?0:ease(g.capture-.025,g.end,P),slack=Math.sin(Math.PI*follow);
          const loop=.023*slack*Math.sin(a+v*5+7*follow);
          pos[0]=mix(pos[0],target[0],follow)+loop/Math.max(1,aspect);
          pos[1]=mix(pos[1],target[1],follow)+slack*.027*Math.cos(a+7*follow);
          pos[2]=mix(pos[2],target[2],follow)+slack*.013*Math.sin(twist);
          const transfer=ease(g.capture,g.end,P),free=born*(1-transfer);
          const exchange=breathing*(.12*pulse+.066*Math.sin(twist+pulse+ageC*11));
          const shed=live*(.36*tear*(1-wetRoll)+.16*tongue-.14*wetRoll*head)+.34*lift;
          const mist=clamp(.11+.19*(1-lip)+.13*reach+.09*Math.sin(g.phase+6*v)+exchange+shed,.045,.79);
          const offset=4*((b*rows+j)*width+k);
          mesh[offset]=encode(pos[0]);mesh[offset+1]=encode(pos[1]);mesh[offset+2]=encode(pos[2]);
          mesh[offset+3]=Math.round(65535*free*(1-mist)*(1-.92*shown)*(1-.55*capGives));
          const mass=g.mass*supplied;
          ledger[frame*sourceCount+owner]+=transfer*mass/total[owner];
          const loc=frame*6+3*s.white;
          massBook[loc]+=mass*(1-born);massBook[loc+1]+=mass*free;massBook[loc+2]+=mass*transfer;
          if(free>.001 && k%3===0 && k<sectors && j%2===0 && shown<.9){
            const shear=reach*(1-lip*.53),spread=s.bulk*(.16+.45*shear);
            // As the figure locks to its solid the mist round it condenses onto its outline: tighter, denser.
            const condense=lock*(1-transfer);
            const softness=(.010+spread*(.79+.20*breathing*pulse+.52*lift))*Math.min(1,aspect)*(1-.45*condense);
            const amount=free*(bulk/.065)*(.035+.17*lip+.085*sleeve+.21*tongue+.19*lift)*(.26+.74*fluke)*(1+.5*condense)*(1-.85*mistGives);
            const loft=gesture*(1-wetRoll)*(.022+.064*tongue)+lift*(.028+.095*fluke);
            splat(field,nx,ny,nz,pos[0]+(shear*.033+lift*bulk*.43)*Math.sin(twist+ageC*8)/Math.max(1,aspect),
              pos[1]+loft+shear*.050*Math.cos(twist+v*5),pos[2],softness,amount*mist,s.white);
          }
        }
        // Four optical rails bound the volume entrained by this ring. The
        // refracting skins and the suspended interior use the same spine,
        // circulation, camera and per-landmark deposition clocks.
        for(let rail=0;rail<4;rail++){
          const side=[-1,1,0,0][rail],deep=[0,0,-1,1][rail];
          const g=vertex[(b*rows+j)*cols+Math.floor(sectors*[.55,.04,.76,.27][rail])];
          const billow=.92+.13*Math.sin(v*10+Pc*5+seed)+.08*Math.cos(2*seed-v*16);
          // Entrainment lengthens the thin stem. The overturning cap spreads
          // laterally and travels as a compact packet with the same end points.
          const cap=under*ease(.38,.80,v);
          const materialDepth=v+.23*under*v*(1-v);
          const spread=1+.23*gesture*ease(.39,.82,v)+.32*cap;
          const halfWidth=(s.radius*(1-reach)+bulk*(id<2?1.94:1.64)*reach*billow*bulge*spread)*portraitWidth;
          const slope=(id===0?-.19:.42*Math.sin(seed*2.1))*reach;
          const collar=Math.exp(-((v-.38)**2)/.062),advection=breathing*collar*pulse;
          const spine=axial.x*.57+slope*plunge*(v-.3)+reach*.021*Math.sin(8*v+ageC*7+seed)
            +s.bulk*advection*(.62+.22*side);
          const roll=branches*bulk*(.49+.51*side)*Math.sin(2.35*tear+1.92*v+.27*currentTime);
          const sheetX=spine+driftX+roll+side*halfWidth+deep*.013*reach*Math.sin(4*v+seed);
          const sheetD=plunge*mix(tail,1.02,materialDepth)+driftD+axial.d*.65+halfWidth*(side*slope*.49+deep*.029)
            -gesture*branches*bulk*(.34+.41*side);
          // The rolled nose travels as a parcel. Independent axial strain in
          // adjacent rows can invert a dense fold and press it into a sliver.
          // Rotate the core section as a whole while its loose skirt overtakes it.
          const nose=under*ease(.34,.74,v);
          const nod=.16*Math.sin(.67*currentTime+seed);
          const capWidth=bulk*(id<2?2.05:1.81)*portraitWidth*(1+.09*Math.cos(.81*currentTime+seed));
          const coreX=slope*plunge*.58+approach*column.neighbourX*.57+.030*gesture*Math.sin(currentTime*.87+seed);
          const capX=coreX+side*capWidth-(v-.80)*plunge*nod;
          const capD=plunge*mix(tail,1.02,v)+side*capWidth*nod+deep*.010+.014*gesture*Math.cos(.60*currentTime+seed);
          const x=s.x+mix(sheetX,capX,nose)/Math.max(1,aspect);
          const d=mix(sheetD,capD,nose);
          const z=s.z+axial.z+deep*halfWidth*.63+.042*reach*Math.sin(6*v+seed);
          const pos=projectTank(x,d,z,cam,aspect);
          circle(pos,orbits.get(id),v);
          if(shown>0){const b=lateRail(s,late,v,rail,P,aspect,cam);for(let axis=0;axis<3;axis++)pos[axis]=mix(pos[axis],b[axis],shown);}
          if(anatomical)for(let axis=0;axis<3;axis++)pos[axis]=mix(pos[axis],rails[rail][axis],anatomical);
          // The tissues first compact into a profile on the same optical
          // chord. Only at the end does its remaining thread touch the solid.
          const follow=g.owner===id?0:ease(g.end-Math.min(.028,site.duration*.23),g.end,P);
          const wet=born*(1-ease(g.capture,g.end,P))*(1-.55*capGives);
          const offset=4*((b*rows+j)*width+cols+rail);
          for(let axis=0;axis<3;axis++)mesh[offset+axis]=encode(mix(pos[axis],g.target[axis],follow));
          mesh[offset+3]=Math.round(65535*wet);
          if(formK!==undefined && v>=.72){
            const t=6*formK,x=mix(pos[0],g.target[0],follow),y=mix(pos[1],g.target[1],follow);
            trackSums[t]+=x;trackSums[t+1]+=y;trackSums[t+2]+=mix(pos[2],g.target[2],follow);
            trackSums[t+3]+=x*x;trackSums[t+4]+=y*y;trackSums[t+5]++;
          }
        }
      }
    }
    // The heads' discharges (ink-swirl.js): each jet lays its trail from where its head was when it left,
    // densest at its running tip, the trail behind spreading and thinning into mist.
    for(const d of DISCHARGES){
      if(d.id>=drops.length)continue;
      const at=dischargeAt(d,P);
      if(!at)continue;
      if(!jets.has(d))jets.set(d,{from:headAt(d.id,d.start,aspect),path:dischargePath(d)});
      const {from,path}=jets.get(d),n=path.length,white=drops[d.id].white,narrow=Math.min(1,aspect);
      for(let i=0;i<n;i++){
        const f=i/(n-1);
        if(f>at.run)break;
        const tip=Math.exp(-(((at.run-f)/.16)**2));
        const r=(d.width*(.7+.7*tip)+.02*at.age*(1-tip))*narrow;
        const amount=at.fade*(.16+.42*tip)*(1-.3*(1-f)*(1-tip));
        splat(field,nx,ny,nz,(from[0]+path[i][0])/aspect,from[1]+path[i][1],Math.min(.97,from[2]+.025*Math.sin(d.seed+4*f)),r,amount,white);
      }
    }
    // As each solid sets, the last of its solvent leaves it: curls of steam (ivory) or soot (black) rise
    // off it and thin into the water.
    for(const site of sites){
      const dur=site.duration,steam=ease(site.birth+.5*dur,site.birth+.8*dur,P)*(1-ease(site.birth+1.05*dur,site.birth+1.5*dur,P));
      if(steam<=0)continue;
      const white=Number(!site.piece.black),age=(P-site.birth)/dur;
      for(let k=0;k<4;k++){
        const rise=site.size*(.18+.22*k+.35*age)*Math.min(1,aspect),sway=.012*Math.sin(2.1*k+19*P+site.slot);
        splat(field,nx,ny,nz,site.x+sway/Math.max(1,aspect),site.y+rise,site.z-.01*k,(.014+.006*k)*Math.min(1,aspect),.11*steam*(1-.18*k),white);
      }
    }
    for(let k=0;k<forms.length;k++){
      const [x,y,z,xx,yy,n]=trackSums.subarray(6*k,6*k+6),o=4*(frame*FORMS.length+k);
      if(!n)continue;
      const mx=x/n,my=y/n;
      tracks[o]=mx;tracks[o+1]=my;tracks[o+2]=z/n;
      tracks[o+3]=Math.max(.02,Math.sqrt(Math.max(0,xx/n-mx*mx)*aspect*aspect+Math.max(0,yy/n-my*my)));
    }
    const density=new Uint8Array(field.length);
    for(let n=0;n<field.length;n++)if(field[n]>0)density[n]=lut[Math.min(2048,Math.round(field[n]*256))];
    emit({frame,density,mesh});
  }
  emit({ledger,massBook,tracks});
}
