import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// A repeatable short churn check, not a claim about unlimited sessions or all GPU memory.
const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto("http://localhost:5173");
  await page.waitForFunction(() => window.__terebore?.elapsed > 0.4);
  async function snapshot() {
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const heap = metrics.find(
      (metric) => metric.name === "JSHeapUsedSize",
    ).value;
    const { textures, geometries, programs, bodies, shadowCapacity } =
      await page.evaluate(() => window.__terebore.rendering);
    return {
      heap,
      resources: { textures, geometries, programs, bodies, shadowCapacity },
    };
  }
  let baseline;
  for (let cycle = 0; cycle < 24; cycle++) {
    await page.mouse.click(450, 440);
    await page.waitForFunction(() => window.__terebore.cadence.ready);
    await page
      .getByRole("button", { name: "Start fresh", exact: true })
      .click();
    await page.locator("#confirm-reset").click();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (cycle === 3) baseline = await snapshot();
  }
  const final = await snapshot();
  assert.deepEqual(
    final.resources,
    baseline.resources,
    "Reset must return resource counts to the warmed baseline",
  );
  assert.ok(
    final.heap < baseline.heap + 2_000_000,
    "Post-GC JS heap grew more than the 2 MB churn allowance",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        cycles: 24,
        baseline,
        final,
        heapGrowth: final.heap - baseline.heap,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
