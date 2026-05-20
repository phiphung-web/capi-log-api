const pool = require('../db/pool');

function getMetaEvent(body) {
  const event = body?.request?.data?.[0] || body?.meta_request_payload?.data?.[0];
  return event && typeof event === 'object' && !Array.isArray(event) ? event : {};
}

function getPixelIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/graph\.facebook\.com\/v\d+\.\d+\/([^/?#]+)\/events/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function getSourceBody(body) {
  const metaEvent = getMetaEvent(body);
  const customData =
    metaEvent.custom_data && typeof metaEvent.custom_data === 'object' && !Array.isArray(metaEvent.custom_data)
      ? metaEvent.custom_data
      : {};
  const userData =
    metaEvent.user_data && typeof metaEvent.user_data === 'object' && !Array.isArray(metaEvent.user_data)
      ? metaEvent.user_data
      : null;
  const eventSourceUrl = body.event_source_url || body.url || null;

  if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
    return {
      ...customData,
      event_name: metaEvent.event_name,
      event_time: metaEvent.event_time,
      event_id: metaEvent.event_id,
      user_data: userData,
      ...body.metadata,
      pixel_id: body.metadata.pixel_id || body.pixel_id || getPixelIdFromUrl(eventSourceUrl),
      sent_at: body.sent_at || body.metadata.sent_at,
      event_source_url: eventSourceUrl || body.metadata.event_source_url,
      meta_request_payload: body.request || body.meta_request_payload || body.metadata.meta_request_payload,
      meta_response: body.response || body.meta_response || body.metadata.meta_response,
      raw_payload: body,
      metadata: body.metadata,
    };
  }

  return {
    ...customData,
    event_name: metaEvent.event_name,
    event_time: metaEvent.event_time,
    event_id: metaEvent.event_id,
    user_data: userData,
    ...body,
    pixel_id: body.pixel_id || getPixelIdFromUrl(eventSourceUrl),
    event_source_url: eventSourceUrl,
    meta_request_payload: body.meta_request_payload || body.request || null,
    meta_response: body.meta_response || body.response || null,
    raw_payload: body,
    metadata: body.metadata || null,
  };
}

function validateSegmentKey(field, value) {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(value)) {
    return `${field} must be 2-64 characters and contain only letters, numbers, underscores, or hyphens.`;
  }

  return null;
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

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
  if (!accessScope) {
    return;
  }

  const clauses = [];

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

const CATALOG_STATUSES = new Set(['active', 'paused', 'archived']);

function pickCatalogFields(body, allowedFields) {
  const data = {};

  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      data[field] = body[field] === null || body[field] === '' ? null : String(body[field]).trim();
    }
  });

  if (data.status && !CATALOG_STATUSES.has(data.status)) {
    return {
      error: 'status must be active, paused, or archived.',
      data: null,
    };
  }

  return { error: null, data };
}

async function syncCatalog(marketKey, productKey) {
  const [existingMarket, existingProduct] = await Promise.all([
    pool.query('SELECT 1 FROM capi_markets WHERE market_key = $1 LIMIT 1', [marketKey]),
    pool.query(
      'SELECT 1 FROM capi_products WHERE market_key = $1 AND product_key = $2 LIMIT 1',
      [marketKey, productKey]
    ),
  ]);

  await pool.query(
    `
      INSERT INTO capi_markets (market_key, first_seen_at, last_seen_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (market_key)
      DO UPDATE SET
        last_seen_at = NOW(),
        updated_at = NOW()
    `,
    [marketKey]
  );

  await pool.query(
    `
      INSERT INTO capi_products (market_key, product_key, first_seen_at, last_seen_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (market_key, product_key)
      DO UPDATE SET
        last_seen_at = NOW(),
        updated_at = NOW()
    `,
    [marketKey, productKey]
  );

  return {
    isNewMarketKey: existingMarket.rowCount === 0,
    isNewProductKey: existingProduct.rowCount === 0,
  };
}

function pickAttribution(body, key) {
  if (body[key] !== undefined && body[key] !== null) {
    return body[key];
  }

  if (body.user_data && body.user_data[key] !== undefined && body.user_data[key] !== null) {
    return body.user_data[key];
  }

  return null;
}

