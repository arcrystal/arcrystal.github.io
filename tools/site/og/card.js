// The share card for one page, drawn in that page's style: its name in the style's display face,
// its line, and on the right the process its transition is built on, drawn here in SVG (the maze,
// the vortex, the supernovae's gas gathered into drops and pulled as shards into Racing's card, the White Mountains leaded into art glass, fire becoming memory, ink gathering into the board). The
// homepage gets the crystal, one facet per destination. Everything is seeded, so a card only
// changes when its words or this file do. Sets <html data-ready> once the fonts are in.
import { carveMaze } from '/static/site/lerp.js';
import { makeDewPlan, radiusAt, liveAt } from '/static/site/scene/dew-plan.js';
import { landform, PEAKS48, PEMI } from '/static/site/scene/terrain-plan.js';
import { GLASS, REDS, JEWELS, leadCell } from '/static/site/scene/glsl/folio.js';
import { PALETTE } from '/static/site/scene/palette.js';
import { BOARD, DETAIL, FOOT, SQ, SR, TALL, TYPES, bodyOf, frameCamera, halfWidth, headOf, project, startSlots, toR, toY, worldOf } from '/static/site/scene/staunton.js';

const W = 1200, H = 630;
const id = new URLSearchParams(location.search).get('id') || 'home';
const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
const html = u => fetch(u).then(r => r.text()).then(t => new DOMParser().parseFromString(t, 'text/html'));
const [reg, { styles }] = await Promise.all([json('/static/site/destinations.json'), json('/static/site/styles.json')]);

// The faces each style sets its titles in (static/site/styles/*.css), sized for the card.
const TYPE = {
  house: { display: "'DM Sans'", weight: 700, track: '-0.045em', label: "'DM Sans'", size: 128 },
  ink: { display: "'Shippori Mincho'", weight: 800, track: '0em', label: "'DM Sans'", size: 118 },
  glass: { display: "'DM Sans'", weight: 720, track: '-0.055em', label: "'JetBrains Mono'", size: 134 },
  cosmos: { display: "'Unbounded'", weight: 600, track: '-0.03em', label: "'JetBrains Mono'", size: 96, upper: true },
  folio: { display: "'Cormorant'", weight: 500, track: '-0.01em', label: "'Cormorant'", size: 156, italic: true },
  darkroom: { display: "'DM Sans'", weight: 300, track: '-0.05em', label: "'JetBrains Mono'", size: 138 },
};
// What each style's transition is made of (the homepage's hold captions say the same).
const PROCESS = {
  house: 'A maze carved depth-first', cosmos: 'A vortex', glass: 'Stardust, then frost',
  folio: 'The mountains rise', darkroom: 'Fire becoming memory', ink: 'Ink finding order',
};

const PAGES = {
  home: { title: 'Alex Crystal', style: 'house', art: 'crystal', kicker: 'arcrystal.github.io' },
  resume: { title: 'Résumé', style: 'house', art: 'maze', url: '/resume/resume.html', pick: d => d.querySelector('.d-lede')?.textContent },
  timeline: { title: 'The AI Power Map', style: 'house', art: 'timeline', url: '/ai-timeline/', kicker: 'Alex Crystal <span aria-hidden="true">·</span> <b>2021 – 2026</b>', pick: d => d.querySelector('meta[property="og:description"]')?.content },
};
for (const d of reg.destinations) PAGES[d.id] = { title: d.title, style: d.style, art: d.style === 'house' ? 'maze' : d.style, dir: d.dir };

const P = PAGES[id];
if (!P) throw new Error(`no card "${id}"`);
const S = styles[P.style], C = S.colors, T = TYPE[P.style], COL = C, C_INK = C.ink;

let line;
if (P.dir) line = (await json(`/${encodeURI(P.dir)}/page/meta.json`)).line;
else if (P.url) line = P.pick(await html(P.url));
else {
  const d = (await html('/')).querySelector('meta[name="description"]').content.replace(/^Alex Crystal\s*—\s*/, '');
  line = d[0].toUpperCase() + d.slice(1);
}

// ---- helpers ----
const f = x => +x.toFixed(1);
const rng = seed => { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; };
const rgbOf = hex => { const n = parseInt(hex.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(' ')})`; };
const hexA = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${a})`; };
// Fades a drawing out toward the words on the left.
const fade = (from = 520, to = 780) => `<linearGradient id="fadeG" x1="${from}" x2="${to}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="fade"><rect width="${W}" height="${H}" fill="url(#fadeG)"/></mask>`;

// ---- the processes ----
const ART = {};

// About Me, Résumé: a maze carved by depth-first backtracking (lerp.js carveMaze, as the transition
// uses). Each corridor is drawn from the cell it was carved from; the earliest are darkest.
ART.maze = () => {
  const cell = 27, cols = 25, rows = 24, x0 = W - cols * cell + 8, y0 = (H - rows * cell) / 2;
  const { order, from } = carveMaze(cols, rows, [cols - 1, rows >> 1], id === 'resume' ? 23 : 7);
  const N = cols * rows, back = { 1: [-1, 0], 2: [1, 0], 3: [0, -1], 4: [0, 1] };
  const cx = c => x0 + (c + 0.5) * cell, cy = r => y0 + (r + 0.5) * cell;
  let paths = '', head = 0;
  for (let i = 0; i < N; i++) {
    if (order[i] === N - 1) head = i;
    if (!from[i]) continue;
    const c = i % cols, r = (i / cols) | 0, [dc, dr] = back[from[i]];
    paths += `<path d="M${f(cx(c + dc))} ${f(cy(r + dr))}L${f(cx(c))} ${f(cy(r))}" stroke="${mix(C.bg, C.ink, 0.9 - 0.72 * order[i] / N)}"/>`;
  }
  const hc = head % cols, hr = (head / cols) | 0;
  return `<defs>${fade(560, 820)}</defs>
  <g mask="url(#fade)"><g fill="none" stroke-width="${f(cell * 0.4)}" stroke-linecap="square">${paths}</g>
  <circle cx="${f(cx(hc))}" cy="${f(cy(hr))}" r="${f(cell * 0.5)}" fill="none" stroke="${C.ink}" stroke-width="2.5"/></g>`;
};

