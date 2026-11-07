import { accounts, requests, sources, type Source } from "./demo";
import { providerById, providers, type ProviderId } from "./providers";

export type SignalStatus = "new" | "linked" | "reviewed";
export type SignalFilter = "all" | SignalStatus;
export type SignalCustomer = { id: string; name: string; initials: string; color: string };
export type CustomerSignal = {
  id: string;
  customer: SignalCustomer;
  title: string;
  category: string;
  priority: "high" | "normal";
  receivedAt: string;
  source: Omit<Source, "kind">;
  /** Simulated intake connector the signal was pulled from. */
  provider: ProviderId;
  /** Identifier in the source system, e.g. a ticket key or thread id. */
  externalRef: string;
  /** Status as reported by the source system at sync time. */
  externalStatus: string;
  nextStep: string;
  decisionId?: "DEC-014";
};

export const inboxCustomers: SignalCustomer[] = [
  ...accounts.map(({ id, name, initials, color }) => ({ id, name, initials, color })),
  { id: "harbor", name: "Harbor", initials: "H", color: "teal" },
  { id: "atlas", name: "Atlas", initials: "A", color: "rose" },
  { id: "kestrel", name: "Kestrel", initials: "K", color: "sand" },
  { id: "orbit", name: "Orbit", initials: "O", color: "slate" },
];

const customer = (id: string) => inboxCustomers.find(item => item.id === id)!;

const additionalSignals: CustomerSignal[] = [
  {
    id: "slack-harbor-webhooks",
    provider: "slack",
    externalRef: "Thread 1713090720.4419",
    externalStatus: "Unanswered",
    customer: customer("harbor"),
    title: "Webhook retries are creating duplicate orders",
    category: "Integrations",
    priority: "high",
    receivedAt: "2026-04-14T10:32:00Z",
    source: { id: "slack-harbor-webhooks", title: "Harbor reports duplicate webhook events", location: "#shared-harbor", author: "Jamie Park · Harbor", date: "Apr 14, 10:32", excerpt: "Since this morning, webhook retries appear to create duplicate orders in our fulfillment workflow. We have paused the automation while we investigate. Can you help us check the event IDs and the retry behavior? We have not confirmed whether the duplicates originate in your delivery system or our consumer." },
    nextStep: "Ask for sample event IDs, timestamps, and consumer logs. Confirm the cause before linking an engineering issue. No approved workaround, delivery estimate, or commercial impact is documented.",
  },
  {
    id: "slack-atlas-invoices",
    provider: "slack",
    externalRef: "Thread 1713090240.2210",
    externalStatus: "Unanswered",
    customer: customer("atlas"),
    title: "Finance needs a PO number on invoices",
    category: "Billing",
    priority: "normal",
    receivedAt: "2026-04-14T10:24:00Z",
    source: { id: "slack-atlas-invoices", title: "Atlas asks about purchase-order references", location: "#shared-atlas", author: "Lena Ortiz · Atlas", date: "Apr 14, 10:24", excerpt: "Our finance team needs a purchase-order number on future invoices. Is there an existing setting for this, or can your team add the reference? This is a process question, not a payment dispute or a renewal blocker." },
    nextStep: "Check the billing documentation and confirm whether an existing invoice setting supports PO references. No new product work, loss estimate, or delivery promise is justified yet.",
  },
  {
    id: "slack-meridian-sso",
    provider: "slack",
    externalRef: "Thread 1713089760.1187",
    externalStatus: "Unanswered",
    customer: customer("meridian"),
    title: "Can SSO sessions expire after eight hours?",
    category: "Access & security",
    priority: "normal",
    receivedAt: "2026-04-14T10:16:00Z",
    source: { id: "slack-meridian-sso", title: "Meridian asks about SSO session policy", location: "#shared-meridian", author: "Priya Shah · Meridian", date: "Apr 14, 10:16", excerpt: "Separate from our audit-export request: our IT team would like SSO sessions to expire after eight hours. Can we configure this in the product or through our identity provider? We are gathering requirements and have not set a deadline." },
    nextStep: "Clarify the identity provider and current session policy, then check existing configuration guidance. This is not the audit-export issue; do not merge the two just because they share an account.",
  },
];

