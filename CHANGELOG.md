# Changelog

All notable changes to the SSRG website are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); dates are the production-deploy date.

## [2026-06-16]

### Added
- **Brand guide.** An unlisted `/brand` page (noindex, not in the navbar) rendered from the live Tailwind tokens — logo, color, typography, voice & tone, UI components, merch, and favicon — plus a `docs/brand/SSRG-brand-guide.md` reference for handoff.

### Changed
- **Custom domain live: `ssrgofficial.com`.** DNS moved off Wix to GoDaddy-managed (apex → Vercel, `www` → Vercel), with Microsoft 365 email preserved and SPF corrected to authorize M365. TLS issued; live Stripe webhook repointed to the custom domain; Supabase auth URLs updated.
- **Fonts self-hosted via `next/font`** (Cormorant + Montserrat), replacing an invalid Google-Fonts `@import` that was leaving the site on system fonts.

### Fixed
- **Browser-tab favicon** now shows the SSRG mark white-on-dark (was a stale near-black icon); generated from the logo and served via `app/icon.png`.
- **Duplicate tagline on the hero** — the logo art already contains "Exotic Car Lifestyle", so the redundant subtitle line was removed when the logo is shown.
- **Local lint now matches CI** (`root: true` in ESLint config) so unused-code errors are caught before deploy.

### Security
- Rotated the live Stripe secret key (the prior key had been exposed); production verified on the new key.

## [2026-06-15]

Replaces the old single-ticket Stripe checkout with a full on-site event registration system, plus dietary options and a mobile hero fix. Shipped to production in three deploys (PRs #1–#3).

### Added
- **Templatized event registration flow.** "Register" now opens an on-site form at `/events/[id]/register`, generated per event from a configurable template (first instance: Monterey Rally 2026). Collects driver details, optional passenger (with its own sub-form), a curated car make/model dropdown with a manual "not listed" entry, t-shirt size, social handles, included meal choices, an optional paid add-on (Thursday dinner, $199/person, up to 2), and a required waiver. Pricing is per car ($599); the Stripe invoice is itemized.
- **Registration auto-close.** Registration closes at a per-event deadline (Aug 13, 2026 for Monterey); the event stays visible afterward.
- **Admin registration settings.** Admins edit each event's meals, add-ons, car list, shirt sizes, passenger toggle, waiver text, and deadline — pre-filled from the standard template and validated on save.
- **Admin registrations view + CSV export.** Per-event table of paid registrations with summary counts (shirts by size, meals, dinners, total cars, revenue) and a CSV download for catering/shirt orders.
- **Dietary restrictions.** Optional, multi-select (Vegan, Vegetarian, No Dairy, Gluten Free) per person for driver and passenger; admin-editable per event and surfaced in the registrations view + CSV.
- **Hero background video on mobile.** The homepage hero video now plays on phones (previously a static image only).

### Changed
- **Registration is now the source of truth on our side, not Stripe.** A submission is validated server-side, written as a `pending` record, then confirmed to `paid` by the Stripe webhook. Stripe custom fields (car make/model) are retired in favor of the on-site form.
- **Hero video compressed 16 MB → 4.4 MB** (also speeds up desktop); the hero image now serves as the poster and the fallback when autoplay is blocked (e.g. iOS Low Power Mode).

### Security
- All pricing and line items are computed server-side; no price or total is ever trusted from the browser.
- Stripe webhook verifies the charged amount against an expected total, checks payment status, and is idempotent against duplicate deliveries.
- Checkout redirect origin is restricted to an allowlist.
- CSV export neutralizes spreadsheet formula injection in registrant free-text fields.

### Database
- Migration `0005`: registration config + deadline columns on events; a `pending → paid` lifecycle with structured registrant fields on registrations; Monterey Rally 2026 seeded.

### Notes
- Test coverage: full Playwright suite green (hermetic checkout/webhook specs, public form flow, admin settings + registrations/CSV), with one gated full-payment end-to-end spec.
- The Monterey waiver text is a placeholder pending the club's final liability language; it's admin-editable, so updating it needs no deploy.
