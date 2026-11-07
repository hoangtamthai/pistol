// SYNTHETIC DEMO: guided "autopilot" scenario. Sources, agents, research, options and fixes are
// scripted sample content from /api/connectors. Nothing is sent, changed or deployed.
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP_MS = 6500;

  const steps = [
    { title: 'Check every source', sub: 'Agents poll Slack, Jira, Zendesk and seven more tools. Nobody copies tickets by hand.', status: 'Scanning sources' },
    { title: 'Group & deduplicate', sub: 'Tickets are compared on evidence, not keywords. Similar wording with different causes stays separate.', status: 'Grouping' },
    { title: 'Assign an agent to every ticket', sub: 'Each ticket goes to the agent with the right tools: customer, engineering or billing.', status: 'Assigning' },
    { title: 'Research before answering', sub: 'Agents read logs, code, docs, changelogs and past tickets, and cite what they found.', status: 'Researching' },
    { title: 'Brainstorm the options', sub: 'Two or three ways to solve each ticket, with effort and risk, and one recommendation.', status: 'Brainstorming' },
    { title: 'Prepare every fix', sub: 'Pull requests, replies and config changes are drafted and checked. None are executed yet.', status: 'Preparing fixes' },
    { title: 'Your approval', sub: 'Nothing leaves Context until you approve it. Unapproved items stay on hold.', status: 'Waiting for your decision' },
    { title: 'Explain it to the customer', sub: 'In their own channel: what went wrong, what we changed, and a request to confirm. Not just a merged PR.', status: 'Talking to customers' },
    { title: 'Close the loop in every source', sub: 'Each approved action is recorded back where the customer raised the ticket.', status: 'Confirmed complete' },
  ];
  const APPROVAL = 6;

  let connectors = [], clusters = [], tickets = [];
  let step = 0, selected = 0, playing = false, timer = null, anim = null, tickN = 0;
  let approved = new Set();

  const provider = id => connectors.find(item => item.id === id) || { id, name: id, mark: id.slice(0, 2) };
  const mark = (id, size = '') => `<span class="source-mark source-${esc(id)} ${size}" aria-hidden="true">${esc(provider(id).mark)}</span>`;
  const agentClass = name => name.split(' ')[0].toLowerCase();
  const toast = message => { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3800); };

  // ---- step renderers -------------------------------------------------------------------------
  function scan() {
    const done = Math.min(connectors.length, tickN);
    const found = connectors.slice(0, done).reduce((total, item) => total + tickets.filter(t => t.provider === item.id).length, 0);
    return `<div class="flow-scan">${connectors.map((item, i) => {
      const count = tickets.filter(t => t.provider === item.id).length;
      const state = i < done ? 'found' : i === done ? 'scanning' : 'idle';
      return `<div class="scan-card is-${state}">${mark(item.id)}<div><strong>${esc(item.name)}</strong><small>${esc(item.workspace)}</small></div><span class="scan-state">${state === 'found' ? `${count} new ${esc(item.noun)}${count === 1 ? '' : 's'}` : state === 'scanning' ? 'Checking…' : 'Queued'}</span></div>`;
    }).join('')}</div>
    <div class="flow-total"><strong>${found}</strong><span>new tickets found across <b>${done}</b> of ${connectors.length} sources</span>${done >= connectors.length ? '<em>All sources checked · no duplicates of existing cases</em>' : ''}</div>`;
  }

  function chip(t) {
    return `<button type="button" class="ticket-chip" data-ticket="${tickets.indexOf(t)}">${mark(t.provider, 'sm')}<span><strong>${esc(t.title)}</strong><small>${esc(t.customer)} · ${esc(provider(t.provider).name)} ${esc(t.ref)}</small></span></button>`;
  }

  function group() {
    return `<div class="flow-columns">${clusters.map(cluster => {
      const items = tickets.filter(t => t.cluster === cluster.id);
      return `<section class="flow-column"><header><strong>${esc(cluster.title)}</strong><span>${items.length}</span></header>${items.map(chip).join('')}<p class="flow-column-note">${esc(cluster.note)}</p></section>`;
    }).join('')}</div>`;
  }

  function assign() {
    const agents = [['Customer agent', 'Policy, docs, account context, replies'], ['Engineering agent', 'Logs, code, repro, pull requests'], ['Billing agent', 'Plans, invoices, account handoffs']];
    return `<div class="flow-columns three">${agents.map(([name, tools]) => {
      const items = tickets.filter(t => t.agent === name);
      return `<section class="flow-column agent-${agentClass(name)}"><header><span class="agent-avatar">${esc(name[0])}A</span><div><strong>${esc(name)}</strong><small>${esc(tools)}</small></div><span>${items.length}</span></header>${items.map(t => `${chip(t)}`).join('')}</section>`;
    }).join('')}</div>`;
  }

  function ticketList(kind) {
    return `<div class="flow-list" role="list">${tickets.map((t, i) => {
      const doneLabel = kind === 'research' ? `${t.research.length} findings` : kind === 'talk' ? (approved.has(i) ? 'confirmed' : 'held') : `${t.options.length} options`;
      return `<button type="button" role="listitem" class="flow-list-item ${i === selected ? 'is-selected' : ''}" data-ticket="${i}" aria-pressed="${i === selected}">${mark(t.provider, 'sm')}<span><strong>${esc(t.title)}</strong><small>${esc(t.customer)} · ${esc(t.agent)}</small></span><em>${doneLabel}</em></button>`;
    }).join('')}</div>`;
  }

  function ticketHead(t) {
    return `<div class="flow-detail-head">${mark(t.provider)}<div><span class="flow-ref">${esc(provider(t.provider).name)} · ${esc(t.ref)} · ${esc(t.severity)}</span><h2>${esc(t.title)}</h2><small>${esc(t.customer)} · handled by <b class="agent-name agent-${agentClass(t.agent)}">${esc(t.agent)}</b></small></div></div>`;
  }

  function research() {
    const t = tickets[selected];
    return `<div class="flow-split">${ticketList('research')}<article class="flow-detail">${ticketHead(t)}
      <p class="flow-label">WHAT THE AGENT CHECKED</p>
      <ol class="research-list">${t.research.map((r, i) => `<li style="--d:${i}"><span class="research-tag tag-${esc(r.where.replace(/\s/g, '').toLowerCase())}">${esc(r.where)}</span><p>${esc(r.finding)}</p></li>`).join('')}</ol>
      <p class="flow-note">Findings are cited to their source. Anything unverified stays marked as a candidate cause.</p></article></div>`;
  }

  function brainstorm() {
    const t = tickets[selected];
    return `<div class="flow-split">${ticketList('brainstorm')}<article class="flow-detail">${ticketHead(t)}
      <p class="flow-label">OPTIONS THE AGENT CONSIDERED</p>
      <div class="option-grid">${t.options.map((o, i) => `<div class="option-card ${i === t.recommended ? 'is-recommended' : ''}" style="--d:${i}">${i === t.recommended ? '<span class="option-badge">Recommended</span>' : ''}<strong>${esc(o.title)}</strong><p>${esc(o.note)}</p><dl><div><dt>Effort</dt><dd>${esc(o.effort)}</dd></div><div><dt>Risk</dt><dd class="risk-${o.risk.toLowerCase()}">${esc(o.risk)}</dd></div></dl></div>`).join('')}</div>
      <p class="flow-why"><b>Why this one:</b> ${esc(t.why)}</p></article></div>`;
  }

  const firstName = name => String(name).split(' ')[0];
  const bug = t => window.ContextMessage.isBug(t);
  function bubble(from, who, body, label, extra = '') {
    return `<li class="bubble from-${from} ${extra}"><div class="bubble-head"><b>${esc(who)}</b>${label ? `<em>${esc(label)}</em>` : ''}</div>${body}</li>`;
  }
  const textBody = text => `<p>${esc(text)}</p>`;
  function talkBack() {
    const t = tickets[selected], ok = approved.has(selected), where = provider(t.provider).name;
    const update = window.ContextMessage.html(t);
    return `<div class="flow-split">${ticketList('talk')}<article class="flow-detail">${ticketHead(t)}
      <p class="flow-label">MESSAGE TO ${esc(t.contact.toUpperCase())} IN ${esc(where.toUpperCase())}</p>
      <ol class="lt-thread talk-thread">
        ${bubble('customer', t.contact, textBody(t.title), 'Original report')}
        ${bubble('agent', 'Context agent', textBody(`Hi ${firstName(t.contact)}, thanks for reporting this. Our ${t.agent.toLowerCase()} is looking into it now. I will share what we find right here in ${where}.`), 'Auto-acknowledgement')}
        ${ok ? bubble('agent', 'Context agent', update, 'Approved by you', 'is-update') : bubble('agent', 'Draft · not sent', update, 'Held for your approval', 'is-update is-draft')}
        ${ok ? bubble('customer', t.contact, textBody(t.customerReply), 'Simulated reply') : ''}
      </ol>
      <p class="flow-why"><b>Why this matters:</b> code review ends at a merged PR. Context ends when ${esc(firstName(t.contact))} knows ${bug(t) ? 'what broke, why, and what changed' : 'the answer'}, and confirms it works.</p></article></div>`;
  }

  function fixes() {
    const kinds = {};
    tickets.forEach(t => { kinds[t.fix.kind] = (kinds[t.fix.kind] || 0) + 1; });
    let budget = tickN;
    const rows = tickets.map(t => {
      const checks = t.fix.checks.map(check => { const ok = budget-- > 0; return `<span class="check ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${esc(check)}</span>`; }).join('');
      return { t, checks };
    });
    const totalChecks = tickets.reduce((n, t) => n + t.fix.checks.length, 0), passed = Math.min(totalChecks, tickN);
    return `<div class="fix-summary">${Object.entries(kinds).map(([kind, n]) => `<span><b>${n}</b> ${esc(n === 1 ? kind.toLowerCase() : kind.toLowerCase().replace(/y$/, 'ie') + 's')}</span>`).join('')}<span class="fix-progress"><b>${passed}/${totalChecks}</b> checks passed</span></div>
      <div class="fix-table">${rows.map(({ t, checks }) => `<div class="fix-row">${mark(t.provider, 'sm')}<div class="fix-main"><span class="fix-kind kind-${esc(t.fix.kind.split(' ')[0].toLowerCase())}">${esc(t.fix.kind)}</span><strong>${esc(t.fix.title)}</strong><small>${esc(t.customer)} · ${esc(t.title)}</small></div><div class="fix-checks">${checks}</div></div>`).join('')}</div>`;
  }

  function approval() {
    return `<div class="approve-bar"><p><b>${approved.size}</b> of ${tickets.length} approved. Approved items run in the next step; the rest stay on hold for you.</p><button type="button" class="button-secondary" data-approve="none">Clear</button><button type="button" class="button-primary" data-approve="all">Approve all ${tickets.length}</button></div>
      <div class="approve-list">${tickets.map((t, i) => `<label class="approve-row ${approved.has(i) ? 'is-approved' : ''}"><input type="checkbox" data-approve-one="${i}" ${approved.has(i) ? 'checked' : ''}>${mark(t.provider, 'sm')}<span class="approve-main"><span class="fix-kind kind-${esc(t.fix.kind.split(' ')[0].toLowerCase())}">${esc(t.fix.kind)}</span><strong>${esc(t.fix.title)}</strong><small>${esc(t.customer)} · ${esc(t.options[t.recommended].title)}</small></span><span class="approve-state">${approved.has(i) ? 'Approved' : 'Needs you'}</span></label>`).join('')}</div>`;
  }

  function closeLoop() {
    const done = tickN;
    const approvedTickets = tickets.filter((_, i) => approved.has(i)), ok = approvedTickets.length;
    const sources = new Set(approvedTickets.map(t => t.provider)).size;
    return `<div class="close-summary"><div><strong>${tickets.length}</strong><span>tickets handled</span></div><div><strong>${sources}</strong><span>source${sources === 1 ? '' : 's'} updated</span></div><div><strong>${ok}</strong><span>approved actions run</span></div><div><strong>0</strong><span>actions without approval</span></div></div>
      <div class="close-list">${tickets.map((t, i) => {
        const isApproved = approved.has(i), shown = i < done;
        const state = !isApproved ? 'held' : shown ? 'done' : 'pending';
        return `<div class="close-row is-${state}">${mark(t.provider, 'sm')}<div><strong>${esc(t.title)}</strong><small>${esc(state === 'held' ? `On hold · not executed in ${provider(t.provider).name}` : t.closeout)}</small></div><span class="close-state">${state === 'done' ? '✓ Updated' : state === 'held' ? 'Held for you' : `Updating ${esc(provider(t.provider).name)}…`}</span></div>`;
      }).join('')}</div>`;
  }

  const renderers = [scan, group, assign, research, brainstorm, fixes, approval, talkBack, closeLoop];

  // ---- frame -----------------------------------------------------------------------------------
  function render() {
    const s = steps[step];
    $('#flow-eyebrow').textContent = `SCENARIO 03 / AUTOPILOT · STEP ${step + 1}`;
    $('#flow-title').textContent = s.title;
    $('#flow-subtitle').textContent = s.sub;
    const status = $('#flow-status');
    status.className = `phase-status ${step === APPROVAL ? 'waiting' : step === steps.length - 1 ? 'complete' : step || playing ? 'working' : ''}`;
    status.textContent = step === 0 && !playing && !tickN ? 'Ready to play' : s.status;
    $('#flow-stage').innerHTML = renderers[step]();
    $('#flow-stage').dataset.step = String(step);
    $('#flow-counter').textContent = `STEP ${String(step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
    $('#flow-step-title').textContent = s.title;
    $('#flow-progress').innerHTML = steps.map((_, i) => `<span class="step-dot ${i < step ? 'done' : i === step ? 'current' : ''}" aria-hidden="true"></span>`).join('');
    $('#flow-progress').setAttribute('aria-label', `Step ${step + 1} of ${steps.length}`);
    $('#flow-back').disabled = step === 0;
    const last = step === steps.length - 1;
    $('#flow-next').hidden = last;
    $('#flow-next').textContent = step === APPROVAL ? (approved.size ? `Run ${approved.size} approved` : 'Approve to continue') : 'Next';
    $('#flow-next').disabled = step === APPROVAL && !approved.size;
    $('#flow-play').textContent = last ? '↺ Replay scenario' : step === APPROVAL ? (approved.size ? `▶ Run ${approved.size} approved` : 'Approve all & continue') : playing ? 'Ⅱ Pause' : step === 0 && !tickN ? '▶ Play demo' : '▶ Continue demo';
  }

  // Per-step micro-animation (scan sources, run checks, update sources).
  function startAnim() {
    clearInterval(anim);
    tickN = 0;
    const limits = { 0: connectors.length, 5: tickets.reduce((n, t) => n + t.fix.checks.length, 0), 8: tickets.length };
    if (!(step in limits)) return;
    if (reduced) { tickN = limits[step]; return; }
    const speed = { 0: 320, 5: 90, 8: 260 }[step];
    anim = setInterval(() => {
      tickN++;
      if (tickN >= limits[step]) clearInterval(anim);
      const keep = $('#flow-stage').scrollTop;
      render();
      $('#flow-stage').scrollTop = keep;
    }, speed);
  }

  // While playing research/brainstorm, cycle a few tickets so the audience sees variety.
  function startCycle() {
    if (!playing || (step !== 3 && step !== 4 && step !== 7)) return;
    let shown = 0;
    clearInterval(startCycle.t);
    startCycle.t = setInterval(() => {
      if (!playing || (step !== 3 && step !== 4 && step !== 7)) { clearInterval(startCycle.t); return; }
      if (++shown >= 3) { clearInterval(startCycle.t); return; }
      selected = (selected + 1) % tickets.length;
      render();
    }, STEP_MS / 3);
  }

  function go(next) {
    if (next < 0 || next >= steps.length) return;
    if (step === APPROVAL && next > step && !approved.size) { toast('Approve at least one proposal first. Nothing runs without you.'); return; }
    step = next;
    if (step <= 2) selected = 0;
    startAnim();
    render();
    $('#flow-stage').scrollTop = 0;
    schedule();
    startCycle();
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    if (step === APPROVAL || step === steps.length - 1) { playing = false; render(); return; }
    timer = setTimeout(() => go(step + 1), STEP_MS);
  }

  function stop() { playing = false; clearTimeout(timer); render(); }

  function primary() {
    if (step === steps.length - 1) { approved = new Set(); playing = false; go(0); return; }
    if (step === APPROVAL) {
      if (!approved.size) { tickets.forEach((_, i) => approved.add(i)); toast(`All ${tickets.length} proposals approved by you.`); }
      go(step + 1);
      return;
    }
    if (playing) { stop(); return; }
    playing = true;
    if (step === 0 && !tickN) startAnim();
    render();
    schedule();
    startCycle();
  }

  // ---- events ----------------------------------------------------------------------------------
  document.addEventListener('click', event => {
    if (document.body.classList.contains('mode-live')) return;
    const nav = event.target.closest('[data-href]');
    if (nav) { location.assign(nav.dataset.href); return; }
    const pick = event.target.closest('[data-ticket]');
    if (pick && (step === 3 || step === 4 || step === 7)) { stop(); selected = Number(pick.dataset.ticket); render(); return; }
    if (pick && step < 3) { stop(); selected = Number(pick.dataset.ticket); go(3); return; }
    const bulk = event.target.closest('[data-approve]');
    if (bulk) { approved = bulk.dataset.approve === 'all' ? new Set(tickets.map((_, i) => i)) : new Set(); render(); return; }
  });
  document.addEventListener('change', event => {
    const box = event.target.closest('[data-approve-one]');
    if (!box) return;
    const i = Number(box.dataset.approveOne);
    if (box.checked) approved.add(i); else approved.delete(i);
    render();
  });
  $('#flow-play').addEventListener('click', primary);
  $('#flow-next').addEventListener('click', () => { stop(); go(step + 1); });
  $('#flow-back').addEventListener('click', () => { stop(); go(step - 1); });
  $('#flow-reset').addEventListener('click', () => { approved = new Set(); playing = false; clearTimeout(timer); go(0); tickN = 0; clearInterval(anim); render(); toast('Scenario restarted.'); });
  document.addEventListener('keydown', event => {
    if (document.body.classList.contains('mode-live') || event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowRight') { stop(); go(step + 1); }
    if (event.key === 'ArrowLeft') { stop(); go(step - 1); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });

  fetch('/api/connectors', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Connectors are unavailable.')))
    .then(result => {
      connectors = result.connectors || [];
      clusters = result.clusters || [];
      tickets = result.tickets || [];
      const params = new URLSearchParams(location.search);
      const start = Number(params.get('step'));
      if (Number.isInteger(start) && start >= 2 && start <= steps.length) {
        if (start - 1 > APPROVAL) tickets.forEach((_, i) => { if (i !== 4) approved.add(i); }); // one item held, to show the gate
        go(start - 1);
        return;
      }
      if (params.get('autoplay') === '1') { primary(); return; }
      render();
    })
    .catch(error => {
      $('#flow-title').textContent = 'Could not load the sample tickets.';
      $('#flow-subtitle').textContent = `${error.message} Refresh to try again.`;
    });
})();
