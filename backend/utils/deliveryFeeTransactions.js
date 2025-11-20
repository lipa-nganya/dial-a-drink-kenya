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
  const paymentType = orderModel.paymentType || 'pay_now';
  
  // CRITICAL: Skip POS orders - they don't have delivery fees
  const isPOSOrder = orderModel.deliveryAddress === 'In-Store Purchase';
  if (isPOSOrder) {
    // Cancel any existing delivery fee transactions for POS orders
    const existingDeliveryTransactions = await db.Transaction.findAll({
      where: {
        orderId,
        transactionType: 'delivery_pay'
      }
    });
    
    for (const existingTxn of existingDeliveryTransactions) {
      if (existingTxn.status !== 'cancelled') {
        await existingTxn.update({
          status: 'cancelled',
          paymentStatus: 'cancelled',
          amount: 0,
          notes: `${existingTxn.notes || ''}\nCancelled - POS orders do not have delivery fees.`.trim()
        });
        console.log(`✅ Cancelled delivery fee transaction #${existingTxn.id} for POS Order #${orderId}`);
      }
    }
    
    return {
      skipped: true,
      reason: 'pos_order_no_delivery_fee',
      deliveryFee: 0
    };
  }
  
  // CRITICAL: For pay_now orders, don't manage driver transactions until driver is assigned
  // For pay_on_delivery orders, driver should already be assigned, so we can manage them
  const isPayNowWithoutDriver = paymentType === 'pay_now' && !driverId;

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

  // CRITICAL: If driver pay is disabled, driverPayAmount must be 0 (full delivery fee goes to merchant)
  let driverPayAmount = 0;
  
  if (driverPayEnabled) {
    // Only calculate driver pay if the feature is enabled
    driverPayAmount = toNumeric(orderModel.driverPayAmount);

    if ((!driverPayAmount || driverPayAmount < 0.009) && configuredDriverPay > 0) {
      driverPayAmount = Math.min(deliveryFeeAmount, configuredDriverPay);
    }

    if (driverPayAmount > deliveryFeeAmount) {
      driverPayAmount = deliveryFeeAmount;
    }
  }
  // If driverPayEnabled is false, driverPayAmount stays 0

  const merchantAmount = Math.max(deliveryFeeAmount - driverPayAmount, 0);

  const deliveryTransactions = await db.Transaction.findAll({
    where: { orderId, transactionType: 'delivery_pay' },
    order: [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC']
    ]
  });

  // Find driver transaction (must have driverId matching current driver)
  let driverTransaction = deliveryTransactions.find(
    (tx) => tx.driverId && driverId && tx.driverId === driverId
  );
  
  // Find merchant transaction (must have driverId: null AND driverWalletId: null)
  // This ensures we don't match driver transactions that haven't been linked yet
  let merchantTransaction = deliveryTransactions.find(
    (tx) => tx.driverId == null && tx.driverWalletId == null
  );

  // Clean up duplicate merchant transactions (keep the first one, cancel others)
  const merchantTransactions = deliveryTransactions.filter(
    (tx) => tx.driverId == null && tx.driverWalletId == null
  );
  if (merchantTransactions.length > 1) {
    console.log(`⚠️ Found ${merchantTransactions.length} merchant delivery transactions for Order #${orderId}, cleaning up duplicates...`);
    // Keep the first one (oldest), cancel the rest
    for (let i = 1; i < merchantTransactions.length; i++) {
      const duplicate = merchantTransactions[i];
      await duplicate.update({
        status: 'cancelled',
        paymentStatus: 'cancelled',
        amount: 0,
        notes: `${duplicate.notes || ''}\nDuplicate transaction cancelled (${context}).`.trim()
      });
      console.log(`   Cancelled duplicate merchant transaction #${duplicate.id}`);
    }
    merchantTransaction = merchantTransactions[0];
  }

  // Don't convert merchant transactions to driver transactions
  // Driver transactions should be created separately

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
      // CRITICAL: Don't cancel merchant transactions that are already completed/paid
      // Only update if not cancelled and payment is completed
      if (merchantTransaction.status === 'cancelled' && paymentCompleted) {
        // Reactivate cancelled merchant transaction if payment is completed
        await merchantTransaction.update(merchantPayload);
        console.log(`✅ Reactivated cancelled merchant transaction #${merchantTransaction.id} for Order #${orderId} (payment completed)`);
      } else if (merchantTransaction.status !== 'cancelled') {
        // CRITICAL: Don't overwrite completed merchant transactions if payment is already completed
        // This prevents ensureDeliveryFeeSplit from overwriting transactions finalized by finalizeOrderPayment
        // Only update if the transaction is not already completed, or if amounts don't match significantly
        const currentAmount = toNumeric(merchantTransaction.amount);
        const amountMismatch = Math.abs(currentAmount - merchantAmount) > 0.009;
        const isNotCompleted = merchantTransaction.status !== 'completed' || merchantTransaction.paymentStatus !== 'paid';
        
        if (isNotCompleted || amountMismatch) {
          await merchantTransaction.update(merchantPayload);
        } else {
          console.log(`ℹ️  Merchant transaction #${merchantTransaction.id} already finalized for Order #${orderId} (skipping update)`);
        }
      }
    } else {
      merchantTransaction = await db.Transaction.create({
        orderId,
        transactionType: 'delivery_pay',
        ...merchantPayload
      });
    }
  } else if (merchantTransaction && merchantTransaction.status !== 'cancelled') {
    // CRITICAL: Only cancel merchant transaction if payment is NOT completed
    // If payment is completed, merchant should always get their share (even if 0, keep transaction)
    if (!paymentCompleted) {
      await merchantTransaction.update({
        status: 'cancelled',
        paymentStatus: 'cancelled',
        amount: 0,
        driverId: null,
        driverWalletId: null,
        notes: `${merchantTransaction.notes || ''}\nMerchant share not applicable (${context}).`.trim()
      });
      merchantTransaction = null;
    } else {
      // Payment completed but merchantAmount is 0 - this shouldn't happen, but keep transaction
      console.warn(`⚠️  Warning: Payment completed but merchantAmount is 0 for Order #${orderId}. Keeping merchant transaction.`);
    }
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

    // CRITICAL: Check both transaction state AND order flag to prevent double crediting
    // This is especially important for pay_now orders where finalizeOrderPayment already credited the wallet
    const wasAlreadyCredited = (driverTransaction?.driverWalletId === driverWallet.id && 
                                driverTransaction?.status === 'completed' &&
                                driverTransaction?.driverId === driverId) ||
                                orderModel.driverPayCredited;

    if (driverTransaction) {
      // Only update transaction if it's not already completed and linked to wallet
      // This prevents overwriting transactions that were finalized by finalizeOrderPayment
      if (!wasAlreadyCredited || driverTransaction.status !== 'completed' || driverTransaction.driverWalletId !== driverWallet.id) {
        await driverTransaction.update(driverPayload);
        await driverTransaction.reload();
      } else {
        console.log(`ℹ️  Driver transaction #${driverTransaction.id} already finalized for Order #${orderId} (skipping update)`);
      }
    } else {
      // CRITICAL: Double-check that no driver delivery transaction exists before creating
      // This prevents duplicates when finalizeOrderPayment already created one
      const existingDriverTxn = await db.Transaction.findOne({
        where: {
          orderId,
          transactionType: 'delivery_pay',
          driverId
        },
        order: [['createdAt', 'DESC']]
      });
      
      if (existingDriverTxn) {
        console.log(`⚠️  Found existing driver delivery transaction #${existingDriverTxn.id} for Order #${orderId}. Using it instead of creating duplicate.`);
        driverTransaction = existingDriverTxn;
        // Update it if needed
        if (!wasAlreadyCredited || driverTransaction.status !== 'completed' || driverTransaction.driverWalletId !== driverWallet.id) {
          await driverTransaction.update(driverPayload);
          await driverTransaction.reload();
        }
      } else {
        // CRITICAL: DO NOT create driver delivery transactions here!
        // Driver delivery transactions should ONLY be created by creditWalletsOnDeliveryCompletion
        // when delivery is completed. Creating them here causes duplicates (e.g., transaction 252, 253).
        // 
        // This function (ensureDeliveryFeeSplit) is only for syncing merchant delivery fee transactions
        // and ensuring order.driverPayAmount is set correctly.
        // 
        // The creditWalletsOnDeliveryCompletion function will handle creation when the order is completed.
        console.log(`ℹ️  Skipping driver delivery transaction creation for Order #${orderId} (pay_on_delivery) - will be created by creditWalletsOnDeliveryCompletion on delivery completion`);
      }
    }

    // CRITICAL: DO NOT credit driver wallet here!
    // Driver wallet crediting should ONLY happen in creditWalletsOnDeliveryCompletion
    // when delivery is completed. Crediting here causes duplicates and credits drivers before delivery.
    // 
    // This function (ensureDeliveryFeeSplit) is only for syncing merchant delivery fee transactions
    // and ensuring order.driverPayAmount is set correctly.
    // 
    // The creditWalletsOnDeliveryCompletion function will handle wallet crediting when the order is completed.
    console.log(`ℹ️  Skipping driver wallet credit for Order #${orderId} - will be credited by creditWalletsOnDeliveryCompletion on delivery completion`);
    
    // OLD CODE REMOVED - DO NOT CREDIT WALLET HERE
    // Wallet crediting is now handled by creditWalletsOnDeliveryCompletion when delivery is completed
    // The following code was removed to prevent duplicate wallet credits:
    // 
    // if (!wasAlreadyCredited && paymentCompleted) {
    //   const oldBalance = toNumeric(driverWallet.balance);
    //   const oldTotalDeliveryPay = toNumeric(driverWallet.totalDeliveryPay);
    //   const oldCount = driverWallet.totalDeliveryPayCount || 0;
    //   await driverWallet.update({
    //     balance: oldBalance + driverPayAmount,
    //     totalDeliveryPay: oldTotalDeliveryPay + driverPayAmount,
    //     totalDeliveryPayCount: oldCount + 1
    //   });
    //   await driverWallet.reload();
    //   await orderModel.update({
    //     driverPayCredited: true,
    //     driverPayCreditedAt: transactionDate || new Date(),
    //     driverPayAmount
    //   });
    // }

    if ((!orderModel.driverPayAmount || Math.abs(toNumeric(orderModel.driverPayAmount) - driverPayAmount) > 0.009)) {
      await orderModel.update({ driverPayAmount });
    }
  } else if (driverId && driverPayAmount > 0.009) {
    // CRITICAL: DO NOT create driver delivery transactions here!
    // Driver delivery transactions should ONLY be created by creditWalletsOnDeliveryCompletion
    // when delivery is completed. Creating them here causes duplicates (e.g., transaction 224).
    // 
    // This function (ensureDeliveryFeeSplit) is only for syncing merchant delivery fee transactions
    // and ensuring order.driverPayAmount is set correctly.
    // 
    // If a driver transaction already exists, we can update its amount if needed, but we should
    // NOT create new ones. The creditWalletsOnDeliveryCompletion function will handle creation
    // when the order is completed.
    
    if (driverTransaction) {
      // Only update if amount changed significantly - don't overwrite status/details
      const currentAmount = toNumeric(driverTransaction.amount);
      const amountMismatch = Math.abs(currentAmount - driverPayAmount) > 0.009;
      
      if (amountMismatch && driverTransaction.status !== 'completed') {
        // Only update amount for pending transactions, don't touch completed ones
        await driverTransaction.update({
          amount: driverPayAmount,
          notes: `Driver delivery fee payment for Order #${orderId} (${context}). Amount: KES ${driverPayAmount.toFixed(2)}. Pending delivery completion.`
        });
        console.log(`⚠️  Updated pending driver delivery transaction #${driverTransaction.id} amount for Order #${orderId} (will be finalized on delivery completion)`);
      }
    } else {
      // Don't create driver delivery transactions here - they'll be created on delivery completion
      console.log(`ℹ️  Skipping driver delivery transaction creation for Order #${orderId} - will be created by creditWalletsOnDeliveryCompletion on delivery completion`);
    }

    // Still update order.driverPayAmount for tracking
    if ((!orderModel.driverPayAmount || Math.abs(toNumeric(orderModel.driverPayAmount) - driverPayAmount) > 0.009)) {
      await orderModel.update({ driverPayAmount });
    }
  } else if (!isPayNowWithoutDriver && driverTransaction && driverTransaction.status !== 'cancelled') {
    // Only cancel driver transactions if:
    // 1. NOT a pay_now order without driver (leave those alone until driver is assigned)
    // 2. Driver transaction exists and isn't already cancelled
    // This handles pay_on_delivery orders where driver pay is disabled
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
  // For pay_now orders without driver: Leave driver transactions alone until driver is assigned

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

