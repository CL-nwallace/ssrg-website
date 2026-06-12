# Event Registration Template — Design

**Date:** 2026-06-11
**Status:** Approved by Nico (this session)
**Supersedes:** the Stripe `custom_fields` approach from `2026-05-28-stripe-payments-design.md` (car make/model and IG handle fields move out of Stripe Checkout and into an on-site registration form).

## Goal

Replace the minimal "Register → straight to Stripe Checkout" flow with a full on-site
registration form, templatized so every event uses the same form *shape* with
admin-editable content. First instance: **Monterey Rally 2026** ($599/car, registration
auto-closes Aug 13, 2026). Stripe Checkout shows an itemized invoice (base registration
+ paid add-ons) computed server-side.

## Decisions made during brainstorming

- **Pricing:** base registration is **per car** ($599 for Monterey). Thursday and
  Saturday lunches are **included** in the base price — the lunch dropdown only captures
  each person's meal choice. The only paid add-on is **Thursday Dinner at $199/person**
  (dropdown shows "$398 for 2" first, then "$199 for 1").
- **Waiver:** checkbox + on-page waiver text. We store the acceptance timestamp; no
  signature, upload, or e-sign service.
- **Auto-close:** when the registration deadline passes, the Register button disappears
  but the event stays visible on `/events`.
- **Admin visibility:** per-event registrations page in `/admin` with a table, summary
  counts (shirts by size, lunches by meal, dinners sold), and CSV export.
- **Templatization level (Approach A):** fixed form shape, admin-tunable parameters via
  a JSON config per event. Not a free-form form builder; a genuinely new question type
  is a (small) code change.

## Data model

### `events` — new columns

| Column | Type | Notes |
|---|---|---|
| `registration_deadline` | `timestamptz` (nullable) | Null = open until `event_date`. |
| `registration_config` | `jsonb` | Template settings, shape below. |

```jsonc
{
  "meals": [
    { "key": "thursday_lunch", "label": "Thursday Lunch",
      "options": ["Fish & Chips", "Cheese Burger", "Burger (no cheese)", "Caesar Salad", "Pork Taco"],
      "note": "Message us if you have dietary restrictions" }
  ],
  "addons": [
    { "key": "thursday_dinner", "label": "Thursday Dinner", "price_cents": 19900, "max_qty": 2 }
  ],
  "car_options": [
    { "make": "Aston Martin", "models": ["All models"] },
    { "make": "Audi", "models": ["R8"] },
    { "make": "Bugatti", "models": ["All models"] },
    { "make": "Chevrolet", "models": ["C8 Z06", "C8 ZR1"] },
    { "make": "Ferrari", "models": ["All models"] },
    { "make": "Koenigsegg", "models": ["All models"] },
    { "make": "Lamborghini", "models": ["All models"] },
    { "make": "Lotus", "models": ["All models"] },
    { "make": "McLaren", "models": ["All models"] },
    { "make": "Mercedes Benz", "models": ["AMG GTR/GTS/GTC", "AMG McLaren"] },
    { "make": "Pagani", "models": ["All models"] },
    { "make": "Porsche", "models": ["718 GTS/GT4/GT4RS", "991.1/991.2",
      "GT3/3RS/Turbo/Turbo S/GTS", "All 992 models", "918"] }
  ],
  "shirt_sizes": ["XS", "SML", "MED", "LRG", "XL", "XXL", "3XL"],
  "passenger_enabled": true,
  "waiver_text": "..."
}
```

Notes:
- Existing `price_cents` remains the per-car base price (59900 for Monterey).
- The car dropdown always appends an "Other / not listed" choice that reveals a
  free-text input, with the "If you don't see your car make/model here, message us!"
  copy. Choosing an "All models" entry also reveals a free-text model input.
- Meal selection applies to the driver and, when present, the passenger (one meal
  option per person).
- New events are pre-filled from the Monterey config (the standard template).

### `registrations` — restructured

