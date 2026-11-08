// A sunflower head grown seed by seed (Vogel's model): seed n sits at radius c·√n and turns
// n·α around the centre. At the golden angle, 137.508°, the seeds pack without gaps and two families
// of spirals appear, 34 one way and 55 the other (one arm of each is picked out). A slider moves α;
// a fraction of a degree away, the head breaks into straight spokes and gaps. Beside it a fern grows
// out of four simple affine maps (Barnsley's fern), a frond made of smaller fronds.
import { stage, COLORS, MONO } from './stage.js';

export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5));
export const seedAt = (n, angleDeg, c = 1) => {
  const a = (n * angleDeg * Math.PI) / 180, r = c * Math.sqrt(n);
  return [r * Math.cos(a), r * Math.sin(a)];
};
// Barnsley's fern: one step of the chaos game.
export function fernStep([x, y], u) {
  if (u < 0.01) return [0, 0.16 * y];
  if (u < 0.86) return [0.85 * x + 0.04 * y, -0.04 * x + 0.85 * y + 1.6];
  if (u < 0.93) return [0.2 * x - 0.26 * y, 0.23 * x + 0.22 * y + 1.6];
  return [-0.15 * x + 0.28 * y, 0.26 * x + 0.24 * y + 0.44];
}

export const caption = 'Each new seed sits 137.5° around from the last: the golden angle. The seeds then form spirals in neighbouring Fibonacci numbers.';
export const sources = [{ title: 'Vogel (1979), Mathematical Biosciences 44, 179', url: 'https://doi.org/10.1016/0025-5564(79)90080-4' }];

const N = 900;

export function mount(el, { reducedMotion = false, compact = false } = {}) {
  let angle = GOLDEN_ANGLE, grown = reducedMotion ? N : 0;
  const fern = [];
  let fp = [0, 0];
  if (reducedMotion) for (let i = 0; i < 9000; i++) { fp = fernStep(fp, Math.random()); fern.push(fp); }

  const S = stage(el, draw, { reducedMotion });
  let slider = null;
  if (!compact) {
    const wrap = document.createElement('label');
    wrap.className = 'sx-control';
    wrap.innerHTML = '<span>Divergence angle</span><input type="range" min="130" max="145" step="0.001"><output></output>';
    slider = wrap.querySelector('input');
    const out = wrap.querySelector('output');
    slider.value = String(GOLDEN_ANGLE);
    const show = () => { out.textContent = `${angle.toFixed(3)}°${Math.abs(angle - GOLDEN_ANGLE) < 0.0015 ? ' · golden' : ''}`; };
    slider.addEventListener('input', () => {
      angle = Number(slider.value);
      // Snap to the golden angle when close, so it can be found again.
      if (Math.abs(angle - GOLDEN_ANGLE) < 0.06) angle = GOLDEN_ANGLE;
      grown = reducedMotion ? N : Math.min(grown, 240);
      show();
      S.redraw();
    });
    show();
    el.append(wrap);
  }

  function draw(ctx, w, h, t, dt) {
    grown = Math.min(N, grown + dt * 260);
    for (let i = 0; i < (reducedMotion ? 0 : 160) && fern.length < 9000; i++) { fp = fernStep(fp, Math.random()); fern.push(fp); }
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w * 0.36, h * 0.42);
    const cx = w * 0.4, cy = h * 0.48;
    const c = R / Math.sqrt(N);
    const golden = Math.abs(angle - GOLDEN_ANGLE) < 1e-6;
    for (let n = 1; n < grown; n++) {
      const [x, y] = seedAt(n, angle, c);
      const arm34 = golden && n % 34 === 7, arm55 = golden && n % 55 === 12;
      const size = 1.2 + 2.2 * Math.sqrt(n / N);
      ctx.fillStyle = arm34 ? COLORS.cyan : arm55 ? COLORS.magenta : `rgba(255, ${190 + (n % 7) * 6}, ${90 + (n % 5) * 10}, ${0.55 + 0.4 * (1 - n / N)})`;
      ctx.beginPath(); ctx.arc(cx + x, cy + y, size, 0, Math.PI * 2); ctx.fill();
    }
    // The fern, to the right.
    const fx = w * 0.82, fy = h * 0.92, fs = Math.min(h * 0.082, w * 0.05);
    ctx.fillStyle = 'rgba(126, 214, 160, 0.55)';
    for (const [x, y] of fern) ctx.fillRect(fx + x * fs, fy - y * fs, 1, 1);
    ctx.font = MONO; ctx.fillStyle = COLORS.mute;
    if (golden) {
      ctx.fillStyle = COLORS.cyan; ctx.fillText('34 spirals', 14, h - 30);
      ctx.fillStyle = COLORS.magenta; ctx.fillText('55 spirals', 14, h - 14);
    } else {
      ctx.fillText(`${angle.toFixed(3)}° — off the golden angle by ${Math.abs(angle - GOLDEN_ANGLE).toFixed(3)}°`, 14, h - 14);
    }
  }
  return { destroy() { S.destroy(); slider?.closest('label')?.remove(); } };
}
