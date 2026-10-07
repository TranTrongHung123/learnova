import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const api = "http://localhost:8081/api/v1", password = "Result test password 123";
async function account(request: APIRequestContext, role: string) {
  const email = `${randomUUID()}@example.com`, csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect((await request.post(`${api}/auth/register`, { headers, data: { email, password, displayName: role, roles: [role] } })).status()).toBe(201);
  const login = await (await request.post(`${api}/auth/login`, { headers, data: { email, password } })).json();
  return { email, id: login.user.id, headers: { Authorization: `Bearer ${login.accessToken}` } };
}
async function fixture(request: APIRequestContext, mode = "DETAILED", graded = true) {
  const owner = await account(request, "CREATOR"), participant = await account(request, "PARTICIPANT"), headers = owner.headers;
  const q = await (await request.post(`${api}/questions`, { headers, data: { type: "TRUE_FALSE", status: "ACTIVE", content: "Snapshot question", explanation: "Snapshot explanation", options: [], correctBoolean: true } })).json();
  const exam = await (await request.post(`${api}/exams`, { headers, data: { name: "Result exam" } })).json();
  const v = await (await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, { headers, data: { revision: 0, questions: [{ questionId: q.id, revision: q.revision }] } })).json();
  expect((await request.post(`${api}/exam-versions/${v.id}/publish`, { headers, data: { revision: v.revision } })).status()).toBe(200);
  const response = await request.post(`${api}/exam-sessions`, { headers, data: { title: "Result session", examVersionId: v.id, startTime: new Date(Date.now() - 60000).toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 30, maxAttempts: 2, passingScore: "1", accessType: "INDIVIDUAL", classroomIds: [], participantIds: [participant.id], shuffleQuestions: false, shuffleAnswers: false, resultDisplayMode: mode, resultReleasePolicy: "MANUAL" } });
  expect(response.status()).toBe(201); const s = await response.json();
  expect((await request.post(`${api}/exam-sessions/${s.id}/schedule`, { headers, data: { revision: s.revision } })).status()).toBe(200);
  const started = await (await request.post(`${api}/exam-sessions/${s.id}/attempts`, { headers: participant.headers })).json();
  const a = started.attempt ?? started;
  expect((await request.put(`${api}/attempts/${a.id}/answers/${a.questions[0].id}`, { headers: participant.headers, data: { revision: 0, answer: { optionIds: [], booleanValue: true, numericValue: null }, markedForReview: false } })).status()).toBe(200);
  if (graded) expect((await request.post(`${api}/attempts/${a.id}/submit`, { headers: participant.headers })).status()).toBe(200);
  return { owner, participant, s, a };
}
async function login(page: Page, email: string, role: string) {
  await page.goto("/login"); await page.locator("#email").fill(email); await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/${role}$`));
}
test("real assignments, released results, read confirmation, offline and responsive notifications", async ({ page, request }) => {
  const f = await fixture(request);
  await login(page, f.participant.email, "participant");
  await page.getByRole("link", { name: "Thông báo, 1 chưa đọc", exact: true }).click();
  const list = page.getByRole("region", { name: "Danh sách thông báo" });
  await expect(list.getByRole("heading", { name: "Bạn được giao kỳ thi" })).toBeVisible();
  await expect(list.getByRole("heading", { name: "Kết quả đã sẵn sàng" })).toHaveCount(0);
  await page.route("**/api/v1/notifications/*/read", route => route.abort());
  await list.getByRole("button", { name: "Đánh dấu đã đọc", exact: true }).click();
  await expect(list.getByRole("alert")).toBeVisible();
  await expect(list.getByText("Chưa đọc", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/notifications/*/read");
  await list.getByRole("button", { name: "Đánh dấu đã đọc", exact: true }).click();
  await expect(list.getByText("Đã đọc", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Thông báo, 0 chưa đọc", exact: true })).toBeVisible();
  expect((await request.post(`${api}/exam-sessions/${f.s.id}/release-results`, { headers: f.owner.headers })).status()).toBe(200);
  await expect.poll(async () => (await (await request.get(`${api}/notifications/unread-count`, { headers: f.participant.headers })).json()).unreadCount, { timeout: 45000 }).toBe(1);
  await list.getByRole("button", { name: "Làm mới" }).click();
  await expect(list.getByRole("heading", { name: "Kết quả đã sẵn sàng" })).toBeVisible();
  await list.getByLabel("Chỉ chưa đọc").check();
  await expect(list.getByRole("heading", { name: "Bạn được giao kỳ thi" })).toHaveCount(0);
  const target = list.getByRole("link", { name: "Mở nội dung liên quan" });
  await target.focus(); await expect(target).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page).toHaveURL(new RegExp(`/participant/results/${f.a.id}$`));
  await expect(page.getByText("Snapshot explanation")).toBeVisible();
  await page.goto("/notifications");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(list.getByRole("heading", { name: "Kết quả đã sẵn sàng" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    if (width === 375 || width === 1440) await page.screenshot({ path: `test-results/notification/list-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 640, height: 450 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.context().setOffline(true); await list.getByRole("button", { name: "Làm mới" }).click();
  await expect(list.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await page.context().setOffline(false); await list.getByRole("button", { name: "Thử lại" }).click();
  await expect(list.getByRole("heading", { name: "Kết quả đã sẵn sàng" })).toBeVisible();
  await list.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();
  await expect(list.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeDisabled();
  await list.getByLabel("Chỉ chưa đọc").check();
  await expect(list.getByRole("heading", { name: "Không có thông báo chưa đọc" })).toBeVisible();
  await page.reload(); await expect(list.getByRole("status", { name: "Trạng thái thông báo" })).toHaveText("0 thông báo chưa đọc");
});

test("class notifications, pagination and owner isolation", async ({ page, request }) => {
  const owner = await account(request, "CREATOR"), participant = await account(request, "PARTICIPANT");
  await login(page, owner.email, "creator"); await page.goto("/notifications");
  const list = page.getByRole("region", { name: "Danh sách thông báo" });
  await expect(list.getByRole("heading", { name: "Chưa có thông báo" })).toBeVisible();
  for (let i = 0; i < 21; i++) {
    const c = await (await request.post(`${api}/classrooms`, { headers: owner.headers, data: { name: `Notification class ${i}` } })).json();
    expect((await request.post(`${api}/classrooms/${c.id}/members`, { headers: owner.headers, data: { userId: participant.id } })).status()).toBe(200);
  }
  await list.getByRole("button", { name: "Làm mới" }).click();
  await expect(list.locator("article")).toHaveCount(20);
  await list.getByRole("button", { name: "Trang sau" }).click(); await expect(list.locator("article")).toHaveCount(1);
  const own = await (await request.get(`${api}/notifications`, { headers: owner.headers })).json();
  expect((await request.post(`${api}/notifications/${own.content[0].id}/read`, { headers: participant.headers })).status()).toBe(404);
  await list.getByRole("link", { name: "Mở nội dung liên quan" }).click();
  await expect(page).toHaveURL(/\/creator\/classes\/[0-9a-f-]+$/);
  await page.goto("/notifications"); await list.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();
  await expect(list.getByRole("status", { name: "Trạng thái thông báo" })).toHaveText("Đã đánh dấu tất cả thông báo đã đọc.");
  expect((await (await request.get(`${api}/notifications/unread-count`, { headers: participant.headers })).json()).unreadCount).toBe(21);
});
