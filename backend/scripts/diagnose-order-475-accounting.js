require('dotenv').config();
const db = require('../models');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { calculateDeliveryAccounting } = require('../utils/deliveryAccounting');

async function main() {
  const orderId = 475;

  const order = await db.Order.findByPk(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);

  const paymentTx = await db.Transaction.findOne({
    where: { orderId, transactionType: 'payment', status: 'completed', paymentStatus: 'paid' },
    order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']]
  });

  const breakdown = await getOrderFinancialBreakdown(orderId);
  const itemsTotal = Number(breakdown.itemsTotal || 0);
  const deliveryFee = Number(breakdown.deliveryFee || 0);

  const paymentType = order.paymentType || 'pay_on_delivery';
  const paymentMethodFromTxnOrOrder = (paymentTx && paymentTx.paymentMethod) || order.paymentMethod || null;
  const providerLower = String(paymentTx?.paymentProvider || '').toLowerCase();

  const isNonCashSystemPayment =
    (order.paymentStatus === 'paid' && (paymentMethodFromTxnOrOrder === 'mobile_money' || paymentMethodFromTxnOrOrder === 'card')) &&
    (!paymentTx || providerLower === '' || providerLower === 'mpesa' || providerLower === 'pesapal');

  const paymentTypeForAccounting = (paymentType === 'pay_now' || isNonCashSystemPayment) ? 'PAY_NOW' : 'PAY_ON_DELIVERY';
  const accounting = calculateDeliveryAccounting(itemsTotal, deliveryFee, paymentTypeForAccounting);

  console.log('=== DIAGNOSE ORDER ACCOUNTING ===');
  console.log({
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentType: order.paymentType,
      paymentMethod: order.paymentMethod
    },
    paymentTx: paymentTx
      ? { id: paymentTx.id, paymentMethod: paymentTx.paymentMethod, paymentProvider: paymentTx.paymentProvider }
      : null,
    itemsTotal,
    deliveryFee,
    paymentTypeForAccounting,
    cashAtHandChange: accounting.cashAtHandChange,
    savingsChange: accounting.savingsChange
  });
}

main()
  .then(() => db.sequelize.close())
  .catch(async (err) => {
    console.error('❌ Diagnose failed:', err);
    try { await db.sequelize.close(); } catch (e) {}
    process.exit(1);
  });