function hasMetaError(metaResponse) {
  if (!metaResponse || typeof metaResponse !== 'object') {
    return false;
  }

  if (metaResponse.error) {
    return true;
  }

  if (!Array.isArray(metaResponse.messages)) {
    return false;
  }

  return metaResponse.messages.some((message) => {
    if (typeof message === 'string') {
      return /error|failed|invalid/i.test(message);
    }

    if (!message || typeof message !== 'object') {
      return false;
    }

    return Object.values(message).some(
      (value) => typeof value === 'string' && /error|failed|invalid/i.test(value)
    );
  });
}

function getErrorMessage(metaResponse) {
  if (!metaResponse || typeof metaResponse !== 'object') {
    return null;
  }

  if (metaResponse.error) {
    if (typeof metaResponse.error === 'string') {
      return metaResponse.error;
    }

    return (
      metaResponse.error.message ||
      metaResponse.error.error_user_msg ||
      JSON.stringify(metaResponse.error)
    );
  }

  if (Array.isArray(metaResponse.messages) && metaResponse.messages.length > 0) {
    const errorMessage = metaResponse.messages.find((message) => {
      if (typeof message === 'string') {
        return /error|failed|invalid/i.test(message);
      }

      return (
        message &&
        typeof message === 'object' &&
        Object.values(message).some(
          (value) => typeof value === 'string' && /error|failed|invalid/i.test(value)
        )
      );
    });

    return errorMessage ? JSON.stringify(errorMessage) : null;
  }

  return null;
}

function getMetaStatus(metaResponse) {
  if (
    metaResponse &&
    typeof metaResponse === 'object' &&
    Number(metaResponse.events_received) > 0
  ) {
    return 'received';
  }

  if (hasMetaError(metaResponse)) {
    return 'error';
  }

  return 'unknown';
}

function getRequestIp(req) {
  const forwardedFor = req.get('x-forwarded-for');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || null;
}

function toIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toBooleanOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (/^(true|1)$/i.test(value)) {
      return true;
    }

    if (/^(false|0)$/i.test(value)) {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : null;
  }

  return null;
}

