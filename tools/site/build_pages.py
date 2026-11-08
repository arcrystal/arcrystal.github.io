"""Builds every page of the site from one template.

  python3 tools/site/build_pages.py                  # every page
  python3 tools/site/build_pages.py --only chess     # one destination page, then the homepage
  python3 tools/site/build_pages.py --only home      # the homepage only
  python3 tools/site/build_pages.py --check          # build in memory; exit 1 when a file would change

Sources:
- static/site/destinations.json: order, titles, URLs, styles, numbers and next links.
- static/site/styles.json: the six styles (names, page colours, scene ids).
- Each destination's package, <dir>/page/: meta.json (copy, on-page index, module, stylesheets,
  old fragment ids, homepage band data) and content.html (the page body: no <html>, <head>,
  <body>, <main>, <h1> or <script>). Markers in content.html are filled here (generated()): the
  Birkie route, the race list, the 48 skyline and its hikes, the Power Map strip, About's
  timeline (timeline.html) and the Science experiments that exist.
- resume/content.html: the résumé body.

Every page: head (title, description, canonical, social preview, stylesheets with content hashes,
an import map that versions every module), the header, <main>, the contact section and footer.
The homepage is a sentence whose phrases open the six destinations, with the crystal beside it,
then one band per destination in its own style (static/site/home.js joins them with the scene's
seams). A destination page is a hero in its style, its content and a card for the next
destination. Without JavaScript every page is complete. Old URLs in the registry's redirects get a
small page that forwards. Files are written atomically and only when they change.
"""
import argparse
import hashlib
import html
import json
import math
import os
import re
import sys
from urllib.parse import quote, unquote, urlsplit

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SITE_DIR = 'static/site'
SITE = 'https://arcrystal.github.io'
EMAIL = 'crystal.a@northeastern.edu'
GITHUB = 'https://github.com/arcrystal'
LINKEDIN = 'https://linkedin.com/in/alex-crystal-326b5a175/'
RESUME = '/resume/resume.html'
SHELL = f'{SITE_DIR}/shell.js'
HOME_DESCRIPTION = ('Alex Crystal — generative AI engineer at MITRE, Nordic ski racer and runner, hiker of all 48 New '
                    'Hampshire 4,000-footers, photographer and chess player.')


esc = html.escape


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


REG = load_json(f'{SITE_DIR}/destinations.json')
STYLES = load_json(f'{SITE_DIR}/styles.json')
DESTS = REG['destinations']
BY_ID = {d['id']: d for d in DESTS}
IDS = [d['id'] for d in DESTS]
STYLE_SHEETS = [f'{SITE_DIR}/tokens.css', f'{SITE_DIR}/site.css'] + [f'{SITE_DIR}/styles/{s}.css' for s in STYLES['order']]
FORBIDDEN = re.compile(r'<\s*(html|head|body|main|h1|script)\b', re.I)


class BuildError(Exception):
    pass


def style_of(ident):
    return STYLES['styles'][ident]


# ---- helpers ------------------------------------------------------------------------------------

def file_of(url):
    """Repository-relative file served at a site URL ('/' → 'index.html')."""
    path = unquote(urlsplit(url).path).lstrip('/')
    return path + 'index.html' if path == '' or path.endswith('/') else path


def url_of(rel):
    """Site URL of a repository-relative path, spaces as %20."""
    return '/' + quote(rel.replace(os.sep, '/'), safe='/')


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


_HASHES = {}


def vhash(rel):
    """Short content hash of a repository file, for ?v= cache busting."""
    path = os.path.join(ROOT, rel)
    try:
        st = os.stat(path)
    except FileNotFoundError:
        raise BuildError(f'missing file: {rel}')
    key = (path, st.st_mtime_ns, st.st_size)
    if key not in _HASHES:
        with open(path, 'rb') as f:
            _HASHES[key] = hashlib.sha1(f.read()).hexdigest()[:10]
    return _HASHES[key]


def versioned(rel):
    return f'{url_of(rel)}?v={vhash(rel)}'


def js_files(rel_dir):
    out = []
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, rel_dir)):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.'))
        out += [os.path.relpath(os.path.join(dirpath, f), ROOT) for f in sorted(filenames) if f.endswith('.js')]
    return out


_IMPORT_MAP = []


def import_map():
    """Every module the pages can import, mapped to a content-hashed URL, so a new deploy never
    mixes old and new modules (GitHub Pages caches for ten minutes)."""
    if not _IMPORT_MAP:
        files = js_files(SITE_DIR)
        for d in DESTS:
            files += js_files(os.path.join(d['dir'], 'page'))
        files += ['athletics/calculator.js', 'resume/resume.js', 'static/vendor/chess/chess.js']
        imports = {url_of(rel): versioned(rel) for rel in files}
        _IMPORT_MAP.append(json.dumps({'imports': imports}, separators=(',', ':'), ensure_ascii=False))
    return _IMPORT_MAP[0]


def boot_script():
    """Runs before first paint: html.js and the motion choice (html.motion-paused, only when the
    visitor paused it: motion is on by default, whatever the system setting). If the shell
    never reports html.app-ready, html.js is dropped after 6 s so JavaScript-only states cannot
    hide content."""
    return ("(function(){var d=document.documentElement;d.classList.add('js');try{"
            "if(localStorage.getItem('ac-motion')==='paused')d.classList.add('motion-paused');"
            "}catch(e){}"
            "setTimeout(function(){if(!d.classList.contains('app-ready'))d.classList.remove('js')},6000)})()")


