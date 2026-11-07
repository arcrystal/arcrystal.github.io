# Site tools

Python 3 and Node 22 or later. There are no packages to install. The browser tools drive the
Google Chrome already on the machine over the DevTools protocol.

| Tool | What it does |
| --- | --- |
| `build_pages.py` | writes every page from `static/site/*.json` and the destination packages: `python3 tools/site/build_pages.py [--only chess] [--check]` |
| `check_pages.py` | structural checks of the generated pages (one `h1`, metadata, every local link resolves, no video or render paths) |
| `contrast.mjs` | WCAG contrast of every text pair in `static/site/styles.json` |
| `perf.mjs` | wheels down the homepage past the last band and reports frame times, style recalculation and layout, on the GPU, with the CPU throttled 4× and on SwiftShader: `node tools/site/perf.mjs [--strict]` |
| `scene_check.mjs` | the WebGL scene headless: screenshots of the hero, the crystal filled with each world, each band, each seam with the meeting line at a quarter, half and three quarters of the screen, and each destination's hero: `node tools/site/scene_check.mjs --out DIR [--only NAME] [--preset nowebgl] [--reduced-motion] [--size 390x844]` |
| `tests/*.test.mjs` | unit tests: `node --test tools/site/tests/*.test.mjs` |
| `trace_route.py` | traces a Strava route screenshot into a vector polyline (`static/site/route-birkie.json`) |
| `serve.mjs` | static server close to GitHub Pages: `node tools/site/serve.mjs --port 8100` |
| `cdp.mjs`, `shoot.mjs` | headless Chrome library and screenshots of routes and sizes |
| `fixtures/` | Chess.com answers for the chess tests, and the original racing page the racing figures are checked against |

A destination's package is `<dir>/page/`:

- `meta.json`: the title, description, homepage line, hero copy, on-page index, module, stylesheets, old fragment ids and preview data
- `content.html`: the page body
- the page's own CSS and JS

The registry, `static/site/destinations.json`, gives the order, URLs and the style of each page.
`design/README.md` describes the six destinations and their styles, the sentence and the crystal, the seams, and how the homepage and the scene work.
