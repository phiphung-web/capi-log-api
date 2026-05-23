CREATE TABLE IF NOT EXISTS capi_event_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TEXT NULL,

  market_key TEXT NOT NULL DEFAULT 'global',
  product_key TEXT NOT NULL DEFAULT 'default',
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
  metadata JSONB NULL,

  request_ip TEXT NULL,
  request_user_agent TEXT NULL,

  UNIQUE (market_key, product_key, event_name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_created_at
  ON capi_event_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_created_market_product
  ON capi_event_logs (created_at DESC, market_key, product_key);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_market_product_created_at
  ON capi_event_logs (market_key, product_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_event_name
  ON capi_event_logs (event_name);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_market_key
  ON capi_event_logs (market_key);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_product_key
  ON capi_event_logs (product_key);

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_market_product
  ON capi_event_logs (market_key, product_key);

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

CREATE TABLE IF NOT EXISTS capi_markets (
  market_key TEXT PRIMARY KEY,
  display_name TEXT NULL,
  region TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner TEXT NULL,
  notes TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capi_products (
  market_key TEXT NOT NULL,
  product_key TEXT NOT NULL,
  display_name TEXT NULL,
  category TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner TEXT NULL,
  notes TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (market_key, product_key),
  FOREIGN KEY (market_key) REFERENCES capi_markets (market_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capi_markets_status
  ON capi_markets (status);

CREATE INDEX IF NOT EXISTS idx_capi_products_status
  ON capi_products (status);

CREATE INDEX IF NOT EXISTS idx_capi_products_category
  ON capi_products (category);

CREATE TABLE IF NOT EXISTS capi_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role IN ('admin', 'manager', 'viewer')),
  CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS capi_user_market_access (
  user_id BIGINT NOT NULL REFERENCES capi_users (id) ON DELETE CASCADE,
  market_key TEXT NOT NULL REFERENCES capi_markets (market_key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, market_key)
);

CREATE TABLE IF NOT EXISTS capi_user_product_access (
  user_id BIGINT NOT NULL REFERENCES capi_users (id) ON DELETE CASCADE,
  market_key TEXT NOT NULL,
  product_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, market_key, product_key),
  FOREIGN KEY (market_key, product_key) REFERENCES capi_products (market_key, product_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS capi_daily_product_metrics (
  metric_date DATE NOT NULL,
  market_key TEXT NOT NULL,
  product_key TEXT NOT NULL,
  event_name TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  received_events INTEGER NOT NULL DEFAULT 0,
  error_events INTEGER NOT NULL DEFAULT 0,
  unknown_events INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC(18, 6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metric_date, market_key, product_key, event_name)
);

CREATE INDEX IF NOT EXISTS idx_capi_daily_metrics_market_product_date
  ON capi_daily_product_metrics (market_key, product_key, metric_date DESC);
