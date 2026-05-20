const TOKEN_KEY = 'capi_dashboard_token';
const THEME_KEY = 'capi_dashboard_theme';

const state = {
  auth: null,
  token: localStorage.getItem(TOKEN_KEY) || '',
  booting: false,
  dataLoading: false,
  routeLoading: false,
  error: '',
  dateFrom: ymd(addDays(new Date(), -6)),
  dateTo: ymd(new Date()),
  theme: localStorage.getItem(THEME_KEY) || 'dark',
  markets: [],
  products: [],
  logs: [],
  overviewToday: null,
  overviewRange: null,
  reconciliation: null,
  selectedProducts: new Set(),
  compareData: null,
  productDetailCache: new Map(),
  admin: {
    tab: 'users',
    users: [],
    loading: false,
  },
};

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

function ymd(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function displayDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date).replaceAll('/', '-');
}

function displayDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function n(value) {
  return Number(value || 0);
}

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: digits,
  }).format(n(value));
}

function money(value, currency = 'USD') {
  return `${fmt(value, 2)} ${currency || 'USD'}`;
}

function pct(value, total) {
  if (!n(total)) return 0;
  return (n(value) / n(total)) * 100;
}

function pctText(value) {
  return `${fmt(value, 1)}%`;
}

function text(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function escapeHtml(value) {
  return text(value, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function classForStatus(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  if (['active', 'received', 'healthy'].includes(normalized)) return 'good';
  if (['warning', 'unknown', 'pending'].includes(normalized)) return 'warn';
  if (['disabled', 'error', 'blocked'].includes(normalized)) return 'bad';
  return 'neutral';
}

function statusLabel(status) {
  const labels = {
    active: 'Đang hoạt động',
    disabled: 'Tạm dừng',
    received: 'Meta nhận',
    error: 'Lỗi',
    unknown: 'Chưa rõ',
    healthy: 'Ổn định',
    warning: 'Cảnh báo',
  };
  return labels[String(status || '').toLowerCase()] || text(status, 'Chưa rõ');
}

function roleLabel(role) {
  return {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    viewer: 'Người xem',
    user: 'Người dùng',
  }[role] || text(role, 'Người dùng');
}

function currentRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/dashboard';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (path === '/dashboard/login') return { name: 'login', nav: '', title: 'Đăng nhập' };
  if (path === '/dashboard') return { name: 'home', nav: 'home', title: 'Trang chủ' };
  if (path === '/dashboard/markets') return { name: 'markets', nav: 'markets', title: 'Thị trường' };
  if (parts[1] === 'markets' && parts[2] && !parts[3]) {
    return { name: 'marketDetail', nav: 'markets', title: 'Sản phẩm theo thị trường', marketKey: parts[2] };
  }
  if (parts[1] === 'markets' && parts[2] && parts[3] === 'products' && parts[4]) {
    return {
      name: 'productDetail',
      nav: 'products',
      title: 'Chi tiết sản phẩm',
      marketKey: parts[2],
      productKey: parts[4],
    };
  }
  if (path === '/dashboard/products') return { name: 'products', nav: 'products', title: 'Sản phẩm' };
  if (path === '/dashboard/admin') return { name: 'admin', nav: 'admin', title: 'Quản trị' };
  return { name: 'home', nav: 'home', title: 'Trang chủ' };
}

function go(path) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  render();
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    setToken('');
    if (window.location.pathname !== '/dashboard/login') go('/dashboard/login');
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }

  if (!response.ok) {
    throw new Error(payload?.message || `API lỗi ${response.status}`);
  }

  return payload?.data ?? payload;
}

const api = {
  login: (payload) => request('/v1/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/v1/auth/me'),
  overview: (range) => request(`/v1/analytics/overview${query(range)}`),
  reconciliation: (range) => request(`/v1/analytics/reconciliation${query(range)}`),
  markets: () => request('/v1/markets'),
  products: (marketKey = '') => request(marketKey ? `/v1/markets/${encodeURIComponent(marketKey)}/products` : '/v1/products'),
  logs: ({ marketKey = '', productKey = '', limit = 250, offset = 0, date_from, date_to } = {}) => {
    const base = marketKey && productKey
      ? `/v1/markets/${encodeURIComponent(marketKey)}/products/${encodeURIComponent(productKey)}/capi/logs`
      : '/v1/capi/logs';
    return request(`${base}${query({ limit, offset, date_from, date_to })}`);
  },
  productsCompare: ({ products, date_from, date_to }) => request(`/v1/analytics/products/compare${query({
    products,
    date_from,
    date_to,
    group_by: 'day',
  })}`),
  adminUsers: () => request('/v1/admin/users'),
  createUser: (payload) => request('/v1/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id, payload) => request(`/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  updateAccess: (id, payload) => request(`/v1/admin/users/${encodeURIComponent(id)}/access`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  updateMarket: (marketKey, payload) => request(`/v1/admin/markets/${encodeURIComponent(marketKey)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  updateProduct: (marketKey, productKey, payload) => request(`/v1/admin/markets/${encodeURIComponent(marketKey)}/products/${encodeURIComponent(productKey)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  aggregateDaily: (days) => request('/v1/admin/maintenance/aggregate-daily', {
    method: 'POST',
    body: JSON.stringify({ days }),
  }),
  purgeRawLogs: (retention_days) => request('/v1/admin/maintenance/purge-raw-logs', {
    method: 'POST',
    body: JSON.stringify({ retention_days }),
  }),
};

function setToken(token) {
  state.token = token || '';
  if (state.token) localStorage.setItem(TOKEN_KEY, state.token);
  else localStorage.removeItem(TOKEN_KEY);
}

function isAdmin() {
  return Boolean(state.auth?.is_admin || state.auth?.role === 'admin');
}

function getProduct(marketKey, productKey) {
  return state.products.find((product) =>
    product.market_key === marketKey && product.product_key === productKey
  ) || { market_key: marketKey, product_key: productKey, display_name: productKey };
}

function getMarket(marketKey) {
  return state.markets.find((market) => market.market_key === marketKey) ||
    { market_key: marketKey, display_name: marketKey };
}

function productName(product) {
  return text(product?.display_name, product?.product_display_name || product?.product_key);
}

function marketName(marketOrProduct) {
  return text(
    marketOrProduct?.market_display_name || marketOrProduct?.display_name,
    marketOrProduct?.market_key
  );
}

function productPath(product) {
  return `/dashboard/markets/${encodeURIComponent(product.market_key)}/products/${encodeURIComponent(product.product_key)}`;
}

