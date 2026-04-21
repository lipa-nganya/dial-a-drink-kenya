/**
 * Keep in sync with backend/utils/slugCanonical.js
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
