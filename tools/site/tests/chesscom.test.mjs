// node --test tools/site/tests/*.test.mjs    Data states against the synthetic Chess.com fixtures
// (tools/site/fixtures/chess): live, saved, unavailable and empty, for every scenario.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chessHandler, scenarioNames } from '../fixtures/chess/index.mjs';
import {
  createClient, createStore, resolvePanel, normalizeStats, analyzeGames, summarize, selectGames, featuredGame,
  openingRecord, errorText, getJSON, ChessComError, hasRatings,
} from '../../../chess/page/lib/chesscom.js';
import { readGame } from '../../../chess/page/lib/pgn.js';

const ACCOUNT = 'example-player';

// A fetch that answers from a fixture scenario, like page.intercept() does in the browser tests.
function fixtureFetch(scenario, { honorDelay = false } = {}) {
  const handler = chessHandler(scenario);
  const calls = [];
  const fetchImpl = async (url, { signal } = {}) => {
    const aborted = () => new DOMException('Aborted', 'AbortError');
    if (signal?.aborted) throw aborted();        // like fetch(): a signal that is already aborted never reaches the network
    const res = await handler({ url });
    calls.push({ url: url.replace(ACCOUNT, '<user>'), status: res.status, fail: res.fail, hang: res.hang });
    if (res === 'continue') throw new TypeError('unexpected request');
    if (res.hang) {
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }
    if (res.fail) throw new TypeError('Failed to fetch');
    if (honorDelay && res.delay) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, res.delay);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(aborted()); }, { once: true });
      });
    }
    return new Response(res.body, { status: res.status, headers: res.headers });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const memory = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
};
const client = (scenario, extra = {}) => {
  const fetchImpl = fixtureFetch(scenario, extra);
  return { fetchImpl, api: createClient({ account: ACCOUNT, fetchImpl, timeoutMs: extra.timeoutMs ?? 2000 }) };
};
const panels = async (scenario, store = createStore(memory()), extra = {}) => {
  const { fetchImpl, api } = client(scenario, extra);
  return {
    fetchImpl,
    stats: await resolvePanel('stats', () => api.stats(), store),
    games: await resolvePanel('games', () => api.games(), store),
    api,
    store,
  };
};

test('the scenario list is the one these tests cover', () => {
  assert.deepEqual(scenarioNames().sort(), ['empty', 'empty-month', 'malformed', 'network-error', 'not-found', 'offline', 'partial-failure',
    'rate-limited', 'retry', 'server-error', 'slow', 'sparse-stats', 'success', 'timeout']);
});

test('success: stats and games are live, Chess960 is not counted, every standard game is readable', async () => {
  const p = await panels('success');
  assert.equal(p.stats.state, 'live');
  assert.equal(p.games.state, 'live');
  assert.ok(p.stats.at > 0);
  const { modes } = p.stats.data;
  assert.deepEqual(Object.keys(modes), ['rapid', 'blitz', 'bullet']);
  for (const mode of Object.values(modes)) {
    assert.ok(Number.isInteger(mode.rating));
    assert.ok(mode.record && Number.isInteger(mode.record.win));
  }
  const { games, summary, partial } = p.games.data;
  assert.equal(partial, null);
  assert.equal(games.length, 6);
  assert.equal(summary.total, 6);
  assert.equal(summary.wins + summary.losses + summary.draws, 6);
  assert.ok(games.every((g) => g.readable && g.plies > 4));
  assert.ok(games.every((g) => g.pgn.length > 100));
  assert.deepEqual(games.map((g) => g.endTime), [...games.map((g) => g.endTime)].sort((a, b) => b - a));
  // No opponent names are kept in the entries.
  assert.ok(!JSON.stringify(games.map(({ pgn, ...rest }) => rest)).includes('opponent-'));
});

test('empty: no archives is the empty state, not an error; stats stay live', async () => {
  const p = await panels('empty');
  assert.equal(p.stats.state, 'live');
  assert.equal(p.games.state, 'empty');
  assert.deepEqual(p.games.data.games, []);
});

test('empty-month: an archive with no games is the empty state', async () => {
  const p = await panels('empty-month');
  assert.equal(p.games.state, 'empty');
});

test('empty must not erase a saved copy of earlier games', async () => {
  const store = createStore(memory());
  await panels('success', store);
  const p = await panels('empty', store);
  assert.equal(p.games.state, 'empty');
  assert.equal(store.load('games').data.games.length, 6);
});

test('sparse-stats: missing modes are null placeholders, never 0 or NaN', async () => {
  const p = await panels('sparse-stats');
  assert.equal(p.stats.state, 'live');
  assert.ok(p.stats.data.modes.rapid.rating > 0);
  assert.equal(p.stats.data.modes.blitz, null);
  assert.equal(p.stats.data.modes.bullet, null);
  assert.equal(p.stats.data.modes.rapid.best, null);
  assert.deepEqual(p.stats.data.puzzle, { highest: null, rush: null });
  assert.equal(JSON.stringify(p.stats.data).includes('NaN'), false);
});

