import test from 'node:test';
import assert from 'node:assert/strict';
import { START, SHAPES, GLYPH, pieceAt, distances, signedBytes } from '../../../static/site/scene/ink-plan.js';
import { UNMIX, SLOTS, cureAt } from '../../../static/site/scene/unmix-plan.js';
import { CAMERA, tankCamera, projectTank } from '../../../static/site/scene/ink-tank.js';
import { UNMIX_GLSL } from '../../../static/site/scene/glsl/unmix.js';
import { PLUME_GLSL } from '../../../static/site/scene/glsl/plume.js';
import { HELD, HOLD, INK_ADDED, INK_FREE, holdFor, inkRaw, inkAdded, easeFor, transitP } from '../../../static/site/lerp.js';
import { TALL, TYPES, BOARD } from '../../../static/site/scene/staunton.js';
import { D1, MORPH, TILT, SLOPE, FRONT, drainLevel, drainSlope, waterHeight, dryEdge, emergence, waveFit, boxCamera, screenRay } from '../../../static/site/scene/ink-drain.js';
import { birthSites } from '../../../static/site/scene/living-ink-plan.js';
import { MASS } from '../../../static/site/scene/living-mass.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const U = UNMIX;

test('the draining free surface retraces every rising pose and its near meniscus clears the bottom', () => {
  const [begin,end]=U.clear;
  const descendedTo=height=>{
    let low=begin,high=end;
    for(let i=0;i<52;i++){
      const mid=(low+high)/2;
      if(tankCamera(mid)[0]>height)low=mid;else high=mid;
    }
    return (low+high)/2;
  };
  for(const f of [0,.04,.12,.25,.50,.77,.97,1]){
    const rising=tankCamera(CAMERA.start+f*(CAMERA.end-CAMERA.start));
    const falling=tankCamera(descendedTo(rising[0]));
    for(let k=0;k<4;k++)near(rising[k],falling[k],1e-12);
    for(const aspect of [.46,1.6]){
      for(const [x,depth,z] of [[.5,0,0],[.8,0,.43],[.2,0,1],[.1,.37,.73]]){
        const a=projectTank(x,depth,z,rising,aspect),b=projectTank(x,depth,z,falling,aspect);
        for(let k=0;k<3;k++)near(a[k],b[k],1e-12);
      }
    }
  }
  const opening=descendedTo(CAMERA.above[0]),dt=.000001;
  for(let z=0;z<=1;z+=.25){
    const y=P=>projectTank(.5,0,z,tankCamera(P),1)[1];
    const left=(y(opening)-y(opening-dt))/dt,right=(y(opening+dt)-y(opening))/dt;
    assert.ok(left<0 && right<0,'the water continues through its starting level');
    near(left,right,.025,'the surface velocity remains continuous at the starting level');
  }
  // (The near meniscus, its chop included: umNear adds at most (.002 + .005 w) of it.)
  const last=tankCamera(end);
  assert.ok(projectTank(.5,0,1,last,1)[1]+.002+.005*last[3]<0,'the near meniscus has left the bottom of the screen');
  assert.deepEqual([...D1],[...U.clear],'the tank drains over D1');
});

