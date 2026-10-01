import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config";
export default defineConfig({ ...auth, testDir: "./tests/question", outputDir: "test-results/question", timeout: 60000 });
