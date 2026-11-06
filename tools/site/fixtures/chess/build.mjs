#!/usr/bin/env node
// Writes the synthetic Chess.com fixtures in this directory, or checks them (--check).
//
//   node tools/site/fixtures/chess/build.mjs           regenerate profile, stats, archives, games, catalog
//   node tools/site/fixtures/chess/build.mjs --check   files match this script and every PGN is legal
//
// Nothing here is real data: the player 'example-player', the opponents, ratings, dates, links and
// ids are invented, and the games were composed for tests. Every valid PGN is replayed with the
// vendored chess.js (static/vendor/chess/chess.js); the malformed month is checked to fail.
// scenarios.json (hand-written) says which file answers which request; see ../README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../../../../static/vendor/chess/chess.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const PLAYER = 'example-player';
const API = 'https://api.chess.com/pub/player/';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const people = {
  [PLAYER]: '00000000-0000-4000-8000-0000000000a0',
  'opponent-alder': '00000000-0000-4000-8000-0000000000a1',
  'opponent-birch': '00000000-0000-4000-8000-0000000000a2',
  'opponent-cedar': '00000000-0000-4000-8000-0000000000a3',
  'opponent-dogwood': '00000000-0000-4000-8000-0000000000a4',
  'opponent-elm': '00000000-0000-4000-8000-0000000000a5',
  'opponent-fir': '00000000-0000-4000-8000-0000000000a6',
  'opponent-ginkgo': '00000000-0000-4000-8000-0000000000a7',
  'opponent-hazel': '00000000-0000-4000-8000-0000000000a8',
};

