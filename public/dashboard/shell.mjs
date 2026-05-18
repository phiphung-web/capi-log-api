import { $ } from './dom.mjs';
import { state } from './state.mjs';

export function setShell(title, subtitle, crumb) {
  $('screenTitle').textContent = title;
  $('screenSubtitle').textContent = subtitle;
  $('breadcrumb').textContent = crumb || `Hệ thống / ${title}`;
  $('shellMode').textContent = state.auth ? 'Đang dùng dữ liệu live' : 'Hệ thống live';
  $('authBadge').textContent = state.auth ? `Phiên ${state.auth.role || 'user'}` : 'Chưa đăng nhập';
}
