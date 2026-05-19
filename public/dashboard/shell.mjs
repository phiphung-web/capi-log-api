import { $ } from './dom.mjs';
import { state } from './state.mjs';

function roleLabel(role) {
  return {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    viewer: 'Người xem',
    user: 'Người dùng',
  }[role] || role || 'Người dùng';
}

export function setShell(title, subtitle, crumb) {
  $('screenTitle').textContent = title;
  $('screenSubtitle').textContent = subtitle;
  $('breadcrumb').textContent = crumb || `Hệ thống / ${title}`;
  $('shellMode').textContent = state.auth ? 'Đang dùng dữ liệu live' : 'Hệ thống live';
  $('authBadge').textContent = state.auth ? `Phiên ${roleLabel(state.auth.role)}` : 'Chưa đăng nhập';
}
