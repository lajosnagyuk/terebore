import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.goto("http://localhost:5173");
  await page.waitForFunction(() => window.__terebore?.elapsed > 0.5);
  await page.mouse.click(380, 180);
  await page.waitForFunction(
    () => window.__terebore.balls.some((b) => b.banked),
    null,
    { timeout: 5000 },
  );
  assert.ok(
    await page.evaluate(() => window.__terebore.balls.some((b) => b.banked)),
  );
  await page.waitForFunction(() => window.__terebore.cadence.ready);
  console.log("Wall bank detected; next throw unlocked.");
} finally {
  await browser.close();
}
