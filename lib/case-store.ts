import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { accounts as sampleAccounts, sources, requests } from "./demo";
import { affectedAccounts, calculateScenario, CaseError, issueStates, object, oneOf, sanitize, text, WORKSPACE_ID, type Account, type Issue, type Proposal, type Relationship, type Report, type ScenarioInput, type Snapshot } from "./issues";

const tables = ["issues", "reports", "relationships", "evidence", "proposals", "accounts", "outcomes", "workItems", "events", "jobs"] as const;
type Table = typeof tables[number];
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${randomUUID()}`;

export class CaseStore {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    for (const table of tables) this.db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, workspace TEXT NOT NULL CHECK(workspace='orbit-local'), data TEXT NOT NULL CHECK(json_valid(data)))`);
    this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS source_revision ON reports(workspace, json_extract(data, '$.source'), json_extract(data, '$.externalId'), json_extract(data, '$.sourceRevision'));
      CREATE TABLE IF NOT EXISTS commands (key TEXT PRIMARY KEY, hash TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    this.transaction(() => { if (!this.db.prepare("SELECT value FROM metadata WHERE key='seed'").get()) { this.seed(); this.db.prepare("INSERT INTO metadata VALUES ('seed', '1')").run(); } });
  }
  close() { this.db.close(); }
  job(jobId: string) { return this.get<Record<string, unknown>>("jobs", jobId); }
  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = run(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private save(table: Table, key: string, value: unknown) {
    this.db.prepare(`INSERT INTO ${table} (id, workspace, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(key, WORKSPACE_ID, JSON.stringify(value));
  }
  private all<T>(table: Table): T[] {
    return this.db.prepare(`SELECT data FROM ${table} WHERE workspace=? ORDER BY rowid`).all(WORKSPACE_ID).map(row => JSON.parse(row.data as string) as T);
  }
  private get<T>(table: Table, key: string): T {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=? AND workspace=?`).get(key, WORKSPACE_ID);
    if (!row) throw new CaseError("Record not found in this workspace.", 404);
    return JSON.parse(row.data as string) as T;
  }
  snapshot(): Snapshot {
    return { issues: this.all("issues"), reports: this.all("reports"), relationships: this.all("relationships"), evidence: this.all("evidence"), proposals: this.all("proposals"), accounts: this.all("accounts"), outcomes: this.all("outcomes"), workItems: this.all("workItems"), events: this.all<Snapshot["events"][number]>("events").slice(-100).reverse() };
  }
  approvedOutreach(proposalId: string) {
    const proposal = this.get<Proposal>("proposals", proposalId);
    const issue = this.get<Issue>("issues", proposal.issueId);
    if (proposal.kind !== "outreach" || proposal.status !== "approved" || proposal.inputRevision !== issue.revision) throw new CaseError("Approve a current outreach version before generating audio.", 409);
    return proposal;
  }
  reserveAudioPreview(proposalId: string) {
    return this.transaction(() => {
      const proposal = this.approvedOutreach(proposalId);
      const today = now().slice(0, 10);
      const requests = this.all<Snapshot["events"][number]>("events").filter(event => event.type === "audio.requested" && event.createdAt.startsWith(today));
      if (requests.length >= 10) throw new CaseError("The local workspace has reached its 10 audio-preview attempts per UTC day.", 429);
      this.event(proposal.issueId, "audio.requested", `Approved outreach ${proposal.id}; explicit operator consent for ElevenLabs. Preview only, not delivery. A failed request may still consume provider credits.`);
      return proposal;
    });
  }
  private event(issueId: string, type: string, detail: string) {
    const eventId = id("event");
    this.save("events", eventId, { id: eventId, issueId, type, detail, actor: "local-operator", createdAt: now() });
  }
  private evidence(issueId: string, kind: string, title: string, content: string) {
    const evidenceId = id("evidence");
    this.save("evidence", evidenceId, { id: evidenceId, issueId, kind, title: sanitize(title), text: sanitize(content), createdAt: now() });
    return evidenceId;
  }
  private touch(issue: Issue) {
    issue.revision++;
    this.save("issues", issue.id, issue);
    for (const proposal of this.all<Proposal>("proposals")) {
      // shortcut: invalidate all pending workspace proposals on case changes; narrow dependencies when multi-case usage needs it.
      if (["awaiting_approval", "approved"].includes(proposal.status)) this.save("proposals", proposal.id, { ...proposal, status: "stale" });
    }
  }
  private seed() {
    for (const account of sampleAccounts) this.save("accounts", account.id, { id: account.id, name: account.name, arr: account.arr, currency: "USD", recipient: `${account.id}@example.invalid` });
    const issue: Issue = { id: "ISS-014", title: "Audit exports stop at 10,000 events", severity: "S2", state: "investigating", owner: "Platform · Jordan Lee (proposed)", environment: "production-eu", revision: 1, deployed: false, createdAt: "2026-04-14T09:42:00Z" };
    this.save("issues", issue.id, issue);
    this.save("issues", "ISS-015", { ...issue, id: "ISS-015", title: "Scheduled audit exports are incomplete", state: "needs_context", owner: "Triage", revision: 1 });
    for (const request of requests.filter(item => item.problem === "audit-export")) {
      const source = sources.find(item => item.id === request.id)!;
      const report: Report = { id: source.id, source: source.id === "ticket-acme" ? "email" : source.id === "ticket-meridian" ? "helpdesk" : "slack", externalId: source.id, sourceRevision: "1", text: source.excerpt, environment: "production-eu", accountId: request.accountId, sentiment: "concerned", issueType: "malfunction", fixture: true, receivedAt: issue.createdAt };
      this.save("reports", report.id, report);
      this.save("jobs", `job-${report.id}`, { id: `job-${report.id}`, issueId: issue.id, status: "completed", stage: "fixture_seed", createdAt: issue.createdAt, note: "Synthetic fixture loaded; no connector or model was run." });
      this.save("relationships", `link-${report.id}`, { id: `link-${report.id}`, fromId: report.id, toId: issue.id, type: "REPORTS", status: "confirmed", rationale: "Reviewer-labeled fixture: same export endpoint and environment.", evidenceIds: [report.id], reviewer: "fixture-reviewer" });
    }
    this.save("relationships", "link-scheduled", { id: "link-scheduled", fromId: "ticket-acme", toId: "ISS-015", type: "REPORTS", status: "confirmed", rationale: "Fixture links Acme to both symptoms; count the account once.", evidenceIds: ["ticket-acme"], reviewer: "fixture-reviewer" });
    this.save("relationships", "candidate-cause", { id: "candidate-cause", fromId: "ISS-015", toId: issue.id, type: "POSSIBLY_CAUSED_BY", status: "proposed", rationale: "Both paths may use the capped export endpoint. Scheduled-job telemetry is missing. Confirming relevance does not establish causation.", evidenceIds: ["eng-214", "fixture-trace"], reviewer: null });
    for (const source of sources.filter(item => !requests.some(request => request.id === item.id))) this.save("evidence", source.id, { id: source.id, issueId: issue.id, kind: "fixture", title: source.title, text: source.excerpt, createdAt: issue.createdAt });
    this.save("evidence", "fixture-trace", { id: "fixture-trace", issueId: issue.id, kind: "fixture", title: "Sanitized event timeline · illustrative only", text: "2026-04-14 09:40 UTC: export.clicked → GET /audit/export → 200, rows=10000. Environment production-eu, release demo-r42. No input values or request bodies captured. This is a hand-authored fixture, not instrumentation.", createdAt: issue.createdAt });
    this.save("evidence", "fixture-repo", { id: "fixture-repo", issueId: issue.id, kind: "hypothesis", title: "Developer brief · repository and deployment fixture", text: "Observed fixture: export response is capped. Candidate: LIMIT=10000 in example-repo/audit/export.ts at demo-r42. Candidate commit demo-c42 is listed in the fixture deployment; demo-c43 is not deployed and is excluded. No actual repository was inspected. Counterevidence: the scheduled path may have a separate timeout. Reproduce with >10,000 events; test pagination, stable ordering and tenant boundaries. Configuration limits remain an alternative. Ownership: fixture service map → Platform; not latest commit author. No tests have been executed against that example repository.", createdAt: issue.createdAt });
    this.event(issue.id, "workspace.seeded", "Synthetic reports, commercial values, repository and deployment fixtures loaded. No live integrations.");
  }
  execute(input: unknown, key: string): { issueId: string; jobId?: string } {
    const body = object(input);
    text(key, "Idempotency key", 100);
    if ("workspaceId" in body || "actor" in body) throw new CaseError("Workspace and actor are derived from the authenticated session.", 403);
    const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    return this.transaction(() => {
      const prior = this.db.prepare("SELECT hash, result FROM commands WHERE key=?").get(key);
      if (prior) {
        if (prior.hash !== hash) throw new CaseError("Idempotency key was already used for a different request.", 409);
        return JSON.parse(prior.result as string) as { issueId: string; jobId?: string };
      }
      const result = body.action === "intake" ? this.intake(body) : this.change(body);
      this.db.prepare("INSERT INTO commands VALUES (?, ?, ?)").run(key, hash, JSON.stringify(result));
      return result;
    });
  }
  private intake(body: Record<string, unknown>) {
    if (body.accountId) throw new CaseError("New reports have no verified account. Map identity separately after review.");
    const externalId = text(body.externalId, "External ID", 100);
    const sourceRevision = text(body.sourceRevision, "Source revision", 40);
    const source = oneOf(body.source, ["form", "helpdesk", "email", "slack", "call", "public_web"], "source");
    const content = sanitize(text(body.text, "Report"));
    const environment = sanitize(text(body.environment, "Environment", 80));
    const existing = this.all<Report>("reports").find(report => report.externalId === externalId && report.source === source && report.sourceRevision === sourceRevision);
    if (existing) {
      if (existing.text !== content || existing.environment !== environment) throw new CaseError("Source revision already exists with different content. Submit a new revision.", 409);
      const link = this.all<Relationship>("relationships").find(edge => edge.fromId === existing.id && edge.status === "confirmed");
      return { issueId: link!.toId, jobId: `job-${existing.id}` };
    }
    if (this.all<Report>("reports").length >= 500) throw new CaseError("This workspace is limited to 500 report revisions. Export and archive before expanding it.", 409);
    const previous = this.all<Report>("reports").filter(report => report.source === source && report.externalId === externalId);
    const links = this.all<Relationship>("relationships").filter(edge => edge.type === "REPORTS" && edge.status === "confirmed" && previous.some(report => report.id === edge.fromId));
    let issue: Issue;
    if (links.length) {
      issue = this.get<Issue>("issues", links[0].toId);
      for (const issueId of new Set(links.map(link => link.toId))) this.touch(this.get<Issue>("issues", issueId));
    } else {
      issue = { id: id("ISS"), title: sanitize(text(body.title, "Title", 160)), severity: oneOf(body.severity, ["S1", "S2", "S3", "S4"], "severity"), state: "needs_context", owner: "Triage", environment, revision: 1, deployed: false, createdAt: now() };
      this.save("issues", issue.id, issue);
    }
    const report: Report = { id: id("report"), externalId, sourceRevision, source, text: content, environment, accountId: null, receivedAt: now(), sentiment: oneOf(body.sentiment, ["unknown", "neutral", "concerned", "angry"], "sentiment"), issueType: oneOf(body.issueType, ["malfunction", "feature_request", "opinion", "unverified"], "issue type"), fixture: false };
    this.save("reports", report.id, report);
    const linkId = id("link");
    this.save("relationships", linkId, { id: linkId, fromId: report.id, toId: issue.id, type: "REPORTS", status: "confirmed", rationale: "Report preserved in its own case; no account or shared cause inferred.", evidenceIds: [report.id], reviewer: "local-operator" });
    // shortcut: keyword candidates support manual triage only; replace with evaluated matching before connector rollout.
    for (const candidate of this.all<Issue>("issues")) {
      if (candidate.id === issue.id || candidate.environment !== environment || !/export/i.test(content) || !/export/i.test(candidate.title)) continue;
      const candidateId = id("link");
      this.save("relationships", candidateId, { id: candidateId, fromId: report.id, toId: candidate.id, type: "REPORTS", status: "proposed", rationale: "Same environment and export wording only. Inspect evidence; abstain if technical signatures differ.", evidenceIds: [report.id], reviewer: null });
    }
    const jobId = `job-${report.id}`;
    this.save("jobs", jobId, { id: jobId, issueId: issue.id, status: "completed", stage: "deterministic_intake", createdAt: now(), note: "No model or external connector was run. Manual context review remains required." });
    this.event(issue.id, "report.ingested", `${report.id} · ${source} revision ${sourceRevision}; account identity unverified.`);
    return { issueId: issue.id, jobId };
  }
  private change(body: Record<string, unknown>) {
    const issue = this.get<Issue>("issues", text(body.issueId, "Issue ID", 100));
    if (!Number.isInteger(body.revision) || body.revision !== issue.revision) throw new CaseError("This case changed. Refresh and review the latest evidence before retrying.", 409);
    const action = text(body.action, "Action", 40);
    if (action === "context") {
      this.evidence(issue.id, "customer_reported", "Customer clarification · recorded by operator", text(body.answer, "Clarification"));
      this.event(issue.id, "context.received", "A correction or clarification was recorded. Previous versions remain in the evidence trail.");
    } else if (action === "state") {
      const state = oneOf(body.state, issueStates, "issue state");
      const reason = sanitize(text(body.reason, "Reason", 500));
      if (state === "resolved") {
        const affected = affectedAccounts(this.snapshot(), issue.id);
        const outcomes = this.all<Snapshot["outcomes"][number]>("outcomes");
        if (!affected.length || affected.some(account => !outcomes.some(outcome => outcome.issueId === issue.id && outcome.accountId === account.id && outcome.state === "confirmed"))) throw new CaseError("Resolve only after all verified affected accounts confirm recovery.", 409);
      }
      issue.state = state;
      issue.owner = sanitize(text(body.owner, "Owner", 100));
      this.event(issue.id, "issue.state_changed", `${state} · ${issue.owner} · ${reason}`);
    } else if (action === "relationship") {
      const edge = this.get<Relationship>("relationships", text(body.edgeId, "Relationship ID", 100));
      if (edge.toId !== issue.id && edge.fromId !== issue.id) throw new CaseError("Relationship is not part of this case.", 404);
      edge.status = oneOf(body.status, ["confirmed", "rejected", "proposed"], "relationship review");
      edge.reviewer = "local-operator";
      edge.rationale = sanitize(text(body.rationale, "Review rationale", 1000));
      this.save("relationships", edge.id, edge);
      const otherId = edge.fromId === issue.id ? edge.toId : edge.fromId;
      if (edge.type !== "REPORTS") this.touch(this.get<Issue>("issues", otherId));
      this.event(issue.id, "relationship.reviewed", `${edge.type}: ${edge.status}. ${edge.rationale} Causal links remain hypotheses.`);
    } else if (action === "map_account") {
      const report = this.get<Report>("reports", text(body.reportId, "Report ID", 100));
      const links = this.all<Relationship>("relationships").filter(edge => edge.fromId === report.id && edge.type === "REPORTS" && edge.status === "confirmed");
      if (!links.some(edge => edge.toId === issue.id)) throw new CaseError("Report is not linked to this case.", 404);
      const account = this.get<Account>("accounts", text(body.accountId, "Verified account", 100));
      const basis = sanitize(text(body.basis, "Identity verification basis", 500));
      if (report.source === "public_web") throw new CaseError("Public usernames cannot be mapped to customer accounts in this workspace.");
      report.accountId = account.id;
      this.save("reports", report.id, report);
      for (const linkedId of new Set(links.map(link => link.toId))) if (linkedId !== issue.id) this.touch(this.get<Issue>("issues", linkedId));
      this.event(issue.id, "identity.reviewed", `${report.id} → ${account.name}. Operator verification: ${basis}`);
    } else if (action === "scenario") {
      const values = object(body.input);
      const input = Object.fromEntries(["start", "baseline", "min", "max", "weeklyCapacity", "reservedCapacity", "dailyRate"].map(key => [key, values[key]])) as unknown as ScenarioInput;
      const result = calculateScenario(input);
      this.evidence(issue.id, "estimate", "Saved planning scenario · USD · version-bound inputs", JSON.stringify({ inputRevision: issue.revision, input, result, assumptions: "One team, one indivisible workstream; capacity spread over Monday–Friday; no holidays; dependencies assumed ready. Effort includes QA. SSO baseline is displaced by inserted work. No roadmap write. Maintenance and commercial benefit unknown." }, null, 2));
      this.event(issue.id, "scenario.saved", "Deterministic scenario saved with inputs and assumptions. Not a delivery commitment.");
    } else if (action === "proposal") {
      const kind = oneOf(body.kind, ["jira", "outreach"], "proposal type");
      const recipient = text(body.recipient, "Recipient", 100);
      if (kind === "outreach" && !affectedAccounts(this.snapshot(), issue.id).some(account => account.recipient === recipient)) throw new CaseError("Select a verified affected contact. Public usernames are not recipients.");
      if (kind === "jira" && recipient !== "DEMO") throw new CaseError("Only the labeled DEMO Jira adapter is available.");
      const content = sanitize(text(body.text, "Proposal text"));
      const versions = this.all<Proposal>("proposals").filter(proposal => proposal.issueId === issue.id && proposal.kind === kind && proposal.recipient === recipient && proposal.inputRevision === issue.revision && proposal.status !== "stale");
      if (versions.some(proposal => proposal.text === content)) return { issueId: issue.id };
      for (const prior of versions) if (prior.status !== "simulated") this.save("proposals", prior.id, { ...prior, status: "stale" });
      const proposalId = id("proposal");
      this.save("proposals", proposalId, { id: proposalId, issueId: issue.id, kind, recipient, channel: kind === "jira" ? "jira_simulation" : "email_simulation", text: content, inputRevision: issue.revision, status: "awaiting_approval", createdAt: now() });
      this.event(issue.id, "action.proposed", `${kind} draft saved; no external action.`);
      return { issueId: issue.id };
    } else if (action === "approve" || action === "execute") {
      const proposal = this.get<Proposal>("proposals", text(body.proposalId, "Proposal ID", 100));
      if (proposal.issueId !== issue.id) throw new CaseError("Proposal is not part of this case.", 404);
      if (proposal.inputRevision !== issue.revision || proposal.status === "stale") throw new CaseError("Stale approval. Create and review a new draft against the current case revision.", 409);
      if (action === "approve") {
        if (proposal.status !== "awaiting_approval") throw new CaseError("Only a pending draft can be approved.", 409);
        proposal.status = "approved";
      } else {
        if (proposal.status === "simulated") return { issueId: issue.id };
        if (proposal.status !== "approved") throw new CaseError("Approval is required before execution.", 409);
        if (proposal.kind === "jira") {
          const existing = this.all<Snapshot["workItems"][number]>("workItems").find(item => item.issueId === issue.id);
          if (!existing) this.save("workItems", issue.id, { issueId: issue.id, externalId: `DEMO-${this.all("workItems").length + 1}`, state: "To do" });
        }
        proposal.status = "simulated";
      }
      this.save("proposals", proposal.id, proposal);
      this.event(issue.id, action === "approve" ? "action.approved" : "action.simulated", `${proposal.kind} · ${proposal.recipient} · revision ${proposal.inputRevision}. No external write or delivery.`);
      return { issueId: issue.id };
    } else if (action === "work_done") {
      const item = this.get<Snapshot["workItems"][number]>("workItems", issue.id);
      this.save("workItems", issue.id, { ...item, state: "Done (simulated)" });
      this.event(issue.id, "work_item.changed", "Jira Done simulated. Deployment and account recovery remain unverified.");
    } else if (action === "deployment") {
      issue.deployed = true;
      issue.state = "verifying";
      const snapshot = this.snapshot();
      const downstream = snapshot.relationships.filter(edge => edge.type === "POSSIBLY_CAUSED_BY" && edge.toId === issue.id && edge.status === "confirmed");
      for (const caseId of new Set([issue.id, ...downstream.map(edge => edge.fromId)])) {
        for (const account of affectedAccounts(snapshot, caseId)) this.save("outcomes", `${caseId}:${account.id}`, { issueId: caseId, accountId: account.id, state: "verification_due" });
        if (caseId !== issue.id) {
          this.touch(this.get<Issue>("issues", caseId));
          this.event(caseId, "verification.requested", "Candidate underlying fix deployed in simulation. Verify this symptom; do not assume recovery.");
        }
      }
      this.event(issue.id, "deployment.observed", "Simulated deployment to this case environment. Account verification tasks created; no blanket resolution or notification.");
    } else if (action === "outcome") {
      const accountId = text(body.accountId, "Account", 100);
      if (!affectedAccounts(this.snapshot(), issue.id).some(account => account.id === accountId)) throw new CaseError("Account is not linked to this case.");
      const state = oneOf(body.state, ["confirmed", "persists"], "customer outcome");
      const basis = sanitize(text(body.basis, "Customer confirmation evidence", 1000));
      this.save("outcomes", `${issue.id}:${accountId}`, { issueId: issue.id, accountId, state });
      if (state === "persists") issue.state = "reopened";
      this.evidence(issue.id, "customer_reported", `Recovery · ${accountId} · ${state}`, basis);
      this.event(issue.id, "customer.confirmed", `${accountId}: ${state}. This does not imply recovery for other accounts.`);
    } else { throw new CaseError("Unknown action."); }
    this.touch(issue);
    return { issueId: issue.id };
  }
}

let store: CaseStore | undefined;
export function caseStore() {
  if (!store) store = new CaseStore(process.env.RELAY_DB_PATH || "data/relay.sqlite");
  return store;
}
