# capi-log-api

Node.js + Express + PostgreSQL API for receiving callback logs from a partner backend after it sends Meta Conversions API events.

This service stores the raw callback payload, Meta request payload, Meta response, transaction fields, attribution fields, request IP, and request User-Agent. It also includes a management dashboard with username/password login, role-based access, product/market catalogs, and analytics views.

## 1. Install dependencies

```bash
npm install
```

## 2. Create `.env`

```bash
cp .env.example .env
```

Edit `.env`:

```env
APP_PORT=4005
NODE_ENV=development
API_TOKEN=CHANGE_THIS_SECRET_TOKEN
APP_SECRET=CHANGE_THIS_INTERNAL_APP_SECRET
SESSION_TTL_SECONDS=28800
REMEMBER_SESSION_TTL_SECONDS=2592000
TZ=Asia/Ho_Chi_Minh

DB_HOST=localhost
DB_PORT=5432
DB_NAME=capi_log
DB_USER=capi_user
DB_PASSWORD=CHANGE_DATABASE_PASSWORD
```

## 3. Create PostgreSQL database

Run as a PostgreSQL admin user:

```bash
psql -U postgres
```

```sql
CREATE DATABASE capi_log;
CREATE USER capi_user WITH PASSWORD 'CHANGE_DATABASE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE capi_log TO capi_user;
\c capi_log
GRANT ALL ON SCHEMA public TO capi_user;
```

## 4. Import schema

```bash
psql -U capi_user -d capi_log -f database/schema.sql
```

## 5. Run local

```bash
npm run dev
```

Production-style local run:

```bash
npm start
```

Run project checks:

```bash
npm run check
npm test
```

Health check:

```bash
curl http://localhost:4005/health
```

Dashboard:

```text
http://localhost:4005/
```

The root domain redirects to `/dashboard/login`. The dashboard app then checks the stored session token: unauthenticated users stay on login, authenticated users are sent into the dashboard.

Login sessions expire automatically. By default, normal sessions last 8 hours (`SESSION_TTL_SECONDS=28800`) and "Remember login" sessions last 30 days (`REMEMBER_SESSION_TTL_SECONDS=2592000`).

Server timezone mặc định được đặt là `Asia/Ho_Chi_Minh` (UTC+7) qua biến môi trường `TZ`.

## 6. Test with curl

Market and product-specific endpoint for partner callbacks:

```text
POST /v1/markets/:market_key/products/:product_key/capi/logs
```

Product-only endpoint still works and stores `market_key` as `global`:

```text
POST /v1/products/:product_key/capi/logs
```

Legacy endpoint still works:

```text
POST /v1/capi/logs
```

```bash
curl -X POST http://localhost:4005/v1/markets/vn/products/lengbear777/capi/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CHANGE_THIS_SECRET_TOKEN" \
  -d '{
    "url": "https://landing-demo.com/?fbclid=test",
    "request": {
      "data": [
        {
          "event_name": "Purchase",
          "event_time": 1775754136,
          "event_id": "purchase_60924493165"
        }
      ]
    },
    "response": {
      "events_received": 1,
      "messages": [],
      "fbtrace_id": "TEST_FBTRACE_ID"
    },
    "metadata": {
    "pixel_id": "1178548207737198",
    "event_name": "Purchase",
    "event_time": 1775754136,
    "event_id": "purchase_60924493165",
    "user_id": "1016124",
    "username": "user.1016124",
    "txn_id": "60924493165",
    "ref": "lengbear777_vipclubasia_apk",
    "pub_id": "lengbear777",
    "platform": "Android",
    "channel": "WING_Direct",
    "value": 0.5,
    "currency": "USD",
    "is_first_purchase": true,
    "total_purchase_count": 1,
    "total_deposit_amount": 0.5,
    "user_data": {
      "fbc": "fb.1.1775754000000.testfbclid",
      "fbp": "fb.1.1775753000000.testfbp",
      "fbclid": "testfbclid",
      "external_id": "sha256_user_id",
      "client_ip_address": "182.2.181.1",
      "client_user_agent": "Mozilla/5.0 Android"
    }
    },
    "sent_at": "2026-05-07T10:58:00+07:00"
  }'
```

Expected response:

```json
{
  "success": true,
  "message": "CAPI log saved.",
    "data": {
    "id": 1,
    "created_at": "2026-05-07T04:00:00.000Z",
    "market_key": "vn",
    "product_key": "lengbear777",
    "event_name": "Purchase",
    "event_id": "purchase_60924493165",
    "meta_status": "received",
    "events_received": 1,
    "fbtrace_id": "TEST_FBTRACE_ID"
  }
}
```

## 7. Deploy VPS with PM2

Install dependencies on the server:

```bash
npm install --omit=dev
```

Start with PM2:

```bash
pm2 start src/app.js --name capi-log-api
pm2 save
pm2 startup
```

Check logs:

```bash
pm2 logs capi-log-api
```

Restart after deployment:

```bash
pm2 restart capi-log-api
```

## 8. Nginx reverse proxy sample

