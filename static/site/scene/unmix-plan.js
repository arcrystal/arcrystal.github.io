// Photography → Chess, "ink, unmixed" (glsl/unmix.js draws it; ink-sim.js bakes its fluid; board3d.js its
// board). The clock, in the scroll's P (−.2 … 1.2), and the pure maths the shader mirrors:
// Sixteen drops land on the red darkroom. Buoyant pigment rolls into grey,
// then the back ranks' dissolve runs backward. A falling meniscus uncovers the board.
import { pieceAt, START } from './ink-plan.js';
import { TALL, TYPES } from './staunton.js';

export const UNMIX = Object.freeze({
  drops: [-.005, .081],
  // The rain's run plays from rainRun[0] to rainRun[1] of its length over rain; its ink diffuses over diffuse.
  rain: [.145, .55], rainRun: [0, .74], diffuse: [.40, .53],
  // The rain gives way to the dissolve over still; the dissolve plays backward from unmixRun[0] of its run
  // to its start over unmix, its ink coming back into focus over focus.
  still: [.50, .62], unmix: [.535, .91], unmixRun: [.84, 0], focus: [.61, .88],
  // Its outline trembles as it lands (capillary ripples, dying away).
  tremble: [.79, .91],
  // Click navigation cures the squares first, then each piece over span, the first from
  // harden[0], the last done by harden[1].
  squares: [0.84, 0.9], harden: [0.88, 1.02], span: 0.075,
  // The water clears to the band's world.
  clear: [.96, 1.17],
  lodMax: 1.45,
});
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (r, x) => { const t = clamp((x - r[0]) / (r[1] - r[0])); return t * t * (3 - 2 * t); };
export const smoothIn = smooth;

// Where each run is (a share of its length) at P.
export const rainAt = P => UNMIX.rainRun[0] + (UNMIX.rainRun[1] - UNMIX.rainRun[0]) * clamp((P - UNMIX.rain[0]) / (UNMIX.rain[1] - UNMIX.rain[0]));
// (Played backward, slowing as it lands.)
export const unmixAt = P => {
  const t = clamp((P - UNMIX.unmix[0]) / (UNMIX.unmix[1] - UNMIX.unmix[0]));
  // Nearly linear while the tendrils gather, braking smoothly onto the silhouettes.
  return UNMIX.unmixRun[0] * (1 - t)**2 * (1 + t);
};
// How diffused the ink is (a level of detail, 0 sharp).
export const lodAt = P => UNMIX.lodMax * smooth(UNMIX.diffuse, P) * (1 - smooth(UNMIX.focus, P));
// How much of each run shows.
export const weightsAt = P => { const w = smooth(UNMIX.still, P); return [1 - w, w]; };

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
