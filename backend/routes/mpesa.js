const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesa');
const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { ensureDeliveryFeeSplit } = require('../utils/deliveryFeeTransactions');
const pushNotifications = require('../services/pushNotifications');
const { getOrCreateHoldDriver } = require('../utils/holdDriver');

const finalizeOrderPayment = async ({ orderId, paymentTransaction, receiptNumber, req, context = 'Payment confirmation' }) => {
  if (!paymentTransaction) {
    throw new Error('Payment transaction is required to finalize payment');
  }

  const effectiveOrderId = orderId || paymentTransaction.orderId;
  const orderInstance = await db.Order.findByPk(effectiveOrderId);
  if (!orderInstance) {
    throw new Error(`Order ${effectiveOrderId} not found during payment finalization`);
  }

  const orderWasPreviouslyPaid = orderInstance.paymentStatus === 'paid';

  if (paymentTransaction.status === 'completed' && paymentTransaction.paymentStatus === 'paid' && orderWasPreviouslyPaid) {
    await paymentTransaction.reload().catch(() => {});
    return { order: orderInstance, receipt: paymentTransaction.receiptNumber };
  }

  const breakdown = await getOrderFinancialBreakdown(effectiveOrderId);
  const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
  const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
  const tipAmountNumeric = parseFloat(breakdown.tipAmount) || 0;

  const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
    db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
    db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
  ]);

  const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
  const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
  
  // CRITICAL: Use same calculation logic as ensureDeliveryFeeSplit to avoid mismatches
  // First check orderInstance.driverPayAmount, then fall back to configuredDriverPayAmount
  let driverPayAmount = 0;
  if (driverPaySettingEnabled && orderInstance.driverId) {
    driverPayAmount = parseFloat(orderInstance.driverPayAmount || '0');
    
    if ((!driverPayAmount || driverPayAmount < 0.009) && configuredDriverPayAmount > 0) {
      driverPayAmount = Math.min(deliveryFee, configuredDriverPayAmount);
    }
    
    if (driverPayAmount > deliveryFee) {
      driverPayAmount = deliveryFee;
    }
  }
  // If driverPayEnabled is false or no driver, driverPayAmount stays 0
  
  const merchantDeliveryAmount = Math.max(deliveryFee - driverPayAmount, 0);

  const normalizedReceipt = receiptNumber || paymentTransaction.receiptNumber;

  if (!normalizedReceipt) {
    throw new Error('Missing M-Pesa receipt number; cannot finalize payment without Safaricom confirmation.');
  }

  const initialTransactionDate = paymentTransaction.transactionDate || null;
  const transactionTimestamp = initialTransactionDate
    ? new Date(initialTransactionDate)
    : new Date();
  const paymentMethod = paymentTransaction.paymentMethod || orderInstance.paymentMethod || 'mobile_money';
  const paymentProvider = paymentTransaction.paymentProvider || 'mpesa';

  await paymentTransaction.update({
    amount: itemsTotal,
    status: 'completed',
    paymentStatus: 'paid',
    receiptNumber: normalizedReceipt,
    transactionDate: transactionTimestamp
  });
  await paymentTransaction.reload().catch(() => {});

  const resolvedTransactionDate = paymentTransaction.transactionDate
    ? new Date(paymentTransaction.transactionDate)
    : transactionTimestamp;

  // Find merchant delivery transaction (must have driverId: null AND driverWalletId: null)
  // This ensures we don't match driver transactions
  let merchantDeliveryTransaction = await db.Transaction.findOne({
    where: {
      orderId: effectiveOrderId,
      transactionType: 'delivery_pay',
      driverId: null,
      driverWalletId: null
    },
    order: [['createdAt', 'ASC']] // Get the first one if multiple exist
  });

  const deliveryNotes = driverPayAmount > 0
    ? `Delivery fee for Order #${effectiveOrderId} (${context}) - merchant share KES ${merchantDeliveryAmount.toFixed(2)}, driver payout pending KES ${driverPayAmount.toFixed(2)}.`
    : `Delivery fee for Order #${effectiveOrderId} (${context})`;

  if (merchantDeliveryTransaction) {
    await merchantDeliveryTransaction.update({
      amount: merchantDeliveryAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: normalizedReceipt,
      transactionDate: resolvedTransactionDate,
      notes: deliveryNotes,
      driverId: null,
      driverWalletId: null
    });
  } else {
    merchantDeliveryTransaction = await db.Transaction.create({
      orderId: effectiveOrderId,
      transactionType: 'delivery_pay',
      paymentMethod,
      paymentProvider,
      amount: merchantDeliveryAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: normalizedReceipt,
      checkoutRequestID: paymentTransaction.checkoutRequestID,
      merchantRequestID: paymentTransaction.merchantRequestID,
      phoneNumber: paymentTransaction.phoneNumber,
      transactionDate: resolvedTransactionDate,
      notes: deliveryNotes,
      driverId: null,
      driverWalletId: null
    });
  }

  let driverDeliveryTransaction = null;
  if (driverPayAmount > 0.009 && orderInstance.driverId) {
    // CRITICAL: Check for ANY existing driver delivery transaction for this order and driver
    // Check by driverId first (most specific)
    driverDeliveryTransaction = await db.Transaction.findOne({
      where: {
        orderId: effectiveOrderId,
        transactionType: 'delivery_pay',
        driverId: orderInstance.driverId
      },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
    });
    
    // If not found, check for pending transaction with null driverId (created before driver assignment)
    if (!driverDeliveryTransaction) {
      driverDeliveryTransaction = await db.Transaction.findOne({
        where: {
          orderId: effectiveOrderId,
          transactionType: 'delivery_pay',
          driverId: null,
          driverWalletId: null // Must be merchant transaction, not driver transaction
        },
        order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
      });
    }

    const driverDeliveryPayload = {
      orderId: effectiveOrderId,
      transactionType: 'delivery_pay',
      paymentMethod,
      paymentProvider,
      amount: driverPayAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: normalizedReceipt,
      checkoutRequestID: paymentTransaction.checkoutRequestID,
      merchantRequestID: paymentTransaction.merchantRequestID,
      phoneNumber: paymentTransaction.phoneNumber,
      transactionDate: resolvedTransactionDate,
      driverId: orderInstance.driverId,
      notes: `Driver delivery fee payment for Order #${effectiveOrderId} (${context}).`
    };

    if (driverDeliveryTransaction) {
      // Found existing transaction - update it instead of creating duplicate
      await driverDeliveryTransaction.update(driverDeliveryPayload);
      // Reload transaction to get updated values
      await driverDeliveryTransaction.reload();
      console.log(`✅ Updated existing driver delivery transaction #${driverDeliveryTransaction.id} for Order #${effectiveOrderId}`);
    } else {
      // No driver delivery transaction exists - safe to create new one
      driverDeliveryTransaction = await db.Transaction.create(driverDeliveryPayload);
      console.log(`✅ Created driver delivery transaction #${driverDeliveryTransaction.id} for Order #${effectiveOrderId}`);
    }

    try {
      // Check if wallet was already credited (check order flag first to avoid double crediting)
      if (!orderInstance.driverPayCredited) {
        let driverWallet = await db.DriverWallet.findOne({ where: { driverId: orderInstance.driverId } });
        if (!driverWallet) {
          driverWallet = await db.DriverWallet.create({
            driverId: orderInstance.driverId,
            balance: 0,
            totalTipsReceived: 0,
            totalTipsCount: 0,
            totalDeliveryPay: 0,
            totalDeliveryPayCount: 0
          });
        }

        const alreadyCredited =
          driverDeliveryTransaction.driverWalletId === driverWallet.id && driverDeliveryTransaction.status === 'completed';

        if (!alreadyCredited) {
          const oldBalance = parseFloat(driverWallet.balance) || 0;
          const oldTotalDeliveryPay = parseFloat(driverWallet.totalDeliveryPay || 0);
          const oldCount = driverWallet.totalDeliveryPayCount || 0;
          
          await driverWallet.update({
            balance: oldBalance + driverPayAmount,
            totalDeliveryPay: oldTotalDeliveryPay + driverPayAmount,
            totalDeliveryPayCount: oldCount + 1
          });

          await driverDeliveryTransaction.update({
            driverWalletId: driverWallet.id,
            status: 'completed',
            paymentStatus: 'paid',
            notes: `Driver delivery fee payment for Order #${effectiveOrderId} (${context}) - credited to driver wallet`
          });
          
          // Reload wallet to get updated balance
          await driverWallet.reload();
          
          console.log(`✅ Delivery pay credited for Order #${effectiveOrderId}:`);
          console.log(`   Amount: KES ${driverPayAmount.toFixed(2)}`);
          console.log(`   Wallet balance: ${oldBalance.toFixed(2)} → ${parseFloat(driverWallet.balance).toFixed(2)}`);
          console.log(`   Total delivery pay: ${oldTotalDeliveryPay.toFixed(2)} → ${parseFloat(driverWallet.totalDeliveryPay).toFixed(2)}`);
          console.log(`   Delivery pay count: ${oldCount} → ${driverWallet.totalDeliveryPayCount}`);

          await orderInstance.update({
            driverPayCredited: true,
            driverPayCreditedAt: resolvedTransactionDate,
            driverPayAmount: driverPayAmount
          });

          const driver = await db.Driver.findByPk(orderInstance.driverId).catch(() => null);
          
          // Emit socket event to notify driver about delivery pay
          const io = req?.app?.get('io');
          if (io) {
            io.to(`driver-${orderInstance.driverId}`).emit('delivery-pay-received', {
              orderId: effectiveOrderId,
              amount: driverPayAmount,
              customerName: orderInstance.customerName,
              walletBalance: parseFloat(driverWallet.balance)
            });
            console.log(`📬 Delivery pay notification sent to driver #${orderInstance.driverId} for Order #${effectiveOrderId}`);
          }
          
          if (driver?.pushToken) {
            pushNotifications.sendPushNotification(driver.pushToken, {
              title: 'Delivery Fee Payment',
              body: `KES ${driverPayAmount.toFixed(2)} for Order #${effectiveOrderId} has been added to your wallet.`,
              data: {
                type: 'delivery_pay',
                orderId: effectiveOrderId,
                amount: driverPayAmount
              }
            }).catch((pushError) => {
              console.error('❌ Error sending delivery fee payment push notification (finalizeOrderPayment):', pushError);
            });
          }
        } else {
          console.log(`ℹ️ Delivery pay already credited for Order #${effectiveOrderId} (transaction already linked to wallet)`);
        }
      } else {
        console.log(`ℹ️ Delivery pay already credited for Order #${effectiveOrderId} (order flag set)`);
      }
    } catch (driverPayError) {
      console.error('❌ Error crediting delivery fee payment during payment finalization:', driverPayError);
    }
  } else if (driverPayAmount > 0.009) {
    driverDeliveryTransaction = await db.Transaction.findOne({
      where: {
        orderId: effectiveOrderId,
        transactionType: 'delivery_pay',
        driverId: null,
        paymentStatus: 'pending'
      },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
    });

    const pendingDriverPayload = {
      orderId: effectiveOrderId,
      transactionType: 'delivery_pay',
      paymentMethod,
      paymentProvider,
      amount: driverPayAmount,
      status: 'pending',
      paymentStatus: 'pending',
      receiptNumber: normalizedReceipt,
      checkoutRequestID: paymentTransaction.checkoutRequestID,
      merchantRequestID: paymentTransaction.merchantRequestID,
      phoneNumber: paymentTransaction.phoneNumber,
      transactionDate: resolvedTransactionDate,
      driverId: null,
      driverWalletId: null,
      notes: `Driver delivery fee payment for Order #${effectiveOrderId} (${context}) - pending driver assignment.`
    };

    if (driverDeliveryTransaction) {
      await driverDeliveryTransaction.update(pendingDriverPayload);
    } else {
      driverDeliveryTransaction = await db.Transaction.create(pendingDriverPayload);
    }
  } else {
    // If no driver delivery payment is due, cancel any lingering driver-specific delivery payments to avoid confusion
    const existingDriverDeliveryTransaction = await db.Transaction.findOne({
      where: {
        orderId: effectiveOrderId,
        transactionType: 'delivery_pay',
        driverId: {
          [Op.not]: null
        }
      },
      order: [['createdAt', 'DESC']]
    });

    if (existingDriverDeliveryTransaction && existingDriverDeliveryTransaction.status !== 'cancelled') {
      await existingDriverDeliveryTransaction.update({
        status: 'cancelled',
        paymentStatus: 'cancelled',
        amount: 0,
        notes: `${existingDriverDeliveryTransaction.notes || ''}\nDriver delivery fee payment disabled or no driver assigned.`.trim()
      });
    }
  }

  let tipTransaction = null;
  if (tipAmountNumeric > 0.009) {
    tipTransaction = await db.Transaction.findOne({
      where: {
        orderId: effectiveOrderId,
        transactionType: 'tip'
      }
    });

    // CRITICAL: Always assign tip to the order's current driver (usually HOLD driver at payment time)
    // This ensures tip is assigned even if no real driver is assigned yet
    const tipDriverId = orderInstance.driverId;
    
    // Get driver wallet (will be HOLD driver's wallet if no real driver assigned)
    let driverWallet = null;
    if (tipDriverId) {
      driverWallet = await db.DriverWallet.findOne({ where: { driverId: tipDriverId } });
      if (!driverWallet) {
        driverWallet = await db.DriverWallet.create({
          driverId: tipDriverId,
          balance: 0,
          totalTipsReceived: 0,
          totalTipsCount: 0,
          totalDeliveryPay: 0,
          totalDeliveryPayCount: 0
        });
      }
    }

    const tipPayload = {
      orderId: effectiveOrderId,
      transactionType: 'tip',
      paymentMethod,
      paymentProvider,
      amount: tipAmountNumeric,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: normalizedReceipt,
      checkoutRequestID: paymentTransaction.checkoutRequestID,
      merchantRequestID: paymentTransaction.merchantRequestID,
      phoneNumber: paymentTransaction.phoneNumber,
      transactionDate: resolvedTransactionDate,
      driverId: tipDriverId,
      driverWalletId: driverWallet?.id || null,
      notes: `Tip for Order #${effectiveOrderId} (${context})${tipDriverId ? ' - assigned to driver' : ''}`
    };

    if (tipTransaction) {
      await tipTransaction.update(tipPayload);
    } else {
      tipTransaction = await db.Transaction.create(tipPayload);
    }

    // Credit driver wallet (HOLD driver's wallet if no real driver assigned yet)
    if (tipDriverId && driverWallet) {
      try {
        const driver = await db.Driver.findByPk(tipDriverId).catch(() => null);
        const { driver: holdDriver } = await getOrCreateHoldDriver();
        const isHoldDriver = tipDriverId === holdDriver.id;

        const tipAlreadyCredited =
          tipTransaction.driverWalletId === driverWallet.id && tipTransaction.status === 'completed';

        if (!tipAlreadyCredited) {
          await driverWallet.update({
            balance: parseFloat(driverWallet.balance) + tipAmountNumeric,
            totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + tipAmountNumeric,
            totalTipsCount: driverWallet.totalTipsCount + 1
          });

          await tipTransaction.update({
            driverId: tipDriverId,
            driverWalletId: driverWallet.id,
            paymentStatus: 'paid',
            status: 'completed',
            notes: `Tip for Order #${effectiveOrderId} (${context})${isHoldDriver ? ' - assigned to HOLD driver (will transfer when real driver assigned)' : ' - credited to driver wallet'}`
          });

          // Only send push notification if NOT HOLD driver
          if (!isHoldDriver && driver?.pushToken) {
            pushNotifications.sendPushNotification(driver.pushToken, {
              title: 'Tip Received',
              body: `You received a tip of KES ${tipAmountNumeric.toFixed(2)} for Order #${effectiveOrderId}.`,
              data: {
                type: 'tip',
                orderId: effectiveOrderId,
                amount: tipAmountNumeric
              }
            }).catch((pushError) => {
              console.error('❌ Error sending tip push notification (finalizeOrderPayment):', pushError);
            });
          }
        }
      } catch (walletError) {
        console.error('⚠️ Failed to credit tip to driver wallet:', walletError);
      }
    }
  }

  const orderUpdatePayload = {
    paymentStatus: 'paid',
    status: orderInstance.status === 'pending' ? 'confirmed' : orderInstance.status
  };

  if (driverPayAmount > 0.009) {
    orderUpdatePayload.driverPayAmount = driverPayAmount;
  }

  await orderInstance.update(orderUpdatePayload);

  await orderInstance.reload({
    include: [
      {
        model: db.OrderItem,
        as: 'orderItems',
        include: [{ model: db.Drink, as: 'drink' }]
      },
      {
        model: db.Transaction,
        as: 'transactions'
      },
      {
        model: db.Driver,
        as: 'driver'
      }
    ]
  }).catch(() => {});

  const io = req?.app?.get('io');
  if (io) {
    const paymentConfirmedAt = new Date().toISOString();
    const payload = {
      orderId: orderInstance.id,
      status: orderInstance.status,
      paymentStatus: 'paid',
      receiptNumber: normalizedReceipt,
      transactionId: paymentTransaction.id,
      transactionStatus: 'completed',
      paymentConfirmedAt,
      order: orderInstance.toJSON ? orderInstance.toJSON() : orderInstance,
      message: `Payment confirmed for Order #${orderInstance.id}`
    };

    io.to(`order-${orderInstance.id}`).emit('payment-confirmed', payload);

    if (orderInstance.driverId) {
      io.to(`driver-${orderInstance.driverId}`).emit('payment-confirmed', payload);
    }

    io.to('admin').emit('payment-confirmed', {
      ...payload,
      message: `${context} for Order #${orderInstance.id}`
    });
  }

  if (!orderWasPreviouslyPaid) {
    try {
      let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
      if (!adminWallet) {
        adminWallet = await db.AdminWallet.create({
          id: 1,
          balance: 0,
          totalRevenue: 0,
          totalOrders: 0
        });
      }

      const adminCreditAmount = Math.max(itemsTotal + merchantDeliveryAmount, 0);

      await adminWallet.update({
        balance: parseFloat(adminWallet.balance) + adminCreditAmount,
        totalRevenue: parseFloat(adminWallet.totalRevenue) + adminCreditAmount,
        totalOrders: adminWallet.totalOrders + 1
      });

      console.log(`✅ Credited admin wallet with KES ${adminCreditAmount.toFixed(2)} for Order #${orderInstance.id}`);
    } catch (adminWalletError) {
      console.error('❌ Error crediting admin wallet during finalizeOrderPayment:', adminWalletError);
    }
  }

  try {
    await ensureDeliveryFeeSplit(orderInstance, { context: 'mpesa-finalize' });
  } catch (syncError) {
    console.error('❌ Error syncing delivery fee transactions (finalizeOrderPayment):', syncError);
  }

  return {
    order: orderInstance,
    receipt: normalizedReceipt,
    deliveryTransaction,
      driverPayTransaction: driverDeliveryTransaction,
    tipTransaction
  };
};

