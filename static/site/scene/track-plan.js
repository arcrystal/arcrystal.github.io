// One stadium geometry for the worker, GPU and generated SVG. CSS pixels, y down.
export const TRACK = Object.freeze({ lanes: 8, straight: .25, inner: .17, lane: .01, tilt: -Math.PI / 15, squash: .86, settle: [.96, 1.14] });
const clamp = x => Math.max(0, Math.min(1, x));
export const trackEase = x => { x = clamp(x); return x*x*x*(x*(x*6-15)+10); };
export function trackFrame(W, H, card, P = 0) {
  const t = trackEase((P - TRACK.settle[0]) / (TRACK.settle[1] - TRACK.settle[0]));
  const big = [W*.5, H*.49+20, Math.min(W*.84, (H-150)/.65)];
  const small = [card[0]+card[2]/2, card[1]+card[3]/2, Math.min(card[2]*.88, card[3]/.70)];
  return big.map((v,i)=>v+(small[i]-v)*t);
}
export function trackToWorld(q, frame) {
  const c=Math.cos(TRACK.tilt), s=Math.sin(TRACK.tilt), x=q[0]*frame[2], y=q[1]*frame[2]*TRACK.squash;
  return [frame[0]+c*x-s*y,frame[1]+s*x+c*y];
}
export function trackLocal(q, frame) {
  const c=Math.cos(TRACK.tilt),s=Math.sin(TRACK.tilt),x=q[0]-frame[0],y=q[1]-frame[1];
  return [(c*x+s*y)/frame[2],(-s*x+c*y)/(frame[2]*TRACK.squash)];
}
export function trackRadius(lane) { return TRACK.inner+(lane+.5)*TRACK.lane; }
export function trackPoint(phase, lane) {
  const a=TRACK.straight,r=trackRadius(lane),L=4*a+2*Math.PI*r;
  let s=((phase%1)+1)%1*L;
  if(s<2*a)return [a-s,-r]; s-=2*a;
  if(s<Math.PI*r){const t=-Math.PI/2-s/r;return [-a+r*Math.cos(t),r*Math.sin(t)];} s-=Math.PI*r;
  if(s<2*a)return [-a+s,r]; s-=2*a;
  const t=Math.PI/2-s/r;return [a+r*Math.cos(t),r*Math.sin(t)];
}
export function trackTangent(phase,lane) {
  const a=trackPoint(phase-1e-6,lane),b=trackPoint(phase+1e-6,lane),d=Math.hypot(b[0]-a[0],b[1]-a[1]);return [(b[0]-a[0])/d,(b[1]-a[1])/d];
}
export function trackDistance(q,frame) {
  const p=trackLocal(q,frame),r=Math.hypot(Math.max(Math.abs(p[0])-TRACK.straight,0),p[1]);
  return Math.max(TRACK.inner-r,r-(TRACK.inner+8*TRACK.lane),0)*frame[2];
}
export function trackShardAt(sh, P, W, H, card) {
  const entry=clamp((P-sh.t0)/(sh.join-sh.t0));
  if(P<sh.join){const v=1-entry;return sh.start.map((x,i)=>v*v*v*x+3*v*v*entry*sh.control[i]+3*v*entry*entry*sh.control2[i]+entry**3*sh.entry[i]);}
  const u=clamp((P-sh.join)/(sh.t1-sh.join));
  return trackToWorld(trackPoint(sh.phase+sh.laps*u,sh.lane),trackFrame(W,H,card,P));
}
// Shared functions are constant-time; no particle searches in fragment shaders.
export const TRACK_GLSL = /* glsl */ `
const float TR_A = ${TRACK.straight};
const float TR_IN = ${TRACK.inner};
const float TR_LANE = ${TRACK.lane};
vec2 trRotate(vec2 p) { return mat2(${Math.cos(TRACK.tilt)}, ${Math.sin(TRACK.tilt)}, ${-Math.sin(TRACK.tilt)}, ${Math.cos(TRACK.tilt)}) * p; }
float trEase(float x) { x=clamp(x,0.0,1.0); return x*x*x*(x*(x*6.0-15.0)+10.0); }
vec3 trFrame(vec2 wh, vec4 card, float P) {
  vec3 big=vec3(wh*vec2(.5,.49)+vec2(0.0,20.0),min(wh.x*.84,(wh.y-150.0)/.65));
  vec3 small=vec3(card.xy+card.zw*.5,min(card.z*.88,card.w/.70));
  return mix(big,small,trEase((P-.96)/.18));
}
vec2 trWorld(vec2 p,vec3 frame) { return frame.xy+trRotate(p*vec2(1.0,${TRACK.squash})*frame.z); }
vec2 trLocal(vec2 p,vec3 frame) { vec2 d=p-frame.xy; return vec2(dot(d,trRotate(vec2(1,0))),dot(d,trRotate(vec2(0,1))))/frame.z/vec2(1.0,${TRACK.squash}); }
float trRadius(vec2 p) { return length(vec2(max(abs(p.x)-TR_A,0.0),p.y)); }
vec4 trSample(float phase,float lane) {
 float r=TR_IN+(lane+.5)*TR_LANE,s=fract(phase)*(4.0*TR_A+6.28318530718*r);
 if(s<2.0*TR_A)return vec4(TR_A-s,-r,-1.0,0.0);s-=2.0*TR_A;
 if(s<3.14159265359*r){float t=-1.57079632679-s/r;return vec4(-TR_A+r*cos(t),r*sin(t),sin(t),-cos(t));}s-=3.14159265359*r;
 if(s<2.0*TR_A)return vec4(-TR_A+s,r,1.0,0.0);s-=2.0*TR_A;
 float t=1.57079632679-s/r;return vec4(TR_A+r*cos(t),r*sin(t),sin(t),-cos(t));
}
vec2 trPoint(float phase,float lane) { return trSample(phase,lane).xy; }
float trDistance(vec2 q,vec3 frame) { float r=trRadius(trLocal(q,frame));return max(max(TR_IN-r,r-.25),0.0)*frame.z; }
`;
export function trackSVG() {
  const paths=Array.from({length:9},(_,i)=>{const r=TRACK.inner+i*TRACK.lane;return `<path d="M .25 ${-r} H -.25 A ${r} ${r} 0 0 0 -.25 ${r} H .25 A ${r} ${r} 0 0 0 .25 ${-r} Z"/>`;}).join('');
  return `<svg class="r-track-still" viewBox="0 0 400 300" aria-hidden="true"><defs><filter id="track-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".065"/></feComponentTransfer></filter></defs><g transform="translate(200 150) rotate(-12) scale(352 302.72)"><rect x="-.5" y="-.25" width="1" height=".5" rx=".25" fill="#ac5544"/><rect x="-.42" y="-.17" width=".84" height=".34" rx=".17" fill="#435b4b"/><g fill="none" stroke="#f4eee1" stroke-width=".0017">${paths}</g><path d="M .11 -.25 V -.17" stroke="#f4eee1" stroke-width=".004"/></g><rect width="400" height="300" filter="url(#track-grain)" opacity=".5"/></svg>`;
}

