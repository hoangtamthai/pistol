import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { createSession, passwordMatches, readJson, requireOrigin, requireSession, SESSION_COOKIE, validSession } from "./workspace-auth";

test("workspace sessions expire, reject forgery, and rotate with the password", () => {
  const original = process.env.RELAY_WORKSPACE_PASSWORD;
  try {
    delete process.env.RELAY_WORKSPACE_PASSWORD;
    assert.equal(validSession("anything"), false);
    assert.throws(() => createSession(), /RELAY_WORKSPACE_PASSWORD/);
    process.env.RELAY_WORKSPACE_PASSWORD = "test-only-strong-local-password";
    assert.equal(passwordMatches("wrong"), false);
    assert.equal(passwordMatches(process.env.RELAY_WORKSPACE_PASSWORD), true);
    const token = createSession();
    assert.equal(validSession(token), true);
    assert.equal(validSession(token + "forged"), false);
    assert.equal(validSession(token, Date.now() + 9 * 60 * 60 * 1000), false);
    const request = new NextRequest("http://localhost/api/issues", { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
    assert.doesNotThrow(() => requireSession(request));
    assert.throws(() => requireSession(new NextRequest("http://localhost/api/issues")), /Sign in/);
    process.env.RELAY_WORKSPACE_PASSWORD = "a-different-strong-local-password";
    assert.equal(validSession(token), false);
  } finally { if (original === undefined) delete process.env.RELAY_WORKSPACE_PASSWORD; else process.env.RELAY_WORKSPACE_PASSWORD = original; }
});

test("CSRF rejects missing or foreign origin and accepts exact loopback host", () => {
  for (const origin of [undefined, "https://foreign.example"]) assert.throws(() => requireOrigin(new NextRequest("http://localhost:3000/api/issues", { headers: origin ? { origin } : {} })), /own browser/);
  assert.doesNotThrow(() => requireOrigin(new NextRequest("http://localhost:3000/api/issues", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } })));
});

test("JSON boundary rejects malformed, oversized and non-JSON bodies", async () => {
  const request = (body: string, contentType = "application/json") => new Request("http://localhost", { method: "POST", headers: { "Content-Type": contentType }, body });
  assert.deepEqual(await readJson(request('{"ok":true}')), { ok: true });
  await assert.rejects(readJson(request("not-json")), /Invalid JSON/);
  await assert.rejects(readJson(request("{}", "text/plain")), /application\/json/);
  await assert.rejects(readJson(request(JSON.stringify({ text: "x".repeat(20001) }))), /20 KB/);
});