// Science: the vortex its transition rides (after the Burgers vortex, scene/glsl/flight.js vortexAt):
// streamlines spiralling in to an upright axis, turning faster as they close in (teal, blue, orange
// at the core), stretched along it, with a few cubes riding them. Drawn far side first.
ART.cosmos = () => {
  const r = rng(11), C = [930, 315], SPIN = 2.5, TILT = 0.42;
  const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const turn = u => (u * (1 + SPIN / 2) - SPIN * Math.sin(2 * Math.PI * u) / (4 * Math.PI)) / (1 + SPIN / 2);
  const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Science's palette (scene/palette.js): its teal, a deeper teal-blue, its gold.
  const TEAL = [63, 220, 210], BLUE = [58, 150, 182], ORANGE = [245, 180, 81];
  const hue = s => s < 0.55 ? lerp3(TEAL, BLUE, sm((s - 0.1) / 0.45)) : lerp3(BLUE, ORANGE, sm((s - 0.55) / 0.4));
  const css = (c, a = 1) => `rgb(${c.map(Math.round).join(' ')} / ${a})`;
  const at = (hx, hy, rc, turns, u) => {
    const r0 = hx - C[0], k = sm(Math.sin(Math.PI * u));
    const rad = r0 + (Math.sign(r0) * Math.min(Math.abs(r0), rc) - r0) * k ** 1.7;
    const th = turns * Math.PI * turn(u), tilt = TILT * sm(k / 0.4);
    const yl = (hy - C[1]) * (1 + 0.7 * k), X = rad * Math.cos(th), Z = rad * Math.sin(th);
    const y = yl * Math.cos(tilt) + Z * Math.sin(tilt), z = Z * Math.cos(tilt) - yl * Math.sin(tilt);
    const s = 1100 / (1100 - Math.min(z, 600));
    return [C[0] + X * s, C[1] + y * s, z, s];
  };
  const segs = [];
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1, hx = C[0] + side * (30 + 300 * Math.sqrt(r())), hy = C[1] + (r() - 0.5) * 300;
    const rc = 14 + 46 * r(), turns = r() < 0.5 ? 3 : 1, u1 = 0.36 + 0.3 * r();
    let prev = at(hx, hy, rc, turns, 0.02);
    for (let j = 1; j <= 56; j++) {
      const u = 0.02 + (u1 - 0.02) * j / 56, p = at(hx, hy, rc, turns, u), spin = Math.sin(Math.PI * u) ** 2;
      segs.push({ z: (prev[2] + p[2]) / 2, d: `M${f(prev[0])} ${f(prev[1])}L${f(p[0])} ${f(p[1])}`, c: hue(spin), w: (2.8 - 1.9 * spin) * p[3], a: 0.35 + 0.6 * j / 56 });
      prev = p;
    }
    // A cube riding the line, at its head.
    if (i % 3 === 0) {
      const s = 7 * prev[3];
      segs.push({ z: prev[2] + 1, cube: `<rect x="${f(prev[0] - s / 2)}" y="${f(prev[1] - s / 2)}" width="${f(s)}" height="${f(s)}" transform="rotate(${f(r() * 90)} ${f(prev[0])} ${f(prev[1])})" fill="${css(hue(Math.sin(Math.PI * u1) ** 2))}" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/>` });
    }
  }
  segs.sort((a, b) => a.z - b.z);
  const lines = segs.map(g => g.cube || `<path d="${g.d}" stroke="${css(g.c, f(g.a * (g.z < 0 ? 0.7 : 1)))}" stroke-width="${f(g.w)}"/>`).join('');
  let stars = '';
  for (let i = 0; i < 170; i++) stars += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(0.4 + r() * r() * 1.6)}" fill="${C_INK}" fill-opacity="${f(0.25 + r() * 0.6)}"/>`;
  return `<defs>${fade(500, 760)}
    <radialGradient id="neb1" cx="0.78" cy="0.3" r="0.45"><stop offset="0" stop-color="${COL.accent2}" stop-opacity="0.22"/><stop offset="1" stop-color="${COL.accent2}" stop-opacity="0"/></radialGradient>
    <radialGradient id="neb2" cx="0.92" cy="0.85" r="0.5"><stop offset="0" stop-color="${COL.accent}" stop-opacity="0.18"/><stop offset="1" stop-color="${COL.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="core" x1="0" x2="1"><stop offset="0" stop-color="rgb(245 180 81)" stop-opacity="0"/><stop offset="0.5" stop-color="rgb(245 180 81)" stop-opacity="0.2"/><stop offset="1" stop-color="rgb(245 180 81)" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#neb1)"/><rect width="${W}" height="${H}" fill="url(#neb2)"/>${stars}
  <g mask="url(#fade)"><rect x="${C[0] - 26}" y="0" width="52" height="${H}" fill="url(#core)"/><g fill="none" stroke-linecap="butt" stroke-linejoin="round">${lines}</g></g>`;
};

