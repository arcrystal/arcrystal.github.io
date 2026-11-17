// Photography → Chess: ink finding order. The clock and the hold, the falling drops, the whorls, the
// sight through a figure of revolution, the board's lattice, the pieces' order, the silhouettes'
// distances, and what the shaders mirror.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INK, RING, START, SHAPES, GLYPH, pieceAt, flowTime, lamb, extent, ringAt, ringTurn, rimTurn, ringFrame, whorlTurn, coreAt,
  stage, dropTime, whorlFrame, bodyVel, carryBack, sightThrough, greenPsi, okuboWeiss, darkSquare, zoomAt, distances, signedBytes, waterLevel,
} from '../../../static/site/scene/ink-plan.js';
import { PLUME_MAP, PLUME_INK, PLUME_GLSL } from '../../../static/site/scene/glsl/plume.js';
import { HOLD, HELD, holdFor, holdAt, inkEase, inkRaw, easeFor, transitP } from '../../../static/site/lerp.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);

test('the clock: water, drops, whorls, lattice, squares, pieces, the tile, in that order', () => {
  const I = INK;
  assert.ok(I.water[0] < I.light[1] && I.water[1] <= I.enter[0] + 1e-9, 'under the surface before the ink falls');
  assert.ok(I.enter[1] <= I.fold[0] + 1e-9 && I.fold[1] >= I.lattice[0], 'the drops, then the whorls, then the lattice');
  assert.ok(I.lattice[0] < I.card[0] && I.card[0] < I.squares[0] && I.squares[0] < I.tighten[0], 'threads, the card, squares, their edges');
  assert.ok(I.squares[1] <= I.pieces[0] + 0.05 && I.pieces[1] + I.span <= I.finish[1], 'every piece has formed before the picture is whole');
  assert.ok(I.zoom[0] < I.zoom[1] && I.zoom[1] <= I.pieces[0] + 0.03 && I.zoom[3] <= I.finish[1], 'the view closes for the pieces and is back before the handoff');
  assert.ok(I.finish[1] <= I.loose[1] + 1e-9 && I.still[1] < 1.2 && I.rise[1] < 1.2, 'still water and the paper before the hold ends');
  // The tile surfaces over its own picture and is whole as the hold ends.
  const [s0, ds] = HELD.ink;
  assert.ok(s0 >= I.finish[1] - 1e-9 && s0 + ds <= 1.2 + 1e-9);
  assert.equal(easeFor('ink'), inkEase);
  assert.equal(holdFor('ink').leadOut, 0, 'the band is held to the very end');
  for (const P of [-0.1, 0.2, 0.7, 1.15]) near(transitP(inkEase(inkRaw(P))), P, 2e-3);
  assert.equal(zoomAt(I.zoom[0]), 1);
  assert.equal(zoomAt(1.2), 1);
  assert.ok(zoomAt(0.95) > 1.4 && zoomAt(0.95, true) < zoomAt(0.95), 'closer on a desk than on a phone');
});

test('the tray\'s surface stays below the strip\'s top edge while the strip comes in', () => {
  for (const pin of [HOLD.pin, HOLD.pinTouch]) for (const vh of [900, 812]) {
    const L = holdFor('ink', pin), H = vh * (1 + pin * L.pin), T = 5000;
    for (let sy = T - L.leadIn * vh; sy <= T; sy += 4) {
      const { y, p } = holdAt(sy, T, H, vh, L.leadIn, L.leadOut);
      // (Its ripples are a few px high, and the darkroom is drawn to 6 px under it.)
      assert.ok(waterLevel(transitP(inkEase(p))) * vh > y + 24, `pin ${pin} at ${sy}`);
    }
  }
  assert.ok(waterLevel(INK.water[0]) > 1 && waterLevel(INK.water[1]) < 0, 'from under the foot to over the top');
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
  assert.ok(darkSquare(0, 7) && !darkSquare(0, 0) && !darkSquare(7, 7), 'a1 dark, a8 and h1 light');
});

test('a drop: it sinks and slows, its ring widens, its canopy trails, the fluid goes down its axis', () => {
  let prev = ringAt(0), speed = Infinity;
  assert.equal(prev.z, 0);
  for (let u = 0.2; u <= 6; u += 0.2) {
    const a = ringAt(u), v = a.z - prev.z;
    assert.ok(v > 0 && v < speed, 'sinking, ever more slowly');
    assert.ok(a.R >= prev.R && a.zc <= a.z && a.Rc >= a.R, 'wider; its canopy behind it and outside it');
    speed = v; prev = a;
  }
  assert.ok(prev.z < RING.depth && prev.z > 0.98 * RING.depth);
  assert.ok(ringTurn(6) < RING.turn[0] && ringTurn(1) > 0.5 * RING.turn[0] && rimTurn(0.2) === 0);
  // Stepped backward through its frame, a point on the axis below the ring came from higher up.
  const K = INK.steps[0], cells = new Float32Array(K * 16), bodies = new Float32Array(K * 4);
  ringFrame(1.5, K, cells, bodies);
  const a = ringAt(1.5), from = carryBack([0, a.z + 0.05], K, cells, bodies);
  // (Its two cores are stepped one after the other, so the axis is kept only nearly.)
  near(from[0], 0, 0.02, 'the axis stays the axis');
  assert.ok(from[1] < a.z - 0.3, 'it was carried down');
  // Its tile holds it.
  assert.ok(a.Rc < RING.span[0] && RING.depth + RING.body < RING.span[2] + 0.1);
});

