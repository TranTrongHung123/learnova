import { defineConfig } from "@playwright/test";
import { applicationConfig } from "./playwright.shared";

export default defineConfig(
  applicationConfig({
    suite: "dashboard",
    frontendPort: 3120,
    backendPort: 8094,
    bootstrapAdmin: true,
  }),
);
