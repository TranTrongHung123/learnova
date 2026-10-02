import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";
export default defineConfig({ ...auth, testDir: "./tests/import", outputDir: "test-results/import", timeout: 60000 });
