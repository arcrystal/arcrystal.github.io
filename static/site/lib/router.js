// Router: the DOM side of navigation. It intercepts ordinary links to site pages, fetches the next
// page, swaps <main> (and any [data-swap] parts), and keeps the body, header, title, meta, page
// stylesheets, history, scroll, focus and announcer in step. Which navigation wins is decided in
// nav-core.js; the expand effects join in through travel/beforeSwap/afterSwap, the page
// modules through mountPage/unmountPage.
import { createNavCore, pushesHistory } from './nav-core.js';
import { createRoutes, absolutizeAttr, absolutizeSrcset, decodePath } from './routes.js';

const META = [
  ['name', 'description'], ['name', 'theme-color'],
  ['property', 'og:title'], ['property', 'og:url'], ['property', 'og:description'], ['property', 'og:image'],
];
const STYLE_WAIT_MS = 2500;  // longest wait for a new page's stylesheets before swapping anyway
const URL_ATTRS = ['src', 'href', 'poster', 'data-src'];
const Y_THROTTLE_MS = 200;   // replaceState is rate-limited (Safari: 100 calls per 10 s)

export function createRouter({
  registry, routes = createRoutes(registry),
  travel, settle, samePage, status, mountPage, unmountPage, announce,
  swapped,                   // optional: (intent, pageDoc) after the DOM swap, before mounting
  beforeSwap,                // optional: async (intent) before the swap (the opening covers the viewport)
  afterSwap,                 // optional: (intent) once the new page is mounted and placed
  focusTarget,               // optional: (intent, main) → element to focus instead of the <h1>
} = {}) {
  let started = false;
  let lastPath = null;       // decoded path of the location the router last saw
  let contentPath = null;    // canonical path of the page whose <main> is in the document
  let queue = Promise.resolve();
  let yTimer = 0;
  let announcer = null;

  const here = () => routes.routeOf(location.href, location.href);
  const motionPaused = () => document.documentElement.classList.contains('motion-paused');

  const nav = createNavCore({
    routeOf: url => routes.routeOf(url, location.href),
    currentUrl: () => location.href,
    fetchPage,
    commit,
    samePage: onSamePage,
    travel: intent => travel?.(intent) || null,
    status(intent, state, info) {
      document.documentElement.dataset.nav = state;
      status?.(intent, state, info);
    },
    hardNavigate,
    now: () => performance.now(),
  });

  // ---- Loading -------------------------------------------------------------------------------

  async function fetchPage(route, signal) {
    const target = new URL(route.url, location.href);
    target.hash = '';
    const res = await fetch(target.href, { signal, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`${route.url}: HTTP ${res.status}`);
    const html = await res.text();
    const base = res.url || target.href;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = doc.querySelector('main#main[data-page]');
    if (!main || !routes.hasPage(main.dataset.page)) throw new Error(`${route.url}: not a site page`);
    const swaps = new Map();
    doc.querySelectorAll('[data-swap]').forEach(el => {
      if (!el.closest('main') && !swaps.has(el.dataset.swap)) swaps.set(el.dataset.swap, el);
    });
    absolutize(main, base);
    swaps.forEach(el => absolutize(el, base));
    const meta = {};
    for (const [attr, name] of META) {
      const m = doc.querySelector(`meta[${attr}="${name}"]`);
      if (m) meta[name] = m.getAttribute('content') ?? '';
    }
    const styles = [...doc.querySelectorAll('link[rel="stylesheet"][data-page-style]')]
      .map(l => absolutizeAttr(l.getAttribute('href'), base));
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
    const world = doc.querySelector('section.world');
    // Take the parts into this document now and empty the parsed one: Chrome never releases a
    // parsed document that still holds a <video> or a <picture><source media> (every page has
    // both), so each visit used to keep a whole page in memory.
    const adopted = new Map([...swaps].map(([name, el]) => [name, document.importNode(el, true)]));
    const live = document.importNode(main, true);
    doc.documentElement.remove();
    return {
      url: base,
      title: doc.title,
      main: live,
      swaps: adopted,
      meta,
      body: { page: doc.body?.dataset.page, region: doc.body?.dataset.region, theme: doc.body?.dataset.theme, look: doc.body?.dataset.style,
              scheme: doc.body?.dataset.scheme, style: doc.body?.getAttribute('style') ?? null },
      styles,
      canonical,
      world: world ? { region: world.dataset.region, label: world.getAttribute('aria-label') } : null,
    };
  }

  // Imported markup keeps working: relative URLs resolve against the page they came from.
  function absolutize(root, base) {
    for (const el of [root, ...root.querySelectorAll('[src],[href],[poster],[srcset],[data-src]')]) {
      for (const attr of URL_ATTRS) {
        const v = el.getAttribute(attr);
        if (v == null) continue;
        const next = absolutizeAttr(v, base);
        if (next !== v) el.setAttribute(attr, next);
      }
      const set = el.getAttribute('srcset');
      if (set) {
        const next = absolutizeSrcset(set, base);
        if (next !== set) el.setAttribute('srcset', next);
      }
    }
  }

  // ---- Commit --------------------------------------------------------------------------------

  // Commits run strictly in turn, so page modules mount and unmount in order even when a newer
  // page arrives while the previous one is still mounting.
  function commit(intent, doc) {
    const run = queue.then(() => (intent.source === 'initial' ? commitInitial(intent) : swapIn(intent, doc)));
    queue = run.catch(() => {});
    return run;
  }

  async function commitInitial(intent) {
    const route = intent.route;
    const main = document.querySelector('main#main');
    lastPath = decodePath(location.pathname);
    contentPath = route.path;
    settleWorld(route, intent);              // no journey on arrival: the world starts in place
    // A reload or a return from another site puts the reader back where they were; otherwise the
    // hash is honoured below the sticky header. Both again once the page module has mounted
    // (tabs and other mounted layout), unless the reader moved. Focus stays where the browser put it.
    const y = history.state?.y;
    const restoring = typeof y === 'number';
    const placeInitial = () => {
      if (restoring) scrollToY(y);
      else if (route.hash) {
        const target = findTarget(route.hash);
        if (target) scrollToY(targetY(target.scroll));
      }
    };
    placeInitial();
    const userMoved = watchUser();
    await mountPageSafely(main, { intent, restoring });
    if (userMoved() || intent.signal.aborted) return;
    placeInitial();
  }

  async function swapIn(intent, doc) {
    const route = intent.route;
    await ensureStyles(doc.styles || [], intent.signal);
    if (beforeSwap) await beforeSwap(intent);
    if (intent.signal.aborted) throw abortError();
    if (pushesHistory(intent) && here()?.path === contentPath) saveY();   // leaving position, for Back
    const from = contentPath ? routes.routeOf(location.href, location.href)?.key ?? null : null;
    try { unmountPage?.(); } catch (err) { console.error(err); }
    const main = doc.main;                   // already imported into this document by fetchPage
    document.querySelector('main#main')?.replaceWith(main);
    document.querySelectorAll('[data-swap]').forEach(el => {
      if (el.closest('main#main')) return;
      const incoming = doc.swaps.get(el.dataset.swap);
      if (incoming) el.replaceWith(incoming);
    });
    syncDocument(route, doc, main);
    contentPath = route.path;
    if (pushesHistory(intent)) {
      try { history.pushState({ y: 0, from }, '', href(route)); } catch (err) { console.error(err); }
    }
    lastPath = decodePath(location.pathname);
    // The world places itself at the committed page (a journey arriving there carries on).
    settleWorld(route, intent);
    try { swapped?.(intent, doc); } catch (err) { console.error(err); }

    const placed = place(intent);
    const userMoved = watchUser();
    await mountPageSafely(main, { intent, restoring: !!placed.restored });
    const moved = userMoved();
    if (intent.signal.aborted) return;       // a newer intent owns scroll and focus now
    // Mounting can change the layout (tabs hide panels) or render the fragment's element: place
    // again unless the reader moved.
    if (!moved && (route.hash || placed.restored)) placed.target = place(intent, true).target || placed.target;
    let custom = null;
    try { custom = focusTarget?.(intent, main) || null; } catch (err) { console.error(err); }
    focusOn(placed.target?.focus || custom || main.querySelector('h1') || main);
    say(document.title);
    try { afterSwap?.(intent); } catch (err) { console.error(err); }
  }

  function abortError() {
    const err = new Error('navigation superseded');
    err.name = 'AbortError';
    return err;
  }

  // Adds the incoming page's stylesheets ([data-page-style]) that are not in the document yet and
  // waits for them (bounded), so the new content never shows unstyled. Loaded ones stay: they are
  // scoped to their destination and make Back and Forward instant.
  function ensureStyles(hrefs, signal) {
    const have = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(l => new URL(l.getAttribute('href'), location.href).href));
    const waits = [];
    for (const h of hrefs) {
      const abs = new URL(h, location.href).href;
      if (have.has(abs)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = h;
      link.dataset.pageStyle = '';
      waits.push(new Promise(resolve => { link.onload = link.onerror = resolve; }));
      document.head.append(link);
    }
    if (!waits.length) return Promise.resolve();
    return Promise.race([Promise.all(waits), new Promise(r => setTimeout(r, STYLE_WAIT_MS)),
      new Promise(r => signal?.addEventListener('abort', r, { once: true }))]);
  }

  function settleWorld(route, intent) {
    try { settle?.(route, intent); } catch (err) { console.error(err); }
  }

  // mountPage(main, { intent, restoring }): restoring is true when the router puts back a saved
  // scroll position, so the page should not scroll to its fragment by itself.
  async function mountPageSafely(main, info) {
    try { await mountPage?.(main, info); } catch (err) { console.error(`The ${main?.dataset.page} page failed to mount:`, err); }
  }

  // Did the reader scroll, tap or press a key since this was called?
  function watchUser() {
    let moved = false;
    const mark = () => { moved = true; };
    const types = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    types.forEach(t => addEventListener(t, mark, { passive: true, capture: true }));
    return () => {
      types.forEach(t => removeEventListener(t, mark, { capture: true }));
      return moved;
    };
  }

  function syncDocument(route, doc, main) {
    const body = document.body;
    const data = main.dataset;
    setData(body, 'page', data.page || doc.body.page || route.page);
    setData(body, 'region', doc.body.region);
    setData(body, 'theme', doc.body.theme);
    setData(body, 'scheme', doc.body.scheme ?? data.scheme);
    setData(body, 'style', doc.body.look ?? data.style);
    if (doc.body.style) body.setAttribute('style', doc.body.style); else body.removeAttribute('style');
    const world = document.querySelector('section.world');
    if (world && doc.world) {
      setData(world, 'region', doc.world.region || route.region);
      if (doc.world.label != null) world.setAttribute('aria-label', doc.world.label);
    }
    document.querySelectorAll('.site-header [data-nav-key], .site-header [data-nav]').forEach(a => {
      const key = a.dataset.nav ?? a.dataset.navKey;
      if (key === route.key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (doc.canonical) {
      let c = document.head.querySelector('link[rel="canonical"]');
      if (!c) { c = document.createElement('link'); c.rel = 'canonical'; document.head.append(c); }
      c.setAttribute('href', doc.canonical);
    }
    document.title = doc.title || data.title || document.title;
    for (const [attr, name] of META) {
      if (!(name in doc.meta)) continue;
      let m = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute(attr, name);
        document.head.append(m);
      }
      m.setAttribute('content', doc.meta[name]);
    }
  }

  function setData(el, key, value) {
    if (value == null || value === '') delete el.dataset[key];
    else el.dataset[key] = value;
  }

  // Canonical path, the link's own query, then the hash.
  function href(route) {
    return route.url.slice(0, route.url.length - route.hash.length) + (route.search || '') + route.hash;
  }

  // ---- Scroll and focus ----------------------------------------------------------------------

  // Restore y for Back/Forward, else the fragment target below the sticky header, else the top.
  function place(intent, again = false) {
    const route = intent.route;
    const target = route.hash ? findTarget(route.hash) : null;
    const y = intent.historyState?.y;
    if (intent.source === 'pop' && typeof y === 'number') {
      scrollToY(y);
      return { y: scrollY, target, restored: true };
    }
    if (target) {
      scrollToY(targetY(target.scroll));
      return { y: scrollY, target };
    }
    if (!again) scrollToY(0);
    return { y: scrollY, target: null };
  }

  // A fragment names an element, or a tab of a hash-driven tab system (athletics #races …):
  // scroll to the tab system and focus the tab.
  function findTarget(hash) {
    const id = decodePath(hash.replace(/^#/, ''));
    if (!id) return null;
    const el = document.getElementById(id);
    if (el) return { scroll: el, focus: el };
    const tab = [...document.querySelectorAll('main [role="tab"][data-tab]')].find(t => t.dataset.tab === id);
    if (tab) return { scroll: tab.closest('[data-tabs]') || tab, focus: tab };
    return null;
  }

  function headerOffset() {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    if (pad > 0) return pad;
    const header = document.querySelector('.site-header');
    if (!header) return 0;
    const pos = getComputedStyle(header).position;
    return pos === 'sticky' || pos === 'fixed' ? header.getBoundingClientRect().height : 0;
  }

  // The layout position, without transforms: a reveal still sliding into place (translateY) would
  // otherwise leave the target tucked under the sticky header once it settles.
  function targetY(el) {
    let top = 0;
    if (el instanceof HTMLElement) for (let n = el; n; n = n.offsetParent) top += n.offsetTop;
    else top = el.getBoundingClientRect().top + scrollY;
    return top - headerOffset();
  }

  function scrollToY(y, smooth = false) {
    const top = Math.max(0, Math.round(y));
    try { scrollTo({ top, left: 0, behavior: smooth ? 'smooth' : 'instant' }); } catch (_) { scrollTo(0, top); }
  }

  function focusOn(el) {
    if (!el) return;
    if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }

  function say(text) {
    if (announce) { announce(text); return; }
    if (!announcer) {
      announcer = document.createElement('p');
      announcer.className = 'sr-only';
      announcer.setAttribute('aria-live', 'polite');
      document.body.append(announcer);
    }
    announcer.textContent = text;
  }

  // ---- Same page ----------------------------------------------------------------------------

  function onSamePage(route, intent) {
    // Content already shows this page, but a superseded Back may have left another URL behind.
    if (here()?.path !== route.path) {
      try { history.pushState({ y: scrollY }, '', href(route)); } catch (err) { console.error(err); }
      lastPath = decodePath(location.pathname);
    }
    if (intent.source === 'pop') {
      const y = intent.historyState?.y;
      if (typeof y === 'number') scrollToY(y);
    } else if (route.hash) {
      // Native fragment navigation: history entry, hashchange (hash tabs listen) and scroll.
      if (location.hash !== route.hash) {
        flushY();
        location.hash = route.hash;
      }
      const target = findTarget(route.hash);
      if (target) {
        scrollToY(targetY(target.scroll));
        focusOn(target.focus);
      }
    } else {
      if (location.hash || location.search !== (route.search || '')) {
        try { history.replaceState(history.state, '', href(route)); } catch (_) {}
      }
      scrollToY(0, !motionPaused());
      const main = document.querySelector('main#main');
      focusOn(main?.querySelector('h1') || main);
    }
    samePage?.(route, intent);
  }

  // ---- History -------------------------------------------------------------------------------

  function saveY() {
    const s = history.state;
    try { history.replaceState({ ...(s && typeof s === 'object' ? s : {}), y: Math.round(scrollY) }, ''); } catch (_) {}
  }

  function onScroll() {
    if (!yTimer) yTimer = setTimeout(recordY, Y_THROTTLE_MS);
  }

  // Record a position still waiting for the throttle, before the entry changes.
  function flushY() {
    if (!yTimer) return;
    clearTimeout(yTimer);
    recordY();
  }

  function recordY() {
    yTimer = 0;
    // While a Back/Forward page is loading the URL already names the next entry: leave it be.
    if (here()?.path !== contentPath) return;
    if (history.state?.y === Math.round(scrollY)) return;
    saveY();
  }

  function onPop(e) {
    // A position still waiting to be recorded belongs to the entry just left.
    clearTimeout(yTimer);
    yTimer = 0;
    const path = decodePath(location.pathname);
    // Hash-only steps on the same page are the browser's (unless a page is on its way: then
    // Back means "stay here"). Scroll restoration is manual, so put back the position the entry
    // recorded, as the browser's own restoration would have.
    if (path === lastPath && nav.latest?.state !== 'pending') {
      if (typeof e.state?.y === 'number') scrollToY(e.state.y);
      return;
    }
    lastPath = path;
    nav.go(location.href, { source: 'pop', state: e.state });
  }

  function hardNavigate(url) {
    const u = new URL(url, location.href);
    if (u.href === location.href) location.reload();
    else location.assign(u.href);
  }

  // ---- Links ---------------------------------------------------------------------------------

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    const target = a.getAttribute('target');
    if (target && target.toLowerCase() !== '_self') return;
    if (a.hasAttribute('download') || a.closest('[data-router="off"], [data-liquid="off"]')) return;
    let url;
    try { url = new URL(a.getAttribute('href'), document.baseURI); } catch (_) { return; }
    if (!routes.routeOf(url.href, location.href)) return;   // other origins, files, apps
    // In-page fragment links stay native, unless they should overrule a page on its way.
    const fragment = url.pathname === location.pathname && url.search === location.search
      && (url.hash !== '' || url.href.endsWith('#'));
    if (fragment && nav.latest?.state !== 'pending') { flushY(); return; }
    e.preventDefault();
    const source = a.closest('[data-world-markers], .world-places') ? 'hotspot' : 'link';
    nav.go(url.href, { source });
  }

  // ---- Public --------------------------------------------------------------------------------

  return {
    // Take over navigation on a routed page; commits the page already in the document.
    start() {
      if (started) return nav.latest;
      const main = document.querySelector('main#main[data-page]');
      if (!main || !here() || !routes.hasPage(main.dataset.page)) return null;
      started = true;
      try { history.scrollRestoration = 'manual'; } catch (_) {}
      lastPath = decodePath(location.pathname);
      document.addEventListener('click', onClick);
      addEventListener('popstate', onPop);
      addEventListener('scroll', onScroll, { passive: true });
      return nav.go(location.href, { source: 'initial', state: history.state });
    },
    stop() {
      if (!started) return;
      started = false;
      document.removeEventListener('click', onClick);
      removeEventListener('popstate', onPop);
      removeEventListener('scroll', onScroll);
      clearTimeout(yTimer);
      yTimer = 0;
    },
    // Programmatic navigation; URLs outside the shell load for real.
    go(url, opts = {}) {
      return nav.go(new URL(url, location.href).href, { source: 'link', ...opts });
    },
    nav,
    routes,
    get current() { return nav.committed; },
  };
}
