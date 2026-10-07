import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Profile password test 123";
const newPassword = "Changed password test 456";

async function login(page: Page, email: string, value = password) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(value);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/participant$/);
}

async function account(page: Page) {
  const email = `${randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Tên hiển thị", { exact: false }).fill("Profile Test");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
  await login(page, email);
  return email;
}

test("profile persists, validates, recovers from network failure and fits all viewports", async ({ page }) => {
  await account(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ", exact: true })).toBeVisible();
  await page.locator("#profile-displayName").fill("Tên mới 😀");
  await page.locator("#profile-avatarUrl").fill("http://example.com/avatar.png");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  await page.route("https://example.com/avatar.png", (route) => route.abort());
  await page.locator("#profile-avatarUrl").fill("https://example.com/avatar.png");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await expect(page.getByRole("button", { name: /Menu người dùng/ })).toContainText("Tên mới 😀");
  await page.reload();
  await expect(page.locator("#profile-displayName")).toHaveValue("Tên mới 😀");
  await expect(page.locator("#profile-avatarUrl")).toHaveValue("https://example.com/avatar.png");
  await expect(page.locator('img[src="https://example.com/avatar.png"]')).toHaveCount(0);
  await page.locator("#profile-avatarUrl").fill("");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");

  await page.route("**/api/v1/auth/profile", (route) => route.abort());
  await page.locator("#profile-displayName").fill("Chưa lưu");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Đã lưu hồ sơ.", { exact: true })).toHaveCount(0);
  await expect(page.locator("#profile-displayName")).toHaveValue("Chưa lưu");
  await page.unroute("**/api/v1/auth/profile");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [[375, 812], [768, 1024], [1024, 768], [1440, 900], [640, 450]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/auth/profile-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Đăng xuất tất cả thiết bị", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng xuất tất cả thiết bị", exact: true })).toBeFocused();
});

test("password change keeps current session, revokes other devices and logout-all clears current session", async ({ page, browser }) => {
  const email = await account(page);
  const other = await browser.newContext();
  try {
    const device = await other.newPage();
    await login(device, email);
    await page.goto("/profile");
    await page.locator("#password-currentPassword").fill("wrong password");
    await page.locator("#password-newPassword").fill(newPassword);
    await page.locator("#password-confirm").fill(newPassword);
    await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Mật khẩu hiện tại chưa đúng");
    await device.reload();
    await expect(device.getByRole("heading", { name: "Tổng quan người tham gia", exact: true })).toBeVisible();
    await page.locator("#password-currentPassword").fill(password);
    await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Đã đổi mật khẩu");
    await expect(page.locator("#password-currentPassword")).toHaveValue("");
    await page.reload();
    await expect(page.locator("#profile-displayName")).toHaveValue("Profile Test");
    await device.reload();
    await expect(device).toHaveURL(/\/login/);
    await login(device, email, newPassword);
    await page.getByRole("button", { name: "Đăng xuất tất cả thiết bị", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Đăng xuất tất cả", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await device.reload();
    await expect(device).toHaveURL(/\/login/);
  } finally {
    await other.close();
  }
});
