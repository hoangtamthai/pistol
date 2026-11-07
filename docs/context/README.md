# Context main app and demos

The root opens `/context`, rewriting to `public/context-demo/index.html`. The supplied HTML, CSS, and JavaScript run directly, isolated from the older Pistol styles. The new saved-issue pages rewrite to `records.html` and use the password-free SQLite API. Use normal anchors, not client-side Next Links, when navigating to these static documents.

The original `Context-UI-Handoff.zip` is unchanged. The adapted source of truth is `public/context-demo/`, not the original standalone export inside the ZIP. No external integrations, calls, fulfillment, patches, deployments, or customer messages are performed. Saved records need no sign-in. Anyone who can reach the app can read and edit issues; keep it local. Paid ElevenLabs calls retain their optional provider sign-in.

## Saved issues

- `/context/issues/new`: save a title, environment, operational severity, description, and separate optional comment. Sanitization, source deduplication, origin checks, and idempotency apply.
- `/context/issues`: every database issue, searchable by title, owner, state, or ID. Existing records are preserved.
- `/context/issues/:id`: saved lifecycle. It starts automatically and advances permitted steps every 1.5 seconds, with no Next or Continue click after human input.
- Human gates: assignment; missing investigation findings and fix/verification plan; acknowledgment of the exact fix plan; simulated deployment evidence; verified customer identity and separate customer replies. The server enforces these gates, not just the UI.
- Fix plans are internal drafts, not generated GitHub PRs. No tests or deployments are invented. Comments remain visible in report details and the full evidence workspace.
- Browser visibility, open details, and failed requests safely pause automatic advancement. The page must remain open; no worker runs after it closes. SQLite retains the last step for the next visit.
- A response lost after saving can be retried with the same request key without duplicating the issue. Stale revisions refresh for review instead of overwriting another operator's changes.

## Present the original scripted samples

Open `/context?demo=1` for both original scenarios. The default main-page **Issue lifecycle** tab instead opens database issues.

- Desktop viewport: at least 1180 × 700.
- [Exact demo clicks](Context-Demo-Flows.md).
- [Two-minute recording guide](Context-2-Minute-Video-Guide.md). No video has been rendered.
- Each scenario has independent progress, approvals, routing, and channel selection. Restart resets the selected scenario's progress and approvals, retaining its chosen routing.
- Sample state, not database issue state, is stored under `context-workflow-demo-v1` in browser local storage. Missing, invalid, or blocked storage does not prevent playback. Without storage, reloading starts over.
- Changing routing invalidates that scenario's technical approval and customer confirmations and returns it to review. Unchanged routing does not revoke approval.
- Approval, execution, and customer confirmation are separate steps. Saved state is normalized to prevent premature approval or confirmation flags from skipping gates. These are demo guardrails, not production authorization.

## Validate

```sh
npm test
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
npm start -- --port 3100
```

In a second terminal, once Next reports Ready, run the browser checks using an available Playwright installation and installed browsers:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright npm run test:context
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CONTEXT_BROWSER=firefox npm run test:context
```

If Playwright is already resolvable from this repository, omit `PLAYWRIGHT_MODULE`. No new runtime or test package was added. Optional environment variables:

- `CONTEXT_BASE_URL`: defaults to `http://127.0.0.1:3100`.
- `CONTEXT_BROWSER`: defaults to `chromium`.
- `CONTEXT_SCREENSHOT_DIR`: saves desktop captures when set.

`lib/context-demo.test.ts` exercises the actual browser state engine, including approval gates, explicit confirmations, independent resets, routing invalidation, and malformed state restoration.

`scripts/test-context-demo.cjs` clicks both complete presenter flows, rejects unacknowledged PR approval, verifies pending execution and confirmation, tests reloads and scenario independence, checks future detail links, exercises routing changes, pauses playback on dialogs/scenario switches/visibility events, checks keyboard interaction and storage failure, and checks desktop bounds at 1180 × 700, 1280 × 720, and 1920 × 1080. It fails on browser errors, failed HTTP responses, or external requests. Playback timers are advanced with Playwright's clock; hidden-tab handling is exercised through a visibility event.

## Validate saved workflows

Use a disposable database, not your main workspace. Start a second local server after building:

```sh
RELAY_DB_PATH="$(mktemp -d)/issues.sqlite" RELAY_WORKSPACE_PASSWORD= npm start -- --port 3101
```

After Ready, run in another terminal:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright npm run test:context-workspace
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CONTEXT_BROWSER=firefox npm run test:context-workspace
```

This script defaults to port 3101, accepts the same URL/browser/screenshot overrides, and creates test issues. It checks main navigation, password-free access, submission and redacted comments, retry after a lost save response, database listing, all automatic transitions and human gates, recovery, reload persistence, and HTML escaping. Stop the disposable server after use.

`lib/lifecycle.test.ts` covers SQLite reopen, optional comment validation, gate enforcement, approval invalidation, concurrent step conflicts, account-specific confirmation, and safe login redirects. The existing API tests cover password-free issue reads/writes/receipts, retained provider authentication, origin checks, and request limits.

Mobile layouts and real external actions are intentionally out of scope.
