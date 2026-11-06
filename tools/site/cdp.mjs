#!/usr/bin/env node
// Dependency-free headless Chrome over the DevTools protocol (Node 22+ built-ins only).
//
//   import { launch } from './cdp.mjs';
//   const browser = await launch({ preset: 'gpu' });
//   const page = await browser.newPage({ width: 1440, height: 900 });
//   await page.goto('http://127.0.0.1:8000/');
//   console.log(await page.eval(() => document.title));
//   await page.screenshot('/tmp/home.png');
//   await browser.close();
//
// Chrome is spawned with --remote-debugging-pipe, its own temporary profile and its own process
// group. It is killed on browser.close(), on process exit, on SIGINT/SIGTERM/SIGHUP, and Chrome
// also exits by itself when this process dies (the pipe closes). By default every host except
// 127.0.0.1 and localhost fails DNS resolution, so pages under test cannot reach the network;
// page.intercept() still answers such requests with fixtures.
//
// Also a small CLI for one-off probes:
//   node tools/site/cdp.mjs URL [--size 1440x900] [--preset gpu] [--eval EXPR]... [--shot FILE] [--full-page]
//     [--chess SCENARIO]   answer Chess.com API requests from tools/site/fixtures/chess
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TOOLS_DIR, '..', '..');

// GPU flag presets, verified headless on Apple Silicon with Chrome 154.
export const PRESETS = {
  // Hardware WebGL2 through ANGLE's Metal backend (what Chrome picks by default on macOS; pinned).
  gpu: process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
    : ['--enable-gpu', '--ignore-gpu-blocklist'],
  // CPU WebGL2 (SwiftShader). A pessimistic proxy for weak devices; frame times are CPU-bound.
  swiftshader: ['--disable-gpu', '--enable-unsafe-swiftshader'],
  // No WebGL at all: getContext('webgl2') returns null, which exercises the fallback.
  nowebgl: ['--disable-gpu'],
  none: [],
};

// Quiet, offline-friendly, unthrottled throwaway profile.
export const BASE_FLAGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-sync',
  '--disable-extensions',
  '--disable-default-apps',
  '--disable-client-side-phishing-detection',
  '--disable-domain-reliability',
  '--safebrowsing-disable-auto-update',
  '--metrics-recording-only',
  '--no-service-autorun',
  '--mute-audio',
  '--hide-scrollbars',
  '--password-store=basic',
  '--use-mock-keychain',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,CalculateNativeWinOcclusion,DialMediaRouteProvider',
];

// Every host except the loopback names fails DNS; intercepted requests never reach DNS.
const LOCAL_ONLY = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : process.platform === 'win32'
      ? [`${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`]
      : (process.env.PATH || '').split(':').flatMap((d) => ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map((n) => path.join(d, n)));
  const found = candidates.find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } });
  if (!found) throw new Error('Chrome not found; set CHROME_PATH');
  return found;
}