```nginx
server {
    listen 80;
    server_name capi-log.example.com;

    location / {
        proxy_pass http://127.0.0.1:4005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Endpoint for partner backend

Send partner callbacks to:

```text
POST https://capi-log.example.com/v1/markets/{market_key}/products/{product_key}/capi/logs
```

Required headers:

```text
Content-Type: application/json
Authorization: Bearer <API_TOKEN>
```

Dashboard session tokens can read data according to the user's role and assigned market/product access. Creating CAPI logs requires the server `API_TOKEN` or a user role with write access (`admin` or `manager`).

If the sending service cannot set an `Authorization` header, it can send the same token with either header:

```text
X-API-Token: <API_TOKEN>
X-API-Key: <API_TOKEN>
```

Authentication errors keep `message: "Unauthorized."` and include `error_code` for debugging:

```text
AUTH_HEADER_MISSING
AUTH_SCHEME_INVALID
AUTH_TOKEN_MISSING
AUTH_TOKEN_FORMAT_INVALID
AUTH_TOKEN_CONFLICT
AUTH_TOKEN_INVALID
AUTH_USER_INACTIVE
```

`market_key` and `product_key` are read from the URL and stored exactly as sent. Both must match `^[a-zA-Z0-9_-]{2,64}$`; new valid keys are accepted automatically and marked with `is_new_market_key` / `is_new_product_key` in the save response.

Recommended body:

```json
{
  "url": "https://landing-demo.com/?fbclid=test",
  "request": {},
  "response": {},
  "metadata": {
    "pixel_id": "1178548207737198",
    "event_name": "Purchase",
    "event_id": "purchase_60924493165",
    "user_id": "1016124",
    "txn_id": "60924493165",
    "fbc": "fb.1.1775754000000.testfbclid",
    "fbp": "fb.1.1775753000000.testfbp",
    "fbclid": "testfbclid",
    "external_id": "sha256_user_id"
  },
  "sent_at": "2026-05-07T10:58:00+07:00"
}
```

The API uses `UNIQUE (market_key, product_key, event_name, event_id)` and PostgreSQL UPSERT. Repeated callbacks for the same market/product event update the existing row instead of creating duplicates.

List detected markets and products:

```bash
curl https://capi-log.example.com/v1/markets \
  -H "Authorization: Bearer <API_TOKEN>"

curl https://capi-log.example.com/v1/products \
  -H "Authorization: Bearer <API_TOKEN>"

curl https://capi-log.example.com/v1/markets/vn/products \
  -H "Authorization: Bearer <API_TOKEN>"
```

Compare multiple products across the selected date range:

```bash
curl "https://capi-log.example.com/v1/analytics/products/compare?products=vn:lengbear777,kh:live777&date_from=2026-05-01&date_to=2026-05-14&group_by=day" \
  -H "Authorization: Bearer <API_TOKEN>"
```

The comparison response includes totals, error rate, unique users, value, purchase/deposit fields, daily series, and breakdowns by event name, Meta status, ref, pub_id, and channel.

Ads reconciliation report:

```bash
curl "https://capi-log.example.com/v1/analytics/reconciliation?date_from=2026-05-01&date_to=2026-05-14" \
  -H "Authorization: Bearer <API_TOKEN>"
```

This report compares backend log rows against Meta CAPI response fields (`meta_status`, `events_received`) and breaks gaps down by product, event, campaign/ref, ref/pub_id/channel, and recent issue logs. To compare against Ads Manager campaign UI totals, import or connect campaign metrics as a separate data source.

Update catalog metadata for admin/dashboard:

```bash
curl -X PATCH https://capi-log.example.com/v1/admin/markets/vn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{"display_name":"Vietnam","region":"SEA","status":"active","owner":"Ops Team","notes":"Primary VN market"}'

curl -X PATCH https://capi-log.example.com/v1/admin/markets/vn/products/lengbear777 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{"display_name":"Lengbear 777","category":"Casino","status":"active","owner":"Media Buyer A","notes":"APK + web funnels"}'
```

Open the management dashboard:

```text
https://capi-log.example.com/dashboard
```

## 10. Server migration for product endpoints

If the database was created before product-specific endpoints were added, run:

```bash
cd /var/www/capi-log-api
psql -U capi_user -d capi_log -h localhost -f database/migrations/001_add_product_log_support.sql
psql -U capi_user -d capi_log -h localhost -f database/migrations/002_add_market_support.sql
psql -U capi_user -d capi_log -h localhost -f database/migrations/003_create_market_product_catalog.sql
psql -U capi_user -d capi_log -h localhost -f database/migrations/004_add_auth_access_and_metrics.sql
psql -U capi_user -d capi_log -h localhost -f database/migrations/005_use_username_for_users.sql
pm2 restart capi-log-api
```

Bootstrap the first admin user with the server API token:

```bash
curl -X POST https://capi-log.example.com/v1/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{"username":"admin","password":"CHANGE_ADMIN_PASSWORD","display_name":"Admin"}'
```

Or set these variables in `.env` and restart PM2; the server will create/update the admin account on startup:

```env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=CHANGE_ADMIN_PASSWORD
DEFAULT_ADMIN_DISPLAY_NAME=Administrator
```

Dashboard users can then log in at:

```text
https://capi-log.example.com/dashboard
```
