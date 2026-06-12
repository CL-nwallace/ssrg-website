# Event Registration Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stripe `custom_fields` checkout with a templatized on-site registration form (Monterey Rally 2026 shape), itemized Stripe Checkout, admin-editable per-event settings, and an admin registrations view with CSV export.

**Architecture:** Each event row carries a `registration_config` JSONB (meals, paid add-ons, car list, shirt sizes, passenger toggle, waiver text) plus a `registration_deadline`. A new public page `/events/[id]/register` renders the form from config and POSTs JSON to `/api/checkout`, which re-validates server-side, inserts a `pending` registration row, and creates an itemized Stripe Checkout session. The webhook flips the row to `paid`. Spec: `docs/superpowers/specs/2026-06-11-event-registration-template-design.md`.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS, service-role writes), Stripe Checkout (inline `price_data`), Playwright e2e (no unit-test runner in this repo — pure libs are exercised through the API specs).

---

## Conventions for the implementing engineer

- All commands run from the repo root `/Users/nico/ssrg-website/ssrg-website`.
- Playwright starts its own server (`npm run build && npm run start`) per `playwright.config.ts`. Run single specs with `--project=desktop` to skip the mobile/tablet duplicates while iterating; the final task runs everything.
- `.env.local` already holds `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (test mode), `STRIPE_WEBHOOK_SECRET`, `TEST_AUTH_SECRET`. Specs and routes rely on these.
- Commit after every green step; never commit with failing specs for the code under change.

## File map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0005_registration_template.sql` | Create | events config columns; registrations lifecycle + structured fields |
| `supabase/seed.sql` | Modify | Seed Monterey Rally 2026 with full config |
| `lib/supabase/service.ts` | Create | Shared service-role Supabase client |
| `lib/registration/config.ts` | Create | Config types, `MONTEREY_TEMPLATE`, `parseRegistrationConfig`, `effectiveConfig` |
| `lib/registration/validate.ts` | Create | `validateSubmission` — server-side form validation + line items |
| `lib/registration/admin-data.ts` | Create | `fetchPaidRegistrations` for admin page + CSV route |
| `lib/registration/csv.ts` | Create | `registrationsToCsv` |
| `app/api/checkout/route.ts` | Rewrite | JSON API: validate → pending row → itemized session |
| `app/api/stripe/webhook/route.ts` | Rewrite | pending→paid by `metadata.registration_id` |
| `app/(public)/events/[id]/register/page.tsx` | Create | Event detail + form (or closed state) |
| `app/(public)/events/[id]/register/RegistrationForm.tsx` | Create | Client form |
| `components/EventCard.tsx` | Modify | Register button → link; closed state |
| `app/(public)/events/page.tsx` | Modify | Pass `registrationOpen` |
| `app/admin/(protected)/events/actions.ts` | Modify | Parse + validate registration settings |
| `components/admin/RegistrationSettingsFields.tsx` | Create | Admin config editor (serializes to hidden JSON input) |
| `app/admin/(protected)/events/new/page.tsx` | Modify | Include settings, pre-filled from template |
| `app/admin/(protected)/events/[id]/page.tsx` + `EditEventForm.tsx` | Modify | Load + edit settings |
| `app/admin/(protected)/events/page.tsx` | Modify | "Registrations" link per row |
| `app/admin/(protected)/events/[id]/registrations/page.tsx` | Create | Paid registrations table + summary counts |
| `app/admin/(protected)/events/[id]/registrations/export/route.ts` | Create | CSV download |
| `e2e/helpers/registrations.ts` | Modify | New row type, config-aware seeding, pending-row helper |
| `e2e/helpers/stripe-webhook.ts` | Modify | Payload uses `registration_id` metadata, no custom_fields |
| `e2e/registration-checkout.spec.ts` | Create | API validation suite (replaces `checkout-api.spec.ts`) |
| `e2e/checkout-api.spec.ts` | Delete | Replaced |
| `e2e/stripe-webhook.spec.ts` | Rewrite | pending→paid lifecycle |
| `e2e/registration-page.spec.ts` | Create | Browser form flow + closed states |
| `e2e/events.spec.ts` | Modify | Monterey card assertions |
| `e2e/stripe-checkout.spec.ts` | Rewrite | Gated full-payment e2e via new form |
| `e2e/admin-registration-settings.spec.ts` | Create | Admin config editing |
| `e2e/admin-registrations.spec.ts` | Create | Registrations view + CSV |
| `CLAUDE.md` | Modify | Document new flow |

---

### Task 1: Migration + seed

**Files:**
- Create: `supabase/migrations/0005_registration_template.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0005_registration_template.sql
-- Templatized event registration (spec: docs/superpowers/specs/2026-06-11-event-registration-template-design.md).
-- events: per-event registration settings. registrations: pending->paid lifecycle
-- with structured registrant fields; legacy columns (name, car_make_model,
-- instagram_handle) stay for historical rows but are no longer written.

alter table public.events
  add column if not exists registration_deadline timestamptz,
  add column if not exists registration_config jsonb;

alter table public.registrations
  alter column name drop not null,
  alter column car_make_model drop not null,
  alter column amount_paid_cents drop not null;

alter table public.registrations
  add column if not exists status text not null default 'pending',
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists shirt_size text,
  add column if not exists car_make text,
  add column if not exists car_model text,
  add column if not exists has_passenger boolean,
  add column if not exists passenger_first_name text,
  add column if not exists passenger_last_name text,
  add column if not exists passenger_shirt_size text,
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists waiver_accepted_at timestamptz;

alter table public.registrations
  drop constraint if exists registrations_status_check;
alter table public.registrations
  add constraint registrations_status_check check (status in ('pending', 'paid'));

-- Every pre-existing row was inserted by the webhook after payment.
update public.registrations set status = 'paid' where stripe_session_id is not null;

create index if not exists registrations_event_status_idx
  on public.registrations (event_id, status);
```

- [ ] **Step 2: Append the Monterey Rally seed**

Append to the end of `supabase/seed.sql`:

```sql
-- Monterey Rally 2026: first event on the registration template (added 2026-06-11).
-- The config shape must match RegistrationConfig in lib/registration/config.ts.
insert into public.events
  (title, event_date, price_cents, description_html, cover_image_path, status,
   registration_deadline, registration_config)
select
  'Monterey Rally 2026',
  timestamptz '2026-08-14 09:00:00-07',
  59900,
  '<p>Three days of driving, dinners, and Car Week. Base registration is per car and includes Thursday and Saturday lunch for driver and passenger.</p>',
  null,
  'published',
  timestamptz '2026-08-13 23:59:00-07',
  '{
    "meals": [
      {
        "key": "thursday_lunch",
        "label": "Thursday Lunch",
        "note": "Message us if you have dietary restrictions.",
        "options": ["Fish & Chips", "Cheese Burger", "Burger (no cheese)", "Caesar Salad", "Pork Taco"]
      }
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
      { "make": "Porsche", "models": ["718 GTS/GT4/GT4RS", "991.1/991.2", "GT3/3RS/Turbo/Turbo S/GTS", "All 992 models", "918"] }
    ],
    "shirt_sizes": ["XS", "SML", "MED", "LRG", "XL", "XXL", "3XL"],
    "passenger_enabled": true,
    "waiver_text": "PLACEHOLDER WAIVER — final liability text pending from the club. By checking the box you acknowledge that motorsport and group-drive activities carry inherent risk and you release SSRG, its organizers, and venues from liability for injury or property damage arising from participation."
  }'::jsonb
where not exists (select 1 from public.events e where e.title = 'Monterey Rally 2026');
```

- [ ] **Step 3: Apply and verify**

Run: `npx supabase db push --include-seed`
Then: `npx supabase db query "select title, registration_deadline, registration_config->'addons'->0->>'label' as addon from public.events where title = 'Monterey Rally 2026'" --linked`
Expected: one row, addon = `Thursday Dinner`.
Then: `npx supabase db query "select column_name from information_schema.columns where table_name = 'registrations' and column_name in ('status','answers','waiver_accepted_at')" --linked`
Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_registration_template.sql supabase/seed.sql
git commit -m "Add registration template schema + Monterey Rally seed"
```

---

### Task 2: Config module + service client

**Files:**
- Create: `lib/supabase/service.ts`
- Create: `lib/registration/config.ts`

Behavioral coverage for this module lands in Task 5's API spec (no unit runner in this repo); this task gates on `tsc`.

- [ ] **Step 1: Create `lib/supabase/service.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — server-side only
 * (API routes, admin server components). NEVER import from a "use client" file.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 2: Create `lib/registration/config.ts`**

