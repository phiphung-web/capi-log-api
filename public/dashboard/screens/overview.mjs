import { $, content } from '../dom.mjs';
import { state } from '../state.mjs';
import { chartLegend, marketCards, metrics, statusPill, table } from '../components.mjs';
import { drawCompareChart } from '../chart.mjs';
import { productPath, productsComparePath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, fromIsoDate, summarize } from '../utils.mjs';

function numberValue(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function percent(part, total) {
  return Number(total) ? `${Math.round((Number(part || 0) / Number(total)) * 100)}%` : '0%';
}

export function renderOverview() {
  const summary = summarize(state.markets);
  const overview = state.overview || {};
  const topProducts = [...state.products]
    .sort((a, b) => Number(b.error_logs || 0) - Number(a.error_logs || 0) || Number(b.total_logs || 0) - Number(a.total_logs || 0))
    .slice(0, 8);
  const recentLogs = [...state.logs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);
  const totalEvents = Number(overview.total_events ?? summary.total ?? 0);
  const receivedEvents = Number(overview.received_events ?? summary.received ?? 0);
  const errorEvents = Number(overview.error_events ?? summary.errors ?? 0);
  const unknownEvents = Number(overview.unknown_events ?? 0);
  const issueEvents = errorEvents + unknownEvents;
  const receiveRate = percent(receivedEvents, totalEvents);
  const issueRate = percent(issueEvents, totalEvents);
  const errorRate = percent(errorEvents, totalEvents);

  setShell('Trang chủ', 'Tổng quan dữ liệu đã nhận, trạng thái xử lý và luồng Market / Product / Log.', 'Workspace / Trang chủ');

  content().innerHTML = `
    <section class="ops-hero">
      <div>
        <span class="eyebrow">Live intake</span>
        <h2>Market / Product / Meta CAPI log flow</h2>
        <p>Request từ đối tác được xác thực, bóc dữ liệu Meta callback, đồng bộ market/product, lưu raw payload và hiển thị báo cáo theo thời gian.</p>
      </div>
      <div class="ops-score">
        <span>Meta received</span>
        <strong>${receiveRate}</strong>
        <p class="muted mini">${numberValue(receivedEvents)} / ${numberValue(totalEvents)} events accepted</p>
      </div>
    </section>

    <section class="workflow ops-flow">
      <article class="step-card"><span>01</span><strong>Authenticate</strong><p>Validate Bearer or X-API-Token before any log is accepted.</p></article>
      <article class="step-card"><span>02</span><strong>Parse payload</strong><p>Read metadata or raw Meta request.data[0] and extract event fields.</p></article>
      <article class="step-card"><span>03</span><strong>Sync catalog</strong><p>Create or update market and product keys detected from the endpoint.</p></article>
      <article class="step-card"><span>04</span><strong>Report</strong><p>Power overview, product detail, logs, trends, and comparison views.</p></article>
    </section>

    ${metrics([
      { label: 'Total logs', value: numberValue(totalEvents), note: 'All events in selected range' },
      { label: 'Meta received', value: numberValue(receivedEvents), note: `${receiveRate} accepted` },
      { label: 'Needs review', value: numberValue(issueEvents), note: `${issueRate} error or unknown` },
      { label: 'Errors', value: numberValue(errorEvents), note: `${errorRate} failed response` },
      { label: 'Unique users', value: numberValue(overview.unique_users ?? 0), note: 'Distinct user_id' },
      { label: 'Total value', value: Number(overview.total_value || 0).toFixed(2), note: 'Sum of value field' },
    ])}

    <section class="health-board">
      <article><span>Markets</span><strong>${numberValue(overview.total_markets ?? state.markets.length)} active data scopes</strong></article>
      <article><span>Products</span><strong>${numberValue(overview.total_products ?? state.products.length)} visible products</strong></article>
      <article><span>Unknown</span><strong>${numberValue(unknownEvents)} events need response check</strong></article>
      <article><span>Pipeline</span><strong>Auth -> Parse -> Catalog -> Report</strong></article>
    </section>

    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Market health</h2><button class="primary" data-route="/dashboard/markets">Open markets</button></div>
        <div class="panel-body">${marketCards(state.markets)}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Compare products</h2><button data-route="${esc(productsComparePath())}">Open compare</button></div>
        <div class="panel-body">
          <div class="chart-toolbar">
            <label>
              <span>Chart type</span>
              <select id="overviewChartType">
                <option value="area">Area</option>
                <option value="line">Line</option>
                <option value="bar">Bar</option>
              </select>
            </label>
          </div>
          <canvas id="compareChart" class="chart"></canvas>
          ${chartLegend()}
        </div>
      </section>
    </div>
    <div style="height:14px"></div>
    <div class="split wide-left">
      ${table(['Latest log', 'Market / Product', 'Status', 'User / Txn', 'Ref / Pub', 'Trace'], recentLogs.map((log) => `
        <tr>
          <td>${fromIsoDate(log.created_at)}<div class="muted mini">${new Date(log.created_at).toLocaleTimeString()}</div></td>
          <td>${esc(log.market_display_name || log.market_key)} / ${esc(log.product_display_name || log.product_key)}<div class="muted mono">${esc(log.market_key)} / ${esc(log.product_key)}</div></td>
          <td>${statusPill(log.meta_status)}</td>
          <td>${esc(log.username || log.user_id || '-')}<div class="muted mono">${esc(log.txn_id || '-')}</div></td>
          <td>${esc(log.ref || '-')}<div class="muted mono">${esc(log.pub_id || '-')}</div></td>
          <td class="mono">${esc(log.fbtrace_id || '-')}</td>
        </tr>
      `))}
      ${table(['Product', 'Market', 'Events', 'Received', 'Errors', 'Status'], topProducts.map((product) => `
        <tr>
          <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.display_name || product.product_key)}</span><div class="muted mono">${esc(product.product_key)}</div></td>
          <td class="mono">${esc(product.market_key)}</td>
          <td>${numberValue(product.total_logs || 0)}</td>
          <td>${numberValue(product.received_logs || 0)}</td>
          <td>${numberValue(product.error_logs || 0)}</td>
          <td>${statusPill(product.status)}</td>
        </tr>
      `))}
    </div>
  `;

  $('overviewChartType').value = state.overviewChartType || 'area';
  $('overviewChartType').onchange = () => {
    state.overviewChartType = $('overviewChartType').value;
    drawCompareChart(undefined, state.overviewChartType);
  };

  drawCompareChart(undefined, state.overviewChartType || 'area');
}