function systemHealth(summary) {
  const total = n(summary?.total_events || summary?.sent_events);
  const errorRate = pct(summary?.error_events || summary?.error_logs, total);
  if (errorRate < 5) return { status: 'healthy', label: 'Healthy', detail: `Tỷ lệ lỗi ${pctText(errorRate)}` };
  if (errorRate <= 15) return { status: 'warning', label: 'Warning', detail: `Tỷ lệ lỗi ${pctText(errorRate)}` };
  return { status: 'error', label: 'Error', detail: `Tỷ lệ lỗi ${pctText(errorRate)}` };
}

function setTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem(THEME_KEY, state.theme);
}

function skeletonCards(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="card skeleton-card">
      <span></span><strong></strong><i></i>
    </div>
  `).join('');
}

function emptyState(title, body = '') {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      ${body ? `<p>${escapeHtml(body)}</p>` : ''}
    </div>
  `;
}

function render() {
  setTheme(state.theme);
  const route = currentRoute();

  if (route.name !== 'login' && !state.token) {
    go('/dashboard/login');
    return;
  }

  if (route.name === 'login' && state.token && !state.auth && !state.booting) {
    renderLoginChecking();
    bootstrap();
    return;
  }

  if (route.name === 'login') {
    renderLogin();
    return;
  }

  if (!state.auth && !state.booting) {
    renderShell(route, loadingScreen('Đang kiểm tra phiên đăng nhập...'));
    bootstrap();
    return;
  }

  if (route.name === 'admin' && !isAdmin()) {
    go('/dashboard');
    return;
  }

  renderRoute(route);
}