// Chess.com player names never appear in logs: tools pass every logged string through this.
export function redact(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(api\.chess\.com\/pub\/player\/)[^/\s"'?#]+/gi, '$1<user>')
    .replace(/(chess\.com\/member\/)[^/\s"'?#]+/gi, '$1<user>');
}

// ---------------------------------------------------------------------------------------------
// Protocol connection over Chrome's pipe (fd 3 writes, fd 4 reads, messages end with \0).
// ---------------------------------------------------------------------------------------------
class Connection {
  constructor(writable, readable) {
    this.out = writable;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    this.closed = false;
    let chunks = [];
    readable.on('data', (data) => {
      let start = 0;
      for (let i = data.indexOf(0); i >= 0; i = data.indexOf(0, start)) {
        chunks.push(data.subarray(start, i));
        this.receive(Buffer.concat(chunks).toString('utf8'));
        chunks = [];
        start = i + 1;
      }
      if (start < data.length) chunks.push(data.subarray(start));
    });
    const end = () => this.shut('Chrome closed the DevTools pipe');
    readable.on('close', end);
    readable.on('error', end);
    writable.on('error', end);
  }

  send(method, params = {}, sessionId, { timeout = 60000 } = {}) {
    if (this.closed) return Promise.reject(new Error(`${method}: browser connection closed`));
    const id = ++this.nextId;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = timeout > 0 ? setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: no reply after ${timeout} ms`));
      }, timeout) : null;
      this.pending.set(id, { resolve, reject, method, timer });
      this.out.write(JSON.stringify(msg) + '\0');
    });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  receive(text) {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.id !== undefined) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) {
        const err = new Error(`${p.method}: ${msg.error.message}${msg.error.data ? ' ' + msg.error.data : ''}`);
        err.code = msg.error.code;
        p.reject(err);
      } else p.resolve(msg.result);
      return;
    }
    for (const fn of this.listeners) {
      try { fn(msg); } catch { /* a listener error must not break the connection */ }
    }
  }

  shut(reason) {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(`${p.method}: ${reason}`)); }
    this.pending.clear();
  }
}

// ---------------------------------------------------------------------------------------------
// Page: one tab, one flattened session.
// ---------------------------------------------------------------------------------------------
// Collected before any page script: LCP, CLS and long tasks.
const OBSERVERS = `(() => {
  const p = (window.__cdp = { lcp: null, cls: 0, longTasks: 0, longTaskMs: 0 });
  const describe = (el) => el ? el.tagName + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '') : null;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) p.lcp = { t: e.startTime, size: e.size, el: describe(e.element), url: e.url || null }; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) p.cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { p.longTasks++; p.longTaskMs += e.duration; } })
      .observe({ type: 'longtask', buffered: true });
  } catch {}
})();`;

const KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Escape: { code: 'Escape', vk: 27 },
  Tab: { code: 'Tab', vk: 9 },
  Space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
  ' ': { code: 'Space', vk: 32, text: ' ' },
  Backspace: { code: 'Backspace', vk: 8 },
  Delete: { code: 'Delete', vk: 46 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
  PageUp: { code: 'PageUp', vk: 33 },
  PageDown: { code: 'PageDown', vk: 34 },
  Home: { code: 'Home', vk: 36 },
  End: { code: 'End', vk: 35 },
  Shift: { code: 'ShiftLeft', vk: 16 },
  Control: { code: 'ControlLeft', vk: 17 },
  Alt: { code: 'AltLeft', vk: 18 },
  Meta: { code: 'MetaLeft', vk: 91 },
  '+': { code: 'Equal', vk: 187, text: '+' },
  '-': { code: 'Minus', vk: 189, text: '-' },
  '=': { code: 'Equal', vk: 187, text: '=' },
};
const MODIFIERS = { Alt: 1, Control: 2, Ctrl: 2, Meta: 4, Cmd: 4, Shift: 8 };
const MAC_COMMANDS = { a: 'selectAll', c: 'copy', x: 'cut', v: 'paste', z: 'undo' };

function keyInfo(name) {
  if (KEYS[name]) return { key: KEYS[name].key || name, ...KEYS[name] };
  if (name.length === 1) {
    const upper = name.toUpperCase();
    const code = /[a-z]/i.test(name) ? 'Key' + upper : /\d/.test(name) ? 'Digit' + name : '';
    return { key: name, code, vk: /[a-z\d]/i.test(name) ? upper.charCodeAt(0) : 0, text: name };
  }
  if (/^F\d{1,2}$/.test(name)) return { key: name, code: name, vk: 111 + +name.slice(1) };
  return { key: name, code: name, vk: 0 };
}

// Fetch-domain glob ('*' any run, '?' one character) as a RegExp.
function globToRegExp(glob) {
  return new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

function toSource(fnOrString, args) {
  if (typeof fnOrString === 'function') return `(${fnOrString.toString()})(...${JSON.stringify(args)})`;
  if (args.length) throw new Error('eval: arguments need a function, not a string');
  return String(fnOrString);
}

// Nearest-rank percentile of a sorted array.
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i];
}

// Same definitions as static/world/core/frame-stats.js: median of the middle pair, nearest-rank p95.
export function intervalStats(intervals) {
  const s = [...intervals].sort((a, b) => a - b);
  const r = (v) => (v == null ? null : Math.round(v * 100) / 100);
  const mid = s.length >> 1;
  return {
    samples: s.length,
    median: r(!s.length ? null : s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2),
    p95: r(quantile(s, 0.95)),
    max: r(s.length ? s[s.length - 1] : null),
    over33: s.filter((v) => v > 33.4).length,
  };
}

class Page {
  constructor(browser, sessionId, targetId, opts) {
    this.browser = browser;
    this.conn = browser.conn;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.contextId = opts.contextId || null; // set when the page has its own browser context
    this.opts = opts;
    this.timeout = opts.timeout ?? 30000;
    this.events = [];
    this._spliced = 0; // events dropped from the front of the buffer
    this.console = [];
    this.errors = [];
    this.logs = [];
    this.notes = [];
    this.status = null;
    this._requests = new Map();
    this._intercepts = [];
    this._answered = new Map(); // network request id -> 'fulfilled' | 'failed' | 'hung' by intercept()
    this._inflight = new Set();
    this._lastNetworkActivity = performance.now();
    this._network = null;
    this.closed = false;
    this._off = this.conn.on((msg) => {
      if (msg.sessionId !== this.sessionId) return;
      this.events.push(msg);
      if (this.events.length > 4000) { this.events.splice(0, 2000); this._spliced += 2000; }
      this._record(msg);
    });
  }

  send(method, params, options) { return this.conn.send(method, params, this.sessionId, options); }

  get requests() { return [...this._requests.values()]; }

  _record({ method, params }) {
    const t = Date.now();
    switch (method) {
      case 'Runtime.consoleAPICalled': {
        const f = params.stackTrace?.callFrames?.[0];
        this.console.push({ t, type: params.type, text: params.args.map(formatRemote).join(' '), at: f ? `${f.url}:${f.lineNumber + 1}:${f.columnNumber + 1}` : undefined });
        break;
      }
      case 'Runtime.exceptionThrown': {
        const d = params.exceptionDetails;
        this.errors.push({ t, text: d.exception?.description || d.text, url: d.url, line: d.lineNumber + 1, column: d.columnNumber + 1 });
        break;
      }
      case 'Log.entryAdded': {
        const e = params.entry;
        this.logs.push({ t, source: e.source, level: e.level, text: e.text, url: e.url, line: e.lineNumber !== undefined ? e.lineNumber + 1 : undefined });
        break;
      }
      case 'Network.requestWillBeSent': {
        const prev = this._requests.get(params.requestId);
        // A redirect reuses the request id; keep the hop as its own record.
        if (prev && params.redirectResponse) {
          prev.status = params.redirectResponse.status;
          prev.redirectedTo = params.request.url;
          this._requests.set(params.requestId + ':' + prev.url, prev);
        }
        this._requests.set(params.requestId, {
          id: params.requestId, url: params.request.url, method: params.request.method, type: params.type || 'Other',
          status: null, mimeType: null, encodedDataLength: 0, dataLength: 0, fromCache: false,
          priority: params.request.initialPriority, initiator: params.initiator?.type,
          frameId: params.frameId, wallTime: params.wallTime, startTs: params.timestamp, responseTs: null, endTs: null,
          intercepted: this._answered.get(params.requestId),
        });
        this._inflight.add(params.requestId);
        this._lastNetworkActivity = performance.now();
        break;
      }
      case 'Network.requestServedFromCache': {
        const r = this._requests.get(params.requestId); if (r) r.fromCache = true;
        break;
      }
      case 'Network.responseReceived': {
        const r = this._requests.get(params.requestId);
        if (!r) break;
        r.status = params.response.status;
        r.mimeType = params.response.mimeType;
        r.protocol = params.response.protocol;
        r.responseTs = params.timestamp;
        if (params.response.fromDiskCache || params.response.fromServiceWorker || params.response.fromPrefetchCache) r.fromCache = true;
        if (params.type === 'Document' && params.frameId === this.targetId) this.status = params.response.status;
        break;
      }
      case 'Network.dataReceived': {
        const r = this._requests.get(params.requestId); if (r) r.dataLength += params.dataLength;
        this._lastNetworkActivity = performance.now();
        break;
      }
      case 'Network.loadingFinished': {
        const r = this._requests.get(params.requestId);
        if (r) { r.encodedDataLength = params.encodedDataLength; r.endTs = params.timestamp; }
        this._inflight.delete(params.requestId);
        this._lastNetworkActivity = performance.now();
        break;
      }
      case 'Network.loadingFailed': {
        const r = this._requests.get(params.requestId);
        // Requests blocked by setBlockedUrls() fail with an empty errorText and blockedReason 'inspector'.
        if (r) { r.failed = params.errorText || (params.blockedReason ? `blocked:${params.blockedReason}` : 'failed'); r.canceled = !!params.canceled; r.blockedReason = params.blockedReason; r.endTs = params.timestamp; }
        this._inflight.delete(params.requestId);
        this._lastNetworkActivity = performance.now();
        break;
      }
      case 'Fetch.requestPaused':
        this._onPaused(params);
        break;
      case 'Inspector.targetCrashed':
        this.errors.push({ t, text: 'renderer crashed (Inspector.targetCrashed)' });
        break;
    }
  }

  // Resolve with the first event matching pred, from `fromIndex` in the buffer or in the future.
  waitForEvent(pred, { timeout = this.timeout, fromIndex = 0, label = 'event' } = {}) {
    for (let i = Math.max(0, fromIndex - this._spliced); i < this.events.length; i++) if (pred(this.events[i])) return Promise.resolve(this.events[i]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error(`timeout ${timeout} ms waiting for ${label}`)); }, timeout);
      const off = this.conn.on((msg) => {
        if (msg.sessionId === this.sessionId && pred(msg)) { clearTimeout(timer); off(); resolve(msg); }
      });
    });
  }

  // Subscribe to a protocol event of this page: page.on('Network.responseReceived', fn) → off().
  on(method, fn) {
    return this.conn.on((msg) => { if (msg.sessionId === this.sessionId && msg.method === method) fn(msg.params); });
  }

  async setup(o) {
    await Promise.all([
      this.send('Page.enable'),
      this.send('Runtime.enable'),
      this.send('Log.enable'),
      this.send('Network.enable', { maxTotalBufferSize: 0, maxResourceBufferSize: 0 }).catch(() => this.send('Network.enable')),
      this.send('Performance.enable', { timeDomain: 'timeTicks' }),
    ]);
    await this.send('Page.setLifecycleEventsEnabled', { enabled: true });
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVERS });
    // Run before page scripts on every document, e.g. seeding localStorage. Storage throws on
    // opaque origins (about:blank), hence the try.
    for (const source of o.init || []) await this.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { ${source}\n} catch (e) {}` });
    await this.setViewport(o);
    // Headless tabs are not focused; without this, :focus-visible and focus events misbehave.
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch((e) => this.notes.push(e.message));
    await this.setMedia(o);
    if (o.javaScript === false) await this.setJavaScript(false);
    if (o.network) await this.setNetwork(o.network);
    if (o.cpuThrottle && o.cpuThrottle > 1) await this.setCpuThrottle(o.cpuThrottle);
    if (o.blockUrls?.length) await this.setBlockedUrls(o.blockUrls);
    if (o.cache === false) await this.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (o.textZoom && o.textZoom !== 1) await this.setTextZoom(o.textZoom);
  }

  // zoom emulates browser page zoom: the CSS viewport shrinks by the factor and the device pixel
  // ratio grows by it, so a 1440x900 window at 200% lays out at 720x450 CSS px.
  async setViewport({ width = 1280, height = 800, deviceScaleFactor = 1, mobile = false, zoom = 1 } = {}) {
    this.viewport = { width, height, deviceScaleFactor, mobile, zoom };
    const w = Math.round(width / zoom), h = Math.round(height / zoom);
    await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: deviceScaleFactor * zoom, mobile, screenWidth: w, screenHeight: h });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: mobile ? 5 : 0 }).catch(() => {});
  }

  async setMedia({ reducedMotion = false, colorScheme } = {}) {
    const features = [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }];
    if (colorScheme) features.push({ name: 'prefers-color-scheme', value: colorScheme });
    await this.send('Emulation.setEmulatedMedia', { media: '', features });
  }

  async setJavaScript(enabled) {
    await this.send('Emulation.setScriptExecutionDisabled', { value: !enabled });
  }

  // Enlarged text: the browser's default font size (16 px) times the factor, like the browser
  // font-size setting. Text sized in px does not grow; that is the point of the check.
  async setTextZoom(factor) {
    await this.send('Page.setFontSizes', { fontSizes: { standard: Math.round(16 * factor), fixed: Math.round(13 * factor) } });
  }

  // Requests matching any pattern ('*' wildcards) fail with net::ERR_BLOCKED_BY_CLIENT.
  async setBlockedUrls(patterns) {
    await this.send('Network.setBlockedURLs', { urls: patterns }).catch(() =>
      this.send('Network.setBlockedURLs', { urlPatterns: patterns.map((urlPattern) => ({ urlPattern, block: true })) }));
  }

  async setCpuThrottle(rate) {
    await this.send('Emulation.setCPUThrottlingRate', { rate: Math.max(1, rate) });
  }

  // network = { latencyMs, downKbps, upKbps, offline } (kilobits per second); null clears.
  async setNetwork(network) {
    this._network = network || null;
    const n = network || {};
    const cond = {
      offline: !!n.offline,
      latency: n.latencyMs ?? 0,
      downloadThroughput: n.downKbps ? (n.downKbps * 1000) / 8 : -1,
      uploadThroughput: n.upKbps ? (n.upKbps * 1000) / 8 : -1,
    };
    try {
      // Deprecated in Chrome 154 but still honoured; same timings as its replacement.
      await this.send('Network.emulateNetworkConditions', { ...cond, connectionType: network ? 'wifi' : 'none' });
      this.networkMethod = 'Network.emulateNetworkConditions';
    } catch {
      // The replacement pair: offline state plus a throttling rule that matches every URL.
      await this.send('Network.overrideNetworkState', { offline: cond.offline, latency: cond.latency, downloadThroughput: cond.downloadThroughput, uploadThroughput: cond.uploadThroughput }).catch(() => {});
      await this.send('Network.emulateNetworkConditionsByRule', { offline: cond.offline, matchedNetworkConditions: [{ urlPattern: '', latency: cond.latency, downloadThroughput: cond.downloadThroughput, uploadThroughput: cond.uploadThroughput }] });
      this.networkMethod = 'Network.emulateNetworkConditionsByRule';
    }
  }

  setOffline(offline) {
    return this.setNetwork({ ...(this._network || {}), offline: !!offline });
  }

  async goto(url, { waitUntil = 'load', timeout = this.timeout } = {}) {
    const from = this.events.length + this._spliced;
    const t0 = performance.now();
    this.status = null;
    const nav = await this.send('Page.navigate', { url }, { timeout });
    if (nav.errorText) throw new Error(`navigate ${redact(url)}: ${nav.errorText}`);
    // A same-document navigation (fragment only) has no loader and fires no load event.
    if (!nav.loaderId || waitUntil === 'commit') return { url, status: this.status, ms: Math.round(performance.now() - t0) };
    await this.waitLifecycle(waitUntil, nav.loaderId, from, timeout, url);
    return { url, status: this.status, ms: Math.round(performance.now() - t0) };
  }

  async reload({ waitUntil = 'load', timeout = this.timeout, ignoreCache = false } = {}) {
    const from = this.events.length + this._spliced;
    const t0 = performance.now();
    await this.send('Page.reload', { ignoreCache });
    await this.waitLifecycle(waitUntil, null, from, timeout, 'reload');
    return { status: this.status, ms: Math.round(performance.now() - t0) };
  }

  waitLifecycle(waitUntil, loaderId, from, timeout, label) {
    const name = { load: 'load', domcontentloaded: 'DOMContentLoaded', networkidle: 'networkIdle', networkalmostidle: 'networkAlmostIdle' }[waitUntil];
    if (!name) throw new Error(`unknown waitUntil ${waitUntil}`);
    const pred = (m) => m.method === 'Page.lifecycleEvent' && m.params.name === name && m.params.frameId === this.targetId && (!loaderId || m.params.loaderId === loaderId);
    return this.waitForEvent(pred, { timeout, fromIndex: from, label: `${waitUntil} of ${redact(label)}` });
  }

  // Evaluate a function (serialized with JSON arguments) or an expression string in the page.
  // Promises are awaited; the value comes back by value (JSON-compatible).
  async eval(fnOrString, ...args) {
    const res = await this.send('Runtime.evaluate', {
      expression: toSource(fnOrString, args),
      awaitPromise: true, returnByValue: true, userGesture: true, allowUnsafeEvalBlockedByCSP: true,
    }, { timeout: this.timeout + 30000 });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(`eval threw: ${d.exception?.description || d.text}`);
    }
    return res.result.value !== undefined ? res.result.value : res.result.type === 'undefined' ? undefined : res.result.description;
  }

  // Poll until the function/expression returns a truthy value; resolves with that value.
  async waitFor(fnOrString, { timeout = this.timeout, interval = 100, args = [] } = {}) {
    const t0 = performance.now();
    let lastError = null;
    for (;;) {
      let v;
      try { v = await this.eval(fnOrString, ...args); lastError = null; } catch (e) { lastError = e; }
      if (v) return v;
      if (performance.now() - t0 > timeout) {
        const what = typeof fnOrString === 'function' ? 'function' : fnOrString;
        throw new Error(`timeout ${timeout} ms waiting for ${what}${lastError ? ` (last error: ${lastError.message})` : ''}`);
      }
      await sleep(interval);
    }
  }

  // Resolves once no request (other than media streams and sockets) has been in flight for idleMs.
  async waitForNetworkIdle({ idleMs = 500, timeout = this.timeout } = {}) {
    const t0 = performance.now();
    for (;;) {
      const busy = [...this._inflight].filter((id) => !['Media', 'WebSocket', 'EventSource'].includes(this._requests.get(id)?.type));
      const quiet = performance.now() - this._lastNetworkActivity;
      if (!busy.length && quiet >= idleMs) return { ms: Math.round(performance.now() - t0) };
      if (performance.now() - t0 > timeout) throw new Error(`timeout ${timeout} ms waiting for network idle (${busy.length} in flight)`);
      await sleep(50);
    }
  }

  // PNG of the viewport, the full page (fullPage) or a CSS-pixel rectangle (clip: { x, y, width,
  // height }). Writes `file` when given; resolves with { file, bytes, width, height, ms, buffer }.
  // Full-page capture resizes the layout viewport for a moment, which fires resize handlers.
  async screenshot(file, { fullPage = false, clip, format = 'png', quality } = {}) {
    // A hidden page produces no frames, so the capture would wait forever.
    if (this.hidden) throw new Error('screenshot: the page is hidden; call show() first');
    const t0 = performance.now();
    const params = { format, fromSurface: true };
    if (quality && format !== 'png') params.quality = quality;
    if (fullPage) {
      const m = await this.send('Page.getLayoutMetrics');
      const s = m.cssContentSize || m.contentSize;
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: Math.ceil(s.width), height: Math.ceil(s.height), scale: 1 };
    } else if (clip) {
      params.clip = { scale: 1, ...clip };
      params.captureBeyondViewport = true;
    }
    const { data } = await this.send('Page.captureScreenshot', params, { timeout: Math.max(60000, this.timeout) });
    const buffer = Buffer.from(data, 'base64');
    if (file) {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.writeFileSync(file, buffer);
    }
    return { file, bytes: buffer.length, ms: Math.round(performance.now() - t0), ...pngSize(buffer), buffer };
  }

  // Trusted click at the centre of the first matching element that is actually on top there
  // (after scrolling it into view). Throws when every match is covered, unless { force: true }.
  // The position is re-measured until it holds still for a frame (smooth scrolling, late layout).
  async click(selector, { force = false, button = 'left', clickCount = 1, modifiers } = {}) {
    const locate = (sel, force) => {
      const els = [...document.querySelectorAll(sel)];
      if (!els.length) return null;
      const boxed = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (!boxed.length) return { invisible: els.length };
      const name = (n) => n ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).join('.') : '') : null;
      let first = null;
      for (const el of boxed) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
        const b = { x, y, hit: !!top && (top === el || el.contains(top)), on: name(top) };
        if (b.hit) return b;
        if (!first) first = b;
      }
      if (force) boxed[0].scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      return first;
    };
    let box = null;
    for (let i = 0; i < 10; i++) {
      const next = await this.eval(locate, selector, force);
      if (!next) throw new Error(`click: nothing matches ${selector}`);
      if (next.invisible) throw new Error(`click: ${next.invisible} element(s) match ${selector} but none has a box`);
      const still = box && Math.abs(next.x - box.x) < 1 && Math.abs(next.y - box.y) < 1;
      box = next;
      if (still) break;
      await this.eval(() => new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 120); }));
    }
    if (!box.hit && !force) throw new Error(`click: ${selector} is covered at its centre by ${box.on}`);
    await this.clickAt(box.x, box.y, { button, clickCount, modifiers });
    return box;
  }

  async clickAt(x, y, { button = 'left', clickCount = 1, modifiers } = {}) {
    const mods = modifierBits(modifiers);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers: mods });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount, modifiers: mods });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount, modifiers: mods });
  }

  async mouse(x, y) { await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); }

  // Mouse drag from [x, y] to [x, y] in `steps` moves (pointer orbit).
  async drag(from, to, { steps = 12, button = 'left', duration = 240 } = {}) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0], y: from[1] });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from[0], y: from[1], button, clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0] + (to[0] - from[0]) * k, y: from[1] + (to[1] - from[1]) * k, button, buttons: 1 });
      await sleep(duration / steps);
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to[0], y: to[1], button, clickCount: 1 });
  }

  // Key press, e.g. 'Enter', 'ArrowLeft', 'a', 'Shift+Tab', 'Control+='. No nativeVirtualKeyCode:
  // on macOS Chrome reads it as a Mac key code (65 is the keypad decimal), which floods the page
  // with phantom keydown events and can stall the protocol.
  async press(combo) {
    const parts = combo.length > 1 ? combo.split('+').filter(Boolean) : [combo];
    if (combo.endsWith('++')) parts.push('+');
    const name = parts.pop();
    const mods = modifierBits(parts);
    const k = keyInfo(name);
    const text = mods & ~8 ? undefined : k.text;
    const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers: mods };
    // macOS performs editing shortcuts as commands rather than from the key event.
    const command = process.platform === 'darwin' && mods === 4 ? MAC_COMMANDS[name.toLowerCase()] : undefined;
    await this.send('Input.dispatchKeyEvent', { ...base, type: text ? 'keyDown' : 'rawKeyDown', text, unmodifiedText: text, ...(command ? { commands: [command] } : {}) });
    await this.send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  }

  // Types into the focused element one character at a time (key events with text).
  async type(text) {
    for (const ch of text) {
      if (ch === '\n') { await this.press('Enter'); continue; }
      const k = keyInfo(ch);
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, code: k.code, windowsVirtualKeyCode: k.vk, text: ch, unmodifiedText: ch });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: k.code, windowsVirtualKeyCode: k.vk });
    }
  }

  // Mouse wheel at (x, y) (default: viewport centre). modifiers: ['Control'] for pinch-style zoom.
  async wheel(deltaY, { deltaX = 0, x, y, modifiers } = {}) {
    if (x === undefined || y === undefined) {
      const vp = await this.eval(() => [innerWidth / 2, innerHeight / 2]);
      x ??= vp[0]; y ??= vp[1];
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY, modifiers: modifierBits(modifiers) });
  }

  // One-finger swipe from [x, y] to [x, y]: native touch input, so an unprevented vertical swipe
  // scrolls the page. Touch emulation is switched on for the gesture when the page is not mobile.
  async touchSwipe(from, to, { steps = 10, duration = 300 } = {}) {
    await this.withTouch(async () => {
      await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1], id: 1 }] });
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        await this.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from[0] + (to[0] - from[0]) * k, y: from[1] + (to[1] - from[1]) * k, id: 1 }] });
        await sleep(duration / steps);
      }
      await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
  }

  // Two-finger pinch around [x, y] from one finger distance to another (zoom gestures).
  async pinch(center, fromDistance, toDistance, { steps = 10, duration = 300 } = {}) {
    const pts = (d) => [{ x: center[0] - d / 2, y: center[1], id: 1 }, { x: center[0] + d / 2, y: center[1], id: 2 }];
    await this.withTouch(async () => {
      await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(fromDistance) });
      for (let i = 1; i <= steps; i++) {
        await this.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(fromDistance + (toDistance - fromDistance) * (i / steps)) });
        await sleep(duration / steps);
      }
      await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
  }

  async withTouch(fn) {
    const temporary = !this.viewport?.mobile;
    if (temporary) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {});
    try { await fn(); } finally {
      if (temporary) await this.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
    }
  }

  // Answer requests whose URL matches `pattern` (a Fetch glob such as
  // 'https://api.chess.com/pub/player/*', or a RegExp) from `handler(request)`, which returns:
  //   undefined | 'continue'                      let the request through
  //   { status, headers, body, contentType, delay }   fulfil (body: string, Buffer or JSON value)
  //   { fail: 'Failed' | 'TimedOut' | 'ConnectionRefused' | ..., delay }   network error
  //   { hang: true }                              never answer (until the page closes)
  // Fulfilled answers get Access-Control-Allow-Origin: * unless the handler sets it, so fixtures
  // for other origins pass CORS. request = { url, method, headers, postData, resourceType }.
  // Resolves with an async function that removes the interception.
  // tools/site/fixtures/chess/index.mjs builds Chess.com handlers on this.
  async intercept(pattern, handler) {
    const entry = pattern instanceof RegExp
      ? { glob: '*', test: (u) => pattern.test(u), handler }
      : { glob: pattern, test: ((re) => (u) => re.test(u))(globToRegExp(pattern)), handler };
    this._intercepts.push(entry);
    await this._syncFetch();
    return async () => {
      this._intercepts = this._intercepts.filter((e) => e !== entry);
      if (!this.closed) await this._syncFetch();
    };
  }

  async _syncFetch() {
    if (!this._intercepts.length) { await this.send('Fetch.disable'); return; }
    const globs = [...new Set(this._intercepts.map((e) => e.glob))];
    await this.send('Fetch.enable', { patterns: globs.map((urlPattern) => ({ urlPattern, requestStage: 'Request' })) });
  }

  async _onPaused(params) {
    const { requestId, request, resourceType, networkId } = params;
    const entry = this._intercepts.find((e) => e.test(request.url));
    const send = (method, p) => this.send(method, { requestId, ...p }).catch((e) => { if (!this.closed) this.notes.push(redact(`${e.message} (${request.url})`)); });
    // Marks the page's request record, which may not exist yet.
    const mark = (how) => {
      if (!networkId) return;
      this._answered.set(networkId, how);
      const r = this._requests.get(networkId);
      if (r) r.intercepted = how;
    };
    if (!entry) return send('Fetch.continueRequest');
    let res;
    try {
      res = await entry.handler({ url: request.url, method: request.method, headers: request.headers, postData: request.postData, resourceType });
    } catch (e) {
      this.notes.push(`intercept handler threw for ${redact(request.url)}: ${e.message}`);
      return send('Fetch.failRequest', { errorReason: 'Failed' });
    }
    if (!res || res === 'continue') return send('Fetch.continueRequest');
    if (res.hang) return mark('hung');
    mark(res.fail ? 'failed' : 'fulfilled');
    if (res.delay) await sleep(res.delay);
    if (this.closed) return;
    if (res.fail) return send('Fetch.failRequest', { errorReason: res.fail });
    let body = res.body ?? '';
    const headers = { ...(res.headers || {}) };
    const lower = Object.fromEntries(Object.keys(headers).map((k) => [k.toLowerCase(), k]));
    if (typeof body !== 'string' && !Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
      body = JSON.stringify(body);
      if (!lower['content-type']) headers['Content-Type'] = 'application/json; charset=utf-8';
    }
    if (res.contentType && !lower['content-type']) headers['Content-Type'] = res.contentType;
    if (!lower['access-control-allow-origin']) headers['Access-Control-Allow-Origin'] = '*';
    const buf = Buffer.from(body);
    return send('Fetch.fulfillRequest', {
      responseCode: res.status ?? 200,
      responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value: String(value) })),
      body: buf.toString('base64'),
    });
  }

  // requestAnimationFrame intervals over `ms` (ends on a timer, so a hidden page returns 0 samples).
  async frameIntervals(ms = 2000) {
    const r = await this.eval((ms) => new Promise((resolve) => {
      const out = [];
      let last = null, done = false;
      const t0 = performance.now();
      const finish = () => { if (!done) { done = true; resolve({ intervals: out, ms: performance.now() - t0, visibility: document.visibilityState }); } };
      const tick = (t) => {
        if (done) return;
        if (last !== null) out.push(t - last);
        last = t;
        if (performance.now() - t0 < ms) requestAnimationFrame(tick); else finish();
      };
      requestAnimationFrame(tick);
      setTimeout(finish, ms + 500);
    }), ms);
    return { ...intervalStats(r.intervals), ms: Math.round(r.ms), visibility: r.visibility, intervals: r.intervals };
  }

  // Protocol performance counters, page timing (navigation, paint, LCP, CLS, long tasks) and the
  // world diagnostics snapshot (window.__world.metrics()) when the page has one.
  async metrics() {
    const { metrics } = await this.send('Performance.getMetrics');
    const perf = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
    const page = await this.eval(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
      const p = window.__cdp || {};
      let world = null;
      try { world = window.__world && typeof window.__world.metrics === 'function' ? window.__world.metrics() : null; } catch (e) { world = { error: String(e) }; }
      return {
        timeOrigin: performance.timeOrigin,
        nav: nav ? { responseStart: Math.round(nav.responseStart), domInteractive: Math.round(nav.domInteractive), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), type: nav.type } : null,
        paint,
        lcp: p.lcp ? { ...p.lcp, t: Math.round(p.lcp.t) } : null,
        cls: +(p.cls || 0).toFixed(4),
        longTasks: p.longTasks || 0,
        longTaskMs: Math.round(p.longTaskMs || 0),
        world: world ? JSON.parse(JSON.stringify(world)) : null,
      };
    });
    const world = page.world;
    delete page.world;
    return { perf, page, world };
  }

  async gc() { await this.send('HeapProfiler.collectGarbage').catch(() => {}); }

  // Console errors, uncaught exceptions, error-level browser logs, failed and HTTP-error requests.
  // External requests (blocked by the local-only resolver) are listed apart from local failures;
  // requests answered by intercept() count as fixtures, and their HTTP errors carry fixture: true.
  problems() {
    const reqs = this.requests;
    const isLocal = (u) => /^(https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/|data:|blob:|about:)/.test(u);
    // "Failed to load resource" entries repeat what the request lists below already say.
    const listed = new Set(reqs.filter((r) => r.failed || r.status >= 400).map((r) => r.url));
    return {
      consoleErrors: this.console.filter((c) => c.type === 'error' || c.type === 'assert').map((c) => ({ text: redact(c.text), at: redact(c.at) })),
      exceptions: this.errors.map((e) => ({ text: redact(e.text), url: redact(e.url), line: e.line })),
      logErrors: this.logs.filter((l) => l.level === 'error' && !(l.source === 'network' && listed.has(l.url) && /^Failed to load resource/.test(l.text)))
        .map((l) => ({ source: l.source, text: redact(l.text), url: redact(l.url) })),
      failedRequests: reqs.filter((r) => r.failed && !r.canceled && r.blockedReason !== 'inspector' && !r.intercepted && isLocal(r.url)).map((r) => ({ url: redact(r.url), type: r.type, error: r.failed, blocked: r.blockedReason })),
      blockedByTest: reqs.filter((r) => r.blockedReason === 'inspector').length,
      httpErrors: reqs.filter((r) => r.status >= 400).map((r) => ({ url: redact(r.url), type: r.type, status: r.status, ...(r.intercepted ? { fixture: true } : {}) })),
      external: [...new Set(reqs.filter((r) => !isLocal(r.url) && !r.intercepted).map((r) => redact(r.url)))],
      fixtures: reqs.filter((r) => r.intercepted).length,
    };
  }

  // document.visibilityState 'hidden' (rAF stops, timers throttle), as when the visitor switches
  // tabs. Focus emulation pins a page 'visible'; it must be off, then another tab goes in front.
  async hide() {
    this.hidden = true;
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {});
    await this.browser.bringSpareToFront(this.contextId);
  }

  async show() {
    await this.conn.send('Target.activateTarget', { targetId: this.targetId }).catch(() => {});
    await this.send('Page.bringToFront').catch(() => {});
    if (this.hidden) {
      this.hidden = false;
      await this.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this._off();
    await this.conn.send('Target.closeTarget', { targetId: this.targetId }, undefined, { timeout: 5000 }).catch(() => {});
    if (this.contextId) await this.browser.disposeContext(this.contextId);
    this.browser.pages.delete(this);
  }
}