test('partial-failure: stats unavailable without a copy, games live from the months that answered', async () => {
  const p = await panels('partial-failure');
  assert.equal(p.stats.state, 'unavailable');
  assert.equal(p.stats.error.kind, 'http');
  assert.equal(p.stats.error.status, 500);
  assert.equal(p.games.state, 'live');
  assert.deepEqual(p.games.data.partial, { failed: 2, months: 3 });
  assert.equal(p.games.data.games.length, 2);
});

test('partial-failure with a saved copy: stats say saved and carry the saved date', async () => {
  const store = createStore(memory());
  const clock = () => 1_790_000_000_000;
  const ok = client('success');
  await resolvePanel('stats', () => ok.api.stats(), store, clock);
  const bad = client('partial-failure');
  const stats = await resolvePanel('stats', () => bad.api.stats(), store, () => 1_791_000_000_000);
  assert.equal(stats.state, 'saved');
  assert.equal(stats.at, 1_790_000_000_000);
  assert.equal(stats.error.status, 500);
  assert.ok(hasRatings(stats.data));
});

test('malformed: the readable game is listed, the others are flagged unreadable with a reason', async () => {
  const p = await panels('malformed');
  assert.equal(p.games.state, 'live');
  const { games } = p.games.data;
  assert.equal(games.length, 4);
  const readable = games.filter((g) => g.readable);
  const bad = games.filter((g) => !g.readable);
  assert.equal(readable.length, 1);
  assert.equal(bad.length, 3);
  assert.ok(bad.every((g) => g.plies === 0 && g.error));
  assert.equal(readGame(readable[0].pgn).ok, true);
  assert.deepEqual(selectGames(games).map((s) => s.game.id).every((id) => readable.some((g) => g.id === id)), true);
});

test('retry: the first answers fail with 503, and retrying loads that panel', async () => {
  const { api } = client('retry');
  const store = createStore(memory());
  const first = await resolvePanel('stats', () => api.stats(), store);
  assert.equal(first.state, 'unavailable');
  assert.equal(first.error.status, 503);
  const again = await resolvePanel('stats', () => api.stats(), store);
  assert.equal(again.state, 'live');
  // Games: the archive list and each month fail once, so it takes up to three tries.
  let games;
  let tries = 0;
  do { games = await resolvePanel('games', () => api.games(), store); tries += 1; } while (games.state !== 'live' && tries < 4);
  assert.equal(games.state, 'live');
  assert.ok(tries >= 2 && tries <= 3);
});

test('timeout: requests that never answer end in the page’s own timeout', async () => {
  const p = await panels('timeout', undefined, { timeoutMs: 40 });
  for (const panel of [p.stats, p.games]) {
    assert.equal(panel.state, 'unavailable');
    assert.equal(panel.error.kind, 'timeout');
  }
  assert.equal(errorText(p.stats.error), 'Chess.com did not answer in time.');
});

test('network-error and offline: unavailable with a network error, with and without a saved copy', async () => {
  for (const scenario of ['network-error', 'offline']) {
    const p = await panels(scenario);
    assert.equal(p.stats.state, 'unavailable', scenario);
    assert.equal(p.stats.error.kind, 'network', scenario);
    assert.equal(p.games.state, 'unavailable', scenario);
    const store = createStore(memory());
    await panels('success', store);
    const saved = await panels(scenario, store);
    assert.equal(saved.stats.state, 'saved', scenario);
    assert.equal(saved.games.state, 'saved', scenario);
    assert.equal(saved.games.data.games.length, 6);
    assert.ok(saved.games.data.games.every((g) => g.readable));
  }
});

test('server-error, rate-limited and not-found: distinct messages, one request per panel, no retry loop', async () => {
  const expected = { 'server-error': [503, /error \(503\)/], 'rate-limited': [429, /limiting requests/], 'not-found': [404, /no public data/] };
  for (const [scenario, [status, text]] of Object.entries(expected)) {
    const p = await panels(scenario);
    assert.equal(p.stats.state, 'unavailable', scenario);
    assert.equal(p.stats.error.status, status, scenario);
    assert.match(errorText(p.stats.error), text, scenario);
    assert.equal(p.games.state, 'unavailable', scenario);
    assert.equal(p.fetchImpl.calls.length, 2, `${scenario}: one stats request and one archive-list request, no retries`);
  }
});

