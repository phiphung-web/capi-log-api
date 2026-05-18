import { content } from '../dom.mjs';
import { metrics, productCards, statusLabel, statusPill, table } from '../components.mjs';
import { marketProductsPath, productPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { state } from '../state.mjs';
import { esc, summarize } from '../utils.mjs';

export function renderMarketDetail(ctx) {
  const market = state.markets.find((item) => item.market_key === state.selectedMarket);
  const products = state.products.filter((product) => product.market_key === state.selectedMarket);
  const summary = summarize([market || {}]);

  if (!market) {
    content().innerHTML = `<section class="panel"><div class="panel-body muted">Không tìm thấy thị trường.</div></section>`;
    return;
  }

  setShell(
    market.display_name || market.market_key,
    'Chi tiết thị trường, danh mục sản phẩm và sức khỏe CAPI cấp thị trường.',
    `Hệ thống / Thị trường / ${market.market_key}`
  );

  content().innerHTML = `
    ${metrics([
      { label: 'Sản phẩm', value: products.length, note: 'Trong thị trường này' },
      { label: 'Sự kiện', value: summary.total, note: 'Khoảng đã chọn' },
      { label: 'Meta nhận', value: summary.received, note: 'Meta chấp nhận' },
      { label: 'Lỗi', value: summary.errors, note: 'Cần rà soát' },
      { label: 'Trạng thái', value: statusLabel(market.status), note: market.region || 'Chưa đặt khu vực' },
    ])}
    <section class="panel">
      <div class="panel-head">
        <h2>Danh mục thị trường</h2>
        ${statusPill(market.status)}
      </div>
      <div class="panel-body kv">
        <div><span>Market key</span><strong class="mono">${esc(market.market_key)}</strong></div>
        <div><span>Khu vực</span><strong>${esc(market.region || '-')}</strong></div>
        <div><span>Đường dẫn sản phẩm</span><strong class="mono">${esc(marketProductsPath(market.market_key))}</strong></div>
      </div>
    </section>
    <div style="height:14px"></div>
    <section class="panel">
      <div class="panel-head"><h2>Sản phẩm trong ${esc(market.market_key)}</h2><button class="primary" data-route="${esc(marketProductsPath(market.market_key))}">Mở sản phẩm</button></div>
      <div class="panel-body">${productCards(products)}</div>
    </section>
    ${table(['Sản phẩm', 'Danh mục', 'Sự kiện', 'Meta nhận', 'Lỗi', 'Trạng thái'], products.map((product) => `
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
