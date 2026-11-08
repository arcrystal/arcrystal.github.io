# Coding page: media sources

| File | What | Origin |
|---|---|---|
| `images/aimap-explorer.webp` | The AI Power Map's record with the 2022-11-30 moment open (ChatGPT) | Screenshot of `/ai-timeline/` in headless Chrome, 1440 px layout at device pixel ratio 3, resized to 2400 px wide, lossless WebP. `tools/cinema/coding/capture_aimap.mjs`. |
| `images/aimap-benchmarks.webp` | The benchmark trend lines, SWE-bench tab | Same capture run, 1800 px wide. |
| `images/aimap-top.webp` | Top of the page (title, counts, "When it felt different") | 1200 px layout, 1800 px wide. Used for the stand-in social preview. |
| `images/aimap-phone.webp` | The page at phone width (430 px layout, DPR 4) | 860 px wide. |
| `diagrams/mbonita-planes.svg` | Three omics layers carrying one network (schematic) | Drawn by `tools/cinema/coding/layers.py`. Node names are placeholders. |
| `posters/og.jpg` | Social preview (stand-in until the film's end frame replaces it) | Composite of `images/aimap-top.webp` on a midnight ground. |

The screenshots are unmodified captures of the app. The headless browser had no network, so the app's
web fonts (Manrope, Newsreader, DM Mono) show as the page's CSS fallbacks; see
`design/cinema/coding/asset-requests.md`. The Birkie Race Intelligence app was not opened or captured;
the case study's figure is a diagram drawn in HTML and CSS from the project description, and says so.
