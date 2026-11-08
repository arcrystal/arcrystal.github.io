// State of a replay board: which ply is shown, which way the board faces, and what each square holds.
// Pure (no DOM), so stepping, rotation and keys are tested under Node.
import { describePly, moveLabel } from './pgn.js';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Keyboard map: arrows step, Home/End jump, F flips the board, P plays and pauses.
export function keyAction(key, mods = {}) {
  if (mods.ctrlKey || mods.metaKey || mods.altKey) return null;
  switch (key) {
    case 'ArrowLeft': return 'prev';
    case 'ArrowRight': return 'next';
    case 'Home': return 'first';
    case 'End': return 'last';
    case 'f': case 'F': return 'flip';
    case 'p': case 'P': return 'play';
    default: return null;
  }
}

export class ReplayModel {
  constructor(game, { flipped = false, index = 0 } = {}) {
    if (!game?.ok) throw new Error('ReplayModel needs a game that was read successfully');
    this.game = game;
    this.flipped = flipped;
    this.index = 0;
    this.go(index);
  }

  get max() { return this.game.moves.length; }
  get board() { return this.game.boards[this.index]; }
  get fen() { return this.game.fens[this.index]; }
  get move() { return this.index ? this.game.moves[this.index - 1] : null; }
  get atStart() { return this.index === 0; }
  get atEnd() { return this.index === this.max; }
  get caption() { return describePly(this.game, this.index); }
  get label() { return this.move ? moveLabel(this.move.ply, this.move.san) : 'Start'; }
  get toMove() { return this.fen.split(' ')[1] === 'w' ? 'White' : 'Black'; }

  go(i) {
    const n = Math.round(Number(i));
    this.index = Number.isFinite(n) ? Math.min(this.max, Math.max(0, n)) : this.index;
    return this.index;
  }

  next() { return this.go(this.index + 1); }
  prev() { return this.go(this.index - 1); }
  first() { return this.go(0); }
  last() { return this.go(this.max); }
  flip() { this.flipped = !this.flipped; return this.flipped; }

  act(action) {
    if (action === 'next' || action === 'prev' || action === 'first' || action === 'last' || action === 'flip') return this[action]();
    return null;
  }

  // The square of the king in check after the current move, or null.
  get checkSquare() {
    const m = this.move;
    if (!m || !m.check) return null;
    const side = this.fen.split(' ')[1];
    const code = `${side}K`;
    return Object.keys(this.board).find((sq) => this.board[sq] === code) || null;
  }

  // The 64 squares in display order (top row first), each with its piece code ('wK') or ''.
  squares() {
    const ranks = this.flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const files = this.flipped ? [...FILES].reverse() : FILES;
    const out = [];
    ranks.forEach((rank, row) => {
      files.forEach((file, col) => {
        const sq = `${file}${rank}`;
        const fileIndex = FILES.indexOf(file);
        out.push({ sq, row, col, light: (fileIndex + rank) % 2 === 0, piece: this.board[sq] || '' });
      });
    });
    return out;
  }
}
