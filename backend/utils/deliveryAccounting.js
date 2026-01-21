/**
 * Delivery Accounting Logic for Dial a Drink
 * 
 * This module implements the exact delivery accounting rules as specified.
 * DO NOT modify, optimize, or change ownership rules.
 * 
 * Core Business Rules (Immutable):
 * - Alcohol cost belongs 100% to the business
 * - Delivery fee belongs 100% to the driver
 * - The business withholds 50% of the delivery fee as leverage, not revenue
 * - Withheld delivery money is tracked as Savings
 * - Savings is always driver-owned money
 * - Cash at Hand = money the driver owes the business
 * - Savings is never counted as business income
 */

/**
 * Calculate delivery accounting values based on payment method
 * 
 * @param {number} alcoholCost - Total cost of alcohol items
 * @param {number} deliveryFee - Total delivery fee
 * @param {string} paymentMethod - "PAY_NOW" | "PAY_ON_DELIVERY"
 * @returns {Object} Delivery accounting result
 * @returns {number} returns.cashAtHandChange - Change to driver's cash at hand
 * @returns {number} returns.savingsChange - Change to driver's savings
 * @returns {number} returns.immediateDriverEarnings - Driver's immediate earnings
 * @returns {number} returns.withheldAmount - Amount withheld from driver
 */
function calculateDeliveryAccounting(alcoholCost, deliveryFee, paymentMethod) {
  // Validate inputs
  if (typeof alcoholCost !== 'number' || isNaN(alcoholCost) || alcoholCost < 0) {
    throw new Error('alcoholCost must be a non-negative number');
  }
  if (typeof deliveryFee !== 'number' || isNaN(deliveryFee) || deliveryFee < 0) {
    throw new Error('deliveryFee must be a non-negative number');
  }
  if (paymentMethod !== 'PAY_NOW' && paymentMethod !== 'PAY_ON_DELIVERY') {
    throw new Error('paymentMethod must be "PAY_NOW" or "PAY_ON_DELIVERY"');
  }

  // Derived values (as per specification)
  const driverDeliveryShare = deliveryFee;
  const withheldAmount = deliveryFee * 0.5;
  const immediateDriverEarnings = deliveryFee - withheldAmount;

  let cashAtHandChange;
  let savingsChange;

  if (paymentMethod === 'PAY_NOW') {
    // PAY_NOW: Customer pays business
    // Business receives: alcoholCost + deliveryFee
    // Business owes driver: immediateDriverEarnings
    // Savings: Increase by withheldAmount
    // Cash at Hand: Decrease by immediateDriverEarnings
    cashAtHandChange = -immediateDriverEarnings;
    savingsChange = withheldAmount;
  } else if (paymentMethod === 'PAY_ON_DELIVERY') {
    // PAY_ON_DELIVERY: Customer pays driver
    // Driver receives: alcoholCost + deliveryFee
    // Driver keeps: driverDeliveryShare
    // Driver remits to business: alcoholCost - withheldAmount
    // Savings: Increase by withheldAmount
    // Cash at Hand: Increase by (alcoholCost - withheldAmount)
    cashAtHandChange = alcoholCost - withheldAmount;
    savingsChange = withheldAmount;
  }

  return {
    cashAtHandChange,
    savingsChange,
    immediateDriverEarnings,
    withheldAmount
  };
}

module.exports = {
  calculateDeliveryAccounting
};
