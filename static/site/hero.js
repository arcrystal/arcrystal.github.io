// A destination page's scene and arrival. The scene draws the page's room behind its hero and the
// next room behind the "Next" card, only while each is on screen. The hero arrives (.is-in runs
// its letters and lines through --in, styles/*.css) when the page loads or, after an expand, as the
// effect starts to uncover it. The Racing route draws when it scrolls into view.
import { motion } from './lib/util.js';
import { getScene, STYLE_ID } from './scene/scene.js';

export function mount(main, ctx) {
  const { scope } = ctx;
  const hero = main.querySelector('[data-hero]');
  const start = () => { if (!scope.disposed) hero?.classList.add('is-in'); };
  if (document.documentElement.dataset.xp) scope.on(document, 'xp:reveal', start, { once: true });
  else requestAnimationFrame(start);

  const routes = [...main.querySelectorAll('.r-route-svg')];
  if (routes.length && 'IntersectionObserver' in window && !motion.paused) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-drawn'); io.unobserve(e.target); }
    }), { threshold: 0.4 });
    routes.forEach(r => io.observe(r));
    scope.add(() => io.disconnect());
  }

  const scene = getScene();
  if (scene) {
    // Document offsets, measured on resize; per frame only scrollY is read.
    const next = main.querySelector('.d-next');
    const areas = [
      { el: hero, style: STYLE_ID[main.dataset.style], top: 0, h: 0 },
      { el: next, style: STYLE_ID[next?.dataset.style], top: 0, h: 0 },
    ].filter(a => a.el && a.style != null && a.style !== 0);
    let vw = 0;
    const measure = () => { vw = document.documentElement.clientWidth; areas.forEach(a => { const r = a.el.getBoundingClientRect(); a.top = r.top + scrollY; a.h = r.height; }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    scope.add(() => ro.disconnect());
    scope.on(window, 'resize', measure);
    areas.forEach(a => {
      const stop = scene.add({
        update() {
          const y = a.top - scrollY;
          if (y + a.h <= 0 || y >= innerHeight) return null;
          return { region: [0, y, vw, a.h], mode: 0, a: a.style };
        },
      });
      scope.add(stop);
    });
  }
  return { unmount() { hero?.classList.remove('is-in'); } };
}
