import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const api = "http://localhost:8081/api/v1";

const password = "Question test password 123";

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  // Không thu request/header/body, trace hay giá trị input chứa credential.
  const state = page.isClosed()
    ? { closed: true }
    : {
        path: new URL(page.url()).pathname,
        headings: await page.getByRole("heading").allTextContents(),
        forms: await page.locator("form").count(),
        textareas: await page.locator("textarea").count(),
      };
  const path = testInfo.outputPath("question-page-diagnostics.json");
  await writeFile(path, JSON.stringify({ ...state, errors: pageErrors.get(page) ?? [] }, null, 2));
  await testInfo.attach("question-page-diagnostics", { path, contentType: "application/json" });
});

async function account(request: APIRequestContext, roles = ["CREATOR"]) {
  const email = `${randomUUID()}@example.com`;
  const csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect(
    (
      await request.post(`${api}/auth/register`, {
        headers,
        data: { email, password, displayName: "Người soạn câu hỏi", roles },
      })
    ).status(),
  ).toBe(201);
  const login = await (
    await request.post(`${api}/auth/login`, { headers, data: { email, password } })
  ).json();
  return { email, headers: { Authorization: `Bearer ${login.accessToken}` } };
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await expect(page.getByRole("link", { name: "Ngân hàng câu hỏi", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ngân hàng câu hỏi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ngân hàng câu hỏi", exact: true })).toBeVisible();
}

async function create(page: Page, type: string, content: string) {
  await page.goto("/creator/questions/new");
  await page.getByLabel("Loại câu hỏi", { exact: true }).selectOption(type);
  await page.getByLabel("Nội dung câu hỏi", { exact: true }).fill(content);
  if (type.includes("CHOICE")) {
    await page.getByLabel("Lựa chọn 1", { exact: true }).fill("A");
    await page.getByLabel("Lựa chọn 2", { exact: true }).fill("B");
    await page.getByLabel("Đáp án đúng 1", { exact: true }).check();
    if (type === "MULTIPLE_CHOICE") await page.getByLabel("Đáp án đúng 2", { exact: true }).check();
  } else if (type === "TRUE_FALSE")
    await page.getByLabel("Đáp án đúng", { exact: true }).selectOption("false");
  else {
    await page.getByLabel("Đáp án số", { exact: true }).fill("12345678901234567890.1234567891");
    await page.getByLabel("Sai số tuyệt đối", { exact: true }).fill("");
  }
  await page.getByLabel("Danh mục", { exact: true }).fill("Toán");
  await page.getByLabel("Nhãn / chủ đề", { exact: true }).fill("đại số, ôn tập");
  await page.getByRole("button", { name: "Lưu và kích hoạt" }).click();
  await expect(page).toHaveURL(/\/creator\/questions\/[a-f0-9-]+\?saved=1/);
  await expect(page.getByRole("heading", { name: content, exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

test("four types round trip, edit, filter and preserve exact decimal", async ({
  page,
  request,
}) => {
  const owner = await account(request);
  await login(page, owner.email);
  for (const type of ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "NUMERIC_ANSWER"]) {
    await create(page, type, `Câu ${type}`);
    await page.reload();
    await expect(page.getByRole("heading", { name: `Câu ${type}`, exact: true })).toBeVisible();
    if (type === "NUMERIC_ANSWER") {
      await expect(
        page.getByText("12345678901234567890.1234567891", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Sai số tuyệt đối: 0", { exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
    await page.getByLabel("Giải thích đáp án").fill("Giải thích đã chỉnh sửa");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByText("Giải thích đã chỉnh sửa", { exact: true })).toBeVisible();
  }
  await page.goto("/creator/questions");
  await page.getByLabel("Loại câu hỏi").selectOption("NUMERIC_ANSWER");
  await page.getByLabel("Danh mục", { exact: true }).fill("Toán");
  await page.getByRole("button", { name: "Tìm kiếm / Lọc" }).click();
  await expect(page.getByText(/1 câu hỏi · Trang/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Loại câu hỏi")).toHaveValue("NUMERIC_ANSWER");
});

test("incomplete draft restores to draft, completed question restores active", async ({
  page,
  request,
}) => {
  const owner = await account(request);
  await login(page, owner.email);
  await page.goto("/creator/questions/new");
  await page.getByRole("button", { name: "Lưu nháp" }).click();
  await expect(page.getByRole("heading", { name: "Câu hỏi chưa có nội dung" })).toBeVisible();
  for (const expected of ["Bản nháp", "Đang sử dụng"]) {
    await page.getByRole("button", { name: "Lưu trữ", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Lưu trữ", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Xác nhận lưu trữ" }).click();
    await expect(page.getByRole("button", { name: "Khôi phục", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Chỉnh sửa", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Khôi phục", exact: true }).click();
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
    if (expected === "Bản nháp") {
      await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
      await page.getByLabel("Nội dung câu hỏi").fill("Câu hoàn chỉnh");
      await page.getByLabel("Lựa chọn 1", { exact: true }).fill("A");
      await page.getByLabel("Lựa chọn 2", { exact: true }).fill("B");
      await page.getByLabel("Đáp án đúng 1", { exact: true }).check();
      await page.getByRole("button", { name: "Lưu và kích hoạt" }).click();
      await expect(
        page.getByRole("heading", { name: "Câu hoàn chỉnh", exact: true }),
      ).toBeVisible();
    }
  }
  await page.goto("/creator/questions");
  await expect(page.getByText(/1 câu hỏi · Trang/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Lưu trữ", exact: true }).click();
  await expect(page.getByText(/0 câu hỏi · Trang/)).toBeVisible();
  await page.getByLabel("Trạng thái").selectOption("ARCHIVED");
  await page.getByRole("button", { name: "Tìm kiếm / Lọc" }).click();
  await page.getByRole("button", { name: "Khôi phục", exact: true }).click();
  await expect(page.getByText("Đã cập nhật: Đang sử dụng.", { exact: true })).toBeVisible();
});

test("validation focus, network failure and stale two-tab edits retain input", async ({
  page,
  context,
  request,
}) => {
  const owner = await account(request);
  await login(page, owner.email);
  await page.goto("/creator/questions/new");
  await page.getByRole("button", { name: "Lưu và kích hoạt" }).click();
  await expect(page.locator('form [role="alert"]')).toBeFocused();
  const path = await create(page, "TRUE_FALSE", "Câu gốc");
  await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
  await expect(page.getByLabel("Nội dung câu hỏi")).toHaveValue("Câu gốc");
  const other = await context.newPage();
  await other.goto(`${path}/edit`);
  await expect(other.getByLabel("Nội dung câu hỏi")).toHaveValue("Câu gốc");
  await other.getByLabel("Nội dung câu hỏi").fill("Đã sửa từ tab hai");
  await other.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(
    other.getByRole("heading", { name: "Đã sửa từ tab hai", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nội dung câu hỏi").fill("Nội dung chưa lưu");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.locator('form [role="alert"]')).toContainText("Câu hỏi đã thay đổi");
  await expect(page.getByLabel("Nội dung câu hỏi")).toHaveValue("Nội dung chưa lưu");
  await other.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
  await other.getByLabel("Nội dung câu hỏi").fill("Nội dung khi mất mạng");
  await context.setOffline(true);
  await other.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(other.locator('form [role="alert"]')).toBeVisible();
  await expect(other.getByLabel("Nội dung câu hỏi")).toHaveValue("Nội dung khi mất mạng");
  await context.setOffline(false);
  await other.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(
    other.getByRole("heading", { name: "Nội dung khi mất mạng", exact: true }),
  ).toBeVisible();
});

test("owner isolation, responsive layout and reduced motion", async ({
  page,
  request,
}, testInfo) => {
  const owner = await account(request);
  const other = await account(request);
  await login(page, owner.email);
  const path = await create(page, "MULTIPLE_CHOICE", "Câu kiểm tra responsive");
  expect(
    (
      await request.get(`${api}/questions/${path.split("/").at(-1)}`, { headers: other.headers })
    ).status(),
  ).toBe(404);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 900 });
    await page.goto(`${path}/edit`);
    await expect(page.getByLabel("Nội dung câu hỏi")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    if (width === 375 || width === 1440)
      await page.screenshot({ path: testInfo.outputPath(`form-${width}.png`), fullPage: true });
    await page.goto("/creator/questions");
    await expect(page.getByText(/1 câu hỏi · Trang/)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    if (width === 375 || width === 1440)
      await page.screenshot({ path: testInfo.outputPath(`list-${width}.png`), fullPage: true });
  }
});