// Composed games. features: what a replay test can look for in each.
const GAMES = [
  {
    id: 1, month: '2026/09', start: '2026-09-14T18:02:11Z', timeClass: 'rapid', timeControl: '600',
    white: [PLAYER, 1512], black: ['opponent-alder', 1488], result: '1-0', results: ['win', 'resigned'],
    termination: `${PLAYER} won by resignation`, eco: 'C45', ecoUrl: 'https://www.chess.com/openings/Scotch-Game-Classical-Variation',
    moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4 O-O O-O Bb6 Nc2 d6 Bxb6 axb6 f4 Be6 Bxe6 Qxe6 Nd2 Qc4 Ne3 Qd3 Qf3 f5 exf5 Nxf5 Nxf5 Rxf5 Rad1 Qa6 Qd5+ Kh8 Qxf5',
    accuracies: { white: 84.6, black: 71.3 },
    features: ['kingside castling by both sides', 'check', 'opening: Scotch Game'],
  },
  {
    id: 2, month: '2026/09', start: '2026-09-21T20:40:05Z', timeClass: 'blitz', timeControl: '180+2',
    white: ['opponent-birch', 1430], black: [PLAYER, 1405], result: '0-1', results: ['timeout', 'win'],
    termination: `${PLAYER} won on time`, eco: 'B67', ecoUrl: 'https://www.chess.com/openings/Sicilian-Defense-Richter-Rauzer-Variation',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5 e6 Qd2 a6 O-O-O Bd7 f4 Be7 Nf3 b5 Bxf6 gxf6 Kb1 Qb6 f5 O-O-O fxe6 fxe6 Qe2 Kb8',
    features: ['queenside castling by both sides', 'loss on time', 'opening: Sicilian Defense'],
  },
  {
    id: 7, month: '2026/09', start: '2026-09-27T09:15:42Z', timeClass: 'rapid', timeControl: '600', rules: 'chess960',
    fen: 'nrbqkbrn/pppppppp/8/8/8/8/PPPPPPPP/NRBQKBRN w - - 0 1',
    white: [PLAYER, 1380], black: ['opponent-cedar', 1395], result: '1/2-1/2', results: ['agreed', 'agreed'],
    termination: 'Game drawn by agreement',
    moves: 'e4 e5 Nb3 Nb6 d3 d6 Be3 Be6',
    features: ['rules chess960 (not standard chess: pages that count standard games skip it)', 'custom start position (SetUp/FEN headers)'],
  },
  {
    id: 3, month: '2026/08', start: '2026-08-09T15:30:00Z', timeClass: 'rapid', timeControl: '900+10',
    white: ['opponent-dogwood', 1530], black: [PLAYER, 1497], result: '1/2-1/2', results: ['repetition', 'repetition'],
    termination: 'Game drawn by repetition', eco: 'C02', ecoUrl: 'https://www.chess.com/openings/French-Defense-Advance-Variation',
    moves: 'e4 e6 d4 d5 e5 f5 exf6 Nxf6 Nf3 Be7 Bd3 O-O O-O c5 c3 Nc6 Re1 Qc7 Bg5 Bd7 Nbd2 Rae8 Qe2 Kh8 Qd1 Kg8 Qe2 Kh8 Qd1 Kg8 Qe2 Kh8',
    features: ['en passant by White (exf6, move 4)', 'kingside castling by both sides', 'threefold repetition', 'opening: French Defense'],
  },
  {
    id: 4, month: '2026/08', start: '2026-08-23T11:05:37Z', timeClass: 'rapid', timeControl: '600',
    white: ['opponent-elm', 1466], black: [PLAYER, 1503], result: '0-1', results: ['resigned', 'win'],
    termination: `${PLAYER} won by resignation`, eco: 'A09', ecoUrl: 'https://www.chess.com/openings/Reti-Opening-Advance-Variation',
    moves: 'Nf3 d5 g3 d4 c4 dxc3 Nxc3 Nf6 Bg2 e5 O-O e4 Ng5 Bf5 d3 exd3 exd3 h6 Nge4 Nxe4 Nxe4 Be7 Re1 O-O Qb3 Nc6 Bf4 Qd7',
    accuracies: { white: 66.1, black: 79.8 },
    features: ['en passant by Black (dxc3, move 3)', 'kingside castling by both sides', 'opening: Réti Opening'],
  },
  {
    id: 5, month: '2026/07', start: '2026-07-04T17:45:20Z', timeClass: 'bullet', timeControl: '60',
    white: [PLAYER, 1301], black: ['opponent-fir', 1322], result: '1-0', results: ['win', 'resigned'],
    termination: `${PLAYER} won by resignation`, eco: 'B01', ecoUrl: 'https://www.chess.com/openings/Scandinavian-Defense',
    moves: 'e4 d5 exd5 c6 dxc6 Nf6 cxb7 Nbd7 bxa8=Q Qc7 Qxa7 e5 Nf3 Bc5 Qa4 O-O Be2 e4',
    features: ['promotion to a queen with capture (bxa8=Q, move 5)', 'kingside castling by Black', 'opening: Scandinavian Defense'],
  },
  {
    id: 6, month: '2026/07', start: '2026-07-10T08:00:00Z', timeClass: 'daily', timeControl: '1/259200', daily: true,
    white: ['opponent-ginkgo', 1240], black: [PLAYER, 1255], result: '0-1', results: ['resigned', 'win'],
    termination: `${PLAYER} won by resignation`, eco: 'D08', ecoUrl: 'https://www.chess.com/openings/Queens-Gambit-Declined-Albin-Countergambit-Lasker-Trap',
    moves: 'd4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3 Bxb4 exf2+ Ke2 fxg1=N+ Ke1 Qh4+ Kd2 Nc6 Bc3 Bg4 Qe1 O-O-O+',
    features: ['underpromotion to a knight with capture and check (fxg1=N+, move 7)', 'queenside castling with check by Black (O-O-O+)', 'daily game', 'opening: Queen\'s Gambit Declined (Albin Countergambit)'],
  },
];

