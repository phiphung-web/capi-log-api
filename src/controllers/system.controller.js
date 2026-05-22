const os = require('os');
const pool = require('../db/pool');

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bytesToPayload(memoryUsage) {
  return Object.fromEntries(
    Object.entries(memoryUsage).map(([key, value]) => [key, numberOrNull(value)])
  );
}

function poolStats() {
  return {
    max: numberOrNull(pool.options?.max),
    total: numberOrNull(pool.totalCount),
    idle: numberOrNull(pool.idleCount),
    waiting: numberOrNull(pool.waitingCount),
  };
}

async function status(req, res) {
  const uptimeSeconds = Math.round(process.uptime());
  const server = {
    status: 'ok',
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu_count: os.cpus().length,
    load_average: os.loadavg().map((value) => Number(value.toFixed(2))),
    total_memory_bytes: numberOrNull(os.totalmem()),
    free_memory_bytes: numberOrNull(os.freemem()),
    process_memory_bytes: bytesToPayload(process.memoryUsage()),
    node_version: process.version,
    node_env: process.env.NODE_ENV || 'development',
    pid: process.pid,
    uptime_seconds: uptimeSeconds,
    started_at: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  };

  const database = {
    status: 'unknown',
    host: process.env.DB_HOST || 'localhost',
    port: numberOrNull(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || null,
    pool: poolStats(),
  };

  const started = process.hrtime.bigint();

  try {
    const { rows } = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port,
        current_setting('server_version') AS server_version,
        pg_database_size(current_database())::bigint AS database_size_bytes,
        (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') AS max_connections,
        (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datname = current_database()) AS total_connections,
        (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active_connections,
        (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') AS idle_connections,
        stats.xact_commit::bigint AS xact_commit,
        stats.xact_rollback::bigint AS xact_rollback,
        stats.blks_read::bigint AS blocks_read,
        stats.blks_hit::bigint AS blocks_hit,
        stats.tup_inserted::bigint AS rows_inserted,
        stats.tup_updated::bigint AS rows_updated,
        stats.tup_deleted::bigint AS rows_deleted,
        stats.deadlocks::bigint AS deadlocks
      FROM pg_stat_database stats
      WHERE stats.datname = current_database()
      LIMIT 1
    `);

    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const row = rows[0] || {};

    Object.assign(database, {
      status: 'ok',
      name: row.database_name || database.name,
      user: row.database_user || null,
      server_addr: row.server_addr || null,
      server_port: numberOrNull(row.server_port),
      server_version: row.server_version || null,
      size_bytes: numberOrNull(row.database_size_bytes),
      max_connections: numberOrNull(row.max_connections),
      total_connections: numberOrNull(row.total_connections),
      active_connections: numberOrNull(row.active_connections),
      idle_connections: numberOrNull(row.idle_connections),
      response_ms: Number(elapsedMs.toFixed(1)),
      pool: poolStats(),
      stats: {
        commits: numberOrNull(row.xact_commit),
        rollbacks: numberOrNull(row.xact_rollback),
        blocks_read: numberOrNull(row.blocks_read),
        blocks_hit: numberOrNull(row.blocks_hit),
        rows_inserted: numberOrNull(row.rows_inserted),
        rows_updated: numberOrNull(row.rows_updated),
        rows_deleted: numberOrNull(row.rows_deleted),
        deadlocks: numberOrNull(row.deadlocks),
      },
    });
  } catch (error) {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    Object.assign(database, {
      status: 'error',
      response_ms: Number(elapsedMs.toFixed(1)),
      error: error.message,
      pool: poolStats(),
    });
  }

  return res.json({
    success: true,
    data: {
      server,
      database,
      checked_at: new Date().toISOString(),
    },
  });
}

module.exports = {
  status,
};
