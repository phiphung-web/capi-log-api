import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { marketCards, marketRows, metrics } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { summarize } from '../utils.mjs';

export function renderMarkets() {
  const summary = summarize(state.markets);
  setShell('Markets', 'Top-level business scopes. Open a market to review its products.', 'Workspace / Markets');

  content().innerHTML = `
    ${metrics([
      { label: 'Markets', value: state.markets.length, note: 'Accessible scopes' },
      { label: 'Products', value: state.products.length, note: 'All visible products' },
      { label: 'Active markets', value: state.markets.filter((market) => market.status === 'active').length, note: 'Ready for callbacks' },
      { label: 'Total logs', value: summary.total, note: 'Selected range' },
      { label: 'Errors', value: summary.errors, note: 'Needs review' },
    ])}
    ${marketCards(state.markets)}
    ${marketRows(state.markets)}
  `;
}
