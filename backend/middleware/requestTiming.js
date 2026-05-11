/**
 * One JSON line per request (or slow-only) for Cloud Logging queries.
 *
 * Logs Explorer examples (production backend):
 *   jsonPayload.requestTiming=true
 *   jsonPayload.requestTiming=true AND jsonPayload.ms>500
 *
 * Env:
 *   REQUEST_TIMING_MODE=off|slow|all   (default: production=slow, else off)
 *   REQUEST_TIMING_SLOW_MS=250         (only when mode=slow)
 *   REQUEST_TIMING_SKIP_PREFIX=/api/health  (comma-separated path prefixes to skip; exact / only if listed alone)
 */
function parseSkipPrefixes() {
  const raw = process.env.REQUEST_TIMING_SKIP_PREFIX || '/api/health';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = function requestTimingMiddleware() {
  const defaultMode = process.env.NODE_ENV === 'production' ? 'slow' : 'off';
  const mode = String(process.env.REQUEST_TIMING_MODE || defaultMode).toLowerCase();
  if (mode === 'off') {
    return (req, res, next) => next();
  }
  const slowMs = Math.max(0, parseInt(process.env.REQUEST_TIMING_SLOW_MS || '250', 10) || 250);
  const skipPrefixes = parseSkipPrefixes();

  return (req, res, next) => {
    const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
    const shouldSkip = skipPrefixes.some((p) => {
      if (p === '/') return pathOnly === '/';
      return pathOnly === p || pathOnly.startsWith(`${p}/`) || pathOnly.startsWith(p);
    });
    if (shouldSkip) return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durNs = process.hrtime.bigint() - start;
      const ms = Number(durNs) / 1e6;
      if (mode === 'slow' && ms < slowMs) return;

      const payload = {
        requestTiming: true,
        method: req.method,
        path: pathOnly,
        ms: Math.round(ms * 10) / 10,
        status: res.statusCode
      };
      console.log(JSON.stringify(payload));
    });
    next();
  };
};
