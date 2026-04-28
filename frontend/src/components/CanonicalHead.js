import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildCanonicalUrl,
  ensureCanonicalLink,
  removeCanonicalLink
} from '../utils/seoCanonical';
import { toBrandSlug } from '../utils/brandSlug';

/**
 * Sets <link rel="canonical"> on every navigation so Google gets a user-selected
 * canonical for all pages (not only product detail). Skips admin and debug.
 */
export default function CanonicalHead() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname === '/debug') {
      removeCanonicalLink();
      return;
    }

    // Product routes: ProductPage may override with slug-based URL after load.
    // Still set pathname-based canonical immediately for crawlers (www→apex normalized).
    let href = buildCanonicalUrl(pathname, search);

    // Legacy/query pages:
    // /products?brand=<x>&sort=<y> was used by the old site. For SEO,
    // canonical should point at the stable brand listing URL, not a query URL.
    if (pathname === '/products') {
      const params = new URLSearchParams(search || '');
      const brand = params.get('brand');
      if (brand) {
        href = buildCanonicalUrl(`/brands/${toBrandSlug(brand)}`);
      } else {
        href = buildCanonicalUrl('/menu');
      }
    }

    ensureCanonicalLink(href);
  }, [pathname, search]);

  return null;
}