// Racing: the live transition's own plan, left to right as it plays: the supernovae's spherical
// remnants (gold shells, teal knots); their gas gathered by gravity into glowing drops, the stars into
// beads; and the drops, frozen and split, their shards streaming along the field lines into Racing's
// card, which glows with the light it takes in.
ART.glass = () => {
  const card = [W * 0.8, H * 0.3, W * 0.15, H * 0.4];
  const plan = makeDewPlan(W, H, { phone: false, card }), q = rng(41);
  const rgb = c => `rgb(${c.map(v => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2))).join(',')})`;
  const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const gold = PALETTE.neb.ha, teal = PALETTE.neb.o3;
  let shells = '', drops = '', lines = '', shards = '';
  // The remnants, where they are on the left: a limb-brightened shell of filaments, knots within.
  for (const e of plan.events) {
    if (e.S[0] > W * 0.62) continue;
    const R = e.Rmax * 0.9;
    shells += `<circle cx="${f(e.S[0])}" cy="${f(e.S[1])}" r="${f(R)}" fill="url(#cav)" stroke="${gold}" stroke-opacity=".55" stroke-width="${f(R * 0.12)}"/>`;
    for (let k = 0; k < 26; k++) {
      const a = q() * Math.PI * 2, r1 = R * (0.78 + 0.2 * q()), r2 = r1 + R * (0.08 + 0.1 * q()), b = a + (q() - 0.5) * 0.5;
      shells += `<path d="M${f(e.S[0] + Math.cos(a) * r1)} ${f(e.S[1] + Math.sin(a) * r1)}Q${f(e.S[0] + Math.cos((a + b) / 2) * (r1 + r2) * 0.55)} ${f(e.S[1] + Math.sin((a + b) / 2) * (r1 + r2) * 0.55)} ${f(e.S[0] + Math.cos(b) * r2)} ${f(e.S[1] + Math.sin(b) * r2)}" stroke="${q() < 0.15 + 0.3 * e.hot ? teal : gold}" stroke-opacity=".7" stroke-width="1.1" fill="none"/>`;
    }
    for (let k = 0; k < 8; k++) { const a = q() * Math.PI * 2, rr = R * 0.55 * Math.sqrt(q()); shells += `<circle cx="${f(e.S[0] + Math.cos(a) * rr)}" cy="${f(e.S[1] + Math.sin(a) * rr)}" r="${f(2 + 3 * q())}" fill="${teal}" fill-opacity=".55"/>`; }
  }
  // The drops (and the stars' beads) in the middle, glowing in their gas's colours.
  for (const s of plan.clumps) {
    if (s.c[0] < W * 0.5 || s.c[0] > W * 0.74) continue;
    drops += `<circle cx="${f(s.c[0])}" cy="${f(s.c[1])}" r="${f(s.r * 2.6)}" fill="${rgb(s.col)}" fill-opacity=".12"/><circle cx="${f(s.c[0])}" cy="${f(s.c[1])}" r="${f(s.r)}" fill="${rgb(s.col.map(v => v * 0.8))}" stroke="#fff" stroke-opacity=".4" stroke-width=".6"/><circle cx="${f(s.c[0] - s.r * 0.35)}" cy="${f(s.c[1] - s.r * 0.4)}" r="${f(Math.max(0.6, s.r * 0.2))}" fill="#fff" fill-opacity=".85"/>`;
  }
  for (const r of plan.records) {
    if (!r.sky || r.c[0] < W * 0.52 || r.c[0] > W * 0.72) continue;
    drops += `<circle cx="${f(r.c[0])}" cy="${f(r.c[1])}" r="1.6" fill="${PALETTE.stars[r.sky.tint > 0.5 ? 1 : 0]}" fill-opacity=".9"/>`;
  }
  // The shards on the right, along their field lines into the card, further along the nearer they are.
  plan.shards.forEach((sh, i) => {
    if (sh.c[0] < W * 0.66 || sh.kind === 1) return;
    const path = sh.path, u = sm((sh.c[0] - W * 0.66) / (W * 0.12)) * 0.85;
    if (i % 3 === 0) lines += `M${path.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}`;
    const x = u * (path.length - 1), k = Math.min(path.length - 2, Math.floor(x)), t = x - k, p = [path[k][0] + (path[k + 1][0] - path[k][0]) * t, path[k][1] + (path[k + 1][1] - path[k][1]) * t];
    const ang = Math.atan2(path[k + 1][1] - path[k][1], path[k + 1][0] - path[k][0]), len = 3 + sh.r * 1.1, wid = 1.5 + sh.r * 0.5;
    const col = sh.kind === 2 ? '#fff' : rgb(sh.col.map(v => v * 0.85 + 0.1));
    shards += `<polygon points="${[[len, 0], [-len * 0.6, wid], [-len * 0.4, -wid]].map(([a, b]) => `${f(p[0] + Math.cos(ang) * a - Math.sin(ang) * b)},${f(p[1] + Math.sin(ang) * a + Math.cos(ang) * b)}`).join(' ')}" fill="${col}" fill-opacity=".92" stroke="#fff" stroke-opacity=".6" stroke-width=".5"/>`;
  });
  const [cx, cy, cw, ch] = card;
  return `<defs>${fade(580, 780)}<radialGradient id="neb" cx=".55" cy=".45" r=".6"><stop offset="0" stop-color="${PALETTE.sky.body}" stop-opacity=".4"/><stop offset="1" stop-color="${PALETTE.sky.body}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cav"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".85" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="night" x1="0" x2="1"><stop offset=".62" stop-color="#1d4c74" stop-opacity="0"/><stop offset=".85" stop-color="#1d4c74" stop-opacity=".75"/></linearGradient>
    <radialGradient id="fill" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="${PALETTE.neb.gold}" stop-opacity=".9"/><stop offset=".6" stop-color="${PALETTE.neb.o3}" stop-opacity=".5"/><stop offset="1" stop-color="#cfe9ff" stop-opacity=".35"/></radialGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2d8" stop-opacity=".5"/><stop offset="1" stop-color="#fff2d8" stop-opacity="0"/></radialGradient></defs>
  <g mask="url(#fade)"><rect width="${W}" height="${H}" fill="${PALETTE.css.bg}"/><rect width="${W}" height="${H}" fill="url(#neb)"/><rect width="${W}" height="${H}" fill="url(#night)"/>${shells}${drops}
  <path d="${lines}" fill="none" stroke="#dff1ff" stroke-opacity=".16" stroke-width=".8"/>${shards}
  <ellipse cx="${f(cx + cw / 2)}" cy="${f(cy + ch / 2)}" rx="${f(cw)}" ry="${f(ch * 0.9)}" fill="url(#glow)"/>
  <rect x="${f(cx)}" y="${f(cy)}" width="${f(cw)}" height="${f(ch)}" rx="18" fill="url(#fill)" stroke="#fff" stroke-opacity=".85" stroke-width="1.4"/></g>`;
};

