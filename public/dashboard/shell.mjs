import { $ } from './dom.mjs';
import { state } from './state.mjs';

export function setShell(title, subtitle, crumb) {
  $('screenTitle').textContent = title;
  $('screenSubtitle').textContent = subtitle;
  $('breadcrumb').textContent = crumb || `Workspace / ${title}`;
  $('shellMode').textContent = state.demoMode ? 'Demo data preview' : 'Live data connected';
  $('authBadge').textContent = state.auth ? `${state.auth.role || 'user'} session` : 'Not signed in';
}
