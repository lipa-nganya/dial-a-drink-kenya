const db = require('../models');
const { Op } = db.Sequelize;
const smsService = require('../services/sms');

const toInt = (value, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const toFloat = (value, fallback = 0) => {
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
};

const normalizeCapacity = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const capacityPriceCandidates = (entry) => {
  if (!entry || typeof entry !== 'object') return [];
  const values = [];
  const cp = toFloat(entry.currentPrice, NaN);
  const op = toFloat(entry.originalPrice, NaN);
  const p = toFloat(entry.price, NaN);
  if (!Number.isNaN(cp) && cp > 0) values.push(cp);
  if (!Number.isNaN(op) && op > 0) values.push(op);
  if (!Number.isNaN(p) && p > 0) values.push(p);
  return values;
};

/**
 * Best-effort capacity resolution for historical order items that don't persist selectedCapacity:
 * match by exact unit price against drink.capacityPricing candidates.
 */
const resolveCapacityFromOrderItemPrice = (drink, item) => {
  const unitPrice = toFloat(item.price, NaN);
  if (Number.isNaN(unitPrice) || unitPrice <= 0) return null;
  const pricing = Array.isArray(drink.capacityPricing) ? drink.capacityPricing : [];
  const matches = pricing.filter((entry) => {
    const capacity = (entry?.capacity || entry?.size || '').toString().trim();
    if (!capacity) return false;
    return capacityPriceCandidates(entry).some((candidate) => Math.abs(candidate - unitPrice) < 0.0001);
  });
  if (matches.length === 1) {
    return (matches[0].capacity || matches[0].size || '').toString().trim() || null;
  }
  return null;
};

const sumStockByCapacity = (stockByCapacity) =>
  Object.values(stockByCapacity || {}).reduce((sum, value) => sum + Math.max(0, toInt(value, 0)), 0);

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

    // Check if this is a walk-in order (POS order)
    const isWalkInOrder = order.deliveryAddress === 'In-Store Purchase' || order.customerPhone === 'POS';

    // For walk-in orders, reduce inventory immediately when order is placed (regardless of payment status)
    // For delivery orders, only reduce inventory if order is completed and paid
    if (order.status !== 'completed') {
      console.log(`ℹ️  Skipping inventory decrease for Order #${orderId} - status: ${order.status}`);
      return {
        skipped: true,
        reason: 'order_not_completed',
        orderId
      };
    }

    if (!isWalkInOrder && order.paymentStatus !== 'paid') {
      console.log(`ℹ️  Skipping inventory decrease for Order #${orderId} - delivery order not paid (paymentStatus: ${order.paymentStatus})`);
      return {
        skipped: true,
        reason: 'delivery_order_not_paid',
        orderId
      };
    }

    // For walk-in orders, reduce inventory even if payment is pending (items are physically taken)
    if (isWalkInOrder && order.paymentStatus !== 'paid') {
      console.log(`📦 Reducing inventory for walk-in Order #${orderId} (paymentStatus: ${order.paymentStatus} - items physically taken)`);
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

        const currentStock = toInt(drink.stock, 0);
        const quantity = toInt(item.quantity, 0);

        if (quantity <= 0) {
          console.warn(`⚠️  Invalid quantity (${quantity}) for Drink #${item.drinkId} in Order #${orderId}`);
          continue;
        }

        const hasStockByCapacity = drink.stockByCapacity && typeof drink.stockByCapacity === 'object';
        let oldStock = currentStock;
        let newStock = currentStock;

        if (hasStockByCapacity) {
          const byCap = { ...drink.stockByCapacity };
          let remainingToDeduct = quantity;
          const matchedCapacity = resolveCapacityFromOrderItemPrice(drink, item);
          if (matchedCapacity) {
            const key = Object.keys(byCap).find((k) => normalizeCapacity(k) === normalizeCapacity(matchedCapacity));
            if (key) {
              const current = Math.max(0, toInt(byCap[key], 0));
              const deduct = Math.min(current, remainingToDeduct);
              byCap[key] = current - deduct;
              remainingToDeduct -= deduct;
            }
          }

          // Fallback for ambiguous/missing capacity: deduct from capacities with stock, largest first.
          if (remainingToDeduct > 0) {
            const keysByStockDesc = Object.keys(byCap).sort(
              (a, b) => Math.max(0, toInt(byCap[b], 0)) - Math.max(0, toInt(byCap[a], 0))
            );
            for (const key of keysByStockDesc) {
              if (remainingToDeduct <= 0) break;
              const current = Math.max(0, toInt(byCap[key], 0));
              if (current <= 0) continue;
              const deduct = Math.min(current, remainingToDeduct);
              byCap[key] = current - deduct;
              remainingToDeduct -= deduct;
            }
          }

          oldStock = currentStock;
          newStock = sumStockByCapacity(byCap);
          await drink.update({
            stockByCapacity: byCap,
            stock: newStock,
            isAvailable: newStock > 0
          }, { transaction });
        } else {
          // Calculate new stock (ensure it doesn't go below 0)
          newStock = Math.max(0, currentStock - quantity);
          await drink.update({
            stock: newStock,
            isAvailable: newStock > 0
          }, { transaction });
        }

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
          oldStock,
          newStock: newStock
        });

        console.log(`📉 Decreased inventory for Drink #${item.drinkId} (${drink.name}): ${oldStock} → ${newStock} (sold ${quantity})`);
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

