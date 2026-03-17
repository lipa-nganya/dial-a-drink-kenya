require('dotenv').config();
const db = require('../backend/models');
const { getOrderFinancialBreakdown } = require('../backend/utils/orderFinancials');

async function main() {
  const orderId = 473;

  const order = await db.Order.findByPk(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!order.driverId) throw new Error(`Order ${orderId} has no driverId`);

  const paymentTxn = await db.Transaction.findOne({
    where: { orderId, transactionType: 'payment', status: 'completed', paymentStatus: 'paid' },
    order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']]
  });
  const method = paymentTxn?.paymentMethod || order.paymentMethod || null;
  if (method !== 'mobile_money' && method !== 'card') {
    throw new Error(`Order ${orderId} payment method is not mobile_money/card (got: ${method})`);
  }

  const hasCashSettlement = await db.Transaction.findOne({
    where: {
      orderId,
      driverId: order.driverId,
      transactionType: 'cash_settlement',
      status: 'completed'
    }
  });
  if (!hasCashSettlement) {
    throw new Error(`Order ${orderId} has no cash_settlement; refusing to apply repair`);
  }

  const breakdown = await getOrderFinancialBreakdown(orderId);
  const itemsTotal = Number(breakdown.itemsTotal || 0);
  const deliveryFee = Number(breakdown.deliveryFee || 0);
  const withheld = deliveryFee * 0.5;

  // If Order #473 was ever incorrectly treated as PAY_ON_DELIVERY cash-at-hand credit,
  // it would have added (itemsTotal + withheld). The correct PAY_NOW logic should *not* add this amount.
  // This repair removes that incorrect credit.
  const repairDelta = -(itemsTotal + withheld);

  const driver = await db.Driver.findByPk(order.driverId);
  if (!driver) throw new Error(`Driver ${order.driverId} not found`);

  const before = Number(driver.cashAtHand || 0);
  const after = before + repairDelta;

  await driver.update({ cashAtHand: after });

  console.log(`✅ Repaired driver cashAtHand for Order #${orderId}`);
  console.log(`driverId: ${driver.id}`);
  console.log(`itemsTotal: ${itemsTotal}, deliveryFee: ${deliveryFee}, withheld: ${withheld}`);
  console.log(`cashAtHand: ${before} → ${after} (delta ${repairDelta})`);
}

main()
  .then(() => db.sequelize.close())
  .catch(async (err) => {
    console.error('❌ Repair failed:', err);
    try { await db.sequelize.close(); } catch (e) {}
    process.exit(1);
  });

