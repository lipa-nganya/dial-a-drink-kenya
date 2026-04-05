/** 5 minutes — keep in sync with AdminAccessPaywallScreen / backend expectations. */
export const ADMIN_PAYWALL_COOLDOWN_MS = 5 * 60 * 1000;

export const ADMIN_PAYWALL_SESSION_KEYS = {
  login: 'dialadrink_admin_paywall_login',
  setupPassword: 'dialadrink_admin_paywall_setup',
};

function parseSession(raw) {
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.unlockAt === 'number' && !Number.isNaN(o.unlockAt)) {
      return { unlockAt: o.unlockAt };
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

export function readPaywallSession(storageKey) {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  return parseSession(raw);
}

export function writePaywallSession(storageKey, unlockAtMs) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(storageKey, JSON.stringify({ unlockAt: unlockAtMs }));
}

export function clearPaywallSession(storageKey) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(storageKey);
}

export function hasPaywallSession(storageKey) {
  return readPaywallSession(storageKey) != null;
}

/** Start or reset cooldown; persists so refresh cannot skip the wait. */
export function startPaywallCooldownSession(storageKey) {
  const unlockAt = Date.now() + ADMIN_PAYWALL_COOLDOWN_MS;
  writePaywallSession(storageKey, unlockAt);
  return unlockAt;
}
