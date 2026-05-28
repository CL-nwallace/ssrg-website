import Stripe from "stripe";

export function buildCheckoutSessionCompletedPayload(args: {
  sessionId: string;
  eventId: string;
  amountTotal: number;
  email: string;
  name: string;
  carMakeModel: string;
  instagramHandle?: string | null;
}): string {
  const session = {
    id: args.sessionId,
    object: "checkout.session",
    amount_total: args.amountTotal,
    currency: "usd",
    metadata: { event_id: args.eventId },
    customer_details: { email: args.email, name: args.name },
    custom_fields: [
      {
        key: "car_make_model",
        text: { value: args.carMakeModel },
      },
      {
        key: "instagram_handle",
        text: { value: args.instagramHandle ?? null },
      },
    ],
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
