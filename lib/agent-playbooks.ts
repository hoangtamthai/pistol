// SYNTHETIC DEMO: scripted agent work for each mock connector ticket. Findings, options and
// fixes are illustrative sample content, not output from a model or a real codebase.
export type AgentName = "Customer agent" | "Engineering agent" | "Billing agent";
export type ResearchSource = "Logs" | "Docs" | "Code" | "Past tickets" | "Changelog" | "Account";
export type Option = { title: string; effort: string; risk: "Low" | "Medium" | "High"; note: string };
export type Playbook = {
  cluster: string;
  agent: AgentName;
  action: string;
  outcome: string;
  research: { where: ResearchSource; finding: string }[];
  options: Option[];
  recommended: number;
  why: string;
  fix: { kind: "Pull request" | "Customer reply" | "Config change" | "Account handoff"; title: string; checks: string[] };
  closeout: string;
};

export const clusters = [
  { id: "duplicates", title: "Duplicate deliveries", note: "Similar wording, different causes. Kept as separate cases." },
  { id: "access", title: "Access & identity", note: "Three accounts, three distinct questions." },
  { id: "data", title: "Data in & out", note: "Import and scheduling defects." },
  { id: "clients", title: "Apps & SDK", note: "Client-side regressions after upgrades." },
  { id: "commercial", title: "Commercial & compliance", note: "No engineering work needed." },
] as const;

