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
| 02 | Science | **Liquid Cosmos** | deep space `#05060F`, `#ECE9FF`, cyan `#22E6FF`, magenta `#FF3DCB` | Unbounded, JetBrains Mono | A nebula and stars; liquid-chrome drops with thin-film colour; instrument brackets tracking them | TRAPPIST-1 live, with its transit light curve |
| 03 | Racing | **Glacier** | ice `#E8F0F6`, `#0A1E2C`, glacier blue `#1767C2`, mint `#2BD9A8` | DM Sans | Caustic light through ice, contours, snow | The Birkie drawn at race pace while the clock runs to 2:28:49.04 |
| 04 | Outdoors | **Naturalist's Folio** | forest `#0F1913`, parchment `#EEE4CE`, brass `#CDA562` | Cormorant | A copperplate-engraved forest with a lantern | The 48 as an engraved skyline, lit in the order climbed |
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
| Racing | **Stardust, then frost**: a few of Science's giants end, spaced so each nebula stays whole and only the outer fringes of neighbours cross. The hot supergiants go supernova (a flash along the ⁵⁶Ni → ⁵⁶Co light curve, a light echo, the gas flaring in [O III] then glowing in Hα; the remnant free, then Sedov–Taylor) as four different remnants: the Crab (a flickering pulsar in synchrotron light inside a cage of filaments), Cassiopeia A (a knotty ring with a jet), the Veil (braided arcs, red inside, blue-green out) and SN 1987A (a ring of hot spots lighting one by one). The cool giants shed planetary nebulae: the Cat's Eye, the Ring, the Butterfly. Their gas breaks into cores; the stardust spirals into each along exact collapse orbits (r = r₀cos²β, θ = θ₀ + Ω tan β), every drop a whirlpool of its gas's colours, its volume growing at a steady rate as the grains arrive. The drops are coloured water: lenses traced exactly (the nebula behind each inverted), deeper in colour where deeper (Beer–Lambert), merging by volume, the stardust still turning inside them. Then a freezing chain reaction runs in from the frame's edges: frost bridges leap from drop to drop, each drop flashing milky as it freezes into a bead of coloured ice and throwing off a frost halo, the middle last. The larger drops seed snow crystals in their own colours, each of its own habit (mostly fernlike and stellar dendrites, some plates) and none alike, with hoarfrost feathering in behind and grains of frost glittering, until they meet across the pane; their boundaries split into fissures where electricity crawls. The main crack takes the charge, surges and shakes; it opens in an ellipse (Griffith–Irwin), lightning bridging it until each bolt snaps, a sunrise breaking behind. Then the field: a fracture front runs out and the pane comes apart into thousands of fragments, which turn to lie along the electric field between the crack and Racing's card and are vacuumed along its lines in sweeping arcs, spinning and flashing, the field glowing as they go, into the card, which frosts from where they land, flashes and anneals clear while the heading and text condense from frost (the slowest stretch of the scroll). The page holds still until then (P 1.2). A click forms the dew and crystals outward from the click and shatters from there. |
| Outdoors | **Layers of sheets**: three layers lie over the page (the glacier's ice, a topographic trail map, tracing vellum), each of brick-laid sheets, and each peels from the foot of the screen up a little after the layer above, so the sheets come away in waves. A sheet curls from a corner of its own (a page curl), then lets go and flies like paper: unrolling, cupping, twisting along its length and fluttering, its normals taken from the bent surface. The ice's undersides are gilt; ice dust breaks loose; a caustic net pools under each fold. On a click, gilt rolls unroll the plate across the panes. |
| Photography | **Film, developed**: strip by strip from the foot of the screen, a flash crosses the page and it turns to 35 mm colour negative (orange mask, sprocket holes, frame lines); each strip is pulled off the table from one end into a rising, twisting helix of film. Where it has gone, the frames come up as prints in the developer, white-bordered and askew, from a **halftone** screen through **Bayer dithering** to full tone, ripples spreading under the safelight; they dissolve into the Photography page as it arrives. On a click, **a camera iris** closes and opens on the darkroom. |
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
and Photography, whose headings follow straight after). Each starts slowly (`holdEase`). Science's
hold is 1.6 times the others', Outdoors' and Photography's 1.25, Chess's 1.2 (`HOLD.by` in `lerp.js`).

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
| Science → Racing | supernovae, collapse into rain, frost, the rift, field lines into the card | ~2,000–5,000 fragments and their field lines, drawn instanced (a still of the frozen pane for their faces); the lit gas drawn at a fraction of the resolution each other frame; a worker-prepared plan (the supernovae, the gravitational cores, condensation times, drops, merges, runners, the freezing chain's bridges, crystal cells and habits, the main crack, the fracture front, each fragment's traced field line, the card's frost clock, tile lists) | Supernovae, light echoes and the gas they light; gravitational collapse into raindrops; runners; a freezing chain; snow crystals of many habits; electric fissures; the main crack's surge and shake; the rift; fragments along field lines; Racing's card crystallizing in place. All a function of scroll progress, so it plays back in reverse; Racing's hold paces it, the ending slowest. |
| Racing → Outdoors | layers of sheets | 3 layers of ~60–110 sheets, ice dust | The ice cracks along its sheets' edges; layer under layer (ice, trail map, vellum), sheets peel from a corner of their own and fly off like paper, unrolling, cupping, twisting and fluttering. |
| Outdoors → Photography | negative film, prints developing | ~11 film strips | A flash turns each strip to a negative with sprocket holes; it is pulled off into a rising, twisting helix; prints of its frames develop in the tray beneath, halftone to dither to tone, under the safelight. |
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
