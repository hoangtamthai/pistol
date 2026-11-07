# Customer Issue Intelligence — Technical Specification

Version: 0.1 · 7 November 2026 · Status: proposed architecture, not an implemented system

## 1. Product objective

Build an evidence-driven coordination layer between customers, support, customer success, engineering, and product planning.

The system collects feedback from different platforms, reconstructs the customer's context, groups related reports, investigates possible technical causes, recommends ownership and solutions, assesses commercial and delivery tradeoffs, and manages customer follow-up.

Core question: **What happened, what evidence do we have, who is affected, what should we do, who owns it, and what changes if we prioritize it?**

Primary users: support/customer success leads, support agents, engineering leads, developers, and product owners at B2B SaaS companies. Commercial value and willingness to pay remain hypotheses to validate.

## 2. Scope and delivery stages

| Capability | One-day demonstration | Pilot / production direction |
|---|---|---|
| Feedback intake | One real report form or connector; labeled fixtures for other channels | Helpdesk, email, Slack, call transcripts, public sources |
| Context collection | Short customer clarification form; sanitized event and trace fixture | Instrumented application, observability integration, permission-aware document retrieval |
| Grouping | Suggest matches; human confirms links | Evaluated matching pipeline, reversible merges and splits |
| Issue relationship graph | Small interactive graph with evidence on edges | Incremental graph updates and reviewer workflow |
| Engineering investigation | Known example repository, release history, diagnostic summary | Authorized repository and deployment integrations; optional reviewed patch proposals |
| Jira | Real create/link and refresh if credentials are ready; otherwise labeled adapter simulation | Reliable bidirectional reconciliation and workflow mapping |
| Impact and planning | Imported account/roadmap data and transparent scenario calculations | CRM synchronization and capacity-aware scheduling |
| Outreach | Draft email and ElevenLabs audio preview | Approved email delivery and scheduled, approved telephone calls |
| Public monitoring | Search approved public sources; propose an internal intake ticket | Scheduled monitoring, coverage reporting, source-specific adapters |
| Deployment | Single-workspace local demo | Hardened private deployment and optional hosted service |

Do not present the demonstration as production-ready. Defer autonomous code changes, automatic causal conclusions, comprehensive social-media coverage, and automatic roadmap changes.

## 3. Foundational distinctions

1. **Report:** one customer or public statement, preserved with its source and revisions. A report may contain multiple problems.
2. **Canonical issue:** the shared problem being investigated. Many reports can link to one issue; one report can link to several issues.
3. **Diagnosis:** a hypothesis about why an issue occurs, supported or contradicted by evidence. A hypothesis is not a confirmed cause.
4. **Engineering work item:** a Jira issue, investigation, workaround, or fix associated with a canonical issue.
5. **Account outcome:** whether a particular affected customer received help and confirmed recovery.

Keep these separate. Similar language does not prove a shared cause. A merged pull request does not prove deployment. A deployed fix does not prove every customer's problem is resolved.

## 4. Architecture and technology choices

Use a modular monolith for the first implementation. Functional agent stages run through a controlled workflow; they do not require separate services or autonomous agents.

| Layer | Proposed implementation | Responsibility |
|---|---|---|
| Web application | React + TypeScript | Intake, case workspace, relationship graph, decision review |
| Graph interface | React Flow | Issue and evidence relationships; support an equivalent list/table view [S7] |
| API and worker | Node.js + TypeScript, shared domain modules | Authentication, business rules, connectors, background processing |
| Database | PostgreSQL | Cases, relationships, jobs, source links, permissions, audit records |
| Retrieval | PostgreSQL full-text and structured filtering initially; optional vector retrieval later | Retrieve permission-compatible evidence and candidate duplicates |
| File storage | Private local volume for demo; private object storage for pilot | Sanitized attachments, approved audio, document versions |
| Jobs | PostgreSQL-backed durable jobs and action outbox | Retrying ingestion, analysis, synchronization, and delivery |
| Model access | Provider adapter with structured response validation | Extraction, clarification, hypotheses, explanations, message drafts |
| External services | Jira, repository provider, observability provider, Exa, ElevenLabs + telephony | Integration capabilities described below |

