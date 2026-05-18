import { $, content } from '../dom.mjs';
import { api } from '../api.mjs';
import { statusPill, table } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { esc } from '../utils.mjs';

function roleLabel(role) {
  return {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    viewer: 'Người xem',
  }[role] || role || '-';
}

async function loadUsers() {
  const payload = await api('/v1/admin/users');
  $('usersTable').innerHTML = table(['Username', 'Tên hiển thị', 'Vai trò', 'Trạng thái', 'Thị trường', 'Sản phẩm'], payload.data.map((user) => `
    <tr>
      <td>${esc(user.username)}</td>
      <td>${esc(user.display_name || '-')}</td>
      <td>${esc(roleLabel(user.role))}</td>
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
  setShell('Người dùng', 'Quản trị tài khoản, mật khẩu và quyền truy cập theo username.', 'Hệ thống / Admin / Người dùng');
  content().innerHTML = `
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Tài khoản người dùng</h2><button id="loadUsers" class="primary">Tải người dùng</button></div>
        <div id="usersTable" class="panel-body muted">Bấm Tải người dùng để lấy danh sách tài khoản live.</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Tạo người dùng</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <div><label>Username</label><input id="newUsername" placeholder="username"></div>
            <div><label>Tên hiển thị</label><input id="newName" placeholder="tên hiển thị"></div>
            <div><label>Mật khẩu</label><input id="newPassword" placeholder="mật khẩu"></div>
            <div><label>Vai trò</label><select id="newRole"><option value="viewer">Người xem</option><option value="manager">Quản lý</option><option value="admin">Quản trị viên</option></select></div>
          </div>
          <div class="actions"><button id="createUser" class="primary">Tạo</button></div>
        </div>
      </section>
    </div>
  `;

  $('loadUsers').onclick = loadUsers;
  $('createUser').onclick = createUser;
}
