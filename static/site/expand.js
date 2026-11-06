// Click to expand. Plugs into the router as travel / beforeSwap / afterSwap / status:
//   1. A click on a tile (or a next-page card, or any link to a destination) starts the fetch and,
//      at the same time, the destination style's effect from the element's rectangle.
//   2. The router swaps the page in once the effect covers the viewport (beforeSwap).
//   3. afterSwap: the effect reveals the new page; its hero plays its arrival (hero.js).
// Back to the homepage folds the page back into its tile; other history steps, links to the
// house pages and reduced motion use a plain fade in the destination's colour.
import { open } from './effects.js';

export function createExpand({ motion }) {
  const root = document.documentElement;
  const runs = new WeakMap();      // intent → run
  let pending = null, point = null, current = null;

  // The click is seen first (capture), so travel() knows which element and where.
  function install(scope) {
    scope.on(document, 'click', e => {
      pending = null;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      pending = a;
      point = e.detail === 0 ? null : { x: e.clientX, y: e.clientY };
      setTimeout(() => { if (pending === a) pending = null; }, 0);
    }, { capture: true });
  }

  function originRect(link, vw, vh) {
    let r = null;
    if (link?.closest('.tile')) r = document.querySelector('.stage-frame .panel')?.getBoundingClientRect();
    else if (link) r = (link.closest('.d-next-card') || link).getBoundingClientRect();
    if (!r || r.width < 2 || r.bottom < 0 || r.top > vh) {
      const w = Math.min(vw * 0.3, 280), h = w * 1.25;
      r = { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
    }
    return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height };
  }

  function finish(run) {
    if (current !== run) return;
    current = null;
    delete root.dataset.xp;
  }

  function travel(intent) {
    const link = pending;
    pending = null;
    if (intent.source === 'initial') return null;
    const vw = root.clientWidth, vh = innerHeight;
    const from = document.body.dataset.style || 'house';
    const to = intent.route?.place?.destination?.style || 'house';
    let kind;
    if (intent.source === 'pop') kind = intent.route.page === 'home' && from !== 'house' && !motion.paused ? 'close' : 'fade';
    else kind = motion.paused || to === 'house' ? 'fade' : to;
    const rect = originRect(link, vw, vh);
    const at = point || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    point = null;
    if (current) { current.cancel(); finish(current); }
    const run = open(kind, { rect, point: at, vw, vh, from, to });
    current = run;
    runs.set(intent, run);
    root.dataset.xp = kind;
    return {
      finished: run.covered,
      skip: () => run.skip(),
      cancel: () => { run.cancel(); runs.delete(intent); finish(run); },
    };
  }

  // The router waits for the cover before it swaps.
  async function beforeSwap(intent) {
    const run = runs.get(intent);
    if (run) await run.covered;
  }

  async function afterSwap(intent) {
    const run = runs.get(intent);
    if (!run) return;
    runs.delete(intent);
    await run.reveal({ panelRect: () => document.querySelector('.stage-frame .panel')?.getBoundingClientRect() || null });
    finish(run);
  }

  // 'slow' (over 1.2 s): a waiting line on the overlay. 'error': the overlay lets go.
  function status(intent, state) {
    const run = runs.get(intent);
    if (!run) return;
    if (state === 'slow') run.slow();
    if (state === 'error') { run.fail(); runs.delete(intent); finish(run); }
  }

  return { install, travel, beforeSwap, afterSwap, status, get active() { return !!current; } };
}
