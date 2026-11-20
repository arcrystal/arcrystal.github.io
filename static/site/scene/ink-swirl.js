// Photography → Chess: the mist's main event (glsl/living-ink.js INK_VOLUME, the veils).
// One source for the shaders and the tests, as ink-tank.js is for the tank.
//
// A free drop's shape modes (Rayleigh, 1879): ω_l ∝ √(l(l−1)(l+2)), so l = 2, 3, 4 ring at 1 : 1.94 : 3.
// The breathing plumes borrow l = 2 and l = 3 (l = 4 locks to l = 2 at 1 : 3).
export const RAYLEIGH = [2, 3, 4].map(l => Math.sqrt(l * (l - 1) * (l + 2)) / Math.sqrt(8));
