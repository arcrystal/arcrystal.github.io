// Ice, illuminated: electric crystal. Shared scroll/click material, a pure function of q and P (no
// clock, pointer, velocity or fluid history; only the snapshots it looks through move).
//   Optics kept physical: crossed-polariser interference T = sin²2φ·sin²(πΓ/λ), integrated per
//   channel through CIE 1931 / D65 (uIceSpectrum), Γ from thickness; Beer–Lambert absorption; Snell
//   refraction at each facet; Schlick Fresnel.
//   Artistic: the kaleidoscope (each grain sees what lies beneath it through six mirrored wedges about
//   its own arms), the electric veins deep in the ice, the light travelling along each fissure, and
//   the glow, flares and glints.
export const ICE_GLSL = /* glsl */ `
uniform sampler2D uIceAtlas;
uniform sampler2D uIceSpectrum;
uniform float uIceReady;
uniform float uIceDetail;
// Linear RGB.
const vec3 ICE_MIDNIGHT = vec3(.0015, .004, .02), ICE_COBALT = vec3(.002, .018, .14), ICE_INDIGO = vec3(.03, .012, .15);
const vec3 ICE_CYAN = vec3(.1, .82, 1.0), ICE_TURQUOISE = vec3(.03, .78, .6), ICE_VIOLET = vec3(.46, .14, 1.0);
// Retardances (nm) whose first- and second-order interference colours the chips settle on: amber,
// magenta, violet, blue, cyan, turquoise, rose, violet.
const float ICE_ORDERS[8] = float[8](455.0, 520.0, 565.0, 640.0, 705.0, 745.0, 1010.0, 1100.0);
const vec3 ICE_MAGENTA = vec3(.95, .1, .6), ICE_AMBER = vec3(1.0, .5, .1), ICE_WHITE = vec3(.82, .96, 1.0);
vec4 iceData(int i) { return texelFetch(uReach, ivec2(i % 1024, i / 1024), 0); }
vec3 iceLinear(vec3 c) { return mix(c / 12.92, pow(max((c + 0.055) / 1.055, 0.0), vec3(2.4)), step(vec3(0.04045), c)); }
vec3 iceDisplay(vec3 c) { c = max(c, 0.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec4 iceAtlas(vec2 p) {
  ivec2 a = ivec2(floor(p)); vec2 f = fract(p);
  return mix(mix(texelFetch(uIceAtlas, a, 0), texelFetch(uIceAtlas, a + ivec2(1,0), 0), f.x),
             mix(texelFetch(uIceAtlas, a + ivec2(0,1), 0), texelFetch(uIceAtlas, a + ivec2(1,1), 0), f.x), f.y);
}
vec3 iceIntegral(float G) {
  float x = clamp(G / 2200.0, 0.0, 1.0) * 2047.0; int i = int(x);
  return mix(texelFetch(uIceSpectrum, ivec2(i,0), 0).rgb, texelFetch(uIceSpectrum, ivec2(min(i+1,2047),0), 0).rgb, fract(x));
}
float iceUp(vec2 q, vec2 S, bool click) { return click ? clamp(length(q-uPoint) / farCorner(uPoint),0.0,1.0) : 1.0-q.y/S.y; }
float iceClear(vec2 q, vec2 S, float P, bool click) {
  float c = 0.84 + 0.18 * iceUp(q,S,click) + 0.006*sin(q.x*.008)*sin(q.y*.007)*(click?iceUp(q,S,click):1.0);
  return smoothstep(c,c+.08,P);
}
// Crack propagation is delayed into the fully frozen cover for radial entry. Geometry is unchanged.
vec2 iceCrackTimes(vec2 times, bool click) { return click ? vec2(.72) + (times - .52) * .3 : times; }
// A compact pulse on [0,1], zero in value and slope at both ends, peaking at x = .29.
vec2 iceUV(vec2 q, vec2 S) { return vec2(q.x / S.x, 1.0 - q.y / S.y); }
float icePulse(float x) { if (x <= 0.0 || x >= 1.0) return 0.0; float y = 1.0 - (1.0 - x) * (1.0 - x); return 16.0 * y * y * (1.0 - y) * (1.0 - y); }
// Hue-preserving highlight compression: the brightest channel rolls off above .6 toward 1 and every
// channel is scaled by the same factor, so saturated light stays its own colour.
vec3 iceCompress(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  return m <= .6 ? c : c * ((.6 + .4 * (1.0 - exp(-(m - .6) / .4))) / m);
}
float iceCross(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
float icePlane(vec2 p0, float h0, vec2 p1, float h1, vec2 p2, float h2, vec2 q, out vec2 g) {
  vec2 a = p1 - p0, b = p2 - p0; float det = iceCross(a, b), d1 = h1 - h0, d2 = h2 - h0;
  g = vec2(d1 * b.y - d2 * a.y, d2 * a.x - d1 * b.x) / det;
  return h0 + dot(g, q - p0);
}
// The nested cut (ice-plan.js facetAt): the sector between the rays to two neighbouring vertices,
// its band between the homothetic rings, then the half of that band's quad on q's side of its
// diagonal. Heights in material units (2.2 CSS px each); ridge = distance to the nearest facet edge.
struct IceCut { float h; vec2 grad; float border; float ridge; float key; };
IceCut iceCut(vec2 q, vec2 N, int start, int n, bool phone) {
  IceCut c; vec2 dq = q - N;
  vec4 first = iceData(start), A = first, Va = first, Vb = iceData(start + 1); bool found = false;
  c.border = 1e9; c.key = 0.0;
  for (int j = 0; j < 16; j++) {
    if (j >= n) break;
    vec4 B = j + 1 < n ? iceData(start + j + 1) : first;
    vec2 e = B.xy - A.xy;
    c.border = min(c.border, dot(q - A.xy, vec2(-e.y, e.x)) / max(length(e), 1e-4));
    if (!found && iceCross(A.xy - N, dq) >= 0.0 && iceCross(dq, B.xy - N) >= 0.0) { found = true; Va = A; Vb = B; c.key = float(j); }
    A = B;
  }
  vec2 e = Vb.xy - Va.xy, inward = vec2(-e.y, e.x) / length(e);
  float dN = dot(N - Va.xy, inward), t = 1.0 - dot(q - Va.xy, inward) / dN;
  float f0 = phone ? .55 : .38, f1 = .72;
  vec2 a0 = N + (Va.xy - N) * f0, b0 = N + (Vb.xy - N) * f0;
  c.ridge = min(abs(iceCross(normalize(Va.xy - N), dq)), abs(iceCross(normalize(Vb.xy - N), dq)));
  c.ridge = min(c.ridge, abs(t - f0) * dN);
  if (!phone) c.ridge = min(c.ridge, abs(t - f1) * dN);
  if (t < f0) { c.h = icePlane(N, 23.0, a0, Va.z, b0, Vb.z, q, c.grad); return c; }
  bool outer = phone || t >= f1;
  vec2 A2 = outer && !phone ? N + (Va.xy - N) * f1 : a0, B2 = outer && !phone ? N + (Vb.xy - N) * f1 : b0;
  float hA = outer && !phone ? Va.w : Va.z, hB = outer && !phone ? Vb.w : Vb.z;
  vec2 C2 = outer ? Va.xy : N + (Va.xy - N) * f1, D2 = outer ? Vb.xy : N + (Vb.xy - N) * f1;
  float hC = outer ? 5.0 : Va.w, hD = outer ? 5.0 : Vb.w;
  vec2 diag = D2 - A2; float side = iceCross(diag, q - A2), ref = iceCross(diag, B2 - A2);
  c.ridge = min(c.ridge, abs(side) / length(diag));
  bool upper = side * ref >= 0.0;
  c.h = upper ? icePlane(A2, hA, B2, hB, D2, hD, q, c.grad) : icePlane(A2, hA, D2, hD, C2, hC, q, c.grad);
  c.key += 16.0 * ((outer && !phone ? 3.0 : 1.0) + (upper ? 0.0 : 1.0));
  return c;
}
// Six mirrored wedges about a crystal's own arm direction a: what lies under a grain is seen as a
// twelve-segment rosette, as through a kaleidoscope's mirrors.
vec2 iceFold(vec2 d, float a) {
  float r = length(d), t = atan(d.y, d.x) - a;
  t = abs(mod(t + PI / 6.0, PI / 3.0) - PI / 6.0);
  return r * vec2(cos(t + a), sin(t + a));
}
// Electric veins deep in the ice: warped, ridged value noise, thin bright filaments, cyan to violet.
vec3 iceVeins(vec2 p, float P) {
  vec2 w = vec2(noise(p * .7 + vec2(3.1, P * 1.3)), noise(p * .7 - vec2(1.7, P * 1.1))) - .5;
  float a = pow(1.0 - abs(2.0 * noise(p + w * 1.8) - 1.0), 16.0);
  float b = pow(1.0 - abs(2.0 * noise(p * 2.2 + w * 2.6 + 7.0) - 1.0), 22.0);
  return mix(ICE_CYAN, ICE_VIOLET, smoothstep(.35, .7, noise(p * .35 + 9.0))) * (a + .6 * b);
}
// Hoarfrost: fine barbs along the three directions of a grain's arms (ice branches at 60°), broken
// into short feathers.
float iceFrost(vec2 q, float a) {
  float f = 0.0;
  for (int k = 0; k < 3; k++) {
    float t = a + float(k) * PI / 3.0 + PI / 6.0;
    vec2 d = vec2(cos(t), sin(t));
    float x = dot(q, vec2(-d.y, d.x)) / 4.2 + float(k) * .37;
    float barb = 1.0 - smoothstep(.05, .16, abs(fract(x) - .5));
    f = max(f, barb * smoothstep(.58, .8, noise(vec2(dot(q, d) / 9.0, floor(x) * .71 + float(k) * 3.1))));
  }
  return f;
}
vec4 iceMaterial(vec2 q, vec2 px, vec2 S, float P, bool click, bool reveal) {
  float aa = max(fwidth(q.x) + fwidth(q.y), .6) * .7;
  if (P <= -.2) return click ? vec4(0.0) : vec4(sceneCosmos(px),1.0);
  float clear = iceClear(q,S,P,click);
  if (P >= 1.12 || clear >= 1.0) return click ? vec4(0.0) : vec4(sceneGlacier(px),1.0);
  if (uIceReady < .5) {
    float f = smoothstep(-.2,.72,P);
    return click ? vec4(iceDisplay(vec3(.025,.12,.2)) * f * (1.0-clear),f*(1.0-clear)) : vec4(mix(sceneCosmos(px),sceneGlacier(px),smoothstep(-.2,1.12,P)),1.0);
  }
  vec4 header=iceData(0), counts=iceData(1), offsets=iceData(2), atlasInfo=iceData(3);
  bool phone = counts.w > .5, full = uIceDetail > .5;
  ivec2 tile=clamp(ivec2(q/atlasInfo.w),ivec2(0),ivec2(header.zw)-1);
  vec4 list=iceData(int(offsets.w)+tile.y*int(header.z)+tile.x);
  float best=1e30; int id=0;
  for(int j=0;j<int(list.y);j++) {
    int candidate=int(iceData(int(list.x)+j).x);vec2 n=iceData(int(offsets.x)+candidate*4).xy;
    float d=dot(q-n,q-n);if(d<best){best=d;id=candidate;}
  }
  int gi=int(offsets.x)+id*4;
  vec4 g=iceData(gi), box=iceData(gi+1), attr=iceData(gi+2), shape=iceData(gi+3);
  vec2 f=clamp((q-box.xy)/max(box.zw,vec2(1.0)),0.0,1.0);
  vec4 field=iceAtlas(attr.xy+f*(atlasInfo.z-1.0));
  float up=iceUp(q,S,click), upN=iceUp(g.xy,S,click);
  float cold=-.18+.62*up, birth=-.11+.39*upN+attr.z;
  float arrival=max(cold,birth+field.x), frozen=smoothstep(arrival,arrival+.055,P);
  float cool=smoothstep(cold-.045,cold,P), keep=1.0-clear;
  // Nucleation: as each nucleus freezes it catches a small violet or turquoise spark.
  float spark=icePulse((P-max(birth,-.18+.62*upN)+.02)/.1);
  vec2 dn=q-g.xy; float rn2=dot(dn,dn);
  spark*=exp(-rn2/40.0)+.35*exp(-abs(dn.x)*1.6-abs(dn.y)/9.0)+.35*exp(-abs(dn.y)*1.6-abs(dn.x)/9.0);
  if(!click && cool<=0.0 && frozen<=0.0 && spark<=.001) return vec4(sceneCosmos(px),1.0);
  vec3 sparkCol=mix(ICE_VIOLET,ICE_TURQUOISE,step(.5,hash(g.xy)))*spark*1.6;
  // The cooling disturbance: a cyan front rising from the foot, frost forming in it.
  float front=icePulse((P-cold+.07)/.12), frost=iceFrost(q,g.w);
  vec3 haze=ICE_COBALT*.5*cool+ICE_CYAN*(.035*cool+.16*front*frost)+sparkCol;
  if(frozen<=0.0){
    if(click) return vec4(iceDisplay(iceCompress(haze/.72))*cool*.72*keep,cool*.72*keep);
    return vec4(iceDisplay(iceLinear(sceneCosmos(px))*mix(1.0,.42,cool)+haze),1.0);
  }
  IceCut cut=iceCut(q,g.xy,int(shape.z),int(shape.w),phone);
  float height=cut.h; vec2 grad=cut.grad; float hero=attr.w;
  float age=max(P-arrival,0.0), mature=smoothstep(0.0,.16,age);
  // Fissures: recessed grooves (lips, two walls, a connected floor) and the light that runs along them.
  // Lips and glow read the signed distance to the union of the opened grooves (one outline for the
  // whole fissure, not one per piece), lit by the nearest piece's travelling light.
  float groove=0.0, flare=0.0, hue=0.0, edgeOff=1e9, axis=1e9, energyN=0.0; vec2 grooveGrad=vec2(0.0), deltaN=vec2(0.0);
  float reach=phone?4.0:6.0;
  if(P>(click?.71:.5)) for(int j=0;j<int(list.w);j++) {
    int ci=int(offsets.y)+int(iceData(int(list.z)+j).x)*3;
    vec4 meta=iceData(ci+2);
    if(!full && meta.x>=2.0) continue;
    vec4 e=iceData(ci+1); vec2 times=iceCrackTimes(e.xy,click);
    if(P<times.x) continue;
    vec4 line=iceData(ci);
    vec2 d=line.zw-line.xy; float L=max(length(d),.0001); vec2 u=d/L;
    float projection=dot(q-line.xy,u), along=clamp(projection,0.0,L), s=along/L;
    vec2 delta=q-(line.xy+u*along); float distance=length(delta);
    float tf=mix(times.x,times.y,s), z=clamp((P-tf)/.018,0.0,1.0), open=z*z*(3.0-2.0*z);
    float aperture=e.z*open, off=distance-aperture;
    if(off>reach) continue;
    float depth=min(e.w,height*.65), raw=open-distance/e.z, carve=depth*max(0.0,raw);
    if(carve>groove){
      groove=carve; float dop=-6.0*z*(1.0-z)*(times.y-times.x)/(.018*L);
      grooveGrad=depth*(u*dop*step(0.0,projection)*step(projection,L)-delta/max(distance,.001)/e.z);
      if(e.w>height*.65) grooveGrad+=.65*grad*raw;
      hue=hash(line.xy*.37+meta.yy);
    }
    // A compact wave of light follows the opening by arc length, then a restrained steady glow.
    if(open>0.0 && off<edgeOff){edgeOff=off; axis=distance; deltaN=delta; energyN=(.45*open+2.4*icePulse((P-tf)/.035))*pow(.72,meta.x)*sqrt(open);}
    if(meta.w>.5){vec2 J=q-line.xy;float r=length(J);flare=max(flare,icePulse((P-times.x)/.035)*exp(-r*r/5.0)*(1.0-smoothstep(reach*.5,reach,r)));}
  }
  // The lip facing the light is the brighter one.
  float lit=.55+.45*dot(normalize(deltaN+1e-4),normalize(vec2(-.8+1.45*smoothstep(.58,.90,P),-.55)));
  float w=max(.7,aa);
  float lip=exp(-edgeOff*edgeOff/(w*w))*energyN*lit*keep;
  float glow=full?exp(-max(edgeOff,0.0)/1.8)*(1.0-smoothstep(reach*.45,reach,max(edgeOff,0.0)))*energyN*keep:0.0;
  float floorLit=exp(-axis*axis/.5)*energyN*keep;
  groove*=keep; grooveGrad*=keep; flare*=keep;
  grad-=grooveGrad;
  // Light: an oblique sweep (.58 → .90) and an eye above the middle of the screen.
  vec3 Nn=normalize(vec3(-grad*2.2,1.0));
  float sweep=smoothstep(.58,.90,P);
  vec3 Ld=normalize(vec3(mix(-.8,.65,sweep),-.55,.9)), V=normalize(vec3(-(q-S*.5)/max(S.y,1.0)*.7,1.0)), Hh=normalize(Ld+V);
  float diffuse=max(dot(Nn,Ld),0.0), spec=pow(max(dot(Nn,Hh),0.0),mix(80.0,240.0,hero));
  float fresnel=.02+.98*pow(1.0-max(dot(Nn,V),0.0),5.0);
  // Transmission: the view ray refracts at its facet (n = 1.31) and meets a deep layer seen through
  // the grain's kaleidoscope, which turns with progress.
  vec3 Rr=refract(-V,Nn,1.0/1.31);
  vec2 shift=Rr.xy/max(-Rr.z,.25)*(phone?55.0:95.0);
  float spin=.85*P+attr.z*6.0+g.z;
  vec2 kq=rot(spin)*iceFold(dn,g.w);
  vec2 kale=g.xy+kq*(.72+.12*hero)+shift+28.0*vec2(sin(P*2.3+g.z*5.0),cos(P*1.9+g.z*3.0));
  float through=mature*keep;
  vec3 deep=vec3(0.0);
  float cStart=.84+.18*up;
  if(!click){
    vec2 k=clamp(kale,vec2(1.0),S-1.0), radial=(k-g.xy)*.035;
    deep.r=iceLinear(texture(uTexA,iceUV(k-radial,S)).rgb).r;
    deep.g=iceLinear(texture(uTexA,iceUV(k,S)).rgb).g;
    deep.b=iceLinear(texture(uTexA,iceUV(k+radial,S)).rgb).b;
    // Seen through cold ice, Science's colours give way to its light: bright detail (stars, the rims of
    // its drops) comes through as cyan and violet; the rest sinks.
    float l=dot(deep,vec3(.2126,.7152,.0722));
    deep=mix(ICE_VIOLET*.7,ICE_CYAN,smoothstep(.05,.5,l)+.3*(deep.b-deep.r))*pow(l,1.35)*1.6;
    float handoff=smoothstep(cStart-.1,cStart+.02,P);
    if(handoff>0.0) deep=mix(deep,iceLinear(textureLod(uTexB,iceUV(k,S),1.5).rgb),handoff);
  }
  vec3 veins=full?iceVeins(kale/(phone?60.0:85.0),P):vec3(0.0);
  float thin=clamp((height-groove)/23.0,0.0,1.0);
  vec3 absorb=exp(-(.5+1.1*thin)*vec3(2.6,.75,.22));
  // Interference between crossed polarisers. Γ grows as the ice thickens with age; within a grain it
  // follows the nested relief, so colour bands follow the cut. The stage turns slowly, carrying grains
  // through extinction in turn.
  // Interference between crossed polarisers, Γ = Δn·t. The ice thickens with age; within a grain the
  // thickness follows the nested relief and a pattern seen through the same kaleidoscope, so each
  // crystal blooms as a symmetric rosette of colour that turns with progress. The stage turns slowly,
  // carrying grains through extinction in turn.
  // The chips: platelets of different thickness, cells of the grain's folded, turning frame, so they
  // drift through the mirrors as the page scrolls. Each takes its own interference colour.
  float chipS=hero>.5?(phone?22.0:30.0):(phone?9.0:12.0);
  vec2 cq=(kq+shift*.55)/chipS+g.z*17.0, ci=floor(cq), chip=ci; float d1=9.0, d2=9.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 o=ci+vec2(x,y), p=o+.12+.76*hash2(o);
    float d=length(cq-p); if(d<d1){d2=d1;d1=d;chip=o;} else if(d<d2) d2=d;
  }
  float chipH=hash(chip+3.7), chipEdge=(d2-d1)*chipS*.5, chipD=d1;
  float bloom=step(.62-.3*hero,hash(chip+11.3))*smoothstep(0.0,aa*1.5,chipEdge);
  // Principal crystals hold the rosettes; the smaller grains stay quiet, with a faint wash of colour
  // that follows their relief.
  bloom*=hero;
  float grow=smoothstep(0.0,.5,age);
  float G=ICE_ORDERS[min(int(chipH*(6.0+2.0*hero)),7)]*(.35+.65*grow)*(.9+.14*thin);
  float phi=g.z+.45*P, s2=sin(2.0*phi);
  float extinct=.3+.7*s2*s2;
  float shown=smoothstep(380.0,470.0,G);
  vec3 polar=max(extinct*iceIntegral(G),0.0)*shown*(.92*bloom);
  float Gw=(560.0+120.0*hash(g.xy+1.3))*(.35+.65*grow)*(.7+.45*thin);
  polar+=max(extinct*iceIntegral(Gw),0.0)*smoothstep(260.0,430.0,Gw)*.07*(1.0-hero);
  // Facets catch the light in turn, like a cut stone: lit ones transmit electric cyan, others stay dark.
  float catchL=pow(diffuse,8.0)*(.55+.45*exp(-cut.ridge/9.0));
  // The oblique light sweep: a broad band crossing the screen between P .58 and .90.
  float band=exp(-pow((dot(q/max(S.y,1.0),normalize(vec2(1.0,.42)))-mix(-.25,2.1,sweep))/.2,2.0));
  // The body: midnight and cobalt depths, indigo where the ice is thin, then transmitted light.
  vec3 body=mix(ICE_MIDNIGHT,ICE_COBALT,.15+.55*thin)+ICE_INDIGO*.3*(1.0-thin);
  body+=(deep*.6+veins*(.2+.45*hero))*absorb*through*(.3+.7*catchL);
  body+=mix(ICE_TURQUOISE,ICE_CYAN,catchL)*(.13*catchL+.35*band*catchL*catchL)*mature;
  body=mix(body,body*.25,bloom*shown*extinct*mature*.85)+polar*mature*(.3+.9*pow(diffuse,3.0)+.4*exp(-chipD*chipD*2.5));
  body+=ICE_WHITE*exp(-length(dn)/(phone?7.0:11.0))*hero*mature*.5;
  float rosette=hero*(1.0-smoothstep(shape.x*.8,shape.x*.95,length(dn)));
  body+=mix(ICE_CYAN,ICE_WHITE,.55)*(1.0-bloom)*rosette*mature*(.05+.1*frost+.08*catchL);
  body+=mix(ICE_WHITE,ICE_CYAN,.3)*exp(-chipEdge/.6)*rosette*mature*.12;
  // Chip edges catch a little light, as glass fragments do.
  body+=mix(ICE_CYAN,ICE_WHITE,.4)*exp(-chipEdge/.7)*bloom*extinct*mature*.2;
  // Bevels: facet edges stay faint until the oblique sweep or a highlight catches them; then a
  // cyan-white core with spectral shoulders.
  float edgeLight=mature*(.006+.1*spec+.12*band*catchL);
  float core=exp(-pow(cut.ridge/aa,2.0)), shoulder=exp(-pow((cut.ridge-1.5)/.7,2.0));
  vec3 fringe=mix(ICE_VIOLET,mix(ICE_MAGENTA,ICE_AMBER,step(.82,hash(vec2(cut.key,float(id))))),hash(vec2(float(id),cut.key)));
  body+=(ICE_WHITE*core+fringe*shoulder*.5)*edgeLight;
  // Frost sparkle: sparse points on a 7 px lattice twinkle as the sweep crosses facets facing it.
  if(full){
    vec2 cell=floor(q/7.0), jit=hash2(cell+19.0);
    float r=length(q-(cell+.2+.6*jit)*7.0), on=step(.93,hash(cell+7.7));
    float tw=icePulse(clamp((band-.25)/.75,0.0,1.0)*(.6+.8*jit.x));
    body+=ICE_WHITE*on*exp(-r*r/.9)*tw*(.4+catchL)*mature*1.4;
  }
  // Grain boundaries: frosted seams.
  float seam=exp(-max(cut.border,0.0)/1.2);
  body+=mix(ICE_CYAN,ICE_WHITE,frost)*seam*(.06+.35*band)*mature*(.35+frost);
  // Surface sheen.
  body+=mix(ICE_CYAN,ICE_WHITE,.6)*spec*(.06+.1*frost*(1.0-mature))+ICE_CYAN*fresnel*.06;
  // Growth: bright advancing tips and their trailing branches, hoarfrost on the young ice.
  float skeleton=exp(-field.y/1.15);
  body+=ICE_CYAN*skeleton*(.02+1.1*exp(-age*24.0))+ICE_WHITE*exp(-pow((P-arrival)/.012,2.0))*.3;
  body+=mix(ICE_CYAN,ICE_WHITE,frost)*frost*.4*(1.0-mature)*(.25+.75*exp(-field.y/16.0));
  // Fissures: dark recess, walls lit differently on their two sides, the cobalt floor's transmitted
  // light, then the lips, glow and junction flares.
  // Inside: a dark recess whose two walls take the light differently (their normals come from the
  // groove), and a cobalt floor carrying a thread of transmitted cyan or violet.
  float recess=clamp(groove/3.0,0.0,1.0);
  body=mix(body,ICE_MIDNIGHT+ICE_COBALT*.35+ICE_TURQUOISE*.5*pow(diffuse,6.0),recess*.9);
  body+=mix(ICE_CYAN,ICE_VIOLET,hue)*floorLit*.6;
  body+=(ICE_WHITE*2.0+ICE_CYAN*.9)*lip+mix(ICE_CYAN,ICE_TURQUOISE,.3)*glow*.6+(ICE_WHITE*2.0+ICE_VIOLET*.6)*flare;
  // Star glints: tiny white cores, fine rays, short spectral fringes.
  if(P>.6&&P<.92&&!click||click&&P>.78&&P<.86) for(int j=0;j<int(counts.z);j++){
    if(!full && j%int(phone?3:6)>0) continue;
    vec4 e=iceData(int(offsets.z)+j);
    float a=click?.795+(e.z-.68)*.15:e.z, b=click?a+.006:e.w;
    float z=clamp((P-a)/(b-a),0.0,1.0), pulse=16.0*z*z*(1.0-z)*(1.0-z);
    if(pulse<=0.0) continue;
    vec2 d=q-e.xy; float r=length(d);
    float star=exp(-r*r/1.5)+.5*(exp(-abs(d.x)*3.0-abs(d.y)/14.0)+exp(-abs(d.y)*3.0-abs(d.x)/14.0))+.15*(exp(-abs(d.x+d.y)*2.5-abs(d.x-d.y)/9.0)+exp(-abs(d.x-d.y)*2.5-abs(d.x+d.y)/9.0));
    vec3 ring=iceIntegral(300.0+r*110.0)*exp(-pow((r-3.2)/1.0,2.0));
    body+=(ICE_WHITE*star*1.8+ring*.25)*pulse*keep;
  }
  body=iceCompress(body+sparkCol*(1.0-mature));
  if(click){
    vec3 c=mix(haze/.72,body,frozen);
    float cover=reveal?1.0:max(frozen,cool*.72),alphaOut=cover*keep;
    return vec4(iceDisplay(iceCompress(c))*alphaOut,alphaOut);
  }
  vec3 col=body;
  if(frozen<1.0) col=mix(iceLinear(sceneCosmos(px))*mix(1.0,.42,cool)+haze,body,frozen);
  if(clear>0.0) col=mix(col,iceLinear(sceneGlacier(px)),clear);
  return vec4(iceDisplay(col),1.0);
}
`;
