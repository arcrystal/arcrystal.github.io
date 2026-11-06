// node --test tools/site/tests/*.test.mjs    The homepage style blend (static/site/lerp.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHex, toOklab, oklabCss, compile, blend, holdEase, pairAt, crossfade, COLORS,
} from '../../../static/site/lerp.js';

const { order, styles } = JSON.parse(readFileSync(new URL('../../../static/site/styles.json', import.meta.url), 'utf8'));
const compiled = Object.fromEntries(order.map(id => [id, compile(styles[id])]));

test('hex parsing, with and without alpha', () => {
  assert.deepEqual(parseHex('#FF0000'), [1, 0, 0, 1]);
  assert.deepEqual(parseHex('#00000080').map(v => Number(v.toFixed(3))), [0, 0, 0, 0.502]);
  assert.throws(() => parseHex('red'));
});

test('OKLab reference points', () => {
  const [L0] = toOklab('#000000');
  const [L1, a1, b1] = toOklab('#FFFFFF');
  assert.ok(Math.abs(L0) < 1e-6);
  assert.ok(Math.abs(L1 - 1) < 1e-4 && Math.abs(a1) < 1e-4 && Math.abs(b1) < 1e-4);
  assert.equal(oklabCss([0.5, 0.1, -0.1, 1]), 'oklab(0.5 0.1 -0.1)');
  assert.equal(oklabCss([0.5, 0, 0, 0.25]), 'oklab(0.5 0 0 / 0.25)');
});

test('every style compiles, and a blend at 0 and 1 reproduces its ends', () => {
  for (const id of order) assert.equal(Object.keys(compiled[id].colors).length, Object.keys(COLORS).length);
  const a = compiled.sumi, b = compiled.glass;
  assert.deepEqual(blend(a, b, 0), blend(a, a, 0.7));
  assert.deepEqual(blend(a, b, 1), blend(b, b, 0.2));
  const mid = blend(a, b, 0.5);
  assert.match(mid['--p-radius'], /^[\d.]+% [\d.]+% [\d.]+% [\d.]+% \/ [\d.]+% [\d.]+% [\d.]+% [\d.]+%$/);
  assert.match(mid['--p-shadow'], /^-?[\d.]+px -?[\d.]+px [\d.]+px -?[\d.]+px$/);
  assert.equal(mid['--p-blur'], '12px');
});

test('the mix is clamped', () => {
  assert.deepEqual(blend(compiled.neon, compiled.folio, -2), blend(compiled.neon, compiled.folio, 0));
  assert.deepEqual(blend(compiled.neon, compiled.folio, 9), blend(compiled.neon, compiled.folio, 1));
});

test('hold zones keep each tile pure for most of its scroll', () => {
  assert.equal(holdEase(0), 0);
  assert.equal(holdEase(0.3), 0);
  assert.equal(holdEase(0.5), 0.5);
  assert.equal(holdEase(0.7), 1);
  assert.equal(holdEase(1), 1);
  for (let x = 0; x < 1; x += 0.05) assert.ok(holdEase(x + 0.05) >= holdEase(x));
});

test('pairs along the sequence', () => {
  assert.deepEqual(pairAt(-1, 7), { i: 0, j: 1, frac: 0 });
  assert.deepEqual(pairAt(2.25, 7), { i: 2, j: 3, frac: 0.25 });
  assert.deepEqual(pairAt(6, 7), { i: 5, j: 6, frac: 1 });
  assert.deepEqual(pairAt(99, 7), { i: 5, j: 6, frac: 1 });
});

test('crossfade never shows both tiles at once', () => {
  for (let t = 0; t <= 1; t += 0.01) {
    const { out, in: inn } = crossfade(t);
    assert.ok(out === 0 || inn === 0, `t=${t}`);
  }
  assert.deepEqual(crossfade(0), { out: 1, in: 0 });
  assert.deepEqual(crossfade(1), { out: 0, in: 1 });
});
