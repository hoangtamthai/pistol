import assert from "node:assert/strict";
import { test } from "node:test";
import { matchRequests } from "./demo";
import { customerSignals, filterSignals, inboxCustomers, signalStatus } from "./inbox";

test("inbox represents five customers and preserves each original source", () => {
  assert.equal(customerSignals.length, 8);
  assert.equal(new Set(customerSignals.map(signal => signal.customer.id)).size, 5);
  assert.equal(new Set(customerSignals.map(signal => signal.id)).size, 8);
  for (const signal of customerSignals) {
    assert.equal(signal.source.id, signal.id);
    assert.ok(signal.source.excerpt.length > 50);
    assert.ok(signal.customer.name);
    assert.ok(signal.title);
    assert.ok(Number.isFinite(Date.parse(signal.receivedAt)));
    assert.ok(inboxCustomers.some(customer => customer.id === signal.customer.id));
  }
  assert.equal(customerSignals[0].id, "slack-harbor-webhooks");
});

test("inbox search is trimmed and case-insensitive, including source excerpts and senders", () => {
  assert.equal(filterSignals("  HARBOR  ", "all", "all").length, 1);
  assert.equal(filterSignals("Priya Shah", "all", "all").length, 3);
  assert.equal(filterSignals("purchase-order", "all", "all")[0].customer.id, "atlas");
  assert.equal(filterSignals("DEC-014", "all", "all").length, 5);
  assert.equal(filterSignals("unmatched query", "all", "all").length, 0);
});

test("customer and status filters intersect without confusing separate issues", () => {
  assert.equal(filterSignals("", "meridian", "all").length, 3);
  assert.equal(filterSignals("", "meridian", "linked").length, 2);
  assert.equal(filterSignals("", "meridian", "new")[0].id, "slack-meridian-sso");
  assert.equal(filterSignals("", "all", "new").length, 3);
  assert.equal(filterSignals("", "all", "reviewed").length, 0);
  const reviewedIds = ["slack-harbor-webhooks"];
  assert.equal(filterSignals("", "all", "reviewed", reviewedIds)[0].customer.id, "harbor");
  assert.equal(filterSignals("", "all", "new", reviewedIds).length, 2);
  assert.equal(filterSignals("Harbor", "atlas", "all").length, 0);
});

test("only audit-export signals link to the existing decision and keep its impact unchanged", () => {
  const linkedIds = customerSignals.filter(signal => signal.decisionId).map(signal => signal.id).sort();
  assert.deepEqual(linkedIds, matchRequests("audit-export").requests.map(request => request.id).sort());
  assert.equal(matchRequests("audit-export").accounts.length, 3);
  assert.equal(matchRequests("audit-export").associatedArr, 148000);
  const linked = customerSignals.find(signal => signal.id === "slack-northstar")!;
  assert.equal(signalStatus(linked, [linked.id]), "linked");
  assert.ok(customerSignals.filter(signal => !signal.decisionId).every(signal => signal.nextStep.length > 20));
});
