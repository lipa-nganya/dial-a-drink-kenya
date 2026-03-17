/**
 * Dial a Drink - Wallet Accounting Engine
 *
 * Single source of truth for all wallet/cash-at-hand/savings adjustments.
 * Runs ONLY when order status becomes 'completed'.
 *
 * Flow rules (from Dial_a_Drink_Payment_Flow):
 *
 * PAY NOW (M-Pesa/Pesapal):
 *   - Driver cash at hand: -50% delivery fee
 *   - Driver savings: +50% delivery fee
 *
 * PAY ON DELIVERY + M-Pesa/Pesapal:
 *   - Same as Pay Now (driver did not receive cash)
 *
 * PAY ON DELIVERY + Cash (Driver App / Customer site):
 *   - Driver cash at hand: +order amount + 50% delivery fee
 *   - Driver savings: +50% delivery fee
 *
 * PAY ON DELIVERY + Cash (Admin Web / Mobile):
 *   - Admin cash at hand: +full order amount
 *   - Driver savings: +50% delivery fee
 *   - Driver cash at hand: -50% delivery fee
 *
 * POS walk-in + Pay Now + Cash:
 *   - Admin cash at hand: +order value
 *
 * POS + Cash received:
 *   - Admin cash at hand: +order value
 */

const { creditWalletsOnDeliveryCompletion } = require('./walletCredits');

/**
 * Run wallet accounting when order status becomes completed.
 * This is the single entry point - all completion paths must call this.
 *
 * @param {number} orderId - Order ID
 * @param {object} req - Express request (for Socket.IO)
 * @returns {Promise<object>} Result
 */
async function runOnOrderCompletion(orderId, req = null) {
  return creditWalletsOnDeliveryCompletion(orderId, req);
}

module.exports = {
  runOnOrderCompletion
};
