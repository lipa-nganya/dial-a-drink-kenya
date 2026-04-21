'use strict';

const db = require('../models');

/**
 * Whether an order counts as "paid" for admin amount edits and wallet reconciliation.
 * Matches list-view behaviour: paymentStatus, or a completed customer payment transaction.
 */
function isOrderEffectivelyPaid(order) {
  if (!order) return false;
  if (order.paymentStatus === 'paid') return true;
  const txs = order.transactions;
  if (!Array.isArray(txs)) return false;
  return txs.some((tx) => {
    if (!tx || tx.status !== 'completed') return false;
    const ty = tx.transactionType;
    if (ty == null || ty === '') return true;
    return String(ty).toLowerCase() === 'payment';
  });
}

/** Completed orders where payment is recorded (row or transaction) — run reconcile after amount edits. */
function shouldReconcilePaidCompletedAmountEdit(order) {
  return !!(order && order.status === 'completed' && isOrderEffectivelyPaid(order));
}

function isSequelizeTransaction(val) {
  return !!(val && typeof val.commit === 'function' && typeof val.rollback === 'function');
}

async function loadOrderWithTransactions(orderId, arg2) {
  let sequelizeTransaction;
  let includeOrderItems = false;
  if (isSequelizeTransaction(arg2)) {
    sequelizeTransaction = arg2;
  } else if (arg2 && typeof arg2 === 'object') {
    sequelizeTransaction = arg2.transaction;
    includeOrderItems = !!arg2.includeOrderItems;
  }

  const include = [
    {
      model: db.Transaction,
      as: 'transactions',
      required: false,
      attributes: ['id', 'status', 'transactionType', 'paymentStatus']
    }
  ];
  if (includeOrderItems) {
    include.push({
      model: db.OrderItem,
      as: 'items',
      attributes: ['id', 'drinkId', 'quantity', 'price']
    });
  }

  const opts = { include };
  if (sequelizeTransaction) opts.transaction = sequelizeTransaction;
  return db.Order.findByPk(orderId, opts);
}

module.exports = {
  isOrderEffectivelyPaid,
  shouldReconcilePaidCompletedAmountEdit,
  loadOrderWithTransactions
};