// Outdoors: the White Mountains as the transition leaves them, Outdoors' art-glass window: the land's
// heights stepped into bands on the square module and leaded by marching squares (every line square
// or at 45°), clear glass low over the dusk, sage, forest green, cream and gold on the mountains, a
// Cherokee-red square at each summit, the tarns' jewels (glsl/folio.js, the same module and bands).
ART.folio = () => {
  const { module: M, bands } = GLASS, x0 = 12, z0 = 14, span = 50, sx = 700 / span, X = 520, Y = -50;
  const MID = 37, i0 = Math.floor((x0 - MID) / M) - 1, i1 = Math.ceil((x0 + span - MID) / M) + 1, j0 = Math.floor((z0 - MID) / M) - 1, j1 = Math.ceil((z0 + span * H / 700 - MID) / M) + 1;
  const ft = (x, z) => landform(x, z);
  const px = (x, z) => [X + (x - x0) * sx, Y + (span - (z - z0)) * sx];
  const P = (x, z) => { const [a, b] = px(x, z); return `${f(a)} ${f(b)}`; };
  // For each band edge, the region above it, cell by cell (glsl/folio.js leadCell: vertices at the
  // corners and the sides' midpoints), and the edge itself.
  const fills = bands.map(() => ''), lines = bands.map(() => '');
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const ox = MID + i * M, oz = MID + j * M;
    const c = [[ox, oz], [ox + M, oz], [ox + M, oz + M], [ox, oz + M]], v = c.map(([x, z]) => ft(x, z)), mid = ft(ox + M / 2, oz + M / 2);
    const at = ([u, w]) => P(ox + u * M, oz + w * M);
    bands.forEach((thr, k) => {
      const { polys, segs } = leadCell(v, mid, thr);
      for (const poly of polys) fills[k] += `M${poly.map(at).join('L')}Z`;
      for (const [a, b] of segs) lines[k] += `M${at(a)}L${at(b)}`;
    });
  }
  const glass = ['#1d2b26', '#2a3a30', '#5f7c55', '#2c6b45', '#e6d8b8', '#e2ae52'];
  let panes = '';
  bands.forEach((_, k) => { panes += `<path d="${fills[k]}" fill="${glass[k]}" fill-opacity="${k < 1 ? 0.5 : 0.92}"/>`; });
  const came = lines.join('');
  let reds = '';
  for (const r of REDS) { const [a, b] = px(r.c[0] - r.h[0], r.c[1] + r.h[1]); reds += `<rect x="${f(a)}" y="${f(b)}" width="${f(2 * r.h[0] * sx)}" height="${f(2 * r.h[1] * sx)}"/>`; }
  let jewels = '';
  for (const t of JEWELS) { const rr = Math.max(0.3, t.r * 1.1); jewels += `<path d="M${P(t.p[0], t.p[1] + rr)}L${P(t.p[0] + rr, t.p[1])}L${P(t.p[0], t.p[1] - rr)}L${P(t.p[0] - rr, t.p[1])}Z"/>`; }
  return `<defs>${fade(480, 700)}<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0b1a1f"/><stop offset=".62" stop-color="#173033"/><stop offset=".8" stop-color="#5a3b20"/><stop offset="1" stop-color="#14140f"/></linearGradient></defs>
  <g mask="url(#fade)"><rect width="${W}" height="${H}" fill="url(#dusk)"/>${panes}
    <g fill="#b8402a" stroke="#0a0907" stroke-width="2">${reds}</g>
    <g fill="#8fc3c6" stroke="#0a0907" stroke-width="1.6">${jewels}</g>
    <path d="${came}" fill="none" stroke="#0a0907" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${came}" fill="none" stroke="${C.accent}" stroke-opacity=".22" stroke-width=".7"/></g>`;
};

