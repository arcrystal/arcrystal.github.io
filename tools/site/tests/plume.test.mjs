import test from 'node:test';
import assert from 'node:assert/strict';
import { START, SHAPES, GLYPH, pieceAt, distances, signedBytes } from '../../../static/site/scene/ink-plan.js';
import { UNMIX, SLOTS, cureAt } from '../../../static/site/scene/unmix-plan.js';
import { CAMERA, tankCamera, projectTank, DRAIN, CLEAR, tankLevel } from '../../../static/site/scene/ink-tank.js';
import { UNMIX_GLSL } from '../../../static/site/scene/glsl/unmix.js';
import { PLUME_GLSL } from '../../../static/site/scene/glsl/plume.js';
import { HELD, HOLD, INK_ADDED, INK_FREE, holdFor, inkRaw, inkAdded, easeFor, transitP } from '../../../static/site/lerp.js';
import { TALL, TYPES, BOARD } from '../../../static/site/scene/staunton.js';
import { FRONT, TIP, LIGHTS, lightsAt, farLine, waterPlane, dryEdge, emergence, boxCamera, screenRay, drainUniforms } from '../../../static/site/scene/ink-drain.js';
import { birthSites, LANDED } from '../../../static/site/scene/living-ink-plan.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const U = UNMIX;

// Screens of desktop scroll from the start of the hold (lerp.js inkRaw).
const screens = P => { const h = holdFor('ink', HOLD.pin); return inkRaw(P, HOLD.pin) * (h.pin * HOLD.pin + h.leadIn); };
const atScreens = (d, lo, hi) => { for (let i = 0; i < 52; i++) { const m = (lo + hi) / 2; if (screens(m) < d) lo = m; else hi = m; } return (lo + hi) / 2; };

test('the water falls as it rose, screen for screen, pauses on the opening pose, and slides off the bottom', () => {
  const rise = screens(CAMERA.end) - screens(CAMERA.start), d0 = screens(CLEAR[0]);
  near(screens(DRAIN.fall[1]) - d0, rise, 1e-6, 'the fall takes the rise\'s scroll');
  for (let f = 0; f <= 1.0001; f += .05) {
    const up = tankCamera(atScreens(screens(CAMERA.start) + f * rise, CAMERA.start, CAMERA.end));
    const down = tankCamera(atScreens(d0 + (1 - f) * rise, CLEAR[0], 1.2));
    near(up[0], down[0], .03, `the same pose at ${f.toFixed(2)} of the rise`);
    for (const [x, z] of [[.5, 0], [.2, 1], [.8, .43]]) near(projectTank(x, 0, z, up, 1.6)[1], projectTank(x, 0, z, down, 1.6)[1], .03);
  }
  let prev = 1;
  for (let P = CLEAR[0]; P <= CLEAR[1]; P += .0002) { const L = tankLevel(P); assert.ok(L <= prev + 1e-9, 'the water only falls'); prev = L; }
  // The pause: the opening pose (the near meniscus, chop and all, just under the bottom edge) held.
  assert.ok(screens(DRAIN.pause[1]) - screens(DRAIN.pause[0]) >= .3, 'a pause of at least a third of a screen');
  for (let P = DRAIN.pause[0] + 1e-4; P < DRAIN.pause[1]; P += .0005) near(tankLevel(P), 0, 1e-3, 'held at the opening level');
  const opening = tankCamera((DRAIN.pause[0] + DRAIN.pause[1]) / 2);
  near(opening[0] + .5 * opening[1], CAMERA.above[0] + .5 * CAMERA.above[1], 2e-3, 'the far line where it was at the start');
  // (As in the rise's opening pose, the camera is wholly out of the water: no bath, no lip, the near line at the edge.)
  assert.ok(opening[3] < 1e-4, 'the camera is out of the water');
  assert.ok(opening[0] - .5 * opening[1] <= 1e-9, 'the near meniscus at the bottom edge');
  assert.ok(farLine(DRAIN.sink[1]) + .0018 < 0, 'the far line, chop and all, has slid off the bottom');
  // The lights come on during the pause, the highlights a beat ahead.
  assert.ok(LIGHTS[0] > DRAIN.pause[0] && LIGHTS[1] < DRAIN.pause[1]);
  assert.equal(lightsAt(DRAIN.pause[0] - .001), 0);
  assert.equal(lightsAt(DRAIN.pause[1]), 1);
  assert.ok(lightsAt((LIGHTS[0] + LIGHTS[1]) / 2, true) > lightsAt((LIGHTS[0] + LIGHTS[1]) / 2));
  assert.ok(DRAIN.last[1] < CLEAR[1], 'the sheen is gone before the tile takes over');
});

