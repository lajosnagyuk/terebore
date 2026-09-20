import { test, expect } from "./fixtures.mjs";
test("production assets load, play, and reset without development hooks", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  await expect(page.locator("canvas")).toBeVisible();
  expect(await page.evaluate(() => window.__terebore)).toBeUndefined();
  expect(await page.locator("script[type=module]").getAttribute("src")).toMatch(
    /^\/assets\/.*\.js$/,
  );
  await page.mouse.click(450, 440);
  await expect(page.locator("body")).toHaveClass(/playing/);
  await expect(page.locator(".hand-label")).toHaveText("LET IT LAND");
  await expect(page.locator(".hand-label")).toHaveText("IN YOUR HAND");
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await page.locator("#confirm-reset").click();
  await expect(page.locator("body")).not.toHaveClass(/playing/);
  await expect(page.locator("#score")).toHaveText("0");
});
