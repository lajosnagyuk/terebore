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
  await expect(page.locator(".score-pop")).toHaveCSS("opacity", "1");
  const box = await page.locator(".score-pop").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(12);
  expect(box.x + box.width).toBeLessThanOrEqual(900);
  await page.waitForTimeout(250);
  const later = await page.locator(".score-pop").boundingBox();
  expect(Math.abs(later.y - box.y)).toBeLessThan(1);
  await expect(page.locator(".score-pop")).toHaveCSS("pointer-events", "none");
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

test("room outlines fade through successive shells instead of drawing over the pile", async ({
  page,
}) => {
  await openGame(page);
  const contrast = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { roomOutline } = await import("/src/room-art.ts");
    const { createMarbleMaterial } = await import("/src/marble-art.ts");
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    renderer.setSize(160, 160);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1e3cb");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.z = 5;
    // Long room edges can have a sort centre closer than the balls even
    // though the visible segment is behind them. The second edge is offscreen.
    const line = roomOutline(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -1, -5.2),
        new THREE.Vector3(0, 30, -5.2),
        new THREE.Vector3(30, 30, 20),
        new THREE.Vector3(31, 30, 20),
      ]),
      "#777464",
      0.6,
    );
    scene.add(line);
    const geometry = new THREE.SphereGeometry(1, 32, 20);
    const balls = Array.from({ length: 3 }, (_, i) => {
      const ball = new THREE.Mesh(
        geometry,
        createMarbleMaterial("#da527c", 0.5),
      );
      ball.position.z = -i * 2;
      scene.add(ball);
      return ball;
    });
    const gl = renderer.getContext();
    const read = () => {
      renderer.render(scene, camera);
      const pixels = new Uint8Array(4 * 4 * 4);
      gl.readPixels(78, 78, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const result = [0, 1, 3].map((count) => {
      balls.forEach((ball, i) => (ball.visible = i < count));
      line.visible = true;
      const withLine = read();
      line.visible = false;
      const withoutLine = read();
      return withLine.reduce(
        (sum, value, i) =>
          sum + (i % 4 === 3 ? 0 : Math.abs(value - withoutLine[i])),
        0,
      );
    });
    geometry.dispose();
    balls.forEach((ball) => ball.material.dispose());
    line.geometry.dispose();
    line.material.dispose();
    renderer.dispose();
    return result;
  });
  expect(contrast[0]).toBeGreaterThan(50);
  expect(contrast[1]).toBeLessThan(contrast[0] * 0.5);
  expect(contrast[2]).toBeLessThan(contrast[1] * 0.4);
});

