import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { metrics, statusPill, table } from '../components.mjs';
import { logPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, fromIsoDate } from '../utils.mjs';

function pct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function signedGap(value) {
  const numberValue = Number(value || 0);
  if (numberValue > 0) return `-${numberValue}`;
  if (numberValue < 0) return `+${Math.abs(numberValue)}`;
  return '0';
}

function healthStatus(row) {
  if (Number(row.error_logs || 0) > 0) return 'error';
  if (Number(row.unknown_logs || 0) > 0 || Number(row.mismatch_events || 0) !== 0) return 'unknown';
  return 'received';
}

function fallbackReport() {
  const sent = state.logs.length;
  const metaReceived = state.logs.reduce((sum, log) => sum + Number(log.events_received || 0), 0);
  const errorLogs = state.logs.filter((log) => log.meta_status === 'error').length;
  const unknownLogs = state.logs.filter((log) => log.meta_status === 'unknown').length;

  return {
    date_from: '',
    date_to: '',
    ads_manager_reported_events: null,
    ads_manager_note: 'Endpoint đối soát live chưa tải xong.',
    summary: {
      sent_events: sent,
      meta_received_events: metaReceived,
      mismatch_events: sent - metaReceived,
      accepted_logs: state.logs.filter((log) => log.meta_status === 'received').length,
      error_logs: errorLogs,
      unknown_logs: unknownLogs,
      match_rate: sent ? (metaReceived / sent) * 100 : 0,
      issue_rate: sent ? ((errorLogs + unknownLogs) / sent) * 100 : 0,
    },
    products: [],
    events: [],
    sources: [],
    campaigns: [],
    issues: state.logs.filter((log) => log.meta_status !== 'received' || Number(log.events_received || 0) === 0),
  };
}

function issueMessage(issue) {
  return issue.error_message || issue.fbtrace_id || 'Meta chưa ghi nhận event nhận thành công cho log này.';
}