// The malformed month: one valid game and three PGNs no parser should accept.
const MALFORMED = [
  {
    id: 101, month: '2026/06', start: '2026-06-12T19:00:00Z', timeClass: 'rapid', timeControl: '600',
    white: [PLAYER, 1490], black: ['opponent-hazel', 1475], result: '1/2-1/2', results: ['agreed', 'agreed'],
    termination: 'Game drawn by agreement', eco: 'C50', ecoUrl: 'https://www.chess.com/openings/Italian-Game',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    features: ['valid game inside the malformed month'],
  },
  {
    id: 102, month: '2026/06', start: '2026-06-13T19:00:00Z', timeClass: 'rapid', timeControl: '600',
    white: [PLAYER, 1491], black: ['opponent-alder', 1480], result: '1-0', results: ['win', 'resigned'],
    termination: `${PLAYER} won by resignation`, eco: 'C20', ecoUrl: 'https://www.chess.com/openings/Kings-Pawn-Opening',
    broken: 'illegal', pgnMoves: '1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Ke3 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:49]} 1-0',
    features: ['malformed: illegal move 2. Ke3'],
  },
  {
    id: 103, month: '2026/06', start: '2026-06-14T19:00:00Z', timeClass: 'blitz', timeControl: '300',
    white: ['opponent-birch', 1420], black: [PLAYER, 1410], result: '0-1', results: ['resigned', 'win'],
    termination: `${PLAYER} won by resignation`, eco: 'B20', ecoUrl: 'https://www.chess.com/openings/Sicilian-Defense',
    broken: 'truncated',
    features: ['malformed: unterminated tag pair and movetext cut off mid-move'],
  },
  {
    id: 104, month: '2026/06', start: '2026-06-15T19:00:00Z', timeClass: 'rapid', timeControl: '600',
    white: [PLAYER, 1492], black: ['opponent-cedar', 1470], result: '1-0', results: ['win', 'checkmated'],
    termination: `${PLAYER} won by checkmate`, eco: 'C60', ecoUrl: 'https://www.chess.com/openings/Ruy-Lopez-Opening',
    broken: 'garbage', pgnMoves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Zz9 Nf6 1-0',
    features: ['malformed: unknown move token 4. Zz9'],
  },
];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
const hms = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const clock = (s) => `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s % 60))}${s % 1 ? '.' + Math.round((s % 1) * 10) : ''}`;

// Deterministic think time for ply i: 0.5 to 2.5 % of the base time, in tenths of a second.
const think = (i, id, base) => Math.round((base * (5 + ((i * 7 + id * 3) % 21))) / 100) / 10;

function play(g) {
  const chess = new Chess(g.fen || START);
  for (const san of g.moves.split(' ')) chess.move(san); // throws on an illegal move
  return chess;
}