function renderLoginChecking() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-panel">
        <div class="login-brand">
          <div class="brand-mark">CP</div>
          <div>
            <strong>CAPI Log Platform</strong>
            <span>Đang kiểm tra phiên đã lưu</span>
          </div>
        </div>
        <div class="empty-state">
          <strong>Đang xác thực phiên đăng nhập...</strong>
          <p>Nếu phiên còn hợp lệ, hệ thống sẽ chuyển về dashboard.</p>
        </div>
      </section>
      <aside class="login-aside"></aside>
    </main>
  `;
}

function renderLogin() {
  if (state.token && state.auth) {
    go('/dashboard');
    return;
  }

  app.innerHTML = `
    <main class="login-page">
      <section class="login-panel">
        <div class="login-brand">
          <div class="brand-mark">CP</div>
          <div>
            <strong>CAPI Log Platform</strong>
            <span>Đối soát Conversions API cho media buyer</span>
          </div>
        </div>
        <form id="login-form" class="login-form">
          <label>
            <span>Tên đăng nhập</span>
            <input name="username" autocomplete="username" required autofocus>
          </label>
          <label>
            <span>Mật khẩu</span>
            <input name="password" type="password" autocomplete="current-password" required>
          </label>
          <label class="check-row">
            <input name="remember_me" type="checkbox">
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <button class="primary" type="submit">Đăng nhập</button>
          <p id="login-error" class="form-error">${escapeHtml(state.error)}</p>
        </form>
      </section>
      <aside class="login-aside">
        <div>
          <span class="eyebrow">Dashboard vận hành</span>
          <h1>Theo dõi log CAPI, lỗi Meta và chất lượng sự kiện theo sản phẩm.</h1>
          <p>Giao diện mới tập trung vào đối soát nhanh: tổng quan hệ thống, phân loại theo event, campaign, nguồn traffic và log chi tiết.</p>
        </div>
      </aside>
    </main>
  `;

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button');
    const error = document.getElementById('login-error');
    button.disabled = true;
    button.textContent = 'Đang đăng nhập...';
    error.textContent = '';

    try {
      const result = await api.login({
        username: String(form.get('username') || '').trim(),
        password: String(form.get('password') || ''),
        remember_me: form.has('remember_me'),
      });
      setToken(result.token);
      state.auth = await api.me();
      await loadDashboardData();
      state.error = '';
      go('/dashboard');
    } catch (err) {
      state.error = err.message || 'Không đăng nhập được.';
      error.textContent = state.error;
    } finally {
      button.disabled = false;
      button.textContent = 'Đăng nhập';
    }
  });
}

async function bootstrap() {
  state.booting = true;
  try {
    state.auth = await api.me();
    await loadDashboardData();
  } catch (err) {
    state.error = err.message;
    setToken('');
    state.auth = null;
    go('/dashboard/login');
    return;
  } finally {
    state.booting = false;
  }
  render();
}

async function loadDashboardData() {
  if (!state.token) return;
  state.dataLoading = true;
  const today = ymd(new Date());

  try {
    const [overviewToday, overviewRange, reconciliation, markets, products, logs] = await Promise.all([
      api.overview({ date_from: today, date_to: today }),
      api.overview({ date_from: state.dateFrom, date_to: state.dateTo }),
      api.reconciliation({ date_from: state.dateFrom, date_to: state.dateTo }),
      api.markets(),
      api.products(),
      api.logs({ limit: 250, date_from: state.dateFrom, date_to: state.dateTo }),
    ]);

    state.overviewToday = overviewToday;
    state.overviewRange = overviewRange;
    state.reconciliation = reconciliation;
    state.markets = Array.isArray(markets) ? markets : [];
    state.products = Array.isArray(products) ? products : [];
    state.logs = Array.isArray(logs) ? logs : [];
    state.error = '';
  } catch (err) {
    state.error = err.message || 'Không tải được dữ liệu dashboard.';
  } finally {
    state.dataLoading = false;
  }
}

function renderShell(route, content) {
  const user = state.auth?.user || {};
  const nav = [
    ['home', '📊', 'Trang chủ', '/dashboard'],
    ['markets', '🌍', 'Thị trường', '/dashboard/markets'],
    ['products', '📦', 'Sản phẩm', '/dashboard/products'],
    ['admin', '⚙', 'Quản trị', '/dashboard/admin'],
  ].filter((item) => item[0] !== 'admin' || isAdmin());

  app.innerHTML = `
    <div class="dashboard-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-mark">CP</div>
          <div>
            <strong>CAPI Log Platform</strong>
            <span>Log CAPI theo thị trường và sản phẩm</span>
          </div>
        </div>
        <nav class="nav">
          ${nav.map(([key, icon, label, path]) => `
            <button class="${route.nav === key ? 'active' : ''}" data-go="${path}" type="button">
              <span class="nav-icon">${icon}</span>
              <span>${label}</span>
            </button>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="session-card">
            <span>Đang đăng nhập</span>
            <strong>${escapeHtml(user.display_name || user.username || '-')}</strong>
            <small>${escapeHtml(roleLabel(state.auth?.role))}</small>
          </div>
          <button class="ghost wide" id="logout-btn" type="button">Đăng xuất</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn mobile-only" id="menu-btn" type="button" aria-label="Mở menu">☰</button>
          <div class="title-block">
            <span>${escapeHtml(breadcrumb(route))}</span>
            <h1>${escapeHtml(route.title)}</h1>
          </div>
          <div class="toolbar">
            <label>
              <span>Từ ngày</span>
              <input id="global-date-from" type="date" value="${state.dateFrom}">
            </label>
            <label>
              <span>Đến ngày</span>
              <input id="global-date-to" type="date" value="${state.dateTo}">
            </label>
            <button class="secondary" id="global-refresh" type="button">Tải lại</button>
            <button class="icon-btn" id="theme-btn" type="button" aria-label="Đổi giao diện">${state.theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </header>
        ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ''}
        <section class="content" id="screen-content">${content}</section>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => go(el.dataset.go));
  });
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    render();
  });
  document.getElementById('menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  document.getElementById('global-refresh')?.addEventListener('click', async () => {
    state.dateFrom = document.getElementById('global-date-from').value || state.dateFrom;
    state.dateTo = document.getElementById('global-date-to').value || state.dateTo;
    state.productDetailCache.clear();
    await loadDashboardData();
    render();
  });
}

function breadcrumb(route) {
  if (route.name === 'marketDetail') return `Hệ thống / Thị trường / ${route.marketKey}`;
  if (route.name === 'productDetail') return `Hệ thống / Sản phẩm / ${route.marketKey}:${route.productKey}`;
  if (route.name === 'admin') return 'Hệ thống / Quản trị';
  return `Hệ thống / ${route.title}`;
}

function loadingScreen(label) {
  return `
    <div class="grid cards-4">${skeletonCards(4)}</div>
    <div class="panel">
      <div class="panel-head"><strong>${escapeHtml(label)}</strong></div>
      <div class="skeleton-lines"><span></span><span></span><span></span><span></span></div>
    </div>
  `;
}

async function renderRoute(route) {
  if (state.dataLoading && !state.markets.length) {
    renderShell(route, loadingScreen('Đang tải dữ liệu live...'));
    return;
  }

  if (route.name === 'home') renderShell(route, renderHome());
  if (route.name === 'markets') renderShell(route, renderMarkets());
  if (route.name === 'marketDetail') renderShell(route, renderMarketDetail(route.marketKey));
  if (route.name === 'products') renderShell(route, renderProducts());
  if (route.name === 'productDetail') {
    renderShell(route, renderProductDetail(route.marketKey, route.productKey));
    await ensureProductDetail(route.marketKey, route.productKey);
  }
  if (route.name === 'admin') {
    renderShell(route, renderAdmin());
    await ensureAdminData();
  }
  bindScreenEvents(route);
}

function renderHome() {
  const today = state.overviewToday || {};
  const range = state.overviewRange || {};
  const health = systemHealth(range);
  const activeMarkets = state.markets.filter((market) => String(market.status || 'active') === 'active').length;
  const activeProducts = state.products.filter((product) => String(product.status || 'active') === 'active').length;
  const latest = state.logs[0]?.created_at;
  const topProducts = (state.reconciliation?.products || [])
    .slice()
    .sort((a, b) => n(b.sent_events) - n(a.sent_events))
    .slice(0, 6);

  return `
    <div class="kpi-grid">
      ${kpiCard('Thị trường đang hoạt động', activeMarkets, `${fmt(state.markets.length)} thị trường tổng`)}
      ${kpiCard('Sản phẩm đang hoạt động', activeProducts, `${fmt(state.products.length)} sản phẩm tổng`)}
      ${kpiCard('Sự kiện hôm nay', fmt(today.total_events), `${fmt(range.total_events)} trong 7 ngày / khoảng lọc`)}
      ${kpiCard('Tình trạng hệ thống', health.label, health.detail, health.status)}
      ${kpiCard('Sự kiện gần nhất', latest ? displayDateTime(latest) : '-', 'Theo log mới nhất')}
    </div>

    <div class="split-layout">
      <section class="panel">
        <div class="panel-head">
          <div>
            <strong>Top sản phẩm theo số sự kiện</strong>
            <span>${displayDate(state.dateFrom)} - ${displayDate(state.dateTo)}</span>
          </div>
        </div>
        ${topProducts.length ? `
          <div class="rank-list">
            ${topProducts.map((product, index) => `
              <button class="rank-row" data-go="${productPath(product)}" type="button">
                <span>${index + 1}</span>
                <div>
                  <strong>${escapeHtml(product.product_display_name || product.product_key)}</strong>
                  <small>${escapeHtml(product.market_key)} · lỗi ${pctText(pct(product.error_logs, product.sent_events))}</small>
                </div>
                <b>${fmt(product.sent_events)}</b>
              </button>
            `).join('')}
          </div>
        ` : emptyState('Chưa có dữ liệu sản phẩm trong khoảng lọc')}
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <strong>Sự kiện gần nhất</strong>
            <span>250 log mới nhất trong khoảng lọc</span>
          </div>
          <button class="secondary" data-go="/dashboard/products" type="button">Xem sản phẩm</button>
        </div>
        ${renderLogsTable(state.logs.slice(0, 8))}
      </section>
    </div>
  `;
}

function kpiCard(label, value, detail, status = '') {
  return `
    <article class="kpi-card ${status ? `status-${status}` : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderMarkets() {
  if (!state.markets.length) return emptyState('Chưa có thị trường', 'Khi backend nhận log, thị trường sẽ xuất hiện tại đây.');
  return `
    <div class="card-grid">
      ${state.markets.map((market) => `
        <button class="market-card data-card" data-go="/dashboard/markets/${encodeURIComponent(market.market_key)}" type="button">
          <div class="card-top">
            <div>
              <strong>${escapeHtml(market.display_name || market.market_key)}</strong>
              <span>${escapeHtml(market.market_key)}</span>
            </div>
            <em class="badge ${classForStatus(market.status)}">${escapeHtml(statusLabel(market.status || 'active'))}</em>
          </div>
          <dl>
            <div><dt>Region</dt><dd>${escapeHtml(text(market.region))}</dd></div>
            <div><dt>Sản phẩm</dt><dd>${fmt(market.total_products)}</dd></div>
            <div><dt>Log 30 ngày</dt><dd>${fmt(market.total_logs)}</dd></div>
            <div><dt>Lỗi</dt><dd>${pctText(pct(market.error_logs, market.total_logs))}</dd></div>
          </dl>
        </button>
      `).join('')}
    </div>
  `;
}

function renderMarketDetail(marketKey) {
  const market = getMarket(marketKey);
  const products = state.products.filter((product) => product.market_key === marketKey);

  return `
    <section class="section-head">
      <div>
        <h2>${escapeHtml(market.display_name || market.market_key)}</h2>
        <p>${escapeHtml(text(market.region, 'Chưa có region'))} · ${escapeHtml(statusLabel(market.status || 'active'))}</p>
      </div>
      <button class="secondary" data-go="/dashboard/markets" type="button">Quay lại thị trường</button>
    </section>
    ${products.length ? `
      <div class="card-grid">
        ${products.map(renderProductCard).join('')}
      </div>
    ` : emptyState('Thị trường chưa có sản phẩm')}
  `;
}

function productStats(product) {
  const rec = (state.reconciliation?.products || []).find((item) =>
    item.market_key === product.market_key && item.product_key === product.product_key
  );
  const sent = n(rec?.sent_events ?? product.total_logs);
  const errors = n(rec?.error_logs ?? product.error_logs);
  return {
    sent,
    errors,
    received: n(rec?.meta_received_events ?? product.received_logs),
    errorRate: pct(errors, sent),
  };
}

function renderProducts() {
  const selected = Array.from(state.selectedProducts);
  const comparePanel = renderComparePanel(selected);

  return `
    <section class="section-head">
      <div>
        <h2>Tất cả sản phẩm</h2>
        <p>Chọn nhiều sản phẩm để đối chiếu sự kiện, lỗi và daily series.</p>
      </div>
      <button class="primary" id="compare-btn" type="button" ${selected.length < 2 ? 'disabled' : ''}>So sánh ${selected.length || ''}</button>
    </section>
    ${comparePanel}
    ${state.products.length ? `
      <div class="card-grid">
        ${state.products.map(renderProductCard).join('')}
      </div>
    ` : emptyState('Chưa có sản phẩm', 'Sản phẩm sẽ tự xuất hiện sau khi backend nhận log.')}
  `;
}

function renderProductCard(product) {
  const stats = productStats(product);
  const key = `${product.market_key}:${product.product_key}`;
  const checked = state.selectedProducts.has(key) ? 'checked' : '';
  return `
    <article class="product-card data-card">
      <div class="card-top">
        <label class="select-box" title="Chọn để so sánh">
          <input type="checkbox" data-product-select="${escapeHtml(key)}" ${checked}>
        </label>
        <em class="badge ${classForStatus(product.status || 'active')}">${escapeHtml(statusLabel(product.status || 'active'))}</em>
      </div>
      <button class="card-link" data-go="${productPath(product)}" type="button">
        <strong>${escapeHtml(productName(product))}</strong>
        <span>${escapeHtml(product.market_key)} · ${escapeHtml(product.product_key)}</span>
      </button>
      <dl>
        <div><dt>Sự kiện</dt><dd>${fmt(stats.sent)}</dd></div>
        <div><dt>Meta nhận</dt><dd>${fmt(stats.received)}</dd></div>
        <div><dt>% lỗi</dt><dd>${pctText(stats.errorRate)}</dd></div>
        <div><dt>Nhóm</dt><dd>${escapeHtml(text(product.category))}</dd></div>
      </dl>
    </article>
  `;
}

function renderComparePanel(selected) {
  if (selected.length < 2) {
    return `<div class="notice">Chọn ít nhất 2 sản phẩm để mở bảng so sánh.</div>`;
  }

  if (!state.compareData) {
    return `<section class="panel compare-panel">${emptyState('Sẵn sàng so sánh', 'Bấm nút So sánh để tải số liệu daily series.')}</section>`;
  }

  const products = state.compareData.products || [];
  return `
    <section class="panel compare-panel">
      <div class="panel-head">
        <div>
          <strong>Bảng so sánh sản phẩm</strong>
          <span>${displayDate(state.compareData.date_from)} - ${displayDate(state.compareData.date_to)}</span>
        </div>
      </div>
      ${renderCompareChart(products)}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Thị trường</th>
              <th>Sự kiện</th>
              <th>Meta nhận</th>
              <th>% lỗi</th>
              <th>Unique users</th>
              <th>Total value</th>
            </tr>
          </thead>
          <tbody>
            ${products.map((product) => `
              <tr>
                <td><button class="table-link" data-go="${productPath(product)}" type="button">${escapeHtml(product.product_display_name || product.product_key)}</button></td>
                <td>${escapeHtml(product.market_key)}</td>
                <td>${fmt(product.total_events)}</td>
                <td>${fmt(product.received_events)}</td>
                <td>${pctText(product.error_rate)}</td>
                <td>${fmt(product.unique_users)}</td>
                <td>${money(product.total_value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCompareChart(products) {
  const max = Math.max(1, ...products.map((product) => n(product.total_events)));
  return `
    <div class="bar-list">
      ${products.map((product) => `
        <div class="bar-row">
          <span>${escapeHtml(product.product_display_name || product.product_key)}</span>
          <div><i style="width:${Math.max(4, (n(product.total_events) / max) * 100)}%"></i></div>
          <b>${fmt(product.total_events)}</b>
        </div>
      `).join('')}
    </div>
  `;
}

async function ensureProductDetail(marketKey, productKey) {
  const cacheKey = `${marketKey}:${productKey}:${state.dateFrom}:${state.dateTo}`;
  if (state.productDetailCache.has(cacheKey)) {
    drawProductCharts();
    return;
  }

  const container = document.getElementById('screen-content');
  if (!container) return;
  container.innerHTML = loadingScreen('Đang tải chi tiết sản phẩm...');

  try {
    const today = ymd(new Date());
    const yesterday = ymd(addDays(new Date(), -1));
    const lastWeek = ymd(addDays(new Date(), -7));
    const [logs, todayLogs, yesterdayLogs, lastWeekLogs] = await Promise.all([
      api.logs({ marketKey, productKey, limit: 500, date_from: state.dateFrom, date_to: state.dateTo }),
      api.logs({ marketKey, productKey, limit: 500, date_from: today, date_to: today }),
      api.logs({ marketKey, productKey, limit: 500, date_from: yesterday, date_to: yesterday }),
      api.logs({ marketKey, productKey, limit: 500, date_from: lastWeek, date_to: lastWeek }),
    ]);

    state.productDetailCache.set(cacheKey, {
      logs: Array.isArray(logs) ? logs : [],
      compare: { today: todayLogs || [], yesterday: yesterdayLogs || [], lastWeek: lastWeekLogs || [] },
      chartType: 'line',
    });
  } catch (err) {
    container.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
    return;
  }

  render();
}

function currentProductDetail(marketKey, productKey) {
  return state.productDetailCache.get(`${marketKey}:${productKey}:${state.dateFrom}:${state.dateTo}`);
}

function renderProductDetail(marketKey, productKey) {
  const product = getProduct(marketKey, productKey);
  const detail = currentProductDetail(marketKey, productKey);
  if (!detail) return loadingScreen('Đang tải chi tiết sản phẩm...');

  const logs = detail.logs || [];
  const summary = summarizeLogs(logs);
  const events = groupLogs(logs, (log) => log.event_name || '-');
  const campaigns = groupLogs(logs, campaignKey);
  const chartType = detail.chartType || 'line';

  setTimeout(drawProductCharts);

  return `
    <section class="section-head">
      <div>
        <h2>${escapeHtml(productName(product))}</h2>
        <p>${escapeHtml(marketKey)} · ${escapeHtml(productKey)} · ${displayDate(state.dateFrom)} - ${displayDate(state.dateTo)}</p>
      </div>
      <button class="secondary" data-go="/dashboard/products" type="button">Quay lại sản phẩm</button>
    </section>

    <section class="panel filters-panel">
      <div class="preset-row">
        ${[
          ['today', 'Hôm nay'],
          ['yesterday', 'Hôm qua'],
          ['last7', '7 ngày trước'],
          ['week', 'Tuần này'],
          ['month', 'Tháng này'],
        ].map(([key, label]) => `<button class="chip" data-preset="${key}" type="button">${label}</button>`).join('')}
      </div>
      <div class="date-row">
        <label><span>Ngày bắt đầu</span><input id="detail-date-from" type="date" value="${state.dateFrom}"></label>
        <label><span>Ngày kết thúc</span><input id="detail-date-to" type="date" value="${state.dateTo}"></label>
        <button class="primary" id="detail-apply" type="button">Áp dụng</button>
      </div>
    </section>

    <div class="kpi-grid product-kpis">
      ${kpiCard('Tổng sự kiện gửi', fmt(summary.sent), 'Backend đã ghi nhận')}
      ${kpiCard('Meta nhận', fmt(summary.received), `${pctText(summary.matchRate)} match rate`)}
      ${kpiCard('% lỗi', pctText(summary.errorRate), `${fmt(summary.errors)} log lỗi`, summary.errorRate > 15 ? 'error' : summary.errorRate > 5 ? 'warning' : 'healthy')}
      ${kpiCard('% chưa rõ', pctText(summary.unknownRate), `${fmt(summary.unknown)} log unknown`)}
      ${kpiCard('Tỷ lệ khớp', pctText(summary.matchRate), 'events_received / events sent')}
    </div>

    <div class="split-layout">
      <section class="panel">
        <div class="panel-head"><strong>Phân loại theo event_name</strong></div>
        ${renderEventBreakdown(events)}
      </section>
      <section class="panel">
        <div class="panel-head"><strong>Phân loại theo Campaign / Ref</strong></div>
        ${renderCampaignBreakdown(campaigns)}
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>So sánh sự kiện theo giờ</strong>
          <span>Hôm nay vs Hôm qua vs Cùng ngày tuần trước</span>
        </div>
        <select id="chart-type">
          <option value="line" ${chartType === 'line' ? 'selected' : ''}>Line</option>
          <option value="bar" ${chartType === 'bar' ? 'selected' : ''}>Bar</option>
          <option value="area" ${chartType === 'area' ? 'selected' : ''}>Area</option>
        </select>
      </div>
      <canvas id="hourly-chart" width="1200" height="360" data-market="${escapeHtml(marketKey)}" data-product="${escapeHtml(productKey)}"></canvas>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Log chi tiết gần nhất</strong>
          <span>Click từng dòng để xem payload/meta response</span>
        </div>
      </div>
      ${renderLogsTable(logs)}
    </section>
  `;
}

function summarizeLogs(logs) {
  const sent = logs.length;
  const received = logs.reduce((sum, log) => sum + n(log.events_received), 0);
  const errors = logs.filter((log) => log.meta_status === 'error').length;
  const unknown = logs.filter((log) => !log.meta_status || log.meta_status === 'unknown').length;
  return {
    sent,
    received,
    errors,
    unknown,
    errorRate: pct(errors, sent),
    unknownRate: pct(unknown, sent),
    matchRate: pct(received, sent),
  };
}

function extractCustomData(log) {
  return log?.meta_request_payload?.data?.[0]?.custom_data ||
    log?.raw_payload?.data?.[0]?.custom_data ||
    log?.metadata ||
    {};
}

function campaignKey(log) {
  const custom = extractCustomData(log);
  return text(
    custom.utm_campaign || custom.campaign_id || custom.campaign || log.metadata?.campaign_id || log.ref || log.pub_id,
    '-'
  );
}

function groupLogs(logs, keyFn) {
  const map = new Map();
  logs.forEach((log) => {
    const key = keyFn(log);
    const item = map.get(key) || {
      name: key,
      sent: 0,
      received: 0,
      errors: 0,
      unknown: 0,
      users: new Set(),
      value: 0,
    };
    item.sent += 1;
    item.received += n(log.events_received);
    item.errors += log.meta_status === 'error' ? 1 : 0;
    item.unknown += !log.meta_status || log.meta_status === 'unknown' ? 1 : 0;
    if (log.user_id) item.users.add(log.user_id);
    item.value += n(log.value);
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => b.sent - a.sent);
}

function renderEventBreakdown(rows) {
  if (!rows.length) return emptyState('Không có event trong khoảng lọc');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Event</th><th>Gửi</th><th>Meta nhận</th><th>% lỗi</th><th>Unique users</th><th>Value</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td>${fmt(row.sent)}</td>
              <td>${fmt(row.received)}</td>
              <td>${pctText(pct(row.errors, row.sent))}</td>
              <td>${fmt(row.users.size)}</td>
              <td>${money(row.value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCampaignBreakdown(rows) {
  if (!rows.length) return emptyState('Không có campaign/ref trong khoảng lọc');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Campaign / Ref</th><th>Sự kiện</th><th>Meta nhận</th><th>% lỗi</th></tr></thead>
        <tbody>
          ${rows.slice(0, 30).map((row) => `
            <tr>
              <td class="clip">${escapeHtml(row.name)}</td>
              <td>${fmt(row.sent)}</td>
              <td>${fmt(row.received)}</td>
              <td>${pctText(pct(row.errors, row.sent))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLogsTable(logs) {
  if (!logs.length) return emptyState('Không có log trong khoảng lọc');
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Event</th>
            <th>Sản phẩm</th>
            <th>User</th>
            <th>Value</th>
            <th>Meta</th>
            <th>Trace</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map((log) => `
            <tr class="clickable-row" data-log-id="${escapeHtml(log.id)}">
              <td>${displayDateTime(log.created_at)}</td>
              <td>${escapeHtml(text(log.event_name))}</td>
              <td>${escapeHtml(log.market_key)}:${escapeHtml(log.product_key)}</td>
              <td>${escapeHtml(text(log.username || log.user_id))}</td>
              <td>${money(log.value, log.currency)}</td>
              <td><em class="badge ${classForStatus(log.meta_status)}">${escapeHtml(statusLabel(log.meta_status))}</em></td>
              <td class="clip">${escapeHtml(text(log.fbtrace_id))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function drawProductCharts() {
  const canvas = document.getElementById('hourly-chart');
  if (!canvas) return;
  const marketKey = canvas.dataset.market;
  const productKey = canvas.dataset.product;
  const detail = currentProductDetail(marketKey, productKey);
  if (!detail) return;

  const type = detail.chartType || 'line';
  const series = [
    { label: 'Hôm nay', color: '#22d3ee', values: hourly(detail.compare.today || []) },
    { label: 'Hôm qua', color: '#14b8a6', values: hourly(detail.compare.yesterday || []) },
    { label: 'Cùng ngày tuần trước', color: '#f59e0b', values: hourly(detail.compare.lastWeek || []) },
  ];
  drawChart(canvas, series, type);
}

function hourly(logs) {
  const values = Array.from({ length: 24 }, () => 0);
  logs.forEach((log) => {
    const date = new Date(log.created_at);
    if (!Number.isNaN(date.getTime())) values[date.getHours()] += 1;
  });
  return values;
}

function drawChart(canvas, series, type) {
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width) {
    canvas.width = rect.width * ratio;
    canvas.height = 360 * ratio;
    ctx.scale(ratio, ratio);
  }
  const width = rect.width || 1200;
  const height = 360;
  const padding = { left: 44, right: 18, top: 24, bottom: 42 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...series.flatMap((item) => item.values));

  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border');
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted');

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + plotH - (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(fmt((max * i) / 4), 8, y + 4);
  }

  for (let h = 0; h < 24; h += 1) {
    if (h % 3 === 0) {
      const x = padding.left + (plotW * h) / 23;
      ctx.fillText(`${h}h`, x - 8, height - 14);
    }
  }

  series.forEach((item, seriesIndex) => {
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 2;
    const points = item.values.map((value, index) => ({
      x: padding.left + (plotW * index) / 23,
      y: padding.top + plotH - (plotH * value) / max,
      value,
    }));

    if (type === 'bar') {
      const barW = Math.max(3, plotW / 24 / 4);
      points.forEach((point) => {
        const x = point.x - barW * 1.5 + seriesIndex * barW;
        ctx.globalAlpha = 0.78;
        ctx.fillRect(x, point.y, barW, padding.top + plotH - point.y);
        ctx.globalAlpha = 1;
      });
      return;
    }

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    if (type === 'area') {
      ctx.lineTo(width - padding.right, padding.top + plotH);
      ctx.lineTo(padding.left, padding.top + plotH);
      ctx.closePath();
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });

  let legendX = padding.left;
  series.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, 8, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
    ctx.fillText(item.label, legendX + 16, 18);
    legendX += ctx.measureText(item.label).width + 44;
  });
}

function renderAdmin() {
  const tabs = [
    ['users', 'User'],
    ['markets', 'Thị trường'],
    ['products', 'Sản phẩm'],
    ['maintenance', 'Maintenance'],
  ];

  return `
    <div class="tabs">
      ${tabs.map(([key, label]) => `<button class="${state.admin.tab === key ? 'active' : ''}" data-admin-tab="${key}" type="button">${label}</button>`).join('')}
    </div>
    ${state.admin.loading ? loadingScreen('Đang tải dữ liệu quản trị...') : renderAdminTab()}
  `;
}

function renderAdminTab() {
  if (state.admin.tab === 'users') return renderAdminUsers();
  if (state.admin.tab === 'markets') return renderAdminMarkets();
  if (state.admin.tab === 'products') return renderAdminProducts();
  return renderMaintenance();
}

async function ensureAdminData() {
  if (!isAdmin() || state.admin.loading || state.admin.users.length) return;
  state.admin.loading = true;
  const container = document.getElementById('screen-content');
  if (container) container.innerHTML = renderAdmin();
  try {
    state.admin.users = await api.adminUsers();
  } catch (err) {
    state.error = err.message;
  } finally {
    state.admin.loading = false;
  }
  render();
}

function renderAdminUsers() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Quản lý User</strong>
          <span>Tạo, sửa role/status/password và phân quyền truy cập.</span>
        </div>
        <button class="primary" id="create-user-btn" type="button">Tạo user</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Quyền truy cập</th><th></th></tr></thead>
          <tbody>
            ${state.admin.users.map((user) => `
              <tr>
                <td><strong>${escapeHtml(user.username)}</strong><br><small>${escapeHtml(text(user.display_name))}</small></td>
                <td>${escapeHtml(text(user.email))}</td>
                <td>${escapeHtml(roleLabel(user.role))}</td>
                <td><em class="badge ${classForStatus(user.status)}">${escapeHtml(statusLabel(user.status))}</em></td>
                <td>${fmt(user.markets?.length || 0)} thị trường · ${fmt(user.products?.length || 0)} sản phẩm</td>
                <td class="actions">
                  <button class="secondary" data-edit-user="${user.id}" type="button">Sửa</button>
                  <button class="secondary" data-access-user="${user.id}" type="button">Phân quyền</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminMarkets() {
  return `
    <section class="panel">
      <div class="panel-head"><strong>Quản lý Thị trường</strong></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Market</th><th>Region</th><th>Status</th><th>Owner</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${state.markets.map((market) => `
              <tr>
                <td><strong>${escapeHtml(market.display_name || market.market_key)}</strong><br><small>${escapeHtml(market.market_key)}</small></td>
                <td>${escapeHtml(text(market.region))}</td>
                <td><em class="badge ${classForStatus(market.status || 'active')}">${escapeHtml(statusLabel(market.status || 'active'))}</em></td>
                <td>${escapeHtml(text(market.owner))}</td>
                <td class="clip">${escapeHtml(text(market.notes))}</td>
                <td><button class="secondary" data-edit-market="${escapeHtml(market.market_key)}" type="button">Sửa</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminProducts() {
  return `
    <section class="panel">
      <div class="panel-head"><strong>Quản lý Sản phẩm</strong></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Sản phẩm</th><th>Thị trường</th><th>Category</th><th>Status</th><th>Owner</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${state.products.map((product) => `
              <tr>
                <td><strong>${escapeHtml(productName(product))}</strong><br><small>${escapeHtml(product.product_key)}</small></td>
                <td>${escapeHtml(product.market_key)}</td>
                <td>${escapeHtml(text(product.category))}</td>
                <td><em class="badge ${classForStatus(product.status || 'active')}">${escapeHtml(statusLabel(product.status || 'active'))}</em></td>
                <td>${escapeHtml(text(product.owner))}</td>
                <td class="clip">${escapeHtml(text(product.notes))}</td>
                <td><button class="secondary" data-edit-product="${escapeHtml(`${product.market_key}:${product.product_key}`)}" type="button">Sửa</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMaintenance() {
  return `
    <div class="split-layout">
      <section class="panel">
        <div class="panel-head"><strong>Gom metrics hàng ngày</strong></div>
        <label class="field"><span>Số ngày gom metrics</span><input id="aggregate-days" type="number" min="1" max="370" value="31"></label>
        <button class="primary" id="aggregate-btn" type="button">Gom metrics hàng ngày</button>
      </section>
      <section class="panel">
        <div class="panel-head"><strong>Xóa raw log cũ</strong></div>
        <label class="field"><span>Số ngày giữ lại</span><input id="retention-days" type="number" min="7" max="370" value="31"></label>
        <button class="danger" id="purge-btn" type="button">Xóa log cũ</button>
      </section>
    </div>
  `;
}

function bindScreenEvents(route) {
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => go(el.dataset.go));
  });

  document.querySelectorAll('[data-product-select]').forEach((el) => {
    el.addEventListener('change', (event) => {
      const key = event.currentTarget.dataset.productSelect;
      if (event.currentTarget.checked) state.selectedProducts.add(key);
      else state.selectedProducts.delete(key);
      state.compareData = null;
      render();
    });
  });

  document.getElementById('compare-btn')?.addEventListener('click', runProductsCompare);

  document.querySelectorAll('[data-log-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const allLogs = [
        ...state.logs,
        ...Array.from(state.productDetailCache.values()).flatMap((item) => item.logs || []),
      ];
      showLogModal(allLogs.find((log) => String(log.id) === String(row.dataset.logId)));
    });
  });

  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const range = presetRange(button.dataset.preset);
      state.dateFrom = range.dateFrom;
      state.dateTo = range.dateTo;
      state.productDetailCache.clear();
      loadDashboardData().then(render);
    });
  });

  document.getElementById('detail-apply')?.addEventListener('click', async () => {
    state.dateFrom = document.getElementById('detail-date-from').value || state.dateFrom;
    state.dateTo = document.getElementById('detail-date-to').value || state.dateTo;
    state.productDetailCache.clear();
    await loadDashboardData();
    render();
  });

  document.getElementById('chart-type')?.addEventListener('change', (event) => {
    const detail = currentProductDetail(route.marketKey, route.productKey);
    if (detail) {
      detail.chartType = event.currentTarget.value;
      drawProductCharts();
    }
  });

  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.admin.tab = button.dataset.adminTab;
      render();
    });
  });

  bindAdminEvents();
}

function presetRange(preset) {
  const now = new Date();
  if (preset === 'today') return { dateFrom: ymd(now), dateTo: ymd(now) };
  if (preset === 'yesterday') {
    const yesterday = addDays(now, -1);
    return { dateFrom: ymd(yesterday), dateTo: ymd(yesterday) };
  }
  if (preset === 'week') return { dateFrom: ymd(startOfWeek(now)), dateTo: ymd(now) };
  if (preset === 'month') return { dateFrom: ymd(startOfMonth(now)), dateTo: ymd(now) };
  return { dateFrom: ymd(addDays(now, -6)), dateTo: ymd(now) };
}

async function runProductsCompare() {
  const selected = Array.from(state.selectedProducts);
  if (selected.length < 2) return;
  const button = document.getElementById('compare-btn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Đang so sánh...';
  }
  try {
    state.compareData = await api.productsCompare({
      products: selected.join(','),
      date_from: state.dateFrom,
      date_to: state.dateTo,
    });
  } catch (err) {
    state.error = err.message;
  }
  render();
}

function bindAdminEvents() {
  document.getElementById('create-user-btn')?.addEventListener('click', () => showUserForm());

  document.querySelectorAll('[data-edit-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = state.admin.users.find((item) => String(item.id) === String(button.dataset.editUser));
      if (user) showUserForm(user);
    });
  });

  document.querySelectorAll('[data-access-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = state.admin.users.find((item) => String(item.id) === String(button.dataset.accessUser));
      if (user) showAccessForm(user);
    });
  });

  document.querySelectorAll('[data-edit-market]').forEach((button) => {
    button.addEventListener('click', () => {
      const market = getMarket(button.dataset.editMarket);
      showMarketForm(market);
    });
  });

  document.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const [marketKey, productKey] = button.dataset.editProduct.split(':');
      showProductForm(getProduct(marketKey, productKey));
    });
  });

  document.getElementById('aggregate-btn')?.addEventListener('click', async () => {
    const days = n(document.getElementById('aggregate-days').value || 31);
    if (!(await confirmDialog(`Bạn có chắc muốn gom metrics ${days} ngày?`))) return;
    await runAdminAction(() => api.aggregateDaily(days), 'Đã gom metrics hàng ngày.');
  });

  document.getElementById('purge-btn')?.addEventListener('click', async () => {
    const days = n(document.getElementById('retention-days').value || 31);
    if (!(await confirmDialog(`Bạn có chắc muốn xóa raw log cũ hơn ${days} ngày?`))) return;
    await runAdminAction(() => api.purgeRawLogs(days), 'Đã xóa raw log cũ.');
  });
}

function showUserForm(user = null) {
  const editing = Boolean(user);
  showModal(`
    <form class="modal-form" id="user-form">
      <h2>${editing ? 'Sửa user' : 'Tạo user mới'}</h2>
      ${editing ? `<p class="muted">${escapeHtml(user.username)}</p>` : `
        <label><span>Username</span><input name="username" required></label>
      `}
      <label><span>Display name</span><input name="display_name" value="${escapeHtml(user?.display_name || '')}"></label>
      <label><span>Email</span><input name="email" value="${escapeHtml(user?.email || '')}" ${editing ? 'disabled' : ''}></label>
      <label><span>Role</span>${select('role', ['viewer', 'manager', 'admin'], user?.role || 'viewer')}</label>
      <label><span>Status</span>${select('status', ['active', 'disabled'], user?.status || 'active')}</label>
      <label><span>${editing ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu'}</span><input name="password" type="password" ${editing ? '' : 'required'}></label>
      <div class="modal-actions">
        <button class="ghost" data-close-modal type="button">Hủy</button>
        <button class="primary" type="submit">${editing ? 'Lưu user' : 'Tạo user'}</button>
      </div>
    </form>
  `);

  document.getElementById('user-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (!payload.password) delete payload.password;
    if (editing) {
      if (!(await confirmDialog('Bạn có chắc muốn lưu thay đổi user này?'))) return;
      await runAdminAction(() => api.updateUser(user.id, payload), 'Đã cập nhật user.');
    } else {
      if (!(await confirmDialog('Bạn có chắc muốn tạo user mới?'))) return;
      await runAdminAction(() => api.createUser(payload), 'Đã tạo user.');
    }
    closeModal();
    state.admin.users = await api.adminUsers();
    render();
  });
}

function showAccessForm(user) {
  const userMarkets = new Set(user.markets || []);
  const userProducts = new Set((user.products || []).map((item) => `${item.market_key}:${item.product_key}`));

  showModal(`
    <form class="modal-form access-form" id="access-form">
      <h2>Phân quyền ${escapeHtml(user.username)}</h2>
      <div class="access-columns">
        <section>
          <strong>Thị trường</strong>
          ${state.markets.map((market) => `
            <label class="check-row">
              <input name="markets" value="${escapeHtml(market.market_key)}" type="checkbox" ${userMarkets.has(market.market_key) ? 'checked' : ''}>
              <span>${escapeHtml(market.display_name || market.market_key)}</span>
            </label>
          `).join('')}
        </section>
        <section>
          <strong>Sản phẩm cụ thể</strong>
          ${state.products.map((product) => {
            const key = `${product.market_key}:${product.product_key}`;
            return `
              <label class="check-row">
                <input name="products" value="${escapeHtml(key)}" type="checkbox" ${userProducts.has(key) ? 'checked' : ''}>
                <span>${escapeHtml(productName(product))} · ${escapeHtml(product.market_key)}</span>
              </label>
            `;
          }).join('')}
        </section>
      </div>
      <div class="modal-actions">
        <button class="ghost" data-close-modal type="button">Hủy</button>
        <button class="primary" type="submit">Lưu phân quyền</button>
      </div>
    </form>
  `);

  document.getElementById('access-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!(await confirmDialog('Bạn có chắc muốn cập nhật phân quyền user này?'))) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      markets: form.getAll('markets'),
      products: form.getAll('products').map((key) => {
        const [market_key, product_key] = String(key).split(':');
        return { market_key, product_key };
      }),
    };
    await runAdminAction(() => api.updateAccess(user.id, payload), 'Đã cập nhật phân quyền.');
    closeModal();
    state.admin.users = await api.adminUsers();
    render();
  });
}

function showMarketForm(market) {
  showCatalogForm({
    title: `Sửa thị trường ${market.market_key}`,
    fields: ['display_name', 'region', 'status', 'owner', 'notes'],
    values: market,
    onSubmit: async (payload) => {
      if (!(await confirmDialog(`Bạn có chắc muốn lưu thị trường ${market.market_key}?`))) return;
      await runAdminAction(() => api.updateMarket(market.market_key, payload), 'Đã cập nhật thị trường.');
      await loadDashboardData();
      closeModal();
      render();
    },
  });
}

function showProductForm(product) {
  showCatalogForm({
    title: `Sửa sản phẩm ${product.market_key}:${product.product_key}`,
    fields: ['display_name', 'category', 'status', 'owner', 'notes'],
    values: product,
    onSubmit: async (payload) => {
      if (!(await confirmDialog(`Bạn có chắc muốn lưu sản phẩm ${product.product_key}?`))) return;
      await runAdminAction(() => api.updateProduct(product.market_key, product.product_key, payload), 'Đã cập nhật sản phẩm.');
      await loadDashboardData();
      closeModal();
      render();
    },
  });
}

function showCatalogForm({ title, fields, values, onSubmit }) {
  showModal(`
    <form class="modal-form" id="catalog-form">
      <h2>${escapeHtml(title)}</h2>
      ${fields.map((field) => {
        if (field === 'status') {
          return `<label><span>Status</span>${select('status', ['active', 'disabled'], values.status || 'active')}</label>`;
        }
        if (field === 'notes') {
          return `<label><span>Notes</span><textarea name="notes">${escapeHtml(values.notes || '')}</textarea></label>`;
        }
        return `<label><span>${escapeHtml(field)}</span><input name="${field}" value="${escapeHtml(values[field] || '')}"></label>`;
      }).join('')}
      <div class="modal-actions">
        <button class="ghost" data-close-modal type="button">Hủy</button>
        <button class="primary" type="submit">Lưu thay đổi</button>
      </div>
    </form>
  `);
  document.getElementById('catalog-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSubmit(payload);
  });
}

function select(name, options, value) {
  return `
    <select name="${escapeHtml(name)}">
      ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
    </select>
  `;
}

async function runAdminAction(action, successMessage) {
  try {
    await action();
    toast(successMessage);
  } catch (err) {
    toast(err.message || 'Thao tác thất bại.', 'error');
  }
}

function showLogModal(log) {
  if (!log) return;
  showModal(`
    <div class="log-modal">
      <div class="modal-head">
        <div>
          <h2>Chi tiết log #${escapeHtml(log.id)}</h2>
          <p>${escapeHtml(log.market_key)}:${escapeHtml(log.product_key)} · ${displayDateTime(log.created_at)}</p>
        </div>
        <button class="ghost" data-close-modal type="button">Đóng</button>
      </div>
      <div class="log-grid">
        ${[
          ['Event', log.event_name],
          ['Event ID', log.event_id],
          ['User', log.username || log.user_id],
          ['Txn ID', log.txn_id],
          ['Ref', log.ref],
          ['Pub ID', log.pub_id],
          ['Channel', log.channel],
          ['Platform', log.platform],
          ['Meta status', log.meta_status],
          ['Events received', log.events_received],
          ['FB trace', log.fbtrace_id],
          ['Error', log.error_message],
        ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(text(value))}</strong></div>`).join('')}
      </div>
      <details open>
        <summary>Payload / response</summary>
        <pre>${escapeHtml(JSON.stringify({
          custom_data: extractCustomData(log),
          meta_request_payload: log.meta_request_payload,
          meta_response: log.meta_response,
          raw_payload: log.raw_payload,
        }, null, 2))}</pre>
      </details>
    </div>
  `);
}

function showModal(html) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel">${html}</div>
    </div>
  `;
  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.innerHTML = `
      <div class="modal-backdrop confirm-backdrop">
        <div class="modal-panel confirm-panel">
          <h2>Xác nhận thao tác</h2>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="ghost" id="confirm-cancel" type="button">Hủy</button>
            <button class="primary" id="confirm-ok" type="button">Xác nhận</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(layer);
    layer.querySelector('#confirm-cancel').addEventListener('click', () => {
      layer.remove();
      resolve(false);
    });
    layer.querySelector('#confirm-ok').addEventListener('click', () => {
      layer.remove();
      resolve(true);
    });
  });
}

function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function logout() {
  setToken('');
  state.auth = null;
  state.markets = [];
  state.products = [];
  state.logs = [];
  state.reconciliation = null;
  state.productDetailCache.clear();
  go('/dashboard/login');
}

window.addEventListener('popstate', render);
window.addEventListener('resize', drawProductCharts);

setTheme(state.theme);
render();
