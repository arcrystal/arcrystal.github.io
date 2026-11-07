// TRAPPIST-1 from above: seven planets on their orbits around a small red star, at their real
// periods and relative sizes (Agol et al. 2021), with time running at a day a second (drag
// sideways to run it faster, slower or backward). Below, the light curve a telescope on the near
// side would record: each planet that crosses the star dims it by the share of its face it covers.
// Orbits are to scale with each other; the star and planets are drawn far larger than life, and the
// starting positions are illustrative.
import { stage, COLORS, MONO } from './stage.js';

// Period in days, radius in Earth radii, semi-major axis in AU (Agol et al. 2021, table 2 and 6).
export const PLANETS = [
  { id: 'b', period: 1.510826, radius: 1.116, a: 0.01154 },
  { id: 'c', period: 2.421937, radius: 1.097, a: 0.01580 },
  { id: 'd', period: 4.049219, radius: 0.788, a: 0.02227 },
  { id: 'e', period: 6.101013, radius: 0.920, a: 0.02925, habitable: true },
  { id: 'f', period: 9.207540, radius: 1.045, a: 0.03849, habitable: true },
  { id: 'g', period: 12.352446, radius: 1.129, a: 0.04683, habitable: true },
  { id: 'h', period: 18.772866, radius: 0.755, a: 0.06189 },
];
export const STAR_RADIUS_KM = 0.1192 * 695700;
const EARTH_KM = 6371;

// The fraction of the star's light a planet blocks in transit: the ratio of their disc areas.
export const transitDepth = rEarth => ((rEarth * EARTH_KM) / STAR_RADIUS_KM) ** 2;
// Orbital phase 0..1 at time t (days), from an illustrative starting phase.
export const phaseAt = (p, t, start = 0) => (((t / p.period + start) % 1) + 1) % 1;
// Neighbouring period ratios, the near-resonant chain (about 8:5, 5:3, 3:2, 3:2, 4:3, 3:2).
export const periodRatios = () => PLANETS.slice(1).map((p, i) => p.period / PLANETS[i].period);

const START = [0.12, 0.47, 0.81, 0.33, 0.62, 0.05, 0.9];

export const caption = 'Seven Earth-sized planets orbit TRAPPIST-1, a red dwarf about 40 light-years away. Their years last from 1.5 to 19 days; e, f and g orbit where liquid water could last.';
export const sources = [{ title: 'Agol et al. (2021), Planetary Science Journal 2, 1', url: 'https://doi.org/10.3847/PSJ/abd022' }];

export function mount(el, { reducedMotion = false, compact = false } = {}) {
  let days = 0, speed = 1, dragX = null;
  const curve = [];   // [day, flux]
  const S = stage(el, draw, {
    reducedMotion,
    onPointer(type, p) {
      if (type === 'pointerdown') dragX = p.x;
      if (type === 'pointermove' && p.down && dragX !== null) { speed = Math.max(-6, Math.min(12, speed + (p.x - dragX) * 0.02)); dragX = p.x; }
      if (type === 'leave') dragX = null;
    },
  });
  S.canvas.style.cursor = 'ew-resize';

  function draw(ctx, w, h, t, dt) {
    days += dt * speed;
    if (reducedMotion && !curve.length) days = 7.3;
    ctx.clearRect(0, 0, w, h);
    const plotH = Math.max(46, h * 0.22);
    const cx = w * (compact ? 0.62 : 0.5), cy = (h - plotH) * 0.5 + 4;
    const scale = Math.min(w * (compact ? 0.36 : 0.44), (h - plotH) * 0.46) / PLANETS[6].a;
    const starR = Math.max(9, scale * 0.0035);

    // The habitable zone, between the orbits of e and g.
    ctx.beginPath();
    ctx.arc(cx, cy, PLANETS[6 - 1].a * scale + 8, 0, Math.PI * 2);
    ctx.arc(cx, cy, PLANETS[3].a * scale - 8, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(34, 230, 255, 0.06)';
    ctx.fill('evenodd');
    // The line of sight toward us, down the screen.
    ctx.strokeStyle = 'rgba(255, 61, 203, 0.25)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, h - plotH - 6); ctx.stroke();
    ctx.setLineDash([]);
    // The star.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, starR * 4);
    g.addColorStop(0, '#FFE2C2'); g.addColorStop(0.25, '#FF8A55'); g.addColorStop(0.5, 'rgba(255, 90, 60, 0.25)'); g.addColorStop(1, 'rgba(255, 90, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, starR * 4, 0, Math.PI * 2); ctx.fill();

    let flux = 1;
    PLANETS.forEach((p, i) => {
      const r = p.a * scale;
      ctx.strokeStyle = p.habitable ? 'rgba(34, 230, 255, 0.35)' : COLORS.rule;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      // Phase 0.25 puts the planet on the near side, in front of the star.
      const ang = phaseAt(p, days, START[i]) * Math.PI * 2;
      const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
      const pr = 2.4 + p.radius * 3.4;
      // In front of the star, as seen from below, when it is on the near side and within the star's width.
      const inFront = Math.sin(ang) > 0 ? Math.max(0, 1 - Math.abs(x - cx) / (starR + pr)) : 0;
      flux -= transitDepth(p.radius) * Math.min(1, inFront * 1.6);
      const metal = ctx.createRadialGradient(x - pr * 0.4, y - pr * 0.4, 0, x, y, pr);
      metal.addColorStop(0, '#FFFFFF'); metal.addColorStop(0.35, p.habitable ? '#9FEFFF' : '#C9CCE6'); metal.addColorStop(0.8, '#3A3570'); metal.addColorStop(1, '#22E6FF');
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
      if (!compact || i % 2 === 0) {
        ctx.font = MONO; ctx.fillStyle = p.habitable ? COLORS.cyan : COLORS.mute;
        ctx.fillText(p.id, x + pr + 4, y - pr - 2);
      }
    });

    // The light curve: the last few days of starlight, newest at the right.
    curve.push([days, flux]);
    while (curve.length > 2 && Math.abs(curve[curve.length - 1][0] - curve[0][0]) > 6) curve.shift();
    const top = h - plotH + 8, bottom = h - 14, left = 14, right = w - 14;
    ctx.strokeStyle = COLORS.rule;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.stroke();
    ctx.font = MONO; ctx.fillStyle = COLORS.mute;
    ctx.fillText('starlight', left, top + 13);
    ctx.fillText('−1%', left, bottom);
    const y = f => top + 18 + (1 - f) * 100 * (bottom - top - 22);
    ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const now = days;
    curve.forEach(([d, f], k) => {
      const x = right - (Math.abs(now - d) / 6) * (right - left - 60);
      if (k) ctx.lineTo(x, y(f)); else ctx.moveTo(x, y(f));
    });
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(`day ${days.toFixed(1)} · ${speed.toFixed(1)} days/s`, right, top + 13);
    ctx.textAlign = 'left';
  }
  return { destroy: S.destroy };
}
