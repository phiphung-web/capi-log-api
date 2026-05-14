const pool = require('../db/pool');

async function getAccessScope(req) {
  if (!req.auth || req.auth.is_admin) {
    return null;
  }

  if (!req.auth.user || !req.auth.user.id) {
    return { marketKeys: [], productMarketKeys: [], productKeys: [] };
  }

  const [marketAccess, productAccess] = await Promise.all([
    pool.query('SELECT market_key FROM capi_user_market_access WHERE user_id = $1', [
      req.auth.user.id,
    ]),
    pool.query(
      'SELECT market_key, product_key FROM capi_user_product_access WHERE user_id = $1',
      [req.auth.user.id]
    ),
  ]);

  return {
    marketKeys: marketAccess.rows.map((row) => row.market_key),
    productMarketKeys: productAccess.rows.map((row) => row.market_key),
    productKeys: productAccess.rows.map((row) => row.product_key),
  };
}

function addAccessFilter(accessScope, filters, params, marketExpr, productExpr) {
  if (!accessScope) return;

  const clauses = [];

  if (accessScope.marketKeys.length > 0) {
    params.push(accessScope.marketKeys);
    clauses.push(`${marketExpr} = ANY($${params.length}::text[])`);
  }

  if (accessScope.productKeys.length > 0) {
    params.push(accessScope.productMarketKeys, accessScope.productKeys);
    const marketParam = params.length - 1;
    const productParam = params.length;
    clauses.push(`EXISTS (
      SELECT 1
      FROM unnest($${marketParam}::text[], $${productParam}::text[]) AS allowed(market_key, product_key)
      WHERE allowed.market_key = ${marketExpr}
        AND allowed.product_key = ${productExpr}
    )`);
  }

  filters.push(clauses.length > 0 ? `(${clauses.join(' OR ')})` : '1 = 0');
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

function validateSegmentKey(value) {
  return /^[a-zA-Z0-9_-]{2,64}$/.test(value);
}

function parseProductPairs(value) {
  if (!value) return [];

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [marketKey, productKey, extra] = item.split(':');
      if (!marketKey || !productKey || extra) {
        return { error: `Invalid product selector: ${item}` };
      }
      if (!validateSegmentKey(marketKey) || !validateSegmentKey(productKey)) {
        return { error: `Invalid market/product key: ${item}` };
      }
      return { marketKey, productKey };
    });
}

function requestedProductsCte(pairs, params) {
  const values = pairs.map((pair, index) => {
    params.push(pair.marketKey, pair.productKey, index + 1);
    const base = params.length - 2;
    return `($${base}, $${base + 1}, $${base + 2}::integer)`;
  });

  return `
    requested_products (market_key, product_key, display_order) AS (
      VALUES ${values.join(', ')}
    )
  `;
}

function hasProductAccess(accessScope, marketKey, productKey) {
  if (!accessScope) return true;
  if (accessScope.marketKeys.includes(marketKey)) return true;

  return accessScope.productKeys.some((allowedProductKey, index) =>
    allowedProductKey === productKey && accessScope.productMarketKeys[index] === marketKey
  );
}

function allowedProductsCte(accessScope, params) {
  if (!accessScope) {
    return `
      allowed_products AS (
        SELECT market_key, product_key, display_order
        FROM requested_products
      )
    `;
  }

  const clauses = [];

  if (accessScope.marketKeys.length > 0) {
    params.push(accessScope.marketKeys);
    clauses.push(`rp.market_key = ANY($${params.length}::text[])`);
  }

  if (accessScope.productKeys.length > 0) {
    params.push(accessScope.productMarketKeys, accessScope.productKeys);
    const marketParam = params.length - 1;
    const productParam = params.length;
    clauses.push(`EXISTS (
      SELECT 1
      FROM unnest($${marketParam}::text[], $${productParam}::text[]) AS allowed(market_key, product_key)
      WHERE allowed.market_key = rp.market_key
        AND allowed.product_key = rp.product_key
    )`);
  }

  return `
    allowed_products AS (
      SELECT rp.market_key, rp.product_key, rp.display_order
      FROM requested_products rp
      WHERE ${clauses.length > 0 ? clauses.join(' OR ') : 'FALSE'}
    )
  `;
}

