# A sentence for a front door, six destinations

The homepage is one sentence in Alex's voice. Its phrases are the menu, and the crystal beside it
is a gem with one facet per destination. Below come six bands, one per destination, each in its
own style and each with one piece that shows something true. One WebGL canvas draws every style's
world, the crystal, the seams where two bands meet and the click-to-expand effects, all from code:
there are no renders, no video and no 3D models. Photographs are real photographs. Without WebGL
(or on a software renderer), the CSS and SVG art stands in.

| # | Destination | Style | Palette | Type | World (scene) | The band's piece |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | About Me | **House** | paper `#F4F2EE`, ink `#141416` | DM Sans | Paper | The role, three threads, three things built, and a strip of the AI Power Map's 224 moments you can read along |
| 02 | Science | **Liquid Cosmos** | Hubble's narrowband gold and teal (`static/site/scene/palette.js`, one source for the page, the sky and the transition): navy `#04080F`, `#EAF3F3`, teal `#3FDCD2`, gold `#F5B451`, cream `#F1DCAE` | Unbounded, JetBrains Mono | A nebula and stars; liquid-chrome drops with a gold-and-teal oxide sheen; instrument brackets tracking them | TRAPPIST-1 live, with its transit light curve |
| 03 | Racing | **Glacier** | ice `#E8F0F6`, `#0A1E2C`, glacier blue `#1767C2`, mint `#2BD9A8` | DM Sans | Caustic light through ice, contours, snow | The Birkie drawn at race pace while the clock runs to 2:28:49.04 |
| 04 | Outdoors | **Naturalist's Folio** | forest `#0F1913`, parchment `#EEE4CE`, brass `#CDA562` | Cormorant | The White Mountains as a Frank Lloyd Wright art-glass window at dusk, with a lantern | The 48 as an engraved skyline, lit in the order climbed |
| 05 | Photography | **Darkroom** | black `#0B0A09`, print white `#F2EEE6`, safelight `#E5483F` | DM Sans 300, JetBrains Mono | A red safelight, the tray's ripples, dust in the beam | A reel of twelve prints that develop as they reach the middle |
| 06 | Chess | **Ink & Mist** | paper `#F3EEE3`, ink `#1C1A17`, indigo `#2F4A6B` | Shippori Mincho | Ink-wash ridges and mist, with no cultural motifs | The Scotch playing on a brushed board, live ratings |

## The hero

> I'm Alex Crystal, a **generative AI engineer at MITRE**. I **race on skis and on foot**, have stood
> on **all 48 of New Hampshire's 4,000-footers**, **photograph the places I go**, **chase the strange
> corners of science**, and **play the Scotch**.

- **Pointing at a phrase** (hover, focus, or a facet of the crystal) floods the gem with that world from its facet, behind a prismatic front, and swaps the line beneath the sentence for a fact.
- **Clicking a phrase** expands into the page from the crystal.
- **On touch screens:**
  - the first tap shows the world, and the second opens the page;
  - until someone taps, the crystal tours the worlds every 5 s.

## Transitions: one process per destination

Every transition plays across the whole screen, the old page showing through until the new world
covers it, and each destination is told apart by its **process**, not its colours: in grayscale at
half speed no two look alike. The same process carries you in whether you scroll into the band or
click through to the page (`flight.js` holds the maths, `reach.js` and `opens.js` the drawing):