function build(g) {
  const startDate = new Date(g.start);
  const [base, inc] = g.timeControl.includes('/') ? [null, 0] : g.timeControl.split('+').map(Number).concat(0);
  let movetext = '', seconds = 0, finalFen = null, verbose = [];
  if (!g.broken) {
    const chess = play(g);
    verbose = chess.history({ verbose: true });
    finalFen = chess.fen();
    const left = [base, base];
    verbose.forEach((m, i) => {
      const side = i % 2;
      const used = g.daily ? 3600 * (2 + (i % 7)) : think(i, g.id, base);
      seconds += used;
      const num = Math.floor(i / 2) + 1;
      // Chess.com repeats the move number for Black only after a clock comment.
      movetext += side === 0 ? `${num}. ${m.san} ` : base ? `${num}... ${m.san} ` : `${m.san} `;
      if (base) {
        left[side] = Math.max(0.1, left[side] - used + inc);
        movetext += `{[%clk ${clock(Math.round(left[side] * 10) / 10)}]} `;
      }
    });
    movetext += g.result;
  } else {
    seconds = 95;
    movetext = g.pgnMoves || '';
  }
  const endDate = new Date(startDate.getTime() + Math.round(seconds) * 1000);
  const link = `https://www.chess.com/game/${g.daily ? 'daily' : 'live'}/${900000000000 + g.id}`;
  const tags = [
    ['Event', g.daily ? 'Let\'s Play!' : g.rules === 'chess960' ? 'Live Chess - Chess960' : 'Live Chess'],
    ['Site', 'Chess.com'],
    ['Date', ymd(startDate)],
    ['Round', '-'],
    ['White', g.white[0]],
    ['Black', g.black[0]],
    ['Result', g.result],
    ...(g.fen ? [['SetUp', '1'], ['FEN', g.fen], ['Variant', 'Chess960']] : []),
    ...(finalFen ? [['CurrentPosition', finalFen]] : []),
    ['Timezone', 'UTC'],
    ...(g.eco ? [['ECO', g.eco], ['ECOUrl', g.ecoUrl]] : []),
    ['UTCDate', ymd(startDate)],
    ['UTCTime', hms(startDate)],
    ['WhiteElo', String(g.white[1])],
    ['BlackElo', String(g.black[1])],
    ['TimeControl', g.timeControl],
    ['Termination', g.termination],
    ['StartTime', hms(startDate)],
    ['EndDate', ymd(endDate)],
    ['EndTime', hms(endDate)],
    ['Link', link],
  ];
  let pgn = tags.map(([k, v]) => `[${k} "${v}"]`).join('\n') + '\n\n' + movetext + '\n';
  if (g.broken === 'truncated') {
    // A tag pair that never closes, then movetext that stops inside a move.
    pgn = tags.slice(0, 6).map(([k, v]) => `[${k} "${v}"]`).join('\n').replace('[Site "Chess.com"]', '[Site "Chess.com"') + '\n\n1. e4 {[%clk 0:04:59]} 1... c5 {[%clk 0:04:58]} 2. Nf';
  }
  const player = (name, rating, result) => ({ rating, result, '@id': API + name, username: name, uuid: people[name] });
  const game = {
    url: link,
    pgn,
    time_control: g.timeControl,
    end_time: Math.floor(endDate.getTime() / 1000),
    rated: true,
    ...(g.accuracies ? { accuracies: g.accuracies } : {}),
    uuid: `00000000-0000-4000-9000-${String(g.id).padStart(12, '0')}`,
    initial_setup: g.fen || START,
    fen: finalFen || START,
    time_class: g.timeClass,
    rules: g.rules || 'chess',
    white: player(g.white[0], g.white[1], g.results[0]),
    black: player(g.black[0], g.black[1], g.results[1]),
    ...(g.eco ? { eco: g.ecoUrl } : {}),
  };
  // Castling (k, q), en passant (e) and promotion (p) moves, by ply, for replay tests.
  const special = verbose.flatMap((m, i) => (/[kqep]/.test(m.flags)
    ? [{ ply: i + 1, move: `${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${m.san}`, flags: m.flags }] : []));
  const entry = {
    uuid: game.uuid, file: `games-${g.month.replace('/', '-')}${g.broken || g.id >= 100 ? '-malformed' : ''}.json`, rules: game.rules,
    valid: !g.broken, plies: verbose.length || null, result: g.result, finalFen: finalFen, features: g.features, specialMoves: special,
  };
  return { game, entry };
}

function files() {
  const out = {};
  const catalog = [];
  const months = new Map();
  for (const g of [...GAMES, ...MALFORMED]) {
    const { game, entry } = build(g);
    catalog.push(entry);
    if (!months.has(entry.file)) months.set(entry.file, []);
    months.get(entry.file).push(game);
  }
  // Oldest first within a month, as the API lists them.
  for (const [file, games] of months) out[file] = { games: games.sort((a, b) => a.end_time - b.end_time) };
  const monthUrl = (m) => `${API}${PLAYER}/games/${m}`;
  out['archives.json'] = { archives: ['2026/07', '2026/08', '2026/09'].map(monthUrl) };
  out['archives-empty.json'] = { archives: [] };
  out['archives-malformed.json'] = { archives: ['2026/06'].map(monthUrl) };
  out['games-empty.json'] = { games: [] };
  out['profile.json'] = {
    avatar: 'https://images.chesscomfiles.com/uploads/v1/user/example.png',
    player_id: 900000001,
    '@id': API + PLAYER,
    url: `https://www.chess.com/member/${PLAYER}`,
    name: 'Example Player',
    username: PLAYER,
    followers: 42,
    country: 'https://api.chess.com/pub/country/XX',
    location: 'Fixture Lake',
    last_online: 1790000000,
    joined: 1420070400,
    status: 'basic',
    is_streamer: false,
    verified: false,
    league: 'Stone',
    streaming_platforms: [],
  };
  // Invented round numbers, chosen to look nothing like a real account.
  out['stats.json'] = {
    chess_daily: { last: { rating: 1250, date: 1789000000, rd: 120 }, best: { rating: 1300, date: 1783000000, game: 'https://www.chess.com/game/daily/900000000006' }, record: { win: 6, loss: 4, draw: 1, time_per_move: 5400, timeout_percent: 0 } },
    chess_rapid: { last: { rating: 1500, date: 1790500000, rd: 45 }, best: { rating: 1550, date: 1785000000, game: 'https://www.chess.com/game/live/900000000001' }, record: { win: 120, loss: 110, draw: 10 } },
    chess_bullet: { last: { rating: 1300, date: 1783200000, rd: 90 }, best: { rating: 1350, date: 1780000000, game: 'https://www.chess.com/game/live/900000000005' }, record: { win: 30, loss: 28, draw: 2 } },
    chess_blitz: { last: { rating: 1400, date: 1790100000, rd: 70 }, best: { rating: 1450, date: 1781000000, game: 'https://www.chess.com/game/live/900000000002' }, record: { win: 60, loss: 55, draw: 5 } },
    fide: 0,
    tactics: { highest: { rating: 1700, date: 1778000000 }, lowest: { rating: 400, date: 1500000000 } },
    puzzle_rush: { best: { total_attempts: 25, score: 21 } },
  };
  // A new account: rapid only, no best rating, no tactics or puzzle rush.
  out['stats-sparse.json'] = {
    chess_rapid: { last: { rating: 1200, date: 1790500000, rd: 200 }, record: { win: 1, loss: 2, draw: 0 } },
    fide: 0,
    tactics: {},
    puzzle_rush: {},
  };
  out['catalog.json'] = {
    about: 'Synthetic games for replay tests (generated by build.mjs). valid: false marks PGNs that must be rejected.',
    player: PLAYER,
    games: catalog,
  };
  return out;
}

