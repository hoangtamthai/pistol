"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConversationProvider } from "@elevenlabs/react";
import { ArrowRight, ArrowUpRight, AudioLines, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleCheck, CircleDot, Clock3, Copy, ExternalLink, FileText, Flag, GitBranch, Inbox, Layers3, Lightbulb, Link2, MessageSquare, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Users, Workflow, X } from "lucide-react";
import VoicePanel from "./voice-panel";
import { accounts, customerDraft, matchRequests, shortDate, sources, timeline, updateOutcome, type Language, type Option, type Outcome, type Source, type Tab } from "@/lib/demo";

type ModalName = "intake" | "sources" | "setup" | null;
const impact = matchRequests("audit-export");
const emptyOutcome = (): Outcome => ({ released: false, notified: false, confirmed: false });
const initialOutcomes = () => Object.fromEntries(accounts.map(account => [account.id, emptyOutcome()]));
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "brand-small" : ""}`}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>{!small && <span>relay<span className="brand-period">.</span></span>}</span>;
}

function SourceIcon({ kind, size = 16 }: { kind: Source["kind"]; size?: number }) {
  if (kind === "slack") return <span className="slack-mark" style={{ fontSize: size + 5 }} aria-label="Slack">#</span>;
  if (kind === "linear") return <CircleDot size={size} />;
  if (kind === "contract") return <FileText size={size} />;
  return <BookOpen size={size} />;
}

function Modal({ title, description, children, close, wide = false }: { title: string; description?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]');
      if (!focusable?.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}><div className={`modal ${wide ? "modal-wide" : ""}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={description ? "modal-description" : undefined} tabIndex={-1}><div className="modal-heading"><div><p className="eyebrow">RELAY WORKSPACE</p><h2 id="modal-title">{title}</h2>{description && <p id="modal-description" className="muted">{description}</p>}</div><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20} /></button></div>{children}</div></div>;
}

