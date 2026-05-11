ALTER TABLE capi_users
  ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE capi_users
SET username = COALESCE(username, split_part(email, '@', 1))
WHERE username IS NULL;

ALTER TABLE capi_users
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_capi_users_username_unique
  ON capi_users (username);
