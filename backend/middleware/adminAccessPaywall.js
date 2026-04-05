const db = require('../models');

const PAYWALL_MESSAGE =
  'Account temporarily in limited mode. Please contact site owner to restore full access.';

/** Short TTL so toggling the flag takes effect quickly without hammering the DB. */
let cache = { expires: 0, enabled: false };

async function isAdminAccessPaywallEnabled() {
  if (Date.now() < cache.expires) {
    return cache.enabled;
  }
  try {
    const row = await db.Settings.findOne({ where: { key: 'adminAccessPaywall' } });
    const enabled = String(row?.value || '').toLowerCase() === 'true';
    cache = { enabled, expires: Date.now() + 15000 };
    return enabled;
  } catch (e) {
    console.warn('adminAccessPaywall: failed to read settings, defaulting to off:', e.message);
    return false;
  }
}

function clearAdminAccessPaywallCache() {
  cache.expires = 0;
}

function adminPaywallBody() {
  return {
    success: false,
    error: PAYWALL_MESSAGE,
    code: 'ADMIN_PAYWALL',
    message: PAYWALL_MESSAGE
  };
}

/**
 * After verifyAdmin. Blocks all non–super_super_admin admins when paywall setting is true.
 * Promise-based (no async) so Express 4 invokes next correctly.
 */
function enforceAdminAccessPaywall(req, res, next) {
  const role = req.admin?.role || req.admin?.user?.role;
  if (role === 'super_super_admin') {
    return next();
  }
  isAdminAccessPaywallEnabled()
    .then((enabled) => {
      if (!enabled) {
        return next();
      }
      return res.status(403).json(adminPaywallBody());
    })
    .catch((err) => {
      console.error('enforceAdminAccessPaywall error:', err);
      next(err);
    });
}

module.exports = {
  isAdminAccessPaywallEnabled,
  enforceAdminAccessPaywall,
  adminPaywallBody,
  clearAdminAccessPaywallCache,
  PAYWALL_MESSAGE
};
