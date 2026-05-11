ALTER TABLE capi_event_logs
  ADD COLUMN IF NOT EXISTS product_key TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL;

ALTER TABLE capi_event_logs
  DROP CONSTRAINT IF EXISTS capi_event_logs_pixel_id_event_name_event_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'capi_event_logs_product_key_event_name_event_id_key'
  ) THEN
    ALTER TABLE capi_event_logs
      ADD CONSTRAINT capi_event_logs_product_key_event_name_event_id_key
      UNIQUE (product_key, event_name, event_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_capi_event_logs_product_key
  ON capi_event_logs (product_key);
