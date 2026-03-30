export function getDefaultSavingsDebitCreditStrings(row) {
  const amt = parseFloat(row?.amount || 0) || 0;
  const hasD = row?.debitAmount != null && row.debitAmount !== '';
  const hasC = row?.creditAmount != null && row.creditAmount !== '';

  if (hasD || hasC) {
    return {
      debit: hasD ? String(Math.round(Number(row.debitAmount))) : '',
      credit: hasC ? String(Math.round(Number(row.creditAmount))) : ''
    };
  }

  // Fallback from signed amount.
  if (amt > 0) return { debit: '', credit: String(Math.round(amt)) };
  if (amt < 0) return { debit: String(Math.round(Math.abs(amt))), credit: '' };
  return { debit: '', credit: '' };
}

export function mergeSavingsDraftIntoRow(row, draft) {
  if (!draft || Object.keys(draft).length === 0) return { ...row };
  const out = { ...row };

  const dStr = draft.debit !== undefined ? String(draft.debit).trim() : null;
  const cStr = draft.credit !== undefined ? String(draft.credit).trim() : null;

  if (dStr !== null && dStr !== '') {
    const d = parseFloat(dStr);
    if (Number.isFinite(d)) out.debitAmount = d;
  }
  if (cStr !== null && cStr !== '') {
    const c = parseFloat(cStr);
    if (Number.isFinite(c)) out.creditAmount = c;
  }

  // If either side is being overridden, recompute signed amount as credit - debit.
  if (dStr !== null || cStr !== null) {
    const d = parseFloat(out.debitAmount != null && out.debitAmount !== '' ? out.debitAmount : 0) || 0;
    const c = parseFloat(out.creditAmount != null && out.creditAmount !== '' ? out.creditAmount : 0) || 0;
    out.amount = c - d;
  }

  return out;
}

export function mergeSavingsRowsWithDrafts(rows, draftsByKey) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((r) => {
    const k = r?.entryKey;
    const draft = k && draftsByKey ? draftsByKey[k] : null;
    if (!draft || Object.keys(draft).length === 0) return r;
    return mergeSavingsDraftIntoRow(r, draft);
  });
}

