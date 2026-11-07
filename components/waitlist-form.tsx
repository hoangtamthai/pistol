"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import styles from "@/app/landing.module.css";

export default function WaitlistForm() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    const email = new FormData(event.currentTarget).get("email");
    setState("submitting");
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "We couldn’t save your email. Please try again.");
      }
      setState("success");
    } catch (error) {
      setError(error instanceof Error && error.name === "Error" ? error.message : "We couldn’t connect. Please try again in a moment.");
      setState("error");
    }
  }

  return <div aria-live="polite" aria-atomic="true">
    {state === "success" ? <div className={styles.success} role="status"><Check size={23} aria-hidden="true" /><strong>You’re on the list.</strong><p>We’ll email you when early access is available.</p></div> : <form onSubmit={submit} aria-label="Join the waitlist" aria-busy={state === "submitting"}>
      <label className={styles.formLabel} htmlFor="waitlist-email">Your email</label>
      <div className={styles.formRow}>
        <input id="waitlist-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254} aria-describedby={error ? "waitlist-error waitlist-note" : "waitlist-note"} readOnly={state === "submitting"} />
        <button type="submit" className={styles.primaryButton} disabled={state === "submitting"}>{state === "submitting" ? "Joining…" : "Join waitlist"}<ArrowRight size={15} aria-hidden="true" /></button>
      </div>
      <p className={styles.formNote} id="waitlist-note">Early access, not extra noise. Only emails about Context’s launch.</p>
      {error && <p id="waitlist-error" className={`${styles.formMessage} ${styles.error}`} role="alert">{error}</p>}
    </form>}
  </div>;
}
