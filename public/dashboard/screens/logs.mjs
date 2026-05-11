import { $, content } from '../dom.mjs';
import { state } from '../state.mjs';
import { metrics, statusPill, table } from '../components.mjs';
import { logPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, fromIsoDate } from '../utils.mjs';

function filterLogs(logs) {
  let output = logs;

  if (state.selectedProduct) {
    output = output.filter((log) => log.market_key === state.selectedProduct.market_key && log.product_key === state.selectedProduct.product_key);
  }
  if (state.filters.status) {
    output = output.filter((log) => log.meta_status === state.filters.status);
  }
  if (state.filters.event) {
    output = output.filter((log) => String(log.event_name || '').toLowerCase().includes(state.filters.event.toLowerCase()));
  }
  if (state.filters.ref) {
    const needle = state.filters.ref.toLowerCase();
    output = output.filter((log) => [log.ref, log.pub_id, log.channel].some((value) => String(value || '').toLowerCase().includes(needle)));
  }
  if (state.filters.search) {
    const needle = state.filters.search.toLowerCase();
    output = output.filter((log) => [
      log.event_id,
      log.txn_id,
      log.user_id,
      log.username,
      log.fbtrace_id,
      log.market_key,
      log.product_key,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }

  return output;
}

export function renderLogs(ctx) {
  setShell(
    state.selectedProduct ? `Logs: ${state.selectedProduct.product_key}` : 'Logs',
    'Filter event fields, inspect payloads, and verify Meta response status.',
    state.selectedProduct
      ? `Workspace / ${state.selectedProduct.market_key} / ${state.selectedProduct.product_key} / Logs`
      : 'Workspace / Logs'
  );

  const logs = filterLogs(state.logs);
  content().innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Filters</h2><span class="muted">Date format dd-mm-yyyy</span></div>
      <div class="panel-body filters">
        <input id="filterSearch" value="${esc(state.filters.search || '')}" placeholder="event_id, txn_id, user_id, fbtrace">
        <select id="filterStatus"><option value="">All status</option><option>received</option><option>error</option><option>unknown</option></select>
        <input id="filterEvent" value="${esc(state.filters.event || '')}" placeholder="event_name">
        <input id="filterRef" value="${esc(state.filters.ref || '')}" placeholder="ref / pub_id / channel">
        <button id="applyFilters" class="primary">Apply</button>
      </div>
    </section>
    ${metrics([
      { label: 'Visible logs', value: logs.length, note: 'After filters' },
      { label: 'Received', value: logs.filter((log) => log.meta_status === 'received').length, note: 'Meta accepted' },
      { label: 'Errors', value: logs.filter((log) => log.meta_status === 'error').length, note: 'Needs action' },
      { label: 'Unknown', value: logs.filter((log) => log.meta_status === 'unknown').length, note: 'Incomplete response' },
      { label: 'Purchases', value: logs.filter((log) => log.event_name === 'Purchase').length, note: 'Conversion events' },
    ])}
    ${table(['Time', 'Market / Product', 'Event', 'Status', 'User / Txn', 'Value', 'Trace'], logs.map((log) => `
      <tr>
        <td>${fromIsoDate(log.created_at)}<div class="muted">${new Date(log.created_at).toLocaleTimeString()}</div></td>
        <td>${esc(log.market_display_name || log.market_key)} / ${esc(log.product_display_name || log.product_key)}<div class="muted mono">${esc(log.market_key)} / ${esc(log.product_key)}</div></td>
        <td><span class="link" data-route="${esc(logPath(log.market_key, log.product_key, log.id))}">${esc(log.event_name)}</span><div class="muted mono">${esc(log.event_id)}</div></td>
        <td>${statusPill(log.meta_status)}</td>
        <td>${esc(log.username || log.user_id || '-')}<div class="muted mono">${esc(log.txn_id || '-')}</div></td>
        <td>${log.value ? `${Number(log.value).toFixed(2)} ${esc(log.currency || '')}` : '-'}</td>
        <td class="mono">${esc(log.fbtrace_id || '-')}</td>
      </tr>
    `))}
  `;

  $('filterStatus').value = state.filters.status || '';
  $('applyFilters').onclick = () => {
    state.filters = {
      search: $('filterSearch').value.trim(),
      status: $('filterStatus').value,
      event: $('filterEvent').value.trim(),
      ref: $('filterRef').value.trim(),
    };
    ctx.render();
  };
}
