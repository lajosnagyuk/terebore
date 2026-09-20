import { test as base, expect } from "@playwright/test";
export { expect };
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() => {
      let seed = 42;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    });
    try {
      await use(page);
    } finally {
      expect(errors, "Uncaught or rendering errors").toEqual([]);
    }
  },
});
export async function openGame(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.__terebore?.elapsed > 0.4);
}
export const state = (page) => page.evaluate(() => window.__terebore);
export async function reset(page) {
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await page.locator("#confirm-reset").click();
}
/** Inject a deterministic starting pile into the test browser only. */
export async function matchingPile(page) {
  await page.route("**/src/main.ts*", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(
      /function seed\(\) \{[\s\S]*?\n\}\nfunction chooseColor/,
      `function seed() {
      addBall(0,new THREE.Vector3(-2.5,.38,-2.5));
      addBall(0,new THREE.Vector3(-1.78,.38,-2.5));
      addBall(0,new THREE.Vector3(-1.06,.38,-2.5));
      addBall(1,new THREE.Vector3(-1.78,1.1,-2.5));
    }\nfunction chooseColor`,
    );
    expect(body).not.toBe(original);
    await route.fulfill({ response, body });
  });
}
