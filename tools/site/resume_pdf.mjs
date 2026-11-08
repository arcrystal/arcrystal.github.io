// node tools/site/resume_pdf.mjs     The résumé as a PDF (resume/Alex-Crystal-Resume.pdf), printed by
// headless Chrome from the résumé page itself, so the two never disagree. Run it after changing the
// résumé (resume/content.html), then commit the PDF with the page.
//
// It serves the repository locally (serve.mjs), opens the page with motion paused (so nothing is
// waiting to fade in), waits for the fonts, and prints US Letter with the page's own print styles.
import fs from 'node:fs';
import path from 'node:path';
import { launch, REPO_ROOT } from './cdp.mjs';
import { createServer } from './serve.mjs';

const OUT = path.join(REPO_ROOT, 'resume', 'Alex-Crystal-Resume.pdf');

const srv = await createServer({ port: 0 });
const browser = await launch({});
try {
  const page = await browser.newPage({ width: 1100, height: 1400, init: "localStorage.setItem('ac-motion', 'paused');" });
  await page.goto(new URL("resume/resume.html", srv.url).href);
  await page.eval(() => document.fonts.ready.then(() => document.fonts.status));
  const { data } = await page.send('Page.printToPDF', {
    printBackground: true, paperWidth: 8.5, paperHeight: 11,
    marginTop: 0.5, marginBottom: 0.5, marginLeft: 0.55, marginRight: 0.55,
  });
  fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
  console.log(`wrote ${path.relative(REPO_ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
} finally {
  await browser.close();
  await srv.close();
}
