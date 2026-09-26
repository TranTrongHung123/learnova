import { expect, test } from "vitest";
import { createApiClient } from "../src/lib/api/client";
import type { HealthResponse } from "../src/lib/api/types";
test("health từ backend thật khớp OpenAPI", async () => {
  const client = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  });
  expect(
    await client.request<HealthResponse>("/api/v1/health", {
      authenticated: false,
      credentials: "omit",
      signal: AbortSignal.timeout(5000),
    }),
  ).toEqual({ status: "UP" });
});