export function renderAnalytics() {
  const report = state.reconciliation || fallbackReport();
  const summary = report.summary || {};

  setShell(
    'Đối soát CAPI',
    'Báo cáo giúp ads xem backend đã gửi bao nhiêu event, Meta CAPI đã nhận bao nhiêu và lệch ở đâu.',
    'Hệ thống / Đối soát CAPI'
  );

  content().innerHTML = `
    <section class="ops-hero">
      <div>
        <span class="eyebrow">Đối soát dữ liệu ads</span>
        <h2>Backend đã gửi so với Meta CAPI đã nhận</h2>
        <p>Màn hình này dùng để kiểm tra log CAPI từ backend có được Meta chấp nhận hay không. Các bảng theo sản phẩm, sự kiện, nguồn, campaign/ref và log lỗi gần nhất cho biết ads nên kiểm tra điểm nào trước.</p>
      </div>
      <div class="ops-score">
        <span>Tỷ lệ khớp</span>
        <strong>${pct(summary.match_rate)}</strong>
      </div>
    </section>

    ${metrics([
      { label: 'Backend đã gửi', value: summary.sent_events || 0, note: 'Số log trong khoảng ngày' },
      { label: 'Meta đã nhận', value: summary.meta_received_events || 0, note: 'Tổng events_received' },
      { label: 'Chênh lệch', value: signedGap(summary.mismatch_events), note: 'Backend gửi trừ Meta nhận' },
      { label: 'Lỗi / chưa rõ', value: Number(summary.error_logs || 0) + Number(summary.unknown_logs || 0), note: `${pct(summary.issue_rate)} tổng log` },
      { label: 'User duy nhất', value: summary.unique_users || 0, note: 'Đếm theo user_id' },
    ])}

    <section class="panel">
      <div class="panel-head"><h2>So sánh với Ads Manager</h2><span class="muted">Cần import dữ liệu</span></div>
      <div class="panel-body reconciliation-note">
        <div>
          <strong>Cơ sở hiện tại</strong>
          <span>Hệ thống đang so sánh log backend với phản hồi API từ Meta CAPI qua các trường meta_status và events_received.</span>
        </div>
        <div>
          <strong>Nguồn dữ liệu tiếp theo</strong>
          <span>${esc(report.ads_manager_note || 'Kết nối hoặc import số liệu Ads Manager để so với số hiển thị trên campaign.')}</span>
        </div>
      </div>
    </section>

    <div style="height:14px"></div>
    <div class="split wide-left">
      <section>
        ${table(['Sản phẩm', 'Đã gửi', 'Meta nhận', 'Chênh lệch', 'Vấn đề', 'Sức khỏe'], report.products.map((row) => `
          <tr>
            <td>
              <span class="link" data-product="${esc(row.market_key)}:${esc(row.product_key)}">${esc(row.product_display_name || row.product_key)}</span>
              <div class="muted mono">${esc(row.market_key)} / ${esc(row.product_key)}</div>
            </td>
            <td>${esc(row.sent_events || 0)}</td>
            <td>${esc(row.meta_received_events || 0)}</td>
            <td>${esc(signedGap(row.mismatch_events))}</td>
            <td>${esc(Number(row.error_logs || 0) + Number(row.unknown_logs || 0))}</td>
            <td>${statusPill(healthStatus(row))}</td>
          </tr>
        `))}
      </section>
      <section>
        ${table(['Sự kiện', 'Đã gửi', 'Meta nhận', 'Chênh lệch', 'Tỷ lệ vấn đề'], report.events.map((row) => `
          <tr>
            <td><strong>${esc(row.event_name || '-')}</strong></td>
            <td>${esc(row.sent_events || 0)}</td>
            <td>${esc(row.meta_received_events || 0)}</td>
            <td>${esc(signedGap(row.mismatch_events))}</td>
            <td>${esc(pct(row.issue_rate))}</td>
          </tr>
        `))}
      </section>
    </div>

    <div style="height:14px"></div>
    <div class="split wide-left">
      <section>
        ${table(['Campaign / ref', 'Đã gửi', 'Meta nhận', 'Chênh lệch', 'Vấn đề'], report.campaigns.map((row) => `
          <tr>
            <td><strong>${esc(row.campaign || '-')}</strong></td>
            <td>${esc(row.sent_events || 0)}</td>
            <td>${esc(row.meta_received_events || 0)}</td>
            <td>${esc(signedGap(row.mismatch_events))}</td>
            <td>${esc(Number(row.error_logs || 0) + Number(row.unknown_logs || 0))}</td>
          </tr>
        `))}
      </section>
      <section>
        ${table(['Ref / Pub / Channel', 'Đã gửi', 'Meta nhận', 'Chênh lệch', 'Vấn đề'], report.sources.map((row) => `
          <tr>
            <td>
              <strong>${esc(row.ref || '-')}</strong>
              <div class="muted mono">${esc(row.pub_id || '-')} / ${esc(row.channel || '-')}</div>
            </td>
            <td>${esc(row.sent_events || 0)}</td>
            <td>${esc(row.meta_received_events || 0)}</td>
            <td>${esc(signedGap(row.mismatch_events))}</td>
            <td>${esc(Number(row.error_logs || 0) + Number(row.unknown_logs || 0))}</td>
          </tr>
        `))}
      </section>
    </div>

    <div style="height:14px"></div>
    ${table(['Thời gian', 'Thị trường / Sản phẩm', 'Sự kiện', 'User / Giao dịch', 'Trạng thái', 'Lý do'], (report.issues || []).map((issue) => `
      <tr>
        <td>${fromIsoDate(issue.created_at)}<div class="muted">${new Date(issue.created_at).toLocaleTimeString()}</div></td>
        <td>${esc(issue.market_key)} / ${esc(issue.product_key)}</td>
        <td><span class="link" data-route="${esc(logPath(issue.market_key, issue.product_key, issue.id))}">${esc(issue.event_name || '-')}</span><div class="muted mono">${esc(issue.event_id || '-')}</div></td>
        <td>${esc(issue.username || issue.user_id || '-')}<div class="muted mono">${esc(issue.txn_id || '-')}</div></td>
        <td>${statusPill(issue.meta_status)}</td>
        <td>${esc(issueMessage(issue))}</td>
      </tr>
    `))}
  `;
}
