// Photography → Chess (glsl/plume.js): the tile's own pictures, for the transition that builds its board.
//   The atlas: the six silhouettes (the page's #sK … #sP paths, placed as their symbols place them), each
//   as a signed distance (ink-plan.js signedBytes), side by side; on unit 9.
//   The board: the tile's card and board as the tile draws them, laid out at the starting position: a
//   copy of its SVG with the page's piece symbols and its own fills written in, drawn as an image at the
//   card's size in device pixels; on unit 10, mipmapped. Made again when the card's size changes.
import { SHAPES, GLYPH, signedBytes } from './ink-plan.js';
import { startMarkup } from '../previews.js';

export function createInkResources(gl) {
  let atlas = null, board = null, key = null, asked = null, dead = false;
  const params = (t, filter) => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  function buildAtlas() {
    const C = GLYPH.cell, w = C * SHAPES.length;
    if (!document.getElementById('sK')) return false;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = C;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    [...SHAPES].forEach((ch, i) => {
      const d = document.getElementById(`s${ch}`)?.getAttribute('d');
      const tr = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(document.querySelector(`#w${ch} > g`)?.getAttribute('transform') || '');
      if (!d) return;
      ctx.setTransform(C / 45, 0, 0, C / 45, i * C + (tr ? +tr[1] : 0) * C / 45, (tr ? +tr[2] : 0) * C / 45);
      ctx.fill(new Path2D(d));
    });
    const img = ctx.getImageData(0, 0, w, C).data, out = new Uint8Array(w * C), a = new Uint8Array(C * C);
    for (let i = 0; i < SHAPES.length; i++) {
      for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) a[y * C + x] = img[(y * w + i * C + x) * 4 + 3];
      const s = signedBytes(a, C, C, GLYPH.range);
      for (let y = 0; y < C; y++) out.set(s.subarray(y * C, (y + 1) * C), y * w + i * C);
    }
    atlas = gl.createTexture();
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, C, 0, gl.RED, gl.UNSIGNED_BYTE, out);
    params(atlas, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    return true;
  }
  // The card (el: .pv-board-wrap) as an SVG of its own: its ground, then the board with its fills as
  // the page styles them, its wash filter, and the pieces at the start.
  function boardSvg(el, dpr) {
    const svg = el.querySelector('svg.pv-board'), sprite = document.getElementById('sK')?.closest('svg');
    if (!svg || !sprite) return null;
    const W = el.offsetWidth, H = el.offsetHeight, cs = getComputedStyle(el), pad = parseFloat(cs.paddingLeft) || 0;
    const xs = new XMLSerializer(), ser = n => xs.serializeToString(n);
    const paint = e => { const c = getComputedStyle(e); return `fill="${c.fill}" fill-opacity="${c.fillOpacity}" stroke="${c.stroke}" stroke-width="${c.strokeWidth}" stroke-linejoin="${c.strokeLinejoin}"`; };
    const dark = svg.querySelector('.pv-sq-dark'), filter = svg.querySelector('defs');
    const inner = `${filter ? ser(filter) : ''}<rect width="360" height="360" ${paint(svg.querySelector('.pv-sq-light'))}/>`
      + `<path d="${dark.getAttribute('d')}" filter="url(#pv-wash)" ${paint(dark)}/>`
      + `<rect x="1" y="1" width="358" height="358" filter="url(#pv-wash)" ${paint(svg.querySelector('.pv-edge'))}/>${startMarkup('', true)}`;
    return { W, H, pad, src: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(W * dpr)}" height="${Math.round(H * dpr)}" viewBox="0 0 ${W} ${H}">`
      + [...sprite.children].map(ser).join('')
      + `<rect width="${W}" height="${H}" fill="${cs.backgroundColor}"/><svg x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" viewBox="0 0 360 360" overflow="visible">${inner}</svg></svg>` };
  }
  async function buildBoard(el, dpr, k) {
    const made = boardSvg(el, dpr);
    if (!made) { asked = null; return; }
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(made.src)}`;
    try { await img.decode(); } catch (e) { console.warn('The chess board\'s picture did not draw; its seam stays plain.', e); return; }
    if (dead || gl.isContextLost() || asked !== k) return;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(made.W * dpr)); cv.height = Math.max(1, Math.round(made.H * dpr));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    if (board) gl.deleteTexture(board);
    board = gl.createTexture();
    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, board);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    params(board, gl.LINEAR_MIPMAP_LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    key = k;
  }
  // The card is drawn again whenever its size changes (its ratings arriving beside it, a resize), a
  // moment after it settles: so it is ready long before its transition, not made as that begins.
  let watched = null, watcher = null, settle = 0;
  function watch(el) {
    if (watched === el || typeof ResizeObserver === 'undefined') return;
    watcher?.disconnect();
    watched = el;
    watcher = new ResizeObserver(() => { clearTimeout(settle); settle = setTimeout(() => { if (!dead && el.isConnected) api.request(el); }, 250); });
    watcher.observe(el);
  }
  const api = {
    // Ask for them, for the tile's card as it is now (once a size; ready some time later).
    request(el = document.querySelector('.band--chess .pv-board-wrap'), dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (dead || !el || !el.offsetWidth) return;
      if (!atlas && !buildAtlas()) return;
      watch(el);
      const k = `${el.offsetWidth} ${el.offsetHeight} ${dpr}`;
      if (k === key || k === asked) return;
      asked = k;
      buildBoard(el, dpr, k);
    },
    ready: () => !!atlas && !!board,
    // The atlas on unit 9 and the board on 10; false until both are in.
    bind() {
      if (!atlas || !board) return false;
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, board);
      gl.activeTexture(gl.TEXTURE0);
      return true;
    },
    unbind() { for (const u of [gl.TEXTURE9, gl.TEXTURE10]) { gl.activeTexture(u); gl.bindTexture(gl.TEXTURE_2D, null); } gl.activeTexture(gl.TEXTURE0); },
    dispose() { dead = true; clearTimeout(settle); watcher?.disconnect(); watcher = watched = null; if (atlas) gl.deleteTexture(atlas); if (board) gl.deleteTexture(board); atlas = board = key = asked = null; },
  };
  return api;
}
