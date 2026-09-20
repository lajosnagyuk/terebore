import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    viewport: { width: 900, height: 700 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--no-sandbox",
        ...(process.env.CI
          ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
          : ["--enable-gpu"]),
      ],
    },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: false,
    },
    {
      command: "npm run preview -- --port 4174 --strictPort",
      url: "http://localhost:4174",
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "development",
      testMatch: "game.spec.mjs",
      use: { baseURL: "http://localhost:5174" },
    },
    {
      name: "production",
      testMatch: "release.spec.mjs",
      use: { baseURL: "http://localhost:4174" },
    },
  ],
});
