// Route table and URL rewriting (static/site/lib/routes.js).
// Run: node --test tools/site/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRoutes, absolutizeAttr, absolutizeSrcset, decodePath } from '../../../static/site/lib/routes.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGIN = 'https://arcrystal.github.io';
const HOME = `${ORIGIN}/`;
const GALLERY = `${ORIGIN}/image%20portfolio/gallery.html`;
const PROJECTS = `${ORIGIN}/coding%20projects/projects.html`;

// The places of architecture.md section 4, reduced to what routing reads.
export const REGISTRY = {
  version: 1,
  places: [
    { key: 'hub', page: 'home', url: '/', nav: 'Hub' },
    { key: 'mountains', page: 'gallery', url: '/image%20portfolio/gallery.html', nav: 'Mountains' },
    { key: 'racing', page: 'athletics', url: '/athletics/athletics.html', nav: 'Racing' },
    { key: 'chess', page: 'chess', url: '/chess/chess.html', nav: 'Chess' },
    { key: 'coding', page: 'projects', url: '/coding%20projects/projects.html', nav: 'Coding' },
    { key: 'hub', page: 'about', view: 'about', url: '/about/', nav: 'About' },
    { key: 'hub', page: 'resume', view: 'resume', url: '/resume/resume.html', nav: 'Résumé' },
  ],
};

const routes = createRoutes(REGISTRY);
const pick = r => r && { key: r.key, region: r.region, page: r.page, view: r.view, url: r.url, path: r.path, hash: r.hash };

test('the hub: /, /index.html, hashes and queries', () => {
  assert.deepEqual(pick(routes.routeOf('/', HOME)),
    { key: 'home', region: 'hub', page: 'home', view: null, url: '/', path: '/', hash: '' });
  assert.deepEqual(pick(routes.routeOf('/index.html', HOME)),
    { key: 'home', region: 'hub', page: 'home', view: null, url: '/', path: '/', hash: '' });
  assert.deepEqual(pick(routes.routeOf(`${ORIGIN}/#film-kick`, GALLERY)),
    { key: 'home', region: 'hub', page: 'home', view: null, url: '/#film-kick', path: '/', hash: '#film-kick' });
  const q = routes.routeOf('/?debug=world#about', HOME);
  assert.equal(q.key, 'home');
  assert.equal(q.search, '?debug=world');
  assert.equal(q.url, '/#about');
  assert.equal(routes.routeOf('#main', HOME).url, '/#main');
});

test('paths with spaces match decoded and %20 spellings and come back %20-encoded', () => {
  for (const spelling of ['/image%20portfolio/gallery.html', '/image portfolio/gallery.html', `${ORIGIN}/image%20portfolio/gallery.html`]) {
    assert.deepEqual(pick(routes.routeOf(spelling, HOME)), {
      key: 'gallery', region: 'mountains', page: 'gallery', view: null,
      url: '/image%20portfolio/gallery.html', path: '/image portfolio/gallery.html', hash: '',
    }, spelling);
  }
  assert.equal(routes.routeOf('gallery.html#top-50', GALLERY).url, '/image%20portfolio/gallery.html#top-50');
  assert.equal(routes.routeOf('#top-50', GALLERY).hash, '#top-50');
  const coding = routes.routeOf('/coding projects/projects.html#projects', HOME);
  assert.deepEqual([coding.key, coding.region, coding.url, coding.path],
    ['projects', 'coding', '/coding%20projects/projects.html#projects', '/coding projects/projects.html']);
});

test('/about and /about/ and /about/index.html are the about view of the hub', () => {
  for (const spelling of ['/about/', '/about', '/about/index.html', '../about/']) {
    assert.deepEqual(pick(routes.routeOf(spelling, `${ORIGIN}/chess/chess.html`)),
      { key: 'about', region: 'hub', page: 'about', view: 'about', url: '/about/', path: '/about/', hash: '' }, spelling);
  }
  assert.deepEqual(pick(routes.routeOf('/resume/resume.html#experience', HOME)), {
    key: 'resume', region: 'hub', page: 'resume', view: 'resume',
    url: '/resume/resume.html#experience', path: '/resume/resume.html', hash: '#experience',
  });
  assert.equal(routes.routeOf('/athletics/athletics.html#calculator', HOME).hash, '#calculator');
  assert.equal(routes.routeOf('/chess/chess.html', HOME).region, 'chess');
});

