const SANE_YEAR_MIN = 1990;
const SANE_YEAR_MAX = 2100;

export function isPlausibleCashAtHandDate(value) {
  if (value == null || value === '') return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= SANE_YEAR_MIN && y <= SANE_YEAR_MAX;
}

export function formatCashAtHandDateTime(value, locale, options) {
  if (!isPlausibleCashAtHandDate(value)) return '—';
  return new Date(value).toLocaleString(locale, options);
}

export function formatCashAtHandDateOnly(value, locale, options) {
  if (!isPlausibleCashAtHandDate(value)) return '—';
  return new Date(value).toLocaleDateString(locale, options);
}

/** Newest-first sort key; implausible dates sort to the end (0). */
export function cashAtHandDateSortMs(value) {
  if (!isPlausibleCashAtHandDate(value)) return 0;
  return new Date(value).getTime();
}
