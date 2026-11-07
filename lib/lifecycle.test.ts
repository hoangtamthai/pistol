import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CaseStore } from "./case-store";
import { issueLifecycle } from "./lifecycle";
import { workspaceReturnPath } from "./navigation";

const intake = { action: "intake", externalId: "context-form-1", sourceRevision: "1", source: "form", title: "Upload rejected", text: "A valid PDF cannot be uploaded.", comment: "Reproduced with a small PDF. token=PRIVATE_CANARY", environment: "staging", severity: "S2", sentiment: "unknown", issueType: "malfunction" };
const investigation = { findings: "A missing client MIME label triggers rejection in the local reproduction.", fix: "Inspect the file on the server. One engineer-day; other work moves by one day.", checks: "Verify empty-MIME PDFs, invalid documents, and size limits. Automated tests not run." };
function mutate(store: CaseStore, issueId: string, action: string, body = {}) {
  const issue = store.snapshot().issues.find(item => item.id === issueId)!;
  return store.execute({ action, issueId, revision: issue.revision, ...body }, randomUUID());
}
function advance(store: CaseStore, issueId: string) {
  return mutate(store, issueId, "workflow_advance", { step: issueLifecycle(store.snapshot(), issueId).lifecycle.step });
}
function reviewReady(store: CaseStore, issueId: string) {
  advance(store, issueId); advance(store, issueId);
  mutate(store, issueId, "state", { state: "triaged", owner: "Platform · Assigned engineer", reason: "Owner accepted the case" });
  advance(store, issueId);
  mutate(store, issueId, "workflow_investigation", investigation);
  advance(store, issueId); advance(store, issueId);
}

