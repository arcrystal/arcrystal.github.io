// Navigation core (static/site/lib/nav-core.js): the seven rules of architecture.md section 5 and the
// awkward sequences around them, with fakes for fetch, travel, history and timers.
// Run: node --test tools/site/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavCore, pushesHistory } from '../../../static/site/lib/nav-core.js';
import { createRoutes } from '../../../static/site/lib/routes.js';

// The places of architecture.md section 4, reduced to what routing reads.
const REGISTRY = {
  places: [
    { key: 'hub', page: 'home', url: '/' },
    { key: 'mountains', page: 'gallery', url: '/image%20portfolio/gallery.html' },
    { key: 'racing', page: 'athletics', url: '/athletics/athletics.html' },
    { key: 'chess', page: 'chess', url: '/chess/chess.html' },
    { key: 'coding', page: 'projects', url: '/coding%20projects/projects.html' },
    { key: 'hub', page: 'about', view: 'about', url: '/about/' },
    { key: 'hub', page: 'resume', view: 'resume', url: '/resume/resume.html' },
  ],
};

const ORIGIN = 'https://arcrystal.github.io';
const A = `${ORIGIN}/`;
const B = `${ORIGIN}/image%20portfolio/gallery.html`;
const C = `${ORIGIN}/chess/chess.html`;
const Z = `${ORIGIN}/about/`;
const flush = () => new Promise(r => setImmediate(r));

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Resolves to the value, or to 'pending' when the promise has not settled yet.
async function peek(promise) {
  const marker = Symbol('pending');
  const v = await Promise.race([promise, flush().then(() => marker)]);
  return v === marker ? 'pending' : v;
}

// A world journey: settles 'finished' on its own (end()), on skip(), or 'cancelled' on cancel().
function fakeTravel(intent) {
  const d = deferred();
  const t = { intent, calls: [], result: null };
  const settle = r => { if (!t.result) { t.result = r; d.resolve(r); } };
  t.finished = d.promise;
  t.skip = () => { t.calls.push('skip'); settle('finished'); };
  t.cancel = () => { t.calls.push('cancel'); settle('cancelled'); };
  t.end = () => settle('finished');
  return t;
}

