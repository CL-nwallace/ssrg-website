import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin events list", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("events list shows seeded events with status badges", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/events");

    await expect(page.locator("h2")).toContainText(/events/i);
    await expect(page.getByText("LA to Las Vegas")).toBeVisible();
    await expect(page.getByRole("link", { name: /new event/i })).toBeVisible();
  });
});