test("Context comments persist separately, redact secrets, and participate in source revision deduplication", () => {
  const directory = mkdtempSync(join(tmpdir(), "context-lifecycle-"));
  const path = join(directory, "issues.sqlite");
  let store = new CaseStore(path);
  try {
    const result = store.execute(intake, "intake-key");
    const report = store.snapshot().reports.at(-1)!;
    assert.match(report.comment!, /Reproduced with a small PDF/);
    assert.doesNotMatch(report.comment!, /PRIVATE_CANARY/);
    assert.equal(report.text, intake.text);
    assert.deepEqual(store.execute(intake, randomUUID()), result);
    assert.throws(() => store.execute({ ...intake, comment: "Changed comment" }, randomUUID()), /new revision/);
    for (const comment of [42, {}, "x".repeat(2001)]) assert.throws(() => store.execute({ ...intake, comment }, randomUUID()), /Comment/);
    advance(store, result.issueId);
    store.close(); store = new CaseStore(path);
    const view = issueLifecycle(store.snapshot(), result.issueId);
    assert.equal(view.lifecycle.step, 1);
    assert.equal(view.reports[0].comment, report.comment);
    assert.ok(store.snapshot().issues.some(issue => issue.id === "ISS-014"));
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("saved issues advance only through recorded evidence and explicit human checks", () => {
  const store = new CaseStore(":memory:");
  try {
    const { issueId } = store.execute(intake, randomUUID());
    assert.throws(() => mutate(store, issueId, "workflow_investigation", investigation), /assign an owner/);
    advance(store, issueId); advance(store, issueId);
    assert.equal(issueLifecycle(store.snapshot(), issueId).lifecycle.step, 2);
    assert.throws(() => advance(store, issueId), /responsible owner/);
    mutate(store, issueId, "state", { state: "triaged", owner: "Platform", reason: "Owner accepted" });
    advance(store, issueId);
    assert.throws(() => advance(store, issueId), /investigation findings/);
    mutate(store, issueId, "workflow_investigation", investigation);
    advance(store, issueId); advance(store, issueId);
    let view = issueLifecycle(store.snapshot(), issueId);
    const proposalId = view.proposal!.id;
    assert.match(view.proposal!.text, /Automated tests not run/);
    assert.equal(view.lifecycle.step, 5);
    assert.throws(() => advance(store, issueId), /acknowledge/);
    assert.throws(() => mutate(store, issueId, "approve", { proposalId }), /acknowledge/);
    assert.throws(() => mutate(store, issueId, "approve", { proposalId, reviewed: "true" }), /acknowledge/);
    mutate(store, issueId, "approve", { proposalId, reviewed: true });
    assert.equal(issueLifecycle(store.snapshot(), issueId).issue.deployed, false);
    advance(store, issueId);
    assert.throws(() => advance(store, issueId), /deployment verification/);
    assert.throws(() => mutate(store, issueId, "execute", { proposalId }), /deployment check/);
    assert.throws(() => mutate(store, issueId, "workflow_deploy", { basis: "Release checked" }), /Acknowledge/);
    mutate(store, issueId, "workflow_deploy", { reviewed: true, basis: "Simulated release checked in staging; valid PDF accepted." });
    advance(store, issueId);
    view = issueLifecycle(store.snapshot(), issueId);
    assert.equal(view.lifecycle.step, 7);
    assert.notEqual(view.issue.state, "resolved");
    assert.throws(() => advance(store, issueId), /Verify customer identity/);
    mutate(store, issueId, "map_account", { reportId: view.reports[0].id, accountId: "northstar", basis: "Authorized local fixture contact verified" });
    assert.throws(() => mutate(store, issueId, "workflow_confirm", { accountId: "northstar", state: "confirmed", basis: "Reply" }), /Acknowledge/);
    mutate(store, issueId, "workflow_confirm", { accountId: "northstar", state: "persists", basis: "Customer reports upload still fails", reviewed: true });
    assert.equal(issueLifecycle(store.snapshot(), issueId).issue.state, "reopened");
    assert.throws(() => advance(store, issueId), /customer identity/);
    mutate(store, issueId, "workflow_confirm", { accountId: "northstar", state: "confirmed", basis: "Customer retried the original file and confirms recovery", reviewed: true });
    advance(store, issueId);
    view = issueLifecycle(store.snapshot(), issueId);
    assert.equal(view.lifecycle.finished, true);
    assert.equal(view.issue.state, "resolved");
    assert.throws(() => advance(store, issueId));
  } finally { store.close(); }
});

test("concurrent lifecycle steps and stale approvals cannot bypass review", () => {
  const store = new CaseStore(":memory:");
  try {
    const { issueId } = store.execute(intake, randomUUID());
    reviewReady(store, issueId);
    const original = issueLifecycle(store.snapshot(), issueId);
    const proposalId = original.proposal!.id;
    mutate(store, issueId, "approve", { proposalId, reviewed: true });
    const body = { action: "workflow_advance", step: 5, issueId, revision: original.issue.revision };
    const key = randomUUID();
    store.execute(body, key);
    assert.doesNotThrow(() => store.execute(body, key));
    assert.throws(() => store.execute(body, randomUUID()), /Workflow changed/);
    mutate(store, issueId, "context", { answer: "Correction: another file type is also affected" });
    assert.equal(issueLifecycle(store.snapshot(), issueId).lifecycle.step, 4);
    assert.throws(() => mutate(store, issueId, "workflow_deploy", { reviewed: true, basis: "Unreviewed deployment" }), /current approved fix/);
    advance(store, issueId);
    const replacement = issueLifecycle(store.snapshot(), issueId);
    assert.notEqual(replacement.proposal!.id, proposalId);
    assert.equal(replacement.proposal!.status, "awaiting_approval");
    assert.match(replacement.proposal!.text, /another file type is also affected/);
    assert.equal(replacement.lifecycle.canAdvance, false);
    assert.equal(store.snapshot().issues.find(issue => issue.id === "ISS-014")!.workflowStep, undefined);
  } finally { store.close(); }
});

test("all verified accounts must confirm before automatic closure", () => {
  const store = new CaseStore(":memory:");
  try {
    const issueId = "ISS-014";
    reviewReady(store, issueId);
    const view = issueLifecycle(store.snapshot(), issueId);
    mutate(store, issueId, "approve", { proposalId: view.proposal!.id, reviewed: true });
    advance(store, issueId);
    mutate(store, issueId, "workflow_deploy", { reviewed: true, basis: "Simulated deployment verified" });
    advance(store, issueId);
    for (const account of view.affected) {
      assert.equal(issueLifecycle(store.snapshot(), issueId).lifecycle.canAdvance, false);
      mutate(store, issueId, "workflow_confirm", { accountId: account.id, state: "confirmed", basis: "Explicit customer test reply", reviewed: true });
    }
    assert.equal(issueLifecycle(store.snapshot(), issueId).lifecycle.canAdvance, true);
    advance(store, issueId);
    assert.equal(issueLifecycle(store.snapshot(), issueId).lifecycle.finished, true);
    assert.throws(() => issueLifecycle(store.snapshot(), "missing"), /not found/);
  } finally { store.close(); }
});

test("sign-in returns only to known local workspace routes", () => {
  for (const path of ["/context", "/issues", "/context/issues", "/context/issues/new", "/context/issues/ISS-014"]) assert.equal(workspaceReturnPath(path), path);
  for (const path of [null, "https://evil.example", "//evil.example", "/\\evil.example", "/context/issues/../evil", "/context/issues/%2F%2Fevil.example", "/context/issues/new?next=https://evil.example"]) assert.equal(workspaceReturnPath(path), "/context/issues");
});
