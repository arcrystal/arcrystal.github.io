// PGN and move-list handling for the chess page: reading a game into positions, naming openings and
// results, and the factual notes (opening, move numbers, material, result). Pure functions, no DOM.
// The relative import resolves to /static/vendor/chess/chess.js in the browser and in Node tests.
import { Chess } from '../../../static/vendor/chess/chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const DRAW_RESULTS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

// ---- headers ------------------------------------------------------------------------------------

export function header(pgn, name) {
  const match = String(pgn || '').match(new RegExp(`\\[${name} "([^"]*)"\\]`));
  return match ? match[1] : '';
}

// Chess.com names the opening in ECOUrl (".../openings/Scotch-Game-Classical-Variation").
const FAMILIES = [
  [/^Sicilian-Defense-OKelly-Variation/, 'Sicilian Defense: O’Kelly'],
  [/^Alapin-Sicilian/, 'Alapin Sicilian'], [/^Closed-Sicilian/, 'Closed Sicilian'],
  [/^Reti-Opening/, 'Réti Opening'], [/^Scotch-Game/, 'Scotch Game'],
  [/^Sicilian-Defense/, 'Sicilian Defense'], [/^Caro-Kann-Defense/, 'Caro–Kann Defense'],
  [/^French-Defense/, 'French Defense'], [/^English-Opening/, 'English Opening'],
  [/^Queens-Gambit/, 'Queen’s Gambit'], [/^Queens-Pawn/, 'Queen’s Pawn Game'],
  [/^Kings-Pawn/, 'King’s Pawn Game'], [/^Italian-Game/, 'Italian Game'],
  [/^Indian-Game/, 'Indian Game'], [/^Kings-Indian/, 'King’s Indian Defense'],
  [/^Nimzo-Indian/, 'Nimzo–Indian Defense'], [/^Bogo-Indian/, 'Bogo–Indian Defense'],
  [/^Vienna-Game/, 'Vienna Game'], [/^Four-Knights/, 'Four Knights Game'],
  [/^Scandinavian-Defense/, 'Scandinavian Defense'], [/^Pirc-Defense/, 'Pirc Defense'],
  [/^Modern-Defense/, 'Modern Defense'], [/^Dutch-Defense/, 'Dutch Defense'],
  [/^Alekhines-Defense/, 'Alekhine’s Defense'], [/^Philidor-Defense/, 'Philidor Defense'],
  [/^Slav-Defense/, 'Slav Defense'], [/^London-System/, 'London System'],
  [/^Catalan-Opening/, 'Catalan Opening'],
];

export function openingFamily(pgnOrUrl) {
  const text = String(pgnOrUrl || '');
  const url = text.includes('[') ? header(text, 'ECOUrl') : text;
  const slug = url.split('/openings/')[1] || '';
  const hit = FAMILIES.find(([pattern]) => pattern.test(slug));
  if (hit) return hit[1];
  const words = slug.split('-').filter(Boolean).slice(0, 2);
  if (words.length) return words.join(' ');
  const eco = text.includes('[') ? header(text, 'ECO') : '';
  return `ECO ${eco || 'unknown'}`;
}

// The full opening name from the slug ("Scotch Game: Classical Variation" style, best effort).
export function openingName(pgn) {
  const slug = (header(pgn, 'ECOUrl').split('/openings/')[1] || '').replace(/-\d.*$/, '');
  if (!slug) return '';
  return slug.replace(/-/g, ' ').replace(/\bOKelly\b/, 'O’Kelly').replace(/\bReti\b/, 'Réti');
}

// ---- results --------------------------------------------------------------------------------------

// Chess.com's per-player result codes → win / loss / draw.
export function outcome(code) {
  if (code === 'win') return 'win';
  if (DRAW_RESULTS.has(code)) return 'draw';
  return 'loss';
}

const REASON = {
  resigned: 'resignation', timeout: 'time', checkmated: 'checkmate', abandoned: 'abandonment',
  agreed: 'agreement', repetition: 'repetition', stalemate: 'stalemate', insufficient: 'insufficient material',
  '50move': 'the fifty-move rule', timevsinsufficient: 'time against insufficient material', kingofthehill: 'king of the hill',
  threecheck: 'three checks', bughousepartnerlose: 'partner loss',
};

// "Won by resignation", "Lost on time", "Drawn by repetition", from the player's side.
export function resultText(playerCode, opponentCode) {
  const o = outcome(playerCode);
  if (o === 'win') {
    const why = REASON[opponentCode];
    if (opponentCode === 'timeout') return 'Won on time';
    if (opponentCode === 'checkmated') return 'Won by checkmate';
    return why ? `Won by ${why}` : 'Won';
  }
  if (o === 'draw') return `Drawn by ${REASON[playerCode] || 'agreement'}`;
  if (playerCode === 'timeout') return 'Lost on time';
  if (playerCode === 'checkmated') return 'Lost by checkmate';
  const why = REASON[playerCode];
  return why ? `Lost by ${why}` : 'Lost';
}

export function scoreOf(result) {
  return result === '1-0' ? 'White won' : result === '0-1' ? 'Black won' : result === '1/2-1/2' ? 'Drawn' : 'Unfinished';
}

// ---- positions ------------------------------------------------------------------------------------

export function placement(chess) {
  const out = {};
  for (const row of chess.board()) for (const cell of row) if (cell) out[cell.square] = cell.color + cell.type.toUpperCase();
  return out;
}

export function material(pieces) {
  let w = 0;
  let b = 0;
  for (const code of Object.values(pieces)) {
    const v = VALUE[code[1].toLowerCase()];
    if (code[0] === 'w') w += v; else b += v;
  }
  return { white: w, black: b, balance: w - b };
}

