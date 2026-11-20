// The falling meniscus on scroll and the abbreviated click cure.
import { pieceAt, START } from './ink-plan.js';
import { TALL, TYPES } from './staunton.js';
import { CLEAR } from './ink-tank.js';

export const UNMIX = Object.freeze({
  squares: [0.84, 0.9], harden: [0.88, 1.02], span: 0.075,
  // The water clears to the band's world.
  clear: CLEAR,
});
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// The 32 pieces in the order of the board's slots (staunton.js startSlots: the FEN's order), each with its
// place in the order they cure (0 … 1) and how tall it stands.
export const SLOTS = (() => {
  const out = [];
  START.split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      out.push({ file: f, row: r, type: TYPES.indexOf(ch.toUpperCase()), order: pieceAt(f, r).when });
      f++;
    }
  });
  const max = Math.max(...out.map(s => s.order));
  return Object.freeze(out.map(s => Object.freeze({ ...s, order: s.order / max, tall: TALL[TYPES[s.type]] })));
})();
// How far a piece's cure has climbed (0 … 1 of its height) at P.
export const cureAt = (order, P) => clamp((P - (UNMIX.harden[0] + order * (UNMIX.harden[1] - UNMIX.harden[0] - UNMIX.span))) / UNMIX.span);