| Column | Type | Notes |
|---|---|---|
| `status` | `text` | `pending` → `paid` (webhook flips it). Check constraint. |
| `first_name`, `last_name` | `text not null` | Replaces single `name`. |
| `email` | `text not null` | |
| `phone` | `text` | Optional. |
| `shirt_size` | `text not null` | |
| `car_make`, `car_model` | `text not null` | From dropdown or manual entry. |
| `has_passenger` | `boolean not null` | |
| `passenger_first_name`, `passenger_last_name` | `text` | Required iff `has_passenger`. |
| `passenger_shirt_size` | `text` | Required iff `has_passenger`. |
| `answers` | `jsonb` | Meal choices (driver + passenger), add-on quantities, IG/FB handles, passenger IG/FB. |
| `waiver_accepted_at` | `timestamptz not null` | The waiver acceptance record. |
| `amount_paid_cents` | `integer` | Itemized total actually charged (set by webhook). |
| `stripe_session_id` | `text unique` | Unchanged. |

- RLS stays default-deny; rows are written server-side with the service role.
- `pending` rows from abandoned checkouts are inert — every read surface (admin
  table, counts, CSV) filters to `paid`. No cleanup job in v1.

## Public flow

1. `/events` card Register button → **`/events/[id]/register`** (event detail + form).
   Button renders only for published events whose deadline (or event date) hasn't passed.
2. Single-page form; passenger sub-section (name*, shirt size*, IG/FB, meal choice)
   expands when "Do you have a passenger?" = yes. Dinner add-on dropdown lists
   "$398 for 2" before "$199 for 1". Waiver text + required checkbox at the bottom.
3. POST `/api/checkout` (extended):
   - Re-validates every field server-side against `registration_config`: required
     fields, meal options exist in config, add-on qty ≤ `max_qty`, shirt size in list,
     waiver accepted, deadline not passed. Client-side validation is UX only.
   - Inserts a `pending` registration row.
   - Creates a Stripe Checkout session with **itemized `line_items`** priced from
     config (inline `price_data`, no Stripe Products): e.g. `Monterey Rally 2026
     Registration — $599.00` and `Thursday Dinner × 2 — $199.00 each`. No
     `custom_fields`. Registration row id goes in `metadata`.
4. Webhook `checkout.session.completed` marks the row `paid` and records
   `amount_paid_cents` from the session. Webhook remains the source of truth;
   `/events/success` stays read-only.

## Admin panel

### Event form (new + edit): "Registration settings" section

- Registration deadline (date-time picker, optional).
- Meals: add/remove meal sections; each with label, note, editable option list.
- Paid add-ons: add/remove rows (label, per-person price, max quantity).
- Car list: grouped make → models editor (one make per block, textarea-style).
- Shirt sizes: editable list, default XS–3XL.
- Passenger section toggle.
- Waiver text textarea.
- "New event" pre-fills everything from the Monterey template.
- Server action validates config before save (no negative prices, no empty option
  lists, non-empty labels); writes `admin_audit_log` like all other mutations.

### New page: `/admin/events/[id]/registrations`

- Read-only table of **paid** registrations: name, email, phone, car, shirt sizes,
  passenger details, meal choices, add-ons, amount, date.
- Summary counts at top: shirts by size (driver + passenger combined), lunches by
  meal, dinners sold, total cars, gross revenue.
- CSV export of the full table.
- Refunds remain a Stripe-dashboard operation; the row stays as history.

## Edge cases

- **Deadline race:** enforced in `/api/checkout`, not just at render — a form loaded
  before the deadline but submitted after is rejected with a clear message.
- **Price edits mid-flight:** line items are priced when the Checkout session is
  created; the webhook records what Stripe actually charged.
- **Tampering:** no price, total, or option ever trusted from the client.
- **Malformed config:** admin save is rejected; the public form additionally renders
  defensively (missing config section → section omitted).
- **Waiver text pending:** the real liability text must come from the club. Seed with
  clearly-marked placeholder copy; it's admin-editable, so swapping in the final text
  is a content change, not a deploy.

## Testing

- Spec coverage for the checkout validator: each required field, bogus meal option,
  add-on over `max_qty`, expired deadline, tampered price/total ignored.
- Webhook specs extended for pending→paid and idempotent re-delivery (existing pattern).
- Playwright e2e: full Monterey form including passenger branch through test-mode
  Stripe with itemized line-item assertions (gated like the existing Stripe spec);
  admin specs for editing registration settings and viewing/exporting registrations.
- Seed update: full Monterey Rally 2026 config on the seeded event.

## Out of scope (v1)

- Refunds/cancellation self-service, editing a registration after payment.
- Dietary-restriction structured field ("message us" copy instead).
- Waitlists, capacity limits, multi-car registration in one checkout.
- Pending-row cleanup job.
- DNS cutover to ssrgofficial.com — separate task (playbook in CLAUDE.md).
