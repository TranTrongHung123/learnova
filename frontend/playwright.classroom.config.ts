import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";

export default defineConfig({
  ...auth,
  testDir: "./tests/classroom",
  outputDir: "test-results/classroom",
  timeout: 60000,
});
