export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

export function toIsoDate(ddmmyyyy) {
  if (!ddmmyyyy) return '';
  const match = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return ddmmyyyy;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function fromIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-GB').format(date).replaceAll('/', '-');
}

export function summarize(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.total_logs || row.total_events || 0), 0);
  const received = rows.reduce((sum, row) => sum + Number(row.received_logs || row.received_events || 0), 0);
  const errors = rows.reduce((sum, row) => sum + Number(row.error_logs || row.error_events || 0), 0);

  return {
    total,
    received,
    errors,
    errorRate: errorRate(total, errors),
  };
}

export function errorRate(total, errors) {
  return Number(total) ? `${Math.round((Number(errors || 0) / Number(total)) * 100)}%` : '0%';
}
