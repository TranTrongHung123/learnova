import { expect, test } from "@playwright/test";

test("entry points lead to real authentication and preview is removed", async ({
  page,
  request,
}) => {
  expect((await request.get("/dev/workspace-preview?roles=all")).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Xem trước giao diện" })).toHaveCount(0);
  await page.getByRole("link", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator("#email")).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("#password")).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`public pages fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of ["/", "/login", "/register"]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (width === 375 || width === 1440) {
        await page.screenshot({
          path: testInfo.outputPath(`${route === "/" ? "home" : route.slice(1)}-${width}.png`),
          fullPage: true,
        });
      }
    }
  });
}
