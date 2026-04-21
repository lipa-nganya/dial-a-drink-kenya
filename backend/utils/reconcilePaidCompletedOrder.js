'use strict';

/**
 * When admin edits amounts on a completed + paid order, wallet/ledger rows created at
 * completion must move by the delta. This module captures a pre-edit snapshot and
 * applies deltas after the order row (and optionally line items) are updated.
 */

const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('./orderFinancials');
const {
  loadOrderWithTransactions,
  shouldReconcilePaidCompletedAmountEdit
} = require('./orderEffectivePaymentStatus');
const { calculateDeliveryAccounting } = require('./deliveryAccounting');

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

async function loadPaymentAccountingContext(orderId) {
  const order = await db.Order.findByPk(orderId);
  if (!order) return null;

  const paymentTransactionForAccounting = await db.Transaction.findOne({
    where: {
      orderId,
      transactionType: 'payment',
      status: 'completed',
      paymentStatus: 'paid'
    },
    order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']]
  });

  const paymentMethodFromTxnOrOrder =
    (paymentTransactionForAccounting && paymentTransactionForAccounting.paymentMethod) ||
    order.paymentMethod ||
    null;
  const providerLower = String(paymentTransactionForAccounting?.paymentProvider || '').toLowerCase();
  const isNonCashSystemPayment =
    (order.paymentStatus === 'paid' &&
      (paymentMethodFromTxnOrOrder === 'mobile_money' || paymentMethodFromTxnOrOrder === 'card')) &&
    (!paymentTransactionForAccounting ||
      providerLower === '' ||
      providerLower === 'mpesa' ||
      providerLower === 'pesapal');

  const orderPaymentTypeNorm = (order.paymentType || 'pay_on_delivery').toString().toLowerCase();
  const paymentTypeForAccounting =
    orderPaymentTypeNorm === 'pay_now' || isNonCashSystemPayment ? 'PAY_NOW' : 'PAY_ON_DELIVERY';

  const paymentMethod = paymentTransactionForAccounting?.paymentMethod || order.paymentMethod || '';
  const paymentProvider = paymentTransactionForAccounting?.paymentProvider || '';
  const isCashPayment =
    paymentMethod === 'cash' ||
    paymentProvider === 'cash_in_hand' ||
    paymentProvider === 'driver_mpesa_manual';

  const [driverPayEnabledSetting, driverPayModeSetting, driverPayAmountSetting, driverPayPercentageSetting] =
    await Promise.all([
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryPercentage' } }).catch(() => null)
    ]);

  const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
  const driverPayMode = driverPayModeSetting?.value || 'amount';
  const isPercentageMode = driverPayMode === 'percentage';
  const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
  const configuredDriverPayPercentage = parseFloat(driverPayPercentageSetting?.value || '30');

  return {
    order,
    paymentTransactionForAccounting,
    paymentTypeForAccounting,
    isCashPayment,
    driverPaySettingEnabled,
    isPercentageMode,
    configuredDriverPayAmount,
    configuredDriverPayPercentage
  };
}

/**
 * Territory fee used for driver pay + savings (same as creditWalletsOnDeliveryCompletion).
 */
function computeEffectiveDriverPay(order, territoryDeliveryFee, ctx) {
  const deliveryFeeAmount = toNum(territoryDeliveryFee);
  if (!order.driverId) return 0;

  if (ctx.paymentTypeForAccounting === 'PAY_NOW') {
    return deliveryFeeAmount * 0.5;
  }
  if (ctx.driverPaySettingEnabled) {
    if (ctx.isPercentageMode) {
      const v = deliveryFeeAmount * (ctx.configuredDriverPayPercentage / 100);
      return Math.min(v, deliveryFeeAmount);
    }
    let driverPayAmount = toNum(order.driverPayAmount);
    if ((!driverPayAmount || driverPayAmount < 0.009) && ctx.configuredDriverPayAmount > 0) {
      driverPayAmount = Math.min(deliveryFeeAmount, ctx.configuredDriverPayAmount);
    }
    if (driverPayAmount > deliveryFeeAmount) driverPayAmount = deliveryFeeAmount;
    return driverPayAmount;
  }
  return 0;
}

/**
 * Snapshot financial state used for delta reconciliation.
 */
