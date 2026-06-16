# SSRG Stripe Payments — Design Spec

**Date:** 2026-05-28
**Phase:** Week 3-4 (Stripe integration per `SSRG-Website-Action-Plan.md`)
**Scope:** Public event registration via Stripe Checkout, webhook-driven persistence of `registrations` rows.

## Goal

Let members register for published events on `/events` by paying through Stripe Checkout. The registration is recorded in `public.registrations` only after Stripe confirms the payment succeeded, via a signed webhook. Refunds and disputes are handled in the Stripe Dashboard.

## Non-goals (v1)

- Multi-ticket purchase. One Checkout Session = one registration row.
- Event capacity / sold-out logic. Schema gets no `capacity` column.
- Admin-side refund tracking. Refunds happen in Stripe Dashboard; the `registrations` row stays as the historical record of payment.
- Branded confirmation email. Stripe's default receipt is enough for v1.
- Custom membership / recurring billing. `mode: 'payment'` only.
- Event detail page. The Register button lives directly on the `EventCard` on `/events`.

## Architecture

### Routes & files

| Path | Type | Purpose |
|---|---|---|
| `app/(public)/events/page.tsx` | EDIT | Pass `event_id` to `EventCard`; pre-existing event list stays. |
| `components/EventCard.tsx` | EDIT | Replace `href="#"` link with `<form action="/api/checkout" method="POST">` containing a hidden `event_id` and a Register button. |
| `app/(public)/events/success/page.tsx` | NEW | Confirmation page. Reads `?session_id=…`, renders "Thanks — receipt on its way." |
| `app/api/checkout/route.ts` | NEW | POST handler. Reads `event_id` from form data, looks up the event, creates a Stripe Checkout Session, returns 303 redirect to `session.url`. |
| `app/api/stripe/webhook/route.ts` | NEW | POST handler. Verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`. Handles `checkout.session.completed`. Inserts a `registrations` row idempotently. |
| `lib/stripe.ts` | NEW | Single `stripeServer` factory wrapping the Stripe SDK with `STRIPE_SECRET_KEY`. Server-only. Never imported by client code. |

No Supabase migrations are needed — `registrations` already has `stripe_session_id` (unique), `event_id`, `email`, `name`, `car_make_model`, `instagram_handle`, `amount_paid_cents`.

### User flow

```
/events  ──► member sees grid of published events
   │       each EventCard renders a <form action="/api/checkout"> with hidden event_id
   │
   │   click Register on event X
   ▼
POST /api/checkout
   │  - reads event_id from form data
   │  - loads event from Supabase (RLS filters to status='published')
   │  - creates Stripe Checkout Session with:
   │      line_items: [{ price_data: { unit_amount: event.price_cents, ... }, quantity: 1 }]
   │      custom_fields: [ car_make_model (required), instagram_handle (optional) ]
   │      billing_address_collection: 'required'    ← gives us customer name
   │      metadata: { event_id: '<uuid>' }
   │      success_url: '/events/success?session_id={CHECKOUT_SESSION_ID}'
   │      cancel_url: '/events'
   │  - returns 303 redirect to session.url
   ▼
checkout.stripe.com  (Stripe-hosted)
   │  member enters: email + name + card + car (required) + IG (optional)
   │  pays
   ▼
Stripe redirects browser ──► /events/success?session_id=…
   │                          renders "Thanks — receipt is on its way" + event title
   │                          (read-only; does NOT write to DB)
   │
   └──── Asynchronously (may arrive before or after the redirect) ────►
                              POST /api/stripe/webhook
                                  - verify stripe-signature
                                  - parse event
                                  - if event.type === 'checkout.session.completed':
                                      INSERT INTO registrations (...)
                                      ON CONFLICT (stripe_session_id) DO NOTHING
                                  - return 200
```

### Why the webhook is the source of truth

The success page is UX only. If the member closes their tab before redirect, payment still completes and the registration still lands when Stripe POSTs the webhook. The DB row never depends on the user's browser making it back to SSRG.

`stripe_session_id` is `UNIQUE` in the schema; the webhook insert uses `ON CONFLICT DO NOTHING` so duplicate webhook deliveries (Stripe retries on non-2xx responses) are idempotent.

## Data flow

When `checkout.session.completed` arrives, the webhook reads from the Stripe session:

| Stripe session field | `registrations` column |
|---|---|
| `session.metadata.event_id` | `event_id` |
| `session.id` | `stripe_session_id` |
| `session.customer_details.email` | `email` |
| `session.customer_details.name` | `name` |
| `session.custom_fields[key='car_make_model'].text.value` | `car_make_model` |
| `session.custom_fields[key='instagram_handle'].text.value` | `instagram_handle` (nullable) |
| `session.amount_total` | `amount_paid_cents` |

`event_id` round-trips via `session.metadata` because the webhook has no other connection to our app's request that created the session.

`name` comes from `billing_address_collection: 'required'` rather than a custom field — this preserves both of our custom-field slots for non-standard data, and gives us a billing address on file should it be useful later.

### Cross-check at webhook time

The webhook re-loads the event by `metadata.event_id` and asserts:

- the event still exists (catches the rare race of admin-deleted-event-mid-checkout)
- `event.price_cents === session.amount_total` (catches any tampering / drift)

We deliberately do *not* re-check `status='published'` here — if a paid Checkout completes after the event was unpublished, we still want to record the registration. The price match is the load-bearing check.

If either check fails, log loudly and return 400 (Stripe will retry, and we'll see it in logs).

## Security properties

1. **Price is never client-controlled.** The browser only POSTs `event_id`. `/api/checkout` reads `price_cents` and `title` directly from Supabase. A user editing the hidden form value or curling the endpoint can only switch which event they're buying, not invent a price.
2. **Draft events are unbuyable.** `/api/checkout` filters `status='published'` and the `events_public_read` RLS policy enforces the same. Knowing a draft event's UUID is not enough.
3. **Webhook authenticity is signature-verified.** The Stripe SDK's `webhooks.constructEvent` rejects any payload not signed with `STRIPE_WEBHOOK_SECRET`. A forged POST to `/api/stripe/webhook` is rejected before any DB work.
4. **Inline `price_data`, no pre-created Stripe Prices.** Avoids the failure mode where a Stripe Product/Price is out of sync with our DB. The price on the Checkout page is always the price we just read.
5. **Service-role key stays server-side.** Webhook writes to `registrations` use the service role (the table has no anon/auth RLS policies, by design). `lib/stripe.ts` is server-only and `STRIPE_SECRET_KEY` is never exposed to the browser.

## Environment configuration

| Vercel env | Stripe mode | `STRIPE_SECRET_KEY` | `STRIPE_WEBHOOK_SECRET` source |
|---|---|---|---|
| Development (`.env.local`) | test | `sk_test_…` | `whsec_…` emitted by `stripe listen` |
| Preview | test | `sk_test_…` | webhook endpoint configured in test-mode dashboard pointing at `https://*.vercel.app/api/stripe/webhook` |
| Production | live | `sk_live_…` | webhook endpoint configured in live-mode dashboard pointing at the prod URL |

