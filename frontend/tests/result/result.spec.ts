import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8081/api/v1",
  password = "Result test password 123";

async function account(request: APIRequestContext, role: string) {
  const email = `${randomUUID()}@example.com`,
    csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect(
    (
      await request.post(`${api}/auth/register`, {
        headers,
        data: { email, password, displayName: role, roles: [role] },
      })
    ).status(),
  ).toBe(201);
  const login = await (
    await request.post(`${api}/auth/login`, { headers, data: { email, password } })
  ).json();
  return { email, id: login.user.id, headers: { Authorization: `Bearer ${login.accessToken}` } };
}

async function fixture(request: APIRequestContext, mode = "DETAILED", graded = true) {
  const owner = await account(request, "CREATOR"),
    participant = await account(request, "PARTICIPANT"),
    headers = owner.headers;
  const q = await (
    await request.post(`${api}/questions`, {
      headers,
      data: {
        type: "TRUE_FALSE",
        status: "ACTIVE",
        content: "Snapshot question",
        explanation: "Snapshot explanation",
        options: [],
        correctBoolean: true,
      },
    })
  ).json();
  const exam = await (
    await request.post(`${api}/exams`, { headers, data: { name: "Result exam" } })
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
      title: "Result session",
      examVersionId: v.id,
      startTime: new Date(Date.now() - 60000).toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      durationMinutes: 30,
      maxAttempts: 2,
      passingScore: "1",
      accessType: "INDIVIDUAL",
      classroomIds: [],
      participantIds: [participant.id],
      shuffleQuestions: false,
      shuffleAnswers: false,
      resultDisplayMode: mode,
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
  const started = await (
    await request.post(`${api}/exam-sessions/${s.id}/attempts`, { headers: participant.headers })
  ).json();
  const a = started.attempt ?? started;
  expect(
    (
      await request.put(`${api}/attempts/${a.id}/answers/${a.questions[0].id}`, {
        headers: participant.headers,
        data: {
          revision: 0,
          answer: { optionIds: [], booleanValue: true, numericValue: null },
          markedForReview: false,
        },
      })
    ).status(),
  ).toBe(200);
  if (graded)
    expect(
      (
        await request.post(`${api}/attempts/${a.id}/submit`, { headers: participant.headers })
      ).status(),
    ).toBe(200);
  return { owner, participant, s, a };
}

async function login(page: Page, email: string, role: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
}

test("manual release, participant privacy, history, snapshot and responsive result", async ({
  page,
  request,
  browser,
}) => {
  const f = await fixture(request);
  await login(page, f.participant.email, "participant");
  await page.goto(`/participant/results/${f.a.id}`);
  await expect(page.getByRole("status")).toHaveText("Chờ công bố");
  await expect(page.getByText("Snapshot explanation")).toHaveCount(0);
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await login(ownerPage, f.owner.email, "creator");
  await ownerPage.goto(`/creator/sessions/${f.s.id}/results`);
  await ownerPage.getByRole("button", { name: "Xem các lượt làm" }).click();
  await expect(ownerPage.getByRole("link", { name: "Xem kết quả lượt 1" })).toBeVisible();
  await ownerPage.getByRole("button", { name: "Công bố kết quả", exact: true }).click();
  await ownerPage.keyboard.press("Escape");
  await expect(
    ownerPage.getByRole("button", { name: "Công bố kết quả", exact: true }),
  ).toBeFocused();
  await ownerPage.getByRole("button", { name: "Công bố kết quả", exact: true }).click();
  await ownerPage.getByRole("button", { name: "Xác nhận công bố" }).click();
  await expect(
    ownerPage.getByRole("status").filter({ hasText: "Đã công bố thủ công" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Snapshot explanation")).toBeVisible();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(page.getByRole("heading", { name: /Câu 1/ })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    if (width === 375 || width === 1440)
      await page.screenshot({ path: `test-results/result/detail-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 450 });
  await page.screenshot({ path: "test-results/result/detail.png", fullPage: true });
  await page.goto("/participant/results");
  await expect(page.getByRole("link", { name: "Xem lượt điểm cao nhất" })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("link", { name: "Xem lượt điểm cao nhất" })).toBeVisible();
  await ownerContext.close();
});

test("hidden result stays unavailable after release and foreign participant is rejected", async ({
  page,
  request,
}) => {
  const f = await fixture(request, "HIDDEN");
  expect(
    (
      await request.post(`${api}/exam-sessions/${f.s.id}/release-results`, {
        headers: f.owner.headers,
      })
    ).status(),
  ).toBe(200);
  const body = await (
    await request.get(`${api}/participant/results/${f.a.id}`, { headers: f.participant.headers })
  ).json();
  expect(body.result).toBeUndefined();
  expect(body.questions).toBeUndefined();
  await login(page, f.participant.email, "participant");
  await page.goto(`/participant/results/${f.a.id}`);
  await expect(page.getByRole("status")).toHaveText("Kết quả đang được ẩn");
  await expect(page.getByText("Snapshot explanation")).toHaveCount(0);
  const other = await account(request, "PARTICIPANT");
  expect(
    (
      await request.get(`${api}/participant/results/${f.a.id}`, { headers: other.headers })
    ).status(),
  ).toBe(404);
});

test("reporting shows best score, all graded samples, immutable snapshot and downloads Excel", async ({
  page,
  request,
}) => {
  const f = await fixture(request, "HIDDEN");
  const secondResponse = await request.post(`${api}/exam-sessions/${f.s.id}/attempts`, {
    headers: f.participant.headers,
  });
  expect(secondResponse.status()).toBe(201);
  const second = await secondResponse.json();
  expect(
    (
      await request.post(`${api}/attempts/${second.id}/submit`, { headers: f.participant.headers })
    ).status(),
  ).toBe(200);
  await login(page, f.owner.email, "creator");
  await page.getByRole("link", { name: "Báo cáo", exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/reports$/);
  await page.getByRole("link", { name: "Xem thống kê Result session", exact: true }).click();
  await expect(page.getByText(/Mẫu BEST_SCORE: 1 người/)).toBeVisible();
  await expect(page.locator("summary")).toHaveText("Câu 1 · 1 điểm — Xem snapshot");
  await expect(page.getByRole("cell", { name: "50% (1)", exact: true })).toHaveCount(2);
  await expect(page.getByRole("cell", { name: /Không có dữ liệu.*0 mẫu thời gian/ })).toBeVisible();
  const snapshot = page.locator("summary").filter({ hasText: "Xem snapshot" });
  await snapshot.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Snapshot question", { exact: true })).toBeVisible();
  await expect(page.getByText("Giải thích: Snapshot explanation", { exact: true })).toBeVisible();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await expect(page.getByRole("button", { name: "Xuất Excel", exact: true })).toBeVisible();
    if (width === 375 || width === 1440)
      await page.screenshot({ path: `test-results/result/analytics-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 450 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`session-${f.s.id}.xlsx`);
  expect(await file.failure()).toBeNull();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByText(/Mẫu BEST_SCORE: 1 người/)).toBeVisible();
  await page.getByRole("link", { name: "Xem kết quả", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xuất Excel", exact: true })).toBeVisible();
});

test("reporting empty samples, export error retry and foreign owner state", async ({
  page,
  request,
}) => {
  const f = await fixture(request, "DETAILED", false);
  await login(page, f.owner.email, "creator");
  await page.goto(`/creator/sessions/${f.s.id}/analytics`);
  await expect(page.getByText(/Chưa có lượt đã chấm/)).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Chưa thể kết nối" })).toBeVisible();
  await page.context().setOffline(false);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel", exact: true }).click();
  expect(await (await download).failure()).toBeNull();
  const foreign = await fixture(request);
  await page.goto(`/creator/sessions/${foreign.s.id}/analytics`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});
