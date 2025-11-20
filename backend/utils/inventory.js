const db = require('../models');
const { Op } = db.Sequelize;
const smsService = require('../services/sms');

/**
 * Decreases inventory stock for all items in a completed order
 * @param {number} orderId - The order ID
 * @param {object} transaction - Optional Sequelize transaction
 * @returns {Promise<object>} Summary of inventory updates
 */
const decreaseInventoryForOrder = async (orderId, transaction = null) => {
  try {
    // Load order with items
    const order = await db.Order.findByPk(orderId, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        required: true
      }],
      transaction
    });

    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }

    // Only decrease inventory if order is completed and paid
    if (order.status !== 'completed' || order.paymentStatus !== 'paid') {
      console.log(`ℹ️  Skipping inventory decrease for Order #${orderId} - status: ${order.status}, paymentStatus: ${order.paymentStatus}`);
      return {
        skipped: true,
        reason: 'order_not_completed_or_paid',
        orderId
      };
    }

    const results = [];
    const errors = [];

    // Process each order item
    for (const item of order.items || []) {
      try {
        const drink = await db.Drink.findByPk(item.drinkId, { transaction });
        
        if (!drink) {
          console.warn(`⚠️  Drink #${item.drinkId} not found for Order #${orderId}`);
          errors.push({
            drinkId: item.drinkId,
            error: 'Drink not found'
          });
          continue;
        }

        const currentStock = parseInt(drink.stock) || 0;
        const quantity = parseInt(item.quantity) || 0;

        if (quantity <= 0) {
          console.warn(`⚠️  Invalid quantity (${quantity}) for Drink #${item.drinkId} in Order #${orderId}`);
          continue;
        }

        // Calculate new stock (ensure it doesn't go below 0)
        const newStock = Math.max(0, currentStock - quantity);

        // Update drink stock and automatically set isAvailable based on stock
        await drink.update({
          stock: newStock,
          isAvailable: newStock > 0
        }, { transaction });

        if (newStock === 0) {
          console.log(`📦 Drink #${item.drinkId} (${drink.name}) is now out of stock`);
        } else if (currentStock === 0 && newStock > 0) {
          console.log(`✅ Drink #${item.drinkId} (${drink.name}) is back in stock (${newStock} units)`);
        }

        // Check if stock falls below alert threshold
        const shouldAlert = newStock > 0 && currentStock > newStock; // Only alert if stock decreased and is still > 0
        if (shouldAlert) {
          try {
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
              }
            }
          } catch (alertError) {
            console.error(`❌ Error sending stock alert for Drink #${item.drinkId}:`, alertError);
            // Don't fail inventory decrease if alert fails
          }
        }

        results.push({
          drinkId: item.drinkId,
          drinkName: drink.name,
          quantity: quantity,
          oldStock: currentStock,
          newStock: newStock
        });

        console.log(`📉 Decreased inventory for Drink #${item.drinkId} (${drink.name}): ${currentStock} → ${newStock} (sold ${quantity})`);
      } catch (itemError) {
        console.error(`❌ Error decreasing inventory for Drink #${item.drinkId} in Order #${orderId}:`, itemError);
        errors.push({
          drinkId: item.drinkId,
          error: itemError.message
        });
      }
    }

    return {
      orderId,
      success: errors.length === 0,
      itemsProcessed: results.length,
      itemsUpdated: results,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error(`❌ Error decreasing inventory for Order #${orderId}:`, error);
    throw error;
  }
};

module.exports = {
  decreaseInventoryForOrder
};

