"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronRight, Clock3, Copy, Flag, Inbox, Link2, MessageSquare, Search, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react";
import { customerSignals, filterSignals, inboxCustomers, providerCounts, signalStatus, type ProviderFilter, type SignalFilter } from "@/lib/inbox";
import { minutesSinceSync, providerById, type ProviderId } from "@/lib/providers";

function ProviderMark({ id }: { id: ProviderId }) {
  return <span className={`provider-mark provider-${id}`} aria-hidden="true">{providerById(id).mark}</span>;
}

const filters: { id: SignalFilter; label: string }[] = [
  { id: "all", label: "All signals" },
  { id: "new", label: "Needs review" },
  { id: "linked", label: "Linked to a decision" },
  { id: "reviewed", label: "Reviewed" },
];
const statusLabels = { new: "Needs review", linked: "Linked to DEC-014", reviewed: "Reviewed" };

type InboxProps = {
  selectedId: string;
  onSelect: (id: string) => void;
  reviewedIds: string[];
  onReview: (id: string) => void;
  onOpenDecision: () => void;
  onCopy: (text: string, success: string) => void;
};

export default function SignalInbox({ selectedId, onSelect, reviewedIds, onReview, onOpenDecision, onCopy }: InboxProps) {
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("all");
  const [status, setStatus] = useState<SignalFilter>("all");
  const [providerId, setProviderId] = useState<ProviderFilter>("all");
  const visible = filterSignals(query, customerId, status, reviewedIds, providerId);
  const connected = providerCounts.filter(item => item.count > 0);
  const selected = visible.find(signal => signal.id === selectedId) || visible[0];
  const linkedCount = customerSignals.filter(signal => signal.decisionId).length;
  const newCount = customerSignals.filter(signal => signalStatus(signal, reviewedIds) === "new").length;
  const hasFilters = Boolean(query || customerId !== "all" || status !== "all" || providerId !== "all");

  function clearFilters() {
    setQuery("");
    setCustomerId("all");
    setStatus("all");
    setProviderId("all");
  }

  return <div className="signal-inbox-page">
    <div className="page-topline"><div className="eyebrow"><span className="live-square" /> CUSTOMER SIGNALS, BEFORE THE SILOS</div><span className="inbox-snapshot"><Clock3 size={13} /> Apr 14, 2026 · Sample snapshot</span></div>
    <div className="inbox-heading"><div><span className="badge badge-green"><Inbox size={12} /> Your customer listening post</span><h1>Every signal.<br /><span>One shared picture.</span></h1><p>Requests, blockers, and the little things worth noticing.<br />Hear every customer without counting the same problem twice.</p></div><div className="inbox-customer-stack" aria-label={`${inboxCustomers.length} customers in this inbox`}><div>{inboxCustomers.map(customer => <span key={customer.id} className={`account-logo ${customer.color}`} title={customer.name}>{customer.initials}</span>)}</div><span>{inboxCustomers.length} customers. No lost context.</span></div></div>
    <div className="inbox-summary"><div><span className="inbox-stat-icon"><MessageSquare size={18} /></span><div><strong>{customerSignals.length}<span>customer signals</span></strong><p>Original messages preserved</p></div></div><div><span className="inbox-stat-icon"><Users size={18} /></span><div><strong>{inboxCustomers.length}<span>unique customers</span></strong><p>Different accounts, distinct needs</p></div></div><div><span className="inbox-stat-icon amber-icon"><Flag size={18} /></span><div><strong>{newCount}<span>need a closer look</span></strong><p>{linkedCount} signals already linked to DEC-014</p></div></div></div>
    <section className="provider-strip" aria-label="Connected sources">
      <div className="provider-strip-heading"><span className="eyebrow">CONNECTED SOURCES</span><span>{connected.length} tools · pulled into one inbox · simulated sync</span></div>
      <div className="provider-chips">
        <button className={`provider-chip ${providerId === "all" ? "active" : ""}`} aria-pressed={providerId === "all"} onClick={() => setProviderId("all")}><span className="provider-mark provider-all" aria-hidden="true">∗</span><span><strong>All sources</strong><small>{customerSignals.length} signals</small></span></button>
        {connected.map(({ provider, count }) => <button key={provider.id} className={`provider-chip ${providerId === provider.id ? "active" : ""}`} aria-pressed={providerId === provider.id} title={provider.workspace} onClick={() => setProviderId(providerId === provider.id ? "all" : provider.id)}><ProviderMark id={provider.id} /><span><strong>{provider.name}</strong><small><span className="sync-dot" />{count} {provider.noun}{count === 1 ? "" : "s"} · synced {minutesSinceSync(provider)}m ago</small></span></button>)}
      </div>
    </section>
    <section className="inbox-workbench" aria-label="Customer signal inbox">
      <div className="inbox-toolbar"><div className="inbox-search"><Search size={17} /><label className="sr-only" htmlFor="signal-search">Search customer signals</label><input id="signal-search" value={query} maxLength={300} onChange={event => setQuery(event.target.value)} placeholder="Search customers, requests, or conversations…" />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</div><label className="inbox-customer-filter"><SlidersHorizontal size={15} /><span>Customer</span><select value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="all">All customers</option>{inboxCustomers.map(customer => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label></div>
      <div className="inbox-filter-row"><div className="inbox-filters" aria-label="Filter signals by review status">{filters.map(filter => <button key={filter.id} aria-pressed={status === filter.id} className={status === filter.id ? "active" : ""} onClick={() => setStatus(filter.id)}>{filter.label}<span>{customerSignals.filter(signal => filter.id === "all" || signalStatus(signal, reviewedIds) === filter.id).length}</span></button>)}</div><span className="inbox-result-count" role="status">{visible.length} of {customerSignals.length} signals</span></div>
      <div className="inbox-columns"><div className="signal-list" aria-label="Customer messages"><div className="signal-list-label"><span>INCOMING SIGNALS</span><span>Newest first</span></div>{visible.map(signal => {
        const currentStatus = signalStatus(signal, reviewedIds);
        return <button className={`signal-row ${selected?.id === signal.id ? "selected" : ""}`} key={signal.id} aria-pressed={selected?.id === signal.id} onClick={() => { onSelect(signal.id); if (window.matchMedia("(max-width: 960px)").matches) requestAnimationFrame(() => document.getElementById("signal-detail")?.scrollIntoView({ block: "start" })); }}><div className="signal-row-header"><span className={`account-logo ${signal.customer.color}`}>{signal.customer.initials}</span><span className="signal-row-customer"><strong>{signal.customer.name}</strong><small>{signal.source.author.split(" · ")[0]}</small></span><time dateTime={signal.receivedAt}>{signal.source.date}</time>{signal.priority === "high" && <Flag size={13} className="signal-priority" aria-label="Needs attention" />}</div><div className="signal-row-source"><ProviderMark id={signal.provider} /><span>{providerById(signal.provider).name}</span><code>{signal.externalRef}</code></div><h2>{signal.title}</h2><p>{signal.source.excerpt}</p><div className="signal-row-footer"><span className={`signal-status signal-status-${currentStatus}`}><span className="tiny-dot" />{statusLabels[currentStatus]}</span><span>{signal.category}</span><ChevronRight size={13} /></div></button>;
      })}{!visible.length && <div className="signal-empty"><Search size={26} /><h2>No signals match this view.</h2><p>Try a different customer or search term.</p><button className="button" onClick={clearFilters}>Clear filters</button></div>}</div>
      <aside id="signal-detail" className="signal-detail" aria-label="Selected signal detail">{selected ? <>
        <div className="signal-detail-topline"><span className={`signal-status signal-status-${signalStatus(selected, reviewedIds)}`}><span className="tiny-dot" />{statusLabels[signalStatus(selected, reviewedIds)]}</span><span className="small muted">Synthetic customer signal</span></div>
        <div className="signal-detail-customer"><span className={`account-logo ${selected.customer.color}`}>{selected.customer.initials}</span><div><strong>{selected.customer.name}</strong><span>{selected.source.location}</span></div><button className="icon-button" aria-label="Copy original customer message" onClick={() => onCopy(`SYNTHETIC DEMO SOURCE\n${selected.source.title}\n${selected.source.author}\n${providerById(selected.provider).name} · ${selected.externalRef}\n${selected.source.location} · ${selected.source.date}\nSource ID: ${selected.source.id}\n\n${selected.source.excerpt}`, "Original customer message copied with its source details.")}><Copy size={16} /></button></div>
        <h2 className="signal-detail-title">{selected.title}</h2>
        <div className="signal-message-meta"><MessageSquare size={13} /><span>Original {providerById(selected.provider).name} {providerById(selected.provider).noun}</span><time dateTime={selected.receivedAt}>{selected.source.date}</time></div>
        <blockquote className="signal-original-message"><div><span className={`avatar ${selected.customer.color}`}>{selected.source.author.split(" · ")[0].split(" ").map(name => name[0]).join("")}</span><strong>{selected.source.author.split(" · ")[0]}</strong></div><p>{selected.source.excerpt}</p></blockquote>
        <dl className="signal-source-meta">
          <div><dt>Pulled from</dt><dd><ProviderMark id={selected.provider} />{providerById(selected.provider).name}</dd></div>
          <div><dt>Reference</dt><dd><code>{selected.externalRef}</code></dd></div>
          <div><dt>Status in {providerById(selected.provider).name.split(" ")[0]}</dt><dd>{selected.externalStatus}</dd></div>
          <div><dt>Workspace</dt><dd>{providerById(selected.provider).workspace}</dd></div>
        </dl>
        <div className="signal-provenance"><ShieldCheck size={13} /><span>Original wording preserved · <code>{selected.source.id}</code></span></div>
        <div className="signal-next-step"><span className="eyebrow">THE NEXT USEFUL STEP</span><h3>{selected.decisionId ? "Part of a bigger picture." : "Understand first. Then decide."}</h3><p>{selected.nextStep}</p>{selected.decisionId ? <><div className="signal-linked-decision"><span><Link2 size={15} />DEC-014</span><strong>Audit export limit</strong><small>5 messages · 3 unique accounts · 2 solution options</small></div><button className="button button-primary full-width" onClick={onOpenDecision}>Open decision brief <ArrowRight size={15} /></button></> : <><div className="signal-unlinked-note"><Link2 size={14} /><span>No decision or engineering issue linked. Reviewing this message does not resolve the customer’s problem.</span></div><button className="button full-width" disabled={reviewedIds.includes(selected.id)} onClick={() => onReview(selected.id)}><Check size={15} />{reviewedIds.includes(selected.id) ? "Reviewed in this demo" : "Mark reviewed (demo)"}</button></>}</div>
        <p className="signal-detail-disclosure"><ShieldCheck size={14} />No messages sent, priorities changed, or delivery dates promised. Review state is session-only.</p>
      </> : <div className="signal-empty"><Inbox size={29} /><h2>A little quieter here.</h2><p>Clear the filters to see customer conversations.</p></div>}</aside></div>
    </section>
    <div className="inbox-bottom-note"><ShieldCheck size={14} /><span>All customers and messages are fictional. Ingestion from {connected.map(item => item.provider.name).join(", ")} is simulated; no provider is connected. The linked audit-export brief remains scoped to its three affected accounts.</span>{hasFilters && <button className="text-button" onClick={clearFilters}>Clear all filters <X size={12} /></button>}</div>
  </div>;
}
