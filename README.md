# Context

Customer issue intelligence: preserve the report, review the evidence, coordinate engineering work, and verify each customer's recovery.

The main app uses the Context handoff UI with a **password-free, single-workspace SQLite workflow**. Submit issues at `/context/issues/new`, browse every saved issue at `/context/issues`, and open an issue's automatic lifecycle. A persistent left sidebar lists saved issues; selecting one opens its lifecycle on the right without changing the visual style. Submission and evidence details use the same shell. The old `/issues`, `/demo`, and `/inbox` interfaces now redirect to this workspace.

## Run

Requires **Node.js 24+** for the built-in SQLite API. No database service or new package is needed.

```bash
npm install
cp .env.example .env.local
# No password is needed for issues. Configure ElevenLabs only if using paid voice features.
npm run dev
```

Open the address printed by Next.js, normally http://127.0.0.1:3000. Open `/context` directly, or use the landing page's dashboard link. Issue submission, records, saved lifecycles, and the full evidence workspace do not require sign-in, even if a password remains in your environment. Anyone who can reach the app can read and edit its database. Keep it local and use sanitized test data. Paid ElevenLabs features still require the optional `/login` session and `RELAY_WORKSPACE_PASSWORD`; provider sessions expire after eight hours.

SQLite defaults to `data/relay.sqlite`. Set `RELAY_DB_PATH` to change it. Reports, revisions, reviews, evidence, proposals, simulated Jira mappings, scenarios, account outcomes, completed intake jobs, and audit events survive browser and server restarts. The database and sidecar files are tracked by Git at the operator's request. Keep only sanitized test data in them: committing exposes their contents to repository readers. The local database file is owner-readable/writable only; those permissions do not protect committed copies.

```bash
npm test
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
npm start
```

## Main Context workflow

- `/context`: the saved-issue workspace, with a searchable left sidebar and a lifecycle/detail area on the right. No static demo or scenario switcher.
- `/context/issues/new`: issue title, environment, severity, description, and an optional **Comment** saved separately on the report. Submission opens the new issue's lifecycle. Retrying an uncertain save reuses the same idempotency key.
- `/context/issues`: the same workspace shell. Every database issue appears in the left sidebar, including existing fixtures. Search by title, owner, state, or ID, then select a row to open its lifecycle. The selected row is highlighted.
- `/context/issues/:id`: automatic progression through report, context, ownership, investigation, fix planning, review, deployment verification, follow-up, and recovery. No Next or Continue button is needed. Human checks require ownership, investigation findings, exact-version fix acknowledgment, explicit simulated deployment verification, verified identity, and customer replies. Unknown evidence is never replaced with the CV-upload sample.

Progress is saved in SQLite. The browser advances permitted steps while the page is open and visible; there is no background worker. Details and request errors pause progression safely. Case changes invalidate pending approvals. Every verified affected account must confirm before closure; a persistent problem reopens the case. Deployment and customer replies remain operator-recorded simulations, not live integrations.

The static demo page, scripts, engine, and demo-only guides/tests have been removed; `?demo=1` no longer selects a sample scenario. Original handoff ZIPs and database fixtures are preserved. See [workspace behavior and browser validation](docs/context/README.md).

## Retained domain capabilities

The following pre-existing capabilities remain in the command API and fixtures. Advanced relationship, planning, Jira, and provider controls from the old Pistol UI are not exposed in the unified lifecycle UI.

