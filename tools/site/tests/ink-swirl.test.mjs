// Photography → Chess's misty main event (static/site/scene/ink-swirl.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAYLEIGH } from '../../../static/site/scene/ink-swirl.js';

test('a drop breathes in Rayleigh\'s modes: ω_l ∝ √(l(l−1)(l+2)), 1 : 1.94 : 3', () => {
  assert.ok(Math.abs(RAYLEIGH[1] / RAYLEIGH[0] - Math.sqrt(30 / 8)) < 1e-12);
  assert.ok(Math.abs(RAYLEIGH[2] / RAYLEIGH[0] - 3) < 1e-12);
});
