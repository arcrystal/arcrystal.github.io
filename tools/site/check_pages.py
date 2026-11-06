"""Structural checks of the generated pages.

  python3 tools/site/check_pages.py            # exit 1 when a page has a problem

Every page: <html lang>, a title, a meta description and a canonical link; exactly one <h1>; body
and <main> name a style that exists; every local src, href, srcset candidate and import-map target
resolves to a file in the repository; every in-page fragment link names an id on the page; and no
page references video, the old media CDN or the removed render folders (the site has no renders).
"""
import json
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REG = json.load(open(os.path.join(ROOT, 'static/site/destinations.json'), encoding='utf-8'))
STYLES = json.load(open(os.path.join(ROOT, 'static/site/styles.json'), encoding='utf-8'))['styles']
PAGES = ['index.html', 'resume/resume.html'] + [
    unquote(urlsplit(d['url']).path).lstrip('/') + ('index.html' if d['url'].endswith('/') else '') for d in REG['destinations']]
FORBIDDEN = re.compile(r'<video\b|/media/|\.mp4\b|\.webm\b|static/film|static/worlds|static/world/|static/cinema|/cinema/|posters/', re.I)
STANDALONE = ('/ai-timeline/', '/coding projects/BirkieAnalysis/', '/coding projects/bubbletrouble/')


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.refs, self.h1, self.meta, self.links = set(), [], 0, {}, {}
        self.html_lang = self.title = None
        self.styles = []
        self._in_title = False
        self._importmap = False
        self.importmap = ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        if tag == 'html':
            self.html_lang = a.get('lang')
        if tag == 'title':
            self._in_title = True
        if tag == 'h1':
            self.h1 += 1
        if tag == 'meta' and a.get('name'):
            self.meta[a['name']] = a.get('content', '')
        if tag == 'link' and a.get('rel'):
            self.links.setdefault(a['rel'], []).append(a.get('href', ''))
        if tag in ('body', 'main') and 'data-style' in a:
            self.styles.append((tag, a['data-style']))
        if tag == 'script' and a.get('type') == 'importmap':
            self._importmap = True
        for key in ('src', 'href'):
            if a.get(key):
                self.refs.append((tag, a[key]))
        if a.get('srcset'):
            for part in a['srcset'].split(','):
                if part.strip():
                    self.refs.append((tag, part.strip().split()[0]))

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False
        if tag == 'script':
            self._importmap = False

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or '') + data
        if self._importmap:
            self.importmap += data


def local_file(url):
    """Repository path of a site URL, or None for other origins, mailto and data URLs."""
    if re.match(r'^[a-z][a-z0-9+.-]*:', url, re.I) or url.startswith('//'):
        return None
    path = unquote(urlsplit(url).path)
    if not path:
        return None
    if not path.startswith('/'):
        return 'relative'
    rel = path.lstrip('/')
    return rel + 'index.html' if rel == '' or rel.endswith('/') else rel


def check(rel):
    problems = []
    text = open(os.path.join(ROOT, rel), encoding='utf-8').read()
    p = Page()
    p.feed(text)
    if not p.html_lang:
        problems.append('no <html lang>')
    if not (p.title or '').strip():
        problems.append('no <title>')
    if not p.meta.get('description'):
        problems.append('no meta description')
    if not p.links.get('canonical'):
        problems.append('no canonical link')
    if p.h1 != 1:
        problems.append(f'{p.h1} <h1> elements')
    if [t for t, _ in p.styles] != ['body', 'main'] or any(s not in STYLES for _, s in p.styles):
        problems.append(f'body/main style: {p.styles}')
    m = FORBIDDEN.search(text)
    if m:
        problems.append(f'references removed media: …{text[max(0, m.start() - 40):m.end() + 20]}…')
    targets = [r for _, r in p.refs]
    try:
        targets += list(json.loads(p.importmap or '{}').get('imports', {}).values())
    except ValueError:
        problems.append('malformed import map')
    for url in targets:
        if url.startswith('#'):
            if len(url) > 1 and unquote(url[1:]) not in p.ids:
                problems.append(f'fragment {url} names no element')
            continue
        f = local_file(url)
        if f is None:
            continue
        if f == 'relative':
            problems.append(f'relative URL {url}')
            continue
        if any(('/' + f).startswith(s) for s in STANDALONE):
            if not os.path.exists(os.path.join(ROOT, f)):
                problems.append(f'missing {url}')
            continue
        if not os.path.exists(os.path.join(ROOT, f)):
            problems.append(f'missing {url}')
    return problems


def main():
    failed = 0
    for rel in PAGES:
        problems = check(rel)
        status = 'ok  ' if not problems else 'FAIL'
        print(f'{status} {rel}')
        for msg in sorted(set(problems)):
            print(f'       {msg}')
        failed += bool(problems)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
