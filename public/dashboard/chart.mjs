import { api } from './api.mjs';

export function drawCompareChart(rows) {
  const canvas = document.getElementById('compareChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;

  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);

  const series = rows || [
    { name: 'current', color: '#0f766e', values: [12, 18, 20, 28, 36, 44, 52] },
    { name: 'previous', color: '#b42318', values: [10, 15, 17, 22, 31, 37, 40] },
    { name: 'last_week', color: '#9a6700', values: [8, 11, 16, 20, 24, 30, 34] },
  ];
  const max = Math.max(...series.flatMap((item) => item.values), 1);

  series.forEach((line) => {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    line.values.forEach((value, index) => {
      const x = 22 + (index * (canvas.clientWidth - 44)) / (line.values.length - 1);
      const y = canvas.clientHeight - 24 - (value / max) * (canvas.clientHeight - 48);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });
}

export async function loadCompareChart(product) {
  try {
    const payload = await api(`/v1/analytics/markets/${product.market_key}/products/${product.product_key}/compare?days=7`);
    const grouped = ['current', 'previous', 'last_week'].map((period, index) => ({
      name: period,
      color: ['#0f766e', '#b42318', '#9a6700'][index],
      values: payload.data.series.filter((row) => row.period === period).map((row) => row.total_events),
    }));
    drawCompareChart(grouped);
  } catch {
    drawCompareChart();
  }
}

export function drawProductSeriesChart(products, metric = 'total_events') {
  const canvas = document.getElementById('productCompareChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;
  const colors = ['#0f766e', '#b42318', '#9a6700', '#2563eb', '#7c3aed', '#475569'];
  const lines = products.map((product, index) => ({
    color: colors[index % colors.length],
    values: (product.series || []).map((row) => Number(row[metric] || 0)),
  })).filter((line) => line.values.length > 0);

  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);

  const max = Math.max(...lines.flatMap((line) => line.values), 1);
  lines.forEach((line) => {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    line.values.forEach((value, index) => {
      const denominator = Math.max(line.values.length - 1, 1);
      const x = 22 + (index * (canvas.clientWidth - 44)) / denominator;
      const y = canvas.clientHeight - 24 - (value / max) * (canvas.clientHeight - 48);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });
}
