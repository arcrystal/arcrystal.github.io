# Five rooms, five styles

The homepage is a hero and a pinned stage of five tiles. Each tile has its own design style, and
its page uses the same style. One WebGL canvas draws every style's scene, the handoffs between
them and the click-to-expand effects, all from code: there are no renders, no video and no image
textures. Without WebGL (or on a software renderer) the CSS and SVG art stands in.

| Tile | Style | Palette | Type | Scene | Expand |
| --- | --- | --- | --- | --- | --- |
| 01 Chess | **Ink & Mist** | paper `#F3EEE3`, ink `#1C1A17`, indigo `#2F4A6B` | Shippori Mincho | Abstract ink-wash ridges with wet crests and granulation; mist drifts between them and parts round the pointer | Ink floods out of the card, then lifts and thins to wash |
| 02 Racing | **Glacier** | ice `#E8F0F6`, `#0A1E2C`, glacier blue `#1767C2`, mint `#2BD9A8` | DM Sans | Caustic light through ice, light shafts, contour lines, snow. The card is real glass: the scene is refracted and frosted inside it | Frost crystallises out of the card, then clears from the click like wiped condensation |
| 03 Coding | **Signal** | `#07060E`, cyan `#22E6FF`, magenta `#FF3DCB`, acid `#C8FF4D` (live markers only) | Unbounded, JetBrains Mono | A field of dot-matrix glyphs; pulses ring from the pointer, a scan sweeps, bands glitch with an RGB split | Glitch bands spread from the card; a scan line reveals; the title decodes |
| 04 Mountains | **Naturalist's Folio** | forest `#0F1913`, parchment `#EEE4CE`, brass `#CDA562` | Cormorant | A copperplate-engraved forest: hatching that thickens with the light, a lantern that follows the pointer, swaying ferns, motes | A parchment page turns across the screen, then turns away |
| 05 About Me | **Liquid Chrome** | pearl `#ECEBF4`, `#14131C`, electric indigo `#3D2BFF`, iridescence | Krona One | Metaballs of liquid metal reflecting a studio sky with thin-film colour; one follows the pointer | Liquid chrome swells out of the card, then pops into scattering drops |
| — | **House**: hero, contact, résumé | paper `#F4F2EE`, ink `#141416` | DM Sans | The crystal: a pentagonal gem whose five facets are windows onto the rooms | a plain fade |

## The handoffs

Scrolling from one tile to the next plays a moving boundary between two complete worlds, never a
blend through grey. Each is scrubbed by scroll, so scrolling back plays it in reverse.

| From → to | Name | What happens |
| --- | --- | --- |
| House → Ink | Into the crystal | The view falls into the Ink facet, its edges flaring into a prism; the wash spreads |
| Ink → Glacier | Thaw | A frost front of crystal lattice grows up from the bottom; the ink cools ahead of it |
| Glacier → Signal | Shatter | Shards crack out from the card, refract and drift, then flip to the signal with a cyan flash |
| Signal → Folio | Power down, lantern up | The screen collapses to one line, which warms to brass and opens like a book onto the forest |
| Folio → Chrome | Gilt melt | Molten brass drips down and turns to chrome, then parts into drops over the pearl |
| Chrome → House | Back to paper | The drops gather into one, which shrinks to a glint |

The cards and titles move with the boundary: the outgoing title leaves over the first 60% of a
handoff and the incoming one arrives over the last 70%, letter by letter in each style's manner
(brushed in, risen, decoded, inked in, popped). The lines around them take turns.

## How it works

- **Smoothing.** `static/site/tiles.js` turns scroll into a target position; the visible position
  chases it with an exponential approach (`static/site/lerp.js`), so the stage glides. Each tile
  holds its style for 45% of its 1.5 screens of scroll. Stopping inside a handoff glides on to the
  nearer tile; rail and hero-index jumps glide through the handoffs in between.
- **Writes.** Per frame the stage writes a handful of custom properties on the two tiles in view
  (`--in`, `--out` on the text; `--cin`, `--cout` on the cards, which do not inherit) and one ink
  each on the header, rail and counter, in 24 steps per handoff. Nothing is written on `<body>`.
  Measured with `tools/site/perf.mjs`.
- **Scene.** `static/site/scene/scene.js` owns a fixed canvas behind every page that survives
  router swaps. Pages register hosts (the stage, a destination's hero, the next-page card), and the
  shader in `static/site/scene/glsl/` draws only the regions on screen. The buffer drops its
  resolution when frames run long, and the pages fall back to their CSS art when even that is not
  enough.
- **Expand.** `static/site/expand.js` plugs into the router. The scene draws the cover in front of
  the page from the clicked card's rectangle; the router swaps underneath; the reveal plays behind
  the new page's hero, whose letters arrive at the same time. Back to the homepage, the page's
  world fills the screen and the tile's card shrinks back into its place.
- **Styles.** `static/site/styles/<style>.css` holds a style's tokens, CSS art, card, letters,
  preview, destination hero and next-page card. `static/site/styles.json` holds the colours (checked
  by `tools/site/contrast.mjs`) and each style's id in the scene.
- **Fallbacks.** With reduced motion (or Motion off) the scene holds still, handoffs crossfade and
  letters only fade. Without WebGL the CSS backdrops wipe into one another. Without JavaScript the
  stage is five stacked sections, each in its own style.
