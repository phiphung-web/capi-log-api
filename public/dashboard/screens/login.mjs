import { $, content } from '../dom.mjs';
import { setShell } from '../shell.mjs';

export function renderLogin(ctx) {
  setShell('Đăng nhập', 'Đăng nhập bằng tài khoản được cấp để xem dữ liệu CAPI live.', 'Hệ thống / Đăng nhập');

  content().innerHTML = `
    <section class="login-page">
      <div class="login-shell">
        <aside class="login-copy">
          <div class="brand login-brand">
            <div class="brand-mark">CP</div>
            <div>
              <strong>CAPI Log Platform</strong>
              <span>Hệ thống đối soát CAPI nội bộ</span>
            </div>
          </div>
          <h1>Theo dõi log Meta CAPI theo thị trường và sản phẩm.</h1>
          <p>Xem tình trạng callback, phản hồi từ Meta, dữ liệu attribution và chi tiết từng sự kiện trong một hệ thống nội bộ.</p>
          <div class="login-flow">
            <div><span>01</span><strong>Thị trường</strong><small>Quốc gia hoặc phạm vi traffic</small></div>
            <div><span>02</span><strong>Sản phẩm</strong><small>Game, app hoặc landing</small></div>
            <div><span>03</span><strong>Log</strong><small>Lịch sử sự kiện chi tiết</small></div>
          </div>
        </aside>

        <div class="login-card panel">
          <div class="panel-head">
            <h2>Đăng nhập</h2>
            <span class="muted">Username / mật khẩu</span>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="full"><label>Username</label><input id="pageUsername" autocomplete="username" placeholder="admin"></div>
              <div class="full"><label>Mật khẩu</label><input id="pagePassword" autocomplete="current-password" type="password" placeholder="mật khẩu"></div>
              <label class="full check-line">
                <input id="rememberLogin" type="checkbox">
                <span>
                  <strong>Ghi nhớ đăng nhập</strong>
                  <small>Giữ phiên sau khi đóng trình duyệt.</small>
                </span>
              </label>
            </div>
            <div class="actions">
              <button id="pageLogin" class="primary">Đăng nhập</button>
            </div>
            <p id="pageLoginState" class="muted mini"></p>
          </div>
        </div>
      </div>
    </section>
  `;

  $('pageLogin').onclick = async () => {
    $('pageLoginState').textContent = '';
    try {
      await ctx.login(
        $('pageUsername').value,
        $('pagePassword').value,
        $('rememberLogin').checked
      );
    } catch (error) {
      $('pageLoginState').textContent = 'Đăng nhập thất bại. Vui lòng kiểm tra username và mật khẩu.';
    }
  };

  ['pageUsername', 'pagePassword'].forEach((id) => {
    $(id).onkeydown = (event) => {
      if (event.key === 'Enter') {
        $('pageLogin').click();
      }
    };
  });
}
