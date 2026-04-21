/**
 * Single canonical rule for URL slugs (customer site + API).
 * Matches frontend Menu toSlug behavior, with explicit hyphen collapsing.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { normalizeSlug };
