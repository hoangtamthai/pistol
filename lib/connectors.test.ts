import assert from "node:assert/strict";
import { test } from "node:test";
import { CaseStore } from "./case-store";
import { connectorStatus, connectorTickets, intakeCommand } from "./connectors";
import { providers } from "./providers";
import { clusters } from "./agent-playbooks";

test("simulated connectors pull one ticket per source system and never duplicate on re-sync", () => {
  const store = new CaseStore(":memory:");
  const issuesBefore = store.snapshot().issues.length;
  assert.ok(connectorStatus(store.snapshot()).every(connector => connector.pulled === 0));
  assert.deepEqual([...new Set(connectorTickets.map(ticket => ticket.provider))].sort(), providers.map(provider => provider.id).sort());

  for (let pass = 0; pass < 2; pass++) for (const ticket of connectorTickets) { const { key, body } = intakeCommand(ticket); store.execute(body, key); }

  const snapshot = store.snapshot();
  assert.equal(snapshot.issues.length, issuesBefore + connectorTickets.length);
  const status = connectorStatus(snapshot);
  assert.ok(status.every(connector => connector.pulled === connector.available && connector.available > 0));
  const jira = snapshot.reports.find(report => report.source === "jira")!;
  assert.equal(jira.externalId, "jira:SUP-1482");
  assert.equal(jira.accountId, null);
  assert.match(jira.comment || "", /Jira Service Management/);
  store.close();
});

test("every pullable ticket has a complete agent playbook that stops at a proposal", () => {
  const clusterIds = clusters.map(cluster => cluster.id as string);
  for (const { externalId, playbook } of connectorTickets) {
    assert.ok(clusterIds.includes(playbook.cluster), `${externalId} has an unknown cluster`);
    assert.ok(playbook.research.length >= 2, `${externalId} needs research findings`);
    assert.ok(playbook.options.length >= 2, `${externalId} needs options to compare`);
    assert.ok(playbook.options[playbook.recommended], `${externalId} recommends a missing option`);
    assert.ok(playbook.fix.checks.length >= 1);
    assert.ok(playbook.closeout.length > 5);
    const { message } = playbook;
    for (const part of [message.summary, message.why, message.changed, message.youDo]) {
      assert.ok(part.length > 10 && part.length <= 200, `${externalId}: keep each message part short (${part.length} chars)`);
    }
    assert.ok(playbook.customerReply.length > 10);
    const text = `${message.summary} ${message.why} ${message.changed} ${message.youDo}`;
    assert.doesNotMatch(text, /\b(guarantee|by (monday|tomorrow|end of))\b/i, `${externalId} must not promise dates`);
    assert.doesNotMatch(text, /\b(idempoten\w*|tokens?|proxy|HTTP|413|async\w*|deep[- ]link\w*|endpoint|regression|WHATWG|payload)\b/i, `${externalId}: use everyday words in customer messages`);
  }
  for (const cluster of clusters) assert.ok(connectorTickets.some(ticket => ticket.playbook.cluster === cluster.id), `${cluster.id} is empty`);
});
