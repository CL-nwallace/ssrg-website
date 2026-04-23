import { test, expect } from "@playwright/test";

test.describe("Events Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/events");
  });

  test("page loads with Upcoming Events heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Upcoming Events");
  });

  test("events page has no video background", async ({ page }) => {
    const video = page.locator("video");
    await expect(video).toHaveCount(0);
  });

  test("event cards render with title, price, and CTA", async ({ page }) => {
    const eventsGrid = page.locator('[data-testid="events-grid"]');
    await expect(eventsGrid).toBeVisible();

    await expect(page.locator("text=LA to Las Vegas")).toBeVisible();
    await expect(page.locator("text=$3,000.00")).toBeVisible();
    await expect(page.locator("text=Register Now").first()).toBeVisible();
  });

  test("event card has an image", async ({ page }) => {
    const eventImage = page.locator('[data-testid="events-grid"] img');
    await expect(eventImage.first()).toBeVisible();
  });
});
