#!/usr/bin/env node
/**
 * Inspect an order's cash at hand transactions - how they're calculated and displayed
 * Usage: node scripts/check-order-470-cash-at-hand.js <orderId>
 */
require('dotenv').config();
const db = require('../models');

async function main() {
  const orderId = parseInt(process.argv[2] || '470', 10);
  const order = await db.Order.findByPk(orderId, {
    include: [{ model: db.Driver, as: 'driver', attributes: ['id', 'name', 'cashAtHand'] }]
  });
  if (!order) {
    console.log(`Order ${orderId} not found`);
    process.exit(1);
  }

  console.log(`\n=== ORDER ${orderId} ===`);
  console.log('status:', order.status);
  console.log('paymentStatus:', order.paymentStatus);
  console.log('paymentType:', order.paymentType);
  console.log('paymentMethod:', order.paymentMethod);
  console.log('driverId:', order.driverId);
  if (order.driver) {
    console.log('driver:', order.driver.name, 'cashAtHand:', order.driver.cashAtHand);
  }

  const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
  const { calculateDeliveryAccounting } = require('../utils/deliveryAccounting');
  const breakdown = await getOrderFinancialBreakdown(orderId);
  const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
  const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
  const paymentType = order.paymentType || 'pay_on_delivery';
  const paymentTxn = await db.Transaction.findOne({
    where: { orderId, transactionType: 'payment', status: 'completed', paymentStatus: 'paid' },
    order: [['createdAt', 'DESC']]
  });
  const isMpesa = paymentTxn && (
    (paymentTxn.paymentMethod === 'mobile_money' || paymentTxn.paymentMethod === 'card') &&
    (String(paymentTxn.paymentProvider || '').toLowerCase() === 'mpesa' || String(paymentTxn.paymentProvider || '').toLowerCase() === 'pesapal')
  );
  const accountingType = (paymentType === 'pay_now' || isMpesa) ? 'PAY_NOW' : 'PAY_ON_DELIVERY';
  const accounting = calculateDeliveryAccounting(itemsTotal, deliveryFee, accountingType);

  console.log('\n=== ACCOUNTING ===');
  console.log('itemsTotal:', itemsTotal);
  console.log('deliveryFee:', deliveryFee);
  console.log('accountingType:', accountingType);
  console.log('cashAtHandChange:', accounting.cashAtHandChange);
  console.log('savingsChange:', accounting.savingsChange);

  const transactions = await db.Transaction.findAll({
    where: { orderId },
    order: [['createdAt', 'ASC']]
  });

  console.log('\n=== ALL TRANSACTIONS FOR ORDER 470 ===');
  transactions.forEach(tx => {
    console.log('---');
    console.log('id:', tx.id);
    console.log('transactionType:', tx.transactionType);
    console.log('amount:', tx.amount);
    console.log('status:', tx.status);
    console.log('notes:', (tx.notes || '').substring(0, 100));
    console.log('createdAt:', tx.createdAt);
  });

  // Simulate driver-wallet cash-at-hand entries for this driver
  const driverId = order.driverId;
  if (driverId) {
    const cashSettlementsPositive = await db.Transaction.findAll({
      where: {
        driverId,
        orderId,
        transactionType: 'cash_settlement',
        status: { [require('sequelize').Op.in]: ['completed', 'pending'] },
        amount: { [require('sequelize').Op.gt]: 0 }
      }
    });
    const deliveryFeeSettlements = await db.Transaction.findAll({
      where: {
        driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        paymentStatus: 'paid',
        notes: { [require('sequelize').Op.like]: '%Pay Now: 50% delivery fee - cash at hand%' }
      }
    });

    console.log('\n=== CASH-AT-HAND DISPLAY LOGIC (driver-wallet) ===');
    console.log('cashSettlementsPositive for order 470:', cashSettlementsPositive.length);
    cashSettlementsPositive.forEach(tx => {
      console.log('  - id:', tx.id, 'amount:', tx.amount, 'notes:', (tx.notes || '').substring(0, 80));
    });
    console.log('deliveryFeeSettlements (Pay Now 50%):', deliveryFeeSettlements.length);
    deliveryFeeSettlements.forEach(tx => {
      console.log('  - id:', tx.id, 'orderId:', tx.orderId, 'amount:', tx.amount);
    });

    const payNowForOrder470 = deliveryFeeSettlements.filter(tx => tx.orderId === orderId);
    const positiveForOrder470 = cashSettlementsPositive.filter(tx => tx.orderId === orderId);
    const inBoth = payNowForOrder470.filter(p => positiveForOrder470.some(q => q.id === p.id));
    console.log('\n=== DUPLICATE CHECK ===');
    console.log('Pay Now settlements for order 470:', payNowForOrder470.length);
    console.log('Positive cash_settlement for order 470:', positiveForOrder470.length);
    console.log('Same tx in BOTH lists (would show twice):', inBoth.length);
    if (inBoth.length > 0) {
      console.log('DUPLICATE: Transaction', inBoth[0].id, 'appears in allCashSettlements AND deliveryFeeSettlements');
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
