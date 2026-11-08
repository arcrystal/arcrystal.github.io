// Supermountains (Zhu et al. 2022): twice in Earth's history, while supercontinents assembled,
// mountain ranges as high as the Himalayas and up to 8,000 km long rose and then wore away. Their
// eroded roots left low-lutetium zircons; their erosion washed phosphorus and iron into the oceans.
// The first, the Nuna Supermountain (2.0 to 1.8 billion years ago), coincides with the likely
// appearance of eukaryotes; the second, the Transgondwanan (650 to 500 million years ago), with
// the first large animals and the Cambrian explosion. Between them, the "Boring Billion". The
// timing is from the paper; the shapes are schematic. A correlation the authors propose to test,
// not a proven cause.
import { stage, COLORS, MONO } from './stage.js';

// Millions of years ago.
export const SPAN = [2500, 0];
export const EPISODES = [
  { name: 'Nuna Supermountain', from: 2000, to: 1800 },
  { name: 'Transgondwanan Supermountain', from: 650, to: 500 },
];
export const EVENTS = [
  { at: 1650, label: 'Eukaryotes in the fossil record' },
  { at: 575, label: 'First large animals' },
  { at: 530, label: 'Cambrian explosion' },
];
export const BORING = { from: 1800, to: 800, label: 'The Boring Billion' };

const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// How high the ranges stand at time ma (0..1): they rise through each episode and wear down over
// the 150 million years after it.
export function mountainHeight(ma) {
  let h = 0;
  for (const e of EPISODES) {
    const rise = smooth((e.from - ma) / ((e.from - e.to) * 0.6));
    const wear = 1 - smooth((e.to - ma) / 150);
    h = Math.max(h, rise * wear);
  }
  return h;
}
// The nutrients washed to the sea (0..1): high while the ranges stand and wear away.
export function nutrients(ma) {
  let f = 0;
  for (const e of EPISODES) {
    const on = smooth((e.from - ma) / 60) * (1 - smooth((e.to - 200 - ma) / 120));
    f = Math.max(f, on);
  }
  return f;
}
export const episodeAt = ma => EPISODES.find(e => ma <= e.from && ma >= e.to) || null;

export const caption = 'Two supermountains, the nutrients their erosion released, and what life did next. Timing from Zhu et al. (2022); shapes schematic.';
export const sources = [
  { title: 'Zhu et al. (2022), The temporal distribution of Earth’s supermountains and their potential link to the rise of atmospheric oxygen and biological evolution, Earth and Planetary Science Letters 580, 117391', url: 'https://doi.org/10.1016/j.epsl.2022.117391' },
  { title: 'ANU, Supermountains controlled the evolution of life on Earth', url: 'https://www.anu.edu.au/news/all-news/supermountains-controlled-the-evolution-of-life-on-earth' },
];

