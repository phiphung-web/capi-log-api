-- Run this migration outside an explicit transaction. CONCURRENTLY keeps log writes available
-- while PostgreSQL builds indexes on large capi_event_logs tables.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capi_event_logs_created_market_product
  ON capi_event_logs (created_at DESC, market_key, product_key);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capi_event_logs_market_product_created_at
  ON capi_event_logs (market_key, product_key, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capi_daily_metrics_market_product_date
  ON capi_daily_product_metrics (market_key, product_key, metric_date DESC);
