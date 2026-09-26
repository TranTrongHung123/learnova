import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  outputDir: "test-results/production",
  workers: 1,
  use: {
    baseURL: "http://localhost:3103",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
  },
  webServer: {
    command: "npm run start -- --port 3103",
    url: "http://localhost:3103",
    reuseExistingServer: false,
  },
});
