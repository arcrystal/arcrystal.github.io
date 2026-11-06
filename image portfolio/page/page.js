// Mountains page module (CONTRACT section 2). The content is plain HTML that works without
// JavaScript; this adds the photograph viewer. Everything goes through ctx.scope, so unmount (and a
// later mount on Back or Forward) leaves nothing behind. image portfolio/gallery.js stays as it was
// for the old shell; this page does not use it.
import { createLightbox } from './lightbox.js';

export async function mount(main, ctx) {
  const lightbox = createLightbox(main, ctx.scope);
  return {
    unmount() { lightbox.close(); },
  };
}
