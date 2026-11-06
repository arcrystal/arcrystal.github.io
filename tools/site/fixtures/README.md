# Browser test fixtures

Two kinds of fixture live here:

- `chess/`: synthetic Chess.com API answers, served to a page by `page.intercept()` in
  `tools/site/cdp.mjs` (the DevTools Fetch domain). Nothing reaches the network.
- `faults/`: rules for `tools/site/serve.mjs --faults`, which delay, fail, drop or truncate the
  site's own files to exercise loading, slow and error states.

Nothing here is real data. The player is `example-player`; the opponents, ratings, dates, game
links and ids are invented; the games were composed for the tests.

## Chess.com fixtures (`chess/`)

The chess page requests `https://api.chess.com/pub/player/<user>` (profile), `…/stats`,
`…/games/archives` and the monthly archives `…/games/YYYY/MM`. In the test browser every host
other than 127.0.0.1 and localhost fails DNS resolution, so without fixtures those requests fail
as if offline. With fixtures, `intercept()` answers them before DNS.

```js
import { launch } from '../cdp.mjs';
import { useChessFixtures } from './chess/index.mjs';

const browser = await launch();
const page = await browser.newPage({ width: 1440, height: 900 });
const chess = await useChessFixtures(page, 'partial-failure'); // before goto()
await page.goto('http://127.0.0.1:PORT/chess/chess.html');
// ... assertions ...
console.log(chess.calls);   // [{ resource: 'profile', n: 1, status: 200 }, { resource: 'stats', n: 1, status: 500 }, ...]
await chess.remove();       // stop answering (later requests fail offline again)
await browser.close();
```

From the command line, `--chess SCENARIO` does the same for every page:

```sh
node tools/site/cdp.mjs http://127.0.0.1:PORT/chess/chess.html --chess empty --shot /tmp/chess-empty.png
node tools/site/shoot.mjs --routes /chess/chess.html --chess timeout --out /tmp/shots
node tools/site/perf.mjs --routes /chess/chess.html --chess success --out /tmp/perf
```

`node tools/site/fixtures/chess/index.mjs` lists the scenarios.

### How a request is answered

