import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { workbook } from "../import/workbook";

const api = "http://localhost:8081/api/v1";
const password = "Acceptance password 123";

async function json(response: APIResponse, status = 200) {
  // Chỉ ghi status khi lỗi; response đăng nhập có token.
  expect(response.status()).toBe(status);
  return response.json();
}

async function account(request: APIRequestContext, role: string) {
  const email = `${randomUUID()}@example.com`;
  const csrf = await json(await request.get(`${api}/auth/csrf`));
  const headers = { [csrf.headerName]: csrf.token };
  await json(
    await request.post(`${api}/auth/register`, {
      headers,
      data: { email, password, displayName: role, roles: [role] },
    }),
    201,
  );
  const login = await json(
    await request.post(`${api}/auth/login`, {
      headers,
      data: { email, password },
    }),
  );
  return { email, headers: { Authorization: `Bearer ${login.accessToken}` } };
}

test("CLASS lifecycle: join, import, publish, autosave, submit, release and export", async ({
  page,
  request,
}) => {
  const owner = await account(request, "CREATOR");
  const participant = await account(request, "PARTICIPANT");
  const headers = owner.headers;
  const classroom = await json(
    await request.post(`${api}/classrooms`, {
      headers,
      data: { name: "Lớp nghiệm thu V1" },
    }),
    201,
  );
  const code = await json(
    await request.post(`${api}/classrooms/${classroom.id}/join-code`, { headers }),
  );
  await json(
    await request.post(`${api}/classrooms/join-preview`, {
      headers: participant.headers,
      data: { code: code.code },
    }),
  );
  await json(
    await request.post(`${api}/classrooms/join`, {
      headers: participant.headers,
      data: { code: code.code },
    }),
  );
  const preview = await json(
    await request.post(`${api}/question-imports`, {
      headers,
      multipart: {
        file: {
          name: "acceptance.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: workbook([
            {
              type: "TRUE_FALSE",
              content: "Câu hỏi nghiệm thu",
              correctBoolean: "TRUE",
              explanation: "Giải thích chỉ công bố sau release",
            },
          ]),
        },
      },
    }),
    201,
  );
  expect(preview.validRows).toBe(1);
  expect((await json(await request.get(`${api}/questions`, { headers }))).totalElements).toBe(
    0,
  );
  const confirmed = await json(
    await request.post(`${api}/question-imports/${preview.importId}/confirm`, {
      headers,
      data: { validRowsOnly: false },
    }),
  );
  expect(confirmed.importedRows).toBe(1);
  const listed = await json(await request.get(`${api}/questions`, { headers }));
  const question = await json(
    await request.put(`${api}/questions/${listed.content[0].id}`, {
      headers,
      data: {
        type: "TRUE_FALSE",
        status: "ACTIVE",
        content: "Câu hỏi nghiệm thu",
        correctBoolean: true,
        explanation: "Giải thích chỉ công bố sau release",
        options: [],
        revision: listed.content[0].revision,
      },
    }),
  );
  const exam = await json(
    await request.post(`${api}/exams`, { headers, data: { name: "Đề nghiệm thu V1" } }),
    201,
  );
  const version = await json(
    await request.post(`${api}/exam-versions/${exam.versions[0].id}/questions`, {
      headers,
      data: {
        revision: 0,
        questions: [{ questionId: question.id, revision: question.revision }],
      },
    }),
  );
  await json(
    await request.post(`${api}/exam-versions/${version.id}/publish`, {
      headers,
      data: { revision: version.revision },
    }),
  );
  const session = await json(
    await request.post(`${api}/exam-sessions`, {
      headers,
      data: {
        title: "Kỳ thi nghiệm thu V1",
        examVersionId: version.id,
        startTime: new Date(Date.now() - 60000).toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        durationMinutes: 30,
        maxAttempts: 1,
        passingScore: "1",
        accessType: "CLASS",
        classroomIds: [classroom.id],
        participantIds: [],
        shuffleQuestions: true,
        shuffleAnswers: true,
        resultDisplayMode: "DETAILED",
        resultReleasePolicy: "MANUAL",
      },
    }),
    201,
  );
  await json(
    await request.post(`${api}/exam-sessions/${session.id}/schedule`, {
      headers,
      data: { revision: session.revision },
    }),
  );

  await page.goto("/login");
  await page.locator("#email").fill(participant.email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/participant$/);
  await page.goto(`/participant/exams/${session.id}`);
  await page.getByRole("button", { name: "Bắt đầu làm bài", exact: true }).click();
  await page.getByRole("button", { name: "Bắt đầu ngay", exact: true }).click();
  await expect(page).toHaveURL(/\/participant\/attempts\//);
  await page.getByRole("radio", { name: "Đúng", exact: true }).check();
  await expect(page.getByRole("status")).toHaveText("Tất cả thay đổi đã được lưu");
  const attemptId = page.url().split("/").at(-1);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Đúng", exact: true })).toBeChecked();
  const active = await json(
    await request.get(`${api}/attempts/${attemptId}`, { headers: participant.headers }),
  );
  expect(JSON.stringify(active)).not.toContain("correctBoolean");
  expect(JSON.stringify(active)).not.toContain("Giải thích chỉ công bố");
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận nộp bài", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã nộp bài", exact: true })).toBeVisible();
  const hidden = await json(
    await request.get(`${api}/participant/results/${attemptId}`, {
      headers: participant.headers,
    }),
  );
  expect(hidden.result).toBeUndefined();
  expect(hidden.questions).toBeUndefined();
  await json(
    await request.post(`${api}/exam-sessions/${session.id}/release-results`, { headers }),
  );
  await page.goto(`/participant/results/${attemptId}`);
  await expect(
    page.getByText("Giải thích chỉ công bố sau release", { exact: true }),
  ).toBeVisible();
  const result = await json(
    await request.get(`${api}/participant/results/${attemptId}`, {
      headers: participant.headers,
    }),
  );
  expect(Number(result.result.score)).toBe(1);
  expect(result.result.passed).toBe(true);
  const analytics = await json(
    await request.get(`${api}/exam-sessions/${session.id}/analytics`, { headers }),
  );
  expect(analytics.overview.gradedParticipantCount).toBe(1);
  expect(Number(analytics.overview.averageScore)).toBe(1);
  const exported = await request.get(`${api}/exam-sessions/${session.id}/export`, { headers });
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toContain("spreadsheetml");
  expect((await exported.body()).subarray(0, 2).toString()).toBe("PK");
});
