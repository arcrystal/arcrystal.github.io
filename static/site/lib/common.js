// Behaviour shared by every page: tab systems, footer year, local time and scroll reveals.
// Mounted per route on the given root; everything is released when the scope ends.
import { motion } from './util.js';

// options.hashScroll: also bring a tab chosen by the URL fragment into view at mount. Off by
// default: the router places fragments (and history positions) itself once the page has mounted.
export function mountCommon(root, scope, { hashScroll = false } = {}) {
  root.querySelectorAll('[data-tabs]').forEach(system => mountTabs(system, scope, hashScroll));
  // Only the footer's year: destinations may use data-year for their own markup (a timeline's dates).
  document.querySelectorAll('.site-foot [data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });
  const time = root.querySelector('[data-local-time]');
  if (time) {
    const fmt = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const tick = () => { time.textContent = fmt.format(new Date()); };
    tick();
    const id = setInterval(tick, 30000);
    scope.add(() => clearInterval(id));
  }
  mountReveals(root, scope);
}

// Reveals fade in as they enter the view; with motion paused they are simply visible, including
// when the visitor pauses motion after the page has mounted.
function mountReveals(root, scope) {
  const reveals = [...root.querySelectorAll('.reveal')];
  if (!reveals.length) return;
  const showAll = () => reveals.forEach(n => n.classList.add('is-visible'));
  let io = null;
  if (!('IntersectionObserver' in window) || motion.paused) showAll();
  else {
    io = new IntersectionObserver((entries, obs) => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
    }), { threshold: 0.13, rootMargin: '0px 0px -40px' });
    reveals.forEach(n => io.observe(n));
    scope.add(() => io.disconnect());
  }
  scope.add(motion.subscribe(paused => { if (paused) { io?.disconnect(); showAll(); } }));
}


// ARIA tabs: [data-tabs] > .tab-list > [role=tab][data-tab], panels [data-tab-panel] as direct
// children. A URL fragment selects a tab by name, or the panel holding the element or nested tab
// it names (#calculator, #nh-48, #panel-hikes), on arrival and on every hashchange. Systems
// marked data-hash-tabs also write the chosen tab into the fragment.
function mountTabs(system, scope, hashScroll) {
  const tabList = [...system.children].find(c => c.matches?.('.tab-list'));
  if (!tabList) return;
  const tabs = [...tabList.querySelectorAll(':scope > [role="tab"][data-tab]')];
  const panels = [...system.children].filter(c => c.matches?.('[data-tab-panel]'));
  const fallback = system.dataset.defaultTab || tabs[0]?.dataset.tab;
  const writesHash = system.hasAttribute('data-hash-tabs');
  const activate = (requested, { focus = false, writeHash = writesHash } = {}) => {
    const name = tabs.some(t => t.dataset.tab === requested) ? requested : fallback;
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach(p => { const on = p.dataset.tabPanel === name; p.hidden = !on; p.setAttribute('aria-hidden', String(!on)); });
    if (writeHash) history.replaceState(history.state, '', `#${name}`);
  };
  const fragment = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (_) { return ''; } };
  function fromHash() {
    const id = fragment();
    if (!id) return null;
    if (tabs.some(t => t.dataset.tab === id)) return id;
    const el = document.getElementById(id);
    const sel = `[role="tab"][data-tab="${CSS.escape(id)}"]`;
    const panel = panels.find(p => (el && p.contains(el)) || p.querySelector(sel));
    return panel ? panel.dataset.tabPanel : null;
  }
  // The named element when it exists and shows, otherwise the whole tab system.
  function reveal(smooth) {
    const el = document.getElementById(fragment());
    const target = el && system.contains(el) && el.getClientRects().length ? el : system;
    target.scrollIntoView({ block: 'start', behavior: smooth && !motion.paused ? 'smooth' : 'instant' });
  }
  tabs.forEach((tab, i) => {
    scope.on(tab, 'click', () => activate(tab.dataset.tab));
    scope.on(tab, 'keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      let n = i;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabs.length - 1;
      activate(tabs[n].dataset.tab, { focus: true });
    });
  });
  const initial = fromHash();
  activate(initial || fallback, { writeHash: false });
  if (initial && hashScroll) reveal(false);
  // In-page links such as "#calculator" (left to the browser by the router) open their tab.
  scope.on(window, 'hashchange', () => {
    const name = fromHash();
    if (!name) return;
    activate(name, { writeHash: false });
    reveal(true);
  });
}