async function createLog(req, res) {
  if (!req.is('application/json')) {
    return res.status(415).json({
      success: false,
      message: 'Content-Type must be application/json.',
    });
  }

  const body = req.body || {};
  const sourceBody = getSourceBody(body);
  const marketKey = req.params.market_key || sourceBody.market_key || 'global';
  const productKey = req.params.product_key || sourceBody.product_key || 'default';
  const marketKeyError = validateSegmentKey('market_key', marketKey);
  const productKeyError = validateSegmentKey('product_key', productKey);

  if (marketKeyError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'market_key', message: marketKeyError }],
    });
  }

  if (productKeyError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'product_key', message: productKeyError }],
    });
  }

  if (!sourceBody.event_name) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'event_name', message: 'event_name is required in root or metadata.' }],
    });
  }

  if (!sourceBody.event_id) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'event_id', message: 'event_id is required in root or metadata.' }],
    });
  }

  const metaResponse = sourceBody.meta_response || null;
  const values = {
    market_key: marketKey,
    product_key: productKey,
    sent_at: sourceBody.sent_at || null,
    pixel_id: sourceBody.pixel_id || null,
    event_name: sourceBody.event_name,
    event_time: toIntegerOrNull(sourceBody.event_time),
    event_id: sourceBody.event_id,
    user_id: sourceBody.user_id || null,
    username: sourceBody.username || null,
    txn_id: sourceBody.txn_id || null,
    ref: sourceBody.ref || null,
    pub_id: sourceBody.pub_id || null,
    platform: sourceBody.platform || null,
    channel: sourceBody.channel || null,
    value: toNumberOrNull(sourceBody.value),
    currency: sourceBody.currency || null,
    is_first_purchase: toBooleanOrNull(sourceBody.is_first_purchase),
    total_purchase_count: toIntegerOrNull(sourceBody.total_purchase_count),
    total_deposit_amount: toNumberOrNull(sourceBody.total_deposit_amount),
    fbc: pickAttribution(sourceBody, 'fbc'),
    fbp: pickAttribution(sourceBody, 'fbp'),
    fbclid: pickAttribution(sourceBody, 'fbclid'),
    external_id: pickAttribution(sourceBody, 'external_id'),
    client_ip_address: pickAttribution(sourceBody, 'client_ip_address'),
    client_user_agent: pickAttribution(sourceBody, 'client_user_agent'),
    event_source_url: sourceBody.event_source_url || null,
    events_received: toIntegerOrNull(metaResponse && metaResponse.events_received),
    fbtrace_id: metaResponse && metaResponse.fbtrace_id ? metaResponse.fbtrace_id : null,
    meta_status: getMetaStatus(metaResponse),
    error_message: getErrorMessage(metaResponse),
    meta_request_payload: sourceBody.meta_request_payload || null,
    meta_response: metaResponse,
    raw_payload: sourceBody.raw_payload,
    metadata: sourceBody.metadata,
    request_ip: getRequestIp(req),
    request_user_agent: req.get('user-agent') || null,
  };

  const sql = `
    INSERT INTO capi_event_logs (
      sent_at,
      market_key,
      product_key,
      pixel_id,
      event_name,
      event_time,
      event_id,
      user_id,
      username,
      txn_id,
      ref,
      pub_id,
      platform,
      channel,
      value,
      currency,
      is_first_purchase,
      total_purchase_count,
      total_deposit_amount,
      fbc,
      fbp,
      fbclid,
      external_id,
      client_ip_address,
      client_user_agent,
      event_source_url,
      events_received,
      fbtrace_id,
      meta_status,
      error_message,
      meta_request_payload,
      meta_response,
      raw_payload,
      metadata,
      request_ip,
      request_user_agent
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35, $36
    )
    ON CONFLICT (market_key, product_key, event_name, event_id)
    DO UPDATE SET
      received_at = NOW(),
      sent_at = EXCLUDED.sent_at,
      pixel_id = EXCLUDED.pixel_id,
      event_time = EXCLUDED.event_time,
      user_id = EXCLUDED.user_id,
      username = EXCLUDED.username,
      txn_id = EXCLUDED.txn_id,
      ref = EXCLUDED.ref,
      pub_id = EXCLUDED.pub_id,
      platform = EXCLUDED.platform,
      channel = EXCLUDED.channel,
      value = EXCLUDED.value,
      currency = EXCLUDED.currency,
      is_first_purchase = EXCLUDED.is_first_purchase,
      total_purchase_count = EXCLUDED.total_purchase_count,
      total_deposit_amount = EXCLUDED.total_deposit_amount,
      fbc = EXCLUDED.fbc,
      fbp = EXCLUDED.fbp,
      fbclid = EXCLUDED.fbclid,
      external_id = EXCLUDED.external_id,
      client_ip_address = EXCLUDED.client_ip_address,
      client_user_agent = EXCLUDED.client_user_agent,
      event_source_url = EXCLUDED.event_source_url,
      events_received = EXCLUDED.events_received,
      fbtrace_id = EXCLUDED.fbtrace_id,
      meta_status = EXCLUDED.meta_status,
      error_message = EXCLUDED.error_message,
      meta_request_payload = EXCLUDED.meta_request_payload,
      meta_response = EXCLUDED.meta_response,
      raw_payload = EXCLUDED.raw_payload,
      metadata = EXCLUDED.metadata,
      request_ip = EXCLUDED.request_ip,
      request_user_agent = EXCLUDED.request_user_agent
    RETURNING
      id,
      created_at,
      market_key,
      product_key,
      event_name,
      event_id,
      meta_status,
      events_received,
      fbtrace_id
  `;

  const params = [
    values.sent_at,
    values.market_key,
    values.product_key,
    values.pixel_id,
    values.event_name,
    values.event_time,
    values.event_id,
    values.user_id,
    values.username,
    values.txn_id,
    values.ref,
    values.pub_id,
    values.platform,
    values.channel,
    values.value,
    values.currency,
    values.is_first_purchase,
    values.total_purchase_count,
    values.total_deposit_amount,
    values.fbc,
    values.fbp,
    values.fbclid,
    values.external_id,
    values.client_ip_address,
    values.client_user_agent,
    values.event_source_url,
    values.events_received,
    values.fbtrace_id,
    values.meta_status,
    values.error_message,
    values.meta_request_payload,
    values.meta_response,
    values.raw_payload,
    values.metadata,
    values.request_ip,
    values.request_user_agent,
  ];

  try {
    const { isNewMarketKey, isNewProductKey } = await syncCatalog(
      values.market_key,
      values.product_key
    );
    const { rows } = await pool.query(sql, params);
    const data = {
      ...rows[0],
      is_new_market_key: isNewMarketKey,
      is_new_product_key: isNewProductKey,
    };

    if (isNewMarketKey) {
      console.warn(`New market_key detected: ${values.market_key}`);
    }

    if (isNewProductKey) {
      console.warn(`New product_key detected: ${values.market_key}/${values.product_key}`);
    }

    if (isNewMarketKey || isNewProductKey) {
      data.notice = 'New market/product key detected.';
    }

    return res.status(201).json({
      success: true,
      message: 'CAPI log saved.',
      data,
    });
  } catch (error) {
    console.error('Failed to save CAPI log:', error);

    if (error.code === '42P01') {
      return res.status(500).json({
        success: false,
        message: 'Database schema is missing required tables.',
        error_code: 'DB_SCHEMA_MISSING',
        detail: 'Run database/schema.sql or the required migrations before sending logs.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Could not save CAPI log.',
      error_code: 'LOG_SAVE_FAILED',
    });
  }
}