// Photography: fire becoming memory. The torus the embers' ribbons wind onto, two families crossing
// as warp and weft, copper and gold, seen a little from above (the far side dimmer); embers and sparks
// round it; fine silver grains settling below, under the safelight.
ART.darkroom = () => {
  const r = rng(6), cx = 935, cy = 318, R = 218, a = 94, tilt = 1.02, TAU = Math.PI * 2;
  const at = (th, ph) => {
    const x = (R + a * Math.cos(th)) * Math.cos(ph), y = (R + a * Math.cos(th)) * Math.sin(ph), z = a * Math.sin(th);
    return [cx + x, cy + y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
  };
  let back = '', front = '';
  for (let fam = 0; fam < 2; fam++) for (let k = 0; k < 17; k++) {
    const al = (k / 17) * TAU + (r() - 0.5) * 0.16, dir = fam ? -1 : 1, d = ['', ''];
    let prev = -1;
    for (let i = 0; i <= 260; i++) {
      const ph = (i / 260) * TAU, [x, y, z] = at(dir * 3 * ph + al, ph), side = z > 0 ? 1 : 0;
      d[side] += `${prev === side ? 'L' : 'M'}${f(x)} ${f(y)}`;
      prev = side;
    }
    const col = r() < 0.45 ? '#D1783D' : r() < 0.85 ? '#FFBD52' : '#FFEDC7', w = f(1 + r() * 1.3);
    back += `<path d="${d[0]}" stroke="${col}" stroke-width="${w}" stroke-opacity="0.34"/>`;
    front += `<path d="${d[1]}" stroke="${col}" stroke-width="${w}" stroke-opacity="0.95"/>`;
  }
  // Embers: fire under a dark crust; sparks.
  let embers = '', sparks = '', grains = '';
  for (let i = 0; i < 9; i++) {
    const x = 610 + r() * 630, y = 40 + r() * 520, q = 7 + r() * 13;
    if (Math.hypot((x - cx) / 1.25, (y - cy) / 0.7) < 250 && Math.hypot((x - cx) / 1.25, (y - cy) / 0.7) > 90) continue;
    embers += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(r() * 360)})"><circle r="${f(q * 2.4)}" fill="url(#halo)"/>
      <ellipse rx="${f(q)}" ry="${f(q * (0.72 + r() * 0.2))}" fill="url(#coal)"/>
      <path d="M${f(-q * 0.7)} ${f(-q * 0.1)}q${f(q * 0.5)} ${f(-q * 0.6)} ${f(q * 0.9)} ${f(-q * 0.2)}t${f(q * 0.5)} ${f(q * 0.5)}q${f(-q * 0.5)} ${f(q * 0.5)} ${f(-q * 1.1)} ${f(q * 0.2)}z" fill="#120C0A" fill-opacity="0.82"/></g>`;
  }
  for (let i = 0; i < 70; i++) sparks += `<circle cx="${f(580 + r() * 680)}" cy="${f(r() * 560)}" r="${f(0.7 + r() * 1.5)}" fill="${r() < 0.5 ? '#FFBD52' : '#F25C1A'}" fill-opacity="${f(0.35 + r() * 0.6)}"/>`;
  for (let i = 0; i < 520; i++) {
    const y = 560 + Math.pow(r(), 0.7) * 150;
    grains += `<circle cx="${f(540 + r() * 720)}" cy="${f(y)}" r="${f(0.5 + r() * 1.1)}" fill="#D6DBE6" fill-opacity="${f((0.15 + r() * 0.7) * Math.min(1, (y - 550) / 60))}"/>`;
  }
  return `<defs>${fade(500, 700)}
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <radialGradient id="safe" cx="0.72" cy="-0.05" r="0.75"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.42"/><stop offset="1" stop-color="${C.accent2}" stop-opacity="0.02"/></radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#F25C1A" stop-opacity="0.5"/><stop offset="1" stop-color="#F25C1A" stop-opacity="0"/></radialGradient>
    <radialGradient id="coal" cx="0.4" cy="0.38"><stop offset="0" stop-color="#FFEDC7"/><stop offset="0.35" stop-color="#FFBD52"/><stop offset="0.75" stop-color="#F25C1A"/><stop offset="1" stop-color="#6B0D05"/></radialGradient></defs>
  <g mask="url(#fade)"><rect width="${W}" height="${H}" fill="url(#safe)"/>
    <g fill="none" stroke-linecap="round">${back}</g>
    <g fill="none" stroke-linecap="round" filter="url(#glow)" opacity="0.8">${front}</g>
    <g fill="none" stroke-linecap="round">${front}</g>
    ${embers}${sparks}${grains}</g>`;
};

// Chess: ink, unmixed. The tile's own tilted board (staunton.js: its camera, and the sprite's pieces turned
// on their axes), caught as it forms out of the grey haze: the squares hardened, lacquered wash and paper,
// all but the far rank, still ink; each piece cured from its foot (white done, black's pawns part way, its
// back rank barely begun, knights first), a glint at each front; above, threads of black and white ink
// streaming down into the pieces still forming, motes caught in the light.
ART.ink = () => {
  const r = rng(11), X0 = 650, X1 = 1215, Y0 = 80, Y1 = 640, w = X1 - X0, h = Y1 - Y0;
  const cam = frameCamera(w / h, { elev: 0.62, fov: 0.5, margin: 0.04 });
  const at = p => { const [u, v] = project(cam, p); return [X0 + (u + 1) / 2 * w, Y0 + (1 - v) / 2 * h]; };
  const poly = q => q.map(p => at(p).map(f).join(',')).join(' ');
  const E = BOARD.half + BOARD.frame, WASH = '#26221E', PAPER = '#ECE4D3', WHITE_INK = '#FFFDF8';
  // A circle of the solid at height y, as the screen sees it.
  const ring = (x, y, z, rad) => {
    const [cx, cy] = at([x, y, z]), rx = Math.abs(at([x + rad, y, z])[0] - cx), ry = Math.abs(at([x, y, z + rad])[1] - at([x, y, z - rad])[1]) / 2;
    return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(Math.max(0.4, ry))}"/>`;
  };
  const ball = (x, y, z, rad) => { const [cx, cy] = at([x, y, z]); return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.abs(at([x + rad, y, z])[0] - cx))}"/>`; };
  // A piece between heights lo and hi (world units): its turned body as rings stacked from the foot (each
  // shaded across, as a turned surface is), then what turning cannot make (the king's cross, the queen's
  // coronet, the bishop's finial, the knight's head cut flat, facing the middle). grow fattens it.
  const piece = (s, lo, hi, grow = 0) => {
    const T = TYPES[s.type], polys = bodyOf(T), top = Math.min(...polys.flat().map(v => v[1])), inside = y => y >= lo && y <= hi;
    let g = '';
    for (let sy = FOOT - 0.2; sy >= top; sy -= 0.5) { const hw = halfWidth(polys, sy); if (hw > 0 && inside(toY(sy))) g += ring(s.x, toY(sy), s.z, hw / SQ * SR + grow); }
    if (T === 'K') for (const [cx, cy, hw, hh] of DETAIL.cross) if (inside(cy)) g += `<polygon points="${poly([[s.x + cx - hw - grow, cy - hh - grow, s.z], [s.x + cx + hw + grow, cy - hh - grow, s.z], [s.x + cx + hw + grow, cy + hh + grow, s.z], [s.x + cx - hw - grow, cy + hh + grow, s.z]])}"/>`;
    if (T === 'Q') {
      const [cr, cy, br] = DETAIL.coronet;
      if (inside(cy)) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; g += ball(s.x + cr * Math.cos(a), cy, s.z + cr * Math.sin(a), br + grow); }
      if (inside(DETAIL.crown[0])) g += ball(s.x, DETAIL.crown[0], s.z, DETAIL.crown[1] + grow);
    }
    if (T === 'B' && inside(DETAIL.finial[0])) g += ball(s.x, DETAIL.finial[0], s.z, DETAIL.finial[1] + grow);
    if (T === 'N') {
      // The sprite's knight looks left; each turns to face the middle.
      const dir = s.file < 4 ? -1 : 1;
      for (const p of headOf()) {
        const q = p.map(([x, y]) => [s.x + dir * toR(x) * (1 + grow * 3), Math.min(hi, Math.max(lo, toY(y))), s.z]);
        if (hi > 0.45) g += `<polygon points="${poly(q)}"/>`;
      }
    }
    return g;
  };
  // How far each piece has cured (a share of its height): white done; black's pawns rippling out from the
  // middle; its back rank begun, the knights furthest.
  const cureOf = s => !s.black ? 1 : s.rank === 7 ? 0.95 - 0.12 * Math.abs(s.file - 3.5) : TYPES[s.type] === 'N' ? 0.62 : 0.12 + r() * 0.16;
  const slots = startSlots().sort((a, b) => a.z - b.z);
  // The board: its slab and frame, the squares (the far rank's still ink), the inlay, the lacquer.
  let squares = '', liquid = '';
  for (let file = 0; file < 8; file++) for (let rank = 1; rank <= 8; rank++) {
    const [x, z] = worldOf(file, rank), dark = (file + rank) % 2 === 1;
    const q = poly([[x - 0.5, 0, z - 0.5], [x + 0.5, 0, z - 0.5], [x + 0.5, 0, z + 0.5], [x - 0.5, 0, z + 0.5]]);
    if (rank < 8) squares += `<polygon points="${q}" fill="${dark ? WASH : PAPER}"${dark ? ` fill-opacity="${f(0.9 + r() * 0.1)}"` : ''}/>`;
    else liquid += `<polygon points="${q}" fill="${dark ? C.ink : WHITE_INK}" fill-opacity="${dark ? f(0.55 + r() * 0.2) : f(0.6 + r() * 0.2)}"/>`;
  }
  const zF = 3, fl = at([-E, 0, -zF]), fr = at([E, 0, -zF]);
  const board = `<polygon points="${poly([[-E, 0, E], [E, 0, E], [E, -BOARD.slab, E], [-E, -BOARD.slab, E]])}" fill="#0E0D0B"/>
    <polygon points="${poly([[-E, 0, -zF], [E, 0, -zF], [E, 0, E], [-E, 0, E]])}" fill="${C.ink}"/>
    <polygon points="${poly([[-4.14, 0, -zF], [-4.14, 0, 4.14], [4.14, 0, 4.14], [4.14, 0, -zF]])}" fill="none" stroke="${C.accent}" stroke-width="1.2" stroke-opacity="0.9"/>
    ${squares}<polygon points="${poly([[-4, 0, -zF], [4, 0, -zF], [4, 0, 4], [-4, 0, 4]])}" fill="url(#lacquer)"/>`;
  const farFrame = `<polygon points="${poly([[-E, 0, -E], [E, 0, -E], [E, 0, -zF], [-E, 0, -zF]])}" fill="${C.ink}" fill-opacity="0.7"/>`;
  // Shadows, cast back and to the right; then the pieces, far ones first: the solid below each front, the
  // ink above it, the glint at it.
  let shadows = '', pieces = '';
  for (const s of slots) {
    const T = TYPES[s.type], tall = TALL[T], c = cureOf(s), yc = c * tall + (c >= 1 ? 1 : 0);
    if (c > 0.3) shadows += ring(s.x + 0.12 + tall * 0.12, 0, s.z - 0.1 - tall * 0.16, 0.34 + tall * 0.05);
    const fill = s.black ? 'url(#obsidian)' : 'url(#ivory)', rim = s.black ? '#8A93A3' : C.ink;
    // (Rings overlap, so a part seen through is a group's opacity, never its fill's.)
    let g = `<g fill="${rim}" opacity="${s.black ? 0.5 : 0.6}">${piece(s, -1, yc, 0.018)}</g><g fill="${fill}">${piece(s, -1, yc)}</g>`;
    if (c < 1) {
      g += `<g filter="url(#liquid)" fill="${C.ink}">${piece(s, yc - 0.02, 9, 0.012)}<g fill="${WHITE_INK}" opacity="0.16">${piece(s, yc + 0.08, 9, -0.035)}</g></g>`;
      const [x0] = at([s.x - 0.42, yc, s.z]), [x1, y1] = at([s.x + 0.42, yc, s.z]);
      g += `<path d="M${f(x0)} ${f(y1)}H${f(x1)}" stroke="#FFF7E6" stroke-width="4" stroke-opacity="0.8" filter="url(#glow)"/><path d="M${f(x0 + 3)} ${f(y1)}H${f(x1 - 3)}" stroke="#FFFCF4" stroke-width="1" stroke-opacity="0.95"/>`;
    }
    pieces += g;
  }
  // Threads of ink streaming down out of the haze into the pieces still forming: bundles of strands, black
  // and white, spread wide above and gathering as they fall; a few curls where the stirring is still undoing.
  let threads = '', veils = '', motes = '';
  const bez = (a, b, c, d, t) => { const s = 1 - t; return [0, 1].map(i => s * s * s * a[i] + 3 * s * s * t * b[i] + 3 * s * t * t * c[i] + t * t * t * d[i]); };
  const targets = slots.filter(s => cureOf(s) < 1);
  for (let k = 0; k < 30; k++) {
    const s = targets[k % targets.length], tall = TALL[TYPES[s.type]], end = at([s.x + (r() - 0.5) * 0.3, tall * (0.6 + r() * 0.5), s.z]);
    const st = [end[0] + (r() - 0.5) * 300, Y0 - 120 + r() * 60], turn = r() < 0.5 ? -1 : 1, L = end[1] - st[1];
    const c1 = [st[0] + turn * L * (0.25 + r() * 0.35), st[1] + L * (0.3 + r() * 0.2)], c2 = [end[0] - turn * L * (0.12 + r() * 0.2), end[1] - L * (0.35 + r() * 0.2)];
    const white = k % 3 !== 0, n = 2 + Math.floor(r() * 3), spread = 3.5 + r() * 4;
    veils += `<path d="M${f(st[0])} ${f(st[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(end[0])} ${f(end[1])}" stroke="${white ? WHITE_INK : C.ink}" stroke-width="${f(10 + r() * 16)}" stroke-opacity="${white ? 0.1 : 0.07}"/>`;
    for (let j = 0; j < n; j++) {
      const o = (j - (n - 1) / 2) * spread, col = (white ? j % 4 !== 3 : j % 3 === 2) ? WHITE_INK : C.ink;
      const d = `M${f(st[0] + o * 2.4)} ${f(st[1])}C${f(c1[0] + o * 1.8)} ${f(c1[1])} ${f(c2[0] + o * 0.6)} ${f(c2[1])} ${f(end[0] + o * 0.08)} ${f(end[1])}`;
      threads += `<path d="${d}" stroke="${col}" stroke-width="${f(0.8 + r() * (col === C.ink ? 2 : 1.5))}" stroke-opacity="${f(col === C.ink ? 0.35 + r() * 0.45 : 0.5 + r() * 0.45)}"/>`;
    }
    for (let j = 0; j < 3; j++) {
      const [mx, my] = bez(st, c1, c2, end, 0.3 + r() * 0.65);
      motes += `<circle cx="${f(mx + (r() - 0.5) * 10)}" cy="${f(my + (r() - 0.5) * 6)}" r="${f(0.6 + r() * 1.2)}"/>`;
    }
  }
  // Curls: two arms, black and white, wound together.
  let curls = '';
  for (const [cx, cy, R0, rot] of [[880, 60, 46, 0.4], [1110, 120, 38, 2.2], [1000, 26, 30, 4.1]]) {
    for (let arm = 0; arm < 2; arm++) {
      let d = '';
      for (let i = 0; i <= 90; i++) {
        const th = i / 90 * 3.4 * Math.PI, rr = R0 * Math.exp(-0.17 * th), a = th + rot + arm * Math.PI;
        d += `${i ? 'L' : 'M'}${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a) * 0.62)}`;
      }
      curls += `<path d="${d}" stroke="${arm ? WHITE_INK : C.ink}" stroke-width="${arm ? 1.6 : 2.2}" stroke-opacity="${arm ? 0.85 : 0.6}"/>`;
    }
  }
  // Light from above through the water.
  let shafts = '';
  for (let k = 0; k < 6; k++) {
    const x = X0 - 40 + r() * w, wd = 18 + r() * 46, sk = 90 + r() * 60;
    shafts += `<polygon points="${f(x)},-10 ${f(x + wd)},-10 ${f(x + wd + sk)},${f(fl[1] + 40)} ${f(x + sk - wd * 0.4)},${f(fl[1] + 40)}" fill-opacity="${f(0.06 + r() * 0.1)}"/>`;
  }
  // Sparkles along the board's front.
  let sparks = '';
  for (let k = 0; k < 12; k++) {
    const t = r(), x = fl[0] + (fr[0] - fl[0]) * t, y = fl[1] + (r() - 0.5) * 4, s = 2 + r() * 5;
    sparks += `<path d="M${f(x - s)} ${f(y)}L${f(x)} ${f(y - s * 0.22)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y + s * 0.22)}ZM${f(x)} ${f(y - s * 0.7)}L${f(x + s * 0.15)} ${f(y)}L${f(x)} ${f(y + s * 0.7)}L${f(x - s * 0.15)} ${f(y)}Z"/>`;
  }
  return `<defs>${fade(470, 720)}
    <linearGradient id="ivory" x1="0" x2="1"><stop offset="0" stop-color="#A99D86"/><stop offset="0.24" stop-color="#E4DAC6"/><stop offset="0.4" stop-color="#FFFCF3"/><stop offset="0.66" stop-color="#F1E9D8"/><stop offset="1" stop-color="#9E927C"/></linearGradient>
    <linearGradient id="obsidian" x1="0" x2="1"><stop offset="0" stop-color="#050505"/><stop offset="0.26" stop-color="#222429"/><stop offset="0.38" stop-color="#5D6C82"/><stop offset="0.46" stop-color="#1D1F23"/><stop offset="0.85" stop-color="#0D0D0D"/><stop offset="1" stop-color="#2A2F38"/></linearGradient>
    <linearGradient id="lacquer" gradientUnits="userSpaceOnUse" x1="${X0}" y1="${f(fl[1])}" x2="${X1}" y2="${Y1}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.13"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.02"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="haze" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${f(fl[1] + 150)}"><stop offset="0" stop-color="#B9B2A6"/><stop offset="0.55" stop-color="#9A9387"/><stop offset="0.8" stop-color="#9A9387" stop-opacity="0.75"/><stop offset="1" stop-color="#9A9387" stop-opacity="0"/></linearGradient>
    <filter id="liquid" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.05 0.08" numOctaves="3" seed="5"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.7"/></filter>
    <filter id="silk" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="10"/></filter>
    <filter id="mist" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="shade" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="glow" x="-50%" y="-400%" width="200%" height="900%"><feGaussianBlur stdDeviation="3"/></filter></defs>
  <g mask="url(#fade)">
    <rect x="${X0 - 260}" y="-10" width="${w + 320}" height="${f(fl[1] + 160)}" fill="url(#haze)"/>
    <g fill="${WHITE_INK}">${shafts}</g>
    <g fill="none" stroke-linecap="round" filter="url(#mist)">${veils}</g>
    ${board}
    <g filter="url(#liquid)">${farFrame}<g>${liquid}</g></g>
    <path d="M${f(fl[0])} ${f(fl[1])}L${f(fr[0])} ${f(fr[1])}" stroke="#FFF7E6" stroke-width="5" stroke-opacity="0.7" filter="url(#glow)"/>
    <path d="M${f(fl[0])} ${f(fl[1])}L${f(fr[0])} ${f(fr[1])}" stroke="#FFFCF4" stroke-width="1.1" stroke-opacity="0.85"/>
    <g fill="#FFFCF4">${sparks}</g>
    <g fill="${C.ink}" fill-opacity="0.34" filter="url(#shade)">${shadows}</g>
    <g fill="none" stroke-linecap="round" filter="url(#silk)">${curls}${threads}</g>
    ${pieces}
    <g fill="${WHITE_INK}" fill-opacity="0.9">${motes}</g></g>`;
};

