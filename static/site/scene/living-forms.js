// Photography → Chess: the living ink (glsl/living-forms.js, the motes and the forms), and the clock the
// whole event's motion keeps.
//
// The scroll does not run evenly through P: a screen covers a little P where the event is slow to scroll
// and much where it is quick, and a phone's hold is half a desktop's. A wave that turns with P therefore
// crawls in one place and throbs in another. So inside the event every wave turns with the scroll itself:
// clockP(P) is P outside [EVENT_CLOCK.from, EVENT_CLOCK.to], and inside it runs on at one P per
// EVENT_CLOCK.screens screens of this device's own scroll. Scrolling back rewinds it exactly.
import { inkRaw, holdFor, HOLD } from '../lerp.js';

export const EVENT_CLOCK = Object.freeze({ from: .555, to: .80, screens: 48 });
const screensOf = pin => { const h = holdFor('ink', pin), T = h.pin * pin + h.leadIn; return P => inkRaw(P, pin) * T; };
const memo = new Map();
// The event's clock for a hold of `pin` (HOLD.pin on desktop, HOLD.pinTouch on touch).
export function clockP(P, pin = HOLD.pin) {
  if (!memo.has(pin)) memo.set(pin, screensOf(pin));
  const s = memo.get(pin), { from, to, screens } = EVENT_CLOCK;
  if (P <= from) return P;
  const inside = (s(Math.min(P, to)) - s(from)) / screens;
  return from + inside + Math.max(0, P - to);
}

// Every wave that is on screen during the event, and how fast it turns: radians per unit of clockP,
// times its highest harmonic (a sin(3θ) turns three times as fast). The test holds each to at most one
// cycle per three screens of scroll, on desktop and on touch.
export const CLOCKS = Object.freeze([
  { name: 'veils: roll cores (turn)', rate: 34, harmonic: 1 },
  { name: 'veils: packets', rate: 30, harmonic: 1 },
  { name: 'veils: lift', rate: 69, harmonic: 1 },
  { name: 'veils: skin twist', rate: 32, harmonic: 1 },
  { name: 'veils: dye phase', rate: 5.4, harmonic: 1 },
  { name: 'bake: plume wave (currentTime)', rate: 32, harmonic: 1.5 },
  { name: 'bake: lift', rate: 69, harmonic: 1 },
  { name: 'bake: pulse', rate: 23, harmonic: 1 },
  { name: 'bake: twist and folds (age)', rate: 11, harmonic: 1 },
  { name: 'caps: breath', rate: 2 * Math.PI / .14, harmonic: RAYLEIGH_MAX() },
].map(Object.freeze));
function RAYLEIGH_MAX() { return Math.sqrt(3 * 2 * 5) / Math.sqrt(8); }
