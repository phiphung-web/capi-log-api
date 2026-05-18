import { content } from '../dom.mjs';
import { metrics } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { state } from '../state.mjs';

function roleLabel(role) {
  return {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    viewer: 'Người xem',
  }[role] || role || '-';
}

export function renderAdmin() {
  setShell('Admin', 'Quản trị hệ thống cho tài khoản, quyền truy cập và tác vụ bảo trì.', 'Hệ thống / Admin');

  content().innerHTML = `
    ${metrics([
      { label: 'Vai trò', value: roleLabel(state.auth?.role), note: 'Phiên hiện tại' },
      { label: 'Thị trường', value: state.markets.length, note: 'Phạm vi được phân quyền' },
      { label: 'Sản phẩm', value: state.products.length, note: 'Phạm vi sản phẩm' },
      { label: 'Lưu raw', value: '30 ngày', note: 'Payload sự kiện chi tiết' },
      { label: 'Chế độ', value: 'Live', note: 'Nguồn dữ liệu' },
    ])}
    <section class="entity-grid">
      <article class="entity-card">
        <div class="entity-top">
          <div class="entity-title"><strong>Người dùng</strong><span>Quản lý tài khoản username/password và vai trò.</span></div>
        </div>
        <button class="primary" data-route="/dashboard/admin/users">Mở người dùng</button>
      </article>
      <article class="entity-card">
        <div class="entity-top">
          <div class="entity-title"><strong>Phạm vi truy cập</strong><span>Cấp quyền xem dữ liệu theo thị trường và sản phẩm.</span></div>
        </div>
        <button data-route="/dashboard/admin/users">Quản lý quyền</button>
      </article>
      <article class="entity-card">
        <div class="entity-top">
          <div class="entity-title"><strong>Bảo trì</strong><span>Tổng hợp số liệu theo ngày và xóa raw log sau thời gian lưu trữ.</span></div>
        </div>
        <button disabled>Job server đã lên lịch</button>
      </article>
    </section>
  `;
}
