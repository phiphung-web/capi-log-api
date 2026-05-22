require('dotenv').config();

process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const auth = require('./middleware/auth');
const analyticsController = require('./controllers/analytics.controller');
const authController = require('./controllers/auth.controller');
const capiLogsController = require('./controllers/capiLogs.controller');
const capiLogsRoutes = require('./routes/capiLogs.routes');
const maintenanceController = require('./controllers/maintenance.controller');
const systemController = require('./controllers/system.controller');
const usersController = require('./controllers/users.controller');

const app = express();

app.set('trust proxy', true);

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '20mb' }));
app.use('/dashboard-assets', express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.redirect('/dashboard/login');
});

app.get('/v1', (req, res) => {
  res.json({
    success: true,
    name: 'capi-log-api',
    status: 'ok',
    health: '/health',
    markets_endpoint: '/v1/markets',
    products_endpoint: '/v1/products',
    products_compare_endpoint: '/v1/analytics/products/compare?products=marketA:productA,marketB:productB',
    campaign_performance_endpoint: '/v1/analytics/campaign-performance?date_from=2026-05-01&date_to=2026-05-14&event_name=Purchase',
    events_breakdown_endpoint: '/v1/analytics/events-breakdown?market_key=vn&product_key=lengbear777',
    log_endpoint: '/v1/capi/logs',
    product_log_endpoint: '/v1/products/:product_key/capi/logs',
    market_product_log_endpoint: '/v1/markets/:market_key/products/:product_key/capi/logs',
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.post('/v1/auth/login', authController.login);
app.get('/v1/auth/me', auth, authController.me);
app.post('/v1/auth/bootstrap-admin', auth, auth.requireAdmin, authController.bootstrapAdmin);
app.get('/v1/admin/users', auth, auth.requireAdmin, usersController.listUsers);
app.post('/v1/admin/users', auth, auth.requireAdmin, usersController.createUser);
app.patch('/v1/admin/users/:id', auth, auth.requireAdmin, usersController.updateUser);
app.put('/v1/admin/users/:id/access', auth, auth.requireAdmin, usersController.updateUserAccess);
app.get('/v1/admin/system/status', auth, auth.requireAdmin, systemController.status);
app.get('/v1/analytics/overview', auth, analyticsController.overview);
app.get('/v1/analytics/reconciliation', auth, analyticsController.reconciliation);
app.get('/v1/analytics/campaign-performance', auth, analyticsController.getCampaignPerformance);
app.get('/v1/analytics/events-breakdown', auth, analyticsController.eventsBreakdown);
app.get('/v1/analytics/products/compare', auth, analyticsController.productsCompare);
app.get(
  '/v1/analytics/markets/:market_key/products/:product_key/compare',
  auth,
  analyticsController.productCompare
);
app.post(
  '/v1/admin/maintenance/aggregate-daily',
  auth,
  auth.requireAdmin,
  maintenanceController.aggregateDailyMetrics
);
app.post(
  '/v1/admin/maintenance/purge-raw-logs',
  auth,
  auth.requireAdmin,
  maintenanceController.purgeRawLogs
);
app.get('/v1/products', auth, capiLogsController.listProducts);
app.get('/v1/markets', auth, capiLogsController.listMarkets);
app.get('/v1/markets/:market_key/products', auth, capiLogsController.listProducts);
app.patch('/v1/admin/markets/:market_key', auth, auth.requireWrite, capiLogsController.updateMarket);
app.patch(
  '/v1/admin/markets/:market_key/products/:product_key',
  auth,
  auth.requireWrite,
  capiLogsController.updateProduct
);
app.use('/v1/capi/logs', capiLogsRoutes);
app.use('/v1/products/:product_key/capi/logs', capiLogsRoutes);
app.use('/v1/markets/:market_key/products/:product_key/capi/logs', capiLogsRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found.',
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(error.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : error.message || 'Internal server error.',
  });
});

const port = process.env.APP_PORT || 4005;

if (require.main === module) {
  authController.ensureDefaultAdmin()
    .catch((error) => {
      console.error('Default admin bootstrap skipped:', error);
    })
    .finally(() => {
      app.listen(port, () => {
        console.log(`CAPI Log API listening on port ${port}`);
      });
    });
}

module.exports = app;
