# SSRG Brand Guide

**Version:** 1.0  
**Date:** 2026-06-15  
**Status:** Live — sourced from `tailwind.config.ts` and site codebase.  
**URL:** `/brand` (unlisted; noindex)

---

## 1. Brand Positioning

> "Premier exotic car event and lifestyle group in California — unforgettable driving experiences and social gatherings."

---

## 2. Voice & Tone

**Tone pillars:** Aspirational · Exclusive · Understated

Write as if extending a personal invitation to an elevated experience. Never use discount language, artificial urgency, or all-caps hype copy.

**Proposed tagline:** *Drive Extraordinary.*  
**STATUS: PROPOSED — pending board approval. Do not use on public-facing material until the board signs off.**

### Copy examples

| Do | Don't |
|---|---|
| "Experience the thrill of California's most exclusive driving routes." | "HUGE SALE — 50% OFF event tickets this weekend only!!!" |
| "An invitation-style event for drivers who demand more from every mile." | "Anyone can join — the more the merrier!" |
| "Your next chapter on the open road begins here." | "Limited spots going FAST, book NOW or regret it." |

---

## 3. Color Palette

All values map to Tailwind tokens in `tailwind.config.ts`. Use tokens in code; use hex for print/design tools.

### Backgrounds

| Name | Token | Hex | Role |
|---|---|---|---|
| Deep | `bg-bg-deep` | `#0A0A0A` | Page background; darkest surface |
| Elevated | `bg-bg-elevated` | `#111111` | Cards, panels, admin sidebar |
| Surface | `bg-bg-surface` | `#1A1A1A` | Input fills, info blocks |

### Gold Accent

| Name | Token | Hex | Role |
|---|---|---|---|
| Gold | `bg-gold` / `text-gold` | `#C9A84C` | Primary accent — CTAs, gold-line rule, highlights |
| Gold Light | `bg-gold-light` / `text-gold-light` | `#D4B96A` | Hover state for gold elements |
| Gold Muted | `bg-gold-muted` / `text-gold-muted` | `#8A7535` | Subdued gold — badges, draft labels |

### Text

| Name | Token | Hex | Role |
|---|---|---|---|
| Primary | `text-text-primary` | `#F5F5F5` | Headings and body copy on dark bg |
| Secondary | `text-text-secondary` | `#A3A3A3` | Supporting copy, captions |
| Muted | `text-text-muted` | `#737373` | Placeholder, disabled, fine print |

### Border

| Name | Token | Value | Role |
|---|---|---|---|
| Subtle | `border-subtle` | `rgba(255,255,255,0.08)` | Hairline borders on cards/panels |

### WCAG Contrast Notes

