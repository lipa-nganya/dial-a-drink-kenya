const parseBool = (value, defaultValue) => {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const parseIntSafe = (value, defaultValue, min = 0) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.max(min, n);
};

export const ADMIN_PERF_FLAGS = {
  // Backup polling for badges/counts in AdminContext.
  pollingEnabled: parseBool(process.env.REACT_APP_ADMIN_POLLING_ENABLED, true),
  pollingIntervalMs: parseIntSafe(process.env.REACT_APP_ADMIN_POLL_INTERVAL_MS, 30000, 5000),

  // Controls heavy dashboard sections (latest orders/transactions/top inventory + full completed orders scan).
  overviewHeavyDataEnabled: parseBool(process.env.REACT_APP_ADMIN_OVERVIEW_HEAVY_DATA, false),
  overviewCacheMs: parseIntSafe(process.env.REACT_APP_ADMIN_OVERVIEW_CACHE_MS, 60000, 10000)
};

