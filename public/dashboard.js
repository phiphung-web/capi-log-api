const demo = {
  markets: [
    { market_key: 'kh', display_name: 'Cambodia', region: 'SEA', status: 'active', total_products: 2, total_logs: 1280, received_logs: 1210, error_logs: 44, unknown_logs: 26 },
    { market_key: 'id', display_name: 'Indonesia', region: 'SEA', status: 'active', total_products: 3, total_logs: 2190, received_logs: 2044, error_logs: 83, unknown_logs: 63 },
  ],
  products: [
    { market_key: 'kh', product_key: 'live777', display_name: 'Live777 KH', category: 'Casino', status: 'active', total_logs: 820, received_logs: 792, error_logs: 18, unknown_logs: 10 },
    { market_key: 'kh', product_key: 'mga-market', display_name: 'MGA Market', category: 'Slots', status: 'paused', total_logs: 460, received_logs: 418, error_logs: 26, unknown_logs: 16 },
    { market_key: 'id', product_key: 'wingdirect', display_name: 'Wing Direct', category: 'APK', status: 'active', total_logs: 940, received_logs: 884, error_logs: 32, unknown_logs: 24 },
  ],
  logs: [
    { id: 1, created_at: new Date().toISOString(), market_key: 'kh', product_key: 'live777', market_display_name: 'Cambodia', product_display_name: 'Live777 KH', product_category: 'Casino', event_name: 'Purchase', event_id: 'purchase_60924493165', user_id: '1016124', txn_id: '60924493165', value: '0.500000', currency: 'USD', meta_status: 'received', events_received: 1, fbtrace_id: 'TRACE_KH_001', fbc: 'fb.1.xxx', fbp: 'fb.1.yyy', request_ip: '182.2.181.1', meta_request_payload: { data: [{ event_name: 'Purchase' }] }, meta_response: { events_received: 1 } },
    { id: 2, created_at: new Date(Date.now() - 3600000).toISOString(), market_key: 'id', product_key: 'wingdirect', market_display_name: 'Indonesia', product_display_name: 'Wing Direct', product_category: 'APK', event_name: 'CompleteRegistration', event_id: 'reg_10022', user_id: '10022', txn_id: null, value: null, currency: 'USD', meta_status: 'error', events_received: 0, fbtrace_id: 'TRACE_ID_ERR', error_message: 'Invalid match key', meta_response: { error: { message: 'Invalid match key' } } },
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
  document.querySelectorAll('.nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.screen === screen);
  });
  render();
}

function statusPill(status) {
  return `<span class="status ${esc(status || 'unknown')}">${esc(status || 'unknown')}</span>`;
}

function metrics(items) {
  return `<section class="grid metrics">${items.map((item) => `
    <article class="metric"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>
  `).join('')}</section>`;
}

