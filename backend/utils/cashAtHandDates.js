/**
 * Pick a display/sort timestamp for cash-at-hand log rows.
 * Prefer earlier candidates when the calendar year is plausible (1990–2100).
 * Skips bad values from M-Pesa/import bugs (e.g. year 2612) so they do not
 * reorder the statement ahead of real rows.
 *
 * Always pass fallbacks in order, e.g. `pickCashAtHandLogDate(tx.transactionDate, tx.createdAt)`.
 */
function pickCashAtHandLogDate(...candidates) {
  const minYear = 1990;
  const maxYear = 2100;

  const isSane = (d) => {
    if (Number.isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= minYear && y <= maxYear;
  };

  for (const c of candidates) {
    if (c == null) continue;
    const d = c instanceof Date ? new Date(c.getTime()) : new Date(c);
    if (isSane(d)) return d;
  }

  // No candidate in a plausible year (e.g. only bad transactionDate). Use epoch so sort stays stable
  // and admin UI can treat the row as implausible (see cashAtHandDateDisplay.js).
  return new Date(0);
}

module.exports = { pickCashAtHandLogDate };