// Helper function to calculate delivery fee (same as in orders.js)
const calculateDeliveryFee = async (orderId) => {
  try {
    const order = await db.Order.findByPk(orderId, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink',
          include: [{
            model: db.Category,
            as: 'category'
          }]
        }]
      }]
    });

    if (!order || !order.items) {
      return 50; // Default fee
    }

    // Get delivery settings
    const [testModeSetting, withAlcoholSetting, withoutAlcoholSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'deliveryTestMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeWithAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeWithoutAlcohol' } }).catch(() => null)
    ]);

    const isTestMode = testModeSetting?.value === 'true';
    
    if (isTestMode) {
      return 0;
    }

    const deliveryFeeWithAlcohol = parseFloat(withAlcoholSetting?.value || '50');
    const deliveryFeeWithoutAlcohol = parseFloat(withoutAlcoholSetting?.value || '30');

    // Check if all items are from Soft Drinks category
    const allSoftDrinks = order.items.every(item => 
      item.drink && item.drink.category && item.drink.category.name === 'Soft Drinks'
    );

    if (allSoftDrinks && order.items.length > 0) {
      return deliveryFeeWithoutAlcohol;
    }

    return deliveryFeeWithAlcohol;
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    return 50; // Default fee
  }
};

/**
 * Initiate M-Pesa STK Push for payment
 */
