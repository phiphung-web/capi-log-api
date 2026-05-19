import { errorRate, esc } from './utils.mjs';

const STATUS_LABELS = {
  active: 'Đang hoạt động',
  paused: 'Tạm dừng',
  archived: 'Lưu trữ',
  received: 'Meta đã nhận',
  error: 'Lỗi',
  unknown: 'Chưa rõ',
  pending: 'Đang chờ',
  success: 'Thành công',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Chưa rõ';
}

export function statusPill(status) {
  const rawStatus = status || 'unknown';
  return `<span class="status ${esc(rawStatus)}">${esc(statusLabel(rawStatus))}</span>`;
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
    : `<tr><td colspan="${headers.length}" class="muted">Không có dữ liệu trong phạm vi đã chọn.</td></tr>`;

  return `
    <div class="panel">
      <div class="table-scroll table-container">
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
      <div><span>Sự kiện</span><strong>${esc(total || 0)}</strong></div>
      <div><span>Meta nhận</span><strong>${esc(received || 0)}</strong></div>
      <div><span>Tỷ lệ lỗi</span><strong>${esc(errorRate(total, errors))}</strong></div>
    </div>
  `;
}

export function marketCards(markets) {
  return `<section class="entity-grid">${markets.map((market) => `
    <article class="entity-card">
      <div class="entity-top">
        <div class="entity-title">
          <strong><span class="link" data-market="${esc(market.market_key)}">${esc(market.display_name || market.market_key)}</span></strong>
          <span class="mono">${esc(market.market_key)} / ${esc(market.region || 'chưa đặt khu vực')}</span>
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
          <span class="mono">${esc(product.market_key)} / ${esc(product.product_key)} / ${esc(product.category || 'chưa phân loại')}</span>
        </div>
        ${statusPill(product.status)}
      </div>
      ${entityStats(product.total_logs, product.received_logs, product.error_logs)}
    </article>
  `).join('')}</section>`;
}

export function marketRows(markets, compact = false) {
  return table(['Thị trường', 'Sản phẩm', 'Sự kiện', 'Meta nhận', 'Tỷ lệ lỗi', 'Trạng thái'], markets.map((market) => `
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

export function chartLegend(labels = ['Hiện tại', 'Kỳ trước', 'Cùng kỳ tuần trước']) {
  const colors = ['#0f766e', '#b42318', '#9a6700'];
  return `
    <div class="legend">
      ${labels.map((label, index) => `<span style="--dot:${colors[index]}">${esc(label)}</span>`).join('')}
    </div>
  `;
}
