import { $, content } from '../dom.mjs';
import { setShell } from '../shell.mjs';

export function renderLogin(ctx) {
  setShell('Login', 'Sign in with username and password to access live CAPI log data.', 'Workspace / Login');

  content().innerHTML = `
    <section class="login-page">
      <div class="login-panel panel">
        <div class="panel-head"><h2>Internal access</h2><span class="muted">Username / password</span></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="full"><label>Username</label><input id="pageUsername" placeholder="admin"></div>
            <div class="full"><label>Password</label><input id="pagePassword" type="password" placeholder="password"></div>
          </div>
          <div class="actions">
            <button id="pageDemo" class="ghost">View demo</button>
            <button id="pageLogin" class="primary">Login</button>
          </div>
          <p id="pageLoginState" class="muted mini"></p>
        </div>
      </div>
    </section>
  `;

  $('pageLogin').onclick = async () => {
    $('usernameInput').value = $('pageUsername').value;
    $('passwordInput').value = $('pagePassword').value;
    await ctx.login($('pageUsername').value, $('pagePassword').value);
  };

  $('pageDemo').onclick = () => ctx.useDemo();
}
