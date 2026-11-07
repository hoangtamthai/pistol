# Project notes

## Fixes

- Check for .git before running Git commands; this workspace was initialized on branch main during the hackathon. (E)
- ElevenLabs SDK declaration paths vary by version; locate the declaration with find or rg before reading a guessed hooks path. (E)
- Installing Playwright may exceed a 120-second tool timeout; inspect package state and active npm processes before retrying with a longer timeout. (E)
- The registry timed out fetching playwright-core 1.65.0; prefer an already cached compatible Playwright version for browser checks rather than repeatedly fetching latest. (E)
- npm metadata requests also stalled during browser-test setup; use the existing Playwright installation under ~/.npm/_npx for this session instead of further registry requests. (E)
- Before browser automation, verify the actual Next.js port and page heading; port 3000 may already serve another app and cause misleading locator timeouts. (E)
- Wait for React hydration via an interactive action before Playwright screenshots; screenshot caret hiding can mutate an input before hydration and cause a false mismatch. Add an app icon to avoid favicon 404 noise. (E)
- NextRequest.nextUrl can normalize 127.0.0.1 to localhost; same-origin checks must use the actual Host header with the request protocol, with a regression test for loopback aliases. (E)
- Run TypeScript with noUnusedLocals and noUnusedParameters when validating the UI; remove unused icon imports before the final build. (E)
- GitHub CLI (gh) is not installed; use Git directly for remote inspection and pushes rather than assuming gh is available. (E)
- GitHub HTTPS credentials are unavailable in this environment; verify SSH access rather than retrying non-interactive HTTPS pushes. (E)
- SSH access to hoangtamthai/cursor-hackathon returned Repository not found; confirm the repository exists and the authenticated account has access before attempting a push. (E)
- A direct git push retry also returned Repository not found despite successful SSH authentication as hoangtamthai; request the exact repository URL and verify access rather than repeating the same push. (E)

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