export default function Workspace() {
  const [tab, setTab] = useState<Tab>("brief");
  const [option, setOption] = useState<Option>("workaround");
  const [comparison, setComparison] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [draft, setDraft] = useState(customerDraft("workaround", "en"));
  const [approved, setApproved] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(initialOutcomes);
  const [reviewAccount, setReviewAccount] = useState<string | null>(null);
  const [followupDraft, setFollowupDraft] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [toast, setToast] = useState("");
  const [matched, setMatched] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const allReleased = accounts.every(account => outcomes[account.id].released);
  const resolvedCount = accounts.filter(account => outcomes[account.id].confirmed).length;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!mobileNav) return;
    const previous = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileNav(false); };
    document.addEventListener("keydown", handleEscape);
    return () => { document.removeEventListener("keydown", handleEscape); previous?.focus(); };
  }, [mobileNav]);

  function chooseOption(next: Option) {
    if (next === option) return;
    setOption(next);
    setDraft(customerDraft(next, language));
    setApproved(false);
  }

  function chooseLanguage(next: Language) {
    setLanguage(next);
    setDraft(customerDraft(option, next));
    setApproved(false);
  }

  function openSource(id: string) {
    const found = sources.find(item => item.id === id);
    if (!found) { setToast("That source is not part of this sample brief."); return; }
    setModal(null);
    setSource(found);
  }

  function showComparison() {
    setTab("brief");
    setComparison(true);
    setShowAssumptions(true);
  }

  function resetDemo() {
    setTab("brief"); setOption("workaround"); setComparison(false); setLanguage("en");
    setDraft(customerDraft("workaround", "en")); setApproved(false); setOutcomes(initialOutcomes());
    setMatched(false); setModal("intake"); setShowAssumptions(false); setMobileNav(false);
    setToast("Demo reset. Start with the incoming customer request.");
  }

  async function copyText(text: string, success: string) {
    try { await navigator.clipboard.writeText(text); setToast(success); }
    catch { setToast("Clipboard access is unavailable. You can select and copy the text manually."); }
  }

  function shareBrief() {
    copyText(`RELAY · SYNTHETIC DEMO · April 14, 2026\n\nProblem: Audit exports stop at 10,000 events.\nEvidence: ${sources.map(item => `${item.id}: ${item.title}`).join("; ")}\nImpact: 3 accounts, $148,000 associated ARR. Only Northstar ($72,000 ARR) explicitly links this issue to renewal approval; loss probability and amount are unknown.\nRecommendation: Approved assisted export now, Maya Patel (CS); permanent-fix scoping, Jordan Lee (Platform).\nWorkaround: estimated 0.5–1 CS working day per account; consent and secure transfer required.\nPermanent fix: 3–5 person-days. With one engineer from Apr 20, estimated Apr 22–24; SSO moves from Apr 24 to Apr 29–May 1. Assumes available dependencies, sequential work, Monday–Friday, no holidays or interruptions. Not a commitment.\nSelected for review: ${option}. No roadmap approval or external send.\nUnknowns: monetary and maintenance costs, revenue loss probability, confirmed delivery date, actual commercial gain.`, "Decision brief copied, including assumptions and sample-data disclosure.");
  }

  function simulateRelease() {
    setOutcomes(current => Object.fromEntries(Object.entries(current).map(([id, outcome]) => [id, updateOutcome(outcome, "release")])));
    setToast("Simulated ENG-214 release. Three follow-up drafts prepared; no customers notified.");
  }

  function reviewFollowup(accountId: string) {
    setReviewAccount(accountId);
    setReviewed(false);
    const account = accounts.find(item => item.id === accountId)!;
    setFollowupDraft(`Hi ${account.name} team,\n\nThe audit-export pagination fix has been released in this demo scenario. Please try a complete export and let us know whether the full event history is now available.\n\nWe’ll keep this request open until you confirm it’s resolved.\n\nBest,\nMaya`);
  }

  const evidenceButton = (id: string, label?: string) => <button className="inline-source" onClick={() => openSource(id)}><Link2 size={11} />{label || id}<ArrowUpRight size={10} /></button>;
  const filteredSources = sources.filter(item => `${item.title} ${item.location} ${item.excerpt}`.toLowerCase().includes(sourceFilter.toLowerCase()));
  const screenContext = JSON.stringify({ tab, selectedOption: option, draftApproved: approved, outcomes, note: "State is session-only; no external send or roadmap write is available." });

  return <ConversationProvider><a className="skip-link" href="#main-content">Skip to decision brief</a><div className="app-shell">
    <aside id="workspace-navigation" className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label="Workspace navigation">
      <div className="sidebar-brand"><Brand /><span className="beta-label">BETA</span><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <button className="workspace-switch" onClick={() => { setModal("setup"); setMobileNav(false); }}><span className="workspace-avatar">O</span><span>Orbit workspace<small>Customer operations</small></span><ChevronDown size={14} /></button>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="nav-list">
        <button onClick={() => { setModal("intake"); setMobileNav(false); }}><Inbox size={18} /><span>Signal inbox</span><span className="nav-count">5</span></button>
        <button className={tab !== "followups" ? "active" : ""} onClick={() => { setTab("brief"); setMobileNav(false); }} aria-current={tab !== "followups" ? "page" : undefined}><Layers3 size={18} /><span>Decisions</span><span className="nav-count">1</span></button>
        <button className={tab === "followups" ? "active" : ""} onClick={() => { setTab("followups"); setMobileNav(false); }} aria-current={tab === "followups" ? "page" : undefined}><CheckCheck size={18} /><span>Follow-through</span><span className="nav-count">{accounts.length - resolvedCount}</span></button>
        <button onClick={() => { setModal("sources"); setMobileNav(false); }}><BookOpen size={18} /><span>Sources</span><span className="nav-count">{sources.length}</span></button>
      </nav>
      <div className="sidebar-section-label decisions-label">PINNED DECISION<span>1</span></div>
      <button className="pinned-decision" onClick={() => { setTab("brief"); setMobileNav(false); }}><span className="tiny-dot" /><span>Audit export limit<small>3 accounts · Needs a decision</small></span></button>
      <div className="sidebar-bottom"><div className="demo-note"><span className="demo-note-icon"><Sparkles size={16} /></span><strong>Small signal. Bigger picture.</strong><p>Take the complete workflow<br />for a three-minute spin.</p><button onClick={resetDemo}>Replay the demo <ArrowUpRight size={14} /></button></div><button className="sidebar-settings" onClick={() => setModal("setup")}><Settings2 size={17} /> Voice & workspace setup</button><div className="user-profile"><span className="avatar avatar-maya">MP</span><div><strong>Maya Patel</strong><small>Customer Success Lead</small></div><span className="online-dot" /></div></div>
    </aside>

    <div className="workspace-main">
      <header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" aria-expanded={mobileNav} aria-controls="workspace-navigation"><Layers3 size={20} /></button><span className="breadcrumb-icon"><Layers3 size={16} /></span><button onClick={() => setTab("brief")}>Decisions</button><ChevronRight size={13} /><span>DEC-014</span></div><div className="topbar-right"><span className="sample-indicator"><span />Sample workspace</span><button className="button button-small" onClick={() => setModal("intake")}><Plus size={14} /> New request</button></div></header>
      <main id="main-content" className="main-content">
        <div className="page-topline"><div className="eyebrow"><span className="live-square" /> CUSTOMER SIGNAL → CLEAR DECISION</div><button className="text-button reset-button" onClick={resetDemo}><RotateCcw size={13} /> Replay demo</button></div>
        <div className="page-heading"><div><div className="heading-badges"><span className={`badge badge-amber`}><span className="tiny-dot" />{approved ? "Reply approved" : "Needs your decision"}</span><span className="decision-id">DEC-014</span></div><h1>A small export limit.<br /><span>A bigger customer problem.</span></h1><p className="page-description">Audit exports stop at 10,000 events. Three accounts need the full picture.<br className="desktop-break" /> One has a security review coming up, and a renewal on the line.</p></div><button className="button share-button" onClick={shareBrief}><Copy size={15} /> Copy brief</button></div>
        <div className="brief-meta"><span><span className="avatar avatar-maya avatar-xs">MP</span> Maya Patel <span className="muted">· CS owner</span></span><span className="meta-divider" /><span><Clock3 size={13} /> Apr 14, 2026 <span className="muted">· Demo snapshot</span></span><span className="meta-divider" /><span className="meta-grounded"><ShieldCheck size={13} /> Every claim has a trail</span></div>

        <div className="metrics-grid"><div className="metric"><span className="metric-label"><Users size={15} /> Affected accounts</span><div className="metric-value">{impact.accounts.length}<span className="metric-mini">unique accounts</span></div><p>Across {impact.requests.length} related Slack messages {evidenceButton("ticket-meridian-followup", "Deduplicated")}</p></div><div className="metric"><span className="metric-label"><GitBranch size={15} /> Associated ARR</span><div className="metric-value">$148<span className="metric-unit">k</span><span className="badge badge-neutral">Fact</span></div><p>Account value, not revenue at risk {evidenceButton("contract-register", "Register")}</p></div><div className="metric metric-blocker"><span className="metric-label"><Flag size={15} /> Explicit renewal blocker</span><div className="metric-value">1<span className="metric-mini">Northstar · $72k ARR</span></div><p>Loss amount & probability unknown {evidenceButton("slack-northstar", "Customer")}</p></div></div>

        <div className="tabs-row"><div className="tabs" role="tablist" aria-label="Decision workflow">{([{ id: "brief", title: "Decision brief", icon: FileText }, { id: "reply", title: "Customer reply", icon: MessageSquare }, { id: "followups", title: "Follow-through", icon: CheckCheck }] as const).map(item => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls="workflow-panel" tabIndex={tab === item.id ? 0 : -1} className={tab === item.id ? "tab active" : "tab"} onClick={() => setTab(item.id)} onKeyDown={event => { const tabs: Tab[] = ["brief", "reply", "followups"]; const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0; if (direction) { event.preventDefault(); const next = tabs[(tabs.indexOf(tab) + direction + tabs.length) % tabs.length]; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}><item.icon size={15} />{item.title}{item.id === "followups" && <span className="tab-count">3</span>}</button>)}</div><span className="tabs-note"><span className="status-dot green" /> {matched ? "Evidence connected" : "Sample brief preview"}</span></div>

        <div id="workflow-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
          {tab === "brief" && <div className="decision-layout"><div className="decision-column">
            <section className="recommendation-card"><div className="recommendation-top"><span className="recommendation-label"><Sparkles size={15} /> THE RECOMMENDATION</span><span className="badge badge-green">For your review</span></div><h2>Unblock the customer.<br />Don’t derail the roadmap.</h2><p>Offer the approved assisted export now. Give Northstar a path to its security review while Platform scopes a permanent fix.</p><div className="recommendation-reason"><Check size={14} /> A documented workaround exists <span>·</span> No engineering displacement</div><div className="recommendation-bottom"><span className="owner-pill"><span className="avatar avatar-maya avatar-xs">MP</span><strong>Maya</strong> <span>Customer Success</span></span>{evidenceButton("workaround", "Approved runbook")}</div></section>

            <section className="section-block options-section" id="solution-options"><div className="section-heading"><h2><GitBranch size={17} /> Two paths forward</h2><button className="text-button" onClick={() => { setComparison(value => !value); setShowAssumptions(true); }}>{comparison ? "Hide details" : "Compare tradeoffs"}<ArrowUpRight size={13} /></button></div><p className="section-description">One solves the immediate need. One removes the underlying limit.</p>
              <div className="option-grid" role="radiogroup" aria-label="Solution to review"><button role="radio" aria-checked={option === "workaround"} className={`option-card ${option === "workaround" ? "selected" : ""}`} onClick={() => chooseOption("workaround")}><div className="option-card-top"><span className="option-icon"><Lightbulb size={18} /></span><span className="radio-circle">{option === "workaround" && <span />}</span></div><span className="option-kicker">THE WORKAROUND <span>Recommended</span></span><h3>Assisted full export</h3><p>An authorized CS admin prepares a complete, securely shared export.</p><span className="option-owner">Owner: Maya Patel · Customer Success</span><div className="option-effort"><Clock3 size={13} /><strong>0.5–1 day</strong><span>CS effort / account</span></div><div className="option-footer"><span className="dot green" />No engineering displacement</div></button><button role="radio" aria-checked={option === "permanent"} className={`option-card ${option === "permanent" ? "selected" : ""}`} onClick={() => chooseOption("permanent")}><div className="option-card-top"><span className="option-icon"><Workflow size={18} /></span><span className="radio-circle">{option === "permanent" && <span />}</span></div><span className="option-kicker">THE PERMANENT FIX</span><h3>Paginated audit exports</h3><p>Remove the product limit with cursor pagination and regression tests.</p><span className="option-owner">Owner: Jordan Lee · Platform</span><div className="option-effort"><Clock3 size={13} /><strong>3–5 days</strong><span>engineering effort</span></div><div className="option-footer option-warning"><span className="dot amber" />Moves an existing milestone</div></button></div>
              {comparison && <div className="comparison-details"><div><strong>Workaround</strong><p>Requires customer consent and secure transfer. Repeats 0.5–1 day of CS effort for each account; does not remove the product limit. {evidenceButton("workaround", "Runbook")}</p></div><div><strong>Permanent fix</strong><p>Reusable product improvement, but consumes Platform capacity. Maintenance and monetary cost remain unknown. {evidenceButton("eng-214", "Engineering estimate")}</p></div><div className="comparison-unknown"><span className="badge badge-neutral">Unknown</span> Realized gain, dollar costs, and probability of commercial loss. Deferring avoids immediate work but leaves the blocker unresolved.</div></div>}
              <div className="selection-footnote"><ShieldCheck size={13} /><span>Selection is for review. It does not approve priority or commit a date.</span></div>
            </section>

            <section className="timeline-card"><div className="section-heading"><h2><GitBranch size={17} /> The delivery tradeoff</h2><span className="badge badge-blue">Estimate</span></div><p className="section-description">If the permanent fix goes next, something else moves.</p><div className="timeline-visual"><div className="timeline-label-row"><span>April 2026</span><span>May</span></div><div className="timeline-scale"><span>20</span><span>22</span><span>24</span><span>27</span><span>29</span><span>01</span></div><div className="timeline-lane"><span className="timeline-lane-label">Audit exports</span><div className="timeline-track"><div className="timeline-bar fix-bar"><span>3–5 person-days</span></div></div></div><div className="timeline-lane"><span className="timeline-lane-label">SSO improvements</span><div className="timeline-track"><div className="baseline-marker" title="Original milestone: April 24" /><div className="timeline-shift-arrow" aria-hidden="true">········→</div><div className="timeline-bar sso-bar"><span>+3–5 workdays</span></div></div></div></div><div className="timeline-summary"><span><span className="dot green" /><strong>Fix window</strong> {shortDate(timeline.earliest)}–24</span><span><span className="dot amber" /><strong>SSO moves</strong> Apr 24 <ArrowRight size={12} /> Apr 29–May 1</span></div><div className="timeline-assumptions"><button onClick={() => setShowAssumptions(value => !value)} aria-expanded={showAssumptions}><ShieldCheck size={13} /> Planning scenario, not a customer promise<ChevronDown size={14} className={showAssumptions ? "rotated" : ""} /></button>{showAssumptions && <p>One engineer available Apr 20. Sequential work, Monday–Friday, no holidays or interruptions; API review and dependencies assumed ready. Effort is not elapsed time. Capacity and dependencies must be revalidated before commitment. {evidenceButton("roadmap", "Capacity plan")}</p>}</div></section>
            <div className="next-step-card"><div><span className="eyebrow">NEXT, WITH A HUMAN IN THE LOOP</span><h3>Make the next conversation easier.</h3><p>Review a reply based on your selected option.</p></div><button className="button button-primary" onClick={() => setTab("reply")}>Review customer reply <ArrowRight size={15} /></button></div>
          </div><aside className="evidence-column" aria-label="Supporting evidence"><section className="evidence-card"><div className="section-heading"><h2><Link2 size={16} /> The evidence trail</h2><span className="count-pill">9</span></div><p className="section-description">Not just an answer. The receipts.</p><button className="customer-quote" onClick={() => openSource("slack-northstar")}><div className="quote-channel"><SourceIcon kind="slack" /><span>#shared-northstar</span><ArrowUpRight size={13} /></div><blockquote>“This is blocking our May renewal approval.”</blockquote><span className="quote-author"><span className="avatar avatar-northstar avatar-xs">AC</span>Alex Chen <span>· Northstar</span></span></button><div className="source-list">{["workaround", "eng-214", "contract-register"].map(id => { const item = sources.find(entry => entry.id === id)!; return <button className="source-row" key={id} onClick={() => openSource(id)}><span className={`source-type source-${item.kind}`}><SourceIcon kind={item.kind} /></span><span><strong>{id === "workaround" ? "Approved export runbook" : id === "eng-214" ? "ENG-214 · Export pagination" : "Account & renewal register"}</strong><small>{id === "workaround" ? "Documented workaround" : id === "eng-214" ? "Linked engineering issue" : "Commercial context"}</small></span><ArrowUpRight size={13} /></button>; })}</div><button className="all-sources" onClick={() => setModal("sources")}>View all 9 sources <ArrowRight size={13} /></button></section>
            <section className="accounts-card"><div className="section-heading"><h2><Users size={16} /> Who else is affected?</h2></div><div className="affected-list">{impact.accounts.map(account => <button key={account.id} className="affected-account" onClick={() => openSource(account.id === "northstar" ? "slack-northstar" : `ticket-${account.id}`)}><span className={`account-logo ${account.color}`}>{account.initials}</span><span><strong>{account.name}</strong><small>{account.blocker ? "Renewal blocker" : "Same problem, no stated blocker"}</small></span><span className="account-arr">{money(account.arr / 1000)}k<small>ARR</small></span></button>)}</div><div className="accounts-footnote"><Users size={12} /> 5 messages ≠ 5 customers</div></section>
            <section className="unknowns-card"><h3><CircleDot size={15} /> What we don’t know yet</h3><p>Revenue-loss probability, maintenance cost, confirmed delivery dates, and whether the workaround resolves the customer’s need.</p><span className="badge badge-neutral">Unknowns stay unknown.</span></section>
            <div className="data-note"><ShieldCheck size={14} /><p>Synthetic customer data.<br />Slack & Linear are simulated.<br /><button onClick={() => setModal("setup")}>Where does the data go? <ArrowUpRight size={11} /></button></p></div>
          </aside></div>}

          {tab === "reply" && <div className="reply-layout"><section className="composer-card"><div className="section-heading"><h2><MessageSquare size={17} /> A clear next step, not an empty promise.</h2><span className={`badge ${approved ? "badge-green" : "badge-amber"}`}>{approved ? "Approved · demo only" : "Draft · not sent"}</span></div><p className="section-description">Prepared for the original conversation. Yours to review and edit.</p><div className="composer-channel"><SourceIcon kind="slack" size={20} /><div><strong>#shared-northstar</strong><small>To Alex Chen · Northstar</small></div><button className="text-button" onClick={() => openSource("slack-northstar")}>Original request <ArrowUpRight size={12} /></button></div><div className="composer-controls"><span>Based on <strong>{option === "workaround" ? "assisted full export" : "permanent fix + interim help"}</strong></span><label>Language <select value={language} onChange={event => chooseLanguage(event.target.value as Language)}><option value="en">English</option><option value="de">Deutsch</option></select></label></div><label className="sr-only" htmlFor="customer-draft">Customer response draft</label><textarea id="customer-draft" value={draft} onChange={event => { setDraft(event.target.value); setApproved(false); }} maxLength={10000} rows={16} /><div className="composer-checks"><span><Check size={13} /> No delivery date promised in template</span><span><Check size={13} /> Customer consent requested</span></div><div className="composer-footer"><button className="button" onClick={() => copyText(draft, "Draft copied. Review before sending through the original channel.")}><Copy size={14} /> Copy draft</button><button className="button button-primary" disabled={!draft.trim() || approved} onClick={() => { setApproved(true); setToast("Draft approved locally for this demo. Nothing was sent to Slack."); }}><Check size={15} />{approved ? "Approved for review" : "Approve draft (demo)"}</button></div><p className="composer-disclosure"><ShieldCheck size={13} /> This demo never sends messages. Edits invalidate approval. Recheck any commitments you add.</p></section><aside className="reply-context"><div className="context-card"><span className="eyebrow">BEFORE YOU APPROVE</span><h3>Helpful. Honest. Human.</h3><ul><li>Confirm the secure transfer channel and customer permission.</li><li>Check that Maya can coordinate the assisted export.</li><li>Do not turn an engineering estimate into a delivery promise.</li><li>Keep the request open until the customer confirms resolution.</li></ul><button className="text-button" onClick={() => openSource("workaround")}>Read the approved runbook <ArrowUpRight size={12} /></button></div><div className="context-card subtle"><h3>Not the last message.</h3><p>When the fix is released, Relay prepares an update for every affected account.</p><button className="text-button" onClick={() => setTab("followups")}>See follow-through <ArrowRight size={13} /></button></div></aside></div>}

          {tab === "followups" && <section className="followups-section"><div className="followups-heading"><div><span className="eyebrow">CLOSE THE LOOP, NOT JUST THE TICKET</span><h2>A fix isn’t finished until the customer knows.</h2><p>Track the product event, the communication, and the actual outcome separately.</p></div><button className="button button-primary" disabled={allReleased} onClick={simulateRelease}>{allReleased ? <Check size={15} /> : <GitBranch size={15} />}{allReleased ? "Release simulated" : "Simulate ENG-214 release"}</button></div><div className="simulation-banner"><Lightbulb size={16} /><span><strong>Simulation only.</strong> No Linear issue is updated and no customer is contacted. Drafts do not count as notifications.</span></div><div className="outcome-summary">{[{ label: "Fix released", count: accounts.filter(account => outcomes[account.id].released).length }, { label: "Customer notified", count: accounts.filter(account => outcomes[account.id].notified).length }, { label: "Confirmed resolved", count: resolvedCount }].map((item, index) => <div key={item.label}><span className="outcome-number">0{index + 1}</span><strong>{item.count}<small>/ 3</small></strong><span>{item.label}</span></div>)}</div><div className="followup-accounts">{accounts.map(account => { const outcome = outcomes[account.id]; return <article className="followup-account" key={account.id}><div className="followup-account-head"><span className={`account-logo ${account.color}`}>{account.initials}</span><div><h3>{account.name}</h3><p>{account.blocker ? "Explicit renewal blocker · May 1" : "Affected account · no stated renewal blocker"}</p></div><span className={`badge ${outcome.confirmed ? "badge-green" : "badge-neutral"}`}>{outcome.confirmed ? "Resolved · demo" : outcome.notified ? "Awaiting confirmation" : outcome.released ? "Draft ready" : "Awaiting release"}</span></div><div className="outcome-steps">{[{ label: "Fix released", done: outcome.released }, { label: "Customer notified", done: outcome.notified }, { label: "Customer confirmed", done: outcome.confirmed }].map((step, index) => <div className={step.done ? "outcome-step done" : "outcome-step"} key={step.label}><span>{step.done ? <Check size={13} /> : index + 1}</span>{step.label}</div>)}</div><div className="followup-actions"><button className="button button-small" disabled={!outcome.released || outcome.notified} onClick={() => reviewFollowup(account.id)}><MessageSquare size={13} />Review follow-up</button><button className="text-button" disabled={!outcome.notified || outcome.confirmed} onClick={() => { setOutcomes(current => ({ ...current, [account.id]: updateOutcome(current[account.id], "confirm") })); setToast(`${account.name} confirmation simulated. This is not an actual customer outcome.`); }}><CheckCheck size={14} />Simulate customer confirmation</button></div></article>; })}</div><div className="actuals-note"><Clock3 size={16} /><div><strong>Predictions are not outcomes.</strong><p>Estimated effort: 3–5 person-days. Actual effort, actual release date, and commercial outcome are unmeasured in this demo. A simulated release does not validate the estimate.</p></div></div></section>}
        </div>
        <footer className="page-footer"><Brand small /><span>Good decisions have a paper trail.</span><span className="footer-right">Built for the space between teams.</span></footer>
      </main>
      <VoicePanel actions={{ openSource, setTab, selectOption: chooseOption, showComparison }} openSetup={() => setModal("setup")} context={screenContext} />
    </div>
  </div>

  {modal === "intake" && <Modal title="One message. The whole picture." description="Incoming request · Simulated Slack integration" close={() => setModal(null)}><div className="intake-channel"><SourceIcon kind="slack" size={22} /><div><strong>#shared-northstar</strong><span>Apr 14, 2026 · 09:42</span></div><span className="badge badge-blue">{matched ? "Matched" : "New signal"}</span></div><div className="intake-message"><span className="avatar avatar-northstar">AC</span><div><strong>Alex Chen <span>Northstar</span></strong><p>{sources[0].excerpt}</p></div></div><div className="intake-plan"><h3><Sparkles size={15} /> What Relay connects</h3><p>5 messages → 3 unique accounts → 1 engineering issue → 2 paths forward.</p><span className="small muted">Seeded scenario with deterministic tag matching, not a live Slack import or AI extraction.</span></div><button className="button button-primary full-width" onClick={() => { setMatched(true); setTab("brief"); setModal(null); setToast("Matched 5 related messages across 3 accounts. Source-backed brief is ready."); }}>Build the decision brief <ArrowRight size={15} /></button></Modal>}

  {modal === "sources" && <Modal title="Every claim has a trail." description="9 preserved sample sources · No external systems connected" close={() => setModal(null)} wide><div className="source-search"><Search size={17} /><label className="sr-only" htmlFor="source-search">Search source documents</label><input id="source-search" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} placeholder="Search excerpts, documents, or channels…" /></div><div className="source-library">{filteredSources.map(item => <button key={item.id} onClick={() => openSource(item.id)}><span className={`source-type source-${item.kind}`}><SourceIcon kind={item.kind} /></span><span><strong>{item.title}</strong><small>{item.location} · {item.author}</small><p>{item.excerpt.slice(0, 140)}…</p></span><ArrowUpRight size={15} /></button>)}{!filteredSources.length && <p className="empty-state">No sample sources match “{sourceFilter}”. Try “export”, “renewal”, or “capacity”.</p>}</div></Modal>}

  {modal === "setup" && <Modal title="Give your decision a voice." description="ElevenLabs live voice · Optional for the guided demo" close={() => setModal(null)} wide><div className="setup-hero"><span className="assistant-symbol"><AudioLines size={28} /></span><div><h3>A conversation, not a read-aloud button.</h3><p>Ask for evidence, compare the tradeoff, and prepare a reply while the brief stays in view.</p></div></div><ol className="setup-steps"><li><span>1</span><div><strong>Create a private ElevenLabs agent</strong><p>Use the prompt and five client-tool definitions in <code>docs/elevenlabs.md</code>. Enable “Wait for response” for each tool.</p></div></li><li><span>2</span><div><strong>Add your server-side credentials</strong><pre>ELEVENLABS_API_KEY=your_key{"\n"}ELEVENLABS_AGENT_ID=your_agent_id</pre><p>Put these in <code>.env.local</code>, then restart the development server. Never put the API key in a browser variable.</p></div></li><li><span>3</span><div><strong>Click “Talk to Relay”</strong><p>Allow microphone access. Use headphones at the hackathon. Text input remains available as a guided fallback.</p></div></li></ol><div className="privacy-note"><ShieldCheck size={19} /><div><strong>Local app does not mean local AI.</strong><p>The guided demo uses scripted answers with no model request. Live voice sends microphone audio, the synthetic brief, source excerpts, and screen state to ElevenLabs and its configured model services. Provider retention depends on account settings. Session state is in browser memory and resets on reload. Slack and Linear are not connected.</p><p>This is a single-user hackathon demo, not an authenticated production app. Add authentication, tenant permissions, durable audit records, and quota controls before any public or real-data deployment.</p></div></div><a className="button button-primary" href="https://elevenlabs.io/docs/eleven-agents/libraries/react" target="_blank" rel="noreferrer">ElevenLabs React documentation <ExternalLink size={14} /></a></Modal>}

  {source && <Modal title={source.title} description={source.location} close={() => setSource(null)}><div className="source-detail-meta"><span className={`source-type source-${source.kind}`}><SourceIcon kind={source.kind} /></span><div><strong>{source.author}</strong><small>{source.date} · Synthetic source</small></div><span className="badge badge-neutral">Original excerpt</span></div><blockquote className="source-excerpt">{source.excerpt}</blockquote><div className="source-provenance"><Link2 size={14} /><span>Source ID: <code>{source.id}</code></span><button className="text-button" onClick={() => copyText(`${source.title}\n${source.location}\nSource ID: ${source.id}\nSYNTHETIC DEMO SOURCE\n\n${source.excerpt}`, "Source excerpt copied with provenance.")}><Copy size={13} />Copy</button></div><p className="small muted">This is a preserved fictional source, not a link to a real customer workspace. No source permissions are implied.</p><button className="button full-width" onClick={() => { setSource(null); setModal("sources"); }}>Browse all sources <ArrowRight size={14} /></button></Modal>}

  {reviewAccount && <Modal title={`Follow up with ${accounts.find(account => account.id === reviewAccount)?.name}`} description="Prepared after simulated release · Nothing will be sent" close={() => setReviewAccount(null)}><label className="field-label" htmlFor="followup-draft">Review the update</label><textarea id="followup-draft" className="followup-textarea" rows={12} value={followupDraft} maxLength={10000} onChange={event => { setFollowupDraft(event.target.value); setReviewed(false); }} /><label className="review-checkbox"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed this customer update. Record notification only in the demo.</label><button className="button button-primary full-width" disabled={!reviewed || !followupDraft.trim()} onClick={() => { setOutcomes(current => ({ ...current, [reviewAccount]: updateOutcome(current[reviewAccount], "notify") })); setReviewAccount(null); setToast("Notification recorded as a demo event. No message sent; customer resolution is still unconfirmed."); }}><Check size={15} /> Record as notified (demo)</button></Modal>}

  <div className={`toast ${toast ? "toast-visible" : ""}`} role="status" aria-live="polite">{toast && <><CircleCheck size={17} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button></>}</div>
  </ConversationProvider>;
}
