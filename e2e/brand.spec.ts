import { test, expect } from "@playwright/test";

test.describe("Brand guide page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/brand");
  });

  test("loads with the brand guide heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("SSRG Brand Guide");
  });

  test("renders all seven section headings", async ({ page }) => {
    for (const name of [
      /^Logo$/,
      /^Color$/,
      /^Typography$/,
      /Voice/,
      /Components/,
      /Merch/,
      /Favicon/,
    ]) {
      await expect(
        page.getByRole("heading", { name }).first(),
      ).toBeVisible();
    }
  });

  test("is unlisted from search engines (noindex)", async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("display heading renders in the brand serif (Cormorant via next/font)", async ({
    page,
  }) => {
    const family = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.toLowerCase()).toContain("cormorant");
  });

  test("is not linked from the navbar", async ({ page }) => {
    await expect(page.locator('nav a[href="/brand"]')).toHaveCount(0);
  });

  test("favicon icon is wired and resolves", async ({ page, request }) => {
    expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0);
    const res = await request.get("/icon.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});
