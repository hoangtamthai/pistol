// SYNTHETIC DEMO: simulated provider connectors. "Pulling" replays fixed mock tickets
// through the normal intake command; no external system is contacted.
import { customerSignals } from "./inbox";
import { providerById, providers, type ProviderId } from "./providers";
import type { Snapshot } from "./issues";
import { playbooks, type Playbook } from "./agent-playbooks";

export type ConnectorTicket = {
  provider: ProviderId;
  externalId: string;
  title: string;
  text: string;
  comment: string;
  severity: "S2" | "S3";
  issueType: "malfunction" | "feature_request";
  customer: string;
  /** Reporter's name as shown in the source system. */
  contact: string;
  category: string;
  /** Simulated agent work for this ticket; always ends at a proposal for a human. */
  playbook: Playbook;
};

function missingPlaybook(id: string): never {
  throw new Error(`No agent playbook for connector ticket ${id}`);
}

const requestCategories = new Set(["Billing", "Security review", "Data residency"]);

/** Every signal not already part of the audit-export decision becomes a pullable ticket. */
export const connectorTickets: ConnectorTicket[] = customerSignals
  .filter(signal => !signal.decisionId)
  .map(signal => {
    const provider = providerById(signal.provider);
    return {
      provider: signal.provider,
      externalId: `${signal.provider}:${signal.externalRef}`,
      title: `${signal.customer.name}: ${signal.title}`,
      text: signal.source.excerpt,
      comment: `Pulled from ${provider.name} (${provider.workspace}) · ${signal.externalRef} · reported by ${signal.source.author} · status in source: ${signal.externalStatus}. Simulated connector sample.`,
      severity: signal.priority === "high" ? "S2" : "S3",
      issueType: requestCategories.has(signal.category) ? "feature_request" : "malfunction",
      customer: signal.customer.name,
      contact: signal.source.author.split(" · ")[0],
      category: signal.category,
      playbook: playbooks[signal.id] ?? missingPlaybook(signal.id),
    } satisfies ConnectorTicket;
  });

export function intakeCommand(ticket: ConnectorTicket) {
  return {
    key: `connector:${ticket.externalId}:r1`,
    body: { action: "intake", source: ticket.provider, externalId: ticket.externalId, sourceRevision: "1", title: ticket.title, text: ticket.text, comment: ticket.comment, environment: "production", severity: ticket.severity, sentiment: "unknown", issueType: ticket.issueType },
  };
}

export function connectorStatus(snapshot: Snapshot) {
  return providers.map(provider => {
    const available = connectorTickets.filter(ticket => ticket.provider === provider.id);
    const pulled = available.filter(ticket => snapshot.reports.some(report => report.source === ticket.provider && report.externalId === ticket.externalId)).length;
    return { ...provider, available: available.length, pulled };
  });
}
