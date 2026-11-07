# Relay

Customer issue intelligence: preserve the report, review the evidence, coordinate engineering work, and verify each customer's recovery.

The app now includes a **password-protected, single-workspace SQLite MVP** at `/issues`, based on [the customer issue specification](docs/customer-issue-intelligence-technical-spec.md). The original synthetic decision/voice demo remains at `/demo`, with its inbox at `/inbox`.

## Run

Requires **Node.js 24+** for the built-in SQLite API. No database service or new package is needed.

```bash
npm install
cp .env.example .env.local
# Edit .env.local: set RELAY_WORKSPACE_PASSWORD to at least 4 characters; special characters are optional.
npm run dev
```

Open the address printed by Next.js, normally http://127.0.0.1:3000. The root opens `/issues`, which redirects to `/login` until signed in. There is no default password. Four-letter passwords are accepted for local use; longer unique passwords are recommended. Sessions expire after eight hours; changing the password revokes them. The original fictional demo is publicly readable, but funded voice sessions require workspace sign-in.

SQLite defaults to `data/relay.sqlite`. Set `RELAY_DB_PATH` to change it. Reports, revisions, reviews, evidence, proposals, simulated Jira mappings, scenarios, account outcomes, completed intake jobs, and audit events survive browser and server restarts. The database and sidecar files are tracked by Git at the operator's request. Keep only sanitized test data in them: committing exposes their contents to repository readers. The local database file is owner-readable/writable only; those permissions do not protect committed copies.

```bash
npm test
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
npm start
```

## Durable workflow

1. **Triage:** two seeded canonical issues and cross-channel report fixtures. Search by title, owner, or lifecycle state; queue ordering is severity-first. Associated ARR uses a union of verified account IDs, never message counts.
2. **Report intake:** submit sanitized test text through the authenticated form. Source + external ID + revision deduplicates delivery. New source revisions preserve earlier wording. Received time is recorded; occurrence time is not invented. Public sources remain unverified and cannot be mapped to an account in this MVP.
3. **Context:** review original reports and up to three clarification templates. Record customer answers/corrections. New manually submitted reports have no telemetry; the UI says so. Identity mapping requires an explicit operator verification basis against the local fixture account register.
4. **Relationships:** same-environment keyword matches are proposals only. Inspect evidence, confirm/reject/abstain, or undo a review. A reviewed candidate cause is still a hypothesis, not confirmed causation. A relationship map and equivalent list expose the same records.
5. **Investigation:** the export fixture includes a labeled event timeline, repository/deployment example, candidate commit, excluded undeployed commit, counterevidence, ownership basis, and proposed tests. No actual repository was analyzed or tested.
6. **Decision:** compare clarify/workaround/fix/defer options. Save deterministic capacity/cost scenarios with explicit inputs, incident reserve, weekday calendar, and baseline milestone displacement. Unknown rates produce unknown cost, not invented values. No roadmap writes.
7. **Jira simulation:** save and approve an immutable payload, then simulate create/link. Existing issue mappings are reused. Simulated Jira Done does not imply deployment or recovery.
8. **Follow-up:** a simulated deployment creates verification tasks, including reviewed downstream symptoms. Draft a customer-safe message for a verified fixture contact, approve its exact version, optionally preview audio, then simulate delivery. Each account's recovery is recorded separately with evidence; a “persists” answer reopens the case.

Mutations use optimistic case revisions and idempotency keys inside SQLite transactions. Reusing a key with a different payload fails. A changed message for the same recipient invalidates its previous pending version. **Any case mutation conservatively invalidates all pending workspace approvals**, including approved ones; immutable completed simulation records remain history. Approval and execution recheck case revision. No external send is implemented.

## ElevenLabs

### Approved message audio preview

Set server-side `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`, then restart. In **Follow-up**, save and approve a message, explicitly consent to provider processing, and click **Generate ElevenLabs audio preview** before simulating delivery.

Only that approved message text is sent, not the full case, commercial register, or repository fixture. The server checks approval again after generation and discards stale results. Preview requests have a 30-second timeout, an 8 MB response limit, and a durable limit of 10 attempts per UTC day. Failures may consume provider credits; retries are never automatic. Audio remains in browser memory, not persisted storage. No phone call is placed.

API contract: [ElevenLabs Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), `POST /v1/text-to-speech/:voice_id`, MP3, `eleven_multilingual_v2`. Provider retention depends on the account; this app does not claim zero retention.

### Original live assistant

Follow [docs/elevenlabs.md](docs/elevenlabs.md), set `ELEVENLABS_AGENT_ID`, sign in to the workspace, and open `/demo`. The existing ElevenLabs conversation is scoped to the original synthetic brief, **not the SQLite case data**. Its scripted offline fallback requires no provider. The legacy demo's drafts and outcomes remain session-only and separate from the durable workspace.

