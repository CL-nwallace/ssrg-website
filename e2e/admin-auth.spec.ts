import { test, expect } from "@playwright/test";
import { signInAsAdmin, signInAsNonAdmin, serviceClient, ensureAuthUser } from "./helpers/admin-session";

test.describe("Admin auth", () => {
  test("unauthenticated /admin redirects to /admin/login", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(page.url()).toContain("/admin/login");
    expect(response?.status()).toBeLessThan(500);
  });

  test("login page renders email and password inputs", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("submitting valid admin email+password signs in and lands on /admin", async ({ page }) => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: "nickwallibe@gmail.com" });
    await ensureAuthUser("nickwallibe@gmail.com", "Test-Admin-Password-1!");

    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("nickwallibe@gmail.com");
    await page.getByLabel(/password/i).fill("Test-Admin-Password-1!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin");
    await expect(page.getByText("nickwallibe@gmail.com")).toBeVisible();
  });

  test("wrong password surfaces an error", async ({ page }) => {
    await ensureAuthUser("nickwallibe@gmail.com", "Test-Admin-Password-1!");
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("nickwallibe@gmail.com");
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });

  test("non-admin email is rejected with admin-list error", async ({ page }) => {
    const admin = serviceClient();
    await admin.from("admin_emails").delete().eq("email", "notadmin@example.com");
    await ensureAuthUser("notadmin@example.com", "Test-NonAdmin-Password-1!");

    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("notadmin@example.com");
    await page.getByLabel(/password/i).fill("Test-NonAdmin-Password-1!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/not on the admin list/i)).toBeVisible();
  });

  test("non-admin session at /admin redirects to login with not_authorized", async ({ page, context }) => {
    // Covers the middleware path: a valid Supabase session whose email isn't in admin_emails.
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
