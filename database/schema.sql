CREATE TABLE IF NOT EXISTS capi_event_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TEXT NULL,

  pixel_id TEXT NULL,
  event_name TEXT NOT NULL,
  event_time BIGINT NULL,
  event_id TEXT NOT NULL,

  user_id TEXT NULL,
  username TEXT NULL,
  txn_id TEXT NULL,

  ref TEXT NULL,
  pub_id TEXT NULL,
  platform TEXT NULL,
  channel TEXT NULL,

  value NUMERIC(18, 6) NULL,
  currency TEXT NULL,
  is_first_purchase BOOLEAN NULL,
  total_purchase_count INTEGER NULL,
  total_deposit_amount NUMERIC(18, 6) NULL,

  fbc TEXT NULL,
  fbp TEXT NULL,
  fbclid TEXT NULL,
  external_id TEXT NULL,
  client_ip_address TEXT NULL,
  client_user_agent TEXT NULL,
  event_source_url TEXT NULL,

  events_received INTEGER NULL,
  fbtrace_id TEXT NULL,
  meta_status TEXT NULL,
  error_message TEXT NULL,

  meta_request_payload JSONB NULL,
  meta_response JSONB NULL,
  raw_payload JSONB NOT NULL,

  request_ip TEXT NULL,
  request_user_agent TEXT NULL,

  UNIQUE (pixel_id, event_name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_created_at
  ON capi_event_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_event_name
  ON capi_event_logs (event_name);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_user_id
  ON capi_event_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_txn_id
  ON capi_event_logs (txn_id);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_ref
  ON capi_event_logs (ref);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_pub_id
  ON capi_event_logs (pub_id);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_meta_status
  ON capi_event_logs (meta_status);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_events_received
  ON capi_event_logs (events_received);
