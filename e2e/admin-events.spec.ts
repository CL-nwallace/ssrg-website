import path from "node:path";
import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Create event", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("create draft event — hidden from public /events", async ({ page, context }) => {
    const uniqueTitle = `Draft Test ${Date.now()}`;
    await signInAsAdmin(context, ADMIN_EMAIL);

    await page.goto("/admin/events/new");
    await page.getByLabel(/title/i).fill(uniqueTitle);
    await page.getByLabel(/date/i).fill("2030-06-15T09:00");
    await page.getByLabel(/price/i).fill("500.00");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Short description.");
    await page.getByLabel(/cover image/i).setInputFiles(
      path.join(__dirname, "fixtures", "sample.jpg"),
    );
    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL("**/admin/events");

    await page.goto("/events");
    await expect(page.getByText(uniqueTitle)).toHaveCount(0);

    const admin = serviceClient();
    await admin.from("events").delete().ilike("title", uniqueTitle);
  });
});

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
