// A model cast in silicon. Taalas's HC1 (announced February 2026) hardwires one model, Meta's
// Llama 3.1 8B, into a TSMC 6 nm chip of 53 billion transistors, keeping its weights on the die
// next to the logic that uses them; it generates about 17,000 tokens a second for one user, where
// Nvidia's H200 manages about 230 on the same model (the company's figures; independent tests
// measured 14,000 to 16,000). The catch: it runs only that model. Here the same 1,000-token answer
// is written at both speeds, in real time.
import { stage, COLORS, MONO } from './stage.js';

export const HC1 = { name: 'Taalas HC1', model: 'Llama 3.1 8B', rate: 17000, process: 'TSMC 6 nm', dieMm2: 815, transistors: 53e9, weights: '3- and 6-bit', modelToChipMonths: 2 };
export const GPU = { name: 'Nvidia H200', model: 'Llama 3.1 8B', rate: 230 };
export const ANSWER = 1000;   // tokens

export const tokensAt = (rate, s, n = ANSWER) => Math.min(n, Math.floor(rate * Math.max(0, s)));
export const secondsFor = (rate, n = ANSWER) => n / rate;
export const speedup = () => HC1.rate / GPU.rate;

export const caption = 'The same 1,000-token answer on a GPU and on a chip with the model built into it, in real time. Speeds are Taalas’s published figures.';
export const sources = [
  { title: 'Taalas, The path to ubiquitous AI (2026)', url: 'https://taalas.com/the-path-to-ubiquitous-ai/' },
  { title: 'CNX Software, Taalas HC1 hardwired Llama-3.1 8B AI accelerator delivers up to 17,000 tokens/s (2026)', url: 'https://www.cnx-software.com/2026/02/22/taalas-hc1-hardwired-llama-3-1-8b-ai-accelerator-delivers-up-to-17000-tokens-s/' },
];

export function mount(el, { reducedMotion = false } = {}) {
  // One run: both start together; the GPU takes about 4.3 s, then a pause, then again.
  const cycle = secondsFor(GPU.rate) + 1.6;

  function lane(ctx, x, y, w, h, chip, s, color) {
    const done = tokensAt(chip.rate, s);
    const cols = Math.max(20, Math.floor(w / 9)), rows = Math.ceil(ANSWER / cols);
    const cw = w / cols, ch = Math.min(6, (h - 34) / rows);
    ctx.font = MONO; ctx.fillStyle = COLORS.ink;
    ctx.fillText(`${chip.name.toUpperCase()} · ${chip.rate.toLocaleString('en-US')} TOKENS/S`, x, y + 12);
    for (let i = 0; i < ANSWER; i++) {
      const cx = x + (i % cols) * cw, cy = y + 22 + Math.floor(i / cols) * ch;
      ctx.fillStyle = i < done ? color : 'rgba(185,166,255,0.12)';
      ctx.fillRect(cx, cy, cw - 1.5, ch - 1.5);
    }
    const t = Math.min(s, secondsFor(chip.rate));
    ctx.fillStyle = done >= ANSWER ? color : COLORS.mute;
    ctx.fillText(done >= ANSWER ? `done in ${t < 1 ? Math.round(t * 1000) + ' ms' : t.toFixed(2) + ' s'}` : `${done} / ${ANSWER} tokens`, x, y + 22 + rows * ch + 14);
  }

  function draw(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const s = reducedMotion ? secondsFor(GPU.rate) : t % cycle;
    const half = (h - 40) / 2;
    lane(ctx, 16, 8, w - 32, half, HC1, s, COLORS.cyan);
    lane(ctx, 16, 8 + half, w - 32, half, GPU, s, COLORS.violet);
    ctx.font = MONO; ctx.fillStyle = COLORS.mute;
    ctx.fillText(`${Math.round(speedup())}× faster for one user · ${HC1.process} · ${HC1.dieMm2} mm² · ${HC1.transistors / 1e9}B transistors · runs only ${HC1.model}`, 16, h - 10);
  }
  // Last: the stage draws once as soon as it is made.
  const S = stage(el, draw, { reducedMotion });
  return { destroy: S.destroy };
}