async function overview(req, res) {
  try {
    const accessScope = await getAccessScope(req);
    const filters = [];
    const params = [];
    const { dateFrom, dateTo } = parseWindow(req.query);
    params.push(dateFrom, dateTo);
    filters.push("l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')");
    addAccessFilter(accessScope, filters, params, 'l.market_key', 'l.product_key');

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

  const accessScope = await getAccessScope(req);
  if (!hasProductAccess(accessScope, marketKey, productKey)) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
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

async function productsCompare(req, res) {
  const parsedPairs = parseProductPairs(req.query.products);

  if (parsedPairs.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'products query is required. Use products=marketA:productA,marketB:productB.',
    });
  }

  const invalidPair = parsedPairs.find((pair) => pair.error);
  if (invalidPair) {
    return res.status(400).json({
      success: false,
      message: invalidPair.error,
    });
  }

  const dedupedPairs = [];
  const seen = new Set();
  parsedPairs.forEach((pair) => {
    const key = `${pair.marketKey}:${pair.productKey}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedPairs.push(pair);
    }
  });

  if (dedupedPairs.length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Compare supports up to 20 products at once.',
    });
  }

  const groupBy = req.query.group_by || 'day';
  if (groupBy !== 'day') {
    return res.status(400).json({
      success: false,
      message: 'group_by currently supports day only.',
    });
  }

  const { dateFrom, dateTo } = parseWindow(req.query);
  const baseParams = [];
  const accessScope = await getAccessScope(req);
  const ctes = [
    requestedProductsCte(dedupedPairs, baseParams),
    allowedProductsCte(accessScope, baseParams),
  ].join(',\n');

  const summaryParams = [...baseParams, dateFrom, dateTo];
  const dateFromParam = summaryParams.length - 1;
  const dateToParam = summaryParams.length;
  const summarySql = `
    WITH ${ctes}
    SELECT
      ap.market_key,
      ap.product_key,
      ap.display_order,
      m.display_name AS market_display_name,
      p.display_name AS product_display_name,
      p.category AS product_category,
      p.status AS product_status,
      COUNT(l.id)::integer AS total_events,
      COUNT(l.id) FILTER (WHERE l.meta_status = 'received')::integer AS received_events,
      COUNT(l.id) FILTER (WHERE l.meta_status = 'error')::integer AS error_events,
      COUNT(l.id) FILTER (WHERE l.meta_status = 'unknown')::integer AS unknown_events,
      COUNT(DISTINCT l.user_id)::integer AS unique_users,
      COALESCE(SUM(l.value), 0)::numeric AS total_value,
      COUNT(l.id) FILTER (WHERE l.event_name = 'Purchase')::integer AS purchase_events,
      COUNT(l.id) FILTER (WHERE l.is_first_purchase IS TRUE)::integer AS first_purchase_events,
      COALESCE(SUM(l.total_deposit_amount), 0)::numeric AS total_deposit_amount,
      CASE
        WHEN COUNT(l.id) = 0 THEN 0
        ELSE ROUND((COUNT(l.id) FILTER (WHERE l.meta_status = 'error')::numeric / COUNT(l.id)::numeric) * 100, 2)
      END AS error_rate
    FROM allowed_products ap
    LEFT JOIN capi_event_logs l
      ON l.market_key = ap.market_key
      AND l.product_key = ap.product_key
      AND l.created_at >= $${dateFromParam}::date
      AND l.created_at < ($${dateToParam}::date + INTERVAL '1 day')
    LEFT JOIN capi_markets m
      ON m.market_key = ap.market_key
    LEFT JOIN capi_products p
      ON p.market_key = ap.market_key
      AND p.product_key = ap.product_key
    GROUP BY
      ap.market_key,
      ap.product_key,
      ap.display_order,
      m.display_name,
      p.display_name,
      p.category,
      p.status
    ORDER BY ap.display_order
  `;

  const breakdownParams = [...baseParams, dateFrom, dateTo];
  const breakdownDateFromParam = breakdownParams.length - 1;
  const breakdownDateToParam = breakdownParams.length;
  const breakdownSql = `
    WITH ${ctes},
    scoped_logs AS (
      SELECT l.*
      FROM allowed_products ap
      JOIN capi_event_logs l
        ON l.market_key = ap.market_key
        AND l.product_key = ap.product_key
        AND l.created_at >= $${breakdownDateFromParam}::date
        AND l.created_at < ($${breakdownDateToParam}::date + INTERVAL '1 day')
    ),
    event_name_breakdown AS (
      SELECT market_key, product_key, 'event_name' AS dimension, COALESCE(event_name, '-') AS name, COUNT(*)::integer AS total_events
      FROM scoped_logs
      GROUP BY market_key, product_key, COALESCE(event_name, '-')
    ),
    meta_status_breakdown AS (
      SELECT market_key, product_key, 'meta_status' AS dimension, COALESCE(meta_status, 'unknown') AS name, COUNT(*)::integer AS total_events
      FROM scoped_logs
      GROUP BY market_key, product_key, COALESCE(meta_status, 'unknown')
    ),
    ref_breakdown AS (
      SELECT market_key, product_key, 'ref' AS dimension, COALESCE(ref, '-') AS name, COUNT(*)::integer AS total_events
      FROM scoped_logs
      GROUP BY market_key, product_key, COALESCE(ref, '-')
    ),
    pub_id_breakdown AS (
      SELECT market_key, product_key, 'pub_id' AS dimension, COALESCE(pub_id, '-') AS name, COUNT(*)::integer AS total_events
      FROM scoped_logs
      GROUP BY market_key, product_key, COALESCE(pub_id, '-')
    ),
    channel_breakdown AS (
      SELECT market_key, product_key, 'channel' AS dimension, COALESCE(channel, '-') AS name, COUNT(*)::integer AS total_events
      FROM scoped_logs
      GROUP BY market_key, product_key, COALESCE(channel, '-')
    )
    SELECT *
    FROM (
      SELECT * FROM event_name_breakdown
      UNION ALL SELECT * FROM meta_status_breakdown
      UNION ALL SELECT * FROM ref_breakdown
      UNION ALL SELECT * FROM pub_id_breakdown
      UNION ALL SELECT * FROM channel_breakdown
    ) b
    ORDER BY market_key, product_key, dimension, total_events DESC, name
  `;

  const seriesParams = [...baseParams, dateFrom, dateTo];
  const seriesDateFromParam = seriesParams.length - 1;
  const seriesDateToParam = seriesParams.length;
  const seriesSql = `
    WITH ${ctes},
    days AS (
      SELECT gs::date AS metric_date
      FROM generate_series($${seriesDateFromParam}::date, $${seriesDateToParam}::date, INTERVAL '1 day') gs
    )
    SELECT
      ap.market_key,
      ap.product_key,
      d.metric_date,
      COUNT(l.id)::integer AS total_events,
      COUNT(l.id) FILTER (WHERE l.meta_status = 'received')::integer AS received_events,
      COUNT(l.id) FILTER (WHERE l.meta_status = 'error')::integer AS error_events,
      COUNT(l.id) FILTER (WHERE l.meta_status = 'unknown')::integer AS unknown_events,
      COUNT(DISTINCT l.user_id)::integer AS unique_users,
      COALESCE(SUM(l.value), 0)::numeric AS total_value,
      COUNT(l.id) FILTER (WHERE l.event_name = 'Purchase')::integer AS purchase_events,
      COUNT(l.id) FILTER (WHERE l.is_first_purchase IS TRUE)::integer AS first_purchase_events,
      COALESCE(SUM(l.total_deposit_amount), 0)::numeric AS total_deposit_amount
    FROM allowed_products ap
    CROSS JOIN days d
    LEFT JOIN capi_event_logs l
      ON l.market_key = ap.market_key
      AND l.product_key = ap.product_key
      AND l.created_at::date = d.metric_date
    GROUP BY ap.market_key, ap.product_key, ap.display_order, d.metric_date
    ORDER BY ap.display_order, d.metric_date
  `;

  try {
    const [summaryResult, breakdownResult, seriesResult] = await Promise.all([
      pool.query(summarySql, summaryParams),
      pool.query(breakdownSql, breakdownParams),
      pool.query(seriesSql, seriesParams),
    ]);

    const products = summaryResult.rows.map((row) => ({
      ...row,
      breakdowns: {
        event_name: [],
        meta_status: [],
        ref: [],
        pub_id: [],
        channel: [],
      },
      series: [],
    }));
    const byKey = new Map(products.map((product) => [`${product.market_key}:${product.product_key}`, product]));

    breakdownResult.rows.forEach((row) => {
      const product = byKey.get(`${row.market_key}:${row.product_key}`);
      if (!product || !product.breakdowns[row.dimension]) return;
      product.breakdowns[row.dimension].push({
        name: row.name,
        total_events: row.total_events,
      });
    });

    seriesResult.rows.forEach((row) => {
      const product = byKey.get(`${row.market_key}:${row.product_key}`);
      if (!product) return;
      product.series.push(row);
    });

    return res.json({
      success: true,
      data: {
        date_from: dateFrom,
        date_to: dateTo,
        group_by: groupBy,
        requested_products: dedupedPairs.map((pair) => ({
          market_key: pair.marketKey,
          product_key: pair.productKey,
        })),
        products,
      },
    });
  } catch (error) {
    console.error('Failed to load product comparison:', error);
    return res.status(500).json({ success: false, message: 'Could not load product comparison.' });
  }
}

module.exports = {
  overview,
  productCompare,
  productsCompare,
};
