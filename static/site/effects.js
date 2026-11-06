// The expand effects: one per style, plus a plain fade and the return to the homepage. Each draws on
// its own fixed overlay (.xp, styled in styles/<style>.css) in two acts:
//   cover   from the clicked tile's panel (or link) until the viewport is covered — the router
//           swaps the page underneath once this resolves;
//   reveal  after the swap, uncovering the new page, whose hero is in the same style.
// Only transform, opacity, clip-path, masks and SVG strokes animate. Every run can be cancelled
// (a newer navigation), failed (the page did not load) or skipped (finish at once).

const SVG = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
const SPRING = CSS.supports?.('animation-timing-function', 'linear(0, 1)')
  ? 'linear(0, 0.013, 0.05 2.3%, 0.205, 0.41 7.6%, 0.82 13.4%, 0.99 16.9%, 1.06 19.6%, 1.098 22.4%, 1.106 24.9%, 1.098 27.6%, 1.039 34.2%, 1.006 40.2%, 0.991 46.6%, 0.995 58.8%, 1.001 72%, 1)'
  : 'cubic-bezier(0.34, 1.32, 0.64, 1)';
const FILIGREE = '<svg viewBox="0 0 64 64"><path d="M3 62V16Q3 3 16 3H62"/><path d="M9 62V21Q9 9 21 9H62"/><circle cx="16.5" cy="16.5" r="3.2"/><path d="M22 22C34 23 38 33 31 37C25 40 21 33 27 31"/><path d="M40 9C44 14 50 14 54 9M9 40C14 44 14 50 9 54"/></svg>';
// The seal: 王 (the king) in vermilion, as on the Sumi pages.
const SEAL = '<svg class="seal" viewBox="0 0 40 40"><rect x="1.5" y="1.5" width="37" height="37" rx="2.5" fill="#B3311A"/><g fill="#FBF8F1"><path d="M8.6 9.2h22.6l-.3 3.4H8.9z"/><path d="M11 18.4h18l-.2 3.3H11.2z"/><path d="M7.4 28.2h25.4l-.4 3.7H7.6z"/><path d="M18.3 9.4h3.6l-.2 20.4h-3.5z"/></g><rect x="4.2" y="4.2" width="31.6" height="31.6" rx="1.2" fill="none" stroke="#FBF8F1" stroke-width="1.3"/></svg>';
let seq = 0;

