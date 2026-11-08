// The replay board: an SVG board with the film's own pieces (chess/cinema/pieces.svg), move stepping
// (buttons and keys), a move list, factual notes, board rotation, optional autoplay and a source link.
// All listeners go through the page scope, so unmounting leaves nothing behind.
import { ReplayModel, keyAction } from './replay-model.js';
import { annotate, endSummary, moveLabel } from './pgn.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE = new URL('../pieces.svg', import.meta.url).href;
const STEP_MS = 1100;

const ICONS = {
  first: 'M6 5v14M19 5L9 12l10 7z',
  prev: 'M16 5L7 12l9 7z',
  next: 'M8 5l9 7-9 7z',
  last: 'M18 5v14M5 5l10 7-10 7z',
  play: 'M7 4.5l12 7.5-12 7.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  flip: 'M7 4l-4 4h3v8a3 3 0 003 3h2M17 20l4-4h-3V8a3 3 0 00-3-3h-2',
};

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function icon(name) {
  const stroked = ['first', 'last', 'flip'].includes(name);
  const root = svg('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true', focusable: 'false' });
  root.append(svg('path', {
    d: ICONS[name], fill: name === 'flip' ? 'none' : 'currentColor', stroke: 'currentColor',
    'stroke-width': stroked ? 2 : 0, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  }));
  return root;
}

function button(act, label, iconName, extra = {}) {
  return h('button', { type: 'button', class: 'replay-btn', 'data-act': act, 'aria-label': label, title: label, ...extra }, icon(iconName));
}

