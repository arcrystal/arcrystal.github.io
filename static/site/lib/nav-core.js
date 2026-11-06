// Navigation controller: decides which navigation wins. Pure: no DOM and no globals beyond
// AbortController and timers; every side effect is an injected dependency (the router in the
// browser, fakes in tools/site/tests/nav-core.test.mjs).
//
// Each go() to a new target is an intent with its own id and AbortController. Starting one
// aborts the previous intent's fetch and cancels its travel, and every async continuation checks
// that its intent is still the latest before it touches content, history, focus, status or the
// world. Intent promises (committed, settled) resolve true or false and never reject.

const SLOW_MS = 1200;

// History policy for commit: every navigation adds an entry except Back/Forward (the entry
// exists) and the page the visitor loaded (it is the entry).
export const pushesHistory = intent => intent.source !== 'pop' && intent.source !== 'initial';

export function createNavCore(deps) {
  const {
    routeOf, currentUrl, fetchPage, commit, samePage, travel, status, hardNavigate,
    now = () => Date.now(),
    setTimeout: setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: clearTimer = id => globalThis.clearTimeout(id),
  } = deps;

  let seq = 0;
  let latest = null;
  let shown;                       // route currently shown; undefined until first needed
  const records = new WeakMap();   // intent → private bookkeeping

  const safeRoute = url => { try { return routeOf(url) || null; } catch (_) { return null; } };
  const isLatest = intent => intent === latest;
  const inFlight = intent => intent && (intent.state === 'pending' || intent.state === 'committed');
  const sameTarget = (a, b) => !!a && !!b && a.path === b.path && a.hash === b.hash;

  function shownRoute() {
    if (shown === undefined) shown = safeRoute(currentUrl());
    return shown;
  }

  function report(intent, state, info) {
    if (!isLatest(intent)) return;
    try { status?.(intent, state, info); } catch (err) { console.error(err); }
  }

  function create(url, route, source, historyState) {
    const controller = new AbortController();
    let resolveCommitted, resolveSettled;
    const intent = {
      id: ++seq, url, route, source, state: 'pending', signal: controller.signal,
      historyState: historyState ?? null, startedAt: now(),
      committed: new Promise(r => { resolveCommitted = r; }),
      settled: new Promise(r => { resolveSettled = r; }),
    };
    records.set(intent, {
      controller, travel: null, travelDone: true, slowTimer: 0, commitStarted: false,
      resolveCommitted, resolveSettled,
    });
    return intent;
  }

  function stopSlow(rec) {
    if (rec.slowTimer) { clearTimer(rec.slowTimer); rec.slowTimer = 0; }
  }

  function stopTravel(rec) {
    if (rec.travel && !rec.travelDone) {
      rec.travelDone = true;
      try { rec.travel.cancel(); } catch (err) { console.error(err); }
    }
  }

  // A newer intent replaces this one: abort its loads and journey; its promises settle false
  // (committed stays true when its content already went in, or resolves when a started commit ends).
  function supersede(intent) {
    if (!intent) return;
    const rec = records.get(intent);
    rec.controller.abort();
    stopSlow(rec);
    stopTravel(rec);
    if (intent.state === 'pending') {
      intent.state = 'cancelled';
      if (!rec.commitStarted) rec.resolveCommitted(false);
      rec.resolveSettled(false);
    } else if (intent.state === 'committed') {
      intent.state = 'cancelled';
      rec.resolveSettled(false);
    }
  }

  function trySettle(intent) {
    const rec = records.get(intent);
    if (!isLatest(intent) || intent.state !== 'committed' || !rec.travelDone) return;
    intent.state = 'settled';
    rec.resolveSettled(true);
  }

  function fail(intent, error) {
    const rec = records.get(intent);
    stopSlow(rec);
    stopTravel(rec);
    intent.state = 'failed';
    rec.resolveCommitted(false);
    rec.resolveSettled(false);
    if (intent.source === 'pop') {
      // The address bar already shows the destination: load it for real.
      try { hardNavigate(intent.url, intent); } catch (err) { console.error(err); }
      return;
    }
    report(intent, 'error', { error, retry: () => (isLatest(intent) ? api.retry() : null) });
  }

  function startCommit(intent, doc) {
    const rec = records.get(intent);
    rec.commitStarted = true;
    shown = intent.route;
    let result;
    try { result = commit(intent, doc); } catch (err) { return commitFailed(intent, err); }
    Promise.resolve(result).then(() => {
      rec.resolveCommitted(true);
      if (intent.state !== 'pending') return;      // superseded while committing
      intent.state = 'committed';
      trySettle(intent);
    }, err => commitFailed(intent, err));
  }

  // The DOM may be half swapped: fall back to a real page load (latest intent only). The initial
  // page is the real document already, so reloading it could only repeat the failure.
  function commitFailed(intent, err) {
    if (err?.name !== 'AbortError' || isLatest(intent)) console.error('Navigation commit failed:', err);
    const rec = records.get(intent);
    if (intent.source === 'initial') {
      rec.resolveCommitted(true);
      if (intent.state !== 'pending') return;
      intent.state = 'committed';
      trySettle(intent);
      return;
    }
    rec.resolveCommitted(false);
    if (!isLatest(intent)) return;
    stopTravel(rec);
    intent.state = 'failed';
    rec.resolveSettled(false);
    try { hardNavigate(intent.url, intent); } catch (e) { console.error(e); }
  }

  function startTravel(intent) {
    const rec = records.get(intent);
    let handle = null;
    try { handle = travel?.(intent) || null; } catch (err) { console.error(err); }
    if (!handle) return;
    rec.travel = handle;
    rec.travelDone = false;
    Promise.resolve(handle.finished).catch(() => 'cancelled').then(() => {
      if (rec.travelDone) return;                  // cancelled by a newer intent or a failure
      rec.travelDone = true;
      trySettle(intent);
    });
  }

  function go(input, { source = 'link', state } = {}) {
    const url = String(input);
    const route = safeRoute(url);
    const previous = latest;

    if (!route) {
      // Not a page of the shell: leave for real, dropping whatever was in flight.
      supersede(previous);
      latest = null;
      try { hardNavigate(url, null); } catch (err) { console.error(err); }
      return null;
    }

    // Repeated selection of the destination already on its way: nothing restarts.
    if (source !== 'initial' && inFlight(previous) && sameTarget(previous.route, route)) return previous;

    const intent = create(url, route, source, state);
    supersede(previous);
    latest = intent;
    const rec = records.get(intent);

    if (source === 'initial') {
      // The page is already in the document: commit it without fetching or travelling.
      report(intent, 'idle');
      startCommit(intent, null);
      return intent;
    }

    const here = shownRoute();
    if (here && here.path === route.path) {
      // Same page: fragment or top, and the world's overview. No fetch and no travel. It
      // settles first, so anything samePage triggers (a hash change, a popstate) sees it done.
      shown = route;
      intent.state = 'settled';
      rec.resolveCommitted(true);
      rec.resolveSettled(true);
      report(intent, 'idle');
      try { samePage(route, intent); } catch (err) { console.error(err); }
      return intent;
    }

    report(intent, 'loading');
    let loading;
    try { loading = Promise.resolve(fetchPage(route, intent.signal)); } catch (err) { loading = Promise.reject(err); }
    startTravel(intent);
    rec.slowTimer = setTimer(() => {
      rec.slowTimer = 0;
      if (isLatest(intent) && intent.state === 'pending' && !rec.commitStarted) {
        report(intent, 'slow', { elapsed: now() - intent.startedAt });
      }
    }, SLOW_MS);

    loading.then(doc => {
      if (!isLatest(intent) || intent.signal.aborted) return;   // stale: the page is dropped
      stopSlow(rec);
      report(intent, 'idle');
      startCommit(intent, doc);
    }, err => {
      if (!isLatest(intent) || intent.signal.aborted) return;   // aborts are not failures
      fail(intent, err);
    });
    return intent;
  }

  const api = {
    go,
    // Finish the current journey at once; the intent settles when its page is in.
    skip() {
      const rec = latest && records.get(latest);
      if (rec?.travel && !rec.travelDone) {
        try { rec.travel.skip(); } catch (err) { console.error(err); }
      }
    },
    // Re-run the last failed intent (the error status carries this as info.retry).
    retry() {
      if (!latest || latest.state !== 'failed') return null;
      return go(latest.url, { source: 'retry', state: latest.historyState });
    },
    get latest() { return latest; },
    get committed() { return shownRoute(); },
  };
  return api;
}
