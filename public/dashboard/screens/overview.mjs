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

  setShell('Tổng quan', 'Tổng quan dữ liệu đã nhận, trạng thái xử lý và luồng Thị trường / Sản phẩm / Log.', 'Hệ thống / Tổng quan');

  content().innerHTML = `
    <section class="ops-hero">
      <div>
        <span class="eyebrow">Luồng nhận log live</span>
        <h2>Luồng log Thị trường / Sản phẩm / Meta CAPI</h2>
        <p>Request từ backend được xác thực, bóc dữ liệu callback Meta, đồng bộ market/product, lưu raw payload và hiển thị báo cáo theo thời gian.</p>
      </div>
      <div class="ops-score">
        <span>Meta đã nhận</span>
        <strong>${receiveRate}</strong>
        <p class="muted mini">${numberValue(receivedEvents)} / ${numberValue(totalEvents)} sự kiện được chấp nhận</p>
      </div>
    </section>

    <section class="workflow ops-flow">
      <article class="step-card"><span>01</span><strong>Xác thực</strong><p>Kiểm tra Bearer token hoặc X-API-Token trước khi nhận log.</p></article>
      <article class="step-card"><span>02</span><strong>Đọc payload</strong><p>Đọc metadata hoặc raw Meta request.data[0] và lấy các trường sự kiện.</p></article>
      <article class="step-card"><span>03</span><strong>Đồng bộ danh mục</strong><p>Tạo hoặc cập nhật market và product key phát hiện từ endpoint.</p></article>
      <article class="step-card"><span>04</span><strong>Báo cáo</strong><p>Cấp dữ liệu cho tổng quan, chi tiết sản phẩm, log, xu hướng và so sánh.</p></article>
    </section>

    ${metrics([
      { label: 'Tổng log', value: numberValue(totalEvents), note: 'Tất cả sự kiện trong khoảng đã chọn' },
      { label: 'Meta đã nhận', value: numberValue(receivedEvents), note: `${receiveRate} được chấp nhận` },
      { label: 'Cần rà soát', value: numberValue(issueEvents), note: `${issueRate} lỗi hoặc chưa rõ` },
      { label: 'Lỗi', value: numberValue(errorEvents), note: `${errorRate} phản hồi lỗi` },
      { label: 'User duy nhất', value: numberValue(overview.unique_users ?? 0), note: 'Theo user_id' },
      { label: 'Tổng giá trị', value: Number(overview.total_value || 0).toFixed(2), note: 'Tổng trường value' },
    ])}

    <section class="health-board">
      <article><span>Thị trường</span><strong>${numberValue(overview.total_markets ?? state.markets.length)} phạm vi dữ liệu đang hoạt động</strong></article>
      <article><span>Sản phẩm</span><strong>${numberValue(overview.total_products ?? state.products.length)} sản phẩm đang hiển thị</strong></article>
      <article><span>Chưa rõ</span><strong>${numberValue(unknownEvents)} sự kiện cần kiểm tra phản hồi</strong></article>
      <article><span>Pipeline</span><strong>Xác thực -> Đọc payload -> Danh mục -> Báo cáo</strong></article>
    </section>

    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Sức khỏe thị trường</h2><button class="primary" data-route="/dashboard/markets">Mở thị trường</button></div>
        <div class="panel-body">${marketCards(state.markets)}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>So sánh sản phẩm</h2><button data-route="${esc(productsComparePath())}">Mở so sánh</button></div>
        <div class="panel-body">
          <div class="chart-toolbar">
            <label>
              <span>Kiểu biểu đồ</span>
              <select id="overviewChartType">
                <option value="area">Vùng</option>
                <option value="line">Đường</option>
                <option value="bar">Cột</option>
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
      ${table(['Log mới nhất', 'Thị trường / Sản phẩm', 'Trạng thái', 'User / Giao dịch', 'Ref / Pub', 'Trace'], recentLogs.map((log) => `
        <tr>
          <td>${fromIsoDate(log.created_at)}<div class="muted mini">${new Date(log.created_at).toLocaleTimeString()}</div></td>
          <td>${esc(log.market_display_name || log.market_key)} / ${esc(log.product_display_name || log.product_key)}<div class="muted mono">${esc(log.market_key)} / ${esc(log.product_key)}</div></td>
          <td>${statusPill(log.meta_status)}</td>
          <td>${esc(log.username || log.user_id || '-')}<div class="muted mono">${esc(log.txn_id || '-')}</div></td>
          <td>${esc(log.ref || '-')}<div class="muted mono">${esc(log.pub_id || '-')}</div></td>
          <td class="mono">${esc(log.fbtrace_id || '-')}</td>
        </tr>
      `))}
      ${table(['Sản phẩm', 'Thị trường', 'Sự kiện', 'Meta nhận', 'Lỗi', 'Trạng thái'], topProducts.map((product) => `
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
