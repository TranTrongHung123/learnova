import { expect, test, type Page } from "@playwright/test";

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
