// The Birkebeiner at race pace: the route draws itself from Cable to Hayward while a clock runs to
// the official time, about 1,500 times faster than it was skied. It plays once when the figure
// scrolls into view (again from a replay button where there is one); with motion paused it shows the
// finished route and time. Used by the homepage's Racing band and the Racing page.
import { onTick, clamp } from './lib/util.js';

const MS = 6000;
const KM = 50;

function seconds(text) {
  const [hms, cs = '0'] = text.split('.');
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s + Number(`0.${cs}`);
}
const clockText = sec => `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function racePace(fig, { scope, motion }) {
  const line = fig.querySelector('.rt-line');
  const dot = fig.querySelector('.rt-dot');
  const clock = fig.querySelector('[data-pace-clock]');
  const km = fig.querySelector('[data-pace-km]');
  const replay = fig.querySelector('[data-pace-replay]');
  if (!line || !clock) return null;
  const finalText = fig.dataset.final || clock.textContent.trim();
  const total = seconds(finalText);
  const kmFinal = km?.textContent;
  const len = line.getTotalLength();
  let stop = null, played = false;

  const show = x => {
    fig.style.setProperty('--pace', x.toFixed(4));
    if (dot) {
      const p = line.getPointAtLength(x * len);
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
    }
    clock.textContent = x >= 1 ? finalText : clockText(total * x);
    if (km) km.textContent = x >= 1 ? kmFinal : `${Math.round(KM * x)} km of ${KM}`;
  };
  const end = () => {
    stop?.();
    stop = null;
    fig.classList.remove('is-running');
    show(1);
    if (replay) replay.hidden = false;
  };
  const run = () => {
    played = true;
    if (motion.paused) { end(); return; }
    stop?.();
    fig.classList.add('is-running');
    let t = 0;
    show(0);
    stop = onTick(dt => {
      t += dt * 1000;
      const x = clamp(t / MS);
      show(x);
      if (x >= 1) end();
    });
  };

  if (!motion.paused && 'IntersectionObserver' in window) {
    show(0);
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !played) { io.disconnect(); run(); }
    }, { threshold: 0.5 });
    io.observe(fig);
    scope.add(() => io.disconnect());
  } else end();
  if (replay) scope.on(replay, 'click', run);
  scope.add(() => stop?.());
  return { setMotion(paused) { if (paused) end(); } };
}
