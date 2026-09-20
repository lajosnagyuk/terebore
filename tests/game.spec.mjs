import {
  test,
  expect,
  openGame,
  state,
  reset,
  matchingPile,
} from "./fixtures.mjs";

for (const corrupt of ["Infinity", "-50", "abc", "1.5"]) {
  test(`corrupt stored best ${corrupt} cannot poison scoring`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("terebore-best", value),
      corrupt,
    );
    await openGame(page);
    await expect(page.locator("#best")).toHaveText("0");
  });
}
test("storage denied at property access still permits throwing and reset", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    }),
  );
  await openGame(page);
  await page.mouse.click(450, 440);
  expect((await state(page)).current).toBe(1);
  await reset(page);
  expect((await state(page)).balls).toHaveLength(8);
  await expect(page.locator("#best")).toHaveText("0");
});
test("a banked throw respects cadence, then accepts the next throw", async ({
  page,
}) => {
  await openGame(page);
  await page.mouse.move(380, 180);
  expect((await state(page)).balls).toHaveLength(8);
  await page.mouse.click(380, 180);
  await page.mouse.click(380, 180);
  expect((await state(page)).balls).toHaveLength(9);
  await page.waitForFunction(
    () =>
      window.__terebore.balls.some((b) => b.banked) &&
      window.__terebore.cadence.ready,
  );
  await page.mouse.click(450, 440);
  expect((await state(page)).balls).toHaveLength(10);
});
for (const interrupt of ["blur", "resize", "visibility"]) {
  test(`${interrupt} cancels a drag without a delayed throw`, async ({
    page,
  }) => {
    await openGame(page);
    await page.mouse.move(450, 440);
    await page.mouse.down();
    if (interrupt === "resize")
      await page.setViewportSize({ width: 800, height: 650 });
    else if (interrupt === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else
      await page.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
    await page.mouse.up();
    expect((await state(page)).current).toBe(0);
    expect((await state(page)).balls).toHaveLength(8);
    expect((await state(page)).targeting.visible).toBe(false);
  });
}
test("secondary pointer cancellation does not cancel the primary drag", async ({
  page,
}) => {
  await openGame(page);
  await page.mouse.move(450, 440);
  await page.mouse.down();
  await page.evaluate(() => {
    const el = document.querySelector("#world");
    for (const type of ["pointercancel", "lostpointercapture"])
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 99,
          isPrimary: false,
          pointerType: "touch",
        }),
      );
  });
  expect((await state(page)).targeting.visible).toBe(true);
  await page.mouse.up();
  expect((await state(page)).current).toBe(1);
});
test("keyboard auto-repeat cannot auto-fire; a fresh press works", async ({
  page,
}) => {
  await openGame(page);
  await page.locator("#world").focus();
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", repeat: true }),
    ),
  );
  expect((await state(page)).balls).toHaveLength(8);
  await page.keyboard.press("ArrowLeft");
  expect((await state(page)).targeting.visible).toBe(true);
  await page.keyboard.press("Space");
  expect((await state(page)).balls).toHaveLength(9);
});
test("dialogs pause simulation and block throws", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: "How to play" }).click();
  const before = await state(page);
  await page.waitForTimeout(350);
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })),
  );
  const after = await state(page);
  expect(after.elapsed).toBe(before.elapsed);
  expect(after.balls).toEqual(before.balls);
  await page.keyboard.press("Escape");
  await page.mouse.click(450, 440);
  expect((await state(page)).current).toBe(1);
});
test("reset cancels transient UI and preserves a valid personal best", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("terebore-best", "650"));
  await openGame(page);
  await page.mouse.click(450, 440);
  await reset(page);
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#best")).toHaveText("650");
  await expect(page.locator("body")).not.toHaveClass(/playing/);
  await page.waitForTimeout(2000);
  await expect(page.locator("#hint")).toHaveText(
    "Point to aim · click to throw",
  );
  expect((await state(page)).balls).toHaveLength(8);
});
test("touch target stays above the finger, survives release, and cancels off-screen", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  await touch("touchStart", [{ x: 195, y: 650 }]);
  await touch("touchMove", [{ x: 200, y: 430 }]);
  const aim = (await state(page)).targeting;
  expect(aim.pointer).toEqual([200, 346]);
  await expect(page.locator(".touch-aim")).toHaveClass(/visible/);
  await touch("touchEnd", []);
  expect((await state(page)).targeting.point).toEqual(aim.point);
  expect((await state(page)).current).toBe(1);
  await reset(page);
  await page.evaluate(() =>
    document
      .querySelector("#world")
      .addEventListener(
        "pointerdown",
        (e) => (window.__touchId = e.pointerId),
        { once: true },
      ),
  );
  await touch("touchStart", [{ x: 195, y: 650 }]);
  await page.evaluate(() =>
    document.querySelector("#world").dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: window.__touchId,
        pointerType: "touch",
        isPrimary: true,
        clientX: 195,
        clientY: -10,
      }),
    ),
  );
  await touch("touchEnd", []);
  expect((await state(page)).current).toBe(0);
  await expect(page.locator(".touch-aim")).not.toHaveClass(/visible/);
});
test("a committed match celebrates, clears once, and wakes its remaining support", async ({
  page,
}) => {
  await matchingPile(page);
  await openGame(page);
  await page.waitForFunction(() => window.__terebore.celebrations === 1);
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#score")).toHaveText("30");
  await page.waitForFunction(
    () =>
      window.__terebore.balls.length === 1 &&
      window.__terebore.balls[0].position.y < 0.5,
  );
  await page.waitForTimeout(350);
  await expect(page.locator("#score")).toHaveText("30");
  await expect(page.locator("#best")).toHaveText("30");
  expect(await page.evaluate(() => localStorage.getItem("terebore-best"))).toBe(
    "30",
  );
});
test("reduced motion leaves a readable stationary score token", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await matchingPile(page);
  await openGame(page);
  await expect(page.locator("#score")).toHaveText("30");
  await expect(page.locator(".toast")).toHaveCSS("opacity", "1");
  const box = await page.locator(".toast").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(12);
  expect(box.x + box.width).toBeLessThan(300);
  await expect(page.locator(".toast")).toHaveCSS("pointer-events", "none");
});

test("an audio resume rejection cannot interrupt play", async ({ page }) => {
  await page.addInitScript(() => {
    AudioContext.prototype.resume = () =>
      Promise.reject(new DOMException("Audio denied", "NotAllowedError"));
  });
  await openGame(page);
  await page.getByRole("button", { name: "Turn sound on" }).click();
  await expect(
    page.getByRole("button", { name: "Turn sound off" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(450, 440);
  expect((await state(page)).balls).toHaveLength(9);
  await page.getByRole("button", { name: "Turn sound off" }).click();
});
