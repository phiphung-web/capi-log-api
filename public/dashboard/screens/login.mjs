import { $, content } from '../dom.mjs';
import { setShell } from '../shell.mjs';

export function renderLogin(ctx) {
  setShell('Login', 'Sign in with username and password to access live CAPI log data.', 'Workspace / Login');

  content().innerHTML = `
    <section class="login-page">
      <div class="login-shell">
        <aside class="login-copy">
          <div class="brand login-brand">
            <div class="brand-mark">CP</div>
            <div>
              <strong>CAPI Log Platform</strong>
              <span>Internal attribution operations</span>
            </div>
          </div>
          <h1>Control Meta CAPI logs by market and product.</h1>
          <p>Review callback health, Meta response status, attribution fields, and product-level event detail from one internal console.</p>
          <div class="login-flow">
            <div><span>01</span><strong>Market</strong><small>Country or traffic scope</small></div>
            <div><span>02</span><strong>Product</strong><small>Game build or property</small></div>
            <div><span>03</span><strong>Logs</strong><small>Event audit trail</small></div>
          </div>
        </aside>

        <div class="login-card panel">
          <div class="panel-head">
            <h2>Sign in</h2>
            <span class="muted">Username / password</span>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="full"><label>Username</label><input id="pageUsername" autocomplete="username" placeholder="admin"></div>
              <div class="full"><label>Password</label><input id="pagePassword" autocomplete="current-password" type="password" placeholder="password"></div>
            </div>
            <div class="actions">
              <button id="pageDemo">View demo</button>
              <button id="pageLogin" class="primary">Login</button>
            </div>
            <p id="pageLoginState" class="muted mini"></p>
          </div>
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
