import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8081/api/v1", password = "Discovery test password 123";
async function account(request: APIRequestContext, roles = ["PARTICIPANT"]) {
  const email = `${randomUUID()}@example.com`, csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect((await request.post(`${api}/auth/register`, { headers, data: { email, password, displayName: "Người dùng thử", roles } })).status()).toBe(201);
  const login = await (await request.post(`${api}/auth/login`, { headers, data: { email, password } })).json();
  return { email, id: login.user.id as string, headers: { Authorization: `Bearer ${login.accessToken}` } };
}
async function session(request: APIRequestContext, participant: Awaited<ReturnType<typeof account>>, access = "INDIVIDUAL", upcoming = false) {
  const owner = await account(request, ["CREATOR"]), headers = owner.headers;
  const question = await (await request.post(`${api}/questions`, { headers, data: { type: "TRUE_FALSE", status: "ACTIVE", content: "SECRET QUESTION", correctBoolean: true } })).json();
  const exam = await (await request.post(`${api}/exams`, { headers, data: { name: "Đề discovery", description: "Mô tả kỳ thi thử nghiệm" } })).json();
  const version = await (await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, { headers, data: { revision: 0, questions: [{ questionId: question.id, revision: question.revision }] } })).json();
  expect((await request.post(`${api}/exam-versions/${version.id}/publish`, { headers, data: { revision: version.revision } })).status()).toBe(200);
  let classroomId: string | undefined;
  if (access === "CLASS") {
    classroomId = (await (await request.post(`${api}/classrooms`, { headers, data: { name: "Lớp discovery" } })).json()).id;
    expect((await request.post(`${api}/classrooms/${classroomId}/members`, { headers, data: { userId: participant.id } })).status()).toBe(200);
  }
  const title = `Kỳ thi ${randomUUID()}`;
  const response = await request.post(`${api}/exam-sessions`, { headers, data: {
    title, examVersionId: version.id, startTime: new Date(Date.now() + (upcoming ? 3600000 : -60000)).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(), durationMinutes: 30, maxAttempts: 2, passingScore: "0.5", accessType: access,
    classroomIds: classroomId ? [classroomId] : [], participantIds: access === "INDIVIDUAL" ? [participant.id] : [], shuffleQuestions: false, shuffleAnswers: false,
  } });
  expect(response.status()).toBe(201); const s = await response.json();
  expect((await request.post(`${api}/exam-sessions/${s.id}/schedule`, { headers, data: { revision: s.revision } })).status()).toBe(200);
  return { ...s, title, owner, classroomId };
}
async function login(page: Page, email: string) {
  await page.goto("/login"); await page.locator("#email").fill(email); await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await expect(page).toHaveURL(/\/participant$/);
  await page.getByRole("link", { name: "Kỳ thi của tôi", exact: true }).click();
}
test("real list/detail, filters, reload, safe metadata and responsive keyboard navigation", async ({ page, request }) => {
  const p = await account(request), s = await session(request, p), upcoming = await session(request, p, "INDIVIDUAL", true);
  const body = await (await request.get(`${api}/participant/exam-sessions/${s.id}`, { headers: p.headers })).text();
  expect(body).not.toContain("SECRET QUESTION"); expect(body).not.toContain("correctBoolean");
  await login(page, p.email); await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await page.getByRole("link", { name: "Sắp diễn ra", exact: true }).click(); await expect(page).toHaveURL(/tab=UPCOMING/);
  await expect(page.getByRole("heading", { name: upcoming.title })).toBeVisible(); await page.reload();
  await page.getByRole("link", { name: `Xem chi tiết ${upcoming.title}` }).click();
  await expect(page.getByText("Kỳ thi chưa đến giờ bắt đầu.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Về kỳ thi của tôi" }).click(); await expect(page).toHaveURL(/tab=UPCOMING/);
  await page.getByRole("link", { name: "Có thể làm", exact: true }).click();
  await page.getByRole("link", { name: `Xem chi tiết ${s.title}` }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu làm bài · Sắp có" })).toBeDisabled();
  await expect(page.getByText("Bạn chưa có bài làm trong kỳ thi này.")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/discovery/detail-desktop.png", fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "test-results/discovery/detail-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Về kỳ thi của tôi" }).focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/tab=AVAILABLE/);
});
test("completed overlap, exhausted attempts and personal history use database fixtures", async ({ page, request }) => {
  const p = await account(request), s = await session(request, p);
  expect((await request.post(`${api}/exam-sessions/${s.id}/test-fixture?status=SUBMITTED`, { headers: p.headers })).status()).toBe(200);
  await login(page, p.email); await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await page.getByRole("link", { name: "Đã hoàn thành", exact: true }).click(); await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  expect((await request.post(`${api}/exam-sessions/${s.id}/test-fixture?status=GRADED`, { headers: p.headers })).status()).toBe(200);
  await page.getByRole("link", { name: `Xem chi tiết ${s.title}` }).click();
  await expect(page.getByText("Bạn đã dùng hết số lượt làm bài.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lượt 1 · Đã nộp" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lượt 2 · Đã chấm" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem kết quả · Sắp có" })).toHaveCount(2);
  await page.getByRole("link", { name: "Về kỳ thi của tôi" }).click(); await page.getByRole("link", { name: "Có thể làm", exact: true }).click();
  await expect(page.getByRole("heading", { name: s.title })).toHaveCount(0);
});
test("removed class membership keeps continuation and history; offline retry and private access", async ({ page, request, context }) => {
  const p = await account(request), s = await session(request, p, "CLASS");
  expect((await request.post(`${api}/exam-sessions/${s.id}/test-fixture?status=IN_PROGRESS`, { headers: p.headers })).status()).toBe(200);
  expect((await request.delete(`${api}/classrooms/${s.classroomId}/members/${p.id}`, { headers: s.owner.headers })).status()).toBe(204);
  await login(page, p.email); await page.getByRole("link", { name: `Xem chi tiết ${s.title}` }).click();
  await expect(page.getByRole("button", { name: "Tiếp tục làm bài · Sắp có" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Lượt 1 · Đang làm" })).toBeVisible();
  await context.setOffline(true); await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await context.setOffline(false); await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  const other = await account(request);
  expect((await request.get(`${api}/participant/exam-sessions/${s.id}`, { headers: other.headers })).status()).toBe(404);
  expect((await request.get(`${api}/participant/exam-sessions/${s.id}/attempts`, { headers: other.headers })).status()).toBe(404);
});
