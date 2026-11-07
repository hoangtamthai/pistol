import { addBusinessDays } from "./demo";

export const WORKSPACE_ID = "orbit-local";
export const issueStates = ["new", "needs_context", "triaged", "investigating", "planned", "in_progress", "verifying", "resolved", "reopened", "dismissed"] as const;
export type IssueState = typeof issueStates[number];
export type Issue = { workflowStep?: number; id: string; title: string; severity: string; state: IssueState; owner: string; environment: string; revision: number; deployed: boolean; createdAt: string };
export type Report = { comment?: string; id: string; externalId: string; sourceRevision: string; source: string; text: string; environment: string; accountId: string | null; receivedAt: string; sentiment: string; issueType: string; fixture: boolean };
export type Relationship = { id: string; fromId: string; toId: string; type: "REPORTS" | "POSSIBLY_CAUSED_BY" | "RELATED_TO"; status: "proposed" | "confirmed" | "rejected"; rationale: string; evidenceIds: string[]; reviewer: string | null };
export type Evidence = { id: string; issueId: string; kind: string; title: string; text: string; createdAt: string };
export type Proposal = { id: string; issueId: string; kind: "jira" | "outreach" | "fix"; recipient: string; channel: string; text: string; inputRevision: number; status: "awaiting_approval" | "approved" | "simulated" | "stale"; createdAt: string };
export type Account = { id: string; name: string; arr: number; currency: string; recipient: string };
export type Snapshot = { issues: Issue[]; reports: Report[]; relationships: Relationship[]; evidence: Evidence[]; proposals: Proposal[]; accounts: Account[]; outcomes: { issueId: string; accountId: string; state: string }[]; workItems: { issueId: string; externalId: string; state: string }[]; events: { id: string; issueId: string; type: string; detail: string; createdAt: string }[] };

export class CaseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CaseError("A JSON object is required.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, name: string, max = 4000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new CaseError(`${name} must contain 1–${max} characters.`);
  return value.trim();
}
export function oneOf<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) throw new CaseError(`Invalid ${name}.`);
  return value as T;
}

// shortcut: conservative text redaction is not a DLP system; restrict this MVP to sanitized test data until application-specific canaries pass.
export function sanitize(value: string) {
  return value
    .replace(/https?:\/\/[^\s<>"']+/gi, raw => {
      try { const url = new URL(raw); return `${url.origin}${url.pathname}${url.search ? "?[redacted]" : ""}${url.hash ? "#[redacted]" : ""}`; }
      catch { return "[redacted URL]"; }
    })
    .replace(/\b(?:authorization|cookie|set-cookie)\s*:[^\r\n]*/gi, "[redacted header]")
    .replace(/\b(?:password|passwd|secret|token|api[_-]?key|input(?:[_-]?value)?)\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi, "[redacted field]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
}

export function affectedAccounts(snapshot: Snapshot, issueId: string) {
  const issueIds = new Set([issueId]);
  for (const currentId of issueIds) {
    for (const edge of snapshot.relationships) {
      if (edge.toId === currentId && edge.type === "POSSIBLY_CAUSED_BY" && edge.status === "confirmed") issueIds.add(edge.fromId);
    }
  }
  const reportIds = new Set(snapshot.relationships.filter(edge => edge.type === "REPORTS" && edge.status === "confirmed" && issueIds.has(edge.toId)).map(edge => edge.fromId));
  const accountIds = new Set(snapshot.reports.filter(report => reportIds.has(report.id)).map(report => report.accountId));
  return snapshot.accounts.filter(account => accountIds.has(account.id));
}

export type ScenarioInput = { start: string; baseline: string; min: number; max: number; weeklyCapacity: number; reservedCapacity: number; dailyRate: number | null };
export function calculateScenario(input: ScenarioInput) {
  const { min, max, weeklyCapacity, reservedCapacity, dailyRate } = input;
  if (![min, max, weeklyCapacity, reservedCapacity].every(Number.isFinite) || min <= 0 || max < min || max > 100 || weeklyCapacity <= 0 || weeklyCapacity > 5 || reservedCapacity < 0 || reservedCapacity >= weeklyCapacity) throw new CaseError("Enter 0–5 engineer-days of weekly capacity, a smaller reserve, and 0–100 days of ordered effort.");
  if (dailyRate !== null && (!Number.isFinite(dailyRate) || dailyRate < 0 || dailyRate > 100000)) throw new CaseError("Enter a valid loaded daily rate or leave it unknown.");
  try {
    addBusinessDays(input.start, 0); addBusinessDays(input.baseline, 0);
    const weekday = new Date(`${input.start}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) throw new CaseError("Choose a weekday start.");
    if (input.baseline < input.start) throw new CaseError("The baseline milestone must not precede the start.");
    const days = (effort: number) => Math.ceil(effort / ((weeklyCapacity - reservedCapacity) / 5));
    return { earliest: addBusinessDays(input.start, days(min) - 1), latest: addBusinessDays(input.start, days(max) - 1), displacedEarliest: addBusinessDays(input.baseline, days(min)), displacedLatest: addBusinessDays(input.baseline, days(max)), costMin: dailyRate === null ? null : min * dailyRate, costMax: dailyRate === null ? null : max * dailyRate };
  } catch (error) { if (error instanceof CaseError) throw error; throw new CaseError("Use valid dates and a planning horizon below 365 working days."); }
}

export function customerSafeDraft(issue: Issue) {
  return issue.deployed
    ? "Hello,\n\nA deployment has been recorded for the reported problem in this test scenario. Please retry your affected workflow and tell us whether the problem persists. We will keep your recovery open until you confirm.\n\nThank you,\nCustomer Support"
    : "Hello,\n\nWe are investigating your report. Could you share the steps you took, what you expected, and what happened instead? Please do not include passwords, tokens, or personal data. It is fine to say ‘I don’t know’.\n\nWe have not committed a delivery date.\n\nThank you,\nCustomer Support";
}