| Destination | Process |
| --- | --- |
| About Me, Résumé, Contact | **A maze carved by depth-first backtracking** from the click (a random spanning tree, carved on the CPU by `carveMaze` in `lerp.js`): corridors open down long winding passages and back out of dead ends, inked at their walls, and last the walls fill with paper; the ink fades in reverse order. |
| Science | **A vortex** (after the Burgers vortex, an exact solution of the Navier–Stokes equations) standing on the foot of the screen right beneath About Me and growing taller: a wide base, a trumpet closing into an orange core, a rim whirling at the top. The page is gathered into cubes up the screen behind its top, each height over a long window so some cubes lag (the foot is still giving up cubes as the upper middle starts). Each cube goes round the vortex one and a half to four and a half times, rising with the wind, in one of five swarms (a density wave turning with the wind), solid in front of the axis and pale glass behind it; then it is thrown down and out, swerving along a stretch of the Lorenz attractor, onto its new cell. A greedy schedule (lerp.js vortexPlan) builds the bottom corners first, then upward and inward, the middle top last; the wind's base leaves the foot once the gathering is done and climbs the screen, sharpening it. Where a cube has gone the paper shows an empty socket; the cubes bring Science in heavily blurred, and a narrow clearing front follows immediately beneath the vortex's lifting base. Each cell stays blurred a while after it is built and throughout the vortex itself, then sharpens just after the base passes. Science scrolls into the cleared foot while the vortex is still leaving, with its heading aligned to the top of the section. On a click the funnel runs from the link across the page, building it as it goes. |
| Racing | **Stardust, then frost**: one story, out and in and out and in. Seven of Science's giants end (four on a phone), spread so each remnant has room of its own and only the outer fringes of neighbours cross, red supergiants as well as blue (red ones are type II-P progenitors). Each breaks out in a flash that swells rather than pops (the ⁵⁶Ni → ⁵⁶Co light curve, a light echo, the gas flaring in [O III] then glowing in Hα) and leaves a spherical remnant, free then Sedov–Taylor: a shell seen through, limb-brightened by integrating along the line of sight, its gas in wisps of three-dimensional turbulence front and back, Rayleigh–Taylor fingers on its inner edge, teal ejecta knots within, a thin rim at the forward shock, a dark cavity where it swept the gas up. Gold and teal throughout (Science's palette). Then gravity's spots: the cooled gas breaks into clumps about a Jeans length apart (closer where dense), each cell of gas visibly falling in on itself (uniform free fall), the lanes between going dark, each snapping into a glowing lens drop of its gas's colour; Science's stars condense into beads (the plan repeats the sky's hash). A held moment: the windshield of jewels. Racing's card appears in place as a ghost of cold glass; a front of frost spreads from it; each drop flashes milky (recalescence), freezes through from its rim (Stefan, τ ∝ r²), grows its freezing tip and splits along ice's 60° planes into shards (Science's chrome drops into finer mirror pieces). Racing's card pulls everything in along its field lines (the frame +, the card −): the shards accelerate, align, spin and flash, fusing into the card; the old world drains in along the same lines (line integral convolution) and Racing's world shows behind, at night, outward from the card. The card fills with the light it took in, then gives it back: a ring of light goes out from it (as the supernovae's did at the start), dawn, then Racing's day; the card anneals into its glass card and the heading and text condense from frost (the slowest stretch of the scroll). The page holds still until then (P 1.2). A click plays the same story about the click in two and a half seconds: a star dies at the click and its light races out as a ring, lighting the remnants' gas over the old page; the gas falls into drops, the cold spreads from the click, and the click draws every shard in (a point sink: r = r₀√(1 − t/T)); Racing's night is left and the light gathers at the click, a new star, which once the page has changed goes out as the ring of dawn the new page opens behind. |
| Outdoors | **The mountains rise**: Racing's white ice settles into a primed canvas, seen from straight above, and thick paint lands on it a drop at a time: green, white-ish, yellow, orange and red splashes with fingers, satellite drops and spray, random at first, though each is the colour of the land where it falls. Soon the paint creeps out along its own kind of land (the forest's green up the slopes, the hardwoods' colours down the valleys, white along the high ridges), each blotch drawing back along the contours, until the canvas is the painted map of the White Mountains; the lakes are struck in last, in blue. The painting rises into relief and becomes the land as the camera dives past Franconia Ridge, along the Garfield Ridge to the Twins, over the Pemigewasset Wilderness to the Bonds, then turns to the Presidential Range: single crowns of spruce, fir, maple and birch, granite slabs, the first snow high up, level lakes mirroring the mountains, in a low October sun. It rises to look straight down: the map draws its contour lines in, low to high, marks the 48 and dashes in the Pemi Loop; then the land settles flat into its map, dusk falls, the contours straighten onto a square module and thicken into came, and the light comes through the glass band by band, the summits glowing red in the order they were climbed. A click leads the window from the click instead: molten lead runs out along its came, glowing at its tip, while the page dims into the dark glass; then the last light passes outward through it. |
| Photography | **The thickness of a moment**: Outdoors' lantern sweeps its art-glass window and the glass remembers (echoes, a glint's hairline, the newest light cool, the remembered warm); time becomes depth, the view eases aside through a sculpture of the evening (a ribbon, leaf veils, ruby threads), and the depth closes into the long exposure. A **focal-plane curtain** ends it; under the safelight the sheet tips into the developer and the evening comes up, **darkest first** (H&D). On a click, a light sweeps the page from the click, remembered, the curtain closes, and the page develops behind a meniscus. |
| Chess | **Branching ink**: eight trunks climb from the foot of the screen and fork three times (each level twice the branches), soft fingers that swell and pool; around them ink billows into the water in clouds (domain-warped noise, thickest near the branches); strokes trace the flow; the darkroom clears into wash behind. The ink stays until it lets go as Chess arrives. |

