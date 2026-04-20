import { test, expect } from "@playwright/test";

test.describe("Contact Form", () => {
  test("contact form has all required fields", async ({ page }) => {
    await page.goto("/");
    const form = page.locator('[data-testid="contact-form"]');
    await form.scrollIntoViewIfNeeded();
    await expect(form.locator('input[name="firstName"]')).toBeVisible({ timeout: 5000 });
    await expect(form.locator('input[name="lastName"]')).toBeVisible();
    await expect(form.locator('input[name="email"]')).toBeVisible();
    await expect(form.locator('textarea[name="message"]')).toBeVisible();
  });

  test("contact form submits successfully", async ({ page }) => {
    await page.goto("/");
    const form = page.locator('[data-testid="contact-form"]');
    await form.scrollIntoViewIfNeeded();

    await form.locator('input[name="firstName"]').fill("John");
    await form.locator('input[name="email"]').fill("john@example.com");
    await form.locator('textarea[name="message"]').fill("I love exotic cars!");
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText("Message Sent")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Sponsor Form", () => {
  test("sponsor form has all required fields", async ({ page }) => {
    await page.goto("/");
    const form = page.locator('[data-testid="sponsor-form"]');
    await form.scrollIntoViewIfNeeded();
    await expect(form.locator('input[name="company"]')).toBeVisible({ timeout: 5000 });
    await expect(form.locator('input[name="firstName"]')).toBeVisible();
    await expect(form.locator('input[name="lastName"]')).toBeVisible();
    await expect(form.locator('input[name="position"]')).toBeVisible();
    await expect(form.locator('input[name="email"]')).toBeVisible();
    await expect(form.locator('input[name="phone"]')).toBeVisible();
    await expect(form.locator('textarea[name="goals"]')).toBeVisible();
  });

  test("sponsor form submits successfully", async ({ page }) => {
    await page.goto("/");
    const form = page.locator('[data-testid="sponsor-form"]');
    await form.scrollIntoViewIfNeeded();

    await form.locator('input[name="company"]').fill("Auto Co");
    await form.locator('input[name="firstName"]').fill("Jane");
    await form.locator('input[name="lastName"]').fill("Smith");
    await form.locator('input[name="position"]').fill("CEO");
    await form.locator('input[name="email"]').fill("jane@auto.co");
    await form.locator('input[name="phone"]').fill("555-0123");
    await form.locator('textarea[name="goals"]').fill("Brand exposure");
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText("Application Received")).toBeVisible({ timeout: 10000 });
  });
});
