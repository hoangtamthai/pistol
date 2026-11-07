// Renders the customer update the agent sends, in a fixed easy-to-scan structure.
// Shared by the live board and the step-by-step view so the message reads the same everywhere.
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const labels = {
    bug: ['What happened', 'Why it happened', 'What we changed', 'What you need to do'],
    question: ['You asked', 'The answer', 'What we did', 'What you need to do'],
  };
  const firstName = name => String(name || '').split(' ')[0];

  function html(ticket, { compact = false } = {}) {
    const m = ticket.message, l = labels[m.kind] || labels.bug;
    const rows = [['summary', m.summary], ['why', m.why], ['changed', m.changed], ['you', m.youDo]];
    return `<div class="cmsg cmsg-${esc(m.kind)} ${compact ? 'is-compact' : ''}">
      <p class="cmsg-greet">Hi ${esc(firstName(ticket.contact))}, ${m.kind === 'bug' ? 'here is what went wrong and what we changed.' : 'here is the answer to your question.'}</p>
      <dl>${rows.map(([key, text], i) => `<div class="cmsg-row r-${key}"><dt>${esc(l[i])}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl>
    </div>`;
  }

  /** One-line preview, used where space is tight. */
  function preview(ticket) {
    const m = ticket.message;
    return `${(labels[m.kind] || labels.bug)[1]}: ${m.why}`;
  }

  window.ContextMessage = { html, preview, labels, isBug: ticket => ticket.message?.kind === 'bug' };
})();
