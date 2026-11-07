import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/waitlist/route";
import { joinWaitlist } from "./waitlist";

test("waitlist validates, persists, deduplicates, protects email data, and bounds new signups", () => {
  const directory = mkdtempSync(join(tmpdir(), "context-waitlist-"));
  const path = join(directory, "waitlist.sqlite");
  try {
    for (const input of [null, {}, { email: 1 }, { email: "" }, { email: "a@b" }, { email: "a b@example.com" }, { email: `${"a".repeat(255)}@example.com` }]) {
      assert.throws(() => joinWaitlist(input, path));
    }
    joinWaitlist({ email: " Person@Example.com " }, path);
    joinWaitlist({ email: "person@example.com" }, path);
    const db = new DatabaseSync(path);
    try {
      assert.equal(db.prepare("SELECT COUNT(*) AS total FROM waitlist").get()!.total, 1);
      assert.equal(db.prepare("SELECT email FROM waitlist").get()!.email, "person@example.com");
      assert.equal(statSync(path).mode & 0o777, 0o600);
      for (let index = 1; index < 100; index++) joinWaitlist({ email: `person${index}@example.com` }, path);
      assert.throws(() => joinWaitlist({ email: "overflow@example.com" }, path), /try again in an hour/);
      joinWaitlist({ email: "person@example.com" }, path);
      db.prepare("UPDATE waitlist SET created_at = 0").run();
      joinWaitlist({ email: "next-hour@example.com" }, path);
      assert.equal(db.prepare("SELECT COUNT(*) AS total FROM waitlist").get()!.total, 101);
    } finally { db.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("public waitlist API enforces origin and body limits without requiring a session", async () => {
  const directory = mkdtempSync(join(tmpdir(), "context-waitlist-api-"));
  const savedPath = process.env.CONTEXT_WAITLIST_DB_PATH;
  process.env.CONTEXT_WAITLIST_DB_PATH = join(directory, "api.sqlite");
  const request = (body: string, origin = "http://127.0.0.1:3000", contentType = "application/json") => new NextRequest("http://127.0.0.1:3000/api/waitlist", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", origin, "Content-Type": contentType },
    body,
  });
  try {
    const body = JSON.stringify({ email: "hello@example.com" });
    const response = await POST(request(body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await POST(request(body))).status, 200);
    assert.equal((await POST(request(body, "https://foreign.example"))).status, 403);
    assert.equal((await POST(request(body, ""))).status, 403);
    assert.equal((await POST(request("not json"))).status, 400);
    assert.equal((await POST(request('{"email":"invalid"}'))).status, 400);
    assert.equal((await POST(request(body, undefined, "text/plain"))).status, 415);
    assert.equal((await POST(request("x".repeat(20_001)))).status, 413);
    process.env.CONTEXT_WAITLIST_DB_PATH = directory;
    const failedWrite = await POST(request(body));
    assert.equal(failedWrite.status, 500);
    assert.match((await failedWrite.json()).error, /try again/);
  } finally {
    if (savedPath === undefined) delete process.env.CONTEXT_WAITLIST_DB_PATH;
    else process.env.CONTEXT_WAITLIST_DB_PATH = savedPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