router.post('/stk-push', async (req, res) => {
  try {
    const { phoneNumber, amount, orderId, accountReference } = req.body;

    if (!phoneNumber || !amount || !orderId) {
      return res.status(400).json({ 
        error: 'Missing required fields: phoneNumber, amount, orderId' 
      });
    }

    // Validate order exists
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Validate amount matches order total (customer pays full amount including tip)
    // Note: order.totalAmount includes tip, and customer pays the full amount
    // But we store payment transaction as totalAmount - tipAmount (tip is separate transaction)
    const tipAmount = parseFloat(order.tipAmount) || 0;
    const expectedTotal = parseFloat(order.totalAmount); // Customer pays full amount
    
    if (Math.abs(parseFloat(amount) - expectedTotal) > 0.01) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected KES ${expectedTotal.toFixed(2)}, got KES ${parseFloat(amount).toFixed(2)}` 
      });
    }

    const testModeSetting = await db.Settings.findOne({ where: { key: 'deliveryTestMode' } }).catch(() => null);
    const isTestMode = testModeSetting?.value === 'true';
    
    // Determine if we should simulate payment
    // On Cloud Run, we want real payments unless explicitly in test mode
    // Check if we're on Cloud Run (GCP environment)
    const isCloudRun = process.env.K_SERVICE || process.env.GCP_PROJECT || false;
    const isProduction = process.env.NODE_ENV === 'production' || isCloudRun;
    
    // Only simulate if:
    // 1. Test mode is explicitly enabled in database, OR
    // 2. We're NOT in production/cloud AND FORCE_REAL_MPESA is not set to 'true'
    const shouldSimulatePayment = isTestMode || (!isProduction && process.env.FORCE_REAL_MPESA !== 'true');

    // Initiate STK Push
    const reference = accountReference || `ORDER-${orderId}`;
    const description = `Payment for Order #${orderId}`;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 Initiating STK Push with:', {
      phoneNumber,
      amount,
      reference,
      description,
      orderId,
      testMode: isTestMode,
      simulate: shouldSimulatePayment,
      isCloudRun: !!isCloudRun,
      isProduction: isProduction,
      NODE_ENV: process.env.NODE_ENV,
      FORCE_REAL_MPESA: process.env.FORCE_REAL_MPESA,
      MPESA_ENVIRONMENT: process.env.MPESA_ENVIRONMENT,
      K_SERVICE: process.env.K_SERVICE || 'not set',
      GCP_PROJECT: process.env.GCP_PROJECT || 'not set'
    });
    console.log('═══════════════════════════════════════════════════════');

    let stkResponse;
    if (shouldSimulatePayment) {
      stkResponse = {
        ResponseCode: '0',
        CustomerMessage: 'Test mode payment simulated. No STK push sent.',
        CheckoutRequestID: `TEST-${Date.now()}`,
        MerchantRequestID: `TESTMER-${Date.now()}`,
        RequestID: `TESTREQ-${Date.now()}`
      };
      console.log('🧪 Skipping real M-Pesa call - simulated response:', stkResponse);
    } else {
      stkResponse = await mpesaService.initiateSTKPush(
        phoneNumber,
        amount,
        reference,
        description
      );
    }

    console.log('STK Push response received:', JSON.stringify(stkResponse, null, 2));

    // Check if STK push was successful
    // M-Pesa returns ResponseCode as string '0' for success
    // Also check for errorCode or errorMessage
    const responseCode = stkResponse.ResponseCode || stkResponse.responseCode || stkResponse.errorCode;
    const errorMessage = stkResponse.errorMessage || stkResponse.errorDescription || stkResponse.errorMessage;
    const requestId = stkResponse.requestId || stkResponse.RequestID;
    const checkoutRequestID = stkResponse.CheckoutRequestID || stkResponse.checkoutRequestID;
    
    console.log('Response code:', responseCode);
    console.log('Error message:', errorMessage);
    console.log('Request ID:', requestId);
    console.log('CheckoutRequestID:', checkoutRequestID);
    console.log('MerchantRequestID:', stkResponse.MerchantRequestID);
    console.log('CustomerMessage:', stkResponse.CustomerMessage);
    
    // Check if response indicates success (ResponseCode === '0' means success)
    // Even if ResponseCode is not '0', if we have CheckoutRequestID, it might still be successful
    // M-Pesa sandbox sometimes returns different response formats
    const hasCheckoutRequestID = !!checkoutRequestID;
    const isSuccessCode = responseCode === '0' || responseCode === 0;
    
    console.log('Has CheckoutRequestID:', hasCheckoutRequestID);
    console.log('Is success code:', isSuccessCode);
    
      if (isSuccessCode || hasCheckoutRequestID) {
      // Update order with M-Pesa transaction details
      const checkoutRequestID = stkResponse.CheckoutRequestID || stkResponse.checkoutRequestID;
      
      // Store checkout request ID and also store it in a way that's easy to find
      const checkoutNote = `M-Pesa CheckoutRequestID: ${checkoutRequestID}`;
      await order.update({
        paymentMethod: 'mobile_money',
        // Store checkout request ID for tracking (will be used by callback to find order)
        notes: order.notes ? 
          `${order.notes}\n${checkoutNote}` : 
          checkoutNote
      });
      
      const {
        itemsTotal,
        deliveryFee,
        tipAmount
      } = await getOrderFinancialBreakdown(order.id);

      const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
        db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
        db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
      ]);

      const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
      const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
      const driverPayAmount = driverPaySettingEnabled && order.driverId && configuredDriverPayAmount > 0
        ? Math.min(deliveryFee, configuredDriverPayAmount)
        : 0;
      const merchantDeliveryAmount = Math.max(deliveryFee - driverPayAmount, 0);

      const baseTransactionPayload = {
          orderId: order.id,
          paymentMethod: 'mobile_money',
          paymentProvider: 'mpesa',
          status: 'pending',
        paymentStatus: 'pending',
          checkoutRequestID: checkoutRequestID,
          merchantRequestID: stkResponse.MerchantRequestID,
        phoneNumber: phoneNumber
      };

      try {
        const paymentNote = `STK Push initiated. ${stkResponse.CustomerMessage || ''} Order portion: KES ${itemsTotal.toFixed(2)}.${tipAmount > 0 ? ` Tip (KES ${tipAmount.toFixed(2)}) will be recorded separately.` : ''}`;

        // CRITICAL: Check for ANY existing payment transaction for this order FIRST
        // This prevents duplicates even if checkoutRequestID is different or null
        let paymentTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'payment'
          },
          order: [['createdAt', 'DESC']]
        });

        if (paymentTransaction) {
          // Found existing payment transaction - update it instead of creating duplicate
          console.log(`⚠️  Found existing payment transaction #${paymentTransaction.id} for Order #${orderId}. Updating it instead of creating duplicate.`);
          await paymentTransaction.update({
            ...baseTransactionPayload,
            amount: itemsTotal,
            notes: paymentNote,
            checkoutRequestID: checkoutRequestID // Update checkoutRequestID if it was missing
          });
          console.log(`✅ Payment transaction updated for Order #${orderId} (transaction #${paymentTransaction.id})`);
        } else {
          // No payment transaction exists - safe to create new one
          paymentTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'payment',
            amount: itemsTotal,
            notes: paymentNote
          });
          console.log(`✅ Payment transaction created for Order #${orderId} (transaction #${paymentTransaction.id})`);
        }

        const deliveryNote = driverPayAmount > 0
          ? `Delivery fee portion for Order #${orderId}. Merchant share: KES ${merchantDeliveryAmount.toFixed(2)}. Driver payout KES ${driverPayAmount.toFixed(2)} pending.`
          : `Delivery fee portion for Order #${orderId}. Amount: KES ${deliveryFee.toFixed(2)}. Included in same M-Pesa payment.`;

        let deliveryTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'delivery_pay',
            status: { [Op.ne]: 'completed' }
          },
          order: [['createdAt', 'DESC']]
        });

        if (deliveryTransaction) {
          await deliveryTransaction.update({
            ...baseTransactionPayload,
            amount: merchantDeliveryAmount,
            notes: deliveryNote,
            transactionType: 'delivery_pay'
          });
          console.log(`✅ Delivery fee transaction updated for Order #${orderId} (transaction #${deliveryTransaction.id})`);
        } else {
          deliveryTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'delivery_pay',
            amount: merchantDeliveryAmount,
            notes: deliveryNote
          });
          console.log(`✅ Delivery fee transaction created for Order #${orderId} (transaction #${deliveryTransaction.id})`);
        }

        if (driverPayAmount > 0 && order.driverId) {
          const driverDeliveryNote = `Driver delivery fee payment for Order #${orderId}. Amount: KES ${driverPayAmount.toFixed(2)}. Pending confirmation.`;

          // CRITICAL: Check for ANY existing driver delivery transaction for this order and driver
          // Don't filter by status - if one exists (even completed), update it instead of creating duplicate
          let driverDeliveryTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'delivery_pay',
              driverId: order.driverId
            },
            order: [['createdAt', 'DESC']]
          });

          const driverDeliveryPayload = {
            ...baseTransactionPayload,
            transactionType: 'delivery_pay',
            amount: driverPayAmount,
            notes: driverDeliveryNote,
            driverId: order.driverId,
            driverWalletId: null
          };

          if (driverDeliveryTransaction) {
            // Found existing driver delivery transaction - update it instead of creating duplicate
            await driverDeliveryTransaction.update(driverDeliveryPayload);
            console.log(`✅ Driver delivery fee transaction updated for Order #${orderId} (transaction #${driverDeliveryTransaction.id})`);
          } else {
            // No driver delivery transaction exists - safe to create new one
            driverDeliveryTransaction = await db.Transaction.create(driverDeliveryPayload);
            console.log(`✅ Driver delivery fee transaction created for Order #${orderId} (transaction #${driverDeliveryTransaction.id})`);
          }
        } else {
          const existingDriverDeliveryTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'delivery_pay',
              driverId: order.driverId || null
            },
            order: [['createdAt', 'DESC']]
          });

          if (existingDriverDeliveryTransaction) {
            await existingDriverDeliveryTransaction.update({
              status: 'cancelled',
              paymentStatus: 'cancelled',
              amount: 0,
              notes: `${existingDriverDeliveryTransaction.notes || ''}\nDriver delivery fee payment disabled or no driver assigned.`.trim()
            });
          }
        }

        if (shouldSimulatePayment) {
          try {
            console.log(`🧪 Test mode: auto finalizing payment for Order #${orderId}`);
            const paymentTransactionRecord = await db.Transaction.findOne({
              where: {
                orderId: order.id,
                transactionType: 'payment',
                checkoutRequestID: checkoutRequestID
              },
              order: [['updatedAt', 'DESC']]
            });

            if (paymentTransactionRecord) {
              await finalizeOrderPayment({
                orderId: order.id,
                paymentTransaction: paymentTransactionRecord,
                receiptNumber: `TEST-RECEIPT-${Date.now()}`,
                req,
                context: 'Test mode auto-payment'
              });
            } else {
              console.warn('⚠️ Test mode: payment transaction not found for auto-finalization');
            }
          } catch (finalizeError) {
            console.error('❌ Test mode auto-finalization failed:', finalizeError);
          }
        }
      } catch (transactionError) {
        console.error('❌ Error preparing order transactions:', transactionError);
        // Don't fail the STK push if transaction creation fails - log it but continue
        console.log('⚠️  Continuing with STK push despite transaction preparation error');
      }
      
      console.log(`✅ STK Push initiated for Order #${orderId}. CheckoutRequestID: ${checkoutRequestID}`);

      res.json({
        success: true,
        message: stkResponse.CustomerMessage || stkResponse.customerMessage || 'STK Push initiated successfully. Please check your phone to complete payment.',
        checkoutRequestID: checkoutRequestID,
        customerMessage: stkResponse.CustomerMessage || stkResponse.customerMessage,
        testMode: shouldSimulatePayment,
        response: stkResponse
      });
    } else {
      // Log the full response for debugging
      console.error('STK Push failed. Full response:', JSON.stringify(stkResponse, null, 2));
      res.status(400).json({
        success: false,
        error: errorMessage || 'Failed to initiate STK Push',
        responseCode: responseCode,
        response: stkResponse
      });
    }
  } catch (error) {
    console.error('❌ Error initiating M-Pesa STK Push:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to initiate payment',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * M-Pesa callback endpoint (called by Safaricom)
 */
/**
 * Get callback URL configuration (for debugging)
 */
router.get('/callback-url', async (req, res) => {
  try {
    const mpesaService = require('../services/mpesa');
    const callbackUrl = mpesaService.getMpesaCallbackUrl();
    
    res.json({
      callbackUrl: callbackUrl,
      environment: process.env.NODE_ENV || 'development',
      ngrokUrl: process.env.NGROK_URL || 'not set',
      mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || 'not set',
      message: 'Callback URL configuration'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get callback URL', message: error.message });
  }
});

/**
 * Debug endpoint to check recent callbacks received
 */
router.get('/callback-log', async (req, res) => {
  try {
    // Query recent transactions to see if any have receipt numbers
    const recentTransactions = await db.Transaction.findAll({
      where: {
        paymentProvider: 'mpesa',
        createdAt: {
          [db.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'status', 'customerName', 'customerPhone']
      }]
    });
    
    res.json({
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        orderId: t.orderId,
        checkoutRequestID: t.checkoutRequestID,
        status: t.status,
        receiptNumber: t.receiptNumber,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        order: t.order
      })),
      count: recentTransactions.length,
      message: 'Recent M-Pesa transactions (last 24 hours)'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get callback log', message: error.message });
  }
});

router.post('/callback', async (req, res) => {
  // CRITICAL: Respond to M-Pesa IMMEDIATELY (within 5 seconds)
  // M-Pesa will retry if response is slow or fails
  
  // Log that callback endpoint was hit
  console.log('🔔 CALLBACK ENDPOINT HIT - Timestamp:', new Date().toISOString());
  console.log('🔔 Request method:', req.method);
  console.log('🔔 Request URL:', req.url);
  console.log('🔔 Request headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    // Respond immediately
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received' });
    console.log('✅ Responded to M-Pesa callback with 200 OK');
  } catch (error) {
    console.error('❌ Error responding to callback:', error);
    if (!res.headersSent) {
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received' });
    }
  }
  
  // Process callback asynchronously (don't block the response)
  setImmediate(async () => {
    try {
      const callbackData = req.body;

      console.log('═══════════════════════════════════════════════════════');
      console.log('📞📞📞 M-Pesa Callback received at:', new Date().toISOString());
      console.log('═══════════════════════════════════════════════════════');
      console.log('Full callback data:', JSON.stringify(callbackData, null, 2));
      console.log('═══════════════════════════════════════════════════════');
      
      // Also log to a separate file for easier debugging
      console.log(`🎯 CALLBACK RECEIVED - Check backend logs above for processing details`);
      
      // Log the raw request body for debugging
      console.log('Raw request body:', JSON.stringify(req.body, null, 2));
      console.log('Request headers:', JSON.stringify(req.headers, null, 2));

    // M-Pesa callback structure:
    // {
    //   Body: {
    //     stkCallback: {
    //       MerchantRequestID: "...",
    //       CheckoutRequestID: "...",
    //       ResultCode: 0,
    //       ResultDesc: "The service request is processed successfully.",
    //       CallbackMetadata: {
    //         Item: [
    //           { Name: "Amount", Value: 1 },
    //           { Name: "MpesaReceiptNumber", Value: "..." },
    //           { Name: "TransactionDate", Value: "..." },
    //           { Name: "PhoneNumber", Value: "254..." }
    //         ]
    //       }
    //     }
    //   }
    // }

    if (callbackData.Body && callbackData.Body.stkCallback) {
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;

      // Find order by checkout request ID
      let order = null;
      
      console.log(`🔍 Looking for order with CheckoutRequestID: ${checkoutRequestID}`);
      
      // First try to find by checkoutRequestID in transactions table (most reliable)
      const transaction = await db.Transaction.findOne({
        where: {
          checkoutRequestID: checkoutRequestID
        },
        include: [{
          model: db.Order,
          as: 'order'
        }]
      });
      
      if (transaction && transaction.order) {
        order = transaction.order;
        console.log(`✅ Found order #${order.id} via transaction lookup`);
      } else {
        // Fallback: try to find by checkout request ID in order notes
        const orders = await db.Order.findAll({
          where: {
            notes: {
              [db.Sequelize.Op.like]: `%${checkoutRequestID}%`
            }
          }
        });

        if (orders.length > 0) {
          order = orders[0];
          console.log(`✅ Found order #${order.id} via notes lookup`);
        } else {
          // Fallback: try to find by MerchantRequestID if available
          const merchantRequestID = stkCallback.MerchantRequestID;
          if (merchantRequestID) {
            const ordersByMerchant = await db.Order.findAll({
              where: {
                notes: {
                  [db.Sequelize.Op.like]: `%${merchantRequestID}%`
                }
              },
              order: [['createdAt', 'DESC']],
              limit: 1
            });
            
            if (ordersByMerchant.length > 0) {
              order = ordersByMerchant[0];
              console.log(`✅ Found order #${order.id} by MerchantRequestID: ${merchantRequestID}`);
            }
          }
        }
      }
      
      // Last resort: find by recent pending transactions with matching checkoutRequestID
      if (!order) {
        console.log(`⚠️  Order not found by CheckoutRequestID, trying to find via recent transactions...`);
        const recentTransactions = await db.Transaction.findAll({
          where: {
            checkoutRequestID: checkoutRequestID
          },
          order: [['createdAt', 'DESC']],
          limit: 1
        });
        
        if (recentTransactions.length > 0 && recentTransactions[0].orderId) {
          order = await db.Order.findByPk(recentTransactions[0].orderId);
          if (order) {
            console.log(`✅ Found order #${order.id} via transaction orderId`);
          }
        }
      }

      // If order not found, try to find and update transaction directly by checkoutRequestID
      if (!order) {
        console.log(`⚠️  Order not found for CheckoutRequestID: ${checkoutRequestID}`);
        console.log(`   Attempting to find transaction directly and update it...`);
        
        // Find transaction by checkoutRequestID
        const transactionByCheckout = await db.Transaction.findOne({
          where: { checkoutRequestID: checkoutRequestID },
          include: [{
            model: db.Order,
            as: 'order'
          }]
        });
        
        if (transactionByCheckout && transactionByCheckout.order) {
          order = transactionByCheckout.order;
          console.log(`✅ Found order #${order.id} via transaction lookup`);
        } else if (transactionByCheckout && transactionByCheckout.orderId) {
          // Transaction exists but order association failed, fetch order directly
          order = await db.Order.findByPk(transactionByCheckout.orderId);
          if (order) {
            console.log(`✅ Found order #${order.id} via transaction orderId`);
          }
        }
      }
      
      if (order) {
        console.log(`✅ Found order #${order.id} for CheckoutRequestID: ${checkoutRequestID}`);
        console.log(`   Order current status: ${order.status}, paymentStatus: ${order.paymentStatus}`);

        const {
          itemsTotal,
          deliveryFee,
          tipAmount
        } = await getOrderFinancialBreakdown(order.id);

        if (resultCode === 0) {
          // Payment successful
          const callbackMetadata = stkCallback.CallbackMetadata || {};
          const items = callbackMetadata.Item || [];
          
          const receiptNumber = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
          const amount = items.find(item => item.Name === 'Amount')?.Value;
          const transactionDate = items.find(item => item.Name === 'TransactionDate')?.Value;
          const phoneNumber = items.find(item => item.Name === 'PhoneNumber')?.Value;

          console.log(`💰 Payment details from callback:`);
          console.log(`   Receipt: ${receiptNumber || 'N/A'}`);
          console.log(`   Amount: ${amount || 'N/A'}`);
          console.log(`   Phone: ${phoneNumber || 'N/A'}`);
          console.log(`   Transaction Date: ${transactionDate || 'N/A'}`);

          // CRITICAL: Check for ANY existing payment transaction for this order FIRST
          // This is the most reliable way to prevent duplicates - check by orderId + transactionType
          // Don't rely on checkoutRequestID alone as it might be null or different
          let transaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'payment' // CRITICAL: Only match payment transactions
            },
            order: [['createdAt', 'DESC']] // Get most recent one
          });
          
          console.log(`🔍 Transaction lookup by orderId + transactionType='payment': ${transaction ? `Found #${transaction.id} (status: ${transaction.status}, checkoutID: ${transaction.checkoutRequestID || 'N/A'})` : 'Not found'}`);
          
          // If found but checkoutRequestID doesn't match, update it
          if (transaction && checkoutRequestID && transaction.checkoutRequestID !== checkoutRequestID) {
            console.log(`⚠️  Found transaction #${transaction.id} but checkoutRequestID differs. Updating checkoutRequestID.`);
            await transaction.update({ checkoutRequestID });
          }
          
          // If not found by orderId, try by checkoutRequestID as fallback
          if (!transaction && checkoutRequestID) {
            transaction = await db.Transaction.findOne({
              where: {
                checkoutRequestID: checkoutRequestID,
                transactionType: 'payment'
              }
            });
            console.log(`🔍 Transaction lookup by checkoutRequestID + transactionType='payment': ${transaction ? `Found #${transaction.id} (status: ${transaction.status})` : 'Not found'}`);
          }

          if (!transaction) {
            // CRITICAL: Final check - if we still don't have a transaction, check one more time
            // This handles race conditions where transaction was just created
            // Use database transaction with lock to prevent concurrent creation
            const dbTransaction = await db.sequelize.transaction();
            
            try {
              // Final check within locked transaction
              const finalCheck = await db.Transaction.findOne({
                where: {
                  orderId: order.id,
                  transactionType: 'payment'
                },
                lock: dbTransaction.LOCK.UPDATE,
                transaction: dbTransaction
              });
              
              if (finalCheck) {
                console.log(`⚠️  Found existing payment transaction #${finalCheck.id} during final check. Using it instead of creating duplicate.`);
                transaction = finalCheck;
                // Update checkoutRequestID and receiptNumber if missing
                const updates = {};
                if (checkoutRequestID && !finalCheck.checkoutRequestID) updates.checkoutRequestID = checkoutRequestID;
                if (receiptNumber && !finalCheck.receiptNumber) updates.receiptNumber = receiptNumber;
                if (Object.keys(updates).length > 0) {
                  await finalCheck.update(updates, { transaction: dbTransaction });
                }
                await dbTransaction.commit();
              } else {
                // Truly no transaction exists - safe to create
                const paymentAmount = itemsTotal;
                
                console.log(`📝 Creating new transaction for Order #${order.id} with CheckoutRequestID: ${checkoutRequestID}`);
                console.log(`   Customer paid KES ${parseFloat(order.totalAmount).toFixed(2)} (items: KES ${itemsTotal.toFixed(2)}, delivery: KES ${deliveryFee.toFixed(2)}, tip: KES ${tipAmount.toFixed(2)})`);
                console.log(`   Creating item payment transaction: KES ${paymentAmount.toFixed(2)}`);
                
                transaction = await db.Transaction.create({
                  orderId: order.id,
                  transactionType: 'payment',
                  paymentMethod: 'mobile_money',
                  paymentProvider: 'mpesa',
                  amount: paymentAmount,
                  status: 'completed',
                  paymentStatus: 'paid',
                  receiptNumber: receiptNumber,
                  checkoutRequestID: checkoutRequestID,
                  merchantRequestID: stkCallback.MerchantRequestID,
                  phoneNumber: phoneNumber,
                  transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
                  notes: `Item payment via M-Pesa. Receipt: ${receiptNumber}. Breakdown: items KES ${paymentAmount.toFixed(2)}, delivery KES ${deliveryFee.toFixed(2)}, tip KES ${tipAmount.toFixed(2)} (tip recorded separately).`
                }, { transaction: dbTransaction });
                
                await dbTransaction.commit();
                console.log(`✅ Created transaction #${transaction.id} with status: ${transaction.status}`);
              }
            } catch (createError) {
              await dbTransaction.rollback();
              console.error(`❌ Error creating/checking transaction:`, createError);
              // Final recovery attempt
              transaction = await db.Transaction.findOne({
                where: {
                  orderId: order.id,
                  transactionType: 'payment'
                }
              });
              
              if (!transaction) {
                throw createError; // Re-throw if we can't recover
              }
              console.log(`✅ Found existing transaction #${transaction.id} after error recovery`);
            }
          } else {
            // Update existing transaction - ensure orderId is set if it wasn't
            const paymentAmount = itemsTotal;
            
            console.log(`📝 Updating existing transaction #${transaction.id} for Order #${order.id}`);
            console.log(`   Current status: ${transaction.status}`);
            console.log(`   Current amount: ${transaction.amount}, should be: ${paymentAmount}`);
            console.log(`   Updating to: completed`);
            
            // Use raw SQL update first to ensure it works
            try {
              await db.sequelize.query(
                `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "receiptNumber" = :receiptNumber, "orderId" = :orderId, amount = :amount, "transactionDate" = :transactionDate, "phoneNumber" = COALESCE(:phoneNumber, "phoneNumber"), "updatedAt" = NOW(), notes = COALESCE(notes || E'\n', '') || :note WHERE id = :id`,
                {
                  replacements: {
                    id: transaction.id,
                    orderId: order.id,
                    amount: paymentAmount,
                    receiptNumber: receiptNumber || transaction.receiptNumber || null,
                    transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
                    phoneNumber: phoneNumber || transaction.phoneNumber || null,
                    note: `✅ Item payment completed. Receipt: ${receiptNumber || 'N/A'} (items: KES ${paymentAmount.toFixed(2)}, delivery: KES ${deliveryFee.toFixed(2)}${tipAmount > 0 ? `, tip: KES ${tipAmount.toFixed(2)} separate` : ''})`
                  }
                }
              );
              
              // Also try Sequelize update as backup
              await transaction.update({
                orderId: order.id,
                amount: paymentAmount,
                status: 'completed',
                paymentStatus: 'paid',
                receiptNumber: receiptNumber,
                transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
                phoneNumber: phoneNumber || transaction.phoneNumber,
                notes: transaction.notes ? 
                  `${transaction.notes}\n✅ Item payment completed. Receipt: ${receiptNumber} (items: KES ${paymentAmount.toFixed(2)}, delivery: KES ${deliveryFee.toFixed(2)}${tipAmount > 0 ? `, tip: KES ${tipAmount.toFixed(2)} separate` : ''})` : 
                  `✅ Item payment completed via M-Pesa. Receipt: ${receiptNumber} (items: KES ${paymentAmount.toFixed(2)}, delivery: KES ${deliveryFee.toFixed(2)}${tipAmount > 0 ? `, tip: KES ${tipAmount.toFixed(2)} separate` : ''})`
              });
            } catch (updateError) {
              console.error(`❌ Error updating transaction:`, updateError);
              // Try raw SQL as fallback
              await db.sequelize.query(
                `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "receiptNumber" = :receiptNumber, "updatedAt" = NOW() WHERE id = :id`,
                {
                  replacements: {
                    id: transaction.id,
                    receiptNumber: receiptNumber || transaction.receiptNumber || null
                  }
                }
              );
            }
            
            // Force reload to ensure update is saved
            await transaction.reload();
            console.log(`✅ Transaction #${transaction.id} updated to completed. Status: ${transaction.status}`);
            
            // Double-check by querying the database directly
            const verifyTransaction = await db.Transaction.findByPk(transaction.id);
            console.log(`🔍 Verified transaction status from DB: ${verifyTransaction.status}`);
            
            // If status is still not 'completed', force update with raw SQL using bind parameters
            if (verifyTransaction.status !== 'completed') {
              console.log(`⚠️  Transaction status mismatch! DB shows: ${verifyTransaction.status}, expected: completed`);
              console.log(`   Force updating with raw SQL again using bind parameters...`);
              await db.sequelize.query(
                `UPDATE transactions SET status = $1, "receiptNumber" = $2, "updatedAt" = NOW() WHERE id = $3`,
                {
                  bind: ['completed', receiptNumber || transaction.receiptNumber || null, transaction.id],
                  type: db.sequelize.QueryTypes.UPDATE
                }
              );
              
              // Verify with direct DB query
              const [finalCheckResult] = await db.sequelize.query(
                `SELECT id, status, "receiptNumber" FROM transactions WHERE id = $1`,
                {
                  bind: [transaction.id],
                  type: db.sequelize.QueryTypes.SELECT
                }
              );
              
              console.log(`✅ Final check - Transaction #${transaction.id}: Status: ${finalCheckResult?.[0]?.status || 'NOT FOUND'}`);
            }
          }

          // CRITICAL: Call finalizeOrderPayment to handle all transaction creation/updates
          // This centralizes transaction creation and prevents duplicates
          // finalizeOrderPayment will create/update payment, delivery, and driver delivery transactions
          try {
            console.log(`📞 Calling finalizeOrderPayment for Order #${order.id}...`);
            await finalizeOrderPayment({
              orderId: order.id,
              paymentTransaction: transaction,
              receiptNumber: receiptNumber,
              req,
              context: 'M-Pesa callback'
            });
            console.log(`✅ finalizeOrderPayment completed for Order #${order.id}`);
          } catch (finalizeError) {
            console.error(`❌ Error in finalizeOrderPayment:`, finalizeError);
            // Don't fail the callback - payment transaction is already updated
            // Delivery transactions can be synced later via ensureDeliveryFeeSplit
          }

          // Reload order after finalizeOrderPayment to get updated status
          await order.reload();

          // Update order - Transaction status is the single source of truth
          // Determine the correct order status based on current status
          // If order was "out_for_delivery", update directly to "completed" (delivered + paid = completed)
          // If order was "delivered", update to "completed"
          // Otherwise, only update paymentStatus to 'paid' without changing status
          const currentOrderStatus = order.status;
          let newOrderStatus = currentOrderStatus;
          
          if (currentOrderStatus === 'out_for_delivery') {
            // If order was out for delivery when payment is confirmed, mark as completed directly
            // (delivered + paid = completed, and it should be moved to completed orders on driver app)
            newOrderStatus = 'completed';
            console.log(`📝 Order #${order.id} was "out_for_delivery", updating to "completed" after payment confirmation (delivered + paid = completed)`);
          } else if (currentOrderStatus === 'delivered') {
            // If order was already delivered, mark as completed
            newOrderStatus = 'completed';
            console.log(`📝 Order #${order.id} was "delivered", updating to "completed" after payment confirmation`);
          } else if (currentOrderStatus === 'pending' || currentOrderStatus === 'cancelled') {
            // For newly paid orders, move them into confirmed so they flow through the rest of the lifecycle
            newOrderStatus = 'confirmed';
            console.log(`📝 Order #${order.id} was "${currentOrderStatus}", updating to "confirmed" after payment confirmation`);
          } else if (currentOrderStatus === 'confirmed' || currentOrderStatus === 'preparing') {
            // For orders that haven't been delivered yet, only update payment status, keep current status
            newOrderStatus = currentOrderStatus;
            console.log(`📝 Order #${order.id} is "${currentOrderStatus}", keeping status but updating paymentStatus to 'paid'`);
          }
          
          console.log(`📝 Updating order #${order.id}: status from '${currentOrderStatus}' to '${newOrderStatus}', paymentStatus to 'paid' (transaction completed)`);
          
          const noteText = `✅ M-Pesa Receipt: ${receiptNumber || 'N/A'}\n✅ Payment confirmed at: ${new Date().toISOString()}`;
          
          // Update order status and paymentStatus
          // Use raw SQL first to ensure it works (PostgreSQL column name might be different)
          try {
            // Try raw SQL first to ensure it works regardless of Sequelize column mapping
            await db.sequelize.query(
              `UPDATE orders SET status = :status, "paymentStatus" = 'paid', "updatedAt" = NOW(), notes = COALESCE(notes || E'\n', '') || :note WHERE id = :id`,
              {
                replacements: { 
                  id: order.id,
                  status: newOrderStatus,
                  note: noteText
                }
              }
            );
            console.log(`✅ Order #${order.id} updated via raw SQL: status=${newOrderStatus}, paymentStatus=paid`);
            
            // CRITICAL: Tip transaction and admin wallet credit are handled by finalizeOrderPayment
            // Don't duplicate them here to avoid double crediting
            
            // Also update via Sequelize as backup
            try {
              await order.update({
                status: newOrderStatus,
                paymentStatus: 'paid',
                notes: order.notes ? 
                  `${order.notes}\n${noteText}` : 
                  noteText
              });
              console.log(`✅ Order #${order.id} also updated via Sequelize`);
            } catch (sequelizeError) {
              console.log(`⚠️  Sequelize update warning (raw SQL already applied):`, sequelizeError.message);
            }
          } catch (sqlError) {
            console.error(`⚠️  Raw SQL update failed, trying Sequelize:`, sqlError);
            // Fallback to Sequelize if raw SQL fails
            try {
              await order.update({
                status: newOrderStatus,
                paymentStatus: 'paid',
                notes: order.notes ? 
                  `${order.notes}\n${noteText}` : 
                  noteText
              });
              console.log(`✅ Order #${order.id} updated via Sequelize: status=${newOrderStatus}, paymentStatus=paid`);
            } catch (updateError) {
              console.error(`❌ Both SQL and Sequelize updates failed:`, updateError);
              throw updateError;
            }
          }
          
          console.log(`✅ Order #${order.id} status updated to '${newOrderStatus}' (triggered by transaction completion)`);
          
          // Force reload and verify the update with all relationships
          await order.reload({
            include: [
              {
                model: db.OrderItem,
                as: 'orderItems',
                include: [{ model: db.Drink, as: 'drink' }]
              }
            ]
          });
          
          // Double-check the status was saved - get fresh order data from database
          const verifyOrder = await db.sequelize.query(
            `SELECT id, status, "paymentStatus", "driverId" FROM orders WHERE id = :id`,
            {
              replacements: { id: order.id },
              type: db.sequelize.QueryTypes.SELECT
            }
          );
          
          const dbOrder = verifyOrder[0];
          
          console.log(`✅✅✅ Order #${order.id} AUTOMATICALLY CONFIRMED via M-Pesa payment`);
          console.log(`   Order Status (DB): ${dbOrder?.status}`);
          console.log(`   Payment Status (DB): ${dbOrder?.paymentStatus}`);
          console.log(`   Driver ID: ${dbOrder?.driverId || 'Not assigned'}`);
          console.log(`   Receipt: ${receiptNumber}`);
          console.log(`   Amount: ${amount}`);
          console.log(`   Phone: ${phoneNumber}`);
          console.log(`   Transaction ID: ${transaction.id}`);
          console.log(`   Transaction Status: ${transaction.status}`);
          
          // If order status is still not correct or paymentStatus is not 'paid', force update again
          if (!dbOrder || dbOrder.paymentStatus !== 'paid') {
            console.log(`⚠️  Order paymentStatus mismatch detected! Current: ${dbOrder?.paymentStatus}, expected: paid`);
            console.log(`   Force updating paymentStatus with raw SQL again...`);
            await db.sequelize.query(
              `UPDATE orders SET "paymentStatus" = 'paid', "updatedAt" = NOW() WHERE id = :id`,
              {
                replacements: { id: order.id }
              }
            );
            // Also update status if it needs to be updated based on previous logic
            if (dbOrder?.status !== newOrderStatus) {
              await db.sequelize.query(
                `UPDATE orders SET status = :status, "updatedAt" = NOW() WHERE id = :id`,
                {
                  replacements: { id: order.id, status: newOrderStatus }
                }
              );
            }
            // Reload again after force update
            await order.reload();
            const finalCheck = await db.sequelize.query(
              `SELECT status, "paymentStatus" FROM orders WHERE id = :id`,
              {
                replacements: { id: order.id },
                type: db.sequelize.QueryTypes.SELECT
              }
            );
            console.log(`✅ Final check - Order #${order.id}: Status: ${finalCheck[0]?.status}, PaymentStatus: ${finalCheck[0]?.paymentStatus}`);
          }
          
          // Get the final order data with all relationships for socket event
          // Use database values to ensure accuracy
          const finalOrder = await db.Order.findByPk(order.id, {
            include: [
              {
                model: db.OrderItem,
                as: 'orderItems',
                include: [{ model: db.Drink, as: 'drink' }]
              }
            ]
          });
          
          // Use database values from direct query (most reliable)
          const actualPaymentStatus = dbOrder?.paymentStatus || finalOrder?.paymentStatus || 'paid';
          const actualStatus = dbOrder?.status || finalOrder?.status || newOrderStatus;
          
          // Double-check paymentStatus one more time before emitting
          if (actualPaymentStatus !== 'paid') {
            console.log(`⚠️  Final order paymentStatus is still not 'paid' (${actualPaymentStatus}), forcing update again...`);
            await db.sequelize.query(
              `UPDATE orders SET "paymentStatus" = 'paid' WHERE id = :id`,
              {
                replacements: { id: order.id }
              }
            );
            // Reload again
            await finalOrder.reload();
            const finalVerify = await db.sequelize.query(
              `SELECT "paymentStatus" FROM orders WHERE id = :id`,
              {
                replacements: { id: order.id },
                type: db.sequelize.QueryTypes.SELECT
              }
            );
            console.log(`✅ After force update - PaymentStatus: ${finalVerify[0]?.paymentStatus}`);
          }
          
          // Update finalOrder object with database values
          if (finalOrder) {
            finalOrder.paymentStatus = actualPaymentStatus;
            finalOrder.status = actualStatus;
          }
          
          // Prepare order data for socket event (convert to plain object)
          const orderData = finalOrder.toJSON ? finalOrder.toJSON() : finalOrder;
          // Ensure paymentStatus is correct in order data
          if (orderData) {
            orderData.paymentStatus = actualPaymentStatus;
            orderData.status = actualStatus;
          }
          
          const paymentConfirmedAt = new Date().toISOString();
          
          // Emit real-time notification to frontend via Socket.IO
          const io = req.app.get('io');
          if (io) {
            // Prepare payment confirmation data - use actual values from database
            const paymentConfirmedData = {
              orderId: order.id,
              status: actualStatus,
              paymentStatus: actualPaymentStatus, // Use actual value from database
              receiptNumber: receiptNumber,
              amount: amount,
              transactionId: transaction.id,
              transactionStatus: 'completed',
              paymentConfirmedAt: paymentConfirmedAt,
              order: orderData, // Include full order object with latest paymentStatus
              message: `Payment confirmed for Order #${order.id}`
            };
            
            console.log(`📡 Preparing payment-confirmed event for Order #${order.id}`);
            console.log(`   Status: ${paymentConfirmedData.status}`);
            console.log(`   PaymentStatus: ${paymentConfirmedData.paymentStatus}`);
            console.log(`   Order paymentStatus in data: ${orderData?.paymentStatus}`);
            console.log(`   Driver ID: ${dbOrder?.driverId || finalOrder?.driverId || 'Not assigned'}`);
            
            // Emit to a specific order room so the frontend can listen for this specific order
            io.to(`order-${order.id}`).emit('payment-confirmed', paymentConfirmedData);
            
            // Notify driver if order is assigned to one - use database driverId
            const driverId = dbOrder?.driverId || finalOrder?.driverId;
            if (driverId) {
              io.to(`driver-${driverId}`).emit('payment-confirmed', paymentConfirmedData);
              console.log(`📡 Emitted payment-confirmed event to driver-${driverId} for Order #${order.id}`);
            } else {
              console.log(`⚠️  No driverId found for Order #${order.id}, skipping driver notification`);
            }
            
            // Also notify admin
            io.to('admin').emit('payment-confirmed', paymentConfirmedData);
            
            console.log(`📡 Socket.IO events emitted for Order #${order.id} with transaction status: completed`);
          }
      } else {
        // Payment failed - check the specific error code
        const resultCode = stkCallback.ResultCode;
        const resultDesc = stkCallback.ResultDesc || 'Payment failed';
        console.log(`❌ Order #${order.id} payment failed: ${resultDesc} (ResultCode: ${resultCode})`);
        
        // Determine error type
        let errorType = 'failed';
        let errorMessage = resultDesc;
        
        if (resultCode === 1) {
          errorType = 'insufficient_balance';
          errorMessage = 'Customer has insufficient balance to complete payment';
        } else if (resultCode === 2001 || resultCode === 2006 || resultDesc.toLowerCase().includes('pin') || resultDesc.toLowerCase().includes('wrong')) {
          errorType = 'wrong_pin';
          errorMessage = 'Customer entered incorrect PIN';
        } else if (resultCode === 1032) {
          errorType = 'timeout';
          errorMessage = 'Payment request timed out - customer did not complete payment';
        }
        
        // Update transaction status if exists
        const transaction = await db.Transaction.findOne({
          where: { checkoutRequestID: checkoutRequestID }
        });
        
        if (transaction) {
          await transaction.update({
            status: 'failed',
            paymentStatus: 'unpaid',
            notes: transaction.notes ? 
              `${transaction.notes}\n❌ Payment Failed: ${errorMessage}` : 
              `❌ Payment Failed: ${errorMessage}`
          });
        }
        
        await order.update({
          status: 'pending',
          paymentStatus: 'unpaid',
          notes: order.notes ? 
            `${order.notes}\nM-Pesa Payment Failed: ${errorMessage}` : 
            `M-Pesa Payment Failed: ${errorMessage}`
        });
        
        // Emit socket event to notify driver about payment failure
        const io = req.app.get('io');
        if (io && order.driverId) {
          io.to(`driver-${order.driverId}`).emit('payment-failed', {
            orderId: order.id,
            errorType: errorType,
            errorMessage: errorMessage,
            resultCode: resultCode,
            resultDesc: resultDesc
          });
          console.log(`📡 Emitted payment-failed event to driver-${order.driverId} for Order #${order.id}`);
        }
      }
      } else {
        console.log(`⚠️  No order found for CheckoutRequestID: ${checkoutRequestID}`);
        console.log(`   Attempting to update transaction directly if it exists...`);
        
        // Last resort: Try to update transaction directly by checkoutRequestID even without order
        if (resultCode === 0 && checkoutRequestID) {
          const directTransaction = await db.Transaction.findOne({
            where: { checkoutRequestID: checkoutRequestID }
          });
          
          if (directTransaction) {
            console.log(`📝 Found transaction #${directTransaction.id} directly, updating to completed...`);
            const callbackMetadata = stkCallback.CallbackMetadata || {};
            const items = callbackMetadata.Item || [];
            const receiptNumber = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
            
            // Update transaction directly using raw SQL to ensure it works
            await db.sequelize.query(
              `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "receiptNumber" = :receiptNumber, "updatedAt" = NOW() WHERE id = :id`,
              {
                replacements: {
                  id: directTransaction.id,
                  receiptNumber: receiptNumber || null
                }
              }
            );
            
            // If transaction has an orderId, update the order too
            if (directTransaction.orderId) {
              await db.sequelize.query(
                `UPDATE orders SET status = 'confirmed', "updatedAt" = NOW() WHERE id = :id`,
                {
                  replacements: { id: directTransaction.orderId }
                }
              );
              console.log(`✅ Updated transaction #${directTransaction.id} and order #${directTransaction.orderId} directly`);
            } else {
              console.log(`✅ Updated transaction #${directTransaction.id} directly (no orderId found)`);
            }
          } else {
            console.log(`❌ No transaction found with CheckoutRequestID: ${checkoutRequestID}`);
          }
        }
        
        console.log(`⚠️  No order found for CheckoutRequestID: ${checkoutRequestID}`);
        console.log(`   Searching for order with CheckoutRequestID in notes...`);
        
        // Try to find order by searching notes more broadly
        const allOrders = await db.Order.findAll({
          order: [['createdAt', 'DESC']],
          limit: 10,
          attributes: ['id', 'notes', 'createdAt', 'status', 'paymentStatus']
        });
        
        console.log(`   Recent orders (last 10):`, allOrders.map(o => ({ 
          id: o.id, 
          status: o.status,
          paymentStatus: o.paymentStatus,
          notes: o.notes?.substring(0, 150),
          hasCheckoutID: o.notes?.includes(checkoutRequestID)
        })));
        
        // Try to find by partial match
        const partialMatch = allOrders.find(o => 
          o.notes && o.notes.includes(checkoutRequestID.substring(0, 20))
        );
        
        if (partialMatch) {
          console.log(`   Found potential match: Order #${partialMatch.id}`);
        }
      }
    } else {
      console.log('⚠️  Callback received but missing stkCallback in Body:', JSON.stringify(callbackData, null, 2));
    }
      console.log('✅ Callback processing completed');
    } catch (error) {
      console.error('❌ Error processing M-Pesa callback:', error);
      console.error('Error stack:', error.stack);
    }
  })();
});

/**
 * Poll M-Pesa API for transaction status (active check)
 * This queries M-Pesa directly instead of relying on callbacks
 */
router.get('/poll-transaction/:checkoutRequestID', async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;
    
    if (!checkoutRequestID) {
      return res.status(400).json({ error: 'CheckoutRequestID is required' });
    }
    
    console.log(`🔍 Polling M-Pesa API for transaction status: ${checkoutRequestID}`);
    
    // Import M-Pesa service
    const mpesaService = require('../services/mpesa');
    
    // Query M-Pesa directly for transaction status
    let mpesaStatus;
    try {
      mpesaStatus = await mpesaService.checkTransactionStatus(checkoutRequestID);
      console.log(`📊 M-Pesa API response for ${checkoutRequestID}:`, JSON.stringify(mpesaStatus, null, 2));
    } catch (mpesaError) {
      console.error(`❌ M-Pesa API call failed for ${checkoutRequestID}:`, mpesaError.message);
      // Return a pending status instead of throwing - let frontend continue polling
      return res.json({
        success: false,
        status: 'pending',
        error: true,
        errorMessage: mpesaError.message || 'Failed to query M-Pesa API',
        message: 'M-Pesa API query failed, will continue polling transaction status'
      });
    }
    
    // Check M-Pesa API response structure
    // IMPORTANT: ResultCode 0 with "The service request is processed successfully" can mean:
    // - Payment completed (if there's a receipt number)
    // - Request received but still processing (if no receipt number yet)
    // ResultCode 1032 = Request timeout (user hasn't entered PIN)
    // Other codes = Transaction failed or cancelled
    
    // The REAL indicator of payment completion is the receipt number in CallbackMetadata
    // The query API structure: CallbackMetadata contains Item array with Name/Value pairs
    const callbackMetadata = mpesaStatus?.CallbackMetadata;
    const items = callbackMetadata?.Item || [];
    const receiptFromMetadata = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
    const receiptFromResponse = mpesaStatus?.ReceiptNumber;
    const hasReceiptNumber = receiptFromMetadata || receiptFromResponse;
    
    // Log full metadata structure for debugging
    console.log(`🔍 Full M-Pesa response structure:`);
    console.log(`   ResultCode: ${mpesaStatus?.ResultCode}`);
    console.log(`   ResultDesc: ${mpesaStatus?.ResultDesc}`);
    console.log(`   CallbackMetadata exists: ${!!callbackMetadata}`);
    console.log(`   CallbackMetadata.Items count: ${items.length}`);
    if (items.length > 0) {
      console.log(`   Items:`, JSON.stringify(items, null, 2));
    }
    console.log(`   Receipt from metadata: ${receiptFromMetadata || 'NOT FOUND'}`);
    console.log(`   Receipt from response: ${receiptFromResponse || 'NOT FOUND'}`);
    console.log(`   Has receipt: ${!!hasReceiptNumber}`);
    
    // Payment is completed ONLY if we have a receipt number AND ResultCode is 0
    // Just ResultCode 0 alone isn't enough - it can mean the request was received but not yet completed
    const isCompleted = mpesaStatus && mpesaStatus.ResultCode === 0 && hasReceiptNumber;
    const isSuccessWithoutReceipt = mpesaStatus && mpesaStatus.ResultCode === 0 && !hasReceiptNumber;
    
    console.log(`🔍 M-Pesa status check: ResultCode=${mpesaStatus?.ResultCode}, hasReceiptNumber=${!!hasReceiptNumber}, isCompleted=${isCompleted}`);
    
    // If M-Pesa confirms payment completion (ResultCode 0 with receipt), update our database
    if (isCompleted) {
      const transaction = await db.Transaction.findOne({
        where: { checkoutRequestID, transactionType: 'payment' },
        include: [{
          model: db.Order,
          as: 'order'
        }]
      });
      
      if (transaction) {
        const receiptNumber = receiptFromMetadata || receiptFromResponse || null;
        const context = 'M-Pesa query confirmation';

        const finalizeResult = await finalizeOrderPayment({
          orderId: transaction.orderId,
          paymentTransaction: transaction,
          receiptNumber,
          req,
          context
        });
      
      return res.json({
        success: true,
        status: 'completed',
          mpesaStatus,
          receiptNumber: finalizeResult.receipt,
        message: 'Transaction completed according to M-Pesa API'
        });
      }
    } else if (isSuccessWithoutReceipt) {
      // M-Pesa returned success but did not include receipt metadata yet.
      // This usually means the asynchronous callback has not been delivered.
      return res.json({
        success: false,
        error: false,
        status: 'pending',
        awaitingReceipt: true,
        mpesaStatus,
        message: 'M-Pesa reported success but has not provided a receipt number yet. Waiting for Safaricom callback.',
        resultCode: mpesaStatus?.ResultCode,
        resultDesc: mpesaStatus?.ResultDesc
      });
    } else {
      // Transaction still pending or failed
      // But check if maybe payment was completed but callback hasn't arrived yet
      // In this case, we return pending but the frontend will continue polling
      // The callback should eventually arrive and update the status
      
      const statusMessage = mpesaStatus?.ResultCode === 1032 
        ? 'Request timeout - user hasn\'t entered PIN yet' 
        : (mpesaStatus?.ResultDesc || 'Transaction status check completed');
      
      return res.json({
        success: true,
        status: 'pending',
        mpesaStatus: mpesaStatus,
        message: statusMessage,
        // Include helpful info for debugging
        resultCode: mpesaStatus?.ResultCode,
        resultDesc: mpesaStatus?.ResultDesc
      });
    }
  } catch (error) {
    console.error('Error polling M-Pesa transaction status:', error);
    res.status(500).json({ 
      error: 'Failed to poll transaction status',
      message: error.message 
    });
  }
});

