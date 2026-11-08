#!/usr/bin/env node
// Static server for the repository, close to what GitHub Pages serves (Node built-ins only).
//
//   node tools/site/serve.mjs [--port 0] [--root DIR] [--latency MS] [--kbps N] [--faults FILE] [--log]
//
// Prints the URL (one line, e.g. http://127.0.0.1:53817/) and serves until SIGINT/SIGTERM.
// - Correct MIME types, ETag/Last-Modified revalidation, byte ranges (video seeking).
// - /dir redirects to /dir/; /dir/ serves index.html; /page serves page.html when it exists.
// - Files git would never publish answer 404 like production: dot-files and folders, and paths
//   matching .gitignore or .git/info/exclude patterns (--serve-ignored turns this off).
// - /media/ is served from the `media` symlink (the CDN tree) with byte ranges, and with
//   Access-Control-Allow-Origin: *, as the CDN will.
// - --latency delays every response; --kbps paces all response bodies through one shared link.
// - --faults FILE: JSON array of { match, delay, status, drop, truncate, times, method } rules,
//   re-read when the file changes. See tools/site/README.md.
//
// As a module: const srv = await createServer({ port: 0, faults: [...] }); srv.url; srv.setFaults([]); await srv.close();
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive',
  '.pgn': 'application/x-chess-pgn',
};

export function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest)|image\/svg)/;

