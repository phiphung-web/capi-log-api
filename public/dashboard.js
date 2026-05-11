const demoLogs = [
  {
    id: 101,
    created_at: '2026-05-11T04:53:32.294Z',
    product_key: 'lengbear777',
    pixel_id: '1178548207737198',
    event_name: 'Purchase',
    event_id: 'purchase_60924493165',
    user_id: '1016124',
    username: 'user.1016124',
    txn_id: '60924493165',
    ref: 'lengbear777_vipclubasia_apk',
    pub_id: 'lengbear777',
    platform: 'Android',
    channel: 'WING_Direct',
    value: '0.500000',
    currency: 'USD',
    fbc: 'fb.1.1775754000000.testfbclid',
    fbp: 'fb.1.1775753000000.testfbp',
    fbclid: 'testfbclid',
    events_received: 1,
    fbtrace_id: 'TEST_FBTRACE_ID',
    meta_status: 'received',
    event_source_url: 'https://landing-demo.com/?fbclid=test',
    meta_request_payload: { data: [{ event_name: 'Purchase', event_id: 'purchase_60924493165' }] },
    meta_response: { events_received: 1, messages: [], fbtrace_id: 'TEST_FBTRACE_ID' },
  },
  {
    id: 102,
    created_at: '2026-05-11T04:44:12.100Z',
    product_key: 'casinoplus',
    pixel_id: 'PX_CASINO_01',
    event_name: 'CompleteRegistration',
    event_id: 'reg_882913',
    user_id: '882913',
    username: 'guest.882913',
    txn_id: null,
    ref: 'casinoplus_web',
    pub_id: 'casino-aff-22',
    platform: 'iOS',
    channel: 'Facebook_Ads',
    value: null,
    currency: 'USD',
    fbc: 'fb.1.1775751000000.regclid',
    fbp: 'fb.1.1775750800000.regfbp',
    fbclid: 'regclid',
    events_received: 1,
    fbtrace_id: 'TRACE_REG_001',
    meta_status: 'received',
    event_source_url: 'https://casino-plus.example/register?fbclid=regclid',
    meta_response: { events_received: 1, messages: [], fbtrace_id: 'TRACE_REG_001' },
  },
  {
    id: 103,
    created_at: '2026-05-11T04:39:45.000Z',
    product_key: 'wingdirect',
    pixel_id: 'PX_WING_77',
    event_name: 'Purchase',
    event_id: 'purchase_771200',
    user_id: '771200',
    username: 'wing.771200',
    txn_id: 'TXN-771200',
    ref: 'wingdirect_apk',
    pub_id: 'wingdirect',
    platform: 'Android',
    channel: 'WING_Direct',
    value: '12.000000',
    currency: 'USD',
    fbc: null,
    fbp: 'fb.1.1775750000000.wingfbp',
    fbclid: null,
    events_received: 0,
    fbtrace_id: 'TRACE_ERROR_12',
    meta_status: 'error',
    error_message: 'Invalid match key format',
    event_source_url: 'https://wing.example/deposit',
    meta_response: { error: { message: 'Invalid match key format' }, fbtrace_id: 'TRACE_ERROR_12' },
  },
  {
    id: 104,
    created_at: '2026-05-11T04:31:20.700Z',
    product_key: 'newvipclub',
    pixel_id: 'PX_NEW_88',
    event_name: 'Lead',
    event_id: 'lead_10002',
    user_id: '10002',
    username: 'lead.10002',
    txn_id: null,
    ref: 'newvipclub_landing',
    pub_id: 'newvipclub',
    platform: 'Web',
    channel: 'TikTok_Retarget',
    value: null,
    currency: 'USD',
    fbc: null,
    fbp: null,
    fbclid: null,
    events_received: null,
    fbtrace_id: null,
    meta_status: 'unknown',
    event_source_url: 'https://newvip.example',
    meta_response: { messages: [] },
  },
];

let logs = [...demoLogs];
let selectedProduct = 'all';
let selectedLogId = null;
let dataMode = 'demo';

