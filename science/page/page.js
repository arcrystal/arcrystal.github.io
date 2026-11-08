// Science page module. The page is complete without it (each figure keeps its still); this starts
// each live experiment as it nears the viewport (static/site/sims.js).
import { mountSims } from '/static/site/sims.js';

export function mount(main, ctx) {
  mountSims(main, { scope: ctx.scope, motion: ctx.motion });
  return null;
}
