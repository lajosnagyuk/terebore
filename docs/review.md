# Reliability review — 20 September 2026

This pass examined input interruption, scoring and match timing, persistence, optional audio, reset, rendering resource ownership, and release verification. It preserves the existing physics and art direction.

## Findings addressed

| Area | Failure | Change and regression coverage |
| --- | --- | --- |
| Input | Losing focus during a drag could still release a throw; an unrelated pointer cancellation cancelled the active drag. | Cancel on focus loss and viewport change; identify cancellation by pointer ID. Browser tests cover focus, visibility, resize, and secondary pointers. |
| Touch | Clamping the aiming offset could turn an off-screen release into a valid throw. | Validate raw coordinates before applying the offset; unit and touch-browser regression tests. |
| Keyboard | Holding Space could repeatedly throw as the cadence allowed. | Ignore repeated keydown events; retain fresh key presses. |
| Persistence | Corrupt saved values such as `Infinity` appeared as the personal best. | Accept only nonnegative safe integers, recover from denied storage access and quota errors. |
| Matching | Delayed clears used the shot number at clearing rather than commitment, allowing subsequent input to change chain attribution. | Explicit match lifecycle retains the shot, prevents overlapping commitments, and resets pending work. Unit tests and a deterministic physical pile check dwell, scoring once, and unsupported balls falling. |
| Reset | A previous throw's delayed hint or match chord could run in the new round. | Track and cancel those timers; browser check verifies the restored hint. |
| Audio | Rejected AudioContext resume promises were unhandled; tone nodes lacked explicit disconnection. | Handle rejection and disconnect ended nodes; browser test simulates denied audio. |
| Verification | Existing checks relied on a separately running dev server and did not verify release assets. | One command builds and tests isolated dev and production servers; CI checks formatting, coverage thresholds, browser behaviour, and Wrangler packaging. |

Matching also passes an independent connectivity oracle for 100 reproducible generated piles in both input orders. Coverage thresholds apply to unit-imported modules, not the full scene or shader code. The production browser test intentionally uses public UI rather than development diagnostics.

## Remaining verification limits

- Chromium touch emulation covers event handling, not the feel or browser behaviour of a physical iPhone or Android device. Safari and Firefox remain separate compatibility checks.
- WebGL 2 is required. Friendly startup failure and explicit context-loss recovery are not implemented in this pass.
- Matching scans pairs and therefore has quadratic worst-case cost. The room has no hard pile-size limit. Long-duration sessions with unusually large unmatched piles need dedicated profiling before choosing a spatial index or a gameplay limit.
- Shader appearance and hardware performance use the separate translucency check and benchmark. CI software rendering cannot certify appearance on every GPU or a 60 fps target.
- The scene and frame loop still live in `main.ts`; this pass extracts the stateful rules most useful to test without restructuring the renderer during release hardening.

## Validation for this pass

- 33 unit tests passed; imported-module coverage: 98.09% lines, 99.38% branches, 98.04% functions.
- 18 Playwright tests passed with CI-style software-rendered Chromium, including the production build.
- TypeScript/Vite build, formatting check, and Wrangler deployment dry run passed.
- Shell translucency pixel check passed with no browser errors.
- Hardware benchmark on Intel UHD 620: 60 measured fps in each six-second idle, moving-aim, and repeated-throw sample; p95 frame interval 16.7 ms. CSS viewport 2259 × 1271 at device scale 1.7, canvas 1686 × 948, 8–13 balls. This is a short regression sample, not a large-pile or long-duration guarantee.
