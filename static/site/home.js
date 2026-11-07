// The homepage. The sentence's phrases open the six destinations: pointing at one (or at its facet
// of the crystal) fills the crystal with that world and swaps the fact beneath the sentence; on
// touch screens the crystal cycles through the worlds on its own. Below, one band per destination in
// its own style. The scene draws each band's world behind it and a seam where two styles meet, both
// in step with the page as it scrolls: nothing is pinned. Each band has one piece that shows
// something true (the Power Map strip, TRAPPIST-1, the Birkie at race pace, the 48, the prints, the
// board), and arrives as it scrolls in.
//
// Per frame this reads scrollY and writes only the header's ink (when the band under it changes)
// and the crystal's state; everything else is measured on resize.
import { onTick, clamp } from './lib/util.js';
import { approach, smoothstep } from './lerp.js';
import { getScene, STYLE_ID } from './scene/scene.js';
import { racePace } from './race-pace.js';
import { skyline } from './skyline.js';
import { powermap } from './powermap.js';
import { mountSims } from './sims.js';
import { playChess, loadRatings } from './previews.js';

const TAU = Math.PI * 2;
const CYCLE_MS = 5000;

export function mount(main, ctx) {
  const { scope, motion } = ctx;
  const root = document.documentElement;
  const header = document.getElementById('site-header');
  const hero = main.querySelector('[data-home-hero]');
  const phrases = [...main.querySelectorAll('.ph')];
  const bands = [...main.querySelectorAll('.band')];
  const order = (ctx.registry?.destinations || []).map(d => d.id);
  const facetOf = id => order.indexOf(id);
  const fact = main.querySelector('.hero-fact');
  const factK = fact?.querySelector('[data-fact-k]');
  const factT = fact?.querySelector('[data-fact-t]');
  const restK = factK?.textContent, restT = factT?.textContent;
  const apis = [];

  // ---- layout, measured on resize -------------------------------------------------------------
  let vw = 1, vh = 1, heroTop = 0, heroH = 0, headH = 64, crystal = [0, 0, 0], sections = [];
  const coarse = matchMedia('(pointer: coarse)');
  function measure() {
    vw = root.clientWidth; vh = innerHeight; headH = header?.offsetHeight || 64;
    const sy = scrollY;
    const hr = hero.getBoundingClientRect();
    heroTop = hr.top + sy; heroH = hr.height;
    // Beside the sentence on wide screens, above it on narrow ones (site.css .crystal matches).
    if (vw >= 900) crystal = [vw * 0.76, heroTop + heroH * 0.5, Math.min(vh * 0.3, vw * 0.17)];
    else {
      const r = Math.min(vw * 0.27, vh * 0.14);
      crystal = [vw * 0.5, heroTop + headH + 24 + r, r];
    }
    sections = bands.map(b => {
      const r = b.getBoundingClientRect();
      return { el: b, id: b.dataset.band, style: b.dataset.style, top: r.top + sy, h: r.height };
    });
  }
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(main);
  scope.add(() => ro.disconnect());
  scope.on(window, 'resize', measure);

  // ---- the sentence and the crystal --------------------------------------------------------------
  let world = -1, fill = 0, shown = -1, swapTimer = 0, cycleAt = 0, userTouched = false;
  function setFact(ph) {
    if (!fact) return;
    clearTimeout(swapTimer);
    fact.classList.add('is-swapping');
    swapTimer = setTimeout(() => {
      factK.textContent = ph ? ph.dataset.factK : restK;
      factT.textContent = ph ? ph.dataset.fact : restT;
      fact.classList.remove('is-swapping');
    }, 160);
  }
  function setWorld(k) {
    if (k === world) return;
    world = k;
    fill = Math.min(fill, 0.2);
    const ph = phrases.find(p => facetOf(p.dataset.world) === k) || null;
    phrases.forEach(p => p.classList.toggle('is-on', p === ph));
    setFact(ph);
  }
  phrases.forEach(p => {
    const k = () => facetOf(p.dataset.world);
    scope.on(p, 'pointerenter', () => { userTouched = true; setWorld(k()); });
    scope.on(p, 'focus', () => { userTouched = true; setWorld(k()); });
    scope.on(p, 'pointerleave', () => { if (!coarse.matches) setWorld(-1); });
    scope.on(p, 'blur', () => { if (!coarse.matches) setWorld(-1); });
    // On touch, the first tap shows the world and the second opens it.
    scope.on(p, 'click', e => {
      if (coarse.matches && world !== k()) { e.preventDefault(); userTouched = true; setWorld(k()); }
    });
  });

  // Facets: the gem has one face per destination, clockwise from the top.
  function facetAt(x, y) {
    const [cx, cy, r] = crystal;
    const dx = x - cx, dy = y - (cy - scrollY);
    const d = Math.hypot(dx, dy);
    if (d > r * 0.92 || d < r * 0.36) return -1;
    const n = order.length;
    const ang = (Math.atan2(dx, -dy) + TAU) % TAU;
    return Math.floor(ang / (TAU / n)) % n;
  }
  if (hero) {
    scope.on(hero, 'pointermove', e => {
      if (e.pointerType === 'touch' || e.target.closest('a, button')) return;
      const k = facetAt(e.clientX, e.clientY);
      hero.classList.toggle('is-facet', k >= 0);
      if (k >= 0) { userTouched = true; setWorld(k); }
    });
    scope.on(hero, 'pointerleave', () => { hero.classList.remove('is-facet'); if (!coarse.matches) setWorld(-1); });
    scope.on(hero, 'click', e => {
      if (e.target.closest('a, button')) return;
      const k = facetAt(e.clientX, e.clientY);
      const ph = phrases.find(p => facetOf(p.dataset.world) === k);
      ph?.click();
    });
  }

  // ---- the bands arrive as they scroll in ----------------------------------------------------------
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -18% 0px' });
    bands.forEach(b => io.observe(b));
    scope.add(() => io.disconnect());
  } else bands.forEach(b => b.classList.add('is-in'));

  // ---- each band's piece -------------------------------------------------------------------------
  const pieceCtx = { scope, motion };
  main.querySelectorAll('[data-pm]').forEach(el => apis.push(powermap(el, pieceCtx)));
  main.querySelectorAll('[data-race-pace]').forEach(el => apis.push(racePace(el, pieceCtx)));
  main.querySelectorAll('[data-skyline]').forEach(el => apis.push(skyline(el, pieceCtx)));
  mountSims(main, pieceCtx);

  // About Me: a picture of the project follows the pointer along its row.
  const peekRows = [...main.querySelectorAll('[data-preview]')];
  if (peekRows.length && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const peek = document.createElement('div');
    peek.className = 'ab-peek';
    peek.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.alt = '';
    peek.append(img);
    document.body.append(peek);
    scope.add(() => peek.remove());
    let px = 0, py = 0, tx = 0, ty = 0, on = false, stopPeek = null;
    const follow = dt => {
      const k = 1 - Math.exp(-dt / 0.09);
      px += (tx - px) * k; py += (ty - py) * k;
      peek.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      if (!on && Math.abs(tx - px) < 0.5) { stopPeek?.(); stopPeek = null; }
    };
    peekRows.forEach(row => {
      scope.on(row, 'pointerenter', e => {
        img.src = row.dataset.preview;
        tx = px = e.clientX + 28; ty = py = e.clientY - 120;
        on = true; peek.classList.add('is-on');
        if (!stopPeek && !motion.paused) stopPeek = onTick(follow);
      });
      scope.on(row, 'pointermove', e => { tx = e.clientX + 28; ty = e.clientY - 120; if (motion.paused) follow(1); });
      scope.on(row, 'pointerleave', () => { on = false; peek.classList.remove('is-on'); });
    });
    scope.add(() => stopPeek?.());
  }

  // Photography: each print develops when it reaches the middle of the reel; a mouse can drag it.
  const reel = main.querySelector('[data-reel]');
  if (reel) {
    const prints = [...reel.querySelectorAll('.dr-print')];
    if ('IntersectionObserver' in window && !motion.paused) {
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-developed'); io.unobserve(e.target); }
      }), { root: reel, rootMargin: '0px -22% 0px -22%', threshold: 0.5 });
      // The reel's own viewport only counts once the reel is on screen.
      const outer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { prints.forEach(p => io.observe(p)); outer.disconnect(); }
      }, { threshold: 0.35 });
      outer.observe(reel);
      scope.add(() => { io.disconnect(); outer.disconnect(); });
    } else prints.forEach(p => p.classList.add('is-developed'));
    let dragX = null, startLeft = 0;
    scope.on(reel, 'pointerdown', e => { if (e.pointerType !== 'mouse') return; dragX = e.clientX; startLeft = reel.scrollLeft; });
    scope.on(window, 'pointermove', e => { if (dragX !== null) reel.scrollLeft = startLeft - (e.clientX - dragX); });
    scope.on(window, 'pointerup', () => { dragX = null; });
    scope.on(reel, 'dragstart', e => e.preventDefault());
  }

  // Chess: the Scotch plays while the band is in view; the ratings are read once.
  const board = main.querySelector('.band--chess [data-pv="chess"]');
  if (board) {
    let run = null, rated = false;
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) {
        if (!rated) { rated = true; loadRatings(board.closest('.band'), scope); }
        if (!run && !motion.paused) run = playChess(board);
      } else { run?.stop(); run = null; }
    }), { threshold: 0.3 });
    io.observe(board);
    scope.add(() => { io.disconnect(); run?.stop(); });
    apis.push({ setMotion(paused) { if (paused) { run?.stop(); run = null; } } });
  }

  // ---- header ink: the ink of whatever passes under it ---------------------------------------------
  const inks = Object.fromEntries(Object.entries(ctx.styles?.styles || {}).map(([k, s]) => [k, s.colors.ink]));
  let headInk = null;
  function headerInk(sy) {
    const y = sy + headH / 2;
    let style = 'house';
    for (const s of sections) if (y >= s.top && y < s.top + s.h) { style = s.style; break; }
    const ink = inks[style] || null;
    if (ink === headInk) return;
    headInk = ink;
    if (style === 'house') header?.style.removeProperty('--l-ink'); else header?.style.setProperty('--l-ink', ink);
  }
  scope.add(() => header?.style.removeProperty('--l-ink'));

  // ---- the scene: the hero's crystal, each band's world and the seams ------------------------------
  const scene = getScene();
  let lastY = scrollY, vel = 0;
  function frame(dt) {
    const sy = scrollY;
    vel = approach(vel, (sy - lastY) / Math.max(dt, 1 / 120) / Math.max(vh, 1), dt, 0.12);
    lastY = sy;
    headerInk(sy);
    // The crystal fills toward the world in hand, and empties when nothing is.
    fill = motion.paused ? (world >= 0 ? 1 : 0) : approach(fill, world >= 0 ? 1 : 0, dt, 0.22);
    if (world >= 0) shown = world;
    else if (fill < 0.01) shown = -1;
    // Touch screens: the crystal tours the worlds by itself until someone picks one.
    if (coarse.matches && !userTouched && !motion.paused && sy < heroTop + heroH * 0.6) {
      cycleAt += dt * 1000;
      if (cycleAt > CYCLE_MS) { cycleAt = 0; setWorld((world + 1) % order.length); }
    }
  }
  if (scene) {
    // The hero: paper, and the crystal.
    scope.add(scene.add({
      update(dt) {
        frame(dt);
        const y = heroTop - scrollY;
        if (y + heroH <= 0 || y >= vh) return null;
        return { region: [0, y, vw, heroH], mode: 7, a: 0, crystal: [crystal[0], crystal[1] - scrollY, crystal[2]],
          hover: shown, e: smoothstep(fill), vel: clamp(vel, -3, 3) };
      },
    }));
    // Each band's world.
    bands.forEach((b, i) => scope.add(scene.add({
      update() {
        const s = sections[i];
        if (!s) return null;
        const y = s.top - scrollY;
        if (y + s.h <= 0 || y >= vh) return null;
        return { region: [0, y, vw, s.h], mode: 0, a: STYLE_ID[s.style] ?? 0, vel: clamp(vel, -3, 3) };
      },
    })));
    // A seam where two styles meet: a band of the screen straddling the boundary, drawn over both.
    // h is where the boundary is on screen (0 at the top, 1 at the bottom); the seam leans with it.
    bands.forEach((b, i) => {
      if (i === 0) return;
      scope.add(scene.add({
        update() {
          const a = sections[i - 1], c = sections[i];
          if (!a || !c || a.style === c.style) return null;
          const S = Math.min(vh * 0.56, 520);
          const by = c.top - scrollY;
          const y = by - S / 2;
          if (y + S <= 0 || y >= vh) return null;
          return { region: [0, y, vw, S], card: [0, y, vw, S], mode: 6, a: STYLE_ID[a.style] ?? 0, b: STYLE_ID[c.style] ?? 0,
            h: clamp(by / vh), vel: clamp(vel, -3, 3) };
        },
      }));
    });
  } else {
    scope.add(onTick(frame));
  }

  return {
    unmount() { clearTimeout(swapTimer); phrases.forEach(p => p.classList.remove('is-on')); },
    setMotion(paused) { apis.forEach(api => api?.setMotion?.(paused)); },
  };
}
