import { content } from '../dom.mjs';
import { state } from '../state.mjs';
import { marketCards, marketRows, metrics } from '../components.mjs';
import { setShell } from '../shell.mjs';
import { summarize } from '../utils.mjs';

export function renderMarkets() {
  const summary = summarize(state.markets);
  setShell('Thị trường', 'Phạm vi dữ liệu cấp cao. Mở từng thị trường để xem sản phẩm và sức khỏe CAPI.', 'Hệ thống / Thị trường');

  content().innerHTML = `
    ${metrics([
      { label: 'Thị trường', value: state.markets.length, note: 'Phạm vi được phân quyền' },
      { label: 'Sản phẩm', value: state.products.length, note: 'Tất cả sản phẩm đang thấy' },
      { label: 'Đang hoạt động', value: state.markets.filter((market) => market.status === 'active').length, note: 'Sẵn sàng nhận callback' },
      { label: 'Tổng log', value: summary.total, note: 'Khoảng đã chọn' },
      { label: 'Lỗi', value: summary.errors, note: 'Cần rà soát' },
    ])}
    ${marketCards(state.markets)}
    ${marketRows(state.markets)}
  `;
}
