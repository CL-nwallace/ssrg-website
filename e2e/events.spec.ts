import { test, expect } from "@playwright/test";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";

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
    const title = `Events Card ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const eventId = await seedTestEvent({ title, price_cents: 59900 });
    try {
      await page.goto("/events");
      const eventsGrid = page.locator('[data-testid="events-grid"]');
      await expect(eventsGrid).toBeVisible();
      await expect(page.getByText(title)).toBeVisible();
      await expect(page.getByText("$599.00").first()).toBeVisible();
      await expect(page.locator(`[data-testid="register-link-${eventId}"]`)).toBeVisible();
    } finally {
      await deleteTestEvent(eventId);
    }
  });

  test("event card has an image", async ({ page }) => {
    const eventImage = page.locator('[data-testid="events-grid"] img');
    await expect(eventImage.first()).toBeVisible();
  });
});

test.describe("Events success page", () => {
  test("renders confirmation copy and reference id", async ({ page }) => {
    await page.goto("/events/success?session_id=cs_test_example_123");
    await expect(page.locator("h1")).toContainText("Thanks for registering");
    await expect(page.locator("text=cs_test_example_123")).toBeVisible();
    await expect(page.locator("a", { hasText: "Back to events" })).toBeVisible();
  });

  test("renders even with no session_id query param", async ({ page }) => {
    await page.goto("/events/success");
    await expect(page.locator("h1")).toContainText("Thanks for registering");
  });
});
