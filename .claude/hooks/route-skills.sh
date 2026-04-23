#!/usr/bin/env bash
# route-skills.sh — inspect the user's prompt and nudge Claude toward the
# right skill family. Runs as a UserPromptSubmit hook. Emits JSON with
# hookSpecificOutput.additionalContext when any bucket matches; exits
# silently otherwise.
set -euo pipefail

input="$(cat)"
prompt="$(printf '%s' "$input" | jq -r '.prompt // .user_prompt // ""' | tr '[:upper:]' '[:lower:]')"

hints=()

# Design / UI / UX work → ui-ux-pro-max
if printf '%s' "$prompt" | grep -qE 'design|style|layout|\bui\b|\bux\b|component|hero|section|tailwind|theme|brand|typography|palette|color scheme|landing page|homepage|page layout|responsive'; then
  hints+=("Design/UI work detected. Invoke the 'ui-ux-pro-max:ui-ux-pro-max' skill before writing UI code — it has the style, color, typography, and component libraries scoped for this project.")
fi

# Functional testing → playwright
if printf '%s' "$prompt" | grep -qE 'e2e|end[- ]to[- ]end|playwright|functional test|browser test|smoke test|user flow|regression test'; then
  hints+=("Testing work detected. Use the Playwright MCP tools (mcp__plugin_playwright_playwright__browser_*) for browser-driven tests, and write specs into the existing e2e/ directory.")
fi

# Execution workflow → superpowers
if printf '%s' "$prompt" | grep -qE 'implement|build|fix|debug|refactor|add feature|ship|release|new page|migrate|integrate|wire up'; then
  hints+=("Implementation work detected. Follow the superpowers workflow: brainstorming → writing-plans → executing-plans (or subagent-driven-development), plus test-driven-development, systematic-debugging, and verification-before-completion before claiming done.")
fi

if [ ${#hints[@]} -eq 0 ]; then
  exit 0
fi

printf '%s\n' "${hints[@]}" | jq -Rs --arg event UserPromptSubmit '{
  hookSpecificOutput: {
    hookEventName: $event,
    additionalContext: .
  }
}'
