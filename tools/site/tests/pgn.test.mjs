// node --test tools/site/tests/*.test.mjs    PGN and move-list handling against the synthetic fixture games.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readGame, annotate, describePly, endSummary, openingFamily, openingName, outcome, resultText, material,
  moveLabel, stripComments, header, START_FEN, placement,
 checkGame } from '../../../chess/page/lib/pgn.js';
import { Chess } from '../../../static/vendor/chess/chess.js';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'chess');
const catalog = JSON.parse(fs.readFileSync(path.join(FIX, 'catalog.json'), 'utf8'));
const files = new Map();
const raw = (file) => {
  if (!files.has(file)) files.set(file, JSON.parse(fs.readFileSync(path.join(FIX, file), 'utf8')).games);
  return files.get(file);
};
const gameOf = (entry) => raw(entry.file).find((g) => g.uuid === entry.uuid);

test('every valid fixture game reads to its catalogued final position and ply count', () => {
  const valid = catalog.games.filter((g) => g.valid && g.rules === 'chess');
  assert.ok(valid.length >= 5);
  for (const entry of valid) {
    const game = readGame(gameOf(entry).pgn);
    assert.equal(game.ok, true, `${entry.uuid}: ${game.error}`);
    assert.equal(game.moves.length, entry.plies, entry.uuid);
    assert.equal(game.fens.at(-1), entry.finalFen, entry.uuid);
    assert.equal(game.fens.length, game.moves.length + 1);
    assert.equal(game.boards.length, game.fens.length);
  }
});

test('castling, en passant, promotion and underpromotion are flagged on the right plies', () => {
  for (const entry of catalog.games.filter((g) => g.valid && g.specialMoves?.length)) {
    const game = readGame(gameOf(entry).pgn);
    for (const special of entry.specialMoves) {
      const move = game.moves[special.ply - 1];
      assert.ok(move, `${entry.uuid} ply ${special.ply}`);
      for (const flag of special.flags) assert.ok(move.flags.includes(flag), `${entry.uuid} ply ${special.ply} flags ${move.flags}`);
    }
  }
});

test('malformed PGNs are rejected with a message and never half-read', () => {
  const bad = catalog.games.filter((g) => !g.valid);
  assert.ok(bad.length >= 3);
  for (const entry of bad) {
    const game = readGame(gameOf(entry).pgn);
    assert.equal(game.ok, false, entry.uuid);
    assert.match(game.error, /\S/);
    assert.equal(game.moves, undefined);
  }
  assert.equal(readGame('').ok, false);
  assert.equal(readGame(null).ok, false);
  assert.equal(readGame('[Event "x"]\n\n*').ok, false);
});