async function listLogs(req, res) {
  try {
    const accessScope = await getAccessScope(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const filters = [];
    const params = [];

    function addFilter(sql, value) {
      params.push(value);
      filters.push(sql.replace('?', `$${params.length}`));
    }

    if (req.params.product_key) {
      addFilter('l.product_key = ?', req.params.product_key);
    } else if (req.query.product_key) {
      addFilter('l.product_key = ?', req.query.product_key);
    }

    if (req.params.market_key) {
      addFilter('l.market_key = ?', req.params.market_key);
    } else if (req.query.market_key) {
      addFilter('l.market_key = ?', req.query.market_key);
    }

    if (req.query.meta_status) {
      addFilter('l.meta_status = ?', req.query.meta_status);
    }

    if (req.query.event_name) {
      addFilter('l.event_name = ?', req.query.event_name);
    }

    if (req.query.date_from) {
      addFilter('l.created_at >= ?::date', req.query.date_from);
    }

    if (req.query.date_to) {
      addFilter("l.created_at < (?::date + INTERVAL '1 day')", req.query.date_to);
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) {
        params.push(search);
        const exactParam = `$${params.length}`;
        params.push(`${escapeLikePattern(search)}%`);
        const prefixParam = `$${params.length}`;
        filters.push(`(
      l.event_id = ${exactParam}
      OR l.txn_id = ${exactParam}
      OR l.user_id ILIKE ${prefixParam} ESCAPE '\\'
      OR l.username ILIKE ${prefixParam} ESCAPE '\\'
      OR l.fbtrace_id ILIKE ${prefixParam} ESCAPE '\\'
      OR l.ref ILIKE ${prefixParam} ESCAPE '\\'
      OR l.pub_id ILIKE ${prefixParam} ESCAPE '\\'
      OR m.display_name ILIKE ${prefixParam} ESCAPE '\\'
      OR p.display_name ILIKE ${prefixParam} ESCAPE '\\'
      OR p.category ILIKE ${prefixParam} ESCAPE '\\'
    )`);
      }
    }

    addAccessFilter(accessScope, filters, params, 'l.market_key', 'l.product_key');

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const dataParams = [...params, limit, offset];
    const countParams = params;

    const dataSql = `
    SELECT
      l.id,
      l.created_at,
      l.received_at,
      l.sent_at,
      l.market_key,
      l.product_key,
      l.pixel_id,
      l.event_name,
      l.event_time,
      l.event_id,
      l.user_id,
      l.username,
      l.txn_id,
      l.ref,
      l.pub_id,
      l.platform,
      l.channel,
      l.value,
      l.currency,
      l.is_first_purchase,
      l.total_purchase_count,
      l.total_deposit_amount,
      l.fbc,
      l.fbp,
      l.fbclid,
      l.external_id,
      l.client_ip_address,
      l.client_user_agent,
      l.event_source_url,
      l.events_received,
      l.fbtrace_id,
      l.meta_status,
      l.error_message,
      l.meta_request_payload,
      l.meta_response,
      l.raw_payload,
      l.metadata,
      l.request_ip,
      l.request_user_agent,
      m.display_name AS market_display_name,
      m.region AS market_region,
      m.status AS market_status,
      p.display_name AS product_display_name,
      p.category AS product_category,
      p.status AS product_status,
      p.owner AS product_owner,
      p.notes AS product_notes
    FROM capi_event_logs l
    LEFT JOIN capi_markets m
      ON m.market_key = l.market_key
    LEFT JOIN capi_products p
      ON p.market_key = l.market_key
      AND p.product_key = l.product_key
    ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
    const countSql = `
    SELECT COUNT(*)::integer AS total
    FROM capi_event_logs l
    LEFT JOIN capi_markets m
      ON m.market_key = l.market_key
    LEFT JOIN capi_products p
      ON p.market_key = l.market_key
      AND p.product_key = l.product_key
    ${whereSql}
  `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataSql, dataParams),
      pool.query(countSql, countParams),
    ]);

    return res.json({
      success: true,
      message: 'CAPI logs listed.',
      data: dataResult.rows,
      pagination: {
        total: countResult.rows[0].total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Failed to list CAPI logs:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not list CAPI logs.',
    });
  }
}

async function listProducts(req, res) {
  try {
    const accessScope = await getAccessScope(req);
    const filters = [];
    const params = [];

    if (req.params.market_key) {
      params.push(req.params.market_key);
      filters.push(`p.market_key = $${params.length}`);
    } else if (req.query.market_key) {
      params.push(req.query.market_key);
      filters.push(`p.market_key = $${params.length}`);
    }

    addAccessFilter(accessScope, filters, params, 'p.market_key', 'p.product_key');

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const sql = `
    WITH log_stats AS (
      SELECT
        market_key,
        product_key,
        COUNT(*)::integer AS total_logs,
        COUNT(*) FILTER (WHERE meta_status = 'received')::integer AS received_logs,
        COUNT(*) FILTER (WHERE meta_status = 'error')::integer AS error_logs,
        COUNT(*) FILTER (WHERE meta_status = 'unknown')::integer AS unknown_logs,
        MAX(created_at) AS latest_log_at
      FROM capi_event_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY market_key, product_key
    )
    SELECT
      p.market_key,
      p.product_key,
      p.display_name,
      p.category,
      p.status,
      p.owner,
      p.notes,
      COALESCE(s.total_logs, 0) AS total_logs,
      COALESCE(s.received_logs, 0) AS received_logs,
      COALESCE(s.error_logs, 0) AS error_logs,
      COALESCE(s.unknown_logs, 0) AS unknown_logs,
      p.first_seen_at,
      GREATEST(p.last_seen_at, COALESCE(s.latest_log_at, p.last_seen_at)) AS last_seen_at
    FROM capi_products p
    LEFT JOIN log_stats s
      ON s.market_key = p.market_key
      AND s.product_key = p.product_key
    ${whereSql}
    ORDER BY last_seen_at DESC
  `;

    const { rows } = await pool.query(sql, params);

    return res.json({
      success: true,
      message: 'Products listed.',
      data: rows,
    });
  } catch (error) {
    console.error('Failed to list products:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not list products.',
    });
  }
}

async function listMarkets(req, res) {
  try {
    const accessScope = await getAccessScope(req);
    const params = [];
    const outerFilters = [];
    const logStatsFilters = ["l.created_at >= NOW() - INTERVAL '30 days'"];

    addAccessFilter(accessScope, logStatsFilters, params, 'l.market_key', 'l.product_key');
    addAccessFilter(accessScope, outerFilters, params, 'm.market_key', 'p.product_key');

    const logStatsWhereSql = `WHERE ${logStatsFilters.join(' AND ')}`;
    const whereSql = outerFilters.length > 0 ? `WHERE ${outerFilters.join(' AND ')}` : '';
    const sql = `
    WITH log_stats AS (
      SELECT
        l.market_key,
        COUNT(DISTINCT l.product_key)::integer AS total_products,
        COUNT(*)::integer AS total_logs,
        COUNT(*) FILTER (WHERE l.meta_status = 'received')::integer AS received_logs,
        COUNT(*) FILTER (WHERE l.meta_status = 'error')::integer AS error_logs,
        COUNT(*) FILTER (WHERE l.meta_status = 'unknown')::integer AS unknown_logs,
        MAX(l.created_at) AS latest_log_at
      FROM capi_event_logs l
      ${logStatsWhereSql}
      GROUP BY l.market_key
    )
    SELECT
      m.market_key,
      m.display_name,
      m.region,
      m.status,
      m.owner,
      m.notes,
      COALESCE(s.total_products, 0) AS total_products,
      COALESCE(s.total_logs, 0) AS total_logs,
      COALESCE(s.received_logs, 0) AS received_logs,
      COALESCE(s.error_logs, 0) AS error_logs,
      COALESCE(s.unknown_logs, 0) AS unknown_logs,
      m.first_seen_at,
      GREATEST(m.last_seen_at, COALESCE(s.latest_log_at, m.last_seen_at)) AS last_seen_at
    FROM capi_markets m
    LEFT JOIN log_stats s
      ON s.market_key = m.market_key
    LEFT JOIN capi_products p
      ON p.market_key = m.market_key
    ${whereSql}
    GROUP BY
      m.market_key,
      m.display_name,
      m.region,
      m.status,
      m.owner,
      m.notes,
      s.total_products,
      s.total_logs,
      s.received_logs,
      s.error_logs,
      s.unknown_logs,
      s.latest_log_at
    ORDER BY last_seen_at DESC
  `;

    const { rows } = await pool.query(sql, params);

    return res.json({
      success: true,
      message: 'Markets listed.',
      data: rows,
    });
  } catch (error) {
    console.error('Failed to list markets:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not list markets.',
    });
  }
}

async function updateMarket(req, res) {
  const { market_key: marketKey } = req.params;
  const marketKeyError = validateSegmentKey('market_key', marketKey);

  if (marketKeyError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'market_key', message: marketKeyError }],
    });
  }

  const { error, data } = pickCatalogFields(req.body || {}, [
    'display_name',
    'region',
    'status',
    'owner',
    'notes',
  ]);

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'status', message: error }],
    });
  }

  try {
    if (!req.auth.is_admin) {
      const access = await pool.query(
        'SELECT 1 FROM capi_user_market_access WHERE user_id = $1 AND market_key = $2 LIMIT 1',
        [req.auth.user.id, marketKey]
      );

      if (access.rowCount === 0) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
    }

    await pool.query(
      `
        INSERT INTO capi_markets (market_key)
        VALUES ($1)
        ON CONFLICT (market_key) DO NOTHING
      `,
      [marketKey]
    );

    const { rows } = await pool.query(
      `
        UPDATE capi_markets
        SET
          display_name = COALESCE($2, display_name),
          region = COALESCE($3, region),
          status = COALESCE($4, status),
          owner = COALESCE($5, owner),
          notes = COALESCE($6, notes),
          updated_at = NOW()
        WHERE market_key = $1
        RETURNING *
      `,
      [
        marketKey,
        data.display_name,
        data.region,
        data.status,
        data.owner,
        data.notes,
      ]
    );

    return res.json({
      success: true,
      message: 'Market updated.',
      data: rows[0],
    });
  } catch (err) {
    console.error('Failed to update market:', err);

    return res.status(500).json({
      success: false,
      message: 'Could not update market.',
    });
  }
}

async function updateProduct(req, res) {
  const { market_key: marketKey, product_key: productKey } = req.params;
  const marketKeyError = validateSegmentKey('market_key', marketKey);
  const productKeyError = validateSegmentKey('product_key', productKey);

  if (marketKeyError || productKeyError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [
        marketKeyError ? { field: 'market_key', message: marketKeyError } : null,
        productKeyError ? { field: 'product_key', message: productKeyError } : null,
      ].filter(Boolean),
    });
  }

  const { error, data } = pickCatalogFields(req.body || {}, [
    'display_name',
    'category',
    'status',
    'owner',
    'notes',
  ]);

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'status', message: error }],
    });
  }

  try {
    if (!req.auth.is_admin) {
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
        [req.auth.user.id, marketKey, productKey]
      );

      if (access.rowCount === 0) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
    }

    await pool.query(
      `
        INSERT INTO capi_markets (market_key)
        VALUES ($1)
        ON CONFLICT (market_key) DO NOTHING
      `,
      [marketKey]
    );

    await pool.query(
      `
        INSERT INTO capi_products (market_key, product_key)
        VALUES ($1, $2)
        ON CONFLICT (market_key, product_key) DO NOTHING
      `,
      [marketKey, productKey]
    );

    const { rows } = await pool.query(
      `
        UPDATE capi_products
        SET
          display_name = COALESCE($3, display_name),
          category = COALESCE($4, category),
          status = COALESCE($5, status),
          owner = COALESCE($6, owner),
          notes = COALESCE($7, notes),
          updated_at = NOW()
        WHERE market_key = $1
          AND product_key = $2
        RETURNING *
      `,
      [
        marketKey,
        productKey,
        data.display_name,
        data.category,
        data.status,
        data.owner,
        data.notes,
      ]
    );

    return res.json({
      success: true,
      message: 'Product updated.',
      data: rows[0],
    });
  } catch (err) {
    console.error('Failed to update product:', err);

    return res.status(500).json({
      success: false,
      message: 'Could not update product.',
    });
  }
}

module.exports = {
  createLog,
  listLogs,
  listMarkets,
  listProducts,
  updateMarket,
  updateProduct,
};
