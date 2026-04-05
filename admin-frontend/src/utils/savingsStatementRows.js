import { cashAtHandDateSortMs } from './cashAtHandDateDisplay';

/**
 * Build rows for admin savings statement (newest first, running balance).
 *
 * Entries must have:
 * - amount (signed number: +credit, -debit)
 * - date
 * - entryKey (for opening-balance mode)
 *
 * @param {Array} rawEntries
 * @param {number} currentSavings
 * @param {string} normalizedSearch
 * @param {object} options
 * @param {number|null|undefined} options.openingBalance
 */
export function buildSavingsStatementRows(rawEntries, currentSavings, normalizedSearch = '', options = {}) {
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) return [];

  const { openingBalance } = options;
  const sorted = [...rawEntries].sort((a, b) => cashAtHandDateSortMs(b.date) - cashAtHandDateSortMs(a.date));

  const filtered = normalizedSearch
    ? sorted.filter((row) => {
        const haystack = [
          row.date,
          row.orderId,
          row.orderNumber,
          row.entryKey,
          row.notes,
          row.paymentProvider,
          row.transactionType,
          row.amount
        ]
          .filter((v) => v !== null && v !== undefined)
          .join(' ')
          .toString()
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : sorted;

  const openNum = openingBalance != null && openingBalance !== '' ? parseFloat(openingBalance) : NaN;
  const allHaveKeys = filtered.length > 0 && filtered.every((e) => e.entryKey);
  // Only use forward opening-balance mode for a strictly positive opening. Treat 0 as "auto"
  // (backward from current savings) so the running column matches wallet.savings.
  const useOpening = allHaveKeys && Number.isFinite(openNum) && openNum > 0;

  let balanceByKey = null;
  if (useOpening) {
    balanceByKey = new Map();
    const oldestFirst = [...filtered].sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      const safeA = Number.isNaN(ta) ? 0 : ta;
      const safeB = Number.isNaN(tb) ? 0 : tb;
      const tdiff = safeA - safeB;
      if (tdiff !== 0) return tdiff;
      return String(a.entryKey).localeCompare(String(b.entryKey));
    });
    let running = openNum;
    for (const row of oldestFirst) {
      if (row.balanceAfterDisplay != null && row.balanceAfterDisplay !== '') {
        running = Number(row.balanceAfterDisplay);
        balanceByKey.set(row.entryKey, Math.round(running));
        continue;
      }
      const move = parseFloat(row.amount || 0) || 0;
      running += move;
      balanceByKey.set(row.entryKey, Math.round(running));
    }
  }

  let balanceAfter = parseFloat(currentSavings || 0);

  return filtered.map((row) => {
    const amt = parseFloat(row.amount || 0) || 0;
    const debit = amt < 0 ? Math.abs(amt) : 0;
    const credit = amt > 0 ? amt : 0;

    let balance;
    if (useOpening) {
      balance =
        row.balanceAfterDisplay != null && row.balanceAfterDisplay !== ''
          ? Math.round(Number(row.balanceAfterDisplay))
          : balanceByKey && row.entryKey && balanceByKey.has(row.entryKey)
          ? balanceByKey.get(row.entryKey)
          : Math.round(balanceAfter);
    } else {
      // Reconcile from current wallet balance; ignore stale balanceAfterDisplay on rows.
      balance = Math.round(balanceAfter);
      balanceAfter -= amt;
    }

    return {
      row,
      amount: amt,
      debitDisplay: debit ? Math.round(debit) : '—',
      creditDisplay: credit ? Math.round(credit) : '—',
      balance
    };
  });
}

