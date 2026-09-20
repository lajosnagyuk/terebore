import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.addInitScript(() => {
  let seed = 42;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://localhost:5173");
await page.waitForFunction(() => window.__terebore?.elapsed > 1);
await page.evaluate(() => {
  window.__sawCelebration = false;
  function observe() {
    if (window.__terebore?.celebrations > 0) window.__sawCelebration = true;
    requestAnimationFrame(observe);
  }
  requestAnimationFrame(observe);
});
await page.screenshot({ path: "/tmp/terebore-desktop.png" });
const initial = await page.evaluate(() => window.__terebore);
assert.equal(initial.balls.length, 8);
// Hover alone must move the guide, without spending a marble.
await page.mouse.move(450, 460);
await page.waitForTimeout(100);
let targeting = await page.evaluate(() => window.__terebore.targeting);
assert.equal(targeting.surface, "floor");
assert.equal(targeting.visible, true);
assert.ok(
  targeting.point[0] + targeting.point[2] > -1,
  "foreground floor is aimable",
);
assert.equal(await page.evaluate(() => window.__terebore.balls.length), 8);
await page.mouse.move(390, 230);
assert.equal(
  await page.evaluate(() => window.__terebore.targeting.surface),
  "left wall",
);
await page.mouse.move(550, 230);
assert.equal(
  await page.evaluate(() => window.__terebore.targeting.surface),
  "right wall",
);
await page.mouse.move(455, 342);
assert.equal(
  await page.evaluate(() => window.__terebore.targeting.surface),
  "floor",
);
await page.mouse.down();
await page.mouse.up();
assert.equal(
  await page.evaluate(() => window.__terebore.current),
  initial.next,
);
assert.equal(await page.evaluate(() => window.__terebore.balls.length), 9);
// Rapid clicking must not consume the pocket; aim remains available during settling.
const afterFirst = await page.evaluate(() => ({
  current: window.__terebore.current,
  count: window.__terebore.balls.length,
}));
await page.mouse.click(455, 342);
assert.deepEqual(
  await page.evaluate(() => ({
    current: window.__terebore.current,
    count: window.__terebore.balls.length,
  })),
  afterFirst,
);
assert.equal(await page.evaluate(() => window.__terebore.cadence.ready), false);
for (let i = 0; i < 24; i++) {
  const time = await page.evaluate(() => window.__terebore.elapsed);
  await page.waitForFunction(
    (t) =>
      window.__terebore.elapsed > t + 1.5 && window.__terebore.cadence.ready,
    time,
    {
      timeout: 60000,
    },
  );
  // Vary the intended landing across the play area while building the pile.
  await page.mouse.move(400 + (i % 4) * 25, 340 + (i % 2) * 8);
  await page.keyboard.press("Space");
  const state = await page.evaluate(() => window.__terebore);
  assert.ok(
    state.balls.every((b) => b.position.x >= -2.8 && b.position.z >= -2.8),
    "Marbles must remain inside the room walls",
  );
  if (state.score > 0) break;
}
await page.waitForFunction(() => window.__terebore.score > 0, null, {
  timeout: 60000,
});
assert.equal(
  await page.evaluate(() => window.__sawCelebration),
  true,
  "Matching marbles should celebrate before clearing",
);
console.log(
  "Scoring confirmed:",
  await page.evaluate(() => ({
    score: window.__terebore.score,
    balls: window.__terebore.balls.length,
  })),
);
// The score token settles outside the pile and never captures game input.
await page.waitForTimeout(1150);
const token = await page.locator(".toast").evaluate((el) => {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    opacity: getComputedStyle(el).opacity,
    pointerEvents: getComputedStyle(el).pointerEvents,
  };
});
assert.equal(token.pointerEvents, "none");
assert.equal(token.opacity, "1");
assert.ok(token.left >= 12 && token.right < 300 && token.bottom < 700);
await page.screenshot({ path: "/tmp/terebore-score-token.png" });
// Right click must not throw, and cancelled touch/pointer gestures must not throw.
const beforeCancel = await page.evaluate(() => window.__terebore.current);
await page.mouse.click(450, 440, { button: "right" });
assert.equal(
  await page.evaluate(() => window.__terebore.current),
  beforeCancel,
);
await page.getByRole("button", { name: "How to play" }).click();
assert.ok(await page.locator("#help-dialog").isVisible());
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Turn sound on" }).click();
assert.equal(await page.locator("#sound").getAttribute("aria-pressed"), "true");
await page.getByRole("button", { name: "Start fresh", exact: true }).click();
await page.getByRole("button", { name: "Keep playing" }).click();
await page.getByRole("button", { name: "Start fresh", exact: true }).click();
await page.locator("#confirm-reset").click();
assert.equal(await page.evaluate(() => window.__terebore.score), 0);
assert.equal(await page.evaluate(() => window.__terebore.balls.length), 8);
assert.ok(Number(await page.locator("#best").textContent()) > 0);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1000);
await page.screenshot({ path: "/tmp/terebore-mobile.png" });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: 195, y: 650 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: 200, y: 430 }],
});
const touchAim = await page.evaluate(() => window.__terebore.targeting);
assert.deepEqual(
  touchAim.pointer,
  [200, 346],
  "Touch aim should sit 84 CSS pixels above the finger",
);
assert.equal(
  await page
    .locator(".touch-aim")
    .evaluate((el) => getComputedStyle(el).opacity),
  "1",
);
await page.screenshot({ path: "/tmp/terebore-touch-aim.png" });
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
assert.equal(await page.evaluate(() => window.__terebore.current), 1);
assert.deepEqual(
  await page.evaluate(() => window.__terebore.targeting.point),
  touchAim.point,
  "Releasing must preserve the visible target",
);
assert.equal(
  await page
    .locator(".touch-aim")
    .evaluate((el) => getComputedStyle(el).opacity),
  "0",
);
await page.waitForFunction(() => window.__terebore.cadence.ready);
const beforeCancelledTouch = await page.evaluate(() => ({
  current: window.__terebore.current,
  count: window.__terebore.balls.length,
}));
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: 195, y: 650 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: 220, y: 420 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchCancel",
  touchPoints: [],
});
const afterCancelledTouch = await page.evaluate(() => ({
  current: window.__terebore.current,
  count: window.__terebore.balls.length,
}));
assert.deepEqual(afterCancelledTouch, beforeCancelledTouch);
assert.equal(
  await page.evaluate(() => window.__terebore.targeting.visible),
  false,
);
console.log("Browser errors:", errors);
await browser.close();
assert.deepEqual(errors, []);
