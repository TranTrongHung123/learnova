import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "test-results/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3102",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3102",
    url: "http://localhost:3102",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
