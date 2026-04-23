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

test("editing an event's title reflects on public /events", async ({ page, context }) => {
  const admin = serviceClient();
  const baseTitle = `Edit Test ${Date.now()}`;
  const { data: ev } = await admin
    .from("events")
    .insert({
      title: baseTitle,
      event_date: "2030-07-01T09:00:00Z",
      price_cents: 12345,
      status: "published",
    })
    .select("id")
    .single();

  await signInAsAdmin(context, ADMIN_EMAIL);
  await page.goto(`/admin/events/${ev!.id}`);
  const newTitle = `${baseTitle} EDITED`;
  await page.getByLabel(/title/i).fill(newTitle);
  await page.getByRole("button", { name: /save/i }).click();
  await page.waitForURL("**/admin/events");

  await page.goto("/events");
  await expect(page.getByText(newTitle)).toBeVisible();

  await admin.from("events").delete().eq("id", ev!.id);
});

test("deleting an event removes it from /events and logs a delete in audit", async ({ page, context }) => {
  const admin = serviceClient();
  const title = `Delete Test ${Date.now()}`;
  const { data: ev } = await admin
    .from("events")
    .insert({
      title,
      event_date: "2030-08-01T09:00:00Z",
      price_cents: 6789,
      status: "published",
    })
    .select("id")
    .single();

  await signInAsAdmin(context, ADMIN_EMAIL);
  await page.goto("/admin/events");
  const row = page.locator("tr", { hasText: title });
  await row.getByRole("button", { name: /delete/i }).click();
  await page.waitForURL("**/admin/events");

  await page.goto("/events");
  await expect(page.getByText(title)).toHaveCount(0);

  const { data: auditRows } = await admin
    .from("admin_audit_log")
    .select("*")
    .eq("entity_id", ev!.id)
    .eq("action", "delete");
  expect(auditRows?.length ?? 0).toBeGreaterThan(0);
  expect(auditRows![0].snapshot).toMatchObject({ title });
});