test('the opening line is read from a SAN list', () => {
  const game = readGame(['e4', 'e5', 'Nf3', 'Nc6', 'd4']);
  assert.equal(game.ok, true);
  assert.equal(game.startFen, START_FEN);
  assert.equal(game.fens.at(-1), 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3');
  assert.equal(readGame(['e4', 'e4']).ok, false);
});

test('opening families come from the ECOUrl slug', () => {
  const urls = {
    'https://www.chess.com/openings/Scotch-Game-Classical-Variation': 'Scotch Game',
    'https://www.chess.com/openings/Reti-Opening-Anglo-Slav-Variation': 'Réti Opening',
    'https://www.chess.com/openings/Sicilian-Defense-OKelly-Variation-3.c3': 'Sicilian Defense: O’Kelly',
    'https://www.chess.com/openings/Sicilian-Defense-Richter-Rauzer-Variation': 'Sicilian Defense',
    'https://www.chess.com/openings/Closed-Sicilian-Defense': 'Closed Sicilian',
    'https://www.chess.com/openings/Some-Unknown-Opening-Line': 'Some Unknown',
    '': 'ECO unknown',
  };
  for (const [url, family] of Object.entries(urls)) assert.equal(openingFamily(url), family, url);
  const pgn = gameOf(catalog.games[0]).pgn;
  assert.equal(openingFamily(pgn), 'Scotch Game');
  assert.equal(header(pgn, 'ECO'), 'C45');
  assert.match(openingName(pgn), /^Scotch Game/);
  assert.equal(openingFamily('[Event "x"]\n[ECO "A04"]\n\n1. Nf3 *'), 'ECO A04');
});

test('result codes map to win, draw or loss and to plain text from the player’s side', () => {
  assert.equal(outcome('win'), 'win');
  for (const code of ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']) assert.equal(outcome(code), 'draw');
  for (const code of ['resigned', 'timeout', 'checkmated', 'abandoned']) assert.equal(outcome(code), 'loss');
  assert.equal(resultText('win', 'resigned'), 'Won by resignation');
  assert.equal(resultText('win', 'timeout'), 'Won on time');
  assert.equal(resultText('win', 'checkmated'), 'Won by checkmate');
  assert.equal(resultText('timeout', 'win'), 'Lost on time');
  assert.equal(resultText('resigned', 'win'), 'Lost by resignation');
  assert.equal(resultText('repetition', 'repetition'), 'Drawn by repetition');
});

test('material counts the start position as level at 39 points a side', () => {
  const chess = new Chess();
  assert.deepEqual(material(placement(chess)), { white: 39, black: 39, balance: 0 });
  chess.load('4k3/8/8/8/8/8/PPPP4/4K2Q w - - 0 1');
  assert.deepEqual(material(placement(chess)), { white: 13, black: 0, balance: 13 });
});

test('move labels number White and Black moves', () => {
  assert.equal(moveLabel(1, 'e4'), '1. e4');
  assert.equal(moveLabel(2, 'e5'), '1… e5');
  assert.equal(moveLabel(5, 'd4'), '3. d4');
});

test('factual notes cover castling, the first capture and checks, in ply order', () => {
  const game = readGame(gameOf(catalog.games[0]).pgn);
  const notes = annotate(game);
  assert.ok(notes.length >= 3);
  assert.deepEqual(notes.map((n) => n.ply), [...notes.map((n) => n.ply)].sort((a, b) => a - b));
  const text = notes.map((n) => n.text).join('\n');
  assert.match(text, /White castles kingside/);
  assert.match(text, /Black castles kingside/);
  assert.match(text, /the first capture/);
  assert.match(endSummary(game), /^(Material is level|White is ahead|Black is ahead)/);
  assert.deepEqual(annotate({ ok: false }), []);
});

test('promotion and en passant notes appear for the fixture games that have them', () => {
  const promo = catalog.games.find((g) => g.valid && g.features?.some((f) => /promotion to a queen/.test(f)));
  const ep = catalog.games.find((g) => g.valid && g.features?.some((f) => /en passant by White/.test(f)));
  assert.ok(promo && ep);
  assert.match(annotate(readGame(gameOf(promo).pgn)).map((n) => n.text).join('\n'), /promotes a pawn to a queen/);
  assert.match(annotate(readGame(gameOf(ep).pgn)).map((n) => n.text).join('\n'), /captures en passant/);
});

test('plies are described for assistive technology', () => {
  const game = readGame(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']);
  assert.equal(describePly(game, 0), 'Start position.');
  assert.equal(describePly(game, 5), 'Move 3, White plays d4: pawn from d2 to d4.');
  assert.equal(describePly(game, 6), 'Move 3, Black plays exd4: pawn from e5 to d4, captures a pawn.');
});

test('stripping clock comments keeps the game identical', () => {
  const pgn = gameOf(catalog.games[0]).pgn;
  const plain = stripComments(pgn);
  assert.ok(plain.length < pgn.length);
  assert.equal(readGame(plain).fens.at(-1), readGame(pgn).fens.at(-1));
});

test('checkGame agrees with readGame on legality and length, without replaying', () => {
  const games = [
    '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 1-0',
    '1. Nf3 d5 2. c4 *',
    '[FEN "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"]\n[SetUp "1"]\n\n2. Nf3 Nc6 3. Bb5 *',
    '[FEN "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"]\n[SetUp "1"]\n\n2... Nc6 3. Bb5 a6 *',
    '1. e4 e5 2. Ke3 *',
    '',
  ];
  for (const g of games) {
    const r = readGame(g), c = checkGame(g);
    assert.equal(c.ok, r.ok, g);
    assert.equal(c.plies, r.ok ? r.moves.length : 0, g);
    if (!c.ok) assert.ok(c.error);
  }
});
