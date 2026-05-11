const demo = {
  markets: [
    { market_key: 'kh', display_name: 'Cambodia', region: 'SEA', status: 'active', total_products: 2, total_logs: 1280, received_logs: 1210, error_logs: 44, unknown_logs: 26 },
    { market_key: 'id', display_name: 'Indonesia', region: 'SEA', status: 'active', total_products: 3, total_logs: 2190, received_logs: 2044, error_logs: 83, unknown_logs: 63 },
    { market_key: 'vn', display_name: 'Vietnam', region: 'SEA', status: 'paused', total_products: 1, total_logs: 540, received_logs: 498, error_logs: 22, unknown_logs: 20 },
  ],
  products: [
    { market_key: 'kh', product_key: 'live777', display_name: 'Live777 KH', category: 'Casino', status: 'active', total_logs: 820, received_logs: 792, error_logs: 18, unknown_logs: 10 },
    { market_key: 'kh', product_key: 'mga-market', display_name: 'MGA Market', category: 'Slots', status: 'paused', total_logs: 460, received_logs: 418, error_logs: 26, unknown_logs: 16 },
    { market_key: 'id', product_key: 'wingdirect', display_name: 'Wing Direct', category: 'APK', status: 'active', total_logs: 940, received_logs: 884, error_logs: 32, unknown_logs: 24 },
    { market_key: 'id', product_key: 'lucky365', display_name: 'Lucky365 ID', category: 'Casino', status: 'active', total_logs: 720, received_logs: 690, error_logs: 18, unknown_logs: 12 },
    { market_key: 'vn', product_key: 'test-game', display_name: 'Test Game VN', category: 'Sandbox', status: 'paused', total_logs: 540, received_logs: 498, error_logs: 22, unknown_logs: 20 },
  ],
  logs: [
    { id: 1, created_at: new Date().toISOString(), market_key: 'kh', product_key: 'live777', market_display_name: 'Cambodia', product_display_name: 'Live777 KH', product_category: 'Casino', event_name: 'Purchase', event_id: 'purchase_60924493165', user_id: '1016124', username: 'user.1016124', txn_id: '60924493165', ref: 'lengbear777_vipclubasia_apk', pub_id: 'lengbear777', channel: 'WING_Direct', value: '0.500000', currency: 'USD', meta_status: 'received', events_received: 1, fbtrace_id: 'TRACE_KH_001', fbc: 'fb.1.xxx', fbp: 'fb.1.yyy', client_ip_address: '182.2.181.1', request_ip: '10.0.0.12', meta_request_payload: { data: [{ event_name: 'Purchase' }] }, meta_response: { events_received: 1, fbtrace_id: 'TRACE_KH_001' } },
    { id: 2, created_at: new Date(Date.now() - 3600000).toISOString(), market_key: 'id', product_key: 'wingdirect', market_display_name: 'Indonesia', product_display_name: 'Wing Direct', product_category: 'APK', event_name: 'CompleteRegistration', event_id: 'reg_10022', user_id: '10022', txn_id: null, ref: 'wing_direct_apk', pub_id: 'wing', channel: 'APK', value: null, currency: 'USD', meta_status: 'error', events_received: 0, fbtrace_id: 'TRACE_ID_ERR', error_message: 'Invalid match key', meta_response: { error: { message: 'Invalid match key' } } },
    { id: 3, created_at: new Date(Date.now() - 7200000).toISOString(), market_key: 'id', product_key: 'lucky365', market_display_name: 'Indonesia', product_display_name: 'Lucky365 ID', product_category: 'Casino', event_name: 'Purchase', event_id: 'purchase_lucky_8821', user_id: '8821', txn_id: 'TXN8821', ref: 'lucky365_id', pub_id: 'affiliate_a', channel: 'Facebook', value: '3.000000', currency: 'USD', meta_status: 'received', events_received: 1, fbtrace_id: 'TRACE_ID_8821', meta_response: { events_received: 1 } },
    { id: 4, created_at: new Date(Date.now() - 9000000).toISOString(), market_key: 'vn', product_key: 'test-game', market_display_name: 'Vietnam', product_display_name: 'Test Game VN', product_category: 'Sandbox', event_name: 'Lead', event_id: 'lead_vn_991', user_id: '991', txn_id: null, ref: 'vn_test', pub_id: 'internal', channel: 'QA', value: null, currency: 'USD', meta_status: 'unknown', events_received: null, fbtrace_id: null, meta_response: { messages: [] } },
  ],
};

