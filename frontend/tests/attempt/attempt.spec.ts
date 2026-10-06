import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8081/api/v1", password = "Attempt test password 123";
async function account(request: APIRequestContext, roles = ["PARTICIPANT"]) {
  const email = `${randomUUID()}@example.com`, csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect((await request.post(`${api}/auth/register`, { headers, data: { email, password, displayName: "Người làm bài", roles } })).status()).toBe(201);
  const login = await (await request.post(`${api}/auth/login`, { headers, data: { email, password } })).json();
  return { email, id: login.user.id as string, headers: { Authorization: `Bearer ${login.accessToken}` } };
}
async function fixture(request: APIRequestContext, access = "INDIVIDUAL", remainingMs = 3600000) {
  const participant = await account(request), owner = await account(request, ["CREATOR"]), headers = owner.headers;
  const sources = [];
  for (const type of ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "NUMERIC_ANSWER"]) {
    const choice = type.endsWith("CHOICE");
    const response = await request.post(`${api}/questions`, { headers, data: { type, status: "ACTIVE", content: `Câu hỏi ${type}`, explanation: "SECRET EXPLANATION", options: choice ? [{ content: "Lựa chọn Một", correct: true }, { content: "Lựa chọn Hai", correct: false }, { content: "Lựa chọn Ba", correct: false }] : [], correctBoolean: type === "TRUE_FALSE" ? true : null, correctValue: type === "NUMERIC_ANSWER" ? "2.5" : null } });
    expect(response.status()).toBe(201); const q = await response.json(); sources.push({ questionId: q.id, revision: q.revision });
  }
  const exam = await (await request.post(`${api}/exams`, { headers, data: { name: "Đề làm bài" } })).json();
  const version = await (await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, { headers, data: { revision: 0, questions: sources } })).json();
  expect((await request.post(`${api}/exam-versions/${version.id}/publish`, { headers, data: { revision: version.revision } })).status()).toBe(200);
  let classroomId: string | undefined;
  if (access === "CLASS") {
    classroomId = (await (await request.post(`${api}/classrooms`, { headers, data: { name: "Lớp làm bài" } })).json()).id;
    expect((await request.post(`${api}/classrooms/${classroomId}/members`, { headers, data: { userId: participant.id } })).status()).toBe(200);
  }
  const response = await request.post(`${api}/exam-sessions`, { headers, data: { title: `Bài kiểm tra ${randomUUID()}`, examVersionId: version.id, startTime: new Date(Date.now() - 60000).toISOString(), endTime: new Date(Date.now() + remainingMs).toISOString(), durationMinutes: 30, maxAttempts: 2, passingScore: "1", accessType: access, classroomIds: classroomId ? [classroomId] : [], participantIds: access === "INDIVIDUAL" ? [participant.id] : [], shuffleQuestions: true, shuffleAnswers: true } });
  expect(response.status()).toBe(201); const s = await response.json();
  expect((await request.post(`${api}/exam-sessions/${s.id}/schedule`, { headers, data: { revision: s.revision } })).status()).toBe(200);
  return { participant, owner, s, classroomId };
}
async function login(page: Page, email: string) {
  await page.goto("/login"); await page.locator("#email").fill(email); await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await expect(page).toHaveURL(/\/participant$/);
}
async function start(page: Page, s: { id: string }) {
  await page.goto(`/participant/exams/${s.id}`); await page.getByRole("button", { name: "Bắt đầu làm bài", exact: true }).click();
  await page.getByRole("button", { name: "Bắt đầu ngay", exact: true }).click(); await expect(page).toHaveURL(/\/participant\/attempts\//);
  await expect(page.getByRole("heading", { name: "Câu 1 / 4", exact: true })).toBeVisible();
}
async function read(request: APIRequestContext, page: Page, headers: { Authorization: string }) {
  const id = page.url().split("/").at(-1); const response = await request.get(`${api}/attempts/${id}`, { headers }); expect(response.ok()).toBeTruthy(); return response.json();
}
async function navigate(page: Page, index: number) {
  const toggle = page.getByRole("button", { name: "Danh sách câu hỏi" });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await page.getByRole("navigation", { name: "Câu hỏi", exact: true }).getByRole("button", { name: new RegExp(`^Câu ${index + 1},`) }).click();
}
test("start, all answer types, review, reload and stable shuffle with real API", async ({ page, request }) => {
  const f = await fixture(request); await login(page, f.participant.email); await start(page, f.s);
  const initial = await read(request, page, f.participant.headers);
  expect(JSON.stringify(initial)).not.toMatch(/SECRET EXPLANATION|correctBoolean|tolerance|"correct"/);
  for (let i = 0; i < initial.questions.length; i++) {
    await navigate(page, i); const type = initial.questions[i].type;
    if (type === "NUMERIC_ANSWER") await page.getByLabel("Câu trả lời bằng số", { exact: true }).fill("-12.125");
    else if (type === "TRUE_FALSE") await page.getByRole("radio", { name: "Sai", exact: true }).check();
    else if (type === "SINGLE_CHOICE") await page.getByRole("radio").first().check();
    else { await page.getByRole("checkbox").nth(0).check(); await page.getByRole("checkbox").nth(1).check(); }
    await expect(page.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu");
  }
  await page.getByRole("button", { name: "Đánh dấu xem lại", exact: true }).click(); await expect(page.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu");
  const before = await read(request, page, f.participant.headers); await page.reload(); await expect(page.getByRole("heading", { name: "Câu 1 / 4", exact: true })).toBeVisible();
  const after = await read(request, page, f.participant.headers);
  expect(after.questions.map((q: { id: string; options: unknown }) => [q.id, q.options])).toEqual(initial.questions.map((q: { id: string; options: unknown }) => [q.id, q.options]));
  expect(after.questions.map((q: { state: { answer: unknown; markedForReview: boolean } }) => [q.state.answer, q.state.markedForReview])).toEqual(before.questions.map((q: { state: { answer: unknown; markedForReview: boolean } }) => [q.state.answer, q.state.markedForReview]));
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Chưa trả lời: 0");
  await page.screenshot({ path: "test-results/attempt/submit-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "test-results/attempt/submit-mobile.png", fullPage: true });
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Nộp bài", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận nộp bài" }).click();
  await expect(page.getByRole("heading", { name: "Đã nộp bài", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/attempt/completed-mobile.png", fullPage: true });
  const finished = await read(request, page, f.participant.headers);
  expect(finished.status).toBe("GRADED"); expect(finished.questions).toEqual([]);
  expect(JSON.stringify(finished)).not.toMatch(/rawScore|passed|correctBoolean|SECRET EXPLANATION/);
  await page.reload(); await expect(page.getByRole("heading", { name: "Đã nộp bài", exact: true })).toBeVisible();
});

test("submit waits for a delayed save and recovers when the committed response is lost", async ({ page, request }) => {
  const f = await fixture(request); await login(page, f.participant.email); await start(page, f.s);
  const a = await read(request, page, f.participant.headers);
  const index = a.questions.findIndex((q: { type: string }) => q.type === "NUMERIC_ANSWER"); await navigate(page, index);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/attempts/*/answers/*", async route => { await gate; await route.continue(); }, { times: 1 });
  let submissions = 0;
  await page.route("**/attempts/*/submit", async route => { submissions++; const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort("failed"); });
  await page.getByLabel("Câu trả lời bằng số", { exact: true }).fill("2.5");
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click(); await page.getByRole("button", { name: "Xác nhận nộp bài" }).click();
  await expect(page.getByText("Đang lưu các thay đổi…", { exact: true })).toBeVisible(); expect(submissions).toBe(0);
  release(); await expect(page.getByRole("heading", { name: "Đã nộp bài", exact: true })).toBeVisible(); expect(submissions).toBe(1);
});

test("server finalizes after the browser closes and reload shows expiration", async ({ page, request, context }) => {
  const f = await fixture(request, "INDIVIDUAL", 20000); await login(page, f.participant.email); await start(page, f.s);
  const url = page.url(); await page.close();
  // History chỉ đọc metadata: polling không kích hoạt lazy finalization.
  await expect.poll(async () => {
    const response = await request.get(`${api}/participant/exam-sessions/${f.s.id}/attempts`, { headers: f.participant.headers });
    const history = await response.json(); return history.content[0]?.status;
  }, { timeout: 45000, intervals: [1000] }).toBe("GRADED");
  const resumed = await context.newPage(); await resumed.goto(url);
  await expect(resumed.getByRole("heading", { name: "Bài làm đã kết thúc do hết giờ" })).toBeVisible();
});

test("deadline while editing finalizes on the server and restores focus", async ({ page, request }) => {
  const f = await fixture(request, "INDIVIDUAL", 20000); await login(page, f.participant.email); await start(page, f.s);
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bài làm đã kết thúc do hết giờ" })).toBeVisible({ timeout: 35000 });
  await expect(page.getByRole("heading", { name: "Bài làm đã kết thúc do hết giờ" })).toBeFocused();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const a = await read(request, page, f.participant.headers); expect(a.completionReason).toBe("DEADLINE_REACHED");
});
test("offline retains unsaved input and reconnect saves before reload", async ({ page, request, context }) => {
  const f = await fixture(request); await login(page, f.participant.email); await start(page, f.s); const a = await read(request, page, f.participant.headers);
  const index = a.questions.findIndex((q: { type: string }) => q.type === "NUMERIC_ANSWER"); await navigate(page, index);
  await context.setOffline(true); await page.getByLabel("Câu trả lời bằng số", { exact: true }).fill("123.45");
  await expect(page.getByText("Chưa lưu được. Kiểm tra mạng hoặc thử lại.", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).not.toHaveText("Tất cả thay đổi đã được lưu");
  await context.setOffline(false); await expect(page.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu");
  await page.reload(); await navigate(page, index); await expect(page.getByLabel("Câu trả lời bằng số", { exact: true })).toHaveValue("123.45");
});
test("two tabs preserve conflicting answers until participant chooses", async ({ page, request, context }) => {
  const f = await fixture(request); await login(page, f.participant.email); await start(page, f.s); const a = await read(request, page, f.participant.headers);
  const index = a.questions.findIndex((q: { type: string }) => q.type === "NUMERIC_ANSWER"); await navigate(page, index);
  const other = await context.newPage(); await other.goto(page.url()); await navigate(other, index);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/attempts/*/answers/*", async route => { await gate; await route.continue(); }, { times: 1 });
  await page.getByLabel("Câu trả lời bằng số", { exact: true }).fill("1");
  await other.getByLabel("Câu trả lời bằng số", { exact: true }).fill("9"); await expect(other.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu");
  // Trì hoãn request thật để hai tab gửi cùng revision; không thay response backend.
  release();
  await expect(page.getByRole("heading", { name: "Câu này đã thay đổi ở nơi khác" })).toBeVisible();
  await expect(page.getByLabel("Câu trả lời bằng số", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Lưu bản đang nhập" }).click(); await expect(page.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu");
  await other.reload(); await navigate(other, index); await expect(other.getByLabel("Câu trả lời bằng số", { exact: true })).toHaveValue("1"); await other.close();
});
test("removed membership still resumes; responsive layout, keyboard and reduced motion", async ({ page, request }) => {
  const f = await fixture(request, "CLASS"); await login(page, f.participant.email); await start(page, f.s); const url = page.url();
  expect((await request.delete(`${api}/classrooms/${f.classroomId}/members/${f.participant.id}`, { headers: f.owner.headers })).status()).toBe(204);
  await page.goto(`/participant/exams/${f.s.id}`); await page.getByRole("link", { name: "Tiếp tục làm bài", exact: true }).click(); await expect(page).toHaveURL(url);
  await page.getByRole("button", { name: "Đánh dấu xem lại", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu"); await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: "test-results/attempt/desktop.png", fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; }); await page.setViewportSize({ width: 375, height: 812 }); await page.screenshot({ path: "test-results/attempt/mobile.png", fullPage: true });
});
test("read errors distinguish not-found, forbidden and network failure", async ({ page, request }) => {
  const f = await fixture(request); await login(page, f.participant.email);
  await page.goto(`/participant/attempts/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang", exact: true })).toBeVisible();
  const response = await request.post(`${api}/exam-sessions/${f.s.id}/attempts`, { headers: f.participant.headers });
  expect(response.status()).toBe(201); const a = await response.json();
  const endpoint = `${api}/attempts/${a.id}`;
  // Backend thật từ chối CREATOR không có role PARTICIPANT; auth của trang vẫn được giữ.
  await page.route(endpoint, route => route.continue({ headers: { ...route.request().headers(), authorization: f.owner.headers.Authorization } }));
  await page.goto(`/participant/attempts/${a.id}`);
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập", exact: true })).toBeVisible();
  await page.unroute(endpoint); await page.route(endpoint, route => route.abort("connectionfailed"));
  await page.reload(); await expect(page.getByRole("heading", { name: "Chưa thể kết nối", exact: true })).toBeVisible();
  await page.unroute(endpoint); await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Câu 1 / 4", exact: true })).toBeVisible();
});
