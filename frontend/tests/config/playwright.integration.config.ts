import { defineConfig } from "@playwright/test";
import path from "node:path";
import { applicationConfig, frontendRoot, testPaths } from "./playwright.shared";

const suiteTimeouts = {
  auth: 45000,
  classroom: 60000,
  question: 60000,
  import: 60000,
  exam: 90000,
  session: 90000,
  discovery: 90000,
  attempt: 90000,
  result: 90000,
  monitoring: 120000,
  notification: 120000,
};

export default defineConfig({
  ...applicationConfig({
    suite: "integration",
    frontendPort: 3104,
    backendPort: 8081,
    allowedOrigins: ["http://localhost:3104", "http://localhost:3102", "http://localhost:3103"],
    // Fixture chỉ tồn tại trên test classpath, cần cho project discovery.
    backendArguments: ["--learnova.test.discovery=true"],
    // Dùng cùng bản build cho các project để thao tác form trong CI ổn định.
    buildFrontendInCi: true,
  }),
  testDir: path.join(frontendRoot, "tests"),
  projects: Object.entries(suiteTimeouts).map(([name, timeout]) => ({
    name,
    timeout,
    ...testPaths(name),
  })),
});
