/**
 * Delivery Accounting Logic for Dial a Drink
 *
 * No wallet. Only Cash at Hand and Savings.
 * - Savings = 50% of delivery fee (credited on Pay Now orders only).
 * - Pay on Delivery (cash): driver's cash at hand += 50% delivery fee + order total.
 * - Pay Now (M-Pesa/Pesapal): driver's cash at hand -= 50% delivery fee; savings += 50% delivery fee.
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
    // M-Pesa/Pesapal: cash at hand reduces by 50% of delivery fee; 50% credited to savings
    cashAtHandChange = -withheldAmount;
    savingsChange = withheldAmount;
  } else {
    // PAY_ON_DELIVERY (cash): cash at hand increases by 50% delivery fee + order total. No savings.
    cashAtHandChange = alcoholCost + withheldAmount;
    savingsChange = 0;
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
