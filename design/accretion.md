# Gravity becoming a track

This homepage-only finale extends Racing's hold multiplier from 4 to 5.4. The old scroll-distance measure remains unchanged through P=.5, including on touch screens. The extra distance is distributed after condensation. Click navigation retains its point sink, clocks and page aperture; a small fracture-only texture is uploaded before the orbit bake so clicks do not wait for it.

## Physical model and deliberate transformations

The worker selects the five closest clump droplets to the composition centre. Their fragments have symmetric softened Newtonian forces, `Fij = -mi mj (xi-xj)/(distance²+ε²)^(3/2)`, ε=.18, and inward velocities with zero total momentum and angular momentum. Velocity Verlet advances this cluster. Its final contraction into a central source is an explicit artistic scale change, not relativistic stellar collapse.

Visible size and assigned mass are separate: each parent's assigned mass is proportional to the cube root of its optical volume; sectors divide that assigned mass by their angular and radial volume fractions. The seed parents are normalized to mass 1 and all remaining material to .01. Every visible parent and every facet has an identity; absorbed shards never return. The seed cluster has no external force. The nonseed material moves in a fixed central field (the central source absorbs its accounting mass and angular momentum without moving).

Units are `r_s=GM=1`, so `c=√2`. The Paczyński–Wiita potential is `Φ=-1/(r-1)`, acceleration `a=-x/[r(r-1)²]`, circular angular frequency `Ω²=1/[r(r-1)²]`, and radial epicyclic frequency squared `κ²=(r-3)/[r(r-1)³]`. Thus the stability boundary is 3. The visible target annulus is 3.6–12. The absorbing boundary is 1.85, safely before the singularity.

Each original screen position is unprojected into the 70° disc plane. Initial velocities are bound and prograde. The initial guiding radius is `min(r, clamp(.75r,8.2,11.2))`; `L=r_g²Ω(r_g)` is capped at .94 of the local escape angular momentum. Gravity is entirely radial. Inner circulation is faster.

Local pairs, deterministically found by an integer spatial hash, have `h=.7`, reduced mass `μ=mi mj/(mi+mj)`, `w=max(0,1-d/h)`, and friction `F_D=-γ μ w² (vij·rhat) rhat`. Exact pair impulses multiply the relative radial velocity by `exp(-γw²Δt)`. Equal opposite impulses conserve pair momentum and angular momentum, and the kinetic energy removed is exactly `Q=.5 μ v_rad² [1-exp(-2γw²Δt)]`. A cooling ledger radiates heat on a 12-unit timescale; retained specific heat warms the rendered fragments. Weak pressure uses `K=μ c_s²/h`, `c_s=.06v_K`.

The initial proposed damping coefficient .35 was insufficient for this sparse, finite particle surrogate. The implemented coefficient is **5√(ΩiΩj)**. Symmetric forward/reverse pair sweeps are Strang split between gravitational kicks and drifts, Δt=.12. This is a dissipative particle approximation, not MHD or a hydrodynamic fluid solver.

Collection means bound material with radius 3.3–13, radial speed below .30v_K, and tangential speed within .30v_K of circular. The margins accommodate residual eccentricity. The event is checked after an initial settling interval `1.3 × .95 r_max^(3/2)` and requires **85% by both count and assigned mass**, including swallowed particles in the eligible denominator. The minimum interval excludes transient threshold crossings while the outer material is still falling. A failed gate rejects the bake. The measured event maps to P=.86; no frame decides whether to fire it. Uncollected survivors remain on their physical paths until the explicit, smooth lane-organization stage. They are never teleported to manufacture collection.

## Optics

Schwarzschild ray-plane integration solves `u''+u=1.5u²`, with `u(0)=0`, `u'(0)=1/b`. A worker table contains reciprocal radii and escape deflections; its impact grid is concentrated near the critical impact parameter `b_c=3√3/2`. An inverse table maps emitter radius and viewing angle to primary and first-secondary image positions. The surface, particles, ribbons and faint background use these same rays. A finite background image is graded from the physical escape deflection; it is not an astronomical sky survey. There is no ray integration in the render loop.

The visible shadow radius is b_c, not the horizon radius 1. The emission shift is informed by `sqrt(1-1/r) sqrt(1-β²)/(1+β sin(i) cos(φ))`, followed by artistic exposure. The nonrotating hole and rotating disc are distinct. Primary fragments are all retained. One eighth of the fragments carry a faint secondary image, and all secondary surface emission remains; this bounds optical overdraw while retaining the raised far arc.

## Artistic clocks and shared geometry