/**
 * Simple check: Does this order have a receipt number? (Payment completed)
 * This is the most reliable indicator of payment completion
 */
router.get('/check-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Direct database query to check for receipt number - most reliable
    const [results] = await db.sequelize.query(
      `SELECT id, status, "receiptNumber", "checkoutRequestID", "orderId", amount, "phoneNumber", "transactionDate"
       FROM transactions 
       WHERE "orderId" = :orderId 
         AND "transactionType" = 'payment'
       ORDER BY "updatedAt" DESC, "createdAt" DESC 
       LIMIT 1`,
      {
        replacements: { orderId },
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    
    const transaction = results?.[0] || results;
    
    if (transaction && transaction.receiptNumber) {
      const paymentTransaction = await db.Transaction.findByPk(transaction.id);
      if (!paymentTransaction) {
        console.warn(`⚠️  Payment transaction #${transaction.id} not found while finalizing receipt check`);
        return res.json({
          success: true,
          paymentCompleted: true,
          receiptNumber: transaction.receiptNumber,
          transactionId: transaction.id,
          status: 'completed',
          amount: transaction.amount,
          phoneNumber: transaction.phoneNumber,
          transactionDate: transaction.transactionDate
        });
      }
      
      try {
        const finalizeResult = await finalizeOrderPayment({
          orderId,
          paymentTransaction,
          receiptNumber: transaction.receiptNumber,
          req,
          context: 'Receipt detected via check-payment'
        });

        await paymentTransaction.reload().catch(() => {});
        const finalizedOrder = finalizeResult.order || await db.Order.findByPk(orderId);

        return res.json({
          success: true,
          paymentCompleted: true,
          receiptNumber: finalizeResult.receipt || paymentTransaction.receiptNumber,
          transactionId: paymentTransaction.id,
          status: paymentTransaction.status,
          amount: paymentTransaction.amount,
          phoneNumber: paymentTransaction.phoneNumber,
          transactionDate: paymentTransaction.transactionDate,
          orderStatus: finalizedOrder?.status,
          paymentStatus: finalizedOrder?.paymentStatus
        });
      } catch (finalizeError) {
        console.error('Error finalizing payment via check-payment:', finalizeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to finalize payment status',
          message: finalizeError.message
        });
      }
    }
    
    // No receipt = payment not completed yet
    return res.json({
      success: true,
      paymentCompleted: false,
      status: transaction?.status || 'pending',
      transactionId: transaction?.id || null
    });
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check payment status',
      message: error.message 
    });
  }
});

