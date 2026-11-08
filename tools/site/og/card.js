// The share card for one page, drawn in that page's style: its name in the style's display face,
// its line, and on the right the process its transition is built on, drawn here in SVG (the maze,
// the vortex, crystal growth, layers of peeling sheets, film developed into prints, branching ink). The
// homepage gets the crystal, one facet per destination. Everything is seeded, so a card only
// changes when its words or this file do. Sets <html data-ready> once the fonts are in.
import { carveMaze } from '/static/site/lerp.js';

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
  house: 'A maze carved depth-first', cosmos: 'A vortex', glass: 'Crystal growth',
  folio: 'Layers of sheets', darkroom: 'Film, developed', ink: 'Branching ink',
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
  const TEAL = [41, 204, 219], BLUE = [61, 117, 235], ORANGE = [252, 158, 61];
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
    <linearGradient id="core" x1="0" x2="1"><stop offset="0" stop-color="rgb(252 158 61)" stop-opacity="0"/><stop offset="0.5" stop-color="rgb(252 158 61)" stop-opacity="0.2"/><stop offset="1" stop-color="rgb(252 158 61)" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#neb1)"/><rect width="${W}" height="${H}" fill="url(#neb2)"/>${stars}
  <g mask="url(#fade)"><rect x="${C[0] - 26}" y="0" width="52" height="${H}" fill="url(#core)"/><g fill="none" stroke-linecap="butt" stroke-linejoin="round">${lines}</g></g>`;
};

// Racing: crystal growth. Six-fold dendrites nucleated at different moments, so they reach
// different sizes; side branches leave each arm at 60 degrees and shorten toward the tip.
ART.glass = () => {
  const r = rng(5);
  const dendrite = (cx, cy, R, rot) => {
    let d = '';
    for (let k = 0; k < 6; k++) {
      const a = rot + k * Math.PI / 3, ux = Math.cos(a), uy = Math.sin(a);
      d += `M${f(cx)} ${f(cy)}L${f(cx + ux * R)} ${f(cy + uy * R)}`;
      for (let t = 0.2; t < 0.93; t += 0.105) {
        const L = R * (1 - t) * (0.42 + 0.16 * Math.sin(t * 17 + k)), px = cx + ux * R * t, py = cy + uy * R * t;
        for (const sg of [-1, 1]) { const b = a + sg * Math.PI / 3; d += `M${f(px)} ${f(py)}L${f(px + Math.cos(b) * L)} ${f(py + Math.sin(b) * L)}`; }
      }
    }
    const plate = Array.from({ length: 6 }, (_, k) => { const a = rot + k * Math.PI / 3; return `${f(cx + Math.cos(a) * R * 0.15)},${f(cy + Math.sin(a) * R * 0.15)}`; }).join(' ');
    return `<path d="${d}" stroke="#fff" stroke-width="${f(Math.max(4, R / 22))}" stroke-opacity="0.55" filter="url(#soft)"/>
      <path d="${d}" stroke="${C.accent}" stroke-width="${f(Math.max(1, R / 120))}" stroke-opacity="0.55" transform="translate(1.5 1.5)"/>
      <path d="${d}" stroke="#fff" stroke-width="${f(Math.max(1.4, R / 90))}"/>
      <polygon points="${plate}" fill="#fff" fill-opacity="0.7" stroke="${C.accent}" stroke-opacity="0.5"/>`;
  };
  const seeds = [[925, 318, 250], [1150, 80, 120], [1130, 560, 105], [700, 560, 70], [760, 90, 58], [1185, 330, 46], [640, 300, 30]];
  return `<defs>${fade(470, 700)}<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    <radialGradient id="orb1" cx="0.8" cy="0.25" r="0.4"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.3"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="orb2" cx="0.95" cy="0.9" r="0.35"><stop offset="0" stop-color="${C.accent2}" stop-opacity="0.32"/><stop offset="1" stop-color="${C.accent2}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#orb1)"/><rect width="${W}" height="${H}" fill="url(#orb2)"/>
  <g mask="url(#fade)" fill="none" stroke-linecap="round">${seeds.map(([x, y, R]) => dendrite(x, y, R, r() * Math.PI / 3)).join('')}</g>`;
};

// Outdoors: peeling sheets. Engraved sheets stacked in a folio; the top one's corner folds back
// along a straight crease, its gilt underside the corner reflected across that crease.
ART.folio = () => {
  const w = 430, h = 500, r = rng(3);
  const engraving = (seed) => {
    const q = rng(seed); let ridge = '', hatch = '';
    const ys = [];
    for (let x = 0; x <= w; x += 6) {
      const y = 250 - 120 * Math.exp(-(((x - 250) / 110) ** 2)) - 55 * Math.exp(-(((x - 110) / 70) ** 2)) + 10 * Math.sin(x * 0.11) + 6 * q();
      ys.push([x, y]); ridge += `${x ? 'L' : 'M'}${x} ${f(y)}`;
    }
    for (const [x, y] of ys) if (x % 12 === 0) hatch += `M${x} ${f(y + 6)}L${x} ${f(y + 40 + 90 * q())}`;
    let sun = ''; for (let k = 0; k < 5; k++) sun += `<circle cx="330" cy="110" r="${18 + k * 9}" fill="none" stroke-opacity="${f(0.7 - k * 0.12)}"/>`;
    let lines = ''; for (let y = 330; y < h - 40; y += 16) lines += `M40 ${y}L${f(w - 40 - q() * 140)} ${y}`;
    return `<g stroke="${C.accent}" fill="none" stroke-width="1.2">${sun}<path d="${ridge}" stroke-width="2"/><path d="${hatch}" stroke-opacity="0.55"/><path d="${lines}" stroke-opacity="0.3" stroke-width="2"/></g>`;
  };
  const sheet = (tx, ty, rot, curl) => {
    let body = `<rect width="${w}" height="${h}" fill="${C.surface}" stroke="${C.accent}" stroke-opacity="0.65" stroke-width="1.5"/>
      <rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="none" stroke="${C.accent}" stroke-opacity="0.35"/>${engraving(tx | 0)}`;
    if (!curl) return `<g transform="translate(${tx} ${ty}) rotate(${rot})">${body}</g>`;
    // The crease runs from A (bottom edge) to B (right edge); the corner (w, h) folds over it.
    const A = [w - 190, h], B = [w, h - 230];
    const ux = B[0] - A[0], uy = B[1] - A[1], L = Math.hypot(ux, uy), u = [ux / L, uy / L];
    const p = [w - A[0], h - A[1]], dot = p[0] * u[0] + p[1] * u[1];
    const Cp = [A[0] + 2 * dot * u[0] - p[0], A[1] + 2 * dot * u[1] - p[1]];
    const clip = `<clipPath id="peel"><polygon points="0,0 ${w},0 ${B.join(',')} ${A.join(',')} 0,${h}"/></clipPath>`;
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    let glitter = '';
    for (let i = 0; i < 26; i++) {
      const t = r(), off = 8 + r() * 70, x = A[0] + ux * t - u[1] * -off * 0.2 + (Cp[0] - mid[0]) * r() * 0.8, y = A[1] + uy * t + (Cp[1] - mid[1]) * r() * 0.8, s = 2 + r() * 5;
      glitter += `<path d="M${f(x)} ${f(y - s)}L${f(x + s * 0.22)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x - s * 0.22)} ${f(y)}ZM${f(x - s)} ${f(y)}L${f(x)} ${f(y + s * 0.22)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y - s * 0.22)}Z" fill="#FFF3D6" fill-opacity="${f(0.5 + r() * 0.5)}"/>`;
    }
    return `<g transform="translate(${tx} ${ty}) rotate(${rot})"><defs>${clip}
        <linearGradient id="gilt" x1="${f(mid[0])}" y1="${f(mid[1])}" x2="${f(Cp[0])}" y2="${f(Cp[1])}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#FFF1CF"/><stop offset="0.18" stop-color="${C.accent}"/><stop offset="0.6" stop-color="#9A7436"/><stop offset="1" stop-color="#E9C987"/></linearGradient></defs>
      <g clip-path="url(#peel)">${body}</g>
      <polygon points="${A.join(',')} ${B.join(',')} ${f(Cp[0])},${f(Cp[1])}" fill="#000" fill-opacity="0.45" transform="translate(10 14)" filter="url(#shade)"/>
      <polygon points="${A.join(',')} ${B.join(',')} ${f(Cp[0])},${f(Cp[1])}" fill="url(#gilt)"/>${glitter}</g>`;
  };
  return `<defs>${fade(500, 700)}<filter id="shade" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <radialGradient id="glow" cx="0.75" cy="0.45" r="0.5"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g mask="url(#fade)">${sheet(700, 92, -7)}${sheet(712, 74, -2.5)}${sheet(726, 60, 2, true)}</g>`;
};

// Photography: film pulled off the table in coils, sprocket holes along both edges (a wide dashed
// stroke under a narrower one shows only in the margins), over prints developing in the red tray,
// white-bordered, each a little askew, coming up from a halftone screen.
ART.darkroom = () => {
  const r = rng(6);
  let prints = '', defs = '';
  const cells = [[640, 300], [860, 330], [1080, 300], [700, 470], [920, 500], [1140, 470], [760, 140], [1000, 150]];
  cells.forEach(([x, y], i) => {
    const w = 190, h = 136, a = (r() - 0.5) * 12, dev = i / cells.length;
    defs += `<pattern id="ht${i}" width="${f(9 - 5 * dev)}" height="${f(9 - 5 * dev)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="${f((9 - 5 * dev) / 2)}" cy="${f((9 - 5 * dev) / 2)}" r="${f(1.6 + 1.6 * r())}" fill="#9FB58C" fill-opacity="${f(0.5 + 0.4 * dev)}"/></pattern>`;
    prints += `<g transform="rotate(${f(a)} ${x} ${y})"><rect x="${x - w / 2 + 8}" y="${y - h / 2 + 10}" width="${w}" height="${h}" fill="#000" fill-opacity="0.45" filter="url(#soft)"/>
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#EDEAE3"/>
      <rect x="${x - w / 2 + 9}" y="${y - h / 2 + 9}" width="${w - 18}" height="${h - 18}" fill="#1F2E22"/>
      <rect x="${x - w / 2 + 9}" y="${y - h / 2 + 9}" width="${w - 18}" height="${h - 18}" fill="url(#ht${i})"/></g>`;
  });
  const film = d => `<path d="${d}" stroke="#2A1408" stroke-width="58"/><path d="${d}" stroke="#0B0705" stroke-width="50" stroke-dasharray="5 7"/>
    <path d="${d}" stroke="#C9783F" stroke-width="38"/><path d="${d}" stroke="#5A2A12" stroke-width="38" stroke-dasharray="2.5 58"/>
    <path d="${d}" stroke="#FFE2C2" stroke-opacity="0.25" stroke-width="6" transform="translate(-6 -9)"/>`;
  return `<defs>${fade(500, 700)}${defs}<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <radialGradient id="safe" cx="0.78" cy="0.55" r="0.6"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.accent2}" stop-opacity="0.05"/></radialGradient></defs>
  <g mask="url(#fade)"><rect width="${W}" height="${H}" fill="url(#safe)"/>${prints}
    <g fill="none" stroke-linecap="butt">${film('M560 640 C 700 520, 900 600, 980 470 S 1220 300, 1080 210 S 820 220, 900 80 S 1120 -40, 1240 40')}
    ${film('M1240 600 C 1120 560, 1060 420, 1150 360 S 1300 330, 1260 230')}</g></g>`;
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
