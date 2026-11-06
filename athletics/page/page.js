// Racing page module (CONTRACT section 2). The page is complete without it; this adds the pace
// calculator and the race-row enhancements (athletics/calculator.js), opens the disclosure a
// fragment points into, and reveals the distance bars as they scroll into view. Every listener,
// observer and timer goes through ctx.scope, so unmount leaves nothing behind.
import { mount as mountTools } from '../calculator.js';

export async function mount(main, ctx) {
  const { scope } = ctx;
  scope.add(mountTools(main));

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
    setMotion(paused) { if (paused) settle(); else arm(); },
  };
}