function div(cls, parent) {
  const el = document.createElement('div');
  el.className = cls;
  parent?.append(el);
  return el;
}
const box = r => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
const setBox = (el, r) => Object.assign(el.style, box(r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// SVG filters (dry-brush edges, gooey chrome) only where there is room and a fine pointer.
const rich = vw => vw >= 700 && !matchMedia('(pointer: coarse)').matches;
// A per-frame tween for SVG attributes; it stops when its overlay is gone.
function tween(el, ms, fn, ease = easeInOut) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const tick = now => {
      if (!el.isConnected) return resolve();
      const x = Math.min(1, (now - t0) / ms);
      fn(ease(x), x);
      if (x < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function overlay(style) {
  const el = div(`xp xp--${style}`);
  el.dataset.style = style;
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  return el;
}

// The shared run: cover and reveal are the effect's two acts; play() tracks animations so a run can
// be skipped or cancelled at any point.
function makeRun(el, { cover, reveal }) {
  const anims = new Set();
  let dead = false;
  const play = (node, frames, opts) => {
    const a = node.animate(frames, { fill: 'forwards', ...opts });
    anims.add(a);
    return a.finished.then(() => !dead, () => false);
  };
  const remove = () => { dead = true; anims.forEach(a => { try { a.cancel(); } catch (_) { /* gone */ } }); el.remove(); };
  const leave = ms => {
    if (dead) return;
    dead = true;
    el.style.pointerEvents = 'none';
    el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: ms, fill: 'forwards' })
      .finished.then(() => el.remove(), () => el.remove());
  };
  const covered = Promise.resolve().then(() => cover(play)).then(() => !dead, () => false);
  return {
    covered,
    async reveal(info = {}) {
      if (dead) return;
      await covered;
      document.dispatchEvent(new CustomEvent('xp:reveal'));
      try { await reveal(play, info); } catch (err) { console.error(err); }
      remove();
    },
    skip() { anims.forEach(a => { try { a.finish(); } catch (_) { /* not running */ } }); },
    cancel() { leave(160); },
    fail() { leave(260); },
    slow() { if (!dead && !el.querySelector('.xp-wait')) div('xp-wait', el); },
  };
}

// ---- Sumi: one stroke of ink sweeps round from the tile, the seal stamps, the ink lifts ----------

function sumi({ rect, vw, vh }) {
  const el = overlay('sumi');
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const far = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));
  // A ring this wide covers its own centre and reaches past every corner: one turn covers the screen.
  const R = far * 0.6, W = far * 1.32;
  const at = deg => { const a = (deg * Math.PI) / 180; return `${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}`; };
  const d = `M${at(-100)}A${R} ${R} 0 0 1 ${at(20)}A${R} ${R} 0 0 1 ${at(140)}A${R} ${R} 0 0 1 ${at(250)}A${R} ${R} 0 0 1 ${at(330)}`;
  const id = `xp-dry-${++seq}`;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'xp-sumi');
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  svg.innerHTML = `${rich(vw) ? `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="3" seed="${seq}"/><feDisplacementMap in="SourceGraphic" scale="${Math.round(far * 0.07)}" xChannelSelector="R" yChannelSelector="G"/></filter>` : ''}
    <path d="${d}" stroke-width="${W.toFixed(0)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"${rich(vw) ? ` filter="url(#${id})"` : ''}/>`;
  el.append(svg);
  const path = svg.querySelector('path');
  return makeRun(el, {
    cover: play => play(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(0.62, 0, 0.28, 1)' }),
    async reveal(play) {
      const seal = div('xp-seal', el);
      seal.innerHTML = SEAL;
      Object.assign(seal.style, { left: `${cx - 48}px`, top: `${cy - 48}px` });
      await play(seal, [
        { opacity: 0, transform: 'scale(1.8) rotate(3deg)' },
        { opacity: 1, transform: 'scale(0.94) rotate(3deg)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1) rotate(3deg)' },
      ], { duration: 360, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' });
      await sleep(140);
      await Promise.all([
        play(path, [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }], { duration: 950, easing: 'cubic-bezier(0.55, 0, 0.3, 1)' }),
        play(seal, [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 950 }),
      ]);
    },
  });
}

// ---- Liquid Chrome: a gooey chrome blob swells out of the tile, then pops ------------------------

function chrome({ rect, point, vw, vh }) {
  const el = overlay('chrome');
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const far = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));
  const goo = rich(vw);
  const id = `xp-chr-${++seq}`;
  const r0 = Math.min(rect.width, rect.height) * 0.42;
  const sats = Array.from({ length: 6 }, (_, k) => ({ a: (k / 6) * Math.PI * 2 + rand(-0.3, 0.3), s: rand(0.28, 0.42) }));
  const drops = Array.from({ length: 14 }, (_, k) => ({ a: (k / 14) * Math.PI * 2 + rand(-0.2, 0.2), r: rand(8, 26), v: rand(1.05, 1.5) }));
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'xp-chrome');
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  svg.innerHTML = `<defs>
      <linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${(vw * 0.3).toFixed(0)}" y2="${vh}" spreadMethod="reflect">
        <stop offset="0" stop-color="#FFFFFF"/><stop offset=".22" stop-color="#C9CCDA"/><stop offset=".4" stop-color="#F6F6FB"/>
        <stop offset=".55" stop-color="#7E8197"/><stop offset=".7" stop-color="#E4E4EE"/><stop offset=".86" stop-color="#55586C"/><stop offset="1" stop-color="#DCDDE7"/>
      </linearGradient>
      ${goo ? `<filter id="${id}-f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 26 -11"/></filter>` : ''}
      <mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${vw}" height="${vh}"><rect width="${vw}" height="${vh}" fill="#fff"/><circle class="hole" cx="${point.x}" cy="${point.y}" r="0" fill="#000"/></mask>
    </defs>
    <g${goo ? ` filter="url(#${id}-f)"` : ''} fill="url(#${id}-g)">
      <g mask="url(#${id}-m)"><circle class="main" cx="${cx}" cy="${cy}" r="${r0}"/>${sats.map(() => '<circle class="sat" r="0"/>').join('')}</g>
      ${drops.map(() => '<circle class="drop" r="0"/>').join('')}
    </g>`;
  el.append(svg);
  const grad = svg.querySelector('linearGradient');
  const main = svg.querySelector('.main');
  const satEls = [...svg.querySelectorAll('.sat')];
  const dropEls = [...svg.querySelectorAll('.drop')];
  const hole = svg.querySelector('.hole');
  return makeRun(el, {
    cover: () => tween(el, 950, t => {
      const e = easeInOut(t);
      const r = r0 + (far * 1.08 - r0) * e;
      main.setAttribute('r', r.toFixed(1));
      satEls.forEach((c, k) => {
        const s = sats[k];
        const dist = r * (0.92 + 0.22 * Math.sin(t * Math.PI));
        c.setAttribute('cx', (cx + Math.cos(s.a + t * 1.2) * dist).toFixed(1));
        c.setAttribute('cy', (cy + Math.sin(s.a + t * 1.2) * dist).toFixed(1));
        c.setAttribute('r', (r * s.s * (1 - 0.6 * t)).toFixed(1));
      });
      grad.setAttribute('x1', (-vw * 0.4 * t).toFixed(0));
      grad.setAttribute('x2', (vw * 0.3 - vw * 0.4 * t).toFixed(0));
    }),
    async reveal(play) {
      const flash = div('xp-flash', el);
      play(flash, [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
      const R = Math.hypot(Math.max(point.x, vw - point.x), Math.max(point.y, vh - point.y)) * 1.15;
      await tween(el, 760, t => {
        const e = 1 - Math.pow(1 - t, 3);
        const hr = R * e;
        hole.setAttribute('r', hr.toFixed(1));
        dropEls.forEach((c, k) => {
          const d = drops[k];
          const dist = hr * d.v + 30;
          c.setAttribute('cx', (point.x + Math.cos(d.a) * dist).toFixed(1));
          c.setAttribute('cy', (point.y + Math.sin(d.a) * dist + 120 * t * t).toFixed(1));
          c.setAttribute('r', (d.r * Math.sin(Math.min(1, t * 1.4) * Math.PI)).toFixed(1));
        });
      }, x => x);
    },
  });
}

// ---- Glacier Glass: a frosted pane springs open; the frost clears from the click -------------

function glass({ rect, point, vw, vh }) {
  const el = overlay('glass');
  const pane = div('xp-pane', el);
  const spec = div('xp-spec', pane);
  const inset = r => `inset(${r.top}px ${vw - r.left - r.width}px ${vh - r.top - r.height}px ${r.left}px round 28px)`;
  return makeRun(el, {
    cover: play => Promise.all([
      play(pane, [
        { clipPath: inset(rect), backgroundColor: 'rgb(255 255 255 / 0.25)' },
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', backgroundColor: 'rgb(234 242 247 / 0.95)' },
      ], { duration: 900, easing: SPRING }),
      play(spec, [{ transform: `translateX(${rect.left - vw * 0.45}px)` }, { transform: `translateX(${vw * 1.15}px)` }], { duration: 820, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', delay: 60 }),
    ]),
    async reveal(play) {
      pane.style.setProperty('--x', `${point.x}px`);
      pane.style.setProperty('--y', `${point.y}px`);
      pane.classList.add('is-clearing');
      const R = Math.hypot(Math.max(point.x, vw - point.x), Math.max(point.y, vh - point.y)) + 220;
      await Promise.all([
        play(pane, [{ '--xp-r': '0px' }, { '--xp-r': `${R}px` }], { duration: 1050, easing: 'cubic-bezier(0.55, 0, 0.3, 1)' }),
        play(el, [{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1050 }),
      ]);
    },
  });
}

// ---- Neon Circuit: the edges trace, the panel glitches into bands, a scan line reveals ---------

function neon({ rect, vw, vh }) {
  const el = overlay('neon');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'xp-trace');
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const trace = (cls, d) => {
    const r = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({ class: cls, x: rect.left + d, y: rect.top + d, width: rect.width, height: rect.height, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 })) r.setAttribute(k, v);
    svg.append(r);
    return r;
  };
  const m = trace('m', 4), c = trace('c', 0);
  el.append(svg);
  const N = 12;
  const bands = Array.from({ length: N }, (_, i) => {
    const b = div('xp-band', el);
    setBox(b, { left: rect.left, top: rect.top + (i * rect.height) / N, width: rect.width, height: rect.height / N + 0.5 });
    b.style.opacity = '0';
    return b;
  });
  return makeRun(el, {
    async cover(play) {
      await Promise.all([
        play(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, easing: 'ease-out' }),
        play(m, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, delay: 50, easing: 'ease-out' }),
      ]);
      await Promise.all(bands.map(b => play(b, [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 1, transform: `translateX(${rand(-34, 34)}px)` },
        { opacity: 1, transform: `translateX(${rand(-16, 16)}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 210, easing: 'steps(4, end)' })));
      play(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
      await Promise.all(bands.map((b, i) => play(b, [
        { ...box({ left: rect.left, top: rect.top + (i * rect.height) / N, width: rect.width, height: rect.height / N + 0.5 }), opacity: 1 },
        { ...box({ left: 0, top: (i * vh) / N, width: vw, height: vh / N + 1 }), opacity: 1 },
      ], { duration: 280, delay: i * 16, easing: 'cubic-bezier(0.9, 0, 0.1, 1)' })));
    },
    async reveal(play) {
      const cover = div('xp-cover', el);
      const scan = div('xp-scan', el);
      bands.forEach(b => b.remove());
      svg.remove();
      const sweep = { duration: 760, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' };
      await Promise.all([
        play(cover, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], sweep),
        play(scan, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${vh}px)`, opacity: 1, offset: 0.96 }, { transform: `translateY(${vh}px)`, opacity: 0 }], sweep),
      ]);
    },
  });
}

