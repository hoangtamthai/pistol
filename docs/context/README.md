# Context issue workspace

Open `/context` or `/context/issues`. Both serve the same database-backed workspace, with a searchable issue list on the left and the selected issue's lifecycle on the right. There is no founder overview, scenario switcher, or static workflow demo.

## Navigation and style

- Select a sidebar issue to open `/context/issues/:id`. Its row is highlighted, and its lifecycle resumes from SQLite.
- **Submit issue** opens `/context/issues/new` in the same shell, with the same sidebar, typography, colors, forms, and controls. The optional comment is saved separately from the report.
- Refreshing the sidebar does not clear an in-progress submission. Search filters the sidebar, not the selected lifecycle.
- Report details and all saved evidence open in native dialogs within the same workspace. There is no jump to the older Pistol UI.
- `/issues?issue=:id` forwards to the matching lifecycle. `/issues`, `/demo`, and `/inbox` forward to the issue workspace.
- The separately edited marketing landing page at `/` is left intact. Its dashboard link opens `/context`.
- The original handoff ZIP is unchanged. The published static demo HTML, scripts, engine, and obsolete demo-only tests/guides were removed. `?demo=1` no longer enables a sample scenario.

The source of truth is `public/context-demo/records.html`, `records.js`, `records.css`, and the shared `styles.css`. The directory name is retained for existing asset paths. Use normal anchors when navigating to these documents; every workspace route uses the same shell and stylesheets.

## Workflow and boundaries

The lifecycle advances permitted steps automatically every 1.5 seconds. Human checks require assignment, investigation findings and a fix/verification plan, acknowledgment of the exact fix version, simulated deployment verification, verified customer identity, and separate customer replies. The server enforces these gates. Every verified affected account must confirm before closure.

The page must be open and visible. Details and failed requests pause progression; SQLite preserves the last step. Uncertain save retries reuse their request key, and stale revisions cannot overwrite newer changes.

Issues require no password. Anyone who can reach the app can read and edit records. Keep it local and use sanitized test data. Investigation is supplied by an operator; no repository analysis, PR, test execution, deployment, or customer delivery is performed. Existing paid-provider endpoints retain their separate authentication, but are not part of this UI.

## Validation

```sh
npm test
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
RELAY_DB_PATH="$(mktemp -d)/issues.sqlite" RELAY_WORKSPACE_PASSWORD= npm start -- --port 3101
```

After Ready, run in another terminal using an existing Playwright installation:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright npm run test:context
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CONTEXT_BROWSER=firefox npm run test:context
```

`test:context-workspace` is an alias for the same check. The browser script creates issues, so use a disposable database. Optional overrides: `CONTEXT_BASE_URL` (default `http://127.0.0.1:3101`), `CONTEXT_BROWSER` (default `chromium`), and `CONTEXT_SCREENSHOT_DIR`.

Browser checks cover sidebar selection and browser Back, shared styling across submission/lifecycle pages, comment persistence and safe rendering, lost-response retries, automatic progress and human gates, reload persistence, retired demo routes, empty lists, and horizontal bounds. Unit/API tests cover the transaction and validation rules separately. Stop the disposable server after use.
