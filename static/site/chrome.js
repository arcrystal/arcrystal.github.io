// The persistent header: the Motion control, the narrow-screen menu, the scrolled state that gives
// destination pages a frosted header, the polite announcer and toasts. Built once per document;
// the header is outside <main>, so it survives every in-page navigation. Without JavaScript the
// controls stay hidden and the menu is the visible link list.
import { motion } from './lib/util.js';

export function mountChrome({ scope }) {
  const root = document.documentElement;
  const header = document.getElementById('site-header');
  const toggle = document.querySelector('[data-motion-toggle]');
  const menuBtn = document.querySelector('[data-menu-toggle]');

  // Motion: aria-pressed true = motion on. The choice is remembered and overrides the operating
  // system preference either way.
  if (toggle) {
    toggle.hidden = false;
    const sync = () => toggle.setAttribute('aria-pressed', String(!motion.paused));
    sync();
    scope.on(toggle, 'click', () => motion.set(!motion.paused));
    scope.add(motion.subscribe(sync));
  }

  // The menu on narrow screens: a disclosure that closes on Escape, on a choice and on resize.
  function setMenu(open, { focus = false } = {}) {
    if (!menuBtn) return;
    if (open) root.dataset.menu = 'open'; else delete root.dataset.menu;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (!open && focus) menuBtn.focus();
  }
  if (menuBtn) {
    menuBtn.hidden = false;
    scope.on(menuBtn, 'click', () => setMenu(root.dataset.menu !== 'open'));
    scope.on(document, 'keydown', e => { if (e.key === 'Escape' && root.dataset.menu === 'open') setMenu(false, { focus: true }); });
    scope.on(header, 'click', e => { if (e.target.closest?.('.site-nav a')) setMenu(false); });
    scope.on(window, 'resize', () => { if (innerWidth >= 1100) setMenu(false); });
  }

  const scrolled = () => { if (scrollY > 24) root.dataset.scrolled = ''; else delete root.dataset.scrolled; };
  scrolled();
  scope.on(window, 'scroll', scrolled, { passive: true });

  const announcer = document.createElement('p');
  announcer.className = 'announcer';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  document.body.append(announcer);
  let announceTimer = 0;
  const announce = text => {
    announcer.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { announcer.textContent = text; }, 30);
  };

  let toastEl = null, toastTimer = 0;
  function toast(text, { action, label = 'Try again', ms = 9000 } = {}) {
    toastEl?.remove();
    clearTimeout(toastTimer);
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    const span = document.createElement('span');
    span.textContent = text;
    toastEl.append(span);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'control';
      b.textContent = label;
      b.addEventListener('click', () => { toastEl?.remove(); toastEl = null; action(); });
      toastEl.append(b);
    }
    document.body.append(toastEl);
    toastTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, ms);
    announce(text);
  }
  scope.add(() => { announcer.remove(); toastEl?.remove(); clearTimeout(toastTimer); clearTimeout(announceTimer); });
  return { announce, toast, closeMenu: () => setMenu(false) };
}
