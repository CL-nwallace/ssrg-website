// Full Stripe-hosted Checkout flow through the registration form.
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
// selectors below may time out. To get this spec green, swap to FrameLocator:
//   const cardFrame = page.frameLocator('iframe[title*="card" i]');
//   await cardFrame.getByLabel(/card number/i).fill('4242424242424242');
// and verify the exact iframe attribute against the live Checkout page.
// Functional coverage of our own code lives in the hermetic specs
// (stripe-webhook.spec.ts + registration-checkout.spec.ts) — this spec only
// adds an end-to-end browser sanity check.
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

  test("member registers with one dinner end-to-end", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/events/${eventId}/register`);
    await page.getByLabel("First name *").fill("Test");
    await page.getByLabel("Last name *").fill("Playwright");
    await page.getByLabel("Email *").fill("test+playwright@ssrgofficial.com");
    await page.getByLabel("T-shirt size *").selectOption("LRG");
    await page.getByLabel("Car make *").selectOption("McLaren");
    await page.getByLabel("Car model *").selectOption("All models");
    await page.getByLabel("Your model *").fill("720S");
    await page.getByLabel("Thursday Lunch — your meal *").selectOption("Pork Taco");
    await page.getByLabel(/thursday dinner/i).selectOption("1");
    await page.getByLabel("I have read and accept the waiver *").check();
    await page.getByRole("button", { name: /continue to payment/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

    await page.getByLabel(/card number/i).fill("4242424242424242");
    await page.getByLabel(/expiration/i).fill("1234");
    await page.getByLabel(/cvc/i).fill("123");
    await page.getByLabel(/name on card/i).fill("Test Playwright Buyer");
    await page.getByRole("button", { name: /pay/i }).click();

    await page.waitForURL(/\/events\/success/, { timeout: 30_000 });
    await expect(page.locator("h1")).toContainText("Thanks for registering");

    const reg = await waitForRegistration(eventId, {
      timeoutMs: 20_000,
      status: "paid",
    });
    expect(reg.amount_paid_cents).toBe(1000 + 19900);
    expect(reg.car_make).toBe("McLaren");
    expect(reg.car_model).toBe("720S");
    expect(reg.email).toBe("test+playwright@ssrgofficial.com");
  });
});
