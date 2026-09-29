import { describe, expect, it, vi } from "vitest";
import { AuthSession } from "./session";
import {
  safeReturnTo,
  resolveWorkspace,
  rememberWorkspace,
} from "./workspace-resolution";

const user = {
  id: "u1",
  email: "a@example.com",
  displayName: "A",
  avatarUrl: null,
  status: "ACTIVE" as const,
  roles: ["PARTICIPANT" as const],
};
const tokens = (token: string) => ({
  accessToken: token,
  tokenType: "Bearer",
  expiresIn: 900,
  expiresAt: "2026-09-28T00:00:00Z",
  user,
});
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const csrf = () => response({ headerName: "X-XSRF-TOKEN", token: "csrf" });
const problem = (status: number, code: string) =>
  response(
    {
      type: "about:blank",
      title: "Error",
      detail: "Error",
      instance: "/api/v1/auth/refresh",
      status,
      code,
      fieldErrors: [],
    },
    status,
  );

describe("auth session reliability", () => {
  it("profile save publishes only the server-confirmed name and avatar with fresh auth and CSRF", async () => {
    const profile = { ...user, displayName: "Server name", avatarUrl: "https://example.com/a.png", createdAt: "2026-09-29T00:00:00Z", hasLocalIdentity: true };
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/refresh")) return response(tokens("fresh"));
      expect(init?.method).toBe("PUT");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fresh");
      expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("csrf");
      return response(profile);
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await session.saveProfile({ displayName: "Client name", avatarUrl: null });
    expect(session.getSnapshot().user).toEqual({ ...user, displayName: profile.displayName, avatarUrl: profile.avatarUrl });
  });
  it.each([400, 401, 503])("does not replay a password command after HTTP %s", async (status) => {
    let commands = 0;
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/refresh")) return response(tokens("fresh"));
      commands++;
      return problem(status, "CHANGE_FAILED");
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await expect(session.changePassword({ currentPassword: "old", newPassword: "new" })).rejects.toMatchObject({ status });
    expect(commands).toBe(1);
  });
  it("failed profile save leaves the confirmed profile in memory", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/refresh")) return response(tokens("fresh"));
      return problem(400, "VALIDATION_FAILED");
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await expect(session.saveProfile({ displayName: "Rejected", avatarUrl: null })).rejects.toMatchObject({ status: 400 });
    expect(session.getSnapshot().user).toEqual(user);
  });
  it("Google completion serializes mutation and refresh, keeps credentials out of the mutation response", async () => {
    const paths: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith("/csrf")) return csrf();
      if (path.endsWith("/google/onboarding")) {
        expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("csrf");
        expect(new Headers(init?.headers).has("Authorization")).toBe(false);
        expect(JSON.parse(String(init?.body))).toEqual({ roles: ["PARTICIPANT"] });
        return new Response(null, { status: 204 });
      }
      if (path.endsWith("/refresh")) return response(tokens("google-token"));
      throw new Error("Unexpected request");
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await session.googleAction("onboarding", { roles: ["PARTICIPANT"] });
    expect(paths).toEqual(["/api/v1/auth/csrf", "/api/v1/auth/google/onboarding", "/api/v1/auth/csrf", "/api/v1/auth/refresh"]);
    expect(session.getSnapshot().user).toEqual(user);
  });
  it("shares Google callback resolution and does not issue a refresh for pending onboarding", async () => {
    const fetcher = vi.fn(async () => response({ state: "ONBOARDING", email: user.email }));
    const session = new AuthSession("http://localhost:8080", fetcher);
    const values = await Promise.all([session.resolveGoogleCallback(), session.resolveGoogleCallback()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(values[0]?.state).toBe("ONBOARDING");
    expect(session.getSnapshot().user).toBeNull();
  });
  it("does not treat an unavailable Google flow as a completed login", async () => {
    const fetcher = vi.fn(async () => problem(503, "SERVICE_UNAVAILABLE"));
    const session = new AuthSession("http://localhost:8080", fetcher);
    await expect(session.resolveGoogleCallback()).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bootstrap shares one refresh and concurrent 401 retries only once", async () => {
    let refreshes = 0;
    let calls = 0;
    const fetcher = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/csrf")) return csrf();
        if (path.endsWith("/refresh"))
          return response(tokens(`token-${++refreshes}`));
        calls++;
        return new Headers(init?.headers).get("Authorization") ===
          "Bearer token-2"
          ? response({ ok: true })
          : problem(401, "AUTHENTICATION_REQUIRED");
      },
    );
    const session = new AuthSession("http://localhost:8080", fetcher);
    await Promise.all([session.bootstrap(), session.bootstrap()]);
    expect(refreshes).toBe(1);
    expect(session.getSnapshot().status).toBe("AUTHENTICATED");
    await Promise.all([
      session.api.request("/api/v1/auth/me"),
      session.api.request("/api/v1/auth/me"),
    ]);
    expect(refreshes).toBe(2);
    expect(calls).toBe(4);
  });
  it("does not loop on repeated 401 or refresh on 403", async () => {
    let refreshes = 0;
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const path = String(input);
      if (path.endsWith("/csrf")) return csrf();
      if (path.endsWith("/refresh"))
        return response(tokens(`token-${++refreshes}`));
      return problem(path.endsWith("/forbidden") ? 403 : 401, "DENIED");
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await session.bootstrap();
    await expect(session.api.request("/api/v1/auth/me")).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshes).toBe(2);
    await expect(
      session.api.request("/api/v1/forbidden"),
    ).rejects.toMatchObject({ status: 403 });
    expect(refreshes).toBe(2);
  });
  it("distinguishes expired authentication from an unavailable service", async () => {
    for (const status of [401, 503]) {
      const fetcher = vi.fn(async (input: URL | RequestInfo) =>
        String(input).endsWith("/csrf")
          ? csrf()
          : problem(
              status,
              status === 401 ? "INVALID_REFRESH_TOKEN" : "SERVICE_UNAVAILABLE",
            ),
      );
      const session = new AuthSession("http://localhost:8080", fetcher);
      await session.bootstrap();
      expect(session.getSnapshot().status).toBe(
        status === 401 ? "UNAUTHENTICATED" : "ERROR",
      );
    }
  });
  it("late refresh cannot restore authentication after logout", async () => {
    let release!: (response: Response) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/refresh")) {
        entered();
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return new Response(null, { status: 204 });
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    const states: string[] = [];
    session.subscribe(() => states.push(session.getSnapshot().status));
    const bootstrap = session.bootstrap();
    await started;
    const logout = session.logout();
    release(response(tokens("late-token")));
    await Promise.all([bootstrap, logout]);
    expect(session.getSnapshot().status).toBe("UNAUTHENTICATED");
    expect(states).not.toContain("AUTHENTICATED");
  });
  it("abort while waiting for refresh does not replay a cancelled request", async () => {
    const controller = new AbortController();
    let attempts = 0;
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/refresh")) {
        controller.abort();
        return response(tokens("next"));
      }
      attempts++;
      return problem(401, "AUTHENTICATION_REQUIRED");
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await expect(
      session.api.request("/api/v1/auth/me", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(attempts).toBe(1);
  });
  it("does not retry or return an old user's request after account changes", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/login"))
        return response(tokens("other-user"));
      return new Promise<Response>((resolve) => {
        complete = resolve;
      });
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    const pending = session.api.request("/api/v1/auth/me");
    await session.login("other@example.com", "long-password");
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    complete(problem(401, "AUTHENTICATION_REQUIRED"));
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("logout-all refresh failure clears memory without claiming success and can retry", async () => {
    let offline = false;
    let logoutCalls = 0;
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).endsWith("/csrf")) return csrf();
      if (String(input).endsWith("/logout-all")) {
        logoutCalls++;
        return new Response(null, { status: 204 });
      }
      if (offline) return problem(503, "SERVICE_UNAVAILABLE");
      return response(tokens("valid"));
    });
    const session = new AuthSession("http://localhost:8080", fetcher);
    await session.bootstrap();
    offline = true;
    await expect(session.logout(true)).rejects.toMatchObject({ status: 503 });
    expect(session.getSnapshot().status).toBe("UNAUTHENTICATED");
    expect(logoutCalls).toBe(0);
    offline = false;
    await session.logout(true);
    expect(logoutCalls).toBe(1);
  });
});

describe("workspace resolution", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "/creator",
    "/admin",
    "/participant/../admin",
    "/participant/%2e%2e/admin",
  ])("rejects %s", (value) => {
    expect(safeReturnTo(value, ["PARTICIPANT"])).toBeNull();
  });
  it("preserves an authorized internal destination", () => {
    expect(safeReturnTo("/participant/exams?q=1", ["PARTICIPANT"])).toBe(
      "/participant/exams?q=1",
    );
  });
  it("isolates preferences by user and revalidates roles", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key),
    });
    try {
      rememberWorkspace(user.id, "CREATOR");
      expect(resolveWorkspace(user)).toBe("/participant");
      const multi = {
        ...user,
        roles: ["CREATOR" as const, "PARTICIPANT" as const],
      };
      expect(resolveWorkspace(multi)).toBe("/creator");
      expect(resolveWorkspace({ ...multi, id: "another-user" })).toBe(
        "/workspaces",
      );
      expect(resolveWorkspace({ ...user, roles: ["ADMIN"] })).toBe("/admin");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
