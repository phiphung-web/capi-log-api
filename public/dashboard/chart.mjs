import { api } from './api.mjs';

const COLORS = ['#0f766e', '#b42318', '#9a6700', '#2563eb', '#7c3aed', '#475569'];

function setupCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(canvas.clientWidth, 320);
  const height = Math.max(canvas.clientHeight, 240);

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  return { ctx, width, height };
}

function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawGrid(ctx, width, height, max) {
  const top = 18;
  const right = 18;
  const bottom = 28;
  const left = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  ctx.strokeStyle = '#e5edf6';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#667085';
  ctx.font = '11px Inter, system-ui, sans-serif';

  for (let i = 0; i <= 4; i += 1) {
    const y = top + (plotHeight * i) / 4;
    const label = Math.round(max - (max * i) / 4).toLocaleString('en-US');
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillText(label, 8, y + 4);
  }

  return { top, right, bottom, left, plotWidth, plotHeight };
}

function normalizeSeries(series) {
  return series
    .map((line, index) => ({
      name: line.name,
      color: line.color || COLORS[index % COLORS.length],
      values: (line.values || []).map((value) => Number(value || 0)),
    }))
    .filter((line) => line.values.length > 0);
}

function drawLineLike(ctx, bounds, lines, max, type) {
  lines.forEach((line) => {
    const points = line.values.map((value, index) => {
      const denominator = Math.max(line.values.length - 1, 1);
      return {
        x: bounds.left + (index * bounds.plotWidth) / denominator,
        y: bounds.top + bounds.plotHeight - (value / max) * bounds.plotHeight,
      };
    });

    if (type === 'area' && points.length > 0) {
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.lineTo(points[points.length - 1].x, bounds.top + bounds.plotHeight);
      ctx.lineTo(points[0].x, bounds.top + bounds.plotHeight);
      ctx.closePath();
      ctx.fillStyle = rgba(line.color, 0.11);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  });
}

function drawBars(ctx, bounds, lines, max) {
  const points = Math.max(...lines.map((line) => line.values.length), 1);
  const groupWidth = bounds.plotWidth / points;
  const barWidth = Math.max(Math.min((groupWidth * 0.72) / Math.max(lines.length, 1), 26), 4);

  lines.forEach((line, lineIndex) => {
    ctx.fillStyle = rgba(line.color, 0.82);
    line.values.forEach((value, index) => {
      const x = bounds.left + index * groupWidth + groupWidth / 2 - (barWidth * lines.length) / 2 + lineIndex * barWidth;
      const barHeight = (value / max) * bounds.plotHeight;
      const y = bounds.top + bounds.plotHeight - barHeight;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  });
}

function drawSeriesChart(canvasId, rawSeries, type = 'line') {
  const setup = setupCanvas(canvasId);
  if (!setup) return;

  const { ctx, width, height } = setup;
  const lines = normalizeSeries(rawSeries);
  const max = Math.max(...lines.flatMap((line) => line.values), 1);
  const bounds = drawGrid(ctx, width, height, max);

  if (lines.length === 0) {
    ctx.fillStyle = '#667085';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.fillText('Chưa có dữ liệu biểu đồ trong phạm vi đã chọn.', bounds.left, height / 2);
    return;
  }

  if (type === 'bar') {
    drawBars(ctx, bounds, lines, max);
    return;
  }

  drawLineLike(ctx, bounds, lines, max, type === 'area' ? 'area' : 'line');
}

export function drawCompareChart(rows, type = 'area') {
  const series = rows || [
    { name: 'current', color: '#0f766e', values: [12, 18, 20, 28, 36, 44, 52] },
    { name: 'previous', color: '#b42318', values: [10, 15, 17, 22, 31, 37, 40] },
    { name: 'last_week', color: '#9a6700', values: [8, 11, 16, 20, 24, 30, 34] },
  ];
  drawSeriesChart('compareChart', series, type);
}

export async function loadCompareChart(product) {
  try {
    const payload = await api(`/v1/analytics/markets/${product.market_key}/products/${product.product_key}/compare?days=7`);
    const grouped = ['current', 'previous', 'last_week'].map((period, index) => ({
      name: period,
      color: COLORS[index],
      values: payload.data.series.filter((row) => row.period === period).map((row) => row.total_events),
    }));
    drawCompareChart(grouped);
  } catch {
    drawCompareChart();
  }
}

export function drawProductSeriesChart(products, metric = 'total_events', type = 'line') {
  const series = products.map((product, index) => ({
    name: product.product_display_name || product.product_key,
    color: COLORS[index % COLORS.length],
    values: (product.series || []).map((row) => Number(row[metric] || 0)),
  }));
  drawSeriesChart('productCompareChart', series, type);
}
