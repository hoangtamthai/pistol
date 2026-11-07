import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/issues/route";
import { GET as getJob } from "../app/api/jobs/[id]/route";
import { POST as audio } from "../app/api/outreach/audio/route";
import { caseStore } from "./case-store";
import { createSession, SESSION_COOKIE } from "./workspace-auth";

test("issues need no password; origin checks and paid audio protection remain enforced", async () => {
  const directory = mkdtempSync(join(tmpdir(), "relay-api-"));
  const saved = { password: process.env.RELAY_WORKSPACE_PASSWORD, path: process.env.RELAY_DB_PATH, key: process.env.ELEVENLABS_API_KEY, voice: process.env.ELEVENLABS_VOICE_ID };
  const originalFetch = globalThis.fetch;
  delete process.env.RELAY_WORKSPACE_PASSWORD;
  process.env.RELAY_DB_PATH = join(directory, "api.sqlite");
  const request = (body: unknown, origin = "http://127.0.0.1:3000") => new NextRequest("http://127.0.0.1:3000/api/issues", { method: "POST", headers: { host: "127.0.0.1:3000", origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(body) });
  const paidRequest = (body: unknown) => { const req = request(body); req.cookies.set(SESSION_COOKIE, createSession()); return req; };
  try {
    assert.equal((await GET(new NextRequest("http://localhost/api/issues"))).status, 200);
    const issueRequest = (issueId: string) => new NextRequest(`http://localhost/api/issues?issue=${issueId}`);
    const workflow = await GET(issueRequest("ISS-014"));
    assert.equal(workflow.status, 200);
    assert.equal(workflow.headers.get("cache-control"), "no-store");
    assert.equal((await workflow.json()).lifecycle.step, 0);
    assert.equal((await GET(issueRequest("missing"))).status, 404);
    const intake = await POST(request({ action: "intake", source: "form", externalId: "no-password-test", sourceRevision: "1", title: "Password-free issue", text: "Test report", comment: "Saved without signing in", environment: "staging", severity: "S3", sentiment: "unknown", issueType: "malfunction" }));
    assert.equal(intake.status, 200);
    const { jobId } = await intake.json();
    assert.equal((await getJob(new NextRequest(`http://localhost/api/jobs/${jobId}`), { params: Promise.resolve({ id: jobId }) })).status, 200);
    assert.equal((await POST(request({}, "https://foreign.example"))).status, 403);
    assert.equal((await POST(request({}, ""))).status, 403);
    assert.equal((await POST(request({ action: "intake", workspaceId: "foreign" }))).status, 403);
    assert.equal((await POST(request({ action: "context", issueId: "ISS-014", revision: 1, answer: "Customer clarifies expected behavior" }))).status, 200);
    assert.equal((await POST(request({ action: "context", issueId: "ISS-014", revision: 1, answer: "Stale write" }))).status, 409);
    const store = caseStore();
    const issue = store.snapshot().issues[0];
    store.execute({ action: "proposal", issueId: issue.id, revision: issue.revision, kind: "outreach", recipient: "northstar@example.invalid", text: "Hello, please retry the workflow." }, randomUUID());
    const proposal = store.snapshot().proposals.at(-1)!;
    process.env.RELAY_WORKSPACE_PASSWORD = "api-test-password-long-enough";
    assert.equal((await GET(issueRequest("ISS-014"))).status, 200);
    assert.equal((await audio(request({ proposalId: proposal.id, consent: true }))).status, 401);
    process.env.ELEVENLABS_API_KEY = "private-test-api-key";
    process.env.ELEVENLABS_VOICE_ID = "testVoice";
    let providerCalls = 0;
    globalThis.fetch = async (_url, options) => {
      providerCalls++;
      assert.deepEqual(JSON.parse(options?.body as string), { text: proposal.text, model_id: "eleven_multilingual_v2" });
      return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
    };
    assert.equal((await audio(paidRequest({ proposalId: proposal.id, consent: false }))).status, 400);
    assert.equal((await audio(paidRequest({ proposalId: proposal.id, consent: true }))).status, 409);
    assert.equal(providerCalls, 0);
    store.execute({ action: "approve", issueId: issue.id, revision: issue.revision, proposalId: proposal.id }, randomUUID());
    const preview = await audio(paidRequest({ proposalId: proposal.id, consent: true }));
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "audio/mpeg");
    assert.equal(preview.headers.get("cache-control"), "no-store");
    assert.equal(providerCalls, 1);
    assert.equal(store.snapshot().outcomes.length, 0);
    globalThis.fetch = async () => {
      store.execute({ action: "context", issueId: issue.id, revision: issue.revision, answer: "New contradictory evidence during generation" }, randomUUID());
      return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
    };
    assert.equal((await audio(paidRequest({ proposalId: proposal.id, consent: true }))).status, 409);
    assert.equal(store.snapshot().proposals.at(-1)!.status, "stale");
  } finally {
    globalThis.fetch = originalFetch;
    caseStore().close();
    for (const [name, value] of Object.entries({ RELAY_WORKSPACE_PASSWORD: saved.password, RELAY_DB_PATH: saved.path, ELEVENLABS_API_KEY: saved.key, ELEVENLABS_VOICE_ID: saved.voice })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    rmSync(directory, { recursive: true, force: true });
  }
});