Data flow:

`Sources → authenticated ingestion → redaction → normalized reports/evidence → context enrichment → matching and investigation → graph + impact assessment → reviewed action proposals → connectors → outcome synchronization`

The database is authoritative for internal cases and approvals. Jira is authoritative for mapped engineering work status. CRM/imported commercial records are authoritative for commercial facts. Model output is never authoritative for identity, contracts, permissions, or deadlines.

## 5. Functional requirements

### FR-01 — Multi-platform intake and public discovery

Normalize every source into a versioned report envelope:

```typescript
type ReportEnvelope = {
  schemaVersion: 1;
  workspaceId: string;            // derived from authenticated connector, not trusted payload
  source: 'form' | 'helpdesk' | 'email' | 'slack' | 'call' | 'public_web';
  externalId: string;
  sourceRevision: string;
  sourceUrl?: string;
  occurredAt?: string;            // distinguish unknown occurrence time from ingestion time
  receivedAt: string;
  accountId?: string;             // only after verified identity mapping
  contactId?: string;
  sanitizedText: string;
  evidenceIds: string[];
  visibilityPolicyId: string;
  environment?: string;
  releaseId?: string;
  traceId?: string;
  sessionId?: string;
};
```

- Authenticate each connector and bind it to one workspace. Do not infer account membership from an arbitrary submitted account ID.
- Enforce uniqueness on workspace + connector + external ID + revision. Replayed delivery must not duplicate reports or trigger repeated outreach.
- Preserve edits and deletion notices; invalidate affected summaries and proposals when source evidence changes.
- Classify sentiment separately from issue type, operational severity, and urgency. An angry message is not automatically a severe incident.
- Reports that contain several problems must be splittable without losing their shared source.

Public monitoring:

- Configure company/product aliases, explicit domain exclusions, languages, approved sources, and search windows.
- Use Exa search/content retrieval as one discovery adapter; its search API supports returning source results and content [S6]. Search coverage is partial and indexing may lag.
- Track publication time, retrieval time, URL, permitted excerpt, language, product relevance, actionability, and provenance. Do not invent an original event date.
- Distinguish actionable malfunction reports, feature requests, general negative opinion, unrelated brand mentions, and spam.
- Deduplicate by canonical source URL, external post ID, content similarity, and known syndication. Repeated posts are not additional affected customers.
- Automatically create an **internal unverified intake ticket** for eligible findings. Link or propose a canonical issue. Jira creation requires the normal review/policy gate.
- Do not infer customer identity, contract value, or permission to contact someone from a public username. Private channels and unsupported platforms require authorized adapters; no universal internet coverage claim.

### FR-02 — Reconstruct missing customer context

Build a context checklist: affected workflow, expected behavior, actual behavior, steps, approximate time/timezone, environment/browser, release, error, frequency, impact, and relevant trace/session IDs.

Sources, in preferred order:

1. Existing linked support history and authorized documents.
2. Deterministically linked application events, error traces, and release information.
3. Targeted customer clarification for missing facts.

Customer clarification:

- Generate at most three high-value questions in one round; avoid requesting facts already available.
- Let a support user approve the request or use an explicitly configured clarification policy.
- Deliver a short-lived, revocable form link bound to the intended workspace/case/contact; verify identity before showing private case details.
- Accept corrections, “I don't know,” and optional reproduction steps. Resume analysis when answers arrive.
- If telemetry was not collected, say so. The system cannot reconstruct historical actions that were never recorded.
- Keep security incidents and urgently disruptive reports moving through escalation even while context is incomplete.

Application instrumentation:

- Prefer an existing observability/session replay integration over a custom recorder. Sentry can connect replays to errors and related diagnostic context; its product documentation describes default masking before transmission [S3]. Validate configuration for the actual application.
- A minimal first-party event recorder captures allowlisted semantic actions such as `export.clicked`, route templates, timestamps, result codes, release IDs, and trace references.
- Default exclusions: input values, keystrokes, passwords, access tokens, authorization headers, cookies, payment fields, URL query values, free-text DOM content, and request/response bodies.
- Redact before transmission and storage. Test console logs, URLs, stack messages, and attachments separately; masking DOM text alone is insufficient.
- Default to sanitized event timelines, not screenshots or continuous screen video. Replay is an explicitly configured capability with masking tests, bounded retention, and clear user controls.
- Backend instrumentation is needed to connect browser actions to server traces. Correlation IDs alone do not provide stack traces or business state.

