import { content } from '../dom.mjs';
import { metrics } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { state } from '../state.mjs';

export function renderAdmin() {
  setShell('Admin', 'System administration for accounts, access, and maintenance tasks.', 'Workspace / Admin');

  content().innerHTML = `
    ${metrics([
      { label: 'Role', value: state.auth?.role || 'demo', note: 'Current session' },
      { label: 'Markets', value: state.markets.length, note: 'Permission scopes' },
      { label: 'Products', value: state.products.length, note: 'Product scopes' },
      { label: 'Raw retention', value: '30d', note: 'Detailed event payload' },
      { label: 'Mode', value: state.demoMode ? 'Demo' : 'Live', note: 'Data source' },
    ])}
    <section class="entity-grid">
      <article class="entity-card">
        <div class="entity-top">
          <div class="entity-title"><strong>Users</strong><span>Manage username/password accounts and roles.</span></div>
        </div>
        <button class="primary" data-route="/dashboard/admin/users">Open users</button>
      </article>
      <article class="entity-card">
        <div class="entity-top">
          <div class="entity-title"><strong>Access scopes</strong><span>Grant users visibility by market and product.</span></div>
        </div>
        <button data-route="/dashboard/admin/users">Manage access</button>
      </article>
      <article class="entity-card">
        <div class="entity-top">
          <div class="entity-title"><strong>Maintenance</strong><span>Aggregate daily metrics and purge raw log detail after retention.</span></div>
        </div>
        <button disabled>Scheduled server job</button>
      </article>
    </section>
  `;
}
