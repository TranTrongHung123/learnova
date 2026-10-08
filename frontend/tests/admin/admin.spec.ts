import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8093/api/v1";

const password = randomUUID();

async function account(request: APIRequestContext, role = "PARTICIPANT") {
  const email = `${randomUUID()}@example.com`;
  const csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const response = await request.post(`${api}/auth/register`, {
    headers: { [csrf.headerName]: csrf.token },
    data: { email, password, displayName: `Người dùng ${email}`, roles: [role] },
  });
  expect(response.status()).toBe(201);
  return { ...(await response.json()), email } as { id: string; email: string };
}

async function login(
  page: Page,
  email = process.env.LEARNOVA_TEST_ADMIN_EMAIL!,
  secret = process.env.LEARNOVA_TEST_ADMIN_PASSWORD!,
  workspace = "admin",
) {
  await page.goto("/login");
  await page.getByLabel("Email (bắt buộc)", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu (bắt buộc)", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${workspace}$`));
}

test("admin searches, changes roles, locks and unlocks through real APIs with audited history", async ({
  page,
  request,
}) => {
  const target = await account(request);
  await login(page);
  await page.getByRole("link", { name: "Người dùng", exact: true }).click();
  await page.getByLabel("Tìm email hoặc tên").fill(target.email);
  await page.getByRole("button", { name: "Tìm kiếm / Lọc" }).click();
  await expect(page).toHaveURL(/search=/);
  await page
    .getByRole("link", { name: "Xem chi tiết", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/users/${target.id}$`));
  const detail = page.getByRole("region", { name: "Chi tiết người dùng" });
  await detail.getByRole("checkbox", { name: "CREATOR", exact: true }).check();
  await detail.getByRole("button", { name: "Lưu vai trò", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xác nhận lưu vai trò" }).click();
  await expect(detail.getByRole("status")).toBeVisible();
  await expect(detail.getByRole("checkbox", { name: "CREATOR", exact: true })).toBeChecked();
  await detail.getByRole("button", { name: "Khóa tài khoản", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Các phiên refresh hiện tại sẽ bị thu hồi/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Khóa tài khoản", exact: true })).toBeFocused();
  await detail.getByRole("button", { name: "Khóa tài khoản", exact: true }).click();
  await dialog.getByRole("button", { name: "Xác nhận khóa", exact: true }).click();
  await expect(detail.getByText("Đã khóa", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Mở khóa tài khoản", exact: true }).click();
  await dialog.getByRole("button", { name: "Xác nhận mở khóa", exact: true }).click();
  await expect(detail.getByText("Đang hoạt động", { exact: true })).toBeVisible();
  await detail.getByRole("link", { name: "Nhật ký thay đổi tài khoản" }).click();
  const log = page.getByRole("region", { name: "Nhật ký hoạt động" });
  await expect(
    log.getByText("ACCOUNT_LOCKED", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await log.getByLabel("Hành động", { exact: true }).selectOption("ROLE_CHANGED");
  await log.getByRole("button", { name: "Lọc nhật ký" }).click();
  await expect(page).toHaveURL(/action=ROLE_CHANGED/);
  await expect(log.locator("summary").filter({ visible: true })).toHaveCount(1);
  await expect(
    log.getByText("ROLE_CHANGED", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await log.locator("summary").filter({ visible: true }).click();
  await expect(
    log.getByText("Vai trò sau", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.reload();
  await expect(log.getByLabel("Hành động", { exact: true })).toHaveValue("ROLE_CHANGED");
  await log.getByLabel("Từ thời điểm").fill("2026-10-08T12:00");
  await log.getByLabel("Đến trước thời điểm").fill("2026-10-07T12:00");
  await log.getByRole("button", { name: "Lọc nhật ký" }).click();
  await expect(log.getByRole("alert")).toHaveText("Thời điểm đến phải sau thời điểm từ.");
  await expect(log.getByLabel("Đến trước thời điểm")).toBeFocused();
});

test("responsive lists, pagination, empty and offline recovery, keyboard and reduced motion", async ({
  page,
  request,
}) => {
  const target = await account(request);
  await login(page);
  await page.goto("/admin/users?size=1");
  const list = page.getByRole("region", { name: "Danh sách người dùng" });
  await list.getByRole("button", { name: "Trang sau" }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(list.getByRole("button", { name: "Trang trước" })).toBeEnabled();
  await page.goto(`/admin/users?search=${encodeURIComponent(target.email)}`);
  for (const path of [
    `/admin/users?search=${encodeURIComponent(target.email)}`,
    `/admin/users/${target.id}`,
    "/admin/audit-logs?action=ADMIN_BOOTSTRAPPED",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Làm mới", exact: true })).toBeVisible();
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      if (width === 375 || width === 1440)
        await page.screenshot({
          path: `test-results/admin/${path.includes("audit") ? "audit" : path.includes("?search") ? "users" : "detail"}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 450 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ADMIN_BOOTSTRAPPED", exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/users?search=absent-${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "Không có người dùng phù hợp" })).toBeVisible();
  await page.goto(`/admin/audit-logs?targetId=${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "Không có nhật ký phù hợp" })).toBeVisible();
});

for (const role of ["PARTICIPANT", "CREATOR"])
  test(`${role} cannot enter admin screens`, async ({ page, request }) => {
    const user = await account(request, role);
    await login(page, user.email, password, role.toLowerCase());
    for (const path of ["/admin/users", `/admin/users/${user.id}`, "/admin/audit-logs"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "Bạn không có quyền truy cập", exact: true }),
      ).toBeVisible();
    }
  });
