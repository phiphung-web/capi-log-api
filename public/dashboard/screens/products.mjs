import { $, content } from '../dom.mjs';
import { state } from '../state.mjs';
import { productCards, statusPill, table } from '../components.mjs';
import { productPath, productsComparePath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc } from '../utils.mjs';

function filterProducts(products, ignoreMarket = false) {
  const filters = state.productFilters || {};
  let output = products;

  if (!ignoreMarket && filters.market) {
    output = output.filter((product) => product.market_key === filters.market);
  }
  if (filters.status) {
    output = output.filter((product) => product.status === filters.status);
  }
  if (filters.category) {
    output = output.filter((product) => String(product.category || '') === filters.category);
  }
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    output = output.filter((product) => [
      product.market_key,
      product.product_key,
      product.display_name,
      product.category,
      product.owner,
      product.notes,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }

  return output;
}

function productSelector(product) {
  return `${product.market_key}:${product.product_key}`;
}

export function renderProducts(ctx) {
  const scopedProducts = state.selectedMarket
    ? state.products.filter((product) => product.market_key === state.selectedMarket)
    : state.products;
  const products = filterProducts(scopedProducts, Boolean(state.selectedMarket));
  const markets = [...new Set(state.products.map((product) => product.market_key))].sort();
  const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort();
  const selectedCount = state.compareSelection.filter((selector) =>
    scopedProducts.some((product) => productSelector(product) === selector)
  ).length;

  setShell(
    state.selectedMarket ? `Sản phẩm trong ${state.selectedMarket}` : 'Sản phẩm',
    state.selectedMarket ? 'Sản phẩm thuộc thị trường đang chọn, kèm thông số log tóm tắt.' : 'Toàn bộ sản phẩm, lọc nhanh và chọn nhiều sản phẩm để so sánh.',
    state.selectedMarket ? `Hệ thống / Thị trường / ${state.selectedMarket} / Sản phẩm` : 'Hệ thống / Sản phẩm'
  );

  content().innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Bộ lọc</h2>
        <button id="compareSelected" class="primary">So sánh đã chọn (${selectedCount})</button>
      </div>
      <div class="panel-body filters">
        <input id="productSearch" value="${esc(state.productFilters.search || '')}" placeholder="sản phẩm, danh mục, người phụ trách">
        <select id="productMarket" ${state.selectedMarket ? 'disabled' : ''}>
          <option value="">Tất cả thị trường</option>
          ${markets.map((market) => `<option value="${esc(market)}">${esc(market)}</option>`).join('')}
        </select>
        <select id="productStatus">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="paused">Tạm dừng</option>
          <option value="archived">Lưu trữ</option>
        </select>
        <select id="productCategory">
          <option value="">Tất cả danh mục</option>
          ${categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}
        </select>
        <button id="applyProductFilters">Áp dụng</button>
        <button id="clearProductFilters" class="ghost">Xóa lọc</button>
      </div>
    </section>
    <div style="height:14px"></div>
    ${productCards(products)}
    ${table(['So sánh', 'Thị trường / Sản phẩm', 'Danh mục', 'Sự kiện', 'Meta nhận', 'Lỗi', 'Trạng thái'], products.map((product) => {
      const selector = productSelector(product);
      return `
      <tr>
        <td><input type="checkbox" data-compare-product="${esc(selector)}" ${state.compareSelection.includes(selector) ? 'checked' : ''}></td>
        <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.display_name || product.product_key)}</span><div class="muted mono">${esc(product.market_key)} / ${esc(product.product_key)}</div></td>
        <td>${esc(product.category || '-')}</td>
        <td>${esc(product.total_logs || 0)}</td>
        <td>${esc(product.received_logs || 0)}</td>
        <td>${esc(product.error_logs || 0)}</td>
        <td>${statusPill(product.status)}</td>
      </tr>
    `}))}
  `;

  $('productMarket').value = state.selectedMarket || state.productFilters.market || '';
  $('productStatus').value = state.productFilters.status || '';
  $('productCategory').value = state.productFilters.category || '';

  document.querySelectorAll('[data-compare-product]').forEach((checkbox) => {
    checkbox.onchange = () => {
      const selector = checkbox.dataset.compareProduct;
      const next = new Set(state.compareSelection);
      if (checkbox.checked) next.add(selector);
      else next.delete(selector);
      state.compareSelection = [...next];
      ctx.render();
    };
  });

  $('applyProductFilters').onclick = () => {
    state.productFilters = {
      search: $('productSearch').value.trim(),
      market: state.selectedMarket || $('productMarket').value,
      status: $('productStatus').value,
      category: $('productCategory').value,
    };
    ctx.render();
  };

  $('clearProductFilters').onclick = () => {
    state.productFilters = {};
    ctx.render();
  };

  $('compareSelected').onclick = () => {
    if (state.compareSelection.length === 0 && products.length > 0) {
      state.compareSelection = products.slice(0, Math.min(products.length, 3)).map(productSelector);
    }
    ctx.navigate(productsComparePath());
  };
}
