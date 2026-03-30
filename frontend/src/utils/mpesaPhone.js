/**
 * Normalize Kenyan mobile input to 2547XXXXXXXX for M-Pesa STK.
 * Accepts local 07…, international 254…, or 9-digit 7… Safaricom numbers.
 */
export function formatMpesaPhoneNumber(phone) {
  if (phone == null || phone === '') return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (!cleaned.startsWith('254')) {
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      cleaned = '254' + cleaned;
    }
  }
  return cleaned;
}

/** True when the value formats to a 12-digit Safaricom M-Pesa MSISDN (2547…). */
export function validateSafaricomPhone(phone) {
  const formatted = formatMpesaPhoneNumber(phone);
  return formatted.length === 12 && formatted.startsWith('2547');
}
