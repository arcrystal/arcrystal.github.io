// The homepage stage. The five tiles share one pinned viewport; scrolling through the stage moves
// a continuous position p from tile to tile, and every frame the two styles in view are blended
// (lerp.js): page and panel colours, the panel's corners, border, outline, shadow, blur and tilt,
// the backdrop and ornament weights, and the crossfade of the tile texts. Each tile holds its own
// style for most of its scroll (holdEase), so a style is something you arrive in, not only pass.
// The blended values go on <body> as custom properties; site.css reads them.
import { motion } from './lib/util.js';
import { compile, blend, holdEase, pairAt, crossfade, smoothstep } from './lerp.js';
import { mountPreviews } from './previews.js';

const TEXT_SHIFT = 36;   // px a tile's text travels as it fades

export function mount(main, ctx) {
  const stage = main.querySelector('[data-stage]');
  if (!stage || !ctx.styles) return null;
  const { scope } = ctx;
  const body = document.body;
  const pin = stage.querySelector('.stage-pin');
  const tiles = [...stage.querySelectorAll('.tile')];
  const n = tiles.length;
  const seq = ['house', ...tiles.map(t => t.dataset.style), 'house'];
  const compiled = seq.map(id => compile(ctx.styles.styles[id]));
  const backdrops = [...stage.querySelectorAll('[data-bd]')];
  const rail = [...stage.querySelectorAll('.rail a')];
  const counter = stage.querySelector('[data-count-now]');
  const previews = mountPreviews(stage, ctx);

  let top = 0, vh = 1, run = 1, frame = 0, active = -1, warmed = false;
  const written = new Map();
  const put = (prop, value) => {
    if (written.get(prop) === value) return;
    written.set(prop, value);
    body.style.setProperty(prop, value);
  };

  function measure() {
    vh = pin.clientHeight || innerHeight;
    top = stage.getBoundingClientRect().top + scrollY;
    run = Math.max(1, stage.offsetHeight - vh);
  }

  // Scroll → p in [-1, n]: -1 while the stage rises into view (house → first style), 0..n-1 while
  // it is pinned, n as it leaves (last style → house).
  function positionAt(y) {
    const rel = y - top;
    if (rel < 0) return -1 + smoothstep(1 + rel / vh);
    if (rel > run) return (n - 1) + smoothstep((rel - run) / vh);
    return (rel / run) * (n - 1);
  }
  const yOf = k => top + (run / (n - 1)) * k;

  function update() {
    frame = 0;
    const p = positionAt(scrollY);
    const s = p + 1;
    const { i, j, frac } = pairAt(s, seq.length);
    const inner = i >= 1 && j <= seq.length - 2;
    const t = inner ? holdEase(frac) : frac;
    for (const [prop, value] of Object.entries(blend(compiled[i], compiled[j], t))) put(prop, value);

    // Weights of the styles in view: backdrops and panel ornaments.
    const weights = {};
    weights[seq[i]] = (weights[seq[i]] || 0) + (1 - t);
    weights[seq[j]] = (weights[seq[j]] || 0) + t;
    for (const bd of backdrops) {
      const w = weights[bd.dataset.bd] || 0;
      put(`--w-${bd.dataset.bd}`, w.toFixed(3));
      bd.classList.toggle('is-on', w > 0.002);
    }

    // Tile texts: the outgoing one fades out before the incoming one fades in.
    const fade = crossfade(t);
    tiles.forEach((tile, k) => {
      let o = 0, y = 0;
      if (k === i - 1) { o = inner ? fade.out : 1; y = inner ? -TEXT_SHIFT * (1 - fade.out) : 0; }
      if (k === j - 1) { o = inner ? fade.in : 1; y = inner ? TEXT_SHIFT * (1 - fade.in) : 0; }
      const key = `o${k}`;
      const value = `${o.toFixed(3)}|${y.toFixed(1)}`;
      if (written.get(key) !== value) {
        written.set(key, value);
        tile.style.setProperty('--o', o.toFixed(3));
        tile.style.setProperty('--y', `${y.toFixed(1)}px`);
      }
    });

    const now = Math.max(0, Math.min(n - 1, t >= 0.5 ? j - 1 : i - 1));
    if (now !== active) activate(now);
    if (!warmed && p > -0.6) { warmed = true; previews.warm(); }
  }

  function activate(k) {
    const prev = active;
    active = k;
    tiles.forEach((tile, idx) => tile.classList.toggle('is-active', idx === k));
    rail.forEach((a, idx) => (idx === k ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    if (counter) counter.textContent = String(k + 1).padStart(2, '0');
    if (prev >= 0) previews.deactivate(tiles[prev]);
    previews.activate(tiles[k]);
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const jump = (k, smooth = !motion.paused) => scrollTo({ top: Math.round(yOf(k)), behavior: smooth ? 'smooth' : 'instant' });

  measure();
  update();
  scope.on(window, 'scroll', schedule, { passive: true });
  scope.on(window, 'resize', () => { measure(); schedule(); });
  if (document.fonts?.ready) document.fonts.ready.then(() => { if (!scope.disposed) { measure(); schedule(); } });

  // Jump links (hero index, rail) and keyboard focus land on a tile's own position.
  main.querySelectorAll('[data-jump]').forEach(a => scope.on(a, 'click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    jump(Number(a.dataset.jump));
    tiles[Number(a.dataset.jump)]?.querySelector('.tile-link')?.focus({ preventScroll: true });
  }));
  scope.on(stage, 'focusin', e => {
    const tile = e.target.closest?.('.tile');
    if (!tile) return;
    const k = tiles.indexOf(tile);
    if (k !== active || Math.abs(scrollY - yOf(k)) > vh * 0.3) jump(k, false);
  });

  return {
    unmount() {
      cancelAnimationFrame(frame);
      previews.destroy();
      for (const prop of written.keys()) if (prop.startsWith('--')) body.style.removeProperty(prop);
    },
    // The panel's current rectangle: where an expand starts and a return lands.
    panelRect: () => stage.querySelector('.stage-frame .panel')?.getBoundingClientRect() || null,
  };
}