Output: a context bundle with reproduction steps, supporting sources, contradictions, missing fields, and completeness indicators. Never fill missing fields with invented values.

### FR-03 — Issue matching and relationship graph

Matching pipeline:

1. Restrict candidates to authorized workspace/product/environment records.
2. Find exact technical signatures: provider error group, normalized error fingerprint, endpoint, trace-linked failure, or previously linked issue.
3. Retrieve text-similar candidates and compare environment, release, reproduction steps, and contradictions.
4. Return proposed matches with reasons, evidence, and an abstention option.
5. A reviewer confirms matches in the MVP. Numeric similarity is not a calibrated probability.

Graph entities: reports, canonical issues, diagnostic hypotheses, services, releases, commits, work items, and relevant account links.

| Relationship | Direction and meaning | Validation |
|---|---|---|
| `REPORTS` | report → canonical issue | confirmed or proposed mapping |
| `RELATED_TO` | issue ↔ issue | shared context without causal implication |
| `POSSIBLY_CAUSED_BY` | symptom issue → candidate underlying issue/diagnosis | hypothesis with evidence and counterevidence |
| `CAUSED_BY` | symptom issue → verified underlying issue/diagnosis | engineer-confirmed finding with recorded basis |
| `DEPENDS_ON` | work item → prerequisite work item | reviewed planning dependency |
| `OBSERVED_IN` | issue → environment-specific release/deployment | observed telemetry or verified report |
| `SUSPECT_COMMIT` | diagnosis → commit | candidate only |
| `ADDRESSED_BY` | issue → work item or fix commit | proposed or verified implementation relationship |

Store every edge with status (`proposed`, `confirmed`, `rejected`, `superseded`), evidence IDs, rationale, creator/model version, timestamps, and reviewer.

Requirements:

- The graph must visually distinguish hypotheses from confirmed relationships and support source inspection on click.
- Display related reports, affected account union, and potentially relieved downstream issues when selecting an underlying issue.
- Root-issue impact uses a union of linked account IDs; never sum overlapping child totals.
- Fixing an underlying issue generates verification tasks for downstream issues. It does not automatically resolve or notify them as fixed.
- Prevent cycles in approved scheduling dependencies; flag conflicting causal links for review.
- Merge/split operations preserve history, external mappings, original IDs, and an undo path. Explicitly reconcile multiple Jira tickets instead of silently deleting one.
- Use relational node/edge tables initially. A separate graph database is unnecessary for the demonstration.

### FR-04 — Developer investigation and code context

Inputs: context bundle, sanitized trace/stack frames, product/environment, deployed release, service map, authorized repository snapshots, relevant pull requests/diffs, runbooks, and prior fixes.

Investigation sequence:

1. Establish observed failure time and deployed version for the affected environment; identify a last-known-good observation where available.
2. Map stack frames to source at that version. Minified JavaScript may require matching source maps or debug metadata.
3. Identify candidate commits contained in the affected deployment, relevant changed code, and configuration/feature-flag changes. A release name alone is insufficient evidence of what reached the customer.
4. Rank candidates using changed-file overlap, reproduction evidence, timing, and deployment membership. Exclude commits not present in that environment. Retain non-code explanations such as configuration and upstream outages.
5. Produce a diagnostic brief: observed facts, ranked hypotheses, counterevidence, reproduction approach, suggested tests, and possible workaround/fix direction.

Observability integrations may already provide suspect-commit information. Sentry documents suspect-commit investigation and an API for release commit lists [S4]. Reuse these as evidence; do not represent them as proof.

Ownership precedence: explicit service ownership map → reviewed repository ownership → existing canonical issue owner → triage team. GitHub CODEOWNERS describes repository path ownership [S5]; map identities to eligible Jira accounts. Latest commit author is only an investigation clue.

