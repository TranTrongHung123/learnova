import { defineConfig } from "@playwright/test";
import { applicationConfig } from "./playwright.shared";

export default defineConfig(
  applicationConfig({
    suite: "admin",
    frontendPort: 3119,
    backendPort: 8093,
    bootstrapAdmin: true,
  }),
);