const providerSignals: CustomerSignal[] = [
  {
    id: "jira-harbor-csv-import",
    provider: "jira",
    externalRef: "SUP-1482",
    externalStatus: "Waiting for support · Priority High",
    customer: customer("harbor"),
    title: "CSV imports over 50 MB fail without an error",
    category: "Data import",
    priority: "high",
    receivedAt: "2026-04-14T10:28:00Z",
    source: { id: "jira-harbor-csv-import", title: "SUP-1482 · Bulk CSV import silently fails", location: "Jira Service Management / SUP", author: "Marcus Webb · Harbor", date: "Apr 14, 10:28", excerpt: "Our nightly product catalogue import (about 62 MB) stopped completing on Friday. The UI shows the upload as finished, but no rows are created and no error is shown. Smaller files under 40 MB still work. We attached the request IDs from the last three attempts." },
    nextStep: "Correlate the attached request IDs with import job logs and confirm whether a file-size limit changed. This is separate from Harbor's webhook report; do not merge them because they share an account.",
  },
  {
    id: "zendesk-atlas-reset-links",
    provider: "zendesk",
    externalRef: "Ticket #48213",
    externalStatus: "Open · Normal",
    customer: customer("atlas"),
    title: "Password reset links expire before users open them",
    category: "Access & security",
    priority: "normal",
    receivedAt: "2026-04-14T10:12:00Z",
    source: { id: "zendesk-atlas-reset-links", title: "Reset links expired on arrival", location: "Zendesk / Support queue", author: "Hannah Brooks · Atlas", date: "Apr 14, 10:12", excerpt: "Several of our warehouse staff say the password reset link is already expired when they click it, usually within five minutes of requesting it. Their email goes through a security scanner that may open links first. Is the link single-use, and can we change that behaviour?" },
    nextStep: "Check whether the reset token is consumed on first GET, which a link-scanning mail gateway would trigger. Ask for the scanner vendor before proposing a configuration change.",
  },
  {
    id: "intercom-kestrel-mobile-crash",
    provider: "intercom",
    externalRef: "Conversation 2214-8873",
    externalStatus: "Open · Assigned to Support",
    customer: customer("kestrel"),
    title: "iOS app closes when opening a shared dashboard",
    category: "Mobile",
    priority: "high",
    receivedAt: "2026-04-14T10:04:00Z",
    source: { id: "intercom-kestrel-mobile-crash", title: "App crashes on shared dashboard links", location: "Intercom / Messenger", author: "Tomás Reyes · Kestrel", date: "Apr 14, 10:04", excerpt: "Since updating to the latest iOS app this morning, tapping a shared dashboard link from email closes the app straight away. Opening the same dashboard from inside the app works. Four people on our ops team see it on iOS 19; Android seems fine." },
    nextStep: "Ask for the app version and a crash timestamp, then check the release notes for deep-link changes. Do not promise a hotfix date until the crash is reproduced.",
  },
  {
    id: "gmail-northstar-soc2",
    provider: "gmail",
    externalRef: "Message-ID <8f3a21@northstar.example>",
    externalStatus: "Unread · Label: Security requests",
    customer: customer("northstar"),
    title: "Procurement asks for the current SOC 2 report",
    category: "Security review",
    priority: "normal",
    receivedAt: "2026-04-14T09:55:00Z",
    source: { id: "gmail-northstar-soc2", title: "Request: SOC 2 Type II report", location: "Gmail / support@context-demo.example", author: "Dana Okafor · Northstar", date: "Apr 14, 09:55", excerpt: "Our procurement team is collecting vendor documents for the annual review. Could you send your most recent SOC 2 Type II report and bridge letter? We are happy to sign an NDA through the usual portal if needed." },
    nextStep: "Route through the standard trust-portal NDA flow. This is a document request, not part of the audit-export decision, even though both relate to Northstar's security review.",
  },
  {
    id: "teams-orbit-duplicate-alerts",
    provider: "teams",
    externalRef: "Channel post 19:7c1e…@thread.tacv2",
    externalStatus: "No reply yet",
    customer: customer("orbit"),
    title: "Alert notifications arrive twice in Teams",
    category: "Integrations",
    priority: "normal",
    receivedAt: "2026-04-14T09:48:00Z",
    source: { id: "teams-orbit-duplicate-alerts", title: "Duplicate alert notifications", location: "Teams / Orbit ↔ Context", author: "Wei Zhang · Orbit", date: "Apr 14, 09:48", excerpt: "Every threshold alert shows up twice in our #ops-alerts channel, a few seconds apart. We reconnected the Teams app last week after an admin change; maybe the old connection is still active?" },
    nextStep: "Check for two active Teams connector installations on Orbit's tenant. Likely configuration, not a product defect; confirm before filing engineering work.",
  },
  {
    id: "github-orbit-node24",
    provider: "github",
    externalRef: "Issue #912",
    externalStatus: "Open · label: bug, needs-triage",
    customer: customer("orbit"),
    title: "Node SDK throws on Node 24 native fetch",
    category: "Developer SDK",
    priority: "normal",
    receivedAt: "2026-04-14T09:31:00Z",
    source: { id: "github-orbit-node24", title: "TypeError: body used already (Node 24)", location: "GitHub / context-demo/sdk-node", author: "devwei · Orbit", date: "Apr 14, 09:31", excerpt: "After upgrading our workers to Node 24, every retry in the SDK fails with \"TypeError: Body is unusable: Body has already been read\". Pinning Node 22 works. Minimal repro repository linked in the issue. Happy to open a PR if the approach is acceptable." },
    nextStep: "Reproduce with the linked repository and confirm the retry path re-reads a consumed request body. A public GitHub username is not a verified account contact.",
  },
  {
    id: "hubspot-kestrel-seat-pricing",
    provider: "hubspot",
    externalRef: "Ticket 3391045",
    externalStatus: "New · Pipeline: Account management",
    customer: customer("kestrel"),
    title: "Would usage-based pricing fit seasonal staff?",
    category: "Billing",
    priority: "normal",
    receivedAt: "2026-04-14T09:20:00Z",
    source: { id: "hubspot-kestrel-seat-pricing", title: "Seat vs usage pricing question", location: "HubSpot / Service Hub", author: "Ava Lindqvist · Kestrel", date: "Apr 14, 09:20", excerpt: "We hire around 40 seasonal staff each summer who only need read access for three months. Paying for full seats all year is hard to justify. Is there a usage-based or viewer tier we should look at before our next budget cycle?" },
    nextStep: "Hand to the account manager with the existing plan comparison. No discount, custom tier, or renewal change should be implied.",
  },
  {
    id: "salesforce-acme-eu-residency",
    provider: "salesforce",
    externalRef: "Case 00012877",
    externalStatus: "Escalated · Tier 2",
    customer: customer("acme"),
    title: "Can new workspaces be hosted in the EU region?",
    category: "Data residency",
    priority: "normal",
    receivedAt: "2026-04-14T08:52:00Z",
    source: { id: "salesforce-acme-eu-residency", title: "EU data residency for new subsidiary", location: "Salesforce / Service Cloud", author: "Sam Rivera · Acme", date: "Apr 14, 08:52", excerpt: "Acme is onboarding a German subsidiary next quarter. Their works council requires that customer data stays in the EU. Can we create a separate workspace in an EU region, and would it share SSO with our existing US workspace?" },
    nextStep: "Confirm the documented regions and whether cross-region SSO is supported. Unrelated to Acme's audit-export request, so keep it out of DEC-014.",
  },
  {
    id: "linear-meridian-report-timezone",
    provider: "linear",
    externalRef: "CR-87",
    externalStatus: "Triage · Customer requests",
    customer: customer("meridian"),
    title: "Scheduled reports use UTC instead of the workspace time zone",
    category: "Reporting",
    priority: "normal",
    receivedAt: "2026-04-14T08:34:00Z",
    source: { id: "linear-meridian-report-timezone", title: "CR-87 · Scheduled report time zone", location: "Linear / Customer requests", author: "Priya Shah · Meridian (via CS)", date: "Apr 14, 08:34", excerpt: "Logged by CS on behalf of Meridian: their 8:00 weekly report arrives at 8:00 UTC rather than 8:00 Singapore time, even though the workspace time zone is set to Asia/Singapore. The report contents are correct; only the delivery time is wrong." },
    nextStep: "Verify the schedule's stored time zone versus the workspace setting. Separate from Meridian's audit-export and SSO requests.",
  },
];

