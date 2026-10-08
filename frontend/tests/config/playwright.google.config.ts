import { defineConfig } from "@playwright/test";
import { applicationConfig } from "./playwright.shared";

export default defineConfig({
  ...applicationConfig({
    suite: "google",
    frontendPort: 3105,
    backendPort: 8082,
    backendArguments: [
      "--learnova.test.google=true",
      "--learnova.auth.google.frontend-url=http://localhost:3105",
      "--learnova.auth.google.redirect-uri=http://localhost:8082/api/v1/auth/google/callback",
    ],
  }),
  timeout: 45000,
});
