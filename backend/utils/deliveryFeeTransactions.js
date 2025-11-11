const db = require('../models');
const { getOrderFinancialBreakdown } = require('./orderFinancials');

const { Op } = db.Sequelize;

const toNumeric = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Ensures delivery fee transactions are split between merchant and driver.
 * Creates or updates the merchant `delivery_pay` transaction and the driver-specific
 * `delivery_pay` transaction (orange entry in the admin UI) so that downstream
 * reporting and wallets stay consistent.
 *
 * @param {object|import('sequelize').Model} orderInstance - Sequelize order instance or plain object with an id.
 * @param {object} options
 * @param {string} [options.context='auto-sync'] - Text appended to transaction notes for auditability.
 * @param {boolean} [options.requirePayment=true] - When true, skips syncing if no completed payment transaction exists.
 * @returns {Promise<object>} Summary of the sync operation.
 */
const ensureDeliveryFeeSplit = async (orderInstance, options = {}) => {
  if (!orderInstance) {
    throw new Error('orderInstance is required');
  }

  const {
    context = 'auto-sync',
    requirePayment = true,
    reloadOrder = true
  } = options;

  let orderModel = null;

  if (orderInstance instanceof db.Order) {
    orderModel = reloadOrder ? await orderInstance.reload() : orderInstance;
  } else {
    const orderId = orderInstance.id || orderInstance.orderId;
    if (!orderId) {
      throw new Error('orderInstance.id is required');
    }
    orderModel = await db.Order.findByPk(orderId);
  }

  if (!orderModel) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const orderId = orderModel.id;
  const driverId = orderModel.driverId || null;

  const breakdown = await getOrderFinancialBreakdown(orderId);
  const deliveryFeeAmount = toNumeric(breakdown.deliveryFee);

  if (deliveryFeeAmount < 0.009) {
    return {
      skipped: true,
      reason: 'no_delivery_fee',
      deliveryFee: deliveryFeeAmount
    };
  }

  let paymentTransaction = null;
  if (requirePayment) {
    paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId,
        transactionType: 'payment',
        status: 'completed'
      },
      order: [
        ['transactionDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    if (!paymentTransaction && orderModel.paymentStatus === 'paid') {
      paymentTransaction = await db.Transaction.findOne({
        where: {
          orderId,
          transactionType: 'payment',
          status: {
            [Op.in]: ['completed', 'pending']
          }
        },
        order: [
          ['transactionDate', 'DESC'],
          ['createdAt', 'DESC']
        ]
      });
    }

    if (!paymentTransaction && orderModel.paymentStatus !== 'paid') {
      return { skipped: true, reason: 'payment_not_completed' };
    }
  } else {
    paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId,
        transactionType: 'payment'
      },
      order: [
        ['transactionDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
  }

  const paymentMethod =
    paymentTransaction?.paymentMethod ||
    orderModel.paymentMethod ||
    (orderModel.paymentType === 'pay_on_delivery' ? 'cash' : 'mobile_money');

  const paymentProvider =
    paymentTransaction?.paymentProvider ||
    orderModel.paymentMethod ||
    (orderModel.paymentType === 'pay_on_delivery' ? 'cash' : 'mpesa');

  const paymentCompleted =
    (paymentTransaction?.status === 'completed' && paymentTransaction?.paymentStatus === 'paid') ||
    orderModel.paymentStatus === 'paid';

  const receiptNumber = paymentCompleted ? (paymentTransaction?.receiptNumber || null) : null;
  const checkoutRequestID = paymentTransaction?.checkoutRequestID || null;
  const merchantRequestID = paymentTransaction?.merchantRequestID || null;
  const phoneNumber = paymentTransaction?.phoneNumber || null;
  const transactionDate = paymentCompleted
    ? (paymentTransaction?.transactionDate || paymentTransaction?.createdAt || new Date())
    : (paymentTransaction?.transactionDate || null);

  const targetStatus = paymentCompleted ? 'completed' : 'pending';
  const targetPaymentStatus = paymentCompleted ? 'paid' : 'pending';

  const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
    db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
    db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
  ]);

  const driverPayEnabled = driverPayEnabledSetting?.value === 'true';
  const configuredDriverPay = toNumeric(driverPayAmountSetting?.value);

  let driverPayAmount = toNumeric(orderModel.driverPayAmount);

  if ((!driverPayAmount || driverPayAmount < 0.009) && driverPayEnabled && configuredDriverPay > 0) {
    driverPayAmount = Math.min(deliveryFeeAmount, configuredDriverPay);
  }

  if (driverPayAmount > deliveryFeeAmount) {
    driverPayAmount = deliveryFeeAmount;
  }

  const merchantAmount = Math.max(deliveryFeeAmount - driverPayAmount, 0);

  const deliveryTransactions = await db.Transaction.findAll({
    where: { orderId, transactionType: 'delivery_pay' },
    order: [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC']
    ]
  });

  let driverTransaction = deliveryTransactions.find(
    (tx) => tx.driverId && driverId && tx.driverId === driverId
  );
  let merchantTransaction = deliveryTransactions.find((tx) => tx.driverId == null);

  if (!driverTransaction && driverId) {
    const convertible = deliveryTransactions.find(
      (tx) => tx.driverId == null && Math.abs(toNumeric(tx.amount) - driverPayAmount) < 0.01
    );

    if (convertible) {
      driverTransaction = convertible;
      if (merchantTransaction && merchantTransaction.id === convertible.id) {
        merchantTransaction = null;
      }
    }
  }

  const merchantPayloadBase = {
    paymentMethod: merchantTransaction?.paymentMethod || paymentMethod,
    paymentProvider: merchantTransaction?.paymentProvider || paymentProvider,
    receiptNumber: receiptNumber || (paymentCompleted ? merchantTransaction?.receiptNumber : null) || null,
    checkoutRequestID: checkoutRequestID || merchantTransaction?.checkoutRequestID || null,
    merchantRequestID: merchantRequestID || merchantTransaction?.merchantRequestID || null,
    phoneNumber: phoneNumber || merchantTransaction?.phoneNumber || null,
    transactionDate: paymentCompleted
      ? (transactionDate || merchantTransaction?.transactionDate || new Date())
      : (merchantTransaction?.transactionDate || null),
    driverId: null,
    driverWalletId: null
  };

  if (merchantAmount > 0.009) {
    const merchantPayload = {
      ...merchantPayloadBase,
      amount: merchantAmount,
      status: targetStatus,
      paymentStatus: targetPaymentStatus,
      notes: `Merchant share of delivery fee for Order #${orderId} (${context}). Amount: KES ${merchantAmount.toFixed(2)}.${paymentCompleted ? '' : ' Pending payment confirmation.'}`
    };

    if (merchantTransaction) {
      await merchantTransaction.update(merchantPayload);
    } else {
      merchantTransaction = await db.Transaction.create({
        orderId,
        transactionType: 'delivery_pay',
        ...merchantPayload
      });
    }
  } else if (merchantTransaction && merchantTransaction.status !== 'cancelled') {
    await merchantTransaction.update({
      status: 'cancelled',
      paymentStatus: 'cancelled',
      amount: 0,
      driverId: null,
      driverWalletId: null,
      notes: `${merchantTransaction.notes || ''}\nMerchant share not applicable (${context}).`.trim()
    });
    merchantTransaction = null;
  }

  let driverWallet = null;
  if (driverId && driverPayAmount > 0.009 && paymentCompleted) {
    driverWallet = await db.DriverWallet.findOne({ where: { driverId } });
    if (!driverWallet) {
      driverWallet = await db.DriverWallet.create({
        driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0
      });
    }

    const driverPayload = {
      paymentMethod: driverTransaction?.paymentMethod || paymentMethod,
      paymentProvider: driverTransaction?.paymentProvider || paymentProvider,
      amount: driverPayAmount,
      status: targetStatus,
      paymentStatus: targetPaymentStatus,
      receiptNumber: receiptNumber || (paymentCompleted ? driverTransaction?.receiptNumber : null) || null,
      checkoutRequestID: checkoutRequestID || driverTransaction?.checkoutRequestID || merchantTransaction?.checkoutRequestID || null,
      merchantRequestID: merchantRequestID || driverTransaction?.merchantRequestID || merchantTransaction?.merchantRequestID || null,
      phoneNumber: phoneNumber || driverTransaction?.phoneNumber || merchantTransaction?.phoneNumber || null,
      transactionDate: paymentCompleted
        ? (transactionDate || driverTransaction?.transactionDate || merchantTransaction?.transactionDate || new Date())
        : (driverTransaction?.transactionDate || null),
      driverId,
      driverWalletId: driverWallet.id,
      notes: `Driver delivery fee payment for Order #${orderId} (${context}). Amount: KES ${driverPayAmount.toFixed(2)}.${paymentCompleted ? '' : ' Pending payment confirmation.'}`
    };

    if (driverTransaction) {
      await driverTransaction.update(driverPayload);
    } else {
      driverTransaction = await db.Transaction.create({
        orderId,
        transactionType: 'delivery_pay',
        ...driverPayload
      });
    }

    await orderModel.update({
      driverPayCredited: true,
      driverPayCreditedAt: transactionDate || new Date(),
      driverPayAmount
    });

    if ((!orderModel.driverPayAmount || Math.abs(toNumeric(orderModel.driverPayAmount) - driverPayAmount) > 0.009)) {
      await orderModel.update({ driverPayAmount });
    }
  } else if (driverId && driverPayAmount > 0.009) {
    const driverPayload = {
      paymentMethod,
      paymentProvider,
      amount: driverPayAmount,
      status: targetStatus,
      paymentStatus: targetPaymentStatus,
      receiptNumber: null,
      checkoutRequestID,
      merchantRequestID,
      phoneNumber,
      transactionDate: null,
      driverId,
      driverWalletId: null,
      notes: `Driver delivery fee payment for Order #${orderId} (${context}). Amount: KES ${driverPayAmount.toFixed(2)}. Pending payment confirmation.`
    };

    if (driverTransaction) {
      await driverTransaction.update(driverPayload);
    } else {
      driverTransaction = await db.Transaction.create({
        orderId,
        transactionType: 'delivery_pay',
        ...driverPayload
      });
    }

    if ((!orderModel.driverPayAmount || Math.abs(toNumeric(orderModel.driverPayAmount) - driverPayAmount) > 0.009)) {
      await orderModel.update({ driverPayAmount });
    }
  } else if (driverTransaction && driverTransaction.status !== 'cancelled') {
    await driverTransaction.update({
      status: 'cancelled',
      paymentStatus: 'cancelled',
      driverWalletId: null,
      driverId: null,
      amount: 0,
      notes: `${driverTransaction.notes || ''}\nDriver delivery fee not applicable (${context}).`.trim()
    });
    driverTransaction = null;
  }

  return {
    deliveryFee: deliveryFeeAmount,
    driverPayAmount,
    merchantAmount,
    driverTransactionId: driverTransaction?.id || null,
    merchantTransactionId: merchantTransaction?.id || null,
    driverWalletId: driverWallet?.id || null
  };
};

module.exports = {
  ensureDeliveryFeeSplit
};