let state = {
  screen: 'overview',
  token: localStorage.getItem('capi_token') || '',
  auth: null,
  markets: [...demo.markets],
  products: [...demo.products],
  logs: [...demo.logs],
  selectedMarket: null,
  selectedProduct: null,
  filters: {},
  demoMode: true,
};

const $ = (id) => document.getElementById(id);
const content = $('content');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function toIsoDate(ddmmyyyy) {
  if (!ddmmyyyy) return '';
  const match = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return ddmmyyyy;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function fromIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-GB').format(date).replaceAll('/', '-');
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

function setScreen(screen, params = {}) {
  state.screen = screen;
  Object.assign(state, params);
  const activeScreen = screen === 'product' ? 'products' : screen;
  document.querySelectorAll('.nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.screen === activeScreen);
  });
  render();
}

function setShell(title, subtitle, crumb) {
  $('screenTitle').textContent = title;
  $('screenSubtitle').textContent = subtitle;
  $('breadcrumb').textContent = crumb || `Workspace / ${title}`;
  $('shellMode').textContent = state.demoMode ? 'Demo data preview' : 'Live data connected';
  $('authBadge').textContent = state.auth ? `${state.auth.role || 'user'} session` : 'Not signed in';
}

function statusPill(status) {
  return `<span class="status ${esc(status || 'unknown')}">${esc(status || 'unknown')}</span>`;
}

function metrics(items) {
  return `<section class="grid metrics">${items.map((item) => `
    <article class="metric"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong>${item.note ? `<p class="muted mini">${esc(item.note)}</p>` : ''}</article>
  `).join('')}</section>`;
}

