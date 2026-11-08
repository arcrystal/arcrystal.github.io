// Reads the racing records out of the page as it was before the cinematic rebuild
// (tools/site/fixtures/racing/athletics-before-cinema.html, a copy of the original athletics page).
// The records are the only source of facts for the new page: build_content.mjs derives the
// archive from them and the tests check every figure shown on the page against them.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SNAPSHOT = join(ROOT, 'tools', 'site', 'fixtures', 'racing', 'athletics-before-cinema.html');

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const text = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

export function loadSnapshot(path = SNAPSHOT) {
  return readFileSync(path, 'utf8');
}

/** Race groups: [{ title, small, count, rows: [{ date, dateText, discipline, title, meta, distance, unit, climb, time }] }] */
export function parseRaces(html = loadSnapshot()) {
  const groups = [];
  const re = /<details class="race-group">([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(html))) {
    const body = m[1];
    const head = /<summary><span><b>([\s\S]*?)<\/b><small>([\s\S]*?)<\/small><\/span><em>(\d+)<\/em><\/summary>/.exec(body);
    const rows = [];
    const rr = /<div class="race-row"><time datetime="([^"]+)">([^<]+)<\/time><div><span class="discipline-pill">([^<]+)<\/span><h3>([\s\S]*?)<\/h3><\/div><p class="race-meta">([^<]*)<\/p><strong>([^<]+)<\/strong><\/div>/g;
    let r;
    while ((r = rr.exec(body))) {
      const meta = decode(r[5]);
      const d = /([\d,.]+)\s*(mi|yd)/.exec(meta);
      const c = /([\d,]+)\s*ft/.exec(meta);
      rows.push({
        date: r[1], dateText: r[2], discipline: decode(r[3]), title: decode(r[4]), meta,
        distance: d ? Number(d[1].replace(/,/g, '')) : null, unit: d ? d[2] : null,
        climb: c ? Number(c[1].replace(/,/g, '')) : null, time: r[6],
      });
    }
    groups.push({ title: decode(head[1]), small: decode(head[2]), count: Number(head[3]), rows, html: m[0] });
  }
  return groups;
}

export function allRaceRows(html) {
  return parseRaces(html).flatMap((g) => g.rows.map((r) => ({ ...r, group: g.title })));
}

export { text, decode };
