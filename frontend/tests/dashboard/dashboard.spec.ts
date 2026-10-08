import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8094/api/v1",
  password = "Result test password 123";

async function account(request: APIRequestContext, role: string) {
  const email = `${randomUUID()}@example.com`,
    csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect(
    (
      await request.post(`${api}/auth/register`, {
        headers,
        data: {
          email,
          password,
          displayName: role,
          roles: role === "PARTICIPANT" ? ["PARTICIPANT", "CREATOR"] : [role],
        },
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
        content: "Dashboard question",
        explanation: "Dashboard explanation",
        options: [],
        correctBoolean: true,
      },
    })
  ).json();
  const exam = await (
    await request.post(`${api}/exams`, { headers, data: { name: "Dashboard exam" } })
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
      title: "Dashboard session",
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
  await expect(page).toHaveURL(new RegExp(`/(?:${role}|workspaces)$`));
  await page.goto(`/${role}`);
}

test("participant dashboard keeps scores private until release, resumes and switches workspace", async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  await login(page, f.participant.email, "participant");
  await expect(page.getByText("Chưa có điểm", { exact: true })).toBeVisible();
  const results = page.getByRole("region", { name: "Kết quả gần đây", exact: true });
  await expect(results.getByText("Chưa có kết quả được phép xem.")).toBeVisible();
  expect(
    (
      await request.post(`${api}/exam-sessions/${f.s.id}/release-results`, {
        headers: f.owner.headers,
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByText("100 / 100", { exact: true })).toBeVisible();
  await expect(
    results.getByRole("link", { name: "Xem kết quả : Dashboard session", exact: true }),
  ).toBeVisible();
  await results.getByRole("link", { name: "Xem kết quả : Dashboard session", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/participant/results/${f.a.id}$`));
  await page.goto("/participant");
  const second = await request.post(`${api}/exam-sessions/${f.s.id}/attempts`, {
    headers: f.participant.headers,
  });
  expect(second.status()).toBe(201);
  const a = await second.json();
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  const active = page.getByRole("region", { name: "Bài đang làm", exact: true });
  await active
    .getByRole("link", { name: "Tiếp tục làm bài : Dashboard session", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/participant/attempts/${a.id}$`));
  await page.goto("/participant");
  await page.getByRole("combobox").selectOption("CREATOR");
  await expect(page).toHaveURL(/\/creator$/);
  await expect(
    page.getByText("Chưa có đề thi. Tạo đề thi đầu tiên từ thao tác nhanh."),
  ).toBeVisible();
  await page.getByRole("combobox").selectOption("PARTICIPANT");
  await expect(page).toHaveURL(/\/participant$/);
  await expect(
    active.getByRole("link", { name: "Tiếp tục làm bài : Dashboard session", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("100 / 100", { exact: true })).toBeVisible();
});

test("creator dashboard shows real owned data, actions and responsive error recovery", async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  await login(page, f.owner.email, "creator");
  await expect(
    page
      .getByRole("region", { name: "Đề thi gần đây", exact: true })
      .getByRole("heading", { name: "Dashboard exam", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Kỳ thi đang mở", exact: true })
      .getByRole("heading", { name: "Dashboard session", exact: true }),
  ).toBeVisible();
  await checkLayout(page, "creator");
  await page.getByRole("link", { name: "Tạo câu hỏi", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/creator\/questions\/new$/);
  await page.goto("/creator");
  await expect(page.getByRole("button", { name: "Làm mới", exact: true })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Đề thi gần đây", exact: true })
      .getByRole("heading", { name: "Dashboard exam", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền truy cập", exact: true }),
  ).toBeVisible();
});

test("participant responsive and notification deep links", async ({ page, request }) => {
  const f = await fixture(request, "SUMMARY", false);
  await login(page, f.participant.email, "participant");
  await expect(
    page
      .getByRole("region", { name: /Thông báo ·/ })
      .getByText(/Dashboard session/)
      .first(),
  ).toBeVisible();
  await checkLayout(page, "participant");
  await page
    .getByRole("region", { name: /Thông báo ·/ })
    .getByRole("link", { name: /Mở thông báo/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/participant/exams/${f.s.id}$`));
});

test("admin dashboard labels account status and role counts with safe navigation", async ({
  page,
  request,
}) => {
  await account(request, "PARTICIPANT");
  await page.goto("/login");
  await page.locator("#email").fill(process.env.LEARNOVA_TEST_ADMIN_EMAIL!);
  await page.locator("#password").fill(process.env.LEARNOVA_TEST_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("paragraph").filter({ hasText: /^Tài khoản ACTIVE$/ })).toBeVisible();
  await expect(page.getByText(/không phải số người đang online/)).toBeVisible();
  await checkLayout(page, "admin");
  await page.getByRole("link", { name: "Xem chi tiết Tài khoản ACTIVE", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users\?status=ACTIVE$/);
  await page.goto("/creator");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền truy cập", exact: true }),
  ).toBeVisible();
});

async function checkLayout(page: Page, role: string) {
  await expect(page.getByRole("button", { name: "Làm mới", exact: true })).toBeVisible();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    if (width === 375 || width === 1440)
      await page.screenshot({
        path: `test-results/dashboard/${role}-${width}.png`,
        fullPage: true,
      });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 450 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
}

test("empty participant dashboard loads without invented scores and retries a failed request", async ({
  page,
  request,
}) => {
  const user = await account(request, "PARTICIPANT");
  await login(page, user.email, "participant");
  await expect(page.getByText("Bạn không có bài đang làm còn thời gian.")).toBeVisible();
  await expect(page.getByText("Bạn chưa có thông báo.")).toBeVisible();
  await expect(page.getByText("Chưa có điểm", { exact: true })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/participant/dashboard", async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Đang tải/ })).toBeVisible();
  release();
  await expect(page.getByText("Chưa có điểm", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/participant/dashboard");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await expect(page.getByText("Chưa có điểm", { exact: true })).toHaveCount(0);
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByText("Chưa có điểm", { exact: true })).toBeVisible();
});