test('the flow: a body\'s field has no sources, a core\'s step is a rotation', () => {
  const h = 1e-5;
  for (const [x, y] of [[0.1, 0.2], [-0.4, 0.05], [0.31, -0.6]]) {
    const div = (bodyVel(x + h, y, 0.3, -0.2, 0.09)[0] - bodyVel(x - h, y, 0.3, -0.2, 0.09)[0] + bodyVel(x, y + h, 0.3, -0.2, 0.09)[1] - bodyVel(x, y - h, 0.3, -0.2, 0.09)[1]) / (2 * h);
    near(div, 0, 1e-6, 'divergence');
  }
  near(bodyVel(0, 0, 0.3, -0.2, 0.09)[0], 0.3, 1e-12, 'its own fluid moves with it');
  assert.ok(Math.hypot(...bodyVel(3, 0, 0.3, -0.2, 0.09)) < 0.01, 'far away, almost nothing');
  // One core, no body: distance from its centre is kept.
  const cells = [0.2, -0.1, 1.3, 0.01, 9, 9, 0, 1, 9, 9, 0, 1, 9, 9, 0, 1];
  const p = carryBack([0.5, 0.3], 1, cells);
  near(Math.hypot(p[0] - 0.2, p[1] + 0.1), Math.hypot(0.3, 0.4), 1e-12);
  near(lamb(1e-9, 1), 1, 1e-5, 'its centre turns as a body');
  near(lamb(100, 1), 0.01, 1e-6, 'far from it, as 1/r²');
});

test('the whorls: two folds with a rest, four stations round the board, alternating', () => {
  assert.equal(whorlTurn(1), 0);
  let prev = 0;
  for (let t = 1; t <= INK.tauMax + 0.01; t += 0.05) { const w = whorlTurn(t); assert.ok(w >= prev - 1e-12); prev = w; }
  assert.ok(whorlTurn(2.45) - whorlTurn(2.0) < 0.2 * (whorlTurn(2.0) - whorlTurn(1.3)), 'a rest between the folds');
  assert.ok(coreAt(INK.tauMax) > coreAt(1), 'their cores spread');
  assert.equal(flowTime(INK.enter[0]), 0);
  near(flowTime(INK.enter[1]), 1, 1e-9);
  near(flowTime(INK.fold[1]), INK.tauMax, 1e-9);
  for (const [W, H, bx, by] of [[1440, 900, 800, 450], [375, 812, 187, 555], [834, 457, 252, 220]]) {
    const St = stage(W, H, bx, by);
    assert.deepEqual(St.stations.map(s => s[2]), [1, -1, -1, 1]);
    for (const s of St.stations) assert.ok(Math.abs(s[0]) < St.hx, `a station on screen at ${W}`);
    assert.equal(St.drops.length, 4);
    const [black, white, b2, w2] = St.drops;
    assert.ok(black.x < white.x && !black.white && white.white && white.born > black.born, 'the black first, to the left of the white');
    assert.ok(b2.born > black.born && b2.sigma < black.sigma && b2.y > black.y && w2.white, 'a smaller one falls from each ring');
    assert.equal(dropTime(white, white.born), 0);
    const K = INK.steps[1], cells = new Float32Array(K * 16);
    whorlFrame(St, 2, K, cells);
    near(cells.filter((_, i) => i % 4 === 2).reduce((a, b) => a + Math.abs(b), 0), 4 * whorlTurn(2), 1e-4, 'the substeps add up to the turn');
  }
  assert.deepEqual(extent(1440, 900).slice(0, 2), [0.8, 0.5]);
});

test('seen through: a figure of revolution loses light as its chord, and a thin shell is dark at its edge', () => {
  for (const x of [0, 0.2, 0.45]) near(sightThrough(r => (r < 0.5 ? 1 : 0), x, 1, 400), 2 * Math.sqrt(0.25 - x * x), 0.02, `a ball at ${x}`);
  const shell = r => Math.exp(-(((r - 0.4) / 0.01) ** 2));
  assert.ok(sightThrough(shell, 0.39, 1, 800) > 3 * sightThrough(shell, 0, 1, 800), 'edge on against face on');
  assert.equal(sightThrough(shell, 1.2, 1), 0);
});

test('the board: the lattice\'s lines are the squares\' edges, and ink gathers along them', () => {
  for (let k = 0; k <= 8; k++) for (const y of [0.3, 2.7]) { near(greenPsi(k, y), 0, 1e-12); near(greenPsi(y, k), 0, 1e-12); }
  assert.ok(Math.sign(greenPsi(0.5, 0.5)) === -Math.sign(greenPsi(1.5, 0.5)), 'neighbouring cells turn against each other');
  assert.ok(okuboWeiss(3, 5) > 0.99 && okuboWeiss(3.5, 5.5) < -0.99, 'strain at the crossings, rotation at the middles');
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
  const f = x => Number(x).toFixed(4);
  for (const s of [`PM_ENTER = vec2(${f(INK.enter[0])}, ${f(INK.enter[1])})`, `PM_FINISH = vec2(${f(INK.finish[0])}, ${f(INK.finish[1])})`, `PM_SPAN = ${f(INK.span)}`, `PM_NSHAPE = ${f(SHAPES.length)}`]) assert.ok(PLUME_GLSL.includes(s), s);
  assert.ok(PLUME_GLSL.includes('vec3 groundPlume('));
  assert.ok(PLUME_MAP.includes(`uCells[${INK.steps[0] * 4}]`) && PLUME_MAP.includes(`uBodies[${INK.steps[0]}]`));
  assert.ok(PLUME_INK.includes(`RG_SPAN = vec3(${f(RING.span[0])}, ${f(RING.span[1])}, ${f(RING.span[2])})`));
  assert.ok(INK.steps[0] * 5 <= 224, 'within the uniforms every WebGL 2 device has');
});
