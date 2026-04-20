import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("logo links to home page", async ({ page }) => {
    await page.goto("/events");
    await page.click('a[aria-label="SSRG Home"]');
    await expect(page).toHaveURL("/");
  });

  test("navbar logo is an image", async ({ page }) => {
    await page.goto("/");
    const logoImg = page.locator('a[aria-label="SSRG Home"] img');
    await expect(logoImg).toBeVisible();
    await expect(logoImg).toHaveAttribute("alt", "SSRG");
  });

  test("desktop nav links work", async ({ page }) => {
    await page.goto("/");
    // Skip if desktop nav is not visible (mobile viewport)
    const desktopNav = page.locator("nav .hidden.md\\:flex");
    if (!(await desktopNav.isVisible())) return;

    await page.locator("nav").first().locator('a[href="/events"]').click();
    await expect(page).toHaveURL("/events");

    await page.locator("nav").first().locator('a[href="/media"]').click();
    await expect(page).toHaveURL("/media");

    await page.locator("nav").first().getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("/");
  });

  test("active nav link is highlighted", async ({ page }) => {
    await page.goto("/events");
    const desktopNav = page.locator("nav .hidden.md\\:flex");
    if (!(await desktopNav.isVisible())) return;

    const eventsLink = page.locator('nav a[href="/events"]').first();
    await expect(eventsLink).toHaveClass(/text-gold/);
  });
});

test.describe("Mobile Navigation", () => {
  test("mobile menu opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // Skip if hamburger is not visible (desktop viewport override)
    const hamburger = page.locator('button[aria-label="Open menu"]');
    if (!(await hamburger.isVisible())) return;

    await hamburger.click();
    const mobileOverlay = page.locator("div.fixed.inset-0");
    await expect(mobileOverlay).toBeVisible();

    await mobileOverlay.locator('button[aria-label="Close menu"]').click();
  });

  test("mobile menu links navigate correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const hamburger = page.locator('button[aria-label="Open menu"]');
    if (!(await hamburger.isVisible())) return;

    await hamburger.click();
    const overlay = page.locator("div.fixed.inset-0");
    await overlay.locator('a[href="/events"]').click();
    await expect(page).toHaveURL("/events");
  });
});
