import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { chartLegend, marketCards, metrics } from '../components.mjs';
import { drawCompareChart } from '../chart.mjs';
import { setShell } from '../shell.mjs';
import { summarize } from '../utils.mjs';

export function renderOverview() {
  const summary = summarize(state.markets);
  setShell('Overview', 'Executive summary across markets, products, and Meta CAPI callbacks.', 'Workspace / Overview');

  content().innerHTML = `
    <section class="workflow">
      <article class="step-card"><span>01</span><strong>Market scope</strong><p>Separate traffic by country or business territory: kh, id, vn.</p></article>
      <article class="step-card"><span>02</span><strong>Product catalog</strong><p>Each game build has its own log stream, owner, status, and category.</p></article>
      <article class="step-card"><span>03</span><strong>Event audit</strong><p>Trace backend sent, Meta response, user attribution, and transaction data.</p></article>
      <article class="step-card"><span>04</span><strong>Daily compare</strong><p>Review today, previous period, and same weekday last week on one chart.</p></article>
    </section>
    ${metrics([
      { label: 'Total events', value: summary.total, note: 'Selected range' },
      { label: 'Meta received', value: summary.received, note: 'events_received > 0' },
      { label: 'Errors', value: summary.errors, note: 'Meta error response' },
      { label: 'Error rate', value: summary.errorRate, note: 'Across visible scope' },
      { label: 'Products', value: state.products.length, note: `${state.markets.length} markets` },
    ])}
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Market health</h2><button class="primary" data-go="markets">Open Markets</button></div>
        <div class="panel-body">${marketCards(state.markets)}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Compare chart</h2><span class="muted">Current / previous / last week</span></div>
        <div class="panel-body">
          <canvas id="compareChart" class="chart"></canvas>
          ${chartLegend()}
        </div>
      </section>
    </div>
  `;

  drawCompareChart();
}
