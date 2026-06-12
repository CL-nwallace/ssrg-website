import { test, expect, request as pwRequest } from "@playwright/test";
import {
  seedTestEvent,
  deleteTestEvent,
  insertPendingRegistration,
  getRegistrationById,
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

async function deliver(payload: string) {
  const api = await pwRequest.newContext();
  return api.post(WEBHOOK_URL, {
    headers: {
      "stripe-signature": signPayload(payload, process.env.STRIPE_WEBHOOK_SECRET!),
      "content-type": "application/json",
    },
    data: payload,
  });
}

test.describe("/api/stripe/webhook", () => {
  let eventId: string;

  test.beforeAll(async () => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
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

  test("marks the pending registration paid on checkout.session.completed", async () => {
    const registrationId = await insertPendingRegistration(eventId);
    const sessionId = uniqueSessionId();
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId,
      eventId,
      registrationId,
      amountTotal: 42300,
    });

    const res = await deliver(payload);
    expect(res.status()).toBe(200);

    const row = await getRegistrationById(registrationId);
    expect(row!.status).toBe("paid");
    expect(row!.amount_paid_cents).toBe(42300);
    expect(row!.stripe_session_id).toBe(sessionId);
    expect(await countRegistrations(eventId)).toBe(1);
  });

  test("rejects payloads with an invalid signature; row stays pending", async () => {
    const registrationId = await insertPendingRegistration(eventId);
    const api = await pwRequest.newContext();
    const res = await api.post(WEBHOOK_URL, {
      headers: {
        "stripe-signature": "t=1,v1=garbage",
        "content-type": "application/json",
      },
      data: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
    });
    expect(res.status()).toBe(400);
    expect((await getRegistrationById(registrationId))!.status).toBe("pending");
  });

  test("is idempotent — duplicate delivery leaves one paid row", async () => {
    const registrationId = await insertPendingRegistration(eventId);
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: uniqueSessionId(),
      eventId,
      registrationId,
      amountTotal: 42300,
    });

    const first = await deliver(payload);
    const second = await deliver(payload);
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect((await getRegistrationById(registrationId))!.status).toBe("paid");
    expect(await countRegistrations(eventId)).toBe(1);
  });

  test("rejects amount_total mismatch against metadata; row stays pending", async () => {
    const registrationId = await insertPendingRegistration(eventId);
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: uniqueSessionId(),
      eventId,
      registrationId,
      amountTotal: 1,
      amountExpectedCents: 42300,
    });
    const res = await deliver(payload);
    expect(res.status()).toBe(400);
    expect((await getRegistrationById(registrationId))!.status).toBe("pending");
  });

  test("rejects sessions without registration_id metadata", async () => {
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: uniqueSessionId(),
      eventId,
      registrationId: "",
      amountTotal: 2500,
    });
    const res = await deliver(payload);
    expect(res.status()).toBe(400);
  });

  test("rejects unknown registration ids", async () => {
    const payload = buildCheckoutSessionCompletedPayload({
      sessionId: uniqueSessionId(),
      eventId,
      registrationId: "00000000-0000-0000-0000-000000000000",
      amountTotal: 2500,
    });
    const res = await deliver(payload);
    expect(res.status()).toBe(400);
  });
});
