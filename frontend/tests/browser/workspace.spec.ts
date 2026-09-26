import { expect, test } from "@playwright/test";
test("multi-role switch, user menu và logout chỉ trong preview", async ({
  page,
}) => {
  await page.goto("/dev/workspace-preview");
  await page
    .getByLabel("Không gian làm việc", { exact: true })
    .selectOption("PARTICIPANT");
  await expect(page).toHaveURL(/workspace=PARTICIPANT/);
  await page.getByRole("button", { name: /Menu người dùng/ }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Menu người dùng/ }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Menu người dùng/ }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đã thoát phiên minh họa" }),
  ).toBeVisible();
});
test("ADMIN chỉ có workspace ADMIN; URL thiếu role không cấp quyền", async ({
  page,
}) => {
  await page.goto("/dev/workspace-preview?roles=admin&workspace=ADMIN");
  await expect(
    page.getByLabel("Không gian làm việc", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng Quản trị viên" })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto("/dev/workspace-preview?roles=admin&workspace=CREATOR");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền truy cập" }),
  ).toBeVisible();
});
for (const width of [375, 768, 1024, 1440]) {
  test(`responsive ${width}px, không tràn ngang`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/workspace-preview");
    await expect(
      page.getByRole("heading", { name: "Không gian của bạn" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`workspace-${width}.png`),
      fullPage: true,
    });
    if (width < 1024) {
      const trigger = page.getByRole("button", { name: "Mở điều hướng" });
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() =>
          document.querySelector("dialog")?.contains(document.activeElement),
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Tổng quan" })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  });
}
test("validation gắn lỗi với input, route thật không dùng fixture", async ({
  page,
}) => {
  await page.goto("/dev/workspace-preview?state=validation");
  await page.getByRole("button", { name: "Kiểm tra thông tin" }).click();
  await expect(page.getByRole("textbox")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("textbox")).toBeFocused();
  await expect(page.getByRole("textbox")).toHaveAccessibleDescription(
    /Vui lòng nhập tên/,
  );
  await page.goto("/creator");
  await expect(
    page.getByRole("heading", { name: "Tính năng đang được hoàn thiện" }),
  ).toBeVisible();
  await expect(page.getByText("Tài khoản minh họa")).toHaveCount(0);
});
test("keyboard skip link, reduced motion và màn hình nhỏ tương đương zoom 200%", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto("/dev/workspace-preview");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Chuyển đến nội dung chính" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(
    await page
      .getByRole("button", { name: "Mở điều hướng" })
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
