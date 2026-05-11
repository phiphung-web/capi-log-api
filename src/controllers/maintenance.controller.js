const pool = require('../db/pool');

async function aggregateDailyMetrics(req, res) {
  const days = Math.min(Math.max(Number(req.body?.days) || 31, 1), 370);

  const sql = `
    INSERT INTO capi_daily_product_metrics (
      metric_date,
      market_key,
      product_key,
      event_name,
      total_events,
      received_events,
      error_events,
      unknown_events,
      unique_users,
      total_value
    )
    SELECT
      created_at::date AS metric_date,
      market_key,
      product_key,
      event_name,
      COUNT(*)::integer AS total_events,
      COUNT(*) FILTER (WHERE meta_status = 'received')::integer AS received_events,
      COUNT(*) FILTER (WHERE meta_status = 'error')::integer AS error_events,
      COUNT(*) FILTER (WHERE meta_status = 'unknown')::integer AS unknown_events,
      COUNT(DISTINCT user_id)::integer AS unique_users,
      COALESCE(SUM(value), 0) AS total_value
    FROM capi_event_logs
    WHERE created_at >= NOW() - ($1::integer || ' days')::interval
    GROUP BY created_at::date, market_key, product_key, event_name
    ON CONFLICT (metric_date, market_key, product_key, event_name)
    DO UPDATE SET
      total_events = EXCLUDED.total_events,
      received_events = EXCLUDED.received_events,
      error_events = EXCLUDED.error_events,
      unknown_events = EXCLUDED.unknown_events,
      unique_users = EXCLUDED.unique_users,
      total_value = EXCLUDED.total_value,
      updated_at = NOW()
  `;

  try {
    await pool.query(sql, [days]);
    return res.json({ success: true, message: 'Daily metrics aggregated.', data: { days } });
  } catch (error) {
    console.error('Failed to aggregate daily metrics:', error);
    return res.status(500).json({ success: false, message: 'Could not aggregate daily metrics.' });
  }
}

async function purgeRawLogs(req, res) {
  const retentionDays = Math.min(Math.max(Number(req.body?.retention_days) || 31, 7), 370);

  const sql = `
    UPDATE capi_event_logs
    SET
      meta_request_payload = NULL,
      meta_response = NULL,
      raw_payload = jsonb_build_object('archived', true, 'retention_days', $1::integer),
      metadata = NULL
    WHERE created_at < NOW() - ($1::integer || ' days')::interval
  `;

  try {
    const result = await pool.query(sql, [retentionDays]);
    return res.json({
      success: true,
      message: 'Old raw log details purged.',
      data: { retention_days: retentionDays, affected_rows: result.rowCount },
    });
  } catch (error) {
    console.error('Failed to purge raw logs:', error);
    return res.status(500).json({ success: false, message: 'Could not purge raw logs.' });
  }
}

module.exports = {
  aggregateDailyMetrics,
  purgeRawLogs,
};