test('slow: each answer is awaited, and aborting during the wait gives the aborted state', async () => {
  const controller = new AbortController();
  const fetchImpl = fixtureFetch('slow', { honorDelay: true });
  const api = createClient({ account: ACCOUNT, fetchImpl, signal: controller.signal, timeoutMs: 8000 });
  const pending = resolvePanel('stats', () => api.stats(), createStore(memory()));
  setTimeout(() => controller.abort(), 60);
  assert.deepEqual(await pending, { state: 'aborted' });
});

test('an already-aborted signal never reaches the network', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchImpl = fixtureFetch('success');
  const api = createClient({ account: ACCOUNT, fetchImpl, signal: controller.signal });
  assert.deepEqual(await resolvePanel('stats', () => api.stats(), createStore(memory())), { state: 'aborted' });
});

test('stats that are not an object, or an archive list of the wrong shape, are malformed', async () => {
  assert.throws(() => normalizeStats(null), (e) => e.kind === 'malformed');
  assert.throws(() => normalizeStats([]), (e) => e.kind === 'malformed');
  assert.equal(hasRatings(normalizeStats({})), false);
  const fetchImpl = async () => new Response('{"archives": "nope"}', { status: 200 });
  await assert.rejects(createClient({ account: ACCOUNT, fetchImpl }).games(), (e) => e.kind === 'malformed');
  const text = async () => new Response('<html>', { status: 200 });
  await assert.rejects(getJSON('https://x', { fetchImpl: text }), (e) => e.kind === 'malformed');
  assert.equal((await resolvePanel('stats', async () => normalizeStats({}), createStore(memory()))).state, 'empty');
});

test('saved copies: a corrupt, wrong-shaped or throwing storage is the same as no copy', async () => {
  const bad = memory();
  bad.map.set('cinema:chess:v1:stats', '{not json');
  bad.map.set('cinema:chess:v1:games', JSON.stringify({ at: 1, data: { games: [{ id: 'x', pgn: 5 }] } }));
  const store = createStore(bad);
  assert.equal(store.load('stats'), null);
  assert.equal(store.load('games'), null);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const s2 = createStore(throwing);
  assert.equal(s2.load('stats'), null);
  s2.save('stats', { modes: {} }, 1);   // must not throw
  const p = await resolvePanel('stats', async () => { throw new ChessComError('network'); }, s2);
  assert.equal(p.state, 'unavailable');
});

test('saved games keep at most 40 games and drop the clock comments', async () => {
  const p = await panels('success');
  const store = createStore(memory());
  const many = Array.from({ length: 60 }, (_, i) => ({ ...p.games.data.games[i % 6], id: `g${i}` }));
  store.save('games', { games: many }, 5);
  const back = store.load('games');
  assert.equal(back.data.games.length, 40);
  assert.ok(!back.data.games[0].pgn.includes('%clk'));
  assert.ok(back.data.games.every((g) => g.readable));
});

test('summaries, opening records, editorial picks and the featured game come from the sample', async () => {
  const p = await panels('success');
  const { games } = p.games.data;
  const sum = summarize(games);
  assert.equal(sum.total, 6);
  assert.ok(sum.openings.length >= 3);
  assert.equal(summarize([]).total, 0);
  const scotch = openingRecord(games, 'Scotch Game');
  assert.ok(scotch.games >= 1);
  assert.equal(scotch.wins + scotch.draws + scotch.losses, scotch.games);
  assert.equal(openingRecord(games, 'Réti Opening').games >= 0, true);
  assert.equal(openingRecord([], 'Scotch Game').score, null);
  const picks = selectGames(games);
  assert.ok(picks.length >= 2 && picks.length <= 4);
  assert.equal(new Set(picks.map((s) => s.game.id)).size, picks.length);
  assert.ok(picks.every((s) => s.rule && s.title));
  const featured = featuredGame(games);
  assert.ok(featured.game.readable);
  assert.equal(featured.game.opening, 'Scotch Game');
  assert.equal(featuredGame([]), null);
});

test('games by other accounts, other rules and duplicates are left out', () => {
  const base = { rules: 'chess', end_time: 5, time_class: 'rapid', pgn: '[Event "x"]\n\n1. e4 e5 *', white: { username: ACCOUNT, result: 'win' }, black: { username: 'other', result: 'resigned' } };
  const raw = [
    base,
    { ...base, uuid: 'a', end_time: 6 },
    { ...base, uuid: 'a', end_time: 7 },                      // duplicate id
    { ...base, uuid: 'b', rules: 'chess960' },
    { ...base, uuid: 'c', white: { username: 'x' }, black: { username: 'y' } },
    { ...base, uuid: 'd', pgn: '' },
    null,
  ];
  const { games, skipped } = analyzeGames(raw, ACCOUNT.toUpperCase());
  assert.equal(games.length, 2);
  assert.equal(skipped, 2);   // the duplicate id and the game without a move list
});
