# Context — two-minute pitch and demo video

## What to give Claude

1. Paste the prompt below into Claude.
2. Add the five screenshots from `screenshots`, or upload short screen recordings of the same screens. The screenshots are actual captures of the frontend.
3. Record the integrated demo at `/context` on this app's address. For local development, use the port printed by `npm run dev`. The original screenshots remain in `Context-UI-Handoff.zip`.

A local app is not accessible to an external editor. Use the supplied captures or your recordings instead of assuming it has access. No public deployment is provided by this handoff. Do not include credentials.

For a moving product demo, record the interactions first. Claude can prepare the script, shot list, captions and editing instructions. If your Claude environment has coding/video-rendering tools, ask it to assemble a video project and render the MP4; otherwise use its edit instructions in your video editor. A chat response alone is not an exported video.

## Ready-to-paste Claude prompt

You are a startup pitch producer and product-demo editor. Create a polished, exactly 120-second pitch/demo for **Context**, using the attached frontend screenshots or screen recordings. Use English narration and captions.

### Product

Context coordinates customer problems from first report to customer-confirmed recovery. It gathers missing context, links related reports and technical evidence, suggests an owner and action, prepares changes for review, and tracks follow-up.

The attached frontend demonstrates two scripted scenarios:

- **Founder overview:** while the founder is away, a damaged-product Amazon review and a CV-upload support ticket arrive. A customer agent uses an existing verified contact to clarify damage and propose a €79 replacement. An engineering agent collects diagnostic context and prepares sample PR #184. A WhatsApp-style approval inbox presents the two decisions. Execution and customer confirmation are separate later steps.
- **Issue lifecycle:** CV-upload report → clarification → ownership/priority → trace/release/candidate commit → sample PR → human approval → sample deployment → email or call-script follow-up → explicit customer confirmation.

### Accuracy constraints

- This is an interactive frontend prototype with scripted sample data. Calls, WhatsApp messages, refunds, replacements, Jira tickets, repository changes, tests and deployments are simulated.
- The frontend’s playback, separate approvals and confirmation gates work. External integrations are not connected.
- Label demo footage **“Prototype · simulated workflow”** in a small readable corner caption. Do not obscure or crop away the app’s simulation labels to imply live integrations.
- Do not invent traction, interviews, revenue saved, customer retention, market size, deployment results or team credentials.
- A public review does not provide a phone number: the sample uses an existing verified order/support contact.
- Associated account revenue is not predicted loss. Approval is not deployment, and deployment is not customer-confirmed resolution.
- Pricing and target-customer statements are hypotheses for testing, not validated results.

### Required 120-second structure

| Time | Story | Visual |
|---|---|---|
| 00:00–00:12 | Customer problems continue while the founder is away | Short opening title and the two inbound cases |
| 00:12–00:22 | Explain Context in one sentence | Founder overview, full screen |
| 00:22–00:54 | Show parallel context collection and two founder decisions | Customer-call transcript, agent lanes, approval inbox |
| 00:54–01:28 | Show the technical lifecycle and evidence-based review | Issue lifecycle, ticket routing, candidate commit, sample PR and checks |
| 01:28–01:42 | Show follow-up and confirmed recovery | Email/call-script preview; explicit simulated customer reply; final state |
| 01:42–02:00 | Present the initial customer/business hypothesis and ask for pilots | Clean product end card; no invented numbers |

### Visual and editing direction

- Desktop, 16:9, 1920×1080, 30 fps; export H.264 MP4 if rendering is available.
- Match the product’s light interface: white/pale gray, navy text, restrained blue actions, amber approval states and green confirmed outcomes.
- Keep real UI readable. Use deliberate crop-ins on the call transcript, approval buttons, code diff and confirmation state. Avoid zooming every shot.
- Use clean cuts and short transitions. No stock AI robots, glowing brains, purple gradients, unnecessary 3D effects or excessive motion.
- Keep on-screen headlines short, usually 4–7 words. Add readable subtitles and leave room around UI controls.
- Use a calm, confident human delivery. Target roughly 235–255 spoken words, leaving room for interaction pauses. Background music is optional and must stay below the voice.

