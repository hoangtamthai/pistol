// SYNTHETIC DEMO: animates simulated agents working through mock tickets pulled from
// connected sources. Nothing is sent, changed, or deployed; every ticket stops at a human approval.
(() => {
  'use strict';
  const root = document.getElementById('autopilot');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TICK = reduced ? 2600 : 1400, MAX_VISIBLE = 6;
  let connectors = [], tickets = [], cards = [], next = 0, tickCount = 0, timer = null, holdUntil = 0, pulse = null;

  const byId = id => connectors.find(item => item.id === id) || { id, name: id, mark: id.slice(0, 2) };
  const stages = ticket => [
    ['Picked up', 'Pulled in automatically · nobody had to assign it'],
    ['Triaged', `${ticket.category} · ${ticket.severity} · routed to ${ticket.agent}`],
    ['Investigating', ticket.action],
    ['Needs your approval', ticket.outcome],
  ];
  const stageClass = stage => ['pulled', 'triaged', 'working', 'waiting'][stage];

  function counts() {
    return {
      pulled: next,
      working: cards.filter(card => card.stage > 0 && card.stage < 3).length,
      waiting: cards.filter(card => card.stage === 3).length + Math.max(0, next - cards.length),
    };
  }

  function render() {
    const c = counts();
    root.querySelector('.ap-sources').innerHTML = connectors.map(item => `<span class="ap-mark source-mark source-${esc(item.id)} ${pulse === item.id ? 'is-pulsing' : ''}" title="${esc(item.name)}">${esc(item.mark)}</span>`).join('');
    root.querySelector('.ap-stats').innerHTML = `<div><strong>${c.pulled}</strong><span>pulled</span></div><div><strong>${c.working}</strong><span>in progress</span></div><div><strong>${c.waiting}</strong><span>need you</span></div>`;
    const feed = root.querySelector('.ap-feed');
    feed.innerHTML = cards.length ? cards.map(card => {
      const t = card.ticket, s = stages(t)[card.stage], p = byId(t.provider);
      return `<button type="button" class="ap-card ap-${stageClass(card.stage)} ${card.fresh && !reduced ? 'is-fresh' : ''}" data-ap="${esc(t.ref)}" aria-label="${esc(`${t.title}. ${s[0]}. Open agent timeline.`)}">
        <span class="ap-card-top"><span class="source-mark source-${esc(t.provider)}" aria-hidden="true">${esc(p.mark)}</span><span class="ap-ref">${esc(p.name)} · ${esc(t.ref)}</span></span>
        <strong class="ap-title">${esc(t.title)}</strong>
        <span class="ap-meta">${esc(t.customer)} · ${card.stage ? esc(t.agent) : 'Unassigned'}</span>
        <span class="ap-stage"><i aria-hidden="true"></i><b>${esc(s[0])}</b> ${esc(s[1])}</span>
        <span class="ap-progress" aria-hidden="true">${[0, 1, 2, 3].map(i => `<span class="${i <= card.stage ? 'on' : ''}"></span>`).join('')}</span>
      </button>`;
    }).join('') : '<p class="ap-empty">Listening for new tickets…</p>';
    cards.forEach(card => { card.fresh = false; });
    const done = next >= tickets.length && cards.every(card => card.stage === 3);
    root.querySelector('.ap-status').textContent = done ? 'All caught up' : 'Running';
    root.classList.toggle('is-done', done);
  }

  function tick() {
    if (document.hidden || !tickets.length) return;
    if (holdUntil) {
      if (Date.now() < holdUntil) return;
      holdUntil = 0; cards = []; next = 0; tickCount = 0;
    }
    tickCount++;
    pulse = null;
    // Every in-flight ticket moves one stage per tick; a new one arrives every other tick.
    cards.forEach(card => { if (card.stage < 3) card.stage++; });
    if (next < tickets.length && tickCount % 2 === 1) {
      const ticket = tickets[next++];
      cards.unshift({ ticket, stage: 0, started: tickCount, fresh: true });
      pulse = ticket.provider;
      if (cards.length > MAX_VISIBLE) cards.pop();
    }
    if (next >= tickets.length && cards.every(card => card.stage === 3)) holdUntil = Date.now() + 9000;
    render();
  }

  function openTimeline(ref) {
    const card = cards.find(item => item.ticket.ref === ref);
    if (!card) return;
    const t = card.ticket, dialog = document.getElementById('detail');
    document.getElementById('detail-ref').textContent = `AUTOPILOT / ${byId(t.provider).name.toUpperCase()} · ${t.ref}`;
    document.getElementById('detail-title').textContent = t.title;
    document.getElementById('detail-body').innerHTML = `<span class="status-pill ${card.stage === 3 ? 'amber' : ''}">Simulated agent run · sample ticket</span>
      <p class="body-intro">${esc(t.customer)} reported this in ${esc(byId(t.provider).name)}. Context pulled it in automatically and the ${esc(t.agent.toLowerCase())} took it from there.</p>
      <ol class="ap-timeline">${stages(t).map(([title, text], i) => `<li class="${i < card.stage || card.stage === 3 && i === 3 ? 'done' : i === card.stage ? 'current' : ''}"><strong>${esc(title)}</strong><span>${esc(text)}</span></li>`).join('')}</ol>
      <p class="body-intro">The agent stops at a proposal. Nothing is sent to the customer, changed in ${esc(byId(t.provider).name)}, or deployed until a person approves it.</p>
      <div class="dialog-actions"><button type="button" class="button-secondary" data-action="close">Close</button><a class="button-primary" href="/context/issues">Review in All issues</a></div>`;
    dialog.classList.remove('wide');
    if (!dialog.open) dialog.showModal();
  }

  function syncVisibility() {
    const away = document.getElementById('away-tab')?.getAttribute('aria-selected') !== 'false';
    root.hidden = !away || !tickets.length;
  }

  root.innerHTML = `<div class="ap-head"><p class="eyebrow">AUTOPILOT · SIMULATED</p><span class="ap-live"><i aria-hidden="true"></i><span class="ap-status">Running</span></span></div>
    <h2>Agents pick up every new ticket</h2>
    <p class="ap-sub">Watching connected sources. Each ticket is triaged, investigated, and brought to you as a proposal.</p>
    <div class="ap-sources" aria-label="Watched sources"></div>
    <div class="ap-stats" role="status" aria-live="off"></div>
    <div class="ap-feed"></div>
    <a class="ap-flow-link" href="/context/autopilot">Watch the full flow: research, brainstorm, fix →</a>
    <p class="ap-foot">Nothing is sent or deployed without your approval. <a href="/context/issues">All issues →</a></p>`;
  root.hidden = true;
  root.addEventListener('click', event => {
    const card = event.target.closest('[data-ap]');
    if (card) openTimeline(card.dataset.ap);
  });
  document.getElementById('autopilot-tab')?.addEventListener('click', () => location.assign('/context/autopilot'));
  new MutationObserver(syncVisibility).observe(document.getElementById('away-tab'), { attributes: true, attributeFilter: ['aria-selected'] });

  fetch('/api/connectors', { cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject(new Error('Unavailable')))
    .then(result => {
      connectors = result.connectors || [];
      tickets = result.tickets || [];
      syncVisibility();
      render();
      timer = setInterval(tick, TICK);
      setTimeout(tick, 600);
    })
    .catch(() => { root.hidden = true; });
  window.addEventListener('pagehide', () => clearInterval(timer));
})();
