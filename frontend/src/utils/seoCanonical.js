/**
 * Canonical URL helpers for Google Search (duplicate / user-selected canonical).
 * Production customer site always uses https://dialadrinkkenya.com (apex, no www).
 */

const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAM_KEYS = new Set([
  'gclid',
  'fbclid',
  'msclkid',
  '_ga',
  'mc_cid',
  'mc_eid'
]);

/**
 * Canonical origin for SEO. On production domains, force apex dialadrinkkenya.com
 * so www and non-www consolidate to one URL.
 */
export function getCanonicalSiteOrigin() {
  if (typeof window === 'undefined') {
    return process.env.REACT_APP_CANONICAL_ORIGIN || 'https://dialadrinkkenya.com';
  }

  const explicit = process.env.REACT_APP_CANONICAL_ORIGIN;
  if (explicit && explicit.startsWith('http')) {
    return explicit.replace(/\/$/, '');
  }

  const { hostname, protocol, host } = window.location;

  if (hostname === 'www.dialadrinkkenya.com' || hostname === 'dialadrinkkenya.com') {
    return 'https://dialadrinkkenya.com';
  }

  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname);

  if (isLocal) {
    return `${protocol}//${host}`;
  }

  return `${protocol}//${host}`;
}

/**
 * Strip marketing/tracking params so ?utm_*=… does not create duplicate URLs.
 */
export function stripTrackingSearchParams(search) {
  if (!search || search === '?') return '';
  const q = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  for (const key of [...params.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAM_KEYS.has(lower)) {
      params.delete(key);
      continue;
    }
    if (TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))) {
      params.delete(key);
    }
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}

/**
 * Normalize pathname: no trailing slash except root.
 */
export function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.replace(/\/+$/, '') || '/' : pathname;
}

/**
 * Full canonical URL for current route (used site-wide).
 */
export function buildCanonicalUrl(pathname, search = '') {
  const origin = getCanonicalSiteOrigin();
  const path = normalizePathname(pathname);
  const query = typeof search === 'string' ? stripTrackingSearchParams(search) : '';
  return `${origin}${path === '/' ? '/' : path}${query}`;
}

/**
 * Product detail canonical (prefer slug URL over /product/:id when data is available).
 */
export function buildProductCanonicalUrl(product) {
  const origin = getCanonicalSiteOrigin();
  if (!product) return `${origin}/`;
  if (product.slug && product.category?.slug) {
    return `${origin}/${product.category.slug}/${product.slug}`;
  }
  if (product.slug) {
    return `${origin}/product/${product.slug}`;
  }
  return `${origin}/product/${product.id}`;
}

/**
 * Ensure a single <link rel="canonical"> in document head.
 */
export function ensureCanonicalLink(href) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function removeCanonicalLink() {
  if (typeof document === 'undefined') return;
  const link = document.querySelector('link[rel="canonical"]');
  if (link) link.remove();
}