async function captureFinancialSnapshot(orderId) {
  const breakdown = await getOrderFinancialBreakdown(orderId);
  const ctx = await loadPaymentAccountingContext(orderId);
  if (!ctx) return null;

  const { order } = ctx;
  const itemsTotal = toNum(breakdown.itemsTotal);
  // MUST match creditWalletsOnDeliveryCompletion: customer-facing fee from breakdown
  // (totalAmount − items − tip). order.convenienceFee can drift after edits and must not override this.
  const convenienceFee = toNum(breakdown.deliveryFee);
  const territoryDeliveryFee = toNum(order.territoryDeliveryFee ?? convenienceFee);
  const orderValue = itemsTotal + convenienceFee;

  const accounting = calculateDeliveryAccounting(
    orderValue,
    territoryDeliveryFee,
    ctx.paymentTypeForAccounting
  );

  const effectiveDriverPay = computeEffectiveDriverPay(order, territoryDeliveryFee, ctx);
  const effectiveDriverPayForTxn = ctx.isCashPayment ? 0 : effectiveDriverPay;

  const isPOS = order.deliveryAddress === 'In-Store Purchase';

  return {
    orderId,
    itemsTotal,
    convenienceFee,
    territoryDeliveryFee,
    orderValue,
    tipAmount: toNum(breakdown.tipAmount),
    totalAmount: toNum(breakdown.totalAmount),
    accounting: {
      savingsChange: accounting.savingsChange,
      cashAtHandChange: accounting.cashAtHandChange
    },
    effectiveDriverPay: effectiveDriverPayForTxn,
    isCashPayment: ctx.isCashPayment,
    paymentTypeForAccounting: ctx.paymentTypeForAccounting,
    isPOS,
    driverId: order.driverId
  };
}

function emitFinancialRefresh(req, orderId, driverId) {
  const io = req.app?.get('io');
  if (!io) return;
  io.to('admin').emit('order-updated', { orderId, reason: 'financial-reconcile' });
  io.to(`order-${orderId}`).emit('order-status-updated', {
    orderId,
    reason: 'order_amounts_updated'
  });
  if (driverId) {
    io.to(`driver-${driverId}`).emit('order-status-updated', {
      orderId,
      reason: 'order_amounts_updated'
    });
    io.to(`driver-${driverId}`).emit('driver-balances-updated', {
      orderId,
      reason: 'order_amounts_updated'
    });
  }
}

/**
 * Apply wallet / transaction deltas after admin edits a completed, paid order.
 * @param {number} orderId
 * @param {object|null} snapshotBefore — from captureFinancialSnapshot before mutations
 */
