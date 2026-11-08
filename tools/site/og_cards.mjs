// node tools/site/og_cards.mjs [id ...]     The share cards (static/og/<id>.jpg, 1200 × 630): the
// picture a link to each page shows in messages and feeds. Each is drawn by tools/site/og/card.html
// in that page's style, then photographed here by headless Chrome. build_pages.py points each
// page's og:image at its card. Run it after changing a page's name or line, or the card itself, and
// commit the JPEGs. With ids, only those cards.
import fs from 'node:fs';
import path from 'node:path';
import { launch, REPO_ROOT } from './cdp.mjs';
import { createServer } from './serve.mjs';

export const CARDS = ['home', 'about', 'science', 'racing', 'outdoors', 'photography', 'chess', 'resume', 'timeline'];
const OUT = path.join(REPO_ROOT, 'static', 'og');
const want = process.argv.slice(2);
for (const id of want) if (!CARDS.includes(id)) throw new Error(`unknown card "${id}" (cards: ${CARDS.join(', ')})`);

fs.mkdirSync(OUT, { recursive: true });
const srv = await createServer({ port: 0 });
const browser = await launch({});
try {
  const page = await browser.newPage({ width: 1200, height: 630 });
  for (const id of want.length ? want : CARDS) {
    await page.goto(new URL(`tools/site/og/card.html?id=${id}`, srv.url).href);
    await page.eval(() => new Promise((resolve, reject) => {
      const t0 = performance.now();
      (function wait() {
        if (document.documentElement.dataset.ready) return resolve();
        if (performance.now() - t0 > 15000) return reject(new Error('the card never finished drawing'));
        setTimeout(wait, 50);
      })();
    }));
    const file = path.join(OUT, `${id}.jpg`);
    const { bytes } = await page.screenshot(file, { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`wrote ${path.relative(REPO_ROOT, file)} (${Math.round(bytes / 1024)} KB)`);
  }
} finally {
  await browser.close();
  await srv.close();
}
