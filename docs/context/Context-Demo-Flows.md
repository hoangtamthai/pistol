# Context — demo flows and presenter instructions

## Before demonstrating

Run this repository with `npm run dev` and open `/context` on the printed address. Use a desktop browser, 1180px or wider and at least 700px tall. The app remembers progress, so select a scenario and click **Restart this scenario** before a fresh take.

**Play demo** advances the scripted workflow. **Next** advances one step for precise presenting. Click a card for details. Opening details pauses playback.

Everything is simulated: contact records, calls, checks, orders, Jira tickets, repository changes, deployments and customer replies. The frontend's playback and approval/confirmation gates are interactive.

## Flow 1: founder away, two parallel cases

```text
Amazon review → customer context → replacement proposal ─┐
                                                       ├→ separate approvals → execution → customer confirmation
CV-upload ticket → diagnostic context → proposed PR ────┘
```

### The story

While the founder is at the gym, two unrelated problems arrive. Emma reports a damaged machine on Amazon. Alex submits a support ticket because CV upload fails.

The customer-care agent uses a verified existing contact, clarifies the damage and preference, checks the order and policy, and prepares a replacement proposal. The engineering agent clarifies the upload issue, connects diagnostic evidence to a release and candidate code change, and prepares a sample PR.

The founder gets two approval summaries. Execution follows the approvals. Customer-confirmed recovery happens later.

### Exact presenter clicks

1. Select **Founder overview** and restart the scenario.
2. Show the Amazon review and support-ticket cards. Click **Play demo**, or click **Next** three times.
3. Playback stops at **Review 2 decisions**. The replacement and PR are prepared; neither has executed.
4. Optional: click **Clarify & verify** to show the sample customer-call transcript. Close it.
5. Click **Review 2 decisions** to open the WhatsApp-style inbox.
6. Click **Approve replacement**. Point out that the PR is still pending.
7. Click **Review pull request**. Show the patch, sample checks, owner, effort and schedule tradeoff.
8. Select **I reviewed the sample patch, checks and delivery tradeoff.** Click **Approve fix**.
9. Both approvals are now recorded. Click **Continue demo** to simulate fulfillment and deployment.
10. Playback stops at **Simulate confirmations**. The cases are awaiting customer verification.
11. Click **Simulate confirmations**. Only now are the replacement and upload outcomes customer-confirmed.

### What the audience should understand

- Two agents work on different kinds of problem in parallel.
- The founder reviews concise decisions with evidence.
- Approving one case does not approve the other.
- Approval does not instantly make either problem solved.

## Flow 2: a complete customer issue lifecycle

```text
Report → clarify → assign/prioritize → investigate → prepare PR
                                                            ↓
Confirmed recovery ← customer follow-up ← verified deployment ← human review
```

### The story

Alex cannot upload a CV. A customer agent collects missing reproduction details through ticket comments. The case becomes an owned, prioritized ticket with related reports linked. Engineering investigates the trace, release and suspected code change, prepares a sample fix, and asks for human review.

After approval, a sample deployment record shows that the change reached the affected environment. The team prepares a customer update in the preferred channel and asks Alex to retry. The case closes only after an explicit customer confirmation.

### Exact presenter clicks

1. Select **Issue lifecycle** and restart that scenario.
2. Use **Next** to advance to **Clarifying the issue**. Open **Collect context** to show the ticket conversation. Close it.
3. Advance to **Owned and prioritized**. Open **Assign & prioritize** to show owner, priority and related reports. Routing can be saved locally.
4. Advance to **Technical investigation**. Open **Trace the failure** to inspect the sample trace, deployed release and candidate commit. Close it.
5. Advance through **Fix prepared** to **Human review**. Playback stops at **Review fix**.
6. Click **Review fix**, inspect the proposed patch and sample checks, acknowledge the review, and click **Approve fix**.
7. The state is approved with execution pending. Click **Continue demo**.
8. The demo shows sample deployment verification and stops at **Simulate customer reply**.
9. Open **Update the customer**. Show the email preview and optional **Call script** tab. Explain the suggested channel and operational/commercial context. Close it.
10. Click **Simulate customer reply**. The final state is **Recovery confirmed**.

### What the audience should understand

- Context is collected before proposing a specific fix.
- There is an explicit owner and priority.
- Reports, symptoms and candidate causes remain distinct.
- Two related tickets from the same account do not double the account count or revenue.
- The reviewer sees evidence, a proposed change and delivery consequences.
- Deployment and customer recovery are separately verified.

## Guardrails worth showing once

| Attempt | Expected behavior |
|---|---|
| Continue with an approval missing | The workflow remains at the decision gate |
| Approve the PR without acknowledgment | A review message appears; approval is not recorded |
| Treat replacement approval as technical approval | The technical decision remains pending |
| Continue without a customer reply | Playback stops at the confirmation step |
| Switch scenarios during playback | Playback pauses and each scenario retains its own progress |
| Restart one scenario | Only that scenario resets |

## Short presenter narration

**Founder overview:** “Two cases arrive while I’m away. Each agent collects the relevant context and prepares a different action. I receive two decisions, approve them separately, and can see what happened afterward. The cases close only when the customers confirm recovery.”

**Issue lifecycle:** “Here is the same process in detail: customer clarification, an owned ticket, technical evidence, a proposed patch, human review, deployment verification and a customer update. The important result is a confirmed customer outcome, with the evidence and decisions connected along the way.”

For the timed two-minute pitch, use the included **Context-2-Minute-Video-Guide.md**.
