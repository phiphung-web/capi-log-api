import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { chartLegend, metrics, statusPill, table } from '../components.mjs';
import { drawCompareChart } from '../chart.mjs';
import { setShell } from '../shell.mjs';
import { esc, summarize } from '../utils.mjs';

export function renderAnalytics() {
  const summary = summarize(state.markets);
  setShell('Analytics', 'Daily comparison view for current period, previous period, and same weekday last week.', 'Workspace / Analytics');

  content().innerHTML = `
    ${metrics([
      { label: 'Current events', value: summary.total, note: 'Current date range' },
      { label: 'Meta received', value: summary.received, note: 'Accepted callbacks' },
      { label: 'Error rate', value: summary.errorRate, note: 'Across visible markets' },
      { label: 'Best product', value: state.products[0]?.product_key || '-', note: 'By visible volume' },
      { label: 'Raw retention', value: '30d', note: 'Detailed event payload' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Daily comparison</h2><span class="muted">3-line attribution trend</span></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          ${chartLegend(['Current', 'Previous period', 'Same weekday last week'])}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Operating notes</h2></div>
        <div class="panel-body kv">
          <div><span>Raw detail</span><strong>Keep full payload for 1 month</strong></div>
          <div><span>Aggregates</span><strong>Keep daily totals for long-term reporting</strong></div>
          <div><span>Attribution</span><strong>Break down by market, product, event, ref, pub_id, channel</strong></div>
        </div>
      </section>
    </div>
    <div style="height:14px"></div>
    ${table(['Product', 'Market', 'Events', 'Received', 'Errors', 'Status'], state.products.map((product) => `
      <tr>
        <td><span class="link" data-product="${esc(product.market_key)}:${esc(product.product_key)}">${esc(product.display_name || product.product_key)}</span><div class="muted mono">${esc(product.product_key)}</div></td>
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