At P .86–.93 one outward Gaussian pulse `A exp[-(r-R)²/(2σ²)]` writes the nine white boundaries in order. Its light comes from the inner luminous flow, outside the dark centre. Surviving particles are ordered by their instantaneous radius at collection and assigned monotonically to eight bands; the small variation inside a lane also preserves order. This choice avoids visible radial crossings during the organization of material with residual eccentricity.

At .94–1.00 a broader emerald membrane unfolds in front of the opening with low-amplitude twofold interference, `1+.16 cos(kr+2φ-ωP)`. The remaining pupil contracts. This is a material reveal, not swallowed matter escaping.

The surface cools toward terracotta from .96 to 1.035. At 1.02–1.14 the shape family is a concentric capsule with straight half-length `.25 S(s)` and radius `(1-S)ρ_disc(q)+Sρ_track(q)`, where `S=6s⁵−15s⁴+10s³`. The camera lifts from 70° to acos(.86), retaining the −12° orientation. Particle orbital phase remains unwrapped; the late physical radial velocity decays continuously, and orbital speed changes through the integral of a smooth velocity ramp. Full projected motion, including shape, camera and tile translation, determines fragment orientation and ribbon tangents. Lensing withdraws during the morph; the black shadow never becomes an oval.

The track moves into the measured tile at 1.02–1.14. The final renderer is exactly the existing shared `trSurface`, including the SVG's geometry, terracotta grain, finish line and three traveling ivory highlights with amber and red wakes. Its primitives are not drawn twice at handoff. The text surfaces from 1.08, dawn follows, and the hold releases at 1.2.

## Data and performance

`accretion-plan.js` runs only in the dew worker. Polar histories retain unwrapped angle and are fitted to Hermite segments with .22 CSS-pixel positional tolerance. Sixty-four time bins give a bounded binary lookup (at most eight steps, no trajectory construction). Cancellation is checked every 80 integration steps. Card movement reuses the complete physics bake. Data use the existing transferable RGBA32F texture, incremental 32-row uploads, instanced facets and short three-segment ribbons. Scroll controls fracture, collection, the outbursts, cooling and the shape change. A display clock adds gentle prograde rotation to the collected material, shared by each shard and its ribbon. The painted lanes inherit traveling light while the last shards melt.

Resource eviction limits the combined active/previous textures, including the temporary click texture and optical tables, to 32 MiB desktop / 16 MiB phone. Obsolete uploads and simulations are cancelled. Reduced motion, paused motion and unavailable WebGL retain the static finished artwork. Fallback selection stays stable during a traversal.

On a fresh homepage visit the opening screen waits for shader compilation, the orbit texture, terrain, fire and ink. It offers immediate entry with motion paused. Static and reduced-motion visitors enter as soon as their page has mounted.

## Reproducible checks

- `node --test tools/site/tests/accretion.test.mjs`: isolated ten-orbit conservation, pair impulse/heat accounting, ISCO, reference optical rays, nested geometry and pacing.
- `node tools/site/accretion_check.mjs /tmp/accretion-numerics.json`: full desktop and phone bakes at Δt and Δt/2; lineage, finite packing, mass/heat/angular-momentum accounting, fit error, monotone lane assignments, cache size and tile-independent physics. Fails if collection changes by ≥1 percentage point or event timing by ≥1%.
- `node tools/site/track_check.mjs --size 1440x900 --out /tmp/accretion-desktop`: exact seeks, moving playback/reversal, shader errors, frame pacing and released tile. `--lifecycle` adds interrupted resize and actual click navigation; `--preset nowebgl`, `--reduced-motion`, `--paused` check alternatives.
- `node tools/site/accretion_movie.mjs --size 390x844 --out /tmp/accretion-movies`: timestamped slow forward/reverse movies plus synchronized contact sheets.
- `node tools/site/accretion_click_check.mjs`: clicks into Racing as soon as the fracture texture is ready, verifies actual shard draws before the orbit bake finishes, and checks destination navigation.
- `node tools/site/perf.mjs --strict`, the complete test suite, page builder `--check` and `check_pages.py` retain the previous gates.

## Sources

- Abramowicz, [The Paczyński–Wiita potential: a step-by-step derivation](https://arxiv.org/html/0904.0913).
- DL-SDG, [Dissipative particle dynamics formulation](https://dl-sdg.github.io/RESOURCES/DOCUMENTS/DPDIntro.html). The implemented cooling surrogate omits the equilibrium stochastic thermostat.
- Bruneton, [Real-time High-Quality Rendering of Non-Rotating Black Holes](https://ebruneton.github.io/black_hole_shader/paper.pdf). The reduced tables here integrate the same Schwarzschild ray equation; they are not a copy of the paper's complete beam-filtering renderer.
- NASA, [Anatomy of a black hole](https://science.nasa.gov/universe/black-holes/anatomy/).
