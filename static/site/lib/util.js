// Shared helpers: math, a single animation loop, the motion preference, and scoped listeners.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// One requestAnimationFrame loop for everything that animates per frame.
const tickers = new Set();
let rafId = 0, last = 0;
function loop(t) {
  rafId = 0;
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
  last = t;
  for (const fn of [...tickers]) {
    try { fn(dt, t); } catch (err) { console.error(err); tickers.delete(fn); }
  }
  if (tickers.size) rafId = requestAnimationFrame(loop); else last = 0;
}
export function onTick(fn) {
  tickers.add(fn);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => tickers.delete(fn);
}

// Motion: on by default; paused only by the visitor's own choice (the header's Motion button).
const listeners = new Set();
function stored() { try { return localStorage.getItem('ac-motion'); } catch (_) { return null; } }
export const motion = {
  get paused() { return stored() === 'paused'; },
  set(paused) {
    try { localStorage.setItem('ac-motion', paused ? 'paused' : 'playing'); } catch (_) {}
    notify();
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
function notify() {
  document.documentElement.classList.toggle('motion-paused', motion.paused);
  listeners.forEach(fn => fn(motion.paused));
}
document.documentElement.classList.toggle('motion-paused', motion.paused);

// Live counts for leak checks.
export const stats = { scopes: 0, listeners: 0, loops: () => tickers.size };

// Listeners that are removed together when a page unmounts.
export function scope() {
  const ac = new AbortController();
  const cleanups = [];
  let listeners = 0, live = true;
  stats.scopes++;
  return {
    signal: ac.signal,
    on(target, type, fn, opts = {}) {
      if (!live) return;
      target.addEventListener(type, fn, { ...opts, signal: ac.signal });
      listeners++;
      stats.listeners++;
    },
    add(fn) { if (!fn) return; if (live) cleanups.push(fn); else { try { fn(); } catch (err) { console.error(err); } } },
    dispose() {
      if (!live) return;
      live = false;
      ac.abort();
      stats.listeners -= listeners;
      stats.scopes--;
      cleanups.splice(0).forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
    },
    get disposed() { return !live; },
  };
}

// Absolute URL for a path relative to the site root, whatever page we are on.
export const site = path => new URL(path, location.origin).href;
