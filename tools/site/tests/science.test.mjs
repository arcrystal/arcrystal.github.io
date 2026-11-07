// node --test tools/site/tests/*.test.mjs    The Science experiments' maths (science/page/sims/) and
// the data behind Racing and Outdoors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLANETS, transitDepth, periodRatios, phaseAt } from '../../../science/page/sims/trappist.js';
import { GOLDEN_ANGLE, seedAt, fernStep } from '../../../science/page/sims/phyllotaxis.js';
import { reflectance, peakWavelength, CHITIN } from '../../../science/page/sims/structural-colour.js';
import { kNearest } from '../../../science/page/sims/murmuration.js';
import { distanceKm, lightHours, REFERENCE, AU_KM } from '../../../science/page/sims/voyager.js';
import { WOW, strength } from '../../../science/page/sims/wow.js';
import { drake, FACTORS } from '../../../science/page/sims/drake.js';

const json = rel => JSON.parse(readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'));

test('TRAPPIST-1: seven planets in order, near the published resonant chain', () => {
  assert.equal(PLANETS.length, 7);
  assert.deepEqual(PLANETS.map(p => p.id).join(''), 'bcdefgh');
  for (let i = 1; i < 7; i++) assert.ok(PLANETS[i].period > PLANETS[i - 1].period && PLANETS[i].a > PLANETS[i - 1].a);
  const near = [8 / 5, 5 / 3, 3 / 2, 3 / 2, 4 / 3, 3 / 2];
  periodRatios().forEach((r, i) => assert.ok(Math.abs(r - near[i]) < 0.025, `${PLANETS[i + 1].id}/${PLANETS[i].id} ${r}`));
  // Kepler's third law holds across the system: a³/P² is the same for every planet.
  const k = PLANETS.map(p => p.a ** 3 / p.period ** 2);
  k.forEach(v => assert.ok(Math.abs(v / k[0] - 1) < 0.01));
  assert.ok(Math.abs(transitDepth(PLANETS[0].radius) - 0.0073) < 0.0005, 'b dims the star by about 0.7%');
  assert.ok(Math.abs(phaseAt(PLANETS[0], PLANETS[0].period * 3) - 0) < 1e-9);
});

test('phyllotaxis: the golden angle and Vogel’s placement', () => {
  assert.ok(Math.abs(GOLDEN_ANGLE - 137.50776) < 1e-4);
  const [x, y] = seedAt(4, 90, 2);
  assert.ok(Math.abs(x - 4) < 1e-9 && Math.abs(y) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...seedAt(100, GOLDEN_ANGLE, 1)) - 10) < 1e-9);
  let p = [0, 0];
  for (let i = 0; i < 2000; i++) p = fernStep(p, (i * 0.618) % 1);
  assert.ok(p[1] >= 0 && p[1] < 10.1 && Math.abs(p[0]) < 3);
});

test('structural colour: a 75 nm chitin film reflects blue, and tilting shifts it shorter', () => {
  const peak = peakWavelength(75, CHITIN, 1);
  assert.ok(peak > 450 && peak < 490, String(peak));
  assert.ok(peakWavelength(75, CHITIN, 0.9) < peak);
  assert.ok(reflectance(peak, 75, CHITIN, 1) > 0.99);
  assert.ok(reflectance(620, 75, CHITIN, 1) < reflectance(peak, 75, CHITIN, 1));
});

test('murmuration: each bird finds its k nearest neighbours', () => {
  const xs = [0, 1, 2, 10, 3, 0.5], ys = [0, 0, 0, 0, 0, 0];
  assert.deepEqual(kNearest(0, xs, ys, [0, 1, 2, 3, 4, 5], 3), [5, 1, 2]);
  assert.deepEqual(kNearest(3, xs, ys, [0, 1, 2, 3, 4, 5], 1), [4]);
});

test('Voyager 1 recedes at its published speed', () => {
  assert.ok(Math.abs(distanceKm(REFERENCE.date) / AU_KM - 167.1) < 1e-9);
  const year = 365.25 * 864e5;
  const perYearAU = (distanceKm(REFERENCE.date + year) - distanceKm(REFERENCE.date)) / AU_KM;
  assert.ok(Math.abs(perYearAU - 3.59) < 0.02, String(perYearAU));
  assert.ok(lightHours(distanceKm(Date.UTC(2026, 10, 7))) > 23 && lightHours(distanceKm(Date.UTC(2026, 10, 7))) < 24.2);
});

test('the Wow! signal reads 6, 14, 26, 30, 19, 5 times the noise', () => {
  assert.deepEqual([...WOW].map(strength), [6, 14, 26, 30, 19, 5]);
  assert.equal(strength(' '), 0);
});

test('the Drake equation multiplies its factors', () => {
  const f = Object.fromEntries(FACTORS.map(x => [x.key, x.value]));
  assert.ok(Math.abs(drake(f) - 3) < 1e-9);
  assert.equal(drake({ ...f, fl: 0 }), 0);
});

test('every race on record is listed once, newest first', () => {
  const { races } = json('athletics/page/races.json');
  assert.equal(races.length, 37);
  assert.equal(races.reduce((n, r) => n + (r.legs ? r.legs.length : 1), 0), 39, 'the 39 competition activities, the half Ironman as one race of three legs');
  for (let i = 1; i < races.length; i++) assert.ok(races[i - 1].date >= races[i].date);
  const birkie = races.find(r => r.date === '2026-02-21');
  assert.equal(birkie.official, '2:28:49.04');
  assert.ok(races.every(r => ['ski', 'run', 'tri', 'endurance'].includes(r.sport)));
});

test('the 48: every summit once, in the order climbed, from the hikes behind them', () => {
  const { peaks, hikes } = json('outdoors/page/peaks.json');
  assert.equal(peaks.length, 48);
  assert.equal(new Set(peaks.map(p => p.name)).size, 48);
  assert.ok(peaks.every(p => p.ft >= 4000 && p.ft <= 6288));
  for (let i = 1; i < 48; i++) assert.ok(peaks[i - 1].date <= peaks[i].date);
  assert.equal(peaks.at(-1).date, '2026-08-01');
  assert.equal(hikes.reduce((n, h) => n + h.peaks.length, 0), 48);
});
