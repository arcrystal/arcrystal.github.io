// Photography → Chess: the living ink (glsl/living-forms.js, the motes and the forms), and the clock the
// whole event's motion keeps.
//
// The scroll does not run evenly through P: a screen covers a little P where the event is slow to scroll
// and much where it is quick, and a phone's hold is half a desktop's. A wave that turns with P therefore
// crawls in one place and throbs in another. So inside the event every wave turns with the scroll itself:
// clockP(P) is P outside [EVENT_CLOCK.from, EVENT_CLOCK.to], and inside it runs on at one P per
// EVENT_CLOCK.screens screens of this device's own scroll. Scrolling back rewinds it exactly.
import { inkRaw, holdFor, HOLD } from '../lerp.js';
import { DROPS, LATE, smooth } from './ink-tank.js';

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

// ---- the forms ----------------------------------------------------------------------------------------
// One living form per plume head: the four trunks, the six late heads, four more between them. Each rides
// its plume's own centroid (the bake's tracks: living-ink-plan.js), congeals out of its mist, lives, and
// dissolves back just before its own figure starts to gather.
export const FORMS = Object.freeze([0, 1, 10, 23, 8, 25, 30, 19, 26, 13, 4, 7, 17, 28]);
const screensDesktop = P => { const h = holdFor('ink', HOLD.pin); return inkRaw(P, HOLD.pin) * (h.pin * HOLD.pin + h.leadIn); };
function beforeScreens(P, screens) {
  const target = screensDesktop(P) - screens;
  let lo = .4, hi = P;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (screensDesktop(m) < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// Where a late head has come down below y .8 (ink-tank.js LATE, living-ink-plan.js lateRail, closed form).
function lateBelow(id, y = .8) {
  const k = LATE.findIndex(l => l.id === id), d = DROPS[id], end = .30 + .07 * (k % 3);
  const fall = (1.10 - y) / (1.10 - end), t = 1 - Math.pow(1 - fall, 1 / 2.2);
  return d.hit + .02 + t * (.64 - d.hit - .02);
}
// The schedule, from the bake's sites (living-ink-plan.js birthSites): for each form, when it begins to
// congeal (c0), is whole (c1), begins to dissolve (d0) and is gone (d1), and its ink.
export function formSchedule(sites) {
  return FORMS.map((id, k) => {
    const late = LATE.some(l => l.id === id);
    // (Staggered: no two forms congeal or dissolve together.)
    const c0 = late ? Math.max(.597 + .0065 * (k - 4), lateBelow(id)) : k < 4 ? .585 + .008 * k : .60 + .007 * (k - 10);
    const c1 = c0 + .04;
    const d1 = Math.min(sites[id].formStart - .004, .755 + .0022 * k), d0 = Math.max(c1 + .02, beforeScreens(d1, 2.2));
    return Object.freeze({ id, white: DROPS[id].white, c0, c1, d0, d1 });
  });
}
// How solid a form is at P: 0 mist … 1 whole.
export const solidity = (f, P) => smooth(f.c0, f.c1, P) * (1 - smooth(f.d0, f.d1, P));
// The forms' tracks between two keys (tracks: KEYS × FORMS × 4, x and y as shares of the screen, depth,
// spread), by a uniform cubic B-spline through the keys: smooth to the second derivative, so a form's
// path never kinks at a key.
export function trackAt(tracks, keyF, f) {
  const n = FORMS.length, keys = tracks.length / (4 * n), k = Math.floor(keyF), t = keyF - k;
  const at = (i, c) => tracks[4 * (Math.max(0, Math.min(keys - 1, i)) * n + f) + c];
  const b = [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) for (let j = 0; j < 4; j++) out[c] += b[j] * at(k - 1 + j, c);
  return out;
}