### Deliverables

1. A timed storyboard whose durations sum to exactly 120 seconds.
2. A complete narration script with word count and scene timestamps.
3. On-screen text and captions, plus SRT if supported.
4. A precise screen-recording/edit list using the actual controls below.
5. If video tools are available: the editable video project and rendered MP4. If not, provide the project or editing handoff and exact remaining steps. Never claim an MP4 was exported unless it exists.

Use the baseline narration below as a starting point. Tighten it to the timing without adding unsupported claims.

## Baseline narration

### 00:00–00:12

You’re at the gym when two customers need help. One received a damaged product. Another cannot upload a CV. Their problems arrive through different channels.

### 00:12–00:22

Context connects each report to the missing information, responsible owner, proposed action, and customer outcome. Here is the experience we are testing.

### 00:22–00:54

In the founder view, two agents work in parallel. Customer care uses a verified contact to understand the damage and prepare a replacement. Engineering asks for the upload details, investigates the error, and prepares a proposed fix. The founder receives two concise decisions, with supporting evidence. Approve the replacement. Review the patch and checks. Then approve the fix. Execution follows approval; customer recovery remains a separate step.

### 00:54–01:28

The second view follows one issue in detail. The customer agent collects reproduction steps. The case is assigned to the responsible team and linked to related reports. Engineering connects the trace to the deployed release and a candidate commit, then prepares a sample pull request. The reviewer sees the patch, checks, estimated effort, and schedule tradeoff before deciding. These workflows and integration records are simulated in this frontend prototype.

### 01:28–01:42

After the sample deployment, the team prepares an update in the customer’s preferred channel. The case closes only when the customer confirms that the original workflow works again.

### 01:42–02:00

Our initial customer hypothesis is small support teams coordinating with engineering. We plan to test a workspace subscription through paid pilots. We’re looking for teams willing to try Context on anonymized customer issues.

## Exact screen-recording instructions

Record clean takes in a desktop browser at 100% zoom. Use a 16:9 recording area. Hide unrelated tabs and private notifications. Pause 1–2 seconds before and after each interaction so the edit has room.

### Take A: founder overview

1. Select **Founder overview**. Click **Restart this scenario** to start from fresh data.
2. Record the two new cases, then click **Play demo**. It stops at **Review 2 decisions**.
3. Optional insert: open **Clarify & verify** to show the sample customer-call transcript, then close it.
4. Click **Review 2 decisions**. Record the WhatsApp-style inbox.
5. Click **Approve replacement**. Show that the technical case is still pending.
6. Click **Review pull request**. Record the sample patch, checks and tradeoff. Check the review acknowledgment, then click **Approve fix**.
7. Click **Continue demo**. Playback stops at **Simulate confirmations**. Record the pending-confirmation state, then click it to show the confirmed outcomes.

### Take B: issue lifecycle

1. Select **Issue lifecycle** and restart that scenario.
2. Use **Next** for precise recording, or **Play demo** for automatic progression. Click cards to open supporting details; opening a card pauses playback.
3. Record **Collect context**, **Assign & prioritize**, and **Trace the failure**. Close each detail view before advancing.
4. Advance to **Review fix**. Record the proposed PR. Acknowledge and approve it.
5. Click **Continue demo**. Playback stops at **Simulate customer reply**.
6. Open **Update the customer**. Record the email preview and optional **Call script** tab. Close the detail view.
7. Click **Simulate customer reply** and record **Recovery confirmed**.

Do not spend the video reading every field. Use the recording to show context, a concrete human decision, and verified follow-through.

## Supplied screenshot assets

- `01-founder-overview.jpg` — two parallel cases at the approval point.
- `02-issue-lifecycle.jpg` — the technical lifecycle at human review.
- `03-founder-approval-inbox.jpg` — WhatsApp-style decision summaries.
- `04-pull-request-review.jpg` — sample patch, checks and tradeoff.
- `05-confirmed-outcomes.jpg` — customer-confirmed final states.

Screenshots can support a storyboard or animated fallback. Prefer actual recordings for interactive product claims. No video or voiceover has been rendered as part of this guide.
