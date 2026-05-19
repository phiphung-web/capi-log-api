import { $ } from './dom.mjs';
import { api } from './api.mjs';
import { go, logPath, marketPath, productPath, productsPath, routeFromLocation } from './router.mjs';
import { clearLiveData, setToken, state, useLiveData } from './state.mjs';
import { showLogDetail } from './modal.mjs';
import { fromIsoDate, toIsoDate } from './utils.mjs';
import { renderAdmin } from './screens/admin.mjs';
import { renderAnalytics } from './screens/analytics.mjs';
import { renderLogDetail } from './screens/logDetail.mjs';
import { renderLogin } from './screens/login.mjs';
import { renderLogs } from './screens/logs.mjs';
import { renderMarketDetail } from './screens/marketDetail.mjs';
import { renderMarkets } from './screens/markets.mjs';
import { renderOverview } from './screens/overview.mjs';
import { renderProductDetail } from './screens/productDetail.mjs';
import { renderProductsCompare } from './screens/productsCompare.mjs';
import { renderProducts } from './screens/products.mjs';
import { renderUsers } from './screens/users.mjs';

const renderers = {
  home: renderOverview,
  login: renderLogin,
  markets: renderMarkets,
  products: renderProducts,
  productsCompare: renderProductsCompare,
  marketDetail: renderMarketDetail,
  marketProducts: renderProducts,
  productDetail: renderProductDetail,
  productLogs: renderLogs,
  logDetail: renderLogDetail,
  analytics: renderAnalytics,
  admin: renderAdmin,
  users: renderUsers,
  notFound: renderOverview,
};

function context() {
  return {
    bindLinks,
    loadData,
    login,
    navigate: go,
    render,
    setScreen,
  };
}

function setScreen(screen, params = {}) {
  if (screen === 'markets') return go('/dashboard/markets');
  if (screen === 'products' && params.selectedMarket) return go(`/dashboard/markets/${encodeURIComponent(params.selectedMarket)}/products`);
  if (screen === 'products') return go(productsPath());
  if (screen === 'product' && params.selectedProduct) return go(productPath(params.selectedProduct.market_key, params.selectedProduct.product_key));
  if (screen === 'logs' && params.selectedProduct) return go(`/dashboard/markets/${encodeURIComponent(params.selectedProduct.market_key)}/products/${encodeURIComponent(params.selectedProduct.product_key)}/logs`);
  if (screen === 'analytics') return go('/dashboard/analytics');
  if (screen === 'users') return go('/dashboard/admin/users');
  return go('/dashboard');
}

function syncStateFromRoute(route) {
  state.screen = route.name;
  state.selectedMarket = route.params?.marketKey || null;
  state.selectedProduct = null;
  state.selectedLog = null;

  if (route.params?.marketKey && route.params?.productKey) {
    state.selectedProduct = state.products.find((product) =>
      product.market_key === route.params.marketKey && product.product_key === route.params.productKey
    ) || {
      market_key: route.params.marketKey,
      product_key: route.params.productKey,
      display_name: route.params.productKey,
      status: 'unknown',
    };
  }

  if (route.params?.logId) {
    state.selectedLog = state.logs.find((log) =>
      String(log.id) === String(route.params.logId) &&
      log.market_key === route.params.marketKey &&
      log.product_key === route.params.productKey
    ) || null;
  }
}

function setActiveNav(nav) {
  document.querySelectorAll('.nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.nav === nav);
  });
}

function formatExpiry(value) {
  if (!value) return 'Không có thời hạn phiên';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Không có thời hạn phiên';
  }

  return `Hết hạn ${date.toLocaleString()}`;
}

function roleLabel(role) {
  return {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    viewer: 'Người xem',
    user: 'Người dùng',
  }[role] || role || 'Người dùng';
}

function updateSessionPanel() {
  const user = state.auth?.user;
  const sessionUser = $('sessionUser');
  const logoutBtn = $('logoutBtn');

  if (!state.auth || !user) {
    sessionUser.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    $('sessionUserName').textContent = '-';
    $('sessionUserRole').textContent = '-';
    $('sessionExpires').textContent = '-';
    return;
  }

  sessionUser.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  $('sessionUserName').textContent = user.display_name || user.username || 'Người dùng';
  $('sessionUserRole').textContent = `${roleLabel(state.auth.role)} / ${user.username || '-'}`;
  $('sessionExpires').textContent = formatExpiry(state.auth.expires_at);
}

function renderSessionCheck(route) {
  setActiveNav(route.nav);
  document.body.classList.remove('login-route');
  document.body.classList.remove('admin-auth');
  $('screenTitle').textContent = 'Đang kiểm tra phiên';
  $('screenSubtitle').textContent = 'Đang xác thực phiên đăng nhập trước khi tải dữ liệu dashboard.';
  $('breadcrumb').textContent = 'Hệ thống / Phiên đăng nhập';
  $('authBadge').textContent = 'Đang kiểm tra';
  $('authState').textContent = 'Đang kiểm tra phiên đã lưu...';
  updateSessionPanel();
  $('content').innerHTML = `
    <section class="panel">
      <div class="panel-body">
        <strong>Đang kiểm tra phiên đã lưu...</strong>
        <p class="muted mini" style="margin-top:8px">Nếu phiên đã hết hạn, hệ thống sẽ đưa bạn về trang đăng nhập.</p>
      </div>
    </section>
  `;
}

