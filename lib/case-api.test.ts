import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/issues/route";
import { POST as audio } from "../app/api/outreach/audio/route";
import { caseStore } from "./case-store";
import { createSession, SESSION_COOKIE } from "./workspace-auth";

test("API enforces auth, CSRF, safe audio egress, and post-generation approval checks", async () => {
  const directory = mkdtempSync(join(tmpdir(), "relay-api-"));
  const saved = { password: process.env.RELAY_WORKSPACE_PASSWORD, path: process.env.RELAY_DB_PATH, key: process.env.ELEVENLABS_API_KEY, voice: process.env.ELEVENLABS_VOICE_ID };
  const originalFetch = globalThis.fetch;
  process.env.RELAY_WORKSPACE_PASSWORD = "api-test-password-long-enough";
  process.env.RELAY_DB_PATH = join(directory, "api.sqlite");
  const request = (body: unknown, origin = "http://127.0.0.1:3000") => new NextRequest("http://127.0.0.1:3000/api/issues", { method: "POST", headers: { host: "127.0.0.1:3000", origin, cookie: `${SESSION_COOKIE}=${createSession()}`, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(body) });
  try {
    assert.equal((await GET(new NextRequest("http://localhost/api/issues"))).status, 401);
    assert.equal((await POST(request({}, "https://foreign.example"))).status, 403);
    assert.equal((await POST(request({ action: "intake", workspaceId: "foreign" }))).status, 403);
    assert.equal((await POST(request({ action: "context", issueId: "ISS-014", revision: 1, answer: "Customer clarifies expected behavior" }))).status, 200);
    assert.equal((await POST(request({ action: "context", issueId: "ISS-014", revision: 1, answer: "Stale write" }))).status, 409);
    const store = caseStore();
    const issue = store.snapshot().issues[0];
    store.execute({ action: "proposal", issueId: issue.id, revision: issue.revision, kind: "outreach", recipient: "northstar@example.invalid", text: "Hello, please retry the workflow." }, randomUUID());
    const proposal = store.snapshot().proposals.at(-1)!;
    process.env.ELEVENLABS_API_KEY = "private-test-api-key";
    process.env.ELEVENLABS_VOICE_ID = "testVoice";
    let providerCalls = 0;
    globalThis.fetch = async (_url, options) => {
      providerCalls++;
      assert.deepEqual(JSON.parse(options?.body as string), { text: proposal.text, model_id: "eleven_multilingual_v2" });
      return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
    };
    assert.equal((await audio(request({ proposalId: proposal.id, consent: false }))).status, 400);
    assert.equal((await audio(request({ proposalId: proposal.id, consent: true }))).status, 409);
    assert.equal(providerCalls, 0);
    store.execute({ action: "approve", issueId: issue.id, revision: issue.revision, proposalId: proposal.id }, randomUUID());
    const preview = await audio(request({ proposalId: proposal.id, consent: true }));
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "audio/mpeg");
    assert.equal(preview.headers.get("cache-control"), "no-store");
    assert.equal(providerCalls, 1);
    assert.equal(store.snapshot().outcomes.length, 0);
    globalThis.fetch = async () => {
      store.execute({ action: "context", issueId: issue.id, revision: issue.revision, answer: "New contradictory evidence during generation" }, randomUUID());
      return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
    };
    assert.equal((await audio(request({ proposalId: proposal.id, consent: true }))).status, 409);
    assert.equal(store.snapshot().proposals.at(-1)!.status, "stale");
  } finally {
    globalThis.fetch = originalFetch;
    caseStore().close();
    for (const [name, value] of Object.entries({ RELAY_WORKSPACE_PASSWORD: saved.password, RELAY_DB_PATH: saved.path, ELEVENLABS_API_KEY: saved.key, ELEVENLABS_VOICE_ID: saved.voice })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    rmSync(directory, { recursive: true, force: true });
  }
});
