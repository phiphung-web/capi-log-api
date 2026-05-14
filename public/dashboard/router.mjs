const BASE = '/dashboard';

function cleanPath(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, '') || BASE;
  return path.startsWith(BASE) ? path : BASE;
}

export function routeFromLocation() {
  return matchRoute(cleanPath());
}

export function go(path) {
  const nextPath = path || BASE;
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath);
  }
  window.dispatchEvent(new CustomEvent('dashboard:navigate'));
}

export function matchRoute(pathname) {
  const path = cleanPath(pathname);
  const parts = path.slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0) return { name: 'home', nav: 'home', path };
  if (parts[0] === 'login') return { name: 'login', nav: 'login', path };
  if (parts[0] === 'analytics') return { name: 'analytics', nav: 'analytics', path };
  if (parts[0] === 'products' && parts.length === 1) return { name: 'products', nav: 'products', path };
  if (parts[0] === 'products' && parts[1] === 'compare') return { name: 'productsCompare', nav: 'products', path };
  if (parts[0] === 'admin' && parts[1] === 'users') return { name: 'users', nav: 'users', path };
  if (parts[0] === 'admin') return { name: 'admin', nav: 'admin', path };

  if (parts[0] === 'markets' && parts.length === 1) {
    return { name: 'markets', nav: 'markets', path };
  }

  if (parts[0] === 'markets' && parts[1]) {
    const marketKey = parts[1];

    if (parts.length === 2) {
      return { name: 'marketDetail', nav: 'markets', path, params: { marketKey } };
    }

    if (parts[2] === 'products' && parts.length === 3) {
      return { name: 'marketProducts', nav: 'markets', path, params: { marketKey } };
    }

    if (parts[2] === 'products' && parts[3]) {
      const productKey = parts[3];

      if (parts.length === 4) {
        return { name: 'productDetail', nav: 'markets', path, params: { marketKey, productKey } };
      }

      if (parts[4] === 'logs' && parts.length === 5) {
        return { name: 'productLogs', nav: 'markets', path, params: { marketKey, productKey } };
      }

      if (parts[4] === 'logs' && parts[5]) {
        return { name: 'logDetail', nav: 'markets', path, params: { marketKey, productKey, logId: parts[5] } };
      }
    }
  }

  return { name: 'notFound', nav: 'home', path };
}

export function marketPath(marketKey) {
  return `${BASE}/markets/${encodeURIComponent(marketKey)}`;
}

export function marketProductsPath(marketKey) {
  return `${marketPath(marketKey)}/products`;
}

export function productPath(marketKey, productKey) {
  return `${marketProductsPath(marketKey)}/${encodeURIComponent(productKey)}`;
}

export function productLogsPath(marketKey, productKey) {
  return `${productPath(marketKey, productKey)}/logs`;
}

export function productsPath() {
  return `${BASE}/products`;
}

export function productsComparePath() {
  return `${productsPath()}/compare`;
}

export function logPath(marketKey, productKey, logId) {
  return `${productLogsPath(marketKey, productKey)}/${encodeURIComponent(logId)}`;
}
