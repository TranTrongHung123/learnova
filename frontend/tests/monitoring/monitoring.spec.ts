import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8081/api/v1",
  password = "Monitoring test password 123";

async function account(request: APIRequestContext, role: string, displayName = role) {
  const email = `${randomUUID()}@example.com`,
    csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect(
    (
      await request.post(`${api}/auth/register`, {
        headers,
        data: { email, password, displayName, roles: [role] },
      })
    ).status(),
  ).toBe(201);
  const login = await (
    await request.post(`${api}/auth/login`, { headers, data: { email, password } })
  ).json();
  return { email, id: login.user.id, headers: { Authorization: `Bearer ${login.accessToken}` } };
}

async function fixture(request: APIRequestContext, accessType = "INDIVIDUAL") {
  const owner = await account(request, "CREATOR"),
    participant = await account(request, "PARTICIPANT", "Nguyễn Minh Anh"),
    headers = owner.headers;
  const q = await (
    await request.post(`${api}/questions`, {
      headers,
      data: {
        type: "TRUE_FALSE",
        status: "ACTIVE",
        content: "Monitoring question",
        explanation: "SECRET EXPLANATION",
        options: [],
        correctBoolean: true,
      },
    })
  ).json();
  const exam = await (
    await request.post(`${api}/exams`, { headers, data: { name: "Monitoring exam" } })
  ).json();
  const v = await (
    await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, {
      headers,
      data: { revision: 0, questions: [{ questionId: q.id, revision: q.revision }] },
    })
  ).json();
  expect(
    (
      await request.post(`${api}/exam-versions/${v.id}/publish`, {
        headers,
        data: { revision: v.revision },
      })
    ).status(),
  ).toBe(200);
  const response = await request.post(`${api}/exam-sessions`, {
    headers,
    data: {
      title: "Kiểm tra giữa kỳ · Vật lý 10",
      examVersionId: v.id,
      startTime: new Date(Date.now() - 60000).toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      durationMinutes: 30,
      maxAttempts: 2,
      passingScore: "1",
      accessType,
      classroomIds: [],
      participantIds: accessType === "PUBLIC" ? [] : [participant.id],
      shuffleQuestions: false,
      shuffleAnswers: false,
      resultDisplayMode: "HIDDEN",
      resultReleasePolicy: "MANUAL",
    },
  });
  expect(response.status()).toBe(201);
  const s = await response.json();
  expect(
    (
      await request.post(`${api}/exam-sessions/${s.id}/schedule`, {
        headers,
        data: { revision: s.revision },
      })
    ).status(),
  ).toBe(200);
  return { owner, participant, s };
}

async function login(page: Page, email: string, role: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
}

test("live progress, reconnect, submit and responsive monitoring", async ({ page, request }) => {
  const f = await fixture(request);
  await login(page, f.owner.email, "creator");
  const frames: string[] = [];
  page.on("websocket", (ws) =>
    ws.on("framereceived", (frame) => frames.push(String(frame.payload))),
  );
  await page.goto(`/creator/sessions/${f.s.id}`);
  await page.getByRole("link", { name: "Giám sát kỳ thi", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Đang cập nhật trực tiếp");
  const row = page.getByRole("row").filter({ hasText: "Nguyễn Minh Anh" });
  await expect(row).toContainText("Chưa bắt đầu");
  const a = await (
    await request.post(`${api}/exam-sessions/${f.s.id}/attempts`, {
      headers: f.participant.headers,
    })
  ).json();
  await expect(row).toContainText("Đang làm");
  await expect(row).toContainText("Đang kết nối");
  for (const width of [375, 768, 1024, 1440, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await expect(page.getByRole("button", { name: "Đồng bộ lại" })).toBeVisible();
    if (width === 375 || width === 1440)
      await page.screenshot({
        path: `test-results/monitoring/monitor-${width}.png`,
        fullPage: true,
      });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("Tìm Participant").fill("không tìm thấy");
  await expect(page.getByText("Không có Participant phù hợp.")).toBeVisible();
  await page.getByLabel("Tìm Participant").fill("");
  await page.getByRole("button", { name: "Đồng bộ lại" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Tìm Participant")).toBeFocused();
  await page.context().setOffline(true);
  await expect(page.getByRole("status")).toContainText("Đang kết nối lại", { timeout: 20000 });
  expect(
    (
      await request.put(`${api}/attempts/${a.id}/answers/${a.questions[0].id}`, {
        headers: f.participant.headers,
        data: {
          revision: 0,
          answer: { optionIds: [], booleanValue: false, numericValue: null },
          markedForReview: false,
        },
      })
    ).status(),
  ).toBe(200);
  await page.context().setOffline(false);
  await expect(page.getByRole("status")).toHaveText("Đang cập nhật trực tiếp", { timeout: 25000 });
  await expect(row).toContainText("1 / 1");
  expect(
    (
      await request.post(`${api}/attempts/${a.id}/submit`, { headers: f.participant.headers })
    ).status(),
  ).toBe(200);
  await expect(row).toContainText("Đã chấm");
  await page.reload();
  await expect(row).toContainText("Đã chấm");
  await expect(page.getByRole("status")).toHaveText("Đang cập nhật trực tiếp");
  expect(frames.length).toBeGreaterThan(2);
  for (const frame of frames)
    expect(frame).not.toMatch(/SECRET|correctBoolean|optionIds|rawScore|refreshToken/);
});

test("PUBLIC not-started is inapplicable and foreign owner is denied", async ({
  page,
  request,
  browser,
}) => {
  const f = await fixture(request, "PUBLIC");
  await login(page, f.owner.email, "creator");
  await page.goto(`/creator/sessions/${f.s.id}/monitor`);
  await expect(page.getByRole("status")).toHaveText("Đang cập nhật trực tiếp");
  await expect(page.getByText("Không áp dụng", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa có Participant tham gia kỳ thi.")).toBeVisible();
  const other = await account(request, "CREATOR"),
    context = await browser.newContext(),
    otherPage = await context.newPage();
  await login(otherPage, other.email, "creator");
  await otherPage.goto(`/creator/sessions/${f.s.id}/monitor`);
  await expect(otherPage.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await context.close();
});

test("exam heartbeat expires independently while answers survive", async ({
  page,
  request,
  browser,
}) => {
  const f = await fixture(request);
  const a = await (
    await request.post(`${api}/exam-sessions/${f.s.id}/attempts`, {
      headers: f.participant.headers,
    })
  ).json();
  await login(page, f.owner.email, "creator");
  await page.goto(`/creator/sessions/${f.s.id}/monitor`);
  const context = await browser.newContext(),
    participantPage = await context.newPage();
  await login(participantPage, f.participant.email, "participant");
  const heartbeat = participantPage.waitForResponse(
    (r) => r.url().endsWith(`/attempts/${a.id}/heartbeat`) && r.status() === 204,
  );
  await participantPage.goto(`/participant/attempts/${a.id}`);
  await heartbeat;
  const row = page.getByRole("row").filter({ hasText: "Nguyễn Minh Anh" });
  await expect(row).toContainText("Đang kết nối");
  await context.close();
  await expect(row).toContainText("Mất kết nối", { timeout: 55000 });
  await expect(row).toContainText("Đang làm");
  const saved = await (
    await request.get(`${api}/attempts/${a.id}`, { headers: f.participant.headers })
  ).json();
  expect(saved.status).toBe("IN_PROGRESS");
  expect(saved.questions).toHaveLength(1);
});