test('the water leaves by height: crowns first, back to front, tallest first, the page on the far line', () => {
  const slab = BOARD.slab;
  assert.ok(Math.max(...TIP) < 1.26, 'never as steep as the camera\'s view of the page');
  for (const [W, H, box] of [[1280, 800, [630, 180, 550, 460]], [1440, 900, [440, 217, 560, 467]], [390, 844, [20, 400, 350, 292]]]) {
    const cam = boxCamera(box);
    for (let P = 1.07; P < DRAIN.sink[1]; P += .002) {
      const { h, s, row } = waterPlane(P, box, W, H);
      if (row < 2 || row > H - 2 || h > 50) continue;
      // The page's waterline is the far line's row, across the whole screen.
      for (const x of [.1 * W, W / 2, .9 * W]) {
        const d = screenRay(cam, box, x, row), z = cam.eye[2] + d[2] * (-slab - cam.eye[1]) / d[1];
        near(h + s * (z - FRONT), -slab, 2e-3, `waterline at row ${row.toFixed(1)}`);
      }
    }
    const crowns = emergence(box, W, H);
    // Within a rank, the tallest first; across a file, the back rank before the front.
    for (const a of crowns) for (const b of crowns) {
      if (Math.abs(a.z - b.z) < 1e-6 && a.top > b.top + 1e-6) assert.ok(a.P <= b.P + 1e-9, 'tallest first in a rank');
      if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.top - b.top) < 1e-6 && a.z < b.z - 1e-6) assert.ok(a.P <= b.P + 1e-9, 'back to front');
    }
    // A crown still under the band at the pause is not uncovered until the water sinks again.
    const [, pauseEnd] = DRAIN.pause;
    for (const c of crowns) if (c.P > DRAIN.pause[0]) assert.ok(c.P >= pauseEnd - 1e-6, 'no crown pops out during the pause');
    let prev = 0;
    for (let P = CLEAR[0]; P <= 1.2; P += .0005) {
      const e = dryEdge(P, box, H);
      assert.ok(e >= prev - 1e-9, 'the page dries from the top of the screen down'); prev = e;
    }
    assert.equal(dryEdge(1.196, box, H), H, 'all of the page is dry at the end');
    assert.deepEqual(drainUniforms(1.0, box, W, H), [99, 0, 0, 0], 'no plane before the water returns');
  }
  // Every piece is down while the water is still falling.
  for (const aspect of [.46, 1, 1.6]) for (const s of birthSites(aspect)) {
    assert.ok(s.land <= LANDED.by + 1e-12 && s.land - s.depart >= LANDED.flight - 1e-12);
  }
  assert.ok(LANDED.by < DRAIN.fall[1], 'landed before the fall ends');
});

test('Chess adds scroll below the water and to its drain, and keeps the distance to the falling droplets', () => {
  assert.ok(U.clear[1]<1.2 && HELD.ink[0]>U.clear[0]);
  near(HOLD.by.ink.pin,7.5+INK_ADDED.free+INK_ADDED.figures+INK_ADDED.drain,1e-9,'the hold is the old clock and what is added');
  // Raw fractions at these landmarks on the previous 7.5-pin clock.
  const old=[[.416,.4475095854],[.53,.5404670178]];
  near(inkAdded(INK_FREE[1]),INK_ADDED.free,1e-12);
  assert.ok(INK_ADDED.free>3,'the plumes going under and the mist\'s main event gain more than three pins of their own');
  near(inkAdded(1.01)-inkAdded(INK_FREE[1]),INK_ADDED.figures,1e-12,'the rank-specific formations gain theirs');
  for(const pin of [HOLD.pin,HOLD.pinTouch]){
    const hold=holdFor('ink',pin),before=7.5*pin+hold.leadIn,after=hold.pin*pin+hold.leadIn;
    assert.equal(hold.leadOut,0);
    const extra=old.map(([P,raw])=>inkRaw(P,pin)*after - raw*before);
    near(extra[0],0,1e-5,'opening waterline');
    near(extra[1],0,1e-5,'camera starts going under');
    const raw=P=>inkRaw(P,pin)*after;
    near(inkAdded(1.04),inkAdded(1.01),1e-12,'nothing is added between the figures and the drain');
    near(inkAdded(1.2)-inkAdded(1.04),INK_ADDED.drain,1e-12,'the drain gains its own pins');
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
