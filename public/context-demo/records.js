const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const humanize = value => String(value).replaceAll('_', ' ');
const issueURL = id => `/context/issues/${encodeURIComponent(id)}`;
const path = location.pathname;
const isNew = path === '/context/issues/new';
const issueId = !isNew && path.startsWith('/context/issues/') ? decodeURIComponent(path.slice('/context/issues/'.length)) : null;
const dialog = $('#record-detail');
const legacySources = { form: 'Web form', helpdesk: 'Helpdesk', email: 'Email', slack: 'Slack', call: 'Phone call', public_web: 'Public web' };
const sourceMarks = { form: 'Fm', helpdesk: 'Hd', email: 'Em', call: 'Ca', public_web: 'Pw' };
function sourceInfo(id) {
  const connector = connectors.find(item => item.id === id);
  return { id, name: connector?.name || legacySources[id] || humanize(id), mark: connector?.mark || sourceMarks[id] || String(id).slice(0, 2) };
}
const sourceBadge = id => { const info = sourceInfo(id); return `<span class="source-badge"><span class="source-mark source-${esc(info.id)}" aria-hidden="true">${esc(info.mark)}</span>${esc(info.name)}</span>`; };
function issueSource(issueId) {
  const reportIds = snapshot.relationships.filter(edge => edge.type === 'REPORTS' && edge.status === 'confirmed' && edge.toId === issueId).map(edge => edge.fromId);
  const reports = snapshot.reports.filter(report => reportIds.includes(report.id)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return { source: reports[0]?.source || 'form', externalId: reports[0]?.externalId || '', count: reports.length };
}
let snapshot, connectors = [], syncNote = '', view, timer, busy = false, pendingRequest = null, search = '', lastTrigger = null;

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000), ...options });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'The request failed.'), { status: response.status });
  return result;
}
function setBusy(value) {
  busy = value;
  $('#content').setAttribute('aria-busy', String(value));
  document.querySelectorAll('fieldset, #refresh, #retry').forEach(element => { element.disabled = value; });
}
function showError(error) {
  clearTimeout(timer);
  $('#request-error span').textContent = error.message || 'The request failed. Retry to continue.';
  $('#request-error').hidden = false;
  if (pendingRequest) document.querySelectorAll('fieldset').forEach(element => { element.disabled = true; });
}
function clearError() { $('#request-error').hidden = true; }
function setHeading(title, description, status) {
  $('#page-title').textContent = title;
  $('#page-description').textContent = description;
  $('#phase-status').textContent = status;
  document.title = `${title} · Context`;
}
async function load() {
  if (issueId) {
    [view, { connectors }] = await Promise.all([api(`/api/issues?issue=${encodeURIComponent(issueId)}`), api('/api/connectors')]);
    renderLifecycle();
  } else {
    [snapshot, { connectors }] = await Promise.all([api('/api/issues'), api('/api/connectors')]);
    if (isNew) renderIntake(); else renderList();
  }
  $('#content').setAttribute('aria-busy', 'false');
}
async function mutate(body, retry = false) {
  if (busy) return;
  clearTimeout(timer);
  if (!retry) pendingRequest = { body: issueId ? { ...body, issueId, revision: view.issue.revision } : body, key: crypto.randomUUID() };
  setBusy(true); clearError();
  try {
    const result = await api('/api/issues', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pendingRequest.key }, body: JSON.stringify(pendingRequest.body) });
    if (pendingRequest.body.action === 'intake') { location.assign(issueURL(result.issueId)); return; }
    await load();
    pendingRequest = null;
  } catch (error) {
    if (error.status && error.status < 500) pendingRequest = null;
    if (error.status === 409) {
      try { await load(); } catch { /* Keep the original conflict visible if refreshing also fails. */ }
    }
    showError(error);
  } finally {
    setBusy(false);
    if (pendingRequest) document.querySelectorAll('fieldset').forEach(element => { element.disabled = true; });
    schedule();
  }
}
function schedule() {
  clearTimeout(timer);
  if (!view?.lifecycle.canAdvance || busy || dialog.open || document.hidden || !$('#request-error').hidden) return;
  timer = setTimeout(() => mutate({ action: 'workflow_advance', step: view.lifecycle.step }), 1500);
}
function renderIntake() {
  setHeading('Submit an issue', 'Preserve the report and your comment, then open its automatic lifecycle.', 'Saved to SQLite');
  $('#new-link').setAttribute('aria-current', 'page');
  $('#content').innerHTML = `<section class="records-card records-submit"><form id="intake" class="records-form"><fieldset>
    <label>Issue title<input name="title" required maxlength="160" placeholder="What is the customer unable to do?"></label>
    <div class="field-row"><label>Environment<input name="environment" required maxlength="80" value="unknown" placeholder="production-eu, staging, or unknown"></label><label>Operational severity<select name="severity"><option value="S2">S2 · Workflow blocked</option><option value="S1">S1 · Security / widespread disruption</option><option value="S3" selected>S3 · Degraded workflow</option><option value="S4">S4 · Low impact / unknown</option></select></label></div>
    <label>Issue description<textarea name="text" required maxlength="4000" rows="5" placeholder="What happened, what did you expect, and how can it be reproduced?"></textarea></label>
    <label>Comment <span class="records-form-note">Optional additional context, observations, or questions. Saved separately from the original report.</span><textarea name="comment" maxlength="2000" rows="4" placeholder="Add a comment for the person investigating this issue."></textarea></label>
    <p class="records-form-note">Do not include secrets or personal data. Saving does not imply a verified customer identity, completed investigation, or deployment.</p>
    <button class="button-primary" type="submit">Submit issue & open lifecycle</button>
    </fieldset></form></section>`;
  $('#intake').addEventListener('submit', event => {
    event.preventDefault();
    mutate({ ...Object.fromEntries(new FormData(event.currentTarget)), action: 'intake', externalId: crypto.randomUUID(), sourceRevision: '1', source: 'form', sentiment: 'unknown', issueType: 'malfunction' });
  });
}
function renderList() {
  $('#issues-link').setAttribute('aria-current', 'page');
  const pulled = connectors.reduce((total, item) => total + item.pulled, 0), available = connectors.reduce((total, item) => total + item.available, 0);
  $('#content').innerHTML = `<section class="records-card connectors-card" aria-labelledby="connectors-title"><div class="connectors-head"><div><p class="eyebrow">CONNECTED SOURCES · SIMULATED</p><h2 id="connectors-title">Tickets from every tool your customers use</h2><p class="records-form-note">${connectors.length} connectors · ${pulled} of ${available} sample tickets pulled into this workspace.</p></div><button type="button" class="button-primary" id="sync-connectors">${pulled < available ? 'Pull tickets from all sources' : 'Sync again'}</button></div><ul class="connector-grid">${connectors.map(item => `<li class="${item.pulled ? 'is-synced' : ''}"><span class="source-mark source-${esc(item.id)}" aria-hidden="true">${esc(item.mark)}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${item.pulled}/${item.available} ${esc(item.noun)}${item.available === 1 ? '' : 's'} pulled</small></span><span class="connector-state">${item.pulled ? 'Synced' : 'Ready'}</span></li>`).join('')}</ul><p class="connector-note" role="status">${esc(syncNote)}</p></section>
  <section class="records-card"><div class="records-filter"><label>Search issues<input id="search" type="search" placeholder="Title, source, owner, status, or issue ID" value="${esc(search)}"></label><button type="button" class="button-secondary" id="refresh">Refresh issues</button></div><div id="issue-rows"></div></section>`;
  $('#search').addEventListener('input', event => { search = event.target.value; renderRows(); });
  $('#refresh').addEventListener('click', refresh);
  $('#sync-connectors').addEventListener('click', syncConnectors);
  renderRows();
}
async function syncConnectors() {
  if (busy) return;
  setBusy(true); clearError();
  document.querySelector('#sync-connectors').disabled = true;
  try {
    const result = await api('/api/connectors', { method: 'POST' });
    syncNote = result.pulled ? `Pulled ${result.pulled} new ticket${result.pulled === 1 ? '' : 's'} from ${result.connectors.filter(item => item.pulled).length} sources. Each one keeps its original wording and source reference.` : 'Already up to date. Re-syncing never duplicates a ticket.';
    await load();
  } catch (error) { showError(error); }
  finally { setBusy(false); }
}
function renderRows() {
  const query = search.trim().toLowerCase();
  const issues = snapshot.issues.filter(issue => `${issue.title} ${issue.id} ${issue.owner} ${humanize(issue.state)} ${sourceInfo(issueSource(issue.id).source).name} ${issueSource(issue.id).externalId}`.toLowerCase().includes(query)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('#issue-rows').innerHTML = issues.length ? `<table class="records-table"><caption>${issues.length} of ${snapshot.issues.length} saved issues · newest first</caption><thead><tr><th scope="col">Issue</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Severity</th><th scope="col">Owner</th><th scope="col">Created</th><th scope="col">Action</th></tr></thead><tbody>${issues.map(issue => `<tr><td><strong>${esc(issue.title)}</strong><small>${esc(issue.id)}</small><small>${esc(issue.environment)}</small></td><td>${(() => { const origin = issueSource(issue.id); return `${sourceBadge(origin.source)}${origin.externalId && origin.source !== 'form' ? `<small>${esc(origin.externalId.replace(/^[a-z]+:/, ''))}</small>` : ''}${origin.count > 1 ? `<small>+${origin.count - 1} more report${origin.count > 2 ? 's' : ''}</small>` : ''}`; })()}</td><td><span class="records-state">${esc(humanize(issue.state))}</span></td><td>${esc(issue.severity)}</td><td>${esc(issue.owner)}</td><td>${esc(new Date(issue.createdAt).toLocaleString())}</td><td><a href="${issueURL(issue.id)}">Open lifecycle<span class="records-form-note"> for ${esc(issue.title)}</span></a></td></tr>`).join('')}</tbody></table>` : `<p class="records-empty">${snapshot.issues.length ? 'No matching issues. Clear your search to see all records.' : 'No issues yet. Submit your first issue to start its lifecycle.'}</p>`;
}
function reportDetails() {
  return `<div class="records-reports">${view.reports.map(report => `<article>${sourceBadge(report.source)}<h3>${esc(report.externalId)} · revision ${esc(report.sourceRevision)}</h3><p><strong>Original report</strong><br>${esc(report.text)}</p><p><strong>Comment</strong><br>${esc(report.comment || 'No comment supplied.')}</p><p class="records-form-note">${report.fixture ? 'Synthetic fixture' : 'Manual intake'} · ${esc(report.source)} · ${esc(report.environment)}</p></article>`).join('')}</div>`;
}
function renderLifecycle() {
  const { issue, lifecycle } = view;
  const { step, canAdvance, finished } = lifecycle;
  setHeading(issue.title, `${issue.id} · ${issue.environment} · ${issue.owner}`, finished ? 'Recovery confirmed' : canAdvance ? 'Running automatically' : 'Human check required');
  $('#phase-status').className = `phase-status ${finished ? 'complete' : canAdvance ? 'working' : 'waiting'}`;
  const nodes = [
    ['Report received', 'Original report + comment', 11, 25], ['Collect context', 'Preserve known facts and unknowns', 37, 25],
    ['Assign & prioritize', issue.owner, 63, 25], ['Investigate', 'Operator evidence, not invented traces', 89, 25],
    ['Prepare fix plan', 'Draft from recorded investigation', 89, 74], ['Human review', 'Exact version + acknowledgment', 63, 74],
    ['Deploy & verify', 'Explicit simulation verification', 37, 74], [finished ? 'Recovery confirmed' : 'Customer follow-up', 'Separate reply for every account', 11, 74],
  ];
  $('#content').innerHTML = `<section class="records-workflow" aria-label="Issue lifecycle"><svg class="connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M11 25H89V74H11" vector-effect="non-scaling-stroke"/></svg>${nodes.map(([title, subtitle, x, y], index) => `<button type="button" data-stage="${index}" class="node ${index < step ? 'done' : index > step ? 'future' : canAdvance ? 'active' : 'waiting'} ${finished && index === 7 ? 'verified' : ''}" style="left:${x}%;top:${y}%"><span class="node-step">${index + 1}</span><span class="node-top"><span class="node-ref">${index === 0 ? 'CUSTOMER REPORT' : index === 5 ? 'HUMAN CHECK' : 'ISSUE LIFECYCLE'}</span></span><h3>${esc(title)}</h3><p>${esc(subtitle)}</p><span class="node-bottom"><span class="node-state ${index < step ? 'done' : index === step && !canAdvance ? 'waiting' : ''}">${index < step ? 'Recorded' : index > step ? 'Not reached' : canAdvance ? 'Processing' : 'Human input required'}</span></span></button>`).join('')}</section>
    <section class="records-dock" aria-label="Automatic progress" role="status"><div><span class="step-counter">STEP ${step + 1} / 9</span><strong>${esc(lifecycle.title)}</strong><p>${esc(finished ? lifecycle.reason : canAdvance ? 'Continuing automatically. No Next or Continue button is needed.' : lifecycle.reason)}</p></div><div class="records-dock-actions">${!canAdvance && !finished ? '<a class="button-primary" href="#human-gate">Review required check</a>' : ''}<button type="button" id="view-report" class="button-secondary">View report & comment</button></div></section>
    <section class="records-card records-gate" id="human-gate" tabindex="-1" ${canAdvance || finished ? 'hidden' : ''}>${canAdvance || finished ? '' : gateContent()}</section>
    <div class="records-actions"><a href="/context/issues" class="button-secondary">All issues</a><a href="/issues?issue=${encodeURIComponent(issue.id)}" class="button-secondary">Full evidence workspace</a><button id="refresh" type="button" class="button-secondary">Refresh saved state</button></div>`;
  $('#view-report').addEventListener('click', () => openDetail('Original report and comment', reportDetails()));
  $('#refresh').addEventListener('click', refresh);
  document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => {
    const stage = Number(button.dataset.stage);
    if (stage > step) { openDetail(lifecycle.stages[stage], '<p>This stage has not been reached. The lifecycle will continue automatically after the current human check.</p>'); return; }
    if (stage <= 1) openDetail(lifecycle.stages[stage], reportDetails());
    else if (stage === 3) openDetail('Investigation evidence', `<pre class="records-evidence">${esc(view.investigation?.text || 'No investigation has been recorded. A human must supply the findings.')}</pre>`);
    else if (stage === 4 || stage === 5) openDetail('Fix plan for review', `<pre class="records-evidence">${esc(view.proposal?.text || 'No fix plan has been prepared yet.')}</pre>`);
    else if (stage === 6) openDetail('Deployment verification', `<pre class="records-evidence">${esc(view.evidence.findLast(item => item.title === 'Simulated deployment verification')?.text || 'No workflow deployment verification has been recorded.')}</pre>`);
    else if (stage === 7) openDetail('Customer outcomes', `<p>${esc(lifecycle.reason)}</p>${view.affected.map(account => `<p>${esc(account.name)}: ${esc(view.outcomes.find(outcome => outcome.accountId === account.id)?.state || 'Awaiting reply')}</p>`).join('')}`);
    else openDetail('Ownership and priority', `<p>${esc(issue.owner)} · ${esc(issue.severity)} · ${esc(issue.environment)}</p>`);
  }));
  bindGate();
  schedule();
}
function gateContent() {
  const { lifecycle, issue, proposal } = view;
  if (lifecycle.step === 2) return `<h2>Confirm ownership</h2><p>Choose the person or team responsible for investigation. Priority comes from the submitted operational severity, ${esc(issue.severity)}.</p><form class="records-form" data-command="state"><fieldset><input type="hidden" name="state" value="triaged"><label>Responsible owner<input name="owner" required maxlength="100" placeholder="Platform · assigned engineer"></label><label>Operational severity<select name="severity">${['S1', 'S2', 'S3', 'S4'].map(severity => `<option ${issue.severity === severity ? 'selected' : ''}>${severity}</option>`).join('')}</select></label><label>Assignment basis<input name="reason" required maxlength="500" placeholder="Service ownership record or owner acceptance"></label><button class="button-primary">Save ownership</button></fieldset></form>`;
  if (lifecycle.step === 3 || lifecycle.step === 4) return `<h2>Record investigation</h2><p>No repository, trace, or test result is inferred from the report. Record your findings before a fix plan is prepared.</p><form class="records-form" data-command="workflow_investigation"><fieldset><label>Investigation findings<textarea name="findings" required maxlength="1000" placeholder="Reproduction, observed evidence, candidate cause, and remaining uncertainty"></textarea></label><label>Proposed fix and delivery tradeoff<textarea name="fix" required maxlength="1000" placeholder="Proposed change, owner effort, and what other work would move"></textarea></label><label>Verification plan and recorded results<textarea name="checks" required maxlength="1000" placeholder="Checks to run, checks actually performed, and results. State when results are unknown."></textarea></label><button class="button-primary">Save investigation</button></fieldset></form>`;
  if (lifecycle.step === 5) return `<h2>Review the proposed fix</h2><p>This is an internal fix plan, not a GitHub PR or proof that checks passed.</p><pre class="records-evidence">${esc(proposal.text)}</pre><form class="records-form" data-command="approve"><fieldset><input type="hidden" name="proposalId" value="${esc(proposal.id)}"><label class="check-label"><input name="reviewed" type="checkbox" required>I reviewed this exact fix plan, evidence, verification status, and delivery tradeoff.</label><button class="button-primary">Approve fix</button></fieldset></form>`;
  if (lifecycle.step === 6) return `<h2>Verify simulated deployment</h2><p>The plan is approved, but nothing has deployed automatically. This explicit action records a simulation, not a production release.</p><form class="records-form" data-command="workflow_deploy"><fieldset><label>Deployment verification evidence<textarea name="basis" required maxlength="1000" placeholder="Sample release, affected environment, and verification result"></textarea></label><label class="check-label"><input name="reviewed" type="checkbox" required>I reviewed this simulated deployment verification. No actual deployment is being performed.</label><button class="button-primary">Record simulated deployment</button></fieldset></form>`;
  if (lifecycle.step === 7) {
    const unverified = view.reports.find(report => !report.accountId && report.source !== 'public_web');
    const identity = unverified ? `<details class="records-identity" ${view.affected.length ? '' : 'open'}><summary>Verify the reporting account</summary><form class="records-form" data-command="map_account"><fieldset><input type="hidden" name="reportId" value="${esc(unverified.id)}"><label>Verified account from the local fixture register<select name="accountId">${view.accounts.map(account => `<option value="${esc(account.id)}">${esc(account.name)} · fixture</option>`).join('')}</select></label><label>Identity verification basis<input name="basis" required maxlength="500" placeholder="Verified support contact or authorized account record"></label><button class="button-primary">Record verified identity</button></fieldset></form></details>` : '';
    return `<h2>Check the customer's recovery</h2><p>Ask the customer to retry their original workflow. No message is sent by this app. Record a separate, explicit test reply for each verified affected account.</p>${identity}${!view.affected.length ? '<p>No verified affected account. Public usernames cannot be used as customer identities. Add verified support evidence in the full workspace before confirming recovery.</p>' : ''}${view.affected.map(account => {
      const outcome = view.outcomes.find(item => item.accountId === account.id);
      return `<section class="records-account"><h3>${esc(account.name)} <span class="records-state ${outcome?.state === 'confirmed' ? 'confirmed' : ''}">${esc(outcome?.state || 'Awaiting reply')}</span></h3>${outcome?.state === 'confirmed' ? '' : `<form class="records-form" data-command="workflow_confirm"><fieldset><input type="hidden" name="accountId" value="${esc(account.id)}"><label>Customer response<select name="state"><option value="confirmed">Customer confirms recovery</option><option value="persists">Problem persists · reopen</option></select></label><label>Customer reply / evidence<textarea name="basis" required maxlength="1000" placeholder="Record a sanitized test reply, not an assumption based on deployment."></textarea></label><label class="check-label"><input name="reviewed" type="checkbox" required>I reviewed this separate customer response for the selected account.</label><button class="button-primary">Record customer reply</button></fieldset></form>`}</section>`;
    }).join('')}<details class="records-identity"><summary>Problem persists? Record a revised investigation</summary><p>A revised investigation invalidates any pending approval and prepares a new fix for human review.</p><form class="records-form" data-command="workflow_investigation"><fieldset><label>Investigation findings<textarea name="findings" required maxlength="1000"></textarea></label><label>Proposed fix and delivery tradeoff<textarea name="fix" required maxlength="1000"></textarea></label><label>Verification plan and recorded results<textarea name="checks" required maxlength="1000"></textarea></label><button class="button-primary">Save revised investigation</button></fieldset></form></details>`;
  }
  return `<h2>More context is needed</h2><p>${esc(lifecycle.reason)}</p><a href="/issues?issue=${encodeURIComponent(issue.id)}">Open the full evidence workspace</a>`;
}
function bindGate() {
  document.querySelectorAll('[data-command]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    if ('reviewed' in body) body.reviewed = body.reviewed === 'on';
    mutate({ ...body, action: form.dataset.command });
  }));
}
function openDetail(title, html) {
  clearTimeout(timer);
  lastTrigger = document.activeElement;
  $('#detail-title').textContent = title;
  $('#detail-body').innerHTML = html;
  dialog.showModal();
  $('#close-detail').focus();
}
async function refresh() {
  if (busy || pendingRequest) return;
  setBusy(true); clearError();
  try { await load(); } catch (error) { showError(error); }
  finally { setBusy(false); schedule(); }
}
$('#close-detail').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (lastTrigger?.isConnected) lastTrigger.focus(); schedule(); });
document.addEventListener('visibilitychange', schedule);
$('#retry').addEventListener('click', () => pendingRequest ? mutate(null, true) : refresh());
refresh();
