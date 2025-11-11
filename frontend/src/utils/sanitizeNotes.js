export const sanitizeCustomerNotes = (rawNotes) => {
  if (!rawNotes) {
    return '';
  }

  let cleaned = rawNotes;

  const replacementPatterns = [
    /Delivery Fee:?\s*KES?\s*[\d,]+\.?\d*/gi,
    /checkoutRequestID:?\s*[\w-]+/gi,
    /merchantRequestID:?\s*[\w-]+/gi,
    /M-Pesa Receipt:?\s*[\w-]+/gi,
    /M-Pesa|MPESA|STK|Transaction|Receipt/gi,
    /Payment confirmed at:?\s*[\d\-\s:]+/gi,
    /Tip:?\s*(Amount)?:?\s*(KES|KSH)?\s*[\d,]+\.?\d*/gi,
    /\(Driver (will|receives).*?tip.*?\)/gim,
    /Driver (will|receives).*?tip.*$/gim,
    /Tip\s*\(KES.*?\)/gi
  ];

  replacementPatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      const lower = line.toLowerCase();

      if (
        lower.startsWith('delivery fee') ||
        lower.startsWith('payment') ||
        lower.startsWith('m-pesa') ||
        lower.startsWith('mpesa') ||
        lower.startsWith('receipt') ||
        lower.startsWith('transaction') ||
        lower.startsWith('checkoutrequestid') ||
        lower.startsWith('merchantrequestid') ||
        lower.startsWith('stk') ||
        /^\d{4}-\d{2}-\d{2}/.test(lower)
      ) {
        return false;
      }

      if (
        (lower.includes('tip') && (
          lower.includes('kes') ||
          lower.includes('ksh') ||
          lower.includes('driver') ||
          lower.includes('wallet') ||
          lower.includes('recorded separately') ||
          lower.includes('credited') ||
          lower.includes('mpesa') ||
          lower.includes('m-pesa') ||
          lower.includes('stk')
        )) ||
        lower.includes('will be recorded separately')
      ) {
        return false;
      }

      return true;
    });

  return lines.join('\n').trim();
};