**Clicks** (a menu item, a band, a phrase, a next-page card) cover in 1.3 s and reveal in 1.2 s.
Escape or a click skips to the end. **History steps** roll fog in and out in the destination's
colours (0.9 s each); **back to the homepage** still folds the page into its band.

**What it's made of.** Each band on the homepage has an information button in its corner (a native
popover) listing the algorithms behind its world, its live piece and the transition into it.
Science lists every algorithm on the site, by field (`#algorithms`). Both come from one file,
`science/page/algorithms.json`.

## Seams

With motion on, each seam has a stretch of page of its own, its **hold** (`home.js`, `HOLD` in
`lerp.js`): the seam scrolls in with the page, fills the screen and stays put for 1.75 screens of
scroll while its transit plays, then scrolls away as the next band arrives. The transit is drawn on
the whole screen as if already held; the strip's place on screen only reveals it. So it begins as
soon as the strip's top comes on screen (0.95 of a screen before the hold), from the foot of the
screen, right beneath the band above, and ends a fifth of a screen after (less for Racing, Outdoors
and Photography, whose headings follow straight after). Each starts slowly (`holdEase`); Racing,
Outdoors and Photography pace theirs by a stretch table instead (`glassEase`, `folioEase`,
`darkroomEase`), slowest at their endings.
Racing's hold is 4 times the others', Photography's 3.6, Outdoors' 3.2, Science's 1.6, Chess's 1.2
(`HOLD.by` in `lerp.js`).

- **One process each.** Each seam runs its destination's process (above); the upper world comes
  apart into its own units, which fly, flow and settle into the lower world.
- **Pure function of scroll.** Progress `p` (0..1 through the hold) maps to `P = transitP(p)`, and
  each point flies while `P` passes its arrival (`flightAt`, `vortexU`, `layerA`, `filmU`).
  Everything is computed from that and
  the seed alone, so scrolling back un-builds the world exactly; stopping mid-seam leaves the units
  hanging, still gently moving.
- **Clean edges.** `P` runs past both ends, so the strip is at rest at both. Every process starts at
  the foot of the screen, so while the strip scrolls in, what lies at its top edge beside the band
  above is still at rest; and each has finished at the foot before the strip's foot shows above the
  band below.
- **Chameleon units.** A unit carries the upper world's colour where it leaves and the lower
  world's where it lands.
- **Fallbacks.** With motion off there are no holds: a still, plain seam straddles each boundary as
  before. Before the transit shaders are ready, the hold shows the plain seam.