function modifierBits(list) {
  if (!list) return 0;
  return (Array.isArray(list) ? list : [list]).reduce((bits, m) => bits | (MODIFIERS[m] || 0), 0);
}

function formatRemote(a) {
  if (a.type === 'string') return a.value;
  if (a.value !== undefined) return JSON.stringify(a.value);
  if (a.unserializableValue) return a.unserializableValue;
  if (a.preview?.properties) return `${a.description || a.className}{${a.preview.properties.map((p) => `${p.name}: ${p.value}`).join(', ')}${a.preview.overflow ? ', …' : ''}}`;
  return a.description || a.type;
}

function pngSize(buf) {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  return {};
}

// ---------------------------------------------------------------------------------------------
// Browser.
// ---------------------------------------------------------------------------------------------
const live = new Set();
let hooked = false;
const OWNER_FILE = 'cdp-owner.json';

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// Profiles left behind by a killed run (SIGKILL leaves no chance to clean up): removed when
// neither the Node process nor the Chrome that used them is still running.
function sweepProfiles(root) {
  let names = [];
  try { names = fs.readdirSync(root).filter((n) => n.startsWith('cdp-profile-')); } catch { return; }
  for (const name of names) {
    const dir = path.join(root, name);
    try {
      const owner = JSON.parse(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8'));
      if (!alive(owner.node) && !alive(owner.chrome)) fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* not ours, or in use */ }
  }
}

function hookProcess() {
  if (hooked) return;
  hooked = true;
  process.on('exit', () => { for (const b of live) b.kill(); });
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
    process.once(sig, () => { for (const b of live) b.kill(); process.exit(code); });
  }
}

