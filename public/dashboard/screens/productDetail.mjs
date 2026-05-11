import { $, content } from '../dom.mjs';
import { api } from '../api.mjs';
import { state } from '../state.mjs';
import { chartLegend, metrics, statusPill, table } from '../components.mjs';
import { loadCompareChart } from '../chart.mjs';
import { logPath, productLogsPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, fromIsoDate, summarize } from '../utils.mjs';

async function saveCatalog(product, ctx) {
  await api(`/v1/admin/markets/${product.market_key}/products/${product.product_key}`, {
    method: 'PATCH',
    body: JSON.stringify({
      display_name: $('catName').value,
      category: $('catCategory').value,
      status: $('catStatus').value,
      owner: $('catOwner').value,
      notes: $('catNotes').value,
    }),
  });
  await ctx.loadData();
}

export function renderProductDetail(ctx) {
  const product = state.selectedProduct;
  if (!product) {
    ctx.setScreen('products');
    return;
  }

  const logs = state.logs.filter((log) => log.market_key === product.market_key && log.product_key === product.product_key);
  const summary = summarize([{
    total_logs: logs.length,
    received_logs: logs.filter((log) => log.meta_status === 'received').length,
    error_logs: logs.filter((log) => log.meta_status === 'error').length,
  }]);

  setShell(
    product.display_name || product.product_key,
    'Product-level statistics, catalog settings, comparison chart, and latest event logs.',
    `Workspace / ${product.market_key} / ${product.product_key}`
  );

  content().innerHTML = `
    ${metrics([
      { label: 'Events', value: summary.total, note: 'This product' },
      { label: 'Received', value: summary.received, note: 'Meta accepted' },
      { label: 'Errors', value: summary.errors, note: 'Check response' },
      { label: 'Error rate', value: summary.errorRate, note: 'Current scope' },
      { label: 'Status', value: product.status || '-', note: product.category || 'Category unset' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Comparison</h2><button data-route="${esc(productLogsPath(product.market_key, product.product_key))}">Open logs</button></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          ${chartLegend()}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Catalog</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><label>Display name</label><input id="catName" value="${esc(product.display_name || '')}"></div>
            <div><label>Category</label><input id="catCategory" value="${esc(product.category || '')}"></div>
            <div><label>Status</label><select id="catStatus"><option>active</option><option>paused</option><option>archived</option></select></div>
            <div><label>Owner</label><input id="catOwner" value="${esc(product.owner || '')}"></div>
            <div class="full"><label>Notes</label><input id="catNotes" value="${esc(product.notes || '')}"></div>
          </div>
          <div class="actions"><button id="saveCatalog" class="primary">Save catalog</button></div>
        </div>
      </section>
    </div>
    <div style="height:14px"></div>
    ${table(['Time', 'Event', 'Status', 'User / Txn', 'Value', 'Trace'], logs.map((log) => `
      <tr>
        <td>${fromIsoDate(log.created_at)}</td>
        <td><span class="link" data-route="${esc(logPath(log.market_key, log.product_key, log.id))}">${esc(log.event_name)}</span><div class="muted mono">${esc(log.event_id)}</div></td>
        <td>${statusPill(log.meta_status)}</td>
        <td>${esc(log.user_id || '-')}<div class="muted mono">${esc(log.txn_id || '-')}</div></td>
        <td>${log.value || '-'}</td>
        <td class="mono">${esc(log.fbtrace_id || '-')}</td>
      </tr>
    `))}
  `;

  $('catStatus').value = product.status || 'active';
  $('saveCatalog').onclick = () => saveCatalog(product, ctx);
  loadCompareChart(product);
}