// The accretion disc and stadium are one nested family; q=0..1 is the material coordinate.
export function capsulePoint(phase,q,morph) {
  const m=trackEase(morph),a=TRACK.straight*m,r=(3.6+8.4*q)/24*(1-m)+(TRACK.inner+8*TRACK.lane*q)*m;
  let d=((phase%1)+1)%1*(4*a+2*Math.PI*r);
  if(d<2*a)return [a-d,-r];d-=2*a;
  if(d<Math.PI*r){const t=-Math.PI/2-d/r;return [-a+r*Math.cos(t),r*Math.sin(t)];}d-=Math.PI*r;
  if(d<2*a)return [-a+d,r];d-=2*a;
  const t=Math.PI/2-d/r;return [a+r*Math.cos(t),r*Math.sin(t)];
}
export const ACCRETION_GEOMETRY=/* glsl */`
float acMorph(float P){return trEase((P-1.02)/.12);}
float acSquash(float P){return cos(mix(1.2217304764,acos(.86),acMorph(P)));}
vec3 acFrame(vec2 wh,vec4 card,float P){
 vec3 big=trFrame(wh,card,0.0),small=trFrame(wh,card,1.2);
 return mix(big,small,trEase((P-1.02)/.12));
}
vec2 acWorld(vec2 p,vec3 f,float P){return f.xy+trRotate(p*vec2(1.0,acSquash(P))*f.z);}
vec2 acLocal(vec2 p,vec3 f,float P){vec2 d=p-f.xy;return vec2(dot(d,trRotate(vec2(1,0))),dot(d,trRotate(vec2(0,1))))/f.z/vec2(1.0,acSquash(P));}
float acRadius(float q,float P){return mix((3.6+8.4*q)/24.0,TR_IN+8.0*TR_LANE*q,acMorph(P));}
vec2 acCapsule(float phase,float q,float P){
 float a=TR_A*acMorph(P),r=acRadius(q,P),s=fract(phase)*(4.0*a+6.28318530718*r);
 if(s<2.0*a)return vec2(a-s,-r);s-=2.0*a;
 if(s<3.14159265359*r){float t=-1.57079632679-s/r;return vec2(-a+r*cos(t),r*sin(t));}s-=3.14159265359*r;
 if(s<2.0*a)return vec2(-a+s,r);s-=2.0*a;
 float t=1.57079632679-s/r;return vec2(a+r*cos(t),r*sin(t));
}
`;