function table(headers, rows) {
  const body = rows.length
    ? rows.join('')
    : `<tr><td colspan="${headers.length}" class="muted">No data for the selected scope.</td></tr>`;
  return `<div class="panel"><div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}

function summarize(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.total_logs || row.total_events || 0), 0);
  const received = rows.reduce((sum, row) => sum + Number(row.received_logs || row.received_events || 0), 0);
  const errors = rows.reduce((sum, row) => sum + Number(row.error_logs || row.error_events || 0), 0);
  return {
    total,
    received,
    errors,
    errorRate: total ? `${Math.round((errors / total) * 100)}%` : '0%',
  };
}

function errorRate(total, errors) {
  return Number(total) ? `${Math.round((Number(errors || 0) / Number(total)) * 100)}%` : '0%';
}

function entityStats(total, received, errors) {
  return `
    <div class="entity-stats">
      <div><span>Events</span><strong>${esc(total || 0)}</strong></div>
      <div><span>Received</span><strong>${esc(received || 0)}</strong></div>
      <div><span>Error rate</span><strong>${esc(errorRate(total, errors))}</strong></div>
    </div>
  `;
}

function marketCards(markets) {
  return `<section class="entity-grid">${markets.map((m) => `
    <article class="entity-card">
      <div class="entity-top">
        <div class="entity-title">
          <strong><span class="link" data-market="${esc(m.market_key)}">${esc(m.display_name || m.market_key)}</span></strong>
          <span class="mono">${esc(m.market_key)} / ${esc(m.region || 'region unset')}</span>
        </div>
        ${statusPill(m.status)}
      </div>
      ${entityStats(m.total_logs, m.received_logs, m.error_logs)}
    </article>
  `).join('')}</section>`;
}

function productCards(products) {
  return `<section class="entity-grid">${products.map((p) => `
    <article class="entity-card">
      <div class="entity-top">
        <div class="entity-title">
          <strong><span class="link" data-product="${esc(p.market_key)}:${esc(p.product_key)}">${esc(p.display_name || p.product_key)}</span></strong>
          <span class="mono">${esc(p.market_key)} / ${esc(p.product_key)} / ${esc(p.category || 'uncategorized')}</span>
        </div>
        ${statusPill(p.status)}
      </div>
      ${entityStats(p.total_logs, p.received_logs, p.error_logs)}
    </article>
  `).join('')}</section>`;
}

function renderOverview() {
  const summary = summarize(state.markets);
  setShell('Overview', 'Executive summary across markets, products, and Meta CAPI callbacks.', 'Workspace / Overview');
  content.innerHTML = `
    <section class="workflow">
      <article class="step-card"><span>01</span><strong>Market scope</strong><p>Separate traffic by country or business territory: kh, id, vn.</p></article>
      <article class="step-card"><span>02</span><strong>Product catalog</strong><p>Each game build has its own log stream, owner, status, and category.</p></article>
      <article class="step-card"><span>03</span><strong>Event audit</strong><p>Trace backend sent, Meta response, user attribution, and transaction data.</p></article>
      <article class="step-card"><span>04</span><strong>Daily compare</strong><p>Review today, previous period, and same weekday last week on one chart.</p></article>
    </section>
    ${metrics([
      { label: 'Total events', value: summary.total, note: 'Selected range' },
      { label: 'Meta received', value: summary.received, note: 'events_received > 0' },
      { label: 'Errors', value: summary.errors, note: 'Meta error response' },
      { label: 'Error rate', value: summary.errorRate, note: 'Across visible scope' },
      { label: 'Products', value: state.products.length, note: `${state.markets.length} markets` },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Market health</h2><button class="primary" data-go="markets">Open Markets</button></div>
        <div class="panel-body">${marketCards(state.markets)}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Compare chart</h2><span class="muted">Current / previous / last week</span></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          <div class="legend">
            <span style="--dot:#0f766e">Current</span>
            <span style="--dot:#b42318">Previous</span>
            <span style="--dot:#9a6700">Last week</span>
          </div>
        </div>
      </section>
    </div>
  `;
  drawDemoChart();
}

function marketRows(markets, compact = false) {
  return table(['Market', 'Products', 'Events', 'Received', 'Error rate', 'Status'], markets.map((m) => {
    const rate = Number(m.total_logs) ? `${Math.round((Number(m.error_logs) / Number(m.total_logs)) * 100)}%` : '0%';
    return `<tr>
      <td><span class="link" data-market="${esc(m.market_key)}">${esc(m.display_name || m.market_key)}</span><div class="muted mono">${esc(m.market_key)}</div></td>
      <td>${esc(m.total_products || 0)}</td>
      <td>${esc(m.total_logs || 0)}</td>
      <td>${esc(m.received_logs || 0)}</td>
      <td>${rate}</td>
      <td>${statusPill(m.status)}</td>
    </tr>`;
  })).replace('class="panel"', compact ? 'class="panel" style="box-shadow:none"' : 'class="panel"');
}

function renderMarkets() {
  setShell('Markets', 'Top-level business scopes. Open a market to review its products.', 'Workspace / Markets');
  content.innerHTML = `
    ${metrics([
      { label: 'Markets', value: state.markets.length, note: 'Accessible scopes' },
      { label: 'Products', value: state.products.length, note: 'All visible products' },
      { label: 'Active markets', value: state.markets.filter((m) => m.status === 'active').length, note: 'Ready for callbacks' },
      { label: 'Total logs', value: summarize(state.markets).total, note: 'Selected range' },
      { label: 'Errors', value: summarize(state.markets).errors, note: 'Needs review' },
    ])}
    ${marketCards(state.markets)}
    ${marketRows(state.markets)}
  `;
}

function renderProducts() {
  const products = state.selectedMarket
    ? state.products.filter((p) => p.market_key === state.selectedMarket)
    : state.products;
  setShell(
    state.selectedMarket ? `Products in ${state.selectedMarket}` : 'Products',
    'Products are game builds or properties inside a market.',
    state.selectedMarket ? `Workspace / Markets / ${state.selectedMarket} / Products` : 'Workspace / Products'
  );
  content.innerHTML = `
    ${productCards(products)}
    ${table(['Market / Product', 'Category', 'Events', 'Received', 'Errors', 'Status'], products.map((p) => `
    <tr>
      <td><span class="link" data-product="${esc(p.market_key)}:${esc(p.product_key)}">${esc(p.display_name || p.product_key)}</span><div class="muted mono">${esc(p.market_key)} / ${esc(p.product_key)}</div></td>
      <td>${esc(p.category || '-')}</td>
      <td>${esc(p.total_logs || 0)}</td>
      <td>${esc(p.received_logs || 0)}</td>
      <td>${esc(p.error_logs || 0)}</td>
      <td>${statusPill(p.status)}</td>
    </tr>
  `))}
  `;
}

function renderLogs() {
  setShell(
    state.selectedProduct ? `Logs: ${state.selectedProduct.product_key}` : 'Logs',
    'Filter event fields, inspect payloads, and verify Meta response status.',
    state.selectedProduct
      ? `Workspace / ${state.selectedProduct.market_key} / ${state.selectedProduct.product_key} / Logs`
      : 'Workspace / Logs'
  );
  const logs = filterLogs(state.logs);
  content.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Filters</h2><span class="muted">Date format dd-mm-yyyy</span></div>
      <div class="panel-body filters">
        <input id="filterSearch" value="${esc(state.filters.search || '')}" placeholder="event_id, txn_id, user_id, fbtrace">
        <select id="filterStatus"><option value="">All status</option><option>received</option><option>error</option><option>unknown</option></select>
        <input id="filterEvent" value="${esc(state.filters.event || '')}" placeholder="event_name">
        <input id="filterRef" value="${esc(state.filters.ref || '')}" placeholder="ref / pub_id / channel">
        <button id="applyFilters" class="primary">Apply</button>
      </div>
    </section>
    ${metrics([
      { label: 'Visible logs', value: logs.length, note: 'After filters' },
      { label: 'Received', value: logs.filter((l) => l.meta_status === 'received').length, note: 'Meta accepted' },
      { label: 'Errors', value: logs.filter((l) => l.meta_status === 'error').length, note: 'Needs action' },
      { label: 'Unknown', value: logs.filter((l) => l.meta_status === 'unknown').length, note: 'Incomplete response' },
      { label: 'Purchases', value: logs.filter((l) => l.event_name === 'Purchase').length, note: 'Conversion events' },
    ])}
    ${table(['Time', 'Market / Product', 'Event', 'Status', 'User / Txn', 'Value', 'Trace'], logs.map((log) => `
      <tr>
        <td>${fromIsoDate(log.created_at)}<div class="muted">${new Date(log.created_at).toLocaleTimeString()}</div></td>
        <td>${esc(log.market_display_name || log.market_key)} / ${esc(log.product_display_name || log.product_key)}<div class="muted mono">${esc(log.market_key)} / ${esc(log.product_key)}</div></td>
        <td><span class="link" data-log="${esc(log.id)}">${esc(log.event_name)}</span><div class="muted mono">${esc(log.event_id)}</div></td>
        <td>${statusPill(log.meta_status)}</td>
        <td>${esc(log.username || log.user_id || '-')}<div class="muted mono">${esc(log.txn_id || '-')}</div></td>
        <td>${log.value ? `${Number(log.value).toFixed(2)} ${esc(log.currency || '')}` : '-'}</td>
        <td class="mono">${esc(log.fbtrace_id || '-')}</td>
      </tr>
    `))}
  `;
  $('filterStatus').value = state.filters.status || '';
  $('applyFilters').onclick = () => {
    state.filters = {
      search: $('filterSearch').value.trim(),
      status: $('filterStatus').value,
      event: $('filterEvent').value.trim(),
      ref: $('filterRef').value.trim(),
    };
    renderLogs();
    bindLinks();
  };
}

function renderProductDetail() {
  const product = state.selectedProduct;
  if (!product) return renderProducts();
  const logs = state.logs.filter((l) => l.market_key === product.market_key && l.product_key === product.product_key);
  const summary = summarize([{ total_logs: logs.length, received_logs: logs.filter((l) => l.meta_status === 'received').length, error_logs: logs.filter((l) => l.meta_status === 'error').length }]);
  setShell(
    product.display_name || product.product_key,
    'Product-level statistics, catalog settings, comparison chart, and latest event logs.',
    `Workspace / ${product.market_key} / ${product.product_key}`
  );
  content.innerHTML = `
    ${metrics([
      { label: 'Events', value: summary.total, note: 'This product' },
      { label: 'Received', value: summary.received, note: 'Meta accepted' },
      { label: 'Errors', value: summary.errors, note: 'Check response' },
      { label: 'Error rate', value: summary.errorRate, note: 'Current scope' },
      { label: 'Status', value: product.status || '-', note: product.category || 'Category unset' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Comparison</h2><span class="muted">Current / previous / last week</span></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          <div class="legend">
            <span style="--dot:#0f766e">Current</span>
            <span style="--dot:#b42318">Previous</span>
            <span style="--dot:#9a6700">Last week</span>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Catalog</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><label>Display name</label><input id="catName" value="${esc(product.display_name || '')}"></div>
            <div><label>Category</label><input id="catCategory" value="${esc(product.category || '')}"></div>
            <div><label>Status</label><select id="catStatus"><option>active</option><option>paused</option><option>archived</option></select></div>
            <div><label>Owner</label><input id="catOwner" value="${esc(product.owner || '')}"></div>
            <div class="full"><label>Notes</label><input id="catNotes" value="${esc(product.notes || '')}"></div>
          </div>
          <div class="actions"><button id="saveCatalog" class="primary">Save catalog</button></div>
        </div>
      </section>
    </div>
    <div style="height:14px"></div>
    ${table(['Time', 'Event', 'Status', 'User / Txn', 'Value', 'Trace'], logs.map((log) => `
      <tr>
        <td>${fromIsoDate(log.created_at)}</td>
        <td><span class="link" data-log="${esc(log.id)}">${esc(log.event_name)}</span><div class="muted mono">${esc(log.event_id)}</div></td>
        <td>${statusPill(log.meta_status)}</td>
        <td>${esc(log.user_id || '-')}<div class="muted mono">${esc(log.txn_id || '-')}</div></td>
        <td>${log.value || '-'}</td>
        <td class="mono">${esc(log.fbtrace_id || '-')}</td>
      </tr>
    `))}
  `;
  $('catStatus').value = product.status || 'active';
  $('saveCatalog').onclick = () => saveCatalog(product);
  loadCompare(product);
}

function renderAnalytics() {
  const summary = summarize(state.markets);
  setShell('Analytics', 'Daily comparison view for current period, previous period, and same weekday last week.', 'Workspace / Analytics');
  content.innerHTML = `
    ${metrics([
      { label: 'Current events', value: summary.total, note: 'Current date range' },
      { label: 'Meta received', value: summary.received, note: 'Accepted callbacks' },
      { label: 'Error rate', value: summary.errorRate, note: 'Across visible markets' },
      { label: 'Best product', value: state.products[0]?.product_key || '-', note: 'By visible volume' },
      { label: 'Raw retention', value: '30d', note: 'Detailed event payload' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Daily comparison</h2><span class="muted">3-line attribution trend</span></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          <div class="legend">
            <span style="--dot:#0f766e">Current</span>
            <span style="--dot:#b42318">Previous period</span>
            <span style="--dot:#9a6700">Same weekday last week</span>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Operating notes</h2></div>
        <div class="panel-body kv">
          <div><span>Raw detail</span><strong>Keep full payload for 1 month</strong></div>
          <div><span>Aggregates</span><strong>Keep daily totals for long-term reporting</strong></div>
          <div><span>Attribution</span><strong>Break down by market, product, event, ref, pub_id, channel</strong></div>
        </div>
      </section>
    </div>
    <div style="height:14px"></div>
    ${table(['Product', 'Market', 'Events', 'Received', 'Errors', 'Status'], state.products.map((p) => `
      <tr>
        <td><span class="link" data-product="${esc(p.market_key)}:${esc(p.product_key)}">${esc(p.display_name || p.product_key)}</span><div class="muted mono">${esc(p.product_key)}</div></td>
        <td class="mono">${esc(p.market_key)}</td>
        <td>${esc(p.total_logs || 0)}</td>
        <td>${esc(p.received_logs || 0)}</td>
        <td>${esc(p.error_logs || 0)}</td>
        <td>${statusPill(p.status)}</td>
      </tr>
    `))}
  `;
  drawDemoChart();
}

function renderUsers() {
  setShell('Users', 'Admin-only account and access management by username and password.', 'Workspace / Admin / Users');
  content.innerHTML = `
    <div class="split">
      <section class="panel"><div class="panel-head"><h2>User accounts</h2><button id="loadUsers" class="primary">Load users</button></div><div id="usersTable" class="panel-body muted">Click Load users to fetch live accounts.</div></section>
      <section class="panel"><div class="panel-head"><h2>Create user</h2></div><div class="panel-body">
        <div class="form-grid">
          <div><label>Username</label><input id="newUsername" placeholder="username"></div>
          <div><label>Display name</label><input id="newName" placeholder="display name"></div>
          <div><label>Password</label><input id="newPassword" placeholder="password"></div>
          <div><label>Role</label><select id="newRole"><option>viewer</option><option>manager</option><option>admin</option></select></div>
        </div>
        <div class="actions"><button id="createUser" class="primary">Create</button></div>
      </div></section>
    </div>
  `;
  $('loadUsers').onclick = loadUsers;
  $('createUser').onclick = createUser;
}

function filterLogs(logs) {
  let output = logs;
  if (state.selectedProduct) {
    output = output.filter((log) => log.market_key === state.selectedProduct.market_key && log.product_key === state.selectedProduct.product_key);
  }
  if (state.filters.status) {
    output = output.filter((log) => log.meta_status === state.filters.status);
  }
  if (state.filters.event) {
    output = output.filter((log) => String(log.event_name || '').toLowerCase().includes(state.filters.event.toLowerCase()));
  }
  if (state.filters.ref) {
    const needle = state.filters.ref.toLowerCase();
    output = output.filter((log) => [log.ref, log.pub_id, log.channel].some((value) => String(value || '').toLowerCase().includes(needle)));
  }
  if (state.filters.search) {
    const needle = state.filters.search.toLowerCase();
    output = output.filter((log) => [
      log.event_id,
      log.txn_id,
      log.user_id,
      log.username,
      log.fbtrace_id,
      log.market_key,
      log.product_key,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }
  return output;
}

function render() {
  document.body.classList.toggle('admin-auth', Boolean(state.auth && state.auth.is_admin));
  if (state.screen === 'overview') renderOverview();
  if (state.screen === 'markets') renderMarkets();
  if (state.screen === 'products') renderProducts();
  if (state.screen === 'logs') renderLogs();
  if (state.screen === 'product') renderProductDetail();
  if (state.screen === 'analytics') renderAnalytics();
  if (state.screen === 'users') renderUsers();
  bindLinks();
}

function bindLinks() {
  document.querySelectorAll('[data-go]').forEach((el) => el.onclick = () => setScreen(el.dataset.go));
  document.querySelectorAll('[data-market]').forEach((el) => el.onclick = () => setScreen('products', { selectedMarket: el.dataset.market }));
  document.querySelectorAll('[data-product]').forEach((el) => el.onclick = () => {
    const [market_key, product_key] = el.dataset.product.split(':');
    const product = state.products.find((p) => p.market_key === market_key && p.product_key === product_key);
    setScreen('product', { selectedProduct: product });
  });
  document.querySelectorAll('[data-log]').forEach((el) => el.onclick = () => showLog(Number(el.dataset.log)));
}

function showLog(id) {
  const log = state.logs.find((item) => Number(item.id) === id);
  if (!log) return;
  $('modalBody').innerHTML = `
    <div class="detail-grid">
      <section class="kv">
        <div><span>Market / Product</span><strong>${esc(log.market_key)} / ${esc(log.product_key)}</strong></div>
        <div><span>Event</span><strong>${esc(log.event_name)}</strong><p class="muted mono">${esc(log.event_id)}</p></div>
        <div><span>Meta status</span>${statusPill(log.meta_status)}<p class="muted mini">events_received: ${esc(log.events_received ?? '-')}</p></div>
        <div><span>User / Transaction</span><strong>${esc(log.username || log.user_id || '-')}</strong><p class="muted mono">${esc(log.txn_id || '-')}</p></div>
        <div><span>Attribution</span><p class="muted mini">ref: ${esc(log.ref || '-')}</p><p class="muted mini">pub_id: ${esc(log.pub_id || '-')}</p><p class="muted mini">channel: ${esc(log.channel || '-')}</p></div>
        <div><span>Network</span><p class="muted mini">client_ip: ${esc(log.client_ip_address || '-')}</p><p class="muted mini">request_ip: ${esc(log.request_ip || '-')}</p></div>
      </section>
      <section class="panel" style="box-shadow:none">
        <div class="panel-head"><h2>Full event payload</h2><span class="muted mono">${esc(log.fbtrace_id || 'no fbtrace')}</span></div>
        <div class="panel-body"><pre>${esc(JSON.stringify(log, null, 2))}</pre></div>
      </section>
    </div>
  `;
  $('modal').classList.remove('hidden');
}

function drawDemoChart(rows) {
  const canvas = $('compareChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  const series = rows || [
    { name: 'current', color: '#0f766e', values: [12, 18, 20, 28, 36, 44, 52] },
    { name: 'previous', color: '#b42318', values: [10, 15, 17, 22, 31, 37, 40] },
    { name: 'last_week', color: '#9a6700', values: [8, 11, 16, 20, 24, 30, 34] },
  ];
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  series.forEach((line) => {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    line.values.forEach((value, index) => {
      const x = 22 + (index * (canvas.clientWidth - 44)) / (line.values.length - 1);
      const y = canvas.clientHeight - 24 - (value / max) * (canvas.clientHeight - 48);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

async function loadCompare(product) {
  try {
    const payload = await api(`/v1/analytics/markets/${product.market_key}/products/${product.product_key}/compare?days=7`);
    const grouped = ['current', 'previous', 'last_week'].map((period, index) => ({
      name: period,
      color: ['#0f766e', '#b42318', '#9a6700'][index],
      values: payload.data.series.filter((row) => row.period === period).map((row) => row.total_events),
    }));
    drawDemoChart(grouped);
  } catch {
    drawDemoChart();
  }
}

async function loadData() {
  if (!state.token) {
    state.demoMode = true;
    state.auth = null;
    document.body.classList.remove('admin-auth');
    $('authState').textContent = 'Demo mode. Save token or login to load live data.';
    render();
    return;
  }
  try {
    const [me, markets, products, logs] = await Promise.all([
      api('/v1/auth/me'),
      api('/v1/markets'),
      api('/v1/products'),
      api(`/v1/capi/logs?limit=250&date_from=${toIsoDate($('dateFrom').value)}&date_to=${toIsoDate($('dateTo').value)}`),
    ]);
    state.auth = me.data;
    state.markets = markets.data;
    state.products = products.data;
    state.logs = logs.data;
    state.demoMode = false;
    $('authState').textContent = `${me.data.role || 'token'} loaded.`;
    document.body.classList.toggle('admin-auth', Boolean(me.data.is_admin));
    document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
      el.style.display = me.data.is_admin ? '' : 'none';
    });
    render();
  } catch (error) {
    $('authState').textContent = `Live load failed (${error.message}). Showing demo data.`;
    state.auth = null;
    state.demoMode = true;
    document.body.classList.remove('admin-auth');
    state.markets = [...demo.markets];
    state.products = [...demo.products];
    state.logs = [...demo.logs];
    render();
  }
}

async function saveCatalog(product) {
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
  await loadData();
}

async function loadUsers() {
  const payload = await api('/v1/admin/users');
  $('usersTable').innerHTML = table(['Username', 'Name', 'Role', 'Status', 'Markets', 'Products'], payload.data.map((u) => `
    <tr><td>${esc(u.username)}</td><td>${esc(u.display_name || '-')}</td><td>${esc(u.role)}</td><td>${statusPill(u.status)}</td><td>${esc((u.markets || []).join(', '))}</td><td>${esc((u.products || []).map((p) => `${p.market_key}/${p.product_key}`).join(', '))}</td></tr>
  `));
}

async function createUser() {
  await api('/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      username: $('newUsername').value,
      display_name: $('newName').value,
      password: $('newPassword').value,
      role: $('newRole').value,
    }),
  });
  await loadUsers();
}

document.querySelectorAll('.nav button').forEach((button) => button.onclick = () => setScreen(button.dataset.screen));
$('saveToken').onclick = () => { state.token = $('tokenInput').value.trim(); localStorage.setItem('capi_token', state.token); loadData(); };
$('loginBtn').onclick = async () => {
  const payload = await api('/v1/auth/login', {
    method: 'POST',
    headers: {},
    body: JSON.stringify({ username: $('usernameInput').value, password: $('passwordInput').value }),
  });
  state.token = payload.data.token;
  localStorage.setItem('capi_token', state.token);
  $('tokenInput').value = state.token;
  await loadData();
};
$('demoBtn').onclick = () => {
  localStorage.removeItem('capi_token');
  state.token = '';
  state.auth = null;
  state.demoMode = true;
  document.body.classList.remove('admin-auth');
  state.markets = demo.markets;
  state.products = demo.products;
  state.logs = demo.logs;
  render();
};
$('refreshBtn').onclick = loadData;
$('closeModal').onclick = () => $('modal').classList.add('hidden');

$('tokenInput').value = state.token;
$('dateTo').value = fromIsoDate(new Date());
$('dateFrom').value = fromIsoDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
render();
loadData();
