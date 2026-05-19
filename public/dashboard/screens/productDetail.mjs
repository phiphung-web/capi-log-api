import { $, content } from '../dom.mjs';
import { api } from '../api.mjs';
import { state } from '../state.mjs';
import { chartLegend, metrics, statusLabel, statusPill, table } from '../components.mjs';
import { loadCompareChart } from '../chart.mjs';
import { logPath, productLogsPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, fromIsoDate, summarize, toIsoDate } from '../utils.mjs';

function productEventFilterKey(product) {
  return `${product.market_key}:${product.product_key}`;
}

function selectedEventName(product) {
  return state.productDetailEventFilters?.[productEventFilterKey(product)] || 'All';
}

function campaignUrl(product, eventName) {
  const params = new URLSearchParams({
    market_key: product.market_key,
    product_key: product.product_key,
    date_from: toIsoDate($('dateFrom').value),
    date_to: toIsoDate($('dateTo').value),
    event_name: eventName || 'All',
  });

  return `/v1/analytics/campaign-performance?${params.toString()}`;
}

function eventsBreakdownUrl(product) {
  const params = new URLSearchParams({
    market_key: product.market_key,
    product_key: product.product_key,
    date_from: toIsoDate($('dateFrom').value),
    date_to: toIsoDate($('dateTo').value),
  });

  return `/v1/analytics/events-breakdown?${params.toString()}`;
}

function renderCampaignPerformance(rows) {
  $('campaignPerformanceResults').innerHTML = table(
    ['Campaign/Pub_ID', 'Total Events', 'Received (Thành công)', 'Error (Lỗi)', 'Total Value'],
    rows.map((row) => `
      <tr>
        <td><strong>${esc(row.campaign || '-')}</strong></td>
        <td>${esc(row.matching_events || 0)}</td>
        <td class="metric-good">${esc(row.received_events || 0)}</td>
        <td class="metric-bad">${esc(row.error_events || 0)}</td>
        <td>${Number(row.total_value || 0).toFixed(2)}</td>
      </tr>
    `)
  );
}

async function loadEventsBreakdown(product) {
  const select = $('eventFilter');
  if (!select) return;

  try {
    const payload = await api(eventsBreakdownUrl(product));
    const selected = selectedEventName(product);
    const events = payload.data.events || [];
    select.innerHTML = [
      '<option value="All">All</option>',
      ...events.map((event) => `<option value="${esc(event.event_name)}">${esc(event.event_name)}</option>`),
    ].join('');
    select.value = events.some((event) => event.event_name === selected) ? selected : 'All';
  } catch (error) {
    select.innerHTML = '<option value="All">All</option>';
  }
}

async function loadCampaignPerformance(product, eventName = selectedEventName(product)) {
  $('campaignPerformanceResults').innerHTML = '<section class="panel"><div class="panel-body muted">Đang tải campaign performance...</div></section>';

  try {
    const payload = await api(campaignUrl(product, eventName));
    renderCampaignPerformance(payload.data.campaigns || []);
  } catch (error) {
    $('campaignPerformanceResults').innerHTML = `<section class="panel"><div class="panel-body muted">Không tải được campaign performance (${esc(error.message)}).</div></section>`;
  }
}

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
  const canManageCatalog = Boolean(state.auth && state.auth.is_admin);
  const eventFilterValue = selectedEventName(product);
  const catalogPanel = canManageCatalog ? `
      <section class="panel">
        <div class="panel-head"><h2>Danh mục</h2><span class="muted">Admin có thể cập nhật</span></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><label>Tên hiển thị</label><input id="catName" value="${esc(product.display_name || '')}"></div>
            <div><label>Danh mục</label><input id="catCategory" value="${esc(product.category || '')}"></div>
            <div><label>Trạng thái</label><select id="catStatus"><option value="active">Đang hoạt động</option><option value="paused">Tạm dừng</option><option value="archived">Lưu trữ</option></select></div>
            <div><label>Người phụ trách</label><input id="catOwner" value="${esc(product.owner || '')}"></div>
            <div class="full"><label>Ghi chú</label><input id="catNotes" value="${esc(product.notes || '')}"></div>
          </div>
          <div class="actions"><button id="saveCatalog" class="primary">Lưu danh mục</button></div>
        </div>
      </section>
    ` : `
      <section class="panel">
        <div class="panel-head"><h2>Danh mục</h2><span class="muted">Chỉ xem</span></div>
        <div class="panel-body kv">
          <div><span>Tên hiển thị</span><strong>${esc(product.display_name || product.product_key)}</strong></div>
          <div><span>Danh mục</span><strong>${esc(product.category || 'Chưa đặt danh mục')}</strong></div>
          <div><span>Trạng thái</span><strong>${esc(statusLabel(product.status))}</strong></div>
          <div><span>Người phụ trách</span><strong>${esc(product.owner || '-')}</strong></div>
          <div><span>Ghi chú</span><strong>${esc(product.notes || '-')}</strong></div>
        </div>
      </section>
    `;

  setShell(
    product.display_name || product.product_key,
    'Thống kê cấp sản phẩm, cấu hình danh mục, biểu đồ so sánh và log sự kiện mới nhất.',
    `Hệ thống / ${product.market_key} / ${product.product_key}`
  );

  content().innerHTML = `
    ${metrics([
      { label: 'Sự kiện', value: summary.total, note: 'Sản phẩm này' },
      { label: 'Meta nhận', value: summary.received, note: 'Meta chấp nhận' },
      { label: 'Lỗi', value: summary.errors, note: 'Cần kiểm tra phản hồi' },
      { label: 'Tỷ lệ lỗi', value: summary.errorRate, note: 'Phạm vi hiện tại' },
      { label: 'Trạng thái', value: statusLabel(product.status), note: product.category || 'Chưa đặt danh mục' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>So sánh</h2><button data-route="${esc(productLogsPath(product.market_key, product.product_key))}">Mở log</button></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          ${chartLegend()}
        </div>
      </section>
      ${catalogPanel}
    </div>
    <div style="height:14px"></div>
    <section class="panel">
      <div class="panel-head"><h2>Campaign</h2><span class="muted">Lọc theo event trong khoảng ngày đang chọn</span></div>
      <div class="panel-body filters">
        <select id="eventFilter">
          <option value="All" ${eventFilterValue === 'All' ? 'selected' : ''}>All</option>
        </select>
      </div>
    </section>
    <section id="campaignPerformanceResults"></section>
    <div style="height:14px"></div>
    ${table(['Thời gian', 'Sự kiện', 'Trạng thái', 'User / Giao dịch', 'Giá trị', 'Trace'], logs.map((log) => `
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

  if (canManageCatalog) {
    $('catStatus').value = product.status || 'active';
    $('saveCatalog').onclick = () => saveCatalog(product, ctx);
  }
  $('eventFilter').onchange = () => {
    const nextEventName = $('eventFilter').value || 'All';
    state.productDetailEventFilters = {
      ...(state.productDetailEventFilters || {}),
      [productEventFilterKey(product)]: nextEventName,
    };
    loadCampaignPerformance(product, nextEventName);
  };
  loadCompareChart(product);
  loadEventsBreakdown(product).then(() => loadCampaignPerformance(product, $('eventFilter').value || 'All'));
}
