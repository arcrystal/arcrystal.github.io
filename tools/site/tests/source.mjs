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

/** Northeast Ultra 8 cards. */
export function parseUltra(html = loadSnapshot()) {
  const out = [];
  const re = /<article class="hike-card( is-complete)? reveal"><div><span>([^<]*)<\/span><b>([^<]*)<\/b><\/div><h3>([^<]*)<\/h3><p>([^<]*)<\/p><\/article>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ complete: !!m[1], where: decode(m[2]), state: m[3], title: decode(m[4]), meta: decode(m[5]) });
  }
  return out;
}

/** NH 48 completion activities: [{ title, meta, count, peaks }]. */
export function parseNh48(html = loadSnapshot()) {
  const start = Math.max(html.indexOf('<div class="summit-activities reveal">'), html.indexOf('<div class="summit-activities">'));
  const end = html.indexOf('<p class="source-note">', start);
  const block = html.slice(start, end);
  const out = [];
  const re = /<details(?: open)?><summary><span><b>([\s\S]*?)<\/b><small>([\s\S]*?)<\/small><\/span><em>([\s\S]*?)<\/em><\/summary><ul>([\s\S]*?)<\/ul><\/details>/g;
  let m;
  while ((m = re.exec(block))) {
    out.push({
      title: decode(m[1]), meta: decode(m[2]), count: decode(m[3]),
      peaks: [...m[4].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => decode(x[1])),
      html: m[0].replace('<details open>', '<details>'),
    });
  }
  return out;
}

/** Soccer snapshot: { sessions: [{ date, dateText, bar, time }], total, in2026, longest, through }. */
export function parseSoccer(html = loadSnapshot()) {
  const sessions = [];
  const re = /<div><time datetime="([^"]+)">([^<]+)<\/time><span><i style="--session:([\d.]+)%"><\/i><\/span><strong>([^<]+)<\/strong><\/div>/g;
  let m;
  while ((m = re.exec(html))) sessions.push({ date: m[1], dateText: m[2], bar: Number(m[3]), time: m[4] });
  const metric = (label) => {
    const r = new RegExp(`<div><strong>([^<]+)</strong><span>${label}</span></div>`).exec(html);
    return r ? r[1] : null;
  };
  const thr = /<time datetime="([^"]+)">through ([^<]+)<\/time>/.exec(html);
  return {
    sessions, total: metric('total time'), in2026: metric('sessions in 2026'), longest: metric('longest session'),
    through: thr ? { date: thr[1], text: thr[2] } : null,
  };
}

export const parseClock = (s) => s.trim().split(':').map(Number).reduce((t, p) => t * 60 + p, 0);

export function fmtClock(sec) {
  const r = Math.round(sec);
  const h = Math.floor(r / 3600), m = Math.floor((r % 3600) / 60), s = r % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export { text, decode };
