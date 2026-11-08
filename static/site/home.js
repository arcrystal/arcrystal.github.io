// The homepage. The sentence's phrases open the six destinations: pointing at one (or at its facet
// of the crystal) fills the crystal with that world and swaps the fact beneath the sentence; on
// touch screens the crystal cycles through the worlds on its own. Below, one band per destination in
// its own style. The scene draws each band's world behind it and a seam where two styles meet. With
// motion on, each seam has a stretch of page of its own (its hold): the seam fills the screen and
// stays put while the scroll plays its transit, then lets go of the next band. Each band has one piece that shows
// something true (the Power Map strip, TRAPPIST-1, the Birkie at race pace, the 48, the prints, the
// board), and arrives as it scrolls in.
//
// Per frame this reads scrollY and writes only the header's ink (when the band under it changes)
// and the crystal's state; everything else is measured on resize.
import { onTick, clamp } from './lib/util.js';
import { approach, smoothstep, HOLD, holdAt, holdFor, holdEase } from './lerp.js';
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
  // The holds (lerp.js HOLD): screens of scroll during which a seam's transit plays with the seam
  // held full screen. They are sized on a steady screen height, so a phone's toolbar sliding in and
  // out doesn't move the page.
  const holds = new Map();   // band index → its hold, just above it
  let holdVh = 0, holdVw = 0;
  function measure() {
    vw = root.clientWidth; vh = innerHeight; headH = header?.offsetHeight || 64;
    if (!holdVh || vw !== holdVw || Math.abs(vh - holdVh) > 140) { holdVh = vh; holdVw = vw; }
    const pin = coarse.matches || vw < 700 ? HOLD.pinTouch : HOLD.pin;
    // Some transitions take longer (lerp.js HOLD.by: the vortex into Science).
    holds.forEach(el => {
      const h = `${Math.round(holdVh * (1 + pin * holdFor(el.dataset.to).pin))}px`;
      if (el.style.height !== h) el.style.height = h;
    });
    const sy = scrollY;
    const hr = hero.getBoundingClientRect();
    heroTop = hr.top + sy; heroH = hr.height;
    // Beside the sentence on wide screens, above it on narrow ones (site.css .crystal matches).
    if (vw >= 900) crystal = [vw * 0.76, heroTop + heroH * 0.5, Math.min(vh * 0.3, vw * 0.17)];
    else {
      const r = Math.min(vw * 0.27, vh * 0.14);
      crystal = [vw * 0.5, heroTop + headH + 24 + r, r];
    }
    sections = bands.map((b, i) => {
      const r = b.getBoundingClientRect();
      const hr = holds.get(i)?.getBoundingClientRect();
      return { el: b, id: b.dataset.band, style: b.dataset.style, top: r.top + sy, h: r.height, seam: 0,
        hold: hr ? { top: hr.top + sy, h: hr.height } : null };
    });
    // Without a hold (motion paused), each seam straddles the boundary on the band below it: tall
    // enough to read, never more than most of the shorter band beside it.
    sections.forEach((s, i) => {
      const a = sections[i - 1];
      s.seam = a && a.style !== s.style && !s.hold ? Math.min(vh * 0.85, 820, 0.9 * Math.min(a.h, s.h)) : 0;
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
  // When each arrived: its world's sheen sweeps across once (ARRIVE_MS).
  const arrived = new Map();
  const ARRIVE_MS = 1600;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); arrived.set(e.target, performance.now()); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -18% 0px' });
    bands.forEach(b => io.observe(b));
    scope.add(() => io.disconnect());
  } else bands.forEach(b => b.classList.add('is-in'));

  // ---- each band's information panel ----------------------------------------------------------------
  // A native popover (popovertarget) where supported; elsewhere a click toggles it, and a click
  // outside or Escape closes it.
  if (!('popover' in HTMLElement.prototype)) {
    const close = () => main.querySelectorAll('.band-algo.is-open').forEach(p => {
      p.classList.remove('is-open');
      main.querySelector(`[popovertarget="${p.id}"]`)?.setAttribute('aria-expanded', 'false');
    });
    main.querySelectorAll('[data-band-info]').forEach(b => {
      const panel = main.querySelector(`#${b.getAttribute('popovertarget')}`);
      b.setAttribute('aria-expanded', 'false');
      scope.on(b, 'click', e => {
        e.stopPropagation();
        const open = !panel.classList.contains('is-open');
        close();
        panel.classList.toggle('is-open', open);
        b.setAttribute('aria-expanded', String(open));
      });
    });
    scope.on(document, 'click', e => { if (!e.target.closest?.('.band-algo')) close(); });
    scope.on(document, 'keydown', e => { if (e.key === 'Escape') close(); });
  }

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
    for (const [i, s] of sections.entries()) {
      if (y >= s.top && y < s.top + s.h) { style = s.style; break; }
      // In a hold, the world that has more of the screen.
      if (s.hold && y >= s.hold.top && y < s.hold.top + s.hold.h) { style = y < s.hold.top + s.hold.h / 2 ? sections[i - 1].style : s.style; break; }
    }
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
        // The seams above and below draw their halves of the band, so the band leaves them out.
        const cutTop = s.seam / 2, cutBot = (sections[i + 1]?.seam ?? 0) / 2;   // 0 beside a hold
        const y = s.top - scrollY + cutTop, h = s.h - cutTop - cutBot;
        if (h <= 0 || y + h <= 0 || y >= vh) return null;
        const at = arrived.get(b);
        const e = at && !motion.paused ? clamp((performance.now() - at) / ARRIVE_MS) : 0;
        return { region: [0, y, vw, h], mode: 0, a: STYLE_ID[s.style] ?? 0, vel: clamp(vel, -3, 3), e: e < 1 ? e : 0 };
      },
    })));
    // A seam where two styles meet. In a hold: the whole screen, scrolling in with the page, held
    // while p (the transit's progress) runs 0 → 1, then scrolling away. Without one: a band of the
    // screen straddling the boundary, drawn over both, h where the boundary is on screen (0 at the
    // top, 1 at the bottom); the seam leans with it.
    bands.forEach((b, i) => {
      if (i === 0) return;
      scope.add(scene.add({
        update() {
          const a = sections[i - 1], c = sections[i];
          if (!a || !c) return null;
          if (c.hold) {
            const L = holdFor(c.style);
            const { y, p: raw } = holdAt(scrollY, c.hold.top, c.hold.h, vh, L.leadIn, L.leadOut);
            if (y + vh <= 0 || y >= vh) return null;
            const p = holdEase(raw);
            const cap = captions.get(i);
            if (cap && Math.abs(cap.p - raw) > 0.002) { cap.p = raw; cap.el.style.setProperty('--p', raw.toFixed(3)); }
            // Drawn on the whole screen as if held; the strip's place on screen (clip) reveals it.
            return { region: [0, 0, vw, vh], clip: [0, y, vw, vh], card: [0, y, vw, vh], mode: 6, a: STYLE_ID[a.style] ?? 0, b: STYLE_ID[c.style] ?? 0,
              p, h: 1 - p, vel: clamp(vel, -3, 3) };
          }
          if (!c.seam) return null;
          const S = c.seam;
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

  // The holds are there while the scene draws with motion on (html.gl, not .motion-paused), and come
  // and go keeping whatever is on screen where it was.
  const wantHolds = () => !!scene && root.classList.contains('gl') && !root.classList.contains('motion-paused');
  // Each hold names its transition while it plays, at the foot of the screen, with a thin line
  // for how far it has come: the process (glsl/flight.js) and where it is going.
  const PROCESS = { cosmos: 'A vortex', glass: 'Crystal growth', folio: 'Layers of sheets', darkroom: 'Film, developed', ink: 'Branching ink' };
  const captions = new Map();   // band index → { el, p }
  function setHolds(on) {
    if (on === holds.size > 0) return;
    const anchor = bands.find(b => b.getBoundingClientRect().bottom > headH);
    const before = anchor?.getBoundingClientRect().top ?? 0;
    if (on) {
      bands.forEach((b, i) => {
        if (!i || bands[i - 1].dataset.style === b.dataset.style) return;
        const el = document.createElement('div');
        el.className = 'seam-hold';
        el.dataset.to = b.dataset.style;
        el.setAttribute('aria-hidden', 'true');
        const process = PROCESS[b.dataset.style];
        if (process) {
          const cap = document.createElement('p');
          cap.className = 'seam-cap';
          const to = b.querySelector('.band-title')?.textContent.trim() || '';
          cap.innerHTML = '<span class="seam-cap-k"></span> <span aria-hidden="true">→</span> <span class="seam-cap-to"></span><i></i>';
          cap.querySelector('.seam-cap-k').textContent = process;
          cap.querySelector('.seam-cap-to').textContent = to;
          el.append(cap);
          captions.set(i, { el: cap, p: -1 });
        }
        b.before(el);
        holds.set(i, el);
      });
    } else {
      holds.forEach(el => el.remove());
      holds.clear();
      captions.clear();
    }
    measure();
    if (anchor) scrollBy(0, anchor.getBoundingClientRect().top - before);
  }
  setHolds(wantHolds());
  const mo = new MutationObserver(() => setHolds(wantHolds()));
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  scope.add(() => { mo.disconnect(); setHolds(false); });

  return {
    unmount() { clearTimeout(swapTimer); phrases.forEach(p => p.classList.remove('is-on')); },
    setMotion(paused) { setHolds(wantHolds()); apis.forEach(api => api?.setMotion?.(paused)); },
  };
}
