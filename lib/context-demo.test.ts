import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const engine = require("../public/context-demo/demo-engine.js");

for (const id of ["away", "lifecycle"]) {
  test(`Context ${id}: approval and explicit confirmation gates`, () => {
    let state = engine.createState();
    state.active = id;
    const { gate, verify, last, cases } = engine.definitions[id];
    assert.equal(engine.approve(state, "tech", true), state);
    assert.equal(engine.confirm(state), state);
    for (let i = 0; i < gate; i++) state = engine.advance(state);
    assert.equal(engine.status(state).approvalGate, true);
    assert.equal(engine.advance(state), state);
    assert.equal(engine.approve(state, "tech", false), state);
    assert.equal(engine.approve(state, "unknown", true), state);
    if (id === "away") {
      state = engine.approve(state, "retail", true);
      assert.equal(state.away.approvals.tech, false);
      assert.equal(engine.advance(state), state);
    }
    state = engine.approve(state, "tech", true);
    assert.equal(state[id].step, gate);
    for (const caseId of cases) assert.equal(state[id].confirmations[caseId], false);
    assert.equal(engine.confirm(state), state);
    while (state[id].step < verify) state = engine.advance(state);
    assert.equal(engine.status(state).confirmationGate, true);
    assert.equal(engine.advance(state), state);
    state = engine.confirm(state);
    assert.equal(state[id].step, last);
    assert.equal(engine.status(state).finished, true);
    assert.equal(engine.advance(state), state);
    assert.deepEqual(engine.restore(state), state);

    const changed = engine.invalidateApproval(state, "tech");
    assert.equal(changed[id].step, gate);
    assert.equal(changed[id].approvals.tech, false);
    for (const caseId of cases) assert.equal(changed[id].confirmations[caseId], false);
    assert.equal(engine.advance(changed), changed);
    assert.equal(state[id].step, last, "transitions do not mutate prior state");
  });
}

test("Context scenarios keep independent progress and reset only the selected one", () => {
  let state = engine.createState();
  state = engine.advance(state, "away");
  state = engine.advance(state, "lifecycle");
  state = engine.advance(state, "lifecycle");
  const reset = engine.reset(state, "away");
  assert.equal(reset.away.step, 0);
  assert.deepEqual(reset.lifecycle, state.lifecycle);
  assert.equal(state.away.step, 1);
});

test("Context restores invalid storage without premature approvals or confirmations", () => {
  for (const value of [null, undefined, false, 42, "invalid", [], {}]) {
    assert.deepEqual(engine.restore(value), engine.createState());
  }
  for (const id of ["away", "lifecycle"]) {
    const { gate, verify, last, cases } = engine.definitions[id];
    const flags = Object.fromEntries(cases.map((caseId: string) => [caseId, true]));
    let state = engine.createState();
    state[id] = { step: 0, approvals: flags, confirmations: flags };
    assert.deepEqual(engine.restore(state), engine.createState());
    state[id] = { step: gate, approvals: flags, confirmations: flags };
    state = engine.restore(state);
    assert.equal(engine.status(state, id).approvalGate, false);
    for (const caseId of cases) assert.equal(state[id].confirmations[caseId], false);
    state[id].step = last;
    assert.equal(engine.restore(state)[id].step, verify);
    state[id].approvals.tech = false;
    assert.equal(engine.restore(state)[id].step, gate);
    state[id].step = -10;
    assert.equal(engine.restore(state)[id].step, 0);
    state[id].step = "6";
    assert.equal(engine.restore(state)[id].step, 0);
  }
});
