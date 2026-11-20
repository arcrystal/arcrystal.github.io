// Photography → Chess: the mist's main event (glsl/living-ink.js INK_SHEET_FRAGMENT).
// One source for the shaders and the tests, as ink-tank.js is for the tank.
//
// Every plume head is a vortex ring seen side on: a mushroom cap with two counter-rotating cores. Through
// the event the cores roll the cap up, winding the plume studies' filaments round themselves into spiral
// curls, the core faster than its rim (a Lamb–Oseen core: solid inside, falling as 1/r² outside), so the
// filaments are drawn out into tendrils. The angle is the integral of a rate that spins up and dies away:
// it only ever grows with the scroll, so nothing turns backward on screen; the wound texture is handed to
// each figure's own study as the figure gathers. Meanwhile the caps breathe.
import { smooth } from './ink-tank.js';

// A free drop's shape modes (Rayleigh, 1879): ω_l ∝ √(l(l−1)(l+2)), so l = 2, 3, 4 ring at 1 : 1.94 : 3.
// The breathing caps borrow l = 2 and l = 3 (l = 4 locks to l = 2 at 1 : 3).
export const RAYLEIGH = [2, 3, 4].map(l => Math.sqrt(l * (l - 1) * (l + 2)) / Math.sqrt(8));

// The roll's rate: up over [.585, .615], full to .645, dying away by .70.
export const SPIN = Object.freeze([.585, .615, .645, .70]);
const rate = P => smooth(SPIN[0], SPIN[1], P) * (1 - smooth(SPIN[2], SPIN[3], P));
const STEPS = 400, lo = SPIN[0], hi = SPIN[3] + .02;
const CUMULATIVE = (() => {
  const c = new Float64Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) {
    const a = lo + (hi - lo) * (i - 1) / STEPS, b = lo + (hi - lo) * i / STEPS;
    c[i] = c[i - 1] + (rate(a) + rate(b)) / 2;
  }
  for (let i = 0; i <= STEPS; i++) c[i] /= c[STEPS];
  return c;
})();
// How far the caps have rolled up at P: 0 … 1, never back.
export function rollUp(P) {
  const x = Math.max(0, Math.min(1, (P - lo) / (hi - lo))) * STEPS, i = Math.min(STEPS - 1, Math.floor(x));
  return CUMULATIVE[i] + (CUMULATIVE[i + 1] - CUMULATIVE[i]) * (x - i);
}
// The caps' breath at P (time: seconds, for a slow breath at rest): its depth, and the phases of the l = 0,
// 2 and 3 modes, their frequencies Rayleigh's (l = 0 slower still); about one breath per .02 of P.
export const BREATH = Object.freeze({ window: [.585, .62, .70, .745], period: .02 });
export function breath(P, time = 0) {
  const [a, b, c, d] = BREATH.window, depth = smooth(a, b, P) * (1 - smooth(c, d, P));
  const t = 2 * Math.PI * P / BREATH.period + .35 * time;
  return [depth, .8 * t, RAYLEIGH[0] * t, RAYLEIGH[1] * t];
}
// The cap's swell at angle ϑ round its centre (shader mirror): l = 0, plus l = 2 and l = 3 on turning axes.
export function swell(b, angle, seed = 0, ivory = 0) {
  const phase = seed * 1.3 + Math.PI * ivory;
  return b[0] * (.12 * Math.sin(b[1] + phase) + .065 * Math.cos(2 * (angle - .4 * b[1] - seed)) * Math.sin(b[2] + phase)
    + .05 * Math.cos(3 * (angle + .3 * b[1] + seed)) * Math.sin(b[3] + phase));
}

// ---- the flow ------------------------------------------------------------------------------------------
// Under the caps the whole water moves: the mist and the veils ride one field, so the clouds stretch,
// contort, contract and swell together. Two parts, both in screen heights (x scaled by the aspect):
//   the stir: the curl of a stream function of travelling modes, ψ = Σ a sin(k·q + ω τ + φ), so it shears
//   and turns without making or losing anything (it is divergence-free);
//   the breath: the gradient of a potential, φ = b cos(m·q + φ0) sin(β), which gathers the water toward
//   some places and spreads it from others and back again; where it gathers, the same pigment is packed
//   into less water and darkens (by 1 − ∇²φ), where it spreads it thins.
// Each depth of the water sees the field at a later phase, so the near and far mist part ways (contortion).
// τ and β run with the scroll (so scrolling back rewinds them) and a little with time (alive at rest).
export const FLOW = Object.freeze({
  window: [.50, .565, .745, .80],
  stir: [[2.1, 3.3, 1.0, .010, .3], [-3.4, 1.7, -1.3, .0085, 1.9], [4.8, -3.9, 1.9, .0048, 4.1], [-6.7, -5.2, -2.6, .0026, 2.6], [9.5, 7.1, 3.4, .0013, .8]],
  breath: [[3.5, 2.5, .0078, 0], [-2.8, 4.1, .0066, 2.2]],
  perP: 62, perSecond: .45, breathPeriod: .021, breathPerSecond: .9, depth: 1.7,
});
export function flowAt(P, time = 0) {
  const [a, b, c, d] = FLOW.window, on = smooth(a, b, P) * (1 - smooth(c, d, P));
  return [FLOW.perP * (P - a) + FLOW.perSecond * time, 2 * Math.PI * P / FLOW.breathPeriod + FLOW.breathPerSecond * time, on];
}
// The displacement at q and the factor its packing multiplies the pigment by (JS mirror of inkFlow).
export function flowField(q, tau, beta) {
  let dx = 0, dy = 0;
  for (const [kx, ky, w, amp, ph] of FLOW.stir) {
    const c = amp * Math.cos(kx * q[0] + ky * q[1] + w * tau + ph);
    dx += c * ky; dy -= c * kx;
  }
  let lap = 0;
  const s = Math.sin(beta);
  for (const [mx, my, amp, ph] of FLOW.breath) {
    const arg = mx * q[0] + my * q[1] + ph;
    dx -= amp * Math.sin(arg) * mx * s; dy -= amp * Math.sin(arg) * my * s;
    lap -= amp * Math.cos(arg) * (mx * mx + my * my) * s;
  }
  return [dx, dy, Math.min(1.5, Math.max(.65, 1 - lap))];
}
const g = x => x.toFixed(4);
export const FLOW_GLSL = /* glsl */ `
uniform vec3 uInkFlow; // τ, β, how strong (ink-swirl.js flowAt)
vec3 inkFlow(vec2 q, float tau, float beta) {
  vec2 d = vec2(0.);
  float c;
${FLOW.stir.map(([kx, ky, w, amp, ph]) => `  c = ${g(amp)} * cos(${g(kx)} * q.x + ${g(ky)} * q.y + ${g(w)} * tau + ${g(ph)}); d += c * vec2(${g(ky)}, ${g(-kx)});`).join('\n')}
  float s = sin(beta), lap = 0., arg;
${FLOW.breath.map(([mx, my, amp, ph]) => `  arg = ${g(mx)} * q.x + ${g(my)} * q.y + ${g(ph)}; d -= ${g(amp)} * sin(arg) * s * vec2(${g(mx)}, ${g(my)}); lap -= ${g(amp)} * cos(arg) * s * ${g(mx * mx + my * my)};`).join('\n')}
  return vec3(d, clamp(1. - lap, .65, 1.5));
}
`;