test('other origins and non-http schemes are not routable', () => {
  for (const url of ['https://example.com/', 'http://arcrystal.github.io/', '//example.com/about/',
    'mailto:crystal.a@northeastern.edu', 'tel:+15555550100', 'javascript:void(0)',
    'data:text/html,hi', 'https://github.com/arcrystal']) {
    assert.equal(routes.routeOf(url, HOME), null, url);
    assert.equal(routes.isRoutable(url, HOME), false, url);
  }
  // A file: page has an opaque origin: nothing routes.
  assert.equal(createRoutes(REGISTRY).routeOf('/about/', 'file:///Users/x/index.html'), null);
});

test('standalone applications, unknown paths and files are not routable', () => {
  for (const url of ['/ai-timeline/', '/ai-timeline', '/ai-timeline/index.html', '/ai-timeline/?q=x#y',
    '/coding%20projects/BirkieAnalysis/birkie.html', '/coding projects/BirkieAnalysis/', 'BirkieAnalysis/birkie.html',
    '/work/', '/work/index.html', '/chess/', '/CHESS/chess.html', '/image%20portfolio/', '/athletics/calculator.js',
    '/resume/resume.pdf', '/static/app.apk', '/design/world/plan.md', '/static/world/regions.json',
    '/static/world/posters/mountains.webp', '/404.html']) {
    assert.equal(routes.routeOf(url, PROJECTS), null, url);
  }
  // The exclusion wins even over a registry entry that names a standalone app.
  const bad = createRoutes({ places: [...REGISTRY.places,
    { key: 'coding', page: 'birkie', url: '/coding%20projects/BirkieAnalysis/birkie.html' },
    { key: 'coding', page: 'timeline', url: '/ai-timeline/' }] });
  assert.equal(bad.routeOf('/coding%20projects/BirkieAnalysis/birkie.html', HOME), null);
  assert.equal(bad.routeOf('/ai-timeline/', HOME), null);
  assert.equal(bad.hasPage('birkie'), false);
});

test('malformed input never throws', () => {
  assert.equal(routes.routeOf('/%E0%A4%A', HOME), null);
  assert.equal(routes.routeOf('http://[bad', HOME), null);
  assert.equal(routes.routeOf('/', 'not a url'), null);
  assert.equal(decodePath('/%E0%A4%A'), null);
  assert.equal(decodePath('/image%20portfolio/'), '/image portfolio/');
  assert.deepEqual(createRoutes(null).places, []);
  assert.equal(createRoutes(undefined).routeOf('/', HOME), null);
});

test('isRoutable, hasPage and places', () => {
  assert.equal(routes.isRoutable('/chess/chess.html', HOME), true);
  assert.equal(routes.isRoutable('/chess/chess.htm', HOME), false);
  assert.deepEqual(routes.places.map(p => p.page), ['home', 'gallery', 'athletics', 'chess', 'projects', 'about', 'resume']);
  assert.ok(routes.places.every(p => routes.hasPage(p.page)));
  assert.equal(routes.hasPage('work'), false);
  assert.equal(routes.routeOf('/', HOME).place, REGISTRY.places[0]);
});

