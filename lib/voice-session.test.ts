import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/voice/session/route";

test("voice configuration exposes readiness, never server credentials", async () => {
  const originalKey = process.env.ELEVENLABS_API_KEY;
  const originalAgent = process.env.ELEVENLABS_AGENT_ID;
  try {
    process.env.ELEVENLABS_API_KEY = "private-test-key";
    process.env.ELEVENLABS_AGENT_ID = "private-test-agent";
    const response = await GET();
    assert.deepEqual(await response.json(), { configured: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
    delete process.env.ELEVENLABS_API_KEY;
    assert.deepEqual(await (await GET()).json(), { configured: false });
  } finally {
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
    if (originalAgent === undefined) delete process.env.ELEVENLABS_AGENT_ID;
    else process.env.ELEVENLABS_AGENT_ID = originalAgent;
  }
});

test("token endpoint rejects cross-origin and missing-origin requests", async () => {
  for (const origin of [undefined, "https://untrusted.example"]) {
    const request = new NextRequest("http://localhost:3000/api/voice/session", { method: "POST", headers: origin ? { origin } : {} });
    assert.equal((await POST(request)).status, 403);
  }
});

test("missing configuration returns an actionable error without upstream calls", async () => {
  const originalKey = process.env.ELEVENLABS_API_KEY;
  try {
    delete process.env.ELEVENLABS_API_KEY;
    const request = new NextRequest("http://localhost:3000/api/voice/session", { method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } });
    const response = await POST(request);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /\.env.local/);
  } finally {
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
  }
});

test("upstream tokens, errors, and rate limits are handled without leaking the key", async () => {
  const originalKey = process.env.ELEVENLABS_API_KEY;
  const originalAgent = process.env.ELEVENLABS_AGENT_ID;
  const originalFetch = globalThis.fetch;
  const request = () => new NextRequest("http://localhost:3000/api/voice/session", { method: "POST", headers: { origin: "http://localhost:3000" } });
  try {
    process.env.ELEVENLABS_API_KEY = "private-test-key";
    process.env.ELEVENLABS_AGENT_ID = "agent_test";
    globalThis.fetch = async (input, options) => {
      assert.match(String(input), /agent_id=agent_test/);
      assert.equal((options?.headers as Record<string, string>)["xi-api-key"], "private-test-key");
      return Response.json({ token: "session-only-token" });
    };
    const success = await POST(request());
    assert.deepEqual(await success.json(), { token: "session-only-token" });
    assert.equal(success.headers.get("cache-control"), "no-store");
    globalThis.fetch = async () => new Response("private upstream error", { status: 401 });
    const denied = await POST(request());
    assert.equal(denied.status, 502);
    assert.doesNotMatch(await denied.text(), /private upstream error|private-test-key/);
    globalThis.fetch = async () => Response.json({ token: 123 });
    assert.equal((await POST(request())).status, 502);
    globalThis.fetch = async () => { throw new Error("network error with sensitive internals"); };
    const unreachable = await POST(request());
    assert.equal(unreachable.status, 502);
    assert.doesNotMatch(await unreachable.text(), /sensitive internals/);
    globalThis.fetch = async () => Response.json({ token: "session-only-token" });
    await POST(request());
    await POST(request());
    assert.equal((await POST(request())).status, 429);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
    if (originalAgent === undefined) delete process.env.ELEVENLABS_AGENT_ID;
    else process.env.ELEVENLABS_AGENT_ID = originalAgent;
  }
});
