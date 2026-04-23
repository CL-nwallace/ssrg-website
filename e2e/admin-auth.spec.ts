import { test, expect } from "@playwright/test";
import { signInAsNonAdmin, serviceClient } from "./helpers/admin-session";

test.describe("Admin auth", () => {
  test("unauthenticated /admin redirects to /admin/login", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(page.url()).toContain("/admin/login");
    expect(response?.status()).toBeLessThan(500);
  });

  test("login page renders email input", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("submitting a valid email shows the check-your-email message", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("nickwallibe@gmail.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test("non-admin email is redirected to login with error", async ({ page, context }) => {
    // Ensure the non-admin email is NOT in admin_emails.
    const admin = serviceClient();
    await admin.from("admin_emails").delete().eq("email", "notadmin@example.com");
    await signInAsNonAdmin(context, "notadmin@example.com");
    await page.goto("/admin");
    expect(page.url()).toContain("/admin/login");
    expect(page.url()).toContain("error=not_authorized");
  });
});