function render() {
  const route = routeFromLocation();

  if (route.name !== 'login' && !state.token) {
    go('/dashboard/login');
    return;
  }

  if (state.token && !state.authChecked) {
    renderSessionCheck(route);
    return;
  }

  if (route.name === 'login' && state.token && state.auth) {
    go('/dashboard');
    return;
  }

  if ((route.name === 'admin' || route.name === 'users') && state.auth && !state.auth.is_admin) {
    go('/dashboard');
    return;
  }

  syncStateFromRoute(route);
  setActiveNav(route.nav);
  document.body.classList.toggle('admin-auth', Boolean(state.auth && state.auth.is_admin));
  document.body.classList.toggle('login-route', route.name === 'login');
  updateSessionPanel();

  const renderer = renderers[route.name] || renderOverview;
  renderer(context());
  bindLinks();
}

function bindLinks() {
  document.querySelectorAll('[data-route]').forEach((el) => {
    el.onclick = () => go(el.dataset.route);
  });

  document.querySelectorAll('[data-market]').forEach((el) => {
    el.onclick = () => go(marketPath(el.dataset.market));
  });

  document.querySelectorAll('[data-product]').forEach((el) => {
    el.onclick = () => {
      const [marketKey, productKey] = el.dataset.product.split(':');
      go(productPath(marketKey, productKey));
    };
  });

  document.querySelectorAll('[data-log]').forEach((el) => {
    el.onclick = () => {
      const log = state.logs.find((item) => Number(item.id) === Number(el.dataset.log));
      if (!log) return showLogDetail(null);
      go(logPath(log.market_key, log.product_key, log.id));
    };
  });
}

async function loadData() {
  if (!state.token) {
    state.auth = null;
    state.authChecked = true;
    state.authLoading = false;
    clearLiveData();
    document.body.classList.remove('admin-auth');
    $('authState').textContent = 'Vui lòng đăng nhập để tiếp tục.';
    updateSessionPanel();
    go('/dashboard/login');
    return;
  }

  let me;
  try {
    me = await api('/v1/auth/me');
  } catch (error) {
    $('authState').textContent = `Phiên đăng nhập không hợp lệ (${error.message}). Vui lòng đăng nhập lại.`;
    setToken('');
    state.authChecked = true;
    state.authLoading = false;
    clearLiveData();
    document.body.classList.remove('admin-auth');
    updateSessionPanel();
    go('/dashboard/login');
    return;
  }

  state.auth = me.data;
  state.authChecked = true;
  state.authLoading = false;

  try {
    const [overview, reconciliation, markets, products, logs] = await Promise.all([
      api(`/v1/analytics/overview?date_from=${toIsoDate($('dateFrom').value)}&date_to=${toIsoDate($('dateTo').value)}`),
      api(`/v1/analytics/reconciliation?date_from=${toIsoDate($('dateFrom').value)}&date_to=${toIsoDate($('dateTo').value)}`),
      api('/v1/markets'),
      api('/v1/products'),
      api(`/v1/capi/logs?limit=250&date_from=${toIsoDate($('dateFrom').value)}&date_to=${toIsoDate($('dateTo').value)}`),
    ]);

    useLiveData({
      auth: me.data,
      overview: overview.data,
      reconciliation: reconciliation.data,
      markets: markets.data,
      products: products.data,
      logs: logs.data,
    });

    $('authState').textContent = `Đã tải phiên ${roleLabel(me.data.role)}.`;
    document.body.classList.toggle('admin-auth', Boolean(me.data.is_admin));
    document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
      el.style.display = me.data.is_admin ? '' : 'none';
    });
    render();
  } catch (error) {
    $('authState').textContent = `Không tải được dữ liệu live (${error.message}).`;
    render();
  }
}

function logout() {
  setToken('');
  state.authChecked = true;
  state.authLoading = false;
  clearLiveData();
  document.body.classList.remove('admin-auth');
  updateSessionPanel();
  $('authState').textContent = 'Đã đăng xuất.';
  go('/dashboard/login');
}

async function login(username, password, rememberMe = false) {
  const payload = await api('/v1/auth/login', {
    method: 'POST',
    headers: {},
    body: JSON.stringify({ username, password, remember_me: rememberMe }),
  });

  setToken(payload.data.token, Boolean(payload.data.remember_me));
  await loadData();
  go('/dashboard');
}

function bindShellActions() {
  document.querySelectorAll('.nav button').forEach((button) => {
    button.onclick = () => go(button.dataset.route);
  });

  $('logoutBtn').onclick = logout;
  $('refreshBtn').onclick = loadData;
  $('closeModal').onclick = () => $('modal').classList.add('hidden');
}

function boot() {
  $('dateTo').value = fromIsoDate(new Date());
  $('dateFrom').value = fromIsoDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  bindShellActions();
  window.addEventListener('popstate', render);
  window.addEventListener('dashboard:navigate', render);
  render();
  loadData();
}

boot();