const auditReceivedAt: Record<string, string> = {
  "slack-northstar": "2026-04-14T09:42:00Z",
  "slack-northstar-followup": "2026-04-14T10:08:00Z",
  "ticket-meridian": "2026-04-13T14:20:00Z",
  "ticket-meridian-followup": "2026-04-14T08:10:00Z",
  "ticket-acme": "2026-04-11T11:30:00Z",
};

const auditTitles: Record<string, string> = {
  "slack-northstar": "Audit export is blocking a security review",
  "slack-northstar-followup": "An assisted export would work for our review",
  "ticket-meridian": "Audit exports stop at 10,000 rows",
  "ticket-meridian-followup": "Any progress on the complete audit export?",
  "ticket-acme": "Compliance needs the complete event history",
};

export const customerSignals: CustomerSignal[] = [
  ...additionalSignals,
  ...providerSignals,
  ...requests.filter(request => request.problem === "audit-export").map(request => ({
    id: request.id,
    provider: "slack" as const,
    externalRef: `Thread in #shared-${request.accountId}`,
    externalStatus: "Awaiting decision",
    customer: customer(request.accountId),
    title: auditTitles[request.id],
    category: "Audit exports",
    priority: request.id === "slack-northstar" ? "high" as const : "normal" as const,
    receivedAt: auditReceivedAt[request.id],
    source: sources.find(source => source.id === request.id)!,
    nextStep: "Review DEC-014 for the shared export limit, approved assisted-export runbook, owners, and delivery tradeoffs. A linked decision is not an approved commitment or a resolved request.",
    decisionId: "DEC-014" as const,
  })),
].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));

