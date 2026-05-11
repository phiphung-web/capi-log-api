import { $ } from './dom.mjs';
import { api } from './api.mjs';
import { setToken, state, useDemoData, useLiveData } from './state.mjs';
import { showLogDetail } from './modal.mjs';
import { toIsoDate, fromIsoDate } from './utils.mjs';
import { renderAnalytics } from './screens/analytics.mjs';
import { renderLogs } from './screens/logs.mjs';
import { renderMarkets } from './screens/markets.mjs';
import { renderOverview } from './screens/overview.mjs';
import { renderProductDetail } from './screens/productDetail.mjs';
import { renderProducts } from './screens/products.mjs';
import { renderUsers } from './screens/users.mjs';

const renderers = {
  overview: renderOverview,
  markets: renderMarkets,
  products: renderProducts,
  logs: renderLogs,
  product: renderProductDetail,
  analytics: renderAnalytics,
  users: renderUsers,
};

function context() {
  return {
    bindLinks,
    loadData,
    render,
    setScreen,
  };
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

function render() {
  document.body.classList.toggle('admin-auth', Boolean(state.auth && state.auth.is_admin));

  const renderer = renderers[state.screen] || renderOverview;
  renderer(context());
  bindLinks();
}

function bindLinks() {
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.onclick = () => setScreen(el.dataset.go);
  });

  document.querySelectorAll('[data-market]').forEach((el) => {
    el.onclick = () => setScreen('products', { selectedMarket: el.dataset.market });
  });

  document.querySelectorAll('[data-product]').forEach((el) => {
    el.onclick = () => {
      const [marketKey, productKey] = el.dataset.product.split(':');
      const product = state.products.find((item) => item.market_key === marketKey && item.product_key === productKey);
      setScreen('product', { selectedProduct: product });
    };
  });

  document.querySelectorAll('[data-log]').forEach((el) => {
    el.onclick = () => {
      const log = state.logs.find((item) => Number(item.id) === Number(el.dataset.log));
      showLogDetail(log);
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

function bindShellActions() {
  document.querySelectorAll('.nav button').forEach((button) => {
    button.onclick = () => setScreen(button.dataset.screen);
  });

  $('saveToken').onclick = () => {
    setToken($('tokenInput').value.trim());
    loadData();
  };

  $('loginBtn').onclick = async () => {
    const payload = await api('/v1/auth/login', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        username: $('usernameInput').value,
        password: $('passwordInput').value,
      }),
    });

    setToken(payload.data.token);
    $('tokenInput').value = state.token;
    await loadData();
  };

  $('demoBtn').onclick = () => {
    setToken('');
    useDemoData();
    document.body.classList.remove('admin-auth');
    render();
  };

  $('refreshBtn').onclick = loadData;
  $('closeModal').onclick = () => $('modal').classList.add('hidden');
}

function boot() {
  $('tokenInput').value = state.token;
  $('dateTo').value = fromIsoDate(new Date());
  $('dateFrom').value = fromIsoDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  bindShellActions();
  render();
  loadData();
}

boot();
