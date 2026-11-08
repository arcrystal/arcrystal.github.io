// The 48 four-thousand footers, lit in the order I climbed them. The count follows the figure's
// progress through the viewport (from document offsets measured on resize, so a scroll reads only
// scrollY); hovering a peak names it. With motion paused all 48 show lit. Used by the homepage's
// Outdoors band and the Outdoors page.
import { clamp } from './lib/util.js';

const fmt = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function skyline(fig, { scope, motion }) {
  const peaks = [...fig.querySelectorAll('.sk-peak')].sort((a, b) => a.dataset.i - b.dataset.i);
  if (!peaks.length) return null;
  const n = fig.querySelector('[data-sk-n]');
  const name = fig.querySelector('[data-sk-peak]');
  const when = fig.querySelector('[data-sk-date]');
  let lit = -1, top = 0, height = 0, vh = innerHeight, hover = null;

  const read = (count, peak) => {
    if (n) n.textContent = String(count);
    if (!peak) return;
    if (name) name.textContent = `${peak.dataset.name} · ${peak.dataset.ft} ft`;
    if (when) when.textContent = `${fmt(peak.dataset.date)} · ${peak.dataset.hike}`;
  };
  const set = count => {
    if (count === lit) return;
    lit = count;
    peaks.forEach((p, i) => { p.classList.toggle('is-lit', i < count); p.classList.toggle('is-now', i === count - 1); });
    if (!hover) read(count, peaks[Math.max(0, count - 1)]);
  };
  const measure = () => {
    const r = fig.getBoundingClientRect();
    top = r.top + scrollY; height = r.height; vh = innerHeight;
  };
  // From the figure's top at 90% of the viewport to its bottom at 45%.
  const onScroll = () => {
    if (motion.paused) return set(peaks.length);
    const x = clamp((scrollY + vh * 0.9 - top) / (height + vh * 0.45));
    set(Math.round(x * peaks.length));
  };
  measure();
  onScroll();
  scope.on(window, 'scroll', onScroll, { passive: true });
  scope.on(window, 'resize', () => { measure(); onScroll(); });
  const ro = new ResizeObserver(() => { measure(); onScroll(); });
  ro.observe(document.body);
  scope.add(() => ro.disconnect());
  scope.on(fig, 'pointerover', e => {
    const p = e.target.closest?.('.sk-peak');
    if (!p) return;
    hover = p;
    read(Number(p.dataset.i) + 1, p);
  });
  scope.on(fig, 'pointerleave', () => { hover = null; read(lit, peaks[Math.max(0, lit - 1)]); });
  return { setMotion() { lit = -1; onScroll(); } };
}
