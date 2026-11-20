import test from 'node:test';
import assert from 'node:assert/strict';
import { START, SHAPES, GLYPH, pieceAt, distances, signedBytes } from '../../../static/site/scene/ink-plan.js';
import { UNMIX, SLOTS, cureAt } from '../../../static/site/scene/unmix-plan.js';
import { CAMERA, tankCamera, projectTank } from '../../../static/site/scene/ink-tank.js';
import { UNMIX_GLSL } from '../../../static/site/scene/glsl/unmix.js';
import { PLUME_GLSL } from '../../../static/site/scene/glsl/plume.js';
import { HELD, HOLD, holdFor, inkRaw, easeFor, transitP } from '../../../static/site/lerp.js';
import { TALL, TYPES } from '../../../static/site/scene/staunton.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const U = UNMIX;

test('the draining free surface retraces every rising pose and clears the bottom with its perspective intact', () => {
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
    assert.ok(y(end)<-.01,'the entire plane, including its wave crests, clears the viewport');
  }
});

test('Chess adds scroll below the water and keeps the distance to the falling droplets', () => {
  assert.ok(U.clear[1]<1.2 && HELD.ink[0]>U.clear[0]);
  // Raw fractions at these landmarks on the previous 7.5-pin clock.
  const old=[[.416,.4475095854],[.53,.5404670178],[.72,.6943028355],[.74,.7120818015],[1.01,.8952690600]];
  for(const pin of [HOLD.pin,HOLD.pinTouch]){
    const hold=holdFor('ink',pin),before=7.5*pin+hold.leadIn,after=hold.pin*pin+hold.leadIn;
    assert.equal(hold.leadOut,0);
    const extra=old.map(([P,raw])=>inkRaw(P,pin)*after - raw*before);
    near(extra[0],0,1e-5,'opening waterline');
    near(extra[1],0,1e-5,'camera starts going under');
    assert.ok(extra[2]>pin,'the free plumes gain at least one pin of their own');
    near(extra[2],extra[3],1e-5,'the completed plume interval stays on the clock');
    assert.ok(extra[4]>extra[3]+.5*pin,'the rank-specific formations gain additional time');
    near(extra[4],after-before,1e-5,'the drain keeps its previous scroll distance');
    const playback=easeFor('ink',pin);
    for(const P of [1.2,.93,.55,-.1,.2,.74,1.01,.69,1.15]){
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
