import { defineConfig } from "@playwright/test";

const api = "http://localhost:8082";

const args =
  "--server.port=8082 --learnova.test.google=true --learnova.auth.allowed-origins=http://localhost:3105 --learnova.auth.google.frontend-url=http://localhost:3105 --learnova.auth.google.redirect-uri=http://localhost:8082/api/v1/auth/google/callback";

export default defineConfig({
  testDir: "./tests/google",
  outputDir: "test-results/google",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:3105",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    trace: "off",
  },
  webServer: [
    {
      command: `${process.platform === "win32" ? "..\\backend\\mvnw.cmd" : "../backend/mvnw"} -f ../backend/pom.xml -B spring-boot:test-run "-Dspring-boot.run.arguments=${args}"`,
      url: `${api}/api/v1/health`,
      timeout: 180000,
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command: "npm run dev -- --port 3105",
      url: "http://localhost:3105",
      env: { NEXT_PUBLIC_API_URL: api },
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
