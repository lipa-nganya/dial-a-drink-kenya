/**
 * Standalone admin app URL (admin-frontend), separate from this customer SPA.
 *
 * - Dev (Netlify): customer dialadrink.thewolfgang.tech → admin dialadrink-admin.thewolfgang.tech
 * - Local: localhost:3000 → localhost:3001
 * - Prod: override with REACT_APP_ADMIN_SITE_URL (Docker / Netlify env)
 *
 * @returns {string} Origin only, no trailing slash
 */
export function getAdminSiteOrigin() {
  const explicit = process.env.REACT_APP_ADMIN_SITE_URL;
  if (explicit && typeof explicit === 'string') {
    return explicit.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return 'https://dialadrink-admin.thewolfgang.tech';
  }

  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  if (host === 'dialadrink.thewolfgang.tech') {
    return 'https://dialadrink-admin.thewolfgang.tech';
  }

  if (
    host.includes('dialadrinkkenya.com') ||
    host.includes('ruakadrinksdelivery.co.ke') ||
    host.includes('drinksdeliverykenya.com')
  ) {
    return 'https://dialadrink-admin.thewolfgang.tech';
  }

  if (host.includes('netlify.app') || host.includes('run.app')) {
    return 'https://dialadrink-admin.thewolfgang.tech';
  }

  return 'https://dialadrink-admin.thewolfgang.tech';
}

/**
 * Maps old embedded customer-app paths (/admin/…) to admin-frontend routes (no /admin prefix).
 */
export function mapEmbeddedAdminPathToStandalone(pathname, search = '', hash = '') {
  const raw = pathname || '/';
  const p =
    raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;

  let targetPath;
  if (p === '/admin' || p === '') {
    targetPath = '/orders';
  } else if (p === '/admin/login') {
    targetPath = '/login';
  } else if (p === '/admin/notifications') {
    targetPath = '/admin/notifications';
  } else if (p.startsWith('/admin/')) {
    targetPath = p.slice('/admin'.length) || '/orders';
  } else {
    targetPath = '/orders';
  }

  return `${targetPath}${search}${hash}`;
}