// The router side, faked: a history stack with an address bar, pages fetched on request (they
// reject on abort, like fetch, unless abortable is false), and a record of every core call.
function setup({ at = A, travel = true, commitAsync = false, abortable = true } = {}) {
  const routes = createRoutes(REGISTRY);
  const h = { entries: [{ url: at, state: null }], index: 0 };
  const log = [];
  const fetches = [];
  const travels = [];
  const timers = new Map();
  const clock = { t: 0 };
  let timerSeq = 0;
  const env = {
    log, fetches, travels, clock, h,
    get url() { return h.entries[h.index].url; },
    push(url, state = { y: 0 }) {
      const abs = new URL(url, env.url).href;
      h.entries.splice(h.index + 1);
      h.entries.push({ url: abs, state });
      h.index++;
      log.push(['push', abs]);
    },
    // Rewrites the current entry in place (the router does this for y and for dropping a hash).
    replace(url, state = h.entries[h.index].state) {
      const abs = new URL(url, env.url).href;
      h.entries[h.index] = { url: abs, state };
      log.push(['replace', abs]);
    },
    back() { h.index--; return h.entries[h.index]; },
    forward() { h.index++; return h.entries[h.index]; },
    pending: [],
    // Advance the fake clock, running due timers.
    advance(ms) {
      clock.t += ms;
      for (const [id, tm] of [...timers]) if (tm.at <= clock.t) { timers.delete(id); tm.fn(); }
    },
    timerCount: () => timers.size,
    calls: name => log.filter(e => e[0] === name),
    statuses: () => log.filter(e => e[0] === 'status').map(([, id, state]) => `${id}:${state}`),
  };
  env.nav = createNavCore({
    routeOf: url => routes.routeOf(url, env.url),
    currentUrl: () => env.url,
    fetchPage(route, signal) {
      const d = deferred();
      const f = { route, signal, ...d, doc: { page: route.page } };
      if (abortable) signal.addEventListener('abort', () => d.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      fetches.push(f);
      log.push(['fetch', route.url]);
      return d.promise;
    },
    commit(intent, doc) {
      log.push(['commit', intent.id, doc?.page ?? null, intent.source]);
      const apply = () => { if (pushesHistory(intent)) env.push(intent.route.url); };
      if (!commitAsync) { apply(); return undefined; }
      const d = deferred();
      env.pending.push({ intent, run: () => { apply(); d.resolve(); }, fail: err => d.reject(err) });
      return d.promise;
    },
    samePage(route, intent) {
      log.push(['samePage', intent.id, route.url, intent.source]);
      // As the router does: the top of the same page drops a fragment in place.
      if (intent.source !== 'pop' && !route.hash && new URL(env.url).hash) env.replace(route.url);
    },
    travel(intent) {
      log.push(['travel', intent.id]);
      if (!travel) return null;
      const t = typeof travel === 'function' ? travel(intent) : fakeTravel(intent);
      travels.push(t);
      return t;
    },
    status(intent, state, info) { log.push(['status', intent.id, state, info]); },
    hardNavigate(url) { log.push(['hard', url]); },
    now: () => clock.t,
    setTimeout(fn, ms) { const id = ++timerSeq; timers.set(id, { fn, at: clock.t + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  return env;
}

// Starts the shell on its first page, as the router does.
async function started(opts = {}) {
  const env = setup(opts);
  const first = env.nav.go(env.url, { source: 'initial' });
  if (opts.commitAsync) env.pending.shift().run();
  await flush();
  assert.equal(first.state, 'settled');
  env.log.length = 0;
  return env;
}

// ---- Rule 1 ---------------------------------------------------------------------------------

test('rule 1: a new target gets the next id, aborts the previous fetch and cancels its travel', async () => {
  const env = await started();
  const one = env.nav.go(B);
  const two = env.nav.go(C);
  assert.equal(two.id, one.id + 1);
  assert.equal(one.signal.aborted, true);
  assert.equal(two.signal.aborted, false);
  assert.deepEqual(env.travels[0].calls, ['cancel']);
  assert.equal(one.state, 'cancelled');
  assert.equal(await one.committed, false);
  assert.equal(await one.settled, false);
  assert.equal(env.nav.latest, two);
});

test('rule 1: only the latest intent commits, reports status or travels', async () => {
  const env = await started();
  const one = env.nav.go(B);
  const two = env.nav.go(C);
  env.fetches[0].resolve({ page: 'gallery' });   // too late: aborted already
  env.advance(5000);                              // its slow timer must not report either
  await flush();
  assert.deepEqual(env.calls('commit'), []);
  assert.deepEqual(env.statuses(), [`${one.id}:loading`, `${two.id}:loading`, `${two.id}:slow`]);
  assert.deepEqual(env.calls('travel').map(e => e[1]), [one.id, two.id]);
  env.fetches[1].resolve({ page: 'chess' });
  await flush();
  assert.deepEqual(env.calls('commit'), [['commit', two.id, 'chess', 'link']]);
});

// ---- Rule 2 ---------------------------------------------------------------------------------

test('rule 2: repeated clicks on the pending destination return the same intent', async () => {
  const env = await started();
  const one = env.nav.go(B);
  assert.equal(env.nav.go(B), one);
  assert.equal(env.nav.go(`${ORIGIN}/image portfolio/gallery.html`), one, 'decoded spelling');
  assert.equal(env.nav.go(B, { source: 'hotspot' }), one);
  assert.equal(env.fetches.length, 1);
  assert.equal(env.travels.length, 1);
  assert.equal(one.signal.aborted, false);
  // A different hash is a different target.
  const two = env.nav.go(`${B}#top-50`);
  assert.notEqual(two, one);
  assert.equal(one.signal.aborted, true);
});

test('rule 2: repeated clicks while the committed page is still travelling change nothing', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  assert.equal(one.state, 'committed');
  assert.equal(env.nav.go(B), one);
  assert.deepEqual(env.calls('samePage'), []);
  assert.deepEqual(env.travels[0].calls, []);
  env.travels[0].end();
  assert.equal(await one.settled, true);
});

test('rule 2: the committed path with nothing pending calls samePage, with and without a hash', async () => {
  const env = await started();
  const top = env.nav.go(A);
  const frag = env.nav.go(`${A}#film-kick`);
  const alias = env.nav.go(`${ORIGIN}/index.html`);
  assert.deepEqual(env.calls('samePage'), [
    ['samePage', top.id, '/', 'link'],
    ['samePage', frag.id, '/#film-kick', 'link'],
    ['samePage', alias.id, '/', 'link'],
  ]);
  assert.equal(env.fetches.length, 0);
  assert.equal(env.travels.length, 0);
  assert.equal(env.h.entries.length, 1, 'samePage leaves history to the router');
  assert.equal(top.state, 'settled');
  assert.equal(await frag.committed, true);
  assert.equal(await frag.settled, true);
  assert.equal(env.nav.committed.hash, '');
});

test('rule 2: same page from a fragment back to the top rewrites the entry, never pushes', async () => {
  const env = await started({ at: `${A}#film-kick` });
  const top = env.nav.go(A);
  assert.equal(top.state, 'settled');
  assert.deepEqual(env.calls('samePage'), [['samePage', top.id, '/', 'link']]);
  assert.deepEqual(env.calls('replace'), [['replace', A]]);
  assert.deepEqual(env.calls('push'), []);
  assert.equal(env.h.entries.length, 1);
  // With a hash: samePage handles the fragment (the router lets the browser add the entry).
  const frag = env.nav.go(`${A}#contact`);
  assert.deepEqual(env.calls('samePage').at(-1), ['samePage', frag.id, '/#contact', 'link']);
  assert.equal(env.calls('replace').length, 1);
  assert.equal(env.nav.committed.hash, '#contact');
});

// ---- Rule 3 ---------------------------------------------------------------------------------

test('rule 3: fetch and travel start together; commit runs while travel plays; settled after both', async () => {
  const env = await started();
  const one = env.nav.go(B);
  assert.deepEqual(env.log.map(e => e[0]), ['status', 'fetch', 'travel']);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  assert.deepEqual(env.calls('commit'), [['commit', one.id, 'gallery', 'link']]);
  assert.equal(one.state, 'committed');
  assert.equal(await one.committed, true);
  assert.equal(await peek(one.settled), 'pending');
  env.travels[0].end();
  assert.equal(await one.settled, true);
  assert.equal(one.state, 'settled');
  assert.equal(env.nav.committed.page, 'gallery');
});

test('rule 3: a journey that ends before the page arrives settles on commit', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.travels[0].end();
  await flush();
  assert.equal(one.state, 'pending');
  env.fetches[0].resolve({ page: 'gallery' });
  assert.equal(await one.settled, true);
  assert.equal(one.state, 'settled');
});

test('rule 3: without a journey (reduced motion, no world) the intent settles at commit', async () => {
  const env = await started({ travel: false });
  const one = env.nav.go(B);
  assert.equal(env.calls('travel').length, 1, 'travel is asked and answers null');
  env.fetches[0].resolve({ page: 'gallery' });
  assert.equal(await one.settled, true);
  assert.equal(one.state, 'settled');
});

test('rule 3: a travel hook that throws or returns junk counts as no journey', async () => {
  const silence = console.error;
  console.error = () => {};
  try {
    const env = await started({ travel: () => { throw new Error('boom'); } });
    const one = env.nav.go(B);
    env.fetches[0].resolve({ page: 'gallery' });
    assert.equal(await one.settled, true);
  } finally { console.error = silence; }
});

test('rule 3: an asynchronous commit resolves committed only when it is done', async () => {
  const env = await started({ commitAsync: true });
  const one = env.nav.go(B);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  assert.equal(env.calls('commit').length, 1);
  assert.equal(one.state, 'pending');
  assert.equal(env.nav.committed.page, 'gallery', 'the page counts as shown once commit starts');
  assert.equal(await peek(one.committed), 'pending');
  env.pending.shift().run();
  assert.equal(await one.committed, true);
  assert.equal(one.state, 'committed');
  env.travels[0].end();
  assert.equal(await one.settled, true);
});

// ---- Rule 4 ---------------------------------------------------------------------------------

test('rule 4: history is pushed by commit only, and never for pop or initial', async () => {
  assert.equal(pushesHistory({ source: 'link' }), true);
  assert.equal(pushesHistory({ source: 'hotspot' }), true);
  assert.equal(pushesHistory({ source: 'retry' }), true);
  assert.equal(pushesHistory({ source: 'pop' }), false);
  assert.equal(pushesHistory({ source: 'initial' }), false);

  const env = setup();
  env.nav.go(A, { source: 'initial' });
  await flush();
  assert.deepEqual(env.calls('push'), [], 'initial');
  const one = env.nav.go(B);
  env.advance(2000);                               // slow, still nothing in history
  assert.deepEqual(env.calls('push'), []);
  assert.deepEqual(env.calls('replace'), []);
  env.fetches[0].resolve({ page: 'gallery' });
  await one.committed;
  assert.deepEqual(env.calls('push'), [['push', B]]);
  const commitAt = env.log.findLastIndex(e => e[0] === 'commit');
  assert.ok(env.log.findIndex(e => e[0] === 'push') > commitAt);
  // Back: the entry exists, nothing is pushed.
  env.back();
  const pop = env.nav.go(env.url, { source: 'pop', state: { y: 120 } });
  env.fetches[1].resolve({ page: 'home' });
  await pop.committed;
  assert.equal(env.calls('push').length, 1);
  assert.deepEqual(pop.historyState, { y: 120 });
  assert.equal(env.h.entries.length, 2);
  assert.equal(env.url, A);
});

// ---- Rule 5 ---------------------------------------------------------------------------------

test('rule 5: a failed fetch cancels travel, reports an error with retry, and leaves the page', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.fetches[0].reject(new Error('HTTP 500'));
  await flush();
  assert.equal(one.state, 'failed');
  assert.deepEqual(env.travels[0].calls, ['cancel']);
  assert.equal(await one.committed, false);
  assert.equal(await one.settled, false);
  const error = env.calls('status').at(-1);
  assert.equal(error[2], 'error');
  assert.equal(error[3].error.message, 'HTTP 500');
  assert.equal(typeof error[3].retry, 'function');
  assert.deepEqual(env.calls('commit'), []);
  assert.deepEqual(env.calls('hard'), []);
  assert.equal(env.url, A);
  assert.equal(env.nav.committed.page, 'home');

  // Retry runs the same destination as a new intent and succeeds.
  const again = error[3].retry();
  assert.equal(again.source, 'retry');
  assert.equal(again.id, one.id + 1);
  assert.equal(env.calls('status').at(-1)[2], 'loading', 'the next intent clears the error');
  env.fetches[1].resolve({ page: 'gallery' });
  env.travels[1].end();
  assert.equal(await again.settled, true);
  assert.equal(env.url, B);
});

test('rule 5: after a failure, choosing the same link again fetches again', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.fetches[0].reject(new Error('HTTP 502'));
  await flush();
  assert.equal(one.state, 'failed');
  const two = env.nav.go(B);
  assert.notEqual(two, one, 'a failed intent is not reused');
  assert.equal(env.fetches.length, 2);
  assert.equal(env.travels.length, 2);
  env.fetches[1].resolve({ page: 'gallery' });
  env.travels[1].end();
  assert.equal(await two.settled, true);
  assert.deepEqual(env.calls('push'), [['push', B]]);
});

test('rule 5: a failed initial commit never reloads the page it is already on', async () => {
  const silence = console.error;
  console.error = () => {};
  try {
    const env = setup({ commitAsync: true });
    const first = env.nav.go(env.url, { source: 'initial' });
    env.pending.shift().fail(new Error('mount failed'));
    assert.equal(await first.committed, true);
    assert.equal(await first.settled, true);
    assert.deepEqual(env.calls('hard'), []);
    // Navigation still works afterwards.
    const one = env.nav.go(B);
    env.fetches[0].resolve({ page: 'gallery' });
    await flush();
    env.pending.shift().run();
    env.travels[0].end();
    assert.equal(await one.settled, true);
  } finally { console.error = silence; }
});

test('rule 5: nav.retry() re-runs only a failed latest intent', async () => {
  const env = await started();
  assert.equal(env.nav.retry(), null);
  const one = env.nav.go(B);
  assert.equal(env.nav.retry(), null, 'pending is not failed');
  env.fetches[0].reject(new Error('offline'));
  await flush();
  const retryFromStatus = env.calls('status').at(-1)[3].retry;
  const two = env.nav.retry();
  assert.equal(two.url, one.url);
  assert.equal(two.route.page, 'gallery');
  assert.equal(retryFromStatus(), null, 'a stale retry button does nothing');
});

test('rule 5: a failed Back/Forward fetch loads the page for real', async () => {
  const env = await started();
  env.nav.go(B);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  env.back();
  const pop = env.nav.go(env.url, { source: 'pop', state: { y: 0 } });
  env.fetches[1].reject(new Error('HTTP 404'));
  await flush();
  assert.deepEqual(env.calls('hard'), [['hard', A]]);
  assert.equal(pop.state, 'failed');
  assert.equal(env.statuses().includes(`${pop.id}:error`), false);
});

test('rule 5: aborts are not failures', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.nav.go(C);
  await flush();                                   // the fake rejects B with AbortError
  assert.equal(one.state, 'cancelled');
  assert.equal(env.statuses().some(s => s.endsWith(':error')), false);
  assert.deepEqual(env.calls('hard'), []);
});

test('rule 5: a commit that throws falls back to a real page load', async () => {
  const silence = console.error;
  console.error = () => {};
  try {
    const env = await started({ commitAsync: true });
    const one = env.nav.go(B);
    env.fetches[0].resolve({ page: 'gallery' });
    await flush();
    env.pending.shift().fail(new Error('swap failed'));
    assert.equal(await one.committed, false);
    assert.deepEqual(env.calls('hard'), [['hard', B]]);
    assert.equal(one.state, 'failed');
  } finally { console.error = silence; }
});

// ---- Rule 6 ---------------------------------------------------------------------------------

test('rule 6: a fetch slower than 1200 ms reports slow; a fast one does not', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.advance(1199);
  assert.deepEqual(env.statuses(), [`${one.id}:loading`]);
  env.advance(1);
  assert.deepEqual(env.statuses(), [`${one.id}:loading`, `${one.id}:slow`]);
  assert.equal(env.calls('status').at(-1)[3].elapsed, 1200);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  assert.equal(env.statuses().at(-1), `${one.id}:idle`, 'slow is cleared when the page arrives');

  const two = env.nav.go(C);
  env.advance(300);
  env.fetches[1].resolve({ page: 'chess' });
  await flush();
  assert.equal(env.timerCount(), 0);
  env.advance(5000);
  assert.deepEqual(env.statuses().filter(s => s.startsWith(`${two.id}:`)), [`${two.id}:loading`, `${two.id}:idle`]);
});

