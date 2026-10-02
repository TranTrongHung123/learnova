import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { workbook } from "./workbook";

const api = "http://localhost:8081/api/v1";
const password = "Import test password 123";
const valid = { type: "TRUE_FALSE", content: "Câu import hợp lệ", correctBoolean: "TRUE" };
async function account(request: APIRequestContext, roles = ["CREATOR"]) {
  const email = `${randomUUID()}@example.com`;
  const csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect((await request.post(`${api}/auth/register`, { headers, data: { email, password, displayName: "Creator import", roles } })).status()).toBe(201);
  const login = await (await request.post(`${api}/auth/login`, { headers, data: { email, password } })).json();
  return { email, headers: { Authorization: `Bearer ${login.accessToken}` } };
}
async function login(page: Page, email: string) {
  await page.goto("/login"); await page.locator("#email").fill(email); await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await expect(page).toHaveURL(/\/creator$/);
  await page.goto("/creator/questions"); await page.getByRole("link", { name: "Import Excel", exact: true }).click();
}
async function upload(page: Page, rows: Record<string, string>[]) {
  await page.getByLabel("File câu hỏi (.xlsx)").setInputFiles({ name: "questions.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbook(rows) });
  await page.getByRole("button", { name: "Upload và xem trước" }).click();
  await expect(page).toHaveURL(/importId=/); await expect(page.getByRole("heading", { name: "2. Kiểm tra trước khi import" })).toBeVisible();
}
test("template, four types, reload preview, confirm and Draft list", async ({ page, request }) => {
  const owner = await account(request); await login(page, owner.email);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Tải template .xlsx" }).click();
  expect((await download).suggestedFilename()).toBe("learnova-questions.xlsx");
  await upload(page, [valid,
    { type: "SINGLE_CHOICE", content: "Một đáp án", option1: "A", option2: "B", correctOptions: "1" },
    { type: "MULTIPLE_CHOICE", content: "Nhiều đáp án", option1: "A", option2: "B", correctOptions: "1;2" },
    { type: "NUMERIC_ANSWER", content: "Số chính xác", correctValue: "12345678901234567890.1234567891" }]);
  expect((await (await request.get(`${api}/questions`, { headers: owner.headers })).json()).totalElements).toBe(0);
  await page.reload(); await expect(page.getByText("Tổng: 4 · Hợp lệ: 4 · Lỗi: 0")).toBeVisible();
  await page.getByText("Xem nội dung và đáp án dòng 5", { exact: true }).click();
  await expect(page.getByText("12345678901234567890.1234567891", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận import 4 câu hỏi" }).click(); await expect(page.getByRole("heading", { name: "Import thành công" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "Import thành công" })).toBeVisible();
  await page.getByRole("link", { name: "Xem câu hỏi nháp" }).click(); await expect(page.getByText(/4 câu hỏi · Trang/)).toBeVisible();
});
test("invalid rows require explicit opt-in, responsive and keyboard", async ({ page, request }) => {
  const owner = await account(request); await login(page, owner.email);
  await upload(page, [valid, { type: "TRUE_FALSE", content: "Thiếu đáp án" }]);
  await expect(page.getByRole("button", { name: "Xác nhận import 1 câu hỏi" })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "test-results/import/preview-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/import/preview-desktop.png", fullPage: true });
  await page.getByLabel("Hiển thị dòng").selectOption("INVALID"); await expect(page.getByText("Dòng 3", { exact: true })).toBeVisible(); await expect(page.getByText("Dòng 2", { exact: true })).toHaveCount(0);
  const checkbox = page.getByRole("checkbox"); await checkbox.focus(); await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked(); await page.getByRole("button", { name: "Xác nhận import 1 câu hỏi" }).click();
  await expect(page.getByText(/Đã tạo 1 câu hỏi DRAFT; bỏ qua 1 dòng lỗi/)).toBeVisible();
});
test("malformed file, network retry and lost confirm response recover", async ({ page, request, context }) => {
  const owner = await account(request); await login(page, owner.email);
  await page.getByLabel("File câu hỏi (.xlsx)").setInputFiles({ name: "fake.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("fake") });
  await page.getByRole("button", { name: "Upload và xem trước" }).click(); await expect(page.locator("form").getByRole("alert")).toBeFocused(); await expect(page.locator("form").getByRole("alert")).toContainText("không phải .xlsx hợp lệ");
  await page.getByLabel("File câu hỏi (.xlsx)").setInputFiles({ name: "q.xlsx", mimeType: "application/octet-stream", buffer: workbook([valid]) });
  await context.setOffline(true); await page.getByRole("button", { name: "Upload và xem trước" }).click(); await expect(page.locator("form").getByRole("alert")).toContainText("kết nối");
  await context.setOffline(false); await page.getByRole("button", { name: "Upload và xem trước" }).click(); await expect(page).toHaveURL(/importId=/);
  await page.route("**/question-imports/*/confirm", async route => { await route.fetch(); await route.abort("failed"); });
  await page.getByRole("button", { name: "Xác nhận import 1 câu hỏi" }).click(); await expect(page.getByRole("heading", { name: "Import thành công" })).toBeVisible();
  expect((await (await request.get(`${api}/questions`, { headers: owner.headers })).json()).totalElements).toBe(1);
});
test("other Creator cannot access preview or confirm", async ({ page, request }) => {
  const owner = await account(request), other = await account(request);
  await login(page, owner.email); await upload(page, [valid]);
  const id = new URL(page.url()).searchParams.get("importId");
  expect((await request.get(`${api}/question-imports/${id}`, { headers: other.headers })).status()).toBe(404);
  expect((await request.post(`${api}/question-imports/${id}/confirm`, { headers: other.headers, data: {} })).status()).toBe(404);
});
