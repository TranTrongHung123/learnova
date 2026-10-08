import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";

export default defineConfig({
  ...auth,
  testDir: "./tests/exam",
  outputDir: "test-results/exam",
  timeout: 90000,
});