test('rule 6: the next intent clears slow and error states', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.advance(1500);
  const two = env.nav.go(C);
  assert.equal(env.statuses().at(-1), `${two.id}:loading`);
  env.fetches[1].reject(new Error('HTTP 503'));
  await flush();
  assert.equal(env.statuses().at(-1), `${two.id}:error`);
  const three = env.nav.go(A);                     // same page: samePage, and idle
  assert.equal(env.statuses().at(-1), `${three.id}:idle`);
  assert.equal(one.state, 'cancelled');
});

// ---- Rule 7 ---------------------------------------------------------------------------------

test('rule 7: a stale page that arrives after a later intent began is dropped', async () => {
  const env = await started({ abortable: false });   // the old fetch resolves late instead
  const one = env.nav.go(B);
  const two = env.nav.go(C);
  env.fetches[1].resolve({ page: 'chess' });
  await flush();
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  assert.deepEqual(env.calls('commit').map(e => e[2]), ['chess']);
  assert.equal(env.nav.committed.page, 'chess');
  assert.equal(one.state, 'cancelled');
  assert.equal(two.state, 'committed');
});

test('rule 7: a stale fetch failing after a later intent began reports nothing', async () => {
  const env = await started({ abortable: false });
  const one = env.nav.go(B);
  const two = env.nav.go(C);
  env.fetches[0].reject(new Error('HTTP 500'));     // the cancelled page fails late
  await flush();
  assert.equal(one.state, 'cancelled');
  assert.equal(two.state, 'pending');
  assert.equal(env.statuses().some(s => s.endsWith(':error')), false);
  assert.deepEqual(env.calls('hard'), []);
  env.fetches[1].resolve({ page: 'chess' });
  env.travels[1].end();
  assert.equal(await two.settled, true);
});