const els = {
  token: document.getElementById('apiToken'),
  saveToken: document.getElementById('saveToken'),
  demoMode: document.getElementById('demoMode'),
  refreshBtn: document.getElementById('refreshBtn'),
  dataState: document.getElementById('dataState'),
  productNav: document.getElementById('productNav'),
  allCount: document.getElementById('allCount'),
  statusFilter: document.getElementById('statusFilter'),
  eventFilter: document.getElementById('eventFilter'),
  searchInput: document.getElementById('searchInput'),
  metricTotal: document.getElementById('metricTotal'),
  metricReceived: document.getElementById('metricReceived'),
  metricErrorRate: document.getElementById('metricErrorRate'),
  metricProducts: document.getElementById('metricProducts'),
  logsBody: document.getElementById('logsBody'),
  tableCount: document.getElementById('tableCount'),
  detailBody: document.getElementById('detailBody'),
  detailStatus: document.getElementById('detailStatus'),
};

function getToken() {
  return localStorage.getItem('capi_dashboard_token') || '';
}

function setToken(token) {
  localStorage.setItem('capi_dashboard_token', token);
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function money(value, currency) {
  if (value === null || value === undefined || value === '') return '-';
  return `${Number(value).toFixed(2)} ${currency || ''}`.trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFilteredLogs() {
  const status = els.statusFilter.value;
  const eventName = els.eventFilter.value;
  const search = els.searchInput.value.trim().toLowerCase();

  return logs.filter((log) => {
    const productMatch = selectedProduct === 'all' || log.product_key === selectedProduct;
    const statusMatch = status === 'all' || log.meta_status === status;
    const eventMatch = eventName === 'all' || log.event_name === eventName;
    const searchTarget = [
      log.event_id,
      log.txn_id,
      log.user_id,
      log.username,
      log.fbtrace_id,
      log.ref,
      log.pub_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const searchMatch = !search || searchTarget.includes(search);
    return productMatch && statusMatch && eventMatch && searchMatch;
  });
}

function renderProducts() {
  const counts = logs.reduce((acc, log) => {
    acc[log.product_key] = (acc[log.product_key] || 0) + 1;
    return acc;
  }, {});

  els.allCount.textContent = logs.length;
  els.productNav.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([product, count]) => `
      <button class="nav-item ${selectedProduct === product ? 'active' : ''}" type="button" data-product="${escapeHtml(product)}">
        <span>${escapeHtml(product)}</span>
        <strong>${count}</strong>
      </button>
    `)
    .join('');

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.product === selectedProduct);
    button.onclick = () => {
      selectedProduct = button.dataset.product;
      render();
    };
  });
}

function renderEventFilter() {
  const current = els.eventFilter.value;
  const events = unique(logs.map((log) => log.event_name)).sort();
  els.eventFilter.innerHTML = '<option value="all">All events</option>' + events
    .map((eventName) => `<option value="${escapeHtml(eventName)}">${escapeHtml(eventName)}</option>`)
    .join('');
  els.eventFilter.value = events.includes(current) ? current : 'all';
}

function renderMetrics(filteredLogs) {
  const received = filteredLogs.filter((log) => log.meta_status === 'received').length;
  const errors = filteredLogs.filter((log) => log.meta_status === 'error').length;
  const products = unique(filteredLogs.map((log) => log.product_key)).length;
  const errorRate = filteredLogs.length ? Math.round((errors / filteredLogs.length) * 100) : 0;

  els.metricTotal.textContent = filteredLogs.length;
  els.metricReceived.textContent = received;
  els.metricErrorRate.textContent = `${errorRate}%`;
  els.metricProducts.textContent = products;
}

function renderTable(filteredLogs) {
  els.tableCount.textContent = `${filteredLogs.length} rows`;

  if (filteredLogs.length === 0) {
    els.logsBody.innerHTML = '<tr><td colspan="7" class="muted">No logs match the current filters.</td></tr>';
    return;
  }

  els.logsBody.innerHTML = filteredLogs.map((log) => `
    <tr data-id="${log.id}" class="${selectedLogId === log.id ? 'selected' : ''}">
      <td>
        <div>${formatDate(log.created_at)}</div>
        <div class="muted mono">${escapeHtml(log.fbtrace_id || '-')}</div>
      </td>
      <td>
        <strong>${escapeHtml(log.product_key || '-')}</strong>
        <div class="muted">${escapeHtml(log.pub_id || log.ref || '-')}</div>
      </td>
      <td>
        <strong>${escapeHtml(log.event_name || '-')}</strong>
        <div class="muted mono">${escapeHtml(log.event_id || '-')}</div>
      </td>
      <td><span class="status ${escapeHtml(log.meta_status || 'unknown')}">${escapeHtml(log.meta_status || 'unknown')}</span></td>
      <td>
        <div>${escapeHtml(log.username || log.user_id || '-')}</div>
        <div class="muted mono">${escapeHtml(log.txn_id || '-')}</div>
      </td>
      <td>${escapeHtml(money(log.value, log.currency))}</td>
      <td>
        <div>${log.fbc ? 'fbc' : '-'} ${log.fbp ? 'fbp' : ''}</div>
        <div class="muted">${escapeHtml(log.platform || '-')} / ${escapeHtml(log.channel || '-')}</div>
      </td>
    </tr>
  `).join('');

  els.logsBody.querySelectorAll('tr[data-id]').forEach((row) => {
    row.onclick = () => {
      selectedLogId = Number(row.dataset.id);
      render();
    };
  });
}

