// Chess.com data for the page: reads the public Published Data API (read-only) and turns each answer
// into one of five labelled states per panel:
//   live         the API answered just now
//   saved        the API failed; showing the last live answer saved in this browser, with its date
//   unavailable  the API failed and nothing is saved
//   empty        the API answered and has nothing to show (no ratings, no public games)
//   loading      set by the page while a request is in flight
// Ratings are never written into the page source; "saved" is a copy of an earlier live answer kept
// in the visitor's own localStorage. Panels are independent: stats and games fail separately.
import { readGame, openingFamily, openingName, outcome, resultText, stripComments, header } from './pgn.js';

export const MODES = ['rapid', 'blitz', 'bullet'];
export const FAVOURITES = ['Réti Opening', 'Scotch Game', 'Sicilian Defense: O’Kelly'];
const API = 'https://api.chess.com/pub/player';
const SAVED_GAMES = 40;

export class ChessComError extends Error {
  constructor(kind, status = 0, detail = '') {
    super(`${kind}${status ? ` ${status}` : ''}${detail ? `: ${detail}` : ''}`);
    this.kind = kind;       // http | network | timeout | aborted | malformed
    this.status = status;
  }
}

export function errorText(error) {
  switch (error?.kind) {
    case 'timeout': return 'Chess.com did not answer in time.';
    case 'network': return 'Chess.com could not be reached.';
    case 'malformed': return 'Chess.com sent data this page could not read.';
    case 'http':
      if (error.status === 404) return 'Chess.com has no public data for this account (404).';
      if (error.status === 429) return 'Chess.com is limiting requests right now (429).';
      return `Chess.com answered with an error (${error.status}).`;
    default: return 'Chess.com data could not be loaded.';
  }
}

// ---- requests -----------------------------------------------------------------------------------------

