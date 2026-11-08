// The homepage's Chess band: the Scotch plays itself on the brushed board, and the ratings read live
// from Chess.com. The band is complete as built: with motion paused, or before this runs, it shows
// the final position.
import { sleep } from './lib/util.js';
import { ACCOUNT } from '/chess/page/lib/config.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const FILES = 'abcdefgh';
const at = sq => [FILES.indexOf(sq[0]) * 45, (8 - Number(sq[1])) * 45];
const MODES = ['rapid', 'blitz', 'bullet'];
const SAVED = 'cinema:chess:v1:stats';   // the copy the Chess page keeps in this browser

// ---- Chess: the Scotch Game, one ply at a time, then a pause and again --------------------------

export function playChess(pv) {
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
  // The move's squares take an indigo wash; where the piece lands, a drop of ink blooms.
  const mark = (from, to) => {
    const [dx, dy] = at(to);
    marks.innerHTML = [from, to].map(sq => { const [x, y] = at(sq); return `<rect class="pv-hl" x="${x}" y="${y}" width="45" height="45"/>`; }).join('')
      + `<circle class="pv-drop" cx="${dx + 22.5}" cy="${dy + 22.5}" r="16"/>`;
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

// Live ratings, read once per visit when the band comes into view; the Chess page's saved copy
// fills in when Chess.com cannot be reached. Without either, a line points to Chess.com.
export async function loadRatings(stage, scope) {
  const cells = Object.fromEntries(MODES.map(m => [m, stage.querySelector(`[data-rating="${m}"]`)]));
  if (!cells.rapid) return;
  const list = stage.querySelector('[data-ratings]');
  let shown = false;
  const show = ratings => MODES.forEach(m => { if (ratings[m] != null && cells[m]) { cells[m].textContent = String(ratings[m]); shown = true; } });
  // Neither Chess.com nor a saved copy: say where the live ratings are instead of showing dashes.
  const settle = () => { if (!shown) list?.classList.add('is-offline'); };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED) || 'null');
    if (saved?.data?.modes) show(Object.fromEntries(MODES.map(m => [m, saved.data.modes[m]?.rating ?? null])));
  } catch (_) { /* no saved copy */ }
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(ACCOUNT)}/stats`, { signal: scope.signal });
    if (res.ok) {
      const json = await res.json();
      show(Object.fromEntries(MODES.map(m => [m, Number.isFinite(json?.[`chess_${m}`]?.last?.rating) ? json[`chess_${m}`].last.rating : null])));
    }
  } catch (_) { /* offline or blocked: keep what shows */ }
  if (!scope.disposed) settle();
}
