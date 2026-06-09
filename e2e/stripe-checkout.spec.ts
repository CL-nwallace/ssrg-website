// Full Stripe-hosted Checkout flow.
//
// Requires BOTH of these to be running locally:
//   1. `npm run dev` (or rely on Playwright's webServer config)
//   2. `stripe listen --api-key $STRIPE_SECRET_KEY \
//        --forward-to http://localhost:3000/api/stripe/webhook \
//        --events checkout.session.completed`
//      (the printed whsec_... is the value already in .env.local)
//
// Run with: STRIPE_CLI_RUNNING=1 npx playwright test e2e/stripe-checkout.spec.ts
//
// KNOWN LIMITATION (2026-05-29): Stripe's current Checkout page renders
// card inputs inside an iframe, so the `getByLabel(/card number/i)` etc.
// selectors below time out. To get this spec green, swap to FrameLocator:
//   const cardFrame = page.frameLocator('iframe[title*="card" i]');
//   await cardFrame.getByLabel(/card number/i).fill('4242424242424242');
// and verify the exact iframe attribute against the live Checkout page.
// Functional coverage of our own code lives in the hermetic specs
// (stripe-webhook.spec.ts + checkout-api.spec.ts) — this spec only adds
// an end-to-end browser sanity check.
//
import { test, expect } from "@playwright/test";
import {
  seedTestEvent,
  deleteTestEvent,
  waitForRegistration,
} from "./helpers/registrations";

test.describe("Stripe Checkout end-to-end", () => {
  test.skip(
    !process.env.STRIPE_CLI_RUNNING,
    "Set STRIPE_CLI_RUNNING=1 and run `stripe listen` to enable this spec.",
  );

  let eventId: string;
  const uniqueTitle = `Playwright Checkout ${Date.now()}`;

  test.beforeAll(async () => {
    eventId = await seedTestEvent({ title: uniqueTitle, price_cents: 1000 });
  });

  test.afterAll(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("member can register for an event end-to-end", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/events");

    // Find the form by event id (data-testid set in EventCard) and submit it.
    const form = page.locator(`[data-testid="register-form-${eventId}"]`);
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: /register/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

    await page.getByLabel(/email/i).fill("test+playwright@ssrgofficial.com");
    await page.getByLabel(/card number/i).fill("4242424242424242");
    await page.getByLabel(/expiration/i).fill("1234");
    await page.getByLabel(/cvc/i).fill("123");
    await page.getByLabel(/name on card/i).fill("Test Playwright Buyer");
    await page.getByLabel(/car make.*model/i).fill("McLaren 720S");
    // Instagram handle is optional; leave blank.

    await page.getByRole("button", { name: /pay/i }).click();

    await page.waitForURL(/\/events\/success/, { timeout: 30_000 });
    await expect(page.locator("h1")).toContainText("Thanks for registering");

    const reg = await waitForRegistration(eventId, { timeoutMs: 20_000 });
    expect(reg.amount_paid_cents).toBe(1000);
    expect(reg.car_make_model).toBe("McLaren 720S");
    expect(reg.email).toBe("test+playwright@ssrgofficial.com");
    expect(reg.instagram_handle).toBeNull();
  });
});
