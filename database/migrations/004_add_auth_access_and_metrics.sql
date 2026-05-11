CREATE TABLE IF NOT EXISTS capi_users (
  id BIGSERIAL PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_capi_users_role_status
  ON capi_users (role, status);

CREATE INDEX IF NOT EXISTS idx_capi_daily_metrics_market_product_date
  ON capi_daily_product_metrics (market_key, product_key, metric_date DESC);

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
GROUP BY created_at::date, market_key, product_key, event_name
ON CONFLICT (metric_date, market_key, product_key, event_name)
DO UPDATE SET
  total_events = EXCLUDED.total_events,
  received_events = EXCLUDED.received_events,
  error_events = EXCLUDED.error_events,
  unknown_events = EXCLUDED.unknown_events,
  unique_users = EXCLUDED.unique_users,
  total_value = EXCLUDED.total_value,
  updated_at = NOW();
