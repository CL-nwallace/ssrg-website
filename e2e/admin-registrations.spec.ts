import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin registrations view", () => {
  let eventId: string;

  test.beforeAll(async () => {
    await serviceClient().from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `AdminRegs ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      price_cents: 59900,
    });
    await serviceClient()
      .from("registrations")
      .insert([
        {
          event_id: eventId,
          status: "paid",
          first_name: "Ada",
          last_name: "Driver",
          email: "ada@example.com",
          phone: "555-0100",
          shirt_size: "LRG",
          car_make: "Porsche",
          car_model: "918",
          has_passenger: true,
          passenger_first_name: "Pat",
          passenger_last_name: "Rider",
          passenger_shirt_size: "MED",
          answers: {
            instagram: "@ada",
            facebook: null,
            passenger_social: "@pat",
            meals: { thursday_lunch: { driver: "Pork Taco", passenger: "Caesar Salad" } },
            addons: { thursday_dinner: 2 },
          },
          waiver_accepted_at: new Date().toISOString(),
          amount_paid_cents: 99700,
          stripe_session_id: `cs_test_adminregs_${Date.now()}`,
        },
        {
          event_id: eventId,
          status: "pending",
          first_name: "Bob",
          last_name: "Pending",
          email: "bob@example.com",
          shirt_size: "XL",
          car_make: "Ferrari",
          car_model: "F8",
          has_passenger: false,
          answers: {},
          waiver_accepted_at: new Date().toISOString(),
        },
      ]);
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("shows paid rows with summary counts; hides pending", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto(`/admin/events/${eventId}/registrations`);

    await expect(page.getByText("ada@example.com")).toBeVisible();
    await expect(page.getByText("bob@example.com")).toHaveCount(0);

    const summary = page.getByTestId("registration-summary");
    await expect(summary).toContainText("1 cars");
    await expect(summary).toContainText("$997.00");
    await expect(summary).toContainText("LRG: 1");
    await expect(summary).toContainText("MED: 1");
    await expect(summary).toContainText("Pork Taco: 1");
    await expect(summary).toContainText("Caesar Salad: 1");
    await expect(summary).toContainText("thursday_dinner: 2");
  });

  test("CSV export contains paid rows only", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    const res = await page.request.get(
      `/admin/events/${eventId}/registrations/export`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const csv = await res.text();
    expect(csv.split("\n")[0]).toContain("Shirt size");
    expect(csv).toContain("ada@example.com");
    expect(csv).toContain("thursday_dinner x2");
    expect(csv).not.toContain("bob@example.com");
  });

  test("CSV neutralizes spreadsheet formula injection in free-text fields", async ({
    page,
    context,
  }) => {
    await serviceClient()
      .from("registrations")
      .insert({
        event_id: eventId,
        status: "paid",
        first_name: "=HYPERLINK(\"http://evil\")",
        last_name: "Exploit",
        email: "exploit@example.com",
        shirt_size: "MED",
        car_make: "McLaren",
        car_model: "720S",
        has_passenger: false,
        answers: {},
        waiver_accepted_at: new Date().toISOString(),
        amount_paid_cents: 59900,
        stripe_session_id: `cs_test_inject_${Date.now()}`,
      });

    await signInAsAdmin(context, ADMIN_EMAIL);
    const res = await page.request.get(
      `/admin/events/${eventId}/registrations/export`,
    );
    expect(res.status()).toBe(200);
    const csv = await res.text();
    // The cell starts with =, so it is quote-prefixed and (because it now
    // contains a ") wrapped in quotes: "'=HYPERLINK(""http://evil"")"
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain(",=HYPERLINK");
  });

  test("events list links to registrations", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/events");
    await expect(
      page.locator(`a[href="/admin/events/${eventId}/registrations"]`),
    ).toBeVisible();
  });
});
