// Chess in three dimensions (scene/staunton.js, scene/glsl/board3d.js): the pieces turned from the site's
// own silhouettes, the camera that frames the board, and the Scotch as a function of time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PATHS, parsePath, halfWidth, area, bodyOf, headOf, profileField, headField, PROF, HEAD, toR, toY, fromY, TALL,
  startSlots, scotchAt, scotchBuilt, scotchPeriod, SCOTCH, PLIES, frameCamera, framePoints, project, BOARD,
} from '../../../static/site/scene/staunton.js';
import { BOARD3D_FS } from '../../../static/site/scene/glsl/board3d.js';

test('board3d: a turned piece holds its silhouette (each row its width, the profile its area)', () => {
  for (const t of 'KQBP') {
    const polys = bodyOf(t);
    let lathe = 0;
    for (let y = 0; y < 45; y += 0.01) lathe += 2 * halfWidth(polys, y) * 0.01;
    assert.ok(Math.abs(lathe - area(polys)) / area(polys) < 0.01, `${t}: ${lathe} vs ${area(polys)}`);
  }
  // (The rook's notches are in its silhouette but not its profile: the shader cuts them as crenels.)
  assert.ok(halfWidth(bodyOf('R'), 18) > 8);
  // Every path reads, and the knight has its base and its head.
  for (const t of 'KQBNRP') assert.ok(parsePath(PATHS[t]).length >= 1);
  assert.equal(parsePath(PATHS.N).length, 2);
  assert.ok(area(headOf()) > 200);
});

test('board3d: a profile\'s field is a signed distance (negative inside, its zero at the silhouette)', () => {
  const f = profileField(bodyOf('P')), at = (r, y) => f[Math.round((y - PROF.y0) / PROF.cell - 0.5) * PROF.w + Math.round(r / PROF.cell - 0.5)];
  const top = toY(19);
  assert.ok(at(0, top - 0.02) < 0 && at(0, top + 0.02) > 0, 'the pawn\'s head ends at its top');
  // A distance: within a cell or so of its true value along the axis above the top.
  for (const h of [0.05, 0.1, 0.2]) assert.ok(Math.abs(at(0, top + h) - h) < 2 * PROF.cell, `h=${h}: ${at(0, top + h)}`);
  // Slope at most one (no step can overshoot by more than the field's rounding).
  let worst = 0;
  for (let j = 1; j < PROF.h; j += 3) for (let i = 1; i < PROF.w; i += 3) {
    const k = j * PROF.w + i;
    worst = Math.max(worst, Math.abs(f[k] - f[k - 1]) / PROF.cell, Math.abs(f[k] - f[k - PROF.w]) / PROF.cell);
  }
  assert.ok(worst < 1.05, `steepest ${worst}`);
  const h = headField();
  assert.equal(h.length, HEAD.w * HEAD.h);
  assert.ok(h.reduce((a, v) => Math.min(a, v), 0) < -0.05 && h.reduce((a, v) => Math.max(a, v), 0) > 0.1);
});

test('board3d: the world agrees with the sprite (round trip, and how tall the pieces stand)', () => {
  for (const y of [10, 25, 43.5]) assert.ok(Math.abs(fromY(toY(y)) - y) < 1e-9);
  assert.equal(toR(22.5), 0);
  assert.ok(TALL.K > TALL.Q && TALL.Q > TALL.B && TALL.B > TALL.P && TALL.R > TALL.P);
  assert.ok(TALL.K < BOARD.top + 1e-9);
  // No piece reaches out of its square (the shader marches a square's own piece only).
  for (const t of 'KQBRP') { let r = 0; for (let y = 0; y < 45; y += 0.05) r = Math.max(r, toR(22.5 + halfWidth(bodyOf(t), y))); assert.ok(r < 0.46, `${t} ${r}`); }
  for (const p of headOf()) for (const [x] of p) assert.ok(Math.abs(toR(x)) < 0.46);
});

test('board3d: the camera holds the board in its box, at any proportion', () => {
  for (const aspect of [0.75, 1, 1.2, 1.6]) {
    const cam = frameCamera(aspect);
    const q = framePoints().map(p => project(cam, p));
    for (const [u, v, z] of q) {
      assert.ok(z > 0, 'in front of the camera');
      assert.ok(Math.abs(u) <= 1.0001 && Math.abs(v) <= 1.0001, `aspect ${aspect}: ${u}, ${v}`);
    }
    // and fills it: at the margin on one side or the other.
    const span = Math.max(Math.max(...q.map(p => Math.abs(p[0]))), Math.max(...q.map(p => Math.abs(p[1]))));
    assert.ok(span > 0.9, `aspect ${aspect}: ${span}`);
  }
});

test('board3d: the Scotch, as a function of time', () => {
  const start = startSlots();
  assert.equal(start.length, 32);
  assert.equal(start.filter(s => s.black).length, 16);
  // At the start, everything stands on its square.
  assert.deepEqual(scotchAt(0).slots.map(s => [s.x, s.z]), start.map(s => [s.x, s.z]));
  // Built: e4, d4 gone (taken on d4 by the e-pawn, which the knight took), the knights on c6 and d4.
  const built = scotchBuilt(), on = sq => built.slots.find(s => s.melt < 2 && s.file === 'abcdefgh'.indexOf(sq[0]) && s.rank === +sq[1]);
  assert.equal(on('e4')?.type, 5); assert.equal(on('d4')?.type, 3); assert.equal(on('c6')?.type, 3);
  assert.equal(built.slots.filter(s => s.melt >= 2).length, 2);
  assert.equal(built.moving, false);
  // A knight leaps; a pawn barely lifts; pieces move only within their ply.
  const nf3 = scotchAt(SCOTCH.lead + 2 * SCOTCH.ply + SCOTCH.move / 2), knight = nf3.slots.find(s => s.type === 3 && !s.black && s.file === 6);
  assert.ok(knight.lift > 0.5 && nf3.moving);
  // Through the rewind no more than six pieces are ever off their squares (the shader's budget), and the
  // loop ends where it began.
  for (let t = scotchPeriod() - SCOTCH.back; t < scotchPeriod(); t += 40) {
    const off = scotchAt(t).slots.filter(s => s.lift > 0 || Math.abs(s.x + 3.5 - Math.round(s.x + 3.5)) > 1e-6 || Math.abs(s.z + 3.5 - Math.round(s.z + 3.5)) > 1e-6).length;
    assert.ok(off <= 6, `t=${t}: ${off}`);
  }
  assert.deepEqual(scotchAt(scotchPeriod() - 1).slots.map(s => [s.x, s.z, s.melt]).map(a => a.map(v => +v.toFixed(3))), start.map(s => [s.x, s.z, 0]));
  assert.equal(PLIES.length, 7);
});

test('board3d: the shader is given the shapes it is told about', () => {
  assert.ok(BOARD3D_FS.includes(`PC = ${PROF.cell}`));
  assert.ok(/const float TALLS\[6\] = float\[6\]\(/.test(BOARD3D_FS));
  assert.ok(!BOARD3D_FS.includes('${'), 'every constant written in');
});
