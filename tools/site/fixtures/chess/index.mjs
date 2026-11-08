// Serves the synthetic Chess.com fixtures in this directory to a page under test, through
// page.intercept() in tools/site/cdp.mjs (the DevTools Fetch domain; nothing reaches the network).
//
//   import { useChessFixtures } from './fixtures/chess/index.mjs';
//   const chess = await useChessFixtures(page, 'partial-failure');   // before page.goto()
//   await page.goto(base + 'chess/chess.html');
//   chess.calls;   // [{ resource: 'stats', n: 1, status: 500 }, ...] (no player names)
//   await chess.remove();
//
// Scenarios are in scenarios.json; `node tools/site/fixtures/chess/index.mjs` lists them.
//
// player: 'requested' (default) answers with the player name taken from the request URL in place of
// 'example-player', so a page that filters games by its own account accepts them. The name only
// exists in the browser's memory; calls and errors never include it. player: 'fixture' leaves the
// fixture text unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const CHESS_API = 'https://api.chess.com/pub/player/*';
const FIXTURE_PLAYER = 'example-player';

let cache = null;
export function loadScenarios() {
  cache ??= JSON.parse(fs.readFileSync(path.join(DIR, 'scenarios.json'), 'utf8'));
  return cache;
}

export function scenarioNames() {
  return Object.keys(loadScenarios().scenarios);
}

// The scenario with its base chain resolved: { about, expect, delay, first, all, routes }.
export function resolveScenario(name) {
  const all = loadScenarios().scenarios;
  const chain = [];
  for (let s = name; s; s = all[s]?.base) {
    if (!all[s]) throw new Error(`unknown chess scenario "${s}" (${Object.keys(all).join(', ')})`);
    if (chain.includes(s)) throw new Error(`chess scenario "${name}": base loop`);
    chain.unshift(s);
  }
  const out = { name, routes: {} };
  for (const s of chain) {
    const { routes, base, ...rest } = all[s];
    Object.assign(out, rest);
    Object.assign(out.routes, routes);
  }
  return out;
}

// '/pub/player/<user>/games/2026/09' → { user, resource: 'games/2026/09' }.
export function resourceOf(url) {
  const u = new URL(url);
  const m = /^\/pub\/player\/([^/]+)(\/.*)?$/.exec(u.pathname);
  if (u.hostname !== 'api.chess.com' || !m) return null;
  const rest = (m[2] || '').replace(/\/+$/, '');
  let resource;
  if (!rest) resource = 'profile';
  else if (rest === '/stats') resource = 'stats';
  else if (rest === '/games/archives') resource = 'archives';
  else if (/^\/games\/\d{4}\/\d{2}$/.test(rest)) resource = rest.slice(1);
  else if (/^\/games\/\d{4}\/\d{2}\/pgn$/.test(rest)) resource = 'pgn/' + rest.slice(7, 14);
  else resource = rest.slice(1);
  let user = m[1];
  try { user = decodeURIComponent(user); } catch { /* keep as sent */ }
  return { user, resource };
}

function ruleFor(scenario, resource) {
  const r = scenario.routes;
  if (r[resource]) return r[resource];
  const family = resource.split('/')[0];
  return r[`${family}/*`] || r['*'] || { status: 404, json: { code: 0, message: 'Data provider not found for this key.' } };
}

// handler(request) for page.intercept(CHESS_API, handler).
export function chessHandler(name = 'success', { player = 'requested', onRequest } = {}) {
  const scenario = resolveScenario(name);
  const counts = new Map();
  const read = (file) => fs.readFileSync(path.join(DIR, file), 'utf8');
  return async (req) => {
    const where = resourceOf(req.url);
    if (!where) return 'continue';
    const { user, resource } = where;
    const n = (counts.get(resource) || 0) + 1;
    counts.set(resource, n);
    let rule = scenario.all || (n === 1 && scenario.first) || ruleFor(scenario, resource);
    // The month as PGN text, built from the month's JSON when no rule names it.
    if (!scenario.all && !(n === 1 && scenario.first) && resource.startsWith('pgn/') && !scenario.routes[resource]) {
      const month = ruleFor(scenario, 'games/' + resource.slice(4));
      rule = month.file ? { text: JSON.parse(read(month.file)).games.map((g) => g.pgn).join('\n\n'), contentType: 'application/x-chess-pgn' } : month;
    }
    const call = { resource, n };
    let res;
    if (rule.hang) {
      call.hang = true;
      res = { hang: true };
    } else if (rule.fail) {
      call.fail = rule.fail;
      res = { fail: rule.fail };
    } else {
      let body = rule.file ? read(rule.file) : rule.json !== undefined ? JSON.stringify(rule.json, null, 2) : rule.text ?? '';
      // Player names in fixtures are lowercase; the API answers with the requested account.
      if (player === 'requested') body = body.split(FIXTURE_PLAYER).join(user.toLowerCase());
      call.status = rule.status ?? 200;
      res = {
        status: call.status,
        body,
        headers: {
          'Content-Type': rule.contentType || (rule.text !== undefined ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
          ...(rule.headers || {}),
        },
      };
    }
    const delay = (scenario.delay || 0) + (rule.delay || 0);
    if (delay && !rule.hang) call.delay = res.delay = delay;
    onRequest?.(call);
    return res;
  };
}

// Installs the scenario on a cdp.mjs page; call before goto(). Resolves with { calls, remove() }.
export async function useChessFixtures(page, name = 'success', options = {}) {
  const calls = [];
  const handler = chessHandler(name, { ...options, onRequest: (c) => { calls.push(c); options.onRequest?.(c); } });
  const remove = await page.intercept(CHESS_API, handler);
  return { scenario: name, calls, remove };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  for (const name of scenarioNames()) {
    const s = resolveScenario(name);
    console.log(`${name.padEnd(16)} ${s.about}`);
  }
}