for (const height of [640, 844]) {
  test(`portrait score token clears the hand and instructions at ${height}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height });
    await matchingPile(page);
    await openGame(page);
    await expect(page.locator("#score")).toHaveText("30");
    await page.waitForTimeout(1200);
    const token = await page.locator(".score-pop").boundingBox();
    for (const selector of [".hand-label", ".instructions", "header"]) {
      const other = await page.locator(selector).boundingBox();
      expect(
        token.y + token.height <= other.y ||
          other.y + other.height <= token.y ||
          token.x + token.width <= other.x ||
          other.x + other.width <= token.x,
      ).toBe(true);
    }
    expect(token.x).toBeGreaterThanOrEqual(0);
    expect(token.x + token.width).toBeLessThanOrEqual(390);
  });
}

test("gameplay claims touch scrolling while controls retain native touches", async ({
  page,
}) => {
  await openGame(page);
  const prevented = await page.evaluate(() => {
    const send = (selector, type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      document.querySelector(selector).dispatchEvent(event);
      return event.defaultPrevented;
    };
    return [
      send("#world", "touchstart"),
      send("#world", "touchmove"),
      send("#help", "touchstart"),
    ];
  });
  expect(prevented).toEqual([true, true, false]);
  await expect(page.locator("html")).toHaveCSS("overscroll-behavior", "none");
});

for (const support of ["none", "outside"]) {
  test(`clearing the corner awards 25 once with ${support} remaining support`, async ({
    page,
  }) => {
    await matchingPile(page, support);
    await openGame(page);
    await expect(page.locator("#score")).toHaveText("55");
    await expect(page.locator(".score-points")).toHaveText("+55");
    await expect(page.locator(".score-detail")).toHaveText(
      "3 cleared\nCorner +25",
    );
    await expect(page.locator("#best")).toHaveText("55");
    expect((await state(page)).balls).toHaveLength(support === "none" ? 0 : 1);
    await page.waitForTimeout(1000);
    await expect(page.locator("#score")).toHaveText("55");
    await reset(page);
    await expect(page.locator("#score")).toHaveText("0");
    // A new round may earn the bonus again.
    await expect(page.locator("#score")).toHaveText("55");
  });
}

for (const colors of [
  [0, 5, 0],
  [6, 5, 6],
  [5, 6, 6],
  [6, 6, 5],
]) {
  test(`Light clears its touching neighbours ${colors.join("-")}`, async ({
    page,
  }) => {
    await matchingPile(page, "none", colors);
    await openGame(page);
    await expect(page.locator("#score")).toHaveText("55");
    expect((await state(page)).balls).toHaveLength(0);
  });
}
test("three Clay balls remain inert in the physical pile", async ({ page }) => {
  await matchingPile(page, "none", [6, 6, 6]);
  await openGame(page);
  await page.waitForTimeout(1500);
  await expect(page.locator("#score")).toHaveText("0");
  expect((await state(page)).balls).toHaveLength(3);
});

test("a completed match raises Light odds until it enters the pocket", async ({
  page,
}) => {
  await matchingPile(page, "none");
  await openGame(page);
  await expect(page.locator("#score")).toHaveText("55");
  expect((await state(page)).draw.lightChance).toBe(2 / 42);
  // This ticket is primary at base odds, but Light after one match.
  await page.evaluate(() => (Math.random = () => 0.94));
  await page.mouse.click(450, 440);
  expect((await state(page)).next).toBe(5);
  expect((await state(page)).draw.lightChance).toBe(1 / 42);
  await expect(page.locator("#next-name")).toHaveText("Light");
  await reset(page);
  expect((await state(page)).draw.lightChance).toBe(1 / 42);
});

for (const count of [1, 2, 3]) {
  test(`${count} Perfects match their ordinary family and add score before the corner bonus`, async ({
    page,
  }) => {
    await matchingPile(
      page,
      "none",
      [0, 0, 0],
      [count >= 1, count >= 2, count >= 3],
    );
    await openGame(page);
    await expect(page.locator(".chance-lights i")).toHaveCount(5);
    await expect
      .poll(async () => (await state(page)).score)
      .toBe(55 + count * 15);
    await expect(page.locator(".score-detail")).toContainText(
      `${count} Perfect${count === 1 ? "" : "s"} +${count * 15}`,
    );
    expect(
      await page
        .locator(".score-pop")
        .evaluate((el) => el.style.getPropertyValue("--score-color")),
    ).toBe((await state(page)).palette[0].color);
    expect((await state(page)).balls).toHaveLength(0);
    expect((await state(page)).draw.perfectChances[0]).toBe(2 / 6);
    await expect(page.locator(".chance-lights")).toHaveAttribute(
      "aria-label",
      /Perfect Cherry blossom: growing/,
    );
    expect(
      await page
        .locator(".chance-lights i")
        .first()
        .evaluate((el) => Number(el.style.getPropertyValue("--chance-glow"))),
    ).toBeGreaterThan(0);
    await reset(page);
    expect((await state(page)).draw.perfectChances).toEqual(
      Array(5).fill(1 / 6),
    );
  });
}
test("a Perfect moves from pocket to hand to pile with its identity intact", async ({
  page,
}) => {
  await openGame(page);
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.mouse.click(450, 440);
  await expect(page.locator("#next-name")).toHaveText("Perfect Wild plum");
  await expect(page.locator(".pocket-ball")).toHaveAttribute(
    "data-finish",
    "perfect",
  );
  await page.waitForFunction(() => window.__terebore.cadence.ready);
  await page.mouse.click(450, 440);
  expect((await state(page)).currentPerfect).toBe(true);
  await page.waitForFunction(() => window.__terebore.cadence.ready);
  await page.mouse.click(450, 440);
  expect(
    (await state(page)).balls.some((ball) => ball.color === 2 && ball.perfect),
  ).toBe(true);
});

test("Light between different primary colours stays unmatched", async ({
  page,
}) => {
  await matchingPile(page, "none", [0, 5, 1]);
  await openGame(page);
  await page.waitForTimeout(1500);
  await expect(page.locator("#score")).toHaveText("0");
  expect((await state(page)).balls).toHaveLength(3);
});

test("Light clears two qualifying families together and counts itself once", async ({
  page,
}) => {
  await matchingPile(page, "none", [0, 5, 1], undefined, [
    [0, -2.5, 0.38, -1.78],
    [1, -1.06, 0.38, -1.78],
  ]);
  await openGame(page);
  await expect(page.locator("#score")).toHaveText("85");
  await expect(page.locator(".score-detail")).toHaveText(
    "5 cleared · Multi\nLight\nGroup +10 · Corner +25",
  );
  expect(
    await page
      .locator(".score-pop")
      .evaluate((el) => el.style.getPropertyValue("--score-color")),
  ).toBe("#39576f");
  expect((await state(page)).balls).toHaveLength(0);
  expect((await state(page)).draw.perfectChances.slice(0, 2)).toEqual([
    2 / 6,
    2 / 6,
  ]);
  expect((await state(page)).draw.lightChance).toBe(2 / 42);
});
test("Light completes a pair without clearing the other colour touching it", async ({
  page,
}) => {
  await matchingPile(page, "none", [0, 0, 5], undefined, [
    [1, -1.06, 0.38, -1.78],
  ]);
  await openGame(page);
  await expect(page.locator("#score")).toHaveText("30");
  expect((await state(page)).balls.map((ball) => ball.color)).toEqual([1]);
  expect((await state(page)).draw.perfectChances.slice(0, 2)).toEqual([
    2 / 6,
    1 / 6,
  ]);
});
