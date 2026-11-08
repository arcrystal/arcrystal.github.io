// node --test tools/site/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrap, counter, announcement, neighbours, keyAction, step, swipe, groupMembers, isPlainClick }
  from '../../../image portfolio/page/lightbox-core.js';

test('wrap keeps indexes in the ring, including negatives', () => {
  assert.equal(wrap(0, 56), 0);
  assert.equal(wrap(56, 56), 0);
  assert.equal(wrap(-1, 56), 55);
  assert.equal(wrap(-57, 56), 55);
  assert.equal(wrap(3, 0), 0);
});

test('counter pads to the width of the total', () => {
  assert.equal(counter(0, 56), '01 / 56');
  assert.equal(counter(22, 56), '23 / 56');
  assert.equal(counter(55, 56), '56 / 56');
  assert.equal(counter(0, 5), '01 / 05');
  assert.equal(counter(99, 120), '100 / 120');
});

test('announcement reads naturally, with or without a caption', () => {
  assert.equal(announcement(22, 56, 'Vietnam · 2024'), 'Photograph 23 of 56: Vietnam · 2024');
  assert.equal(announcement(0, 3, ''), 'Photograph 1 of 3');
});

test('neighbours are the previous and next photographs, never the current one', () => {
  assert.deepEqual(neighbours(5, 56).sort((a, b) => a - b), [4, 6]);
  assert.deepEqual(neighbours(0, 56).sort((a, b) => a - b), [1, 55]);
  assert.deepEqual(neighbours(55, 56).sort((a, b) => a - b), [0, 54]);
  assert.deepEqual(neighbours(0, 2), [1]);
  assert.deepEqual(neighbours(0, 1), []);
});

test('keyAction maps keys, ignores modified keys, and does nothing to navigation in a single-photograph group', () => {
  assert.equal(keyAction({ key: 'ArrowRight' }), 'next');
  assert.equal(keyAction({ key: 'ArrowLeft' }), 'prev');
  assert.equal(keyAction({ key: 'Home' }), 'first');
  assert.equal(keyAction({ key: 'End' }), 'last');
  assert.equal(keyAction({ key: 'Escape' }), 'close');
  assert.equal(keyAction({ key: 'ArrowRight', altKey: true }), null);
  assert.equal(keyAction({ key: 'ArrowLeft', metaKey: true }), null);
  assert.equal(keyAction({ key: 'ArrowRight' }, { single: true }), null);
  assert.equal(keyAction({ key: 'Escape' }, { single: true }), 'close');
  assert.equal(keyAction({ key: 'a' }), null);
});

test('step wraps, jumps, and reports no change', () => {
  assert.equal(step('next', 55, 56), 0);
  assert.equal(step('prev', 0, 56), 55);
  assert.equal(step('first', 10, 56), 0);
  assert.equal(step('first', 0, 56), null);
  assert.equal(step('last', 10, 56), 55);
  assert.equal(step('last', 55, 56), null);
  assert.equal(step('next', 0, 1), null);
  assert.equal(step('bogus', 3, 56), null);
});

test('swipe needs distance and a mostly horizontal drag', () => {
  assert.equal(swipe(-80, 5), 'next');
  assert.equal(swipe(80, -5), 'prev');
  assert.equal(swipe(-30, 0), null);
  assert.equal(swipe(-80, 70), null);
  assert.equal(swipe(10, 120), null);
  assert.equal(swipe(-60, 30, 80), null);
});

test('groupMembers keeps only the opener\'s group, in page order', () => {
  const items = [
    { group: 'selected', id: 'a' }, { group: 'album', id: 'b' }, { group: 'selected', id: 'c' },
    { group: 'album', id: 'd' }, { group: 'album', id: 'e' },
  ];
  const r = groupMembers(items, items[3]);
  assert.equal(r.group, 'album');
  assert.deepEqual(r.members.map((m) => m.id), ['b', 'd', 'e']);
  assert.equal(r.index, 1);
  assert.equal(groupMembers(items, items[0]).index, 0);
});

test('only a plain primary click is intercepted', () => {
  assert.equal(isPlainClick({ button: 0 }), true);
  assert.equal(isPlainClick({ button: 1 }), false);
  assert.equal(isPlainClick({ button: 0, ctrlKey: true }), false);
  assert.equal(isPlainClick({ button: 0, metaKey: true }), false);
  assert.equal(isPlainClick({ button: 0, shiftKey: true }), false);
});