Pilot extension: propose a patch on an isolated branch and open a draft pull request after an approved action. Execute builds/tests only in an isolated environment without production credentials and with restricted network access. Record actual test commands/results; unexecuted tests remain unverified. No automatic merge, deployment, or rollback.

### FR-05 — Ownership, status tracking, and Jira

Before creating a Jira issue, search existing external mappings and relevant candidates. Create one approved work item per canonical issue/project unless a reviewer explicitly requests additional implementation tasks.

Jira payload: concise problem, customer-visible impact, expected/actual behavior, reproduction steps, environment/release, sanitized diagnostic evidence, proposed owner/component, priority rationale, acceptance criteria, and source links. Commercial details and restricted customer data must be omitted unless the destination audience is authorized.

The Jira API supports issue creation, assignment, and transitions; integration code must retrieve the project's required fields and eligible assignments rather than hardcoding one universal workflow [S1].

Synchronization requirements:

- Maintain a local↔external mapping and explicit status translation per project.
- Receive supported webhooks; acknowledge quickly and process asynchronously. Reconcile periodically to recover missed events.
- Jira documents retries and repeated delivery, including a webhook identifier for deduplication [S2]. Authenticate using the selected integration's supported mechanism and deduplicate events.
- Use an outbox and a stable correlation marker for issue creation. If a remote timeout leaves the result unknown, search/reconcile before retrying creation; never claim exactly-once delivery across providers.
- Reject stale updates; check authoritative state before applying an action when event ordering is uncertain. Track origin/version to prevent sync loops.
- Missing permissions or unavailable assignees route the case to triage with an actionable error.

Issue lifecycle: `new → needs_context / triaged → investigating → planned → in_progress → verifying → resolved`, with `reopened` returning to triage and `dismissed` requiring a reason.

Track deployment and account recovery separately. Record owner acceptance, state changes, next update due, and escalation reminders. Only authorized humans or explicit bounded policies can make external changes.

### FR-06 — Documents, commercial impact, and prioritization

Retrieve versioned contracts/CRM facts, customer requirements, runbooks, relevant design/technical documents, commitments, and roadmap entries. Preserve page/section or record references, access policy, retrieved-at time, and source version. Invalidate derived estimates when inputs change.

Decision brief fields:

- Customer disruption, severity, unique affected accounts/users where known.
- Associated annual recurring revenue (ARR), clearly labeled and deduplicated by account.
- Explicit renewal/sales blockers, renewal dates, contractual commitments, and evidence.
- Options: defer, clarify, workaround, permanent fix, approved external product/integration.
- Estimated delivery/maintenance/support costs and incremental commercial benefit/loss scenarios.
- Owner, assumptions, confidence category, missing data, and timeline consequences.

Financial rules:

- Store amounts with currency, time horizon, source, and estimate version. Convert only with a recorded rate/date; otherwise show currencies separately.
- Associated ARR is descriptive exposure, not predicted loss. Do not add prospective sales pipeline, ARR, and monthly savings as if they share a basis.
- Keep renewal retention, expansion, and labor savings separate. Distinguish annual contract value from cash timing and profit.
- If justified probabilities exist, estimate incremental retained contract value as `contract value × (loss probability without action − loss probability with action)` over one defined renewal horizon. Human-entered scenario assumptions must be labeled; missing probabilities produce ranges/scenarios, not fabricated expected values.
- Estimate implementation cost from engineering/QA effort × applicable loaded rates, plus tool and incremental support costs. Count maintenance over an explicit horizon.
- Calculate option comparisons with deterministic code. The model explains inputs and tradeoffs; it does not invent numbers.
- Do not sum overlapping impacts across related issues or independently attribute the same renewal benefit to several fixes.

Prioritization: operational severity and security escalation take precedence over commercial ranking. Within the same urgency class, use an explicit configurable rule based on customer blockage, deadlines, affected accounts, evidence quality, and effort. Show the rationale and missing inputs. A high-value account does not suppress a widespread incident affecting smaller accounts.

### FR-07 — Timeline and roadmap scenarios

