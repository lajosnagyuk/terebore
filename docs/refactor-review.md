# Correctness and maintainability review — 21 September 2026

The refactor preserves game rules, throw solving, physics timing, materials, interface layout, and audio envelopes. The separately requested playtest adjustment changes ball-to-ball restitution from 0.26 to 0.221; room restitution remains 0.56.

## Findings and changes

| Priority | Finding | Resolution |
| --- | --- | --- |
| Medium | Shadow-batch growth replaced a geometry attribute without disposing the original attribute's GPU buffer. | The shadow batch owns its geometry and disposes the old mesh and geometry on growth. Unit lifecycle tests and an actual WebGL buffer-count test exercise growth, reuse, and disposal. |
| Medium | Unit coverage omitted the browser entry point, UI, audio, and shaders' setup code. | Added source-mapped browser coverage, HTML/LCOV reports, CI artifacts, coverage gates, and a check for unobserved runtime modules. Shader execution itself is verified through rendering checks, not represented by TS coverage. |
| Low | The entry point combined markup, procedural audio, shadow management, score-card animations, and gameplay orchestration. | Extracted cohesive modules with explicit ownership; formatted static markup as HTML. Main is about 20% shorter without introducing a framework or event bus. |
| Low | The stylesheet accumulated duplicate selectors, obsolete overrides, and unused power-meter rules. | Consolidated rules and removed unused styles. Computed styles for all 71 inspected interface elements matched before and after at 1280, 640, and 390 CSS-pixel widths. |
| Low | Idle mist scanned 256 particles every frame; frame loops copied arrays; delayed-match polling allocated arrays even when nothing could clear. | Skip idle mist updates, iterate the original arrays (removal replaces rather than mutates them), reuse an immutable empty match result, and query dialog state once per frame. |
| Low | Non-finite frame samples could poison adaptive-quality averages. | Reject invalid timing samples and test subsequent recovery. |
| Low | Optional remote font requests could fail otherwise-correct browser tests. | Stub only the optional font hosts in test browsers; runtime font behaviour is unchanged. |
| Low | Unused TypeScript locals/parameters and switch fallthrough had no compiler checks. | Enabled compiler checks alongside the existing strict mode and formatter. |

## Coverage and resource checks

Unit tests cover rules, aiming, match lifecycle, input coordinates, persistence, adaptive quality, room gravity, mist lifecycle, and shadow-buffer ownership. Browser tests cover public controls, touch handling, score-card merging/dismissal, voice cleanup, GPU disposal, and a separate production build. Pure logic receives stronger branch coverage in unit tests; browser coverage independently measures the assembled application.

The 24-cycle resource check returned to the same warmed counts: 4 textures, 21 geometries, 9 programs, 14 physics bodies, and 192 shadow slots. Post-GC JavaScript heap grew from 6,403,256 to 6,729,008 bytes (+325,752 bytes). This supports bounded short-session resource use; it does not prove zero growth over hours or measure total browser/GPU memory.

## Remaining limitations

- The entry point still orchestrates the scene and input at roughly 1,050 lines. Further extraction is possible, but a wholesale architecture rewrite would create unnecessary behaviour risk for this pass.
- Matching is quadratic in pile size and the game has no hard pile limit. Profile unusually large piles before adding spatial indexing or changing game rules.
- Browser tests run in Chromium. Physical iPhone embedded-browser dismissal, Safari, and Firefox need compatibility checks; no desktop test can certify a native host-app gesture.
- Friendly WebGL startup failure and explicit context-loss recovery remain follow-up work.
- Runtime coverage includes shader construction strings, not GLSL branches or visual correctness. Keep the material pixel check and hardware benchmark alongside it.

## Final automated results

- 36 unit tests passed: 96.55% lines, 99.00% branches, 96.83% functions across imported unit-tested modules.
- 25 browser tests passed, including production assets, real WebGL buffer disposal, audio-node cleanup, and score-token lifecycle.
- Browser coverage observed all 18 runtime TypeScript modules: 93.96% lines, 90.75% branches, 95.40% functions. This is separate from unit coverage, not an average of the two.
- TypeScript build, formatting, and Cloudflare packaging dry run passed.
- Material pixel samples matched the pre-refactor values: rear-colour difference 47; centre/rim transmission contrasts 158/12.
- Intel UHD 620 benchmark at 2259×1271 CSS pixels and scale 1.7 used an adaptive 1433×806 canvas: 60 fps idle, 60 fps moving aim, 59 fps throwing; p95 intervals 16.7/16.7/16.8 ms. Each phase lasted six seconds. Browser main-thread task times were 945/1136/2195 ms respectively; these exclude GPU work and other browser processes. No browser errors occurred. No before/after CPU speedup is claimed from these samples.
