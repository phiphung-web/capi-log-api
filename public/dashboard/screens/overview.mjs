import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { chartLegend, marketCards, metrics, statusPill, table } from '../components.mjs';
import { drawCompareChart } from '../chart.mjs';
import { productPath, productsComparePath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, summarize } from '../utils.mjs';

export function renderOverview() {
  const summary = summarize(state.markets);
  const overview = state.overview || {};
  const topProducts = [...state.products]
    .sort((a, b) => Number(b.error_logs || 0) - Number(a.error_logs || 0) || Number(b.total_logs || 0) - Number(a.total_logs || 0))
    .slice(0, 8);

  setShell('Trang chủ', 'Tổng quan thị trường, sản phẩm, log và trạng thái Meta CAPI.', 'Workspace / Trang chủ');

  content().innerHTML = `
    ${metrics([
      { label: 'Markets', value: overview.total_markets ?? state.markets.length, note: 'Accessible scopes' },
      { label: 'Products', value: overview.total_products ?? state.products.length, note: 'Visible products' },
      { label: 'Total logs', value: overview.total_events ?? summary.total, note: 'Selected range' },
      { label: 'Received', value: overview.received_events ?? summary.received, note: 'Meta accepted' },
      { label: 'Errors', value: overview.error_events ?? summary.errors, note: 'Needs review' },
      { label: 'Unknown', value: overview.unknown_events ?? '-', note: 'Incomplete response' },
      { label: 'Error rate', value: overview.total_events ? `${Math.round((Number(overview.error_events || 0) / Number(overview.total_events)) * 100)}%` : summary.errorRate, note: 'Across visible scope' },
      { label: 'Unique users', value: overview.unique_users ?? '-', note: 'Distinct user_id' },
      { label: 'Total value', value: Number(overview.total_value || 0).toFixed(2), note: 'From log value' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Market health</h2><button class="primary" data-route="/dashboard/markets">Open markets</button></div>
        <div class="panel-body">${marketCards(state.markets)}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Compare products</h2><button data-route="${esc(productsComparePath())}">Open compare</button></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          ${chartLegend()}
        </div>
      </section>
    </div>
    <div style="height:14px"></div>
    ${table(['Product', 'Market', 'Events', 'Received', 'Errors', 'Status'], topProducts.map((product) => `
      <tr>
        <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.display_name || product.product_key)}</span><div class="muted mono">${esc(product.product_key)}</div></td>
        <td class="mono">${esc(product.market_key)}</td>
        <td>${esc(product.total_logs || 0)}</td>
        <td>${esc(product.received_logs || 0)}</td>
        <td>${esc(product.error_logs || 0)}</td>
        <td>${statusPill(product.status)}</td>
      </tr>
    `))}
  `;

  drawCompareChart();
}