```ts
export type MealSection = {
  key: string;
  label: string;
  note: string;
  options: string[];
};

export type Addon = {
  key: string;
  label: string;
  price_cents: number;
  max_qty: number;
};

export type CarOption = { make: string; models: string[] };

export type RegistrationConfig = {
  meals: MealSection[];
  addons: Addon[];
  car_options: CarOption[];
  shirt_sizes: string[];
  passenger_enabled: boolean;
  waiver_text: string;
};

/** Model entry whose selection requires the registrant to type their model. */
export const ALL_MODELS = "All models";
/** Make choice (always appended in the UI) for cars not in the list. */
export const OTHER_MAKE = "Other / not listed";

export const MONTEREY_TEMPLATE: RegistrationConfig = {
  meals: [
    {
      key: "thursday_lunch",
      label: "Thursday Lunch",
      note: "Message us if you have dietary restrictions.",
      options: [
        "Fish & Chips",
        "Cheese Burger",
        "Burger (no cheese)",
        "Caesar Salad",
        "Pork Taco",
      ],
    },
  ],
  addons: [
    { key: "thursday_dinner", label: "Thursday Dinner", price_cents: 19900, max_qty: 2 },
  ],
  car_options: [
    { make: "Aston Martin", models: [ALL_MODELS] },
    { make: "Audi", models: ["R8"] },
    { make: "Bugatti", models: [ALL_MODELS] },
    { make: "Chevrolet", models: ["C8 Z06", "C8 ZR1"] },
    { make: "Ferrari", models: [ALL_MODELS] },
    { make: "Koenigsegg", models: [ALL_MODELS] },
    { make: "Lamborghini", models: [ALL_MODELS] },
    { make: "Lotus", models: [ALL_MODELS] },
    { make: "McLaren", models: [ALL_MODELS] },
    { make: "Mercedes Benz", models: ["AMG GTR/GTS/GTC", "AMG McLaren"] },
    { make: "Pagani", models: [ALL_MODELS] },
    {
      make: "Porsche",
      models: [
        "718 GTS/GT4/GT4RS",
        "991.1/991.2",
        "GT3/3RS/Turbo/Turbo S/GTS",
        "All 992 models",
        "918",
      ],
    },
  ],
  shirt_sizes: ["XS", "SML", "MED", "LRG", "XL", "XXL", "3XL"],
  passenger_enabled: true,
  waiver_text:
    "PLACEHOLDER WAIVER — final liability text pending from the club. By checking the box you acknowledge that motorsport and group-drive activities carry inherent risk and you release SSRG, its organizers, and venues from liability for injury or property damage arising from participation.",
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);
}

/**
 * Strict structural validation. Returns null on any problem — callers decide
 * whether that means "reject the save" (admin) or "fall back" (public read).
 */
export function parseRegistrationConfig(raw: unknown): RegistrationConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.meals)) return null;
  const meals: MealSection[] = [];
  for (const m of o.meals) {
    if (typeof m !== "object" || m === null) return null;
    const mm = m as Record<string, unknown>;
    if (!isNonEmptyString(mm.key) || !isNonEmptyString(mm.label) || !isStringArray(mm.options)) {
      return null;
    }
    meals.push({
      key: mm.key,
      label: mm.label,
      note: typeof mm.note === "string" ? mm.note : "",
      options: mm.options,
    });
  }

  if (!Array.isArray(o.addons)) return null;
  const addons: Addon[] = [];
  for (const a of o.addons) {
    if (typeof a !== "object" || a === null) return null;
    const aa = a as Record<string, unknown>;
    if (!isNonEmptyString(aa.key) || !isNonEmptyString(aa.label)) return null;
    if (!Number.isInteger(aa.price_cents) || (aa.price_cents as number) < 0) return null;
    if (!Number.isInteger(aa.max_qty) || (aa.max_qty as number) < 1) return null;
    addons.push({
      key: aa.key,
      label: aa.label,
      price_cents: aa.price_cents as number,
      max_qty: aa.max_qty as number,
    });
  }

  if (!Array.isArray(o.car_options) || o.car_options.length === 0) return null;
  const car_options: CarOption[] = [];
  for (const c of o.car_options) {
    if (typeof c !== "object" || c === null) return null;
    const cc = c as Record<string, unknown>;
    if (!isNonEmptyString(cc.make) || !isStringArray(cc.models)) return null;
    car_options.push({ make: cc.make, models: cc.models });
  }

  if (!isStringArray(o.shirt_sizes)) return null;
  if (typeof o.passenger_enabled !== "boolean") return null;
  if (!isNonEmptyString(o.waiver_text)) return null;

  // Duplicate keys would make `answers` ambiguous.
  const keys = [...meals.map((m) => m.key), ...addons.map((a) => a.key)];
  if (new Set(keys).size !== keys.length) return null;

  return {
    meals,
    addons,
    car_options,
    shirt_sizes: o.shirt_sizes,
    passenger_enabled: o.passenger_enabled,
    waiver_text: o.waiver_text,
  };
}

/**
 * Events saved before this feature (or with a corrupted config) fall back to
 * the Monterey template — it is "the standard" per the spec.
 */
export function effectiveConfig(raw: unknown): RegistrationConfig {
  return parseRegistrationConfig(raw) ?? MONTEREY_TEMPLATE;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (same set of pre-existing errors as on `main`, if any — run on a clean tree first to baseline).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/service.ts lib/registration/config.ts
git commit -m "Add registration config types, template, and service client"
```

---

### Task 3: Submission validator

**Files:**
- Create: `lib/registration/validate.ts`

- [ ] **Step 1: Create `lib/registration/validate.ts`**

```ts
import { type RegistrationConfig, ALL_MODELS, OTHER_MAKE } from "./config";

export type LineItem = { label: string; unit_amount_cents: number; quantity: number };

export type ValidatedRegistration = {
  row: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    shirt_size: string;
    car_make: string;
    car_model: string;
    has_passenger: boolean;
    passenger_first_name: string | null;
    passenger_last_name: string | null;
    passenger_shirt_size: string | null;
    answers: {
      instagram: string | null;
      facebook: string | null;
      passenger_social: string | null;
      meals: Record<string, { driver: string; passenger?: string }>;
      addons: Record<string, number>;
    };
  };
  lineItems: LineItem[];
  totalCents: number;
};

export type ValidationResult =
  | { ok: true; value: ValidatedRegistration }
  | { ok: false; error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * The single authority on what a valid registration submission is.
 * Client-side validation is UX only; every rule lives here.
 * Prices come exclusively from `config` and `basePriceCents` — nothing
 * money-related is read from `input`.
 */
export function validateSubmission(
  config: RegistrationConfig,
  basePriceCents: number,
  baseLabel: string,
  input: unknown,
): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid submission." };
  }
  const o = input as Record<string, unknown>;

  const first_name = str(o.first_name);
  const last_name = str(o.last_name);
  if (!first_name || !last_name) {
    return { ok: false, error: "First and last name are required." };
  }

  const email = str(o.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid email address is required." };
  }

  const phone = str(o.phone) || null;

  const shirt_size = str(o.shirt_size);
  if (!config.shirt_sizes.includes(shirt_size)) {
    return { ok: false, error: "Please select a t-shirt size." };
  }

  // Car: curated dropdown, with two manual-entry paths (OTHER_MAKE, ALL_MODELS).
  const carMakeInput = str(o.car_make);
  const carModelInput = str(o.car_model);
  const carModelOther = str(o.car_model_other);
  let car_make: string;
  let car_model: string;
  if (carMakeInput === OTHER_MAKE) {
    if (!carModelOther) {
      return { ok: false, error: "Please enter your car make and model." };
    }
    car_make = OTHER_MAKE;
    car_model = carModelOther;
  } else {
    const makeEntry = config.car_options.find((c) => c.make === carMakeInput);
    if (!makeEntry) return { ok: false, error: "Please select your car make." };
    if (!makeEntry.models.includes(carModelInput)) {
      return { ok: false, error: "Please select your car model." };
    }
    car_make = makeEntry.make;
    car_model = carModelInput === ALL_MODELS ? carModelOther : carModelInput;
    if (!car_model) return { ok: false, error: "Please type your car model." };
  }

  if (config.passenger_enabled && typeof o.has_passenger !== "boolean") {
    return { ok: false, error: "Please tell us whether you have a passenger." };
  }
  const has_passenger = config.passenger_enabled && o.has_passenger === true;

  let passenger_first_name: string | null = null;
  let passenger_last_name: string | null = null;
  let passenger_shirt_size: string | null = null;
  let passenger_social: string | null = null;
  if (has_passenger) {
    const p = (typeof o.passenger === "object" && o.passenger !== null
      ? o.passenger
      : {}) as Record<string, unknown>;
    passenger_first_name = str(p.first_name);
    passenger_last_name = str(p.last_name);
    passenger_shirt_size = str(p.shirt_size);
    passenger_social = str(p.social) || null;
    if (!passenger_first_name || !passenger_last_name) {
      return { ok: false, error: "Passenger first and last name are required." };
    }
    if (!config.shirt_sizes.includes(passenger_shirt_size)) {
      return { ok: false, error: "Please select a t-shirt size for your passenger." };
    }
  }

  // Meals: one choice per person per configured section.
  const mealsInput = (typeof o.meals === "object" && o.meals !== null
    ? o.meals
    : {}) as Record<string, unknown>;
  const meals: Record<string, { driver: string; passenger?: string }> = {};
  for (const section of config.meals) {
    const choice = (typeof mealsInput[section.key] === "object" && mealsInput[section.key] !== null
      ? mealsInput[section.key]
      : {}) as Record<string, unknown>;
    const driver = str(choice.driver);
    if (!section.options.includes(driver)) {
      return { ok: false, error: `Please pick a ${section.label} option.` };
    }
    if (has_passenger) {
      const passenger = str(choice.passenger);
      if (!section.options.includes(passenger)) {
        return { ok: false, error: `Please pick a ${section.label} option for your passenger.` };
      }
      meals[section.key] = { driver, passenger };
    } else {
      meals[section.key] = { driver };
    }
  }

  // Add-ons: integer quantity 0..max_qty; unknown keys rejected.
  const addonsInput = (typeof o.addons === "object" && o.addons !== null
    ? o.addons
    : {}) as Record<string, unknown>;
  for (const key of Object.keys(addonsInput)) {
    if (!config.addons.some((a) => a.key === key)) {
      return { ok: false, error: "Unknown add-on selected." };
    }
  }
  const addons: Record<string, number> = {};
  const lineItems: LineItem[] = [
    { label: `${baseLabel} — Registration`, unit_amount_cents: basePriceCents, quantity: 1 },
  ];
  for (const addon of config.addons) {
    const rawQty = addonsInput[addon.key] ?? 0;
    if (!Number.isInteger(rawQty) || (rawQty as number) < 0 || (rawQty as number) > addon.max_qty) {
      return { ok: false, error: `Invalid quantity for ${addon.label}.` };
    }
    const qty = rawQty as number;
    if (qty > 0) {
      addons[addon.key] = qty;
      lineItems.push({ label: addon.label, unit_amount_cents: addon.price_cents, quantity: qty });
    }
  }

  if (o.waiver_accepted !== true) {
    return { ok: false, error: "You must accept the waiver to register." };
  }

  const totalCents = lineItems.reduce((sum, li) => sum + li.unit_amount_cents * li.quantity, 0);

  return {
    ok: true,
    value: {
      row: {
        first_name,
        last_name,
        email,
        phone,
        shirt_size,
        car_make,
        car_model,
        has_passenger,
        passenger_first_name: has_passenger ? passenger_first_name : null,
        passenger_last_name: has_passenger ? passenger_last_name : null,
        passenger_shirt_size: has_passenger ? passenger_shirt_size : null,
        answers: {
          instagram: str(o.instagram) || null,
          facebook: str(o.facebook) || null,
          passenger_social,
          meals,
          addons,
        },
      },
      lineItems,
      totalCents,
    },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/registration/validate.ts
git commit -m "Add server-side registration submission validator"
```

