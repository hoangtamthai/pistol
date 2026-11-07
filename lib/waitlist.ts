import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CaseError, object } from "./issues";

const MAX_EMAIL_LENGTH = 254;
const MAX_HOURLY_SIGNUPS = 100;
const HOUR_MS = 60 * 60 * 1000;

export function joinWaitlist(input: unknown, path = process.env.CONTEXT_WAITLIST_DB_PATH || "data/waitlist.sqlite") {
  const { email } = object(input);
  if (typeof email !== "string" || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new CaseError("Enter a valid email address, then try again.");
  }
  const normalizedEmail = email.trim().toLowerCase();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // shortcut: local SQLite requires persistent disk; use hosted storage before a serverless or multi-instance deployment.
  const db = new DatabaseSync(path);
  try {
    chmodSync(path, 0o600);
    db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, created_at INTEGER NOT NULL);");
    db.exec("BEGIN IMMEDIATE");
    const existing = db.prepare("SELECT 1 FROM waitlist WHERE email = ?").get(normalizedEmail);
    if (!existing) {
      const now = Date.now();
      const recent = db.prepare("SELECT COUNT(*) AS total FROM waitlist WHERE created_at > ?").get(now - HOUR_MS)!;
      if (Number(recent.total) >= MAX_HOURLY_SIGNUPS) throw new CaseError("The waitlist is busy. Please try again in an hour.", 429);
      db.prepare("INSERT INTO waitlist (email, created_at) VALUES (?, ?)").run(normalizedEmail, now);
    }
    db.exec("COMMIT");
  } finally {
    db.close();
  }
}
