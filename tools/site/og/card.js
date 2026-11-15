// The share card for one page, drawn in that page's style: its name in the style's display face,
// its line, and on the right the process its transition is built on, drawn here in SVG (the maze,
// the vortex, the supernovae's gas gathered into drops and pulled as shards into Racing's card, the White Mountains leaded into art glass, film developed into prints, branching ink). The
// homepage gets the crystal, one facet per destination. Everything is seeded, so a card only
// changes when its words or this file do. Sets <html data-ready> once the fonts are in.
import { carveMaze } from '/static/site/lerp.js';
import { makeDewPlan, radiusAt, liveAt } from '/static/site/scene/dew-plan.js';
import { landform, PEAKS48, PEMI } from '/static/site/scene/terrain-plan.js';
import { GLASS, REDS, JEWELS, leadCell } from '/static/site/scene/glsl/folio.js';
import { PALETTE } from '/static/site/scene/palette.js';

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
  folio: 'The mountains rise', darkroom: 'The thickness of a moment', ink: 'Branching ink',
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

// Photography: film pulled off the table in coils, sprocket holes along both edges (a wide dashed
// stroke under a narrower one shows only in the margins), over prints developing in the red tray,
// white-bordered, each a little askew, coming up from a halftone screen.
// Photography: the thickness of a moment. The lantern's reflection through the evening as a ribbon in
// space-time (its edge brilliant, its inside smoke, the glint's hairline along it), in the colours of
// time (amber, copper, sage, midnight blue), the summits' ruby threads behind; below, under the
// safelight, the same evening coming up in a print in the developer, the meniscus crossing it.
ART.darkroom = () => {
  const r = rng(6);
  const rib = 'M560 250 C 700 170, 820 330, 940 270 S 1120 150, 1250 210';
  const ribLo = 'M560 286 C 700 214, 820 362, 940 300 S 1120 170, 1250 222';
  let threads = '';
  for (let i = 0; i < 9; i++) {
    const x = 760 + r() * 420, y = 120 + r() * 260, l = 120 + r() * 160;
    threads += `<path d="M${f(x)} ${f(y)}l${f(l)} ${f(-l * 0.32)}" stroke="#B3271B" stroke-opacity="${f(0.35 + r() * 0.35)}" stroke-width="${f(1 + r() * 1.2)}"/>`;
  }
  // The print: a sheet lying back in the tray (a trapezoid), dark, the evening's trail paper-white.
  const sheet = 'M700 430 L1175 412 L1240 610 L640 628 Z';
  const trail = 'M690 560 C 790 500, 870 590, 960 545 S 1120 470, 1205 500';
  return `<defs>${fade(500, 700)}
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>
    <radialGradient id="safe" cx="0.72" cy="-0.05" r="0.75"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.accent2}" stop-opacity="0.02"/></radialGradient>
    <linearGradient id="time" x1="560" x2="1250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFC27A"/><stop offset="0.35" stop-color="#F08A5E"/><stop offset="0.62" stop-color="#9DC79A"/><stop offset="1" stop-color="#7F95F2"/></linearGradient>
    <clipPath id="sheet"><path d="${sheet}"/></clipPath></defs>
  <g mask="url(#fade)"><rect width="${W}" height="${H}" fill="url(#safe)"/>
    <g fill="none" stroke-linecap="round">${threads}</g>
    <path d="${rib}" fill="none" stroke="url(#time)" stroke-opacity="0.18" stroke-width="40"/>
    <path d="${rib}" fill="none" stroke="url(#time)" stroke-width="5" filter="url(#glow)"/>
    <path d="${ribLo}" fill="none" stroke="url(#time)" stroke-width="3" stroke-opacity="0.85" filter="url(#glow)"/>
    <path d="${rib}" fill="none" stroke="url(#time)" stroke-width="1.6"/>
    <path d="${ribLo}" fill="none" stroke="url(#time)" stroke-width="1.2" stroke-opacity="0.9"/>
    <path d="M560 268 C 700 192, 820 346, 940 285 S 1120 160, 1250 216" fill="none" stroke="#FFE9C9" stroke-width="1" stroke-opacity="0.9"/>
    <g transform="translate(80 -16)"><path d="${sheet}" fill="#000" fill-opacity="0.5" filter="url(#soft)" transform="translate(10 14)"/>
    <path d="${sheet}" fill="#3A0F0B"/>
    <g clip-path="url(#sheet)">
      <path d="${trail}" fill="none" stroke="#C9584A" stroke-width="30" stroke-opacity="0.35"/>
      <path d="${trail}" fill="none" stroke="#E98A7C" stroke-width="5" filter="url(#glow)"/>
      <path d="${trail}" fill="none" stroke="#F3B2A6" stroke-width="1.3"/>
      <path d="M820 420 C 800 480, 860 540, 820 640" fill="none" stroke="#B0473A" stroke-width="16" stroke-opacity="0.3"/>
      <path d="M1080 410 C 1110 470, 1050 540, 1090 640" fill="none" stroke="#B0473A" stroke-width="13" stroke-opacity="0.25"/>
      <path d="M560 470 C 760 520, 980 600, 1260 690" fill="none" stroke="#FF7A66" stroke-width="2.4" stroke-opacity="0.85" filter="url(#glow)"/>
    </g>
    <path d="${sheet}" fill="none" stroke="#E5483F" stroke-opacity="0.35" stroke-width="1.2"/></g></g>`;
};

// Chess: branching ink. Strokes split in two or three as they reach, thinning to hairlines, the
// edges bled by turbulence the way ink runs into paper.
ART.ink = () => {
  const r = rng(9), segs = [];
  const grow = (x, y, a, len, w, depth) => {
    if (!depth || w < 0.5) return;
    const bend = (r() - 0.5) * 0.7, x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const qx = x + Math.cos(a + bend) * len * 0.55, qy = y + Math.sin(a + bend) * len * 0.55;
    segs.push({ d: `M${f(x)} ${f(y)}Q${f(qx)} ${f(qy)} ${f(x2)} ${f(y2)}`, w, depth });
    const n = r() < 0.3 ? 3 : 2;
    for (let i = 0; i < n; i++) grow(x2, y2, a + (i - (n - 1) / 2) * (0.42 + r() * 0.3) + (r() - 0.5) * 0.25, len * (0.7 + r() * 0.12), w * (0.62 + r() * 0.08), depth - 1);
  };
  grow(1240, 120, Math.PI * 1.06, 120, 22, 9);
  grow(1240, 400, Math.PI * 0.96, 132, 26, 9);
  grow(1060, 690, Math.PI * 1.32, 96, 18, 8);
  const ink = segs.map(s => `<path d="${s.d}" stroke="${s.depth > 4 ? C.ink : C.accent}" stroke-opacity="${f(s.depth > 4 ? 0.9 : 0.75)}" stroke-width="${f(s.w)}"/>`).join('');
  let washes = '';
  for (let i = 0; i < 6; i++) washes += `<circle cx="${f(900 + r() * 300)}" cy="${f(r() * H)}" r="${f(60 + r() * 120)}" fill="${C.accent}" fill-opacity="${f(0.05 + r() * 0.06)}" filter="url(#wash)"/>`;
  return `<defs>${fade(470, 720)}
    <filter id="bleed" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
    <filter id="wash" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter></defs>
  <g mask="url(#fade)">${washes}<g fill="none" stroke-linecap="round" filter="url(#bleed)">${ink}</g></g>`;
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
