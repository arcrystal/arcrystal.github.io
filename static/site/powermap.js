// The AI Power Map as one strip of ticks, a tick per dated moment from 2021 to 2026 (the builder's
// powermap_strip()). The ticks draw in left to right when the strip scrolls into view; pointing
// along it reads the moment under the pointer. Used by the homepage's About Me band and About Me.

export function powermap(el, { scope, motion }) {
  let events = [];
  try { events = JSON.parse(el.dataset.pmEvents || '[]'); } catch (_) { return null; }
  const svg = el.querySelector('.pm-strip');
  const rects = [...svg.querySelectorAll('rect')];
  const xs = rects.map(r => Number(r.getAttribute('x')));
  const date = el.querySelector('[data-pm-date]');
  const title = el.querySelector('[data-pm-title]');
  const restDate = date?.textContent, restTitle = title?.textContent;
  let hot = null;

  rects.forEach((r, i) => r.style.setProperty('--d', String(Math.round(i * 5))));
  if (motion.paused || !('IntersectionObserver' in window)) el.classList.add('is-drawn');
  else {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { el.classList.add('is-drawn'); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    scope.add(() => io.disconnect());
  }

  const pick = clientX => {
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 1000;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    if (hot !== rects[best]) {
      hot?.classList.remove('is-hot');
      hot = rects[best];
      hot.classList.add('is-hot');
      const [d, t] = events[best] || [];
      if (date) date.textContent = d || '';
      if (title) title.textContent = t || '';
    }
  };
  scope.on(svg, 'pointermove', e => pick(e.clientX));
  scope.on(svg, 'pointerdown', e => pick(e.clientX));
  scope.on(svg, 'pointerleave', () => {
    hot?.classList.remove('is-hot');
    hot = null;
    if (date) date.textContent = restDate;
    if (title) title.textContent = restTitle;
  });
  return null;
}
