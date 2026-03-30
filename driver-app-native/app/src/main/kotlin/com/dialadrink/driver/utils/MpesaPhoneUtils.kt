package com.dialadrink.driver.utils

/**
 * Kenyan M-Pesa / Safaricom MSISDN normalization (matches backend/driver-wallet rules).
 */
object MpesaPhoneUtils {

    fun normalizeKenyaMpesaPhone(input: String): String {
        val digits = input.filter { it.isDigit() }
        if (digits.isEmpty()) return ""
        return when {
            digits.startsWith("0") -> "254" + digits.drop(1)
            digits.startsWith("254") -> digits
            else -> "254$digits"
        }
    }

    /** Safaricom mobile: formats to 2547XXXXXXXX (12 digits). */
    fun isValidSafaricomMpesa(input: String): Boolean {
        val n = normalizeKenyaMpesaPhone(input)
        return n.length == 12 && n.startsWith("2547")
    }
}
