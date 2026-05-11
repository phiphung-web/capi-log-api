import { errorRate, esc } from './utils.mjs';

export function statusPill(status) {
  return `<span class="status ${esc(status || 'unknown')}">${esc(status || 'unknown')}</span>`;
}

export function metrics(items) {
  return `<section class="grid metrics">${items.map((item) => `
    <article class="metric">
      <span>${esc(item.label)}</span>
      <strong>${esc(item.value)}</strong>
      ${item.note ? `<p class="muted mini">${esc(item.note)}</p>` : ''}
    </article>
  `).join('')}</section>`;
}

export function table(headers, rows) {
  const body = rows.length
    ? rows.join('')
    : `<tr><td colspan="${headers.length}" class="muted">No data for the selected scope.</td></tr>`;

  return `
    <div class="panel">
      <div class="table-scroll">
        <table>
          <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

export function entityStats(total, received, errors) {
  return `
    <div class="entity-stats">
      <div><span>Events</span><strong>${esc(total || 0)}</strong></div>
      <div><span>Received</span><strong>${esc(received || 0)}</strong></div>
      <div><span>Error rate</span><strong>${esc(errorRate(total, errors))}</strong></div>
    </div>
  `;
}

export function marketCards(markets) {
  return `<section class="entity-grid">${markets.map((market) => `
    <article class="entity-card">
      <div class="entity-top">
        <div class="entity-title">
          <strong><span class="link" data-market="${esc(market.market_key)}">${esc(market.display_name || market.market_key)}</span></strong>
          <span class="mono">${esc(market.market_key)} / ${esc(market.region || 'region unset')}</span>
        </div>
        ${statusPill(market.status)}
      </div>
      ${entityStats(market.total_logs, market.received_logs, market.error_logs)}
    </article>
  `).join('')}</section>`;
}

export function productCards(products) {
  return `<section class="entity-grid">${products.map((product) => `
    <article class="entity-card">
      <div class="entity-top">
        <div class="entity-title">
          <strong><span class="link" data-product="${esc(product.market_key)}:${esc(product.product_key)}">${esc(product.display_name || product.product_key)}</span></strong>
          <span class="mono">${esc(product.market_key)} / ${esc(product.product_key)} / ${esc(product.category || 'uncategorized')}</span>
        </div>
        ${statusPill(product.status)}
      </div>
      ${entityStats(product.total_logs, product.received_logs, product.error_logs)}
    </article>
  `).join('')}</section>`;
}

export function marketRows(markets, compact = false) {
  return table(['Market', 'Products', 'Events', 'Received', 'Error rate', 'Status'], markets.map((market) => `
    <tr>
      <td><span class="link" data-market="${esc(market.market_key)}">${esc(market.display_name || market.market_key)}</span><div class="muted mono">${esc(market.market_key)}</div></td>
      <td>${esc(market.total_products || 0)}</td>
      <td>${esc(market.total_logs || 0)}</td>
      <td>${esc(market.received_logs || 0)}</td>
      <td>${errorRate(market.total_logs, market.error_logs)}</td>
      <td>${statusPill(market.status)}</td>
    </tr>
  `)).replace('class="panel"', compact ? 'class="panel" style="box-shadow:none"' : 'class="panel"');
}

export function chartLegend(labels = ['Current', 'Previous', 'Last week']) {
  const colors = ['#0f766e', '#b42318', '#9a6700'];
  return `
    <div class="legend">
      ${labels.map((label, index) => `<span style="--dot:${colors[index]}">${esc(label)}</span>`).join('')}
    </div>
  `;
}