/**
 * Check transaction status by order ID
 * This must be placed BEFORE /status/:orderId to avoid route conflicts
 */
router.get('/transaction-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // CRITICAL: Use getPaymentTransaction helper to ensure we ONLY get payment transactions
    // This prevents delivery_pay or tip transactions from being returned
    const transaction = await getPaymentTransaction(orderId);
    
    console.log(`🔍 Transaction lookup for order ${orderId}: ${transaction ? `Found payment transaction #${transaction.id} with status: ${transaction.status}, receipt: ${transaction.receiptNumber || 'none'}` : 'No payment transaction found'}`);
    
    // CRITICAL AUTO-FIX: If transaction has a receipt number but status isn't 'completed',
    // it means callback processed payment but status update might have failed
    // Auto-update it to completed immediately
    if (transaction && transaction.receiptNumber && transaction.status !== 'completed') {
      console.log(`⚠️  AUTOMATIC FIX: Transaction #${transaction.id} has receipt number (${transaction.receiptNumber}) but status is ${transaction.status}. Finalizing...`);
      try {
        const finalizeResult = await finalizeOrderPayment({
          orderId: transaction.orderId,
          paymentTransaction: transaction,
          receiptNumber: transaction.receiptNumber,
          req,
          context: 'Transaction status auto-fix'
        });
        await transaction.reload().catch(() => {});
        if (finalizeResult.order) {
          transaction.order = finalizeResult.order;
        }
        console.log(`✅ Auto-finalized transaction #${transaction.id} and order #${transaction.orderId} (receipt number detected)`);
      } catch (updateError) {
        console.error(`❌ Error auto-finalizing transaction:`, updateError);
      }
    }

        if (!transaction) {
          // Transaction not created yet - return pending status instead of 404
          // Also fetch order to get paymentStatus - use direct DB query to get latest
          const order = await db.Order.findByPk(orderId).catch(() => null);
          
          // Get latest paymentStatus from database directly
          let orderPaymentStatus = 'pending';
          let orderStatus = 'pending';
          if (order) {
            const [rawOrder] = await db.sequelize.query(
              `SELECT "paymentStatus", status FROM orders WHERE id = :id`,
              {
                replacements: { id: order.id },
                type: db.sequelize.QueryTypes.SELECT
              }
            );
            orderPaymentStatus = rawOrder?.[0]?.paymentStatus || order.paymentStatus || 'pending';
            orderStatus = rawOrder?.[0]?.status || order.status || 'pending';
          }
          
          return res.json({ 
            transactionId: null,
            orderId: parseInt(orderId),
            status: 'pending',
            amount: null,
            receiptNumber: null,
            paymentMethod: null,
            paymentProvider: null,
            phoneNumber: null,
            transactionDate: null,
            createdAt: null,
            order: order ? {
              id: order.id,
              status: orderStatus, // Use actual status from DB
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerPhone: order.customerPhone
            } : null
          });
        }

        // Ensure we're returning the actual status from the database
        // Force reload to get latest status
        await transaction.reload();
        
        // Also reload the order to get latest status
        if (transaction.order) {
          await transaction.order.reload();
        }
        
        // Double-check by querying directly from database to bypass any caching
        const rawTransactions = await db.sequelize.query(
          `SELECT status, "receiptNumber", amount FROM transactions WHERE id = :id`,
          {
            replacements: { id: transaction.id },
            type: db.sequelize.QueryTypes.SELECT
          }
        );
        
        const actualStatus = rawTransactions?.[0]?.status || transaction.status;
        console.log(`🔍 Direct DB query status: ${actualStatus}, Sequelize status: ${transaction.status}`);
        
        // Get latest order status from database directly
        let actualOrderStatus = transaction.order?.status || 'pending';
        if (transaction.orderId) {
          const [rawOrder] = await db.sequelize.query(
            `SELECT status FROM orders WHERE id = :id`,
            {
              replacements: { id: transaction.orderId },
              type: db.sequelize.QueryTypes.SELECT
            }
          );
          actualOrderStatus = rawOrder?.[0]?.status || transaction.order?.status || 'pending';
          console.log(`🔍 Direct DB query order: status=${actualOrderStatus}`);
          
          // Update transaction.order object with latest values
          if (transaction.order) {
            transaction.order.status = actualOrderStatus;
          }
        }
        
        // Use the actual status from direct DB query
        const finalStatus = actualStatus || transaction.status;
        
        const response = {
          transactionId: transaction.id,
          orderId: transaction.orderId,
          status: finalStatus, // Use status from direct DB query
          amount: transaction.amount,
          receiptNumber: transaction.receiptNumber,
          checkoutRequestID: transaction.checkoutRequestID, // Include for active polling
          paymentMethod: transaction.paymentMethod,
          paymentProvider: transaction.paymentProvider,
          phoneNumber: transaction.phoneNumber,
          transactionDate: transaction.transactionDate,
          createdAt: transaction.createdAt,
          order: transaction.order ? {
            id: transaction.order.id,
            status: transaction.order.status,
            customerName: transaction.order.customerName,
            customerEmail: transaction.order.customerEmail,
            customerPhone: transaction.order.customerPhone
          } : null
        };
        
        console.log(`📤 Returning transaction status for order ${orderId}:`, {
          transactionId: response.transactionId,
          status: response.status,
          receiptNumber: response.receiptNumber,
          orderStatus: response.order?.status
        });
        
        res.json(response);
  } catch (error) {
    console.error('Error checking transaction status:', error);
    res.status(500).json({ error: 'Failed to check transaction status' });
  }
});