---

### Task 4: e2e helper updates

**Files:**
- Modify: `e2e/helpers/registrations.ts` (full rewrite below)
- Modify: `e2e/helpers/stripe-webhook.ts` (full rewrite below)

These helpers are consumed by Tasks 5–10. The old `name`/`car_make_model` shapes go away.

- [ ] **Step 1: Rewrite `e2e/helpers/registrations.ts`**

```ts
import { serviceClient } from "./admin-session";

export type RegistrationRow = {
  id: string;
  event_id: string;
  stripe_session_id: string | null;
  status: "pending" | "paid";
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  shirt_size: string | null;
  car_make: string | null;
  car_model: string | null;
  has_passenger: boolean | null;
  passenger_first_name: string | null;
  passenger_last_name: string | null;
  passenger_shirt_size: string | null;
  answers: {
    instagram?: string | null;
    facebook?: string | null;
    passenger_social?: string | null;
    meals?: Record<string, { driver?: string; passenger?: string }>;
    addons?: Record<string, number>;
  };
  waiver_accepted_at: string | null;
  amount_paid_cents: number | null;
  created_at: string;
};

/**
 * Insert a published test event via the service-role client. Returns its id.
 * registration_config defaults to null, which the app treats as the Monterey
 * template (effectiveConfig fallback). Caller must call deleteTestEvent.
 */
export async function seedTestEvent(args: {
  title: string;
  price_cents: number;
  registration_deadline?: string;
  registration_config?: unknown;
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
      registration_deadline: args.registration_deadline ?? null,
      registration_config: args.registration_config ?? null,
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
 * `registrations.event_id` is ON DELETE RESTRICT, so registrations go first.
 */
export async function deleteTestEvent(eventId: string): Promise<void> {
  const supabase = serviceClient();
  await supabase.from("registrations").delete().eq("event_id", eventId);
  await supabase.from("events").delete().eq("id", eventId);
}

/**
 * Insert a pending registration row directly (simulating what /api/checkout
 * does before redirecting to Stripe). Returns the row id.
 */
export async function insertPendingRegistration(
  eventId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      event_id: eventId,
      status: "pending",
      email: "pending@example.com",
      first_name: "Pending",
      last_name: "Buyer",
      shirt_size: "LRG",
      car_make: "Porsche",
      car_model: "918",
      has_passenger: false,
      answers: { meals: { thursday_lunch: { driver: "Pork Taco" } }, addons: {} },
      waiver_accepted_at: new Date().toISOString(),
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("insertPendingRegistration: insert returned no row");
  }
  return data.id;
}

/** One-shot lookup by row id. */
export async function getRegistrationById(id: string): Promise<RegistrationRow | null> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RegistrationRow | null) ?? null;
}

/** One-shot lookup by Stripe session id. Returns null if no row. */
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
 * Poll until at least one registrations row exists for the given event,
 * optionally filtered by status. Returns the most recent one.
 */
export async function waitForRegistration(
  eventId: string,
  opts: { timeoutMs?: number; status?: "pending" | "paid" } = {},
): Promise<RegistrationRow> {
  const timeout = opts.timeoutMs ?? 15_000;
  const start = Date.now();
  const supabase = serviceClient();
  while (Date.now() - start < timeout) {
    let query = supabase
      .from("registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (opts.status) query = query.eq("status", opts.status);
    const { data } = await query.maybeSingle();
    if (data) return data as RegistrationRow;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `waitForRegistration: timed out after ${timeout}ms for event ${eventId}`,
  );
}

/** Count of registration rows for an event. Used to assert idempotency. */
export async function countRegistrations(eventId: string): Promise<number> {
  const supabase = serviceClient();
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
```

- [ ] **Step 2: Rewrite `e2e/helpers/stripe-webhook.ts`**

```ts
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
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit` — expect exit 0. (`e2e/stripe-webhook.spec.ts` and `e2e/stripe-checkout.spec.ts` will now have type errors because they use the old helper shapes — that is expected; they are rewritten in Tasks 6 and 8. If `tsc` flags only those two spec files, proceed.)

```bash
git add e2e/helpers/registrations.ts e2e/helpers/stripe-webhook.ts
git commit -m "Update e2e helpers for registration lifecycle"
```

---

### Task 5: `/api/checkout` rewrite (spec-first)

**Files:**
- Create: `e2e/registration-checkout.spec.ts`
- Delete: `e2e/checkout-api.spec.ts`
- Rewrite: `app/api/checkout/route.ts`

- [ ] **Step 1: Write the failing spec**

Create `e2e/registration-checkout.spec.ts`:

```ts
import { test, expect, request as pwRequest } from "@playwright/test";
import Stripe from "stripe";
import {
  seedTestEvent,
  deleteTestEvent,
  waitForRegistration,
  countRegistrations,
} from "./helpers/registrations";

const CHECKOUT_URL = "http://localhost:3000/api/checkout";

function validBody(eventId: string): Record<string, unknown> {
  return {
    event_id: eventId,
    first_name: "Test",
    last_name: "Driver",
    email: "driver@example.com",
    phone: "555-0100",
    shirt_size: "LRG",
    instagram: "@driver",
    facebook: "",
    car_make: "Porsche",
    car_model: "918",
    car_model_other: "",
    has_passenger: true,
    passenger: { first_name: "Pat", last_name: "Rider", shirt_size: "MED", social: "@pat" },
    meals: { thursday_lunch: { driver: "Pork Taco", passenger: "Caesar Salad" } },
    addons: { thursday_dinner: 2 },
    waiver_accepted: true,
  };
}

async function postCheckout(body: unknown) {
  const api = await pwRequest.newContext();
  return api.post(CHECKOUT_URL, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify(body),
  });
}

test.describe("/api/checkout (registration template)", () => {
  let eventId: string;

  test.beforeEach(async () => {
    // No registration_config => effectiveConfig falls back to the Monterey template.
    eventId = await seedTestEvent({
      title: `Checkout Spec ${Date.now()}`,
      price_cents: 1234,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("valid submission: pending row + itemized Stripe session", async () => {
    const res = await postCheckout(validBody(eventId));
    expect(res.status()).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.first_name).toBe("Test");
    expect(row.shirt_size).toBe("LRG");
    expect(row.car_make).toBe("Porsche");
    expect(row.car_model).toBe("918");
    expect(row.has_passenger).toBe(true);
    expect(row.passenger_first_name).toBe("Pat");
    expect(row.answers.addons!.thursday_dinner).toBe(2);
    expect(row.answers.meals!.thursday_lunch.passenger).toBe("Caesar Salad");
    expect(row.waiver_accepted_at).not.toBeNull();
    expect(row.amount_paid_cents).toBeNull();
    expect(row.stripe_session_id).toMatch(/^cs_/);

    // Itemization is real on Stripe's side: base 1234 + dinner 19900 x 2.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id!);
    expect(session.amount_total).toBe(1234 + 19900 * 2);
    const items = await stripe.checkout.sessions.listLineItems(row.stripe_session_id!);
    const amounts = items.data
      .map((i) => ({ qty: i.quantity, unit: i.price?.unit_amount }))
      .sort((a, b) => (a.unit ?? 0) - (b.unit ?? 0));
    expect(amounts).toEqual([
      { qty: 1, unit: 1234 },
      { qty: 2, unit: 19900 },
    ]);
  });

  test("client-sent prices are ignored", async () => {
    const body = {
      ...validBody(eventId),
      addons: { thursday_dinner: 1 },
      price_cents: 1, // attacker-controlled junk the server must ignore
      total_cents: 1,
      amount: 1,
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(200);
    const row = await waitForRegistration(eventId, { status: "pending" });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id!);
    expect(session.amount_total).toBe(1234 + 19900);
  });

  test("no passenger, no add-ons: single line item", async () => {
    const body = {
      ...validBody(eventId),
      has_passenger: false,
      passenger: undefined,
      meals: { thursday_lunch: { driver: "Caesar Salad" } },
      addons: {},
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(200);
    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.has_passenger).toBe(false);
    expect(row.passenger_first_name).toBeNull();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id!);
    expect(session.amount_total).toBe(1234);
  });

  test("manual car entry via Other / not listed", async () => {
    const body = {
      ...validBody(eventId),
      car_make: "Other / not listed",
      car_model: "",
      car_model_other: "Nissan GT-R NISMO",
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(200);
    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.car_make).toBe("Other / not listed");
    expect(row.car_model).toBe("Nissan GT-R NISMO");
  });

  test("All models selection requires a typed model", async () => {
    const body = {
      ...validBody(eventId),
      car_make: "Ferrari",
      car_model: "All models",
      car_model_other: "",
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/type your car model/i);
  });

  test("rejections: each invalid field returns 400 and writes no row", async () => {
    const cases: Array<Record<string, unknown>> = [
      { ...validBody(eventId), first_name: "" },
      { ...validBody(eventId), email: "not-an-email" },
      { ...validBody(eventId), shirt_size: "XXXXL" },
      { ...validBody(eventId), car_make: "Yugo", car_model: "45" },
      { ...validBody(eventId), meals: { thursday_lunch: { driver: "Sushi", passenger: "Caesar Salad" } } },
      { ...validBody(eventId), addons: { thursday_dinner: 3 } },
      { ...validBody(eventId), addons: { bogus_addon: 1 } },
      { ...validBody(eventId), waiver_accepted: false },
      { ...validBody(eventId), has_passenger: true, passenger: { first_name: "", last_name: "", shirt_size: "MED" } },
    ];
    for (const body of cases) {
      const res = await postCheckout(body);
      expect(res.status(), JSON.stringify(body)).toBe(400);
    }
    expect(await countRegistrations(eventId)).toBe(0);
  });

  test("410 once the registration deadline has passed", async () => {
    const closedId = await seedTestEvent({
      title: `Closed Checkout ${Date.now()}`,
      price_cents: 1000,
      registration_deadline: new Date(Date.now() - 60_000).toISOString(),
    });
    const res = await postCheckout(validBody(closedId));
    expect(res.status()).toBe(410);
    expect(await countRegistrations(closedId)).toBe(0);
    await deleteTestEvent(closedId);
  });

  test("404 for unknown and draft events, 400 for bad envelope", async () => {
    const unknown = await postCheckout(validBody("00000000-0000-0000-0000-000000000000"));
    expect(unknown.status()).toBe(404);

    const { serviceClient } = await import("./helpers/admin-session");
    await serviceClient().from("events").update({ status: "draft" }).eq("id", eventId);
    const draft = await postCheckout(validBody(eventId));
    expect(draft.status()).toBe(404);

    const missingId = await postCheckout({ ...validBody(eventId), event_id: "" });
    expect(missingId.status()).toBe(400);

    const api = await pwRequest.newContext();
    const badJson = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });
    expect(badJson.status()).toBe(400);
  });
});
```

