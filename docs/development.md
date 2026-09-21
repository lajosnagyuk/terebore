# Development

## Checks

```sh
npm ci
npx playwright install chromium
npm run check
npm run format:check
```

`npm run check` runs instrumented unit tests, a production build, and Playwright against isolated development and production servers on ports 5174 and 4174. GitHub Actions runs the same checks with software-rendered Chromium and validates the Wrangler deployment bundle without publishing. Failed browser runs retain traces and screenshots in `test-results/` and an HTML report in `playwright-report/`.

Browser coverage is collected with Chromium's V8 profiler and converted through Vite's source maps to Istanbul HTML and LCOV reports in `coverage/browser/`. CI retains the reports. Minimum browser gates are 90% lines, 85% branches, and 90% functions; missing runtime modules fail the check. This measures TypeScript execution, not GLSL branch coverage or visual quality. Tests that replace the initial pile exclude their altered entry module from coverage because its original source map no longer matches; normal scenarios cover the actual entry module. Optional Google Fonts requests are stubbed in browser tests so network availability does not affect correctness checks.

Unit coverage has minimum gates of 95% lines, 95% branches, and 90% functions. It measures the modules imported by the unit suite, **not the whole application**: aiming, matching and its lifecycle, cadence/scoring, input coordinates, persistence, adaptive resolution, room physics, and pooled mist. Browser tests cover integration through real controls: mouse, keyboard, touch, interruption, dialogs, reset, storage failures, committed matches, reduced motion, and production assets. A seeded connectivity oracle also checks matching across 100 generated piles and reversed input order. Deterministic match fixtures replace the starting pile only in test-browser responses; production has no mutation hooks.

Chromium touch emulation does not replace testing on a physical phone or Safari. Rendering quality and frame-rate claims require the hardware checks below; CI software rendering tests correctness only.

With `npm run dev` running on port 5173, additional rendering and longer gameplay checks are available:

```sh
node scripts/check-browser.mjs
node scripts/check-bank.mjs
node scripts/check-translucency.mjs
node scripts/benchmark.mjs
node scripts/benchmark-lighting.mjs
node scripts/check-resources.mjs
```

The browser check covers desktop and touch input, aiming, throw cadence, matching, score tokens, reset, and browser errors. The bank check verifies wall-assisted throws. The translucency check verifies that a rear ball's colour remains visible through a front shell. Screenshots are written to `/tmp/terebore-*.png`.

The resource check exercises 24 throw/reset cycles and compares post-GC JavaScript heap and rendering/physics resource counts against a warmed baseline. It is a short churn regression, not a long-session guarantee.

The lighting benchmark uses GPU timer queries, when supported, to measure median and p95 render time after warm-up. Its fixed viewport and reported canvas resolution allow before/after comparisons without relying on a vsync-limited FPS counter.

The benchmark uses hardware-accelerated Chromium with a 2259 × 1271 CSS viewport and device scale 1.7. It reports the GPU, actual frame intervals, render resolution, draw counts, main-thread task time, and JavaScript heap during idle, aiming, and repeated throws. Set `SOFTWARE_RENDERER=1` to exercise the software fallback. Performance depends on hardware, browser, power settings, and pile size; software-renderer results are not hardware benchmarks.

