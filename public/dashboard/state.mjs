import { demo } from './demoData.mjs';

export const state = {
  screen: 'overview',
  token: localStorage.getItem('capi_token') || '',
  auth: null,
  markets: [...demo.markets],
  products: [...demo.products],
  logs: [...demo.logs],
  selectedMarket: null,
  selectedProduct: null,
  selectedLog: null,
  filters: {},
  demoMode: true,
};

export function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem('capi_token', token);
  } else {
    localStorage.removeItem('capi_token');
  }
}

export function useDemoData() {
  state.auth = null;
  state.demoMode = true;
  state.markets = [...demo.markets];
  state.products = [...demo.products];
  state.logs = [...demo.logs];
}

export function useLiveData({ auth, markets, products, logs }) {
  state.auth = auth;
  state.markets = markets;
  state.products = products;
  state.logs = logs;
  state.demoMode = false;
}