1. **Triage:** two seeded canonical issues and cross-channel report fixtures. Search by title, owner, or lifecycle state; queue ordering is severity-first. Associated ARR uses a union of verified account IDs, never message counts.
2. **Report intake:** submit sanitized test text through the password-free form. Source + external ID + revision deduplicates delivery. New source revisions preserve earlier wording. Received time is recorded; occurrence time is not invented. Public sources remain unverified and cannot be mapped to an account in this MVP.
3. **Context:** review original reports and up to three clarification templates. Record customer answers/corrections. New manually submitted reports have no telemetry; the UI says so. Identity mapping requires an explicit operator verification basis against the local fixture account register.
4. **Relationships:** same-environment keyword matches are proposals only. Inspect evidence, confirm/reject/abstain, or undo a review. A reviewed candidate cause is still a hypothesis, not confirmed causation. Relationship records remain in the workspace snapshot.
5. **Investigation:** the export fixture includes a labeled event timeline, repository/deployment example, candidate commit, excluded undeployed commit, counterevidence, ownership basis, and proposed tests. No actual repository was analyzed or tested.
6. **Decision:** compare clarify/workaround/fix/defer options. Save deterministic capacity/cost scenarios with explicit inputs, incident reserve, weekday calendar, and baseline milestone displacement. Unknown rates produce unknown cost, not invented values. No roadmap writes.
7. **Jira simulation:** save and approve an immutable payload, then simulate create/link. Existing issue mappings are reused. Simulated Jira Done does not imply deployment or recovery.
8. **Follow-up:** a simulated deployment creates verification tasks, including reviewed downstream symptoms. Draft a customer-safe message for a verified fixture contact, approve its exact version, optionally preview audio, then simulate delivery. Each account's recovery is recorded separately with evidence; a “persists” answer reopens the case.

Mutations use optimistic case revisions and idempotency keys inside SQLite transactions. Reusing a key with a different payload fails. A changed message for the same recipient invalidates its previous pending version. **Case evidence, ownership, and outcome mutations conservatively invalidate all pending workspace approvals**, including approved ones; immutable completed simulation records remain history. Approval and execution recheck case revision. Automatic workflow cursor advances do not change evidence or invalidate approvals; they check both the case revision and expected step inside the transaction. No external send is implemented.

## ElevenLabs

### Approved message audio preview

