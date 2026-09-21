import { mkdir, writeFile } from "node:fs/promises";
import { test as base, expect } from "@playwright/test";
export { expect };
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const measure = testInfo.project.name === "development";
    if (measure)
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    // Optional remote typography must not make gameplay checks depend on the network.
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" }),
    );
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
      if (measure) {
        const coverage = (await page.coverage.stopJSCoverage()).filter(
          (entry) => /\/src\/[^/?]+\.ts(?:\?|$)/.test(entry.url),
        );
        await mkdir(testInfo.outputDir, { recursive: true });
        await writeFile(
          testInfo.outputPath("browser-coverage.json"),
          JSON.stringify(coverage),
        );
      }
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
export async function matchingPile(page, support = "inside") {
  await page.route("**/src/main.ts*", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(
      /function seed\(\) \{[\s\S]*?\n\}\nfunction chooseColor/,
      `function seed() {
      addBall(0,new THREE.Vector3(-2.5,.38,-2.5));
      addBall(0,new THREE.Vector3(-1.78,.38,-2.5));
      addBall(0,new THREE.Vector3(-1.06,.38,-2.5));
      ${support === "none" ? "" : support === "outside" ? "addBall(1,new THREE.Vector3(1,.38,1));" : "addBall(1,new THREE.Vector3(-1.78,1.1,-2.5));"}
    }\nfunction chooseColor`,
    );
    expect(body).not.toBe(original);
    await route.fulfill({
      response,
      body: "/* test-only starting pile */\n" + body,
    });
  });
}
