import { $, content } from '../dom.mjs';
import { api } from '../api.mjs';
import { state } from '../state.mjs';
import { metrics, statusLabel, statusPill, table } from '../components.mjs';
import { drawProductSeriesChart } from '../chart.mjs';
import { go, productPath, productsPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, toIsoDate } from '../utils.mjs';

function selectorFor(product) {
  return `${product.market_key}:${product.product_key}`;
}

function selectedProducts() {
  if (state.compareSelection.length > 0) {
    const selected = new Set(state.compareSelection);
    return state.products.filter((product) => selected.has(selectorFor(product)));
  }

  return [...state.products]
    .sort((a, b) => Number(b.total_logs || 0) - Number(a.total_logs || 0))
    .slice(0, 3);
}

function selectedQuery(products) {
  return products.map(selectorFor).join(',');
}

function topBreakdown(product, dimension) {
  const rows = product.breakdowns?.[dimension] || [];
  return rows.slice(0, 3).map((row) => `${dimension === 'meta_status' ? statusLabel(row.name) : row.name}: ${row.total_events}`).join(', ') || '-';
}

function renderResults(payload) {
  const products = payload.products || [];
  const totals = products.reduce((acc, product) => {
    acc.events += Number(product.total_events || 0);
    acc.received += Number(product.received_events || 0);
    acc.errors += Number(product.error_events || 0);
    acc.unknown += Number(product.unknown_events || 0);
    acc.users += Number(product.unique_users || 0);
    acc.value += Number(product.total_value || 0);
    return acc;
  }, { events: 0, received: 0, errors: 0, unknown: 0, users: 0, value: 0 });

  $('compareResults').innerHTML = `
    ${metrics([
      { label: 'Đang so sánh', value: products.length, note: 'Sản phẩm được phân quyền' },
      { label: 'Sự kiện', value: totals.events, note: 'Khoảng đã chọn' },
      { label: 'Meta nhận', value: totals.received, note: 'Meta chấp nhận' },
      { label: 'Lỗi', value: totals.errors, note: 'Cần rà soát' },
      { label: 'Chưa rõ', value: totals.unknown, note: 'Phản hồi chưa đầy đủ' },
      { label: 'User duy nhất', value: totals.users, note: 'Cộng theo sản phẩm' },
      { label: 'Tổng giá trị', value: totals.value.toFixed(2), note: 'Từ trường value trong log' },
      { label: 'Tỷ lệ lỗi', value: totals.events ? `${Math.round((totals.errors / totals.events) * 100)}%` : '0%', note: 'Toàn bộ sản phẩm đã chọn' },
    ])}
    <section class="panel">
      <div class="panel-head"><h2>Xu hướng theo sản phẩm</h2><span class="muted">${esc(payload.date_from)} đến ${esc(payload.date_to)}</span></div>
      <div class="panel-body">
        <div class="chart-toolbar">
          <label>
            <span>Chỉ số</span>
            <select id="productChartMetric">
              <option value="total_events">Tổng sự kiện</option>
              <option value="received_events">Meta nhận</option>
              <option value="error_events">Lỗi</option>
              <option value="unknown_events">Chưa rõ</option>
              <option value="unique_users">User duy nhất</option>
              <option value="total_value">Tổng giá trị</option>
              <option value="purchase_events">Purchase</option>
              <option value="total_deposit_amount">Tổng nạp</option>
            </select>
          </label>
          <label>
            <span>Kiểu biểu đồ</span>
            <select id="productChartType">
              <option value="line">Đường</option>
              <option value="area">Vùng</option>
              <option value="bar">Cột</option>
            </select>
          </label>
        </div>
        <canvas id="productCompareChart" class="chart"></canvas>
        <div class="legend">
          ${products.map((product, index) => `<span style="--dot:${['#0f766e', '#b42318', '#9a6700', '#2563eb', '#7c3aed', '#475569'][index % 6]}">${esc(product.product_display_name || product.product_key)}</span>`).join('')}
        </div>
      </div>
    </section>
    <div style="height:14px"></div>
    ${table(['Sản phẩm', 'Sự kiện', 'Meta nhận', 'Lỗi', 'Chưa rõ', 'Tỷ lệ lỗi', 'User', 'Giá trị', 'Purchase', 'Purchase đầu tiên', 'Nạp'], products.map((product) => `
      <tr>
        <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.product_display_name || product.product_key)}</span><div class="muted mono">${esc(product.market_key)} / ${esc(product.product_key)}</div>${statusPill(product.product_status || 'unknown')}</td>
        <td>${esc(product.total_events || 0)}</td>
        <td>${esc(product.received_events || 0)}</td>
        <td>${esc(product.error_events || 0)}</td>
        <td>${esc(product.unknown_events || 0)}</td>
        <td>${esc(product.error_rate || 0)}%</td>
        <td>${esc(product.unique_users || 0)}</td>
        <td>${Number(product.total_value || 0).toFixed(2)}</td>
        <td>${esc(product.purchase_events || 0)}</td>
        <td>${esc(product.first_purchase_events || 0)}</td>
        <td>${Number(product.total_deposit_amount || 0).toFixed(2)}</td>
      </tr>
    `))}
    ${table(['Sản phẩm', 'Top event', 'Trạng thái Meta', 'Top ref', 'Top pub_id', 'Top channel'], products.map((product) => `
      <tr>
        <td>${esc(product.product_display_name || product.product_key)}<div class="muted mono">${esc(product.market_key)} / ${esc(product.product_key)}</div></td>
        <td>${esc(topBreakdown(product, 'event_name'))}</td>
        <td>${esc(topBreakdown(product, 'meta_status'))}</td>
        <td>${esc(topBreakdown(product, 'ref'))}</td>
        <td>${esc(topBreakdown(product, 'pub_id'))}</td>
        <td>${esc(topBreakdown(product, 'channel'))}</td>
      </tr>
    `))}
  `;

  const drawSelectedChart = () => {
    state.productCompareMetric = $('productChartMetric').value;
    state.productCompareChartType = $('productChartType').value;
    drawProductSeriesChart(products, state.productCompareMetric, state.productCompareChartType);
  };

  $('productChartMetric').value = state.productCompareMetric || 'total_events';
  $('productChartType').value = state.productCompareChartType || 'line';
  $('productChartMetric').onchange = drawSelectedChart;
  $('productChartType').onchange = drawSelectedChart;
  drawSelectedChart();

  document.querySelectorAll('[data-route]').forEach((el) => {
    el.onclick = () => go(el.dataset.route);
  });
}

