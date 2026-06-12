import { test, expect } from "@playwright/test";
import {
  seedTestEvent,
  deleteTestEvent,
  waitForRegistration,
} from "./helpers/registrations";

test.describe("Event registration page", () => {
  let eventId: string;

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `RegPage ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      price_cents: 59900,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("register link on /events leads to the form", async ({ page }) => {
    await page.goto("/events");
    await page.locator(`[data-testid="register-link-${eventId}"]`).click();
    await page.waitForURL(`**/events/${eventId}/register`);
    await expect(page.getByTestId("registration-form")).toBeVisible();
    await expect(page.getByText(/waiver/i).first()).toBeVisible();
  });

  test("full form with passenger and dinner reaches Stripe Checkout", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/events/${eventId}/register`);

    await page.getByLabel("First name *").fill("Test");
    await page.getByLabel("Last name *").fill("Driver");
    await page.getByLabel("Email *").fill("driver@example.com");
    await page.getByLabel("Phone").fill("555-0100");
    await page.getByLabel("T-shirt size *").selectOption("LRG");
    await page.getByLabel("Instagram username").fill("@driver");
    await page.getByLabel("Car make *").selectOption("Porsche");
    await page.getByLabel("Car model *").selectOption("918");

    await page.getByLabel("I have a passenger").check();
    await page.getByLabel("Passenger first name *").fill("Pat");
    await page.getByLabel("Passenger last name *").fill("Rider");
    await page.getByLabel("Passenger t-shirt size *").selectOption("MED");

    await page.getByLabel("Thursday Lunch — your meal *").selectOption("Pork Taco");
    await page.getByLabel("Thursday Lunch — passenger meal *").selectOption("Caesar Salad");
    await page.getByLabel(/thursday dinner/i).selectOption("2");

    // Order summary reflects base + 2 dinners before submitting.
    await expect(page.getByTestId("order-summary")).toContainText("$997.00");

    await page.getByLabel("I have read and accept the waiver *").check();
    await page.getByRole("button", { name: /continue to payment/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });

    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.first_name).toBe("Test");
    expect(row.has_passenger).toBe(true);
    expect(row.answers.addons!.thursday_dinner).toBe(2);
  });

  test("manual model input appears for All models makes", async ({ page }) => {
    await page.goto(`/events/${eventId}/register`);
    await page.getByLabel("Car make *").selectOption("Ferrari");
    await page.getByLabel("Car model *").selectOption("All models");
    await expect(page.getByLabel("Your model *")).toBeVisible();
  });

  test("closed event hides the form and the events-page register link", async ({ page }) => {
    const closedTitle = `Closed ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const closedId = await seedTestEvent({
      title: closedTitle,
      price_cents: 1000,
      registration_deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    await page.goto(`/events/${closedId}/register`);
    await expect(page.getByTestId("registration-closed")).toBeVisible();
    await expect(page.getByTestId("registration-form")).toHaveCount(0);

    await page.goto("/events");
    await expect(page.getByText(closedTitle)).toBeVisible();
    await expect(page.locator(`[data-testid="register-link-${closedId}"]`)).toHaveCount(0);

    await deleteTestEvent(closedId);
  });
});