// Launches Chrome. Options:
//   preset      'gpu' | 'swiftshader' | 'nowebgl' | 'none'      (default 'gpu')
//   headless    true | false                                     (default true)
//   localOnly   only 127.0.0.1 and localhost resolve             (default true)
//   args        extra Chrome flags
//   profileRoot directory for the temporary profile             (default $CDP_PROFILE_ROOT or the OS temp dir)
//   timeout     default page timeout in ms                       (default 30000)
//   handleSignals  kill Chrome on SIGINT/SIGTERM/SIGHUP          (default true)
//   batterySaver   allow Chrome's battery saver, which caps frames at 30 per second on battery
//                  below 20 % or in macOS Low Power Mode           (default false: off, for stable timings)
export async function launch({
  preset = 'gpu',
  headless = true,
  localOnly = true,
  args = [],
  chrome = findChrome(),
  profileRoot = process.env.CDP_PROFILE_ROOT || os.tmpdir(),
  keepProfile = false,
  timeout = 30000,
  windowSize = [1280, 800],
  handleSignals = true,
  batterySaver = false,
} = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset ${preset} (${Object.keys(PRESETS).join(', ')})`);
  const t0 = performance.now();
  fs.mkdirSync(profileRoot, { recursive: true });
  sweepProfiles(profileRoot);
  const userDataDir = fs.mkdtempSync(path.join(profileRoot, 'cdp-profile-'));
  // Browser-wide preferences live in "Local State"; state 0 switches battery saver off.
  if (!batterySaver) fs.writeFileSync(path.join(userDataDir, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } }));
  const flags = [
    ...(headless ? ['--headless=new'] : []),
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-pipe',
    `--window-size=${windowSize[0]},${windowSize[1]}`,
    ...BASE_FLAGS,
    ...PRESETS[preset],
    ...(localOnly ? [LOCAL_ONLY] : []),
    ...args,
    'about:blank',
  ];
  // Own process group, so close() can reap the GPU and renderer helpers with it.
  const child = spawn(chrome, flags, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], detached: true });
  if (!keepProfile) { try { fs.writeFileSync(path.join(userDataDir, OWNER_FILE), JSON.stringify({ node: process.pid, chrome: child.pid })); } catch {} }
  let stderr = '';
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-20000); });
  let exited = null;
  const exitedPromise = new Promise((resolve) => child.on('exit', (code, signal) => { exited = { code, signal }; resolve(exited); }));
  child.on('error', (e) => { exited = { error: e.message }; });
  const conn = new Connection(child.stdio[3], child.stdio[4]);

  const browser = {
    pid: child.pid, userDataDir, flags, preset, batterySaver, conn, pages: new Set(), spares: new Map(),
    get stderr() { return stderr; },
    get exited() { return exited; },
    version: null,
    launchMs: 0,

    // GPU as Chrome reports it (SystemInfo.getInfo): renderer string, feature status, model.
    async gpu() {
      const info = await conn.send('SystemInfo.getInfo');
      const g = info.gpu;
      const aux = g.auxAttributes || {};
      return {
        renderer: aux.glRenderer || null,
        vendor: aux.glVendor || null,
        devices: g.devices.map((d) => [d.vendorString, d.deviceString].filter(Boolean).join(' ')).filter(Boolean),
        webgl: g.featureStatus?.webgl2 || g.featureStatus?.webgl || null,
        featureStatus: g.featureStatus,
        modelName: info.modelName,
      };
    },

    // Opens a tab. Options: width, height, deviceScaleFactor, mobile, zoom, textZoom, reducedMotion,
    // colorScheme, javaScript, network { latencyMs, downKbps, upKbps, offline }, cpuThrottle,
    // blockUrls, cache (false disables the HTTP cache), init (scripts run before page scripts),
    // isolate (own browser context: empty storage and cache, like a fresh incognito window), timeout.
    async newPage(o = {}) {
      let contextId = null;
      if (o.isolate) ({ browserContextId: contextId } = await conn.send('Target.createBrowserContext', { disposeOnDetach: true }));
      // Background tabs can later be hidden; show() below brings this one to the front.
      const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank', background: true, ...(contextId ? { browserContextId: contextId } : {}) });
      const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(browser, sessionId, targetId, { timeout: o.timeout ?? timeout, contextId });
      browser.pages.add(page);
      try {
        await page.setup(o);
        await page.show();
      } catch (e) {
        await page.close();
        throw e;
      }
      return page;
    },

    // An about:blank tab per browser context (the launch tab for the default one) that hide()
    // brings in front of the page being hidden.
    async bringSpareToFront(contextId = null) {
      let spare = browser.spares.get(contextId);
      if (!spare) {
        let targetId;
        if (!contextId) {
          const { targetInfos } = await conn.send('Target.getTargets');
          targetId = targetInfos.find((t) => t.type === 'page' && t.url === 'about:blank' && ![...browser.pages].some((p) => p.targetId === t.targetId))?.targetId;
        }
        targetId ??= (await conn.send('Target.createTarget', { url: 'about:blank', ...(contextId ? { browserContextId: contextId } : {}) })).targetId;
        const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
        spare = { targetId, sessionId };
        browser.spares.set(contextId, spare);
      }
      await conn.send('Target.activateTarget', { targetId: spare.targetId }).catch(() => {});
      await conn.send('Page.bringToFront', {}, spare.sessionId);
    },

    async disposeContext(contextId) {
      browser.spares.delete(contextId);
      await conn.send('Target.disposeBrowserContext', { browserContextId: contextId }, undefined, { timeout: 5000 }).catch(() => {});
    },

    // Synchronous last resort used on process exit.
    kill() {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      if (!keepProfile) { try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 }); } catch {} }
      live.delete(browser);
    },

    async close() {
      if (!live.has(browser)) return;
      live.delete(browser);
      for (const p of browser.pages) p.closed = true;
      await Promise.race([conn.send('Browser.close', {}, undefined, { timeout: 3000 }).catch(() => {}), sleep(3000)]);
      await Promise.race([exitedPromise, sleep(2000)]);
      if (!exited) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
      await Promise.race([exitedPromise, sleep(2000)]);
      // Reap anything left in the group (helpers outlive the browser process for a moment).
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      conn.shut('browser closed');
      if (!keepProfile) {
        for (let i = 0; i < 10; i++) {
          try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; } catch { await sleep(200); }
        }
      }
    },
  };
  live.add(browser);
  if (handleSignals) hookProcess();

  try {
    browser.version = await Promise.race([
      conn.send('Browser.getVersion', {}, undefined, { timeout }),
      exitedPromise.then((x) => { throw new Error(`Chrome exited during launch ${JSON.stringify(x)}\n${stderr}`); }),
    ]);
  } catch (e) {
    await browser.close();
    throw e;
  }
  browser.launchMs = Math.round(performance.now() - t0);
  return browser;
}

// Opens a browser, runs fn(browser) and always closes it.
export async function withBrowser(options, fn) {
  const browser = await launch(options);
  try { return await fn(browser); } finally { await browser.close(); }
}

// Machine label for reports: model, CPU, memory, OS, power source.
export function machineInfo() {
  let model = null, osName = `${os.type()} ${os.release()}`;
  if (process.platform === 'darwin') {
    try { model = execFileSync('sysctl', ['-n', 'hw.model'], { encoding: 'utf8' }).trim(); } catch {}
    try { osName = `macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()}`; } catch {}
  }
  return {
    model,
    cpu: os.cpus()[0]?.model || null,
    cores: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 2 ** 30),
    os: osName,
    node: process.version,
    power: powerInfo(),
  };
}

// macOS power state: battery or mains, charge, Low Power Mode (slower CPU and GPU clocks).
export function powerInfo() {
  if (process.platform !== 'darwin') return null;
  const out = { source: null, batteryPercent: null, lowPowerMode: null };
  try {
    const batt = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' });
    out.source = /'AC Power'/.test(batt) ? 'mains' : /'Battery Power'/.test(batt) ? 'battery' : null;
    const pct = /(\d+)%/.exec(batt);
    if (pct) out.batteryPercent = +pct[1];
  } catch {}
  try {
    const g = execFileSync('pmset', ['-g'], { encoding: 'utf8' });
    const m = /^\s*(?:lowpowermode|powermode)\s+(\d+)/m.exec(g);
    if (m) out.lowPowerMode = m[1] !== '0';
  } catch {}
  return out;
}

// The browser's frame interval on an empty page: about 16.7 ms when frames follow a 60 Hz clock;
// 33.3 ms means something caps the frame rate (battery saver, a throttled host).
export async function baseFrameInterval(browser) {
  const page = await browser.newPage({ width: 800, height: 600, isolate: true });
  try {
    await page.goto('about:blank');
    return (await page.frameIntervals(1000)).median;
  } finally { await page.close(); }
}

// WebGL renderer string as the page sees it (UNMASKED_RENDERER_WEBGL), or null without WebGL.
export function webglInfo(page) {
  return page.eval(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const info = {
      webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return info;
  });
}

// The routed pages: static/cinema/destinations.json (home, the five destinations, the résumé), or
// the fixed table. → [{ page, region, url }] in navigation order, one per URL.
export const ROUTES = [
  { page: 'home', region: 'home', url: '/' },
  { page: 'chess', region: 'chess', url: '/chess/chess.html' },
  { page: 'racing', region: 'racing', url: '/athletics/athletics.html' },
  { page: 'coding', region: 'coding', url: '/coding%20projects/projects.html' },
  { page: 'mountains', region: 'mountains', url: '/image%20portfolio/gallery.html' },
  { page: 'about', region: 'about', url: '/about/' },
  { page: 'resume', region: 'resume', url: '/resume/resume.html' },
];

export function siteRoutes(root = REPO_ROOT) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(root, 'static', 'cinema', 'destinations.json'), 'utf8'));
    const list = [
      ...(reg.pages || []).filter((p) => p.id === 'home').map((p) => ({ page: p.id, region: p.id, url: p.url })),
      ...(reg.destinations || []).map((d) => ({ page: d.id, region: d.id, url: d.url })),
      ...(reg.pages || []).filter((p) => p.id !== 'home').map((p) => ({ page: p.id, region: p.id, url: p.url })),
    ];
    if (list.length) return { source: 'static/cinema/destinations.json', routes: list };
  } catch { /* no registry yet */ }
  return { source: 'built-in table', routes: ROUTES };
}

// File-name slug for a route: the page key when known, else the path ('/x/y.html#z' → 'x-y-z').
export function routeSlug(route, routes = ROUTES) {
  const u = new URL(route, 'http://local');
  const known = routes.find((r) => decodeURIComponent(new URL(r.url, 'http://local').pathname) === decodeURIComponent(u.pathname));
  const base = known ? known.page : decodeURIComponent(u.pathname).replace(/\.html?$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'home';
  const extra = (u.search + u.hash).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return extra ? `${base}-${extra}` : base;
}

// Labels every report: where and how it was measured. Pass a page to include the WebGL renderer
// string as pages see it; { frameRate: true } also measures the browser's own frame interval.
export async function environment(browser, page, { frameRate = false } = {}) {
  let gpu = null, webgl = null;
  try { gpu = await browser.gpu(); } catch { /* older Chrome */ }
  if (page) { try { webgl = await webglInfo(page); } catch { /* JavaScript off */ } }
  return {
    machine: machineInfo(),
    chrome: browser.version?.product || null,
    preset: browser.preset,
    gpuRenderer: gpu?.renderer || null,
    webglRenderer: webgl ? webgl.renderer : null,
    webgl2: webgl ? webgl.webgl2 : false,
    ...(frameRate ? { baseFrameMs: await baseFrameInterval(browser).catch(() => null) } : {}),
    batterySaver: !!browser.batterySaver,
    note: 'headless browser measurement, not a physical device',
    at: new Date().toISOString(),
  };
}

// The world diagnostics snapshot (design/world/architecture.md §11), or null when the page has
// no window.__world.
export function worldMetrics(page) {
  return page.eval(() => {
    try {
      const w = window.__world;
      return w && typeof w.metrics === 'function' ? JSON.parse(JSON.stringify(w.metrics())) : null;
    } catch (e) { return { error: String(e) }; }
  });
}

// Waits until the 3D stage has settled, as far as the page can tell. The shell mirrors its state
// on section[data-world][data-world-state] (poster → loading → ready | fallback | off, with
// data-world-reason); window.__world.metrics() says what the world itself has loaded.
//   'ready'     the world is available, not travelling, no region detail still loading, and the
//               active region's detail and hotspots have settled (a failed detail counts: the world
//               keeps its far silhouette and says so in metrics.details)
//   'fallback'  the fallback panel shows (reason: no-webgl, context-lost, failed, off, save-data)
//   'none'      the page has no [data-world] stage
//   'offscreen' the stage still shows its poster and is not near the viewport (the shell boots the
//               world lazily, e.g. after a fragment scrolled the page down), for over 1.5 s
//   'timeout'   none of the above within `timeout` ms; stageState tells where it stopped
// Resolves with { state, reason, stageState, ms, metrics }. Two animation frames pass after 'ready'.
export async function waitForWorld(page, { timeout = 20000, interval = 100, settle = true } = {}) {
  const t0 = performance.now();
  const probe = () => {
    const stage = document.querySelector('[data-world]');
    const fallback = document.querySelector('[data-world-fallback]');
    const box = stage?.getBoundingClientRect();
    // The shell's IntersectionObserver uses a 50% root margin.
    const near = !!box && box.bottom >= -0.5 * innerHeight && box.top <= 1.5 * innerHeight;
    let m = null;
    try { m = window.__world && typeof window.__world.metrics === 'function' ? JSON.parse(JSON.stringify(window.__world.metrics())) : null; } catch (e) { m = { error: String(e) }; }
    const shown = !!fallback && !fallback.hidden && getComputedStyle(fallback).display !== 'none';
    const ms = m?.milestones || {};
    const details = m?.details || {};
    const states = Object.values(details);
    const regionDone = ms.region != null || ['ready', 'failed', 'error'].includes(details[m?.region]);
    return {
      stage: !!stage,
      stageState: stage?.dataset.worldState || null,
      reason: stage?.dataset.worldReason || null,
      near,
      fallback: shown,
      available: m?.available ?? null,
      loaded: ms.hotspots != null || regionDone,
      loading: states.includes('loading'),
      travelling: !!m?.travelling,
      metrics: m,
    };
  };
  let last = null, away = null;
  for (;;) {
    try { last = await page.eval(probe); } catch { last = null; } // e.g. a navigation in progress
    const ms = Math.round(performance.now() - t0);
    if (last) {
      const base = { reason: last.reason, stageState: last.stageState };
      if (!last.stage) return { state: 'none', ...base, ms, metrics: last.metrics };
      away = last.stageState === 'poster' && !last.near ? away ?? ms : null;
      if (away !== null && ms - away > 1500) return { state: 'offscreen', ...base, ms, metrics: last.metrics };
      if (last.fallback || last.stageState === 'fallback' || last.stageState === 'off' || last.available === false) {
        return { state: 'fallback', ...base, reason: last.reason || (last.stageState === 'off' ? 'off' : null), ms, metrics: last.metrics };
      }
      const up = last.stageState ? last.stageState === 'ready' : last.available === true; // the lab has no shell state
      if (up && last.loaded && (!settle || (!last.travelling && !last.loading))) {
        await page.eval(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
        return { state: 'ready', ...base, ms: Math.round(performance.now() - t0), metrics: await worldMetrics(page).catch(() => last.metrics) };
      }
    }
    if (ms > timeout) return { state: 'timeout', reason: last?.reason ?? null, stageState: last?.stageState ?? null, ms, metrics: last?.metrics ?? null };
    await sleep(interval);
  }
}

// "1440x900", "390x844@3" → { width, height, deviceScaleFactor?, mobile }. Narrow sides (≤ 500 px)
// are treated as phones: touch emulation and mobile viewport, DPR 3 unless given.
export function parseSize(text, { dpr } = {}) {
  const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(text.trim());
  if (!m) throw new Error(`bad size ${text} (expected WIDTHxHEIGHT or WIDTHxHEIGHT@DPR)`);
  const width = +m[1], height = +m[2];
  const mobile = Math.min(width, height) <= 500;
  return { width, height, mobile, deviceScaleFactor: m[3] ? +m[3] : dpr ?? (mobile ? 3 : 1), label: `${width}x${height}` };
}

// ---------------------------------------------------------------------------------------------
// CLI: one page, a few evaluations, an optional screenshot, a JSON summary on stdout.
// ---------------------------------------------------------------------------------------------
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      size: { type: 'string', default: '1440x900' },
      preset: { type: 'string', default: 'gpu' },
      eval: { type: 'string', multiple: true, default: [] },
      init: { type: 'string', multiple: true, default: [] },
      shot: { type: 'string' },
      'full-page': { type: 'boolean', default: false },
      'reduced-motion': { type: 'boolean', default: false },
      'no-js': { type: 'boolean', default: false },
      chess: { type: 'string' },
      wait: { type: 'string', default: '0' },
      timeout: { type: 'string', default: '30000' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const url = positionals[0];
  if (values.help || !url) {
    console.log('usage: node tools/site/cdp.mjs URL [--size 1440x900[@dpr]] [--preset gpu|swiftshader|nowebgl] [--eval EXPR]... [--init JS]...\n'
      + '         [--shot FILE] [--full-page] [--reduced-motion] [--no-js] [--chess SCENARIO] [--wait MS] [--timeout MS]');
    return;
  }
  const out = { url: redact(url) };
  await withBrowser({ preset: values.preset, timeout: +values.timeout }, async (browser) => {
    out.chrome = browser.version.product;
    const page = await browser.newPage({ ...parseSize(values.size), reducedMotion: values['reduced-motion'], javaScript: !values['no-js'], init: values.init });
    const chess = values.chess ? await (await import('./fixtures/chess/index.mjs')).useChessFixtures(page, values.chess) : null;
    const nav = await page.goto(url);
    if (+values.wait) await sleep(+values.wait);
    out.status = nav.status;
    out.loadMs = nav.ms;
    out.title = await page.eval('document.title');
    out.webgl = values['no-js'] ? null : await webglInfo(page).catch(() => null);
    out.evals = [];
    for (const expr of values.eval) {
      try { out.evals.push({ expr, value: await page.eval(expr) }); } catch (e) { out.evals.push({ expr, error: e.message }); }
    }
    if (values.shot) {
      const s = await page.screenshot(values.shot, { fullPage: values['full-page'] });
      out.shot = { file: s.file, width: s.width, height: s.height, bytes: s.bytes };
    }
    out.problems = page.problems();
    if (chess) out.chess = { scenario: chess.scenario, calls: chess.calls };
  });
  console.log(JSON.stringify(out, (k, v) => (typeof v === 'string' ? redact(v) : v), 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(redact(e.stack || String(e))); process.exit(1); });
}
