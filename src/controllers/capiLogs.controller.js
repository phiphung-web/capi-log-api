const pool = require('../db/pool');

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

  if (!body.event_name) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'event_name', message: 'event_name is required.' }],
    });
  }

  if (!body.event_id) {
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: [{ field: 'event_id', message: 'event_id is required.' }],
    });
  }

  const metaResponse = body.meta_response || null;
  const values = {
    sent_at: body.sent_at || null,
    pixel_id: body.pixel_id || null,
    event_name: body.event_name,
    event_time: toIntegerOrNull(body.event_time),
    event_id: body.event_id,
    user_id: body.user_id || null,
    username: body.username || null,
    txn_id: body.txn_id || null,
    ref: body.ref || null,
    pub_id: body.pub_id || null,
    platform: body.platform || null,
    channel: body.channel || null,
    value: toNumberOrNull(body.value),
    currency: body.currency || null,
    is_first_purchase: toBooleanOrNull(body.is_first_purchase),
    total_purchase_count: toIntegerOrNull(body.total_purchase_count),
    total_deposit_amount: toNumberOrNull(body.total_deposit_amount),
    fbc: pickAttribution(body, 'fbc'),
    fbp: pickAttribution(body, 'fbp'),
    fbclid: pickAttribution(body, 'fbclid'),
    external_id: pickAttribution(body, 'external_id'),
    client_ip_address: pickAttribution(body, 'client_ip_address'),
    client_user_agent: pickAttribution(body, 'client_user_agent'),
    event_source_url: body.event_source_url || null,
    events_received: toIntegerOrNull(metaResponse && metaResponse.events_received),
    fbtrace_id: metaResponse && metaResponse.fbtrace_id ? metaResponse.fbtrace_id : null,
    meta_status: getMetaStatus(metaResponse),
    error_message: getErrorMessage(metaResponse),
    meta_request_payload: body.meta_request_payload || null,
    meta_response: metaResponse,
    raw_payload: body,
    request_ip: getRequestIp(req),
    request_user_agent: req.get('user-agent') || null,
  };

  const sql = `
    INSERT INTO capi_event_logs (
      sent_at,
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
      request_ip,
      request_user_agent
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33
    )
    ON CONFLICT (pixel_id, event_name, event_id)
    DO UPDATE SET
      received_at = NOW(),
      sent_at = EXCLUDED.sent_at,
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
      request_ip = EXCLUDED.request_ip,
      request_user_agent = EXCLUDED.request_user_agent
    RETURNING
      id,
      created_at,
      event_name,
      event_id,
      meta_status,
      events_received,
      fbtrace_id
  `;

  const params = [
    values.sent_at,
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
    values.request_ip,
    values.request_user_agent,
  ];

  try {
    const { rows } = await pool.query(sql, params);

    return res.status(201).json({
      success: true,
      message: 'CAPI log saved.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Failed to save CAPI log:', error);

    return res.status(500).json({
      success: false,
      message: 'Could not save CAPI log.',
    });
  }
}

module.exports = {
  createLog,
};
