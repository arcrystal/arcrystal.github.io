// A starling murmuration at dusk. No bird leads: each one matches the heading of, steers toward and
// keeps clear of its seven nearest neighbours, however near or far they are (the topological rule
// measured in real flocks by Ballerini et al. 2008), and the flock's shape comes out of that. The
// pointer is a falcon: the flock splits around it.
import { stage, COLORS, MONO } from './stage.js';

export const NEIGHBOURS = 7;
// The k nearest of the candidate indices to bird i (squared distances; ties keep candidate order).
export function kNearest(i, xs, ys, candidates, k = NEIGHBOURS) {
  const best = [];
  for (const j of candidates) {
    if (j === i) continue;
    const d = (xs[j] - xs[i]) ** 2 + (ys[j] - ys[i]) ** 2;
    if (best.length < k) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); }
    else if (d < best[k - 1][0]) { best[k - 1] = [d, j]; best.sort((a, b) => a[0] - b[0]); }
  }
  return best.map(b => b[1]);
}

export const caption = 'A starling murmuration has no leader: each bird tracks its six or seven nearest neighbours.';
export const sources = [{ title: 'Ballerini et al. (2008), PNAS 105, 1232', url: 'https://doi.org/10.1073/pnas.0711437105' }];

export function mount(el, { reducedMotion = false, compact = false } = {}) {
  const n = compact ? 700 : 1500;
  const xs = new Float32Array(n), ys = new Float32Array(n), vx = new Float32Array(n), vy = new Float32Array(n);
  let W = 0, H = 0, seeded = false;
  const CELL = 22;
  let grid = new Map();
  // The flock's centre of attention wanders slowly, so the whole shape flows and folds.
  let clock = 0;
  const seed = (w, h) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.min(w, h) * 0.12;
      xs[i] = w * 0.5 + Math.cos(a) * r * 1.8; ys[i] = h * 0.42 + Math.sin(a) * r * 0.8;
      vx[i] = 1.6 + Math.random() * 0.4; vy[i] = (Math.random() - 0.5) * 0.6;
    }
    seeded = true;
  };
  const S = stage(el, draw, { reducedMotion });

  function step(dt, ptr) {
    clock += dt;
    const tx = W * (0.5 + 0.26 * Math.sin(clock * 0.21)), ty = H * (0.42 + 0.14 * Math.sin(clock * 0.33 + 1.3));
    grid = new Map();
    for (let i = 0; i < n; i++) {
      const key = ((xs[i] / CELL) | 0) * 4096 + ((ys[i] / CELL) | 0);
      let cell = grid.get(key);
      if (!cell) grid.set(key, (cell = []));
      cell.push(i);
    }
    const f = dt * 60;
    for (let i = 0; i < n; i++) {
      const gx = (xs[i] / CELL) | 0, gy = (ys[i] / CELL) | 0;
      const cand = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = grid.get((gx + a) * 4096 + gy + b); if (c) for (const j of c) cand.push(j); }
      const nb = kNearest(i, xs, ys, cand.length > 40 ? cand.slice(0, 40) : cand);
      let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0;
      for (const j of nb) {
        ax += vx[j]; ay += vy[j]; cx += xs[j]; cy += ys[j];
        const dx = xs[i] - xs[j], dy = ys[i] - ys[j], d2 = dx * dx + dy * dy + 0.01;
        if (d2 < 64) { sx += dx / d2; sy += dy / d2; }
      }
      const k = nb.length || 1;
      let ux = vx[i], uy = vy[i];
      if (nb.length) {
        ux += ((ax / k - vx[i]) * 0.08 + (cx / k - xs[i]) * 0.012 + sx * 0.7) * f;
        uy += ((ay / k - vy[i]) * 0.08 + (cy / k - ys[i]) * 0.012 + sy * 0.7) * f;
      }
      // Stay over the field: every bird is drawn toward the wandering centre, the strays most.
      const pull = nb.length < 3 ? 0.0016 : 0.0005;
      ux += (tx - xs[i]) * pull * f; uy += (ty - ys[i]) * pull * 1.6 * f;
      if (ptr.on) {
        const dx = xs[i] - ptr.x, dy = ys[i] - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110) { const d = Math.sqrt(d2) + 1; ux += (dx / d) * 0.5 * f; uy += (dy / d) * 0.5 * f; }
      }
      const sp = Math.hypot(ux, uy), lo = 1.5, hi = 3.2;
      if (sp > hi) { ux *= hi / sp; uy *= hi / sp; } else if (sp < lo) { ux *= lo / sp; uy *= lo / sp; }
      vx[i] = ux; vy[i] = uy;
    }
    for (let i = 0; i < n; i++) {
      xs[i] += vx[i] * f; ys[i] += vy[i] * f;
      if (xs[i] < -40) xs[i] = W + 40; if (xs[i] > W + 40) xs[i] = -40;
      if (ys[i] < -40) ys[i] = H + 40; if (ys[i] > H + 40) ys[i] = -40;
    }
  }

  function draw(ctx, w, h, t, dt, ptr) {
    if (!seeded || Math.abs(w - W) > 40 || Math.abs(h - H) > 40) { W = w; H = h; if (!seeded) seed(w, h); }
    W = w; H = h;
    if (dt > 0) step(Math.min(dt, 1 / 30), ptr);
    else if (reducedMotion && !ctx.__settled) { for (let s = 0; s < 120; s++) step(1 / 60, { on: false }); ctx.__settled = true; }
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1C1638'); sky.addColorStop(0.55, '#7A4A6A'); sky.addColorStop(0.85, '#D98A6A'); sky.addColorStop(1, '#F2B184');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(14, 10, 22, 0.88)';
    for (let i = 0; i < n; i++) {
      const sp = Math.hypot(vx[i], vy[i]) || 1;
      ctx.fillRect(xs[i] - (vx[i] / sp) * 1.2, ys[i] - (vy[i] / sp) * 1.2, 2.2, 2);
    }
    // A treeline at the bottom of the frame.
    ctx.fillStyle = '#120C18';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h - 18 - 10 * Math.abs(Math.sin(x * 0.05)) - 6 * Math.sin(x * 0.013));
    ctx.lineTo(w, h); ctx.fill();
    ctx.font = MONO; ctx.fillStyle = COLORS.ink;
    ctx.fillText(`${n.toLocaleString()} birds · 7 neighbours each`, 14, 22);
  }
  return { destroy: S.destroy };
}