Inputs: approved work items, dependency edges, owning teams, estimated effort ranges, team calendars/capacity, current commitments, testing/review work, customer deadlines, and proposed preemption rules.

For each option, compare an unchanged baseline with a scenario that inserts the proposed work. For the MVP use a deterministic scheduler with explicit assumptions: per-team capacity, indivisible tasks unless marked splittable, dependency ordering, non-working days, and reserved incident capacity.

Show earliest feasible start, finish range, slack before customer deadline, displaced work, baseline versus scenario milestone dates, incremental cost, and uncertain dependencies. Preserve the input snapshot and estimate version for reproducibility.

Illustration only: a team has 4 engineer-days of weekly available capacity. A 6 engineer-day task consumes about 1.5 weeks of that capacity before considering dependencies and QA. It is not automatically complete in six calendar days.

If estimates or capacity are missing, show `not enough information` and request an engineering estimate. A priority score or language model cannot infer a reliable delivery date from a ticket description. Never publish customer deadlines or change the roadmap without approval.

### FR-08 — Customer communication and ElevenLabs

Triggers: clarification needed, owner accepted, workaround available, meaningful delay, fix deployed to relevant environment, or customer recovery verification.

- Rank follow-up urgency using severity, promised updates, customer deadlines, expressed concern, and renewal context. Account revenue can be a factor, not the only factor.
- Prefer original channel and recorded customer preference. Phone calls require an appropriate configured contact and approved outreach policy; revenue alone does not select the channel.
- Generate language/tone from account preferences and conversation context. Distinguish apology, clarification, workaround, and resolution messages. Never promise an unapproved date or disclose another customer's details.
- Approved customer messages are derived from a customer-safe projection of the case. Do not expose private source code, internal financial scores, or confidential incident details.
- For the demo, generate an ElevenLabs audio preview and optionally a test call to a team-owned number. Real outbound calls require an agent, linked telephony configuration, and delivery handling; ElevenLabs documents Twilio integration and an outbound-call API [S8].
- Approval is tied to message version, recipient, channel, and current case state. Re-editing content, changing recipient, or contradictory new evidence invalidates the approval.
- Deduplicate by recipient + issue + update type + version. Respect contact preferences, stop requests, and workspace quiet-hour settings.
- Delivery is not resolution. Track `draft → awaiting_approval → approved → sending → delivered / failed / unknown`, with acknowledgment and customer-confirmed outcome separately.
- Call answers/transcripts re-enter the context pipeline. Keep recording optional and separate from placing a call; configure the relevant permissions and notices rather than assuming recording is allowed.

## 6. Data model

All tenant-owned records have a workspace ID, timestamps, and a revision. Join tables enforce same-workspace foreign keys. Source-access policies also apply within a workspace.

| Entity | Key fields / purpose |
|---|---|
| `workspaces`, `memberships` | roles, policies, deployment configuration |
| `connectors` | source type, credential reference, granted scopes, sync cursor, health |
| `accounts`, `contacts`, `identity_links` | verified external identities, commercial facts, channel preferences |
| `reports`, `report_versions` | source envelope, sentiment/type, revision history |
| `issues`, `report_issue_links` | canonical problem, severity, state, owner, reversible mappings |
| `evidence`, `evidence_chunks` | sanitized content/reference, locator, checksum, source version, access policy |
| `context_requests`, `context_responses` | missing facts, approved questions, verified responses |
| `diagnoses`, `claims` | hypotheses, fact/estimate classification, supporting and contradicting evidence |
| `graph_edges` | typed relationships, status, evidence, reviewer, revision |
| `services`, `ownership_rules` | service/path → team/Jira identity mappings |
| `releases`, `deployments`, `commits` | environment and code provenance |
| `work_items`, `external_mappings` | Jira identity, work status, estimates, reconciliation state |
| `impact_assessments`, `scenarios`, `scenario_items` | versioned inputs, financial ranges, capacity and date outputs |
| `action_proposals`, `approvals` | proposed side effects, recipient/target, input hash, actor and expiry |
| `outreach`, `delivery_attempts`, `account_outcomes` | messages/calls, delivery results, customer confirmation |
| `jobs`, `outbox`, `audit_events` | durable processing, integration writes, append-only history |

