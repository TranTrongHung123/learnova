import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";

const servers = Array.isArray(auth.webServer) ? auth.webServer : [];
export default defineConfig({
  ...auth, testDir: "./tests/discovery", outputDir: "test-results/discovery", timeout: 90000,
  webServer: servers.map((server, i) => i === 0 ? {
    ...server,
    command: server.command.replace("--server.port=8081", "--server.port=8081 --learnova.test.discovery=true"),
    reuseExistingServer: false,
  } : server),
});
