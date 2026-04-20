import { test, expect } from "@playwright/test";

test.describe("Media Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/media");
  });

  test("page loads with Media heading", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("h1")).toContainText("Media");
  });

  test("media page has no video background", async ({ page }) => {
    const video = page.locator("video");
    await expect(video).toHaveCount(0);
  });

  test("all 4 media categories render", async ({ page }) => {
    const mediaGrid = page.locator('[data-testid="media-grid"]');
    await mediaGrid.scrollIntoViewIfNeeded();

    const titles = ["Drives / Rallies", "Track Events", "Private Parties", "Coffee Runs"];
    for (const title of titles) {
      const heading = mediaGrid.locator("h3", { hasText: title });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible({ timeout: 3000 });
    }
  });

  test("media categories have images", async ({ page }) => {
    const images = page.locator('[data-testid="media-grid"] img');
    await expect(images).toHaveCount(4);
  });
});
