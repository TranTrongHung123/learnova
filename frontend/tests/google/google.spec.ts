import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Local password for test 123";
async function google(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Tiếp tục với Google", exact: true }).click();
  await page.getByLabel("Email Google").fill(email);
  await page.getByRole("button", { name: "Tiếp tục test", exact: true }).click();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: /Menu người dùng/ }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
}
async function localUser(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Tên hiển thị", { exact: false }).fill("Local User");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
}

test("new Google user resumes onboarding, selects both roles, reloads and signs in again", async ({ page, context }) => {
  const email = `${randomUUID()}@example.com`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await google(page, email);
  await expect(page).toHaveURL(/\/onboarding\/roles$/);
  const cookies = await context.cookies("http://localhost:8082/api/v1/auth/google/flow");
  expect(cookies.find((value) => value.name === "learnova_google_flow")?.httpOnly).toBe(true);
  expect(cookies.find((value) => value.name === "learnova_refresh")).toBeUndefined();
  await page.reload();
  await page.getByRole("radio", { name: "Cả hai", exact: true }).check();
  await page.getByRole("button", { name: "Hoàn tất và tiếp tục", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole("button", { name: "Vào không gian người tạo" }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tổng quan người tạo", exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("Bạn đăng nhập bằng Google.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đổi mật khẩu", exact: true })).toHaveCount(0);
  await page.locator("#profile-displayName").fill("Google Profile");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await logout(page);
  await google(page, email);
  await expect(page).toHaveURL(/\/creator$/);
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /token/i.test(key)))).toEqual([]);
  expect(errors).toEqual([]);
});

test("local collision requires password and explicit confirmation; both logins keep the same account", async ({ page }) => {
  const email = `${randomUUID()}@example.com`;
  await localUser(page, email);
  await google(page, email);
  await expect(page).toHaveURL(/\/auth\/link-account$/);
  await page.getByLabel("Mật khẩu tài khoản Local", { exact: false }).fill("wrong");
  await page.getByRole("button", { name: "Xác minh tài khoản", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email hoặc mật khẩu chưa đúng");
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  await page.getByLabel("Mật khẩu tài khoản Local", { exact: false }).fill(password);
  await page.getByRole("button", { name: "Xác minh tài khoản", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Xác nhận liên kết Google", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/google/link-confirmation.png" });
  await page.reload();
  await page.getByRole("button", { name: "Xác nhận liên kết Google", exact: true }).click();
  await expect(page).toHaveURL(/\/participant$/);
  await expect(page.getByText("Local User", { exact: true })).toBeVisible();
  await logout(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/participant$/);
});

test("cancel, expired flow and provider denial have a route back to login", async ({ page }) => {
  await google(page, `${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Hủy và về đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/onboarding/roles");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("link", { name: "Về đăng nhập", exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục với Google", exact: true }).click();
  await page.getByRole("button", { name: "Hủy Google", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("bị hủy");
});

test("onboarding handles network failure, keyboard and mobile layout", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await google(page, `${randomUUID()}@example.com`);
  await expect(page.getByRole("heading", { name: /Bạn muốn dùng Learnova/ })).toBeFocused();
  await page.getByRole("radio", { name: "Làm bài kiểm tra", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Tạo và tổ chức bài kiểm tra", exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/google/onboarding-375.png" });
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 640, height: 450 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Hoàn tất và tiếp tục", exact: true })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/google/onboarding-640.png" });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Hoàn tất và tiếp tục", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("kết nối");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Hoàn tất và tiếp tục", exact: true }).click();
  await expect(page).toHaveURL(/\/creator$/);
});

test("two tabs finishing the same onboarding recover the authoritative session", async ({ page, context }) => {
  await google(page, `${randomUUID()}@example.com`);
  await expect(page).toHaveURL(/\/onboarding\/roles$/);
  const second = await context.newPage();
  await second.goto("/onboarding/roles");
  await expect(second.getByRole("radio", { name: "Làm bài kiểm tra", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hoàn tất và tiếp tục", exact: true }).click();
  await expect(page).toHaveURL(/\/participant$/);
  await second.getByRole("button", { name: "Hoàn tất và tiếp tục", exact: true }).click();
  await expect(second.getByRole("main").getByRole("alert")).toBeVisible();
  await second.getByRole("button", { name: "Tải lại trạng thái", exact: true }).click();
  await expect(second).toHaveURL(/\/participant$/);
});
