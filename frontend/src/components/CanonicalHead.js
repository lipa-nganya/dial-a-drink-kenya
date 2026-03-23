import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildCanonicalUrl,
  ensureCanonicalLink,
  removeCanonicalLink
} from '../utils/seoCanonical';

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
    const href = buildCanonicalUrl(pathname, search);
    ensureCanonicalLink(href);
  }, [pathname, search]);

  return null;
}