test('rule 7: a stale journey finishing later does not settle the new intent', async () => {
  const env = await started();
  env.nav.go(B);
  const two = env.nav.go(C);
  env.travels[0].end();                            // already cancelled: no effect
  env.fetches[1].resolve({ page: 'chess' });
  await flush();
  assert.equal(two.state, 'committed');
  env.travels[1].end();
  assert.equal(await two.settled, true);
});

// ---- Sequences --------------------------------------------------------------------------------

test('Back while the next page is still loading: the pending link intent is dropped', async () => {
  const env = await started({ at: Z, abortable: false });
  env.push(A);                                     // Z, A (current)
  env.nav.go(A, { source: 'initial' });
  await flush();
  env.log.length = 0;
  const link = env.nav.go(B);
  env.back();                                      // address bar: Z
  const pop = env.nav.go(env.url, { source: 'pop', state: { y: 300 } });
  assert.equal(link.signal.aborted, true);
  assert.deepEqual(env.travels[0].calls, ['cancel']);
  env.fetches[0].resolve({ page: 'gallery' });     // the dropped page, late
  env.fetches[1].resolve({ page: 'about' });
  await flush();
  assert.deepEqual(env.calls('commit'), [['commit', pop.id, 'about', 'pop']]);
  assert.deepEqual(env.calls('push'), []);
  assert.deepEqual(env.h.entries.map(e => e.url), [Z, A]);
  assert.equal(env.h.index, 0);
  assert.equal(env.nav.committed.page, 'about');
});

