// node --test tools/site/tests/*.test.mjs    Replay stepping, rotation and keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayModel, keyAction } from '../../../chess/page/lib/replay-model.js';
import { readGame } from '../../../chess/page/lib/pgn.js';

const line = () => readGame(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4']);

test('stepping is clamped to the start and the end', () => {
  const m = new ReplayModel(line());
  assert.equal(m.max, 7);
  assert.equal(m.index, 0);
  assert.equal(m.prev(), 0);
  assert.equal(m.atStart, true);
  assert.equal(m.next(), 1);
  assert.equal(m.last(), 7);
  assert.equal(m.atEnd, true);
  assert.equal(m.next(), 7);
  assert.equal(m.first(), 0);
  assert.equal(m.go(3), 3);
  assert.equal(m.go(99), 7);
  assert.equal(m.go(-5), 0);
  assert.equal(m.go('x'), 0);
});

test('the position and labels follow the ply', () => {
  const m = new ReplayModel(line());
  assert.equal(m.caption, 'Start position.');
  assert.equal(m.label, 'Start');
  assert.equal(m.toMove, 'White');
  m.go(5);
  assert.equal(m.label, '3. d4');
  assert.equal(m.toMove, 'Black');
  assert.equal(m.board.d4, 'wP');
  assert.equal(m.board.d2, undefined);
  assert.equal(m.move.from, 'd2');
  m.go(6);
  assert.equal(m.board.e5, undefined);
  assert.equal(m.board.d4, 'bP');
  m.go(7);
  assert.equal(m.board.d4, 'wN');
  assert.equal(m.fen, 'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4');
});

test('squares come in display order and flipping turns the board', () => {
  const m = new ReplayModel(line());
  let sq = m.squares();
  assert.equal(sq.length, 64);
  assert.equal(sq[0].sq, 'a8');
  assert.equal(sq[7].sq, 'h8');
  assert.equal(sq[63].sq, 'h1');
  assert.equal(sq[56].sq, 'a1');
  assert.equal(sq[56].light, false);       // a1 is a dark square
  assert.equal(sq[63].light, true);        // h1 is light
  assert.equal(sq[60].piece, 'wK');        // e1
  assert.equal(m.flip(), true);
  sq = m.squares();
  assert.equal(sq[0].sq, 'h1');
  assert.equal(sq[63].sq, 'a8');
  assert.equal(sq[0].light, true);
  assert.equal(m.flip(), false);
  assert.equal(new Set(m.squares().map((s) => s.sq)).size, 64);
});

test('a king in check is marked after the checking move', () => {
  const m = new ReplayModel(readGame(['e4', 'f5', 'Qh5+', 'g6']));
  m.go(3);
  assert.equal(m.checkSquare, 'e8');
  m.go(4);
  assert.equal(m.checkSquare, null);
  m.go(0);
  assert.equal(m.checkSquare, null);
});

test('keys map to actions; modified keys and other keys do nothing', () => {
  assert.equal(keyAction('ArrowLeft'), 'prev');
  assert.equal(keyAction('ArrowRight'), 'next');
  assert.equal(keyAction('Home'), 'first');
  assert.equal(keyAction('End'), 'last');
  assert.equal(keyAction('f'), 'flip');
  assert.equal(keyAction('F'), 'flip');
  assert.equal(keyAction('p'), 'play');
  assert.equal(keyAction('ArrowDown'), null);
  assert.equal(keyAction('ArrowRight', { metaKey: true }), null);
  assert.equal(keyAction('Tab'), null);
  const m = new ReplayModel(line());
  assert.equal(m.act('next'), 1);
  assert.equal(m.act('play'), null);
  assert.equal(m.act('flip'), true);
});

test('a model cannot be made from a game that failed to read', () => {
  assert.throws(() => new ReplayModel(readGame('')), /read successfully/);
});
