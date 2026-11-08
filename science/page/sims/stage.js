// The canvas every Science experiment draws on: sized to its figure (device pixels capped at 1.5),
// animated only while the figure is on screen and the tab is visible, frozen on one frame under
// reduced motion, and gone without a trace on destroy().
export function stage(el, draw, { reducedMotion = false, onPointer } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, raf = 0, visible = false, t = 0, last = 0, dead = false;
  const pointer = { x: 0, y: 0, on: false, down: false };

  const size = () => {
    const r = el.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reducedMotion || !raf) frame(performance.now(), true);
  };
  const frame = (now, once = false) => {
    if (dead) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!reducedMotion) t += dt;
    draw(ctx, w, h, t, reducedMotion ? 0 : dt, pointer);
    if (!once && visible && !reducedMotion && !document.hidden) raf = requestAnimationFrame(frame);
    else raf = 0;
  };
  const wake = () => { if (!raf && visible && !reducedMotion && !document.hidden && !dead) { last = 0; raf = requestAnimationFrame(frame); } };

  const ro = new ResizeObserver(size);
  ro.observe(el);
  const io = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); wake(); });
  io.observe(el);
  const onVis = () => wake();
  document.addEventListener('visibilitychange', onVis);
  const move = e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = true;
    onPointer?.(e.type, pointer, w, h);
    if (reducedMotion) frame(performance.now(), true);
  };
  const down = e => { pointer.down = true; move(e); };
  const up = () => { pointer.down = false; };
  const leave = () => { pointer.on = false; pointer.down = false; onPointer?.('leave', pointer, w, h); };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', down);
  addEventListener('pointerup', up);
  canvas.addEventListener('pointerleave', leave);
  size();

  return {
    canvas,
    redraw() { frame(performance.now(), true); },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointerup', up);
      canvas.remove();
    },
  };
}

export const COLORS = { ink: '#ECE9FF', mute: '#A29FC9', cyan: '#22E6FF', magenta: '#FF3DCB', violet: '#B9A6FF', gold: '#FFC46B', rule: 'rgba(185,166,255,0.22)' };
export const MONO = '500 11px "JetBrains Mono", ui-monospace, monospace';