Evidence-derived values use a common contract:

```typescript
type EvidenceValue<T> = {
  value: T | null;
  kind: 'observed' | 'customer_reported' | 'hypothesis' | 'estimate' | 'unknown';
  evidenceIds: string[];
  assumptions: string[];
  confidence: 'low' | 'medium' | 'high' | 'not_assessed';
  generatedAt: string;
  inputRevision: string;
  reviewedBy?: string;
};
```

Confidence is an explainable assessment label, not a calibrated probability. Store model and prompt versions separately on the analysis run.

## 7. API and event contracts

Proposed internal endpoints, not vendor API definitions:

| Method / path | Purpose |
|---|---|
| `POST /api/intake/reports` | authenticated report submission; returns report and job IDs |
| `POST /api/webhooks/:connectorId` | provider events, verified before enqueueing |
| `GET /api/issues` | filtered queue with authorized counts and summaries |
| `GET /api/issues/:id` | case, context gaps, evidence, ownership, customer outcomes |
| `POST /api/issues/:id/analyze` | enqueue version-bound analysis |
| `POST /api/context-requests/:id/responses` | verified customer clarification submission |
| `GET /api/issues/:id/graph` | permission-filtered graph and uncertainty states |
| `POST /api/issues/:id/relationships` | propose or review a typed edge |
| `POST /api/issues/:id/scenarios` | compute a comparison from explicit inputs |
| `POST /api/action-proposals` | create a Jira/assignment/outreach/patch proposal |
| `POST /api/action-proposals/:id/approve` | approve a specific immutable action revision |
| `POST /api/action-proposals/:id/execute` | recheck policy/state and enqueue side effect |
| `POST /api/issues/:id/outcomes` | record or reopen account-specific recovery |
| `POST /api/monitors/:id/run` | enqueue a bounded public discovery run |
| `GET /api/jobs/:id` | status, stage, safe errors, retry availability |

Use schema validation, pagination, request correlation IDs, version/optimistic-lock checks, and idempotency keys for mutating requests. Never trust caller-supplied actor/workspace identity. Return an explicit conflict for stale approvals.

Event envelope: `eventId`, `workspaceId`, `type`, `entityId`, `entityRevision`, `occurredAt`, `correlationId`, `causationId`, `schemaVersion`, and minimal payload/reference.

Principal events: `report.ingested`, `context.requested`, `context.received`, `issue.match_proposed`, `diagnosis.updated`, `relationship.reviewed`, `impact.updated`, `action.approved`, `work_item.changed`, `deployment.observed`, `outreach.delivered`, `customer.confirmed`, and `source.access_revoked`.

Processing is at least once. Transactions create state changes and outbox records together. Workers use leases, bounded retries/backoff, provider rate-limit handling, dead-letter status, and stale-run checks. Unknown external execution results require reconciliation before retry.

## 8. AI workflow and control boundaries

Stages: extract → identify context gaps → retrieve authorized evidence → propose matches → investigate causes → draft decision brief → draft outreach.

- Every stage has a validated structured output schema, allowed inputs, time/token budget, and failure/abstention path.
- Retrieve with permission filters before the model sees evidence. Filter summaries, graph counts, and commercial aggregates too; hiding a source link after generation is insufficient.
- Treat customer messages, web pages, documents, and repository content as untrusted data, never as instructions to execute tools.
- Models cannot directly access credentials, arbitrary URLs, raw SQL, telephony, Jira writes, or production shells. External actions go through typed, allowlisted tools and policy checks.
- Normalize and sanitize outbound connector payloads independently of the model. Prevent arbitrary URL fetching from reaching private infrastructure; restrict and validate attachments.
- Reuse already collected facts. A blocked model stage should leave the report usable for manual triage.
- Invalidate affected drafts/approvals after relevant evidence or permissions change. Prevent stale analysis jobs from overwriting newer customer corrections.

## 9. Security and deployment

Deployment modes:

