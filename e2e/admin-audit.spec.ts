import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Audit log", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("audit page lists recent entries newest-first", async ({ page, context }) => {
    const admin = serviceClient();
    await admin.from("admin_audit_log").insert([
      {
        admin_email: ADMIN_EMAIL,
        action: "create",
        entity_type: "event",
        entity_id: "11111111-1111-1111-1111-111111111111",
        snapshot: { title: "Audit Test A" },
      },
      {
        admin_email: ADMIN_EMAIL,
        action: "update",
        entity_type: "event",
        entity_id: "11111111-1111-1111-1111-111111111111",
        snapshot: { title: "Audit Test A (edited)" },
      },
    ]);

    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/audit");

    const rows = page.locator('[data-testid="audit-row"]');
    await expect(rows.first()).toContainText(/update/i);
    await expect(rows.nth(1)).toContainText(/create/i);
  });
});
