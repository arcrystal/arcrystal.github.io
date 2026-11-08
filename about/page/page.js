// About Me page module. The page is complete without it; this draws the AI Power Map strip and lets
// it be read moment by moment (static/site/powermap.js).
import { powermap } from '/static/site/powermap.js';

export function mount(main, ctx) {
  main.querySelectorAll('[data-pm]').forEach(el => powermap(el, { scope: ctx.scope, motion: ctx.motion }));
  return null;
}
