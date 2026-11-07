// Voyager 1's distance from the Sun, counting up live. It is worked out from one reference point
// (about 167.1 AU at the end of May 2025, when it passed 25 billion km) and its speed of about
// 17.0 km/s relative to the Sun, so it is an estimate, and labelled as one; light takes the time
// shown to cross the gap.
import { stage, COLORS, MONO } from './stage.js';

export const AU_KM = 149597870.7;
export const C_KM_S = 299792.458;
export const REFERENCE = { date: Date.UTC(2025, 4, 31), au: 167.1, speedKmS: 17.0 };
export const LAUNCH = Date.UTC(1977, 8, 5);
export const distanceKm = (ms, ref = REFERENCE) => ref.au * AU_KM + ((ms - ref.date) / 1000) * ref.speedKmS;
export const lightHours = km => km / C_KM_S / 3600;

export const caption = 'Voyager 1 launched on Sep 5, 1977 and crossed into interstellar space in 2012. Its distance here is an estimate from a published position and speed.';
export const sources = [{ title: 'NASA, Where are Voyager 1 and Voyager 2 now?', url: 'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/' }];

export function mount(el, { reducedMotion = false } = {}) {
  const S = stage(el, draw, { reducedMotion });
  function draw(ctx, w, h, t) {
    const now = Date.now();
    const km = distanceKm(now);
    ctx.clearRect(0, 0, w, h);
    const big = Math.min(w / 15, h / 3.2);
    ctx.font = MONO; ctx.fillStyle = COLORS.mute;
    ctx.fillText('VOYAGER 1 · FROM THE SUN · ESTIMATE', 16, 24);
    ctx.font = `600 ${big}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(`${Math.round(km).toLocaleString('en-US')} km`, 16, 24 + big * 1.15);
    ctx.font = MONO; ctx.fillStyle = COLORS.cyan;
    const lh = lightHours(km);
    ctx.fillText(`${(km / AU_KM).toFixed(3)} AU · light takes ${Math.floor(lh)} h ${Math.round((lh % 1) * 60)} min · ${((now - LAUNCH) / 3.15576e10).toFixed(2)} years out`, 16, h - 16);
    // A dot leaving a long trail, very slowly.
    const x = w - 30 - 8 * Math.sin(t * 0.2);
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath(); ctx.arc(x, 26, 3, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - 160, 0, x, 0);
    g.addColorStop(0, 'rgba(34,230,255,0)'); g.addColorStop(1, 'rgba(34,230,255,0.5)');
    ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x - 160, 26); ctx.lineTo(x, 26); ctx.stroke();
  }
  return { destroy: S.destroy };
}