/**
 * Check payment status
 */
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Reload order from database to get latest status
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Force reload from database to get latest status (bypass any caching)
    await order.reload();
    
    // Double-check by querying directly from database
    const [rawOrder] = await db.sequelize.query(
      `SELECT id, status FROM orders WHERE id = :id`,
      {
        replacements: { id: order.id },
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    
    const actualStatus = rawOrder?.[0]?.status || order.status;
    
    console.log(`🔍 Order #${orderId} status check:`);
    console.log(`   Sequelize: status=${order.status}`);
    console.log(`   Direct DB: status=${actualStatus}`);

    // For M-Pesa payments that are pending, check if enough time has passed
    // If it's been more than 5 minutes and payment is still pending, 
    // we might want to check M-Pesa status directly (but that requires another API call)
    // For now, just return the current status
    const statusCheckTime = new Date();
    const orderAge = statusCheckTime - new Date(order.createdAt);
    const minutesSinceOrder = orderAge / (1000 * 60);

    console.log(`Status check for order #${orderId}: ${actualStatus} (${minutesSinceOrder.toFixed(1)} minutes old)`);

    // Also check transaction status - prioritize payment transaction as source of truth
    let transaction = await db.Transaction.findOne({
      where: { orderId: order.id, transactionType: 'payment' },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
    });

    if (!transaction) {
      transaction = await db.Transaction.findOne({
        where: { orderId: order.id },
        order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
      });
    }
    
    res.json({
      orderId: order.id,
      status: actualStatus, // Use actual status from DB query
      transactionStatus: transaction?.status || 'pending', // Single source of truth for payment
      paymentMethod: order.paymentMethod,
      paymentType: order.paymentType,
      orderAge: minutesSinceOrder,
      notes: order.notes,
      receiptNumber: transaction?.receiptNumber || null,
      transactionId: transaction?.id || null
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/**
 * Customer-facing endpoint to manually confirm payment when callback hasn't arrived
 * This allows customers to confirm payment when they've completed it but status hasn't updated
 */
router.post('/manual-confirm/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { receiptNumber } = req.body || {}; // Optional receipt number
    
    console.log(`🔧 Manual payment confirmation requested for order #${orderId}`);
    
    // Find the order
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Find the transaction
    const transaction = await db.Transaction.findOne({
      where: { orderId: order.id, transactionType: 'payment' },
      order: [['createdAt', 'DESC']]
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found for this order' });
    }
    
    const effectiveReceiptNumber = receiptNumber || transaction.receiptNumber;

    if (!effectiveReceiptNumber) {
      return res.status(400).json({
        error: 'Receipt number required',
        message: 'Safaricom receipt number is required to confirm payment. Please provide the M-Pesa receipt or wait for the official callback.'
      });
    }

    const { receipt, order: updatedOrder } = await finalizeOrderPayment({
      orderId: order.id,
      paymentTransaction: transaction,
      receiptNumber: effectiveReceiptNumber,
      req,
      context: 'Manual confirmation'
    });
    
    console.log(`✅ Order #${order.id} manually confirmed`);
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      orderId: order.id,
      status: updatedOrder.status,
      transactionStatus: 'completed',
      receiptNumber: receipt
    });
  } catch (error) {
    console.error('Error manually confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment', message: error.message });
  }
});

