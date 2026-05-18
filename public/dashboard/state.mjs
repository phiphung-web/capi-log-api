import { demo } from './demoData.mjs';

export const state = {
  screen: 'overview',
  token: localStorage.getItem('capi_token') || sessionStorage.getItem('capi_token') || '',
  auth: null,
  overview: null,
  reconciliation: null,
  markets: [...demo.markets],
  products: [...demo.products],
  logs: [...demo.logs],
  selectedMarket: null,
  selectedProduct: null,
  selectedLog: null,
  filters: {},
  productFilters: {},
  compareSelection: [],
  overviewChartType: 'area',
  productCompareChartType: 'line',
  productCompareMetric: 'total_events',
  demoMode: true,
};

export function setToken(token, remember = true) {
  state.token = token;
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

export function useDemoData() {
  state.auth = null;
  state.overview = null;
  state.reconciliation = null;
  state.demoMode = true;
  state.markets = [...demo.markets];
  state.products = [...demo.products];
  state.logs = [...demo.logs];
  state.productFilters = {};
  state.compareSelection = [];
  state.overviewChartType = 'area';
  state.productCompareChartType = 'line';
  state.productCompareMetric = 'total_events';
}

export function useLiveData({ auth, overview, reconciliation, markets, products, logs }) {
  state.auth = auth;
  state.overview = overview || null;
  state.reconciliation = reconciliation || null;
  state.markets = markets;
  state.products = products;
  state.logs = logs;
  state.demoMode = false;
}