async function reconcilePaidCompletedOrderFinances(orderId, snapshotBefore, req) {
  if (!snapshotBefore) {
    return { skipped: true, reason: 'no_snapshot' };
  }

  const order = await loadOrderWithTransactions(orderId);
  if (!order || !shouldReconcilePaidCompletedAmountEdit(order)) {
    return { skipped: true, reason: 'not_completed_paid' };
  }

  const snapAfter = await captureFinancialSnapshot(orderId);
  if (!snapAfter) {
    return { skipped: true, reason: 'snapshot_after_failed' };
  }

  const dItems = snapAfter.itemsTotal - snapshotBefore.itemsTotal;
  const dSavingsAccounting = snapAfter.accounting.savingsChange - snapshotBefore.accounting.savingsChange;
  const dCashAccounting = snapAfter.accounting.cashAtHandChange - snapshotBefore.accounting.cashAtHandChange;
  const dDriverPay =
    snapAfter.effectiveDriverPay - snapshotBefore.effectiveDriverPay;

  const t = await db.sequelize.transaction();

  try {
    // 1) Merchant (admin) wallet — items total portion credited at completion (includes POS)
    if (Math.abs(dItems) > 0.009) {
      let adminWallet = await db.AdminWallet.findOne({
        where: { id: 1 },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!adminWallet) {
        adminWallet = await db.AdminWallet.create(
          {
            id: 1,
            balance: 0,
            totalRevenue: 0,
            totalOrders: 0,
            cashAtHand: 0
          },
          { transaction: t }
        );
      }
      const bal = toNum(adminWallet.balance);
      const rev = toNum(adminWallet.totalRevenue);
      await adminWallet.update(
        {
          balance: Number((bal + dItems).toFixed(2)),
          totalRevenue: Number((rev + dItems).toFixed(2))
        },
        { transaction: t }
      );
    }

    // POS: no driver savings / cash / delivery_pay legs
    if (snapAfter.isPOS) {
      await t.commit();
      emitFinancialRefresh(req, orderId, null);
      return {
        applied: true,
        pos: true,
        dItems,
        snapAfter
      };
    }

    const driverId = order.driverId;
    if (!driverId) {
      await t.commit();
      emitFinancialRefresh(req, orderId, null);
      return { applied: true, noDriver: true, dItems, snapAfter };
    }

    // 2) Savings + savings_credit transaction
    if (Math.abs(dSavingsAccounting) > 0.009) {
      const driverWallet = await db.DriverWallet.findOne({
        where: { driverId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (driverWallet) {
        const savingsCredit = await db.Transaction.findOne({
          where: {
            orderId,
            transactionType: 'savings_credit',
            driverId,
            status: { [Op.ne]: 'cancelled' }
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        const newSavingsTarget = Number(snapAfter.accounting.savingsChange.toFixed(2));
        const currentSavings = toNum(driverWallet.savings);

        if (savingsCredit) {
          await savingsCredit.update(
            {
              amount: newSavingsTarget,
              notes: `${savingsCredit.notes || ''}\n[admin amount reconcile ${new Date().toISOString()}]`.trim()
            },
            { transaction: t }
          );
          await driverWallet.update(
            { savings: Number((currentSavings + dSavingsAccounting).toFixed(2)) },
            { transaction: t }
          );
        } else if (newSavingsTarget > 0.009) {
          await db.Transaction.create(
            {
              orderId,
              transactionType: 'savings_credit',
              paymentMethod: order.paymentMethod || 'mobile_money',
              paymentProvider: 'mpesa',
              amount: newSavingsTarget,
              status: 'completed',
              paymentStatus: 'paid',
              transactionDate: new Date(),
              driverId,
              driverWalletId: driverWallet.id,
              notes: `50% delivery fee order ${orderId} (admin reconcile)`
            },
            { transaction: t }
          );
          await driverWallet.update(
            { savings: Number((currentSavings + newSavingsTarget).toFixed(2)) },
            { transaction: t }
          );
        }
      }
    }

    // 3) Driver cash at hand (net change from delivery accounting)
    if (Math.abs(dCashAccounting) > 0.009) {
      const driver = await db.Driver.findByPk(driverId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (driver) {
        const cur = toNum(driver.cashAtHand);
        await driver.update(
          { cashAtHand: Number((cur + dCashAccounting).toFixed(2)) },
          { transaction: t }
        );
      }
    }

    // 3b) Align cash_settlement ledger amounts with current accounting so rider statements match drivers.cashAtHand
    const codLedger = await db.Transaction.findOne({
      where: {
        orderId,
        driverId,
        transactionType: 'cash_settlement',
        paymentProvider: 'order_completion',
        status: { [Op.ne]: 'cancelled' }
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (codLedger && snapAfter.paymentTypeForAccounting === 'PAY_ON_DELIVERY') {
      const targetNet = Number(snapAfter.accounting.cashAtHandChange.toFixed(2));
      if (Math.abs(toNum(codLedger.amount) - targetNet) > 0.009) {
        await codLedger.update(
          {
            amount: targetNet,
            notes: `${codLedger.notes || ''}\n[admin reconcile ${new Date().toISOString()}]`.trim()
          },
          { transaction: t }
        );
      }
    }

    const payNowCashLedger = await db.Transaction.findOne({
      where: {
        orderId,
        driverId,
        transactionType: 'cash_settlement',
        status: { [Op.ne]: 'cancelled' },
        [Op.or]: [
          { notes: { [Op.like]: '%Cash at hand − 50% delivery fee%' } },
          { notes: { [Op.like]: '%Pay Now: 50% delivery fee - cash at hand%' } }
        ]
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (payNowCashLedger && snapAfter.paymentTypeForAccounting === 'PAY_NOW') {
      const targetMag = Math.abs(Number(snapAfter.accounting.cashAtHandChange.toFixed(2)));
      if (Math.abs(Math.abs(toNum(payNowCashLedger.amount)) - targetMag) > 0.009) {
        await payNowCashLedger.update(
          {
            amount: targetMag,
            notes: `${payNowCashLedger.notes || ''}\n[admin reconcile ${new Date().toISOString()}]`.trim()
          },
          { transaction: t }
        );
      }
    }

    // 4) delivery_pay transaction amount (audit / driver app; not always wallet balance)
    if (!snapAfter.isCashPayment && Math.abs(dDriverPay) > 0.009) {
      const deliveryPay = await db.Transaction.findOne({
        where: {
          orderId,
          transactionType: 'delivery_pay',
          driverId,
          status: { [Op.ne]: 'cancelled' }
        },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (deliveryPay) {
        await deliveryPay.update(
          {
            amount: Number(snapAfter.effectiveDriverPay.toFixed(2)),
            notes: `${deliveryPay.notes || ''}\n[admin amount reconcile ${new Date().toISOString()}]`.trim()
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    emitFinancialRefresh(req, orderId, driverId);

    return {
      applied: true,
      deltas: {
        itemsTotal: dItems,
        savingsAccounting: dSavingsAccounting,
        cashAtHandAccounting: dCashAccounting,
        driverPay: dDriverPay
      },
      snapAfter
    };
  } catch (err) {
    await t.rollback();
    console.error(`reconcilePaidCompletedOrderFinances failed for order ${orderId}:`, err);
    throw err;
  }
}

module.exports = {
  captureFinancialSnapshot,
  reconcilePaidCompletedOrderFinances
};
