// The opening screen covers real preparation; the page stays measurable behind it.
// Readiness comes from the renderer, never from an estimated percentage or a timer.
export function mountLoading({ scene, mounted, motion }) {
  const root = document.documentElement, panel = document.getElementById('site-loading');
  if (!panel || !root.classList.contains('site-loading')) return;
  const status = panel.querySelector('[data-loading-status]');
  const meter = panel.querySelector('[role="progressbar"]');
  let percent = 0;
  function showPercent(value) {
    const next = Math.max(percent, Math.round(value));
    if (next === percent) return;
    percent = next;
    meter.textContent = next + '%';
    meter.setAttribute('aria-valuenow', String(next));
  }
  const steps = [...panel.querySelectorAll('[data-loading-step]')];
  const content = [...document.querySelectorAll('.site-header, main#main, .contact, .site-foot, .skip-link')];
  const previous = content.map(el => el.inert);
  content.forEach(el => { el.inert = true; });
  let done = false, mountedReady = false, timer, stage = '';
  const started = performance.now(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const button = panel.querySelector('button');
  button.focus({ preventScroll: true });
  const say = (key, text) => {
    if (key === stage && status.textContent === text) return;
    stage = key; status.textContent = text; panel.dataset.stage = key;
    const n = key === 'light' ? 0 : key === 'motion' ? 1 : 2;
    steps.forEach((el, i) => { el.dataset.state = i < n ? 'done' : i === n ? 'active' : 'waiting'; });
  };
  function finish(fallback = false) {
    if (done) return;
    done = true; clearTimeout(timer); unsubscribe();
    say('ready', fallback ? 'Ready to explore' : 'The scene is ready');
    if (fallback) meter.hidden = true;
    else showPercent(100);
    root.classList.add('visuals-ready');
    panel.dataset.finished = 'true';
    // A short reveal only, after the actual preparation has finished.
    setTimeout(() => {
      const focused = panel.contains(document.activeElement);
      content.forEach((el, i) => { el.inert = previous[i]; });
      root.classList.remove('site-loading'); panel.remove();
      if (focused) document.querySelector('main#main')?.focus({ preventScroll: true });
      document.dispatchEvent(new Event('visuals:ready'));
    }, reduced.matches || motion.paused ? 0 : 420);
  }
  const enter = () => { motion.set(true); finish(true); };
  button.addEventListener('click', enter);
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') enter();
    if (e.key === 'Tab') { e.preventDefault(); button.focus(); }
  });
  const unsubscribe = motion.subscribe(paused => { if (paused) finish(true); });
  Promise.resolve(mounted).finally(() => { mountedReady = true; });
  function poll() {
    if (done) return;
    const staticView = !scene || motion.paused || reduced.matches || root.classList.contains('no-gl');
    if (mountedReady && staticView) return finish(true);
    const state = scene?.loadingStatus?.() || { stage: 'light', ready: false };
    showPercent(Math.min(99, state.percent ?? 0));
    say(state.stage, state.stage === 'light' ? 'Finding the light' : state.stage === 'motion' ? 'Bringing the motion together' : 'Adding the finishing touches');
    if (mountedReady && (state.ready || state.failed)) return finish(!!state.failed);
    // A failed driver or blocked worker must never lock someone out of the website.
    if (performance.now() - started > 120000) return finish(true);
    timer = setTimeout(poll, 100);
  }
  poll();
}
