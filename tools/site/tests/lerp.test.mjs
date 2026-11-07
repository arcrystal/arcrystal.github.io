// node --test tools/site/tests/*.test.mjs    The stage's motion maths (static/site/lerp.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHex, toOklab, oklabCss, mixOklab, handoff, pairAt, exitOf, enterOf, OUT_END, IN_START, HOLD,
  approach, settleTarget, glideMs, smoothstep, easeInOutCubic,
} from '../../../static/site/lerp.js';

const { order, styles } = JSON.parse(readFileSync(new URL('../../../static/site/styles.json', import.meta.url), 'utf8'));

test('hex parsing, with and without alpha', () => {
  assert.deepEqual(parseHex('#FF0000'), [1, 0, 0, 1]);
  assert.deepEqual(parseHex('#00000080').map(v => Number(v.toFixed(3))), [0, 0, 0, 0.502]);
  assert.throws(() => parseHex('red'));
});

test('OKLab reference points and the mix', () => {
  const [L0] = toOklab('#000000');
  const [L1, a1, b1] = toOklab('#FFFFFF');
  assert.ok(Math.abs(L0) < 1e-6);
  assert.ok(Math.abs(L1 - 1) < 1e-4 && Math.abs(a1) < 1e-4 && Math.abs(b1) < 1e-4);
  assert.equal(oklabCss([0.5, 0.1, -0.1, 1]), 'oklab(0.5 0.1 -0.1)');
  assert.equal(oklabCss([0.5, 0, 0, 0.25]), 'oklab(0.5 0 0 / 0.25)');
  const ink = toOklab(styles.ink.colors.ink), neon = toOklab(styles.neon.colors.ink);
  assert.equal(mixOklab(ink, neon, 0), oklabCss(ink));
  assert.equal(mixOklab(ink, neon, 1), oklabCss(neon));
  assert.equal(mixOklab(ink, neon, 7), oklabCss(neon));
});

test('every style has the six colours and a scene id', () => {
  const ids = new Set();
  for (const id of order) {
    for (const key of ['bg', 'surface', 'ink', 'mute', 'accent', 'rule']) assert.ok(styles[id].colors[key], `${id}.${key}`);
    assert.ok(Number.isInteger(styles[id].scene));
    ids.add(styles[id].scene);
  }
  assert.equal(ids.size, order.length);
  assert.equal(styles.house.scene, 0);
});

test('each tile holds its style before and after the handoff', () => {
  assert.equal(handoff(0), 0);
  assert.equal(handoff(HOLD / 2), 0);
  assert.equal(handoff(0.5), 0.5);
  assert.equal(handoff(1 - HOLD / 2), 1);
  assert.equal(handoff(1), 1);
  for (let x = 0; x < 1; x += 0.02) assert.ok(handoff(x + 0.02) >= handoff(x));
});

test('pairs along the sequence', () => {
  assert.deepEqual(pairAt(-1, 7), { i: 0, j: 1, frac: 0 });
  assert.deepEqual(pairAt(2.25, 7), { i: 2, j: 3, frac: 0.25 });
  assert.deepEqual(pairAt(6, 7), { i: 5, j: 6, frac: 1 });
  assert.deepEqual(pairAt(99, 7), { i: 5, j: 6, frac: 1 });
});

test('the titles overlap: the screen is never without one', () => {
  assert.ok(IN_START < OUT_END);
  assert.equal(exitOf(0), 0);
  assert.equal(exitOf(OUT_END), 1);
  assert.equal(enterOf(IN_START), 0);
  assert.equal(enterOf(1), 1);
  for (let h = 0; h <= 1.0001; h += 0.01) {
    // With the per-letter stagger (site.css), a title shows letters while its progress is inside (0, 1).
    const outgoingShows = exitOf(h) < 1, incomingShows = enterOf(h) > 0;
    assert.ok(outgoingShows || incomingShows, `h=${h.toFixed(2)}`);
  }
});

test('the visible position approaches the target, independent of frame rate', () => {
  assert.equal(approach(0, 1, 0.016, 0), 1);
  let a = 0, b = 0;
  for (let k = 0; k < 60; k++) a = approach(a, 1, 1 / 60, 0.11);
  for (let k = 0; k < 30; k++) b = approach(b, 1, 1 / 30, 0.11);
  assert.ok(Math.abs(a - b) < 1e-3, `${a} vs ${b}`);
  assert.ok(a > 0.99);
  let c = 0;
  for (let k = 0; k < 6; k++) c = approach(c, 1, 1 / 60, 0.11);
  assert.ok(c > 0.4 && c < 0.7, `after 100 ms: ${c}`);
  assert.equal(approach(0.99995, 1, 1 / 60, 0.11), 1);
});

test('settling: inside a handoff the stage glides to the nearer tile, never from a hold', () => {
  assert.equal(settleTarget(0, 5), null);
  assert.equal(settleTarget(1 + HOLD / 2 - 0.01, 5), null);
  assert.equal(settleTarget(1.4, 5), 1);
  assert.equal(settleTarget(1.6, 5), 2);
  assert.equal(settleTarget(3.9, 5), null);
  assert.equal(settleTarget(-1, 5), null);
  assert.equal(settleTarget(-0.3, 5), 0);
  assert.equal(settleTarget(-0.8, 5), null);
  assert.equal(settleTarget(4.5, 5), null);
});

test('jumps glide longer the further they go, within limits', () => {
  assert.equal(glideMs(0), 450);
  assert.equal(glideMs(1), 700);
  assert.equal(glideMs(-2), 950);
  assert.equal(glideMs(10), 1400);
});

test('eases', () => {
  assert.equal(smoothstep(-1), 0);
  assert.equal(smoothstep(2), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
});