// The AI Power Map: 224 moments on one line from 2021 to 2026, stacked where they crowd.
ART.timeline = () => {
  const x0 = 640, x1 = 1150, base = 470, r = rng(2), bins = new Map();
  let dots = '', ticks = '';
  for (let i = 0; i < 224; i++) {
    const t = Math.pow(r(), 0.62), x = x0 + t * (x1 - x0), b = Math.round(x / 11), k = bins.get(b) || 0;
    bins.set(b, k + 1);
    dots += `<circle cx="${b * 11}" cy="${base - 14 - k * 11}" r="4.2" fill="${k % 3 === 2 ? C.accent2 : C.ink}" fill-opacity="${f(0.85 - (r() * 0.35))}"/>`;
  }
  for (let y = 2021; y <= 2026; y++) {
    const x = x0 + (y - 2021) / 5 * (x1 - x0);
    ticks += `<path d="M${f(x)} ${base}v10" stroke="${C.ink}"/><text x="${f(x)}" y="${base + 34}" text-anchor="middle">${y}</text>`;
  }
  return `<defs>${fade(560, 700)}</defs><g mask="url(#fade)">${dots}<path d="M${x0 - 20} ${base}H${x1 + 20}" stroke="${C.ink}" stroke-width="1.5"/>
    <g fill="${C.mute}" font-family="DM Sans" font-size="16" font-weight="500">${ticks}</g></g>`;
};