test('Back while the committed page is still travelling: the journey is cancelled', async () => {
  const env = await started();
  const link = env.nav.go(B);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  assert.equal(link.state, 'committed');
  env.back();
  const pop = env.nav.go(env.url, { source: 'pop', state: { y: 40 } });
  assert.deepEqual(env.travels[0].calls, ['cancel']);
  assert.equal(link.state, 'cancelled');
  assert.equal(await link.committed, true, 'its page did go in');
  assert.equal(await link.settled, false);
  assert.equal(env.fetches.length, 2, 'the previous page is fetched again');
  env.fetches[1].resolve({ page: 'home' });
  env.travels[1].end();
  assert.equal(await pop.settled, true);
  assert.deepEqual(env.calls('commit').map(e => [e[2], e[3]]), [['gallery', 'link'], ['home', 'pop']]);
  assert.equal(env.h.entries.length, 2);
});

test('Forward again before the Back page arrives returns to the page on screen', async () => {
  const env = await started();
  env.nav.go(B);
  env.fetches[0].resolve({ page: 'gallery' });
  env.travels[0].end();
  await flush();
  env.back();                                      // A, pending
  const pop = env.nav.go(env.url, { source: 'pop', state: { y: 10 } });
  env.forward();                                   // B again: the page that is still shown
  const fwd = env.nav.go(env.url, { source: 'pop', state: { y: 0 } });
  assert.equal(pop.signal.aborted, true);
  assert.deepEqual(env.calls('samePage'), [['samePage', fwd.id, '/image%20portfolio/gallery.html', 'pop']]);
  assert.equal(fwd.state, 'settled');
});