async function loadComparison(products) {
  if (products.length === 0) {
    $('compareResults').innerHTML = `<section class="panel"><div class="panel-body muted">Chưa có sản phẩm để so sánh.</div></section>`;
    return;
  }

  $('compareResults').innerHTML = `<section class="panel"><div class="panel-body muted">Đang tải dữ liệu so sánh...</div></section>`;

  try {
    const params = new URLSearchParams({
      products: selectedQuery(products),
      date_from: toIsoDate($('dateFrom').value),
      date_to: toIsoDate($('dateTo').value),
      group_by: 'day',
    });
    const payload = await api(`/v1/analytics/products/compare?${params.toString()}`);
    renderResults(payload.data);
  } catch (error) {
    $('compareResults').innerHTML = `<section class="panel"><div class="panel-body muted">Không tải được dữ liệu so sánh (${esc(error.message)}).</div></section>`;
  }
}

export function renderProductsCompare(ctx) {
  const products = selectedProducts();
  state.compareSelection = products.map(selectorFor);

  setShell('So sánh sản phẩm', 'So sánh nhiều sản phẩm cùng hoặc khác thị trường theo log, lỗi, người dùng, value và breakdown.', 'Hệ thống / Sản phẩm / So sánh');

  content().innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Sản phẩm cần so sánh</h2>
        <div class="actions">
          <button data-route="${esc(productsPath())}">Quay lại sản phẩm</button>
          <button id="reloadCompare" class="primary">Tải lại so sánh</button>
        </div>
      </div>
      <div class="panel-body filters">
        ${state.products.map((product) => `
          <label class="check-line">
            <input type="checkbox" data-compare-product="${esc(selectorFor(product))}" ${state.compareSelection.includes(selectorFor(product)) ? 'checked' : ''}>
            <span>${esc(product.display_name || product.product_key)} <small class="mono">${esc(product.market_key)} / ${esc(product.product_key)}</small></span>
          </label>
        `).join('')}
      </div>
    </section>
    <div style="height:14px"></div>
    <section id="compareResults"></section>
  `;

  document.querySelectorAll('[data-compare-product]').forEach((checkbox) => {
    checkbox.onchange = () => {
      const next = new Set(state.compareSelection);
      if (checkbox.checked) next.add(checkbox.dataset.compareProduct);
      else next.delete(checkbox.dataset.compareProduct);
      state.compareSelection = [...next];
    };
  });

  $('reloadCompare').onclick = () => {
    const selected = new Set(state.compareSelection);
    loadComparison(state.products.filter((product) => selected.has(selectorFor(product))));
  };

  loadComparison(products);
}