export function mount(el, { reducedMotion = false } = {}) {
  let hover = null;
  const pad = 18;
  const xOf = (ma, w) => pad + (SPAN[0] - ma) / (SPAN[0] - SPAN[1]) * (w - pad * 2);
  const xToMa = (x, w) => Math.min(SPAN[0], Math.max(SPAN[1], SPAN[0] - (x - pad) / (w - pad * 2) * (SPAN[0] - SPAN[1])));
  const grains = Array.from({ length: 90 }, (_, i) => ({ s: (i * 0.618034) % 1, r: ((i * 0.381966) % 1) }));
  // Last: the stage draws once as soon as it is made.
  const S = stage(el, draw, { reducedMotion, onPointer: (type, p, w) => { hover = type === 'leave' ? null : xToMa(p.x, w); } });

  function draw(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    // The time shown: a slow sweep through 2.5 billion years, or wherever the pointer is.
    const ma = hover ?? (reducedMotion ? 560 : SPAN[0] - ((t * 95) % (SPAN[0] + 300)));
    const ground = h * 0.56, sea = h * 0.74;
    // The Boring Billion.
    ctx.fillStyle = 'rgba(185,166,255,0.06)';
    ctx.fillRect(xOf(BORING.from, w), 34, xOf(BORING.to, w) - xOf(BORING.from, w), sea - 34);
    ctx.font = MONO; ctx.fillStyle = COLORS.mute;
    ctx.fillText(BORING.label.toUpperCase(), xOf(BORING.from, w) + 8, 50);
    // The ranges as they stand at time ma: a jagged skyline over each episode, up to where ma is.
    for (const e of EPISODES) {
      const x0 = xOf(e.from + 40, w), x1 = xOf(e.to - 150, w);
      ctx.beginPath(); ctx.moveTo(x0, ground);
      for (let x = x0; x <= x1; x += 3) {
        const at = xToMa(x, w);
        const shown = at >= ma ? mountainHeight(at) : 0;
        const jag = 0.55 + 0.45 * Math.abs(Math.sin(x * 0.37) * Math.cos(x * 0.11));
        ctx.lineTo(x, ground - shown * jag * (ground - 70));
      }
      ctx.lineTo(x1, ground); ctx.closePath();
      const g = ctx.createLinearGradient(0, 70, 0, ground);
      g.addColorStop(0, 'rgba(236,233,255,0.9)'); g.addColorStop(0.25, 'rgba(185,166,255,0.55)'); g.addColorStop(1, 'rgba(91,59,255,0.25)');
      ctx.fillStyle = g; ctx.fill();
      ctx.font = MONO; ctx.fillStyle = COLORS.ink;
      ctx.fillText(e.name.toUpperCase(), xOf(e.from, w), ground + 16);
    }
    // The ground and the sea, with phosphorus and iron washing in while the ranges wear away.
    ctx.strokeStyle = COLORS.rule; ctx.beginPath(); ctx.moveTo(pad, ground); ctx.lineTo(w - pad, ground); ctx.stroke();
    ctx.fillStyle = 'rgba(34,230,255,0.08)'; ctx.fillRect(pad, sea, w - pad * 2, h - sea - 26);
    const flux = nutrients(ma), xm = xOf(ma, w);
    for (const gr of grains) {
      const k = (gr.s + t * 0.35) % 1;
      if (gr.r > flux) continue;
      const x = xm - 40 + gr.r * 80 + Math.sin(k * 9 + gr.r * 20) * 6, y = ground + 4 + k * (sea - ground + 26);
      ctx.fillStyle = gr.r < flux * 0.5 ? COLORS.gold : COLORS.cyan;
      ctx.globalAlpha = 0.85 * (1 - k * 0.6);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Life's milestones.
    for (const ev of EVENTS) {
      const x = xOf(ev.at, w), on = ma <= ev.at;
      ctx.strokeStyle = on ? COLORS.magenta : COLORS.rule;
      ctx.beginPath(); ctx.moveTo(x, sea); ctx.lineTo(x, sea - 26 - (ev.at === 530 ? 16 : 0)); ctx.stroke();
      ctx.fillStyle = on ? COLORS.magenta : COLORS.mute;
      ctx.beginPath(); ctx.arc(x, sea, on ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // The time line, its scale, and what is happening at ma.
    ctx.strokeStyle = COLORS.cyan; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(xm, 34); ctx.lineTo(xm, h - 26); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = MONO; ctx.fillStyle = COLORS.mute;
    for (const tick of [2500, 2000, 1500, 1000, 500, 0]) ctx.fillText(tick ? `${(tick / 1000).toFixed(1)} Ga` : 'today', Math.min(xOf(tick, w), w - pad - 34), h - 8);
    const ep = episodeAt(ma), ev = EVENTS.filter(e => Math.abs(e.at - ma) < 40).pop();
    const now = ev ? ev.label : ep ? `${ep.name} rising` : flux > 0.2 ? 'Erosion feeds the oceans' : ma <= BORING.from && ma >= BORING.to ? 'Little changes for a billion years' : '';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(`${ma >= 1000 ? (ma / 1000).toFixed(2) + ' billion' : Math.round(ma) + ' million'} years ago${now ? ' · ' + now : ''}`, pad, 22);
  }
  return { destroy: S.destroy };
}