- `text-primary` (#F5F5F5) on `bg-deep` (#0A0A0A): **passes AA + AAA** for normal and large text.
- Gold (#C9A84C) on `bg-deep`: **passes AA for large text and UI components** (≈5.2:1). Not for small body copy.
- `text-secondary` (#A3A3A3) on `bg-deep`: passes AA for normal text.

---

## 4. Typography

### Typefaces

| Role | Family | Weights |
|---|---|---|
| Display / Headings | **Cormorant** (serif) | 400, 500, 600, 700 |
| Body / UI | **Montserrat** (sans-serif) | 300, 400, 500, 600, 700 |

Both fonts are loaded via `next/font/google` in `app/layout.tsx` (self-hosted, no render-blocking request) and exposed as CSS variables `--font-cormorant` / `--font-montserrat`, consumed by Tailwind's `fontFamily.serif` / `fontFamily.sans`.

### Type Scale

| Step | Size | Font | Line Height | Letter Spacing |
|---|---|---|---|---|
| Display | 80px | Cormorant serif | 1.05 | −0.02em |
| Hero | 64px | Cormorant serif | 1.1 | −0.02em |
| Heading | 48px | Cormorant serif | 1.15 | −0.02em |
| Subheading | 32px | Cormorant serif | 1.2 | −0.01em |
| Large | 24px | Montserrat sans | 1.4 | — |
| Body | 16px | Montserrat sans | 1.6 | — |
| Small | 14px | Montserrat sans | 1.5 | — |

### Pairing Rules

- Serif (Cormorant) for all headings — display through subheading.
- Sans (Montserrat) for body copy, labels, buttons, captions.
- Never set body copy in Cormorant below 24px.
- Track headings at −0.02em (already built into scale tokens).

---

## 5. Logo

**File:** `public/images/ssrg-logo.png` (264×93 px, white wordmark on transparent)

### Usage Rules

- **Minimum digital size:** 120px wide
- **Minimum print size:** 1.5 in wide
- **Clear space:** equal to the cap-height of the "S" on all four sides
- **Color:** white on dark backgrounds (standard); dark/near-black on light garments (apparel only)

### Do / Don't

**Do:**
- Use the white wordmark on dark (near-black) backgrounds.
- Maintain clear space on all sides.
- Scale proportionally — never distort the aspect ratio.
- Use the supplied PNG at 2× or higher for digital; vector for print.

**Don't:**
- Recolor the wordmark (no gold, no grey, no gradients).
- Stretch or compress the mark.
- Rotate or skew.
- Place on busy, patterned, or low-contrast backgrounds.
- Add drop shadows, outlines, or other effects.

---

## 6. UI Components

### Primary Gold Button
```
px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded
hover:bg-gold-light transition-colors duration-200
focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none
```

### Gold Outline Button
```
px-8 py-3 border border-gold text-gold font-semibold text-small rounded
hover:bg-gold hover:text-bg-deep transition-colors duration-200
```

### Content Card
```
bg-bg-elevated border border-subtle rounded-lg p-6
```

### Gold-line Heading Accent
CSS class `.gold-line` (defined in `app/globals.css`):
```css
.gold-line { width: 60px; height: 2px; background: #c9a84c; }
```
Place above every `h2` section heading.

### Glass Navbar
CSS class `.glass`:
```css
background: rgba(10,10,10,0.7);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255,255,255,0.06);
```

---

## 7. Merch & Apparel

### Treatments

| Garment | Wordmark | Notes |
|---|---|---|
| Dark (black/charcoal) | White wordmark | Standard. Preferred treatment. |
| Light (white/cream) | Dark or gold-tinted wordmark | Confirm ink contrast with printer before production. |

### Rules

- **Minimum size (embroidery):** 2.5 in wide
- **Minimum size (screen print):** 3 in wide
- **Clear space on fabric:** 0.5 in on all sides (or cap-height of the S, whichever is larger)
- **Preferred placement:** left chest (polo/jacket), center chest (tee), back center (hoodie)
- No distressed or grunge treatments — the wordmark must be crisp and clean.
- Garment colors: black, charcoal, or white preferred. Avoid saturated colors that compete with gold.

---

## 8. Favicon & Icon System

### Files

| File | Size | Treatment | Use |
|---|---|---|---|
| `app/icon.png` | 512×512 | Dark mark, transparent bg | Browser-tab favicon (Next.js convention; no legacy `.ico`) |
| `app/apple-icon.png` | 180×180 | White mark, dark tile | iOS home screen (iOS forces an opaque background) |

### Notes

- The **tab favicon** uses the dark mark on transparent so it stays legible on the light tab bars most desktop browsers use; trade-off is low contrast on dark-mode tabs. The **iOS icon** uses the white mark on the brand-dark tile so it stays visible where iOS composites onto black.
- At 16–32px the full SSRG wordmark is tight. If legibility degrades, consider a simplified monogram ("S" or "SS") for small sizes only.
- Icons in `app/` are auto-wired by Next.js metadata convention — no manual `<link rel="icon">` required.
- **Future option (v2):** SVG favicon with `prefers-color-scheme` support for OS theme switching.

---

*This document is the handoff reference for the brand. The `/brand` page on the site renders the same information from live design tokens and serves as the canonical source of truth during development.*
