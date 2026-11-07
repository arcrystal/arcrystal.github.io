// The site shell. Every URL is a complete static page; this module enhances it once per document:
// the header controls, the page's modules (the homepage, a destination's hero and its own
// module from meta.json), and the router, which swaps pages in place behind each style's expand
// effect. Content never waits for any of it, and if this module cannot load, ordinary links simply
// load pages for real.
import { motion, scope as makeScope } from './lib/util.js';
import { mountCommon } from './lib/common.js';
import { createRoutes } from './lib/routes.js';
import { createRouter } from './lib/router.js';
import { mountChrome } from './chrome.js';
import { createExpand } from './expand.js';
import { getScene } from './scene/scene.js';

let data = {};
try { data = JSON.parse(document.getElementById('site-data')?.textContent || '{}'); } catch (err) { console.error(err); }
const { registry, styles } = data;

document.documentElement.classList.add('app-ready');
// The scene canvas lives for the whole visit, outside <main>; it compiles once the page has painted.
getScene();
const shellScope = makeScope();
const chrome = mountChrome({ scope: shellScope });
const expand = createExpand({ motion });
expand.install(shellScope);

// ---- page modules ----------------------------------------------------------------------------
let router = null, current = null, lastId = null;

// The modules a page runs: the sentence and bands on the homepage, the arrival on a destination's hero, then
// the page's own module (data-module). Mounting the same <main> twice is a no-op, so the router can
// commit the page the shell already mounted at boot. A module that fails leaves the static page.
function modulesFor(main) {
  const list = [];
  if (main.dataset.page === 'home') list.push('/static/site/home.js');
  if (main.querySelector('[data-hero]')) list.push('/static/site/hero.js');
  if (main.dataset.module) list.push(main.dataset.module);
  return list;
}

function mountPage(main) {
  if (!main) return Promise.resolve(null);
  if (current?.main === main) return current.ready;
  unmountPage();
  const from = lastId;
  const sc = makeScope();
  const entry = { main, id: main.dataset.page, from, scope: sc, apis: [], ready: null };
  current = entry;
  const ctx = {
    scope: sc, motion, announce: chrome.announce, styles, registry,
    go: url => (router ? router.go(url) : location.assign(url)),
  };
  try { mountCommon(main, sc); } catch (err) { console.error(err); }
  entry.ready = (async () => {
    for (const url of modulesFor(main)) {
      try {
        const mod = await import(url);
        if (current !== entry) return null;
        const api = (await mod.mount?.(main, ctx)) || null;
        if (current !== entry) { api?.unmount?.(); return null; }
        if (api) entry.apis.push(api);
      } catch (err) { console.error(`${url} failed to mount:`, err); }
    }
    return entry.apis;
  })();
  return entry.ready;
}

function unmountPage() {
  if (!current) return;
  const { apis, scope } = current;
  lastId = current.id;
  current = null;
  apis.forEach(api => { try { api.unmount?.(); } catch (err) { console.error(err); } });
  scope.dispose();
}

motion.subscribe(paused => {
  current?.apis.forEach(api => { try { api.setMotion?.(paused); } catch (err) { console.error(err); } });
});

// ---- router -------------------------------------------------------------------------------------
mountPage(document.querySelector('main#main'));

try {
  router = createRouter({
    registry, routes: createRoutes(registry),
    travel: intent => expand.travel(intent),
    beforeSwap: intent => expand.beforeSwap(intent),
    afterSwap: intent => expand.afterSwap(intent),
    status(intent, state, info) {
      expand.status(intent, state);
      if (state === 'error') chrome.toast(`${intent?.route?.place?.title || 'The page'} could not load.`, { action: info?.retry, label: 'Try again' });
    },
    mountPage,
    unmountPage,
    announce: chrome.announce,
    focusTarget(intent, main) {
      // Back on the homepage, focus lands on the band the visitor came from.
      if (current?.id !== 'home' || !current.from) return null;
      return main.querySelector(`.band[data-band="${CSS.escape(current.from)}"] .band-title a`);
    },
  });
  if (!router.start()) console.warn('The router did not start; pages load in full.');
} catch (err) {
  console.warn('Navigation stays on full page loads:', err);
}
