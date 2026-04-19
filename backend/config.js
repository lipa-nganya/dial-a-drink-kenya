const shouldUseSsl = (() => {
  if (process.env.DB_REQUIRE_SSL) {
    return process.env.DB_REQUIRE_SSL !== 'false';
  }
  const databaseUrl = process.env.DATABASE_URL || '';
  return !databaseUrl.includes('/cloudsql/');
})();

/** Admin dashboards run heavy queries; default 5s was aborting large ORDER BY + JOINs. */
const dbStatementTimeoutMs = (() => {
  const raw = process.env.DB_STATEMENT_TIMEOUT_MS;
  if (raw !== undefined && raw !== '') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 60000;
  }
  return 60000;
})();

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'dialadrink',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres'
  },
  'cloud-dev': {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: shouldUseSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : {},
    logging: console.log // Enable logging for cloud-dev debugging
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: (() => {
      const databaseUrl = process.env.DATABASE_URL || '';
      const isCloudSql = databaseUrl.includes('/cloudsql/');
      
      // For Cloud SQL Unix socket connections, don't use SSL
      if (isCloudSql) {
        return {
          connectTimeout: 10000, // 10 second connection timeout
          statement_timeout: dbStatementTimeoutMs,
          query_timeout: dbStatementTimeoutMs
        };
      }
      
      // For external connections, use SSL if required
      return shouldUseSsl
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            },
            connectTimeout: 10000,
            statement_timeout: dbStatementTimeoutMs,
            query_timeout: dbStatementTimeoutMs
          }
        : {
            connectTimeout: 10000,
            statement_timeout: dbStatementTimeoutMs,
            query_timeout: dbStatementTimeoutMs
          };
    })(),
    pool: {
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 5, // Optimized for smaller instances (db-f1-micro)
      min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 1, // Reduced minimum for cost optimization
      acquire: 10000, // Maximum time (ms) to wait for a connection
      idle: 10000, // Maximum time (ms) a connection can be idle
      evict: 1000 // Time interval (ms) to check for idle connections
    },
    logging: false // Disable SQL logging in production
  }
};

