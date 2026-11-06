// What each tile's preview does while its tile is active: Chess plays the Scotch on its board and
// shows live ratings, Racing counts up the Birkebeiner time, Coding types its prompt. Mountains and
// About Me animate in CSS alone. Every preview is complete as built: with motion paused, or before
// this runs, it shows its final state.
import { motion, sleep } from './lib/util.js';
import { ACCOUNT } from '/chess/page/lib/config.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const FILES = 'abcdefgh';
const at = sq => [FILES.indexOf(sq[0]) * 45, (8 - Number(sq[1])) * 45];
const MODES = ['rapid', 'blitz', 'bullet'];
const SAVED = 'cinema:chess:v1:stats';   // the copy the Chess page keeps in this browser

export function mountPreviews(stage, ctx) {
  const runs = new Map();       // preview element → { stop }
  const byTile = tile => tile?.querySelector('[data-pv]');

  const players = {
    chess: playChess,
    racing: countTime,
    coding: typePrompt,
  };

  return {
    activate(tile) {
      const pv = byTile(tile);
      if (!pv || motion.paused) return;
      runs.get(pv)?.stop();
      const play = players[pv.dataset.pv];
      if (play) runs.set(pv, play(pv));
    },
    deactivate(tile) {
      const pv = byTile(tile);
      if (pv) { runs.get(pv)?.stop(); runs.delete(pv); }
    },
    warm() { loadRatings(stage, ctx.scope); },
    destroy() { runs.forEach(r => r.stop()); runs.clear(); },
  };
}

// ---- Chess: the Scotch Game, one ply at a time, then a pause and again --------------------------

function playChess(pv) {
  const svg = pv.querySelector('.pv-board');
  const pieces = svg.querySelector('[data-pieces]');
  const marks = svg.querySelector('[data-marks]');
  const plies = (pv.dataset.plies || '').split(' ').filter(Boolean).map(p => [p.slice(0, 2), p.slice(2, 4)]);
  const final = pieces.innerHTML;
  const finalMarks = marks.innerHTML;
  let live = true;

  const place = (use, sq) => {
    const [x, y] = at(sq);
    use.style.transform = `translate(${x}px, ${y}px)`;
    use.dataset.sq = sq;
  };
  const setup = () => {
    const href = pieces.querySelector('use')?.getAttribute('href')?.split('#')[0] || '/chess/page/pieces.svg';
    const frag = [];
    START.split('/').forEach((row, r) => {
      let c = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { c += Number(ch); continue; }
        const code = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        frag.push(`<use href="${href}#${code}" width="45" height="45" style="transform:translate(${c * 45}px, ${r * 45}px)" data-sq="${FILES[c]}${8 - r}"/>`);
        c++;
      }
    });
    pieces.innerHTML = frag.join('');
    marks.innerHTML = '';
  };
  const mark = (from, to) => {
    marks.innerHTML = [from, to].map(sq => { const [x, y] = at(sq); return `<rect class="pv-hl" x="${x}" y="${y}" width="45" height="45"/>`; }).join('');
  };

  (async () => {
    while (live) {
      setup();
      await sleep(700);
      for (const [from, to] of plies) {
        if (!live) return;
        const mover = pieces.querySelector(`[data-sq="${from}"]`);
        const taken = pieces.querySelector(`[data-sq="${to}"]`);
        if (taken) { taken.style.opacity = '0'; taken.removeAttribute('data-sq'); setTimeout(() => taken.remove(), 320); }
        if (mover) { place(mover, to); pieces.append(mover); }
        mark(from, to);
        await sleep(900);
      }
      await sleep(2600);
    }
  })();

  return {
    stop() {
      live = false;
      pieces.innerHTML = final;
      marks.innerHTML = finalMarks;
    },
  };
}

// Live ratings, read once per visit when the stage comes into view; the Chess page's saved copy
// fills in when Chess.com cannot be reached. Without either, the dashes stay.
async function loadRatings(stage, scope) {
  const cells = Object.fromEntries(MODES.map(m => [m, stage.querySelector(`[data-rating="${m}"]`)]));
  if (!cells.rapid) return;
  const show = ratings => MODES.forEach(m => { if (ratings[m] != null && cells[m]) cells[m].textContent = String(ratings[m]); });
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED) || 'null');
    if (saved?.data?.modes) show(Object.fromEntries(MODES.map(m => [m, saved.data.modes[m]?.rating ?? null])));
  } catch (_) { /* no saved copy */ }
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(ACCOUNT)}/stats`, { signal: scope.signal });
    if (!res.ok) return;
    const json = await res.json();
    show(Object.fromEntries(MODES.map(m => [m, Number.isFinite(json?.[`chess_${m}`]?.last?.rating) ? json[`chess_${m}`].last.rating : null])));
  } catch (_) { /* offline or blocked: keep what shows */ }
}

// ---- Racing: the official time counts up --------------------------------------------------------

function countTime(pv) {
  const el = pv.querySelector('[data-count]');
  if (!el) return { stop() {} };
  const target = el.dataset.count;
  const [h, m, s] = target.split(':').map(Number);
  const total = h * 3600 + m * 60 + s;
  const fmt = sec => `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const t0 = performance.now();
  const ms = 1500;
  let raf = 0;
  const tick = now => {
    const x = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(total * (1 - Math.pow(1 - x, 4)));
    if (x < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop() { cancelAnimationFrame(raf); el.textContent = target; } };
}

// ---- Coding: the prompt types itself, then the listing appears ----------------------------------

function typePrompt(pv) {
  const el = pv.querySelector('[data-type]');
  if (!el) return { stop() {} };
  const text = el.dataset.text || el.textContent;
  el.dataset.text = text;
  pv.classList.add('is-armed');
  pv.classList.remove('is-typed');
  el.textContent = '';
  let i = 0, timer = 0;
  const step = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) timer = setTimeout(step, 38 + Math.random() * 40);
    else pv.classList.add('is-typed');
  };
  timer = setTimeout(step, 380);
  return {
    stop() {
      clearTimeout(timer);
      el.textContent = text;
      pv.classList.add('is-typed');
    },
  };
}