export function moveLabel(ply, san) {
  const number = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${number}. ${san}` : `${number}… ${san}`;
}

export function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

// Reads a game from a PGN (Chess.com's, with clock comments) or from a SAN list.
// → { ok: true, headers, startFen, moves[], fens[], boards[], result } | { ok: false, error }
export function readGame(source, { startFen = START_FEN } = {}) {
  try {
    const headers = {};
    let chess = new Chess();
    let moves;
    if (Array.isArray(source)) {
      chess = new Chess(startFen);
      moves = [];
      for (const san of source) moves.push(chess.move(san));
    } else {
      const text = String(source || '');
      if (!text.trim()) return { ok: false, error: 'empty move list' };
      chess.loadPgn(text);
      Object.assign(headers, chess.getHeaders());
      moves = chess.history({ verbose: true });
    }
    if (!moves.length) return { ok: false, error: 'no moves' };
    const replay = new Chess(moves[0].before);
    const fens = [replay.fen()];
    const boards = [placement(replay)];
    const out = [];
    moves.forEach((m, i) => {
      replay.move(m.san);
      fens.push(replay.fen());
      boards.push(placement(replay));
      out.push({
        ply: i + 1, san: m.san, color: m.color, piece: m.piece, from: m.from, to: m.to, captured: m.captured || null,
        promotion: m.promotion || null, flags: m.flags, check: m.san.includes('+') || m.san.includes('#'), mate: m.san.includes('#'),
      });
    });
    return { ok: true, headers, startFen: moves[0].before, moves: out, fens, boards, result: headers.Result || '' };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).split('\n')[0] };
  }
}

// ---- factual notes ----------------------------------------------------------------------------------

const SIDE = { w: 'White', b: 'Black' };

// Notes about a read game: [{ ply, text }] sorted by ply, derived only from the moves themselves.
export function annotate(game) {
  if (!game.ok) return [];
  const notes = [];
  const mat = game.boards.map(material);
  let firstCapture = false;
  let firstCheck = false;
  let swing = { ply: 0, size: 0 };
  game.moves.forEach((m) => {
    const label = moveLabel(m.ply, m.san);
    const who = SIDE[m.color];
    if (m.flags.includes('k')) notes.push({ ply: m.ply, text: `${label}: ${who} castles kingside.` });
    else if (m.flags.includes('q')) notes.push({ ply: m.ply, text: `${label}: ${who} castles queenside.` });
    if (m.captured && !firstCapture) {
      firstCapture = true;
      notes.push({ ply: m.ply, text: `${label}: the first capture, a ${PIECE_NAME[m.captured]} on ${m.to}.` });
    }
    if (m.flags.includes('e')) notes.push({ ply: m.ply, text: `${label}: ${who} captures en passant on ${m.to}.` });
    if (m.promotion) notes.push({ ply: m.ply, text: `${label}: ${who} promotes a pawn to a ${PIECE_NAME[m.promotion]} on ${m.to}.` });
    if (m.check && !m.mate && !firstCheck) {
      firstCheck = true;
      notes.push({ ply: m.ply, text: `${label}: the first check.` });
    }
    const delta = Math.abs((mat[m.ply].balance) - (mat[m.ply - 1].balance));
    // A material swing is judged over the next reply as well, so a trade is not a swing.
    const next = mat[Math.min(m.ply + 1, mat.length - 1)];
    const settled = Math.abs(next.balance - mat[m.ply - 1].balance);
    if (m.captured && settled >= 3 && delta >= 3 && settled > swing.size) swing = { ply: m.ply, size: settled, color: m.color };
    if (m.mate) notes.push({ ply: m.ply, text: `${label}: checkmate. ${who} wins.` });
  });
  if (swing.ply) {
    const before = mat[swing.ply - 1].balance;
    const after = mat[Math.min(swing.ply + 1, mat.length - 1)].balance;
    notes.push({
      ply: swing.ply,
      text: `${moveLabel(swing.ply, game.moves[swing.ply - 1].san)}: the biggest swing in material. From White's side the balance goes from ${signed(before)} to ${signed(after)}.`,
    });
  }
  return notes.sort((a, b) => a.ply - b.ply);
}

// A one-line summary of the final position: material and the side to move.
export function endSummary(game) {
  if (!game.ok) return '';
  const m = material(game.boards[game.boards.length - 1]);
  const lead = m.balance === 0 ? 'Material is level' : `${m.balance > 0 ? 'White' : 'Black'} is ahead by ${Math.abs(m.balance)} points of material`;
  const last = game.moves[game.moves.length - 1];
  return `${lead} after ${moveLabel(last.ply, last.san)}.`;
}

// "Move 3, White plays d4: pawn from d2 to d4." for assistive technology and the caption.
export function describePly(game, index) {
  if (!game.ok) return '';
  if (index <= 0) return 'Start position.';
  const m = game.moves[index - 1];
  const parts = [`Move ${Math.ceil(m.ply / 2)}, ${SIDE[m.color]} plays ${m.san}`];
  const bits = [`${PIECE_NAME[m.piece]} from ${m.from} to ${m.to}`];
  if (m.captured) bits.push(`captures a ${PIECE_NAME[m.captured]}`);
  if (m.promotion) bits.push(`promotes to a ${PIECE_NAME[m.promotion]}`);
  if (m.mate) bits.push('checkmate'); else if (m.check) bits.push('check');
  return `${parts[0]}: ${bits.join(', ')}.`;
}

// Movetext without the Chess.com clock comments, for compact saved copies.
export function stripComments(pgn) {
  return String(pgn || '').replace(/\{[^}]*\}/g, '').replace(/ {2,}/g, ' ');
}
