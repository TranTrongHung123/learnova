import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Mật khẩu kiểm thử 😀";
async function register(page: Page, multi = false) {
  const email = `${randomUUID()}@example.com`;
  await page.goto("/register");
  await page
    .getByLabel("Tên hiển thị", { exact: false })
    .fill("Người dùng kiểm thử");
  await page.getByLabel("Email", { exact: false }).fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  if (multi)
    await page.getByRole("radio", { name: "Cả hai", exact: true }).check();
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
  await expect(page.getByRole("status")).toContainText("Đăng ký thành công");
  return email;
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/(participant|workspaces|creator)$/);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: /Menu người dùng/ }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("#email")).toBeVisible();
}

test("register, multi-role, preference, real cookie, reload and logout", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = await register(page, true);
  await login(page, email);
  await expect(
    page.getByRole("heading", {
      name: "Chọn không gian làm việc",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vào không gian người tạo" }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await page
    .getByLabel("Không gian làm việc", { exact: true })
    .selectOption("PARTICIPANT");
  await expect(page).toHaveURL(/\/participant$/);
  const cookies = await context.cookies(
    "http://localhost:8081/api/v1/auth/refresh",
  );
  const cookie = cookies.find((cookie) => cookie.name === "learnova_refresh");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.path).toBe("/api/v1/auth");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Không gian người tham gia",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    expect.stringMatching(/^learnova\.workspace\./),
  ]);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền truy cập" }),
  ).toBeVisible();
  await page.goto("/participant");
  await logout(page);
  await login(page, email);
  await expect(page).toHaveURL(/\/participant$/);
  expect(errors).toEqual([]);
});

test("two tabs reload concurrently without refresh reuse and logout synchronizes", async ({
  page,
  context,
}) => {
  const email = await register(page);
  await login(page, email);
  const other = await context.newPage();
  await other.goto("/participant");
  await expect(
    other.getByRole("heading", {
      name: "Không gian người tham gia",
      exact: true,
    }),
  ).toBeVisible();
  await Promise.all([page.reload(), other.reload()]);
  for (const tab of [page, other])
    await expect(
      tab.getByRole("heading", {
        name: "Không gian người tham gia",
        exact: true,
      }),
    ).toBeVisible();
  await logout(page);
  await expect(other).toHaveURL(/\/login/);
});

test("logout-all revokes another device and confirmation restores focus on Escape", async ({
  page,
  browser,
}) => {
  const email = await register(page);
  await login(page, email);
  const other = await browser.newContext();
  try {
    const device = await other.newPage();
    await device.goto("http://localhost:3104/login");
    await device.locator("#email").fill(email);
    await device.locator("#password").fill(password);
    await device
      .getByRole("button", { name: "Đăng nhập", exact: true })
      .click();
    await expect(device).toHaveURL(/\/participant$/);
    await page.getByRole("button", { name: /Menu người dùng/ }).click();
    await page
      .getByRole("button", { name: "Đăng xuất tất cả thiết bị" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Menu người dùng/ }),
    ).toBeFocused();
    await page.getByRole("button", { name: /Menu người dùng/ }).click();
    await page
      .getByRole("button", { name: "Đăng xuất tất cả thiết bị" })
      .click();
    await page
      .getByRole("button", { name: "Đăng xuất tất cả", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await device.reload();
    await expect(device).toHaveURL(/\/login/);
  } finally {
    await other.close();
  }
});

test("single role cannot enter creator, validation and network failure stay actionable", async ({
  page,
  context,
}) => {
  await page.goto("/register");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Vui lòng kiểm tra các trường" }),
  ).toBeFocused();
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  const email = await register(page);
  await login(page, email);
  await expect(
    page.getByLabel("Không gian làm việc", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/creator");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền truy cập" }),
  ).toBeVisible();
  await page.goto("/participant");
  await expect(
    page.getByRole("heading", {
      name: "Không gian người tham gia",
      exact: true,
    }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: /Menu người dùng/ }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByText(/chưa xác nhận thu hồi phiên phía máy chủ/),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Thử đăng xuất lại" }).click();
  await expect(page).toHaveURL(/\/login/);
});

for (const width of [375, 768, 1024, 1440, 640]) {
  test(`auth forms responsive ${width}px, keyboard and reduced motion`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/register");
    await expect(page.locator("#email")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#password").fill("Mật khẩu có dấu 😀");
    await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await expect(page.locator("#password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    await page.locator("#password").fill("");
    await page.screenshot({
      path: info.outputPath(`register-${width}.png`),
      fullPage: true,
    });
  });
}