def site_data():
    """The registry and styles the shell reads without a request."""
    return json.dumps({'registry': REG, 'styles': STYLES}, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')


# ---- packages -----------------------------------------------------------------------------------

class Package:
    def __init__(self, reg):
        self.reg = reg
        self.id = reg['id']
        self.dir = reg['dir']
        self.pdir = os.path.join(reg['dir'], 'page')
        self.style = reg['style']
        try:
            self.meta = load_json(os.path.join(self.pdir, 'meta.json'))
        except (OSError, ValueError) as e:
            raise BuildError(f'{self.pdir}/meta.json: {e}')
        for key in ('docTitle', 'description', 'line', 'lede', 'index', 'preview'):
            if key not in self.meta:
                raise BuildError(f'{self.pdir}/meta.json: missing "{key}"')
        self.content = read(os.path.join(self.pdir, 'content.html'))
        bad = FORBIDDEN.search(self.content)
        if bad:
            raise BuildError(f'{self.pdir}/content.html contains <{bad.group(1)}>')
        self.styles = [os.path.join(self.pdir, s) for s in self.meta.get('styles', [])]
        self.module = url_of(os.path.join(self.pdir, self.meta['module'])) if self.meta.get('module') else None

    def asset(self, rel):
        return url_of(os.path.join(self.pdir, rel))


# ---- shared template ----------------------------------------------------------------------------

_NAV_EXTRA = {'resume': ('Résumé', RESUME), 'contact': ('Contact', '#contact')}
NAV = [(k, BY_ID[k]['title'], BY_ID[k]['url']) if k in BY_ID else (k, *_NAV_EXTRA[k]) for k in REG['nav']]


def head(title, description, canonical, theme_color, styles, preload=()):
    links = [f'<link rel="stylesheet" href="{esc(versioned(s))}">' for s in STYLE_SHEETS]
    links += [f'<link rel="stylesheet" href="{esc(versioned(s))}" data-page-style>' for s in styles]
    fonts = ['dm-sans-latin-1.woff2', *preload]
    preloads = '\n'.join(f'<link rel="preload" as="font" href="/static/fonts/{f}" type="font/woff2" crossorigin>' for f in fonts)
    nl = '\n'
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="theme-color" content="{theme_color}">
<link rel="canonical" href="{SITE}{canonical}">
<link rel="icon" href="/static/crystal-mark.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Alex Crystal">
<meta property="og:url" content="{SITE}{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:image" content="{SITE}/static/og.jpg">
<meta name="twitter:card" content="summary_large_image">
{preloads}
{nl.join(links)}
<script>{boot_script()}</script>
<script type="importmap">{import_map()}</script>
</head>'''


def header(current):
    items = []
    for key, label, href in NAV:
        cur = ' aria-current="page"' if key == current else ''
        items.append(f'      <li><a href="{href}" data-nav="{key}"{cur}>{esc(label)}</a></li>')
    nl = '\n'
    home_cur = ' aria-current="page"' if current == 'home' else ''
    return f'''<header class="site-header" id="site-header">
  <a class="brand" href="/" data-nav="home"{home_cur}><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">Alex Crystal</span></a>
  <nav class="site-nav" id="site-nav" aria-label="Primary">
    <ul role="list">
{nl.join(items)}
    </ul>
  </nav>
  <div class="site-controls">
    <button type="button" class="control motion-toggle" data-motion-toggle aria-pressed="true" hidden><span class="motion-dot" aria-hidden="true"></span>Motion</button>
    <button type="button" class="control menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="site-nav" hidden>Menu</button>
  </div>
</header>'''


def contact():
    return f'''<section class="contact" id="contact" aria-labelledby="contact-title">
  <div class="wrap contact-inner">
    <h2 class="contact-title" id="contact-title">Contact</h2>
    <ul class="contact-links" role="list">
      <li><a href="mailto:{EMAIL}"><span class="label">Email</span><span class="contact-value">{EMAIL}</span></a></li>
      <li><a href="{GITHUB}" target="_blank" rel="noreferrer"><span class="label">GitHub</span><span class="contact-value">arcrystal <span aria-hidden="true">↗</span></span></a></li>
      <li><a href="{LINKEDIN}" target="_blank" rel="noreferrer"><span class="label">LinkedIn</span><span class="contact-value">Alex Crystal <span aria-hidden="true">↗</span></span></a></li>
      <li><a href="{RESUME}"><span class="label">Résumé</span><span class="contact-value">Read the résumé <span aria-hidden="true">→</span></span></a></li>
    </ul>
  </div>
</section>'''


def footer():
    links = ''.join(f'<li><a href="{href}">{esc(label)}</a></li>' for key, label, href in NAV if key != 'contact')
    return f'''<footer class="site-foot">
  <div class="wrap foot-inner">
    <p class="foot-name">© <span data-year>2026</span> Alex Crystal</p>
    <nav class="foot-nav" aria-label="Footer"><ul role="list">{links}</ul></nav>
    <a class="foot-top" href="#main">Back to top <span aria-hidden="true">↑</span></a>
  </div>
</footer>'''


def page(*, title, description, canonical, style, styles, current, page_id, main_attrs, main_html, preload=()):
    theme = style_of(style)['colors']['bg']
    return f'''{head(title, description, canonical, theme, styles, preload)}
<body data-page="{page_id}" data-style="{style}">
<a class="skip-link" href="#main">Skip to content</a>
{header(current)}
<main id="main" tabindex="-1" data-page="{page_id}" data-style="{style}" data-title="{esc(title)}"{main_attrs}>
{main_html}
</main>
{contact()}
{footer()}
<script type="application/json" id="site-data">{site_data()}</script>
<script type="module" src="{versioned(SHELL)}"></script>
</body>
</html>
'''


# ---- code-drawn art -----------------------------------------------------------------------------
# Every backdrop and ornament is markup and CSS; nothing here is an image file.

def f1(x):
    return f'{x:.1f}'.rstrip('0').rstrip('.')


_IDS = [0]


def uid(prefix):
    """Ids for gradients and filters, unique within a page even when a style's art appears twice."""
    _IDS[0] += 1
    return f'{prefix}{_IDS[0]}'


def ridge(width, base, amp, seed, step=16):
    """A mountain ridgeline: a sum of sines, sharpened toward the peaks, closed to the bottom."""
    pts = []
    for x in range(0, width + step, step):
        t = x / width
        y = math.sin(t * 6.1 + seed) * 0.5 + math.sin(t * 13.7 + seed * 2.3) * 0.28 + math.sin(t * 29 + seed * 4.1) * 0.1
        y = base - amp * (abs(y) ** 0.85) * (1 if y > 0 else 0.45)
        pts.append(f'{x} {f1(y)}')
    return f'M0 {base + 400}L' + 'L'.join(pts) + f'L{width} {base + 400}Z'


def ink_art():
    """Ink-wash ridges fading into mist on plain paper (the CSS stand-in for the Ink & Mist scene)."""
    layers = [(170, 90, 1.2, 0.10), (250, 120, 2.9, 0.16), (330, 110, 4.4, 0.26), (420, 90, 0.7, 0.42)]
    defs, paths = [], []
    for base, amp, seed, alpha in layers:
        g = uid('mist')
        defs.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C1A17" stop-opacity="{alpha}"/>'
                    f'<stop offset=".55" stop-color="#1C1A17" stop-opacity="0"/></linearGradient>')
        paths.append(f'<path d="{ridge(1600, base, amp, seed)}" fill="url(#{g})"/>')
    return (f'<svg class="art-mist" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice"><defs>{"".join(defs)}</defs>'
            f'{"".join(paths)}</svg>')


def glass_art():
    return '<i class="art-orb art-orb--1"></i><i class="art-orb art-orb--2"></i><i class="art-orb art-orb--3"></i><i class="art-grid"></i><i class="art-streak"></i>'


def fern(x, y, length, angle, curl, leaves=22, mirror=1):
    """One fern frond: a curved rachis with paired pinnae that shorten toward the tip."""
    parts = []
    pts = []
    for i in range(leaves + 1):
        t = i / leaves
        a = math.radians(angle) + mirror * curl * t * t
        px = x + math.sin(a) * length * t
        py = y - math.cos(a) * length * t
        pts.append((px, py, a))
    rachis = 'M' + ' L'.join(f'{f1(px)} {f1(py)}' for px, py, _ in pts)
    for i, (px, py, a) in enumerate(pts[1:-1], start=1):
        t = i / leaves
        size = length * 0.2 * (1 - t) ** 0.8 + 3
        for side in (-1, 1):
            la = a + side * math.radians(62 - 20 * t)
            tx, ty = px + math.sin(la) * size, py - math.cos(la) * size
            nx, ny = math.cos(la) * size * 0.22, math.sin(la) * size * 0.22
            parts.append(f'M{f1(px)} {f1(py)}Q{f1((px + tx) / 2 + nx)} {f1((py + ty) / 2 + ny)} {f1(tx)} {f1(ty)}'
                         f'Q{f1((px + tx) / 2 - nx)} {f1((py + ty) / 2 - ny)} {f1(px)} {f1(py)}Z')
    return rachis, ''.join(parts)


def folio_art():
    """Two clusters of fern fronds, anchored to the left and right edges at any aspect ratio."""
    sides = {
        'l': [(150, 1000, 640, 8, 0.6, 22, 1), (40, 1000, 760, 22, 0.55, 26, 1), (290, 1000, 470, -4, 0.5, 18, 1)],
        'r': [(450, 1000, 640, -8, -0.6, 22, -1), (560, 1000, 780, -22, -0.55, 26, -1), (320, 1000, 480, 4, -0.5, 18, -1)],
    }
    out = []
    for side, fronds in sides.items():
        groups = []
        for i, fr in enumerate(fronds):
            rachis, leaves = fern(*fr)
            groups.append(f'<g class="art-frond art-frond--{i + 1}"><path class="art-rachis" d="{rachis}"/><path class="art-leaf" d="{leaves}"/></g>')
        align = 'xMinYMax' if side == 'l' else 'xMaxYMax'
        out.append(f'<svg class="art-ferns art-ferns--{side}" viewBox="0 0 600 1000" preserveAspectRatio="{align} meet">{"".join(groups)}</svg>')
    return '\n'.join(out) + '\n<i class="art-hatch"></i><i class="art-vignette"></i>'


def cosmos_art():
    """Deep space: a few nebula washes, a star field and three chrome drops (the CSS stand-in for the
    Liquid Cosmos scene)."""
    stars = ''.join(f'<circle cx="{(i * 397) % 1600}" cy="{(i * 211 + 37) % 900}" r="{0.6 + (i * 7 % 5) * 0.25:.2f}"/>' for i in range(90))
    return (f'<i class="art-nebula"></i><svg class="art-stars" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">{stars}</svg>'
            '<i class="art-drop art-drop--1"></i><i class="art-drop art-drop--2"></i><i class="art-drop art-drop--3"></i>')


def darkroom_art():
    """Darkroom black under a red safelight, with the faint ripple of a developing tray."""
    return '<i class="art-safelight"></i><i class="art-tray"></i><i class="art-grain"></i>'


ART = {'ink': ink_art, 'glass': glass_art, 'cosmos': cosmos_art, 'folio': folio_art, 'darkroom': darkroom_art}

GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+<>/=\\'


def letters(text):
    """A title as one span per letter (--i, a jitter --r and a decoy glyph for the Signal decode),
    for the per-letter choreography. Screen readers get the real text from a visually hidden copy."""
    i, words = 0, []
    for word in text.split(' '):
        chars = []
        for ch in word:
            r = ((i * 7919 + 3) % 13) / 6 - 1
            chars.append(f'<span class="ch" style="--i:{i};--r:{r:.2f}" data-g="{esc(GLYPHS[(i * 11 + len(text)) % len(GLYPHS)])}">{esc(ch)}</span>')
            i += 1
        words.append(f'<span class="w">{"".join(chars)}</span>')
    return f'<span class="sr-only">{esc(text)}</span><span class="tt" aria-hidden="true" style="--n:{max(i, 1)}">{" ".join(words)}</span>'


# The facets' colours in the crystal's stand-in, by style; facet k shows destination k.
FACETS = {'house': ('#FFFFFF', '#BDB7AC'), 'cosmos': ('#1B1745', '#22E6FF'), 'glass': ('#F4F9FC', '#7DBBF0'),
          'folio': ('#0F1913', '#CDA562'), 'darkroom': ('#0B0A09', '#C7302A'), 'ink': ('#F3EEE3', '#8E877C')}


def crystal_svg():
    """The homepage crystal as a still: a hexagonal gem whose six facets stand for the six
    destinations, around a pale table. The scene draws the live crystal over it."""
    n = len(DESTS)

    def pt(k, r):
        a = math.radians(360 / n * k)
        return f'{f1(100 + r * math.sin(a))},{f1(100 - r * math.cos(a))}'
    grads, faces, spokes = [], [], []
    for k, d in enumerate(DESTS):
        c0, c1 = FACETS[d['style']]
        g = f'cf{k}'
        grads.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></linearGradient>')
        faces.append(f'<polygon points="{pt(k, 42)} {pt(k, 100)} {pt(k + 1, 100)} {pt(k + 1, 42)}" fill="url(#{g})"/>')
        (x0, y0), (x1, y1) = pt(k, 42).split(','), pt(k, 100).split(',')
        spokes.append(f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}"/>')
    table = ' '.join(pt(k, 42) for k in range(n))
    outline = ' '.join(pt(k, 100) for k in range(n))
    return (f'<svg class="crystal-still" viewBox="0 0 200 200" aria-hidden="true"><defs>{"".join(grads)}</defs>{"".join(faces)}'
            f'<polygon points="{table}" fill="#FBFAF8"/><g fill="none" stroke="#fff" stroke-width="0.8"><polygon points="{outline}"/>'
            f'<polygon points="{table}"/>{"".join(spokes)}</g></svg>')


# ---- generated pieces (real data only) -------------------------------------------------------------

FILES = 'abcdefgh'


def board_svg(fen, last=(), cls='pv-board'):
    rows = fen.split()[0].split('/')
    squares, pieces, marks = [], [], []
    for r in range(8):
        for c in range(8):
            if (r + c) % 2:
                squares.append(f'M{c * 45} {r * 45}h45v45h-45z')
    for sq in last:
        c, r = FILES.index(sq[0]), 8 - int(sq[1])
        marks.append(f'<rect class="pv-hl" x="{c * 45}" y="{r * 45}" width="45" height="45"/>')
    for r, row in enumerate(rows):
        c = 0
        for ch in row:
            if ch.isdigit():
                c += int(ch)
                continue
            code = ('w' if ch.isupper() else 'b') + ch.upper()
            pieces.append(f'<use href="#{code}" width="45" height="45" transform="translate({c * 45} {r * 45})" data-sq="{FILES[c]}{8 - r}"/>')
            c += 1
    # The dark squares and the edge are brushed: a little displacement makes the wash uneven.
    return (f'<svg class="{cls}" viewBox="0 0 360 360" aria-hidden="true"><defs><filter id="pv-wash" x="-4%" y="-4%" width="108%" height="108%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="3.5"/></filter></defs>'
            f'<rect class="pv-sq-light" width="360" height="360"/><path class="pv-sq-dark" d="{"".join(squares)}" filter="url(#pv-wash)"/>'
            f'<rect class="pv-edge" x="1" y="1" width="358" height="358" filter="url(#pv-wash)"/>'
            f'<g data-marks>{"".join(marks)}</g><g data-pieces>{"".join(pieces)}</g></svg>')


def route_svg(rel, cls):
    data = load_json(rel)
    w, h = data['viewBox']
    pts = ' '.join(f'{x},{y}' for x, y in data['points'])
    (sx, sy), (ex, ey) = data['points'][0], data['points'][-1]
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" aria-hidden="true"><polyline class="rt-glow" points="{pts}"/>'
            f'<polyline class="rt-line" points="{pts}" pathLength="1"/><circle class="rt-start" cx="{sx}" cy="{sy}" r="4.5"/>'
            f'<circle class="rt-end" cx="{ex}" cy="{ey}" r="4.5"/><circle class="rt-dot" cx="{sx}" cy="{sy}" r="6"/></svg>')


def json_attr(value):
    return esc(json.dumps(value, separators=(',', ':'), ensure_ascii=False))


def powermap_strip():
    """The AI Power Map as one strip: a tick per dated moment across 2021–2026, the two moments the
    map marks as inflections taller. home.js and the About page read the titles from data-pm-events."""
    from datetime import date
    data = load_json('ai-timeline/timeline-data.json')
    ev = sorted(data['events'], key=lambda e: e['date'])
    t0, t1 = date(2021, 1, 1), date(2026, 12, 31)
    span = (t1 - t0).days

    def x(iso):
        parts = [int(v) for v in iso.split('-')] + [15]   # a month-only date sits mid-month
        return (date(*parts[:3]) - t0).days / span * 1000
    ticks = []
    for i, e in enumerate(ev):
        tall = str(e.get('inflection')).lower() == 'true'
        h = 56 if tall else 22 + (i * 37 % 13)
        ticks.append(f'<rect x="{x(e["date"]):.1f}" y="{60 - h}" width="2" height="{h}"{" class=\"is-tall\"" if tall else ""}/>')
    years = ''.join(f'<span style="--x:{x(f"{y}-01-01") / 10:.2f}%">{y}</span>' for y in range(2021, 2027))
    events = [[e['displayDate'], e['title']] for e in ev]
    last = ev[-1]
    return f'''<div class="pm" data-pm data-pm-events="{json_attr(events)}">
  <svg class="pm-strip" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">{''.join(ticks)}</svg>
  <p class="pm-years" aria-hidden="true">{years}</p>
  <p class="pm-read" aria-hidden="true"><b data-pm-date>{esc(last['displayDate'])}</b> <span data-pm-title>{esc(last['title'])}</span></p>
</div>'''


def skyline_svg():
    """The 48 four-thousand footers as one engraved range: a peak per summit in the order I climbed
    them, each as tall as its elevation. Outdoors (and its band on the homepage) light them in turn."""
    data = load_json('outdoors/page/peaks.json')
    peaks = data['peaks']
    W, H, n = 1200, 300, len(peaks)
    step = W / (n + 1)
    lo, hi = 3300, max(p['ft'] for p in peaks)
    shapes = []
    for i, p in enumerate(peaks):
        cx = step * (i + 1)
        h = (p['ft'] - lo) / (hi - lo) * (H - 30)
        hb = step * (1.35 + 0.25 * ((i * 7) % 3))
        pts = f'{f1(cx - hb)},{H} {f1(cx)},{f1(H - h)} {f1(cx + hb)},{H}'
        shapes.append((p['ft'], f'<g class="sk-peak" style="--i:{i}" data-i="{i}" data-name="{esc(p["name"])}" data-ft="{p["ft"]:,}" '
                                f'data-date="{esc(p["date"])}" data-hike="{esc(p["hike"])}"><polygon class="sk-fill" points="{pts}"/>'
                                f'<polyline class="sk-ridge" points="{pts}"/></g>'))
    # Taller peaks paint first, so nearer, lower ones overlap them as in a real range.
    body = ''.join(s for _, s in sorted(shapes, key=lambda t: -t[0]))
    hatch = ('<pattern id="sk-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">'
             '<line x1="0" y1="0" x2="0" y2="5" class="sk-hatch-line"/></pattern>')
    return f'<svg class="o-skyline" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs>{hatch}</defs>{body}</svg>'


def fmt_date(iso, year=True):
    from datetime import date
    y, m, d = map(int, iso.split('-'))
    return date(y, m, d).strftime('%b %-d, %Y' if year else '%b %-d')


def hikes_list():
    data = load_json('outdoors/page/peaks.json')
    rows = []
    for h in reversed(data['hikes']):
        peaks = ', '.join(h['peaks'])
        rows.append(f'<li class="o-hike"><time datetime="{h["date"]}">{fmt_date(h["date"])}</time><div><p class="o-hike-name">{esc(h["hike"])}</p>'
                    f'<p class="o-hike-peaks">{esc(peaks)}</p></div><p class="o-hike-meta">{esc(h["distance"])} · {esc(h["climb"])} · {esc(h["time"])}</p></li>')
    return f'<ol class="o-hikes" role="list" reversed>{"".join(rows)}</ol>'


def extreme_art(kind, uid):
    """A small engraving for one of Earth's Extremes (240 × 140): a hatched silhouette and a few
    lines, in the folio's manner. uid keeps each card's clip path its own."""
    H = 'url(#x-hatch)'
    H2 = 'url(#x-hatch-dense)'
    def sil(d, fill=H, rule='nonzero'):
        return f'<path d="{d}" fill="{fill}" fill-rule="{rule}" class="x-sil"/>'
    def ln(d, cls='x-ln'):
        return f'<path d="{d}" class="{cls}"/>'
    parts = []
    if kind in ('k2', 'alpamayo', 'chopicalqui'):
        tops = {
            'k2': [(8, 128), (70, 84), (96, 70), (112, 36), (121, 14), (131, 34), (146, 62), (178, 82), (232, 128)],
            'alpamayo': [(20, 128), (84, 62), (110, 30), (120, 18), (131, 31), (156, 62), (220, 128)],
            'chopicalqui': [(6, 128), (48, 96), (82, 66), (104, 44), (116, 36), (128, 48), (146, 30), (160, 40), (188, 74), (234, 128)],
        }[kind]
        d = 'M' + ' L'.join(f'{x} {y}' for x, y in tops) + ' Z'
        parts.append(f'<clipPath id="x-c-{uid}"><path d="{d}"/></clipPath>')
        parts.append(sil(d))
        def top(x):
            for (x0, y0), (x1, y1) in zip(tops, tops[1:]):
                if x0 <= x <= x1:
                    return y0 + (y1 - y0) * (x - x0) / max(x1 - x0, 1)
            return 128
        if kind == 'k2':
            parts += [ln('M121 14 L116 52 L104 90 L92 128'), ln('M121 14 L138 60 L150 98'), ln('M100 70 Q121 80 146 64', 'x-ln x-snow')]
        elif kind == 'alpamayo':
            # The fluted face: ribs from the ridge down into the snowfield.
            ribs = ''.join(f'M{x} {top(x) + 1.5:.1f} L{x + (x - 120) * 0.12:.1f} {108 - abs(x - 120) * 0.5:.1f} ' for x in range(88, 154, 5))
            parts.append(f'<path d="{ribs}" class="x-ln x-fine" clip-path="url(#x-c-{uid})"/>')
        else:
            parts += [ln('M70 94 Q100 86 130 92'), ln('M92 74 Q120 66 152 72'), ln('M150 102 Q178 96 206 106'), ln('M116 36 L128 48 L146 30', 'x-ln x-snow')]
        parts.append(f'<path d="{d}" class="x-edge" fill="none"/>')
    elif kind == 'canopy':
        crowns = [(18, 84, 15), (44, 80, 17), (72, 86, 14), (96, 76, 16), (146, 80, 16), (172, 86, 14), (198, 78, 17), (226, 84, 15)]
        parts += [ln(f'M{x} {y + r - 2} L{x} 120', 'x-ln x-fine') for x, y, r in crowns]
        parts.append(ln('M120 70 L120 120 M120 92 L108 84 M120 98 L134 88', 'x-ln'))
        for x, y, r in crowns + [(120, 50, 23)]:
            parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{H}" class="x-edge"/>')
        parts.append(ln('M0 124 Q60 114 120 126 T240 120', 'x-ln x-water'))
    elif kind == 'dunes':
        parts.append('<circle cx="188" cy="36" r="13" class="x-edge" fill="none"/>')
        parts.append(sil('M0 128 L0 100 Q40 82 80 96 Q120 112 160 90 Q200 70 240 88 L240 128 Z'))
        parts.append(sil('M0 128 L0 116 Q60 102 120 118 Q170 130 240 110 L240 128 Z', H2))
        parts += [ln('M0 100 Q40 82 80 96 Q120 112 160 90 Q200 70 240 88'), ln('M0 116 Q60 102 120 118 Q170 130 240 110')]
    elif kind == 'hoodoos':
        for x, w, h in [(22, 16, 70), (48, 20, 96), (76, 14, 58), (100, 22, 104), (130, 16, 78), (156, 20, 90), (184, 14, 62), (210, 20, 84)]:
            t = 128 - h
            l, r = x - w / 2, x + w / 2
            d = (f'M{l} 128 C{l - 4} {t + h * 0.7:.0f} {l + 5} {t + h * 0.45:.0f} {l + 1} {t + h * 0.25:.0f} '
                 f'C{l - 2} {t + 14} {l + 2} {t + 9} {l} {t + 7} L{r} {t + 7} C{r - 2} {t + 9} {r + 2} {t + 14} {r - 1} {t + h * 0.25:.0f} '
                 f'C{r - 5} {t + h * 0.45:.0f} {r + 4} {t + h * 0.7:.0f} {r} 128 Z')
            parts.append(sil(d))
            parts.append(f'<path d="{d}" class="x-edge" fill="none"/>')
            parts.append(f'<rect x="{l - 3}" y="{t}" width="{w + 6}" height="7" class="x-edge x-cap"/>')
    elif kind == 'falls':
        parts.append(sil('M190 128 L196 72 L240 68 L240 128 Z', H2))
        parts.append(sil('M0 128 L0 30 L148 26 L156 34 L152 128 Z'))
        parts.append('<path d="M0 30 L148 26 L156 34 L152 128" class="x-edge" fill="none"/>')
        parts.append(''.join(ln(f'M{x} 33 Q{x + 2} 80 {x + 1} 120', 'x-ln x-water') for x in (156, 159, 162)))
        parts.append(''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" class="x-ln x-mist"/>' for cx, cy, r in [(160, 124, 9), (170, 118, 6), (150, 120, 5)]))
    elif kind == 'shield':
        parts.append(ln('M0 64 L240 64', 'x-ln x-water'))
        parts.append(sil('M0 128 Q60 112 90 82 Q110 58 120 48 Q130 58 150 82 Q180 112 240 128 Z'))
        parts.append('<path d="M0 128 Q60 112 90 82 Q110 58 120 48 Q130 58 150 82 Q180 112 240 128" class="x-edge" fill="none"/>')
        parts.append('<rect x="0" y="64" width="240" height="64" class="x-sea"/>')
        parts.append(ln('M224 48 L224 128 M219 48 L229 48 M219 128 L229 128', 'x-ln x-fine'))
        parts.append(ln('M116 46 Q121 30 112 18 Q108 10 114 4', 'x-ln x-fine'))
    elif kind == 'kelp':
        parts.append(''.join(ln(f'M{x} 0 L{x + 30} 128', 'x-ln x-ray') for x in (30, 90, 150, 200)))
        for i, x in enumerate((36, 78, 122, 166, 206)):
            top = 14 + (i * 13) % 26
            wave = f'M{x} 128 ' + ' '.join(f'Q{x + (8 if k % 2 else -8)} {128 - (k + 0.5) * (128 - top) / 6:.0f} {x} {128 - (k + 1) * (128 - top) / 6:.0f}' for k in range(6))
            parts.append(ln(wave))
            for k in range(1, 6):
                y = 128 - k * (128 - top) / 6
                side = 1 if k % 2 else -1
                parts.append(f'<ellipse cx="{x + side * 7}" cy="{y:.0f}" rx="7" ry="2.6" transform="rotate({side * -30} {x + side * 7} {y:.0f})" fill="{H}" class="x-edge"/>')
        parts.append(sil('M0 140 L0 128 Q30 120 60 126 T120 124 T180 127 T240 122 L240 140 Z', H2))
    elif kind == 'cave':
        parts.append(sil('M0 0 L240 0 L240 128 L0 128 Z M40 128 L44 70 Q60 22 120 18 Q180 22 196 70 L200 128 Z', H, 'evenodd'))
        parts.append('<path d="M40 128 L44 70 Q60 22 120 18 Q180 22 196 70 L200 128" class="x-edge" fill="none"/>')
        parts.append('<path d="M112 0 L130 0 L156 128 L92 128 Z" class="x-light"/>')
        parts.append(''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{H2}" class="x-edge"/>' for x, y, r in [(100, 118, 7), (114, 114, 9), (130, 117, 7), (144, 119, 6)]))
        parts.append(ln('M170 128 L170 120 M170 122 L167 126 M170 122 L173 126 M170 120 m0 -2.2 a1.6 1.6 0 1 0 0.01 0', 'x-ln x-fine'))
    elif kind == 'trench':
        parts.append(ln('M0 14 Q20 11 40 14 T80 14 T120 14 T160 14 T200 14 T240 14', 'x-ln x-water'))
        parts.append(sil('M0 140 L0 60 L70 64 L96 72 L112 118 L118 132 L126 120 L140 74 L170 66 L240 62 L240 140 Z'))
        parts.append('<path d="M0 60 L70 64 L96 72 L112 118 L118 132 L126 120 L140 74 L170 66 L240 62" class="x-edge" fill="none"/>')
        parts.append(ln('M108 128 L118 96 L128 128', 'x-ln x-dash'))
        parts.append('<ellipse cx="118" cy="104" rx="5" ry="2.5" class="x-edge" fill="none"/>')
    elif kind == 'ice':
        parts.append(''.join(f'<circle cx="{x}" cy="{y}" r="0.9" class="x-star"/>' for x, y in [(30, 18), (64, 34), (98, 12), (150, 26), (182, 10), (210, 36), (226, 16), (128, 40)]))
        parts.append(sil('M0 128 L0 68 Q120 58 240 68 L240 128 Z'))
        parts.append('<path d="M0 68 Q120 58 240 68" class="x-edge" fill="none"/>')
        parts.append(''.join(ln(f'M0 {y} Q120 {y - 6} 240 {y}', 'x-ln x-fine') for y in (84, 98, 112)))
        parts.append('<rect x="130" y="50" width="16" height="9" class="x-edge" fill="none"/>')
        parts.append(ln('M150 59 L150 38 M150 40 L158 44 L150 48', 'x-ln x-fine'))
        parts.append('<rect x="24" y="26" width="6" height="30" rx="3" class="x-edge" fill="none"/><circle cx="27" cy="60" r="5" class="x-edge" fill="none"/>')
        parts.append(ln('M27 34 L27 56', 'x-ln'))
    return f'<svg class="x-art" viewBox="0 0 240 140" aria-hidden="true" focusable="false">{"".join(parts)}</svg>'


def extremes_list():
    """Earth's Extremes on Outdoors: a card each, an engraving, a figure and a line or two."""
    data = load_json('outdoors/page/extremes.json')
    defs = ('<svg width="0" height="0" class="x-defs" aria-hidden="true" focusable="false"><defs>'
            '<pattern id="x-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="4" class="x-hatch-line"/></pattern>'
            '<pattern id="x-hatch-dense" width="2.5" height="2.5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="2.5" class="x-hatch-line"/></pattern>'
            '</defs></svg>')
    cards = []
    for e in data['extremes']:
        cards.append(f'<li class="x-card" id="x-{e["id"]}">{extreme_art(e["art"], e["id"])}'
                     f'<p class="x-kind">{esc(e["kind"])} <span>{esc(e["where"])}</span></p>'
                     f'<h3>{esc(e["name"])}</h3>'
                     f'<p class="x-stat">{esc(e["stat"])} <span>{esc(e["sub"])}</span></p>'
                     f'<p class="x-text">{esc(e["text"])}</p></li>')
    sources = ' · '.join(f'<a href="{esc(e["source"])}" target="_blank" rel="noreferrer">{esc(e["name"])}</a>' for e in data['extremes'])
    return f'{defs}<ol class="x-cards" role="list">{"".join(cards)}</ol><p class="o-note">Sources: {sources}.</p>'


SPORTS = {'ski': 'Nordic ski', 'run': 'Running', 'tri': 'Triathlon', 'endurance': 'Endurance'}


def races_list():
    data = load_json('athletics/page/races.json')
    rows = []
    for r in data['races']:
        climb = f' · {esc(r["climb"])}' if r.get('climb') else ''
        time = f'<strong>{esc(r["time"])}</strong>'
        if r.get('official'):
            time = f'<strong>{esc(r["official"])}</strong><small>official · {esc(r["time"])} on my watch</small>'
        legs = ''
        if r.get('legs'):
            legs = '<small>' + ' · '.join(f'{esc(l["leg"])} {esc(l["time"])}' for l in r['legs']) + '</small>'
        rows.append(f'<li class="r-race" data-sport="{r["sport"]}" data-year="{r["date"][:4]}"><time datetime="{r["date"]}">{fmt_date(r["date"])}</time>'
                    f'<div class="r-race-what"><p class="r-race-title">{esc(r["title"])}</p><p class="r-race-sub"><span class="r-pill">{esc(r["discipline"])}</span>'
                    f'{esc(r["series"]) if r["series"] != r["title"] else ""}</p></div><p class="r-race-dist">{esc(r["distance"])}{climb}</p>'
                    f'<p class="r-race-time">{time}{legs}</p></li>')
    sports = ''.join(f'<span data-sport-label="{k}">{esc(v)}</span>' for k, v in SPORTS.items())
    return f'<ol class="r-race-list" role="list" data-races data-count="{len(rows)}">{"".join(rows)}</ol><p class="r-race-sports" hidden>{sports}</p>'


def gallery_item(ident):
    """A photograph from the album: its smallest web size, its srcset, and the caption and alt text the
    Photography page already gives it."""
    man = load_json('image portfolio/page/img/manifest.json')[ident]
    widths = man['widths']
    nw, nh = man['native']
    src = f'/image%20portfolio/page/img/{ident}-{widths[0]}.webp'
    srcset = ', '.join(f'/image%20portfolio/page/img/{ident}-{w}.webp {w}w' for w in widths)
    content = read('image portfolio/page/content.html')
    m = re.search(rf'data-caption="([^"]*)" data-alt="([^"]*)"><img src="/image%20portfolio/page/img/{re.escape(ident)}-', content)
    cap, alt = (html.unescape(m.group(1)), html.unescape(m.group(2))) if m else ('', '')
    return src, srcset, nw, nh, cap, alt


# ---- homepage -----------------------------------------------------------------------------------

# The sentence: each phrase opens a destination; the fact under it changes with the phrase.
SENTENCE = 'I’m Alex Crystal, a {about}. I {racing}, have stood on {outdoors}, {photography}, {science}, and {chess}.'
PHRASES = {
    'about': ('generative AI engineer at MITRE', 'Language systems, knowledge graphs, and a map of 224 moments in AI'),
    'racing': ('race on skis and on foot', '2:28:49.04 at the American Birkebeiner, Feb 21, 2026'),
    'outdoors': ('all 48 of New Hampshire’s 4,000-footers', '48 of 48, finished Aug 1, 2026 on the Presidential Traverse'),
    'photography': ('photograph the places I go', '56 photographs from Patagonia, Japan, Vietnam and home'),
    'science': ('chase the strange corners of science', 'Seven Earth-sized worlds circle TRAPPIST-1, 40 light-years away'),
    'chess': ('play the Scotch', 'The Scotch, the Réti and the O’Kelly Sicilian'),
}
HOME_FACT = ('Lately', 'Finished all 48 of New Hampshire’s 4,000-footers on Aug 1, 2026')


ALGO_ROLES = (('world', 'Its world'), ('piece', 'Its live piece'), ('arrival', 'Arriving here'))


def band_algorithms(pkg):
    """The band's information button and panel: the algorithms behind its world, its live piece and
    the transition into it (science/page/algorithms.json), as a native popover (home.js stands in
    where popovers are not supported)."""
    data = load_json('science/page/algorithms.json')
    title = pkg.reg['title']
    groups = []
    for role, label in ALGO_ROLES:
        items = [a for a in data['algorithms'] if a['bands'].get(pkg.id) == role]
        if items:
            lis = ''.join(f'<li><b>{esc(a["name"])}</b> {esc(a["what"])}</li>' for a in items)
            groups.append(f'<h4>{label}</h4><ul role="list">{lis}</ul>')
    pid = f'algo-{pkg.id}'
    return (f'<button type="button" class="band-info" popovertarget="{pid}" aria-label="The algorithms behind {esc(title)}" data-band-info>'
            f'<span aria-hidden="true">i</span></button>'
            f'<div class="band-algo" id="{pid}" popover aria-labelledby="{pid}-h"><p class="band-algo-k" id="{pid}-h">The algorithms behind {esc(title)}</p>'
            f'{"".join(groups)}<p class="band-algo-more"><a href="/science/#algorithms">Every algorithm on the site <span aria-hidden="true">→</span></a></p></div>')


def algorithms_list():
    """Science's catalogue of every algorithm the site runs, by field."""
    data = load_json('science/page/algorithms.json')
    out = []
    for field in data['fields']:
        items = [a for a in data['algorithms'] if a['field'] == field]
        lis = ''.join(f'<li id="algo-{a["id"]}"><h4>{esc(a["name"])}</h4><p>{esc(a["what"])}</p><p class="sx-algo-where">{esc(a["where"])}</p></li>' for a in items)
        out.append(f'<div class="sx-algo-field"><h3>{esc(field)} <span>{len(items)}</span></h3><ul class="sx-algo-list" role="list">{lis}</ul></div>')
    return f'<div class="sx-algos">{"".join(out)}</div>'


def band(pkg, body, cls=''):
    reg = pkg.reg
    return f'''<section class="band band--{pkg.id}{cls}" id="band-{pkg.id}" data-band="{pkg.id}" data-style="{pkg.style}" aria-labelledby="band-{pkg.id}-title">
  <div class="art art--{pkg.style} band-art" aria-hidden="true">{ART[pkg.style]() if pkg.style in ART else ''}</div>
  {band_algorithms(pkg)}
  <div class="wrap band-inner">
    <header class="band-head">
      <p class="band-n">{reg['number']}</p>
      <h2 class="band-title" id="band-{pkg.id}-title"><a href="{reg['url']}" data-expand>{esc(reg['title'])}</a></h2>
      <p class="band-line">{esc(pkg.meta['line'])}</p>
      <p class="band-cta" aria-hidden="true"><a href="{reg['url']}" data-expand tabindex="-1">Open {esc(reg['title'])} <span>→</span></a></p>
    </header>
{body}
  </div>
</section>'''


def band_about(pkg):
    p = pkg.meta['preview']
    threads = ''.join(f'<li>{esc(t)}</li>' for t in p['threads'])
    return f'''    <div class="band-body ab-band">
      <p class="ab-band-role">{esc(p['role'])}.</p>
      <ul class="ab-band-threads" role="list">{threads}</ul>
      <ol class="ab-band-built" role="list">
        <li><a class="ab-band-row" href="/about/#ai-power-map" data-preview="/coding%20projects/page/images/pv-aimap-top.webp"><span class="ab-band-k">AI Power Map</span><span class="ab-band-v">A sourced history of AI: 224 moments, 312 citations</span></a>
{powermap_strip()}</li>
        <li><a class="ab-band-row" href="/about/#birkie-race-intelligence"><span class="ab-band-k">Birkie Race Intelligence</span><span class="ab-band-v">Every Birkebeiner finisher, explorable</span></a></li>
        <li><a class="ab-band-row" href="/about/#mbonita"><span class="ab-band-k">mBONITA</span><span class="ab-band-v">Network models of multiomics data · J. Proteome Res. 2023</span></a></li>
      </ol>
    </div>'''


def band_science(pkg):
    chapters = ''.join(f'<li><a href="{pkg.reg["url"]}{h}">{esc(t)}</a></li>' for t, h in pkg.meta['preview']['chapters'])
    return f'''    <div class="band-body sx-band">
      <figure class="sx-band-sim" data-sim="trappist" data-sim-compact><div class="sx-still sx-still--orbits" aria-hidden="true"></div><figcaption><b>TRAPPIST-1</b> Seven Earth-sized worlds, 40 light-years away, drawn at their real periods. The trace is the star dimming as each one crosses it.</figcaption></figure>
      <ol class="sx-band-chapters" role="list">{chapters}</ol>
    </div>'''


def band_racing(pkg):
    p = pkg.meta['preview']
    stats = ''.join(f'<li><b>{esc(a)}</b><span>{esc(b)}</span></li>' for a, b in p['stats'])
    return f'''    <div class="band-body r-band">
      <figure class="r-band-race" data-race-pace>
        <p class="r-band-cap">{esc(p['caption'])}</p>
        <p class="r-band-clock"><span data-pace-clock>{esc(p['time'])}</span><small>{esc(p['timeSuffix'])}</small></p>
        <div class="r-band-route">{route_svg(p['route'], 'r-band-svg')}<span class="r-band-km" data-pace-km>Cable → Hayward · 50 km</span></div>
        <figcaption class="sr-only">The 2026 Birkebeiner route, Cable to Hayward, with my official time of 2:28:49.04.</figcaption>
      </figure>
      <ul class="r-band-stats" role="list">{stats}<li><b>National champion</b><span>club running, from my résumé</span></li></ul>
    </div>'''


def band_outdoors(pkg):
    p = pkg.meta['preview']
    done, total = p['ultra']
    return f'''    <div class="band-body o-band">
      <figure class="o-band-sky" data-skyline data-skyline-band>{skyline_svg()}
        <figcaption class="o-skyline-read" aria-hidden="true"><span class="o-sk-n" data-sk-n>48</span><span class="o-sk-of">of 48</span><span class="o-sk-peak" data-sk-peak>Jackson · 4,052 ft</span><span class="o-sk-date" data-sk-date>Aug 1, 2026 · Presidential Traverse</span></figcaption>
      </figure>
      <p class="o-band-ultra"><b>{done} of {total}</b> Northeast Ultra 8 traverses. Next: {esc(p['next'][0])}.</p>
    </div>'''


def band_photography(pkg):
    prints = []
    for i, ident in enumerate(pkg.meta['preview']['reel']):
        src, srcset, w, h, cap, alt = gallery_item(ident)
        prints.append(f'<li class="dr-print" style="--ar:{w / h:.4f}"><figure><img src="{src}" srcset="{srcset}" sizes="(min-width: 900px) 34vw, 70vw" '
                      f'width="{w}" height="{h}" alt="{esc(alt)}" loading="lazy" decoding="async"><figcaption><span class="dr-frame">▸ {i + 1:02d}</span> {esc(cap)}</figcaption></figure></li>')
    return f'''    <div class="band-body dr-band">
      <ol class="dr-reel" role="list" data-reel tabindex="0" aria-label="Twelve photographs; scroll sideways">{"".join(prints)}</ol>
    </div>'''


def band_chess(pkg):
    p = pkg.meta['preview']
    modes = ''.join(f'<div><dt>{m.title()}</dt><dd data-rating="{m}">—</dd></div>' for m in ('rapid', 'blitz', 'bullet'))
    plies = ' '.join(f'{a}{b}' for a, b in p['plies'])
    return f'''    <div class="band-body ch-band">
      <div class="pv pv--chess" data-pv="chess" data-plies="{plies}">
        <p class="pv-cap"><span>{esc(p['caption'])}</span><span class="pv-moves" data-moves>{esc(p['moves'])}</span></p>
        <div class="pv-board-wrap">{board_svg(p['fen'], p.get('last', ()))}</div>
      </div>
      <dl class="pv-ratings ch-band-ratings" data-ratings aria-label="My Chess.com ratings, live">{modes}</dl>
    </div>'''


BANDS = {'about': band_about, 'science': band_science, 'racing': band_racing, 'outdoors': band_outdoors,
         'photography': band_photography, 'chess': band_chess}


def home_page(packages):
    links = {}
    for d in DESTS:
        text, fact = PHRASES[d['id']]
        links[d['id']] = (f'<a class="ph" href="{d["url"]}" data-world="{d["id"]}" data-to="{d["style"]}" data-fact="{esc(fact)}" '
                          f'data-fact-k="{esc(d["title"])}" data-expand>{esc(text)}</a>')
    sentence = SENTENCE.format(**links)
    bands = sims_ready('\n'.join(band(packages[d['id']], BANDS[d['id']](packages[d['id']])) for d in DESTS))
    main_html = f'''<section class="hero" aria-labelledby="home-title" data-home-hero>
  <div class="wrap hero-inner">
    <h1 class="hero-sentence" id="home-title">{sentence}</h1>
    <p class="hero-fact" data-fact aria-live="polite"><span class="hero-fact-k" data-fact-k>{esc(HOME_FACT[0])}</span> <span data-fact-t>{esc(HOME_FACT[1])}</span></p>
  </div>
  <div class="crystal" data-crystal aria-hidden="true">{crystal_svg()}</div>
  <p class="hero-cue" aria-hidden="true"><span>Scroll</span><i></i></p>
</section>
<!-- Old homepage fragments land on the bands. -->
<span class="frag-alias" id="destinations" aria-hidden="true"></span>
<span class="frag-alias" id="tiles" aria-hidden="true"></span>
<!-- The chess pieces for the Chess band, inline so the board never refetches them. -->
{read('chess/page/pieces.svg').strip().replace('<svg ', '<svg aria-hidden="true" ', 1)}
<div class="bands" data-bands>
{bands}
</div>'''
    return page(title='Alex Crystal', description=HOME_DESCRIPTION, canonical='/', style='house', styles=[],
                current='home', page_id='home', main_attrs='', main_html=main_html,
                preload=('unbounded-latin.woff2',))


# ---- destination pages --------------------------------------------------------------------------

def with_aliases(content, fragments):
    """Old fragment ids land on their replacements, with or without JavaScript: an empty element
    with the old id goes right before the element carrying the new one."""
    for old, new in fragments.items():
        o, n = old.lstrip('#'), new.lstrip('#')
        if re.search(rf'\bid="{re.escape(o)}"', content):
            continue
        m = re.search(rf'<[a-zA-Z][^<>]*\bid="{re.escape(n)}"', content)
        if m:
            content = content[:m.start()] + f'<span class="frag-alias" id="{esc(o)}" aria-hidden="true"></span>' + content[m.start():]
    return content


def sims_ready(content):
    """A Science experiment is wired up (data-src) only when its module exists, so the page never
    requests a file that is not there; until then the figure keeps its still."""
    def wire(m):
        path = f'science/page/sims/{m.group(1)}.js'
        if os.path.exists(os.path.join(ROOT, path)):
            return f'data-sim="{m.group(1)}" data-src="{url_of(path)}"'
        return m.group(0)
    return re.sub(r'data-sim="([a-z-]+)"', wire, content)


def generated(content, pkg):
    """Fills the markers in a page's content: the Birkie route (Racing), every race, the 48 skyline
    and its hikes and Earth's Extremes (Outdoors), the Power Map strip and the path (About), and the experiments that
    exist (Science and the homepage)."""
    fills = {
        '<!--gen:route-->': lambda: route_svg(pkg.meta['preview']['route'], 'r-route-svg'),
        '<!--gen:races-->': races_list,
        '<!--gen:skyline-->': skyline_svg,
        '<!--gen:hikes-->': hikes_list,
        '<!--gen:extremes-->': extremes_list,
        '<!--gen:algorithms-->': algorithms_list,
        '<!--gen:powermap-->': powermap_strip,
        '<!--gen:timeline-->': lambda: f'''<section class="ab-section ab-timeline" id="timeline" aria-labelledby="timeline-title">
  <div class="wrap ab-grid">
    <p class="label ab-kick">Path</p>
    <h2 class="ab-h2" id="timeline-title">How I got here</h2>
{read(os.path.join(pkg.pdir, 'timeline.html'))}
  </div>
</section>''',
    }
    for mark, fill in fills.items():
        if mark in content:
            content = content.replace(mark, fill())
    return sims_ready(content)


def art_of(style):
    return ART[style]() if style in ART else ''


def hero(pkg):
    reg = pkg.reg
    index = ''.join(f'<li><a href="{esc(h)}">{esc(t)}</a></li>' for h, t in pkg.meta['index'])
    crystal = f'<div class="d-hero-crystal" aria-hidden="true">{crystal_svg()}</div>' if pkg.style == 'house' else ''
    if pkg.meta.get('heroPrint'):
        src, srcset, w, h, cap, alt = gallery_item(pkg.meta['heroPrint'])
        crystal = (f'<figure class="d-hero-print"><img src="{src}" srcset="{srcset}" sizes="(min-width: 900px) 46vw, 90vw" width="{w}" height="{h}" '
                   f'alt="{esc(alt)}" decoding="async" fetchpriority="high"><figcaption>{esc(cap)}</figcaption></figure>')
    return f'''<header class="d-hero" data-hero>
  <div class="art art--{pkg.style} d-hero-art" aria-hidden="true">{art_of(pkg.style)}</div>
  {crystal}<div class="wrap d-hero-inner">
    <p class="d-kicker"><span class="d-n">{reg['number']}</span><span class="d-style">of {len(DESTS):02d}</span></p>
    <h1 class="d-title">{letters(reg['title'])}</h1>
    <p class="d-lede">{esc(pkg.meta['lede'])}</p>
    <nav class="d-index" aria-label="On this page"><ol role="list">{index}</ol></nav>
  </div>
</header>'''


def next_card(pkg, packages):
    nxt = packages[pkg.reg['next']]
    reg = nxt.reg
    return f'''<nav class="d-next" data-style="{nxt.style}" aria-label="Next page">
  <div class="art art--{nxt.style} d-next-art" aria-hidden="true">{art_of(nxt.style)}</div>
  <div class="wrap d-next-inner">
    <p class="label d-next-label">Next</p>
    <a class="d-next-card" href="{reg['url']}" data-expand>
      <span class="d-next-n">{reg['number']}</span>
      <span class="d-next-title">{esc(reg['title'])}</span>
      <span class="d-next-line">{esc(nxt.meta['line'])}</span>
      <span class="d-next-arrow" aria-hidden="true">→</span>
    </a>
  </div>
</nav>'''


PRELOAD = {'ink': 'shippori-mincho-800-latin.woff2', 'cosmos': 'unbounded-latin.woff2', 'folio': 'cormorant-latin.woff2'}


def destination_page(pkg, packages):
    content = generated(with_aliases(pkg.content, pkg.meta.get('fragments', {})), pkg)
    module = f' data-destination="{pkg.id}"' + (f' data-module="{esc(pkg.module)}"' if pkg.module else '')
    main_html = f'''{hero(pkg)}
<!-- content:start -->
<div class="d-content" id="content">
{content.strip()}
</div>
<!-- content:end -->
{next_card(pkg, packages)}'''
    preload = (PRELOAD[pkg.style],) if pkg.style in PRELOAD else ()
    return page(title=pkg.meta['docTitle'], description=pkg.meta['description'], canonical=pkg.reg['url'],
                style=pkg.style, styles=pkg.styles, current=pkg.id, page_id=pkg.id, main_attrs=module,
                main_html=main_html, preload=preload)


def resume_page():
    body = read('resume/content.html')
    main_html = f'''<header class="d-hero d-hero--plain">
  <div class="wrap d-hero-inner">
    <p class="d-kicker"><span class="d-n">CV</span><span class="d-style">Generative AI · Engineering · Education</span></p>
    <h1 class="d-title">Résumé</h1>
    <p class="d-lede">Generative AI engineer at MITRE. Language systems, data tools and applied AI.</p>
  </div>
</header>
<div class="d-content resume" id="content">
{body.strip()}
</div>'''
    return page(title='Résumé — Alex Crystal, Generative AI Engineer',
                description='Alex Crystal — generative AI engineer working across language systems, knowledge graphs, forecasting, and applied machine learning.',
                canonical=RESUME, style='house', styles=['resume/resume.css'], current='resume', page_id='resume',
                main_attrs=' data-module="/resume/resume.js"', main_html=main_html)


def redirect(to, title):
    """A page that moved: it forwards at once, keeping the query, and the fragment when there is one
    (otherwise the target's own)."""
    path, _, frag = to.partition('#')
    keep = f"(location.hash || '{'#' + frag if frag else ''}')"
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{esc(title)} — Alex Crystal</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{SITE}{path}">
<meta http-equiv="refresh" content="0; url={esc(to)}">
<script>location.replace('{path}' + location.search + {keep})</script>
</head>
<body><p>This page is now <a href="{esc(to)}">{esc(title)}</a>.</p></body>
</html>
'''


# ---- output -------------------------------------------------------------------------------------

def write(rel, text, check, changed):
    path = os.path.join(ROOT, rel)
    try:
        with open(path, encoding='utf-8') as f:
            if f.read() == text:
                print('unchanged', rel)
                return
    except FileNotFoundError:
        pass
    changed.append(rel)
    if check:
        print('stale    ', rel)
        return
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    tmp = f'{path}.{os.getpid()}.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)
    print('built    ', rel)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Build the site pages (see the module docstring).')
    ap.add_argument('--only', help='comma list of: ' + ', '.join(IDS + ['home', 'resume']))
    ap.add_argument('--check', action='store_true', help='build in memory; exit 1 when a page would change')
    args = ap.parse_args(argv)
    only = [s.strip() for s in args.only.split(',')] if args.only else IDS + ['home', 'resume']
    unknown = [s for s in only if s not in IDS + ['home', 'resume']]
    if unknown:
        raise SystemExit(f'unknown page(s): {", ".join(unknown)}')
    try:
        packages = {d['id']: Package(d) for d in DESTS}
    except BuildError as e:
        print(f'FAIL      {e}')
        return 1
    changed = []
    targets = [i for i in IDS if i in only]
    if targets and 'home' not in only:
        only.append('home')
    try:
        for ident in targets:
            write(file_of(BY_ID[ident]['url']), destination_page(packages[ident], packages), args.check, changed)
        if 'home' in only:
            write('index.html', home_page(packages), args.check, changed)
        if 'resume' in only:
            write('resume/resume.html', resume_page(), args.check, changed)
            for r in REG.get('redirects', []):
                write(file_of(r['from']), redirect(r['to'], r['title']), args.check, changed)
    except BuildError as e:
        print(f'FAIL      {e}')
        return 1
    if args.check and changed:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