Set server-side `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `RELAY_WORKSPACE_PASSWORD`, then restart and authorize provider access at `/login`. The provider endpoint remains available for approved payloads with explicit consent; the new lifecycle UI does not expose audio controls.

Only that approved message text is sent, not the full case, commercial register, or repository fixture. The server checks approval again after generation and discards stale results. Preview requests have a 30-second timeout, an 8 MB response limit, and a durable limit of 10 attempts per UTC day. Failures may consume provider credits; retries are never automatic. Audio remains in browser memory, not persisted storage. No phone call is placed.

API contract: [ElevenLabs Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), `POST /v1/text-to-speech/:voice_id`, MP3, `eleven_multilingual_v2`. Provider retention depends on the account; this app does not claim zero retention.

### Original live assistant

The old live-assistant UI has been retired with the `/demo` route. Provider handlers and [historical setup notes](docs/elevenlabs.md) are retained, but no voice session runs in the unified issue workspace.

## API and storage

- `POST /api/workspace/session`: optional paid-provider sign-in; HttpOnly, SameSite=Strict session cookie.
- `DELETE /api/workspace/session`: clear the current browser session.
- `GET /api/issues`: password-free workspace snapshot, capped at 500 report revisions and the latest 100 audit events. No shared caching.
- `GET /api/issues?issue=:id`: password-free issue, original reports/comments, investigation, fix plan, outcomes, and server-computed lifecycle gates.
- `POST /api/issues`: validated command, `Idempotency-Key` header required. Actions: `intake`, `context`, `map_account`, `relationship`, `state`, `scenario`, `proposal`, `approve`, `execute`, `work_done`, `deployment`, `outcome`, `workflow_advance`, `workflow_investigation`, `workflow_deploy`, `workflow_confirm`. Fix approvals and workflow verification require explicit acknowledgment. Case actions require `issueId` and `revision`.
- `GET /api/jobs/:id`: password-free durable intake receipt with the completed deterministic stage and explicit analysis limitations.
- `POST /api/outreach/audio`: current approved proposal ID plus explicit provider consent.

The command API intentionally consolidates the spec's proposed endpoint list. Workspace and actor use the fixed local workspace identity, not per-user authentication; submitted `workspaceId` or `actor` fields are rejected. Mutations require exact same-origin requests. JSON bodies are capped at 20 KB. SQL statements are parameterized; domain changes and audit/idempotency records commit together.

SQLite has separate entity tables storing versioned JSON records and a unique source revision index. Same-workspace relationships are checked by the application; this is not PostgreSQL row security or multi-tenant foreign-key isolation. Intake's small deterministic work completes synchronously and leaves a durable completed job receipt. **There is no asynchronous worker or external action outbox yet**, so no queued provider work or restart-retry guarantee is claimed.

Back up with a SQLite-aware backup tool, or stop the app cleanly before copying the database. Do not copy an active SQLite file without accounting for its WAL. Schema version 1 is initialized automatically; existing records are not reset on restart.

## Boundaries before a pilot

This implements a local MVP slice, **not all production requirements in the specification**:

- Issue access has no authentication or per-user roles. Anyone who can reach the app can read and edit all records. Same-origin checks are not access control. Keep the default loopback binding; do not expose publicly. Paid ElevenLabs features retain their separate session check; login throttling is per server process.
- Sanitized test data only. Text redaction handles common URL query/fragment, credential-header, and labeled secret patterns; it is not comprehensive DLP. Attachments, recording, input capture, arbitrary URL fetching, and telemetry collectors are deliberately unsupported.
- No verified customer clarification links or identity provider. Responses are recorded by the local operator without per-user identity verification. No automated context extraction, evaluated matching model, AI diagnostic pipeline, or arbitrary repository access.
- No live Jira/CRM/helpdesk/Slack connector, webhook reconciliation, durable remote outbox, unknown-result recovery, scheduled public discovery, or phone delivery.
- The lifecycle uses the existing Context HTML/CSS style, not React Flow. No arbitrary graph authoring, merge/split workflow, causal confirmation, or dependency scheduler. Reviewer undo preserves events.
- Planning supports one sequential team with explicit capacity and reserved incident time. No holidays, parallel teams, uncertain dependency resolution, customer-deadline slack, or approved roadmap publication. Default estimates belong only to the seeded example; new issues require engineering estimates.
- No deletion/revocation propagation, automated retention, encrypted-at-rest storage, permission-filtered retrieval, or production migrations. Protect the host and backups. Record and test these controls before real customer data.
- The 500-report local snapshot is not a paginated large-dataset API. Increase scope only with query pagination and a durable processing design.

## Validation

Automated checks cover source replay and revision preservation, SQLite reopen, optimistic conflicts, immutable approval invalidation, account/ARR deduplication, different-environment abstention, public identity restrictions, redaction canaries, Jira mapping reuse, deployment-versus-recovery separation, downstream verification, reopened outcomes, capacity calculations, password-free issue access, paid-provider authentication, origin checks, bounded request parsing, and mocked ElevenLabs egress/stale-result handling.

These are deterministic regression tests, not a model-accuracy evaluation or production security audit. Live credentials, real delivery, repository diagnosis accuracy, and customer outcomes are not validated by the tests.

## Main files

- `public/context-demo/records.html`, `records.css`, `records.js`: new Context submission, all-issues, and automatic lifecycle pages.
- `lib/lifecycle.ts`: evidence-backed lifecycle gates shared by API reads and transactional commands.
- `components/issue-workspace.tsx`, `app/issues.css`: retained older UI source, no longer served by `/issues`.
- `lib/issues.ts`: DTOs, validation, redaction, account union, deterministic scenarios, customer-safe draft template.
- `lib/case-store.ts`: SQLite transactions, fixtures, revision checks, approvals, audit trail, local simulation adapters.
- `lib/workspace-auth.ts`: optional paid-provider session, origin checks, bounded JSON parsing.
- `app/api/issues/route.ts`, `app/api/outreach/audio/route.ts`: password-free issue commands and separately authenticated approved audio.
- `components/workspace.tsx`, `lib/demo.ts`: retained older demo source and shared fixtures; `/demo` now redirects to the issue workspace.
