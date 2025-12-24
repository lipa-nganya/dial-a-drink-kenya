const db = require('../models');
const smsService = require('../services/sms');

/**
 * Check and send stock alert if stock falls below threshold
 * @param {number} drinkId - The drink ID
 * @param {number} currentStock - Current stock before update
 * @param {number} newStock - New stock after update
 * @param {object} drink - The drink object (optional, will fetch if not provided)
 * @returns {Promise<object>} Result of alert check
 */
const checkAndSendStockAlert = async (drinkId, currentStock, newStock, drink = null) => {
  try {
    // Only check if stock decreased and is still > 0
    if (newStock >= currentStock || newStock <= 0) {
      return { checked: false, reason: 'stock_not_decreased_or_zero' };
    }

    // Fetch drink if not provided
    if (!drink) {
      drink = await db.Drink.findByPk(drinkId);
      if (!drink) {
        return { checked: false, reason: 'drink_not_found' };
      }
    }

    // Get stock alert settings
    const [stockAlertQuantitySetting, stockAlertRecipientSetting, smsEnabledSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'stockAlertQuantity' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'stockAlertRecipient' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'smsEnabled' } }).catch(() => null)
    ]);

    const stockAlertQuantity = parseInt(stockAlertQuantitySetting?.value || '10');
    const stockAlertRecipientValue = stockAlertRecipientSetting?.value || '';
    const smsEnabled = smsEnabledSetting?.value !== 'false'; // Default to enabled

    // Check if stock is now below threshold and was above threshold before
    if (newStock <= stockAlertQuantity && currentStock > stockAlertQuantity && stockAlertRecipientValue && smsEnabled) {
      // Parse multiple recipients (comma-separated)
      const recipients = stockAlertRecipientValue
        .split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0);

      if (recipients.length > 0) {
        const message = `⚠️ LOW STOCK ALERT: ${drink.name} stock is now ${newStock} units (below threshold of ${stockAlertQuantity}). Please restock soon.`;
        
        console.log(`📱 Sending stock alert SMS for ${drink.name} (stock: ${newStock} ≤ ${stockAlertQuantity}) to ${recipients.length} recipient(s)`);
        
        // Send SMS to all recipients
        const smsResults = await smsService.sendBulkSMS(recipients, message);
        
        const successCount = smsResults.filter(r => r.success).length;
        const failCount = smsResults.filter(r => !r.success).length;
        
        if (successCount > 0) {
          console.log(`✅ Stock alert SMS sent successfully to ${successCount} recipient(s)`);
        }
        if (failCount > 0) {
          console.error(`❌ Failed to send stock alert SMS to ${failCount} recipient(s)`);
          smsResults.filter(r => !r.success).forEach(result => {
            console.error(`   - ${result.phone}: ${result.error || 'Unknown error'}`);
          });
        }

        return {
          checked: true,
          sent: true,
          successCount,
          failCount,
          recipients: recipients.length
        };
      }
    }

    return {
      checked: true,
      sent: false,
      reason: newStock > stockAlertQuantity 
        ? 'stock_above_threshold' 
        : currentStock <= stockAlertQuantity 
          ? 'was_already_below_threshold'
          : !stockAlertRecipientValue 
            ? 'no_recipient_configured'
            : !smsEnabled 
              ? 'sms_disabled'
              : 'unknown'
    };
  } catch (error) {
    console.error(`❌ Error checking stock alert for Drink #${drinkId}:`, error);
    return {
      checked: true,
      sent: false,
      error: error.message
    };
  }
};

module.exports = {
  checkAndSendStockAlert
};



