import { accounts, requests, sources, type Source } from "./demo";

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
  source: Source;
  nextStep: string;
  decisionId?: "DEC-014";
};

export const inboxCustomers: SignalCustomer[] = [
  ...accounts.map(({ id, name, initials, color }) => ({ id, name, initials, color })),
  { id: "harbor", name: "Harbor", initials: "H", color: "teal" },
  { id: "atlas", name: "Atlas", initials: "A", color: "rose" },
];

const additionalSignals: CustomerSignal[] = [
  {
    id: "slack-harbor-webhooks",
    customer: inboxCustomers.find(customer => customer.id === "harbor")!,
    title: "Webhook retries are creating duplicate orders",
    category: "Integrations",
    priority: "high",
    receivedAt: "2026-04-14T10:32:00Z",
    source: { id: "slack-harbor-webhooks", kind: "slack", title: "Harbor reports duplicate webhook events", location: "#shared-harbor", author: "Jamie Park · Harbor", date: "Apr 14, 10:32", excerpt: "Since this morning, webhook retries appear to create duplicate orders in our fulfillment workflow. We have paused the automation while we investigate. Can you help us check the event IDs and the retry behavior? We have not confirmed whether the duplicates originate in your delivery system or our consumer." },
    nextStep: "Ask for sample event IDs, timestamps, and consumer logs. Confirm the cause before linking an engineering issue. No approved workaround, delivery estimate, or commercial impact is documented.",
  },
  {
    id: "slack-atlas-invoices",
    customer: inboxCustomers.find(customer => customer.id === "atlas")!,
    title: "Finance needs a PO number on invoices",
    category: "Billing",
    priority: "normal",
    receivedAt: "2026-04-14T10:24:00Z",
    source: { id: "slack-atlas-invoices", kind: "slack", title: "Atlas asks about purchase-order references", location: "#shared-atlas", author: "Lena Ortiz · Atlas", date: "Apr 14, 10:24", excerpt: "Our finance team needs a purchase-order number on future invoices. Is there an existing setting for this, or can your team add the reference? This is a process question, not a payment dispute or a renewal blocker." },
    nextStep: "Check the billing documentation and confirm whether an existing invoice setting supports PO references. No new product work, loss estimate, or delivery promise is justified yet.",
  },
  {
    id: "slack-meridian-sso",
    customer: inboxCustomers.find(customer => customer.id === "meridian")!,
    title: "Can SSO sessions expire after eight hours?",
    category: "Access & security",
    priority: "normal",
    receivedAt: "2026-04-14T10:16:00Z",
    source: { id: "slack-meridian-sso", kind: "slack", title: "Meridian asks about SSO session policy", location: "#shared-meridian", author: "Priya Shah · Meridian", date: "Apr 14, 10:16", excerpt: "Separate from our audit-export request: our IT team would like SSO sessions to expire after eight hours. Can we configure this in the product or through our identity provider? We are gathering requirements and have not set a deadline." },
    nextStep: "Clarify the identity provider and current session policy, then check existing configuration guidance. This is not the audit-export issue; do not merge the two just because they share an account.",
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
  ...requests.filter(request => request.problem === "audit-export").map(request => ({
    id: request.id,
    customer: inboxCustomers.find(customer => customer.id === request.accountId)!,
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

export function filterSignals(query: string, customerId: string, status: SignalFilter, reviewedIds: readonly string[] = []) {
  const search = query.trim().toLowerCase();
  return customerSignals.filter(signal => {
    const matchesCustomer = customerId === "all" || signal.customer.id === customerId;
    const matchesStatus = status === "all" || signalStatus(signal, reviewedIds) === status;
    const searchableText = `${signal.title} ${signal.customer.name} ${signal.category} ${signal.source.author} ${signal.source.location} ${signal.source.excerpt} ${signal.decisionId || ""}`.toLowerCase();
    return matchesCustomer && matchesStatus && searchableText.includes(search);
  });
}
