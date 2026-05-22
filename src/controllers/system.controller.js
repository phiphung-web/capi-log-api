const os = require('os');
const pool = require('../db/pool');

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(part, total) {
  const left = numberOrNull(part) || 0;
  const right = numberOrNull(total) || 0;
  if (!right) return 0;
  return (left / right) * 100;
}

function rounded(value, digits = 1) {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return Number(parsed.toFixed(digits));
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

function issue(level, title, detail) {
  return { level, title, detail };
}

function addThresholdIssue(issues, value, warnAt, errorAt, title, detail) {
  const parsed = numberOrNull(value);
  if (parsed === null) return;
  if (parsed >= errorAt) issues.push(issue('error', title, detail(parsed)));
  else if (parsed >= warnAt) issues.push(issue('warning', title, detail(parsed)));
}

function buildSummary({ server, database, activity }) {
  const issues = [];
  const memoryUsedPercent = server.memory_used_percent || 0;
  const loadPerCpu = server.load_1m_per_cpu || 0;
  const connectionPercent = database.connection_percent || 0;
  const poolUsedPercent = database.pool?.used_percent || 0;
  const cacheHitPercent = database.stats?.cache_hit_percent;
  const rollbackPercent = database.stats?.rollback_percent;
  const errorRate24h = activity.logs?.error_rate_24h || 0;
  const latestAgeSeconds = activity.logs?.latest_age_seconds;

  if (database.status !== 'ok') {
    issues.push(issue('error', 'Database không sẵn sàng', database.error || 'Không kết nối được PostgreSQL.'));
  }

  addThresholdIssue(issues, memoryUsedPercent, 80, 92, 'RAM server cao', (value) => `Đang dùng ${rounded(value)}% RAM.`);
  addThresholdIssue(issues, loadPerCpu, 1.2, 2, 'CPU load cao', (value) => `Load 1 phút/CPU là ${rounded(value, 2)}.`);
  addThresholdIssue(issues, connectionPercent, 75, 90, 'Kết nối database cao', (value) => `Đang dùng ${rounded(value)}% max_connections.`);
  addThresholdIssue(issues, poolUsedPercent, 80, 95, 'Pool database gần đầy', (value) => `Pool đang dùng ${rounded(value)}%.`);

  if ((database.pool?.waiting || 0) > 0) {
    issues.push(issue('warning', 'Có request chờ DB pool', `${database.pool.waiting} request đang chờ connection.`));
  }

  if (numberOrNull(database.response_ms) !== null && database.response_ms > 1000) {
    issues.push(issue('error', 'Database phản hồi chậm', `Ping DB mất ${database.response_ms} ms.`));
  } else if (numberOrNull(database.response_ms) !== null && database.response_ms > 250) {
    issues.push(issue('warning', 'Database có độ trễ', `Ping DB mất ${database.response_ms} ms.`));
  }

  if (numberOrNull(cacheHitPercent) !== null && database.stats.total_blocks > 1000 && cacheHitPercent < 90) {
    issues.push(issue(cacheHitPercent < 80 ? 'error' : 'warning', 'DB cache hit thấp', `Cache hit hiện ${rounded(cacheHitPercent)}%.`));
  }

  if (numberOrNull(rollbackPercent) !== null && database.stats.total_transactions > 100 && rollbackPercent > 5) {
    issues.push(issue(rollbackPercent > 15 ? 'error' : 'warning', 'Rollback database cao', `Rollback chiếm ${rounded(rollbackPercent)}% transaction.`));
  }

  if (activity.logs?.events_24h > 0) {
    addThresholdIssue(issues, errorRate24h, 5, 15, 'Tỷ lệ log lỗi 24h cao', (value) => `Meta/API lỗi ${rounded(value)}% trong 24h.`);
  } else if ((activity.catalog?.active_products || 0) > 0) {
    issues.push(issue('warning', 'Không có log 24h', 'Có sản phẩm active nhưng 24h gần nhất chưa nhận log.'));
  }

  if (numberOrNull(latestAgeSeconds) !== null && latestAgeSeconds > 3600 && (activity.logs?.events_24h || 0) > 0) {
    issues.push(issue('warning', 'Log mới nhất đã cũ', `Log gần nhất cách ${Math.round(latestAgeSeconds / 60)} phút.`));
  }

  const hasError = issues.some((item) => item.level === 'error');
  const hasWarning = issues.some((item) => item.level === 'warning');
  const score = Math.max(
    0,
    100 - issues.reduce((sum, item) => sum + (item.level === 'error' ? 25 : 10), 0)
  );

  return {
    status: hasError ? 'error' : hasWarning ? 'warning' : 'healthy',
    label: hasError ? 'Cần xử lý' : hasWarning ? 'Cần theo dõi' : 'Ổn định',
    score,
    issues,
  };
}

async function status(req, res) {
  const uptimeSeconds = Math.round(process.uptime());
  const totalMemory = numberOrNull(os.totalmem());
  const freeMemory = numberOrNull(os.freemem());
  const usedMemory = totalMemory !== null && freeMemory !== null ? totalMemory - freeMemory : null;
  const loadAverage = os.loadavg().map((value) => rounded(value, 2));
  const cpuCount = os.cpus().length;
  const processMemory = process.memoryUsage();
  const server = {
    status: 'ok',
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu_count: cpuCount,
    load_average: loadAverage,
    load_1m_per_cpu: rounded((loadAverage[0] || 0) / Math.max(cpuCount, 1), 2),
    total_memory_bytes: totalMemory,
    free_memory_bytes: freeMemory,
    used_memory_bytes: usedMemory,
    memory_used_percent: rounded(pct(usedMemory, totalMemory), 1),
    process_memory_bytes: bytesToPayload(processMemory),
    process_heap_used_percent: rounded(pct(processMemory.heapUsed, processMemory.heapTotal), 1),
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

  const activity = {
    logs: {},
    catalog: {},
    users: {},
  };
  const started = process.hrtime.bigint();

  try {
    const { rows } = await pool.query(`
      WITH db_stats AS (
        SELECT *
        FROM pg_stat_database
        WHERE datname = current_database()
        LIMIT 1
      ),
      recent_logs AS (
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '5 minutes')::integer AS events_5m,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::integer AS events_1h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::integer AS events_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND meta_status = 'received')::integer AS received_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND meta_status = 'error')::integer AS errors_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND (meta_status IS NULL OR meta_status = 'unknown'))::integer AS unknown_24h,
          MAX(created_at) AS latest_log_at
        FROM capi_event_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port,
        current_setting('server_version') AS server_version,
        pg_database_size(current_database())::bigint AS database_size_bytes,
        pg_total_relation_size('capi_event_logs'::regclass)::bigint AS log_table_size_bytes,
        (SELECT COALESCE(reltuples, 0)::bigint FROM pg_class WHERE oid = 'capi_event_logs'::regclass) AS estimated_log_rows,
        (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') AS max_connections,
        (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datname = current_database()) AS total_connections,
        (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active_connections,
        (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') AS idle_connections,
        db.xact_commit::bigint AS xact_commit,
        db.xact_rollback::bigint AS xact_rollback,
        db.blks_read::bigint AS blocks_read,
        db.blks_hit::bigint AS blocks_hit,
        db.tup_inserted::bigint AS rows_inserted,
        db.tup_updated::bigint AS rows_updated,
        db.tup_deleted::bigint AS rows_deleted,
        db.deadlocks::bigint AS deadlocks,
        logs.events_5m,
        logs.events_1h,
        logs.events_24h,
        logs.received_24h,
        logs.errors_24h,
        logs.unknown_24h,
        logs.latest_log_at,
        EXTRACT(EPOCH FROM NOW() - logs.latest_log_at)::integer AS latest_age_seconds,
        (SELECT COUNT(*)::integer FROM capi_markets) AS total_markets,
        (SELECT COUNT(*)::integer FROM capi_markets WHERE status = 'active') AS active_markets,
        (SELECT COUNT(*)::integer FROM capi_products) AS total_products,
        (SELECT COUNT(*)::integer FROM capi_products WHERE status = 'active') AS active_products,
        (SELECT COUNT(*)::integer FROM capi_users) AS total_users,
        (SELECT COUNT(*)::integer FROM capi_users WHERE status = 'active') AS active_users
      FROM db_stats db
      CROSS JOIN recent_logs logs
    `);

    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const row = rows[0] || {};
    const totalBlocks = (numberOrNull(row.blocks_read) || 0) + (numberOrNull(row.blocks_hit) || 0);
    const totalTransactions = (numberOrNull(row.xact_commit) || 0) + (numberOrNull(row.xact_rollback) || 0);
    const dbPoolMetrics = poolStats();
    const poolUsed = Math.max(0, (dbPoolMetrics.total || 0) - (dbPoolMetrics.idle || 0));

    Object.assign(database, {
      status: 'ok',
      name: row.database_name || database.name,
      user: row.database_user || null,
      server_addr: row.server_addr || null,
      server_port: numberOrNull(row.server_port),
      server_version: row.server_version || null,
      size_bytes: numberOrNull(row.database_size_bytes),
      log_table_size_bytes: numberOrNull(row.log_table_size_bytes),
      estimated_log_rows: numberOrNull(row.estimated_log_rows),
      max_connections: numberOrNull(row.max_connections),
      total_connections: numberOrNull(row.total_connections),
      active_connections: numberOrNull(row.active_connections),
      idle_connections: numberOrNull(row.idle_connections),
      connection_percent: rounded(pct(row.total_connections, row.max_connections), 1),
      response_ms: Number(elapsedMs.toFixed(1)),
      pool: {
        ...dbPoolMetrics,
        used: poolUsed,
        used_percent: rounded(pct(poolUsed, dbPoolMetrics.max), 1),
      },
      stats: {
        commits: numberOrNull(row.xact_commit),
        rollbacks: numberOrNull(row.xact_rollback),
        total_transactions: totalTransactions,
        rollback_percent: rounded(pct(row.xact_rollback, totalTransactions), 2),
        blocks_read: numberOrNull(row.blocks_read),
        blocks_hit: numberOrNull(row.blocks_hit),
        total_blocks: totalBlocks,
        cache_hit_percent: rounded(pct(row.blocks_hit, totalBlocks), 2),
        rows_inserted: numberOrNull(row.rows_inserted),
        rows_updated: numberOrNull(row.rows_updated),
        rows_deleted: numberOrNull(row.rows_deleted),
        deadlocks: numberOrNull(row.deadlocks),
      },
    });

    Object.assign(activity.logs, {
      events_5m: numberOrNull(row.events_5m),
      events_1h: numberOrNull(row.events_1h),
      events_24h: numberOrNull(row.events_24h),
      received_24h: numberOrNull(row.received_24h),
      errors_24h: numberOrNull(row.errors_24h),
      unknown_24h: numberOrNull(row.unknown_24h),
      error_rate_24h: rounded(pct(row.errors_24h, row.events_24h), 1),
      latest_log_at: row.latest_log_at || null,
      latest_age_seconds: numberOrNull(row.latest_age_seconds),
    });

    Object.assign(activity.catalog, {
      total_markets: numberOrNull(row.total_markets),
      active_markets: numberOrNull(row.active_markets),
      total_products: numberOrNull(row.total_products),
      active_products: numberOrNull(row.active_products),
    });

    Object.assign(activity.users, {
      total_users: numberOrNull(row.total_users),
      active_users: numberOrNull(row.active_users),
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

  const summary = buildSummary({ server, database, activity });

  return res.json({
    success: true,
    data: {
      summary,
      server,
      database,
      activity,
      checked_at: new Date().toISOString(),
    },
  });
}

module.exports = {
  status,
};
