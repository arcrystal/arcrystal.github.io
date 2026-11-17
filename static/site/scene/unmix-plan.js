// Photography → Chess, "ink, unmixed" (glsl/unmix.js draws it; ink-sim.js bakes its fluid; board3d.js its
// board). The clock, in the scroll's P (−.2 … 1.2), and the pure maths the shader mirrors:
//   0 tray      Photography's developer rises up the screen as still water; the red gives way to white
//               light from above.
//   1 rain      some eighty drops of black and white ink strike the surface one after another, punch in,
//               roll up into mushroom pairs, collide and tear (the rain run, played forward).
//   2 storm     the stirring rises; the threads cascade finer and marble; then diffusion wins, the edges
//               soften and everything becomes a luminous grey haze.
//   3 still     near-uniform murk, the motes hanging; a pulse of light where the board will be. The rain
//               hands over to the dissolve here, where both are featureless.
//   4 unmixing  time runs backward: the dissolve of the board, played from its end to its start. Contrast
//               comes back out of the haze, the threads sharpen and retrace their stirring, black parts
//               from white, and the ink lands exactly on the board's squares and its pieces.
//   5 hardening each piece's ink, its outline still trembling, cures from its foot to its crown (knights
//               first, pawns last), a glint at the front; behind it the solid piece, obsidian or ivory;
//               the squares cure outward from the middle.
//   6 settle    the water clears to the band's ink-wash world; the board there is the tile's own picture.
import { pieceAt, START } from './ink-plan.js';
import { TALL, TYPES } from './staunton.js';

export const UNMIX = Object.freeze({
  water: [-0.075, 0.07], light: [-0.03, 0.12],
  // The rain's run plays from rainRun[0] to rainRun[1] of its length over rain; its ink diffuses over diffuse.
  rain: [-0.03, 0.56], rainRun: [0.03, 0.74], diffuse: [0.26, 0.54],
  // The rain gives way to the dissolve over still; the dissolve plays backward from unmixRun[0] of its run
  // to its start over unmix, its ink coming back into focus over focus.
  still: [0.5, 0.6], unmix: [0.52, 0.86], unmixRun: [0.95, 0], focus: [0.6, 0.83],
  pulse: [0.53, 0.62],
  // Its outline trembles as it lands (capillary ripples, dying away).
  tremble: [0.74, 0.87],
  // The squares cure first, outward from the middle (squares); then each piece over span, the first from
  // harden[0], the last done by harden[1].
  squares: [0.84, 0.9], harden: [0.88, 1.02], span: 0.075,
  // The water clears to the band's world.
  clear: [0.97, 1.12],
  lodMax: 5.2,
});
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (r, x) => { const t = clamp((x - r[0]) / (r[1] - r[0])); return t * t * (3 - 2 * t); };
export const smoothIn = smooth;

// Where each run is (a share of its length) at P.
export const rainAt = P => UNMIX.rainRun[0] + (UNMIX.rainRun[1] - UNMIX.rainRun[0]) * clamp((P - UNMIX.rain[0]) / (UNMIX.rain[1] - UNMIX.rain[0]));
// (Played backward, slowing as it lands.)
export const unmixAt = P => { const s = clamp((P - UNMIX.unmix[0]) / (UNMIX.unmix[1] - UNMIX.unmix[0])); return UNMIX.unmixRun[0] + (UNMIX.unmixRun[1] - UNMIX.unmixRun[0]) * (1 - (1 - s) ** 2); };
// How diffused the ink is (a level of detail, 0 sharp).
export const lodAt = P => UNMIX.lodMax * smooth(UNMIX.diffuse, P) * (1 - smooth(UNMIX.focus, P));
// How much of each run shows.
export const weightsAt = P => { const w = smooth(UNMIX.still, P); return [P < UNMIX.rain[1] + 0.06 ? 1 - w : 0, P > UNMIX.still[0] - 0.02 ? w : 0]; };

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
