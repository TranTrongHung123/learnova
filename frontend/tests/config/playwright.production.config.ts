import { defineConfig } from "@playwright/test";
import { browserUse, frontendRoot, testPaths } from "./playwright.shared";

export default defineConfig({
  ...testPaths("production"),
  workers: 1,
  use: browserUse("http://localhost:3103"),
  webServer: {
    command: "npm run start -- --port 3103",
    cwd: frontendRoot,
    url: "http://localhost:3103",
    reuseExistingServer: false,
  },
});
