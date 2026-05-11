import { content } from '../dom.mjs';
import { metrics, productCards, statusPill, table } from '../components.mjs';
import { marketProductsPath, productPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { state } from '../state.mjs';
import { esc, summarize } from '../utils.mjs';

export function renderMarketDetail(ctx) {
  const market = state.markets.find((item) => item.market_key === state.selectedMarket);
  const products = state.products.filter((product) => product.market_key === state.selectedMarket);
  const summary = summarize([market || {}]);

  if (!market) {
    content().innerHTML = `<section class="panel"><div class="panel-body muted">Market not found.</div></section>`;
    return;
  }

  setShell(
    market.display_name || market.market_key,
    'Market detail with product catalog and market-level CAPI health.',
    `Workspace / Markets / ${market.market_key}`
  );

  content().innerHTML = `
    ${metrics([
      { label: 'Products', value: products.length, note: 'Inside this market' },
      { label: 'Events', value: summary.total, note: 'Selected range' },
      { label: 'Received', value: summary.received, note: 'Meta accepted' },
      { label: 'Errors', value: summary.errors, note: 'Needs review' },
      { label: 'Status', value: market.status || '-', note: market.region || 'Region unset' },
    ])}
    <section class="panel">
      <div class="panel-head">
        <h2>Market catalog</h2>
        ${statusPill(market.status)}
      </div>
      <div class="panel-body kv">
        <div><span>Market key</span><strong class="mono">${esc(market.market_key)}</strong></div>
        <div><span>Region</span><strong>${esc(market.region || '-')}</strong></div>
        <div><span>Product route</span><strong class="mono">${esc(marketProductsPath(market.market_key))}</strong></div>
      </div>
    </section>
    <div style="height:14px"></div>
    <section class="panel">
      <div class="panel-head"><h2>Products in ${esc(market.market_key)}</h2><button class="primary" data-route="${esc(marketProductsPath(market.market_key))}">Open products</button></div>
      <div class="panel-body">${productCards(products)}</div>
    </section>
    ${table(['Product', 'Category', 'Events', 'Received', 'Errors', 'Status'], products.map((product) => `
      <tr>
        <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.display_name || product.product_key)}</span><div class="muted mono">${esc(product.product_key)}</div></td>
        <td>${esc(product.category || '-')}</td>
        <td>${esc(product.total_logs || 0)}</td>
        <td>${esc(product.received_logs || 0)}</td>
        <td>${esc(product.error_logs || 0)}</td>
        <td>${statusPill(product.status)}</td>
      </tr>
    `))}
  `;
}
