// Chess page module (CONTRACT §2): live ratings, the repertoire's demonstration lines, editorial picks
// and the recent-games explorer, on top of the static content in content.html. Everything the page
// shows from Chess.com is labelled live, saved, unavailable or empty, and each panel fails on its own.
// All listeners, timers and requests go through ctx.scope, so unmount leaves nothing running.
import { ACCOUNT, profileUrl } from './lib/config.js';
import { createClient, createStore, resolvePanel, errorText, openingRecord, selectGames, featuredGame, summarize, MODES } from './lib/chesscom.js';
import { readGame, moveLabel } from './lib/pgn.js';
import { OPENINGS } from './lib/openings.js';
import { createReplay } from './lib/replay.js';

const PAGE = 12;
const NUMBER = new Intl.NumberFormat('en-US');
const DATE = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const TIME_ONLY = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const day = (unix) => (unix ? DATE.format(new Date(unix * 1000)) : '—');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v; else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

function browserStorage() {
  try {
    const s = window.localStorage;
    s.getItem('cinema:chess:probe');
    return s;
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

export async function mount(main, ctx) {
  const { scope } = ctx;
  const $ = (sel, root = main) => root.querySelector(sel);
  const formSection = $('#current-form');
  const gamesSection = $('#selected-games');
  if (!formSection || !gamesSection) return {};

  const store = createStore(browserStorage());
  const client = createClient({ account: ACCOUNT, fetchImpl: (...a) => window.fetch(...a), signal: scope.signal });
  const replays = [];
  const touched = new WeakSet();

  // Turns a static demonstration (kept for no-JavaScript visitors) into a live replay board; the
  // original markup is restored on unmount so a second mount starts from the same page.
  function enhance(root, label) {
    const original = root.innerHTML;
    const replay = createReplay(root, { scope, label });
    scope.add(() => {
      replay.destroy();
      root.classList.remove('replay');
      delete root.dataset.state; delete root.dataset.index; delete root.dataset.flipped;
      root.innerHTML = original;
    });
    scope.on(root, 'pointerdown', () => touched.add(root));
    scope.on(root, 'keydown', () => touched.add(root));
    replays.push(replay);
    return replay;
  }

  // ---- status lines ---------------------------------------------------------------------------------

  function setStatus(box, state, text, retry = false) {
    const badge = $('[data-badge]', box);
    badge.dataset.state = state;
    badge.textContent = { loading: 'Loading', live: 'Live', saved: 'Saved', unavailable: 'Unavailable', empty: 'Empty', static: 'Not loaded' }[state];
    $('[data-message]', box).textContent = text;
    $('[data-retry]', box).hidden = !retry;
    box.dataset.state = state;
  }

  const savedNote = (r) => `Chess.com could not be reached. ${errorText(r.error)} Showing the copy saved in this browser on ${DATE_TIME.format(new Date(r.at))}.`;

  // ---- current form ------------------------------------------------------------------------------------

  const formStatus = $('[data-status="form"]', formSection);

  function renderStats(r) {
    const stats = r.data?.modes ? r.data : null;
    for (const mode of MODES) {
      const card = $(`[data-mode="${mode}"]`, formSection);
      const m = stats?.modes?.[mode] || null;
      const value = $('[data-rating]', card);
      value.textContent = m ? NUMBER.format(m.rating) : '—';
      value.setAttribute('aria-label', m ? `${mode} rating ${m.rating}` : `${mode} rating not available`);
      $('[data-peak]', card).textContent = m?.best != null ? NUMBER.format(m.best) : '—';
      const rec = m?.record;
      $('[data-record]', card).textContent = rec && rec.win != null && rec.loss != null && rec.draw != null
        ? `${NUMBER.format(rec.win)}–${NUMBER.format(rec.loss)}–${NUMBER.format(rec.draw)}` : '—';
      $('[data-last]', card).textContent = m?.lastDate ? day(m.lastDate) : '—';
      card.dataset.state = m ? r.state : 'none';
    }
    if (r.state === 'live') setStatus(formStatus, 'live', `Live from Chess.com, updated ${DATE_TIME.format(new Date(r.at))}. Record is wins–losses–draws.`);
    else if (r.state === 'saved') setStatus(formStatus, 'saved', savedNote(r), true);
    else if (r.state === 'unavailable') setStatus(formStatus, 'unavailable', `${errorText(r.error)} Nothing is saved in this browser yet, so no ratings are shown.`, true);
    else if (r.state === 'empty') setStatus(formStatus, 'empty', 'Chess.com returned no rapid, blitz or bullet ratings for this account.');
  }

  async function loadStats() {
    setStatus(formStatus, 'loading', 'Loading ratings from Chess.com…');
    const r = await resolvePanel('stats', () => client.stats(), store);
    if (r.state === 'aborted' || scope.signal.aborted) return;
    renderStats(r);
  }

  // ---- games -----------------------------------------------------------------------------------------------

  const gamesStatus = $('[data-status="games"]', gamesSection);
  const picksBox = $('[data-picks]', gamesSection);
  const explorer = $('[data-explorer]', gamesSection);
  const filtersBox = $('[data-filters]', explorer);
  const listBox = $('[data-game-list]', explorer);
  const countLabel = $('[data-explorer-count]', explorer);
  const staticNote = $('[data-explorer-static]', explorer);
  const explorerRoot = $('[data-replay-root]', explorer);
  const explorerReplay = enhance(explorerRoot, 'Game replay');
  explorerReplay.clear('Choose a game from the list to replay it here.');

  let games = [];
  let gamesState = 'static';
  const filter = { result: 'all', control: 'all', opening: 'all' };
  let shown = PAGE;

  function gameLabel(g) {
    return `${DATE.format(new Date(g.endTime * 1000))}, ${g.resultText.toLowerCase()}, ${g.timeClass}, as ${g.color}, ${g.plies} moves`;
  }

  function loadGameInto(replay, g, opts = {}) {
    const read = readGame(g.pgn);
    if (!read.ok) {
      replay.clear(`This game's move list could not be read (${read.error}). It can be opened on Chess.com.`);
      return false;
    }
    replay.load(read, { source: g.url ? { label: 'Game on Chess.com', url: g.url } : null, startAt: 'start', flipped: g.color === 'black', ...opts });
    return true;
  }

  function filtered() {
    return games.filter((g) => (filter.result === 'all' || g.result === filter.result)
      && (filter.control === 'all' || g.timeClass === filter.control)
      && (filter.opening === 'all' || g.opening === filter.opening));
  }

  function chip(group, value, text) {
    return el('button', { type: 'button', class: 'chip', 'data-filter': group, 'data-value': value, 'aria-pressed': String(filter[group] === value) }, text);
  }

  function renderFilters() {
    const controls = [...new Set(games.map((g) => g.timeClass))].filter(Boolean);
    const openings = summarize(games).openings.slice(0, 6).map((o) => o.name);
    for (const o of OPENINGS) if (games.some((g) => g.opening === o.family) && !openings.includes(o.family)) openings.push(o.family);
    const group = (name, label, chips) => el('div', { class: 'chip-group', role: 'group', 'aria-label': label }, el('span', { class: 'label' }, label), ...chips);
    filtersBox.replaceChildren(
      group('result', 'Result', [chip('result', 'all', 'All'), chip('result', 'win', 'Wins'), chip('result', 'draw', 'Draws'), chip('result', 'loss', 'Losses')]),
      group('control', 'Time control', [chip('control', 'all', 'All'), ...controls.map((c) => chip('control', c, cap(c)))]),
      group('opening', 'Opening', [chip('opening', 'all', 'All'), ...openings.map((o) => chip('opening', o, o))]),
    );
    filtersBox.hidden = false;
  }

  function renderList() {
    const list = filtered();
    countLabel.textContent = games.length ? `${list.length} of ${games.length} games` : '';
    listBox.hidden = !games.length;
    if (!games.length) { listBox.replaceChildren(); return; }
    const rows = list.slice(0, shown).map((g) => {
      const body = [
        el('span', { class: 'g-date' }, DATE.format(new Date(g.endTime * 1000))),
        el('span', { class: 'g-res', 'data-result': g.result }, g.result === 'win' ? 'Won' : g.result === 'loss' ? 'Lost' : 'Drawn'),
        el('span', { class: 'g-meta' }, `${cap(g.timeClass)} · ${cap(g.color)}${g.opponentRating != null ? ` · vs ${NUMBER.format(g.opponentRating)}` : ''}`),
        el('span', { class: 'g-open' }, g.opening),
        el('span', { class: 'g-moves' }, g.readable ? `${Math.ceil(g.plies / 2)} moves` : 'Unreadable'),
      ];
      if (!g.readable) {
        return el('li', { class: 'game-item is-unreadable' },
          el('div', { class: 'game-row', 'aria-label': `${gameLabel(g)}; the move list could not be read` }, ...body,
            g.url ? el('a', { href: g.url, target: '_blank', rel: 'noopener noreferrer', class: 'g-link' }, 'Open on Chess.com ↗') : null));
      }
      return el('li', { class: 'game-item' }, el('button', { type: 'button', class: 'game-row', 'data-game': g.id, 'aria-label': gameLabel(g) }, ...body));
    });
    listBox.replaceChildren(...rows);
    if (list.length > shown) {
      listBox.append(el('li', { class: 'game-more' }, el('button', { type: 'button', class: 'link-button', 'data-more': true }, `Show ${Math.min(PAGE, list.length - shown)} more`)));
    }
    if (!list.length) listBox.replaceChildren(el('li', { class: 'game-more' }, 'No games match these filters.'));
  }

  function renderPicks() {
    const picks = selectGames(games);
    picksBox.replaceChildren(...picks.map(({ id, title, rule, game }) => el('li', { class: 'pick', 'data-pick': id },
      el('p', { class: 'label' }, title),
      el('h3', { class: 'pick-title' }, game.opening),
      el('dl', { class: 'pick-facts' },
        el('div', {}, el('dt', {}, 'Played'), el('dd', {}, DATE.format(new Date(game.endTime * 1000)))),
        el('div', {}, el('dt', {}, 'Result'), el('dd', {}, `${game.resultText}, as ${game.color}`)),
        el('div', {}, el('dt', {}, 'Time control'), el('dd', {}, cap(game.timeClass))),
        el('div', {}, el('dt', {}, 'Length'), el('dd', {}, `${Math.ceil(game.plies / 2)} moves`)),
        game.opponentRating != null ? el('div', {}, el('dt', {}, 'Opponent'), el('dd', {}, `rated ${NUMBER.format(game.opponentRating)}`)) : null),
      el('p', { class: 'pick-rule' }, rule),
      el('button', { type: 'button', class: 'btn-small', 'data-open-game': game.id }, 'Replay this game'))));
  }

  function renderRepertoire(state) {
    for (const o of OPENINGS) {
      const note = $(`[data-opening="${o.key}"] [data-opening-record]`, main);
      const show = $(`[data-opening="${o.key}"] [data-show-games]`, main);
      if (!note) continue;
      if (!games.length) {
        note.textContent = state === 'empty' ? 'No public games to count yet.' : 'Recent play is not available right now.';
        if (show) show.hidden = true;
        continue;
      }
      const r = openingRecord(games, o.family);
      const sample = `the latest ${games.length} public games${state === 'saved' ? ' (saved copy)' : ''}`;
      note.textContent = r.games
        ? `${r.games} of ${sample}: ${r.wins}–${r.losses}–${r.draws}, score ${pct(r.score)}.`
        : `None of ${sample}.`;
      if (show) show.hidden = !r.games;
    }
  }

  function renderFeatured(state, at) {
    const root = $('[data-featured] [data-replay-root]', main);
    const noteEl = $('[data-featured-note]', main);
    const kicker = $('[data-featured-kicker]', main);
    const replay = featuredReplay;
    const pick = games.length ? featuredGame(games) : null;
    if (!pick || touched.has(root)) return;
    const { game, reason } = pick;
    if (!loadGameInto(replay, game, { startAt: 'end' })) return;
    if (kicker) kicker.textContent = state === 'saved' ? 'Game from a saved copy' : 'Game from Chess.com';
    noteEl.textContent = `${reason} Played ${DATE.format(new Date(game.endTime * 1000))}, ${game.timeClass}, as ${game.color}: ${game.resultText.toLowerCase()}${game.opponentRating != null ? `, opponent rated ${NUMBER.format(game.opponentRating)}` : ''}.${state === 'saved' ? ` From the copy saved in this browser on ${DATE_TIME.format(new Date(at))}.` : ''}`;
  }

  function renderGames(r) {
    gamesState = r.state;
    games = r.data?.games || [];
    shown = PAGE;
    const total = games.length;
    const range = total ? `${DATE.format(new Date(Math.min(...games.map((g) => g.endTime)) * 1000))} to ${DATE.format(new Date(Math.max(...games.map((g) => g.endTime)) * 1000))}` : '';
    if (r.state === 'live') {
      const partial = r.data.partial ? ` ${r.data.partial.failed} of ${r.data.partial.months} months could not be loaded, so older games may be missing.` : '';
      const skipped = games.filter((g) => !g.readable).length;
      setStatus(gamesStatus, 'live', `Live from Chess.com, updated ${DATE_TIME.format(new Date(r.at))}. ${total} public standard games, ${range}.${partial}${skipped ? ` ${skipped} could not be read and ${skipped === 1 ? 'is' : 'are'} marked.` : ''}`, !!r.data.partial);
    } else if (r.state === 'saved') {
      setStatus(gamesStatus, 'saved', `${savedNote(r)} ${total} games, ${range}.`, true);
    } else if (r.state === 'unavailable') {
      setStatus(gamesStatus, 'unavailable', `${errorText(r.error)} Nothing is saved in this browser yet, so no games are shown. The profile has them all.`, true);
    } else if (r.state === 'empty') {
      setStatus(gamesStatus, 'empty', 'Chess.com lists no public standard games for this account yet.');
    }
    staticNote.hidden = !!total;
    if (!total) {
      staticNote.hidden = false;
      staticNote.replaceChildren(r.state === 'empty' ? 'No public standard games to explore yet. ' : 'Games are not available right now. ',
        el('a', { href: profileUrl(ACCOUNT), target: '_blank', rel: 'noopener noreferrer' }, 'Open the Chess.com profile ↗'));
      filtersBox.hidden = true;
      explorerReplay.clear('Choose a game from the list to replay it here.');
    }
    renderPicks();
    renderRepertoire(r.state);
    renderFeatured(r.state, r.at);
    if (total) { renderFilters(); }
    renderList();
  }

  async function loadGames() {
    setStatus(gamesStatus, 'loading', 'Loading recent games from Chess.com…');
    const r = await resolvePanel('games', () => client.games(), store);
    if (r.state === 'aborted' || scope.signal.aborted) return;
    renderGames(r);
  }

  function openGame(id, { scroll = true } = {}) {
    const g = games.find((x) => x.id === id);
    if (!g) return;
    explorer.open = true;
    loadGameInto(explorerReplay, g);
    for (const row of listBox.querySelectorAll('[data-game]')) {
      if (row.dataset.game === id) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
    }
    if (scroll) explorerRoot.scrollIntoView({ block: 'nearest', behavior: ctx.motion?.paused ? 'auto' : 'smooth' });
  }

  // ---- the static demonstrations, made interactive ---------------------------------------------------------

  const featuredRoot = $('[data-featured] [data-replay-root]', main);
  const featuredReplay = enhance(featuredRoot, featuredRoot.dataset.label || 'Game replay');
  const scotch = OPENINGS.find((o) => o.key === 'scotch');
  featuredReplay.load(readGame(scotch.line), { source: { label: 'Scotch Game on Chess.com', url: scotch.page, note: '(the opening page; this line is a demonstration)' }, startAt: 'end' });

  for (const o of OPENINGS) {
    const root = $(`[data-opening="${o.key}"] [data-replay-root]`, main);
    if (!root) continue;
    const replay = enhance(root, `${o.name} demonstration line`);
    replay.load(readGame(o.line), { source: { label: `${o.name} on Chess.com`, url: o.page, note: '(the opening page; this line is a demonstration)' }, startAt: 'end' });
  }

  // ---- events ---------------------------------------------------------------------------------------------------

  scope.on(main, 'click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const retry = t.closest('[data-retry]');
    if (retry) {
      if (formSection.contains(retry)) loadStats(); else loadGames();
      return;
    }
    const chipEl = t.closest('.chip');
    if (chipEl && explorer.contains(chipEl)) {
      filter[chipEl.dataset.filter] = chipEl.dataset.value;
      shown = PAGE;
      for (const c of filtersBox.querySelectorAll(`.chip[data-filter="${chipEl.dataset.filter}"]`)) c.setAttribute('aria-pressed', String(c === chipEl));
      renderList();
      return;
    }
    const row = t.closest('[data-game]');
    if (row) { openGame(row.dataset.game); return; }
    const open = t.closest('[data-open-game]');
    if (open) { openGame(open.dataset.openGame); return; }
    if (t.closest('[data-more]')) { shown += PAGE; renderList(); return; }
    const show = t.closest('[data-show-games]');
    if (show) {
      filter.opening = show.dataset.showGames;
      filter.result = 'all';
      filter.control = 'all';
      shown = PAGE;
      explorer.open = true;
      if (games.length) { renderFilters(); renderList(); }
      explorer.scrollIntoView({ block: 'start', behavior: ctx.motion?.paused ? 'auto' : 'smooth' });
    }
  });

  const openForHash = () => { if (location.hash === '#recent-games') explorer.open = true; };
  scope.on(window, 'hashchange', openForHash);
  openForHash();

  loadStats();
  loadGames();

  return {
    unmount() { for (const r of replays) r.pause(); },
    setMotion(paused) { if (paused) for (const r of replays) r.pause(); },
  };
}
