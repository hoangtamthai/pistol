import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { CaseStore } from "./case-store";
import { affectedAccounts, calculateScenario, customerSafeDraft, sanitize } from "./issues";

const intake = (overrides = {}) => ({ action: "intake", externalId: "test-1", sourceRevision: "1", source: "form", title: "Export failed", text: "Export ends early", environment: "production-eu", severity: "S2", sentiment: "angry", issueType: "malfunction", ...overrides });
function mutate(store: CaseStore, action: string, body = {}, issueId = "ISS-014") {
  const issue = store.snapshot().issues.find(item => item.id === issueId)!;
  return store.execute({ action, issueId, revision: issue.revision, ...body }, randomUUID());
}
function withStore(run: (store: CaseStore) => void) {
  const store = new CaseStore(":memory:");
  try { run(store); } finally { store.close(); }
}

test("three source deliveries create one report revision and durable job, even with different request keys", () => withStore(store => {
  const before = store.snapshot().reports.length;
  const results = [1, 2, 3].map(() => store.execute(intake(), randomUUID()));
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
  assert.equal(store.snapshot().reports.length, before + 1);
  assert.equal(store.db.prepare("SELECT count(*) as n FROM jobs").get()!.n, before + 1);
  assert.equal(store.job(results[0].jobId!).status, "completed");
  assert.throws(() => store.execute(intake({ text: "different payload" }), randomUUID()), /new revision/);
}));

test("idempotency binds request content, and optimistic locking rejects stale mutations", () => withStore(store => {
  const body = { action: "context", issueId: "ISS-014", revision: 1, answer: "A customer correction" };
  const key = randomUUID();
  store.execute(body, key);
  assert.doesNotThrow(() => store.execute(body, key));
  assert.throws(() => store.execute({ ...body, answer: "changed" }, key), /different request/);
  assert.throws(() => store.execute(body, randomUUID()), /case changed/);
  assert.equal(store.snapshot().evidence.filter(item => item.kind === "customer_reported").length, 1);
}));

test("same wording in a different environment is not linked and public identity is never inferred", () => withStore(store => {
  const result = store.execute(intake({ environment: "staging", source: "public_web" }), randomUUID());
  const report = store.snapshot().reports.at(-1)!;
  const links = store.snapshot().relationships.filter(edge => edge.fromId === report.id);
  assert.equal(links.length, 1);
  assert.equal(report.accountId, null);
  assert.deepEqual(affectedAccounts(store.snapshot(), result.issueId), []);
  assert.throws(() => mutate(store, "map_account", { reportId: report.id, accountId: "northstar", basis: "Username looks familiar" }, result.issueId), /Public usernames/);
  assert.throws(() => store.execute(intake({ accountId: "northstar" }), randomUUID()), /verified account/);
  assert.throws(() => store.execute(intake({ workspaceId: "other-workspace" }), randomUUID()), /authenticated session/);
}));

test("reviewed candidate causes stay hypotheses and overlapping account ARR is deduplicated", () => withStore(store => {
  const before = store.snapshot().relationships.find(edge => edge.id === "candidate-cause")!;
  assert.equal(before.status, "proposed");
  mutate(store, "relationship", { edgeId: before.id, status: "confirmed", rationale: "Relevant but missing scheduled-job traces" });
  const after = store.snapshot().relationships.find(edge => edge.id === before.id)!;
  assert.equal(after.type, "POSSIBLY_CAUSED_BY");
  const accounts = affectedAccounts(store.snapshot(), "ISS-014");
  assert.equal(accounts.length, 3);
  assert.equal(accounts.reduce((total, account) => total + account.arr, 0), 148000);
  mutate(store, "relationship", { edgeId: before.id, status: "proposed", rationale: "Undo pending more telemetry" });
  assert.equal(store.snapshot().relationships.find(edge => edge.id === before.id)!.status, "proposed");
}));

test("context corrections invalidate approved immutable messages before execution", () => withStore(store => {
  mutate(store, "proposal", { kind: "outreach", recipient: "northstar@example.invalid", text: "Please retry your export." });
  const proposal = store.snapshot().proposals.at(-1)!;
  mutate(store, "approve", { proposalId: proposal.id });
  mutate(store, "context", { answer: "The issue also occurs with fewer than 100 rows." });
  assert.equal(store.snapshot().proposals.at(-1)!.status, "stale");
  assert.throws(() => mutate(store, "execute", { proposalId: proposal.id }), /Stale approval/);
  assert.throws(() => mutate(store, "proposal", { kind: "outreach", recipient: "stranger@example.com", text: "Hello" }), /verified affected contact/);
}));

test("edited message versions invalidate approval and repeated identical drafts deduplicate", () => withStore(store => {
  mutate(store, "proposal", { kind: "outreach", recipient: "northstar@example.invalid", text: "First version" });
  const proposal = store.snapshot().proposals.at(-1)!;
  mutate(store, "approve", { proposalId: proposal.id });
  mutate(store, "proposal", { kind: "outreach", recipient: "northstar@example.invalid", text: "Second version" });
  mutate(store, "proposal", { kind: "outreach", recipient: "northstar@example.invalid", text: "Second version" });
  assert.equal(store.snapshot().proposals.length, 2);
  assert.equal(store.snapshot().proposals[0].status, "stale");
  assert.equal(store.snapshot().proposals[1].status, "awaiting_approval");
  assert.throws(() => mutate(store, "execute", { proposalId: proposal.id }), /Stale approval/);
}));

