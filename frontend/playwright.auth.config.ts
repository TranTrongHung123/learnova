import { defineConfig } from "@playwright/test";
const api = "http://localhost:8081";
export default defineConfig({
  testDir: "./tests/auth",
  outputDir: "test-results/auth",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:3104",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    // Không ghi trace có chứa password/token của bài test auth.
    trace: "off",
  },
  webServer: [
    {
      command:
        process.platform === "win32"
          ? '..\\backend\\mvnw.cmd -f ../backend/pom.xml -B spring-boot:test-run "-Dspring-boot.run.arguments=--server.port=8081 --learnova.auth.allowed-origins=http://localhost:3104,http://localhost:3102,http://localhost:3103"'
          : '../backend/mvnw -f ../backend/pom.xml -B spring-boot:test-run "-Dspring-boot.run.arguments=--server.port=8081 --learnova.auth.allowed-origins=http://localhost:3104,http://localhost:3102,http://localhost:3103"',
      url: `${api}/api/v1/health`,
      timeout: 180000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --port 3104",
      url: "http://localhost:3104",
      env: { NEXT_PUBLIC_API_URL: api },
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