No `NEXT_PUBLIC_STRIPE_*` env vars — Checkout is fully Stripe-hosted, so the browser never needs a publishable key.

The `success_url` / `cancel_url` origins should come from `request.headers.get('origin')` or `process.env.VERCEL_URL`, not be hardcoded, so previews work.

## Testing strategy

### 1. Local interactive smoke test

```bash
# terminal 1
npm run dev
# terminal 2
stripe login                                         # one-time
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
# paste the printed whsec_… into .env.local; restart npm run dev
```

Then in a browser: click Register on a seeded test event, pay with `4242 4242 4242 4242` (any future exp, any CVC), confirm the redirect to `/events/success`, then `select * from registrations order by created_at desc limit 1`.

Also exercise:
- `4000 0000 0000 0002` — card declined (no webhook fires; user stays on Stripe)
- `4000 0025 0000 3155` — 3DS challenge

### 2. Automated full-flow Playwright spec — `e2e/stripe-checkout.spec.ts`

Seeds a test event via service-role client, drives `/events` → Register → Stripe Checkout → fill test card → assert redirect to `/events/success` → poll DB until the webhook lands → assert row matches expected `amount_paid_cents`, `event_id`, `car_make_model`.

Properties:
- Requires `stripe listen` to be running locally. The spec calls `test.skip(!process.env.STRIPE_CLI_RUNNING, "stripe listen must be running")` — a manually-set env var the developer flips on when they have the CLI loop running. CI doesn't set it, so the spec is skipped there rather than hanging on `waitForRegistration`.
- Relies on stable field labels on the Stripe Checkout page. If Stripe redesigns Checkout, this spec breaks — acceptable for v1.

### 3. Isolated webhook spec — `e2e/stripe-webhook.spec.ts`

Hermetic. Constructs payloads + signs them with `STRIPE_WEBHOOK_SECRET` using the Stripe SDK's `webhooks.generateTestHeaderString`, POSTs directly to `/api/stripe/webhook`. Cases:

- Happy path: signed `checkout.session.completed` → 200 + one row inserted.
- Invalid signature: → 400, no row.
- Duplicate delivery: same payload posted twice → only one row, second returns 200.
- Price-mismatch: `session.amount_total` differs from `events.price_cents` for that event → 400 logged, no row.

This catches signature, idempotency, and DB-insert bugs without depending on Stripe being reachable or the CLI running.

### 4. New test helpers (in `e2e/helpers/`)

- `seedTestEvent({ title, price_cents })` — service-role insert into `events` with `status='published'`. Returns the id. Caller responsible for cleanup.
- `waitForRegistration(eventId, opts)` — polls every 250 ms until a row appears or timeout.
- `buildCheckoutSessionCompletedPayload(...)` + `signPayload(...)` — thin wrappers around the Stripe SDK's signing utilities.

## Operational notes

- **`on delete restrict` on `registrations.event_id`** means an admin cannot delete an event with registrations. v1 leaves this as-is: admins must refund and remove registrations in the DB if they ever want to delete a paid event. Worth flagging in admin UI later.
- **Receipts come from Stripe** with the line item title we set as `product_data.name` — i.e., the event title. No SSRG branding on the receipt in v1.
- **Time zones:** `event_date` is `timestamptz`; we pass `Event date: ${event.event_date}` into `product_data.description` so the buyer sees it on Stripe Checkout. Format as ISO for now; localized formatting can come later.
- **Currency is USD** and hardcoded in `/api/checkout`. If SSRG ever runs events in other currencies, add a column.
- **Webhook endpoint must be registered in both Stripe modes** (test + live) and the resulting `whsec_…` placed in the matching Vercel env. The Stripe CLI emits a *different* secret for local forwarding; it is not interchangeable with the dashboard-registered endpoint's secret.

## Out of scope / future work

- Capacity caps + sold-out state.
- Multi-ticket purchases (`quantity > 1`, schema gets a `quantity` column).
- Admin Registrations view (list paid attendees per event, refund status).
- Listening for `charge.refunded` and adding a `status` column to `registrations`.
- Branded confirmation email via Supabase + a templating layer (Resend / Loops / etc.).
- Per-event waitlists.
- Discount codes / promo codes.
