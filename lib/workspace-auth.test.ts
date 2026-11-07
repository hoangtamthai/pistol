import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { authConfigured, createSession, passwordMatches, readJson, requireOrigin, requireSession, SESSION_COOKIE, validSession } from "./workspace-auth";
import { POST as signIn } from "../app/api/workspace/session/route";

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

test("four-letter passwords can sign in without special characters, but shorter passwords cannot", async () => {
  const original = process.env.RELAY_WORKSPACE_PASSWORD;
  const request = (password: string) => new NextRequest("http://localhost/api/workspace/session", { method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  try {
    process.env.RELAY_WORKSPACE_PASSWORD = "test";
    assert.equal(authConfigured(), true);
    assert.equal(passwordMatches("test"), true);
    assert.equal(passwordMatches("fail"), false);
    assert.equal(validSession(createSession()), true);
    const response = await signIn(request("test"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/i);
    assert.deepEqual(await response.json(), { signedIn: true });
    assert.equal((await signIn(request("fail"))).status, 401);
    process.env.RELAY_WORKSPACE_PASSWORD = "abc";
    assert.equal(authConfigured(), false);
    assert.equal(passwordMatches("abc"), false);
    assert.throws(() => createSession(), /at least 4 characters/);
    assert.equal((await signIn(request("abc"))).status, 401);
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
