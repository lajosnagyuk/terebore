import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-gpu",
    ...(process.env.SOFTWARE_RENDERER
      ? ["--use-gl=angle", "--use-angle=swiftshader"]
      : []),
  ],
});
const page = await browser.newPage({
  viewport: { width: 2259, height: 1271 },
  deviceScaleFactor: 1.7,
});
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () =>
  Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://localhost:5173/?stats");
  await page.waitForTimeout(2000);
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  async function measure() {
    const before = await metrics();
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          let last = performance.now();
          const start = last;
          function tick(now) {
            samples.push(now - last);
            last = now;
            if (now - start < 6000) requestAnimationFrame(tick);
            else {
              samples.sort((a, b) => a - b);
              const state = window.__terebore;
              resolve({
                frames: samples.length,
                measuredFps: Math.round(
                  (1000 * samples.length) / (now - start),
                ),
                p95: samples[Math.floor(samples.length * 0.95)],
                ...state.rendering,
                balls: state.balls.length,
              });
            }
          }
          requestAnimationFrame(tick);
        }),
    );
    const after = await metrics();
    return {
      ...result,
      mainThreadTaskMs: Math.round(
        (after.TaskDuration - before.TaskDuration) * 1000,
      ),
      jsHeapUsedBytes: after.JSHeapUsedSize,
    };
  }
  const idle = await measure();
  assert.ok(idle.width * idle.height <= 1_600_000);
  await page.mouse.move(1129, 1050);
  await page.mouse.down();
  await page.mouse.move(1150, 750, { steps: 3 });
  await page.waitForTimeout(300);
  const aiming = await page.evaluate(() => window.__terebore.rendering);
  const movingPointer = await page.evaluate(() =>
    setInterval(() => {
      document.querySelector("#world").dispatchEvent(
        new PointerEvent("pointermove", {
          clientX:
            innerWidth * (0.5 + Math.sin(performance.now() / 700) * 0.12),
          clientY: innerHeight * 0.46,
          pointerType: "mouse",
          isPrimary: true,
          pointerId: 1,
        }),
      );
    }, 16),
  );
  const tracking = await measure();
  await page.evaluate((id) => clearInterval(id), movingPointer);
  assert.ok(aiming.calls <= idle.calls + 2);
  await page.screenshot({ path: "/tmp/terebore-aim.png" });
  await page.mouse.up();
  const interval = await page.evaluate(() =>
    setInterval(
      () =>
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })),
      700,
    ),
  );
  const active = await measure();
  await page.evaluate((id) => clearInterval(id), interval);
  const contained = await page.evaluate(() =>
    window.__terebore.balls.every(
      (b) => b.position.x >= -2.8 && b.position.z >= -2.8,
    ),
  );
  assert.ok(contained, "Marbles escaped the room");
  console.log(JSON.stringify({ gpu, idle, aiming, tracking, active, errors }));
  await page.screenshot({
    path: process.argv[2] || "/tmp/terebore-performance.png",
  });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