test('rapid A → B → A: B is dropped and A stays without a fetch', async () => {
  const env = await started({ abortable: false });
  const b = env.nav.go(B);
  const a = env.nav.go(A);
  assert.equal(b.signal.aborted, true);
  assert.deepEqual(env.travels[0].calls, ['cancel']);
  assert.deepEqual(env.calls('samePage'), [['samePage', a.id, '/', 'link']]);
  env.fetches[0].resolve({ page: 'gallery' });   // late, and dropped
  await flush();
  assert.deepEqual(env.calls('commit'), []);
  assert.equal(env.h.entries.length, 1);
  assert.equal(env.nav.committed.page, 'home');
  assert.equal(await b.settled, false);
  assert.equal(await a.settled, true);
});

test('rapid A → B → C → B: only the last B commits', async () => {
  const env = await started();
  env.nav.go(B);
  env.nav.go(C);
  const last = env.nav.go(B);
  assert.equal(env.fetches.length, 3);
  assert.deepEqual(env.travels.map(t => t.calls), [['cancel'], ['cancel'], []]);
  env.fetches[2].resolve({ page: 'gallery' });
  env.travels[2].end();
  assert.equal(await last.settled, true);
  assert.deepEqual(env.calls('commit').map(e => e[1]), [last.id]);
});

