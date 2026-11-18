# Racing accretion finale — validation

Implemented locally at http://localhost:8100. No deployment, external artwork or dependency was added. Existing working-tree optimizations and the destination Racing content are retained.

## Visual evidence

The stage sheets read left to right, top to bottom: P .50, .54, .58, .70, .84, .89, .93, .97, 1.02, 1.08, 1.14, 1.20. Movies preserve captured frame timestamps and play the finale slowly in both directions.

| Viewport | Forward | Reverse | Stage sheet |
|---|---|---|---|
| Desktop 1440 × 900 | [Movie](1440x900-forward.mp4) | [Movie](1440x900-reverse.mp4) | [Contact sheet](1440x900-contact.png) |
| Narrow 1024 × 768 | [Movie](1024x768-forward.mp4) | [Movie](1024x768-reverse.mp4) | [Contact sheet](1024x768-contact.png) |
| Phone 390 × 844 | [Movie](390x844-forward.mp4) | [Movie](390x844-reverse.mp4) | [Contact sheet](390x844-contact.png) |

Reviewed both exact stage captures and frames from moving playback. The dark centre remains distinct; the far image bends coherently with the particles; one traveling pulse writes nine boundaries; the emerald opening has its own later pulse; camera, curves and fragments settle continuously into the shared track artwork. All eight lanes and the calm infield remain visible on the phone. These are visual review judgments, not an automated proof of beauty.

## Numerical results

These are a calibrated dissipative particle model and Schwarzschild optics, followed by explicit artistic organization and a material/camera morph. Equations, tuning choices and sources are in [the implementation notes](../../design/accretion.md).

| Viewport | Shards | Collected count / mass | Halved-step change: count / mass | Event time change | Max independently probed fit error | Two packed plans |
|---|---:|---:|---:|---:|---:|---:|
| 1440 × 900 | 3275 | 85.02% / 85.54% | 0.031 / 0.135 pp | 0.865% | 0.357 px | 30.78 MiB |
| 390 × 844 | 1103 | 93.28% / 94.07% | 0.736 / 0.846 pp | 0.000% | 0.386 px | 11.56 MiB |

Both collection gates pass ≥85%. Every visible droplet has fragment lineage, all packed values are finite, all eight lanes are balanced, assignments preserve radial order, and moving the destination tile reuses the same physics. Absorbed fragments never reappear. Fracture placement error is below 10⁻⁹ CSS px before float packing. The heat ledger closes within 10⁻¹² and angular-momentum accounting includes absorbed material.

Ten isolated reference orbits have worst relative energy drift 0.0000847% (limit .1%); angular-momentum drift stays below 10⁻¹² relative. The optical table passes reference-ray comparisons near the shadow edge and far arc with <.5 CSS px error. Full measurements: [numerics.json](numerics.json).

## Performance

| Existing strict check | Working-tree baseline p90 | Final p90 | Budget |
|---|---:|---:|---:|
| GPU | 16.7 ms | 16.7 ms | 17.5 ms |
| GPU, CPU throttled 4× | 16.7 ms | 16.7 ms | 20 ms |
| Software fallback | 16.7 ms | 16.7 ms | 33.4 ms |

The final focused run has display-timestamp p90 16.7 ms with zero missed frames, and callback-observation p90 17.3 ms versus the original 17.2 ms. The latter is sensitive to callback scheduling: other final runs measured 19.3–19.6 ms. The resize/click lifecycle run missed one frame. This variation is retained in the reports, rather than described as a universal speedup. CPU-throttled worst frame was 116.7 ms versus the previous 100 ms; its existing p90 and style-recalculation budgets pass.

Preparation remains a material first-load cost: approximately 16.4 seconds for the desktop bake on this machine. Cached orbital frequencies and symmetric pair coefficients preserve bit-identical capture, heat and angular-momentum results. The full simulation is reused on repeat visits and tile movement. If scrolling beats preparation, the existing stable fallback is used for that traversal. Clicks use an earlier fracture-only texture: the early-click check drew 43 shard batches while the full orbit bake was still pending, and the page swapped after 1.43 s.

Reports: [before](performance-before.txt), [after](performance-after.txt), [focused](finale-after.json), [preparation](preparation.txt), [early click](early-click.json).

## Regression gates

- Full Node suite: **201 passed, 1 skipped, 0 failed**.
- Generated pages, page checks and `git diff --check`: passed.
- Forward, reverse, direct seeks, actual click navigation and released tile: passed.
- Rapid resize/interrupted preparation: recovered the full particle renderer.
- Forced WebGL context loss/restoration: static fallback followed by successful recovery.
- No WebGL, reduced motion and paused motion: finished static track, no shader/network/console errors.
- Birkebeiner destination content and route data remain unchanged; homepage artwork remains track-only.

Reproduce with the commands in [design/accretion.md](../../design/accretion.md). Browser reports: [lifecycle](lifecycle.json), [no WebGL](fallback.json), [reduced motion](reduced.json), [paused](paused.json).
