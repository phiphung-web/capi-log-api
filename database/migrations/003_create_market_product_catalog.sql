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

INSERT INTO capi_markets (
  market_key,
  first_seen_at,
  last_seen_at
)
SELECT
  market_key,
  MIN(created_at),
  MAX(created_at)
FROM capi_event_logs
GROUP BY market_key
ON CONFLICT (market_key)
DO UPDATE SET
  first_seen_at = LEAST(capi_markets.first_seen_at, EXCLUDED.first_seen_at),
  last_seen_at = GREATEST(capi_markets.last_seen_at, EXCLUDED.last_seen_at),
  updated_at = NOW();

INSERT INTO capi_products (
  market_key,
  product_key,
  first_seen_at,
  last_seen_at
)
SELECT
  market_key,
  product_key,
  MIN(created_at),
  MAX(created_at)
FROM capi_event_logs
GROUP BY market_key, product_key
ON CONFLICT (market_key, product_key)
DO UPDATE SET
  first_seen_at = LEAST(capi_products.first_seen_at, EXCLUDED.first_seen_at),
  last_seen_at = GREATEST(capi_products.last_seen_at, EXCLUDED.last_seen_at),
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_capi_markets_status
  ON capi_markets (status);

CREATE INDEX IF NOT EXISTS idx_capi_products_status
  ON capi_products (status);

CREATE INDEX IF NOT EXISTS idx_capi_products_category
  ON capi_products (category);
