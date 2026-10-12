import { expect, test, type Page } from "@playwright/test";
import { navigationFor, type Workspace } from "../../src/features/workspace/navigation";

async function authenticated(page: Page, roles = ["CREATOR", "PARTICIPANT"]) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    if (path.endsWith("/auth/csrf")) json = { headerName: "X-CSRF-TOKEN", token: "test-csrf" };
    else if (path.endsWith("/auth/refresh")) json = {
      accessToken: "test-access", tokenType: "Bearer", expiresIn: 900,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      user: { id: "navigation-user", email: "navigation@example.com", displayName: "Navigation",
        avatarUrl: null, status: "ACTIVE", roles },
    };
    else if (path.endsWith("/notifications/unread-count")) json = { unreadCount: 3 };
    else if (path.endsWith("/dashboard")) {
      await route.fulfill({ status: 503, json: { message: "Test unavailable dashboard" } });
      return;
    }
    await route.fulfill({ json });
  });
}

test("navigation preserves the shell through loading, workspace changes and history", async ({ page }, testInfo) => {
  await authenticated(page);
  await page.goto("/creator/classes");
  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("workspace-desktop.png"), fullPage: true });
  const originalSidebar = await sidebar.elementHandle();
  const originalHeader = await page.locator("header").elementHandle();
  await page.route("**/api/v1/questions?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ json: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });
  await sidebar.getByRole("link", { name: "Ngân hàng câu hỏi" }).click();
  await expect(page.getByRole("heading", { name: "Ngân hàng câu hỏi", exact: true })).toBeVisible();
  expect(await originalSidebar!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await originalHeader!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator("main")).toHaveCount(1);
  await sidebar.getByRole("link", { name: /Learnova/ }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await page.getByLabel("Không gian làm việc", { exact: true }).selectOption("PARTICIPANT");
  await expect(page).toHaveURL(/\/participant$/);
  await expect(sidebar.getByRole("link", { name: /Learnova/ })).toHaveAttribute("href", "/participant");
  expect(await originalSidebar!.evaluate((element) => element.isConnected)).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/creator$/);
  await expect(sidebar.getByRole("link", { name: /Learnova/ })).toHaveAttribute("href", "/creator");
});

test("mobile logo returns to the active workspace and closes navigation", async ({ page }, testInfo) => {
  await authenticated(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/creator/classes");
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await page.screenshot({ path: testInfo.outputPath("workspace-mobile-drawer.png"), fullPage: true });
  await page.getByRole("dialog", { name: "Điều hướng" }).getByRole("link", { name: /Learnova/ }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await expect(page.getByRole("dialog", { name: "Điều hướng" })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("admin logo stays in admin and exam taking keeps its focused layout", async ({ page }) => {
  await authenticated(page, ["ADMIN", "PARTICIPANT"]);
  await page.goto("/admin/users");
  await page.locator("aside").getByRole("link", { name: /Learnova/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.route("**/api/v1/attempts/**", (route) => route.fulfill({
    status: 404, json: { message: "Test missing attempt" },
  }));
  await page.goto("/participant/attempts/test-attempt");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.locator("header")).toHaveCount(0);
});

test("persistent layout still blocks a workspace without the required role", async ({ page }) => {
  await authenticated(page, ["PARTICIPANT"]);
  await page.goto("/creator/classes");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập" })).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
});

test("questions to exams has one stable content loading state, then shows fresh data", async ({ page }) => {
  await authenticated(page);
  await page.goto("/creator/questions");
  await expect(page.getByText("Chưa có câu hỏi phù hợp", { exact: true })).toBeVisible();
  let release!: () => void;
  const response = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/v1/exams?**", async (route) => {
    await response;
    await route.fulfill({ json: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });
  await page.clock.install({ time: new Date("2026-10-09T10:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-09T10:00:01Z"));
  await page.locator("aside").getByRole("link", { name: "Đề thi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đề thi", exact: true })).toBeVisible();
  const loading = page.locator('main [role="status"][aria-busy="true"]');
  await expect(loading).toHaveCount(1);
  await expect(loading.locator('[aria-hidden="true"]')).not.toBeVisible();
  await page.clock.runFor(180);
  await expect(loading.locator('[aria-hidden="true"]')).toBeVisible();
  await expect(page.getByLabel("Tìm tên đề")).toBeVisible();
  release();
  await expect(page.getByText("Chưa có đề thi phù hợp", { exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
});

test("dashboard keeps confirmed content while refreshing and removes it on failure", async ({ page }) => {
  await authenticated(page);
  let refreshing = false;
  let release!: () => void;
  const response = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/v1/creator/dashboard", async (route) => {
    if (refreshing) {
      await response;
      await route.fulfill({ status: 503, json: { message: "Unavailable" } });
    } else await route.fulfill({ json: {
      serverTime: new Date().toISOString(),
      counts: { questions: 7, exams: 2, activeSessions: 0, upcomingSessions: 0, participants: 0 },
      questionCounts: { draft: 7, active: 0, archived: 0 },
      activeSessions: [], upcomingSessions: [], recentExams: [], recentResults: [],
    } });
  });
  await page.goto("/creator");
  await expect(page.getByRole("link", { name: "Xem chi tiết Tổng câu hỏi", exact: true })).toBeVisible();
  refreshing = true;
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang cập nhật…" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Xem chi tiết Tổng câu hỏi", exact: true })).toBeVisible();
  await expect(page.locator('main [role="status"][aria-busy="true"]')).toHaveCount(0);
  release();
  await expect(page.getByRole("link", { name: "Xem chi tiết Tổng câu hỏi", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
});

for (const role of ["CREATOR", "PARTICIPANT", "ADMIN"] as Workspace[]) {
  for (const width of [375, 1440]) {
    test(`${role} navigation remains usable on API failures at ${width}px`, async ({ page }) => {
      await authenticated(page, [role]);
      await page.route("**/api/v1/**", async (route) => {
        if (/\/auth\/(csrf|refresh)$/.test(new URL(route.request().url()).pathname)) {
          await route.fallback();
        } else await route.fulfill({ status: 503, json: { message: "Test network failure" } });
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${role.toLowerCase()}`);
      for (const item of navigationFor(role)) {
        if (!item.href) continue;
        if (width < 1024) await page.getByRole("button", { name: "Mở điều hướng" }).click();
        const nav = width < 1024 ? page.getByRole("dialog", { name: "Điều hướng" }) : page.locator("aside");
        await nav.getByRole("link", { name: item.label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${item.href}$`));
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("main")).toHaveCount(1);
        await expect(page.locator("main").getByRole("button", { name: /Thử/ }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      expect(errors).toEqual([]);
    });
  }
}
