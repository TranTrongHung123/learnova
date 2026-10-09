import { defineConfig } from "@playwright/test";
import { browserUse, frontendRoot, testPaths } from "./tests/config/playwright.shared";

const existingServer = process.env.LEARNOVA_BROWSER_BASE_URL;

export default defineConfig({
  ...testPaths("browser"),
  fullyParallel: false,
  workers: 1,
  use: {
    ...browserUse(existingServer ?? "http://localhost:3102"),
    trace: "retain-on-failure",
  },
  webServer: existingServer ? undefined : {
    command: "npm run dev -- --port 3102",
    cwd: frontendRoot,
    url: "http://localhost:3102",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
