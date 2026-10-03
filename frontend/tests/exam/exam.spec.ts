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

test("matrix preview handles overlap, supports keyboard and responsive layout, then appends reviewable snapshots", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers);
  await source(request, owner.headers, "Câu đúng sai theo ma trận");
  expect((await request.post(`${api}/questions`, { headers: owner.headers, data: { type: "NUMERIC_ANSWER", status: "ACTIVE", content: "Câu số theo ma trận", correctValue: "2", tolerance: "0" } })).status()).toBe(201);
  await login(page, owner.email, seed.path);
  const open = page.getByRole("button", { name: "Sinh đề theo ma trận", exact: true });
  await page.getByLabel("Điểm câu 1", { exact: true }).fill("2"); await expect(open).toBeDisabled();
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click(); await expect(open).toBeEnabled();
  await open.click(); await page.keyboard.press("Escape"); await expect(open).toBeFocused(); await open.click();
  const dialog = page.getByRole("dialog", { name: "Sinh đề theo ma trận" });
  await dialog.getByLabel("Số lượng dòng 1").fill("1.5");
  await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByLabel("Số lượng dòng 1")).toHaveAttribute("aria-invalid", "true");
  await dialog.getByLabel("Số lượng dòng 1").fill("1");
  await dialog.getByRole("button", { name: "Thêm dòng" }).click();
  await dialog.getByLabel("Loại câu dòng 2").selectOption("TRUE_FALSE");
  await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Đủ câu hỏi cho toàn ma trận");
  await expect(dialog).toContainText("Dòng 2: yêu cầu 1 · Phù hợp 1 · Phân bổ 1 · Thiếu 0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/exam/matrix-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 812, height: 375 });
  await dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" })).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.evaluate(() => { document.body.style.zoom = "1"; });
  await dialog.getByLabel("Số lượng dòng 2").fill("2");
  await expect(dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" })).toBeDisabled();
  await dialog.getByLabel("Số lượng dòng 2").fill("1");
  await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  await dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Điểm câu 3", { exact: true })).toHaveValue("1");
  const generated: VersionDetail = await (await request.get(`${api}/exam-versions/${seed.v.id}`, { headers: owner.headers })).json();
  expect(generated.questions.map(q => q.snapshot.type)).toEqual(["TRUE_FALSE", "NUMERIC_ANSWER", "TRUE_FALSE"]);
  expect(new Set(generated.questions.map(q => q.sourceQuestionId)).size).toBe(3);
  await page.getByLabel("Điểm câu 2", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận xuất bản" }).click();
  await expect(page).toHaveURL(`/creator/exams/${seed.exam.id}`);
});

test("matrix shortage and changed bank leave Draft unchanged and retain rule input", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers);
  const candidate = await source(request, owner.headers, "Câu có thể bị lưu trữ");
  const before = await (await request.get(`${api}/exam-versions/${seed.v.id}`, { headers: owner.headers })).json();
  await login(page, owner.email, seed.path); await page.getByRole("button", { name: "Sinh đề theo ma trận", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Số lượng dòng 1").fill("2"); await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Chưa đủ câu hỏi cho toàn ma trận");
  await expect(dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" })).toBeDisabled();
  await dialog.getByLabel("Số lượng dòng 1").fill("1"); await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Đủ câu hỏi cho toàn ma trận");
  expect((await request.post(`${api}/questions/${candidate.id}/archive`, { headers: owner.headers, data: { revision: candidate.revision } })).status()).toBe(200);
  await dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Bản nháp chưa bị thay đổi");
  await expect(dialog.getByLabel("Số lượng dòng 1")).toHaveValue("1");
  await expect(dialog).toContainText("Phân bổ 0 · Thiếu 1");
  expect(await (await request.get(`${api}/exam-versions/${seed.v.id}`, { headers: owner.headers })).json()).toEqual(before);
});

test("lost generation response reconciles without generating twice", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers);
  await source(request, owner.headers, "Câu sinh đúng một lần");
  await login(page, owner.email, seed.path); await page.getByRole("button", { name: "Sinh đề theo ma trận", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  let generates = 0;
  await page.route(`**/exam-versions/${seed.v.id}/generation`, async route => { generates++; await route.fetch(); await route.abort(); });
  await dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Chưa xác nhận được kết quả");
  await expect(dialog).toContainText("2 câu · 2 điểm");
  await expect(dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Dùng bản máy chủ và quay lại Builder" }).click();
  await expect(page.getByLabel("Điểm câu 2", { exact: true })).toHaveValue("1"); expect(generates).toBe(1);
});

test("matrix stale revision preserves server changes and requires reconciliation", async ({ page, request }) => {
  const owner = await account(request), seed = await seeded(request, owner.headers);
  await source(request, owner.headers, "Candidate");
  await login(page, owner.email, seed.path); await page.getByRole("button", { name: "Sinh đề theo ma trận", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Kiểm tra số lượng" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Đủ câu hỏi cho toàn ma trận");
  expect((await request.put(`${api}/exam-versions/${seed.v.id}/questions`, { headers: owner.headers, data: { revision: seed.v.revision, questions: [{ id: seed.v.questions[0].id, points: "7" }] } })).status()).toBe(200);
  await dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" }).click();
  await expect(dialog).toContainText("1 câu · 7 điểm");
  await expect(dialog.getByRole("button", { name: "Sinh và thêm vào bản nháp" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Dùng bản máy chủ và quay lại Builder" }).click();
  await expect(page.getByLabel("Điểm câu 1", { exact: true })).toHaveValue("7");
});
