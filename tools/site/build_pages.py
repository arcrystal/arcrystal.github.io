"""Builds every page of the site from one template.

  python3 tools/site/build_pages.py                  # every page
  python3 tools/site/build_pages.py --only chess     # one destination page, then the homepage
  python3 tools/site/build_pages.py --only home      # the homepage only
  python3 tools/site/build_pages.py --check          # build in memory; exit 1 when a file would change

Sources:
- static/site/destinations.json: order, titles, URLs, styles, numbers and next links.
- static/site/styles.json: the six styles (names, page colours, the homepage panel materials).
- Each destination's package, <dir>/page/: meta.json (copy, on-page index, module, stylesheets,
  old fragment ids, homepage preview data) and content.html (the page body: no <html>, <head>,
  <body>, <main>, <h1> or <script>). About adds timeline.html.
- resume/content.html: the résumé body.

Every page: head (title, description, canonical, social preview, stylesheets with content hashes,
an import map that versions every module), the header, <main>, the contact section and footer.
The homepage is a hero and a pinned stage of five tiles, one per style, whose shared panel the
shell morphs from style to style (static/site/tiles.js). A destination page is a hero in its
style, its content and a card for the next destination. Without JavaScript every page is complete:
the stage becomes five stacked sections. Files are written atomically and only when they change.
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
HOME_LEDE = ('Generative AI engineer at MITRE, working on language systems, data tools and applied AI. '
             'Away from the desk: Nordic skiing and running, chess, and mountains.')
HOME_DESCRIPTION = 'Alex Crystal — generative AI engineer, endurance athlete, chess player, and hiker.'

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
    """Runs before first paint: html.js and the motion choice (html.motion-paused). If the shell
    never reports html.app-ready, html.js is dropped after 6 s so JavaScript-only states cannot
    hide content."""
    return ("(function(){var d=document.documentElement;d.classList.add('js');try{"
            "var m=localStorage.getItem('ac-motion'),r=matchMedia('(prefers-reduced-motion: reduce)').matches;"
            "if(m==='paused'||(m!=='playing'&&r))d.classList.add('motion-paused');"
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

NAV = [(d['id'], d['title'], d['url']) for d in DESTS] + [('resume', 'Résumé', RESUME), ('contact', 'Contact', '#contact')]


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


def neon_art():
    return '<i class="art-sun"></i><i class="art-floor"></i><i class="art-scan"></i>'


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


def chrome_art():
    """Pearl and iridescence, liquid-metal blobs and a few sparkles."""
    blobs = ''.join(f'<i class="art-blob art-blob--{i}"></i>' for i in range(1, 4))
    sparks = ''.join(f'<i class="art-spark art-spark--{i}"></i>' for i in range(1, 7))
    return f'<i class="art-iris"></i>{blobs}{sparks}'


ART = {'ink': ink_art, 'glass': glass_art, 'neon': neon_art, 'folio': folio_art, 'chrome': chrome_art}

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


# The facets' colours in the crystal's stand-in, in tile order (Ink, Glacier, Signal, Folio, Chrome).
FACETS = [('#F3EEE3', '#8E877C'), ('#F4F9FC', '#7DBBF0'), ('#07060E', '#22E6FF'), ('#0F1913', '#CDA562'), ('#FFFFFF', '#8E91A6')]


def crystal_svg():
    """The homepage crystal as a still: until the scene draws it, and wherever WebGL is missing."""
    def pt(k, r):
        a = math.radians(72 * k)
        return f'{f1(100 + r * math.sin(a))},{f1(100 - r * math.cos(a))}'
    grads, faces = [], []
    for k, (c0, c1) in enumerate(FACETS):
        g = f'cf{k}'
        grads.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></linearGradient>')
        faces.append(f'<polygon points="{pt(k, 42)} {pt(k, 100)} {pt(k + 1, 100)} {pt(k + 1, 42)}" fill="url(#{g})"/>')
    table = ' '.join(pt(k, 42) for k in range(5))
    outline = ' '.join(pt(k, 100) for k in range(5))
    return (f'<svg class="crystal-still" viewBox="0 0 200 200" aria-hidden="true"><defs>{"".join(grads)}</defs>{"".join(faces)}'
            f'<polygon points="{table}" fill="#FBFAF8"/><g fill="none" stroke="#fff" stroke-width="0.8"><polygon points="{outline}"/>'
            f'<polygon points="{table}"/>{"".join(f'<line x1="{pt(k, 42).split(",")[0]}" y1="{pt(k, 42).split(",")[1]}" x2="{pt(k, 100).split(",")[0]}" y2="{pt(k, 100).split(",")[1]}"/>' for k in range(5))}</g></svg>')


# ---- previews (homepage panel content, real content only) ------------------------------------------

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


def preview_chess(pkg):
    p = pkg.meta['preview']
    modes = ''.join(f'<div><dt>{m.title()}</dt><dd data-rating="{m}">—</dd></div>' for m in ('rapid', 'blitz', 'bullet'))
    plies = ' '.join(f'{a}{b}' for a, b in p['plies'])
    return f'''<div class="pv pv--chess" data-pv="chess" data-plies="{plies}">
  <p class="pv-cap"><span>{esc(p['caption'])}</span><span class="pv-moves" data-moves>{esc(p['moves'])}</span></p>
  <div class="pv-board-wrap">{board_svg(p['fen'], p.get('last', ()))}</div>
  <dl class="pv-ratings" data-ratings aria-label="Chess.com ratings">{modes}</dl>
</div>'''


def route_svg(rel, cls):
    data = load_json(rel)
    w, h = data['viewBox']
    pts = ' '.join(f'{x},{y}' for x, y in data['points'])
    (sx, sy), (ex, ey) = data['points'][0], data['points'][-1]
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" aria-hidden="true"><polyline class="rt-glow" points="{pts}"/>'
            f'<polyline class="rt-line" points="{pts}" pathLength="1"/><circle class="rt-start" cx="{sx}" cy="{sy}" r="4.5"/>'
            f'<circle class="rt-end" cx="{ex}" cy="{ey}" r="4.5"/></svg>')


def preview_racing(pkg):
    p = pkg.meta['preview']
    rows = ''.join(f'<li><span>{esc(a)}</span><b>{esc(b)}</b></li>' for a, b in p['rows'])
    return f'''<div class="pv pv--race" data-pv="racing">
  <p class="pv-cap">{esc(p['caption'])}</p>
  <p class="pv-time"><span class="pv-time-main" data-count="{esc(p['time'])}">{esc(p['time'])}</span><span class="pv-time-sub">{esc(p['timeSuffix'])}</span></p>
  <p class="pv-time-label">{esc(p['timeLabel'])}</p>
  <div class="pv-route">{route_svg(p['route'], 'pv-route-svg')}<span class="pv-route-label">Cable → Hayward · 50 km</span></div>
  <ul class="pv-rows" role="list">{rows}</ul>
</div>'''


def preview_coding(pkg):
    p = pkg.meta['preview']
    w, h = p['imageSize']
    rows = ''.join(f'<li><span class="pv-n">{esc(n)}</span><span class="pv-k">{esc(k)}</span><span class="pv-v">{esc(v)}</span></li>' for n, k, v in p['rows'])
    return f'''<div class="pv pv--code" data-pv="coding">
  <div class="pv-bar"><i></i><i></i><i></i><span>alex@crystal: ~/case-studies</span></div>
  <figure class="pv-shot"><img src="{pkg.asset(p['image'])}" width="{w}" height="{h}" alt="" loading="lazy" decoding="async"></figure>
  <p class="pv-prompt"><span class="pv-ps">$</span> <span data-type>{esc(p['prompt'])}</span><i class="pv-caret"></i></p>
  <ol class="pv-ls" role="list">{rows}</ol>
</div>'''


def preview_mountains(pkg):
    p = pkg.meta['preview']
    plates = ''.join(
        f'<figure class="pv-plate pv-plate--{i + 1}"><img src="{pkg.asset(src)}" width="{w}" height="{h}" alt="" loading="lazy" decoding="async">'
        f'<figcaption><b>{esc(num)}</b> {esc(cap)}</figcaption></figure>' for i, (src, w, h, num, cap) in enumerate(p['plates']))
    return f'''<div class="pv pv--folio" data-pv="mountains">
  <p class="pv-cap"><span>Plates I–III</span><span>Patagonia · Japan · Vietnam</span></p>
  <div class="pv-plates">{plates}</div>
  <p class="pv-foot">From the album of fifty-six photographs</p>
</div>'''


def preview_about(pkg):
    p = pkg.meta['preview']
    last = len(p['chips']) - 1
    rows = ''.join(
        f'<li class="pv-pill{" is-now" if i == last else ""}" style="--i:{i}"><b>{esc(y)}</b><span>{esc(a)}</span><small>{esc(b)}</small></li>'
        for i, (y, a, b) in enumerate(p['chips']))
    return f'''<div class="pv pv--about" data-pv="about">
  <p class="pv-top"><span class="pv-led" aria-hidden="true"></span><span>timeline</span><span class="pv-span">2019 → now</span></p>
  <ol class="pv-pills" role="list">{rows}</ol>
</div>'''


PREVIEW = {'chess': preview_chess, 'racing': preview_racing, 'coding': preview_coding, 'mountains': preview_mountains, 'about': preview_about}


# ---- homepage -----------------------------------------------------------------------------------

def tile(pkg, i):
    reg, st = pkg.reg, style_of(pkg.style)
    return f'''<article class="tile" id="t-{pkg.id}" data-tile="{i}" data-style="{pkg.style}" aria-labelledby="t-{pkg.id}-title">
  <div class="tile-text">
    <p class="tile-num"><span class="tile-n">{reg['number']}</span><span class="tile-style">{esc(st['name'])}</span></p>
    <h2 class="tile-title" id="t-{pkg.id}-title"><a class="tile-link" href="{reg['url']}" data-expand>{letters(reg['title'])}</a></h2>
    <p class="tile-line">{esc(pkg.meta['line'])}</p>
    <p class="tile-cta" aria-hidden="true"><span>Open</span><span class="tile-arrow">→</span></p>
  </div>
  <div class="tile-stage">
    <a class="tile-card" href="{reg['url']}" tabindex="-1" aria-hidden="true" data-expand>
{PREVIEW[pkg.id](pkg)}
    </a>
  </div>
</article>'''


def swatch(style):
    return f'<span class="sw" data-style="{style}" aria-hidden="true"><i></i></span>'


def home_page(packages):
    index = ''.join(
        f'<li><a href="#tile-{d["id"]}" data-jump="{i}">{swatch(d["style"])}<span class="hi-n">{d["number"]}</span>'
        f'<span class="hi-t">{esc(d["title"])}</span><span class="hi-s">{esc(style_of(d["style"])["name"])}</span></a></li>'
        for i, d in enumerate(DESTS))
    backdrops = '\n'.join(f'<div class="bd art art--{d["style"]}" data-bd="{d["style"]}">{ART[d["style"]]()}</div>' for d in DESTS)
    tiles = '\n'.join(tile(packages[d['id']], i) for i, d in enumerate(DESTS))
    rail = ''.join(f'<li><a href="#tile-{d["id"]}" data-jump="{i}"><span class="rail-n">{d["number"]}</span><span class="rail-t">{esc(d["title"])}</span></a></li>'
                   for i, d in enumerate(DESTS))
    main_html = f'''<section class="hero" aria-labelledby="home-title">
  <div class="wrap hero-inner">
    <p class="label hero-kicker">Portfolio · five rooms, five styles</p>
    <h1 class="hero-title" id="home-title">Alex Crystal</h1>
    <p class="hero-lede">{esc(HOME_LEDE)}</p>
    <ol class="hero-index" role="list" aria-label="The five pages">{index}</ol>
  </div>
  <div class="crystal" aria-hidden="true">{crystal_svg()}</div>
  <p class="hero-cue" aria-hidden="true"><span>Scroll</span><i></i></p>
</section>
<!-- Old homepage fragments land on the tiles. -->
<span class="frag-alias" id="destinations" aria-hidden="true"></span>
<!-- The chess pieces for the Chess preview, inline so the board never refetches them. -->
{read('chess/page/pieces.svg').strip().replace('<svg ', '<svg aria-hidden="true" ', 1)}
<section class="stage" id="tiles" aria-label="Pages" data-stage>
  <div class="stage-pin">
    <div class="backdrops" aria-hidden="true">
{backdrops}
    </div>
    <div class="tiles">
{tiles}
    </div>
    <nav class="rail" aria-label="Tiles"><ol role="list">{rail}</ol></nav>
    <p class="stage-count" aria-hidden="true"><span data-count-now>01</span> / 05</p>
  </div>
  <div class="stage-stops" aria-hidden="true">{''.join(f'<i id="tile-{d["id"]}" style="--k:{k}"></i>' for k, d in enumerate(DESTS))}</div>
</section>'''
    return page(title='Alex Crystal', description=HOME_DESCRIPTION, canonical='/', style='house', styles=[],
                current='home', page_id='home', main_attrs='', main_html=main_html,
                preload=('shippori-mincho-800-latin.woff2',))


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


def generated(content, pkg):
    """Fills <!--gen:route--> (Racing) with the traced route."""
    if '<!--gen:route-->' in content:
        content = content.replace('<!--gen:route-->', route_svg(pkg.meta['preview']['route'], 'r-route-svg'))
    return content


def hero(pkg):
    reg, st = pkg.reg, style_of(pkg.style)
    index = ''.join(f'<li><a href="{esc(h)}">{esc(t)}</a></li>' for h, t in pkg.meta['index'])
    return f'''<header class="d-hero" data-hero>
  <div class="art art--{pkg.style} d-hero-art" aria-hidden="true">{ART[pkg.style]()}</div>
  <div class="wrap d-hero-inner">
    <p class="d-kicker"><span class="d-n">{reg['number']}</span><span class="d-style">{esc(st['name'])}</span></p>
    <h1 class="d-title">{letters(reg['title'])}</h1>
    <p class="d-lede">{esc(pkg.meta['lede'])}</p>
    <nav class="d-index" aria-label="On this page"><ol role="list">{index}</ol></nav>
  </div>
</header>'''


def next_card(pkg, packages):
    nxt = packages[pkg.reg['next']]
    reg, st = nxt.reg, style_of(nxt.style)
    return f'''<nav class="d-next" data-style="{nxt.style}" aria-label="Next page">
  <div class="art art--{nxt.style} d-next-art" aria-hidden="true">{ART[nxt.style]()}</div>
  <div class="wrap d-next-inner">
    <p class="label d-next-label">Next</p>
    <a class="d-next-card" href="{reg['url']}" data-expand>
      <span class="d-next-n">{reg['number']} · {esc(st['name'])}</span>
      <span class="d-next-title">{esc(reg['title'])}</span>
      <span class="d-next-line">{esc(nxt.meta['line'])}</span>
      <span class="d-next-arrow" aria-hidden="true">→</span>
    </a>
  </div>
</nav>'''


PRELOAD = {'ink': 'shippori-mincho-800-latin.woff2', 'neon': 'unbounded-latin.woff2', 'folio': 'cormorant-latin.woff2',
           'chrome': 'krona-one-latin.woff2'}


def destination_page(pkg, packages):
    content = generated(with_aliases(pkg.content, pkg.meta.get('fragments', {})), pkg)
    if pkg.id == 'about':
        content = f'''<section class="ab-section ab-timeline" id="timeline" aria-labelledby="timeline-title">
  <div class="wrap ab-grid">
    <p class="label ab-kick">Timeline</p>
    <h2 class="ab-h2" id="timeline-title">Six milestones</h2>
{read(os.path.join(pkg.pdir, 'timeline.html'))}
  </div>
</section>
{content}'''
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


def work_redirect():
    """/work/ was the old name of About; old links (and their query and fragment) still land."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>About Me — Alex Crystal</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{SITE}/about/">
<meta http-equiv="refresh" content="0; url=/about/">
<script>location.replace('/about/' + location.search + location.hash)</script>
</head>
<body><p>This page is now <a href="/about/">About Me</a>.</p></body>
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
            write('work/index.html', work_redirect(), args.check, changed)
    except BuildError as e:
        print(f'FAIL      {e}')
        return 1
    if args.check and changed:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
