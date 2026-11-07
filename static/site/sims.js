// The Science experiments (science/page/sims/*.js), wherever a figure names one with data-sim and the
// builder found its module (data-src). Each mounts when it first nears the viewport and is destroyed
// with the page; until then, and if it fails, the figure keeps its still.
export function mountSims(root, { scope, motion }) {
  const figs = [...root.querySelectorAll('[data-sim][data-src]')];
  if (!figs.length) return;
  const live = new Map();
  const start = async fig => {
    if (live.has(fig)) return;
    live.set(fig, null);
    try {
      const mod = await import(fig.dataset.src);
      if (scope.disposed) return;
      const api = mod.mount(fig, { reducedMotion: motion.paused, compact: fig.hasAttribute('data-sim-compact') });
      live.set(fig, api);
      fig.classList.add('is-live');
    } catch (err) { console.error(`${fig.dataset.sim} did not start:`, err); }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { start(e.target); io.unobserve(e.target); } }), { rootMargin: '200px 0px' });
    figs.forEach(f => io.observe(f));
    scope.add(() => io.disconnect());
  } else figs.forEach(start);
  scope.add(() => live.forEach(api => { try { api?.destroy?.(); } catch (err) { console.error(err); } }));
}
