// Outdoors page module. The page is complete without it; this lights the 48 in the order they were
// climbed as the skyline scrolls by (static/site/skyline.js), and develops the plates from sepia as
// each comes into view.
import { skyline } from '/static/site/skyline.js';

export function mount(main, ctx) {
  const { scope, motion } = ctx;
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
