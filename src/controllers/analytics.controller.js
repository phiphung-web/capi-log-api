const pool = require('../db/pool');

function addAccessFilter(req, filters, params, marketExpr, productExpr) {
  if (!req.auth || req.auth.is_admin) return;
  if (!req.auth.user || !req.auth.user.id) {
    filters.push('1 = 0');
    return;
  }
  params.push(req.auth.user.id);
  const index = params.length;
  filters.push(`(
    ${marketExpr} IN (SELECT market_key FROM capi_user_market_access WHERE user_id = $${index})
    OR EXISTS (
      SELECT 1 FROM capi_user_product_access upa
      WHERE upa.user_id = $${index}
        AND upa.market_key = ${marketExpr}
        AND upa.product_key = ${productExpr}
    )
  )`);
}

function parseWindow(query) {
  const to = query.date_to ? new Date(query.date_to) : new Date();
  const days = Math.min(Math.max(Number(query.days) || 7, 1), 31);
  const from = query.date_from
    ? new Date(query.date_from)
    : new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    days,
  };
}

async function overview(req, res) {
  const filters = [];
  const params = [];
  const { dateFrom, dateTo } = parseWindow(req.query);
  params.push(dateFrom, dateTo);
  filters.push("l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')");
  addAccessFilter(req, filters, params, 'l.market_key', 'l.product_key');

  const sql = `
    SELECT
      COUNT(*)::integer AS total_events,
      COUNT(*) FILTER (WHERE l.meta_status = 'received')::integer AS received_events,
      COUNT(*) FILTER (WHERE l.meta_status = 'error')::integer AS error_events,
      COUNT(*) FILTER (WHERE l.meta_status = 'unknown')::integer AS unknown_events,
      COUNT(DISTINCT l.market_key)::integer AS total_markets,
      COUNT(DISTINCT (l.market_key, l.product_key))::integer AS total_products,
      COUNT(DISTINCT l.user_id)::integer AS unique_users,
      COALESCE(SUM(l.value), 0) AS total_value
    FROM capi_event_logs l
    WHERE ${filters.join(' AND ')}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return res.json({
      success: true,
      data: {
        ...rows[0],
        date_from: dateFrom,
        date_to: dateTo,
      },
    });
  } catch (error) {
    console.error('Failed to load overview:', error);
    return res.status(500).json({ success: false, message: 'Could not load overview.' });
  }
}

async function productCompare(req, res) {
  const { market_key: marketKey, product_key: productKey } = req.params;
  const { dateTo, days } = parseWindow(req.query);

  if (!req.auth?.is_admin) {
    const access = await pool.query(
      `
        SELECT 1
        WHERE EXISTS (
          SELECT 1 FROM capi_user_market_access
          WHERE user_id = $1 AND market_key = $2
        )
        OR EXISTS (
          SELECT 1 FROM capi_user_product_access
          WHERE user_id = $1 AND market_key = $2 AND product_key = $3
        )
      `,
      [req.auth?.user?.id, marketKey, productKey]
    );

    if (access.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
  }

  const sql = `
    WITH ranges AS (
      SELECT 'current' AS period, $3::date - (($4::integer - 1) || ' days')::interval AS start_date, $3::date AS end_date
      UNION ALL
      SELECT 'previous', $3::date - ((($4::integer * 2) - 1) || ' days')::interval, $3::date - ($4::integer || ' days')::interval
      UNION ALL
      SELECT 'last_week', $3::date - ((($4::integer - 1) + 7) || ' days')::interval, $3::date - INTERVAL '7 days'
    ),
    days AS (
      SELECT
        r.period,
        gs::date AS metric_date,
        ROW_NUMBER() OVER (PARTITION BY r.period ORDER BY gs::date) AS day_index
      FROM ranges r
      CROSS JOIN LATERAL generate_series(r.start_date, r.end_date, INTERVAL '1 day') gs
    ),
    events AS (
      SELECT
        d.period,
        d.day_index,
        d.metric_date,
        COUNT(l.id)::integer AS total_events,
        COUNT(l.id) FILTER (WHERE l.meta_status = 'received')::integer AS received_events,
        COUNT(l.id) FILTER (WHERE l.meta_status = 'error')::integer AS error_events
      FROM days d
      LEFT JOIN capi_event_logs l
        ON l.created_at::date = d.metric_date
        AND l.market_key = $1
        AND l.product_key = $2
      GROUP BY d.period, d.day_index, d.metric_date
    )
    SELECT * FROM events ORDER BY period, day_index
  `;

  try {
    const { rows } = await pool.query(sql, [marketKey, productKey, dateTo, days]);
    return res.json({
      success: true,
      data: {
        market_key: marketKey,
        product_key: productKey,
        date_to: dateTo,
        days,
        series: rows,
      },
    });
  } catch (error) {
    console.error('Failed to load compare analytics:', error);
    return res.status(500).json({ success: false, message: 'Could not load compare analytics.' });
  }
}

module.exports = {
  overview,
  productCompare,
};