test('the board\'s plane takes the surface over the crowns and drains away behind the board', () => {
  const crown=Math.max(...Object.values(TALL)),slab=BOARD.slab;
  for(let P=D1[0];P<1.2;P+=.0005)assert.ok(drainLevel(P+.0005)<=drainLevel(P)+1e-12,'the water only falls');
  assert.ok(drainLevel(MORPH[0])>crown+.04,'every crown is under water when the plane takes over');
  const handover=tankCamera(MORPH[0]);
  assert.ok(handover[0]-.5*handover[1]+.007<0,'the whole screen is surface at the hand-over');
  assert.equal(drainSlope(MORPH[1]),0,'the surface is level through the hand-over');
  assert.ok(TILT[0]>MORPH[1]);
  near(drainSlope(TILT[1]),SLOPE,1e-12);
  for(const z of [-14,-4.42,0,4.42,12])assert.ok(waterHeight(z,1.196)<-slab-.15,'the whole page is dry at the end, z '+z);
  // Every piece has landed before its crown is uncovered; the back rank's before the front's.
  const crowns=emergence(),landed=Math.max(...birthSites(1.6).map(s=>s.land),...birthSites(.46).map(s=>s.land));
  assert.ok(crowns.every(c=>c.P>landed),'all landed '+landed+' before '+Math.min(...crowns.map(c=>c.P)));
  for(const c of crowns)near(waterHeight(c.z,c.P),c.top,1e-6,'the surface at the crown');
  const kings=crowns.filter((c,i)=>i===4||i===28);
  assert.ok(kings[0].z<kings[1].z && kings[0].P<kings[1].P,'the black king, at the back, is uncovered first');
  for(const [W,H,box] of [[1280,800,[630,180,550,460]],[390,844,[20,400,350,292]]]){
    let prev=0;
    for(let P=1.10;P<=1.2;P+=.0005){
      const e=dryEdge(P,box,H);
      assert.ok(e>=prev-1e-9,'the page dries from the top of the screen down');prev=e;
      if(e>2 && e<H-2){
        // The row is the waterline: the page point it sees is level with the surface over it.
        const cam=boxCamera(box),d=screenRay(cam,box,box[0]+box[2]/2,e),t=(-slab-cam.eye[1])/d[1];
        near(waterHeight(cam.eye[2]+d[2]*t,P),-slab,2e-3,'waterline at row '+e.toFixed(1));
      }
    }
    assert.equal(dryEdge(MORPH[1],box,H),0,'the page is still under water as the plane takes over');
    assert.equal(dryEdge(1.196,box,H),H,'all of the page is dry at the end');
    // The board's plane continues the tank's waves: the same place and size at the middle of the screen.
    const {k,o}=waveFit(box,W,H),cam=boxCamera(box),h=drainLevel(MORPH[0]);
    const at=y=>{const d=screenRay(cam,box,W/2,(1-y)*H),t=(h-cam.eye[1])/d[1];return (cam.eye[2]+d[2]*t)*k+o[1];};
    const tank=y=>{const c=tankCamera(MORPH[0]),kk=.66*(1-c[3]),f=(c[0]+.5*c[1]-y)/c[1];return f*(1+kk)/(1+kk*f);};
    near(at(.5),tank(.5),1e-9,'the plane meets the tank at the middle');
    const slopeBoard=(at(.55)-at(.45))/.1,slopeTank=(tank(.55)-tank(.45))/.1;
    assert.ok(Math.abs(slopeBoard/slopeTank-1)<.05,'waves the same size on screen '+slopeBoard/slopeTank);
  }
});

test('Chess adds scroll below the water and to its drain, and keeps the distance to the falling droplets', () => {
  assert.ok(U.clear[1]<1.2 && HELD.ink[0]>U.clear[0]);
  near(HOLD.by.ink.pin,7.5+INK_ADDED.free+INK_ADDED.figures+INK_ADDED.drain,1e-9,'the hold is the old clock and what is added');
  // Raw fractions at these landmarks on the previous 7.5-pin clock.
  const old=[[.416,.4475095854],[.53,.5404670178]];
  near(inkAdded(INK_FREE[1]),INK_ADDED.free,1e-12);
  assert.ok(INK_ADDED.free>3,'the plumes going under and the living ink gain more than three pins of their own');
  near(inkAdded(1.01)-inkAdded(INK_FREE[1]),INK_ADDED.figures,1e-12,'the rank-specific formations gain theirs');
  assert.ok(INK_FREE[1]>=MASS.end,'the living ink is all within the free window');
  for(const pin of [HOLD.pin,HOLD.pinTouch]){
    const hold=holdFor('ink',pin),before=7.5*pin+hold.leadIn,after=hold.pin*pin+hold.leadIn;
    assert.equal(hold.leadOut,0);
    const extra=old.map(([P,raw])=>inkRaw(P,pin)*after - raw*before);
    near(extra[0],0,1e-5,'opening waterline');
    near(extra[1],0,1e-5,'camera starts going under');
    const raw=P=>inkRaw(P,pin)*after;
    near(inkAdded(1.04),inkAdded(1.01),1e-12,'nothing is added between the figures and the drain');
    near(inkAdded(1.2)-inkAdded(1.04),INK_ADDED.drain,1e-12,'the drain gains its own pins');
    assert.ok(raw(D1[1])-raw(D1[0])>=raw(CAMERA.end)-raw(CAMERA.start),'the water falls over at least the scroll it rose over');
    const playback=easeFor('ink',pin);
    for(const P of [1.2,.93,.55,-.1,.2,.74,1.01,.69,1.15,1.1,1.07,1.19]){
      near(transitP(playback(inkRaw(P,pin))),P,1e-5,'reverse and direct seek');
    }
  }
});

