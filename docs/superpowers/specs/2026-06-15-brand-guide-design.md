# SSRG Branding Guide — Design

**Date:** 2026-06-15
**Status:** Approved in brainstorming (this session)
**Design production:** use `ui-ux-pro-max:ui-ux-pro-max` for the visual work.

## Goal

Codify SSRG's visual identity in two synced deliverables: a living, on-site
`/brand` page rendered from the real design tokens, and a concise markdown
reference for handoff. The guide documents the identity already in the codebase
(dark palette, gold accent, Cormorant/Montserrat type, the SSRG wordmark) and
fills the gaps (tagline/voice, favicon/icon system, merch treatment). It also
corrects two real issues the work surfaces (font loading, favicon format).

## Deliverables

1. **`/brand` page** — an unlisted public route (live, shareable URL; NOT in the
   navbar; not discoverable in normal navigation). Server component under
   `app/(public)/brand/`, composed of small per-section components. Swatches,
   type specimens, and component samples render from the live Tailwind theme and
   real components so the page can never drift from the code.
2. **`docs/brand/SSRG-brand-guide.md`** — a concise reference mirroring the page
   (hex values, font names/scale, voice rules, logo do/don'ts) for a printer or
   future designer who isn't in the codebase.

## Brand foundations (documented as-is from the code)

- **Colors** (`tailwind.config.ts`): backgrounds `#0a0a0a` (deep) / `#111111`
  (elevated) / `#1a1a1a` (surface); **gold** `#c9a84c` (light `#d4b96a`, muted
  `#8a7535`); text `#f5f5f5` (primary) / `#a3a3a3` (secondary) / `#737373`
  (muted); hairline border `rgba(255,255,255,0.08)`.
- **Type**: serif **Cormorant** (display/headings), sans **Montserrat** (body).
  Scale: display 80 / hero 64 / heading 48 / subheading 32 / large 24 / body 16 /
  small 14, with the defined line-heights and letter-spacing.
- **Logo**: `public/images/ssrg-logo.png` (264×93 wordmark), shown white/inverted
  on dark heroes.
- **Positioning** (from `app/layout.tsx` metadata): "premier exotic car event and
  lifestyle group in California — unforgettable driving experiences and social
  gatherings."

## Sections (page + doc)

1. **Logo** — the wordmark, clear space, minimum sizes, the white-on-dark rule,
   and don'ts (no recolor, stretch, rotate, busy/low-contrast backgrounds).
2. **Color** — swatches with hex + role (gold = accents/CTAs/`gold-line`; dark
   surfaces for depth; text greys), plus WCAG contrast notes for text-on-dark and
   gold-on-dark.
3. **Typography** — Cormorant + Montserrat, the scale with live specimens,
   pairing rules (serif headings / sans body), and the font-loading correction
   (below).
4. **Voice & Tone** — positioning, a proposed **tagline** and messaging pillars,
   and do/don't example copy (aspirational, exclusive, understated; never
   hype-y or discount-driven). **Tagline + pillars are proposed for the board's
   approval inside the deliverable, not invented and shipped.**
5. **UI Components & Applications** — real samples pulled from the site: primary
   gold button, card, the `gold-line` heading accent, the `glass` navbar; plus an
   OG/social image template using the palette + wordmark.
6. **Merch & Apparel** — wordmark treatment on dark and light garments, gold/mono
   options, minimum size and clear space on fabric. (Ties to the t-shirt sizes
   already collected at registration.)
7. **Favicon & Icon system** — see below.

## Real fixes this work includes

### Font loading (correctness + performance)
`app/globals.css` loads the brand fonts with
`@import url('https://fonts.googleapis.com/css2?...Cormorant...Montserrat...')`
placed **after** the `@tailwind` directives. `@import` is only valid before other
statements, so this may be silently ignored — meaning the site could be falling
back to system serif/sans rather than rendering Cormorant/Montserrat. Fix:
migrate to **`next/font`** (self-hosted Cormorant + Montserrat wired in
`app/layout.tsx`, exposed as CSS variables consumed by the Tailwind
`fontFamily`), remove the `@import`, and verify Cormorant actually renders. This
corrects the live site and makes the type specimens truthful, with no
render-blocking request and no layout shift.

### Favicon → miniature SSRG logo
Per direction, the favicon is derived from the **SSRG logo**. Replace the current
`public/images/favicon.jpg` with a crisp icon set generated from the mark and
wire it via Next `metadata.icons` (favicon.ico + 32px PNG + 180px apple-touch +
512px + an SVG where possible). Caveat to resolve during production: the logo is
a four-letter **wordmark**; at 16–32px a full wordmark is hard to read, so the
small sizes should use a simplified/cropped treatment (e.g. a tight "SSRG" lockup
or a single-letter monogram) while larger sizes (apple-touch, OG) can use the
fuller mark. Final small-size treatment chosen visually with `ui-ux-pro-max`,
honoring "miniature SSRG logo."

## Architecture / file structure

- `app/(public)/brand/page.tsx` — composes the section components; page metadata
  marks it noindex (unlisted).
- `app/(public)/brand/_components/` — one focused component per section
  (`LogoBlock`, `ColorSwatches`, `TypeSpecimen`, `VoiceTone`, `ComponentSamples`,
  `MerchBlock`, `IconBlock`). Each reads live tokens/components; no duplicated
  hardcoded values where a token exists.
- `app/layout.tsx` — `next/font` wiring; `app/globals.css` — drop the `@import`.
- `public/images/` (or `public/`) — generated favicon/icon assets.
- `docs/brand/SSRG-brand-guide.md` — the reference doc.

## Out of scope (v1)

- Photography & imagery section (deferred by choice).
- A new logo or visual rebrand — this documents and tightens the existing identity.
- Navbar link to `/brand` (intentionally unlisted).
- Printed/PDF artifact (the markdown is the handoff source).

## Testing / verification

- Playwright: `/brand` returns 200, renders each section heading, is not linked
  from the navbar, and carries a noindex signal.
- A type test asserting the brand fonts are actually applied (computed
  `font-family` on a heading includes "Cormorant") to lock the font-loading fix.
- Favicon wiring verified (correct `<link rel>` / Next metadata output; assets
  resolve 200).
- Visual review with `ui-ux-pro-max` before merge.
