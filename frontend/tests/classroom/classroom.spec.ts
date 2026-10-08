import {
  expect,
  test as base,
  type Page,
  type APIRequestContext,
  type Response,
  type Request,
  type Frame,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:8081/api/v1";

const password = "Classroom test password 123";

const phases = new WeakMap<Page, string>();

type AuthDiagnostic = {
  sequence: number;
  tab: number;
  phase: string;
  path: string;
  kind: "request" | "navigation";
  status?: number;
  code?: string;
  outcome?: string;
};

const test = base.extend<{ refreshDiagnostics: void }>({
  refreshDiagnostics: [
    async ({ context }, runTest, testInfo) => {
      const events: AuthDiagnostic[] = [];
      const requests = new Map<Request, AuthDiagnostic>();
      const tabs = new Map<Page, (frame: Frame) => void>();
      const pending: Promise<void>[] = [];
      const authPaths = new Set([`${api}/auth/csrf`, `${api}/auth/login`, `${api}/auth/refresh`]);
      const trackPage = (page: Page) => {
        if (tabs.has(page)) return;
        const tab = tabs.size + 1;
        const onNavigation = (frame: Frame) => {
          if (frame !== page.mainFrame()) return;
          events.push({
            sequence: events.length + 1,
            tab,
            phase: phases.get(page) ?? "scenario",
            path: new URL(frame.url()).pathname,
            kind: "navigation",
          });
        };
        tabs.set(page, onNavigation);
        page.on("framenavigated", onNavigation);
      };
      const onRequest = (request: Request) => {
        if (!authPaths.has(request.url())) return;
        const page = request.frame().page();
        trackPage(page);
        const event: AuthDiagnostic = {
          sequence: events.length + 1,
          tab: [...tabs.keys()].indexOf(page) + 1,
          phase: phases.get(page) ?? "scenario",
          path: new URL(request.url()).pathname,
          kind: "request",
        };
        events.push(event);
        requests.set(request, event);
      };
      const onResponse = (response: Response) => {
        const event = requests.get(response.request());
        if (!event) return;
        event.status = response.status();
        // Chỉ đọc code lỗi; không đọc body thành công chứa access token hoặc ghi header/cookie.
        if (!response.ok())
          pending.push(
            (async () => {
              try {
                const body: unknown = await response.json();
                if (
                  body &&
                  typeof body === "object" &&
                  "code" in body &&
                  typeof body.code === "string" &&
                  /^[A-Z][A-Z0-9_]{0,79}$/.test(body.code)
                )
                  event.code = body.code;
              } catch {
                event.outcome = "error-body-unavailable";
              }
            })(),
          );
      };
      const onFailed = (request: Request) => {
        const event = requests.get(request);
        if (event) event.outcome = "request-failed";
      };
      context.pages().forEach(trackPage);
      context.on("page", trackPage);
      context.on("request", onRequest);
      context.on("response", onResponse);
      context.on("requestfailed", onFailed);
      try {
        await runTest();
      } finally {
        context.off("page", trackPage);
        context.off("request", onRequest);
        context.off("response", onResponse);
        context.off("requestfailed", onFailed);
        for (const [page, listener] of tabs) page.off("framenavigated", listener);
        await Promise.all(pending);
        if (testInfo.status !== testInfo.expectedStatus) {
          const diagnostics = JSON.stringify(events, null, 2);
          console.error(`Refresh diagnostics: ${diagnostics}`);
          await testInfo.attach("refresh-diagnostics", {
            body: diagnostics,
            contentType: "application/json",
          });
        }
      }
    },
    { auto: true },
  ],
});

async function account(request: APIRequestContext, roles = ["PARTICIPANT", "CREATOR"]) {
  const email = `${randomUUID()}@example.com`;
  const csrf = await (await request.get(`${api}/auth/csrf`)).json();
  const headers = { [csrf.headerName]: csrf.token };
  const registered = await request.post(`${api}/auth/register`, {
    headers,
    data: { email, password, displayName: "Người dùng lớp học", roles },
  });
  expect(registered.status()).toBe(201);
  const signed = await request.post(`${api}/auth/login`, { headers, data: { email, password } });
  expect(signed.ok()).toBeTruthy();
  const login = await signed.json();
  return {
    email,
    id: login.user.id as string,
    headers: { Authorization: `Bearer ${login.accessToken}` },
  };
}

async function login(page: Page, email: string, route: string, readyHeading: string) {
  phases.set(page, "login");
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/(participant|creator|workspaces)$/);
  phases.set(page, "login-destination-bootstrap");
  await page.goto(route);
  // goto chỉ chờ document; heading đích xác nhận bootstrap và phân quyền đã hoàn tất.
  await expect(page).toHaveURL(new URL(route, page.url()).href);
  await expect(page.getByRole("heading", { name: readyHeading, exact: true })).toBeVisible();
  phases.set(page, "login-destination-ready");
}

