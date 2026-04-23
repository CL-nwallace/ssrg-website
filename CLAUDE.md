# SSRG Website

Migration of the SSRG exotic car club site off Wix onto Next.js 14 (App Router) + Vercel + Supabase + Stripe. Full context lives in `SSRG-Website-Action-Plan.md` and in the per-project memory system (`MEMORY.md` is loaded automatically).

## Dev commands

- `npm run dev` — Next.js dev server at http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx playwright test` — E2E tests under `e2e/`

## Default skills for this project

- **Design / UI / UX** → `ui-ux-pro-max:ui-ux-pro-max` (style, color, typography, component libraries)
- **Functional testing** → Playwright MCP (`mcp__plugin_playwright_playwright__browser_*`), specs in `e2e/`
- **Execution workflow** → `superpowers:*` — `brainstorming` → `writing-plans` → `executing-plans` or `subagent-driven-development`, with `test-driven-development`, `systematic-debugging`, and `verification-before-completion`

A `UserPromptSubmit` hook in `.claude/settings.json` auto-nudges Claude toward the right skill based on prompt keywords. See `.claude/hooks/route-skills.sh`.