export const playbooks: Record<string, Playbook> = {
  "slack-harbor-webhooks": {
    cluster: "duplicates", agent: "Engineering agent",
    action: "Matching retry logs to event IDs · idempotency keys missing on retries", outcome: "Fix plan drafted: dedupe by event ID",
    research: [
      { where: "Logs", finding: "41 events re-delivered after a 30 s consumer timeout; each retry got a new delivery ID." },
      { where: "Code", finding: "Retry path regenerates the Idempotency-Key header instead of reusing the original event ID." },
      { where: "Past tickets", finding: "Two similar reports in 2025 were closed as consumer-side; this one is reproducible on our side." },
    ],
    options: [
      { title: "Reuse the event ID as the idempotency key on retries", effort: "1–2 days", risk: "Low", note: "Fixes the root cause for every consumer." },
      { title: "Lengthen the timeout before retrying", effort: "2 hours", risk: "Medium", note: "Reduces duplicates but does not remove them." },
      { title: "Ask Harbor to dedupe on their side", effort: "None for us", risk: "High", note: "Pushes our defect onto the customer." },
    ],
    recommended: 0, why: "Smallest change that removes the cause, with a regression test.",
    fix: { kind: "Pull request", title: "PR #191 · Keep idempotency key stable across webhook retries", checks: ["Unit tests", "Retry replay test", "Contract test"] },
    closeout: "Slack thread answered · Harbor asked to re-enable automation after deploy",
  },
  "teams-orbit-duplicate-alerts": {
    cluster: "duplicates", agent: "Customer agent",
    action: "Found 2 active Teams installs on Orbit tenant", outcome: "Reply drafted: remove old install",
    research: [
      { where: "Account", finding: "Orbit's tenant has two active Teams connector installs, created 9 days apart." },
      { where: "Docs", finding: "Reconnecting after an admin change does not revoke the earlier install." },
      { where: "Logs", finding: "Each alert is posted once per install, about 3 s apart. No retry involved." },
    ],
    options: [
      { title: "Guide Orbit to remove the old install", effort: "10 minutes", risk: "Low", note: "Resolves it today; no code change." },
      { title: "Auto-revoke old installs on reconnect", effort: "3 days", risk: "Medium", note: "Prevents repeats; suggested to Product." },
    ],
    recommended: 0, why: "Configuration issue, not the webhook defect. Product idea logged separately.",
    fix: { kind: "Customer reply", title: "Step-by-step reply: remove the older Teams install", checks: ["Tone check", "Steps verified on test tenant"] },
    closeout: "Teams thread answered · idea logged for Product",
  },
  "zendesk-atlas-reset-links": {
    cluster: "access", agent: "Engineering agent",
    action: "Reproduced: mail scanner opens link first, so the token is consumed", outcome: "Fix plan drafted: confirm on POST",
    research: [
      { where: "Logs", finding: "Reset tokens for Atlas are consumed 2–4 s after sending, from a security-scanner IP range." },
      { where: "Code", finding: "The reset token is invalidated on GET, before the user submits a new password." },
      { where: "Docs", finding: "OWASP guidance: consume single-use tokens on the state-changing POST, not on view." },
    ],
    options: [
      { title: "Consume the token on POST, show a confirm page on GET", effort: "1 day", risk: "Low", note: "Works with every mail scanner." },
      { title: "Allowlist Atlas's scanner IPs", effort: "1 hour", risk: "High", note: "Fragile and customer-specific." },
      { title: "Lengthen the token lifetime", effort: "1 hour", risk: "Medium", note: "Does not fix the scanner problem." },
    ],
    recommended: 0, why: "Fixes the cause for all customers behind link scanners.",
    fix: { kind: "Pull request", title: "PR #192 · Consume reset tokens on submit, not on view", checks: ["Unit tests", "Auth flow e2e", "Security review"] },
    closeout: "Zendesk #48213 → Pending · customer told a fix is in review",
  },
  "slack-meridian-sso": {
    cluster: "access", agent: "Customer agent",
    action: "Checked SSO policy guide · session length set in the IdP", outcome: "Reply drafted · kept apart from DEC-014",
    research: [
      { where: "Docs", finding: "Session length follows the identity provider's session policy; an 8-hour policy is supported." },
      { where: "Account", finding: "Meridian uses Okta. No product setting is needed." },
    ],
    options: [
      { title: "Send Okta configuration steps", effort: "15 minutes", risk: "Low", note: "Answers the question fully." },
      { title: "Add an in-product session limit", effort: "1 week", risk: "Medium", note: "Not requested; logged as feedback only." },
    ],
    recommended: 0, why: "Existing capability. Separate from the audit-export decision.",
    fix: { kind: "Customer reply", title: "Reply with Okta session policy steps", checks: ["Docs link verified", "Tone check"] },
    closeout: "Slack thread answered",
  },
  "salesforce-acme-eu-residency": {
    cluster: "access", agent: "Customer agent",
    action: "Checked region docs · EU hosting available, SSO is per region", outcome: "Reply drafted · kept apart from DEC-014",
    research: [
      { where: "Docs", finding: "EU (Frankfurt) region is available for new workspaces; data stays in-region." },
      { where: "Docs", finding: "SSO is configured per workspace; the same IdP can serve both regions." },
      { where: "Account", finding: "Acme's audit-export request is a separate case (DEC-014); not merged." },
    ],
    options: [
      { title: "Reply with EU setup and SSO guidance", effort: "20 minutes", risk: "Low", note: "Answers both questions." },
      { title: "Offer a call with Solutions Engineering", effort: "1 hour", risk: "Low", note: "Useful if the works council needs detail." },
    ],
    recommended: 0, why: "Documented capability; offer the call as an optional follow-up.",
    fix: { kind: "Customer reply", title: "Reply: EU workspace setup + shared IdP", checks: ["Region docs verified", "Legal wording check"] },
    closeout: "Salesforce case 00012877 → Closed · call offered",
  },
  "jira-harbor-csv-import": {
    cluster: "data", agent: "Engineering agent",
    action: "Traced 3 request IDs · upload proxy limit is 50 MB", outcome: "Fix plan drafted: chunked upload",
    research: [
      { where: "Logs", finding: "All 3 request IDs end with HTTP 413 at the upload proxy; the UI ignores the error." },
      { where: "Changelog", finding: "Friday's infra release lowered the proxy body limit from 100 MB to 50 MB." },
      { where: "Code", finding: "Import client treats any non-200 as success when the response body is empty." },
    ],
    options: [
      { title: "Chunked uploads + surface errors in the UI", effort: "3 days", risk: "Low", note: "Removes the size ceiling and the silent failure." },
      { title: "Restore the 100 MB proxy limit", effort: "1 hour", risk: "Medium", note: "Quick unblock; ceiling remains." },
      { title: "Both: restore now, chunk next sprint", effort: "1 hour + 3 days", risk: "Low", note: "Unblocks Harbor tonight." },
    ],
    recommended: 2, why: "Harbor's nightly import needs to work today; the durable fix follows.",
    fix: { kind: "Config change", title: "Restore proxy limit to 100 MB + PR #193 surface upload errors", checks: ["Config diff reviewed", "62 MB import replayed", "UI error test"] },
    closeout: "Jira SUP-1482 → Resolved · durable fix linked as follow-up",
  },
  "linear-meridian-report-timezone": {
    cluster: "data", agent: "Engineering agent",
    action: "Schedule stored in UTC, ignores workspace time zone", outcome: "Fix plan drafted with test case",
    research: [
      { where: "Code", finding: "Scheduler converts the chosen time to UTC using the server zone, not the workspace zone." },
      { where: "Past tickets", finding: "2 other workspaces outside UTC have the same offset; none reported it yet." },
    ],
    options: [
      { title: "Store the workspace time zone with each schedule", effort: "2 days", risk: "Low", note: "Correct across DST changes." },
      { title: "Offset at send time", effort: "4 hours", risk: "Medium", note: "Breaks during DST transitions." },
    ],
    recommended: 0, why: "Handles daylight-saving changes; also fixes 2 unreported workspaces.",
    fix: { kind: "Pull request", title: "PR #194 · Schedule reports in the workspace time zone", checks: ["Unit tests", "DST boundary tests"] },
    closeout: "Linear CR-87 → Done · Meridian notified via CS",
  },
  "intercom-kestrel-mobile-crash": {
    cluster: "clients", agent: "Engineering agent",
    action: "Crash log matched to iOS deep-link handler in v4.12", outcome: "Hotfix plan drafted · no date promised",
    research: [
      { where: "Logs", finding: "312 crashes since v4.12, all from cold-start deep links to shared dashboards." },
      { where: "Code", finding: "Deep-link handler reads the session before it is restored on cold start." },
      { where: "Changelog", finding: "v4.12 moved session restore to an async task." },
    ],
    options: [
      { title: "Await session restore before routing", effort: "1 day", risk: "Low", note: "Targeted fix for the regression." },
      { title: "Roll back v4.12 session change", effort: "4 hours", risk: "Medium", note: "Loses v4.12 startup improvement." },
    ],
    recommended: 0, why: "Fixes the race without losing the startup gain.",
    fix: { kind: "Pull request", title: "PR #195 · Wait for session restore before deep-link routing", checks: ["Unit tests", "Cold-start UI test", "TestFlight build"] },
    closeout: "Intercom conversation replied · hotfix in review, no date promised",
  },
  "github-orbit-node24": {
    cluster: "clients", agent: "Engineering agent",
    action: "Repro confirmed on Node 24 · retry re-reads a consumed body", outcome: "Draft PR prepared with regression test",
    research: [
      { where: "Code", finding: "Retry wrapper reuses the same Request object, whose body stream is already consumed." },
      { where: "Docs", finding: "Node 24's native fetch enforces single-read bodies (WHATWG spec)." },
      { where: "Past tickets", finding: "Orbit offered a PR; their approach clones the body, matching our option 1." },
    ],
    options: [
      { title: "Clone the request before each retry", effort: "4 hours", risk: "Low", note: "Spec-compliant on all Node versions." },
      { title: "Buffer bodies in memory", effort: "4 hours", risk: "Medium", note: "Breaks large streaming uploads." },
    ],
    recommended: 0, why: "Matches the contributor's proposal; credit them in the PR.",
    fix: { kind: "Pull request", title: "PR #196 · Clone request before retry (Node 24)", checks: ["Node 20/22/24 matrix", "Regression test"] },
    closeout: "GitHub #912 → linked PR · contributor credited",
  },
  "slack-atlas-invoices": {
    cluster: "commercial", agent: "Billing agent",
    action: "Checked invoice settings docs · PO field already supported", outcome: "Reply drafted with setup steps",
    research: [
      { where: "Docs", finding: "Billing → Invoice details has a PO reference field shown on all future invoices." },
      { where: "Account", finding: "Atlas has never set it; their admin is Lena Ortiz." },
    ],
    options: [
      { title: "Send setup steps to the admin", effort: "5 minutes", risk: "Low", note: "Existing feature." },
      { title: "Set it for them on request", effort: "5 minutes", risk: "Low", note: "Needs written approval first." },
    ],
    recommended: 0, why: "Self-serve and already supported.",
    fix: { kind: "Customer reply", title: "Reply: where to add the PO reference", checks: ["Screenshot verified", "Tone check"] },
    closeout: "Slack thread answered",
  },
  "hubspot-kestrel-seat-pricing": {
    cluster: "commercial", agent: "Billing agent",
    action: "Compared plans · viewer seats fit seasonal staff", outcome: "Plan comparison ready for account manager",
    research: [
      { where: "Docs", finding: "Viewer seats are free on the Business plan and cover read-only access." },
      { where: "Account", finding: "Kestrel is on Team; Business adds viewer seats. Renewal in 5 months." },
    ],
    options: [
      { title: "Hand a plan comparison to the account manager", effort: "30 minutes", risk: "Low", note: "No price promised by the agent." },
      { title: "Reply directly with pricing", effort: "10 minutes", risk: "Medium", note: "Commercial terms need a human." },
    ],
    recommended: 0, why: "Pricing conversations stay with a person.",
    fix: { kind: "Account handoff", title: "Plan comparison + talking points for the account manager", checks: ["Pricing page verified", "No discount implied"] },
    closeout: "HubSpot ticket → assigned to account manager",
  },
  "gmail-northstar-soc2": {
    cluster: "commercial", agent: "Customer agent",
    action: "Verified requester domain · NDA on file", outcome: "Trust-portal reply drafted",
    research: [
      { where: "Account", finding: "Requester's domain matches Northstar; a mutual NDA is on file." },
      { where: "Docs", finding: "SOC 2 Type II report (Mar 2026) and bridge letter are in the trust portal." },
    ],
    options: [
      { title: "Send trust-portal access link", effort: "5 minutes", risk: "Low", note: "Standard, tracked access." },
      { title: "Attach the PDF to an email", effort: "5 minutes", risk: "High", note: "Untracked copy of a confidential report." },
    ],
    recommended: 0, why: "Tracked access under the existing NDA.",
    fix: { kind: "Customer reply", title: "Reply with trust-portal invite", checks: ["NDA verified", "Domain verified"] },
    closeout: "Gmail thread replied · labelled Done",
  },
};
