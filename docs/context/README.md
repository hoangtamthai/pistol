# Context demo integration

Open `/context` on the running Next.js app. The URL rewrites to `public/context-demo/index.html`; the supplied HTML, CSS, and JavaScript run directly, isolated from Pistol styles and backend mutations. Use a normal anchor, not a client-side Next Link, if adding navigation to this static document.

The original `Context-UI-Handoff.zip` is unchanged. The adapted source of truth is `public/context-demo/`, not the original standalone export inside the ZIP. No external integrations, credentials, calls, fulfillment, patches, deployments, or customer messages are used.

## Present

- Desktop viewport: at least 1180 × 700.
- [Exact demo clicks](Context-Demo-Flows.md).
- [Two-minute recording guide](Context-2-Minute-Video-Guide.md). No video has been rendered.
- Each scenario has independent progress, approvals, routing, and channel selection. Restart resets the selected scenario's progress and approvals, retaining its chosen routing.
- State is stored under `context-workflow-demo-v1` in browser local storage. Missing, invalid, or blocked storage does not prevent playback. Without storage, reloading starts over.
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

Mobile layouts and real external actions are intentionally out of scope.