| From → to | Process | Units | Transit |
| --- | --- | --- | --- |
| About Me → Science | a vortex | one cube a cell (~4,000 at 18 px; about a third in the air at once), ~1,400 flow lines | The vortex stands on the foot of the screen and grows taller; the page is gathered up the screen behind its top, some cubes lagging; the cubes swirl round it in five swarms and are thrown down and out, building Science from the bottom corners upward and inward, blurred; the vortex's base then lifts and climbs, sharpening it. |
| Science → Racing | spherical remnants, gravity's spots gathering their gas into drops, the stars condensing into beads, cold from Racing's card freezing and splitting them, the vacuum pulling the shards along field lines into the card, its light given back as Racing's dawn | a drop a record (~400–600 clumps and the stars' beads) and ~600–4,000 shards, each with its field line, drawn instanced (the drops' lenses read Science's snapshot and its gas); the lit gas drawn at a fraction of the resolution each other frame until the clumps start to fall; a worker-prepared plan (the supernovae, the gas mirrored from the shader, the Jeans clumps and their cells and falls, the beads, the freeze, the shards and their traced lines, the field grid, the card's fuse clock; a click's shards fly on the click's clocks, computed in the shader) | Supernovae, light echoes and the gas they light; spherical remnants; the Jeans instability and free fall; the stars condensing; freezing drops (recalescence, the Stefan problem, the tip singularity, 60° cleavage); field lines and line integral convolution; the card's light out as a ring. All a function of scroll progress, so it plays back in reverse; Racing's hold paces it, the dawn slowest. |
| Racing → Outdoors | paint into the White Mountains into art glass | none (a 2D painting, then a raymarched heightfield of the 48; the land, its water and the paint's plan built once in a worker) | Racing's ice becomes a canvas; drops of paint splash onto it and creep out along the land until it is the painted map; it rises into the White Mountains, flown in an October afternoon; from straight above, the map draws its contours, which are leaded into Outdoors' window as the light comes through it. |
| Outdoors → Photography | the thickness of a moment | none (live: the window baked still; the evening in depth and the exposure drawn into textures) | Outdoors' lantern sweeps the art-glass window and its earlier light lingers (echoes, a glint's hairline, warm to cool); time becomes depth and the view eases aside: the lantern's reflection a twisted ribbon, falling leaves curved veils, the summits ruby threads; the depth closes into the long exposure, a focal-plane curtain ends it, the last red reflection becomes the safelight; the sheet tips into the developer from a corner and the evening develops, darkest first, and settles into Photography's tray. |
| Photography → Chess | branching ink | ~4,000 ink filaments | Eight trunks of ink climb and fork; ink billows into clouds around them; strokes trace the flow; the darkroom clears into wash; the ink lets go as Chess arrives. |

Each band's world also sweeps a prismatic sheen across itself once, the first time it scrolls in.

## How it works

- **Homepage.**
  - `static/site/home.js` registers scene hosts:
    - the hero, with the crystal (mode 7);
    - one per band (its world, mode 0);
    - one per seam (mode 6), full screen and held while in its hold.
  - It also runs:
    - the sentence;
    - the bands' arrivals;
    - each band's piece (`powermap.js`, `race-pace.js`, `skyline.js`, `sims.js`, `previews.js`);
    - the header's ink.
  - Per frame it reads `scrollY` and nothing else from the layout; the layout is measured on resize.
- **Scene.** `static/site/scene/scene.js` owns a fixed canvas behind every page that survives router swaps. The shader is in `static/site/scene/glsl/`:

  | File | What it holds |
  | --- | --- |
  | `house.js` | The crystal and the paper |
  | `ink.js`, `glacier.js`, `cosmos.js`, `folio.js`, `darkroom.js` | The worlds |
  | `seams.js` | The plain seams (reduced motion, and while the transits compile) |
  | `flight.js` | The processes' maths, shared by every transition: the ink's branching reach, the vortex, the panes' sweep and curl, each point's flight, the swirl, and reading a baked field |
  | `reach.js` | Drawing shared by seams and clicks: the ink, the vortex's core, the iris, bokeh, halftone and Bayer development |
  | `transit.js` | The seams' ground (mode 8): live worlds at rest, snapshots where things move, each seam's process over both |
  | `units.js` | The instanced units (cubes and streamlines, sheets, ice dust, ink filaments) and the bake (the ink's reach) |
  | `opens.js` | The click transitions (cover, reveal, fog): the maze, the vortex (its cubes drawn over by `transit.js`), polarised fractured ice, unrolling sheets, the iris, ink |

  The canvas buffer drops its resolution when frames run long, and the pages fall back to their CSS art when even that is not enough.
- **Transits.** `static/site/scene/transit.js` takes over each seam whose pair it knows. Each frame:
  - It renders the two worlds over the strip into half-resolution snapshots, refreshing one of the
    two per frame, with the scene's own shader (offset by `uOrigin`).
  - Racing uses `ice-plan.js` in `ice-worker.js`: clipped Voronoi domains, rooted growth networks,
    arrival atlases, finite fractal grooves, conservative candidate lists and scheduled glints.
    `ice-resources.js` caches two viewport sizes and uploads in 32-row chunks. No fluid state is integrated.
    `glsl/ice.js` shares the same material between scroll and click; the spectral LUT is rebuilt by
    `node tools/site/ice_spectrum.mjs` from the attributed CIE datasets in `tools/site/data/`.
  - Fields that depend only on the strip's size (the ink's reach) are baked once into a
    texture and read by the ground and the units; a click's reach or maze is made once per
    click the same way.
  - It draws the ground, then the units, with one or two instanced draw calls per seam.
  - Only seams on screen do any work, and only rows of units that can be in flight are drawn.
  - The grids coarsen on touch screens and when the resolution governor has stepped down.
  - The programs compile in parallel (`KHR_parallel_shader_compile`) or one per idle moment. Each
    draws a single pixel once it is ready, so the GPU builds its pipeline before the seam appears.
  - The pure maths (`holdAt`, `holdEase`, `transitP`, `flightAt`, `arrivalRange`, `layerArrival`,
    `filmArrival`, `vortexSeamA`, `vortexTurn`, `vortexAt`, `carveMaze` in `lerp.js`) is tested in
    `tools/site/tests/lerp.test.mjs`.
  - **Performance.** Measured in headless Chrome on an M1 Max at DPR 2.
    - Scrolling the whole page both ways (about 30 s each way at 1440×900): 4,048 frames, none over
      20 ms, no long tasks, full resolution. At 2880×1800, 3 of 8,051 frames over 20 ms.
    - Each of the six click transitions at 1440×900 and 2560×1440: at most one frame over 20 ms (the
      page swap). During a click the buffer is capped at about 6 megapixels.
    - Computing the reach live in every vertex and pixel cost 30–50% of frames on a 2880×1800
      window; baking it removed that.
    - With one process per destination: every seam held mid-transition runs at 60 fps at full
      resolution on a 2880×1800 window; scrolling the whole page at 1440×900, 4,048 of 4,048 frames
      at 16.7 ms; at 2880×1800, 22 of 8,031 over 20 ms and no long tasks.
- **Expand.** `static/site/expand.js` plugs into the router.
  - The scene draws the cover (the destination's process) in front of the page from the clicked element's rectangle.
  - The router swaps the page underneath.
  - Racing keeps its material above the new page until the radial clearing reaches the heading; a
    conservative circular DOM aperture exposes only fully cleared pixels. Other reveals play behind the hero.
  - Back to the homepage, the page's world fills the screen and folds back into its band.
- **Pages.**
  - Each destination is a package, `<dir>/page/`, holding `meta.json` and `content.html`.
  - `tools/site/build_pages.py` fills the markers in `content.html` from data:

    | Marker | Data |
    | --- | --- |
    | `<!--gen:races-->` | `athletics/page/races.json` |
    | `<!--gen:skyline-->` and `<!--gen:hikes-->` | `outdoors/page/peaks.json` |
    | `<!--gen:extremes-->` (Earth's Extremes, with an engraving per card drawn by `extreme_art`) | `outdoors/page/extremes.json` |
    | `<!--gen:powermap-->` | `ai-timeline/timeline-data.json` |
    | `<!--gen:timeline-->` | `about/page/timeline.html` |

  - The registry's `redirects` become small pages that forward old URLs (`/work/` and the old Coding page).
- **Science.** Each experiment is a module in `science/page/sims/`.
  - It exposes `mount(el, { reducedMotion, compact })`.
  - Its pure maths are exported and tested in `tools/site/tests/science.test.mjs`.
  - Every number comes from a source listed on the page.
- **Fallbacks.**
  - Motion is on by default, whatever the system's reduced-motion setting; the header's Motion
    button pauses it (`ac-motion` in localStorage). With Motion off:
    - the scene holds still;
    - experiments draw one frame;
    - prints are developed;
    - the 48 are lit.
  - Without JavaScript every page is complete and static.
