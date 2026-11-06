# Five rooms, five styles

The homepage is a hero and a pinned stage of five tiles. Each tile has its own design style, and
its page uses the same style. Everything is drawn in CSS and SVG or is a real photograph. There
are no renders and no video.

| Tile | Style | Palette | Type | Expand effect |
| --- | --- | --- | --- | --- |
| 01 Chess | **Sumi**: ink and washi | washi `#F3EEE3`, sumi `#1C1A17`, vermilion `#B3311A`, indigo `#2F4A6B` | Shippori Mincho | An ink stroke sweeps round from the tile, the 王 seal stamps, the ink lifts |
| 02 Racing | **Glacier Glass**: geometric, clean, glassy | ice `#E8F0F6`, `#0A1E2C`, glacier blue `#1767C2`, aurora mint `#2BD9A8` | DM Sans | A frosted pane springs open; the frost clears from the click |
| 03 Coding | **Neon Circuit**: cyberpunk | `#07060E`, cyan `#22E6FF`, magenta `#FF3DCB`, acid `#C8FF4D` | Unbounded, JetBrains Mono | Edges trace, the panel glitches into bands, a scan line reveals |
| 04 Mountains | **Naturalist's Folio**: Victorian nature | forest `#0F1913`, parchment `#ECE2CC`, brass `#CDA562` | Cormorant | Filigree draws, the brass frame opens to the edges, ink blooms |
| 05 About Me | **Liquid Chrome**: Y2K | pearl `#ECEBF4`, `#14131C`, electric indigo `#3D2BFF`, iridescence | Krona One | A gooey chrome blob swells out of the tile and pops |
| — | **House**: hero, contact, résumé | paper `#F4F2EE`, ink `#141416` | DM Sans | a plain fade |

## How it works

- **Tokens.** `static/site/styles.json` is the single source of every style: the page colours and
  the material of the homepage panel (corner radii, border, outline, shadow, blur, tilt). The
  builder reads it for `theme-color`, the homepage reads it to blend, and
  `tools/site/contrast.mjs` checks every text pair against WCAG AA.
- **Blend.** On the homepage, `static/site/tiles.js` maps scroll to a position through the tiles.
  `static/site/lerp.js` mixes the two styles in view, with colours mixed in OKLab. Each tile holds
  its own style for 60% of its scroll; the change happens in between. Backdrops and panel
  ornaments crossfade by weight, and the tile texts fade out and in, never at the same time.
- **Expand.** `static/site/expand.js` plugs into the router (`static/site/lib/router.js`). A click
  starts the fetch and the destination's effect (`static/site/effects.js`) together. The router
  swaps the page once the effect covers the viewport, and the effect then reveals the page's hero,
  which is in the same style. Back to the homepage folds the page into its tile. Reduced motion
  and history steps use a fade.
- **Styles.** `static/site/styles/<style>.css` holds a style's tokens, backdrop, panel ornaments,
  tile type, preview, destination hero, next-page card and expand overlay. Page stylesheets
  (`<dir>/page/*.css`) use the shared tokens only, so a page re-themes with its style.

Every page is complete without JavaScript: the homepage stage becomes five stacked sections, each
in its own style.
