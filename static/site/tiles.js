// The homepage stage. Five tiles share one pinned viewport. Scrolling sets a target position p
// (-1 on the hero, 0..4 on the tiles, 5 past the stage); the visible position chases it with an
// exponential approach, so the stage glides rather than steps. From the visible position, every
// frame:
//   - the scene draws the two rooms in view and the handoff between them (scene/), or, before the
//     shader is ready and without WebGL, the CSS backdrops crossfade;
//   - the two tiles in view get their progress, --in and --out (0..1), from which CSS moves the
//     letters and the card in each style's manner;
//   - the header, rail and counter inks mix in OKLab.
// Only these few elements are written to, never <body>, so a frame restyles a few dozen elements.
// When scrolling stops inside a handoff the stage glides on to the nearer tile; jumps glide too.
import { motion, onTick } from './lib/util.js';
import {
  toOklab, mixOklab, pairAt, handoff, smoothstep, approach, exitOf, enterOf, settleTarget, glideMs, easeInOutCubic,
} from './lerp.js';
import { mountPreviews } from './previews.js';
import { getScene, STYLE_ID } from './scene/scene.js';

const TAU = { wheel: 0.11, touch: 0.06, key: 0.09, glide: 0.035 };
const IDLE_MS = 180;
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar']);
const SECTOR = (Math.PI * 2) / 5;
// html[data-hold] turns settling off (the screenshot tools park the stage mid-handoff).
const root = document.documentElement;

