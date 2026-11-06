// A destination page's arrival: the hero's style animation starts (.is-in) when the page loads, or,
// after an expand, as the effect starts to uncover it. Neon titles decode; the Racing route draws
// when it scrolls into view. With motion paused everything is simply in place.
import { motion } from './lib/util.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/\\=';

export function mount(main, ctx) {
  const { scope } = ctx;
  const hero = main.querySelector('[data-hero]');
  const start = () => {
    if (scope.disposed || !hero) return;
    hero.classList.add('is-in');
    if (!motion.paused && main.dataset.style === 'neon') decode(hero.querySelector('[data-title-fx]'), scope);
  };
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
  return { unmount() { hero?.classList.remove('is-in'); } };
}

// The title resolves left to right out of random glyphs. Screen readers get the real text
// throughout (a visually hidden copy); the scrambled layer is aria-hidden.
function decode(el, scope) {
  if (!el) return;
  const text = el.textContent;
  el.innerHTML = '';
  const real = document.createElement('span');
  real.className = 'sr-only';
  real.textContent = text;
  const fx = document.createElement('span');
  fx.setAttribute('aria-hidden', 'true');
  el.append(real, fx);
  const t0 = performance.now(), ms = 900;
  let raf = 0;
  const tick = now => {
    const x = Math.min(1, (now - t0) / ms);
    const fixed = Math.floor(x * text.length);
    fx.textContent = [...text].map((ch, i) => (i < fixed || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (x < 1) raf = requestAnimationFrame(tick);
    else el.textContent = text;
  };
  raf = requestAnimationFrame(tick);
  scope.add(() => { cancelAnimationFrame(raf); el.textContent = text; });
}
