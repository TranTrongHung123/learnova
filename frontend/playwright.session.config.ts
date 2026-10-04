import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";
export default defineConfig({ ...auth, testDir: "./tests/session", outputDir: "test-results/session", timeout: 90000 });
