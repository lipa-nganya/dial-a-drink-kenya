const entryType = (entry) => {
  const t = entry.type ?? entry.transaction_type ?? entry.Type;
  return typeof t === 'string' ? t.toLowerCase() : t;
};

/**
 * Default strings for debit/credit inputs (matches buildCashAtHandStatementRows display rules).
 */
export function getDefaultDebitCreditStrings(entry) {
  const type = entryType(entry);
  const isCredit = type === 'cash_received';
  const amountNet = parseFloat(entry.amount || 0);

  if (isCredit) {
    const hasD = entry.debitAmount != null && entry.debitAmount !== '';
    const hasC = entry.creditAmount != null && entry.creditAmount !== '';
    if (hasD || hasC) {
      return {
        debit: hasD ? String(Math.round(Number(entry.debitAmount))) : '',
        credit: hasC ? String(Math.round(Number(entry.creditAmount))) : ''
      };
    }
    return { debit: '', credit: String(Math.round(amountNet)) };
  }
  return {
    debit: !isCredit ? String(Math.round(amountNet)) : '',
    credit: isCredit ? String(Math.round(amountNet)) : ''
  };
}

/**
 * Merge inline draft strings into a copy of entry and recompute amount (same rules as API GET merge).
 * partialDraft may only set debit or credit.
 */
export function mergeInlineDraftIntoEntry(entry, partialDraft) {
  if (!partialDraft || Object.keys(partialDraft).length === 0) return { ...entry };
  const e = { ...entry };
  const dStr = partialDraft.debit !== undefined ? String(partialDraft.debit).trim() : null;
  const cStr = partialDraft.credit !== undefined ? String(partialDraft.credit).trim() : null;

  if (dStr !== null && dStr !== '') {
    const d = parseFloat(dStr);
    if (Number.isFinite(d)) e.debitAmount = d;
  }
  if (cStr !== null && cStr !== '') {
    const c = parseFloat(cStr);
    if (Number.isFinite(c)) e.creditAmount = c;
  }

  const type = entryType(e);
  if (type === 'cash_received' && (dStr !== null || cStr !== null)) {
    const dVal =
      dStr !== null && dStr !== ''
        ? parseFloat(e.debitAmount)
        : parseFloat(e.debitAmount != null && e.debitAmount !== '' ? e.debitAmount : 0);
    const cVal =
      cStr !== null && cStr !== ''
        ? parseFloat(e.creditAmount)
        : parseFloat(e.creditAmount != null && e.creditAmount !== '' ? e.creditAmount : 0);
    const d2 = Number.isFinite(dVal) ? dVal : 0;
    const c2 = Number.isFinite(cVal) ? cVal : 0;
    e.amount = c2 - d2;
  } else if (type !== 'cash_received' && dStr !== null && dStr !== '') {
    e.amount = Math.abs(parseFloat(e.debitAmount));
  }

  return e;
}

export function mergeLogsWithInlineDrafts(rawEntries, draftsByKey) {
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) return [];
  return rawEntries.map((entry) => {
    const k = entry.entryKey;
    const draft = k && draftsByKey ? draftsByKey[k] : null;
    if (!draft || Object.keys(draft).length === 0) return entry;
    return mergeInlineDraftIntoEntry(entry, draft);
  });
}
