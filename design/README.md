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
click through to the page (`flight.js` and each process's plan hold the maths, `reach.js`, `opens.js` and each process's own file the drawing):

| Destination | Process |
| --- | --- |
| About Me, Résumé, Contact | **A maze carved by depth-first backtracking** from the click (a random spanning tree, carved on the CPU by `carveMaze` in `lerp.js`): corridors open down long winding passages and back out of dead ends, inked at their walls, and last the walls fill with paper; the ink fades in reverse order. |
| Science | **A vortex** (after the Burgers vortex, an exact solution of the Navier–Stokes equations) standing on the foot of the screen right beneath About Me and growing taller: a wide base, a trumpet closing into an orange core, a rim whirling at the top. The page is gathered into cubes up the screen behind its top, each height over a long window so some cubes lag (the foot is still giving up cubes as the upper middle starts). Each cube goes round the vortex one and a half to four and a half times, rising with the wind, in one of five swarms (a density wave turning with the wind), solid in front of the axis and pale glass behind it; then it is thrown down and out, swerving along a stretch of the Lorenz attractor, onto its new cell. A greedy schedule (lerp.js vortexPlan) builds the bottom corners first, then upward and inward, the middle top last; the wind's base leaves the foot once the gathering is done and climbs the screen, sharpening it. Where a cube has gone the paper shows an empty socket; the cubes bring Science in heavily blurred, and a narrow clearing front follows immediately beneath the vortex's lifting base. Each cell stays blurred a while after it is built and throughout the vortex itself, then sharpens just after the base passes. Science scrolls into the cleared foot while the vortex is still leaving, with its heading aligned to the top of the section. On a click the funnel runs from the link across the page, building it as it goes. |
| Racing | **Stardust, then frost**: one story, out and in and out and in. Seven of Science's giants end (four on a phone), spread so each remnant has room of its own and only the outer fringes of neighbours cross, red supergiants as well as blue (red ones are type II-P progenitors). Each breaks out in a flash that swells rather than pops (the ⁵⁶Ni → ⁵⁶Co light curve, a light echo, the gas flaring in [O III] then glowing in Hα) and leaves a spherical remnant, free then Sedov–Taylor: a shell seen through, limb-brightened by integrating along the line of sight, its gas in wisps of three-dimensional turbulence front and back, Rayleigh–Taylor fingers on its inner edge, teal ejecta knots within, a thin rim at the forward shock, a dark cavity where it swept the gas up. Gold and teal throughout (Science's palette). Then gravity's spots: the cooled gas breaks into clumps about a Jeans length apart (closer where dense), each cell of gas visibly falling in on itself (uniform free fall), the lanes between going dark, each snapping into a glowing lens drop of its gas's colour; Science's stars condense into beads (the plan repeats the sky's hash). A held moment: the windshield of jewels. Five nearby droplets fracture and collapse into a dark centre. The rest fall along worker-integrated gravitational trajectories into a deeply inclined accretion disc, with faster inner orbits and a shared Schwarzschild lens table. A measured collection event releases one wave that writes eight white-lined lanes; a second emerald wave unfolds the infield. The camera lifts and the same circular lane family grows straightaways, cooling into terracotta and settling into the measured artwork tile. Three quiet traveling glints remain. The longer hold preserves early supernova/dew scroll distances. Equations, explicit approximations and reproducible numerical/visual checks are in [accretion.md](accretion.md). A click plays the same story about the click in two and a half seconds: a star dies at the click and its light races out as a ring, lighting the remnants' gas over the old page; the gas falls into drops, the cold spreads from the click, and the click draws every shard in (a point sink: r = r₀√(1 − t/T)); Racing's night is left and the light gathers at the click, a new star, which once the page has changed goes out as the ring of dawn the new page opens behind. |
| Outdoors | **The mountains rise**: Racing's white ice settles into a primed canvas, seen from straight above, and thick paint lands on it a drop at a time: green, white-ish, yellow, orange and red splashes with fingers, satellite drops and spray, random at first, though each is the colour of the land where it falls. Soon the paint creeps out along its own kind of land (the forest's green up the slopes, the hardwoods' colours down the valleys, white along the high ridges), each blotch drawing back along the contours, until the canvas is the painted map of the White Mountains; the lakes are struck in last, in blue. The painting rises into relief and becomes the land as the camera dives past Franconia Ridge, along the Garfield Ridge to the Twins, over the Pemigewasset Wilderness to the Bonds, then turns to the Presidential Range: single crowns of spruce, fir, maple and birch, granite slabs, the first snow high up, level lakes mirroring the mountains, in a low October sun. It rises to look straight down: the map draws its contour lines in, low to high, marks the 48 and dashes in the Pemi Loop; then the land settles flat into its map, dusk falls, the contours straighten onto a square module and thicken into came, and the light comes through the glass band by band, the summits glowing red in the order they were climbed. A click leads the window from the click instead: molten lead runs out along its came, glowing at its tip, while the page dims into the dark glass; then the last light passes outward through it. |
| Photography | **Fire becoming memory**: the last low sunlight rakes Outdoors' art-glass window from its foot and its right, bringing up its amber, gold and ruby, and the window burns from within: ignition fronts start in the summits' red glass and race along the came, through the ridge and forest glass and slowly in across the lowland panes; each pane's colour heats to molten light, then darkens to char crossed by glowing cracks, the landscape still drawn in its came for a moment. It lets go as embers (charcoal with fire under its crust) and sparks. We close on one ember as the others lift round it; a swirling flow with no sources or sinks draws their paths out into long copper-and-gold ribbons, ever more slowly, and the one we followed goes out. The ribbons wind onto a vast turning torus, two families crossing as warp and weft, each strand slipping against its place until the coupling holds it, the gaps between them never repeating. The torus turns face on, we pass through it, and it unrolls into a rippling veil: folds of light, interference bands of ember orange, rose and violet, a little blue, on black. Three broad waves gather the veil into brilliant seams and leave darkness; the sparks they shed cool to fine silver grains, hanging. The grains settle, one ripple crosses the dark liquid, and Photography's own background develops out of them across the whole tile, already in place; the tile's words and reel come up over it. On a click the same fire spreads from the click, the page lets go as embers, and the new page develops out of the grain. |
| Chess | **Living ink** collects on the upper edge of the darkroom. Refilling pores release 128 viscous beads into a perspective pool covering the lower 60% of the frame, and keep falling as the surface rises over the camera; six late heads then come down from the top edge as tall plumes the shape of the four plume studies. Under water every plume head is a vortex ring seen side on, and through the main event its cap rolls up: its two cores wind the plume study's filaments into spiral curls and tendrils, black and ivory, while the caps breathe in Rayleigh's free-drop modes, black and ivory out of step; each black plume and its ivory neighbour swing round one another, passing in front and behind, their stems trailing and curling after them, their skirts curling the other way; every plume is a vortex ring, as an ink drop entering water is: each drop's ink rolls up into a rolling head (photographic ink, its rim streaming round its cores) that plunges, slows and spreads as it takes in water, its stem wandering behind it, the big ones calving mini-rings; the rain's beads are drawn into their parents; through the main event the rings act on one another as current loops do on magnets (Biot–Savart): partners are drawn together, swing round each other and push off, each settling to a depth of its own, so the screen keeps changing and never crowds; no drop is drawn under the surface. Then each piece's plume is played backward: its circulation turns over, its rings glide to the piece's place and draw in to its size, and its ink becomes the piece's own shape in ink (the piece's study, registered to it), inside which the liquid fills and sets: the pieces are made of the ink that gathered, never revealed from behind it. All 32 plumes acquire their own translucent piece silhouette; each solid, measured from that very study, fills from its landmarks as a liquid seeping through its ink (its volume the pigment deposited), sets from the inside out, and flies to its square. Every piece lands while the water still stands. Then the water leaves as it came: the rise played backward screen for screen, a pause on the opening pose while the darkroom's lights come on (the red lamps in its reflections turn white), and a fall that slides the far waterline off the bottom while crowns, bodies, the board and the page come out of the water, tallest first. |

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
screen, right beneath the band above, and ends a fifth of a screen after (less for Outdoors, whose
heading follows straight after; Racing's, Photography's and Chess's bands wait in place under their
transitions and surface as they end, `HELD` in `lerp.js`). Each starts slowly (`holdEase`); Racing,
Outdoors, Photography and Chess pace theirs by a stretch table instead (`glassEase`, `folioEase`,
`darkroomEase`, `inkEase`), slowest at their endings.
Chess's hold uses a 12.8 multiplier, Photography's 4.4, Racing's 5.4, Outdoors' 3.2, Science's 1.6
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
| Science → Racing | spherical remnants, gravity’s spots gathering gas into drops, freezing and cleavage, dense eight-lane circulation, the track settling into Racing’s tile | worker-prepared drops and shards; six texels per shard (material, entry controls, lane, phase and clocks), instanced shards and short ribbons, analytic stadium geometry shared with the resting surface and generated SVG; reduced-resolution gas and incremental uploads retained | Supernovae and remnants, Jeans instability, free fall, freezing and cleavage; artistic cubic capture and arc-length circulation. Deterministic from scroll progress, including reversal. |
| Racing → Outdoors | paint into the White Mountains into art glass | none (a 2D painting, then a raymarched heightfield of the 48; the land, its water and the paint's plan built once in a worker) | Racing's ice becomes a canvas; drops of paint splash onto it and creep out along the land until it is the painted map; it rises into the White Mountains, flown in an October afternoon; from straight above, the map draws its contours, which are leaded into Outdoors' window as the light comes through it. |
| Outdoors → Photography | fire, embers, ribbons, a torus, a veil, silver | one ember a cell (~4,000, most of them sparks), ~700 ribbons of 20 segments, ~20,000 grains, each drawn instanced; the fire's plan (when it reaches each point of the window: Dijkstra over a 6 px grid of the leaded window, made once a screen size from Outdoors' plate) | The window burning along its own came; an ABC flow carrying the embers and drawing out their paths; Adler's phase locking onto quasi-periodic windings of a torus; a folded sheet's caustics and two-wave interference; three waves sweeping the veil into seams; grains settling; development by the H&D curve into Photography's live world. All a function of scroll progress, so it un-burns in reverse. Photography's band waits in place under it, as Racing's does, and surfaces as it ends. |
| Photography → Chess | Living ink | 128 entries feed 32 piece-forming plumes in a worker bake of 80 frames; the late heads' sheets carry their plume study outright. Packed material rings and four optical rails per ring follow the evolving camera. A bounded ripple pass deflects the darkroom reflection. The caps' roll-up and breath (`ink-swirl.js`) are inverse maps of the veils' study coordinates. The plumes are vortex rings (`vortex-plan.js`, baked in the worker per aspect along the standard scroll pace, scrubbed by P): Kelvin's self-speed Γ/(4πR)(ln 8R/a − ¼), mutual Biot–Savart (12-segment rings, Rosenhead–Moore cores) moving each ring, changing its radius across its rim (leapfrogging) and tilting it, entrainment, calving, soft walls, the dance's partner pull and swing, and each family's unmixing glide onto its site by formPeak. At run time (`vortex-ink.js`) each live ring is taken through the camera of the moment into the mist volume's space; INK_VOLUME draws its head from the plume studies revolved about its axis, read soft (a thin feature revolved would draw as a line), rolling as a two-phase Lamb–Oseen flow round its cores, lobed by its Widnall wave (azimuth powers, no trig per sample), each pixel listing the heads whose reach covers it, read on alternate depth steps. INK_PIECE's ink stage draws the piece's whole shape as translucent ink from its registered study while its plume hands over, the liquid filling inside it. The bake's plume volume, its veils and the 2D screen fluid (`live-ink.js`) remain only as the fallback. The drain (`ink-tank.js` DRAIN, `ink-drain.js`) is the opening's own surface code with its level read from a scroll-mirrored table; one plane in the board's world, solved to meet the page on the tank's far line, uncovers what stands above it, read from the board picture's second attachment (each pixel's world height). | A finite-core vortex rolls the rim, localized currents pull its skirt into folds, and projected pigment thickness controls transmission. Each primary feeds its own shape, with a small share exchanged by adjacent like-colored plumes. A solid's liquid front leaves its three landmarks with radius set so its filled volume is its deposited pigment (`FILL`), dense ink ahead, viscous fingers at its edge; it sets behind a jammed, glinting band. Each cap's two cores turn the study about them by a Lamb–Oseen angle that only grows with the scroll. Landings ring the falling band in the rain's own packets, crowns ring the plane as they break it, and the far line reveals the band's words. |

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
  | `flight.js` | The processes' maths, shared by every transition: the vortex, the panes' sweep and curl, each point's flight, the swirl, and the plan texture |
  | `reach.js` | Drawing shared by seams and clicks: the vortex's core |
  | `fire.js` | Outdoors → Photography and the click into Photography: the burning window, the one ember, the veil, the seams, development; its embers, ribbons and grains (`fire-plan.js` holds its clock, palette and maths) |
  | `living-ink.js`, `ink-impact.js`, `unmix.js`, `plume.js` | Depth-sliced pigment, landmark condensation, capillary release, overlapping waves and the click bloom |
  | `board3d.js` | Chess's board and pieces, sphere-traced (`board3d.js` and `staunton.js` beside the shader: the pieces' profiles, the camera, the Scotch as a function of time); the tile's and the transition's. The pieces are measured from the ink studies they form out of (`tools/site/ink_profiles.mjs` writes `staunton-ink.js` and the knight's carved relief, `staunton-relief.js`), their fields built in `board3d-worker.js`, each carrying its own study under its lacquer, drawn at the device's resolution up to a 4K screen's |
  | `transit.js` | The seams' ground (mode 8): live worlds at rest, snapshots where things move, each seam's process over both |
  | `units.js` | The instanced units (cubes and streamlines, drops and shards, embers, ribbons and grains) |
  | `opens.js` | The click transitions (cover, reveal, fog): the maze, the vortex (its cubes drawn over by `transit.js`), the dew and frost, molten lead along the came, the fire, the ink's bloom into the board |

  The canvas buffer drops its resolution when frames run long, and the pages fall back to their CSS art when even that is not enough.
- **Transits.** `static/site/scene/transit.js` takes over each seam whose pair it knows. Each frame:
  - It renders the two worlds over the strip into half-resolution snapshots, refreshing one of the
    two per frame, with the scene's own shader (offset by `uOrigin`).
  - Racing prepares droplet and shard trajectories in `dew-worker.js`. The scroll and click renderers use the packed textures managed by `dew-resources.js`. See [the accretion model](accretion.md).
  - What a seam or a click can work out ahead (Science's landing plan, Racing's drops, the fire's
    arrivals, a click's maze or lead) is made once and read from a texture by the ground and the
    units; Chess's pieces' distance fields and its card's picture are made once a size, ahead of time.
  - It draws the ground, then the units, with one or two instanced draw calls per seam.
  - Only seams on screen do any work, and only rows of units that can be in flight are drawn.
  - The grids coarsen on touch screens and when the resolution governor has stepped down.
  - The programs compile in parallel (`KHR_parallel_shader_compile`) or one per idle moment. Each
    draws a single pixel once it is ready, so the GPU builds its pipeline before the seam appears.
  - The pure maths (`holdAt`, `holdEase`, `transitP`, `flightAt`, `layerArrival`,
    `filmArrival`, `vortexSeamA`, `vortexTurn`, `vortexAt`, `carveMaze` in `lerp.js`) is tested in
    `tools/site/tests/lerp.test.mjs`; Chess's keyframes, pigment transfer, independent formation and board projection are tested in `living-ink.test.mjs`, its caps' roll-up and breath in `ink-swirl.test.mjs`, its drain and its click cure in `plume.test.mjs` (with `drain_look.mjs` comparing the falling water to the rising at equal levels), and its board (`staunton.js`: the pieces' profiles, the camera, the
    Scotch) in `board3d.test.mjs`.
  - **Performance.** Measured in headless Chrome on an M1 Max at DPR 2.
    - Scrolling the whole page both ways (about 30 s each way at 1440×900): 4,048 frames, none over
      20 ms, no long tasks, full resolution. At 2880×1800, 3 of 8,051 frames over 20 ms.
    - Each of the six click transitions at 1440×900 and 2560×1440: at most one frame over 20 ms (the
      page swap). During a click the buffer is capped at about 6 megapixels.
    - The living ink transition at 1440×900 ×2 and 390×844 ×3 in Chrome measured 16.7 ms at the 90th percentile in every stretch of P (`seam_perf.mjs --seam ink`). Prewarming the figure, filament, volume and crown-ripple passes during loading avoids first-entry shader compilation. The veils keep a 1.6-megapixel budget; only the solids are drawn at the device's own. At rest Chess draws the existing board texture.
    - `tools/site/seam_shots.mjs` photographs a seam at chosen moments of its clock.
    - `tools/site/ink_bake_check.mjs` scrolls steadily from the top and checks Chess's fluid is in by its seam.
    - `tools/site/handoff_check.mjs` compares Photography → Chess's last held moments with the settled band's
      board (the board the transition cures must be the one the band draws: a mean difference of about 5 at
      P 1.16, where the band's words are still coming into focus).
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


### Ink under the darkroom surface

The homepage seam uses a shallow tank with one moving projection for the overhead filter lip, entries, the water plane and suspended pigment. The opening pinhole projection spreads the impacts across the upper three quarters of the visible surface. Each pore carries three finite charges and recoils between them. Its calibrated release volume obeys ΔρgV = 2πaγf for effective contact radius a and wetting factor f. The underside recedes as the camera turns under the water. Surface packets use ω² = (gk + γk³/ρ)tanh(kh), in the deep-water limit used by this tank. Their group velocities move their envelopes and their phases provide refractive slopes. [Drop formation](https://arxiv.org/abs/physics/0111003)

Sixty-four smaller charges each form a submerged thread and transfer their pigment into a neighboring parent plume as the threads mix. Each parent plume carries a stack of irregular material rings. Its leading rim rolls in a finite core with Ω(r) proportional to (1 − exp(−r²/2δ²))/r². Neighboring plumes share localized currents. A breathing pocket uses curl(wA) with A = (yz, −xz, 0) and a smooth Gaussian envelope w. Inertial lag separates its head from its fringe. Landing guides and elastic recoils are artistic controls. The per-color mass ledger runs independently of exposure. [Falling ink and vortex breakup](https://makingscience.royalsociety.org/items/pp_7_22/paper-on-the-formation-of-vortex-rings-by-drops-falling-into-liquids-and-some-allied-phenomena-by-joseph-john-thomson-and-hugh-frank-newall) · [Controlling incompressible motion](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf)

The optical studies `ink-density.webp`, `ink-knight-density.webp` and `ink-figure-density.webp` store transmission. Four curved internal sections carry this detail with each plume. The non-knight atlas holds the two royal finials, a split mitre, a crenellated tower and two pawn variants. The worker shapes the rails and the external sheet before lacquer forms. Each piece has its own assembly time, orientation and position. The wet filter and airborne drops are composited above the reflective surface. The moving normals sample the same generated darkroom wall in `darkroom-reflection.webp` for paint and water. Fresnel reflection, pigment transmission and a short bright meniscus make the waterline readable as it passes the camera. The near sheet and piece depth split a reduced-resolution mist pass into front and back light. The external membrane uses native-resolution tris and analytic folds. The camera, ray-marched Staunton shapes and measured board destination meet at touchdown. Every scroll state reads immutable worker frames. A shared rotating flow phase animates the sheets and mist during a hold. It has no effect on deposited mass or arrival time. The 12.8 hold multiplier adds 2.6 units of scroll during the underwater movement at P .53–.745, 1.15 around the figure reveals at P .745–1.01 and 1.55 for the drain at P 1.04–1.196. A quintic ramp at each join keeps the distance to the earlier drip sequence intact.