test("Jira simulation requires approval, reuses mappings, and Done is not deployed", () => withStore(store => {
  for (let count = 0; count < 2; count++) {
    mutate(store, "proposal", { kind: "jira", recipient: "DEMO", text: `Investigate export failures, review ${count}.` });
    const proposal = store.snapshot().proposals.at(-1)!;
    assert.throws(() => mutate(store, "execute", { proposalId: proposal.id }), /Approval is required/);
    mutate(store, "approve", { proposalId: proposal.id });
    mutate(store, "execute", { proposalId: proposal.id });
    mutate(store, "execute", { proposalId: proposal.id });
  }
  assert.equal(store.snapshot().workItems.length, 1);
  mutate(store, "work_done");
  assert.equal(store.snapshot().issues[0].deployed, false);
  assert.equal(store.snapshot().outcomes.length, 0);
}));

test("deployment creates downstream verification without resolution; customer persists reopens", () => withStore(store => {
  mutate(store, "relationship", { edgeId: "candidate-cause", status: "confirmed", rationale: "Review candidate relevance" });
  mutate(store, "deployment");
  const snapshot = store.snapshot();
  assert.equal(snapshot.outcomes.length, 4);
  assert.ok(snapshot.outcomes.every(outcome => outcome.state === "verification_due"));
  assert.equal(snapshot.issues.find(issue => issue.id === "ISS-015")!.deployed, false);
  assert.throws(() => mutate(store, "state", { state: "resolved", owner: "Platform", reason: "Jira done" }), /all verified affected/);
  mutate(store, "outcome", { accountId: "northstar", state: "persists", basis: "Customer retried and export still truncates" });
  assert.equal(store.snapshot().issues[0].state, "reopened");
}));

test("source revisions preserve originals and invalidate current proposals", () => withStore(store => {
  const result = store.execute(intake(), randomUUID());
  mutate(store, "proposal", { kind: "jira", recipient: "DEMO", text: "Investigate" }, result.issueId);
  const first = store.snapshot().proposals.at(-1)!;
  mutate(store, "approve", { proposalId: first.id }, result.issueId);
  const revision = store.execute(intake({ sourceRevision: "2", text: "Correction: only staging is affected." }), randomUUID());
  assert.equal(revision.issueId, result.issueId);
  assert.equal(store.snapshot().reports.filter(report => report.externalId === "test-1").length, 2);
  assert.equal(store.snapshot().proposals.at(-1)!.status, "stale");
}));

test("sanitization canaries do not reach stored evidence or proposal content", () => withStore(store => {
  const raw = 'https://example.com/fail?token=URL_CANARY#FRAGMENT_CANARY\nAuthorization: Bearer HEADER_CANARY\npassword="INPUT_CANARY"\napi_key=LOG_CANARY';
  const cleaned = sanitize(raw);
  assert.doesNotMatch(cleaned, /URL_CANARY|FRAGMENT_CANARY|HEADER_CANARY|INPUT_CANARY|LOG_CANARY/);
  const result = store.execute(intake({ text: raw }), randomUUID());
  mutate(store, "context", { answer: raw }, result.issueId);
  mutate(store, "proposal", { kind: "jira", recipient: "DEMO", text: raw }, result.issueId);
  assert.doesNotMatch(JSON.stringify(store.snapshot()), /URL_CANARY|FRAGMENT_CANARY|HEADER_CANARY|INPUT_CANARY|LOG_CANARY/);
  const draft = customerSafeDraft(store.snapshot().issues[0]);
  assert.doesNotMatch(draft, /148000|Northstar|source code|demo-c42/);
}));

test("SQLite survives reopening without duplicate seed or lost approvals", () => {
  const directory = mkdtempSync(join(tmpdir(), "relay-store-"));
  const path = join(directory, "case.sqlite");
  let store = new CaseStore(path);
  try {
    const result = store.execute(intake(), "restart-key");
    const count = store.snapshot().reports.length;
    store.close(); store = new CaseStore(path);
    assert.equal(store.snapshot().reports.length, count);
    assert.deepEqual(store.execute(intake(), "restart-key"), result);
    assert.ok(store.snapshot().issues.some(issue => issue.id === result.issueId));
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("capacity scenarios distinguish effort, reserved capacity and weekends", () => {
  const input = { start: "2026-04-20", baseline: "2026-04-24", min: 6, max: 6, weeklyCapacity: 5, reservedCapacity: 1, dailyRate: 800 };
  assert.deepEqual(calculateScenario(input), { earliest: "2026-04-29", latest: "2026-04-29", displacedEarliest: "2026-05-06", displacedLatest: "2026-05-06", costMin: 4800, costMax: 4800 });
  assert.equal(calculateScenario({ ...input, dailyRate: null }).costMin, null);
  for (const overrides of [{ start: "2026-04-25" }, { start: "bad" }, { min: NaN }, { max: 0 }, { reservedCapacity: 5 }, { weeklyCapacity: 0 }, { dailyRate: -1 }]) assert.throws(() => calculateScenario({ ...input, ...overrides }));
});
