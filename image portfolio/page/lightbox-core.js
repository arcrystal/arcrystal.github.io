// Mountains lightbox: the logic that does not need a DOM (tested with `node --test`, see
// tools/cinema/mountains/lightbox-core.test.mjs). lightbox.js binds it to the page's <dialog>.

/** Index into a ring of n items; works for negative steps. */
export function wrap(index, n) {
  if (!(n > 0)) return 0;
  return ((index % n) + n) % n;
}

/** Zero-padded counter text, "07 / 56". The padding follows the width of the total. */
export function counter(index, n) {
  const width = Math.max(2, String(n).length);
  return `${String(index + 1).padStart(width, '0')} / ${String(n).padStart(width, '0')}`;
}

/** Text announced to assistive technology when the photograph changes. */
export function announcement(index, n, caption) {
  return `Photograph ${index + 1} of ${n}${caption ? `: ${caption}` : ''}`;
}

/** The indexes worth preloading next to `index` (previous and next), without duplicates or itself. */
export function neighbours(index, n) {
  if (n < 2) return [];
  const out = [wrap(index + 1, n), wrap(index - 1, n)];
  return [...new Set(out)].filter((i) => i !== index);
}

/**
 * What a key press means inside the open viewer. `single` is true when the group has one photograph,
 * so navigation keys do nothing. Modified keys (Ctrl, Alt, Meta) are left to the browser.
 */
export function keyAction(event, { single = false } = {}) {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  switch (event.key) {
    case 'Escape': return 'close';
    case 'ArrowLeft': return single ? null : 'prev';
    case 'ArrowRight': return single ? null : 'next';
    case 'Home': return single ? null : 'first';
    case 'End': return single ? null : 'last';
    default: return null;
  }
}

/** Applies an action to the current index; returns the new index, or null when nothing changes. */
export function step(action, index, n) {
  if (n < 2) return null;
  switch (action) {
    case 'prev': return wrap(index - 1, n);
    case 'next': return wrap(index + 1, n);
    case 'first': return index === 0 ? null : 0;
    case 'last': return index === n - 1 ? null : n - 1;
    default: return null;
  }
}

/**
 * A horizontal swipe from a pointer or touch drag: 'next' for a leftward drag, 'prev' for a rightward
 * one. It must be long enough and clearly more horizontal than vertical, so scrolling is not mistaken
 * for a swipe.
 */
export function swipe(dx, dy, min = 48) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'prev';
}

/** The photographs that browse together: those sharing the opener's group, in page order. */
export function groupMembers(items, opener) {
  const group = opener.group;
  const members = items.filter((item) => item.group === group);
  return { group, members, index: Math.max(0, members.indexOf(opener)) };
}

/** True for a plain primary-button click; modified or middle clicks open the link normally. */
export function isPlainClick(event) {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
