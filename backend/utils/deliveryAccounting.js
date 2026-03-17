/**
 * Delivery Accounting Logic for Dial a Drink
 *
 * No wallet. Only Cash at Hand and Savings.
 *
 * Current rules:
 * - For PAY_ON_DELIVERY (cash orders where driver receives cash from customer):
 *   - Driver's cash at hand increases by (order items total + 50% of delivery fee).
 *   - The remaining 50% of the delivery fee (50%) is credited to savings
 *     when the order is completed (via creditWalletsOnDeliveryCompletion),
 *     not when the driver submits cash.
 *
 * - For PAY_NOW (M-Pesa/Pesapal where driver does not receive cash from customer):
 *   - 50% of the delivery fee is credited to driver's savings.
 *   - 50% of the delivery fee reduces the driver's cash at hand (company holds it; driver did not receive cash).
 */

/**
 * Calculate delivery accounting values based on payment method
 *
 * @param {number} alcoholCost - Total cost of items (order total excluding delivery fee)
 * @param {number} deliveryFee - Total delivery fee
 * @param {string} paymentMethod - "PAY_NOW" | "PAY_ON_DELIVERY"
 * @returns {Object} Delivery accounting result
 * @returns {number} returns.cashAtHandChange - Change to driver's cash at hand
 * @returns {number} returns.savingsChange - Change to driver's savings
 * @returns {number} returns.withheldAmount - 50% of delivery fee (savings portion)
 */
function calculateDeliveryAccounting(alcoholCost, deliveryFee, paymentMethod) {
  if (typeof alcoholCost !== 'number' || isNaN(alcoholCost) || alcoholCost < 0) {
    throw new Error('alcoholCost must be a non-negative number');
  }
  if (typeof deliveryFee !== 'number' || isNaN(deliveryFee) || deliveryFee < 0) {
    throw new Error('deliveryFee must be a non-negative number');
  }
  if (paymentMethod !== 'PAY_NOW' && paymentMethod !== 'PAY_ON_DELIVERY') {
    throw new Error('paymentMethod must be "PAY_NOW" or "PAY_ON_DELIVERY"');
  }

  const withheldAmount = deliveryFee * 0.5; // 50% of delivery fee

  let cashAtHandChange;
  let savingsChange;

  if (paymentMethod === 'PAY_NOW') {
    // M-Pesa/Pesapal: driver did not receive cash from customer.
    // Business rule: 50% delivery fee → savings AND 50% delivery fee REDUCES cash at hand.
    cashAtHandChange = -withheldAmount; // Reduce driver cash at hand by 50%
    savingsChange = withheldAmount;     // Credit 50% to driver savings
  } else {
    // PAY_ON_DELIVERY (cash):
    // - Driver receives cash from customer (itemsTotal + deliveryFee).
    // - System tracks driver's cash at hand as itemsTotal + 50% of delivery fee.
    // - The remaining 50% is credited to savings immediately when the order is completed.
    cashAtHandChange = alcoholCost + withheldAmount;
    savingsChange = withheldAmount;
  }

  return {
    cashAtHandChange,
    savingsChange,
    immediateDriverEarnings: withheldAmount,
    withheldAmount
  };
}

module.exports = {
  calculateDeliveryAccounting
};
