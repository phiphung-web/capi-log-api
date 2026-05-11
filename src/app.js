require('dotenv').config();

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const capiLogsRoutes = require('./routes/capiLogs.routes');

const app = express();

app.set('trust proxy', true);

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'capi-log-api',
    status: 'ok',
    health: '/health',
    log_endpoint: '/v1/capi/logs',
    product_log_endpoint: '/v1/products/:product_key/capi/logs',
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

app.use('/v1/capi/logs', capiLogsRoutes);
app.use('/v1/products/:product_key/capi/logs', capiLogsRoutes);

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
  app.listen(port, () => {
    console.log(`CAPI Log API listening on port ${port}`);
  });
}

module.exports = app;