test('the cure: the 32 pieces, knights first, each from its foot, all done before the world clears', () => {
  assert.equal(SLOTS.length, 32);
  for (const [i, s] of SLOTS.entries()) {
    assert.ok(s.order >= 0 && s.order <= 1, `slot ${i}`);
    assert.equal(s.tall, TALL[TYPES[s.type]]);
    assert.equal(cureAt(s.order, U.harden[0] - 0.01), 0);
    assert.ok(cureAt(s.order, U.harden[1]) > 1 - 1e-9, `slot ${i} cured`);
    let prev = 0;
    for (let P = U.harden[0]; P <= U.harden[1]; P += 0.005) { const c = cureAt(s.order, P); assert.ok(c >= prev); prev = c; }
  }
  const knights = SLOTS.filter(s => s.type === 3), pawns = SLOTS.filter(s => s.type === 5);
  assert.ok(Math.max(...knights.map(s => s.order)) < Math.min(...pawns.map(s => s.order)), 'knights before pawns');
  assert.ok(SLOTS.some(s => s.order === 0) && SLOTS.some(s => s.order === 1));
  // In the FEN's order, as the board (staunton.js startSlots) keeps its slots.
  assert.equal(SLOTS[0].type, TYPES.indexOf('R'));
  assert.equal(SLOTS[4].type, TYPES.indexOf('K'));
  assert.equal(SLOTS[31].type, TYPES.indexOf('R'));
});

test('the pieces: the starting position, knights first, black a beat before white', () => {
  const rows = START.split('/');
  let count = 0;
  for (let row = 0; row < 8; row++) for (let file = 0; file < 8; file++) {
    const p = pieceAt(file, row), ch = /\d/.test(rows[row]) ? null : rows[row][file];
    assert.equal(!!p, !!ch, `(${file}, ${row})`);
    if (!p) continue;
    count++;
    assert.equal(SHAPES[p.shape], ch.toUpperCase());
    assert.equal(p.white, ch === ch.toUpperCase());
    assert.ok(p.when >= 0 && p.when <= 1);
  }
  assert.equal(count, 32);
  assert.ok(pieceAt(1, 0).when < pieceAt(4, 0).when && pieceAt(4, 0).when < pieceAt(0, 0).when && pieceAt(0, 0).when < pieceAt(2, 0).when, 'knight, king, rook, bishop');
  assert.ok(pieceAt(2, 0).when < pieceAt(3, 1).when && pieceAt(3, 1).when < pieceAt(0, 1).when, 'then the pawns, from the middle out');
  assert.ok(pieceAt(1, 0).when < pieceAt(1, 7).when);
});

test('the silhouettes: exact distances, signed about the outline', () => {
  const n = 41, mask = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x - 20, y - 20) <= 8) mask[y * n + x] = 255;
  const d = distances(mask, n, n);
  assert.equal(d[20 * n + 20], 0);
  near(d[20 * n + 35], 7, 1e-9, 'straight out');
  near(d[0], Math.hypot(20, 20) - 8, 0.8, 'to the corner');
  const s = signedBytes(mask, n, n, 10);
  assert.ok(s[20 * n + 20] < 40 && s[0] === 255 && Math.abs(s[20 * n + 28] - 128) < 20, 'inside low, outside high, the outline in the middle');
  assert.ok(GLYPH.range < GLYPH.cell / 2);
});

test('the shaders mirror the plan', () => {
  const f = x => (Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(5)));
  for (const s of [`UM_HARDEN = vec2(${f(U.harden[0])}, ${f(U.harden[1])})`, `UM_SQUARES = vec2(${f(U.squares[0])}, ${f(U.squares[1])})`]) assert.ok(UNMIX_GLSL.includes(s), s);
  assert.ok(UNMIX_GLSL.includes(`UM_ORDER[32] = float[32](${SLOTS.map(s => f(s.order)).join(', ')})`));
  assert.ok(UNMIX_GLSL.includes('vec3 groundUnmix(') && UNMIX_GLSL.includes('vec4 umClickCover('));
  for (const src of [UNMIX_GLSL, PLUME_GLSL]) assert.ok(!src.includes('${'), 'every constant written in');
});
