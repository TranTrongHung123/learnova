import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";

const servers = Array.isArray(auth.webServer) ? auth.webServer : [];

export default defineConfig({
  ...auth,
  testDir: "./tests/question",
  outputDir: "test-results/question",
  timeout: 60000,
  webServer: servers.map((server, index) =>
    index === 1 && process.env.CI
      ? {
          ...server,
          // CI kiểm tra route đã build, tránh biên dịch dev trong lúc đang thao tác form.
          command: "npm run build && npm run start -- --port 3104",
          timeout: 180000,
          reuseExistingServer: false,
        }
      : server,
  ),
});
