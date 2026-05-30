# Stripe Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public event registration through Stripe Checkout, with webhook-driven persistence to `public.registrations`.

**Architecture:** Each `EventCard` renders a `<form action="/api/checkout" method="POST">` carrying only the `event_id`. The server route loads the event from Supabase, creates a Stripe Checkout Session with inline `price_data`, and 303-redirects to Stripe. After payment, Stripe POSTs `checkout.session.completed` to `/api/stripe/webhook`, which verifies the signature, cross-checks the amount, and `INSERT … ON CONFLICT DO NOTHING` into `registrations`. The DB write is decoupled from the user's redirect, so it survives a closed tab. Refunds happen in the Stripe Dashboard.

**Tech Stack:** Next.js 14 (App Router, Server Components, Route Handlers), `stripe` Node SDK (server-only), `@supabase/ssr` + `@supabase/supabase-js` (service-role for webhook writes), Playwright for e2e.

**Spec:** [docs/superpowers/specs/2026-05-28-stripe-payments-design.md](../specs/2026-05-28-stripe-payments-design.md)

---

## File map

| Path | Status | Responsibility |
|---|---|---|
| `package.json` | EDIT | Add `stripe` runtime dependency. |
| `.env.example` | EDIT | Document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. |
| `lib/stripe.ts` | NEW | Lazily-constructed `Stripe` client factory. Server-only. |
| `app/api/checkout/route.ts` | NEW | `POST` handler. Reads `event_id`, loads event, creates Checkout Session, 303-redirects to `session.url`. |
| `app/api/stripe/webhook/route.ts` | NEW | `POST` handler. Verifies `stripe-signature`, handles `checkout.session.completed`, inserts a `registrations` row idempotently. |
| `app/(public)/events/success/page.tsx` | NEW | "Thanks — receipt on its way" confirmation page. Reads `?session_id=…` for display only. |
| `components/EventCard.tsx` | EDIT | Replace `<Link href={href}>` with `<form action="/api/checkout" method="POST">` containing a hidden `event_id`. Drop the `href` prop, add `eventId`. |
| `app/(public)/events/page.tsx` | EDIT | Pass `eventId={event.id}` to each `EventCard`; remove `href="#"`. |
| `e2e/helpers/registrations.ts` | NEW | `seedTestEvent`, `deleteTestEvent`, `waitForRegistration`, `getRegistrationBySessionId`. |
| `e2e/helpers/stripe-webhook.ts` | NEW | `buildCheckoutSessionCompletedPayload`, `signPayload`. |
| `e2e/stripe-webhook.spec.ts` | NEW | Hermetic specs: happy path, invalid signature, idempotent retry, price mismatch. |
| `e2e/stripe-checkout.spec.ts` | NEW | Full Stripe-hosted flow. `test.skip(!process.env.STRIPE_CLI_RUNNING, …)`. |

---

## Task 1: Install Stripe SDK and document env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install the Stripe Node SDK**

Run from the project root (`ssrg-website/`):

```bash
npm install stripe
```

Expected: a new line in `dependencies` for `stripe` (a recent v17+ version).

- [ ] **Step 2: Document new env vars in `.env.example`**

Append to `.env.example`:

```bash
# Stripe — test keys for Development and Preview, live keys for Production.
# STRIPE_SECRET_KEY comes from https://dashboard.stripe.com/test/apikeys (or /apikeys in live mode).
# STRIPE_WEBHOOK_SECRET locally comes from `stripe listen --forward-to ...`;
# in Preview/Production it comes from the webhook endpoint configured in the Stripe Dashboard.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

- [ ] **Step 3: Set the values in `.env.local` for local dev**

Edit `.env.local` (gitignored) and add real test-mode values:

- `STRIPE_SECRET_KEY`: https://dashboard.stripe.com/test/apikeys → reveal "Secret key" (starts with `sk_test_`).
- `STRIPE_WEBHOOK_SECRET`: get this by running `stripe listen --forward-to http://localhost:3000/api/stripe/webhook` once (in a separate terminal — `stripe login` first if you haven't). The CLI prints a `whsec_…` value. Copy it into `.env.local`. You can `Ctrl-C` the listener afterward — the hermetic webhook specs (Tasks 5 and 6) don't need it running; they only need the secret to sign payloads with. The listener becomes load-bearing again in Task 10.