export async function getJSON(url, { fetchImpl = globalThis.fetch, signal, timeoutMs = 9000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new ChessComError('http', response.status);
    try {
      return await response.json();
    } catch {
      throw new ChessComError('malformed');
    }
  } catch (error) {
    if (error instanceof ChessComError) throw error;
    if (timedOut) throw new ChessComError('timeout');
    if (signal?.aborted) throw new ChessComError('aborted');
    throw new ChessComError('network', 0, error?.message);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ---- stats ------------------------------------------------------------------------------------------------

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function normalizeStats(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new ChessComError('malformed');
  const modes = {};
  for (const mode of MODES) {
    const d = json[`chess_${mode}`];
    const rating = num(d?.last?.rating);
    if (!d || typeof d !== 'object' || rating === null) { modes[mode] = null; continue; }
    const rec = d.record && typeof d.record === 'object' ? d.record : null;
    modes[mode] = {
      rating,
      best: num(d.best?.rating),
      bestDate: num(d.best?.date),
      lastDate: num(d.last?.date),
      record: rec ? { win: num(rec.win), loss: num(rec.loss), draw: num(rec.draw) } : null,
    };
  }
  return { modes, puzzle: { highest: num(json.tactics?.highest?.rating), rush: num(json.puzzle_rush?.best?.score) } };
}

export const hasRatings = (stats) => MODES.some((m) => stats?.modes?.[m]);

// ---- games ------------------------------------------------------------------------------------------------

// Standard games played by `account`, newest first, as plain entries (opponent names are dropped).
export function analyzeGames(rawGames, account, limit = 100) {
  const me = String(account).toLowerCase();
  const seen = new Set();
  const out = [];
  let skipped = 0;
  const sorted = (Array.isArray(rawGames) ? rawGames : []).filter((g) => g && typeof g === 'object')
    .sort((a, b) => (Number(b.end_time) || 0) - (Number(a.end_time) || 0));
  for (const g of sorted) {
    if (g.rules !== 'chess') continue;
    const white = String(g.white?.username || '').toLowerCase();
    const black = String(g.black?.username || '').toLowerCase();
    if (white !== me && black !== me) continue;
    const color = white === me ? 'white' : 'black';
    const player = g[color];
    const opponent = g[color === 'white' ? 'black' : 'white'];
    const pgn = typeof g.pgn === 'string' ? g.pgn : '';
    const id = String(g.uuid || g.url || `${g.end_time}`);
    if (!pgn || !player?.result || seen.has(id)) { skipped += 1; continue; }
    seen.add(id);
    const read = readGame(pgn);
    out.push({
      id,
      url: typeof g.url === 'string' ? g.url : header(pgn, 'Link'),
      endTime: Number(g.end_time) || 0,
      timeClass: String(g.time_class || ''),
      rated: g.rated !== false,
      color,
      result: outcome(player.result),
      resultText: resultText(player.result, opponent?.result),
      opponentResult: String(opponent?.result || ''),
      playerRating: num(player.rating),
      opponentRating: num(opponent?.rating),
      accuracy: num(g.accuracies?.[color]),
      opening: openingFamily(pgn),
      openingName: openingName(pgn),
      eco: header(pgn, 'ECO'),
      plies: read.ok ? read.moves.length : 0,
      readable: read.ok,
      error: read.ok ? '' : read.error,
      pgn,
    });
    if (out.length >= limit) break;
  }
  return { games: out, skipped };
}

export function summarize(games) {
  const s = { total: games.length, wins: 0, losses: 0, draws: 0, colors: { white: 0, black: 0 }, controls: {}, openings: [], averageOpponent: 0, start: 0, end: 0, score: 0 };
  if (!games.length) return s;
  const map = new Map();
  let opp = 0;
  let oppN = 0;
  for (const g of games) {
    s[g.result === 'win' ? 'wins' : g.result === 'loss' ? 'losses' : 'draws'] += 1;
    s.colors[g.color] += 1;
    s.controls[g.timeClass] = (s.controls[g.timeClass] || 0) + 1;
    if (g.opponentRating !== null) { opp += g.opponentRating; oppN += 1; }
    const o = map.get(g.opening) || { name: g.opening, games: 0, wins: 0, draws: 0, losses: 0 };
    o.games += 1;
    o[g.result === 'win' ? 'wins' : g.result === 'loss' ? 'losses' : 'draws'] += 1;
    map.set(g.opening, o);
  }
  s.averageOpponent = oppN ? Math.round(opp / oppN) : 0;
  s.score = (s.wins + s.draws / 2) / s.total;
  s.start = Math.min(...games.map((g) => g.endTime));
  s.end = Math.max(...games.map((g) => g.endTime));
  s.openings = [...map.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
  return s;
}

// The share of the sample in one opening family, with the score (a draw is half a point).
export function openingRecord(games, family) {
  const mine = games.filter((g) => g.opening === family);
  if (!mine.length) return { games: 0, wins: 0, draws: 0, losses: 0, score: null };
  const wins = mine.filter((g) => g.result === 'win').length;
  const draws = mine.filter((g) => g.result === 'draw').length;
  return { games: mine.length, wins, draws, losses: mine.length - wins - draws, score: (wins + draws / 2) / mine.length };
}

// Editorial picks by stated rules; each game is used at most once. Readable games only.
export function selectGames(games) {
  const ok = games.filter((g) => g.readable && g.plies >= 2);
  const wins = ok.filter((g) => g.result === 'win');
  const rules = [
    { id: 'latest-win', title: 'Most recent win', rule: 'The newest win in the sample.', pick: () => wins[0] },
    { id: 'longest', title: 'Longest game', rule: 'The game with the most moves.', pick: (pool) => [...pool].sort((a, b) => b.plies - a.plies || b.endTime - a.endTime)[0] },
    {
      id: 'highest-rated',
      title: 'Highest-rated opponent beaten',
      rule: 'The win against the highest-rated opponent.',
      pick: (pool) => [...pool.filter((g) => g.result === 'win' && g.opponentRating !== null)].sort((a, b) => b.opponentRating - a.opponentRating || b.endTime - a.endTime)[0],
    },
    {
      id: 'shortest-win',
      title: 'Shortest win',
      rule: 'The win with the fewest moves, not counting abandoned games.',
      pick: (pool) => [...pool.filter((g) => g.result === 'win' && g.opponentResult !== 'abandoned')].sort((a, b) => a.plies - b.plies || b.endTime - a.endTime)[0],
    },
  ];
  const used = new Set();
  const out = [];
  for (const r of rules) {
    const pool = ok.filter((g) => !used.has(g.id));
    const game = r.pick(pool);
    if (game && !used.has(game.id)) {
      used.add(game.id);
      out.push({ id: r.id, title: r.title, rule: r.rule, game });
    }
  }
  return out;
}

// The featured game: the newest readable game in the opening the film shows, else the newest readable one.
export function featuredGame(games, family = 'Scotch Game') {
  const readable = games.filter((g) => g.readable && g.plies >= 6);
  const same = readable.find((g) => g.opening === family);
  if (same) return { game: same, reason: `The newest ${family} in the sample.` };
  return readable[0] ? { game: readable[0], reason: 'The newest game in the sample.' } : null;
}

// ---- client ------------------------------------------------------------------------------------------------

export function createClient({ account, fetchImpl, signal, timeoutMs = 9000, months = 3, limit = 100 }) {
  const base = `${API}/${encodeURIComponent(account)}`;
  const opts = { fetchImpl, signal, timeoutMs };
  return {
    async stats() {
      return normalizeStats(await getJSON(`${base}/stats`, opts));
    },
    async games() {
      const index = await getJSON(`${base}/games/archives`, opts);
      if (!index || !Array.isArray(index.archives)) throw new ChessComError('malformed');
      const urls = index.archives.filter((u) => typeof u === 'string').reverse().slice(0, months);
      if (!urls.length) return { empty: true, games: [], summary: summarize([]), partial: null, skipped: 0 };
      const raw = [];
      let failed = 0;
      let lastError = null;
      for (const url of urls) {
        try {
          const payload = await getJSON(url, opts);
          if (!payload || !Array.isArray(payload.games)) throw new ChessComError('malformed');
          raw.push(...payload.games);
          if (raw.length >= limit + 20) break;
        } catch (error) {
          if (error.kind === 'aborted') throw error;
          failed += 1;
          lastError = error;
        }
      }
      if (failed === urls.length) throw lastError;
      const { games, skipped } = analyzeGames(raw, account, limit);
      return { empty: !games.length, games, summary: summarize(games), skipped, partial: failed ? { failed, months: urls.length } : null };
    },
  };
}

// ---- saved copies (the visitor's own browser) ---------------------------------------------------------------

export function createStore(storage, prefix = 'cinema:chess:v1:') {
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  return {
    save(kind, data, at) {
      const payload = kind === 'games' ? compactGames(data) : data;
      safe(() => storage.setItem(prefix + kind, JSON.stringify({ at, data: payload })));
    },
    load(kind) {
      const text = safe(() => storage.getItem(prefix + kind), null);
      if (!text) return null;
      const saved = safe(() => JSON.parse(text), null);
      if (!saved || typeof saved !== 'object' || !Number.isFinite(saved.at)) return null;
      try {
        if (kind === 'stats') {
          const stats = restoreStats(saved.data);
          return hasRatings(stats) ? { at: saved.at, data: stats } : null;
        }
        if (kind === 'games') {
          const data = restoreGames(saved.data);
          return data.games.length ? { at: saved.at, data } : null;
        }
      } catch { /* a corrupt copy is the same as none */ }
      return null;
    },
  };
}

function restoreStats(data) {
  const modes = {};
  for (const mode of MODES) {
    const d = data?.modes?.[mode];
    modes[mode] = d && num(d.rating) !== null ? {
      rating: num(d.rating), best: num(d.best), bestDate: num(d.bestDate), lastDate: num(d.lastDate),
      record: d.record ? { win: num(d.record.win), loss: num(d.record.loss), draw: num(d.record.draw) } : null,
    } : null;
  }
  return { modes, puzzle: { highest: num(data?.puzzle?.highest), rush: num(data?.puzzle?.rush) } };
}

function compactGames(data) {
  const games = (data?.games || []).slice(0, SAVED_GAMES).map((g) => ({ ...g, pgn: stripComments(g.pgn) }));
  return { games };
}

function restoreGames(data) {
  const list = Array.isArray(data?.games) ? data.games : [];
  const games = [];
  for (const g of list) {
    if (!g || typeof g.pgn !== 'string' || typeof g.id !== 'string') continue;
    const read = readGame(g.pgn);
    games.push({
      id: g.id, url: String(g.url || ''), endTime: num(g.endTime) || 0, timeClass: String(g.timeClass || ''), rated: g.rated !== false,
      color: g.color === 'black' ? 'black' : 'white', result: ['win', 'loss', 'draw'].includes(g.result) ? g.result : 'loss',
      resultText: String(g.resultText || ''), opponentResult: String(g.opponentResult || ''), playerRating: num(g.playerRating),
      opponentRating: num(g.opponentRating), accuracy: num(g.accuracy), opening: String(g.opening || ''), openingName: String(g.openingName || ''),
      eco: String(g.eco || ''), plies: read.ok ? read.moves.length : 0, readable: read.ok, error: read.ok ? '' : read.error, pgn: g.pgn,
    });
  }
  return { games, summary: summarize(games), empty: !games.length, partial: null, skipped: 0 };
}

// ---- one panel's state ---------------------------------------------------------------------------------------

// Runs `load`, and resolves to the panel's state; never rejects (except none): errors become
// 'saved' (an earlier copy exists) or 'unavailable'. An aborted request resolves to { state: 'aborted' }.
export async function resolvePanel(kind, load, store, now = Date.now) {
  try {
    const data = await load();
    const empty = kind === 'stats' ? !hasRatings(data) : data.empty;
    if (empty) return { state: 'empty', at: now(), data };
    store.save(kind, data, now());
    return { state: 'live', data, at: now() };
  } catch (error) {
    if (error?.kind === 'aborted') return { state: 'aborted' };
    const err = error instanceof ChessComError ? error : new ChessComError('network', 0, error?.message);
    const saved = store.load(kind);
    if (saved) return { state: 'saved', data: saved.data, at: saved.at, error: err };
    return { state: 'unavailable', error: err };
  }
}