test('skip finishes the journey; the intent settles once its page is in', async () => {
  const env = await started();
  const one = env.nav.go(B);
  env.nav.skip();
  assert.deepEqual(env.travels[0].calls, ['skip']);
  await flush();
  assert.equal(one.state, 'pending');
  env.fetches[0].resolve({ page: 'gallery' });
  assert.equal(await one.settled, true);
  env.nav.skip();                                  // nothing to skip any more
  assert.deepEqual(env.travels[0].calls, ['skip']);

  const two = env.nav.go(C);
  env.fetches[1].resolve({ page: 'chess' });
  await flush();
  assert.equal(two.state, 'committed');
  env.nav.skip();
  assert.equal(await two.settled, true);
});

test('initial: the page in the document commits without fetch or travel', async () => {
  const env = setup({ at: `${C}#recent` });
  const first = env.nav.go(env.url, { source: 'initial', state: { y: 900 } });
  assert.deepEqual(env.log.map(e => e[0]), ['status', 'commit']);
  assert.deepEqual(env.calls('commit'), [['commit', first.id, null, 'initial']]);
  assert.equal(await first.settled, true);
  assert.equal(env.nav.committed.page, 'chess');
  assert.equal(env.nav.committed.hash, '#recent');
  assert.deepEqual(first.historyState, { y: 900 });
});

test('a URL outside the shell is loaded for real and drops the pending intent', async () => {
  const env = await started();
  const one = env.nav.go(B);
  assert.equal(env.nav.go(`${ORIGIN}/ai-timeline/`), null);
  assert.equal(env.nav.go(`${ORIGIN}/resume/resume.pdf`), null);
  assert.deepEqual(env.calls('hard').map(e => e[1]), [`${ORIGIN}/ai-timeline/`, `${ORIGIN}/resume/resume.pdf`]);
  assert.equal(one.signal.aborted, true);
  assert.equal(one.state, 'cancelled');
});

test('intent promises never reject', async () => {
  const env = await started();
  const intents = [env.nav.go(B), env.nav.go(C)];
  env.fetches[1].reject(new Error('boom'));
  intents.push(env.nav.go(`${ORIGIN}/about/`));
  env.fetches[2].reject(Object.assign(new Error('x'), { name: 'AbortError' }));
  await flush();
  for (const intent of intents) {
    assert.equal(typeof await intent.committed, 'boolean');
    assert.equal(typeof await intent.settled, 'boolean');
  }
});

test('superseded during an asynchronous commit: committed true, settled false', async () => {
  const env = await started({ commitAsync: true });
  const one = env.nav.go(B);
  env.fetches[0].resolve({ page: 'gallery' });
  await flush();
  const two = env.nav.go(C);                       // while B's commit is still running
  assert.equal(two.route.page, 'chess');
  assert.equal(env.fetches.length, 2, 'C is not mistaken for the page on screen');
  assert.equal(one.state, 'cancelled');
  env.pending.shift().run();
  assert.equal(await one.committed, true);
  assert.equal(await one.settled, false);
  assert.equal(one.state, 'cancelled');
  env.fetches[1].resolve({ page: 'chess' });
  await flush();
  env.pending.shift().run();
  env.travels[1].end();
  assert.equal(await two.settled, true);
});
