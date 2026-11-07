// SYNTHETIC DEMO: no provider is actually connected. Each entry describes a simulated
// intake connector so the inbox can show signals arriving from many tools at once.
export type ProviderId =
  | "slack"
  | "jira"
  | "zendesk"
  | "intercom"
  | "gmail"
  | "linear"
  | "github"
  | "hubspot"
  | "teams"
  | "salesforce";

export type Provider = {
  id: ProviderId;
  name: string;
  category: "Chat" | "Issue tracker" | "Helpdesk" | "Email" | "CRM";
  /** What one item from this provider is called, e.g. "message" or "ticket". */
  noun: string;
  /** Two-letter monogram shown instead of a brand logo. */
  mark: string;
  /** Simulated workspace / account the connector reads from. */
  workspace: string;
  /** Simulated last successful sync, ISO timestamp. */
  syncedAt: string;
};

export const providers: Provider[] = [
  { id: "slack", name: "Slack", category: "Chat", noun: "message", mark: "Sl", workspace: "context-demo.slack.com · 5 shared channels", syncedAt: "2026-04-14T10:39:00Z" },
  { id: "jira", name: "Jira Service Management", category: "Issue tracker", noun: "ticket", mark: "Ji", workspace: "context-demo.atlassian.net · SUP project", syncedAt: "2026-04-14T10:38:00Z" },
  { id: "zendesk", name: "Zendesk", category: "Helpdesk", noun: "ticket", mark: "Zd", workspace: "contextdemo.zendesk.com · Support", syncedAt: "2026-04-14T10:37:00Z" },
  { id: "intercom", name: "Intercom", category: "Helpdesk", noun: "conversation", mark: "In", workspace: "Context Demo · Messenger inbox", syncedAt: "2026-04-14T10:39:00Z" },
  { id: "gmail", name: "Gmail", category: "Email", noun: "email", mark: "Gm", workspace: "support@context-demo.example", syncedAt: "2026-04-14T10:35:00Z" },
  { id: "linear", name: "Linear", category: "Issue tracker", noun: "issue", mark: "Li", workspace: "Context Demo · Customer requests", syncedAt: "2026-04-14T10:36:00Z" },
  { id: "github", name: "GitHub Issues", category: "Issue tracker", noun: "issue", mark: "Gh", workspace: "context-demo/sdk-node", syncedAt: "2026-04-14T10:34:00Z" },
  { id: "hubspot", name: "HubSpot", category: "CRM", noun: "ticket", mark: "Hs", workspace: "Context Demo · Service Hub", syncedAt: "2026-04-14T10:33:00Z" },
  { id: "teams", name: "Microsoft Teams", category: "Chat", noun: "message", mark: "Te", workspace: "Context Demo · Shared customer channels", syncedAt: "2026-04-14T10:38:00Z" },
  { id: "salesforce", name: "Salesforce Service Cloud", category: "CRM", noun: "case", mark: "Sf", workspace: "context-demo.my.salesforce.com", syncedAt: "2026-04-14T10:32:00Z" },
];

export function providerById(id: ProviderId): Provider {
  const provider = providers.find(item => item.id === id);
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

/** Minutes between a provider's last sync and the inbox snapshot time. */
export function minutesSinceSync(provider: Provider, snapshotAt = "2026-04-14T10:40:00Z") {
  return Math.max(0, Math.round((Date.parse(snapshotAt) - Date.parse(provider.syncedAt)) / 60000));
}
