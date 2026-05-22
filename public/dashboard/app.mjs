const TOKEN_KEY = 'capi_dashboard_token';
const THEME_KEY = 'capi_dashboard_theme';
const MEDIA_KEY = 'capi_dashboard_media';
const HIDDEN_MARKETS = new Set(['code', 'codex', 'global']);

const state = {
  auth: null,
  token: localStorage.getItem(TOKEN_KEY) || '',
  booting: false,
  dataLoading: false,
  routeLoading: false,
  error: '',
  dateFrom: ymd(new Date()),
  dateTo: ymd(new Date()),
  theme: localStorage.getItem(THEME_KEY) || 'dark',
  media: readMediaSettings(),
  markets: [],
  products: [],
  logs: [],
  overviewToday: null,
  overviewRange: null,
  reconciliation: null,
  reconciliationToday: null,
  selectedProducts: new Set(),
  compareData: null,
  productDetailCache: new Map(),
  detailRef: 'all',
  detailTab: 'overview',
  chartZoomHours: 24,
  admin: {
    tab: 'users',
    users: [],
    loading: false,
  },
};

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

function readMediaSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEDIA_KEY) || '{}');
    return {
      markets: parsed.markets || {},
      products: parsed.products || {},
    };
  } catch {
    return { markets: {}, products: {} };
  }
}

function saveMediaSettings() {
  localStorage.setItem(MEDIA_KEY, JSON.stringify(state.media));
}

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
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value, digits = 0) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: digits,
  }).format(n(value));
}