async function create(page: Page, name: string) {
  phases.set(page, "create-classroom");
  await page.goto("/creator/classes/new");
  await page.getByLabel("Tên lớp", { exact: false }).fill(name);
  await page.getByLabel("Mô tả", { exact: true }).fill("Lớp ôn tập dành cho Participant.");
  await page.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/classes\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return page.url().split("/").at(-1)!;
}

async function generate(page: Page) {
  await page.getByRole("button", { name: /^(Tạo mã tham gia|Tạo lại mã)$/ }).click();
  await page.getByRole("button", { name: "Xác nhận tạo mã", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("join-code")).toBeVisible();
  return (await page.getByTestId("join-code").textContent())!;
}

async function preview(page: Page, code: string) {
  phases.set(page, "preview-classroom");
  await page.goto("/participant/classes/join");
  await page.getByLabel("Mã tham gia", { exact: false }).fill(code);
  await page.getByRole("button", { name: "Kiểm tra mã", exact: true }).click();
}

test("Login waits for delayed destination bootstrap before creating a classroom", async ({
  page,
  request,
}) => {
  const user = await account(request);
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let blocked = false;
  let loginCompleted = false;
  await page.route(`${api}/auth/refresh`, async (route) => {
    if (!blocked && new URL(page.url()).pathname === "/creator/classes") {
      blocked = true;
      await refreshGate;
    }
    // Chỉ trì hoãn request; backend thật vẫn cấp cookie/token và kiểm tra rotation.
    await route.continue();
  });
  const scenario = login(page, user.email, "/creator/classes", "Lớp học").then(() => {
    loginCompleted = true;
    return create(page, "Lớp sau bootstrap");
  });
  // Gắn handler ngay để assertion thất bại không để promise của scenario bị bỏ quên.
  void scenario.catch(() => {});
  try {
    await expect.poll(() => blocked).toBe(true);
    await page.waitForLoadState("load");
    await expect(page.getByRole("status")).toContainText("Đang tải nội dung");
    expect(loginCompleted).toBe(false);
    await expect(page).toHaveURL(/\/creator\/classes$/);
    releaseRefresh();
    await scenario;
    await expect(
      page.getByRole("heading", { name: "Lớp sau bootstrap", exact: true }),
    ).toBeVisible();
  } finally {
    releaseRefresh();
    await scenario.catch(() => {});
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("Creator creates, edits, looks up exact email, adds/removes/reactivates membership", async ({
  page,
  request,
}) => {
  const owner = await account(request);
  const participant = await account(request, ["PARTICIPANT"]);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await login(page, owner.email, "/creator/classes", "Lớp học");
  await expect(page.getByText("Chưa có lớp phù hợp")).toBeVisible();
  const classId = await create(page, "Lớp Toán F06");
  await expect(page.getByText("Chưa tạo mã", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa lớp" }).click();
  await page.getByLabel("Tên lớp", { exact: false }).fill("Lớp Toán đã sửa");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("heading", { name: "Lớp Toán đã sửa" })).toBeVisible();
  await page.getByRole("button", { name: "Thành viên", exact: true }).click();
  const addButton = page.getByRole("button", { name: "Thêm Participant", exact: true });
  await addButton.click();
  await page.keyboard.press("Escape");
  await expect(addButton).toBeFocused();
  await addButton.click();
  await page.getByLabel("Email đầy đủ", { exact: false }).fill("unknown@example.com");
  await page.getByRole("button", { name: "Tìm Participant" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Không tìm thấy Participant",
  );
  await page.getByLabel("Email đầy đủ", { exact: false }).fill(participant.email.toUpperCase());
  await page.getByRole("button", { name: "Tìm Participant" }).click();
  await expect(
    page.getByRole("dialog").getByText(participant.email, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thêm vào lớp" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const memberEmail = page
    .getByRole("region", { name: "Danh sách thành viên" })
    .getByRole("paragraph")
    .filter({ hasText: participant.email });
  await expect(memberEmail).toBeVisible();
  await expect(page.getByText("1 thành viên đang tham gia", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Xóa khỏi lớp ${participant.email}` }).click();
  await expect(page.getByRole("dialog")).toContainText("Bài đang làm vẫn được hoàn tất");
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(memberEmail).toHaveCount(0);
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("REMOVED");
  await expect(memberEmail).toBeVisible();
  const added = await request.post(`${api}/classrooms/${classId}/members`, {
    headers: owner.headers,
    data: { userId: participant.id },
  });
  expect(added.ok()).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Thành viên", exact: true }).click();
  await expect(memberEmail).toBeVisible();
  expect(failures).toEqual([]);
});

test("Participant previews, joins, reloads two tabs, leaves and rejoins the same membership", async ({
  page,
  request,
  context,
}) => {
  const user = await account(request);
  await login(page, user.email, "/creator/classes", "Lớp học");
  const classId = await create(page, "Lớp tự ôn tập");
  const code = await generate(page);
  await page.getByLabel("Không gian làm việc", { exact: true }).selectOption("PARTICIPANT");
  await preview(page, code);
  await expect(page.getByRole("heading", { name: "Lớp tự ôn tập" })).toBeVisible();
  await page.getByLabel("Mã tham gia", { exact: false }).fill("INVALID");
  await expect(page.getByRole("button", { name: "Xác nhận tham gia" })).toHaveCount(0);
  await preview(page, code);
  await page.getByRole("button", { name: "Xác nhận tham gia" }).click();
  await expect(page.getByRole("status")).toContainText("Đã tham gia lớp thành công");
  const first = await (
    await request.post(`${api}/classrooms/join`, { headers: user.headers, data: { code } })
  ).json();
  await page.getByRole("link", { name: "Đến lớp học của tôi" }).click();
  await expect(page).toHaveURL(/\/participant\/classes$/);
  await expect(page.getByRole("heading", { name: "Lớp tự ôn tập", exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/participant/classes");
  // Chờ bootstrap xong để phép thử reload hai phiên ổn định không ngắt refresh ban đầu.
  await expect(other).toHaveURL(/\/participant\/classes$/);
  await expect(other.getByRole("heading", { name: "Lớp tự ôn tập", exact: true })).toBeVisible();
  for (const tab of [page, other]) phases.set(tab, "concurrent-reload");
  await Promise.all([page.reload(), other.reload()]);
  for (const tab of [page, other]) {
    await expect(tab).toHaveURL(/\/participant\/classes$/);
    await expect(tab.getByRole("heading", { name: "Lớp tự ôn tập", exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Xem lớp Lớp tự ôn tập" }).click();
  await expect(page.getByRole("dialog")).toContainText("Lớp ôn tập dành cho Participant");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rời lớp Lớp tự ôn tập" }).click();
  await page.getByRole("button", { name: "Xác nhận rời lớp" }).click();
  await expect(page.getByRole("heading", { name: "Bạn chưa tham gia lớp nào" })).toBeVisible();
  await preview(page, code);
  await expect(page.getByText("Bạn từng rời lớp này. Xác nhận để tham gia lại.")).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận tham gia" }).click();
  await expect(page.getByRole("status")).toContainText("Đã tham gia lớp thành công");
  const again = await (
    await request.post(`${api}/classrooms/join`, { headers: user.headers, data: { code } })
  ).json();
  expect(again.id).toBe(first.id);
  expect(again.joinedAt).toBe(first.joinedAt);
  expect(again.classroomId).toBe(classId);
  await other.close();
});

test("Preview cannot authorize a revoked code; regenerate invalidates old code; offline retry is honest", async ({
  page,
  request,
  context,
}) => {
  const user = await account(request);
  await login(page, user.email, "/creator/classes", "Lớp học");
  const classId = await create(page, "Mã có thể thay đổi");
  const oldCode = await generate(page);
  const generated = await (
    await request.post(`${api}/classrooms/${classId}/join-code`, { headers: user.headers })
  ).json();
  await preview(page, oldCode);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Mã không hợp lệ");
  await preview(page, generated.code);
  await expect(page.getByRole("button", { name: "Xác nhận tham gia" })).toBeVisible();
  expect(
    (
      await request.delete(`${api}/classrooms/${classId}/join-code`, { headers: user.headers })
    ).ok(),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Xác nhận tham gia" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Mã không hợp lệ");
  await expect(page.getByText("Đã tham gia lớp thành công.")).toHaveCount(0);
  await page.goto(`/creator/classes/${classId}`);
  await expect(page.getByText("Mã đã thu hồi", { exact: true })).toBeVisible();
  await generate(page);
  await page.getByRole("button", { name: "Thu hồi mã", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận thu hồi" }).click();
  await expect(page.getByText("Mã đã thu hồi", { exact: true })).toBeVisible();
  await page.goto("/creator/classes");
  await expect(page.getByRole("heading", { name: "Mã có thể thay đổi" })).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("Tìm theo tên lớp").fill("Mã");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chưa thể kết nối" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Mã có thể thay đổi" })).toBeVisible();
});

test("Cross-owner and wrong workspace access never reveal classroom data", async ({
  page,
  request,
}) => {
  const owner = await account(request);
  const participant = await account(request, ["PARTICIPANT"]);
  const other = await account(request);
  const created = await (
    await request.post(`${api}/classrooms`, {
      headers: owner.headers,
      data: { name: "Private classroom" },
    })
  ).json();
  await login(page, other.email, `/creator/classes/${created.id}`, "Không tìm thấy trang");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.getByText("Private classroom")).toHaveCount(0);
  const fresh = await page.context().browser()!.newContext({ baseURL: "http://localhost:3104" });
  const p = await fresh.newPage();
  await login(
    p,
    participant.email,
    `/creator/classes/${created.id}`,
    "Bạn không có quyền truy cập",
  );
  await expect(p.getByRole("heading", { name: "Bạn không có quyền truy cập" })).toBeVisible();
  await fresh.close();
});

test("Responsive layouts, keyboard dialogs, reduced motion and long text remain usable", async ({
  page,
  request,
}, testInfo) => {
  const user = await account(request);
  await login(page, user.email, "/creator/classes/new", "Tạo lớp học");
  await page.getByLabel("Tên lớp", { exact: false }).fill(" ");
  await page.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await expect(page.getByLabel("Tên lớp", { exact: false })).toBeFocused();
  await expect(page.getByLabel("Tên lớp", { exact: false })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  const classId = await create(page, "Lớp học với tên dài " + "A".repeat(130));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [375, 900],
    [768, 900],
    [1024, 900],
    [1440, 900],
    [640, 450],
  ]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`classroom-${width}.png`), fullPage: true });
  }
  const trigger = page.getByRole("button", { name: "Tạo mã tham gia", exact: true });
  await trigger.click();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.querySelector("dialog[open]")?.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.goto(`/creator/classes/${classId}`);
  const code = await generate(page);
  await preview(page, code);
  await page.getByRole("button", { name: "Xác nhận tham gia" }).click();
  await expect(page.getByRole("status")).toContainText("Đã tham gia lớp thành công");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: testInfo.outputPath("join-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