// root: an element to fill. scope: the page scope ({ on, add }). Returns a controller.
export function createReplay(root, { scope, label = 'Chess board' }) {
  let model = null;
  let notes = [];
  let timer = 0;

  root.classList.add('replay');
  root.dataset.state = 'empty';

  const board = h('div', {
    class: 'replay-board', tabindex: '0', role: 'group',
    'aria-label': `${label}. Left and right arrow keys step through the moves, Home and End jump, F turns the board.`,
  });
  const sv = svg('svg', { viewBox: '0 0 360 360', role: 'img', class: 'replay-svg', 'aria-label': label });
  const gSquares = svg('g');
  const gHighlights = svg('g');
  const gPieces = svg('g');
  sv.append(gSquares, gHighlights, gPieces);
  board.append(sv);

  const caption = h('p', { class: 'replay-caption', 'aria-live': 'polite' });
  const controls = h('div', { class: 'replay-controls', role: 'group', 'aria-label': 'Replay controls' },
    button('first', 'First position', 'first'), button('prev', 'Previous move', 'prev'),
    button('next', 'Next move', 'next'), button('last', 'Last position', 'last'),
    button('play', 'Play the moves', 'play'),
    button('flip', 'Turn the board around', 'flip', { 'aria-pressed': 'false' }));
  const moves = h('ol', { class: 'replay-moves', 'aria-label': 'Moves' });
  const noteBox = h('ul', { class: 'replay-notes', 'aria-label': 'Notes on this game' });
  const summary = h('p', { class: 'replay-summary' });
  const source = h('p', { class: 'replay-source' });
  const side = h('div', { class: 'replay-side' }, caption, controls, moves, noteBox, summary, source);
  const layout = h('div', { class: 'replay-layout' }, board, side);
  const empty = h('p', { class: 'replay-empty' }, 'No game loaded.');
  empty.hidden = true;
  layout.hidden = true;
  root.replaceChildren(layout, empty);

  const btn = (act) => controls.querySelector(`[data-act="${act}"]`);

  function drawSquares() {
    gSquares.replaceChildren();
    for (const s of model.squares()) {
      const x = s.col * 45;
      const y = s.row * 45;
      gSquares.append(svg('rect', { x, y, width: 45, height: 45, class: s.light ? 'sq sq-light' : 'sq sq-dark', 'data-sq': s.sq }));
      if (s.col === 0) {
        const t = svg('text', { x: x + 2.5, y: y + 9.5, class: s.light ? 'coord coord-on-light' : 'coord coord-on-dark' });
        t.textContent = s.sq[1];
        gSquares.append(t);
      }
      if (s.row === 7) {
        const t = svg('text', { x: x + 42.5, y: y + 42, class: s.light ? 'coord coord-on-light' : 'coord coord-on-dark', 'text-anchor': 'end' });
        t.textContent = s.sq[0];
        gSquares.append(t);
      }
    }
  }

  function drawPieces() {
    gHighlights.replaceChildren();
    gPieces.replaceChildren();
    const squares = model.squares();
    const at = (sq) => squares.find((c) => c.sq === sq);
    const m = model.move;
    if (m) {
      for (const sq of [m.from, m.to]) {
        const c = at(sq);
        if (c) gHighlights.append(svg('rect', { x: c.col * 45, y: c.row * 45, width: 45, height: 45, class: 'hl' }));
      }
    }
    const chk = model.checkSquare;
    if (chk) {
      const c = at(chk);
      if (c) gHighlights.append(svg('rect', { x: c.col * 45 + 1.5, y: c.row * 45 + 1.5, width: 42, height: 42, rx: 4, class: 'chk' }));
    }
    for (const s of squares) {
      if (!s.piece) continue;
      gPieces.append(svg('use', { href: `${SPRITE}#${s.piece}`, x: s.col * 45, y: s.row * 45, width: 45, height: 45, 'data-piece': s.piece, 'data-sq': s.sq }));
    }
  }

  function drawMoves() {
    moves.replaceChildren();
    let row = null;
    model.game.moves.forEach((m) => {
      if (m.color === 'w' || !row) {
        row = h('li', { class: 'mv' }, h('span', { class: 'mv-n', 'aria-hidden': 'true' }, `${Math.ceil(m.ply / 2)}.`));
        if (m.color === 'b') row.append(h('span', { class: 'mv-gap', 'aria-hidden': 'true' }, '…'));
        moves.append(row);
      }
      row.append(h('button', { type: 'button', class: 'mv-b', 'data-ply': m.ply, 'aria-label': moveLabel(m.ply, m.san).replace('…', ' …') }, m.san));
    });
  }

  function drawNotes() {
    noteBox.replaceChildren(...notes.map((n) => h('li', {}, h('button', { type: 'button', class: 'note-b', 'data-ply': n.ply }, n.text))));
    noteBox.hidden = !notes.length;
  }

  function render() {
    drawPieces();
    root.dataset.index = String(model.index);
    root.dataset.flipped = String(model.flipped);
    caption.replaceChildren(h('strong', {}, model.index ? model.label : 'Start position'), ' ', h('span', {}, model.index ? model.caption : `${model.toMove} to move.`));
    sv.setAttribute('aria-label', `${label}: ${model.index ? model.caption : 'start position.'} ${model.toMove} to move.`);
    btn('first').disabled = model.atStart;
    btn('prev').disabled = model.atStart;
    btn('next').disabled = model.atEnd;
    btn('last').disabled = model.atEnd;
    for (const b of moves.querySelectorAll('.mv-b')) {
      if (Number(b.dataset.ply) === model.index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    }
    const active = moves.querySelector('[aria-current="step"]');
    // Scroll the list itself, never the page.
    moves.scrollTop = active ? Math.max(0, active.offsetTop - moves.clientHeight / 2 + active.offsetHeight / 2) : 0;
    for (const b of noteBox.querySelectorAll('button')) {
      if (Number(b.dataset.ply) === model.index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    }
  }

  function stop() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = 0;
    const b = btn('play');
    b.replaceChildren(icon('play'));
    b.setAttribute('aria-label', 'Play the moves');
    b.title = 'Play the moves';
  }

  function play() {
    if (!model) return;
    if (timer) { stop(); return; }
    if (model.atEnd) model.first();
    const b = btn('play');
    b.replaceChildren(icon('pause'));
    b.setAttribute('aria-label', 'Pause');
    b.title = 'Pause';
    timer = window.setInterval(() => {
      model.next();
      if (model.atEnd) stop();
      render();
    }, STEP_MS);
    render();
  }

  function act(action) {
    if (!model) return;
    if (action === 'play') { play(); return; }
    stop();
    model.act(action);
    if (action === 'flip') {
      drawSquares();
      btn('flip').setAttribute('aria-pressed', String(model.flipped));
    }
    render();
  }

  scope.on(root, 'click', (e) => {
    const target = e.target instanceof Element ? e.target.closest('button') : null;
    if (!model || !target || !root.contains(target) || target.disabled) return;
    if (target.dataset.act) act(target.dataset.act);
    else if (target.dataset.ply) {
      stop();
      model.go(Number(target.dataset.ply));
      render();
    }
  });
  scope.on(root, 'keydown', (e) => {
    if (!model || (e.target instanceof Element && e.target.closest('input, textarea, select'))) return;
    const action = keyAction(e.key, e);
    if (!action) return;
    e.preventDefault();
    act(action);
  });
  scope.add(stop);

  return {
    get model() { return model; },
    // game: a successfully read game (pgn.js readGame).
    // options: { source: { label, url, note }, notes, startAt: 'end' | 'start' | ply, flipped }.
    load(game, { source: src = null, notes: withNotes = true, startAt = 'end', flipped = false } = {}) {
      stop();
      model = new ReplayModel(game, { flipped });
      notes = withNotes ? annotate(game) : [];
      model.go(startAt === 'end' ? model.max : startAt === 'start' ? 0 : startAt);
      root.dataset.state = 'ready';
      layout.hidden = false;
      empty.hidden = true;
      btn('flip').setAttribute('aria-pressed', String(flipped));
      drawSquares();
      drawMoves();
      drawNotes();
      summary.textContent = withNotes ? endSummary(game) : '';
      summary.hidden = !withNotes;
      source.replaceChildren();
      if (src) {
        source.append('Source: ', src.url
          ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, src.label, ' ', h('span', { 'aria-hidden': 'true' }, '↗'))
          : src.label);
        if (src.note) source.append(` ${src.note}`);
      }
      source.hidden = !src;
      render();
      return model;
    },
    goTo(i) { if (model) { stop(); model.go(i); render(); } },
    pause() { stop(); },
    focus() { board.focus({ preventScroll: true }); },
    // Shows a message instead of the board (a game that cannot be read, nothing selected yet).
    clear(message) {
      stop();
      model = null;
      root.dataset.state = 'empty';
      layout.hidden = true;
      empty.textContent = message || 'No game loaded.';
      empty.hidden = false;
    },
    destroy() { stop(); model = null; root.replaceChildren(); },
  };
}
