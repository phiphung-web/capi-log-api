const storedToken = localStorage.getItem('capi_token') || sessionStorage.getItem('capi_token') || '';

export const state = {
  screen: 'overview',
  token: storedToken,
  auth: null,
  authChecked: !storedToken,
  authLoading: Boolean(storedToken),
  overview: null,
  reconciliation: null,
  markets: [],
  products: [],
  logs: [],
  selectedMarket: null,
  selectedProduct: null,
  selectedLog: null,
  filters: {},
  productFilters: {},
  compareSelection: [],
  overviewChartType: 'area',
  productCompareChartType: 'line',
  productCompareMetric: 'total_events',
};

export function setToken(token, remember = true) {
  state.token = token;
  state.auth = null;
  state.authChecked = !token;
  state.authLoading = Boolean(token);

  if (token) {
    if (remember) {
      localStorage.setItem('capi_token', token);
      sessionStorage.removeItem('capi_token');
    } else {
      sessionStorage.setItem('capi_token', token);
      localStorage.removeItem('capi_token');
    }
  } else {
    localStorage.removeItem('capi_token');
    sessionStorage.removeItem('capi_token');
  }
}

export function clearLiveData() {
  state.overview = null;
  state.reconciliation = null;
  state.markets = [];
  state.products = [];
  state.logs = [];
  state.productFilters = {};
  state.compareSelection = [];
  state.overviewChartType = 'area';
  state.productCompareChartType = 'line';
  state.productCompareMetric = 'total_events';
}

export function useLiveData({ auth, overview, reconciliation, markets, products, logs }) {
  state.auth = auth;
  state.authChecked = true;
  state.authLoading = false;
  state.overview = overview || null;
  state.reconciliation = reconciliation || null;
  state.markets = markets || [];
  state.products = products || [];
  state.logs = logs || [];
}
