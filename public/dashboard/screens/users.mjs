import { $, content } from '../dom.mjs';
import { api } from '../api.mjs';
import { statusPill, table } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { esc } from '../utils.mjs';

async function loadUsers() {
  const payload = await api('/v1/admin/users');
  $('usersTable').innerHTML = table(['Username', 'Name', 'Role', 'Status', 'Markets', 'Products'], payload.data.map((user) => `
    <tr>
      <td>${esc(user.username)}</td>
      <td>${esc(user.display_name || '-')}</td>
      <td>${esc(user.role)}</td>
      <td>${statusPill(user.status)}</td>
      <td>${esc((user.markets || []).join(', '))}</td>
      <td>${esc((user.products || []).map((product) => `${product.market_key}/${product.product_key}`).join(', '))}</td>
    </tr>
  `));
}

async function createUser() {
  await api('/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      username: $('newUsername').value,
      display_name: $('newName').value,
      password: $('newPassword').value,
      role: $('newRole').value,
    }),
  });
  await loadUsers();
}

export function renderUsers() {
  setShell('Users', 'Admin-only account and access management by username and password.', 'Workspace / Admin / Users');
  content().innerHTML = `
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>User accounts</h2><button id="loadUsers" class="primary">Load users</button></div>
        <div id="usersTable" class="panel-body muted">Click Load users to fetch live accounts.</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Create user</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><label>Username</label><input id="newUsername" placeholder="username"></div>
            <div><label>Display name</label><input id="newName" placeholder="display name"></div>
            <div><label>Password</label><input id="newPassword" placeholder="password"></div>
            <div><label>Role</label><select id="newRole"><option>viewer</option><option>manager</option><option>admin</option></select></div>
          </div>
          <div class="actions"><button id="createUser" class="primary">Create</button></div>
        </div>
      </section>
    </div>
  `;

  $('loadUsers').onclick = loadUsers;
  $('createUser').onclick = createUser;
}