Restart `npm run dev` if it was already running, so it picks up the new env values.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Add stripe SDK and document Stripe env vars"
```

---

## Task 2: Create the Stripe server factory

**Files:**
- Create: `lib/stripe.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/stripe.ts
import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Server-only Stripe SDK accessor. Lazy so importing this module
 * at build time without STRIPE_SECRET_KEY set doesn't throw.
 *
 * NEVER import this from a "use client" file.
 */
export function stripeServer(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  _stripe = new Stripe(key);
  return _stripe;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0 (no new errors).

- [ ] **Step 3: Commit**

```bash
git add lib/stripe.ts
git commit -m "Add server-side Stripe SDK factory"
```

---

## Task 3: Create the registrations test helpers

**Files:**
- Create: `e2e/helpers/registrations.ts`

- [ ] **Step 1: Write the helpers**

```ts
// e2e/helpers/registrations.ts
import { serviceClient } from "./admin-session";

export type RegistrationRow = {
  id: string;
  event_id: string;
  stripe_session_id: string | null;
  email: string;
  name: string;
  car_make_model: string;
  instagram_handle: string | null;
  amount_paid_cents: number;
  created_at: string;
};

/**
 * Insert a published test event via the service-role client. Returns its id.
 * Caller is responsible for calling deleteTestEvent at the end of the test.
 */
export async function seedTestEvent(args: {
  title: string;
  price_cents: number;
}): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: args.title,
      event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      price_cents: args.price_cents,
      description_html: "<p>Test event (created by e2e helper).</p>",
      status: "published",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("seedTestEvent: insert returned no row");
  }
  return data.id;
}

/**
 * Delete a test event and all its registrations. Run in test teardown.
 * `registrations.event_id` is ON DELETE RESTRICT, so registrations must go first.
 */
export async function deleteTestEvent(eventId: string): Promise<void> {
  const supabase = serviceClient();
  await supabase.from("registrations").delete().eq("event_id", eventId);
  await supabase.from("events").delete().eq("id", eventId);
}

/**
 * Poll until at least one registrations row exists for the given event.
 * Returns the most recent one. Throws on timeout.
 */
export async function waitForRegistration(
  eventId: string,
  opts: { timeoutMs?: number } = {},
): Promise<RegistrationRow> {
  const timeout = opts.timeoutMs ?? 15_000;
  const start = Date.now();
  const supabase = serviceClient();
  while (Date.now() - start < timeout) {
    const { data } = await supabase
      .from("registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as RegistrationRow;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `waitForRegistration: timed out after ${timeout}ms for event ${eventId}`,
  );
}

/**
 * One-shot lookup by Stripe session id. Returns null if no row.
 */
export async function getRegistrationBySessionId(
  sessionId: string,
): Promise<RegistrationRow | null> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  return (data as RegistrationRow | null) ?? null;
}

/**
 * Count of registration rows for an event. Used to assert idempotency.
 */
export async function countRegistrations(eventId: string): Promise<number> {
  const supabase = serviceClient();
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/registrations.ts
git commit -m "Add registrations test helpers"
```

---

## Task 4: Create the Stripe webhook payload helper

**Files:**
- Create: `e2e/helpers/stripe-webhook.ts`

- [ ] **Step 1: Write the helpers**

```ts
// e2e/helpers/stripe-webhook.ts
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/stripe-webhook.ts
git commit -m "Add Stripe webhook test payload + signer helpers"
```

---

## Task 5: Webhook route — happy path (TDD)

**Files:**
- Create: `e2e/stripe-webhook.spec.ts`
- Create: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Write the failing spec (happy path only)**

Create `e2e/stripe-webhook.spec.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

In one terminal: `npm run dev`. In another:

```bash
npx playwright test e2e/stripe-webhook.spec.ts -g "inserts a registration row" --project=desktop
```

Expected: FAIL — the response will be 404 (route doesn't exist yet) so `expect(res.status()).toBe(200)` fails.

- [ ] **Step 3: Implement the webhook route**

Create `app/api/stripe/webhook/route.ts`:

```ts
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripeServer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeServer().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("stripe webhook: signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const eventId = session.metadata?.event_id;
  if (!eventId) {
    console.error("stripe webhook: session has no metadata.event_id", session.id);
    return new Response("Missing event_id metadata", { status: 400 });
  }

  const supabase = serviceClient();

  const { data: eventRow, error: eventErr } = await supabase
    .from("events")
    .select("id, price_cents")
    .eq("id", eventId)
    .maybeSingle();
  if (eventErr) {
    console.error("stripe webhook: failed to load event", eventErr);
    return new Response("Internal error", { status: 500 });
  }
  if (!eventRow) {
    console.error("stripe webhook: event not found", { sessionId: session.id, eventId });
    return new Response("Event not found", { status: 400 });
  }
  if ((session.amount_total ?? -1) !== eventRow.price_cents) {
    console.error("stripe webhook: amount_total mismatch", {
      sessionId: session.id,
      expected: eventRow.price_cents,
      actual: session.amount_total,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  const car =
    session.custom_fields?.find((f) => f.key === "car_make_model")?.text?.value ?? "";
  const igRaw =
    session.custom_fields?.find((f) => f.key === "instagram_handle")?.text?.value;
  const ig = igRaw && igRaw.length > 0 ? igRaw : null;

  const email = session.customer_details?.email ?? "";
  const name = session.customer_details?.name ?? "";
  if (!email || !name || !car) {
    console.error("stripe webhook: missing required customer fields", {
      sessionId: session.id,
      hasEmail: !!email,
      hasName: !!name,
      hasCar: !!car,
    });
    return new Response("Missing required fields", { status: 400 });
  }

  const { error: insertErr } = await supabase.from("registrations").insert({
    event_id: eventId,
    stripe_session_id: session.id,
    email,
    name,
    car_make_model: car,
    instagram_handle: ig,
    amount_paid_cents: session.amount_total ?? 0,
  });

  // 23505 = unique_violation on stripe_session_id; treat duplicate deliveries as success.
  if (insertErr && insertErr.code !== "23505") {
    console.error("stripe webhook: insert failed", insertErr);
    return new Response("Insert failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 4: Run the spec again to confirm it passes**

```bash
npx playwright test e2e/stripe-webhook.spec.ts -g "inserts a registration row" --project=desktop
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts e2e/stripe-webhook.spec.ts
git commit -m "Implement /api/stripe/webhook with happy-path spec"
```

---

## Task 6: Webhook route — negative cases (TDD)

**Files:**
- Modify: `e2e/stripe-webhook.spec.ts`

- [ ] **Step 1: Add three failing specs**

Append to `e2e/stripe-webhook.spec.ts` inside the `test.describe(...)` block (after the existing happy-path test):

```ts
test("rejects payloads with an invalid signature", async () => {
  const api = await pwRequest.newContext();
  const res = await api.post(WEBHOOK_URL, {
    headers: {
      "stripe-signature": "t=1,v1=garbage",
      "content-type": "application/json",
    },
    data: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
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
```

- [ ] **Step 2: Run all four tests**

```bash
npx playwright test e2e/stripe-webhook.spec.ts --project=desktop
```

Expected: all four PASS (the route from Task 5 already implements these behaviors — these specs lock them in).

If any fail: don't paper over with `try`/`catch` in the route. Fix the underlying behavior in `app/api/stripe/webhook/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add e2e/stripe-webhook.spec.ts
git commit -m "Add webhook specs for invalid signature, idempotency, price mismatch"
```

---

## Task 7: Checkout route (TDD)

**Files:**
- Create: `e2e/checkout-api.spec.ts`
- Create: `app/api/checkout/route.ts`

- [ ] **Step 1: Write the failing spec**

Create `e2e/checkout-api.spec.ts`:

```ts
import { test, expect, request as pwRequest } from "@playwright/test";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";
import { serviceClient } from "./helpers/admin-session";

const CHECKOUT_URL = "http://localhost:3000/api/checkout";

test.describe("/api/checkout", () => {
  let eventId: string;

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `Checkout Spec ${Date.now()}`,
      price_cents: 1234,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("redirects to a Stripe Checkout URL for a published event", async () => {
    const api = await pwRequest.newContext();
    const form = new URLSearchParams();
    form.set("event_id", eventId);

    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: form.toString(),
      maxRedirects: 0,
    });

    expect(res.status()).toBe(303);
    const location = res.headers()["location"];
    expect(location).toBeTruthy();
    expect(location).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });

  test("returns 404 for an unknown event id", async () => {
    const api = await pwRequest.newContext();
    const form = new URLSearchParams();
    form.set("event_id", "00000000-0000-0000-0000-000000000000");

    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: form.toString(),
      maxRedirects: 0,
    });

    expect(res.status()).toBe(404);
  });

  test("returns 404 for a draft event (unpublished)", async () => {
    // Flip the event to draft for this case
    await serviceClient().from("events").update({ status: "draft" }).eq("id", eventId);

    const api = await pwRequest.newContext();
    const form = new URLSearchParams();
    form.set("event_id", eventId);

    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: form.toString(),
      maxRedirects: 0,
    });

    expect(res.status()).toBe(404);
  });

  test("returns 400 when event_id is missing", async () => {
    const api = await pwRequest.newContext();
    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: "",
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

```bash
npx playwright test e2e/checkout-api.spec.ts --project=desktop
```

Expected: all four FAIL with 404 on the route itself (Next returns 404 for unrouted paths).

- [ ] **Step 3: Implement the checkout route**

Create `app/api/checkout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { stripeServer } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const eventId = String(form.get("event_id") ?? "");
  if (!eventId) {
    return new Response("Missing event_id", { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, price_cents, event_date, status")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("checkout: failed to load event", error);
    return new Response("Internal error", { status: 500 });
  }
  if (!event) {
    return new Response("Event not found", { status: 404 });
  }

  const origin =
    request.headers.get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const session = await stripeServer().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: event.price_cents,
          product_data: {
            name: event.title,
            description: `Event date: ${event.event_date}`,
          },
        },
      },
    ],
    custom_fields: [
      {
        key: "car_make_model",
        label: { type: "custom", custom: "Car make & model" },
        type: "text",
        optional: false,
      },
      {
        key: "instagram_handle",
        label: { type: "custom", custom: "Instagram handle (optional)" },
        type: "text",
        optional: true,
      },
    ],
    billing_address_collection: "required",
    metadata: { event_id: event.id },
    success_url: `${origin}/events/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/events`,
  });

  if (!session.url) {
    console.error("checkout: Stripe returned a session without a url");
    return new Response("Failed to create checkout session", { status: 500 });
  }

  return NextResponse.redirect(session.url, 303);
}
```

- [ ] **Step 4: Run the spec to confirm it passes**

```bash
npx playwright test e2e/checkout-api.spec.ts --project=desktop
```

Expected: all four PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/route.ts e2e/checkout-api.spec.ts
git commit -m "Implement /api/checkout with happy-path and negative specs"
```

---

## Task 8: Wire the Register button on EventCard

**Files:**
- Modify: `components/EventCard.tsx`
- Modify: `app/(public)/events/page.tsx`

- [ ] **Step 1: Update `components/EventCard.tsx`**

Replace the entire file with:

```tsx
import Image from "next/image";
import { sanitizedHtml } from "@/lib/render-html";

interface EventCardProps {
  eventId: string;
  image: string;
  title: string;
  price: string;
  descriptionHtml?: string;
}

export default function EventCard({
  eventId,
  image,
  title,
  price,
  descriptionHtml,
}: EventCardProps) {
  return (
    <div className="group bg-bg-elevated border border-subtle rounded-lg overflow-hidden hover:border-gold-muted/30 transition-colors">
      <div className="aspect-square relative overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="p-6">
        <h3 className="font-serif text-large text-text-primary">{title}</h3>
        <p className="mt-2 text-body text-gold font-semibold">{price}</p>
        {descriptionHtml ? (
          <div
            className="mt-4 text-small text-text-secondary prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={sanitizedHtml(descriptionHtml)}
          />
        ) : null}
        <form
          action="/api/checkout"
          method="POST"
          className="mt-4"
          data-testid={`register-form-${eventId}`}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            className="inline-block px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors cursor-pointer"
          >
            Register Now
          </button>
        </form>
      </div>
    </div>
  );
}
```

Notes:
- The `next/link` import is dropped. The card is still a Server Component (no `"use client"`).
- `<button type="submit">` performs a native form POST. Works without JS.
- Class strings on the button match the previous `<Link>` exactly to preserve visual styling.

- [ ] **Step 2: Update `app/(public)/events/page.tsx` to pass `eventId`**

Find this block (around lines 60-71):

```tsx
{events.map((event) => (
  <FadeIn key={event.id}>
    <EventCard
      image={coverUrl(supabaseUrl, event.cover_image_path)}
      title={event.title}
      price={formatPrice(event.price_cents)}
      href="#"
      descriptionHtml={event.description_html}
    />
  </FadeIn>
))}
```

Replace with:

```tsx
{events.map((event) => (
  <FadeIn key={event.id}>
    <EventCard
      eventId={event.id}
      image={coverUrl(supabaseUrl, event.cover_image_path)}
      title={event.title}
      price={formatPrice(event.price_cents)}
      descriptionHtml={event.description_html}
    />
  </FadeIn>
))}
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both exit 0. If TypeScript complains about a missing `href` somewhere else, it's a place that's reusing `EventCard` outside `/events`. Grep for it:

```bash
grep -rn "EventCard" app/ components/ --include="*.tsx"
```

If you find another consumer, give it the `eventId` prop too.

- [ ] **Step 4: Verify the existing events spec still passes**

```bash
npx playwright test e2e/events.spec.ts --project=desktop
```

Expected: PASS. The spec asserts `text=Register Now` and event title visibility — both still hold with the button.

- [ ] **Step 5: Commit**

```bash
git add components/EventCard.tsx app/\(public\)/events/page.tsx
git commit -m "Wire EventCard Register button to /api/checkout"
```

---

## Task 9: Success page

**Files:**
- Create: `app/(public)/events/success/page.tsx`
- Modify: `e2e/events.spec.ts` (add a small spec for the new page)

- [ ] **Step 1: Write the failing spec**

Append to `e2e/events.spec.ts`:

```ts
test.describe("Events success page", () => {
  test("renders confirmation copy and reference id", async ({ page }) => {
    await page.goto("/events/success?session_id=cs_test_example_123");
    await expect(page.locator("h1")).toContainText("Thanks for registering");
    await expect(page.locator("text=cs_test_example_123")).toBeVisible();
    await expect(page.locator("a", { hasText: "Back to events" })).toBeVisible();
  });

  test("renders even with no session_id query param", async ({ page }) => {
    await page.goto("/events/success");
    await expect(page.locator("h1")).toContainText("Thanks for registering");
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npx playwright test e2e/events.spec.ts -g "success page" --project=desktop
```

Expected: FAIL (404 — no success page yet).

- [ ] **Step 3: Implement the page**

Create `app/(public)/events/success/page.tsx`:

```tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-lg text-center">
        <h1 className="font-serif text-4xl mb-4">Thanks for registering</h1>
        <p className="text-text-secondary mb-8">
          A receipt from Stripe is on its way to your inbox. If you need to update your
          car or contact info, reply to that email and we&apos;ll sort it out.
        </p>
        {sessionId ? (
          <p className="text-xs text-text-muted mb-8">Reference: {sessionId}</p>
        ) : null}
        <Link
          href="/events"
          className="inline-block rounded bg-black text-white px-6 py-3 font-medium"
        >
          Back to events
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the spec to confirm it passes**

```bash
npx playwright test e2e/events.spec.ts -g "success page" --project=desktop
```

Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/events/success/page.tsx e2e/events.spec.ts
git commit -m "Add /events/success confirmation page"
```

---

## Task 10: Full-flow Playwright spec (gated)

**Files:**
- Create: `e2e/stripe-checkout.spec.ts`

This spec drives the real Stripe Checkout page. It depends on `stripe listen` being running locally to forward webhooks to localhost. It is gated behind `STRIPE_CLI_RUNNING` so CI doesn't hang.

- [ ] **Step 1: Write the spec**

```ts
// e2e/stripe-checkout.spec.ts
//
// Full Stripe-hosted Checkout flow.
//
// Requires BOTH of these to be running locally:
//   1. `npm run dev`
//   2. `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
//      (paste the printed whsec_... into .env.local, then restart `npm run dev`)
//
// Run with: STRIPE_CLI_RUNNING=1 npx playwright test e2e/stripe-checkout.spec.ts
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

    // Now on checkout.stripe.com — fill the test card. Stripe's field labels
    // are stable across years but if Stripe redesigns Checkout, update these.
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
```

- [ ] **Step 2: Verify the spec is correctly skipped without the env var**

```bash
npx playwright test e2e/stripe-checkout.spec.ts --project=desktop
```

Expected: 1 skipped. (If it tries to run, the `test.skip` line is wrong.)

- [ ] **Step 3: Run the spec for real (manual)**

In three terminals:

```bash
# terminal 1
npm run dev

# terminal 2
stripe login         # one-time
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
# copy the printed whsec_..., paste into .env.local as STRIPE_WEBHOOK_SECRET, restart terminal 1

# terminal 3
STRIPE_CLI_RUNNING=1 npx playwright test e2e/stripe-checkout.spec.ts --project=desktop
```

Expected: PASS. The Stripe CLI window will show webhook events being forwarded; the spec asserts the registration row appears.

If Stripe's Checkout field labels have drifted, update the `getByLabel(...)` calls and re-run.

- [ ] **Step 4: Commit**

```bash
git add e2e/stripe-checkout.spec.ts
git commit -m "Add gated end-to-end Stripe Checkout spec"
```

---

## Task 11: Vercel + Stripe Dashboard wiring (manual)

This is operational, not code. Follow it once the code from Tasks 1-10 is on `main`.

**Files:** (none — Stripe Dashboard + Vercel UI/CLI)

- [ ] **Step 1: Register a webhook endpoint in the Stripe test-mode Dashboard**

1. Open https://dashboard.stripe.com/test/webhooks.
2. Click **Add endpoint**.
3. Endpoint URL: `https://<preview-domain>.vercel.app/api/stripe/webhook` (one of the preview URLs; you can also add a wildcard later).
4. Events to send: `checkout.session.completed` only.
5. Save. Click the new endpoint → reveal **Signing secret** (starts with `whsec_`).

- [ ] **Step 2: Set Stripe test-mode env vars on Vercel Preview + Development**

From the project root (Vercel CLI must be logged in — see [CLAUDE.md](../../../CLAUDE.md#vercel)):

```bash
npx vercel env add STRIPE_SECRET_KEY preview ""       # paste sk_test_... when prompted
npx vercel env add STRIPE_WEBHOOK_SECRET preview ""   # paste whsec_... from step 1
npx vercel env add STRIPE_SECRET_KEY development      # paste sk_test_...
npx vercel env add STRIPE_WEBHOOK_SECRET development  # paste the same whsec_... (or a separate test endpoint's)
```

The `""` after `preview` is the magic value the CLI wants for "all preview branches" — see [CLAUDE.md](../../../CLAUDE.md#vercel).

- [ ] **Step 3: Register a webhook endpoint in the Stripe live-mode Dashboard**

1. Switch the Stripe Dashboard toggle to **Live mode** (top-left).
2. https://dashboard.stripe.com/webhooks → **Add endpoint**.
3. Endpoint URL: `https://ssrg-website-nwallace-3136s-projects.vercel.app/api/stripe/webhook`
4. Events: `checkout.session.completed`.
5. Save → reveal **Signing secret**.

- [ ] **Step 4: Set Stripe live env vars on Vercel Production**

```bash
npx vercel env add STRIPE_SECRET_KEY production       # paste sk_live_...
npx vercel env add STRIPE_WEBHOOK_SECRET production   # paste whsec_... from step 3
```

- [ ] **Step 5: Trigger a Preview deploy and smoke-test**

```bash
npx vercel deploy
```

When it finishes, open the preview URL. Click Register on an event, pay with `4242 4242 4242 4242`, confirm:
- You land on `/events/success`.
- The Stripe test-mode Dashboard shows the payment.
- `npx supabase db query "select * from registrations order by created_at desc limit 1" --linked` shows the row.

- [ ] **Step 6: Promote to Production**

```bash
npx vercel deploy --prod
```

Smoke-test with a tiny live amount on a throwaway event (e.g., $0.50). Refund yourself in the Stripe Dashboard afterward. Confirm the registration row exists.

- [ ] **Step 7: Update CLAUDE.md**

Append a short Stripe section to [CLAUDE.md](../../../CLAUDE.md) at the project root, after the Supabase section. Suggested content:

```markdown
## Stripe

- **Modes:** test in Development + Preview, live in Production. Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Local webhook loop:** `stripe listen --forward-to http://localhost:3000/api/stripe/webhook` — paste the printed `whsec_…` into `.env.local`.
- **Registered endpoints:** one in test mode (preview URL) and one in live mode (prod URL), both subscribed to `checkout.session.completed` only.
- **Refunds:** Stripe Dashboard. The `registrations` row stays as the historical record of payment.
```

- [ ] **Step 8: Commit the docs update**

```bash
git add CLAUDE.md
git commit -m "Document Stripe wiring and local webhook loop in CLAUDE.md"
```

---

## Verification checklist

After all tasks are done, run these to confirm everything still works:

- [ ] `npx tsc --noEmit` — passes
- [ ] `npm run lint` — passes
- [ ] `npm run build` — passes
- [ ] `npx playwright test --project=desktop` — all e2e specs pass (stripe-checkout.spec.ts will be skipped without `STRIPE_CLI_RUNNING`)
- [ ] Manual smoke test on local: register for the $0 Coffee Run event with `stripe listen` running, confirm webhook fires and row lands.
- [ ] Manual smoke test on Preview deploy with a test card.
- [ ] Manual smoke test on Production with a $0.50 test event, refund afterward.
