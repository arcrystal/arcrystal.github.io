// Click to expand. Plugs into the router as travel / beforeSwap / afterSwap / status:
//   The scene (scene/scene.js) draws the effect where WebGL is ready; effects.js stands in otherwise.
//   1. A click on a phrase of the homepage's sentence (the effect starts from the crystal), a band,
//      a next-page card or any link to a destination starts the fetch and, at the same time, the
//      destination style's effect from the element's rectangle.
//   2. The router swaps the page in once the effect covers the viewport (beforeSwap).
//   3. afterSwap: the effect reveals the new page; its hero plays its arrival (hero.js).
// Back to the homepage folds the page back into its band; other history steps roll fog in, in the
// destination's colours. With motion paused (or no WebGL for the house pages and fog) a plain fade.
// While an effect plays, Escape or a click skips to its end.
import { open } from './effects.js';
import { getScene } from './scene/scene.js';

export function createExpand({ motion }) {
  const root = document.documentElement;
  const runs = new WeakMap();      // intent → run
  let pending = null, point = null, current = null, leaving = null;

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
    scope.on(document, 'keydown', e => { if (e.key === 'Escape' && current) current.skip?.(); });
    scope.on(document, 'pointerdown', () => { if (current) current.skip?.(); }, { capture: true });
  }

  const cardOf = link => (link?.closest('.ph') && document.querySelector('[data-crystal]'))
    || link?.closest('.band')?.querySelector('.band-body') || link?.closest('.d-next-card') || link || null;

  function originRect(link, vw, vh) {
    let r = null;
    const el = cardOf(link);
    if (el) r = el.getBoundingClientRect();
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
    leaving = document.body.dataset.page || null;
    const to = intent.route?.place?.destination?.style || 'house';
    let kind;
    if (motion.paused) kind = 'fade';
    else if (intent.source === 'pop') kind = intent.route.page === 'home' && from !== 'house' ? 'close' : 'fog';
    else kind = to;
    const rect = originRect(link, vw, vh);
    const at = point || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    point = null;
    if (current) { current.cancel(); finish(current); }
    const scene = getScene();
    const el = cardOf(link);
    const cardR = el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 24;
    const run = scene?.ready && kind !== 'fade'
      ? scene.open(kind, { rect, point: at, from, to, cardR })
      : open(kind, { rect, point: at, vw, vh, from, to });
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
    const page = leaving;
    const card = () => (page ? document.querySelector(`.band[data-band="${CSS.escape(page)}"] .band-body`) : null);
    await run.reveal({ card, panelRect: () => card()?.getBoundingClientRect() || null });
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