function table(headers, rows) {
  return `<div class="panel"><div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
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

function renderOverview() {
  const summary = summarize(state.markets);
  $('screenTitle').textContent = 'Overview';
  $('screenSubtitle').textContent = 'Executive summary for markets and products you can access.';
  content.innerHTML = `
    <section class="workflow">
      <article class="step-card"><span>1</span><strong>Markets</strong><p>Group traffic by business territory such as kh, id, vn.</p></article>
      <article class="step-card"><span>2</span><strong>Products</strong><p>Manage each game build, category, owner, and operational status.</p></article>
      <article class="step-card"><span>3</span><strong>Event Logs</strong><p>Inspect CAPI callbacks, attribution fields, Meta response, and transaction data.</p></article>
      <article class="step-card"><span>4</span><strong>Analytics</strong><p>Compare today, previous period, and same weekday last week.</p></article>
    </section>
    ${metrics([
      { label: 'Total events', value: summary.total },
      { label: 'Meta received', value: summary.received },
      { label: 'Errors', value: summary.errors },
      { label: 'Error rate', value: summary.errorRate },
      { label: 'Markets', value: state.markets.length },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Markets</h2><button class="primary" data-go="markets">Open</button></div>
        <div class="panel-body">${marketRows(state.markets, true)}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Compare chart</h2><span class="muted">Today / Yesterday / Last week</span></div>
        <div class="panel-body"><canvas id="compareChart" class="chart"></canvas></div>
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
  $('screenTitle').textContent = 'Markets';
  $('screenSubtitle').textContent = 'Markets are top-level business scopes, such as kh, id, vn.';
  content.innerHTML = marketRows(state.markets);
}

function renderProducts() {
  const products = state.selectedMarket
    ? state.products.filter((p) => p.market_key === state.selectedMarket)
    : state.products;
  $('screenTitle').textContent = state.selectedMarket ? `Products in ${state.selectedMarket}` : 'Products';
  $('screenSubtitle').textContent = 'Products are game builds or properties inside a market.';
  content.innerHTML = table(['Market / Product', 'Category', 'Events', 'Received', 'Errors', 'Status'], products.map((p) => `
    <tr>
      <td><span class="link" data-product="${esc(p.market_key)}:${esc(p.product_key)}">${esc(p.display_name || p.product_key)}</span><div class="muted mono">${esc(p.market_key)} / ${esc(p.product_key)}</div></td>
      <td>${esc(p.category || '-')}</td>
      <td>${esc(p.total_logs || 0)}</td>
      <td>${esc(p.received_logs || 0)}</td>
      <td>${esc(p.error_logs || 0)}</td>
      <td>${statusPill(p.status)}</td>
    </tr>
  `));
}

function renderLogs() {
  $('screenTitle').textContent = state.selectedProduct ? `Logs: ${state.selectedProduct.product_key}` : 'Logs';
  $('screenSubtitle').textContent = 'Filter by event fields and inspect full event payload in a modal.';
  const logs = filterLogs(state.logs);
  content.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Filters</h2><span class="muted">Date format dd-mm-yyyy</span></div>
      <div class="panel-body filters">
        <input id="filterSearch" placeholder="event_id, txn_id, user_id, fbtrace">
        <select id="filterStatus"><option value="">All status</option><option>received</option><option>error</option><option>unknown</option></select>
        <input id="filterEvent" placeholder="event_name">
        <input id="filterRef" placeholder="ref / pub_id / channel">
        <button id="applyFilters" class="primary">Apply</button>
      </div>
    </section>
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
}

function renderProductDetail() {
  const product = state.selectedProduct;
  if (!product) return renderProducts();
  const logs = state.logs.filter((l) => l.market_key === product.market_key && l.product_key === product.product_key);
  const summary = summarize([{ total_logs: logs.length, received_logs: logs.filter((l) => l.meta_status === 'received').length, error_logs: logs.filter((l) => l.meta_status === 'error').length }]);
  $('screenTitle').textContent = product.display_name || product.product_key;
  $('screenSubtitle').textContent = `${product.market_key} / ${product.product_key}`;
  content.innerHTML = `
    ${metrics([
      { label: 'Events', value: summary.total },
      { label: 'Received', value: summary.received },
      { label: 'Errors', value: summary.errors },
      { label: 'Error rate', value: summary.errorRate },
      { label: 'Status', value: product.status || '-' },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Comparison</h2><span class="muted">Current / previous / last week</span></div>
        <div class="panel-body"><canvas id="compareChart" class="chart"></canvas></div>
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

function renderUsers() {
  $('screenTitle').textContent = 'Users';
  $('screenSubtitle').textContent = 'Admin-only account and access management.';
  content.innerHTML = `
    <div class="split">
      <section class="panel"><div class="panel-head"><h2>Users</h2><button id="loadUsers" class="primary">Load</button></div><div id="usersTable" class="panel-body muted">Click Load.</div></section>
      <section class="panel"><div class="panel-head"><h2>Create user</h2></div><div class="panel-body">
        <div class="form-grid">
          <input id="newUsername" placeholder="username">
          <input id="newName" placeholder="display name">
          <input id="newPassword" placeholder="password">
          <select id="newRole"><option>viewer</option><option>manager</option><option>admin</option></select>
        </div>
        <div class="actions"><button id="createUser" class="primary">Create</button></div>
      </div></section>
    </div>
  `;
  $('loadUsers').onclick = loadUsers;
  $('createUser').onclick = createUser;
}

function filterLogs(logs) {
  if (!state.selectedProduct) return logs;
  return logs.filter((log) => log.market_key === state.selectedProduct.market_key && log.product_key === state.selectedProduct.product_key);
}

function render() {
  document.body.classList.toggle('admin-auth', Boolean(state.auth && state.auth.is_admin));
  if (state.screen === 'overview') renderOverview();
  if (state.screen === 'markets') renderMarkets();
  if (state.screen === 'products') renderProducts();
  if (state.screen === 'logs') renderLogs();
  if (state.screen === 'product') renderProductDetail();
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
  $('modalBody').innerHTML = `<pre>${esc(JSON.stringify(log, null, 2))}</pre>`;
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
    { name: 'current', color: '#16697a', values: [12, 18, 20, 28, 36, 44, 52] },
    { name: 'previous', color: '#b42318', values: [10, 15, 17, 22, 31, 37, 40] },
    { name: 'last_week', color: '#946200', values: [8, 11, 16, 20, 24, 30, 34] },
  ];
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  series.forEach((line) => {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
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
      color: ['#16697a', '#b42318', '#946200'][index],
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
    state.markets = markets.data.length ? markets.data : demo.markets;
    state.products = products.data.length ? products.data : demo.products;
    state.logs = logs.data.length ? logs.data : demo.logs;
    state.demoMode = logs.data.length === 0;
    $('authState').textContent = `${me.data.role || 'token'} loaded.`;
    document.body.classList.toggle('admin-auth', Boolean(me.data.is_admin));
    document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
      el.style.display = me.data.is_admin ? '' : 'none';
    });
    render();
  } catch (error) {
    $('authState').textContent = `Live load failed (${error.message}). Showing demo data.`;
    state.auth = null;
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