export function signalStatus(signal: CustomerSignal, reviewedIds: readonly string[]): SignalStatus {
  if (signal.decisionId) return "linked";
  return reviewedIds.includes(signal.id) ? "reviewed" : "new";
}

export type ProviderFilter = "all" | ProviderId;

/** Connected providers with how many signals each contributed, in registry order. */
export const providerCounts = providers.map(provider => ({
  provider,
  count: customerSignals.filter(signal => signal.provider === provider.id).length,
}));

export function filterSignals(query: string, customerId: string, status: SignalFilter, reviewedIds: readonly string[] = [], providerId: ProviderFilter = "all") {
  const search = query.trim().toLowerCase();
  return customerSignals.filter(signal => {
    const matchesCustomer = customerId === "all" || signal.customer.id === customerId;
    const matchesProvider = providerId === "all" || signal.provider === providerId;
    const matchesStatus = status === "all" || signalStatus(signal, reviewedIds) === status;
    const searchableText = `${signal.title} ${signal.customer.name} ${signal.category} ${signal.source.author} ${signal.source.location} ${signal.source.excerpt} ${signal.decisionId || ""} ${providerById(signal.provider).name} ${signal.externalRef}`.toLowerCase();
    return matchesCustomer && matchesProvider && matchesStatus && searchableText.includes(search);
  });
}
