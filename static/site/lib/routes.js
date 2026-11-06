// Which URLs are pages of the site shell, and how to write them. Pure (no DOM, no globals
// needed): the browser router and the Node tests share it. Paths contain spaces, so routes are
// matched on decoded pathnames and written back %20-encoded, as the registry spells them.

// Standalone applications: never routed, whatever the registry says.
const STANDALONE = ['/ai-timeline/', '/coding projects/BirkieAnalysis/'];
// Attribute values that are already fragment-, scheme- or root-relative stay as they are.
const ABSOLUTE = /^(#|[a-z][a-z0-9+.-]*:|\/)/i;
const PAGE_FILE = /\.html?$/i;

export function decodePath(pathname) {
  try { return decodeURIComponent(pathname); } catch (_) { return null; }
}

// Decoded spellings that reach the same page: a directory, its index.html and, for directory
// pages, the path without the trailing slash (GitHub Pages redirects /about to /about/).
function aliases(path) {
  if (path === '/') return ['/', '/index.html'];
  if (path.endsWith('/')) return [path, path + 'index.html', path.slice(0, -1)];
  return [path];
}

function standalone(path) {
  return STANDALONE.some(prefix => path.startsWith(prefix) || path === prefix.slice(0, -1));
}

// The final path segment names a document that is not a page (.pdf, .apk, .md, images …).
function isFile(path) {
  const last = path.slice(path.lastIndexOf('/') + 1);
  return last.includes('.') && !PAGE_FILE.test(last);
}

// The routed pages of a registry: static/cinema/destinations.json (home, the five destinations,
// the résumé) or the older { places } shape.
export function placesOf(registry) {
  if (Array.isArray(registry?.destinations)) {
    const pages = Array.isArray(registry.pages) ? registry.pages : [];
    const page = p => ({ key: p.id, page: p.id, url: p.url, title: p.title, nav: p.title });
    return [
      ...pages.filter(p => p.id === 'home').map(page),
      ...registry.destinations.map(d => ({ ...page(d), destination: d })),
      ...pages.filter(p => p.id !== 'home').map(page),
    ];
  }
  return [...(registry?.places || [])];
}

export function createRoutes(registry) {
  const places = Object.freeze(placesOf(registry));
  const table = new Map();
  const pages = new Set();
  for (const place of places) {
    if (!place?.page || !place.url) continue;
    const canonical = new URL(String(place.url).split('#')[0], 'https://routes.invalid/');
    const path = decodePath(canonical.pathname);
    if (path == null || standalone(path)) continue;
    const entry = Object.freeze({
      key: place.page,                  // the page key (data-page); unique per route
      page: place.page,
      region: place.key,                // the destination id (older registries: the world region)
      view: place.view ?? null,         // about and resume are views of the hub
      url: canonical.pathname,          // %20-encoded, as written in markup
      path,
      place,
    });
    pages.add(place.page);
    for (const alias of aliases(path)) if (!table.has(alias)) table.set(alias, entry);
  }

  // → { key, region, page, view, url, path, hash, search, place } | null (null = not routable).
  // `url` is the canonical encoded path plus the hash; `path` is the decoded canonical path.
  function routeOf(url, base = globalThis.location?.href) {
    let u, b;
    try { b = new URL(base); u = new URL(url, b); } catch (_) { return null; }
    if (u.origin === 'null' || u.origin !== b.origin || !/^https?:$/.test(u.protocol)) return null;
    const path = decodePath(u.pathname);
    if (path == null || standalone(path) || isFile(path)) return null;
    const entry = table.get(path);
    if (!entry) return null;
    return {
      key: entry.key, page: entry.page, region: entry.region, view: entry.view,
      url: entry.url + u.hash, path: entry.path, hash: u.hash, search: u.search, place: entry.place,
    };
  }

  return {
    routeOf,
    isRoutable: (url, base) => routeOf(url, base) !== null,
    hasPage: key => pages.has(key),
    places,
  };
}

// A relative src/href/poster/data-src value from a fetched page, rewritten so it still points at
// the same file once the markup lives in another document: pathname + search + hash.
export function absolutizeAttr(value, baseUrl) {
  if (value == null) return value;
  const v = String(value).trim();
  if (!v || ABSOLUTE.test(v)) return value;
  try {
    const u = new URL(v, baseUrl);
    return u.pathname + u.search + u.hash;
  } catch (_) { return value; }
}

// The same for every candidate of a srcset; width and density descriptors are kept.
export function absolutizeSrcset(value, baseUrl) {
  if (value == null || !String(value).trim()) return value;
  return parseSrcset(String(value))
    .map(({ url, descriptor }) => absolutizeAttr(url, baseUrl) + (descriptor ? ` ${descriptor}` : ''))
    .join(', ');
}

// Candidate parsing after the HTML spec: a URL is a run of non-space characters (it may contain
// commas, as data: URLs do); trailing commas end a candidate; descriptors run to the next comma
// outside parentheses.
function parseSrcset(s) {
  const out = [];
  const space = c => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
  let i = 0;
  while (i < s.length) {
    while (i < s.length && (space(s[i]) || s[i] === ',')) i++;
    if (i >= s.length) break;
    let j = i;
    while (j < s.length && !space(s[j])) j++;
    let url = s.slice(i, j);
    let descriptor = '';
    i = j;
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      let depth = 0, k = i;
      for (; k < s.length; k++) {
        const c = s[k];
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (c === ',' && depth === 0) break;
      }
      descriptor = s.slice(i, k).trim().replace(/\s+/g, ' ');
      i = k + 1;
    }
    if (url) out.push({ url, descriptor });
  }
  return out;
}