function renderDetail(filteredLogs) {
  const selected = filteredLogs.find((log) => log.id === selectedLogId) || filteredLogs[0];
  if (!selected) {
    els.detailStatus.textContent = 'No log';
    els.detailBody.className = 'detail-empty';
    els.detailBody.textContent = 'No callback selected.';
    return;
  }

  selectedLogId = selected.id;
  els.detailStatus.textContent = selected.meta_status || 'unknown';
  els.detailBody.className = 'detail-content';
  const detailJson = JSON.stringify({
    meta_request_payload: selected.meta_request_payload || null,
    meta_response: selected.meta_response || null,
    raw_payload: selected.raw_payload || null,
    metadata: selected.metadata || null,
  }, null, 2);
  els.detailBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-field"><span>Product</span><strong>${escapeHtml(selected.product_key || '-')}</strong></div>
      <div class="detail-field"><span>Pixel</span><strong>${escapeHtml(selected.pixel_id || '-')}</strong></div>
      <div class="detail-field"><span>Event ID</span><strong class="mono">${escapeHtml(selected.event_id || '-')}</strong></div>
      <div class="detail-field"><span>Transaction</span><strong class="mono">${escapeHtml(selected.txn_id || '-')}</strong></div>
      <div class="detail-field"><span>Client IP</span><strong>${escapeHtml(selected.client_ip_address || selected.request_ip || '-')}</strong></div>
      <div class="detail-field"><span>User Agent</span><strong>${escapeHtml(selected.client_user_agent || selected.request_user_agent || '-')}</strong></div>
    </div>
    <pre>${escapeHtml(detailJson)}</pre>
  `;
}

function render() {
  renderProducts();
  renderEventFilter();
  const filteredLogs = getFilteredLogs();
  renderMetrics(filteredLogs);
  renderTable(filteredLogs);
  renderDetail(filteredLogs);
}

async function loadRealData() {
  const token = getToken();
  if (!token) {
    dataMode = 'demo';
    logs = [...demoLogs];
    els.dataState.textContent = 'Demo dataset loaded. Save an API token to load production logs.';
    render();
    return;
  }

  els.dataState.textContent = 'Loading production logs...';
  const response = await fetch('/v1/capi/logs?limit=250', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const payload = await response.json();
  logs = payload.data && payload.data.length > 0 ? payload.data : [...demoLogs];
  dataMode = payload.data && payload.data.length > 0 ? 'live' : 'demo';
  els.dataState.textContent = dataMode === 'live'
    ? `Live data loaded from ${payload.data.length} callbacks.`
    : 'No production logs yet. Demo dataset loaded.';
  render();
}

els.saveToken.onclick = async () => {
  setToken(els.token.value.trim());
  try {
    await loadRealData();
  } catch (error) {
    logs = [...demoLogs];
    dataMode = 'demo';
    els.dataState.textContent = `Could not load live data: ${error.message}. Demo dataset loaded.`;
    render();
  }
};

els.demoMode.onclick = () => {
  logs = [...demoLogs];
  dataMode = 'demo';
  els.dataState.textContent = 'Demo dataset loaded.';
  render();
};

els.refreshBtn.onclick = async () => {
  try {
    await loadRealData();
  } catch (error) {
    els.dataState.textContent = `Refresh failed: ${error.message}`;
  }
};

els.statusFilter.onchange = render;
els.eventFilter.onchange = render;
els.searchInput.oninput = render;

els.token.value = getToken();
render();
loadRealData().catch(() => render());