`chessHandler(scenario)` (used by `useChessFixtures`) maps the request path to a resource key:
`profile`, `stats`, `archives`, `games/YYYY/MM`, or `pgn/YYYY/MM` (the month as PGN text, built
from the month's JSON). It looks the key up in the scenario's `routes`, then `games/*`, then `*`.
A rule is one of:

| Rule | Answer |
| --- | --- |
| `{ "file": "stats.json" }` | the file's text, `application/json` |
| `{ "json": { … } }` | that value |
| `{ "text": "…", "contentType": "…" }` | that text |
| `{ "status": 500, "json": { … }, "headers": { … } }` | any of the above with a status and headers |
| `{ "fail": "Failed" }` | a network error; any Fetch `errorReason` (`TimedOut`, `ConnectionRefused`, `InternetDisconnected`, …) |
| `{ "hang": true }` | no answer at all; the page's own timeout or a navigation must end the request |
| `"delay": 2500` | in a rule or a scenario: wait before answering |

Scenario fields: `base` (inherit another scenario's routes), `delay` (added to every answer),
`first` (the rule for the first request to each resource; later requests use the routes), `all`
(one rule for every request), `routes`, and the prose `about` and `expect`.

Every fulfilled answer carries `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`,
like the real API, so cross-origin `fetch()` from the page accepts it.

**Player name.** The fixtures say `example-player`. By default the handler answers with the
player name taken from the request URL instead (`player: 'requested'`), so a page that keeps only
games played by its own account accepts the fixture games. The substitution happens in memory in
the browser under test; `calls`, notes and reports never contain the name, and `redact()` in
`cdp.mjs` replaces Chess.com player paths in every logged URL with `<user>`. Pass
`{ player: 'fixture' }` to serve the files unchanged.

### Scenarios (`chess/scenarios.json`)

| Scenario | What the API does | What the page should show |
| --- | --- | --- |
| `success` | everything answers; three months, seven games | live profile, stats and recent games; the Chess960 game is not counted as standard |
| `slow` | as success, 2.5 s per answer | each panel's loading state, then live data; navigating away cancels the requests |
| `empty` | `{"archives": []}` | the empty state for recent games |
| `empty-month` | one month listed, `{"games": []}` | the empty state, no error |
| `sparse-stats` | rapid only, no best rating, empty tactics and puzzle rush | placeholders, never 0, NaN or undefined |
| `partial-failure` | stats HTTP 500, August network failure, July 404, September fine | independent panels: profile live, stats error with retry over the saved snapshot, games from September or a partial notice |
| `malformed` | one month: one valid game, three malformed PGNs | the valid game; the others skipped or marked; no console exception |
| `retry` | first request to each resource HTTP 503, later ones succeed | error with retry; retry loads that panel |
| `timeout` | no answers | the page's own timeout fires; error or stale state with retry |
| `network-error` | every request fails (`net::ERR_FAILED`) | error or stale state with retry |
| `offline` | every request fails (`net::ERR_INTERNET_DISCONNECTED`) | as network-error |
| `server-error` | every request HTTP 503 | error or stale state with retry |
| `rate-limited` | every request HTTP 429 with `Retry-After: 60` | error or stale state, no retry loop |
| `not-found` | every request HTTP 404 | error states; the saved snapshot stays labelled as saved |

**Canceled requests.** Use `slow` or `timeout`, then click a navigation link while the requests
are pending: the router unmounts the chess page, which aborts its requests. `page.requests` then
show `canceled: true` (`net::ERR_ABORTED`), the late fixture answers are dropped (`page.notes`
records `Invalid InterceptionId`), and a test can assert that nothing from them reached the next
page. A full document navigation (`page.goto`) discards the old document's requests without a
cancellation event, so assert on the new page in that case.

### Games (`chess/catalog.json`)

`catalog.json` lists every game with its file, validity, ply count, final position and the
castling, en passant and promotion moves by ply, so a replay test can step to a move and compare
the board with `finalFen` or the expected piece placement.

| uuid ends | Month | Features |
| --- | --- | --- |
| `…0001` | 2026/09 | Scotch Game; kingside castling by both sides; check |
| `…0002` | 2026/09 | Sicilian (Richter-Rauzer); queenside castling by both sides; loss on time |
| `…0007` | 2026/09 | `rules: "chess960"` from a custom position (SetUp/FEN headers) |
| `…0003` | 2026/08 | French Advance; en passant by White (4. exf6); threefold repetition |
| `…0004` | 2026/08 | Réti; en passant by Black (3... dxc3); kingside castling by both sides |
| `…0005` | 2026/07 | Scandinavian; promotion to a queen with capture (5. bxa8=Q) |
| `…0006` | 2026/07 | daily game; underpromotion to a knight with capture and check (7... fxg1=N+); 11... O-O-O+ |
| `…0101` | 2026/06 | valid Italian Game inside the malformed month |
| `…0102` | 2026/06 | malformed: illegal move 2. Ke3 |
| `…0103` | 2026/06 | malformed: unterminated tag pair, movetext cut off mid-move |
| `…0104` | 2026/06 | malformed: unknown move token 4. Zz9 |

PGNs follow Chess.com's layout: the tag pairs Chess.com sends (`ECOUrl`, `CurrentPosition`,
`Termination`, `Link`, …), clock comments `{[%clk 0:09:55.2]}` in live games, `N...` before
Black's move after a comment.

### Regenerating and checking

`chess/build.mjs` holds the games as SAN move lists and writes every JSON file except
`scenarios.json` (hand-written). It replays each game with the vendored chess.js
(`static/vendor/chess/chess.js`).

```sh
node tools/site/fixtures/chess/build.mjs --check   # files match build.mjs; valid PGNs replay to their final position; malformed ones are rejected
node tools/site/fixtures/chess/build.mjs           # rewrite the files after editing build.mjs
```

## Server faults (`faults/`)

`serve.mjs --faults FILE` reads a JSON array of rules and re-reads the file whenever it changes,
so a test can switch faults while the server runs. Each request uses the first matching rule:

| Field | Meaning |
| --- | --- |
| `match` | regular expression tested against the raw request URL and the decoded path plus query (`/image portfolio/…`) |
| `method` | only for this method (`GET`, `HEAD`) |
| `delay` | milliseconds to wait before answering (the file is still served unless another field applies) |
| `status` | answer with this status and a short text body (`body`, `contentType` override it) |
| `drop` | destroy the connection without an answer |
| `truncate` | send only this many body bytes, then cut the connection |
| `times` | apply the rule this many times, then ignore it (fail once, then recover) |

| File | Effect | Exercises |
| --- | --- | --- |
| `world-slow.json` | three and every world module wait 3 s | poster first paint, the world's loading and slow states |
| `world-three-missing.json` | three answers 404 | fallback panel ("could not start") with retry; all links work |
| `registry-error.json` | `regions.json` answers 500 | world start failure handling |
| `region-detail-missing.json` | Mountains detail modules 404 (`far.js` still loads) | the far silhouette stays; one error report; navigation unaffected |
| `region-detail-dropped.json` | every region detail module's connection is dropped | the same, for network failures |
| `world-assets-truncated.json` | world images and models cut off after 2 KiB | texture/model failure never strands navigation |
| `posters-missing.json` | posters 404 | the stage without its picture (alt text, caption, fallback layout) |
| `page-slow.json` | the Racing page waits 2.5 s | the router's slow state (after 1.2 s) during a navigation |
| `page-error-once.json` | the Chess page answers 500 once | the router's error state, retry, then success |

```sh
node tools/site/serve.mjs --port 0 --faults tools/site/fixtures/faults/world-three-missing.json
node tools/site/shoot.mjs --routes / --faults tools/site/fixtures/faults/world-three-missing.json --wait-world --out /tmp/shots
```

As a module: `createServer({ port: 0, faults: [...] })` or `faultsFile`, and `srv.setFaults([...])`
to change rules between steps.
