import { test, expect } from "@playwright/test";
import path from "node:path";
import { serviceClient, ensureAuthUser } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";
const ADMIN_PASSWORD = "Test-Admin-Password-1!";

// A single run exercises the full admin workflow a real admin does on day one:
// password sign-in through the UI, create a draft event, confirm it's hidden,
// publish, confirm it's live, upload media, delete, verify audit entries, sign out.
// Individual per-feature specs cover narrower cases; this one catches integration
// regressions that only surface when features interact through a single session.

test.describe.configure({ mode: "serial" });

test.describe("Admin full journey", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
    await ensureAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("sign in, create+publish+edit+delete event, upload media, verify audit, sign out", async ({ page }) => {
    const eventTitle = `Journey Test ${Date.now()}`;
    const editedTitle = `${eventTitle} (edited)`;

    // --- 1. Sign in via the password form ------------------------------------
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin");
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();

    // --- 2. Create a draft event --------------------------------------------
    await page.getByRole("link", { name: /events/i }).click();
    await page.waitForURL("**/admin/events");
    await page.getByRole("link", { name: /new event/i }).click();
    await page.waitForURL("**/admin/events/new");

    await page.getByLabel(/title/i).fill(eventTitle);
    await page.getByLabel(/date/i).fill("2030-09-20T09:00");
    await page.getByLabel(/price/i).fill("250.00");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Journey event description.");
    await page
      .getByLabel(/cover image/i)
      .setInputFiles(path.join(__dirname, "fixtures", "sample.jpg"));
    // Status defaults to draft.
    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL("**/admin/events");

    // --- 3. Draft must NOT appear on public /events -------------------------
    await page.goto("/events");
    await expect(page.getByText(eventTitle)).toHaveCount(0);

    // --- 4. Edit: publish + rename ------------------------------------------
    await page.goto("/admin/events");
    const row = page.locator("tr", { hasText: eventTitle });
    await row.getByRole("link", { name: /edit/i }).click();
    await page.getByLabel(/title/i).fill(editedTitle);
    await page.getByLabel(/status/i).selectOption("published");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForURL("**/admin/events");

    // --- 5. Published+renamed event appears on public /events ---------------
    await page.goto("/events");
    await expect(page.getByText(editedTitle)).toBeVisible();
    await expect(page.getByText(eventTitle).and(page.getByText(/edited/i))).toBeVisible();

    // --- 6. Upload media to Track Events -------------------------------------
    await page.goto("/admin/media");
    const trackSection = page.locator("section", { hasText: /track events/i });
    const before = await trackSection.locator("img").count();
    await trackSection
      .locator("input[type=file]")
      .setInputFiles(path.join(__dirname, "fixtures", "sample.jpg"));
    await trackSection.getByRole("button", { name: /upload/i }).click();
    await page.waitForURL("**/admin/media");
    const after = await page.locator("section", { hasText: /track events/i }).locator("img").count();
    expect(after).toBeGreaterThan(before);

    // --- 7. Delete the event -------------------------------------------------
    await page.goto("/admin/events");
    const editedRow = page.locator("tr", { hasText: editedTitle });
    // Capture the event id from the Edit link so we can look up audit rows later.
    const editHref = await editedRow.getByRole("link", { name: /edit/i }).getAttribute("href");
    const eventId = editHref?.split("/").pop();
    expect(eventId).toBeTruthy();
    await editedRow.getByRole("button", { name: /delete/i }).click();
    await page.waitForURL("**/admin/events");

    // --- 8. Event gone from public /events ----------------------------------
    await page.goto("/events");
    await expect(page.getByText(editedTitle)).toHaveCount(0);

    // --- 9. Audit log shows create, update, delete for the event ------------
    const admin = serviceClient();
    const { data: eventAudit } = await admin
      .from("admin_audit_log")
      .select("action, snapshot")
      .eq("entity_id", eventId!)
      .order("seq", { ascending: true });
    const actions = (eventAudit ?? []).map((r: { action: string }) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["create", "update", "delete"]));
    // Delete row must carry a snapshot so we can reconstruct what was removed.
    const deleteRow = eventAudit?.find((r: { action: string }) => r.action === "delete");
    expect(deleteRow?.snapshot).toMatchObject({ title: editedTitle });

    // --- 10. Sign out --------------------------------------------------------
    await page.goto("/admin");
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL("**/admin/login");

    // --- 11. /admin gate still works after sign out -------------------------
    await page.goto("/admin");
    expect(page.url()).toContain("/admin/login");

    // --- Cleanup: remove the media row this test uploaded -------------------
    const { data: recent } = await admin
      .from("media")
      .select("id, storage_path")
      .eq("category", "track")
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent[0]) {
      await admin.storage.from("media").remove([recent[0].storage_path]);
      await admin.from("media").delete().eq("id", recent[0].id);
    }
  });
});
