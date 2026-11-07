"use client";

import { useState } from "react";
import Link from "next/link";

export default function WorkspaceLogin({ configured }: { configured: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="case-login"><span className="eyebrow">RELAY · LOCAL WORKSPACE</span><h1>Evidence first.<br />Decisions together.</h1><p>Sign in to the persistent customer issue workspace. One local operator, one workspace, SQLite on this machine.</p>{!configured && <div className="case-notice"><strong>One-time setup required</strong><p>Set <code>RELAY_WORKSPACE_PASSWORD</code> to a unique password of at least 16 characters in <code>.env.local</code>, then restart the app. There is no default password.</p></div>}<form onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    const password = new FormData(event.currentTarget).get("password");
    try {
      const response = await fetch("/api/workspace/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign("/issues");
    } catch (error) { setError(error instanceof Error ? error.message : "Sign-in failed. Try again."); }
    finally { setBusy(false); }
  }}><label>Workspace password<input name="password" type="password" required maxLength={1000} autoComplete="current-password" /></label><button className="button button-primary" disabled={busy || !configured}>{busy ? "Signing in…" : "Open workspace"}</button><p role="alert">{error}</p></form><Link className="text-button" href="/demo">Explore the original synthetic decision demo instead →</Link><p className="small">Local MVP, not production-ready. Use sanitized test data only. Jira and delivery are simulations; no real customers are contacted.</p></main>;
}