- [ ] **Step 2: Delete the old spec and run to verify failure**

```bash
git rm e2e/checkout-api.spec.ts
npx playwright test e2e/registration-checkout.spec.ts --project=desktop
```

Expected: FAIL — the route still expects form data and the old schema (status/JSON mismatches).

- [ ] **Step 3: Rewrite `app/api/checkout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { stripeServer } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { effectiveConfig } from "@/lib/registration/config";
import { validateSubmission } from "@/lib/registration/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing event_id." }, { status: 400 });
  }

  // Service role: registrations is default-deny under RLS and this route
  // must insert the pending row.
  const supabase = createSupabaseServiceClient();
  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, title, price_cents, event_date, status, registration_deadline, registration_config",
    )
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("checkout: failed to load event", error);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Deadline is enforced here, not just in the UI — a form loaded before the
  // deadline but submitted after must be rejected.
  const closesAt = new Date(event.registration_deadline ?? event.event_date);
  if (closesAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Registration for this event has closed." },
      { status: 410 },
    );
  }

  const config = effectiveConfig(event.registration_config);
  const result = validateSubmission(config, event.price_cents, event.title, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { row, lineItems, totalCents } = result.value;

  const { data: registration, error: insertErr } = await supabase
    .from("registrations")
    .insert({
      event_id: event.id,
      status: "pending",
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      shirt_size: row.shirt_size,
      car_make: row.car_make,
      car_model: row.car_model,
      has_passenger: row.has_passenger,
      passenger_first_name: row.passenger_first_name,
      passenger_last_name: row.passenger_last_name,
      passenger_shirt_size: row.passenger_shirt_size,
      answers: row.answers,
      waiver_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !registration) {
    console.error("checkout: failed to insert pending registration", insertErr);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }

  const origin =
    request.headers.get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const session = await stripeServer().checkout.sessions.create({
    mode: "payment",
    line_items: lineItems.map((li) => ({
      quantity: li.quantity,
      price_data: {
        currency: "usd",
        unit_amount: li.unit_amount_cents,
        product_data: { name: li.label },
      },
    })),
    billing_address_collection: "required",
    customer_email: row.email,
    metadata: {
      event_id: event.id,
      registration_id: registration.id,
      amount_expected_cents: String(totalCents),
    },
    success_url: `${origin}/events/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/events/${event.id}/register`,
  });

  if (!session.url) {
    console.error("checkout: Stripe returned a session without a url");
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }

  await supabase
    .from("registrations")
    .update({ stripe_session_id: session.id })
    .eq("id", registration.id);

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx playwright test e2e/registration-checkout.spec.ts --project=desktop`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/route.ts e2e/registration-checkout.spec.ts
git commit -m "Rewrite /api/checkout: validated registration form, pending row, itemized session"
```

---

### Task 6: Webhook rewrite (spec-first)

**Files:**
- Rewrite: `e2e/stripe-webhook.spec.ts`
- Rewrite: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Rewrite the spec (failing first)**

Replace the entire contents of `e2e/stripe-webhook.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/stripe-webhook.spec.ts --project=desktop`
Expected: FAIL — current route looks for `metadata.event_id` + `custom_fields` and inserts a new row.

- [ ] **Step 3: Rewrite `app/api/stripe/webhook/route.ts`**

```ts
import Stripe from "stripe";
import { stripeServer } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

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
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) {
    console.error("stripe webhook: session has no metadata.registration_id", session.id);
    return new Response("Missing registration_id metadata", { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: registration, error: regErr } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("id", registrationId)
    .maybeSingle();
  if (regErr) {
    console.error("stripe webhook: failed to load registration", regErr);
    return new Response("Internal error", { status: 500 });
  }
  if (!registration) {
    console.error("stripe webhook: registration not found", {
      sessionId: session.id,
      registrationId,
    });
    return new Response("Registration not found", { status: 400 });
  }
  // Duplicate delivery of an already-processed session.
  if (registration.status === "paid") {
    return new Response("ok", { status: 200 });
  }

  const expected = Number(session.metadata?.amount_expected_cents ?? NaN);
  if (!Number.isFinite(expected) || (session.amount_total ?? -1) !== expected) {
    console.error("stripe webhook: amount_total mismatch", {
      sessionId: session.id,
      expected,
      actual: session.amount_total,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("registrations")
    .update({
      status: "paid",
      amount_paid_cents: session.amount_total ?? 0,
      stripe_session_id: session.id,
    })
    .eq("id", registrationId);
  if (updateErr) {
    console.error("stripe webhook: update failed", updateErr);
    return new Response("Update failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx playwright test e2e/stripe-webhook.spec.ts --project=desktop`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts e2e/stripe-webhook.spec.ts
git commit -m "Webhook flips pending registration to paid via registration_id metadata"
```

---

### Task 7: Public registration page + events listing

**Files:**
- Create: `e2e/registration-page.spec.ts`
- Create: `app/(public)/events/[id]/register/page.tsx`
- Create: `app/(public)/events/[id]/register/RegistrationForm.tsx`
- Modify: `components/EventCard.tsx`
- Modify: `app/(public)/events/page.tsx`
- Modify: `e2e/events.spec.ts`

- [ ] **Step 1: Write the failing browser spec**

Create `e2e/registration-page.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import {
  seedTestEvent,
  deleteTestEvent,
  waitForRegistration,
} from "./helpers/registrations";

test.describe("Event registration page", () => {
  let eventId: string;

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `RegPage ${Date.now()}`,
      price_cents: 59900,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("register link on /events leads to the form", async ({ page }) => {
    await page.goto("/events");
    await page.locator(`[data-testid="register-link-${eventId}"]`).click();
    await page.waitForURL(`**/events/${eventId}/register`);
    await expect(page.getByTestId("registration-form")).toBeVisible();
    await expect(page.getByText(/waiver/i).first()).toBeVisible();
  });

  test("full form with passenger and dinner reaches Stripe Checkout", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/events/${eventId}/register`);

    await page.getByLabel("First name *").fill("Test");
    await page.getByLabel("Last name *").fill("Driver");
    await page.getByLabel("Email *").fill("driver@example.com");
    await page.getByLabel("Phone").fill("555-0100");
    await page.getByLabel("T-shirt size *").selectOption("LRG");
    await page.getByLabel("Instagram username").fill("@driver");
    await page.getByLabel("Car make *").selectOption("Porsche");
    await page.getByLabel("Car model *").selectOption("918");

    await page.getByLabel("I have a passenger").check();
    await page.getByLabel("Passenger first name *").fill("Pat");
    await page.getByLabel("Passenger last name *").fill("Rider");
    await page.getByLabel("Passenger t-shirt size *").selectOption("MED");

    await page.getByLabel("Thursday Lunch — your meal *").selectOption("Pork Taco");
    await page.getByLabel("Thursday Lunch — passenger meal *").selectOption("Caesar Salad");
    await page.getByLabel(/thursday dinner/i).selectOption("2");

    // Order summary reflects base + 2 dinners before submitting.
    await expect(page.getByTestId("order-summary")).toContainText("$997.00");

    await page.getByLabel("I have read and accept the waiver *").check();
    await page.getByRole("button", { name: /continue to payment/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });

    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.first_name).toBe("Test");
    expect(row.has_passenger).toBe(true);
    expect(row.answers.addons!.thursday_dinner).toBe(2);
  });

  test("manual model input appears for All models makes", async ({ page }) => {
    await page.goto(`/events/${eventId}/register`);
    await page.getByLabel("Car make *").selectOption("Ferrari");
    await page.getByLabel("Car model *").selectOption("All models");
    await expect(page.getByLabel("Your model *")).toBeVisible();
  });

  test("closed event hides the form and the events-page register link", async ({ page }) => {
    const closedTitle = `Closed ${Date.now()}`;
    const closedId = await seedTestEvent({
      title: closedTitle,
      price_cents: 1000,
      registration_deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    await page.goto(`/events/${closedId}/register`);
    await expect(page.getByTestId("registration-closed")).toBeVisible();
    await expect(page.getByTestId("registration-form")).toHaveCount(0);

    await page.goto("/events");
    await expect(page.getByText(closedTitle)).toBeVisible();
    await expect(page.locator(`[data-testid="register-link-${closedId}"]`)).toHaveCount(0);

    await deleteTestEvent(closedId);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/registration-page.spec.ts --project=desktop`
Expected: FAIL — `/events/[id]/register` 404s.

- [ ] **Step 3: Create `app/(public)/events/[id]/register/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import Hero from "@/components/Hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { effectiveConfig } from "@/lib/registration/config";
import { sanitizedHtml } from "@/lib/render-html";
import RegistrationForm from "./RegistrationForm";

export const dynamic = "force-dynamic";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default async function RegisterPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, event_date, price_cents, description_html, registration_deadline, registration_config",
    )
    .eq("id", params.id)
    .eq("status", "published")
    .maybeSingle();
  if (!event) notFound();

  const closesAt = new Date(event.registration_deadline ?? event.event_date);
  const open = closesAt.getTime() > Date.now();
  const config = effectiveConfig(event.registration_config);

  return (
    <>
      <Hero
        title={event.title}
        subtitle={new Date(event.event_date).toLocaleDateString("en-US", {
          dateStyle: "long",
        })}
        backgroundImage="/images/track-cover.jpg"
        fullHeight={false}
        showLogo={false}
      />

      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <p className="text-body text-gold font-semibold">
              {priceFormatter.format(event.price_cents / 100)} per car
            </p>
            <div
              className="mt-4 text-body text-text-secondary prose prose-invert max-w-none"
              dangerouslySetInnerHTML={sanitizedHtml(event.description_html)}
            />
          </div>

          {open ? (
            <RegistrationForm
              eventId={event.id}
              basePriceCents={event.price_cents}
              config={config}
            />
          ) : (
            <p
              className="font-serif text-subheading text-text-secondary"
              data-testid="registration-closed"
            >
              Registration for this event has closed.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Create `app/(public)/events/[id]/register/RegistrationForm.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  type RegistrationConfig,
  ALL_MODELS,
  OTHER_MAKE,
} from "@/lib/registration/config";

type Props = {
  eventId: string;
  basePriceCents: number;
  config: RegistrationConfig;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function dollars(cents: number): string {
  return usd.format(cents / 100);
}

const inputClass =
  "mt-1 w-full rounded border border-subtle bg-bg-elevated px-3 py-2 text-text-primary";
const labelClass = "block text-small text-text-secondary";
const headingClass = "font-serif text-large text-text-primary";

export default function RegistrationForm({ eventId, basePriceCents, config }: Props) {
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [hasPassenger, setHasPassenger] = useState(false);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const makeEntry = config.car_options.find((c) => c.make === carMake);
  const needsManualModel = carMake === OTHER_MAKE || carModel === ALL_MODELS;

  const totalCents = useMemo(
    () =>
      basePriceCents +
      config.addons.reduce((sum, a) => sum + (addonQty[a.key] ?? 0) * a.price_cents, 0),
    [basePriceCents, config.addons, addonQty],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);

    const meals: Record<string, { driver: string; passenger?: string }> = {};
    for (const meal of config.meals) {
      meals[meal.key] = {
        driver: String(form.get(`meal_${meal.key}_driver`) ?? ""),
        ...(hasPassenger
          ? { passenger: String(form.get(`meal_${meal.key}_passenger`) ?? "") }
          : {}),
      };
    }

    const body = {
      event_id: eventId,
      first_name: String(form.get("first_name") ?? ""),
      last_name: String(form.get("last_name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      shirt_size: String(form.get("shirt_size") ?? ""),
      instagram: String(form.get("instagram") ?? ""),
      facebook: String(form.get("facebook") ?? ""),
      car_make: carMake,
      car_model: carModel,
      car_model_other: String(form.get("car_model_other") ?? ""),
      has_passenger: hasPassenger,
      passenger: hasPassenger
        ? {
            first_name: String(form.get("passenger_first_name") ?? ""),
            last_name: String(form.get("passenger_last_name") ?? ""),
            shirt_size: String(form.get("passenger_shirt_size") ?? ""),
            social: String(form.get("passenger_social") ?? ""),
          }
        : undefined,
      meals,
      addons: addonQty,
      waiver_accepted: form.get("waiver_accepted") === "on",
    };

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setError(data.error ?? "Something went wrong. Please try again.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10" data-testid="registration-form">
      <section className="space-y-4">
        <h2 className={headingClass}>Driver</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            First name *
            <input name="first_name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Last name *
            <input name="last_name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Email *
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Phone
            <input name="phone" type="tel" className={inputClass} />
          </label>
          <label className={labelClass}>
            T-shirt size *
            <select name="shirt_size" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                — Select size —
              </option>
              {config.shirt_sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Instagram username
            <input name="instagram" className={inputClass} />
          </label>
          <label className={labelClass}>
            Facebook username
            <input name="facebook" className={inputClass} />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={headingClass}>Your car</h2>
        <p className="text-small text-text-muted">
          If you don&apos;t see your car make/model here, message us!
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Car make *
            <select
              required
              value={carMake}
              onChange={(e) => {
                setCarMake(e.target.value);
                setCarModel("");
              }}
              className={inputClass}
              aria-label="Car make *"
            >
              <option value="" disabled>
                — Select make —
              </option>
              {config.car_options.map((c) => (
                <option key={c.make} value={c.make}>
                  {c.make}
                </option>
              ))}
              <option value={OTHER_MAKE}>{OTHER_MAKE}</option>
            </select>
          </label>
          {makeEntry ? (
            <label className={labelClass}>
              Car model *
              <select
                required
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className={inputClass}
                aria-label="Car model *"
              >
                <option value="" disabled>
                  — Select model —
                </option>
                {makeEntry.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {needsManualModel ? (
            <label className={labelClass}>
              {carMake === OTHER_MAKE ? "Your car make & model *" : "Your model *"}
              <input name="car_model_other" required className={inputClass} />
            </label>
          ) : null}
        </div>
      </section>

      {config.passenger_enabled ? (
        <section className="space-y-4">
          <h2 className={headingClass}>Passenger</h2>
          <label className="flex items-center gap-2 text-small text-text-secondary">
            <input
              type="checkbox"
              checked={hasPassenger}
              onChange={(e) => setHasPassenger(e.target.checked)}
            />
            I have a passenger
          </label>
          {hasPassenger ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Passenger first name *
                <input name="passenger_first_name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Passenger last name *
                <input name="passenger_last_name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Passenger t-shirt size *
                <select
                  name="passenger_shirt_size"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    — Select size —
                  </option>
                  {config.shirt_sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Passenger Instagram/Facebook
                <input name="passenger_social" className={inputClass} />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      {config.meals.length > 0 ? (
        <section className="space-y-4">
          <h2 className={headingClass}>Meals (included)</h2>
          {config.meals.map((meal) => (
            <div key={meal.key} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={labelClass}>
                {meal.label} — your meal *
                <select
                  name={`meal_${meal.key}_driver`}
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    — Select meal —
                  </option>
                  {meal.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {meal.note ? (
                  <span className="mt-1 block text-small text-text-muted">{meal.note}</span>
                ) : null}
              </label>
              {hasPassenger ? (
                <label className={labelClass}>
                  {meal.label} — passenger meal *
                  <select
                    name={`meal_${meal.key}_passenger`}
                    required
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="" disabled>
                      — Select meal —
                    </option>
                    {meal.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {config.addons.length > 0 ? (
        <section className="space-y-4">
          <h2 className={headingClass}>Optional add-ons</h2>
          {config.addons.map((addon) => (
            <label key={addon.key} className={labelClass}>
              {addon.label} ({dollars(addon.price_cents)}/person)
              <select
                value={addonQty[addon.key] ?? 0}
                onChange={(e) =>
                  setAddonQty({ ...addonQty, [addon.key]: Number(e.target.value) })
                }
                className={inputClass}
              >
                {Array.from({ length: addon.max_qty }, (_, i) => addon.max_qty - i).map(
                  (q) => (
                    <option key={q} value={q}>
                      {q} × {addon.label} — {dollars(q * addon.price_cents)}
                    </option>
                  ),
                )}
                <option value={0}>No {addon.label}</option>
              </select>
            </label>
          ))}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className={headingClass}>Waiver</h2>
        <div className="max-h-48 overflow-y-auto rounded border border-subtle p-4 text-small text-text-secondary whitespace-pre-wrap">
          {config.waiver_text}
        </div>
        <label className="flex items-start gap-2 text-small text-text-secondary">
          <input type="checkbox" name="waiver_accepted" required className="mt-1" />
          I have read and accept the waiver *
        </label>
      </section>

      <section className="space-y-2 rounded border border-subtle p-4" data-testid="order-summary">
        <h2 className={headingClass}>Summary</h2>
        <p className="flex justify-between text-small text-text-secondary">
          <span>Registration (per car)</span>
          <span>{dollars(basePriceCents)}</span>
        </p>
        {config.addons.map((addon) => {
          const qty = addonQty[addon.key] ?? 0;
          if (qty === 0) return null;
          return (
            <p key={addon.key} className="flex justify-between text-small text-text-secondary">
              <span>
                {addon.label} × {qty}
              </span>
              <span>{dollars(qty * addon.price_cents)}</span>
            </p>
          );
        })}
        <p className="flex justify-between text-body font-semibold text-gold">
          <span>Total</span>
          <span>{dollars(totalCents)}</span>
        </p>
      </section>

      {error ? (
        <p role="alert" className="rounded bg-red-950/60 px-4 py-3 text-small text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-block px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors cursor-pointer disabled:opacity-50"
      >
        {submitting ? "Redirecting…" : `Continue to payment — ${dollars(totalCents)}`}
      </button>
    </form>
  );
}
```

Note: the two `aria-label` attributes on the car selects are needed because their `<label>` text changes are part of the wrapped content; keep them in sync with the visible text.

- [ ] **Step 5: Update `components/EventCard.tsx`**

Replace the whole file:

```tsx
import Image from "next/image";
import Link from "next/link";
import { sanitizedHtml } from "@/lib/render-html";

interface EventCardProps {
  eventId: string;
  image: string;
  title: string;
  price: string;
  descriptionHtml?: string;
  registrationOpen: boolean;
}

export default function EventCard({
  eventId,
  image,
  title,
  price,
  descriptionHtml,
  registrationOpen,
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
        {registrationOpen ? (
          <Link
            href={`/events/${eventId}/register`}
            data-testid={`register-link-${eventId}`}
            className="mt-4 inline-block px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors"
          >
            Register Now
          </Link>
        ) : (
          <p className="mt-4 text-small text-text-muted">Registration closed</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update `app/(public)/events/page.tsx`**

Change the `EventRow` type, query, and card render (rest of the file unchanged):

```tsx
type EventRow = {
  id: string;
  title: string;
  event_date: string;
  price_cents: number;
  description_html: string;
  cover_image_path: string | null;
  registration_deadline: string | null;
};
```

```tsx
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, event_date, price_cents, description_html, cover_image_path, registration_deadline",
    )
    .eq("status", "published")
    .order("event_date", { ascending: true });
```

```tsx
                {events.map((event) => {
                  const closesAt = new Date(
                    event.registration_deadline ?? event.event_date,
                  );
                  return (
                    <FadeIn key={event.id}>
                      <EventCard
                        eventId={event.id}
                        image={coverUrl(supabaseUrl, event.cover_image_path)}
                        title={event.title}
                        price={formatPrice(event.price_cents)}
                        descriptionHtml={event.description_html}
                        registrationOpen={closesAt.getTime() > Date.now()}
                      />
                    </FadeIn>
                  );
                })}
```

- [ ] **Step 7: Update `e2e/events.spec.ts`**

Replace the "event cards render" test (the seeded LA-to-Vegas event date passes on 2026-06-14, after which its Register CTA correctly disappears — so the CTA assertion moves to the Monterey card):

```ts
  test("event cards render with title, price, and CTA", async ({ page }) => {
    const eventsGrid = page.locator('[data-testid="events-grid"]');
    await expect(eventsGrid).toBeVisible();

    await expect(page.locator("text=LA to Las Vegas")).toBeVisible();
    await expect(page.locator("text=$3,000.00")).toBeVisible();

    // Monterey Rally registration stays open until 2026-08-13.
    await expect(page.locator("text=Monterey Rally 2026")).toBeVisible();
    await expect(page.locator("text=$599.00")).toBeVisible();
    await expect(page.locator("text=Register Now").first()).toBeVisible();
  });
```

- [ ] **Step 8: Run specs**

Run: `npx playwright test e2e/registration-page.spec.ts e2e/events.spec.ts --project=desktop`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/\(public\)/events components/EventCard.tsx e2e/registration-page.spec.ts e2e/events.spec.ts
git commit -m "Add public registration page with templatized form"
```

---

### Task 8: Gated full-payment e2e

**Files:**
- Rewrite: `e2e/stripe-checkout.spec.ts`

This spec only runs with `STRIPE_CLI_RUNNING=1` + `stripe listen` (same gate as before), so the automated check here is compile + skip.

- [ ] **Step 1: Rewrite `e2e/stripe-checkout.spec.ts`**

```ts
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
```

- [ ] **Step 2: Verify it compiles and skips**

Run: `npx playwright test e2e/stripe-checkout.spec.ts --project=desktop`
Expected: 1 skipped (no `STRIPE_CLI_RUNNING`), 0 failed.

- [ ] **Step 3: Commit**

```bash
git add e2e/stripe-checkout.spec.ts
git commit -m "Update gated Stripe e2e for the registration form flow"
```

---

### Task 9: Admin registration settings

**Files:**
- Create: `e2e/admin-registration-settings.spec.ts`
- Create: `components/admin/RegistrationSettingsFields.tsx`
- Modify: `app/admin/(protected)/events/actions.ts`
- Modify: `app/admin/(protected)/events/new/page.tsx`
- Modify: `app/admin/(protected)/events/[id]/page.tsx`
- Modify: `app/admin/(protected)/events/[id]/EditEventForm.tsx`

- [ ] **Step 1: Write the failing spec**

Create `e2e/admin-registration-settings.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin registration settings", () => {
  let eventId: string;

  test.beforeAll(async () => {
    await serviceClient().from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `RegSettings ${Date.now()}`,
      price_cents: 59900,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("edit form pre-fills the template and saves changes", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto(`/admin/events/${eventId}`);

    // Pre-filled from the Monterey template (event has null config).
    await expect(page.getByLabel(/waiver text/i)).toHaveValue(/PLACEHOLDER WAIVER/);
    await expect(page.getByLabel(/shirt sizes/i)).toHaveValue("XS, SML, MED, LRG, XL, XXL, 3XL");

    await page.getByLabel(/registration deadline/i).fill("2030-08-13T23:59");
    await page.getByLabel(/waiver text/i).fill("Updated waiver text for spec.");
    await page.getByLabel(/per-person cost/i).first().fill("250.00");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForURL("**/admin/events");

    const { data } = await serviceClient()
      .from("events")
      .select("registration_deadline, registration_config")
      .eq("id", eventId)
      .single();
    expect(data!.registration_deadline).toContain("2030-08-1");
    expect(data!.registration_config.waiver_text).toBe("Updated waiver text for spec.");
    expect(data!.registration_config.addons[0].price_cents).toBe(25000);
    expect(data!.registration_config.shirt_sizes).toEqual([
      "XS", "SML", "MED", "LRG", "XL", "XXL", "3XL",
    ]);
  });

  test("rejects invalid settings (empty shirt sizes)", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto(`/admin/events/${eventId}`);
    await page.getByLabel(/shirt sizes/i).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/registration settings are invalid/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/admin-registration-settings.spec.ts --project=desktop`
Expected: FAIL — no such labels on the edit page yet.

- [ ] **Step 3: Create `components/admin/RegistrationSettingsFields.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CarOption, RegistrationConfig } from "@/lib/registration/config";

type Props = {
  initialConfig: RegistrationConfig;
  /** datetime-local format ("YYYY-MM-DDTHH:mm") or null */
  initialDeadline: string | null;
};

function carsToText(cars: CarOption[]): string {
  return cars.map((c) => `${c.make}: ${c.models.join(", ")}`).join("\n");
}

function textToCars(text: string): CarOption[] {
  return text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { make: line.trim(), models: [] };
      return {
        make: line.slice(0, idx).trim(),
        models: line
          .slice(idx + 1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    })
    .filter((c) => c.make.length > 0);
}

const fieldClass = "mt-1 w-full rounded border border-gray-300 px-3 py-2";

export default function RegistrationSettingsFields({
  initialConfig,
  initialDeadline,
}: Props) {
  const [meals, setMeals] = useState(
    initialConfig.meals.map((m) => ({ ...m, optionsText: m.options.join(", ") })),
  );
  const [addons, setAddons] = useState(
    initialConfig.addons.map((a) => ({
      ...a,
      priceDollars: (a.price_cents / 100).toFixed(2),
    })),
  );
  const [carsText, setCarsText] = useState(carsToText(initialConfig.car_options));
  const [sizesText, setSizesText] = useState(initialConfig.shirt_sizes.join(", "));
  const [passengerEnabled, setPassengerEnabled] = useState(
    initialConfig.passenger_enabled,
  );
  const [waiverText, setWaiverText] = useState(initialConfig.waiver_text);

  // Serialized on every render; the server action re-validates with
  // parseRegistrationConfig before saving.
  const config: RegistrationConfig = {
    meals: meals.map((m) => ({
      key: m.key,
      label: m.label,
      note: m.note,
      options: m.optionsText.split(",").map((s) => s.trim()).filter(Boolean),
    })),
    addons: addons.map((a) => ({
      key: a.key,
      label: a.label,
      price_cents: Math.round(Number(a.priceDollars) * 100),
      max_qty: a.max_qty,
    })),
    car_options: textToCars(carsText),
    shirt_sizes: sizesText.split(",").map((s) => s.trim()).filter(Boolean),
    passenger_enabled: passengerEnabled,
    waiver_text: waiverText,
  };

  return (
    <fieldset className="space-y-4 rounded border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold">Registration settings</legend>
      <input type="hidden" name="registration_config" value={JSON.stringify(config)} />

      <label className="block">
        <span className="text-sm font-medium">Registration deadline (optional)</span>
        <input
          name="registration_deadline"
          type="datetime-local"
          defaultValue={initialDeadline ?? ""}
          className={fieldClass}
        />
      </label>

      <div className="space-y-3">
        <span className="text-sm font-medium">Meal choices (included in base price)</span>
        {meals.map((m, i) => (
          <div key={m.key} className="space-y-2 rounded border border-gray-200 p-3">
            <label className="block">
              <span className="text-xs text-gray-600">Meal label</span>
              <input
                value={m.label}
                onChange={(e) =>
                  setMeals(meals.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Options (comma-separated)</span>
              <input
                value={m.optionsText}
                onChange={(e) =>
                  setMeals(
                    meals.map((x, j) => (j === i ? { ...x, optionsText: e.target.value } : x)),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Note (shown under the dropdown)</span>
              <input
                value={m.note}
                onChange={(e) =>
                  setMeals(meals.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
                }
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => setMeals(meals.filter((_, j) => j !== i))}
              className="text-xs text-red-700 underline"
            >
              Remove meal
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setMeals([
              ...meals,
              {
                key: `meal_${Date.now()}`,
                label: "New meal",
                note: "",
                options: [],
                optionsText: "",
              },
            ])
          }
          className="text-sm underline"
        >
          + Add meal
        </button>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-medium">Paid add-ons (per person)</span>
        {addons.map((a, i) => (
          <div key={a.key} className="space-y-2 rounded border border-gray-200 p-3">
            <label className="block">
              <span className="text-xs text-gray-600">Add-on label</span>
              <input
                value={a.label}
                onChange={(e) =>
                  setAddons(
                    addons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Per-person cost (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={a.priceDollars}
                onChange={(e) =>
                  setAddons(
                    addons.map((x, j) =>
                      j === i ? { ...x, priceDollars: e.target.value } : x,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Max quantity</span>
              <input
                type="number"
                min="1"
                step="1"
                value={a.max_qty}
                onChange={(e) =>
                  setAddons(
                    addons.map((x, j) =>
                      j === i ? { ...x, max_qty: Number(e.target.value) } : x,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => setAddons(addons.filter((_, j) => j !== i))}
              className="text-xs text-red-700 underline"
            >
              Remove add-on
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setAddons([
              ...addons,
              {
                key: `addon_${Date.now()}`,
                label: "New add-on",
                price_cents: 0,
                max_qty: 1,
                priceDollars: "0.00",
              },
            ])
          }
          className="text-sm underline"
        >
          + Add add-on
        </button>
      </div>

      <label className="block">
        <span className="text-sm font-medium">
          Car list (one make per line — &quot;Make: model, model&quot;)
        </span>
        <textarea
          value={carsText}
          onChange={(e) => setCarsText(e.target.value)}
          rows={10}
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Shirt sizes (comma-separated)</span>
        <input
          value={sizesText}
          onChange={(e) => setSizesText(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={passengerEnabled}
          onChange={(e) => setPassengerEnabled(e.target.checked)}
        />
        <span className="text-sm font-medium">Allow a passenger</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium">Waiver text</span>
        <textarea
          value={waiverText}
          onChange={(e) => setWaiverText(e.target.value)}
          rows={6}
          className={fieldClass}
        />
      </label>
    </fieldset>
  );
}
```

- [ ] **Step 4: Extend `app/admin/(protected)/events/actions.ts`**

Add the import and helper near `parsePriceCents`:

```ts
import {
  parseRegistrationConfig,
  type RegistrationConfig,
} from "@/lib/registration/config";
```

```ts
function parseRegistrationFields(formData: FormData):
  | { ok: true; deadline: string | null; config: RegistrationConfig }
  | { ok: false; error: string } {
  const deadlineRaw = String(formData.get("registration_deadline") ?? "").trim();
  const deadline = deadlineRaw || null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(String(formData.get("registration_config") ?? ""));
  } catch {
    return { ok: false, error: "Registration settings are malformed." };
  }
  const config = parseRegistrationConfig(parsedJson);
  if (!config) {
    return {
      ok: false,
      error:
        "Registration settings are invalid — check that prices are not negative, every list has at least one option, and the waiver text is not empty.",
    };
  }
  return { ok: true, deadline, config };
}
```

In `createEvent`, after the existing `if (priceCents === null)` check, add:

```ts
  const reg = parseRegistrationFields(formData);
  if (!reg.ok) return { ok: false, error: reg.error };
```

and extend the insert object:

```ts
      registration_deadline: reg.deadline,
      registration_config: reg.config,
```

In `updateEvent`, after the same check, add the identical `const reg = ...` two lines and extend the `patch` object:

```ts
    registration_deadline: reg.deadline,
    registration_config: reg.config,
```

- [ ] **Step 5: Wire into the new-event page**

In `app/admin/(protected)/events/new/page.tsx`, add imports:

```tsx
import RegistrationSettingsFields from "@/components/admin/RegistrationSettingsFields";
import { MONTEREY_TEMPLATE } from "@/lib/registration/config";
```

and render the fields inside the `<form>`, between the Status select and the submit button:

```tsx
        <RegistrationSettingsFields
          initialConfig={MONTEREY_TEMPLATE}
          initialDeadline={null}
        />
```

- [ ] **Step 6: Wire into the edit page**

`app/admin/(protected)/events/[id]/page.tsx` — extend the select:

```tsx
    .select(
      "id, title, event_date, price_cents, description_html, cover_image_path, status, registration_deadline, registration_config",
    )
```

`app/admin/(protected)/events/[id]/EditEventForm.tsx` — add imports:

```tsx
import RegistrationSettingsFields from "@/components/admin/RegistrationSettingsFields";
import { effectiveConfig } from "@/lib/registration/config";
```

extend the `Props.event` type:

```tsx
    registration_deadline: string | null;
    registration_config: unknown;
```

and render between the Status select and `<SubmitButton />`:

```tsx
        <RegistrationSettingsFields
          initialConfig={effectiveConfig(event.registration_config)}
          initialDeadline={
            event.registration_deadline
              ? toLocalDateTimeInput(event.registration_deadline)
              : null
          }
        />
```

- [ ] **Step 7: Run specs (new one + existing admin suite)**

Run: `npx playwright test e2e/admin-registration-settings.spec.ts e2e/admin-events.spec.ts e2e/admin-journey.spec.ts --project=desktop`
Expected: PASS. (The existing create-event tests keep working because the settings are pre-filled with a valid template.)

- [ ] **Step 8: Commit**

```bash
git add components/admin/RegistrationSettingsFields.tsx "app/admin/(protected)/events" e2e/admin-registration-settings.spec.ts
git commit -m "Admin can edit per-event registration settings"
```

---

### Task 10: Admin registrations view + CSV export

**Files:**
- Create: `e2e/admin-registrations.spec.ts`
- Create: `lib/registration/admin-data.ts`
- Create: `lib/registration/csv.ts`
- Create: `app/admin/(protected)/events/[id]/registrations/page.tsx`
- Create: `app/admin/(protected)/events/[id]/registrations/export/route.ts`
- Modify: `app/admin/(protected)/events/page.tsx`

- [ ] **Step 1: Write the failing spec**

Create `e2e/admin-registrations.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin registrations view", () => {
  let eventId: string;

  test.beforeAll(async () => {
    await serviceClient().from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `AdminRegs ${Date.now()}`,
      price_cents: 59900,
    });
    await serviceClient()
      .from("registrations")
      .insert([
        {
          event_id: eventId,
          status: "paid",
          first_name: "Ada",
          last_name: "Driver",
          email: "ada@example.com",
          phone: "555-0100",
          shirt_size: "LRG",
          car_make: "Porsche",
          car_model: "918",
          has_passenger: true,
          passenger_first_name: "Pat",
          passenger_last_name: "Rider",
          passenger_shirt_size: "MED",
          answers: {
            instagram: "@ada",
            facebook: null,
            passenger_social: "@pat",
            meals: { thursday_lunch: { driver: "Pork Taco", passenger: "Caesar Salad" } },
            addons: { thursday_dinner: 2 },
          },
          waiver_accepted_at: new Date().toISOString(),
          amount_paid_cents: 99700,
          stripe_session_id: `cs_test_adminregs_${Date.now()}`,
        },
        {
          event_id: eventId,
          status: "pending",
          first_name: "Bob",
          last_name: "Pending",
          email: "bob@example.com",
          shirt_size: "XL",
          car_make: "Ferrari",
          car_model: "F8",
          has_passenger: false,
          answers: {},
          waiver_accepted_at: new Date().toISOString(),
        },
      ]);
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("shows paid rows with summary counts; hides pending", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto(`/admin/events/${eventId}/registrations`);

    await expect(page.getByText("ada@example.com")).toBeVisible();
    await expect(page.getByText("bob@example.com")).toHaveCount(0);

    const summary = page.getByTestId("registration-summary");
    await expect(summary).toContainText("1 cars");
    await expect(summary).toContainText("$997.00");
    await expect(summary).toContainText("LRG: 1");
    await expect(summary).toContainText("MED: 1");
    await expect(summary).toContainText("Pork Taco: 1");
    await expect(summary).toContainText("Caesar Salad: 1");
    await expect(summary).toContainText("thursday_dinner: 2");
  });

  test("CSV export contains paid rows only", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    const res = await page.request.get(
      `/admin/events/${eventId}/registrations/export`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const csv = await res.text();
    expect(csv.split("\n")[0]).toContain("Shirt size");
    expect(csv).toContain("ada@example.com");
    expect(csv).toContain("thursday_dinner x2");
    expect(csv).not.toContain("bob@example.com");
  });

  test("events list links to registrations", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/events");
    await expect(
      page.locator(`a[href="/admin/events/${eventId}/registrations"]`),
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/admin-registrations.spec.ts --project=desktop`
Expected: FAIL — page 404s.

- [ ] **Step 3: Create `lib/registration/admin-data.ts`**

```ts
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type PaidRegistration = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  shirt_size: string | null;
  car_make: string | null;
  car_model: string | null;
  has_passenger: boolean | null;
  passenger_first_name: string | null;
  passenger_last_name: string | null;
  passenger_shirt_size: string | null;
  amount_paid_cents: number | null;
  answers: {
    instagram?: string | null;
    facebook?: string | null;
    passenger_social?: string | null;
    meals?: Record<string, { driver?: string; passenger?: string }>;
    addons?: Record<string, number>;
  } | null;
};

/**
 * Paid registrations for an event, oldest first. Pending rows (abandoned
 * checkouts) are intentionally excluded everywhere admins look.
 * Returns null when the event does not exist.
 */
export async function fetchPaidRegistrations(eventId: string): Promise<{
  event: { id: string; title: string };
  registrations: PaidRegistration[];
} | null> {
  const supabase = createSupabaseServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "paid")
    .order("created_at", { ascending: true });

  return { event, registrations: (data ?? []) as PaidRegistration[] };
}
```

- [ ] **Step 4: Create `lib/registration/csv.ts`**

```ts
import type { PaidRegistration } from "./admin-data";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "Registered at",
  "First name",
  "Last name",
  "Email",
  "Phone",
  "Shirt size",
  "Car make",
  "Car model",
  "Has passenger",
  "Passenger first name",
  "Passenger last name",
  "Passenger shirt size",
  "Instagram",
  "Facebook",
  "Passenger social",
  "Meals",
  "Add-ons",
  "Amount paid (USD)",
];

export function registrationsToCsv(rows: PaidRegistration[]): string {
  const lines = [HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    const meals = Object.entries(r.answers?.meals ?? {})
      .map(([k, v]) => `${k}: ${v.driver ?? ""}${v.passenger ? " / " + v.passenger : ""}`)
      .join(" | ");
    const addons = Object.entries(r.answers?.addons ?? {})
      .map(([k, qty]) => `${k} x${qty}`)
      .join(" | ");
    lines.push(
      [
        r.created_at,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.shirt_size,
        r.car_make,
        r.car_model,
        r.has_passenger ? "yes" : "no",
        r.passenger_first_name,
        r.passenger_last_name,
        r.passenger_shirt_size,
        r.answers?.instagram ?? "",
        r.answers?.facebook ?? "",
        r.answers?.passenger_social ?? "",
        meals,
        addons,
        r.amount_paid_cents === null ? "" : (r.amount_paid_cents / 100).toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 5: Create `app/admin/(protected)/events/[id]/registrations/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchPaidRegistrations,
  type PaidRegistration,
} from "@/lib/registration/admin-data";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function tally(
  rows: PaidRegistration[],
  pick: (r: PaidRegistration) => (string | null | undefined)[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const v of pick(r)) {
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

export default async function RegistrationsPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await fetchPaidRegistrations(params.id);
  if (!result) notFound();
  const { event, registrations } = result;

  const shirts = tally(registrations, (r) => [r.shirt_size, r.passenger_shirt_size]);

  const mealCounts = new Map<string, Map<string, number>>();
  for (const r of registrations) {
    for (const [meal, choice] of Object.entries(r.answers?.meals ?? {})) {
      const inner = mealCounts.get(meal) ?? new Map<string, number>();
      for (const v of [choice.driver, choice.passenger]) {
        if (v) inner.set(v, (inner.get(v) ?? 0) + 1);
      }
      mealCounts.set(meal, inner);
    }
  }

  const addonCounts = new Map<string, number>();
  for (const r of registrations) {
    for (const [k, qty] of Object.entries(r.answers?.addons ?? {})) {
      addonCounts.set(k, (addonCounts.get(k) ?? 0) + qty);
    }
  }

  const revenueCents = registrations.reduce(
    (sum, r) => sum + (r.amount_paid_cents ?? 0),
    0,
  );

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-serif">Registrations — {event.title}</h2>
        <a
          href={`/admin/events/${event.id}/registrations/export`}
          className="rounded bg-black px-4 py-2 text-sm text-white"
          data-testid="export-csv"
        >
          Export CSV
        </a>
      </header>

      <section
        className="mb-8 grid grid-cols-2 gap-6 text-sm md:grid-cols-4"
        data-testid="registration-summary"
      >
        <div>
          <h3 className="mb-1 font-semibold">Totals</h3>
          <p>{registrations.length} cars</p>
          <p>{usd.format(revenueCents / 100)} collected</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Shirts</h3>
          {[...shirts].map(([size, n]) => (
            <p key={size}>
              {size}: {n}
            </p>
          ))}
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Meals</h3>
          {[...mealCounts].map(([meal, inner]) => (
            <div key={meal} className="mb-2">
              <p className="italic">{meal}</p>
              {[...inner].map(([opt, n]) => (
                <p key={opt}>
                  {opt}: {n}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Add-ons</h3>
          {[...addonCounts].map(([k, n]) => (
            <p key={k}>
              {k}: {n}
            </p>
          ))}
        </div>
      </section>

      <table className="w-full text-sm" data-testid="registrations-table">
        <thead className="border-b border-gray-200">
          <tr className="text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Email / phone</th>
            <th className="py-2">Car</th>
            <th className="py-2">Shirts</th>
            <th className="py-2">Passenger</th>
            <th className="py-2">Add-ons</th>
            <th className="py-2">Paid</th>
            <th className="py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 align-top">
              <td className="py-3">
                {r.first_name} {r.last_name}
              </td>
              <td className="py-3">
                {r.email}
                {r.phone ? <span className="block text-gray-500">{r.phone}</span> : null}
              </td>
              <td className="py-3">
                {r.car_make} {r.car_model}
              </td>
              <td className="py-3">
                {r.shirt_size}
                {r.passenger_shirt_size ? ` / ${r.passenger_shirt_size}` : ""}
              </td>
              <td className="py-3">
                {r.has_passenger
                  ? `${r.passenger_first_name} ${r.passenger_last_name}`
                  : "—"}
              </td>
              <td className="py-3">
                {Object.entries(r.answers?.addons ?? {})
                  .map(([k, qty]) => `${k} ×${qty}`)
                  .join(", ") || "—"}
              </td>
              <td className="py-3">
                {r.amount_paid_cents !== null
                  ? usd.format(r.amount_paid_cents / 100)
                  : "—"}
              </td>
              <td className="py-3">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {registrations.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-gray-500">
                No paid registrations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="mt-6">
        <Link href="/admin/events" className="underline">
          Back to events
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Create `app/admin/(protected)/events/[id]/registrations/export/route.ts`**

```ts
import { requireAdmin } from "@/lib/admin/require-admin";
import { fetchPaidRegistrations } from "@/lib/registration/admin-data";
import { registrationsToCsv } from "@/lib/registration/csv";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  await requireAdmin();

  const result = await fetchPaidRegistrations(params.id);
  if (!result) return new Response("Not found", { status: 404 });

  const csv = registrationsToCsv(result.registrations);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registrations-${params.id}.csv"`,
    },
  });
}
```

- [ ] **Step 7: Add the link in `app/admin/(protected)/events/page.tsx`**

In the actions `<td>`, before the Edit link:

```tsx
                <Link
                  href={`/admin/events/${r.id}/registrations`}
                  className="underline"
                >
                  Registrations
                </Link>
```

- [ ] **Step 8: Run specs**

Run: `npx playwright test e2e/admin-registrations.spec.ts --project=desktop`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/registration/admin-data.ts lib/registration/csv.ts "app/admin/(protected)/events" e2e/admin-registrations.spec.ts
git commit -m "Add admin registrations view with summary counts and CSV export"
```

---

### Task 11: Docs + full verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Stripe section of `CLAUDE.md`**

Replace the first paragraph of the `## Stripe` section (the one beginning "Single-ticket Checkout…") with:

```markdown
Itemized Checkout for `/events` registrations (v2, 2026-06). The form lives on
`/events/[id]/register` and is generated from each event's `registration_config`
JSONB (meals, paid add-ons, car list, shirt sizes, passenger toggle, waiver) —
see `lib/registration/config.ts`; events with a null config fall back to the
Monterey template. `/api/checkout` validates the submission server-side
(`lib/registration/validate.ts`), inserts a `pending` registrations row, and
creates a session with inline `price_data` line items (base registration +
add-ons). No Stripe `custom_fields`. The webhook flips the row to `paid` by
`metadata.registration_id` and records `amount_total` (checked against
`metadata.amount_expected_cents`). Pending rows from abandoned checkouts are
inert — every admin surface filters to `paid`. Admins edit settings per event in
`/admin/events/[id]` and see registrations + CSV at
`/admin/events/[id]/registrations`. Refunds in Stripe Dashboard; the
`registrations` row stays as the historical record of payment.
```

- [ ] **Step 2: Lint + types + full suite**

```bash
npm run lint
npx tsc --noEmit
npx playwright test
```

Expected: lint clean, tsc clean, all projects pass (gated `stripe-checkout.spec.ts` skips).

- [ ] **Step 3: Optional gated end-to-end (manual)**

In one terminal: `stripe listen --api-key $STRIPE_SECRET_KEY --forward-to http://localhost:3000/api/stripe/webhook --events checkout.session.completed`
In another: `STRIPE_CLI_RUNNING=1 npx playwright test e2e/stripe-checkout.spec.ts --project=desktop`
Expected: PASS (or apply the FrameLocator note in the spec header if Stripe's card iframe selectors changed).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document registration template flow"
```

---

## Deployment notes (after merge, not part of this plan's tasks)

- `npx supabase db push --include-seed` was already run in Task 1 against the linked (production) database — the schema is additive and legacy rows are preserved as `paid`.
- Vercel needs no new env vars (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` already exist in all envs for the webhook).
- The live waiver text must come from the club; admins can paste it into the event's Waiver text field — no deploy needed.
- DNS cutover to ssrgofficial.com is a separate task (playbook in CLAUDE.md §Stripe).
