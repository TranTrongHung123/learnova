import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { VersionDetail } from "../../src/features/exam/types";

const api = "http://localhost:8081/api/v1", password = "Exam test password 123";
async function account(request: APIRequestContext, roles = ["CREATOR"]) {
  const email = `${randomUUID()}@example.com`;
  const csrf = await (await request.get(`${api}/auth/csrf`)).json(), headers = { [csrf.headerName]: csrf.token };
  expect((await request.post(`${api}/auth/register`, { headers, data: { email, password, displayName: "Người soạn đề", roles } })).status()).toBe(201);
  const login = await (await request.post(`${api}/auth/login`, { headers, data: { email, password } })).json();
  return { email, headers: { Authorization: `Bearer ${login.accessToken}` } };
}
async function login(page: Page, email: string, destination = "/creator/exams") {
  await page.goto("/login"); await page.locator("#email").fill(email); await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/(creator|participant)$/); await page.goto(destination);
}
async function source(request: APIRequestContext, headers: Record<string, string>, content: string) {
  const response = await request.post(`${api}/questions`, { headers, data: { type: "TRUE_FALSE", status: "ACTIVE", content, correctBoolean: true } });
  expect(response.status()).toBe(201); return response.json();
}
async function seeded(request: APIRequestContext, headers: Record<string, string>) {
  const q = await source(request, headers, "Câu hỏi gốc");
  const exam = await (await request.post(`${api}/exams`, { headers, data: { name: "Đề kiểm tra" } })).json();
  const v: VersionDetail = await (await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, { headers, data: { revision: 0, questions: [{ questionId: q.id, revision: q.revision }] } })).json();
  return { exam, v, q, path: `/creator/exams/${exam.id}/versions/${v.id}/edit` };
}
test("build, exact points, immutable snapshots, version copy and archive on real API", async ({ page, request }) => {
  const owner = await account(request);
  const first = await source(request, owner.headers, "Câu hỏi đầu tiên"); await source(request, owner.headers, "Câu hỏi thứ hai");
  await login(page, owner.email); await page.getByRole("link", { name: "Tạo đề thi", exact: true }).click();
  await page.getByLabel("Tên đề thi", { exact: true }).fill("Đề giữa kỳ"); await page.getByLabel("Mô tả", { exact: true }).fill("Đề kiểm tra snapshot");
  await page.getByRole("button", { name: "Tạo đề và mở bản nháp" }).click(); await expect(page).toHaveURL(/\/versions\/[^/]+\/edit$/);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Thêm từ ngân hàng câu hỏi", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Thêm từ ngân hàng câu hỏi" });
  await expect(picker).toBeVisible(); await picker.getByRole("checkbox").nth(0).check(); await picker.getByRole("checkbox").nth(1).check();
  await picker.getByRole("button", { name: "Thêm đã chọn" }).click(); await expect(picker).not.toBeVisible();
  await page.getByLabel("Tổng điểm muốn chia đều").fill("1"); await page.getByRole("button", { name: "Chia đều điểm" }).click();
  await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("0.5");
  await page.getByRole("button", { name: "Đưa câu 1 xuống" }).focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click(); await expect(page.getByRole("status")).toHaveText("Đã lưu bản nháp.");
  await page.reload(); await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("0.5");
  expect((await request.put(`${api}/questions/${first.id}`, { headers: owner.headers, data: { type: "TRUE_FALSE", status: "ACTIVE", content: "Đã sửa ở ngân hàng", correctBoolean: false, revision: first.revision } })).status()).toBe(200);
  await page.reload(); await expect(page.getByText("Câu hỏi đầu tiên", { exact: true })).toBeVisible(); await expect(page.getByText("Đã sửa ở ngân hàng", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận xuất bản" }).click(); await expect(page).toHaveURL(/\/creator\/exams\/[^/]+$/);
  await page.getByRole("link", { name: "Xem phiên bản", exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/exams\/[^/]+\/versions\/[^/]+$/);
  await expect(page.getByText("Phiên bản 1 — Đã xuất bản", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveCount(0);
  await page.goto(`${page.url()}/edit`); await expect(page).not.toHaveURL(/\/edit$/);
  await page.getByRole("link", { name: "Quay lại lịch sử phiên bản" }).click();
  await page.getByRole("button", { name: "Tạo bản nháp từ phiên bản 1" }).click(); await expect(page.getByText("Phiên bản 2 — Bản nháp", { exact: true })).toBeVisible();
  await expect(page.getByText("Câu hỏi đầu tiên", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bỏ câu 2", exact: true }).click(); await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu bản nháp."); await page.getByRole("link", { name: "Quay lại lịch sử phiên bản" }).click();
  await page.getByRole("button", { name: "Lưu trữ đề", exact: true }).click(); await page.getByRole("button", { name: "Xác nhận lưu trữ" }).click();
  await expect(page.getByText("Đã lưu trữ", { exact: true })).toBeVisible(); await expect(page.getByRole("heading", { name: "Phiên bản 1 — Đã xuất bản" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("failed saves keep input; stale revisions require explicit reconciliation", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers);
  await login(page, owner.email, seed.path); await page.getByLabel("Điểm câu 1", { exact: true }).fill("2");
  await page.route(`**/exam-versions/${seed.v.id}/questions`, route => route.abort());
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible(); await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("2"); await expect(page.getByRole("status")).toHaveText("Có thay đổi chưa lưu");
  await page.unroute(`**/exam-versions/${seed.v.id}/questions`);
  expect((await request.put(`${api}/exam-versions/${seed.v.id}/questions`, { headers: owner.headers, data: { revision: seed.v.revision, questions: [{ id: seed.v.questions[0].id, points: "3" }] } })).status()).toBe(200);
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click(); await expect(page.getByRole("main").getByRole("alert")).toContainText("Dữ liệu đã thay đổi");
  await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Tải bản máy chủ để đối chiếu" }).click();
  const dialog = page.getByRole("dialog", { name: "Đối chiếu bản máy chủ" }); await expect(dialog).toContainText("3 điểm");
  await dialog.getByRole("button", { name: "Thay nội dung đang nhập bằng bản máy chủ" }).click(); await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("3");
  await page.getByRole("button", { name: "Thêm từ ngân hàng câu hỏi", exact: true }).click(); await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByRole("button", { name: "Thêm từ ngân hàng câu hỏi", exact: true })).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Xuất bản", exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/exam/builder-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByLabel("Điểm câu 1", { exact: true })).toBeVisible();
});
test("lost publish response recovers from server state without republishing", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers);
  await login(page, owner.email, seed.path);
  let publishes = 0;
  await page.route(`**/exam-versions/${seed.v.id}/publish`, async route => { publishes++; await route.fetch(); await route.abort(); });
  await page.getByRole("button", { name: "Xuất bản", exact: true }).click(); await page.getByRole("button", { name: "Xác nhận xuất bản" }).click();
  await expect(page).toHaveURL(`/creator/exams/${seed.exam.id}`); await expect(page.getByRole("heading", { name: "Phiên bản 1 — Đã xuất bản" })).toBeVisible(); expect(publishes).toBe(1);
});
test("foreign Creator sees not-found and Participant cannot access builder", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers), other = await account(request);
  await login(page, other.email, seed.path); await expect(page.getByRole("heading", { name: "Không tìm thấy trang", exact: true })).toBeVisible();
  const participant = await account(request, ["PARTICIPANT"]);
  expect((await request.get(`${api}/exam-versions/${seed.v.id}`, { headers: participant.headers })).status()).toBe(403);
});