// ---- Naturalist's Folio: filigree draws, the brass frame opens to the edges, ink blooms ---------

function folio({ rect, point, vw, vh }) {
  const el = overlay('folio');
  const frame = div('xp-frame', el);
  setBox(frame, rect);
  const corners = ['tl', 'tr', 'br', 'bl'].map(pos => {
    const c = div(`xp-corner xp-corner--${pos}`, frame);
    c.innerHTML = FILIGREE;
    return c;
  });
  const strokes = corners.flatMap(c => [...c.querySelectorAll('path')]);
  strokes.forEach(p => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
  const beads = corners.flatMap(c => [...c.querySelectorAll('circle')]);
  beads.forEach(b => { b.style.opacity = '0'; });
  return makeRun(el, {
    async cover(play) {
      const draw = Promise.all([
        ...strokes.map((p, i) => play(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: (i % 5) * 40, easing: 'ease-out' })),
        ...beads.map(b => play(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 260 })),
      ]);
      await sleep(320);
      await Promise.all([draw, play(frame, [
        { ...box(rect), backgroundColor: 'rgb(15 25 19 / 0)' },
        { ...box({ left: 0, top: 0, width: vw, height: vh }), backgroundColor: 'rgb(15 25 19 / 1)' },
      ], { duration: 760, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' })]);
    },
    async reveal(play) {
      const id = `xp-ink-${++seq}`;
      const R = Math.hypot(Math.max(point.x, vw - point.x), Math.max(point.y, vh - point.y)) * 1.25;
      const ink = document.createElementNS(SVG, 'svg');
      ink.setAttribute('class', 'xp-ink');
      ink.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      ink.innerHTML = `<defs>${rich(vw) ? `<filter id="${id}-f" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="${seq}"/><feDisplacementMap in="SourceGraphic" scale="110" xChannelSelector="R" yChannelSelector="G"/></filter>` : ''}
        <mask id="${id}-m"><rect width="${vw}" height="${vh}" fill="#fff"/><circle cx="${point.x}" cy="${point.y}" r="0" fill="#000"${rich(vw) ? ` filter="url(#${id}-f)"` : ''}/></mask></defs>
        <rect width="${vw}" height="${vh}" fill="#0F1913" mask="url(#${id}-m)"/>`;
      el.insertBefore(ink, frame);
      frame.style.backgroundColor = 'transparent';
      frame.getAnimations().forEach(a => { try { a.commitStyles(); a.cancel(); } catch (_) { /* done */ } });
      frame.style.backgroundColor = 'transparent';
      const circle = ink.querySelector('circle');
      const t0 = performance.now(), ms = 1200;
      const fadeFrame = play(frame, [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: ms });
      await new Promise(resolve => {
        const tick = now => {
          const x = Math.min(1, (now - t0) / ms);
          const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
          circle.setAttribute('r', String(e * R));
          if (x < 1 && el.isConnected) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      await fadeFrame;
    },
  });
}

// ---- A plain fade in the target style (house pages, reduced motion, history steps) ------------

function fade({ to }) {
  const el = overlay(to || 'house');
  el.style.background = 'var(--c-bg)';
  el.style.opacity = '0';
  return makeRun(el, {
    cover: play => play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }),
    reveal: play => play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' }),
  });
}

// ---- Back to the homepage: the page folds back into the tile it came from ------------------------

function close({ from, vw, vh }) {
  const el = overlay(from || 'house');
  el.style.background = 'var(--c-bg)';
  el.style.opacity = '0';
  return makeRun(el, {
    cover: play => play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }),
    async reveal(play, info) {
      const r = info.panelRect?.();
      if (!r || r.width < 2) {
        await play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        return;
      }
      await play(el, [
        { clipPath: 'inset(0px 0px 0px 0px round 0px)' },
        { clipPath: `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px round 24px)` },
      ], { duration: 620, easing: EASE });
      await play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
    },
  });
}

export const EFFECTS = { sumi, glass, neon, folio, chrome, fade, close };

export function open(kind, opts) {
  return (EFFECTS[kind] || fade)(opts);
}
