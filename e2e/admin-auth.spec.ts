import { test, expect } from "@playwright/test";
import { signInAsAdmin, signInAsNonAdmin, serviceClient } from "./helpers/admin-session";

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

  test("submitting a valid email reaches the signInWithOtp action", async ({ page }) => {
    // Supabase applies a project-wide rate limit to OTP emails. In local
    // development we routinely hit it, so the assertion accepts either the
    // success state ("Check your email") or the "email rate limit exceeded"
    // error surfaced from Supabase — both prove the form hit the action and
    // the server handled it. We are not verifying that the email actually
    // sends; manual three-admin verification in Task 18 covers that.
    const testEmail = `playwright-${Date.now()}@example.com`;
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(
      page.getByText(/check your email|email rate limit exceeded/i),
    ).toBeVisible();
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

test.describe("Admin layout", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin
      .from("admin_emails")
      .upsert({ email: "nickwallibe@gmail.com" });
  });

  test("admin can access /admin and sees their email", async ({ page, context }) => {
    await signInAsAdmin(context, "nickwallibe@gmail.com");
    await page.goto("/admin");
    await expect(page.getByText("nickwallibe@gmail.com")).toBeVisible();
    await expect(page.getByRole("link", { name: /events/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /media/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /audit/i })).toBeVisible();
  });

  test("logout returns the admin to /admin/login", async ({ page, context }) => {
    await signInAsAdmin(context, "nickwallibe@gmail.com");
    await page.goto("/admin");
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL("**/admin/login");
  });
});