/**
 * Manual payment confirmation endpoint (for testing/sandbox)
 * This should only be used in development/test environments
 */
router.post('/confirm/:orderId', async (req, res) => {
  try {
    // Only allow in development/test mode
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MANUAL_CONFIRMATION) {
      return res.status(403).json({ error: 'Manual confirmation not allowed in production' });
    }

    const { orderId } = req.params;
    const order = await db.Order.findByPk(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentMethod !== 'mobile_money') {
      return res.status(400).json({ error: 'Order is not an M-Pesa payment' });
    }

    // Update order status to confirmed
    await order.update({
      status: 'confirmed',
      notes: order.notes ? 
        `${order.notes}\n[MANUAL CONFIRMATION] Payment confirmed manually` : 
        `[MANUAL CONFIRMATION] Payment confirmed manually`
    });

    await order.reload();

    console.log(`✅ Order #${orderId} manually confirmed (test mode)`);

    res.json({
      success: true,
      message: 'Payment confirmed manually',
      order: {
        id: order.id,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Error manually confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

/**
 * TEST ENDPOINT: Simulate M-Pesa callback for testing
 * This allows manual testing of the callback handler without waiting for M-Pesa
 */
router.post('/test-callback/:checkoutRequestID', async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;
    
    console.log(`🧪 TEST: Simulating M-Pesa callback for CheckoutRequestID: ${checkoutRequestID}`);
    
    // Simulate successful payment callback
    const mockCallbackData = {
      Body: {
        stkCallback: {
          MerchantRequestID: "test-merchant-request-id",
          CheckoutRequestID: checkoutRequestID,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: "1.00" },
              { Name: "MpesaReceiptNumber", Value: `TEST-${Date.now()}` },
              { Name: "TransactionDate", Value: new Date().toISOString().replace(/[-:]/g, '').split('.')[0] },
              { Name: "PhoneNumber", Value: "254727893741" }
            ]
          }
        }
      }
    };
    
    // Process the mock callback using the same logic
    req.body = mockCallbackData;
    
    // Call the actual callback handler logic
    const stkCallback = mockCallbackData.Body.stkCallback;
    const resultCode = stkCallback.ResultCode;
    
    // Find transaction by checkoutRequestID
    const transaction = await db.Transaction.findOne({
      where: { checkoutRequestID: checkoutRequestID },
      include: [{
        model: db.Order,
        as: 'order'
      }]
    });
    
    if (!transaction) {
      return res.status(404).json({ error: `Transaction not found for CheckoutRequestID: ${checkoutRequestID}` });
    }
    
    const order = transaction.order || await db.Order.findByPk(transaction.orderId);
    
    if (!order) {
      return res.status(404).json({ error: `Order not found for transaction` });
    }
    
    if (resultCode === 0) {
      const callbackMetadata = stkCallback.CallbackMetadata || {};
      const items = callbackMetadata.Item || [];
      const receiptNumber = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const amount = items.find(item => item.Name === 'Amount')?.Value;
      
      // Update transaction using raw SQL
      await db.sequelize.query(
        `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "receiptNumber" = :receiptNumber, "updatedAt" = NOW() WHERE id = :id`,
        {
          replacements: {
            id: transaction.id,
            receiptNumber: receiptNumber || null
          }
        }
      );
      
      // Update order
      await db.sequelize.query(
        `UPDATE orders SET status = 'confirmed', "updatedAt" = NOW() WHERE id = :id`,
        {
          replacements: { id: order.id }
        }
      );
      
      // Verify updates - reload with all relationships
      await transaction.reload();
      await order.reload({
        include: [
          {
            model: db.OrderItem,
            as: 'orderItems',
            include: [{ model: db.Drink, as: 'drink' }]
          }
        ]
      });
      
      // Prepare order data for socket event
      const orderData = order.toJSON ? order.toJSON() : order;
      const paymentConfirmedAt = new Date().toISOString();
      
      const io = req.app.get('io');
      if (io) {
        const paymentConfirmedData = {
          orderId: order.id,
          status: 'confirmed',
          paymentStatus: 'paid',
          receiptNumber: receiptNumber,
          amount: amount,
          transactionId: transaction.id,
          transactionStatus: 'completed',
          paymentConfirmedAt: paymentConfirmedAt,
          order: orderData,
          message: `Payment confirmed for Order #${order.id}`
        };
        
        io.to(`order-${order.id}`).emit('payment-confirmed', paymentConfirmedData);
        
        // Notify driver if order is assigned to one
        if (order.driverId) {
          io.to(`driver-${order.driverId}`).emit('payment-confirmed', paymentConfirmedData);
          console.log(`📡 Emitted payment-confirmed event to driver-${order.driverId} for Order #${order.id}`);
        }
        
        io.to('admin').emit('payment-confirmed', {
          ...paymentConfirmedData,
          message: `Payment confirmed for Order #${order.id} via M-Pesa`
        });
      }
      
      res.json({
        success: true,
        message: 'Test callback processed successfully',
        transaction: {
          id: transaction.id,
          status: transaction.status,
          receiptNumber: transaction.receiptNumber
        },
        order: {
          id: order.id,
          status: order.status
        }
      });
    } else {
      res.status(400).json({ error: 'Mock callback indicates payment failed' });
    }
  } catch (error) {
    console.error('Error processing test callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * M-Pesa B2C Callback endpoint
 * Handles callbacks from M-Pesa B2C payment requests (driver withdrawals)
 */
router.post('/b2c-callback', (req, res) => {
  // Respond immediately to M-Pesa
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // Process callback in the background
  setImmediate(async () => {
    try {
      const callbackData = req.body;

      console.log('═══════════════════════════════════════════════════════');
      console.log('📞📞📞 M-Pesa B2C Callback received at:', new Date().toISOString());
      console.log('═══════════════════════════════════════════════════════');
      console.log('Full callback data:', JSON.stringify(callbackData, null, 2));
      console.log('═══════════════════════════════════════════════════════');

      // M-Pesa B2C callback structure:
      // {
      //   Result: {
      //     ResultType: 0,
      //     ResultCode: 0,
      //     ResultDesc: "The service request is processed successfully.",
      //     OriginatorConversationID: "...",
      //     ConversationID: "...",
      //     TransactionID: "...",
      //     ResultParameters: {
      //       ResultParameter: [
      //         { Key: "TransactionAmount", Value: 100 },
      //         { Key: "TransactionReceipt", Value: "..." },
      //         { Key: "B2CRecipientIsRegisteredCustomer", Value: "Y" },
      //         { Key: "B2CChargesPaidAccountAvailableFunds", Value: 100 },
      //         { Key: "ReceiverPartyPublicName", Value: "..." },
      //         { Key: "TransactionCompletedDateTime", Value: "..." },
      //         { Key: "B2CUtilityAccountAvailableFunds", Value: 100 },
      //         { Key: "B2CWorkingAccountAvailableFunds", Value: 100 }
      //       ]
      //     },
      //     ReferenceData: { ... }
      //   }
      // }

      if (callbackData.Result) {
        const result = callbackData.Result;
        const conversationID = result.ConversationID;
        const originatorConversationID = result.OriginatorConversationID;
        const resultCode = result.ResultCode;
        const resultDesc = result.ResultDesc;

        console.log(`🔍 Processing B2C callback:`);
        console.log(`   ConversationID: ${conversationID}`);
        console.log(`   OriginatorConversationID: ${originatorConversationID}`);
        console.log(`   ResultCode: ${resultCode}`);
        console.log(`   ResultDesc: ${resultDesc}`);

        // Find withdrawal transaction by conversationID or originatorConversationID
        let transaction = await db.Transaction.findOne({
          where: {
            [db.Sequelize.Op.or]: [
              { checkoutRequestID: conversationID },
              { merchantRequestID: originatorConversationID }
            ],
            transactionType: 'withdrawal'
          }
        });

        if (!transaction) {
          // Try to find by driverId and recent withdrawal transactions
          const recentWithdrawals = await db.Transaction.findAll({
            where: {
              transactionType: 'withdrawal',
              status: 'pending'
            },
            order: [['createdAt', 'DESC']],
            limit: 10
          });

          // Match by amount and approximate time
          for (const withdrawal of recentWithdrawals) {
            if (withdrawal.merchantRequestID === originatorConversationID || 
                withdrawal.checkoutRequestID === conversationID) {
              transaction = withdrawal;
              break;
            }
          }
        }

        if (transaction) {
          console.log(`✅ Found withdrawal transaction #${transaction.id} for driver #${transaction.driverId}`);

          if (resultCode === 0) {
            // B2C payment successful
            const resultParameters = result.ResultParameters?.ResultParameter || [];
            const transactionAmount = resultParameters.find(p => p.Key === 'TransactionAmount')?.Value;
            const transactionReceipt = resultParameters.find(p => p.Key === 'TransactionReceipt')?.Value;
            const transactionCompletedDateTime = resultParameters.find(p => p.Key === 'TransactionCompletedDateTime')?.Value;
            const receiverPartyPublicName = resultParameters.find(p => p.Key === 'ReceiverPartyPublicName')?.Value;

            console.log(`💰 B2C payment successful:`);
            console.log(`   Amount: ${transactionAmount || 'N/A'}`);
            console.log(`   Receipt: ${transactionReceipt || 'N/A'}`);
            console.log(`   Completed: ${transactionCompletedDateTime || 'N/A'}`);
            console.log(`   Recipient: ${receiverPartyPublicName || 'N/A'}`);

            // Update transaction
            await transaction.update({
              status: 'completed',
              paymentStatus: 'paid',
              receiptNumber: transactionReceipt,
              transactionDate: transactionCompletedDateTime ? new Date(transactionCompletedDateTime) : new Date(),
              checkoutRequestID: conversationID,
              merchantRequestID: originatorConversationID,
              notes: transaction.notes ? 
                `${transaction.notes}\n✅ B2C payment completed. Receipt: ${transactionReceipt || 'N/A'}` : 
                `✅ B2C payment completed. Receipt: ${transactionReceipt || 'N/A'}`
            });

            // Wallet balance was already deducted when withdrawal was initiated
            // No need to update wallet again - it's already correct

            // Emit socket event to notify driver
            const io = req.app.get('io');
            if (io && transaction.driverId) {
              io.to(`driver-${transaction.driverId}`).emit('withdrawal-completed', {
                transactionId: transaction.id,
                amount: transactionAmount,
                receiptNumber: transactionReceipt,
                status: 'completed'
              });
              console.log(`📡 Emitted withdrawal-completed event to driver-${transaction.driverId}`);
            }

            console.log(`✅ Withdrawal transaction #${transaction.id} completed successfully`);
          } else {
            // B2C payment failed
            console.log(`❌ B2C payment failed:`);
            console.log(`   ResultCode: ${resultCode}`);
            console.log(`   ResultDesc: ${resultDesc}`);

            // Refund wallet balance
            const wallet = await db.DriverWallet.findByPk(transaction.driverWalletId);
            if (wallet) {
              const refundAmount = parseFloat(transaction.amount);
              await wallet.update({
                balance: parseFloat(wallet.balance) + refundAmount
              });
              console.log(`✅ Refunded KES ${refundAmount.toFixed(2)} to driver wallet #${wallet.id}`);
            }

            // Update transaction
            await transaction.update({
              status: 'failed',
              paymentStatus: 'failed',
              notes: transaction.notes ? 
                `${transaction.notes}\n❌ B2C payment failed: ${resultDesc}` : 
                `❌ B2C payment failed: ${resultDesc}`
            });

            // Emit socket event to notify driver
            const io = req.app.get('io');
            if (io && transaction.driverId) {
              io.to(`driver-${transaction.driverId}`).emit('withdrawal-failed', {
                transactionId: transaction.id,
                error: resultDesc,
                status: 'failed'
              });
              console.log(`📡 Emitted withdrawal-failed event to driver-${transaction.driverId}`);
            }

            console.log(`❌ Withdrawal transaction #${transaction.id} failed`);
          }
        } else {
          console.log(`⚠️  Withdrawal transaction not found for ConversationID: ${conversationID}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing B2C callback:', error);
    }
  });
});

module.exports = router;