test('absolutizeAttr rewrites only relative values, to pathname + search + hash', () => {
  const cases = [
    ['photos/a.jpg', GALLERY, '/image%20portfolio/photos/a.jpg'],
    ['my photo.jpg', GALLERY, '/image%20portfolio/my%20photo.jpg'],
    ['../static/x.css?v=2#h', GALLERY, '/static/x.css?v=2#h'],
    ['./gallery.js', GALLERY, '/image%20portfolio/gallery.js'],
    ['?q=1', GALLERY, '/image%20portfolio/gallery.html?q=1'],
    ['BirkieAnalysis/birkie.html', PROJECTS, '/coding%20projects/BirkieAnalysis/birkie.html'],
    ['../ai-timeline/', PROJECTS, '/ai-timeline/'],
    ['  trips/x.webp ', `${ORIGIN}/about/`, '/about/trips/x.webp'],
    ['https://example.com/x', GALLERY, 'https://example.com/x'],
    ['HTTPS://example.com/x', GALLERY, 'HTTPS://example.com/x'],
    ['mailto:crystal.a@northeastern.edu', GALLERY, 'mailto:crystal.a@northeastern.edu'],
    ['tel:+1', GALLERY, 'tel:+1'],
    ['data:image/png;base64,AAAA', GALLERY, 'data:image/png;base64,AAAA'],
    ['blob:https://x/y', GALLERY, 'blob:https://x/y'],
    ['#top-50', GALLERY, '#top-50'],
    ['/static/app.css?v=11', GALLERY, '/static/app.css?v=11'],
    ['//cdn.example.com/y.js', GALLERY, '//cdn.example.com/y.js'],
    ['', GALLERY, ''],
  ];
  for (const [value, base, want] of cases) assert.equal(absolutizeAttr(value, base), want, `${value} @ ${base}`);
  assert.equal(absolutizeAttr(null, GALLERY), null);
  assert.equal(absolutizeAttr(undefined, GALLERY), undefined);
});

test('absolutizeSrcset rewrites each candidate and keeps descriptors', () => {
  const base = `${ORIGIN}/image%20portfolio/gallery.html`;
  assert.equal(absolutizeSrcset('a.webp 1x, b.webp 2x', base), '/image%20portfolio/a.webp 1x, /image%20portfolio/b.webp 2x');
  assert.equal(absolutizeSrcset('/static/a.webp 800w, thumbs/b.webp 1600w', base), '/static/a.webp 800w, /image%20portfolio/thumbs/b.webp 1600w');
  assert.equal(absolutizeSrcset('a.webp 1x,b.webp 2x', base), '/image%20portfolio/a.webp 1x, /image%20portfolio/b.webp 2x');
  assert.equal(absolutizeSrcset('a.webp', base), '/image%20portfolio/a.webp');
  assert.equal(absolutizeSrcset('a.webp, b.webp 2x', base), '/image%20portfolio/a.webp, /image%20portfolio/b.webp 2x');
  assert.equal(absolutizeSrcset('  ../p/a.webp   480w  ,\n ../p/b.webp 960w ', base), '/p/a.webp 480w, /p/b.webp 960w');
  // data: URLs contain commas; a URL is a run of non-space characters.
  assert.equal(absolutizeSrcset('data:image/png;base64,AA,BB= 1x, b.png 2x', base), 'data:image/png;base64,AA,BB= 1x, /image%20portfolio/b.png 2x');
  assert.equal(absolutizeSrcset('https://x.test/a.png 1x, //cdn.test/b.png 2x', base), 'https://x.test/a.png 1x, //cdn.test/b.png 2x');
  assert.equal(absolutizeSrcset('', base), '');
  assert.equal(absolutizeSrcset(null, base), null);
});

test('the site registry routes every page to itself', () => {
  const registry = JSON.parse(readFileSync(`${ROOT}static/site/destinations.json`, 'utf8'));
  const real = createRoutes(registry);
  assert.equal(real.places.length, 7);
  for (const place of real.places) {
    const route = real.routeOf(place.url, HOME);
    assert.ok(route, place.url);
    assert.equal(route.page, place.page);
    assert.match(route.url, /^\/[^ ]*$/, 'canonical URLs are %20-encoded');
  }
  for (const page of ['home', 'chess', 'racing', 'coding', 'mountains', 'about', 'resume']) assert.ok(real.hasPage(page), page);
  assert.equal(real.routeOf('/coding%20projects/BirkieAnalysis/birkie.html', HOME), null, 'standalone apps are never routed');
});
