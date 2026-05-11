import { content } from '../dom.mjs';
import { productLogsPath } from '../router.mjs';
import { statusPill } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { state } from '../state.mjs';
import { esc, fromIsoDate } from '../utils.mjs';

export function renderLogDetail() {
  const log = state.selectedLog;

  if (!log) {
    setShell('Log not found', 'The requested event log does not exist in the current range.', 'Workspace / Log detail');
    content().innerHTML = `<section class="panel"><div class="panel-body muted">Log event not found. Try widening the date range.</div></section>`;
    return;
  }

  setShell(
    `${log.event_name} event`,
    'Full event audit detail: request payload, Meta response, attribution, and transaction fields.',
    `Workspace / ${log.market_key} / ${log.product_key} / Logs / ${log.id}`
  );

  content().innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Event identity</h2>
        <button data-route="${esc(productLogsPath(log.market_key, log.product_key))}">Back to product logs</button>
      </div>
      <div class="panel-body detail-grid">
        <section class="kv">
          <div><span>Market / Product</span><strong>${esc(log.market_key)} / ${esc(log.product_key)}</strong></div>
          <div><span>Created at</span><strong>${esc(fromIsoDate(log.created_at))}</strong></div>
          <div><span>Event</span><strong>${esc(log.event_name)}</strong><p class="muted mono">${esc(log.event_id)}</p></div>
          <div><span>Meta status</span>${statusPill(log.meta_status)}<p class="muted mini">events_received: ${esc(log.events_received ?? '-')}</p></div>
          <div><span>User / Transaction</span><strong>${esc(log.username || log.user_id || '-')}</strong><p class="muted mono">${esc(log.txn_id || '-')}</p></div>
          <div><span>Attribution</span><p class="muted mini">ref: ${esc(log.ref || '-')}</p><p class="muted mini">pub_id: ${esc(log.pub_id || '-')}</p><p class="muted mini">channel: ${esc(log.channel || '-')}</p></div>
          <div><span>Network</span><p class="muted mini">client_ip: ${esc(log.client_ip_address || '-')}</p><p class="muted mini">request_ip: ${esc(log.request_ip || '-')}</p></div>
        </section>
        <section class="panel" style="box-shadow:none">
          <div class="panel-head"><h2>Full payload</h2><span class="muted mono">${esc(log.fbtrace_id || 'no fbtrace')}</span></div>
          <div class="panel-body"><pre>${esc(JSON.stringify(log, null, 2))}</pre></div>
        </section>
      </div>
    </section>
  `;
}
