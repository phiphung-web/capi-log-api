import { $ } from './dom.mjs';
import { api } from './api.mjs';
import { go, logPath, marketPath, productPath, routeFromLocation } from './router.mjs';
import { setToken, state, useDemoData, useLiveData } from './state.mjs';
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
import { renderProducts } from './screens/products.mjs';
import { renderUsers } from './screens/users.mjs';

const renderers = {
  home: renderOverview,
  login: renderLogin,
  markets: renderMarkets,
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
    useDemo,
  };
}

function setScreen(screen, params = {}) {
  if (screen === 'markets') return go('/dashboard/markets');
  if (screen === 'products' && params.selectedMarket) return go(`/dashboard/markets/${encodeURIComponent(params.selectedMarket)}/products`);
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

function render() {
  const route = routeFromLocation();
  syncStateFromRoute(route);
  setActiveNav(route.nav);
  document.body.classList.toggle('admin-auth', Boolean(state.auth && state.auth.is_admin));
  document.body.classList.toggle('login-route', route.name === 'login');

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
    useDemoData();
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

    useLiveData({
      auth: me.data,
      markets: markets.data,
      products: products.data,
      logs: logs.data,
    });

    $('authState').textContent = `${me.data.role || 'token'} loaded.`;
    document.body.classList.toggle('admin-auth', Boolean(me.data.is_admin));
    document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
      el.style.display = me.data.is_admin ? '' : 'none';
    });
    render();
  } catch (error) {
    $('authState').textContent = `Live load failed (${error.message}). Showing demo data.`;
    useDemoData();
    document.body.classList.remove('admin-auth');
    render();
  }
}

async function login(username, password) {
  const payload = await api('/v1/auth/login', {
    method: 'POST',
    headers: {},
    body: JSON.stringify({ username, password }),
  });

  setToken(payload.data.token);
  $('tokenInput').value = state.token;
  await loadData();
  go('/dashboard');
}

function useDemo() {
  setToken('');
  useDemoData();
  document.body.classList.remove('admin-auth');
  go('/dashboard');
}

function bindShellActions() {
  document.querySelectorAll('.nav button').forEach((button) => {
    button.onclick = () => go(button.dataset.route);
  });

  $('saveToken').onclick = () => {
    setToken($('tokenInput').value.trim());
    loadData();
  };

  $('loginBtn').onclick = async () => {
    const username = $('usernameInput').value.trim();
    const password = $('passwordInput').value;
    if (!username || !password) {
      go('/dashboard/login');
      return;
    }
    await login(username, password);
  };

  $('demoBtn').onclick = useDemo;
  $('refreshBtn').onclick = loadData;
  $('closeModal').onclick = () => $('modal').classList.add('hidden');
}

function boot() {
  $('tokenInput').value = state.token;
  $('dateTo').value = fromIsoDate(new Date());
  $('dateFrom').value = fromIsoDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  bindShellActions();
  window.addEventListener('popstate', render);
  window.addEventListener('dashboard:navigate', render);
  render();
  loadData();
}

boot();