/**
 * Increases inventory stock for all items in a cancelled order when it's accepted
 * @param {number} orderId - The order ID
 * @param {object} transaction - Optional Sequelize transaction
 * @returns {Promise<object>} Summary of inventory updates
 */
const increaseInventoryForOrder = async (orderId, transaction = null) => {
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

        const currentStock = toInt(drink.stock, 0);
        const quantity = toInt(item.quantity, 0);

        if (quantity <= 0) {
          console.warn(`⚠️  Invalid quantity (${quantity}) for Drink #${item.drinkId} in Order #${orderId}`);
          continue;
        }

        const hasStockByCapacity = drink.stockByCapacity && typeof drink.stockByCapacity === 'object';
        let oldStock = currentStock;
        let newStock = currentStock;

        if (hasStockByCapacity) {
          const byCap = { ...drink.stockByCapacity };
          const matchedCapacity = resolveCapacityFromOrderItemPrice(drink, item);
          if (matchedCapacity) {
            const key = Object.keys(byCap).find((k) => normalizeCapacity(k) === normalizeCapacity(matchedCapacity));
            if (key) {
              byCap[key] = Math.max(0, toInt(byCap[key], 0)) + quantity;
            } else {
              byCap[matchedCapacity] = quantity;
            }
          } else {
            // If unknown capacity, restore to first configured capacity key.
            const keys = Object.keys(byCap);
            if (keys.length > 0) {
              const key = keys[0];
              byCap[key] = Math.max(0, toInt(byCap[key], 0)) + quantity;
            }
          }

          oldStock = currentStock;
          newStock = sumStockByCapacity(byCap);
          await drink.update({
            stockByCapacity: byCap,
            stock: newStock,
            isAvailable: newStock > 0
          }, { transaction });
        } else {
          newStock = currentStock + quantity;
          await drink.update({
            stock: newStock,
            isAvailable: newStock > 0
          }, { transaction });
        }

        if (currentStock === 0 && newStock > 0) {
          console.log(`✅ Drink #${item.drinkId} (${drink.name}) is back in stock (${newStock} units)`);
        }

        results.push({
          drinkId: item.drinkId,
          drinkName: drink.name,
          quantity: quantity,
          oldStock,
          newStock: newStock
        });

        console.log(`📈 Increased inventory for Drink #${item.drinkId} (${drink.name}): ${oldStock} → ${newStock} (restored ${quantity})`);
      } catch (itemError) {
        console.error(`❌ Error increasing inventory for Drink #${item.drinkId} in Order #${orderId}:`, itemError);
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
    console.error(`❌ Error increasing inventory for Order #${orderId}:`, error);
    throw error;
  }
};

module.exports = {
  decreaseInventoryForOrder,
  increaseInventoryForOrder
};

