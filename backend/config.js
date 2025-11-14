const shouldUseSsl = (() => {
  if (process.env.DB_REQUIRE_SSL) {
    return process.env.DB_REQUIRE_SSL !== 'false';
  }
  const databaseUrl = process.env.DATABASE_URL || '';
  return !databaseUrl.includes('/cloudsql/');
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
    dialectOptions: shouldUseSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : {},
    logging: false // Disable SQL logging in production
  }
};