// The homepage: the crystal, one facet per destination, each running from its style's ground to its
// accent.
ART.crystal = () => {
  const cx = 945, cy = 315, R = 232;
  const vx = i => cx + Math.cos(-Math.PI / 2 + i * Math.PI / 3) * R, vy = i => cy + Math.sin(-Math.PI / 2 + i * Math.PI / 3) * R;
  let facets = '', grads = '';
  reg.destinations.forEach((d, i) => {
    const c = styles[d.style].colors, from = d.style === 'house' ? c.accent3 : c.bg;
    const mx = (vx(i) + vx(i + 1)) / 2, my = (vy(i) + vy(i + 1)) / 2;
    grads += `<linearGradient id="fa${i}" x1="${cx}" y1="${cy}" x2="${f(mx)}" y2="${f(my)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>`;
    facets += `<path d="M${cx} ${cy}L${f(vx(i))} ${f(vy(i))}L${f(vx(i + 1))} ${f(vy(i + 1))}Z" fill="url(#fa${i})"/>`;
  });
  let edges = '';
  for (let i = 0; i < 6; i++) edges += `M${cx} ${cy}L${f(vx(i))} ${f(vy(i))}`;
  return `<defs>${grads}<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  ${facets}<polygon points="${Array.from({ length: 6 }, (_, i) => `${f(vx(i))},${f(vy(i))}`).join(' ')}" fill="url(#sheen)" stroke="${C.ink}" stroke-opacity="0.85" stroke-width="2"/>
  <path d="${edges}" stroke="#fff" stroke-opacity="0.55" stroke-width="1.2"/>`;
};

