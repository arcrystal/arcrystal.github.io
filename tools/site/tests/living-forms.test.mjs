// Photography → Chess's living ink (static/site/scene/living-forms.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_CLOCK, CLOCKS, clockP } from '../../../static/site/scene/living-forms.js';
import { HOLD, holdFor, inkRaw, INK_ADDED, INK_EVENT } from '../../../static/site/lerp.js';

const near = (a, b, e, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);
const screensOf = pin => { const h = holdFor('ink', pin), T = h.pin * pin + h.leadIn; return P => inkRaw(P, pin) * T; };

test('the event\'s clock runs with this device\'s scroll, and is P outside the event', () => {
  for (const pin of [HOLD.pin, HOLD.pinTouch]) {
    const s = screensOf(pin);
    near(clockP(.4, pin), .4, 1e-12);
    let prev = -1;
    for (let P = .5; P < .9; P += .001) { const c = clockP(P, pin); assert.ok(c > prev, 'only forward'); prev = c; }
    // Inside, one P of clock per EVENT_CLOCK.screens screens of this hold's own scroll.
    for (const P of [.58, .64, .7, .76]) {
      const h = 1e-4, dc = (clockP(P + h, pin) - clockP(P - h, pin)) / (2 * h), ds = (s(P + h) - s(P - h)) / (2 * h);
      near(dc / ds, 1 / EVENT_CLOCK.screens, 1e-6);
    }
    // Continuous at both ends, and P's own pace after.
    near(clockP(EVENT_CLOCK.from + 1e-9, pin), EVENT_CLOCK.from, 1e-6);
    near(clockP(.9, pin) - clockP(.85, pin), .05, 1e-12);
  }
});

test('every wave on screen during the event turns at most once in three screens, on desktop and on touch', () => {
  for (const c of CLOCKS) {
    const perScreen = c.rate * c.harmonic / (2 * Math.PI) / EVENT_CLOCK.screens;
    assert.ok(perScreen <= 1 / 3, `${c.name}: ${perScreen.toFixed(3)} cycles a screen`);
  }
});

test('the event gets half as much scroll again, and the rise and the drain keep theirs', () => {
  near(HOLD.by.ink.pin, 7.5 + INK_ADDED.free + INK_ADDED.event + INK_ADDED.figures + INK_ADDED.drain, 1e-9);
  const s = screensOf(HOLD.pin);
  assert.ok(s(.78) - s(.555) > 10.4 && s(.78) - s(.555) < 11.2, 'about 10.8 screens');
  assert.ok(s(.78) - s(.722) > 1.6, 'the knight and the first figures gather unhurried');
  assert.ok(INK_EVENT[0] >= .565, 'the rise is untouched');
});
