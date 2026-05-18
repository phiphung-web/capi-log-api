import { content } from '../dom.mjs';
import { productLogsPath } from '../router.mjs';
import { statusPill } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { state } from '../state.mjs';
import { esc, fromIsoDate } from '../utils.mjs';

export function renderLogDetail() {
  const log = state.selectedLog;

  if (!log) {
    setShell('Không tìm thấy log', 'Log sự kiện được yêu cầu không có trong khoảng dữ liệu hiện tại.', 'Hệ thống / Chi tiết log');
    content().innerHTML = `<section class="panel"><div class="panel-body muted">Không tìm thấy log sự kiện. Hãy mở rộng khoảng ngày rồi thử lại.</div></section>`;
    return;
  }

  setShell(
    `Sự kiện ${log.event_name}`,
    'Chi tiết audit đầy đủ: request payload, phản hồi Meta, attribution và thông tin giao dịch.',
    `Hệ thống / ${log.market_key} / ${log.product_key} / Log / ${log.id}`
  );

  content().innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Định danh sự kiện</h2>
        <button data-route="${esc(productLogsPath(log.market_key, log.product_key))}">Quay lại log sản phẩm</button>
      </div>
      <div class="panel-body detail-grid">
        <section class="kv">
          <div><span>Thị trường / Sản phẩm</span><strong>${esc(log.market_key)} / ${esc(log.product_key)}</strong></div>
          <div><span>Thời gian tạo</span><strong>${esc(fromIsoDate(log.created_at))}</strong></div>
          <div><span>Sự kiện</span><strong>${esc(log.event_name)}</strong><p class="muted mono">${esc(log.event_id)}</p></div>
          <div><span>Trạng thái Meta</span>${statusPill(log.meta_status)}<p class="muted mini">events_received: ${esc(log.events_received ?? '-')}</p></div>
          <div><span>User / Giao dịch</span><strong>${esc(log.username || log.user_id || '-')}</strong><p class="muted mono">${esc(log.txn_id || '-')}</p></div>
          <div><span>Attribution</span><p class="muted mini">ref: ${esc(log.ref || '-')}</p><p class="muted mini">pub_id: ${esc(log.pub_id || '-')}</p><p class="muted mini">channel: ${esc(log.channel || '-')}</p></div>
          <div><span>Mạng</span><p class="muted mini">client_ip: ${esc(log.client_ip_address || '-')}</p><p class="muted mini">request_ip: ${esc(log.request_ip || '-')}</p></div>
        </section>
        <section class="panel" style="box-shadow:none">
          <div class="panel-head"><h2>Payload đầy đủ</h2><span class="muted mono">${esc(log.fbtrace_id || 'không có fbtrace')}</span></div>
          <div class="panel-body"><pre>${esc(JSON.stringify(log, null, 2))}</pre></div>
        </section>
      </div>
    </section>
  `;
}
