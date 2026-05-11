import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { productCards, statusPill, table } from '../components.mjs';
import { productPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc } from '../utils.mjs';

export function renderProducts() {
  const products = state.selectedMarket
    ? state.products.filter((product) => product.market_key === state.selectedMarket)
    : state.products;

  setShell(
    state.selectedMarket ? `Products in ${state.selectedMarket}` : 'Products',
    'Products are game builds or properties inside a market.',
    state.selectedMarket ? `Workspace / Markets / ${state.selectedMarket} / Products` : 'Workspace / Products'
  );

  content().innerHTML = `
    ${productCards(products)}
    ${table(['Market / Product', 'Category', 'Events', 'Received', 'Errors', 'Status'], products.map((product) => `
      <tr>
        <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.display_name || product.product_key)}</span><div class="muted mono">${esc(product.market_key)} / ${esc(product.product_key)}</div></td>
        <td>${esc(product.category || '-')}</td>
        <td>${esc(product.total_logs || 0)}</td>
        <td>${esc(product.received_logs || 0)}</td>
        <td>${esc(product.error_logs || 0)}</td>
        <td>${statusPill(product.status)}</td>
      </tr>
    `))}
  `;
}