## API and storage

- `POST /api/workspace/session`: password sign-in; HttpOnly, SameSite=Strict session cookie.
- `DELETE /api/workspace/session`: clear the current browser session.
- `GET /api/issues`: authenticated workspace snapshot, capped at 500 report revisions and the latest 100 audit events. No shared caching.
- `POST /api/issues`: validated command, `Idempotency-Key` header required. Actions: `intake`, `context`, `map_account`, `relationship`, `state`, `scenario`, `proposal`, `approve`, `execute`, `work_done`, `deployment`, `outcome`. Case actions require `issueId` and `revision`.
- `GET /api/jobs/:id`: authenticated durable intake receipt with the completed deterministic stage and explicit analysis limitations.
- `POST /api/outreach/audio`: current approved proposal ID plus explicit provider consent.

The command API intentionally consolidates the spec's proposed endpoint list. Workspace and actor come from the authenticated local session; submitted `workspaceId` or `actor` fields are rejected. Mutations require exact same-origin requests. JSON bodies are capped at 20 KB. SQL statements are parameterized; domain changes and audit/idempotency records commit together.

SQLite has separate entity tables storing versioned JSON records and a unique source revision index. Same-workspace relationships are checked by the application; this is not PostgreSQL row security or multi-tenant foreign-key isolation. Intake's small deterministic work completes synchronously and leaves a durable completed job receipt. **There is no asynchronous worker or external action outbox yet**, so no queued provider work or restart-retry guarantee is claimed.

Back up with a SQLite-aware backup tool, or stop the app cleanly before copying the database. Do not copy an active SQLite file without accounting for its WAL. Schema version 1 is initialized automatically; existing records are not reset on restart.

## Boundaries before a pilot

This implements a local MVP slice, **not all production requirements in the specification**:

- One shared local operator password, not per-user roles, SSO, tenant isolation, or source-level permissions. Login throttling is per server process. Keep the default loopback binding; do not expose publicly.
- Sanitized test data only. Text redaction handles common URL query/fragment, credential-header, and labeled secret patterns; it is not comprehensive DLP. Attachments, recording, input capture, arbitrary URL fetching, and telemetry collectors are deliberately unsupported.
- No verified customer clarification links or identity provider. Responses are recorded by the authenticated operator. No automated context extraction, evaluated matching model, AI diagnostic pipeline, or arbitrary repository access.
- No live Jira/CRM/helpdesk/Slack connector, webhook reconciliation, durable remote outbox, unknown-result recovery, scheduled public discovery, or phone delivery.
- The small relationship map uses existing React/CSS, not React Flow. No arbitrary graph authoring, merge/split workflow, causal confirmation, or dependency scheduler. Reviewer undo preserves events.
- Planning supports one sequential team with explicit capacity and reserved incident time. No holidays, parallel teams, uncertain dependency resolution, customer-deadline slack, or approved roadmap publication. Default estimates belong only to the seeded example; new issues require engineering estimates.
- No deletion/revocation propagation, automated retention, encrypted-at-rest storage, permission-filtered retrieval, or production migrations. Protect the host and backups. Record and test these controls before real customer data.
- The 500-report local snapshot is not a paginated large-dataset API. Increase scope only with query pagination and a durable processing design.

## Validation

Automated checks cover source replay and revision preservation, SQLite reopen, optimistic conflicts, immutable approval invalidation, account/ARR deduplication, different-environment abstention, public identity restrictions, redaction canaries, Jira mapping reuse, deployment-versus-recovery separation, downstream verification, reopened outcomes, capacity calculations, authentication, CSRF, bounded request parsing, and mocked ElevenLabs egress/stale-result handling.

These are deterministic regression tests, not a model-accuracy evaluation or production security audit. Live credentials, real delivery, repository diagnosis accuracy, and customer outcomes are not validated by the tests.

## Main files

- `components/issue-workspace.tsx`, `app/issues.css`: persistent triage, case, relationship, decision, and follow-up views.
- `lib/issues.ts`: DTOs, validation, redaction, account union, deterministic scenarios, customer-safe draft template.
- `lib/case-store.ts`: SQLite transactions, fixtures, revision checks, approvals, audit trail, local simulation adapters.
- `lib/workspace-auth.ts`: single-operator session, origin checks, bounded JSON parsing.
- `app/api/issues/route.ts`, `app/api/outreach/audio/route.ts`: authenticated commands and optional approved audio.
- `components/workspace.tsx`, `lib/demo.ts`: original synthetic demo, retained at `/demo`.
