import { $ } from './dom.mjs';
import { statusPill } from './components.mjs';
import { esc } from './utils.mjs';

export function showLogDetail(log) {
  if (!log) return;

  $('modalBody').innerHTML = `
    <div class="detail-grid">
      <section class="kv">
        <div><span>Thị trường / Sản phẩm</span><strong>${esc(log.market_key)} / ${esc(log.product_key)}</strong></div>
        <div><span>Sự kiện</span><strong>${esc(log.event_name)}</strong><p class="muted mono">${esc(log.event_id)}</p></div>
        <div><span>Trạng thái Meta</span>${statusPill(log.meta_status)}<p class="muted mini">events_received: ${esc(log.events_received ?? '-')}</p></div>
        <div><span>User / Giao dịch</span><strong>${esc(log.username || log.user_id || '-')}</strong><p class="muted mono">${esc(log.txn_id || '-')}</p></div>
        <div><span>Attribution</span><p class="muted mini">ref: ${esc(log.ref || '-')}</p><p class="muted mini">pub_id: ${esc(log.pub_id || '-')}</p><p class="muted mini">channel: ${esc(log.channel || '-')}</p></div>
        <div><span>Mạng</span><p class="muted mini">client_ip: ${esc(log.client_ip_address || '-')}</p><p class="muted mini">request_ip: ${esc(log.request_ip || '-')}</p></div>
      </section>
      <section class="panel" style="box-shadow:none">
        <div class="panel-head"><h2>Payload sự kiện đầy đủ</h2><span class="muted mono">${esc(log.fbtrace_id || 'không có fbtrace')}</span></div>
        <div class="panel-body"><pre>${esc(JSON.stringify(log, null, 2))}</pre></div>
      </section>
    </div>
  `;
  $('modal').classList.remove('hidden');
}
