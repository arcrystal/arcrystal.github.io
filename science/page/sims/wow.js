// The Wow! signal, Aug 15, 1977. Big Ear printed each channel's signal strength as one character:
// a blank for under 1, the digits 1 to 9, then letters for 10 and up (A = 10 … Z = 35), in units of
// the background noise. One column of the printout ran 6, E, Q, U, J, 5 over about 72 seconds as
// the sky drifted through the beam: up to 30 times the noise, then gone. Jerry Ehman circled it and
// wrote "Wow!". This redraws that column among the quiet ones around it.
import { stage, COLORS } from './stage.js';

export const WOW = '6EQUJ5';
// The strength a printout character stands for, in standard deviations above the background.
export const strength = ch => (ch === ' ' ? 0 : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 55);

export const caption = 'In 1977 the Big Ear telescope recorded 72 seconds of a narrowband signal, 6EQUJ5, that has never been detected again.';
export const sources = [{ title: 'Jerry Ehman, The Big Ear Wow! signal', url: 'http://www.bigear.org/wow.htm' }];

const COLS = 14, ROWS = 6, WOW_COL = 2;
const NOISE = ['1', '1', '1', ' ', ' ', '2', '1', '3', ' ', '1', '2', ' ', '4'];

export function mount(el, { reducedMotion = false } = {}) {
  const sheet = [];
  for (let r = 0; r < ROWS; r++) sheet.push(Array.from({ length: COLS }, (_, c) => (c === WOW_COL ? WOW[r] : NOISE[(r * 7 + c * 3) % NOISE.length])));
  const S = stage(el, draw, { reducedMotion });
  function draw(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const shown = reducedMotion ? ROWS * COLS : Math.min(ROWS * COLS, Math.floor(t * 18));
    const cw = Math.min((w - 40) / COLS, (h - 30) / ROWS * 0.9), ch = (h - 30) / ROWS;
    const x0 = 20, y0 = 24;
    ctx.font = `500 ${Math.round(cw * 0.62)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    for (let i = 0; i < shown; i++) {
      const r = Math.floor(i / COLS), c = i % COLS, s = sheet[r][c];
      ctx.fillStyle = c === WOW_COL ? COLORS.ink : 'rgba(162,159,201,0.55)';
      ctx.fillText(s, x0 + c * cw + cw / 2, y0 + r * ch + ch * 0.6);
    }
    if (shown >= ROWS * COLS) {
      // The circle in red pen, and the note.
      const cx = x0 + WOW_COL * cw + cw / 2, cy = y0 + (ROWS * ch) / 2;
      const p = reducedMotion ? 1 : Math.min(1, (t - (ROWS * COLS) / 18) * 1.4);
      ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, cw * 0.7, (ROWS * ch) / 2 + 4, 0.04, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2.05); ctx.stroke();
      if (p >= 1) {
        ctx.font = `italic 600 ${Math.round(cw * 0.8)}px Georgia, serif`;
        ctx.fillStyle = '#FF4D6D'; ctx.textAlign = 'left';
        ctx.fillText('Wow!', cx + cw * 0.95, y0 + ch * 1.2);
      }
    }
    ctx.textAlign = 'left';
  }
  return { destroy: S.destroy };
}
