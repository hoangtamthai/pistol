import assert from "node:assert/strict";
import { test } from "node:test";
import { accounts, addBusinessDays, agentContext, answerQuestion, customerDraft, matchRequests, sources, timeline, updateOutcome } from "./demo";

test("related requests count unique accounts and exclude unrelated issues", () => {
  const result = matchRequests("audit-export");
  assert.equal(result.requests.length, 5);
  assert.equal(result.accounts.length, 3);
  assert.equal(result.associatedArr, 148000);
  assert.deepEqual(result.explicitBlockers.map(account => account.id), ["northstar"]);
  assert.equal(matchRequests("missing").associatedArr, 0);
  assert.equal(matchRequests("sso-settings").accounts.length, 1);
});

test("business-day planning separates effort from elapsed time", () => {
  assert.equal(addBusinessDays("2026-04-24", 1), "2026-04-27");
  assert.deepEqual(timeline, { earliest: "2026-04-22", latest: "2026-04-24", displacedEarliest: "2026-04-29", displacedLatest: "2026-05-01" });
  for (const date of ["garbage", "2026-02-30"]) assert.throws(() => addBusinessDays(date, 1));
  for (const days of [-1, 0.5, 366]) assert.throws(() => addBusinessDays("2026-04-20", days));
});

test("release, notification, and confirmation cannot be conflated", () => {
  const initial = { released: false, notified: false, confirmed: false };
  assert.deepEqual(updateOutcome(initial, "notify"), initial);
  assert.deepEqual(updateOutcome(initial, "confirm"), initial);
  const released = updateOutcome(initial, "release");
  assert.equal(released.notified, false);
  assert.deepEqual(updateOutcome(released, "confirm"), released);
  const notified = updateOutcome(released, "notify");
  assert.equal(notified.confirmed, false);
  assert.equal(updateOutcome(notified, "confirm").confirmed, true);
  assert.equal(initial.released, false);
});

test("scripted answers cite real fixture sources and refuse unrelated questions", () => {
  for (const query of ["revenue at risk", "timeline", "who else", "draft a reply", "follow up", "workaround"]) {
    const answer = answerQuestion(query);
    assert.ok(answer.sourceIds.length);
    for (const id of answer.sourceIds) assert.ok(sources.some(source => source.id === id));
  }
  assert.match(answerQuestion("revenue at risk").text, /not a predicted/);
  assert.match(answerQuestion("weather").text, /only answers the seeded/);
  assert.equal(answerQuestion("").sourceIds.length, 0);
});

test("all matched requests and important claims retain their sources", () => {
  for (const request of matchRequests("audit-export").requests) assert.ok(sources.some(source => source.id === request.id));
  const context = JSON.parse(agentContext());
  assert.equal(context.impact.accounts.length, accounts.length);
  assert.match(context.notice, /SYNTHETIC/);
  assert.ok(context.unknowns.includes("Probability and amount of revenue loss"));
});

test("customer drafts ask consent and do not promise planning dates", () => {
  for (const option of ["workaround", "permanent"] as const) {
    for (const language of ["en", "de"] as const) {
      const draft = customerDraft(option, language);
      assert.ok(draft.includes("?"));
      assert.doesNotMatch(draft, /April 2[024]|May 1/);
      assert.match(draft, language === "en" ? /secure transfer/ : /sicheren Übertragungskanal/);
    }
  }
});
