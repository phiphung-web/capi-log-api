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
    ads_manager_note: 'Live reconciliation endpoint has not loaded yet.',
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
  return issue.error_message || issue.fbtrace_id || 'Meta did not report a received event for this log.';
}

export function renderAnalytics() {
  const report = state.reconciliation || fallbackReport();
  const summary = report.summary || {};

  setShell(
    'Doi soat CAPI',
    'Bao cao giup ads xem backend da gui bao nhieu event, Meta CAPI da nhan bao nhieu, va lech o dau.',
    'Workspace / Doi soat CAPI'
  );

  content().innerHTML = `
    <section class="ops-hero">
      <div>
        <span class="eyebrow">Ads reconciliation</span>
        <h2>Backend sent vs Meta CAPI received</h2>
        <p>Use this screen to check whether CAPI logs from backend are being accepted by Meta. Product, event, source, campaign/ref, and recent issue tables show where ads should investigate first.</p>
      </div>
      <div class="ops-score">
        <span>Match rate</span>
        <strong>${pct(summary.match_rate)}</strong>
      </div>
    </section>

    ${metrics([
      { label: 'Backend sent', value: summary.sent_events || 0, note: 'Log rows in date range' },
      { label: 'Meta received', value: summary.meta_received_events || 0, note: 'Sum of events_received' },
      { label: 'Gap', value: signedGap(summary.mismatch_events), note: 'Sent minus Meta received' },
      { label: 'Error / unknown', value: Number(summary.error_logs || 0) + Number(summary.unknown_logs || 0), note: `${pct(summary.issue_rate)} of logs` },
      { label: 'Unique users', value: summary.unique_users || 0, note: 'Distinct user_id in logs' },
    ])}

    <section class="panel">
      <div class="panel-head"><h2>Ads Manager comparison</h2><span class="muted">Manual import needed</span></div>
      <div class="panel-body reconciliation-note">
        <div>
          <strong>Current basis</strong>
          <span>Backend logs are compared with Meta CAPI API response fields: meta_status and events_received.</span>
        </div>
        <div>
          <strong>Next data source</strong>
          <span>${esc(report.ads_manager_note || 'Connect Ads Manager metrics to compare against campaign UI totals.')}</span>
        </div>
      </div>
    </section>

    <div style="height:14px"></div>
    <div class="split wide-left">
      <section>
        ${table(['Product', 'Sent', 'Meta received', 'Gap', 'Issues', 'Health'], report.products.map((row) => `
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
        ${table(['Event', 'Sent', 'Received', 'Gap', 'Issue rate'], report.events.map((row) => `
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
        ${table(['Campaign / ref', 'Sent', 'Received', 'Gap', 'Issues'], report.campaigns.map((row) => `
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
        ${table(['Ref / Pub / Channel', 'Sent', 'Received', 'Gap', 'Issues'], report.sources.map((row) => `
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
    ${table(['Time', 'Market / Product', 'Event', 'User / Txn', 'Status', 'Reason'], (report.issues || []).map((issue) => `
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
