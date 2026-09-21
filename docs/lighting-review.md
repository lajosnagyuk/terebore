# Lighting improvements

The first three options were implemented. The ranking favours visible improvements to grounding and room depth while keeping the existing cloudy plastic style and canvas resolution.

| Rank | Technique | Visual impact | Estimated extra render time | Status |
| --- | --- | --- | --- | --- |
| 1 | Layered contact cores and height-dependent directional penumbras | High | 2–6% | Implemented |
| 2 | Room-local daylight, corner occlusion, and filtered plaster variation | High | 3–7% | Implemented |
| 3 | Soft ball-coloured reflected-light patches on floor and walls | Medium–high | 2–5% | Implemented |
| 4 | One real shadow-casting light | High | 15–30% | Deferred |
| 5 | Screen-space ambient occlusion in the pile | Medium–high | 20–40% | Deferred |

The individual cost ranges are engineering estimates, not isolated measurements. Real shadow maps render casters from the light's viewpoint and would also need shadow reception in the current custom room materials. SSAO would need extra depth handling for the translucent shells. See the [Three.js shadow guide](https://threejs.org/manual/pages/shadows.html) and [SSAOPass documentation](https://threejs.org/docs/pages/SSAOPass.html).

## Implementation

The existing instanced shadow batch now draws nine small patches per ball: a soft shadow, contact core, and reflected-colour patch on each of three room surfaces. Height and wall separation control spread and opacity. Patches use one shared radial texture, cached transforms, and per-instance colour. Sleeping balls do not rebuild the buffers. This adds no draw calls or textures. Reflected colour is a local approximation, not visibility-aware global illumination, and does not cast shadows onto other balls.

Room surfaces share directional daylight and distance-based darkening where walls and floor meet. Shading uses room coordinates so the incline does not misalign the lighting. Small plaster variation fades with screen-space footprint to avoid distant shimmer. The triangle floor now receives the same room shading. Ball materials, resolution policy, physics, and gameplay rules are unchanged.

## Validation and measurements

Local Intel UHD 620, hardware-accelerated Chromium; 2259 × 1271 CSS viewport at device scale 1.7. Both measurements used a 1433 × 806 rendering buffer. GPU timing uses `EXT_disjoint_timer_query_webgl2`, with warm-up followed by six seconds of idle sampling.

| Metric | Before | After |
| --- | --- | --- |
| Median GPU render time | 4.56 ms | 5.37 ms (+18%) |
| p95 GPU render time | 5.70 ms | 7.65 ms (+34%) |
| Measured idle / tracking / active FPS | 60 / 60 / 60 | 60 / 60 / 60 |
| Idle draw calls | 26 | 26 |
| Textures | 4 | 4 |
| Idle triangles | 11,077 | 11,173 |

These short samples indicate that median GPU overhead fits the requested budget; the p95 overhead exceeds 30%, although absolute render time and measured frame rate retain headroom here. They do not establish performance on every device or a large pile. Active-play sampling used 13 balls. The FPS benchmark measures six-second phases and reports transient HUD readings separately.

57 unit tests and 42 browser tests passed, including pixel checks for darker room corners, fading shadows with height, and red/blue reflected colour. GPU-buffer growth and disposal checks passed. After 24 throw/reset cycles, resource counts returned to the warmed baseline and post-GC JavaScript heap grew by approximately 314 KB, within the existing 2 MB allowance.

Reproduce with `npm run check`, `node scripts/benchmark-lighting.mjs`, `node scripts/benchmark.mjs`, and `node scripts/check-resources.mjs` while the development server runs on port 5173. Run GPU measurements sequentially to avoid contention.
