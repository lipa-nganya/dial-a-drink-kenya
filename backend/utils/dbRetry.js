/**
 * Retry transient PostgreSQL / Sequelize connection failures.
 * No extra infrastructure cost — absorbs brief Cloud SQL / network blips.
 */

function isTransientDbError(err) {
  if (!err) return false;

  const name = err.name || '';
  const code = err.code || err.parent?.code || err.original?.code;
  const msg = String(err.message || '').toLowerCase();

  const transientNames = [
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError',
    'SequelizeConnectionAcquireTimeoutError',
    'SequelizeTimeoutError',
    'SequelizeHostNotFoundError'
  ];
  if (transientNames.includes(name)) return true;

  const transientCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'];
  if (transientCodes.includes(code)) return true;

  if (
    msg.includes('connection terminated') ||
    msg.includes('connection closed') ||
    msg.includes('the connection is closed') ||
    msg.includes('server closed the connection') ||
    msg.includes('socket hang up') ||
    msg.includes('connect econnrefused') ||
    msg.includes('read econnreset')
  ) {
    return true;
  }

  return false;
}

/**
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseDelayMs?: number }} [options]
 * @returns {Promise<T>}
 */
async function withDbRetry(fn, options = {}) {
  const maxAttempts = options.retries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 50;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientDbError(err) || attempt >= maxAttempts) {
        throw err;
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), 800);
      console.warn(
        `[dbRetry] transient DB error (attempt ${attempt}/${maxAttempts}): ${err.name || 'Error'} — ${err.message || ''}. Retrying in ${delay}ms…`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Wrap sequelize.query so most ORM operations retry once the pool has a good connection.
 * Only call for non-placeholder Sequelize instances.
 */
function installSequelizeQueryRetry(sequelize) {
  if (!sequelize || typeof sequelize.query !== 'function') return;
  if (sequelize.__dialadrinkQueryRetryInstalled) return;

  const originalQuery = sequelize.query.bind(sequelize);
  sequelize.query = async function queryWithRetry(...args) {
    return withDbRetry(() => originalQuery(...args), { retries: 4, baseDelayMs: 50 });
  };
  sequelize.__dialadrinkQueryRetryInstalled = true;
}

module.exports = {
  isTransientDbError,
  withDbRetry,
  installSequelizeQueryRetry
};
