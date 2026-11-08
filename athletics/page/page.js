// Racing page module (CONTRACT section 2). The page is complete without it; this adds the pace
// calculator (athletics/calculator.js), plays the Birkie at race pace (static/site/race-pace.js),
// filters the list of every race by sport, opens the disclosure a fragment points into, and sends
// old hiking fragments on to Outdoors, where hiking now lives. Every listener, observer and timer
// goes through ctx.scope, so unmount leaves nothing behind.
import { mount as mountTools } from '../calculator.js';
import { racePace } from '/static/site/race-pace.js';

// Fragments of the old hiking section, which moved to Outdoors.
const OUTDOORS = new Set(['hikes', 'panel-hikes', 'tab-hikes', 'ultra-8', 'panel-ultra-8', 'tab-ultra-8', 'ultraEightList', 'nh-48', 'panel-nh-48', 'tab-nh-48']);

export async function mount(main, ctx) {
  const { scope } = ctx;
  const hash = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } })();
  if (OUTDOORS.has(hash)) {
    const to = `/outdoors/#${hash === 'ultra-8' || hash.includes('ultra') ? 'ultra-8' : 'forty-eight'}`;
    if (ctx.go) ctx.go(to); else location.replace(to);
    return null;
  }
  scope.add(mountTools(main));
  const pace = [...main.querySelectorAll('[data-race-pace]')].map(fig => racePace(fig, { scope, motion: ctx.motion }));
  filters(main, scope);

  // A fragment that names something inside a closed disclosure (#calculator, #raceList, #nh-48 ...)
  // opens it. Old ids arrive as empty .frag-alias anchors placed before their replacement.
  const fragment = () => {
    try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
  };
  const openFor = () => {
    const id = fragment();
    if (!id) return;
    let el = main.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!el) return;
    if (el.classList.contains('frag-alias') && el.nextElementSibling) el = el.nextElementSibling;
    let changed = false;
    for (let node = el; node && node !== main; node = node.parentElement) {
      if (node.tagName === 'DETAILS' && !node.open) { node.open = true; changed = true; }
    }
    if (changed) el.scrollIntoView({ block: 'start' });
  };
  openFor();
  scope.on(window, 'hashchange', openFor);

  // Distance bars grow in as they enter the viewport; with motion paused, or without
  // IntersectionObserver, they simply show at full length.
  const bars = [...main.querySelectorAll('.r-bar')];
  let io = null;
  const settle = () => {
    io?.disconnect();
    io = null;
    main.classList.remove('r-motion');
    bars.forEach((b) => b.classList.remove('is-in'));
  };
  const arm = () => {
    if (io || ctx.motion?.paused || !('IntersectionObserver' in window) || !bars.length) return;
    main.classList.add('r-motion');
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.2 });
    bars.forEach((b) => io.observe(b));
  };
  arm();
  scope.add(settle);

  return {
    unmount() { settle(); },
    setMotion(paused) { pace.forEach(p => p?.setMotion?.(paused)); if (paused) settle(); else arm(); },
  };
}

// Every race, filterable by sport: one chip per sport with its count, plus All.
function filters(main, scope) {
  const bar = main.querySelector('[data-race-filters]');
  const list = main.querySelector('[data-races]');
  if (!bar || !list) return;
  const rows = [...list.querySelectorAll('.r-race')];
  const labels = Object.fromEntries([...main.querySelectorAll('[data-sport-label]')].map(el => [el.dataset.sportLabel, el.textContent]));
  const counts = rows.reduce((m, r) => ((m[r.dataset.sport] = (m[r.dataset.sport] || 0) + 1), m), {});
  const make = (key, text, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'r-chip';
    b.dataset.sport = key;
    b.setAttribute('aria-pressed', String(key === 'all'));
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = text;
    b.lastChild.textContent = String(n);
    return b;
  };
  bar.append(make('all', 'All', rows.length), ...Object.keys(labels).filter(k => counts[k]).map(k => make(k, labels[k], counts[k])));
  bar.hidden = false;
  scope.on(bar, 'click', e => {
    const b = e.target.closest('.r-chip');
    if (!b) return;
    const key = b.dataset.sport;
    bar.querySelectorAll('.r-chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    rows.forEach(r => { r.hidden = key !== 'all' && r.dataset.sport !== key; });
    ctxAnnounce(main, `${key === 'all' ? rows.length : counts[key]} races`);
  });
}

function ctxAnnounce(main, text) {
  const live = main.querySelector('[data-races-live]');
  if (live) live.textContent = text;
}
