# capi-log-api

Node.js + Express + PostgreSQL API for receiving callback logs from a partner backend after it sends Meta Conversions API events.

This service stores the raw callback payload, Meta request payload, Meta response, transaction fields, attribution fields, request IP, and request User-Agent. It does not include a dashboard or admin authentication in this version.

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

Health check:

```bash
curl http://localhost:4005/health
```

Dashboard:

```text
http://localhost:4005/dashboard
```

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
pm2 restart capi-log-api
```
