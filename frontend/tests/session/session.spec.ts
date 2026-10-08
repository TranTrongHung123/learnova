import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { localDate, payload, type SessionDetail } from "../../src/features/session/types";

const api = "http://localhost:8081/api/v1",
  password = "Session test password 123";

async function account(request: APIRequestContext, roles = ["CREATOR"]) {
  const email = `${randomUUID()}@example.com`;
  const csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  expect(
    (
      await request.post(`${api}/auth/register`, {
        headers,
        data: { email, password, displayName: "Người tham gia thử", roles },
      })
    ).status(),
  ).toBe(201);
  const login = await (
    await request.post(`${api}/auth/login`, { headers, data: { email, password } })
  ).json();
  return { email, headers: { Authorization: `Bearer ${login.accessToken}` } };
}

async function seed(request: APIRequestContext, headers: Record<string, string>) {
  const question = await (
    await request.post(`${api}/questions`, {
      headers,
      data: { type: "TRUE_FALSE", status: "ACTIVE", content: "Câu hỏi thử", correctBoolean: true },
    })
  ).json();
  const exam = await (
    await request.post(`${api}/exams`, { headers, data: { name: "Đề cho kỳ thi" } })
  ).json();
  const version = await (
    await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, {
      headers,
      data: { revision: 0, questions: [{ questionId: question.id, revision: question.revision }] },
    })
  ).json();
  const published = await (
    await request.post(`${api}/exam-versions/${version.id}/publish`, {
      headers,
      data: { revision: version.revision },
    })
  ).json();
  return { exam, version: published };
}

async function login(page: Page, email: string, destination: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await page.goto(destination);
}

for (const access of ["PUBLIC", "CLASS", "INDIVIDUAL"] as const) {
  test(`wizard ${access}, schedule, extend and cancel with real API`, async ({ page, request }) => {
    const owner = await account(request),
      { exam, version } = await seed(request, owner.headers);
    const participant =
      access === "INDIVIDUAL" ? await account(request, ["PARTICIPANT"]) : undefined;
    if (access === "CLASS")
      expect(
        (
          await request.post(`${api}/classrooms`, {
            headers: owner.headers,
            data: { name: "Lớp được giao" },
          })
        ).status(),
      ).toBe(201);
    await page.setViewportSize({ width: access === "PUBLIC" ? 1440 : 375, height: 900 });
    await login(
      page,
      owner.email,
      `/creator/sessions/new?examId=${exam.id}&versionId=${version.id}`,
    );
    await page.getByLabel("Tên kỳ thi", { exact: true }).fill(`Kỳ thi ${access}`);
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page
      .getByLabel("Giờ bắt đầu", { exact: true })
      .fill(localDate(new Date(Date.now() + 3600000).toISOString()));
    await page
      .getByLabel("Giờ kết thúc", { exact: true })
      .fill(localDate(new Date(Date.now() + 7200000).toISOString()));
    await page.getByLabel("Thời lượng (phút)").fill("45");
    await page.getByLabel("Điểm đạt", { exact: true }).fill("0.5");
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByLabel("Loại truy cập", { exact: true }).selectOption(access);
    if (access === "CLASS") await page.getByLabel("Lớp được giao", { exact: true }).check();
    if (participant) {
      await page.getByLabel("Email chính xác của người tham gia").fill(participant.email);
      await page.getByRole("button", { name: "Tìm và thêm" }).click();
      await expect(page.getByRole("button", { name: "Bỏ Người tham gia thử" })).toBeVisible();
    }
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByLabel("Trộn thứ tự câu hỏi").check();
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await expect(page.getByLabel("Hiển thị kết quả")).toHaveValue("SUMMARY");
    await expect(page.getByLabel("Thời điểm công bố")).toHaveValue("AFTER_SESSION_END");
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await expect(page).toHaveURL(/\/creator\/sessions\/[^/]+$/);
    await expect(page.getByText("Bản nháp", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Lên lịch", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByText("Đã lên lịch", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(/Giờ kết thúc mới/)
      .fill(localDate(new Date(Date.now() + 10800000).toISOString()));
    await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Hủy kỳ thi", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Hủy kỳ thi", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Hủy kỳ thi", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gia hạn", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/session/${access.toLowerCase()}-detail.png`,
      fullPage: true,
    });
  });
}

test("open immediately, rename only, offline feedback and stale editor reconciliation", async ({
  page,
  request,
  context,
}) => {
  const owner = await account(request),
    { version } = await seed(request, owner.headers);
  const response = await request.post(`${api}/exam-sessions`, {
    headers: owner.headers,
    data: {
      title: "Kỳ thi trực tiếp",
      examVersionId: version.id,
      startTime: new Date(Date.now() - 60000).toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      durationMinutes: 30,
      maxAttempts: 1,
      passingScore: "0",
      accessType: "PUBLIC",
      classroomIds: [],
      participantIds: [],
      shuffleQuestions: false,
      shuffleAnswers: false,
    },
  });
  expect(response.status()).toBe(201);
  const s: SessionDetail = await response.json();
  await login(page, owner.email, `/creator/sessions/${s.id}/edit`);
  await page.getByLabel("Tên kỳ thi", { exact: true }).fill("Tên đang nhập");
  expect(
    (
      await request.post(`${api}/exam-sessions/${s.id}/schedule`, {
        headers: owner.headers,
        data: { revision: s.revision },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "6. Kiểm tra", exact: true }).click();
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toContainText("Kỳ thi đã thay đổi");
  await page.getByRole("button", { name: "1. Chọn đề", exact: true }).click();
  await expect(page.getByLabel("Tên kỳ thi", { exact: true })).toHaveValue("Tên đang nhập");
  await page.getByRole("button", { name: "Tải bản máy chủ để đối chiếu" }).click();
  await page.getByRole("button", { name: "Dùng bản máy chủ" }).click();
  await expect(page.getByText("Cấu hình đã khóa. Bạn chỉ có thể sửa tên kỳ thi.")).toBeVisible();
  await expect(page.getByLabel("Giờ bắt đầu", { exact: true })).toHaveCount(0);
  await page.getByLabel("Tên kỳ thi", { exact: true }).fill("Đổi tên đang mở");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toBeVisible();
  await expect(page.getByLabel("Tên kỳ thi", { exact: true })).toHaveValue("Đổi tên đang mở");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/creator/sessions/${s.id}$`));
  await expect(page.getByText("Đang mở", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hủy kỳ thi", exact: true })).toHaveCount(0);
  const latest: SessionDetail = await (
    await request.get(`${api}/exam-sessions/${s.id}`, { headers: owner.headers })
  ).json();
  expect(
    (
      await request.put(`${api}/exam-sessions/${s.id}`, {
        headers: owner.headers,
        data: { ...payload(latest), resultDisplayMode: "DETAILED" },
      })
    ).status(),
  ).toBe(409);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768, 1024, 1440, 640]) {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