function check(expected) {
  const problems = [];
  for (const [file, value] of Object.entries(expected)) {
    const text = JSON.stringify(value, null, 2) + '\n';
    let disk = null;
    try { disk = fs.readFileSync(path.join(DIR, file), 'utf8'); } catch { problems.push(`${file}: missing`); continue; }
    if (disk !== text) problems.push(`${file}: differs from build.mjs output (run without --check)`);
  }
  // Replay every PGN as a page would: valid ones end at the recorded position, malformed ones throw.
  const catalog = expected['catalog.json'].games;
  for (const entry of catalog) {
    const game = expected[entry.file].games.find((g) => g.uuid === entry.uuid);
    const chess = new Chess();
    let error = null;
    try { chess.loadPgn(game.pgn); } catch (e) { error = e.message; }
    if (entry.valid && error) problems.push(`${entry.uuid}: valid game failed to load: ${error}`);
    if (entry.valid && !error && chess.fen() !== game.fen) problems.push(`${entry.uuid}: final position ${chess.fen()} != ${game.fen}`);
    if (entry.valid && !error && chess.history().length !== entry.plies) problems.push(`${entry.uuid}: ${chess.history().length} plies != ${entry.plies}`);
    if (!entry.valid && !error) problems.push(`${entry.uuid}: malformed game loaded without error`);
  }
  const flags = catalog.flatMap((e) => e.specialMoves.map((m) => m.flags)).join('');
  for (const [flag, label] of [['k', 'kingside castling'], ['q', 'queenside castling'], ['e', 'en passant'], ['p', 'promotion']]) {
    if (!flags.includes(flag)) problems.push(`no game contains ${label}`);
  }
  return problems;
}

const expected = files();
if (process.argv.includes('--check')) {
  const problems = check(expected);
  for (const p of problems) console.error(p);
  const games = expected['catalog.json'].games;
  console.log(`${games.length} games (${games.filter((g) => g.valid).length} valid, ${games.filter((g) => !g.valid).length} malformed), ${Object.keys(expected).length} files: ${problems.length ? problems.length + ' problem(s)' : 'ok'}`);
  process.exit(problems.length ? 1 : 0);
} else {
  for (const [file, value] of Object.entries(expected)) fs.writeFileSync(path.join(DIR, file), JSON.stringify(value, null, 2) + '\n');
  const problems = check(expected);
  for (const p of problems) console.error(p);
  console.log(`wrote ${Object.keys(expected).length} files to ${path.relative(process.cwd(), DIR) || '.'}${problems.length ? `, ${problems.length} problem(s)` : ''}`);
  process.exit(problems.length ? 1 : 0);
}
