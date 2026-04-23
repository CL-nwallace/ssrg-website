# SSRG Website

Migration of the SSRG exotic car club site off Wix onto Next.js 14 (App Router) + Vercel + Supabase + Stripe. Full context lives in `SSRG-Website-Action-Plan.md` and in the per-project memory system (`MEMORY.md` is loaded automatically).

## Dev commands

- `npm run dev` — Next.js dev server at http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx playwright test` — E2E tests under `e2e/`

## Supabase

- Schema lives in `supabase/migrations/` (`0001_initial.sql` is the current baseline). Apply via Supabase dashboard → SQL Editor, or `supabase db push` if the CLI is wired up.
- Seed data in `supabase/seed.sql` (idempotent — safe to re-run).
- Env vars: copy `.env.example` to `.env.local` and fill with values from Supabase → Project Settings → API. Never commit `.env.local`.
- Public pages read via `lib/supabase/server.ts` (server components) and `lib/supabase/client.ts` (client components). Rich-text event descriptions are sanitized through `lib/render-html.ts`.

## Default skills for this project

- **Design / UI / UX** → `ui-ux-pro-max:ui-ux-pro-max` (style, color, typography, component libraries)
- **Functional testing** → Playwright MCP (`mcp__plugin_playwright_playwright__browser_*`), specs in `e2e/`
- **Execution workflow** → `superpowers:*` — `brainstorming` → `writing-plans` → `executing-plans` or `subagent-driven-development`, with `test-driven-development`, `systematic-debugging`, and `verification-before-completion`

A `UserPromptSubmit` hook in `.claude/settings.json` auto-nudges Claude toward the right skill based on prompt keywords. See `.claude/hooks/route-skills.sh`.
