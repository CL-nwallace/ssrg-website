# SSRG Website

Migration of the SSRG exotic car club site off Wix onto Next.js 14 (App Router) + Vercel + Supabase + Stripe. Full context lives in `SSRG-Website-Action-Plan.md` and in the per-project memory system (`MEMORY.md` is loaded automatically).

## Dev commands

- `npm run dev` — Next.js dev server at http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx playwright test` — E2E tests under `e2e/`

## Supabase

Project ref `agshdipndimperxuwjqy` (linked via `npx supabase link`). CLI commands run from repo root:

- `npx supabase db push` — apply new migrations in `supabase/migrations/`
- `npx supabase db push --include-seed` — apply seed from `supabase/seed.sql` (idempotent)
- `npx supabase db query "<sql>" --linked` — run ad-hoc SQL against remote
- `npx supabase storage cp <local> ss:///bucket/path --linked --experimental` — upload files to Storage
- Env vars: copy `.env.example` to `.env.local` (gitignored) and populate from Supabase → Project Settings → API. Public pages read via `lib/supabase/server.ts` (server components) and `lib/supabase/client.ts` (client components). Rich-text HTML is sanitized through `lib/render-html.ts` (`sanitize-html` — avoid jsdom-pulling libs, they break Vercel's serverless bundler).

## Vercel

Project `nwallace-3136s-projects/ssrg-website` (framework `nextjs`, Node 22). Production: https://ssrg-website-nwallace-3136s-projects.vercel.app.

- `npx vercel deploy` — preview deploy
- `npx vercel deploy --prod` — production deploy
- `npx vercel env ls` / `npx vercel env add <name> <env>` — manage env vars (preview env wants `""` as the branch-positional arg for "all preview branches")
- `npx vercel logs <url> --no-follow --level error -n 50 -x` — runtime logs (use `-x` for full error bodies)
- Project-level settings (framework, Node version, protection) live on Vercel and are patched via `PATCH https://api.vercel.com/v9/projects/<id>?teamId=<team>` with the CLI's cached bearer token at `~/Library/Application Support/com.vercel.cli/auth.json`.

## Default skills for this project

- **Design / UI / UX** → `ui-ux-pro-max:ui-ux-pro-max` (style, color, typography, component libraries)
- **Functional testing** → Playwright MCP (`mcp__plugin_playwright_playwright__browser_*`), specs in `e2e/`
- **Execution workflow** → `superpowers:*` — `brainstorming` → `writing-plans` → `executing-plans` or `subagent-driven-development`, with `test-driven-development`, `systematic-debugging`, and `verification-before-completion`

A `UserPromptSubmit` hook in `.claude/settings.json` auto-nudges Claude toward the right skill based on prompt keywords. See `.claude/hooks/route-skills.sh`.