Open `/?stats` to display frame rate and canvas resolution. Development builds expose read-only `window.__terebore` diagnostics for the browser checks. These diagnostics are excluded from production builds.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Scene assembly, input, physics, scoring, and frame loop |
| `src/ui.html`, `src/ui.ts` | Static interface markup, mounting, and DOM lookup |
| `src/audio.ts` | Optional audio context and short-lived voices |
| `src/score-token.ts` | Pile-anchored score numbers, bounded bursts, bonus labels, and timer ownership |
| `src/contact-shadows.ts`, `src/contact-texture.ts` | Cached shadow batch and owned GPU resources |
| `src/aiming.ts` | Target selection, launch velocity, and lightweight aiming guide |
| `src/collision-materials.ts` | Ball-pair restitution and shared room contacts |
| `src/play-area-solver.ts` | Reduced bounce for floor contacts inside the triangle |
| `src/room-feel.ts` | Room incline, gravity, and release position |
| `src/cadence.ts` | Throw readiness and scoring bonuses |
| `src/matches.ts` | Connected groups of touching, same-colour balls |
| `src/match-lifecycle.ts` | Contact dwell, one-time match commitment, and delayed clearing |
| `src/input.ts` | Validated pointer coordinates and touch offset |
| `src/persistence.ts` | Validated best-score storage with failure recovery |
| `src/palette.ts` | Five distinct colour families |
| `src/marble-art.ts` | Cloudy shell shading |
| `src/room-art.ts` | Painted room lighting |
| `src/smoke.ts` | Pooled, instanced match mist |
| `src/quality.ts` | Adaptive canvas resolution |
| `src/style.css` | Interface and responsive layout |

## Rendering and physics

The canvas starts with a 1.6-million-pixel ceiling and adapts to sustained frame timing. HTML remains at native display resolution. Ball geometry and procedural textures are shared; shadows, guide dots, and mist use instanced draws. There are no runtime shadow maps or full-screen postprocessing passes.

Ball shells use thickness-dependent transparency, soft pigment variation, and baked studio reflections. Background colours show through without refraction or blur. Transparent draw ordering and the separate held-ball layer must be preserved when changing rendering.

Physics uses fixed 1/90-second steps, interpolation, a sweep-and-prune broadphase, and sleeping bodies. Gameplay time advances at 1.38 times real time. The inclined room and gravity share the same coordinate system. Static collider bounds must be refreshed after positioning so broadphase collision detection remains correct.

Ball-to-ball restitution starts at 0.221. A pair containing Clay applies a 0.9 multiplier; a pair containing Light applies 1.05. Each type applies once, so Clay–Clay is 10% softer, Light–Light is 5% bouncier, and Clay–Light combines both. Ball-to-room contacts start at restitution 0.56 and friction 0.22; ball-to-ball friction stays 0.12. Before solving contacts, the triangle floor applies a 0.9 restitution multiplier (0.504), based on the floor contact position. The floor outside the triangle, walls, and rail retain 0.56. Perfects use their primary colour’s physical material.

The aiming guide is deliberately approximate: it uses the launch velocity and simple room reflections, suggests at most four bounces, and stops near the rail or pile. It does not run another physics world or predict matching outcomes. Input changes refresh it once per frame; a stationary aim is reused while the pile sleeps.

Room surfaces use room-local directional daylight, soft corner occlusion, and distance-filtered plaster variation. Ball shadows combine a close contact core with a broader, height-dependent penumbra; faint family-coloured patches approximate reflected light on the floor and both walls. All nine patches per ball share one instanced draw and one radial texture. These are local lighting approximations, not ray-traced visibility or inter-ball shadowing.

Sleeping shadow transforms and unchanged interface text are cached. Match mist uses a fixed particle pool and one draw. Impact compression follows the contact normal without changing collision geometry. Score numbers rise quickly, drift for reading, then accelerate upward while fading over 3.2 real-time seconds. Clears from one throw can share a burst; independent throws keep separate numbers, capped at three. Single families use their ball colour, while combined groups use slate-blue. Perfect labels show actual bonus points so merging does not imply an incorrect multiplier. Reduced-motion mode keeps the numbers stationary. Reset and resize remove active bursts.

## Assets and storage

Artwork, textures, and audio are procedural. Google Fonts are optional and have system-font fallbacks. Audio starts only when enabled. The only persistent game value is the personal best, stored locally in the browser; storage failures do not prevent play.

See [Reliability review](review.md) for the addressed findings and remaining verification limits.

See the [21 September refactor review](refactor-review.md) for the coverage scope, resource findings, and behaviour-preservation checks.
