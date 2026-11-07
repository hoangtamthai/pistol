// SYNTHETIC DEMO: a watchable "live" board. Mock tickets from /api/connectors arrive from their
// source, move across stages while simulated agents work, wait for approval, then the agent tells
// the customer the root cause in their own channel and waits for them to confirm the fix.
// Nothing is sent, changed or deployed; "approvals" in hands-free mode are labelled simulated.
(() => {
  'use strict';
  const root = document.getElementById('live');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BASE_TICK = 800, ARRIVAL_GAP = 3, SIM_SECONDS_PER_TICK = 15, AUTO_APPROVE_AFTER = 3, CUSTOMER_REPLY_AFTER = 4;
  const STAGES = [
    { id: 'inbox', title: 'Inbox', hint: 'Pulled from sources' },
    { id: 'triage', title: 'Triage', hint: 'Classify & route' },
    { id: 'research', title: 'Research', hint: 'Logs, code, docs' },
    { id: 'brainstorm', title: 'Brainstorm', hint: 'Compare options' },
    { id: 'fix', title: 'Fix & checks', hint: 'Draft + verify' },
    { id: 'needs', title: 'Needs you', hint: 'Your approval' },
    { id: 'told', title: 'Customer told', hint: 'Root cause shared' },
    { id: 'confirmed', title: 'Confirmed', hint: 'Customer verified' },
  ];
  const NEEDS = 5, TOLD = 6, CONFIRMED = 7;

  let connectors = [], all = [], cards = [], log = [], chats = [], tick = 0, timer = null, playing = false, speed = 1, handsFree = true, finishedAt = null, openThread = null;
  const provider = id => connectors.find(item => item.id === id) || { id, name: id, mark: id.slice(0, 2) };
  const mark = id => `<span class="source-mark source-${esc(id)}" aria-hidden="true">${esc(provider(id).mark)}</span>`;
  const agentKey = name => name.split(' ')[0].toLowerCase();
  const first = name => String(name).split(' ')[0];
  const Msg = window.ContextMessage;
  const isBug = t => Msg.isBug(t);
  const clock = n => { const total = 9 * 3600 + n * SIM_SECONDS_PER_TICK; return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}`; };

  // ---- per-stage scripts: what the agent is visibly doing on each tick ------------------------
  function script(t, stage) {
    if (stage === 0) return [`New in ${provider(t.provider).name}`, 'Queued for triage'];
    if (stage === 1) return ['Reading the report…', `${t.category} · ${t.severity}`, `Routed to ${t.agent}`];
    if (stage === 2) return t.research.flatMap(r => [`Checking ${r.where.toLowerCase()}…`, `${r.where}: ${r.finding}`]);
    if (stage === 3) return [...t.options.map(o => `Considering: ${o.title} (${o.effort}, ${o.risk.toLowerCase()} risk)`), 'Weighing trade-offs…', `Picked: ${t.options[t.recommended].title}`];
    if (stage === 4) return [`Drafting ${t.fix.kind.toLowerCase()} + customer update…`, ...t.fix.checks.map(c => `✓ ${c}`)];
    return [''];
  }

  // ---- customer conversation ------------------------------------------------------------------
  function say(c, from, text, label, type = '') {
    chats.push({ card: c.id, provider: c.ticket.provider, ref: c.ticket.ref, from, name: from === 'agent' ? 'Context agent' : c.ticket.contact, text, label, type, time: clock(tick) });
  }
  const ackText = t => `Hi ${first(t.contact)}, thanks for reporting this. Our ${t.agent.toLowerCase()} is looking into it now. I will share what we find right here in ${provider(t.provider).name}.`;
  const bubbleBody = m => m.type === 'update' ? Msg.html(cards.find(c => c.id === m.card).ticket) : `<p>${esc(m.text)}</p>`;

  // ---- DOM ------------------------------------------------------------------------------------
  root.innerHTML = `
    <div class="live-head">
      <div><p class="eyebrow">SCENARIO 03 / AUTOPILOT · LIVE · SIMULATED</p><h1>From ticket to a customer who knows why</h1><p>Agents pull tickets from <span id="live-source-count">10</span> sources, research and fix them, then explain the root cause to the customer and wait for them to confirm.</p></div>
      <div class="live-clock" aria-label="Simulated time"><strong id="live-clock">09:00</strong><small>simulated time</small></div>
    </div>
    <div class="live-bar">
      <div class="live-sources" id="live-sources" aria-label="Connected sources"></div>
      <div class="live-agents" id="live-agents" aria-label="Agents"></div>
      <div class="live-counters" id="live-counters" role="status" aria-live="off"></div>
      <div class="live-controls">
        <button type="button" class="primary-button" id="live-play">▶ Play</button>
        <div class="live-speed" role="group" aria-label="Speed">${[1, 2, 4].map(x => `<button type="button" data-speed="${x}" aria-pressed="${x === 1}">${x}×</button>`).join('')}</div>
        <label class="live-toggle" title="Approve automatically after a short pause, labelled as a simulated decision"><input type="checkbox" id="live-handsfree" checked> Hands-free approvals</label>
        <button type="button" class="next-button" id="live-restart" title="Restart" aria-label="Restart">↺</button>
      </div>
    </div>
    <div class="live-board" id="live-board">${STAGES.map((s, i) => `<section class="live-col col-${s.id}" data-stage="${i}"><header><span class="col-dot"></span><strong>${s.title}</strong><em data-count="${i}">0</em><small>${s.hint}</small></header><div class="live-col-body"></div>${i === NEEDS ? '<button type="button" class="live-approve-all" id="live-approve-all" hidden>Approve all waiting</button>' : ''}</section>`).join('')}</div>
    <div class="live-foot">
      <section class="live-panel"><h2>Agent activity</h2><ol class="live-log" id="live-log" aria-label="Activity log"></ol></section>
      <section class="live-panel live-spot-panel" aria-label="Latest customer update"><div class="live-spot" id="live-spot"></div><div class="live-spot-side"><h2>Other messages</h2><ol class="live-chat" id="live-chat" aria-label="Customer conversations"></ol></div></section>
    </div>
    <div class="live-done" id="live-done" hidden></div>`;
  const $ = selector => root.querySelector(selector);
  const columns = [...root.querySelectorAll('.live-col-body')];
  const thread = document.getElementById('live-thread');

  function cardHTML(c) {
    const t = c.ticket, lines = script(t, c.stage);
    const text = c.stage === NEEDS ? 'Fix + customer update ready' : c.stage === TOLD ? `${isBug(t) ? 'Root cause' : 'Answer'} sent to ${first(t.contact)} · waiting for reply` : c.stage === CONFIRMED ? `“${t.customerReply}”` : lines[Math.min(c.progress, lines.length - 1)];
    const pct = Math.round((Math.min(c.progress + 1, lines.length) / lines.length) * 100);
    const agent = c.stage === 0 ? '<span class="lc-unassigned">Unassigned</span>' : `<b class="agent-name agent-${agentKey(t.agent)}">${esc(t.agent)}</b>`;
    const working = (c.stage > 0 && c.stage < NEEDS) || c.stage === TOLD;
    return `<div class="lc-top">${mark(t.provider)}<span class="lc-ref">${esc(t.ref)}</span><span class="lc-sev sev-${esc(t.severity)}">${esc(t.severity)}</span></div>
      <strong class="lc-title">${esc(t.title)}</strong>
      <div class="lc-meta">${esc(t.customer)} · ${agent}</div>
      <p class="lc-act">${working ? '<i class="lc-pulse"></i>' : ''}${esc(text)}</p>
      ${c.stage < NEEDS ? `<div class="lc-bar"><span style="width:${pct}%"></span></div>` : ''}
      ${c.stage === NEEDS ? `<button type="button" class="lc-approve" data-approve="${c.id}">Approve fix + reply</button>` : ''}
      ${c.stage === CONFIRMED ? `<div class="lc-stamp">✓ Confirmed by ${esc(first(t.contact))}${c.simulated ? ' · approval simulated' : ''}</div>` : ''}`;
  }

  function addLog(c, text, kind = '') {
    log.unshift({ time: clock(tick), provider: c.ticket.provider, ref: c.ticket.ref, text, kind });
    log = log.slice(0, 6);
  }

  function renderChrome() {
    $('#live-clock').textContent = clock(tick);
    $('#live-source-count').textContent = String(connectors.length);
    const lastFrom = cards.filter(c => c.arrivedAt === tick).map(c => c.ticket.provider);
    $('#live-sources').innerHTML = connectors.map(p => `<span class="live-src ${lastFrom.includes(p.id) ? 'is-emitting' : ''}" data-src="${esc(p.id)}" title="${esc(p.name)}">${mark(p.id)}</span>`).join('');
    $('#live-agents').innerHTML = ['Customer agent', 'Engineering agent', 'Billing agent'].map(name => {
      const active = cards.filter(c => ((c.stage >= 1 && c.stage < NEEDS) || c.stage === TOLD) && c.ticket.agent === name);
      return `<div class="live-agent agent-${agentKey(name)} ${active.length ? 'is-working' : ''}"><span class="agent-avatar">${esc(name[0])}A</span><span><strong>${esc(name)}</strong><small>${active.length ? `${active.length} active · ${esc(active[0].ticket.ref)}` : 'Idle'}</small></span></div>`;
    }).join('');
    const arriving = all.length - cards.length, working = cards.filter(c => c.stage < NEEDS).length, waiting = cards.filter(c => c.stage === NEEDS).length, told = cards.filter(c => c.stage === TOLD).length, done = cards.filter(c => c.stage === CONFIRMED).length;
    $('#live-counters').innerHTML = `<div><strong>${arriving}</strong><span>arriving</span></div><div><strong>${working}</strong><span>in progress</span></div><div class="${waiting ? 'is-waiting' : ''}"><strong>${waiting}</strong><span>need you</span></div><div><strong>${told}</strong><span>awaiting customer</span></div><div class="is-done"><strong>${done}</strong><span>confirmed</span></div>`;
    root.querySelectorAll('[data-count]').forEach(el => { el.textContent = String(cards.filter(c => c.stage === Number(el.dataset.count)).length); });
    $('#live-approve-all').hidden = handsFree || !waiting;
    $('#live-log').innerHTML = log.length ? log.map((e, i) => `<li class="${e.kind} ${i === 0 ? 'is-new' : ''}"><time>${e.time}</time>${mark(e.provider)}<span><b>${esc(e.ref)}</b> ${esc(e.text)}</span></li>`).join('') : '<li class="live-empty">Waiting for the first ticket…</li>';
    const latest = [...chats].reverse().find(m => m.type === 'update');
    if (latest) {
      const t = cards.find(c => c.id === latest.card).ticket;
      if ($('#live-spot').dataset.key !== `${latest.card}`) {
        $('#live-spot').dataset.key = `${latest.card}`;
        $('#live-spot').innerHTML = `<div class="spot-head">${mark(t.provider)}<span><b>Message to ${esc(t.contact)}</b> · ${esc(t.customer)} · in ${esc(provider(t.provider).name)} ${esc(t.ref)}</span><em>${esc(latest.label)}</em><button type="button" class="spot-open" data-card="${latest.card}">Full conversation</button></div>${Msg.html(t)}`;
        $('#live-spot').classList.remove('is-new'); void $('#live-spot').offsetWidth; $('#live-spot').classList.add('is-new');
      }
    } else if (!$('#live-spot').dataset.key) {
      $('#live-spot').innerHTML = `<div class="spot-empty"><strong>The customer update appears here</strong><span>After you approve a fix, the agent tells the customer what went wrong, why, what changed, and what they need to do, in plain words.</span></div>`;
    }
    const recent = chats.filter(m => m !== latest).slice(-3).reverse();
    $('#live-chat').innerHTML = recent.length ? recent.map((m, i) => `<li class="bubble from-${m.from} ${i === 0 ? 'is-new' : ''}"><div class="bubble-head">${mark(m.provider)}<b>${esc(m.name)}</b><span>${m.time}</span></div><p>${esc(m.type === 'update' ? Msg.preview(cards.find(c => c.id === m.card).ticket) : m.text)}</p></li>`).join('') : '<li class="live-empty">Acknowledgements and customer replies show up here.</li>';
    $('#live-play').textContent = finishedAt !== null ? '↺ Replay' : playing ? 'Ⅱ Pause' : (tick ? '▶ Resume' : '▶ Play');
    if (openThread !== null) renderThread();
  }

  // FLIP: animate every card from where it was to where it is now; new cards fly out of their source.
  function withFlip(mutate) {
    const before = new Map(cards.map(c => [c, c.el.isConnected ? c.el.getBoundingClientRect() : null]));
    mutate();
    if (reduced) return;
    for (const c of cards) {
      const was = before.get(c), now = c.el.getBoundingClientRect();
      if (!was) {
        const src = root.querySelector(`[data-src="${c.ticket.provider}"]`)?.getBoundingClientRect();
        if (src) c.el.animate([{ transform: `translate(${src.left + src.width / 2 - (now.left + now.width / 2)}px, ${src.top + src.height / 2 - (now.top + now.height / 2)}px) scale(.15)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
        continue;
      }
      const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: Math.abs(dx) > 20 ? 650 : 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  function burst(el) {
    if (reduced || !el.isConnected) return;
    const r = el.getBoundingClientRect(), colors = ['#3fa36b', '#2b71d4', '#ba852c', '#a33a55', '#5e6ad2'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span');
      p.className = 'live-particle';
      p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + 18}px;background:${colors[i % colors.length]}`;
      document.body.appendChild(p);
      const a = (Math.PI * 2 * i) / 14, d = 40 + Math.random() * 40;
      p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.3)`, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }

  function place(c) {
    const col = columns[c.stage];
    if (c.el.parentElement !== col) { if (c.stage === CONFIRMED) col.prepend(c.el); else col.appendChild(c.el); }
    c.el.className = `lcard s-${STAGES[c.stage].id}`;
    c.el.innerHTML = cardHTML(c);
  }

  function approve(c, simulated) {
    if (c.stage !== NEEDS) return;
    c.simulated = simulated;
    c.stage = TOLD;
    c.waited = 0;
    addLog(c, `${simulated ? 'approved (simulated)' : 'approved by you'} · fix shipped, ${isBug(c.ticket) ? 'root cause' : 'answer'} sent to ${first(c.ticket.contact)}`, 'is-resolved');
    say(c, 'agent', '', simulated ? 'Approved · simulated' : 'Approved by you', 'update');
  }

  const allDone = () => all.length && cards.length === all.length && cards.every(c => c.stage === CONFIRMED);

  function step() {
    tick++;
    const confirmedNow = [];
    withFlip(() => {
      const index = Math.floor((tick - 1) / ARRIVAL_GAP);
      if ((tick - 1) % ARRIVAL_GAP === 0 && index < all.length && !cards.some(c => c.id === index)) {
        const el = document.createElement('article');
        el.tabIndex = 0;
        el.dataset.card = String(index);
        const c = { id: index, ticket: all[index], stage: 0, progress: 0, el, arrivedAt: tick, waited: 0 };
        cards.push(c);
        addLog(c, `pulled from ${provider(c.ticket.provider).name}: ${c.ticket.title}`, 'is-arrival');
      }
      for (const c of cards) {
        if (c.arrivedAt === tick) continue;
        if (c.stage < NEEDS) {
          const lines = script(c.ticket, c.stage);
          if (c.progress < lines.length - 1) {
            c.progress++;
            if (c.stage === 2 && c.progress % 2 === 1) addLog(c, `${c.ticket.agent} · ${lines[c.progress]}`);
          } else {
            c.stage++; c.progress = 0;
            if (c.stage === 2) { addLog(c, `triaged → ${c.ticket.agent}`); say(c, 'agent', ackText(c.ticket), 'Auto-acknowledgement'); }
            if (c.stage === 4) addLog(c, `picked: ${c.ticket.options[c.ticket.recommended].title}`, 'is-idea');
            if (c.stage === NEEDS) addLog(c, `ready for approval: ${c.ticket.fix.title} + customer update`, 'is-waiting');
          }
        } else if (c.stage === NEEDS && handsFree) {
          if (++c.waited >= AUTO_APPROVE_AFTER) approve(c, true);
        } else if (c.stage === TOLD) {
          if (++c.waited >= CUSTOMER_REPLY_AFTER) {
            c.stage = CONFIRMED;
            say(c, 'customer', c.ticket.customerReply, 'Simulated reply');
            addLog(c, `${first(c.ticket.contact)} confirmed it works · ${c.ticket.closeout}`, 'is-resolved');
            confirmedNow.push(c);
          }
        }
      }
      cards.forEach(place);
      renderChrome();
    });
    confirmedNow.forEach(c => burst(c.el));
    if (allDone()) finish();
  }

  function finish() {
    finishedAt = tick;
    pause();
    const minutes = Math.round((tick * SIM_SECONDS_PER_TICK) / 60);
    const sources = new Set(all.map(t => t.provider)).size;
    const bugs = all.filter(isBug).length;
    const done = $('#live-done');
    done.innerHTML = `<div><strong>All ${all.length} customers confirmed the outcome</strong><span>${bugs} root causes explained in plain language · ${sources} sources replied in place · ${minutes} simulated minutes · 0 actions without approval</span></div><button type="button" class="primary-button" id="live-replay">↺ Replay</button>`;
    done.hidden = false;
    renderChrome();
  }

  function schedule() { clearTimeout(timer); if (playing) timer = setTimeout(() => { step(); schedule(); }, BASE_TICK / speed); }
  function play() { if (finishedAt !== null) { restart(); return; } if (!all.length) return; playing = true; renderChrome(); schedule(); }
  function pause() { playing = false; clearTimeout(timer); renderChrome(); }
  function restart() {
    pause();
    cards.forEach(c => c.el.remove());
    cards = []; log = []; chats = []; tick = 0; finishedAt = null;
    delete $('#live-spot').dataset.key;
    $('#live-done').hidden = true;
    if (thread?.open) thread.close();
    renderChrome();
    play();
  }

  // ---- conversation dialog --------------------------------------------------------------------
  function renderThread() {
    const c = cards.find(item => item.id === openThread);
    if (!c || !thread) return;
    const t = c.ticket, messages = chats.filter(m => m.card === c.id);
    document.getElementById('lt-ref').textContent = `${provider(t.provider).name.toUpperCase()} · ${t.ref} · ${t.customer.toUpperCase()}`;
    document.getElementById('lt-title').textContent = t.title;
    document.getElementById('lt-body').innerHTML = `
      <p class="lt-status">${esc(STAGES[c.stage].title)} · handled by <b class="agent-name agent-${agentKey(t.agent)}">${esc(t.agent)}</b></p>
      <ol class="lt-thread">
        <li class="bubble from-customer"><div class="bubble-head">${mark(t.provider)}<b>${esc(t.contact)}</b><span>original report</span></div><p>${esc(t.title)}</p></li>
        ${messages.map(m => `<li class="bubble from-${m.from} ${m.type === 'update' ? 'is-update' : ''}"><div class="bubble-head">${mark(m.provider)}<b>${esc(m.name)}</b><span>${m.time}</span>${m.label ? `<em>${esc(m.label)}</em>` : ''}</div>${bubbleBody(m)}</li>`).join('')}
        ${c.stage === NEEDS ? `<li class="bubble from-agent is-update is-draft"><div class="bubble-head">${mark(t.provider)}<b>Draft · not sent</b><em>Needs your approval</em></div>${Msg.html(t)}</li>` : ''}
        ${c.stage < NEEDS ? '<li class="lt-pending">The agent is still investigating. The root-cause update is drafted for your approval before anything is sent.</li>' : ''}
      </ol>
      <p class="lt-note">Sample conversation. In this demo nothing is posted to ${esc(provider(t.provider).name)}.</p>`;
  }
  function showThread(id) {
    if (!thread) return;
    openThread = id;
    renderThread();
    if (!thread.open) thread.showModal();
  }
  thread?.addEventListener('close', () => { openThread = null; });
  document.getElementById('lt-close')?.addEventListener('click', () => thread.close());

  // ---- events ---------------------------------------------------------------------------------
  function approveCards(list) {
    withFlip(() => { list.forEach(c => approve(c, false)); cards.forEach(place); renderChrome(); });
  }
  root.addEventListener('click', event => {
    const one = event.target.closest('[data-approve]');
    if (one) { const c = cards.find(item => item.id === Number(one.dataset.approve)); if (c) approveCards([c]); return; }
    if (event.target.closest('#live-approve-all')) { approveCards(cards.filter(c => c.stage === NEEDS)); return; }
    const sp = event.target.closest('[data-speed]');
    if (sp) { speed = Number(sp.dataset.speed); root.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(b === sp))); schedule(); return; }
    if (event.target.closest('#live-play')) { playing ? pause() : play(); return; }
    if (event.target.closest('#live-restart') || event.target.closest('#live-replay')) { restart(); return; }
    const card = event.target.closest('[data-card]');
    if (card) showThread(Number(card.dataset.card));
  });
  // The spotlight's "Full conversation" button carries data-card too, so it opens the same dialog.
  root.addEventListener('keydown', event => {
    const card = event.target.closest('[data-card]');
    if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showThread(Number(card.dataset.card)); }
  });
  $('#live-handsfree').addEventListener('change', event => { handsFree = event.target.checked; renderChrome(); });

  // ---- view switching (live board ⇄ step by step) ---------------------------------------------
  function setMode(mode, push = true) {
    const live = mode !== 'steps';
    document.body.classList.toggle('mode-live', live);
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.mode === 'live') === live)));
    if (!live) pause();
    if (push) { const url = new URL(location.href); if (live) url.searchParams.delete('mode'); else url.searchParams.set('mode', 'steps'); history.replaceState(null, '', url); }
  }
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });

  const params = new URLSearchParams(location.search);
  const startMode = params.has('step') || params.get('mode') === 'steps' ? 'steps' : 'live';
  setMode(startMode, false);
  renderChrome();
  fetch('/api/connectors', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Connectors are unavailable.')))
    .then(result => {
      connectors = result.connectors || [];
      all = result.tickets || [];
      renderChrome();
      if (startMode === 'live' && params.get('autoplay') !== '0') setTimeout(play, reduced ? 0 : 700);
    })
    .catch(error => { $('.live-head h1').textContent = 'Could not load the sample tickets.'; $('.live-head p:last-child').textContent = `${error.message} Refresh to try again.`; });
})();
