import { expect, test } from "@playwright/test";
test("production không cung cấp preview hoặc fixture", async ({
  page,
  request,
}) => {
  const response = await request.get("/dev/workspace-preview?roles=all");
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("Tài khoản minh họa");
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Xem trước giao diện" }),
  ).toHaveCount(0);
  for (const route of [
    "/participant",
    "/creator",
    "/admin",
    "/profile",
    "/notifications",
    "/login",
    "/register",
  ]) {
    const result = await page.goto(route);
    expect(result?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Tính năng đang được hoàn thiện" }),
    ).toHaveCount(0);
    await expect(page.getByText("Tài khoản minh họa")).toHaveCount(0);
    if (route === "/login" || route === "/register") {
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();
    }
  }
  expect((await request.get("/unknown-route")).status()).toBe(404);
});
