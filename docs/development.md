# Development

## Checks

```sh
npm ci
npm test
npm run build
npx playwright install chromium
```

With `npm run dev` running on port 5173, run the browser checks:

```sh
node scripts/check-browser.mjs
node scripts/check-bank.mjs
node scripts/check-translucency.mjs
node scripts/benchmark.mjs
```

The browser check covers desktop and touch input, aiming, throw cadence, matching, score tokens, reset, and browser errors. The bank check verifies wall-assisted throws. The translucency check verifies that a rear ball's colour remains visible through a front shell. Screenshots are written to `/tmp/terebore-*.png`.

The benchmark uses hardware-accelerated Chromium with a 2259 × 1271 CSS viewport and device scale 1.7. It reports the GPU, actual frame intervals, render resolution, and draw counts during idle, aiming, and repeated throws. Set `SOFTWARE_RENDERER=1` to exercise the software fallback. Performance depends on hardware, browser, power settings, and pile size; software-renderer results are not hardware benchmarks.

Open `/?stats` to display frame rate and canvas resolution. Development builds expose read-only `window.__terebore` diagnostics for the browser checks. These diagnostics are excluded from production builds.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Scene, input, physics, scoring, interface, and frame loop |
| `src/aiming.ts` | Target selection, launch velocity, and lightweight aiming guide |
| `src/room-feel.ts` | Room incline, gravity, and release position |
| `src/cadence.ts` | Throw readiness and scoring bonuses |
| `src/matches.ts` | Connected groups of touching, same-colour balls |
| `src/palette.ts` | Five distinct colour families |
| `src/marble-art.ts` | Cloudy shell shading and contact-shadow texture |
| `src/room-art.ts` | Painted room lighting |
| `src/smoke.ts` | Pooled, instanced match mist |
| `src/quality.ts` | Adaptive canvas resolution |
| `src/style.css` | Interface and responsive layout |

## Rendering and physics

The canvas starts with a 1.6-million-pixel ceiling and adapts to sustained frame timing. HTML remains at native display resolution. Ball geometry and procedural textures are shared; shadows, guide dots, and mist use instanced draws. There are no runtime shadow maps or full-screen postprocessing passes.

Ball shells use thickness-dependent transparency, soft pigment variation, and baked studio reflections. Background colours show through without refraction or blur. Transparent draw ordering and the separate held-ball layer must be preserved when changing rendering.

Physics uses fixed 1/90-second steps, interpolation, a sweep-and-prune broadphase, and sleeping bodies. Gameplay time advances at 1.2 times real time. The inclined room and gravity share the same coordinate system. Static collider bounds must be refreshed after positioning so broadphase collision detection remains correct.

The aiming guide is deliberately approximate: it uses the launch velocity and simple room reflections, suggests at most four bounces, and stops near the rail or pile. It does not run another physics world or predict matching outcomes. Input changes refresh it once per frame; a stationary aim is reused while the pile sleeps.

Sleeping shadow transforms and unchanged interface text are cached. Match mist uses a fixed particle pool and one draw. Impact compression follows the contact normal without changing collision geometry. Score-token reading time remains in real time.

## Assets and storage

Artwork, textures, and audio are procedural. Google Fonts are optional and have system-font fallbacks. Audio starts only when enabled. The only persistent game value is the personal best, stored locally in the browser; storage failures do not prevent play.