// ---- the card ----
const card = document.getElementById('card');
const vars = {
  '--bg': C.bg, '--bg-clear': hexA(C.bg, 0), '--ink': C.ink, '--mute': C.mute, '--accent': C.accent,
  '--display': T.display, '--weight': T.weight, '--track': T.track, '--label': T.label, '--size': `${T.size}px`,
  '--slant': T.italic ? 'italic' : 'normal', '--case': T.upper ? 'uppercase' : 'none',
};
for (const [k, v] of Object.entries(vars)) card.style.setProperty(k, String(v));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// House is the site's own plain style, so its pages carry no style name.
const kicker = P.kicker || (P.style === 'house' ? 'Alex Crystal' : `Alex Crystal <span aria-hidden="true">·</span> <b>${esc(S.name)}</b>`);
const foot = id === 'home'
  ? `<ul class="dests">${reg.destinations.map(d => `<li style="--dot:${styles[d.style].colors.accent}">${esc(d.title)}</li>`).join('')}</ul>`
  : `<span>arcrystal.github.io</span>${P.art === 'timeline' ? '' : `<i></i><span>Transition · <b>${esc(PROCESS[P.style])}</b></span>`}`;
card.innerHTML = `<svg class="art" viewBox="0 0 ${W} ${H}" aria-hidden="true">${ART[P.art]()}</svg><div class="scrim"></div>
  <div class="text"><p class="kicker">${kicker}</p><h1 class="title">${esc(P.title)}</h1><p class="line">${esc(line)}</p><div class="foot">${foot}</div></div>`;

const faces = [`${T.italic ? 'italic ' : ''}${T.weight} 100px ${T.display}`, `500 15px ${T.label}`, "400 27px 'DM Sans'", "600 15px 'DM Sans'", "15px 'JetBrains Mono'"];
await Promise.all(faces.map(s => document.fonts.load(s, `${P.title}${line}`)));
await document.fonts.ready;
// The longest titles step down until they fit the column.
const title = card.querySelector('.title');
for (let s = T.size; title.scrollWidth > 640 && s > 60; s -= 4) title.style.fontSize = `${s}px`;
document.title = `Share card · ${P.title}`;
document.documentElement.dataset.ready = '1';