export function mount(main, ctx) {
  const stage = main.querySelector('[data-stage]');
  if (!stage || !ctx.styles) return null;
  const { scope } = ctx;
  const pin = stage.querySelector('.stage-pin');
  const tiles = [...stage.querySelectorAll('.tile')];
  const n = tiles.length;
  const seq = ['house', ...tiles.map(t => t.dataset.style), 'house'];
  const tones = seq.map(id => {
    const c = ctx.styles.styles[id].colors;
    return { ink: toOklab(c.ink), mute: toOklab(c.mute), accent: toOklab(c.accent) };
  });
  const header = document.querySelector('.site-header');
  const rail = stage.querySelector('.rail');
  const railLinks = [...stage.querySelectorAll('.rail a')];
  const count = stage.querySelector('.stage-count');
  const counter = stage.querySelector('[data-count-now]');
  const backdrops = [...stage.querySelectorAll('[data-bd]')];
  const hero = main.querySelector('.hero');
  const index = [...main.querySelectorAll('.hero-index a')];
  const previews = mountPreviews(stage, ctx);
  const scene = getScene();

  // ---- geometry (measured on resize only; nothing is read per frame) ------------------------
  let top = 0, vw = 1, vh = 1, run = 1, cards = [], crystal = [0, 0, 0];
  function measure() {
    vw = document.documentElement.clientWidth;
    vh = pin.clientHeight || innerHeight;
    const sr = stage.getBoundingClientRect();
    top = sr.top + scrollY;
    run = Math.max(1, stage.offsetHeight - vh);
    const pr = pin.getBoundingClientRect();
    cards = tiles.map(t => {
      const r = t.querySelector('.tile-stage').getBoundingClientRect();
      const w = Math.min(r.width, r.height * 0.8), h = w * 1.25;
      return [r.left + (r.width - w) / 2, r.top - pr.top + (r.height - h) / 2, w, h];
    });
    // Beside the hero text on wide screens; above it on narrow ones (site.css .crystal matches).
    if (vw >= 900) crystal = [vw * 0.735, vh * 0.5, Math.min(vh * 0.31, vw * 0.19)];
    else {
      const r = Math.min(vw * 0.27, vh * 0.14);
      crystal = [vw * 0.5, (header?.offsetHeight || 64) + 24 + r, r];
    }
  }
  // The crystal scrolls with the hero until the dive begins (on wide screens it begins at once).
  const crystalNow = (y = scrollY) => [crystal[0], crystal[1] - Math.min(y, Math.max(0, top - vh)), crystal[2]];

  // Scroll → p: one screen of hero before the stage, SEGMENT screens per handoff, one screen out.
  function positionAt(y) {
    const rel = y - top;
    if (rel < 0) return -1 + Math.max(0, 1 + rel / vh);
    if (rel > run) return (n - 1) + Math.min(1, (rel - run) / vh);
    return (rel / run) * (n - 1);
  }
  const yOf = k => (k < 0 ? 0 : top + (run / (n - 1)) * k);

  // ---- input and smoothing ----------------------------------------------------------------
  let target = 0, view = 0, vel = 0, kind = 'wheel', lastInput = 0, lastScroll = 0, touching = false, glide = null;
  const now = () => performance.now();
  function input(k) { kind = k; lastInput = now(); glide = null; }
  scope.on(window, 'wheel', () => input('wheel'), { passive: true });
  scope.on(window, 'touchstart', () => { touching = true; input('touch'); }, { passive: true });
  scope.on(window, 'touchend', () => { touching = false; lastInput = now(); }, { passive: true });
  scope.on(window, 'touchcancel', () => { touching = false; }, { passive: true });
  scope.on(window, 'pointerdown', e => { if (e.pointerType !== 'touch') input(kind); }, { passive: true });
  scope.on(window, 'keydown', e => { if (SCROLL_KEYS.has(e.key)) input('key'); });
  scope.on(window, 'scroll', () => { target = positionAt(scrollY); lastScroll = now(); }, { passive: true });

  function glideTo(k) {
    const to = Math.round(yOf(k));
    if (Math.abs(to - scrollY) < 2) return;
    if (motion.paused) { scrollTo({ top: to, behavior: 'instant' }); return; }
    glide = { from: scrollY, to, t0: now(), ms: glideMs(positionAt(to) - positionAt(scrollY)) };
  }

  // ---- writes, each only when its value changes ------------------------------------------
  const last = new Map();
  const put = (el, prop, value) => {
    const key = el === header ? `h${prop}` : el === rail ? `r${prop}` : el === count ? `c${prop}` : null;
    if (key && last.get(key) === value) return;
    if (key) last.set(key, value);
    el.style.setProperty(prop, value);
  };
  const tileState = tiles.map(t => ({ near: null, inV: '', outV: '', v: '', text: t.querySelector('.tile-text'), card: t.querySelector('.tile-card') }));

  let active = -1, warmed = false, hover = -1;
  function activate(k) {
    const prev = active;
    active = k;
    tiles.forEach((tile, idx) => tile.classList.toggle('is-active', idx === k));
    railLinks.forEach((a, idx) => (idx === k ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    if (counter) counter.textContent = String(k + 1).padStart(2, '0');
    if (prev >= 0) previews.deactivate(tiles[prev]);
    if (shown) previews.activate(tiles[k]);
  }
  // Previews play only once the stage is on screen; the hero's scroll cue rests once it is not.
  let shown = false;
  function reveal(on) {
    if (on === shown) return;
    shown = on;
    root.toggleAttribute('data-stage-on', on);
    if (on && active >= 0) previews.activate(tiles[active]);
    if (!on && active >= 0) previews.deactivate(tiles[active]);
  }

  function update(dt) {
    const t = now();
    const sy = scrollY;   // read before any write, so nothing forces a layout
    if (glide) {
      const x = Math.min(1, (t - glide.t0) / glide.ms);
      const y = glide.from + (glide.to - glide.from) * easeInOutCubic(x);
      scrollTo({ top: y, behavior: 'instant' });
      target = positionAt(y);
      if (x >= 1) glide = null;
    } else if (!touching && t - lastScroll > IDLE_MS && t - lastInput > IDLE_MS && Math.abs(view - target) < 0.003 && !root.hasAttribute('data-hold')) {
      const k = settleTarget(target, n);
      if (k !== null) glideTo(k);
    }
    const prev = view;
    view = approach(view, target, dt, motion.paused ? 0 : TAU[glide ? 'glide' : kind]);
    vel += ((dt > 0 ? (view - prev) / dt : 0) - vel) * 0.3;

    const { i, j, frac } = pairAt(view + 1, seq.length);
    const inner = i >= 1 && j <= n;
    const h = inner ? handoff(frac) : i === 0 ? frac : smoothstep(frac);

    // Tiles: the outgoing one leaves, the incoming one arrives; the others are hidden.
    // Quantised, so a steady scroll does not restyle the text every frame.
    const skew = (Math.round(Math.max(-3, Math.min(3, vel)) * 2) / 2).toFixed(1);
    tiles.forEach((tile, k) => {
      const st = tileState[k];
      let near = false, vin = 0, vout = 0;
      if (k === i - 1) { near = true; vin = 1; vout = exitOf(h); }
      if (k === j - 1) { near = true; vin = enterOf(h); vout = 0; }
      if (near !== st.near) { st.near = near; tile.classList.toggle('is-near', near); }
      if (!near) return;
      const a = vin.toFixed(3), b = vout.toFixed(3);
      if (a !== st.inV) { st.inV = a; st.text.style.setProperty('--in', a); st.card.style.setProperty('--cin', a); }
      if (b !== st.outV) { st.outV = b; st.text.style.setProperty('--out', b); st.card.style.setProperty('--cout', b); }
      if (skew !== st.v) { st.v = skew; st.text.style.setProperty('--v', skew); }
    });
    const nowTile = Math.max(0, Math.min(n - 1, h < 0.5 ? i - 1 : j - 1));
    if (nowTile !== active) activate(nowTile);
    if (!warmed && view > -0.6) { warmed = true; previews.warm(); }
    reveal(view > -0.4 && view < n - 0.4);

    // Inks of the frame around the stage.
    // In 24 steps per handoff: finer than the eye follows, and most frames write nothing.
    const ta = tones[i], tb = tones[j], hq = Math.round(h * 24) / 24;
    if (header) put(header, '--l-ink', mixOklab(ta.ink, tb.ink, hq));
    if (rail) { put(rail, '--l-ink', mixOklab(ta.ink, tb.ink, hq)); put(rail, '--l-accent', mixOklab(ta.accent, tb.accent, hq)); }
    if (count) put(count, '--l-mute', mixOklab(ta.mute, tb.mute, hq));

    // The CSS backdrops, while the canvas is not drawing: the incoming one wipes up over the
    // outgoing one (a crossfade where motion is paused), never a blend of the two.
    if (!scene?.ready) {
      const paused = motion.paused;
      backdrops.forEach(bd => {
        const style = bd.dataset.bd, out = seq[i] === style, inc = seq[j] === style && h > 0.002;
        const on = (out && h < 0.998) || inc;
        bd.classList.toggle('is-on', on);
        if (!on) return;
        bd.style.zIndex = inc ? '1' : '0';
        bd.style.opacity = inc && paused ? h.toFixed(3) : '1';
        bd.style.clipPath = inc && !paused ? `inset(${((1 - h) * 100).toFixed(2)}% 0 0 0)` : 'none';
      });
    }

    if (view >= n) return null;
    // The glacier card is glass: the scene draws it while that tile is in view and still.
    const g = seq.indexOf('glass');
    let card = null, cardMix = 0;
    if (i === g || j === g) {
      card = cards[g - 1];
      cardMix = i === g ? 1 - smoothstep(h / 0.35) : smoothstep((h - 0.65) / 0.35);
    }
    return {
      region: [0, 0, vw, vh],
      mode: 1, a: STYLE_ID[seq[i]], b: STYLE_ID[seq[j]], h, vel,
      card, cardR: 28, cardMix, crystal: crystalNow(sy), hover: view < -0.5 ? hover : -1,
    };
  }

  // ---- the crystal: hovering a facet (or its index link) lights it; clicking one goes there ---
  function facetAt(x, y) {
    const [cx, cy, r] = crystalNow();
    const dx = x - cx, dy = y - cy;
    const a = Math.atan2(dx, -dy);
    const ang = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const k = Math.floor(ang / SECTOR);
    const phi = (k + 0.5) * SECTOR;
    const dn = dx * Math.sin(phi) - dy * Math.cos(phi);
    const apo = r * 0.809;
    return dn < apo && dn > apo * 0.42 ? k : -1;
  }
  if (hero) {
    scope.on(hero, 'pointermove', e => {
      if (e.pointerType === 'touch' || view > -0.5) return;
      hover = e.target.closest('a, button') ? hover : facetAt(e.clientX, e.clientY);
      hero.classList.toggle('is-facet', hover >= 0);
    }, { passive: true });
    scope.on(hero, 'pointerleave', () => { hover = -1; hero.classList.remove('is-facet'); });
    scope.on(hero, 'click', e => {
      if (e.target.closest('a, button') || view > -0.5) return;
      const k = facetAt(e.clientX, e.clientY);
      if (k >= 0) glideTo(k);
    });
  }
  index.forEach((a, k) => {
    scope.on(a, 'pointerenter', () => { hover = k; });
    scope.on(a, 'pointerleave', () => { hover = -1; });
  });

  // ---- jumps: hero index, rail, keyboard focus -------------------------------------------
  main.querySelectorAll('[data-jump]').forEach(a => scope.on(a, 'click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const k = Number(a.dataset.jump);
    glideTo(k);
    tiles[k]?.querySelector('.tile-link')?.focus({ preventScroll: true });
  }));
  scope.on(stage, 'focusin', e => {
    const tile = e.target.closest?.('.tile');
    if (!tile) return;
    const k = tiles.indexOf(tile);
    if (k !== active || Math.abs(scrollY - yOf(k)) > vh * 0.3) glideTo(k);
  });

  measure();
  target = view = positionAt(scrollY);
  const ro = new ResizeObserver(() => { measure(); target = positionAt(scrollY); });
  ro.observe(stage);
  scope.add(() => ro.disconnect());
  scope.on(window, 'resize', () => { measure(); target = positionAt(scrollY); });
  if (document.fonts?.ready) document.fonts.ready.then(() => { if (!scope.disposed) measure(); });

  // The scene drives the frame loop when there is one; otherwise the stage runs its own.
  const host = { update };
  const stop = scene ? scene.add(host) : onTick(dt => { update(dt); });
  update(0);

  return {
    unmount() {
      stop();
      root.removeAttribute('data-stage-on');
      previews.destroy();
      for (const el of [header, rail, count]) ['--l-ink', '--l-accent', '--l-mute'].forEach(p => el?.style.removeProperty(p));
    },
    // The resting card of the tile in view: where an expand starts and a return lands.
    card: () => tiles[Math.max(0, active)]?.querySelector('.tile-card') || null,
    panelRect: () => tiles[Math.max(0, active)]?.querySelector('.tile-card')?.getBoundingClientRect() || null,
  };
}