// ---------------------------------------------------------------------------------------------
// What GitHub Pages would not have: dot-files and git-ignored paths. Supports the common subset
// of gitignore syntax (no negation): `name` matches at any depth, `a/b` and `/a` are anchored at
// the root, a trailing `/` means a directory, `*` `?` and `**` are globs.
// ---------------------------------------------------------------------------------------------
function ignoreRules(root) {
  const rules = [];
  for (const file of ['.gitignore', path.join('.git', 'info', 'exclude')]) {
    let text = '';
    try { text = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;
      const dir = line.endsWith('/');
      if (dir) line = line.slice(0, -1);
      const anchored = line.includes('/');
      line = line.replace(/^\//, '');
      const glob = line.split('/').map((seg) => seg === '**' ? '(?:.*)' : seg
        .replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')).join('/');
      // A matched directory hides everything below it; a matched file only itself.
      const tail = dir ? '/.+' : '(?:/.+)?';
      rules.push(new RegExp(anchored ? `^${glob}${tail}$` : `(?:^|/)${glob}${tail}$`));
    }
  }
  return rules;
}

// /media/ is the local view of the CDN tree ($MEDIA_ROOT/cdn through the git-ignored `media`
// symlink at the repository root): served although git ignores it, as the CDN would serve it.
const MEDIA_PREFIX = /^media(\/|$)/;

function hiddenPath(rel, rules) {
  if (rel.split('/').some((seg) => seg.startsWith('.'))) return true;
  if (MEDIA_PREFIX.test(rel)) return false;
  return rules.some((re) => re.test(rel));
}

// ---------------------------------------------------------------------------------------------
// Shared link: every body chunk waits its turn on one emulated connection of `kbps`.
// ---------------------------------------------------------------------------------------------
function createLink(kbps) {
  let free = 0;
  return {
    // Resolves when `bytes` would have finished crossing the link.
    take(bytes) {
      if (!kbps) return Promise.resolve();
      const now = performance.now();
      free = Math.max(free, now) + (bytes * 8) / kbps; // kbps = bits per millisecond
      return new Promise((resolve) => setTimeout(resolve, free - now));
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolves when the response can take more data, or when the client has gone.
function drained(res) {
  return new Promise((resolve) => {
    const finish = () => { res.off('drain', finish); res.off('close', finish); resolve(); };
    res.on('drain', finish);
    res.on('close', finish);
  });
}

// Files above this size are streamed from disk instead of read whole.
const STREAM_BYTES = 1024 * 1024;

// Fault rule: { match: 'regex', method?, delay?, status?, body?, drop?, truncate?, times? }.
function compileFaults(list) {
  if (!Array.isArray(list)) throw new Error('faults must be a JSON array');
  return list.map((f, i) => {
    if (!f || typeof f.match !== 'string') throw new Error(`fault ${i}: "match" (a regular expression string) is required`);
    return { ...f, re: new RegExp(f.match), used: 0 };
  });
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null; // multiple or malformed ranges: send the whole file
  let start, end;
  if (!m[1]) { start = Math.max(0, size - +m[2]); end = size - 1; } else { start = +m[1]; end = m[2] ? Math.min(+m[2], size - 1) : size - 1; }
  if (start > end || start >= size) return { unsatisfiable: true };
  return { start, end };
}

export async function createServer({
  root = REPO_ROOT,
  host = '127.0.0.1',
  port = 0,
  latency = 0,
  kbps = 0,
  faults = [],
  faultsFile = null,
  serveIgnored = false,
  overlay = null,   // a second root consulted first: pages generated with the synthetic test film
  gzip = false,
  maxAge = 0,
  log = null, // function(line) or null
} = {}) {
  root = path.resolve(root);
  overlay = overlay ? path.resolve(overlay) : null;
  const rules = serveIgnored ? [] : ignoreRules(root);
  let link = createLink(kbps);
  let rulesList = compileFaults(faults);
  let faultsMtime = 0;
  const stats = { requests: 0, bytes: 0, faults: 0 };
  const sockets = new Set();

  function reloadFaults() {
    if (!faultsFile) return;
    try {
      const m = fs.statSync(faultsFile).mtimeMs;
      if (m === faultsMtime) return;
      faultsMtime = m;
      rulesList = compileFaults(JSON.parse(fs.readFileSync(faultsFile, 'utf8')));
    } catch (e) {
      log?.(`faults file ${faultsFile}: ${e.message}`);
    }
  }
  reloadFaults();

  // body: a Buffer, or { file, start, length } streamed from disk (large files, byte ranges).
  async function send(req, res, status, headers, body, t0, fault) {
    const total = body ? body.length : 0;
    const limit = fault?.truncate != null ? Math.min(total, fault.truncate) : total;
    if (latency) await sleep(latency);
    if (res.destroyed) return;
    res.writeHead(status, { 'Content-Length': total, ...headers });
    if (req.method === 'HEAD' || !total) { res.end(); return done(); }
    // Small pieces when throttled, so pacing stays smooth.
    const CHUNK = kbps ? 16384 : 65536;
    const fh = Buffer.isBuffer(body) ? null : await fs.promises.open(body.file, 'r');
    let sent = 0;
    try {
      while (sent < limit) {
        const n = Math.min(CHUNK, limit - sent);
        let piece;
        if (fh) {
          piece = Buffer.allocUnsafe(n);
          const { bytesRead } = await fh.read(piece, 0, n, body.start + sent);
          if (!bytesRead) break;
          piece = piece.subarray(0, bytesRead);
        } else piece = body.subarray(sent, sent + n);
        await link.take(piece.length);
        if (res.destroyed) return done('aborted by the client');
        // When truncating, wait for each piece to reach the socket so the cut lands after it.
        if (limit < total) await new Promise((r) => res.write(piece, r));
        else if (!res.write(piece)) await drained(res);
        sent += piece.length;
        stats.bytes += piece.length;
      }
    } finally {
      await fh?.close();
    }
    if (limit < total) { res.socket?.destroy(); return done('truncated'); }
    res.end();
    done();
    function done(note) {
      log?.(`${req.method} ${status} ${req.method === 'HEAD' ? 0 : sent}B ${Math.round(performance.now() - t0)}ms ${req.url}${note ? ' ' + note : ''}`);
    }
  }

  function text(status, message) {
    return [status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, Buffer.from(message + '\n')];
  }

  async function handle(req, res) {
    const t0 = performance.now();
    stats.requests++;
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, ...text(405, 'method not allowed'), t0);
    const url = new URL(req.url, 'http://local');
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { return send(req, res, ...text(400, 'bad path encoding'), t0); }

    reloadFaults();
    const fault = rulesList.find((f) => (!f.method || f.method === req.method) && (f.times == null || f.used < f.times)
      && (f.re.test(req.url) || f.re.test(decoded + url.search)));
    if (fault) {
      fault.used++;
      stats.faults++;
      if (fault.delay) await sleep(fault.delay);
      if (fault.drop) { log?.(`${req.method} DROP ${req.url}`); req.socket.destroy(); return; }
      if (fault.status) {
        const body = Buffer.from((fault.body ?? `fault ${fault.status} for ${decoded}`) + '\n');
        return send(req, res, fault.status, { 'Content-Type': fault.contentType || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, body, t0);
      }
    }

    if (decoded.includes('\0')) return send(req, res, ...text(400, 'bad path'), t0);
    const rel = path.posix.normalize(decoded).replace(/^\/+/, '');
    if (rel.startsWith('..')) return send(req, res, ...text(403, 'outside the root'), t0);
    const notFound = async () => {
      const page = path.join(root, '404.html');
      if (fs.existsSync(page)) return send(req, res, 404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }, await fs.promises.readFile(page), t0);
      return send(req, res, ...text(404, `not found: ${decoded}`), t0);
    };
    if (rel && hiddenPath(rel.replace(/\/$/, ''), rules)) return notFound();

    // An overlay root (--overlay) wins where it has the path: the generated test pages sit on the
    // real URLs while everything else (scripts, styles, media) comes from the repository.
    let base = root;
    if (overlay && rel && await fs.promises.stat(path.join(overlay, rel)).then(() => true, () => false)) base = overlay;
    else if (overlay && !rel && await fs.promises.stat(path.join(overlay, 'index.html')).then(() => true, () => false)) base = overlay;
    let file = path.join(base, rel);
    let st = await fs.promises.stat(file).catch(() => null);
    if (st?.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        if (latency) await sleep(latency);
        res.writeHead(301, { Location: url.pathname + '/' + url.search, 'Content-Length': 0 });
        res.end();
        log?.(`${req.method} 301 ${req.url}`);
        return;
      }
      file = path.join(file, 'index.html');
      st = await fs.promises.stat(file).catch(() => null);
    } else if (!st && !path.extname(file)) {
      // GitHub Pages serves /page from page.html.
      file += '.html';
      st = await fs.promises.stat(file).catch(() => null);
    }
    if (!st || !st.isFile()) return notFound();

    const type = mimeOf(file);
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      ...(MEDIA_PREFIX.test(rel) ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length' } : {}),
      'Content-Type': type,
      'Last-Modified': st.mtime.toUTCString(),
      ETag: etag,
      'Accept-Ranges': 'bytes',
      'Cache-Control': maxAge ? `max-age=${maxAge}` : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers['if-none-match'] === etag) {
      return send(req, res, 304, { ETag: etag, 'Cache-Control': headers['Cache-Control'] }, null, t0);
    }

    const range = req.headers.range && st.size ? parseRange(req.headers.range, st.size) : null;
    if (range?.unsatisfiable) {
      return send(req, res, 416, { 'Content-Range': `bytes */${st.size}`, 'Content-Type': 'text/plain' }, null, t0);
    }
    if (range) {
      const body = { file, start: range.start, length: range.end - range.start + 1 };
      return send(req, res, 206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${st.size}` }, body, t0, fault);
    }
    const zip = gzip && COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && st.size > 1024;
    if (!zip && st.size > STREAM_BYTES) return send(req, res, 200, headers, { file, start: 0, length: st.size }, t0, fault);
    let body = await fs.promises.readFile(file);
    if (zip) {
      body = zlib.gzipSync(body, { level: 6 });
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      delete headers['Accept-Ranges'];
    }
    return send(req, res, 200, headers, body, t0, fault);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      log?.(`500 ${req.url}: ${e.message}`);
      if (res.writableEnded || res.destroyed) return;
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('server error\n');
    });
  });
  server.keepAliveTimeout = 5000;
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const actual = server.address().port;
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${actual}/`;
  return {
    server,
    url,
    port: actual,
    root,
    stats,
    setFaults(list) { rulesList = compileFaults(list || []); },
    // Change throttling while serving, e.g. throttle the first load only.
    setThrottle({ latency: l = 0, kbps: k = 0 } = {}) { latency = l; link = createLink(k); },
    close() {
      for (const s of sockets) s.destroy();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', short: 'p', default: '0' },
      host: { type: 'string', default: '127.0.0.1' },
      root: { type: 'string', default: REPO_ROOT },
      latency: { type: 'string', default: '0' },
      kbps: { type: 'string', default: '0' },
      faults: { type: 'string' },
      'serve-ignored': { type: 'boolean', default: false },
      overlay: { type: 'string' },
      gzip: { type: 'boolean', default: false },
      'max-age': { type: 'string', default: '0' },
      log: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('usage: node tools/site/serve.mjs [--port 0] [--host 127.0.0.1] [--root DIR] [--latency MS] [--kbps N]\n'
      + '         [--faults FILE.json] [--overlay DIR] [--gzip] [--max-age S] [--serve-ignored] [--log]');
    return;
  }
  const srv = await createServer({
    root: values.root,
    host: values.host,
    port: +values.port,
    latency: +values.latency,
    kbps: +values.kbps,
    faultsFile: values.faults ? path.resolve(values.faults) : null,
    serveIgnored: values['serve-ignored'],
    overlay: values.overlay || null,
    gzip: values.gzip,
    maxAge: +values['max-age'],
    log: values.log ? (line) => process.stderr.write(line + '\n') : null,
  });
  console.log(srv.url);
  const stop = async () => { await srv.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
