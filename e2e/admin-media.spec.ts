import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin media", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("uploading to a category appears on public /media", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/media");

    // Count current items in Track Events before upload.
    const trackSection = page.locator("section", { hasText: /track events/i });
    await trackSection.scrollIntoViewIfNeeded();
    const before = await trackSection.locator("img").count();

    const trackUpload = trackSection.locator("input[type=file]");
    await trackUpload.setInputFiles(path.join(__dirname, "fixtures", "sample.jpg"));

    // The form auto-submits when we click the Upload button (no auto-submit on change).
    await trackSection.getByRole("button", { name: /upload/i }).click();

    // Wait for redirect back to /admin/media and re-render.
    await page.waitForURL("**/admin/media");
    const after = await page.locator("section", { hasText: /track events/i }).locator("img").count();
    expect(after).toBeGreaterThan(before);

    // Public /media: cover for Track Events should load from Supabase Storage.
    await page.goto("/media");
    const trackCover = page.locator("section", { hasText: "Track Events" }).locator("img").first();
    await expect(trackCover).toHaveAttribute("src", /storage\/v1\/object\/public\/media/);

    // Cleanup: remove the most recent media row.
    const admin = serviceClient();
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
