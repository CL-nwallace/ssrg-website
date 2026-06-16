import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin registration settings", () => {
  let eventId: string;

  test.beforeAll(async () => {
    await serviceClient().from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `RegSettings ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      price_cents: 59900,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("edit form pre-fills the template and saves changes", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto(`/admin/events/${eventId}`);

    // Pre-filled from the Monterey template (event has null config).
    await expect(page.getByLabel(/waiver text/i)).toHaveValue(/PLACEHOLDER WAIVER/);
    await expect(page.getByLabel(/shirt sizes/i)).toHaveValue("XS, SML, MED, LRG, XL, XXL, 3XL");

    await page.getByLabel(/registration deadline/i).fill("2030-08-13T23:59");
    await page.getByLabel(/waiver text/i).fill("Updated waiver text for spec.");
    await page.getByLabel(/per-person cost/i).first().fill("250.00");
    await page.getByLabel(/dietary options/i).fill("Vegan, Halal");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForURL("**/admin/events");

    const { data } = await serviceClient()
      .from("events")
      .select("registration_deadline, registration_config")
      .eq("id", eventId)
      .single();
    expect(data!.registration_deadline).toContain("2030-08-1");
    expect(data!.registration_config.waiver_text).toBe("Updated waiver text for spec.");
    expect(data!.registration_config.addons[0].price_cents).toBe(25000);
    expect(data!.registration_config.shirt_sizes).toEqual([
      "XS", "SML", "MED", "LRG", "XL", "XXL", "3XL",
    ]);
    expect(data!.registration_config.dietary_options).toEqual(["Vegan", "Halal"]);
  });

  test("rejects invalid settings (empty shirt sizes)", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto(`/admin/events/${eventId}`);
    await page.getByLabel(/shirt sizes/i).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/registration settings are invalid/i)).toBeVisible();
  });
});
