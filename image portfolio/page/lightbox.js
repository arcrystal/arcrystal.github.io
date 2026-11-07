// Photography lightbox. Every photograph on the page is a real link to its full-size file
// ([data-lightbox-item]); this enhances those links with a modal <dialog> viewer. It is keyboard
// operable (Enter opens; Left, Right, Home and End browse; Escape closes; Tab stays inside; focus
// returns to the photograph last viewed), announces each photograph, and removes everything it added
// through the page scope when the page unmounts.
import { announcement, counter, groupMembers, isPlainClick, keyAction, neighbours, step, swipe } from './lightbox-core.js';

export function createLightbox(root, scope) {
  const dialog = root.querySelector('#photoLightbox');
  const links = [...root.querySelectorAll('[data-lightbox-item]')];
  if (!dialog || typeof dialog.showModal !== 'function' || !links.length) return { close() {} };

  const image = dialog.querySelector('#lightboxImage');
  const caption = dialog.querySelector('#lightboxCaption');
  const count = dialog.querySelector('#lightboxCount');
  const status = dialog.querySelector('#lightboxStatus');
  const prevButton = dialog.querySelector('[data-lightbox-prev]');
  const nextButton = dialog.querySelector('[data-lightbox-next]');
  const closeButton = dialog.querySelector('[data-lightbox-close]');
  const stage = dialog.querySelector('.mt-lb-stage');
  const items = links.map((el) => ({ el, group: el.dataset.lightboxGroup || 'all' }));

  let members = [];
  let index = 0;
  let ticket = 0;

  const show = (next) => {
    index = next;
    const el = members[index].el;
    const text = el.dataset.caption || '';
    const mine = ++ticket;
    dialog.dataset.loading = 'true';
    image.alt = el.dataset.alt || text || 'Expanded photograph';
    image.onload = image.onerror = (event) => {
      if (mine !== ticket) return;
      delete dialog.dataset.loading;
      if (event.type === 'error') caption.textContent = `${text} (the photograph could not be loaded)`;
    };
    image.src = el.dataset.src || el.href;
    caption.textContent = text;
    count.textContent = counter(index, members.length);
    status.textContent = announcement(index, members.length, text);
    const single = members.length < 2;
    prevButton.hidden = nextButton.hidden = single;
    // Warm the neighbours so browsing feels immediate.
    for (const i of neighbours(index, members.length)) new Image().src = members[i].el.dataset.src || members[i].el.href;
  };

  const open = (opener) => {
    const item = items.find((x) => x.el === opener);
    const found = groupMembers(items, item);
    members = found.members;
    show(found.index);
    if (!dialog.open) dialog.showModal();
  };

  const move = (action) => {
    const next = step(action, index, members.length);
    if (next !== null) show(next);
  };

  scope.on(root, 'click', (event) => {
    const link = event.target.closest?.('[data-lightbox-item]');
    if (!link || !root.contains(link) || !isPlainClick(event)) return;
    event.preventDefault();
    open(link);
  });
  scope.on(prevButton, 'click', () => move('prev'));
  scope.on(nextButton, 'click', () => move('next'));
  scope.on(closeButton, 'click', () => dialog.close());
  scope.on(dialog, 'keydown', (event) => {
    const action = keyAction(event, { single: members.length < 2 });
    if (!action) return;
    if (action === 'close') return; // the dialog closes itself on Escape
    event.preventDefault();
    move(action);
  });
  // A click on the dark ground around the photograph closes the viewer.
  scope.on(dialog, 'click', (event) => {
    if (event.target === dialog || event.target === stage) dialog.close();
  });
  // Horizontal swipes browse on touch screens.
  let start = null;
  scope.on(stage, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    start = { x: event.clientX, y: event.clientY };
  });
  scope.on(stage, 'pointerup', (event) => {
    if (!start) return;
    const action = swipe(event.clientX - start.x, event.clientY - start.y);
    start = null;
    if (action) move(action);
  });
  scope.on(stage, 'pointercancel', () => { start = null; });
  scope.on(dialog, 'close', () => {
    ticket += 1;
    image.removeAttribute('src');
    delete dialog.dataset.loading;
    // Land on the photograph that was last viewed (focus would otherwise return to the first opener).
    const el = members[index]?.el;
    if (el && el.isConnected) el.focus({ preventScroll: false });
  });

  const close = () => { if (dialog.open) dialog.close(); };
  scope.add(close);
  return { close };
}