function money(value, currency = 'USD') {
  const code = String(currency || 'USD').trim().toUpperCase();
  const raw = value === null || value === undefined ? '' : String(value).replace(/,/g, '').trim();
  const decimals = raw.includes('.') ? raw.split('.')[1].replace(/0+$/, '').length : 0;
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(Math.max(decimals, 0), 6),
  }).format(n(value))} ${code || 'USD'}`;
}

function currencyKey(log) {
  return String(customValue(log, 'currency', log?.currency || 'USD') || 'USD').trim().toUpperCase() || 'USD';
}

function addMoney(map, currency, value) {
  const code = String(currency || 'USD').trim().toUpperCase() || 'USD';
  map.set(code, (map.get(code) || 0) + n(value));
}

function moneyMapText(map) {
  if (!map || map.size === 0) return money(0);
  return Array.from(map.entries())
    .filter(([, value]) => n(value) !== 0)
    .map(([currency, value]) => money(value, currency))
    .join(' / ') || money(0);
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

function marketMeta(market) {
  const key = String(market?.market_key || '').toLowerCase();
  const saved = state.media.markets[key] || {};
  const defaults = {
    kh: { flag: '🇰🇭', name: 'Cambodia' },
    vn: { flag: '🇻🇳', name: 'Vietnam' },
    th: { flag: '🇹🇭', name: 'Thailand' },
    id: { flag: '🇮🇩', name: 'Indonesia' },
    ph: { flag: '🇵🇭', name: 'Philippines' },
    my: { flag: '🇲🇾', name: 'Malaysia' },
    mm: { flag: '🇲🇲', name: 'Myanmar' },
    la: { flag: '🇱🇦', name: 'Laos' },
    sg: { flag: '🇸🇬', name: 'Singapore' },
  }[key] || { flag: '🌍', name: market?.display_name || market?.region || market?.market_key || '-' };

  return {
    flag: saved.flag_url ? `<img src="${escapeHtml(saved.flag_url)}" alt="">` : escapeHtml(saved.flag || defaults.flag),
    inlineFlag: escapeHtml(saved.flag || defaults.flag),
    name: saved.display_name || market?.display_name || defaults.name,
    flagUrl: saved.flag_url || '',
  };
}

function marketInlineText(market) {
  const key = String(market?.market_key || '').toUpperCase();
  const name = marketMeta(market).name;
  if (!key) return name || '-';
  if (!name || String(name).toUpperCase() === key) return key;
  return `${key} ${name}`;
}

function productMedia(product) {
  const key = `${product?.market_key || ''}:${product?.product_key || ''}`;
  return state.media.products[key] || {};
}

function productImage(product) {
  const media = productMedia(product);
  if (media.image_url) {
    return `<img src="${escapeHtml(media.image_url)}" alt="">`;
  }
  const label = String(product?.display_name || product?.product_key || 'P').slice(0, 2).toUpperCase();
  return `<span>${escapeHtml(label)}</span>`;
}

function visibleMarkets(markets = state.markets) {
  return markets.filter((market) => !HIDDEN_MARKETS.has(String(market.market_key || '').toLowerCase()));
}

function visibleProducts(products = state.products) {
  return products.filter((product) => !HIDDEN_MARKETS.has(String(product.market_key || '').toLowerCase()));
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
    const [overviewToday, overviewRange, reconciliation, reconciliationToday, markets, products, logs] = await Promise.all([
      api.overview({ date_from: today, date_to: today }),
      api.overview({ date_from: state.dateFrom, date_to: state.dateTo }),
      api.reconciliation({ date_from: state.dateFrom, date_to: state.dateTo }),
      api.reconciliation({ date_from: today, date_to: today }),
      api.markets(),
      api.products(),
      api.logs({ limit: 250, date_from: state.dateFrom, date_to: state.dateTo }),
    ]);

    state.overviewToday = overviewToday;
    state.overviewRange = overviewRange;
    state.reconciliation = reconciliation;
    state.reconciliationToday = reconciliationToday;
    state.markets = visibleMarkets(Array.isArray(markets) ? markets : []);
    state.products = visibleProducts(Array.isArray(products) ? products : []);
    state.logs = (Array.isArray(logs) ? logs : []).filter((log) => !HIDDEN_MARKETS.has(String(log.market_key || '').toLowerCase()));
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
    ['home', '🏠', 'Trang chủ', '/dashboard'],
    ['markets', '🌍', 'Thị trường', '/dashboard/markets'],
    ['products', '📦', 'Sản phẩm', '/dashboard/products'],
    ['admin', '⚙', 'Quản trị', '/dashboard/admin'],
  ].filter((item) => item[0] !== 'admin' || isAdmin());

  app.innerHTML = `
    <div class="dashboard-shell" id="dashboard-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-mark">CP</div>
          <div>
            <strong>CAPI Log Platform</strong>
            <span>Đối soát Meta CAPI theo pub và campaign</span>
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
      <button class="sidebar-overlay" id="sidebar-overlay" type="button" aria-label="Đóng menu"></button>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn mobile-only" id="menu-btn" type="button" aria-label="Mở menu" aria-controls="sidebar" aria-expanded="false">☰</button>
          <div class="title-block">
            <span>${escapeHtml(breadcrumb(route))}</span>
            <h1>${escapeHtml(route.title)}</h1>
          </div>
          <div class="toolbar">
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
    el.addEventListener('click', () => {
      closeSidebar();
      go(el.dataset.go);
    });
  });
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    render();
  });
  document.getElementById('menu-btn')?.addEventListener('click', () => toggleSidebar());
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  document.getElementById('global-refresh')?.addEventListener('click', async () => {
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

function setSidebarOpen(open) {
  const shell = document.getElementById('dashboard-shell');
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menu-btn');
  shell?.classList.toggle('sidebar-open', open);
  sidebar?.classList.toggle('open', open);
  document.body.classList.toggle('sidebar-lock', open);
  if (menuBtn) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  }
}

function toggleSidebar() {
  const shell = document.getElementById('dashboard-shell');
  setSidebarOpen(!shell?.classList.contains('sidebar-open'));
}

function closeSidebar() {
  setSidebarOpen(false);
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
  const range = state.overviewRange || {};
  const health = systemHealth(range);
  const user = state.auth?.user || {};
  const activeMarkets = state.markets.filter((market) => String(market.status || 'active') === 'active').length;
  const activeProducts = state.products.filter((product) => String(product.status || 'active') === 'active').length;
  const latest = state.logs[0]?.created_at;
  const total = n(range.total_events || range.sent_events);
  const errorRate = pct(range.error_events || range.error_logs, total);

  return `
    <section class="home-welcome panel">
      <div>
        <span class="eyebrow">CAPI Log Platform</span>
        <h2>Xin chào, ${escapeHtml(user.display_name || user.username || 'bạn')}!</h2>
        <p>Dashboard đang theo dõi trạng thái nhận log và phản hồi Meta CAPI theo quyền truy cập của bạn.</p>
      </div>
      <em class="badge ${classForStatus(health.status)}">${escapeHtml(health.status === 'healthy' ? 'Đang hoạt động' : health.status === 'warning' ? 'Cảnh báo' : 'Lỗi')}</em>
    </section>

    <div class="home-status-grid">
      ${kpiCard('Tình trạng hệ thống', health.status === 'healthy' ? 'Đang hoạt động' : health.label, health.detail, health.status)}
      ${kpiCard('Sự kiện gần nhất nhận lúc', latest ? displayDateTime(latest) : '-', 'Theo log mới nhất')}
      ${kpiCard('Tỷ lệ lỗi hiện tại', pctText(errorRate), `${fmt(range.error_events || range.error_logs)} lỗi trong khoảng lọc`, health.status)}
      ${kpiCard('Thị trường hoạt động', activeMarkets, `${fmt(state.markets.length)} thị trường được phép xem`)}
      ${kpiCard('Sản phẩm hoạt động', activeProducts, `${fmt(state.products.length)} sản phẩm được phép xem`)}
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
      ${state.markets.map((market) => {
        const meta = marketMeta(market);
        const receiving = n(market.total_logs) > 0 && String(market.status || 'active') === 'active';
        return `
          <button class="market-card data-card country-card" data-go="/dashboard/markets/${encodeURIComponent(market.market_key)}" type="button">
            <div class="country-flag">${meta.flag}</div>
            <div>
              <strong>${escapeHtml(meta.name)}</strong>
              <span>${escapeHtml(market.market_key.toUpperCase())}${market.region ? ` · ${escapeHtml(market.region)}` : ''}</span>
            </div>
            <em class="badge ${receiving ? 'good' : 'warn'}">${receiving ? 'Đang nhận log' : 'Ngừng nhận log'}</em>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderMarketDetail(marketKey) {
  const market = getMarket(marketKey);
  const meta = marketMeta(market);
  const products = state.products.filter((product) => product.market_key === marketKey);

  return `
    <section class="section-head">
      <div>
        <h2><span class="inline-flag">${meta.inlineFlag}</span>${escapeHtml(meta.name)}</h2>
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
  const rec = (state.reconciliationToday?.products || []).find((item) =>
    item.market_key === product.market_key && item.product_key === product.product_key
  );
  const sent = n(rec?.sent_events);
  const errors = n(rec?.error_logs);
  return {
    sent,
    errors,
    received: n(rec?.meta_received_events),
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
        <p>Card hiển thị số liệu hôm nay. Chọn nhiều sản phẩm để so sánh theo ngày.</p>
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
  const marketLabel = marketInlineText(getMarket(product.market_key));
  return `
    <article class="product-card data-card">
      <div class="card-top">
        <label class="select-box" title="Chọn để so sánh">
          <input type="checkbox" data-product-select="${escapeHtml(key)}" ${checked}>
        </label>
        <em class="badge ${classForStatus(product.status || 'active')}">${escapeHtml(statusLabel(product.status || 'active'))}</em>
      </div>
      <div class="product-image">${productImage(product)}</div>
      <button class="card-link" data-go="${productPath(product)}" type="button">
        <strong>${escapeHtml(productName(product))}</strong>
        <span>${escapeHtml(marketLabel)} · ${escapeHtml(product.product_key)}</span>
      </button>
      <dl>
        <div><dt>Sự kiện hôm nay</dt><dd>${fmt(stats.sent)}</dd></div>
        <div><dt>Thành công</dt><dd>${fmt(stats.received)}</dd></div>
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
              <th>Thành công</th>
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

  const allLogs = detail.logs || [];
  const refOptions = Array.from(new Set(allLogs.map(logRefKey).filter(Boolean))).sort();
  const activeRef = refOptions.includes(state.detailRef) ? state.detailRef : 'all';
  if (state.detailRef !== activeRef) state.detailRef = activeRef;
  const logs = activeRef === 'all' ? allLogs : allLogs.filter((log) => logRefKey(log) === activeRef);
  const summary = summarizeLogs(logs);
  const events = buildEventDetails(logs);
  const chartType = detail.chartType || 'line';
  const detailTabs = [
    ['overview', 'Tổng quan'],
    ['events', 'Loại sự kiện hoạt động'],
    ['campaigns', 'Camp hoạt động'],
  ];
  if (!detailTabs.some(([key]) => key === state.detailTab)) state.detailTab = 'overview';

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
        <label><span>Ref</span>
          <select id="detail-ref">
            <option value="all">Tất cả ref</option>
            ${refOptions.map((ref) => `<option value="${escapeHtml(ref)}" ${activeRef === ref ? 'selected' : ''}>${escapeHtml(ref)}</option>`).join('')}
          </select>
        </label>
        <button class="primary" id="detail-apply" type="button">Áp dụng</button>
      </div>
    </section>

    <div class="tabs product-detail-tabs">
      ${detailTabs.map(([key, label]) => `<button class="${state.detailTab === key ? 'active' : ''}" data-detail-tab="${key}" type="button">${label}</button>`).join('')}
    </div>

    ${state.detailTab === 'overview' ? renderProductOverviewTab(summary, chartType, marketKey, productKey, logs) : ''}
    ${state.detailTab === 'events' ? renderProductEventsTab(events) : ''}
    ${state.detailTab === 'campaigns' ? renderCampaignActivityTab(logs) : ''}
  `;
}

function renderProductOverviewTab(summary, chartType, marketKey, productKey, logs) {
  return `
    <div class="kpi-grid product-kpis">
      ${kpiCard('Sự kiện gửi', fmt(summary.sent), 'Tổng sự kiện hệ thống đã gửi')}
      ${kpiCard('Meta nhận thành công', fmt(summary.received), `Số log có meta_status = 'received'`)}
      ${kpiCard('Chênh lệch', fmt(summary.sent - summary.received), 'Sự kiện gửi - Meta nhận')}
      ${kpiCard('Lỗi', fmt(summary.errors), `meta_status = error`)}
      ${kpiCard('% lỗi', pctText(summary.errorRate), `${fmt(summary.errors)} lỗi / ${fmt(summary.sent)} ghi nhận`, summary.errorRate > 15 ? 'error' : summary.errorRate > 5 ? 'warning' : 'healthy')}
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Xu hướng và so sánh sự kiện</strong>
          <span>Hôm nay vs Hôm qua vs Cùng ngày tuần trước · hover để xem tooltip</span>
        </div>
        <div class="chart-controls">
          <select id="chart-type">
            <option value="line" ${chartType === 'line' ? 'selected' : ''}>Line</option>
            <option value="bar" ${chartType === 'bar' ? 'selected' : ''}>Bar</option>
            <option value="area" ${chartType === 'area' ? 'selected' : ''}>Area</option>
          </select>
          <button class="chip ${state.chartZoomHours === 24 ? 'active' : ''}" data-zoom-hours="24" type="button">24h</button>
          <button class="chip ${state.chartZoomHours === 12 ? 'active' : ''}" data-zoom-hours="12" type="button">12h</button>
          <button class="chip ${state.chartZoomHours === 6 ? 'active' : ''}" data-zoom-hours="6" type="button">6h</button>
        </div>
      </div>
      <canvas id="hourly-chart" width="1200" height="360" data-market="${escapeHtml(marketKey)}" data-product="${escapeHtml(productKey)}"></canvas>
      <div class="chart-tooltip" id="chart-tooltip"></div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Log gần nhất</strong>
          <span>Hiển thị nhanh 10 log gần nhất theo filter hiện tại.</span>
        </div>
        <button class="secondary" id="view-all-logs" type="button">Xem tất cả</button>
      </div>
      ${renderLogsTable(logs.slice(0, 10))}
    </section>
  `;
}

function renderProductEventsTab(events) {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Loại sự kiện hoạt động</strong>
          <span>Mỗi event hiển thị tổng gửi/thành công/lỗi/user. Purchase mới có value.</span>
        </div>
      </div>
      ${renderEventSections(events)}
    </section>
  `;
}

function summarizeLogs(logs) {
  const sent = logs.length;
  const accepted = logs.filter((log) => log.meta_status === 'received').length;
  const errors = logs.filter((log) => log.meta_status === 'error').length;
  const unknown = logs.filter((log) => !log.meta_status || log.meta_status === 'unknown').length;
  return {
    sent,
    received: accepted,
    accepted,
    errors,
    unknown,
    errorRate: pct(errors, sent),
    unknownRate: pct(unknown, sent),
    matchRate: pct(accepted, sent),
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
    custom.utm_campaign || log.metadata?.utm_campaign || log.metadata?.campaign_id || log.metadata?.campaign,
    'Không có campaign'
  );
}

function logRefKey(log) {
  const custom = extractCustomData(log);
  return text(custom.ref || log.ref, '-');
}

function identityKey(log) {
  const custom = extractCustomData(log);
  return text(log.user_id || custom.user_id || log.external_id || custom.external_id || log.username || custom.username, '');
}

function customValue(log, key, fallback = '-') {
  const custom = extractCustomData(log);
  return text(custom[key] ?? log[key], fallback);
}

function isFirstPurchase(log) {
  const custom = extractCustomData(log);
  return log.is_first_purchase === true || custom.is_first_purchase === true || custom.is_first_purchase === 'true';
}

function isPurchase(log) {
  return String(log.event_name || '').toLowerCase() === 'purchase';
}

function groupLogs(logs, keyFn) {
  const map = new Map();
  logs.forEach((log) => {
    const key = keyFn(log);
    const item = map.get(key) || {
      name: key,
      sent: 0,
      received: 0,
      accepted: 0,
      errors: 0,
      unknown: 0,
      users: new Set(),
      value: 0,
      valueByCurrency: new Map(),
      purchaseCountByCurrency: new Map(),
    };
    item.sent += 1;
    item.received += log.meta_status === 'received' ? 1 : 0;
    item.accepted = item.received;
    item.errors += log.meta_status === 'error' ? 1 : 0;
    item.unknown += !log.meta_status || log.meta_status === 'unknown' ? 1 : 0;
    if (log.user_id) item.users.add(log.user_id);
    if (isPurchase(log)) {
      const currency = currencyKey(log);
      const amount = n(log.value || extractCustomData(log).value);
      item.value += amount;
      addMoney(item.valueByCurrency, currency, amount);
      item.purchaseCountByCurrency.set(currency, (item.purchaseCountByCurrency.get(currency) || 0) + 1);
    }
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => b.sent - a.sent);
}

function groupDimension(logs, keyFn) {
  const map = new Map();
  logs.forEach((log) => {
    const key = text(keyFn(log), '-');
    const item = map.get(key) || {
      name: key,
      sent: 0,
      received: 0,
      errors: 0,
      unknown: 0,
      users: new Set(),
      firstUsers: new Set(),
      purchaseEvents: 0,
      firstPurchases: 0,
      returningPurchases: 0,
      value: 0,
      valueByCurrency: new Map(),
      purchaseCountByCurrency: new Map(),
      deposit: 0,
    };
    const user = identityKey(log);
    const purchase = isPurchase(log);
    item.sent += 1;
    item.received += log.meta_status === 'received' ? 1 : 0;
    item.errors += log.meta_status === 'error' ? 1 : 0;
    item.unknown += !log.meta_status || log.meta_status === 'unknown' ? 1 : 0;
    if (user) item.users.add(user);
    if (purchase) {
      item.purchaseEvents += 1;
      const currency = currencyKey(log);
      const amount = n(log.value || extractCustomData(log).value);
      item.value += amount;
      addMoney(item.valueByCurrency, currency, amount);
      item.purchaseCountByCurrency.set(currency, (item.purchaseCountByCurrency.get(currency) || 0) + 1);
      item.deposit += n(log.total_deposit_amount || extractCustomData(log).total_deposit_amount);
      if (isFirstPurchase(log)) {
        item.firstPurchases += 1;
        if (user) item.firstUsers.add(user);
      } else {
        item.returningPurchases += 1;
      }
    }
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => b.sent - a.sent);
}

function averageMoneyText(valueByCurrency, countByCurrency) {
  if (!valueByCurrency || valueByCurrency.size === 0) return money(0);
  return Array.from(valueByCurrency.entries())
    .filter(([, value]) => n(value) !== 0)
    .map(([currency, value]) => money(value / Math.max(1, countByCurrency?.get(currency) || 0), currency))
    .join(' / ') || money(0);
}

function purchaseMoney(log) {
  if (!isPurchase(log)) return '-';
  return money(log.value || extractCustomData(log).value, currencyKey(log));
}

function buildEventDetails(logs) {
  return groupLogs(logs, (log) => log.event_name || '-').map((event) => {
    const eventLogs = logs.filter((log) => (log.event_name || '-') === event.name);
    const purchaseLogs = event.name === 'Purchase' ? eventLogs : [];
    const firstPurchases = purchaseLogs.filter(isFirstPurchase);
    const returning = purchaseLogs.filter((log) => !isFirstPurchase(log));
    return {
      ...event,
      logs: eventLogs,
      campaigns: groupLogs(eventLogs, campaignKey),
      refs: groupLogs(eventLogs, logRefKey),
      dimensions: [
        ['Campaign', groupLogs(eventLogs, campaignKey)],
        ['Ref', groupLogs(eventLogs, logRefKey)],
        ['Ad set', groupLogs(eventLogs, (log) => customValue(log, 'utm_content'))],
        ['Ad', groupLogs(eventLogs, (log) => customValue(log, 'utm_term'))],
        ['Channel', groupLogs(eventLogs, (log) => customValue(log, 'channel'))],
        ['Platform', groupLogs(eventLogs, (log) => customValue(log, 'platform'))],
        ['VIP', groupLogs(eventLogs, (log) => customValue(log, 'vip'))],
      ],
      firstPurchases: firstPurchases.length,
      returningPurchases: returning.length,
    };
  });
}

function renderParameterBreakdowns(logs) {
  if (!logs.length) return '';
  const dimensions = [
    ['Ref', groupDimension(logs, logRefKey)],
    ['Campaign', groupDimension(logs, campaignKey)],
    ['Ad set', groupDimension(logs, (log) => customValue(log, 'utm_content'))],
    ['Ad', groupDimension(logs, (log) => customValue(log, 'utm_term'))],
    ['Channel', groupDimension(logs, (log) => customValue(log, 'channel'))],
    ['Platform', groupDimension(logs, (log) => customValue(log, 'platform'))],
  ];

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Bóc tách theo tham số</strong>
          <span>Dùng để đối chiếu nguồn traffic, campaign, ad set, ad, kênh thanh toán và nền tảng.</span>
        </div>
      </div>
      <div class="breakdown-grid">
        ${dimensions.map(([title, rows]) => renderDimensionTable(title, rows)).join('')}
      </div>
    </section>
  `;
}

function renderDimensionTable(title, rows) {
  return `
    <div class="dimension-card">
      <strong>${escapeHtml(title)}</strong>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Giá trị</th><th>Gửi</th><th>Thành công</th><th>Lỗi</th><th>User</th><th>Purchase</th><th>Nạp mới</th><th>Purchase value</th></tr></thead>
          <tbody>
            ${rows.slice(0, 12).map((row) => `
              <tr>
                <td class="clip">${escapeHtml(row.name)}</td>
                <td>${fmt(row.sent)}</td>
                <td>${fmt(row.received)}</td>
                <td>${pctText(pct(row.errors, row.sent))}</td>
                <td>${fmt(row.users.size)}</td>
                <td>${fmt(row.purchaseEvents)}</td>
                <td>${fmt(row.firstUsers.size || row.firstPurchases)}</td>
                <td>${row.purchaseEvents ? moneyMapText(row.valueByCurrency) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEventDimensionTable(title, rows, includeValue = false) {
  return `
    <div class="table-wrap ref-table">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(title)}</th>
            <th>Sự kiện gửi</th>
            <th>Thành công</th>
            <th>Chênh lệch</th>
            <th>% lỗi</th>
            ${includeValue ? '<th>Value</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 20).map((row) => `
            <tr>
              <td class="clip">${escapeHtml(row.name)}</td>
              <td>${fmt(row.sent)}</td>
              <td>${fmt(row.received)}</td>
              <td>${fmt(row.sent - row.received)}</td>
              <td>${pctText(pct(row.errors, row.sent))}</td>
              ${includeValue ? `<td>${moneyMapText(row.valueByCurrency)}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEventDimensionCard(title, rows, includeValue = false) {
  return `
    <div class="dimension-card event-dimension-card">
      <strong>${escapeHtml(title)}</strong>
      <div class="table-wrap compact-table">
        <table>
          <thead>
            <tr>
              <th>Giá trị</th>
              <th>Gửi</th>
              <th>Thành công</th>
              <th>Chênh lệch</th>
              <th>% lỗi</th>
              ${includeValue ? '<th>Value</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0, 12).map((row) => `
              <tr>
                <td class="clip">${escapeHtml(row.name)}</td>
                <td>${fmt(row.sent)}</td>
                <td>${fmt(row.received)}</td>
                <td>${fmt(row.sent - row.received)}</td>
                <td>${pctText(pct(row.errors, row.sent))}</td>
                ${includeValue ? `<td>${moneyMapText(row.valueByCurrency)}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEventSections(events) {
  if (!events.length) return emptyState('Không có event trong khoảng lọc');

  return `
    <div class="event-stack">
      ${events.map((event) => `
        <article class="event-card">
          <div class="event-head">
            <div>
              <strong>${escapeHtml(event.name)}</strong>
              <span>${fmt(event.sent)} gửi · ${fmt(event.received)} Meta nhận thành công · lỗi ${pctText(pct(event.errors, event.sent))}</span>
            </div>
            ${sparkline(event.logs, event.name)}
          </div>
          <div class="event-metrics">
            <div><span>Unique users</span><strong>${fmt(event.users.size)}</strong></div>
            ${event.name === 'Purchase' ? `
              <div><span>Tổng value</span><strong>${moneyMapText(event.valueByCurrency)}</strong></div>
              <div><span>Nạp mới</span><strong>${fmt(event.firstPurchases)}</strong></div>
              <div><span>Nạp cũ</span><strong>${fmt(event.returningPurchases)}</strong></div>
              <div><span>Giá trị TB</span><strong>${averageMoneyText(event.valueByCurrency, event.purchaseCountByCurrency)}</strong></div>
            ` : ''}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function metricBucket(name) {
  return {
    name,
    sent: 0,
    received: 0,
    errors: 0,
    unknown: 0,
    users: new Set(),
    firstUsers: new Set(),
    purchaseEvents: 0,
    firstPurchases: 0,
    returningPurchases: 0,
    valueByCurrency: new Map(),
    purchaseCountByCurrency: new Map(),
  };
}

function addLogMetric(bucket, log) {
  const user = identityKey(log);
  bucket.sent += 1;
  bucket.received += log.meta_status === 'received' ? 1 : 0;
  bucket.errors += log.meta_status === 'error' ? 1 : 0;
  bucket.unknown += !log.meta_status || log.meta_status === 'unknown' ? 1 : 0;
  if (user) bucket.users.add(user);

  if (isPurchase(log)) {
    bucket.purchaseEvents += 1;
    const currency = currencyKey(log);
    const amount = n(log.value || extractCustomData(log).value);
    addMoney(bucket.valueByCurrency, currency, amount);
    bucket.purchaseCountByCurrency.set(currency, (bucket.purchaseCountByCurrency.get(currency) || 0) + 1);
    if (isFirstPurchase(log)) {
      bucket.firstPurchases += 1;
      if (user) bucket.firstUsers.add(user);
    } else {
      bucket.returningPurchases += 1;
    }
  }
}

function childBucket(map, key) {
  const name = text(key, '-');
  if (!map.has(name)) map.set(name, { ...metricBucket(name), children: new Map() });
  return map.get(name);
}

function buildCampaignTree(logs) {
  const campaigns = new Map();
  logs.forEach((log) => {
    const campaign = childBucket(campaigns, campaignKey(log));
    const adSet = childBucket(campaign.children, customValue(log, 'utm_content', 'Không có ad set'));
    const ad = childBucket(adSet.children, customValue(log, 'utm_term', 'Không có ad'));
    addLogMetric(campaign, log);
    addLogMetric(adSet, log);
    addLogMetric(ad, log);
  });

  const sortNodes = (nodes) => Array.from(nodes.values())
    .sort((a, b) => b.sent - a.sent)
    .map((node) => ({ ...node, children: sortNodes(node.children) }));

  return sortNodes(campaigns);
}

function metricPills(metric) {
  return `
    <div class="metric-pills">
      <span>Gửi <strong>${fmt(metric.sent)}</strong></span>
      <span>Thành công <strong>${fmt(metric.received)}</strong></span>
      <span>Lỗi <strong>${pctText(pct(metric.errors, metric.sent))}</strong></span>
      <span>User <strong>${fmt(metric.users.size)}</strong></span>
      <span>Purchase <strong>${fmt(metric.purchaseEvents)}</strong></span>
      <span>Nạp mới <strong>${fmt(metric.firstUsers.size || metric.firstPurchases)}</strong></span>
      <span>Value <strong>${metric.purchaseEvents ? moneyMapText(metric.valueByCurrency) : '-'}</strong></span>
    </div>
  `;
}

function renderCampaignActivityTab(logs) {
  const campaigns = buildCampaignTree(logs);
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Camp hoạt động</strong>
          <span>Ghép theo cấu trúc Ads Manager: Campaign → Ad set → Ad từ utm_campaign, utm_content, utm_term.</span>
        </div>
      </div>
      ${campaigns.length ? `
        <div class="campaign-tree">
          ${campaigns.map((campaign) => `
            <article class="campaign-node">
              <div class="campaign-node-head">
                <div>
                  <span>Campaign</span>
                  <strong class="clip">${escapeHtml(campaign.name)}</strong>
                </div>
                ${metricPills(campaign)}
              </div>
              <div class="adset-stack">
                ${campaign.children.map((adSet) => `
                  <section class="adset-node">
                    <div class="adset-head">
                      <div><span>Ad set</span><strong class="clip">${escapeHtml(adSet.name)}</strong></div>
                      ${metricPills(adSet)}
                    </div>
                    <div class="table-wrap compact-table">
                      <table>
                        <thead><tr><th>Ad</th><th>Gửi</th><th>Thành công</th><th>Chênh lệch</th><th>% lỗi</th><th>User</th><th>Purchase</th><th>Nạp mới</th><th>Value</th></tr></thead>
                        <tbody>
                          ${adSet.children.map((ad) => `
                            <tr>
                              <td class="clip">${escapeHtml(ad.name)}</td>
                              <td>${fmt(ad.sent)}</td>
                              <td>${fmt(ad.received)}</td>
                              <td>${fmt(ad.sent - ad.received)}</td>
                              <td>${pctText(pct(ad.errors, ad.sent))}</td>
                              <td>${fmt(ad.users.size)}</td>
                              <td>${fmt(ad.purchaseEvents)}</td>
                              <td>${fmt(ad.firstUsers.size || ad.firstPurchases)}</td>
                              <td>${ad.purchaseEvents ? moneyMapText(ad.valueByCurrency) : '-'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </section>
                `).join('')}
              </div>
            </article>
          `).join('')}
        </div>
      ` : emptyState('Không có campaign trong khoảng lọc')}
    </section>
  `;
}

function sparkline(logs, label, compact = false) {
  const values = hourly(logs);
  const max = Math.max(1, ...values);
  const width = compact ? 120 : 180;
  const height = compact ? 34 : 46;
  const points = values.map((value, index) => {
    const x = (index / 23) * width;
    const y = height - 4 - (value / max) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"></polyline>
    </svg>
  `;
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
              <td>${purchaseMoney(log)}</td>
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
  const filter = (logs) => state.detailRef === 'all' ? logs : logs.filter((log) => logRefKey(log) === state.detailRef);
  const series = [
    { label: 'Hôm nay', color: '#22d3ee', values: hourly(filter(detail.compare.today || [])) },
    { label: 'Hôm qua', color: '#14b8a6', values: hourly(filter(detail.compare.yesterday || [])) },
    { label: 'Cùng ngày tuần trước', color: '#f59e0b', values: hourly(filter(detail.compare.lastWeek || [])) },
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
  const visibleHours = Math.min(24, Math.max(1, state.chartZoomHours || 24));
  const startHour = 24 - visibleHours;
  const hourLabels = Array.from({ length: visibleHours }, (_, index) => startHour + index);
  const visibleSeries = series.map((item) => ({
    ...item,
    values: item.values.slice(startHour, 24),
  }));
  const max = Math.max(1, ...visibleSeries.flatMap((item) => item.values));

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

  hourLabels.forEach((h, index) => {
    if (h % 3 === 0 || visibleHours <= 6) {
      const denom = Math.max(1, visibleHours - 1);
      const x = padding.left + (plotW * index) / denom;
      ctx.fillText(`${h}h`, x - 8, height - 14);
    }
  });

  const hoverPoints = [];
  visibleSeries.forEach((item, seriesIndex) => {
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = 2;
    const points = item.values.map((value, index) => ({
      x: padding.left + (plotW * index) / Math.max(1, visibleHours - 1),
      y: padding.top + plotH - (plotH * value) / max,
      value,
      hour: hourLabels[index],
      label: item.label,
      color: item.color,
    }));
    hoverPoints.push(...points);

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

  canvas._chartHoverPoints = hoverPoints;
  bindChartTooltip(canvas);
}

function bindChartTooltip(canvas) {
  if (canvas._tooltipBound) return;
  canvas._tooltipBound = true;
  canvas.addEventListener('mousemove', (event) => {
    const tooltip = document.getElementById('chart-tooltip');
    const points = canvas._chartHoverPoints || [];
    if (!tooltip || !points.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nearest = points.reduce((best, point) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      return !best || distance < best.distance ? { point, distance } : best;
    }, null);
    if (!nearest || nearest.distance > 38) {
      tooltip.classList.remove('visible');
      return;
    }
    tooltip.innerHTML = `<strong>${escapeHtml(nearest.point.label)} · ${nearest.point.hour}h</strong><span>${fmt(nearest.point.value)} sự kiện</span>`;
    tooltip.style.left = `${Math.min(rect.width - 160, Math.max(8, nearest.point.x + 12))}px`;
    tooltip.style.top = `${Math.max(8, nearest.point.y - 46)}px`;
    tooltip.classList.add('visible');
  });
  canvas.addEventListener('mouseleave', () => {
    document.getElementById('chart-tooltip')?.classList.remove('visible');
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
          <span>User chỉ cần tên đăng nhập và mật khẩu. Quyền truy cập được cấu hình riêng.</span>
        </div>
        <button class="primary" id="create-user-btn" type="button">Tạo user</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tên đăng nhập</th><th>Quyền truy cập</th><th></th></tr></thead>
          <tbody>
            ${state.admin.users.map((user) => `
              <tr>
                <td><strong>${escapeHtml(user.username)}</strong></td>
                <td>${fmt(user.markets?.length || 0)} thị trường · ${fmt(user.products?.length || 0)} sản phẩm</td>
                <td class="actions">
                  <button class="secondary" data-edit-user="${user.id}" type="button">Đổi mật khẩu</button>
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
          <thead><tr><th>Market</th><th>Region</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${state.markets.map((market) => `
              <tr>
                <td>
                  <div class="market-key-cell">
                    <strong>${escapeHtml(String(market.market_key || '').toUpperCase())}</strong>
                    <small>${escapeHtml(market.market_key)}</small>
                  </div>
                </td>
                <td>${escapeHtml(text(market.region || market.display_name || marketMeta(market).name))}</td>
                <td><em class="badge ${classForStatus(market.status || 'active')}">${escapeHtml(statusLabel(market.status || 'active'))}</em></td>
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
          <thead><tr><th>Sản phẩm</th><th>Thị trường</th><th>Category</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${state.products.map((product) => `
              <tr>
                <td>
                  <div class="entity-cell">
                    <span class="table-product-image">${productImage(product)}</span>
                    <div><strong>${escapeHtml(productName(product))}</strong><small>${escapeHtml(product.product_key)}</small></div>
                  </div>
                </td>
                <td>${escapeHtml(product.market_key)}</td>
                <td>${escapeHtml(text(product.category))}</td>
                <td><em class="badge ${classForStatus(product.status || 'active')}">${escapeHtml(statusLabel(product.status || 'active'))}</em></td>
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
  const oldest = state.logs.length ? state.logs.reduce((min, log) => !min || new Date(log.created_at) < new Date(min) ? log.created_at : min, null) : null;
  const newest = state.logs[0]?.created_at || null;
  const approxSize = state.logs.reduce((sum, log) => sum + JSON.stringify(log).length, 0);
  return `
    <div class="maintenance-stats">
      ${kpiCard('Log hiện tại', fmt(state.logs.length), 'Theo mẫu log đang tải trong dashboard')}
      ${kpiCard('Log cũ nhất', oldest ? displayDateTime(oldest) : '-', 'Trong dữ liệu đang xem')}
      ${kpiCard('Log mới nhất', newest ? displayDateTime(newest) : '-', 'Trong dữ liệu đang xem')}
      ${kpiCard('Dung lượng ước tính', `${fmt(approxSize / 1024, 1)} KB`, 'Ước tính từ payload client đã tải')}
    </div>
    <div class="split-layout">
      <section class="panel">
        <div class="panel-head"><strong>Gom metrics</strong><span>Tự động theo tháng, gửi số ngày tương ứng API hiện có.</span></div>
        <label class="field"><span>Khoảng gom</span>
          <select id="aggregate-months">
            <option value="31">1 tháng</option>
            <option value="62" selected>2 tháng</option>
            <option value="93">3 tháng</option>
          </select>
        </label>
        <button class="primary" id="aggregate-btn" type="button">Gom metrics</button>
      </section>
      <section class="panel">
        <div class="panel-head"><strong>Lưu trữ raw log</strong><span>Mặc định giữ 2 tháng gần nhất để tránh nặng database.</span></div>
        <label class="field"><span>Thời gian giữ chi tiết</span>
          <select id="retention-days">
            <option value="31">1 tháng</option>
            <option value="62" selected>2 tháng</option>
            <option value="93">3 tháng</option>
          </select>
        </label>
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
    state.detailRef = document.getElementById('detail-ref')?.value || 'all';
    state.productDetailCache.clear();
    await loadDashboardData();
    render();
  });

  document.getElementById('detail-ref')?.addEventListener('change', (event) => {
    state.detailRef = event.currentTarget.value || 'all';
    render();
  });

  document.querySelectorAll('[data-detail-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.detailTab = button.dataset.detailTab || 'overview';
      render();
    });
  });

  document.getElementById('chart-type')?.addEventListener('change', (event) => {
    const detail = currentProductDetail(route.marketKey, route.productKey);
    if (detail) {
      detail.chartType = event.currentTarget.value;
      drawProductCharts();
    }
  });

  document.querySelectorAll('[data-zoom-hours]').forEach((button) => {
    button.addEventListener('click', () => {
      state.chartZoomHours = n(button.dataset.zoomHours) || 24;
      drawProductCharts();
      render();
    });
  });

  document.getElementById('view-all-logs')?.addEventListener('click', () => {
    const detail = currentProductDetail(route.marketKey, route.productKey);
    const logs = (detail?.logs || []).filter((log) => state.detailRef === 'all' || logRefKey(log) === state.detailRef);
    showAllLogsModal(logs, 0);
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
    const days = n(document.getElementById('aggregate-months').value || 62);
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
      <h2>${editing ? 'Đổi mật khẩu user' : 'Tạo user mới'}</h2>
      ${editing ? `<p class="muted">${escapeHtml(user.username)}</p>` : `
        <label><span>Tên đăng nhập</span><input name="username" required autocomplete="username"></label>
      `}
      <label><span>${editing ? 'Mật khẩu mới' : 'Mật khẩu'}</span><input name="password" type="password" autocomplete="new-password" required></label>
      <div class="modal-actions">
        <button class="ghost" data-close-modal type="button">Hủy</button>
        <button class="primary" type="submit">${editing ? 'Lưu mật khẩu' : 'Tạo user'}</button>
      </div>
    </form>
  `);

  document.getElementById('user-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (editing) {
      if (!(await confirmDialog('Bạn có chắc muốn đổi mật khẩu user này?'))) return;
      await runAdminAction(() => api.updateUser(user.id, { password: payload.password }), 'Đã cập nhật mật khẩu.');
    } else {
      if (!(await confirmDialog('Bạn có chắc muốn tạo user mới?'))) return;
      await runAdminAction(() => api.createUser({ username: payload.username, password: payload.password }), 'Đã tạo user.');
    }
    closeModal();
    state.admin.users = await api.adminUsers();
    render();
  });
}

function showAccessForm(user) {
  const userMarkets = new Set(user.markets || []);
  const userProducts = new Set((user.products || []).map((item) => `${item.market_key}:${item.product_key}`));
  const marketsWithProducts = state.markets
    .map((market) => ({
      ...market,
      products: state.products.filter((product) => product.market_key === market.market_key),
    }))
    .filter((market) => market.products.length > 0);

  showModal(`
    <form class="modal-form access-form" id="access-form">
      <h2>Phân quyền ${escapeHtml(user.username)}</h2>
      <p class="muted">Chọn thị trường rồi chọn ít nhất 1 sản phẩm trong thị trường đó. Quyền xem thực tế được giới hạn theo sản phẩm đã chọn.</p>
      <div class="access-market-list">
        ${marketsWithProducts.map((market) => {
          const marketProductKeys = market.products.map((product) => `${product.market_key}:${product.product_key}`);
          const hasSelectedProduct = marketProductKeys.some((key) => userProducts.has(key));
          const checked = userMarkets.has(market.market_key) || hasSelectedProduct;
          return `
            <section class="access-market">
              <label class="check-row access-market-head">
                <input name="markets" value="${escapeHtml(market.market_key)}" type="checkbox" data-access-market="${escapeHtml(market.market_key)}" ${checked ? 'checked' : ''}>
                <span>${escapeHtml(marketInlineText(market))} <small>${escapeHtml(market.market_key)}</small></span>
              </label>
              <div class="access-products">
                ${market.products.map((product) => {
                  const key = `${product.market_key}:${product.product_key}`;
                  return `
                    <label class="check-row">
                      <input name="products" value="${escapeHtml(key)}" type="checkbox" data-access-product-market="${escapeHtml(product.market_key)}" ${userProducts.has(key) ? 'checked' : ''}>
                      <span>${escapeHtml(productName(product))} <small>${escapeHtml(product.product_key)}</small></span>
                    </label>
                  `;
                }).join('')}
              </div>
            </section>
          `;
        }).join('')}
      </div>
      <div class="modal-actions">
        <button class="ghost" data-close-modal type="button">Hủy</button>
        <button class="primary" type="submit">Lưu phân quyền</button>
      </div>
    </form>
  `);

  document.querySelectorAll('[data-access-product-market]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const marketKey = event.currentTarget.dataset.accessProductMarket;
      const marketInput = document.querySelector(`[data-access-market="${CSS.escape(marketKey)}"]`);
      if (event.currentTarget.checked && marketInput) marketInput.checked = true;
    });
  });

  document.querySelectorAll('[data-access-market]').forEach((input) => {
    input.addEventListener('change', (event) => {
      if (event.currentTarget.checked) return;
      document.querySelectorAll(`[data-access-product-market="${CSS.escape(event.currentTarget.value)}"]`).forEach((productInput) => {
        productInput.checked = false;
      });
    });
  });

  document.getElementById('access-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const markets = form.getAll('markets');
    const products = form.getAll('products').map((key) => {
      const [market_key, product_key] = String(key).split(':');
      return { market_key, product_key };
    });
    const productMarketSet = new Set(products.map((product) => product.market_key));
    const invalidMarket = markets.find((marketKey) => !productMarketSet.has(marketKey));

    if (invalidMarket) {
      toast(`Thị trường ${invalidMarket} phải có ít nhất 1 sản phẩm kèm.`, 'error');
      return;
    }

    if (!(await confirmDialog('Bạn có chắc muốn cập nhật phân quyền user này?'))) return;
    const payload = {
      markets,
      products,
    };
    await runAdminAction(() => api.updateAccess(user.id, payload), 'Đã cập nhật phân quyền.');
    closeModal();
    state.admin.users = await api.adminUsers();
    render();
  });
}

function showMarketForm(market) {
  const meta = marketMeta(market);
  showCatalogForm({
    title: `Sửa thị trường ${market.market_key}`,
    fields: ['display_name', 'region', 'status', 'flag_url', 'notes'],
    values: { ...market, flag_url: meta.flagUrl },
    onSubmit: async (payload) => {
      if (!(await confirmDialog(`Bạn có chắc muốn lưu thị trường ${market.market_key}?`))) return;
      const { flag_url, ...apiPayload } = payload;
      state.media.markets[String(market.market_key).toLowerCase()] = {
        ...(state.media.markets[String(market.market_key).toLowerCase()] || {}),
        flag_url,
      };
      saveMediaSettings();
      await runAdminAction(() => api.updateMarket(market.market_key, apiPayload), 'Đã cập nhật thị trường.');
      await loadDashboardData();
      closeModal();
      render();
    },
  });
}

function showProductForm(product) {
  const media = productMedia(product);
  showCatalogForm({
    title: `Sửa sản phẩm ${product.market_key}:${product.product_key}`,
    fields: ['display_name', 'category', 'status', 'image_url', 'notes'],
    values: { ...product, image_url: media.image_url || '' },
    onSubmit: async (payload) => {
      if (!(await confirmDialog(`Bạn có chắc muốn lưu sản phẩm ${product.product_key}?`))) return;
      const { image_url, ...apiPayload } = payload;
      state.media.products[`${product.market_key}:${product.product_key}`] = {
        ...(state.media.products[`${product.market_key}:${product.product_key}`] || {}),
        image_url,
      };
      saveMediaSettings();
      await runAdminAction(() => api.updateProduct(product.market_key, product.product_key, apiPayload), 'Đã cập nhật sản phẩm.');
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
        if (field === 'flag_url' || field === 'image_url') {
          return mediaField(field, values[field] || '');
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

  document.querySelectorAll('[data-media-upload]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('Vui lòng chọn file ảnh.', 'error');
        event.currentTarget.value = '';
        return;
      }
      if (file.size > 700 * 1024) {
        toast('Ảnh tối đa 700KB khi lưu trực tiếp trên trình duyệt.', 'error');
        event.currentTarget.value = '';
        return;
      }
      const field = event.currentTarget.dataset.mediaUpload;
      const dataUrl = await readFileAsDataUrl(file);
      const urlInput = document.querySelector(`[name="${field}"]`);
      const preview = document.querySelector(`[data-media-preview="${field}"]`);
      if (urlInput) urlInput.value = dataUrl;
      if (preview) preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="">`;
    });
  });
}

function mediaField(name, value) {
  const label = name === 'flag_url' ? 'Ảnh cờ' : 'Ảnh sản phẩm';
  const preview = value
    ? `<img src="${escapeHtml(value)}" alt="">`
    : `<span>${name === 'flag_url' ? 'FLAG' : 'IMG'}</span>`;
  return `
    <div class="media-field">
      <span>${label}</span>
      <div class="media-preview" data-media-preview="${escapeHtml(name)}">${preview}</div>
      <label>
        <span>URL ảnh</span>
        <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="https://... hoặc upload file bên dưới">
      </label>
      <label>
        <span>Upload file ảnh</span>
        <input type="file" accept="image/*" data-media-upload="${escapeHtml(name)}">
      </label>
      <small>File upload được lưu trong trình duyệt dưới dạng data URL. URL ảnh phù hợp hơn nếu cần dùng chung cho nhiều máy.</small>
    </div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Không đọc được file ảnh.'));
    reader.readAsDataURL(file);
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
          ['Value', purchaseMoney(log)],
          ['Tích lũy user', isPurchase(log) ? money(log.total_deposit_amount || extractCustomData(log).total_deposit_amount, currencyKey(log)) : '-'],
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

function showAllLogsModal(logs, page = 0) {
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const rows = logs.slice(safePage * pageSize, safePage * pageSize + pageSize);
  showModal(`
    <div class="log-modal">
      <div class="modal-head">
        <div>
          <h2>Tất cả log</h2>
          <p>${fmt(logs.length)} log · trang ${safePage + 1}/${totalPages}</p>
        </div>
        <button class="ghost" data-close-modal type="button">Đóng</button>
      </div>
      ${renderLogsTable(rows)}
      <div class="modal-actions">
        <button class="secondary" id="logs-prev" type="button" ${safePage === 0 ? 'disabled' : ''}>Trang trước</button>
        <button class="secondary" id="logs-next" type="button" ${safePage >= totalPages - 1 ? 'disabled' : ''}>Trang sau</button>
      </div>
    </div>
  `);
  document.getElementById('logs-prev')?.addEventListener('click', () => showAllLogsModal(logs, safePage - 1));
  document.getElementById('logs-next')?.addEventListener('click', () => showAllLogsModal(logs, safePage + 1));
  modalRoot.querySelectorAll('[data-log-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const log = logs.find((item) => String(item.id) === String(row.dataset.logId));
      if (log) showLogModal(log);
    });
  });
}

function showModal(html) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel">${html}</div>
    </div>
  `;
  document.body.classList.add('modal-lock');
  const backdrop = modalRoot.querySelector('.modal-backdrop');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });
  modalRoot.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-lock');
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
    document.body.classList.add('confirm-lock');

    const finish = (value) => {
      layer.remove();
      document.body.classList.remove('confirm-lock');
      window.removeEventListener('keydown', onKeydown);
      resolve(value);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKeydown);
    const backdrop = layer.querySelector('.confirm-backdrop');
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) finish(false);
    });
    layer.querySelector('#confirm-cancel').addEventListener('click', () => finish(false));
    layer.querySelector('#confirm-ok').addEventListener('click', () => finish(true));
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
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (document.body.classList.contains('confirm-lock')) return;
  if (modalRoot.innerHTML) {
    closeModal();
    return;
  }
  closeSidebar();
});

setTheme(state.theme);
render();