1. **Local application + cloud inference:** database and worker run locally; explicitly approved sanitized payloads may leave for inference. Cloud connectors, search, voice, and telephony also involve external providers.
2. **Private deployment:** application, storage, and an optional local model run inside customer-controlled infrastructure. External connector access is individually allowed. Strict no-egress mode disables capabilities requiring external services.

Initial packaging: containerized web/API, worker, PostgreSQL, and private storage with documented environment configuration. A local demo can refresh Jira manually or poll outward. Receiving Jira Cloud webhooks requires a reachable HTTPS endpoint with appropriate transport configuration [S2]; a private deployment needs an approved ingress relay or outbound reconciliation strategy.

Pilot controls:

- Roles: administrator, support, engineering, commercial reviewer, and read-only viewer, with additional project/document restrictions.
- Separate runtime credentials from migration/admin credentials. PostgreSQL row security can provide database-level isolation; table-owner/bypass behavior must be accounted for, not assumed away [S9].
- Least-privilege connector scopes; credentials in server-side secret storage, encrypted at rest where persisted. No provider keys in client code or model prompts.
- Private transport/storage, expiring attachment links, source-permission synchronization, audit records, and operational access logging without sensitive payloads.
- Proposed retention defaults for pilot review: 7 days for sanitized diagnostic timelines, 30 days for transient attachments, 90 days for case evidence; recording off by default. These are configurable engineering defaults, not compliance guarantees. Restrict any retained unsanitized exception separately.
- Deletion/revocation propagates to stored content, retrieval indexes, summaries, queued jobs, and generated artifacts. Document backup expiry and minimal audit retention separately.
- Retention policy and redaction must be tested against the actual customer application and data categories before deployment.

## 10. User-facing workspaces

1. **Triage queue:** source, sentiment, severity, context completeness, unique affected accounts, owner, age, and next action. Unverified public findings are clearly marked.
2. **Issue workspace:** original reports, evidence timeline, customer clarification, reproduction, diagnoses, ownership/status history, and Jira links.
3. **Relationship graph:** symptoms, candidate causes, engineering dependencies, supporting evidence, review controls, and account union. Provide list/table access to the same information.
4. **Decision brief:** defer/workaround/fix/external-tool options; cost/benefit assumptions; timeline comparison; approval controls.
5. **Customer follow-up queue:** approved recipient/channel, message/audio preview, commercial context visible only to authorized users, delivery status, and verification due.

Always show what is known, what is proposed, and what requires a human decision. Technical internals appear only where they help the user act.

## 11. Reliability, observability, and cost targets

Initial acceptance targets for a small demo dataset, not service-level guarantees:

- Valid report submission returns an acknowledgment/job ID within 2 seconds, excluding large attachment upload time.
- A basic extraction/match/context draft completes within 60 seconds under normal provider conditions; slow/failing stages expose status and manual continuation.
- Duplicate deliveries produce no duplicate approved actions.
- Core queued work survives worker restart. External result ambiguity is visible and reconciled.
- Track ingestion lag, queue lag, model latency/cost, tokens, connector failures, stale evidence, redaction failures, and action approval/delivery counts.
- Per-workspace daily limits for public search, model spending, recording storage, and voice minutes. Cache by source/input revision and cap evidence retrieval per case.
- Measure onboarding labor and integration maintenance alongside hosting/model cost. No profitability claim follows from model cost alone.

## 12. Validation and acceptance criteria

Create a small reviewer-labeled evaluation set, separate from the polished demo story. Include duplicate and distinct reports, incomplete context, conflicting evidence, multiple symptoms sharing a cause, missing telemetry, deployment mismatches, unknown public users, and restricted documents. Report sample size and observed results; small samples do not establish production accuracy.

