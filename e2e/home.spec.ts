import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero displays SSRG logo image", async ({ page }) => {
    const logo = page.locator('section img[alt="SSRG"]');
    await expect(logo).toBeVisible({ timeout: 3000 });
  });

  test("hero has background video on desktop", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, "Video hidden on mobile");
    const video = page.locator("video");
    await expect(video).toBeVisible({ timeout: 3000 });
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("muted", "");
    await expect(video).toHaveAttribute("loop", "");
  });

  test("hero video has correct source", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, "Video hidden on mobile");
    const source = page.locator("video source");
    await expect(source).toHaveAttribute("src", "/videos/hero.mp4");
  });

  test("Who is SSRG section is visible", async ({ page }) => {
    const heading = page.getByText("Who is SSRG?");
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
  });

  test("vision sections render (Passion, Vision, Goal)", async ({ page }) => {
    const passion = page.getByText("Our Passion", { exact: true });
    await passion.scrollIntoViewIfNeeded();
    await expect(passion).toBeVisible({ timeout: 3000 });

    const vision = page.getByText("Our Vision", { exact: true });
    await vision.scrollIntoViewIfNeeded();
    await expect(vision).toBeVisible({ timeout: 3000 });

    const goal = page.getByText("Our Goal", { exact: true });
    await goal.scrollIntoViewIfNeeded();
    await expect(goal).toBeVisible({ timeout: 3000 });
  });

  test("member car cards display", async ({ page }) => {
    const membersSection = page.locator('[data-testid="members-section"]');
    await membersSection.scrollIntoViewIfNeeded();
    await expect(page.getByText("Loyal Participants")).toBeVisible();
  });

  test("View All Members button expands grid", async ({ page }) => {
    const viewAllBtn = page.getByText("View All Members");
    await viewAllBtn.scrollIntoViewIfNeeded();
    await expect(viewAllBtn).toBeVisible({ timeout: 5000 });
    await viewAllBtn.click();
    // Button should disappear after clicking
    await expect(viewAllBtn).not.toBeVisible();
  });

  test("about section shows Sally Corpin", async ({ page }) => {
    const aboutSection = page.locator('[data-testid="about-section"]');
    await aboutSection.scrollIntoViewIfNeeded();
    await expect(page.getByText("Sally Corpin").first()).toBeVisible({ timeout: 3000 });
  });

  test("sponsors section renders", async ({ page }) => {
    const sponsorsSection = page.locator('[data-testid="sponsors-section"]');
    await sponsorsSection.scrollIntoViewIfNeeded();
    await expect(page.getByText("Our Valued Partners")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Services Offered").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("SSRG Member Perks").first()).toBeVisible({ timeout: 3000 });
  });

  test("contact form section is present", async ({ page }) => {
    const contactSection = page.locator('[data-testid="contact-section"]');
    await contactSection.scrollIntoViewIfNeeded();
    await expect(page.getByText("Contact Us")).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
  });

  test("sponsor form section is present", async ({ page }) => {
    const formSection = page.locator('[data-testid="sponsor-form-section"]');
    await formSection.scrollIntoViewIfNeeded();
    await expect(page.getByText("Become Our Sponsor")).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="sponsor-form"]')).toBeVisible();
  });
});
