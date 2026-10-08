import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";

export default defineConfig({
  ...auth,
  testDir: "./tests/notification",
  outputDir: "test-results/notification",
  timeout: 120000,
  webServer: (Array.isArray(auth.webServer) ? auth.webServer : []).map((s, i) =>
    i === 0 ? { ...s, reuseExistingServer: false } : s,
  ),
});
