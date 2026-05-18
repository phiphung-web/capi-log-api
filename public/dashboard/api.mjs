import { setToken, state } from './state.mjs';

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('capi_token');
    sessionStorage.removeItem('capi_token');
    setToken('');
    if (window.location.pathname !== '/dashboard/login') {
      window.location.href = '/dashboard/login';
    }
    throw new Error('401');
  }

  if (!response.ok) {
    throw new Error(`${response.status}`);
  }

  return response.json();
}
