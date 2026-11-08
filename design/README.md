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
| Science | **A vortex** (after the Burgers vortex, an exact solution of the Navier–Stokes equations): the page breaks into cubes along a funnel, starting right under the band above and travelling down toward Science; each spirals in toward an upright axis, turns fastest round its glowing core while the flow pulls it down the axis toward Science (the stretching), then spirals out lower down and lands mirrored, sky face up. The bottom rows dive out into Science; the top rows are refilled by cubes swirling down from the band above. Streamline ribbons trace the helices, teal where they turn slowly, orange at the core. On a click the funnel runs from the link across the page, building it as it goes. |
| Racing | **Crystal growth**: nuclei appear across the screen and grow as six-armed stars, fastest along their arms (after Reiter's snowflakes), until they meet along bright grain boundaries (a Johnson–Mehl tessellation); each crystal flashes and clears. |
| Outdoors | **Peeling sheets**: brick-laid panes peel back in a diagonal sweep, each a page curl from one corner (half a turn round a cylinder, then laid flat over itself), gilt underneath with the engraving pressed in; ice glitters, dust breaks loose, a caustic net pools beside each fold. On a click, gilt rolls unroll the plate across the panes. |
| Photography | **A camera iris**: nine blades close as the light inside warms and overexposes, a diffraction star flares as they meet, and they open onto the darkroom, which develops from a **halftone** screen through **Bayer dithering** to full tone, with nine-sided bokeh. |
| Chess | **Branching ink**: a few trunks fork three times as they go (each level twice the branches), soft fingers that swell and pool, then the wash; strokes trace the vortex flow. |

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
scroll while its transit plays, then scrolls away as the next band arrives. The transit runs over
the hold plus 0.35 of a screen either side, about 2.5 screens in all.

- **One process each.** Each seam runs its destination's process (above); the upper world comes
  apart into its own units, which fly, flow and settle into the lower world.
- **Pure function of scroll.** Progress `p` (0..1 through the hold) maps to `P = transitP(p)`, and
  each point flies while `P` passes its arrival (`flightAt`, `vortexU`, `paneA`; the iris reads
  `p` itself). Everything is computed from that and
  the seed alone, so scrolling back un-builds the world exactly; stopping mid-seam leaves the units
  hanging, still gently moving.
- **Clean edges.** `P` runs past both ends, so the strip is entirely the upper world while its top is
  on screen above the hold, and entirely the lower one while its foot is on screen below.
- **Chameleon units.** A unit carries the upper world's colour where it leaves and the lower
  world's where it lands.
- **Fallbacks.** With motion off there are no holds: a still, plain seam straddles each boundary as
  before. Before the transit shaders are ready, the hold shows the plain seam.

| From → to | Process | Units | Transit |
| --- | --- | --- | --- |
| About Me → Science | a vortex (a longer hold: `HOLD.longer`, starting as the strip's top comes on screen) | ~18,000 cubes, ~1,600 streamlines | The paper breaks into cubes along a funnel, starting right under About Me. They spiral in, tumbling, turn fastest at the glowing core (coloured by speed, teal to orange) while it pulls them down toward Science, then spiral out lower and land mirrored, sky face up; the swirl travels down the page and is still turning as Science arrives. Scrolling back draws it all back up. |
| Science → Racing | crystal growth | the liquid itself | Space liquefies and swirls in vortices, stirred by a real fluid sim (scroll and pointer push it), while six-armed crystals nucleate across it, grow and meet; each holds the swirl at its own tilt, then flashes and clears to the glacier. |
| Racing → Outdoors | page curl | 4–5 rows of panes, ice dust | The ice cracks along the panes' edges; each pane peels back from a corner in a diagonal sweep, its gilt engraved underside laid over itself, glitters, sheds dust and tumbles away. |
| Outdoors → Photography | iris, halftone, dither | none | Nine blades close over the plate as it warms and overexposes; a diffraction star; they open on the darkroom developing from halftone to dither to tone, safelight blooming, bokeh drifting. |
| Photography → Chess | branching ink | ~3,000 ink filaments | Ink fingers climb and fork; the darkroom lets go of its black like ink dropped in water, tapering strokes sinking along the flow, then bleeding into the wash along a granulating wet edge. |

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
  | `flight.js` | The processes' maths, shared by every transition: the ink's branching reach, crystal growth, the vortex, the panes' sweep and curl, each point's flight, the swirl, and reading a baked field |
  | `reach.js` | Drawing shared by seams and clicks: the ink, the vortex's core, the iris, bokeh, halftone and Bayer development |
  | `transit.js` | The seams' ground (mode 8): live worlds at rest, snapshots where things move, each seam's process over both |
  | `units.js` | The instanced units (cubes and streamlines, sheets, ice dust, ink filaments), the fluid sim's passes and the bake (ink or crystals) |
  | `opens.js` | The click transitions (cover, reveal, fog): the maze, the vortex (its cubes drawn over by `transit.js`), crystals, unrolling sheets, the iris, ink |

  The canvas buffer drops its resolution when frames run long, and the pages fall back to their CSS art when even that is not enough.
- **Transits.** `static/site/scene/transit.js` takes over each seam whose pair it knows. Each frame:
  - It renders the two worlds over the strip into half-resolution snapshots, refreshing one of the
    two per frame, with the scene's own shader (offset by `uOrigin`).
  - For Science → Racing it steps the fluid: a 128-cell RG16F grid that advects, adds forces and
    projects with 12 Jacobi iterations. It needs `EXT_color_buffer_float`; without it, the swirl
    alone drives the flow.
  - Fields that depend only on the strip's size (the ink's reach, the crystals) are baked once into a
    texture and read by the ground and the units; a click's reach, crystals or maze are made once per
    click the same way.
  - It draws the ground, then the units, with one or two instanced draw calls per seam.
  - Only seams on screen do any work, and only rows of units that can be in flight are drawn.
  - The grids coarsen on touch screens and when the resolution governor has stepped down.
  - The programs compile in parallel (`KHR_parallel_shader_compile`) or one per idle moment. Each
    draws a single pixel once it is ready, so the GPU builds its pipeline before the seam appears.
  - The pure maths (`transitP`, `flightAt`, `arrivalRange`, `activeRows`, `holdAt`, `paneArrival`,
    `irisOpen`, `vortexA`, `vortexTurn`, `vortexAt`, `carveMaze` in `lerp.js`) is tested in
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
  - The reveal plays behind the new page's hero, whose letters arrive at the same time.
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
