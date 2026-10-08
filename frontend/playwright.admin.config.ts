import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";

process.env.LEARNOVA_TEST_ADMIN_EMAIL ??= `${randomUUID()}@example.com`;

process.env.LEARNOVA_TEST_ADMIN_PASSWORD ??= randomUUID();

const api = "http://localhost:8093";

export default defineConfig({
  testDir: "./tests/admin",
  outputDir: "test-results/admin",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://localhost:3119",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    trace: "off",
  },
  webServer: [
    {
      command:
        process.platform === "win32"
          ? '..\\backend\\mvnw.cmd -f ../backend/pom.xml -B spring-boot:test-run "-Dspring-boot.run.arguments=--server.port=8093 --learnova.auth.allowed-origins=http://localhost:3119"'
          : '../backend/mvnw -f ../backend/pom.xml -B spring-boot:test-run "-Dspring-boot.run.arguments=--server.port=8093 --learnova.auth.allowed-origins=http://localhost:3119"',
      url: `${api}/api/v1/health`,
      timeout: 180000,
      reuseExistingServer: false,
      env: {
        ADMIN_BOOTSTRAP_ENABLED: "true",
        ADMIN_BOOTSTRAP_EMAIL: process.env.LEARNOVA_TEST_ADMIN_EMAIL,
        ADMIN_BOOTSTRAP_PASSWORD: process.env.LEARNOVA_TEST_ADMIN_PASSWORD,
        ADMIN_BOOTSTRAP_DISPLAY_NAME: "Quản trị kiểm thử",
      },
    },
    {
      command: "npm run dev -- --port 3119",
      url: "http://localhost:3119",
      timeout: 120000,
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_URL: api },
    },
  ],
});
