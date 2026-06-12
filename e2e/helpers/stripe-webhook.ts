import Stripe from "stripe";

export function buildCheckoutSessionCompletedPayload(args: {
  sessionId: string;
  eventId: string;
  registrationId: string;
  amountTotal: number;
  /** Defaults to amountTotal; pass a different value to simulate a mismatch. */
  amountExpectedCents?: number;
  email?: string;
  name?: string;
}): string {
  const session = {
    id: args.sessionId,
    object: "checkout.session",
    amount_total: args.amountTotal,
    currency: "usd",
    metadata: {
      event_id: args.eventId,
      registration_id: args.registrationId,
      amount_expected_cents: String(args.amountExpectedCents ?? args.amountTotal),
    },
    customer_details: {
      email: args.email ?? "buyer@example.com",
      name: args.name ?? "Test Buyer",
    },
    payment_status: "paid",
    status: "complete",
  };
  const event = {
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: "checkout.session.completed",
    api_version: "2025-09-30.clover",
    created: Math.floor(Date.now() / 1000),
    data: { object: session },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  };
  return JSON.stringify(event);
}

/**
 * Sign a payload with the same scheme Stripe uses, producing a header value
 * that `Stripe.webhooks.constructEvent` will accept when paired with `secret`.
 */
export function signPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp,
  });
}
