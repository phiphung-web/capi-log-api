import { $, content } from '../dom.mjs';
import { api } from '../api.mjs';
import { state } from '../state.mjs';
import { metrics, statusPill, table } from '../components.mjs';
import { drawProductSeriesChart } from '../chart.mjs';
import { go, productPath, productsPath } from '../router.mjs';
import { setShell } from '../shell.mjs';
import { esc, toIsoDate } from '../utils.mjs';

function selectorFor(product) {
  return `${product.market_key}:${product.product_key}`;
}

function selectedProducts() {
  if (state.compareSelection.length > 0) {
    const selected = new Set(state.compareSelection);
    return state.products.filter((product) => selected.has(selectorFor(product)));
  }

  return [...state.products]
    .sort((a, b) => Number(b.total_logs || 0) - Number(a.total_logs || 0))
    .slice(0, 3);
}

function selectedQuery(products) {
  return products.map(selectorFor).join(',');
}

function topBreakdown(product, dimension) {
  const rows = product.breakdowns?.[dimension] || [];
  return rows.slice(0, 3).map((row) => `${row.name}: ${row.total_events}`).join(', ') || '-';
}

function renderResults(payload) {
  const products = payload.products || [];
  const totals = products.reduce((acc, product) => {
    acc.events += Number(product.total_events || 0);
    acc.received += Number(product.received_events || 0);
    acc.errors += Number(product.error_events || 0);
    acc.unknown += Number(product.unknown_events || 0);
    acc.users += Number(product.unique_users || 0);
    acc.value += Number(product.total_value || 0);
    return acc;
  }, { events: 0, received: 0, errors: 0, unknown: 0, users: 0, value: 0 });

  $('compareResults').innerHTML = `
    ${metrics([
      { label: 'Compared', value: products.length, note: 'Authorized products' },
      { label: 'Events', value: totals.events, note: 'Selected range' },
      { label: 'Received', value: totals.received, note: 'Meta accepted' },
      { label: 'Errors', value: totals.errors, note: 'Needs review' },
      { label: 'Unknown', value: totals.unknown, note: 'Incomplete response' },
      { label: 'Unique users', value: totals.users, note: 'Sum by product' },
      { label: 'Total value', value: totals.value.toFixed(2), note: 'From log value' },
      { label: 'Error rate', value: totals.events ? `${Math.round((totals.errors / totals.events) * 100)}%` : '0%', note: 'Overall' },
    ])}
    <section class="panel">
      <div class="panel-head"><h2>Trend by product</h2><span class="muted">${esc(payload.date_from)} to ${esc(payload.date_to)}</span></div>
      <div class="panel-body">
        <canvas id="productCompareChart" class="chart"></canvas>
        <div class="legend">
          ${products.map((product, index) => `<span style="--dot:${['#0f766e', '#b42318', '#9a6700', '#2563eb', '#7c3aed', '#475569'][index % 6]}">${esc(product.product_display_name || product.product_key)}</span>`).join('')}
        </div>
      </div>
    </section>
    <div style="height:14px"></div>
    ${table(['Product', 'Events', 'Received', 'Errors', 'Unknown', 'Error rate', 'Users', 'Value', 'Purchases', 'First purchase', 'Deposit'], products.map((product) => `
      <tr>
        <td><span class="link" data-route="${esc(productPath(product.market_key, product.product_key))}">${esc(product.product_display_name || product.product_key)}</span><div class="muted mono">${esc(product.market_key)} / ${esc(product.product_key)}</div>${statusPill(product.product_status || 'unknown')}</td>
        <td>${esc(product.total_events || 0)}</td>
        <td>${esc(product.received_events || 0)}</td>
        <td>${esc(product.error_events || 0)}</td>
        <td>${esc(product.unknown_events || 0)}</td>
        <td>${esc(product.error_rate || 0)}%</td>
        <td>${esc(product.unique_users || 0)}</td>
        <td>${Number(product.total_value || 0).toFixed(2)}</td>
        <td>${esc(product.purchase_events || 0)}</td>
        <td>${esc(product.first_purchase_events || 0)}</td>
        <td>${Number(product.total_deposit_amount || 0).toFixed(2)}</td>
      </tr>
    `))}
    ${table(['Product', 'Top events', 'Meta status', 'Top refs', 'Top pub_id', 'Top channels'], products.map((product) => `
      <tr>
        <td>${esc(product.product_display_name || product.product_key)}<div class="muted mono">${esc(product.market_key)} / ${esc(product.product_key)}</div></td>
        <td>${esc(topBreakdown(product, 'event_name'))}</td>
        <td>${esc(topBreakdown(product, 'meta_status'))}</td>
        <td>${esc(topBreakdown(product, 'ref'))}</td>
        <td>${esc(topBreakdown(product, 'pub_id'))}</td>
        <td>${esc(topBreakdown(product, 'channel'))}</td>
      </tr>
    `))}
  `;

  drawProductSeriesChart(products, 'total_events');
  document.querySelectorAll('[data-route]').forEach((el) => {
    el.onclick = () => go(el.dataset.route);
  });
}

async function loadComparison(products) {
  if (products.length === 0) {
    $('compareResults').innerHTML = `<section class="panel"><div class="panel-body muted">No products available to compare.</div></section>`;
    return;
  }

  $('compareResults').innerHTML = `<section class="panel"><div class="panel-body muted">Loading comparison...</div></section>`;

  try {
    const params = new URLSearchParams({
      products: selectedQuery(products),
      date_from: toIsoDate($('dateFrom').value),
      date_to: toIsoDate($('dateTo').value),
      group_by: 'day',
    });
    const payload = await api(`/v1/analytics/products/compare?${params.toString()}`);
    renderResults(payload.data);
  } catch (error) {
    $('compareResults').innerHTML = `<section class="panel"><div class="panel-body muted">Could not load comparison (${esc(error.message)}).</div></section>`;
  }
}

export function renderProductsCompare(ctx) {
  const products = selectedProducts();
  state.compareSelection = products.map(selectorFor);

  setShell('So sánh sản phẩm', 'So sánh nhiều sản phẩm cùng hoặc khác thị trường theo log, lỗi, người dùng, value và breakdown.', 'Workspace / Sản phẩm / So sánh');

  content().innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Products to compare</h2>
        <div class="actions">
          <button data-route="${esc(productsPath())}">Back to products</button>
          <button id="reloadCompare" class="primary">Reload compare</button>
        </div>
      </div>
      <div class="panel-body filters">
        ${state.products.map((product) => `
          <label class="check-line">
            <input type="checkbox" data-compare-product="${esc(selectorFor(product))}" ${state.compareSelection.includes(selectorFor(product)) ? 'checked' : ''}>
            <span>${esc(product.display_name || product.product_key)} <small class="mono">${esc(product.market_key)} / ${esc(product.product_key)}</small></span>
          </label>
        `).join('')}
      </div>
    </section>
    <div style="height:14px"></div>
    <section id="compareResults"></section>
  `;

  document.querySelectorAll('[data-compare-product]').forEach((checkbox) => {
    checkbox.onchange = () => {
      const next = new Set(state.compareSelection);
      if (checkbox.checked) next.add(checkbox.dataset.compareProduct);
      else next.delete(checkbox.dataset.compareProduct);
      state.compareSelection = [...next];
    };
  });

  $('reloadCompare').onclick = () => {
    const selected = new Set(state.compareSelection);
    loadComparison(state.products.filter((product) => selected.has(selectorFor(product))));
  };

  loadComparison(products);
}
