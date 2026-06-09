import { test, expect, request as pwRequest } from "@playwright/test";
import {
  seedTestEvent,
  deleteTestEvent,
  getRegistrationBySessionId,
  countRegistrations,
} from "./helpers/registrations";
import {
  buildCheckoutSessionCompletedPayload,
  signPayload,
} from "./helpers/stripe-webhook";

const WEBHOOK_URL = "http://localhost:3000/api/stripe/webhook";

function uniqueSessionId(): string {
  return `cs_test_spec_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

test.describe("/api/stripe/webhook", () => {
  let eventId: string;

  test.beforeAll(async () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error(
        "STRIPE_WEBHOOK_SECRET must be set in .env.local for the webhook specs",
      );
    }
  });

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `Webhook Spec ${Date.now()}`,
      price_cents: 2500,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("inserts a registration row on checkout.session.completed", async () => {
    const sessionId = uniqueSessionId();
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId,
      eventId,
      amountTotal: 2500,
      email: "buyer@example.com",
      name: "Test Buyer",
      carMakeModel: "McLaren 720S",
      instagramHandle: "@testbuyer",
    });
    const signature = signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const api = await pwRequest.newContext();
    const res = await api.post(WEBHOOK_URL, {
      headers: {
        "stripe-signature": signature,
        "content-type": "application/json",
      },
      data: payload,
    });

    expect(res.status()).toBe(200);

    const row = await getRegistrationBySessionId(sessionId);
    expect(row).not.toBeNull();
    expect(row!.event_id).toBe(eventId);
    expect(row!.email).toBe("buyer@example.com");
    expect(row!.name).toBe("Test Buyer");
    expect(row!.car_make_model).toBe("McLaren 720S");
    expect(row!.instagram_handle).toBe("@testbuyer");
    expect(row!.amount_paid_cents).toBe(2500);
    expect(await countRegistrations(eventId)).toBe(1);
  });

  test("rejects payloads with an invalid signature", async () => {
    const api = await pwRequest.newContext();
    const res = await api.post(WEBHOOK_URL, {
      headers: {
        "stripe-signature": "t=1,v1=garbage",
        "content-type": "application/json",
      },
      data: JSON.stringify({
        type: "checkout.session.completed",
        data: { object: {} },
      }),
    });
    expect(res.status()).toBe(400);
    expect(await countRegistrations(eventId)).toBe(0);
  });

  test("is idempotent — duplicate delivery inserts only one row", async () => {
    const sessionId = uniqueSessionId();
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId,
      eventId,
      amountTotal: 2500,
      email: "dup@example.com",
      name: "Duplicate Buyer",
      carMakeModel: "Porsche 911",
    });
    const signature = signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const api = await pwRequest.newContext();
    const headers = {
      "stripe-signature": signature,
      "content-type": "application/json",
    };

    const first = await api.post(WEBHOOK_URL, { headers, data: payload });
    const second = await api.post(WEBHOOK_URL, { headers, data: payload });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(await countRegistrations(eventId)).toBe(1);
  });

  test("rejects sessions where amount_total does not match event price", async () => {
    const sessionId = uniqueSessionId();
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId,
      eventId,
      amountTotal: 1, // event is 2500 cents — mismatch
      email: "cheap@example.com",
      name: "Cheap Buyer",
      carMakeModel: "Anything",
    });
    const signature = signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const api = await pwRequest.newContext();
    const res = await api.post(WEBHOOK_URL, {
      headers: {
        "stripe-signature": signature,
        "content-type": "application/json",
      },
      data: payload,
    });
    expect(res.status()).toBe(400);
    expect(await countRegistrations(eventId)).toBe(0);
  });
});