| Case | Required result |
|---|---|
| Same report delivered three times | one source revision; no repeated external action |
| Same wording, different environments/root causes | separate issues or abstention; no forced merge |
| Customer supplies missing reproduction steps | context updates; stale draft cannot overwrite correction |
| Report has no telemetry | targeted questions and explicit gap; no fabricated trace |
| Sanitization canary in URL/log/input/attachment | secret does not reach stored sanitized evidence, prompts, or outbound payload |
| Root issue linked to overlapping customer sets | affected accounts and associated revenue use set union |
| AI proposes a causal edge | remains a visible hypothesis until reviewed |
| Candidate commit was never deployed to affected environment | excluded or explicitly flagged as unsupported |
| Jira create request times out after remote success | reconcile existing issue; no blind duplicate creation |
| Jira says done but deployment is unverified | no claim that the fix reached the customer |
| Root fix is deployed | downstream verification tasks; no automatic blanket resolution |
| New evidence arrives after message approval | stale approval rejected before delivery |
| Unrelated negative web mention | excluded or queued for relevance review, not a confirmed customer issue |
| Cross-workspace request or revoked source | no leakage in source, summary, graph, or aggregate |
| Customer confirms problem persists | account recovery remains open; issue reopens/retriages as appropriate |

Measure matching precision/recall against labels, ownership recommendation accuracy, source-supported claim rate, reviewer acceptance/edit rate, time to usable context, time to accepted owner, follow-up completion, and customer-confirmed resolution. Compare workflows with historical/manual baselines. Keep any retention or revenue claim separate unless directly evidenced.

## 13. One-day implementation sequence

Respect the event rule that project-specific core implementation is built during the hackathon. This document is planning material.

1. Establish the vertical slice: seed one authorized example repository/release, a small account/ownership dataset, and several clearly labeled report fixtures.
2. Implement durable report intake, context extraction, source links, and one context-question response loop.
3. Add candidate grouping with human confirmation and the small issue relationship graph.
4. Build one source-backed developer brief and a deterministic impact/timeline scenario using explicit team estimates.
5. Connect Jira create/link and refresh if setup is available. Otherwise demonstrate the same interface with a clearly labeled simulation.
6. Add email drafting and an ElevenLabs audio preview; public search is a stretch feature after the core flow works.
7. Run the critical privacy/idempotency/stale-approval checks, capture validation findings, and record the three-minute demo. Stop feature development by the guide's recommended 16:45 cutoff for the 17:00 submission.

Suggested demo: three cross-platform reports describe export failures → one asks for missing context → sanitized timeline links an error to the affected deployment → reviewer confirms a shared issue and a candidate underlying problem → the brief shows owner, workaround, and scheduling tradeoff → create/link Jira → replay a labeled deployment update → prepare account-specific email/audio follow-ups → capture a customer's confirmation.

Show a candidate cause as a candidate. Label all simulated reports, deployment events, connectors, and commercial amounts. The demonstration should make evidence and limits visible without requiring a large production platform.

## 14. Decisions to validate before a pilot

- Which support platform and repository provider do the first customers already use?
- Who can authorize telemetry and source-code access, and what data may leave their environment?
- Is existing observability sufficient, or is application instrumentation a deployment blocker?
- Does a named person own capacity/estimates and approve timeline tradeoffs?
- Which context questions and diagnostic outputs materially reduce engineering back-and-forth?
- Will customers pay for coordination/context recovery, and how much implementation work is needed per account?
- Can public discovery produce actionable findings at an acceptable false-positive rate?
- Do target customers want phone updates, or is voice only useful as an optional channel?

## 15. Integration references

The architectural requirements above are proposed product behavior. The following primary sources establish relevant integration capabilities; verify actual account permissions, project configuration, and current API contracts during implementation.

- **[S1]** [Jira Cloud REST API — issues, creation, assignment, and transitions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)
- **[S2]** [Jira Cloud webhooks — delivery, retries, and configuration](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
- **[S3]** [Sentry Session Replay — diagnostic context and masking](https://sentry.io/product/session-replay/)
- **[S4]** [Sentry suspect-commit investigation](https://sentry.io/changelog/2023-12-4-improvements-to-suspect-commits/) and [release commit API](https://docs.sentry.io/api/releases/list-a-project-releases-commits/)
- **[S5]** [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- **[S6]** [Exa search API](https://exa.ai/docs/reference/search)
- **[S7]** [React Flow documentation](https://reactflow.dev/learn)
- **[S8]** [ElevenLabs Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration) and [outbound-call API](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call)
- **[S9]** [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
