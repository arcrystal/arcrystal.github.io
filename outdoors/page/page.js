// Outdoors page module. The page is complete without it (both parts show, one after the other);
// this makes Hiking and Earth's Extremes two tabs, lights the 48 in the order they were climbed as
// the skyline scrolls by (static/site/skyline.js), and develops the plates from sepia as each comes
// into view.
import { skyline } from '/static/site/skyline.js';

// Two tabs over two panels. A link to anything inside a panel (the hero's index, an old fragment,
// Back and Forward) opens that panel first.
function tabs(main, scope, motion) {
  const list = main.querySelector('[data-o-tablist]');
  if (!list) return;
  const tabEls = [...list.querySelectorAll('[role="tab"]')];
  const panels = tabEls.map(t => main.querySelector(`#${t.getAttribute('aria-controls')}`));
  const panelOf = el => panels.find(p => p?.contains(el)) || null;
  function select(i, { focus = false, scroll = false } = {}) {
    tabEls.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
      panels[k].classList.toggle('is-shown', on);
    });
    if (focus) tabEls[i].focus();
    if (scroll && list.getBoundingClientRect().top < 0) list.scrollIntoView({ behavior: motion.paused ? 'auto' : 'smooth', block: 'start' });
  }
  const fromHash = () => {
    let el = null;
    try { el = location.hash ? main.querySelector(decodeURIComponent(location.hash)) : null; } catch (_) { el = null; }
    const p = el && panelOf(el);
    return p ? panels.indexOf(p) : -1;
  };
  list.hidden = false;
  select(Math.max(0, fromHash()));
  tabEls.forEach((t, i) => {
    scope.on(t, 'click', () => {
      select(i, { scroll: true });
      history.replaceState(history.state, '', `#${panels[i].id}`);
    });
    scope.on(t, 'keydown', e => {
      const n = tabEls.length;
      const k = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      select(k, { focus: true });
    });
  });
  // In-page links: open the panel before the browser scrolls to the target.
  scope.on(document, 'click', e => {
    const a = e.target.closest?.('a[href*="#"]');
    if (!a || a.pathname !== location.pathname) return;
    let el = null;
    try { el = a.hash ? main.querySelector(decodeURIComponent(a.hash)) : null; } catch (_) { el = null; }
    const p = el && panelOf(el);
    if (p && p.hidden) select(panels.indexOf(p));
  }, { capture: true });
  scope.on(window, 'hashchange', () => { const k = fromHash(); if (k >= 0) select(k); });
}

export function mount(main, ctx) {
  const { scope, motion } = ctx;
  tabs(main, scope, motion);
  const apis = [...main.querySelectorAll('[data-skyline]')].map(fig => skyline(fig, { scope, motion }));
  const plates = [...main.querySelectorAll('.o-plates li')];
  if ('IntersectionObserver' in window && !motion.paused) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.35 });
    plates.forEach(p => io.observe(p));
    scope.add(() => io.disconnect());
  } else plates.forEach(p => p.classList.add('is-in'));
  return { setMotion(paused) { apis.forEach(a => a?.setMotion?.(paused)); if (paused) plates.forEach(p => p.classList.add('is-in')); } };
}
