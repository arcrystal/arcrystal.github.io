// The pace calculators' maths (athletics/calculator.js), the prerendered default state in content.html,
// and the race-row lookup table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clock, secondsFromClock, equivalents, exactFinish, projectionRowsHtml, rowPace, DISTANCES, MILE, RACE_ACTIVITIES, mount } from '../../../athletics/calculator.js';
import { ROOT, allRaceRows, loadSnapshot } from './source.mjs';

const content = readFileSync(join(ROOT, 'athletics', 'page', 'content.html'), 'utf8');

test('clock formats seconds as m:ss or h:mm:ss and rejects non-times', () => {
  assert.equal(clock(59), '0:59');
  assert.equal(clock(60), '1:00');
  assert.equal(clock(1320), '22:00');
  assert.equal(clock(3600), '1:00:00');
  assert.equal(clock(8928), '2:28:48');
  assert.equal(clock(59.6), '1:00', 'rounds to the nearest second');
  for (const bad of [0, -5, NaN, Infinity, undefined]) assert.equal(clock(bad), '—');
});

test('secondsFromClock reads m:ss and h:mm:ss', () => {
  assert.equal(secondsFromClock('22:00'), 1320);
  assert.equal(secondsFromClock('2:28:48'), 8928);
  assert.equal(secondsFromClock(' 0:55 '), 55);
  assert.equal(secondsFromClock('2:28:49.04'), 8929.04);
  assert.equal(secondsFromClock('abc'), 0);
  assert.equal(secondsFromClock('1:xx'), 0);
});

test('distances are the standard race lengths', () => {
  const by = Object.fromEntries(DISTANCES.map((d) => [d.label, d.meters]));
  assert.equal(by['1 mile'], 1609.344);
  assert.equal(by['5K'], 5000);
  assert.equal(by['10K'], 10000);
  assert.equal(by['Half marathon'], 21097.5);
  assert.equal(by['Marathon'], 42195);
  assert.equal(by['50K'], 50000);
});

test('race equivalents: Riegel exponent 1.06 and the exact same-pace conversion', () => {
  const e = equivalents(5000, 22 * 60);                       // a 22:00 5K
  assert.equal(clock(e.paceMile), '7:05');
  assert.equal(clock(e.paceKm), '4:24');
  const row = (label) => e.rows.find((r) => r.label === label);
  assert.equal(clock(row('5K').equivalent), '22:00', 'the benchmark maps to itself');
  assert.equal(clock(row('5K').exact), '22:00');
  assert.equal(clock(row('10K').exact), '44:00', 'same pace over twice the distance');
  assert.equal(clock(row('10K').equivalent), '45:52');
  assert.equal(clock(row('Half marathon').equivalent), '1:41:12');
  assert.equal(clock(row('Marathon').equivalent), '3:31:00');
  // Riegel: T2 = T1 (D2/D1)^1.06
  assert.ok(Math.abs(row('Marathon').equivalent - 1320 * (42195 / 5000) ** 1.06) < 1e-6);
  assert.ok(row('Marathon').equivalent > row('Marathon').exact, 'longer races slow down');
  assert.ok(row('1 mile').equivalent < row('1 mile').exact, 'shorter races speed up');
});

test('exact pace to finish time, and the pace in the other unit', () => {
  const mile = exactFinish(8 * 60, MILE, 10000);              // 8:00 per mile over a 10K
  assert.equal(clock(mile.finish), '49:43');
  assert.equal(clock(mile.otherPace), '4:58');
  assert.equal(mile.otherLabel, 'km');
  const km = exactFinish(5 * 60, 1000, 21097.5);              // 5:00 per km over a half marathon
  assert.equal(clock(km.finish), '1:45:29');
  assert.equal(clock(km.otherPace), '8:03');
  assert.equal(km.otherLabel, 'mi');
  assert.equal(clock(exactFinish(0, MILE, 5000).finish), '—', 'no pace, no time');
});

test('row pace: per mile, per 100 yd for a swim, none under a mile', () => {
  assert.equal(rowPace(30.48, 'mi', 2 * 3600 + 28 * 60 + 48), '4:53 / mi');
  assert.equal(rowPace(13.11, 'mi', 1 * 3600 + 22 * 60 + 12), '6:16 / mi');
  assert.equal(rowPace(2125, 'yd', 47 * 60 + 29, true), '2:14 / 100 yd');
  assert.equal(rowPace(0.96, 'mi', 295), null, 'under a mile: no pace');
  assert.equal(rowPace(5, 'mi', 0), null);
});

test('the prerendered default state in content.html matches the calculator', () => {
  const e = equivalents(5000, 22 * 60);
  const rows = content.match(/<!--gen:projection-->([\s\S]*?)<!--\/gen:projection-->/)[1];
  assert.equal(rows, projectionRowsHtml(e.rows));
  assert.match(content, new RegExp(`id="benchmarkPace">${clock(e.paceMile)} / mi<`));
  assert.match(content, new RegExp(`id="benchmarkMetricPace">${clock(e.paceKm)} / km<`));
  const x = exactFinish(8 * 60, MILE, 10000);
  assert.match(content, new RegExp(`id="exactFinishTime">${clock(x.finish)}<`));
  assert.match(content, new RegExp(`id="exactConvertedPace">${clock(x.otherPace)} / ${x.otherLabel}<`));
  // default inputs: 5K, 0 h 22 min 0 s; 8:00 per mile, 10K
  assert.match(content, /id="benchmarkDistance">[\s\S]*?<option value="5000" selected>5K/);
  assert.match(content, /id="benchmarkMinutes"[^>]*value="22"/);
  assert.match(content, /id="exactPaceMinutes"[^>]*value="8"/);
  assert.match(content, /id="exactDistance">[\s\S]*?<option value="10000" selected>10K/);
});

test('every id the calculator reads exists in content.html, once', () => {
  for (const id of ['raceEquivalentCalculator', 'exactPaceCalculator', 'benchmarkDistance', 'benchmarkCustom', 'benchmarkDistanceValue',
    'benchmarkDistanceUnit', 'benchmarkHours', 'benchmarkMinutes', 'benchmarkSeconds', 'benchmarkPace', 'benchmarkMetricPace', 'projectionRows',
    'exactPaceMinutes', 'exactPaceSeconds', 'exactPaceUnit', 'exactDistance', 'exactCustom', 'exactDistanceValue', 'exactDistanceUnit',
    'exactFinishTime', 'exactConvertedPace']) {
    const n = (content.match(new RegExp(`\\sid="${id}"`, 'g')) || []).length;
    assert.equal(n, 1, `${id} appears ${n} times`);
  }
});

test('the Strava lookup covers exactly the race rows in the records', () => {
  const rows = allRaceRows(loadSnapshot());
  const keys = new Set(rows.map((r) => `${r.date}|${r.title}`));
  assert.equal(keys.size, rows.length, 'date|title identifies a row');
  for (const k of keys) assert.ok(RACE_ACTIVITIES.has(k), `no Strava activity for ${k}`);
  for (const k of RACE_ACTIVITIES.keys()) assert.ok(keys.has(k), `Strava entry without a race row: ${k}`);
  for (const [, [id]] of RACE_ACTIVITIES) assert.match(id, /^\d{7,12}$/);
});

test('mount() keeps its old no-argument interface and returns a cleanup', () => {
  assert.equal(typeof mount, 'function');
  assert.equal(mount.length, 0, 'the default argument keeps the call mount() valid');
});
