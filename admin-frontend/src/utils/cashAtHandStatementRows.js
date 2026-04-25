import { cashAtHandDateSortMs } from './cashAtHandDateDisplay';

/** Net cash impact for statement math; matches displayed CRT − DBT when both are present. */
function netMoveFromEntry(entry, typeLower) {
  const isCashReceived = typeLower === 'cash_received';
  const hasD = entry.debitAmount != null && entry.debitAmount !== '';
  const hasC = entry.creditAmount != null && entry.creditAmount !== '';
  if (isCashReceived && hasD && hasC) {
    return (
      Number(entry.creditAmount != null ? entry.creditAmount : 0) -
      Number(entry.debitAmount != null ? entry.debitAmount : 0)
    );
  }
  return parseFloat(entry.amount || 0);
}

/**
 * Build rows for admin cash-at-hand statement (newest first, running balance).
 * Uses optional balanceAfterDisplay and debit/credit amounts from API (including display overrides).
 *
 * @param {object} [options]
 * @param {number|null|undefined} [options.openingBalance] — If set (and every entry has entryKey), balances are computed forward from this opening (before oldest transaction).
 * @param {boolean} [options.entriesAreComplete=true] — Set false when entries are paginated/partial (or otherwise incomplete), so balance math uses totalCashAtHand fallback.
 */
export function buildCashAtHandStatementRows(rawEntries, totalCashAtHand, normalizedSearch = '', options = {}) {
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) return [];

  const { openingBalance, entriesAreComplete = true } = options;

  const entryType = (entry) => {
    const t = entry.type ?? entry.transaction_type ?? entry.Type;
    return typeof t === 'string' ? t.toLowerCase() : t;
  };

  const sorted = [...rawEntries].sort((a, b) => cashAtHandDateSortMs(b.date) - cashAtHandDateSortMs(a.date));

  const filtered = normalizedSearch
    ? sorted.filter((entry) => {
        const haystack = [
          entry.date,
          entry.orderId,
          entry.order_id,
          entry.transactionId,
          entry.id,
          entry.entryKey,
          entry.description,
          entry.customerName,
          entry.receiptNumber,
          entryType(entry),
          entry.amount
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
  const useOpening =
    entriesAreComplete &&
    !normalizedSearch &&
    allHaveKeys &&
    Number.isFinite(openNum) &&
    openNum >= 0;

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
      const ob = (a.orderId || 0) - (b.orderId || 0);
      if (ob !== 0) return ob;
      return (a.transactionId || 0) - (b.transactionId || 0);
    });

    let running = openNum;
    for (const entry of oldestFirst) {
      const type = entryType(entry);
      const move = netMoveFromEntry(entry, type);
      const isCredit = type === 'cash_received';
      if (entry.balanceAfterDisplay != null && entry.balanceAfterDisplay !== '') {
        running = Number(entry.balanceAfterDisplay);
        balanceByKey.set(entry.entryKey, Math.round(running));
        continue;
      }
      if (isCredit) running += move;
      else running -= move;
      balanceByKey.set(entry.entryKey, Math.round(running));
    }
  }

  let balanceAfter = parseFloat(totalCashAtHand || 0);

  return filtered.map((entry) => {
    const type = entryType(entry);
    const isCredit = type === 'cash_received';
    const isCashReceived = type === 'cash_received';
    const amountNet = parseFloat(entry.amount || 0);

    let debitDisplay;
    let creditDisplay;
    if (isCashReceived) {
      const hasD = entry.debitAmount != null && entry.debitAmount !== '';
      const hasC = entry.creditAmount != null && entry.creditAmount !== '';
      if (hasD || hasC) {
        debitDisplay = hasD ? Math.round(Number(entry.debitAmount)) : '—';
        creditDisplay = hasC ? Math.round(Number(entry.creditAmount)) : '—';
      } else {
        debitDisplay = '—';
        creditDisplay = Math.round(amountNet);
      }
    } else {
      const hasDebitCol = entry.debitAmount != null && entry.debitAmount !== '';
      const hasCreditCol = entry.creditAmount != null && entry.creditAmount !== '';
      debitDisplay = hasDebitCol
        ? Math.round(Number(entry.debitAmount))
        : !isCredit
          ? Math.round(amountNet)
          : '—';
      creditDisplay = hasCreditCol
        ? Math.round(Number(entry.creditAmount))
        : isCredit
          ? Math.round(amountNet)
          : '—';
    }

    const balance =
      entry.balanceAfterDisplay != null && entry.balanceAfterDisplay !== ''
        ? Math.round(Number(entry.balanceAfterDisplay))
        : useOpening && balanceByKey && entry.entryKey && balanceByKey.has(entry.entryKey)
        ? balanceByKey.get(entry.entryKey)
        : Math.round(balanceAfter);

    const move = netMoveFromEntry(entry, type);
    if (!useOpening) {
      if (entry.balanceAfterDisplay == null || entry.balanceAfterDisplay === '') {
        if (isCredit) {
          balanceAfter -= move;
        } else {
          balanceAfter += move;
        }
      } else {
        balanceAfter = Number(entry.balanceAfterDisplay);
      }
    }

    return {
      entry,
      type,
      isCredit,
      amount: move,
      debitDisplay,
      creditDisplay,
      balance
    };
  });
}
