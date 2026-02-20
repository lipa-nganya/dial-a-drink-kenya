const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');

// Helper function to format description using first 2 words of delivery address
const formatDescriptionFromAddress = (deliveryAddress) => {
  if (!deliveryAddress) return 'submission';
  const words = deliveryAddress.trim().split(/\s+/);
  const firstTwoWords = words.slice(0, 2).join(' ');
  return firstTwoWords ? `${firstTwoWords} submission` : 'submission';
};

/**
 * Get cash at hand data for driver
 * GET /api/driver-wallet/:driverId/cash-at-hand
 * IMPORTANT: This route must be defined BEFORE /:driverId to avoid route conflicts
 * 
 * No wallet. Cash at hand = (Pay on Delivery cash: 50% delivery fee + order total per order)
 *               - (Pay Now: 50% delivery fee per order) - approved submissions - settlements.
 */
router.get('/:driverId/cash-at-hand', async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    let totalCashAtHand = parseFloat(driver.cashAtHand || 0);

    // Pay on Delivery (cash): cash at hand += 50% delivery fee + order total per order
    const cashOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      attributes: ['id', 'customerName', 'totalAmount', 'createdAt', 'status', 'deliveryAddress'],
      order: [['createdAt', 'DESC']]
    });

    let cashCollected = 0;
    for (const order of cashOrders) {
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        cashCollected += (breakdown.itemsTotal || 0) + (breakdown.deliveryFee || 0) * 0.5;
      } catch (e) {
        console.warn(`Cash at hand: could not get breakdown for order ${order.id}:`, e.message);
      }
    }

    // Pay Now (M-Pesa/Pesapal): cash at hand -= 50% delivery fee per order
    const payNowOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_now',
        paymentStatus: 'paid',
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      attributes: ['id', 'customerName', 'totalAmount', 'createdAt', 'status'],
      order: [['createdAt', 'DESC']]
    });

    let cashDeductionPayNow = 0;
    for (const order of payNowOrders) {
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        cashDeductionPayNow += (breakdown.deliveryFee || 0) * 0.5;
      } catch (e) {
        console.warn(`Cash at hand: could not get breakdown for pay_now order ${order.id}:`, e.message);
      }
    }

    // Get negative cash_settlement transactions (cash remitted)
    const cashSettlementsNegative = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: { [Op.in]: ['completed', 'pending'] }, // Include pending for savings withdrawals
        amount: { [Op.lt]: 0 }
      },
      attributes: ['id', 'orderId', 'amount', 'createdAt', 'notes', 'receiptNumber', 'paymentProvider'],
      include: [
        { model: db.Order, as: 'order', attributes: ['id', 'deliveryAddress'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Get positive cash_settlement transactions (cash added, e.g., from loan recovery)
    const cashSettlementsPositive = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: { [Op.in]: ['completed', 'pending'] },
        amount: { [Op.gt]: 0 }
      },
      attributes: ['id', 'orderId', 'amount', 'createdAt', 'notes', 'receiptNumber', 'paymentProvider'],
      include: [
        { model: db.Order, as: 'order', attributes: ['id', 'deliveryAddress'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    const orderIdsWithSettlementFromTx = new Set((cashSettlementsNegative || []).map(tx => tx.orderId).filter(Boolean));

    const approvedCashSubmissions = await db.CashSubmission.findAll({
      where: { driverId: driverId, status: 'approved' },
      attributes: ['id', 'amount', 'createdAt', 'submissionType', 'details'],
      include: [
        {
          model: db.Order,
          as: 'orders',
          attributes: ['id', 'deliveryAddress'],
          required: false,
          through: { attributes: [] }
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const pendingCashSubmissions = await db.CashSubmission.findAll({
      where: { driverId: driverId, status: 'pending' },
      attributes: ['id', 'amount']
    });
    const pendingSubmissionsTotal = pendingCashSubmissions.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

    // Calculate cash remitted (negative cash_settlement transactions)
    const cashRemitted = Math.abs(cashSettlementsNegative.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0));
    
    // Calculate cash added (positive cash_settlement transactions, e.g., from loan recovery)
    const cashAdded = cashSettlementsPositive.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    
    // Include approved submissions; for order_payment, skip if already counted via cash_settlement (negative amount)
    const approvedSubmissionsTotal = approvedCashSubmissions.reduce((sum, s) => {
      if (s.submissionType === 'order_payment' && s.details?.orderId != null && orderIdsWithSettlementFromTx.has(s.details.orderId)) return sum;
      return sum + parseFloat(s.amount || 0);
    }, 0);

    const calculatedCashAtHand = cashCollected - cashDeductionPayNow - cashRemitted - approvedSubmissionsTotal + cashAdded;

    // CRITICAL: ALWAYS sync the database value with calculated value to ensure consistency
    // This ensures both admin and driver app show the same value from the database
    // Always update if values differ by more than 0.01, or if stored value is 0/null
    const needsSync = Math.abs(totalCashAtHand - calculatedCashAtHand) > 0.01 || totalCashAtHand === 0 || isNaN(totalCashAtHand);
    
    if (needsSync) {
      // Store old value before update for logging
      const oldValue = parseFloat(driver.cashAtHand || 0);
      // Update driver's cashAtHand field to match calculated value
      await driver.update({ cashAtHand: calculatedCashAtHand });
      // Reload driver to ensure we have the updated value
      await driver.reload();
      totalCashAtHand = parseFloat(driver.cashAtHand || 0);
      console.log(`🔄 [Cash At Hand Sync] Driver ${driverId}: Updated cashAtHand from ${oldValue} to ${calculatedCashAtHand} (cashCollected: ${cashCollected}, payNowDeduction: ${cashDeductionPayNow}, cashRemitted: ${cashRemitted}, approvedSubmissions: ${approvedSubmissionsTotal})`);
    } else {
      // Values match, but always use calculated value to ensure consistency
      // This ensures both endpoints return the exact same value
      totalCashAtHand = calculatedCashAtHand;
      console.log(`✅ [Cash At Hand Sync] Driver ${driverId}: Value in sync (DB: ${parseFloat(driver.cashAtHand || 0)}, using calculated: ${calculatedCashAtHand})`);
    }

    // Format entries for response
    const entries = [];

    // Add cash order entries (50% delivery fee + order total per Pay on Delivery cash order)
    for (const order of cashOrders) {
      let amount = 0;
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        amount = (breakdown.itemsTotal || 0) + (breakdown.deliveryFee || 0) * 0.5;
      } catch (e) {}
      entries.push({
        type: 'cash_received',
        orderId: order.id,
        customerName: order.customerName,
        amount,
        date: order.createdAt,
        description: formatDescriptionFromAddress(order.deliveryAddress)
      });
    }

    // Add cash settlement entries (remittances to business and savings withdrawals)
    // Combine negative and positive cash_settlement transactions for display
    const allCashSettlements = [...cashSettlementsNegative, ...cashSettlementsPositive].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    allCashSettlements.forEach(tx => {
      // Check if this is a savings withdrawal by paymentProvider
      // Savings withdrawals have paymentProvider = 'savings_withdrawal_record' or 'mpesa' with notes containing 'Savings withdrawal'
      const isSavingsWithdrawal = tx.paymentProvider === 'savings_withdrawal_record' || 
                                  (tx.paymentProvider === 'mpesa' && tx.notes && (tx.notes.includes('Savings withdrawal') || tx.notes.includes('savings withdrawal'))) ||
                                  (tx.notes && (tx.notes.includes('Savings withdrawal') || tx.notes.includes('savings withdrawal')));
      
      let description;
      
      // Always format savings withdrawals with the proper format
      if (isSavingsWithdrawal) {
        description = `Savings withdrawal`;
      } else {
        // For cash settlements with order, use delivery address (first 2 words) + "submission"
        if (tx.order && tx.order.deliveryAddress) {
          description = formatDescriptionFromAddress(tx.order.deliveryAddress);
        } else {
          // For other cash settlements, use the notes or default description
          description = tx.notes || `Cash remitted to business`;
        }
      }
      
      // Determine entry type based on transaction amount
      // Negative amounts = cash sent (remitted)
      // Positive amounts = cash received (e.g., from loan recovery)
      const txAmount = parseFloat(tx.amount) || 0;
      const entryType = txAmount < 0 ? 'cash_sent' : 'cash_received';
      
      entries.push({
        type: entryType,
        transactionId: tx.id,
        amount: Math.abs(txAmount), // Make positive for display
        date: tx.transactionDate || tx.createdAt,
        description: description,
        receiptNumber: tx.receiptNumber
      });
    });

    // Add approved cash submission entries (these reduce cash at hand)
    // Skip order_payment when already shown as cash_sent from cash_settlement (negative amount)
    approvedCashSubmissions.forEach(submission => {
      if (submission.submissionType === 'order_payment' && submission.details?.orderId != null && orderIdsWithSettlementFromTx.has(submission.details.orderId)) return;
      const submissionType = submission.submissionType;
      let description = 'Cash submission';
      
      // Check if submission has linked orders with delivery address
      const orderWithAddress = submission.orders && submission.orders.length > 0 
        ? submission.orders.find(o => o.deliveryAddress) || submission.orders[0]
        : null;
      
      if (orderWithAddress && orderWithAddress.deliveryAddress) {
        // Use delivery address (first 2 words) + "submission"
        description = formatDescriptionFromAddress(orderWithAddress.deliveryAddress);
      } else if (submissionType === 'purchases' && submission.details?.deliveryLocation) {
        // For purchases, use deliveryLocation if available
        description = formatDescriptionFromAddress(submission.details.deliveryLocation);
      } else if (submissionType === 'purchases' && submission.details?.supplier) {
        // Support both old format (single item) and new format (multiple items)
        if (submission.details?.items && Array.isArray(submission.details.items) && submission.details.items.length > 0) {
          const itemsList = submission.details.items.map((item) => item.item).join(', ');
          description = `Purchase: ${itemsList} from ${submission.details.supplier}`;
        } else if (submission.details?.item) {
          description = `Purchase: ${submission.details.item} from ${submission.details.supplier}`;
        }
      } else if (submissionType === 'cash' && submission.details?.recipientName) {
        description = `Cash to: ${submission.details.recipientName}`;
      } else if (submissionType === 'general_expense' && submission.details?.nature) {
        description = `Expense: ${submission.details.nature}`;
      } else if (submissionType === 'payment_to_office' && submission.details?.accountType) {
        description = `Payment to office: ${submission.details.accountType}`;
      } else if (submissionType === 'order_payment' && (submission.details?.orderId != null)) {
        description = `Order payment #${submission.details.orderId}`;
      }

      entries.push({
        type: 'cash_submission',
        transactionId: submission.id,
        amount: parseFloat(submission.amount || 0),
        date: submission.createdAt,
        description: description
      });
    });

    // Add delivery_fee_debit transactions (Pay Now orders - 50% delivery fee reduction)
    const deliveryFeeDebits = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'delivery_fee_debit',
        status: 'completed',
        paymentStatus: 'paid'
      },
      include: [
        { model: db.Order, as: 'order', attributes: ['id', 'customerName'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });

    deliveryFeeDebits.forEach(tx => {
      const amount = Math.abs(parseFloat(tx.amount || 0)); // Make positive for display
      const description = tx.notes || (tx.order ? `50% delivery fee order ${tx.order.id}` : '50% delivery fee');
      entries.push({
        type: 'cash_sent', // This is a credit entry (money going out, reducing cash at hand)
        transactionId: tx.id,
        orderId: tx.orderId,
        customerName: tx.order?.customerName || null,
        amount: amount,
        date: tx.transactionDate || tx.createdAt,
        description: description,
        receiptNumber: tx.receiptNumber
      });
    });

    // Sort entries by date (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // CRITICAL: Return the synced database value to ensure consistency
    // This value matches what's stored in drivers.cashAtHand and what admin panel shows
    // Actual cash at hand = totalCashAtHand (value before pending submissions are approved)
    // Pending cash at hand = totalCashAtHand - sum(pending submission amounts) — value after all pending submissions are approved
    const payload = {
      totalCashAtHand: totalCashAtHand, // Synced database value from drivers.cashAtHand (Actual cash at hand)
      cashAtHand: totalCashAtHand, // Alias for consistency (some clients might use this field)
      entries: entries
    };
    if (pendingSubmissionsTotal > 0) {
      payload.pendingSubmissionsTotal = pendingSubmissionsTotal;
      payload.pendingCashAtHand = totalCashAtHand - pendingSubmissionsTotal;
    }
    sendSuccess(res, payload);
  } catch (error) {
    console.error('Error fetching cash at hand:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Initiate M-Pesa STK push for Pay on Delivery order payment (driver submits order cost + 50% savings via M-Pesa)
 * POST /api/driver-wallet/:driverId/order-payment-stk-push
 * Body: { orderId, phoneNumber } - phoneNumber optional (defaults to driver's phone), can be edited by driver
 */
router.post('/:driverId/order-payment-stk-push', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { orderId: bodyOrderId, phoneNumber: bodyPhone } = req.body;
    const orderId = bodyOrderId != null ? parseInt(bodyOrderId, 10) : null;

    if (!orderId || orderId < 1) {
      return sendError(res, 'orderId is required', 400);
    }

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const order = await db.Order.findOne({
      where: {
        id: orderId,
        driverId: parseInt(driverId, 10),
        status: 'completed',
        paymentStatus: 'paid',
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash'
      }
    });
    if (!order) {
      return sendError(res, 'Order not found or not eligible for order payment submission', 404);
    }

    const existingLinks = await db.sequelize.query(
      `SELECT cs.id FROM cash_submissions cs
       INNER JOIN cash_submission_orders cso ON cso."cashSubmissionId" = cs.id
       WHERE cs."driverId" = :driverId AND cs."submissionType" = 'order_payment' AND cso."orderId" = :orderId AND cs.status IN ('pending', 'approved')`,
      { type: db.sequelize.QueryTypes.SELECT, replacements: { driverId: parseInt(driverId, 10), orderId } }
    ).catch(() => []);
    if (existingLinks && existingLinks.length > 0) {
      return sendError(res, 'This order has already been submitted for order payment', 400);
    }

    const breakdown = await getOrderFinancialBreakdown(orderId);
    const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
    const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
    const savings = deliveryFee * 0.5;
    const submitAmount = itemsTotal + savings;

    if (submitAmount < 0.01) {
      return sendError(res, 'Order amount is too small', 400);
    }

    let phoneNumber = (bodyPhone && String(bodyPhone).trim()) || driver.phoneNumber;
    if (!phoneNumber) {
      return sendError(res, 'Phone number is required', 400);
    }
    const cleanedPhone = String(phoneNumber).replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    let wallet = await db.DriverWallet.findOne({ where: { driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      });
    }

    const accountReference = `ORDER-PAY-${orderId}`;
    const transactionDesc = `Order payment #${orderId} - KES ${submitAmount.toFixed(2)}`;

    let stkResponse;
    try {
      stkResponse = await mpesaService.initiateSTKPush(
        formattedPhone,
        submitAmount,
        accountReference,
        transactionDesc
      );
    } catch (mpesaError) {
      console.error('Error initiating M-Pesa STK Push for order payment:', mpesaError);
      return sendError(res, `Failed to initiate M-Pesa payment: ${mpesaError.message}`, 500);
    }

    const isSuccess = stkResponse.success !== undefined ? stkResponse.success : (stkResponse.ResponseCode === '0' || stkResponse.ResponseCode === 0);
    const checkoutRequestID = stkResponse.checkoutRequestID || stkResponse.CheckoutRequestID;

    if (!isSuccess && !checkoutRequestID) {
      const errMsg = stkResponse.errorMessage || stkResponse.CustomerMessage || stkResponse.error || 'STK push failed';
      return sendError(res, errMsg, 400);
    }

    const pendingTransaction = await db.Transaction.create({
      orderId: orderId,
      driverId: parseInt(driverId, 10),
      driverWalletId: wallet.id,
      transactionType: 'cash_settlement',
      paymentMethod: 'mobile_money',
      paymentProvider: 'mpesa',
      amount: submitAmount,
      status: 'pending',
      paymentStatus: 'pending',
      phoneNumber: formattedPhone,
      checkoutRequestID: checkoutRequestID || null,
      merchantRequestID: stkResponse.merchantRequestID || stkResponse.MerchantRequestID || null,
      notes: `order_payment_submission|orderId=${orderId}|driverId=${driverId}|amount=${submitAmount.toFixed(2)}`
    });

    console.log(`✅ Order payment STK push initiated for Order #${orderId}, CheckoutRequestID: ${checkoutRequestID}`);

    sendSuccess(res, {
      checkoutRequestID: checkoutRequestID,
      orderId: orderId,
      amount: submitAmount,
      message: 'Enter your M-Pesa PIN on your phone to complete the payment.'
    }, 'M-Pesa prompt sent');
  } catch (error) {
    console.error('Error initiating order payment STK push:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Submit cash at hand (remit cash to business via M-Pesa)
 * POST /api/driver-wallet/:driverId/cash-at-hand/submit
 * IMPORTANT: This route must be defined BEFORE /:driverId/withdraw to avoid route conflicts
 * 
 * This initiates an M-Pesa STK Push to the driver's phone. The driver enters their PIN
 * to send money to the business. The payment is confirmed via M-Pesa callback.
 */
router.post('/:driverId/cash-at-hand/submit', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid amount. Amount must be greater than 0', 400);
    }

    const submitAmount = parseFloat(amount);

    // Get driver info to get phone number
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    if (!driver.phoneNumber) {
      return sendError(res, 'Driver phone number is required', 400);
    }

    // Calculate current cash at hand (using same logic as GET endpoint)
    const cashOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash', // Only orders where customer paid cash
        paymentStatus: 'paid',
        status: {
          [Op.in]: ['delivered', 'completed']
        }
      },
      attributes: ['id', 'totalAmount', 'driverPayAmount']
    });

    // Get negative cash_settlement transactions (cash remitted)
    const cashSettlementsNegative = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.lt]: 0
        }
      },
      attributes: ['amount']
    });
    
    // Get positive cash_settlement transactions (cash added, e.g., from loan recovery)
    const cashSettlementsPositive = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.gt]: 0
        }
      },
      attributes: ['amount']
    });

    // For each order: totalAmount - driverPayAmount (delivery fee portion that belongs to driver)
    const cashCollected = cashOrders.reduce((sum, order) => {
      const totalAmount = parseFloat(order.totalAmount) || 0;
      const driverPayAmount = parseFloat(order.driverPayAmount) || 0;
      // Cash at hand = cash received minus the delivery fee portion that belongs to driver
      return sum + (totalAmount - driverPayAmount);
    }, 0);

    const cashRemitted = Math.abs(cashSettlementsNegative.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0));
    
    const cashAdded = cashSettlementsPositive.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0);

    // Allow negative cash at hand - drivers can go into negative balance (credit)
    const currentCashAtHand = cashCollected - cashRemitted + cashAdded;

    // Allow drivers to submit more than they have - they can go into negative balance
    // Removed validation that prevented submitting more than current cash at hand

    // Get or create wallet
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0
      });
    }

    // Format phone number for M-Pesa
    const cleanedPhone = driver.phoneNumber.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Create cash settlement transaction with pending status (will be updated when M-Pesa callback confirms payment)
    const settlementTransaction = await db.Transaction.create({
      orderId: null, // No specific order associated
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'cash_settlement',
      paymentMethod: 'mobile_money', // Changed from 'cash' to 'mobile_money'
      paymentProvider: 'mpesa',
      amount: -submitAmount, // Negative amount = cash remitted
      status: 'pending', // Will be updated to 'completed' when M-Pesa callback confirms
      paymentStatus: 'pending', // Will be updated to 'paid' when M-Pesa callback confirms
      phoneNumber: formattedPhone,
      notes: `Cash remittance to business: KES ${submitAmount.toFixed(2)} - Awaiting M-Pesa confirmation`
    });

    // Initiate M-Pesa STK Push to driver's phone
    // Driver will receive a prompt to enter their PIN and send money to the business
    const accountReference = `CASH-SETTLEMENT-${settlementTransaction.id}`;
    const transactionDesc = `Cash remittance to business - KES ${submitAmount.toFixed(2)}`;

    let stkResponse;
    try {
      stkResponse = await mpesaService.initiateSTKPush(
        formattedPhone,
        submitAmount,
        accountReference,
        transactionDesc
      );
    } catch (mpesaError) {
      console.error('Error initiating M-Pesa STK Push for cash settlement:', mpesaError);
      // Update transaction to failed status
      await settlementTransaction.update({
        status: 'failed',
        paymentStatus: 'failed',
        notes: `Failed to initiate M-Pesa payment: ${mpesaError.message}`
      });
      return sendError(res, `Failed to initiate M-Pesa payment: ${mpesaError.message}`, 500);
    }

    // Check if STK push was successful
    if (stkResponse.ResponseCode === '0') {
      // STK Push initiated successfully
      // Update transaction with checkout request IDs
      await settlementTransaction.update({
        checkoutRequestID: stkResponse.CheckoutRequestID,
        merchantRequestID: stkResponse.MerchantRequestID,
        notes: `Cash remittance to business: KES ${submitAmount.toFixed(2)} - M-Pesa STK Push initiated. Awaiting driver PIN confirmation.`
      });

      console.log(`✅ M-Pesa STK Push initiated for cash settlement #${settlementTransaction.id}`);
      console.log(`   Driver: ${driver.name} (${formattedPhone})`);
      console.log(`   Amount: KES ${submitAmount.toFixed(2)}`);
      console.log(`   CheckoutRequestID: ${stkResponse.CheckoutRequestID}`);

      sendSuccess(res, {
        transaction: {
          id: settlementTransaction.id,
          amount: submitAmount,
          status: 'pending',
          checkoutRequestID: stkResponse.CheckoutRequestID
        },
        message: 'M-Pesa payment prompt sent to your phone. Please enter your PIN to complete the payment.'
      }, 'M-Pesa payment prompt sent');
    } else {
      // STK Push failed
      await settlementTransaction.update({
        status: 'failed',
        paymentStatus: 'failed',
        notes: `M-Pesa STK Push failed: ${stkResponse.CustomerMessage || 'Unknown error'}`
      });

      console.error(`❌ M-Pesa STK Push failed for cash settlement #${settlementTransaction.id}:`, stkResponse.CustomerMessage);
      return sendError(res, `Failed to send payment prompt: ${stkResponse.CustomerMessage || 'Unknown error'}`, 400);
    }
  } catch (error) {
    console.error('Error submitting cash at hand:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Get driver wallet balance and tips
 * GET /api/driver-wallet/:driverId
 */
router.get('/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    // Get or create wallet
    let wallet = await db.DriverWallet.findOne({ 
      where: { driverId: driverId },
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber']
      }]
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
              totalTipsCount: 0,
              totalDeliveryPay: 0,
              totalDeliveryPayCount: 0
      });
    }

    // Get driver savings_credit transactions (50% of delivery fee credited to savings)
    const savingsCreditTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'savings_credit',
        driverWalletId: {
          [Op.not]: null
        },
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'deliveryAddress', 'createdAt', 'status']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50 // Last 50 savings credits
    });

    // Get cash settlement debits (driver remits collected cash)
    const cashSettlementTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'createdAt', 'status']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50 // Last 50 settlements
    });

    // No wallet: balance and withdrawals are not used. Only savings.
    const totalBalance = 0;
    const availableBalance = 0;

    // Get savings amount from wallet
    const savings = parseFloat(wallet.savings || 0);
    
    // Calculate today's savings withdrawal total (for daily limit check)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySavingsWithdrawals = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'savings_withdrawal',
        status: {
          [Op.in]: ['pending', 'completed']
        },
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      },
      attributes: ['amount']
    });
    
    const todayWithdrawn = todaySavingsWithdrawals.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0);
    
    const dailyLimit = 1000; // 1000 KES per day
    const remainingDailyLimit = Math.max(0, dailyLimit - todayWithdrawn);
    const canWithdraw = savings > 0 && remainingDailyLimit > 0;

    sendSuccess(res, {
      wallet: {
        id: wallet.id,
        driverId: wallet.driverId,
        balance: totalBalance,
        availableBalance: availableBalance,
        savings: savings
      },
      savingsWithdrawal: {
        dailyLimit: dailyLimit,
        todayWithdrawn: todayWithdrawn,
        remainingDailyLimit: remainingDailyLimit,
        canWithdraw: canWithdraw
      },
      recentDeliveryPayments: [], // No wallet
      recentSavingsCredits: savingsCreditTransactions.map(tx => {
        // Format description using delivery address (first 2 words) + "submission"
        let description = 'submission';
        if (tx.order && tx.order.deliveryAddress) {
          description = formatDescriptionFromAddress(tx.order.deliveryAddress);
        } else {
          description = tx.notes || `Savings credit from Order #${tx.orderId || 'N/A'}`;
        }
        return {
          id: tx.id,
          amount: Math.abs(parseFloat(tx.amount)),
          transactionType: 'savings_credit',
          orderId: tx.orderId,
          orderNumber: tx.order?.id,
          orderLocation: tx.order?.deliveryAddress || null,
          customerName: tx.order?.customerName,
          status: tx.order?.status,
          date: tx.createdAt,
          notes: description // Use formatted description
        };
      }),
      cashSettlements: cashSettlementTransactions.map(tx => ({
        id: tx.id,
        amount: Math.abs(parseFloat(tx.amount)),
        transactionType: tx.transactionType,
        orderId: tx.orderId,
        orderNumber: tx.order?.id,
        customerName: tx.order?.customerName,
        status: tx.order?.status,
        date: tx.createdAt,
        notes: tx.notes
      })),
      recentTips: [],
      recentWithdrawals: (await db.Transaction.findAll({
        where: {
          driverId: driverId,
          transactionType: 'savings_withdrawal',
          status: { [Op.in]: ['pending', 'completed'] }
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      })).map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount || 0),
        phoneNumber: tx.phoneNumber,
        status: tx.status,
        paymentStatus: tx.paymentStatus,
        receiptNumber: tx.receiptNumber,
        date: tx.transactionDate || tx.createdAt,
        notes: tx.notes || `Savings withdrawal${tx.phoneNumber ? ` to ${tx.phoneNumber}` : ''}`,
        paymentProvider: tx.paymentProvider // Include paymentProvider to identify loan/penalty transactions
      }))
    });
  } catch (error) {
    console.error('Error fetching driver wallet:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Withdraw savings: amount only. Recorded as savings withdrawal + cash at hand credit (reduction).
 * When phoneNumber is provided, can optionally initiate M-Pesa B2C; when omitted, record-only.
 * POST /api/driver-wallet/:driverId/withdraw-savings
 * Daily limit: 1000 KES per day
 */
router.post('/:driverId/withdraw-savings', async (req, res) => {
  try {
    const { driverId } = req.params;
    const amount = req.body?.amount;
    const phoneNumber = req.body?.phoneNumber; // Optional. When missing/null/empty, record-only (no M-Pesa).

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid withdrawal amount', 400);
    }

    const withdrawalAmount = parseFloat(amount);
    const dailyLimit = 1000;

    let wallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      });
    }

    const currentSavings = parseFloat(wallet.savings || 0);
    if (withdrawalAmount > currentSavings) {
      return sendError(res, `Insufficient savings. Available: KES ${currentSavings.toFixed(2)}`, 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayWithdrawals = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'savings_withdrawal',
        status: { [Op.in]: ['pending', 'completed'] },
        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow }
      },
      attributes: ['amount']
    });
    const todayWithdrawn = todayWithdrawals.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const remainingLimit = dailyLimit - todayWithdrawn;
    if (withdrawalAmount > remainingLimit) {
      return sendError(res, `Daily withdrawal limit exceeded. You can withdraw up to KES ${remainingLimit.toFixed(2)} today (limit: KES ${dailyLimit.toFixed(2)}/day)`, 400);
    }

    const doRecordOnly = !phoneNumber || String(phoneNumber).trim() === '';
    const formattedPhone = doRecordOnly ? null : (() => {
      const cleaned = String(phoneNumber).replace(/\D/g, '');
      if (cleaned.startsWith('0')) return '254' + cleaned.substring(1);
      if (!cleaned.startsWith('254')) return '254' + cleaned;
      return cleaned;
    })();

    const withdrawalTransaction = await db.Transaction.create({
      orderId: null,
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'savings_withdrawal',
      paymentMethod: doRecordOnly ? 'cash' : 'mobile_money',
      paymentProvider: doRecordOnly ? 'savings_withdrawal_record' : 'mpesa',
      amount: withdrawalAmount,
      status: doRecordOnly ? 'completed' : 'pending',
      paymentStatus: doRecordOnly ? 'paid' : 'pending',
      phoneNumber: formattedPhone,
      notes: doRecordOnly
        ? `Savings withdrawal - KES ${withdrawalAmount.toFixed(2)}`
        : `Savings withdrawal to ${formattedPhone}`
    });

    await wallet.update({ savings: currentSavings - withdrawalAmount });

    const driver = await db.Driver.findByPk(driverId);
    if (driver) {
      const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
      const newCashAtHand = currentCashAtHand - withdrawalAmount;
      await driver.update({ cashAtHand: newCashAtHand });
      console.log(`   Driver ${driverId} cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)} (savings withdrawal -${withdrawalAmount.toFixed(2)})`);
      
      // Create cash at hand transaction log entry for savings withdrawal
      await db.Transaction.create({
        orderId: null,
        driverId: driverId,
        driverWalletId: wallet.id,
        transactionType: 'cash_settlement', // Using cash_settlement type to show in cash at hand log
        paymentMethod: doRecordOnly ? 'cash' : 'mobile_money',
        paymentProvider: doRecordOnly ? 'savings_withdrawal_record' : 'mpesa',
        amount: -withdrawalAmount, // Negative amount to show as credit (money going out)
        status: withdrawalTransaction.status,
        paymentStatus: withdrawalTransaction.paymentStatus,
        phoneNumber: formattedPhone,
        transactionDate: withdrawalTransaction.createdAt || new Date(),
        notes: `Savings withdrawal - KES ${withdrawalAmount.toFixed(2)}`
      });
      console.log(`✅ Created cash_settlement transaction for savings withdrawal: ${withdrawalAmount.toFixed(2)}, notes: "Savings withdrawal - KES ${withdrawalAmount.toFixed(2)}"`);
    }

    if (!doRecordOnly && formattedPhone) {
      try {
        const b2cResult = await mpesaService.initiateB2C(
          formattedPhone,
          withdrawalAmount,
          `Savings withdrawal for driver #${driverId} - Transaction #${withdrawalTransaction.id}`,
          'Savings Withdrawal'
        );
        if (b2cResult.success) {
          await withdrawalTransaction.update({
            checkoutRequestID: b2cResult.conversationID,
            merchantRequestID: b2cResult.originatorConversationID,
            notes: (withdrawalTransaction.notes || '') + '\nB2C initiated: ' + (b2cResult.responseDescription || '')
          });
          console.log(`✅ B2C payment initiated for savings withdrawal transaction #${withdrawalTransaction.id}`);
        } else {
          await wallet.update({ savings: currentSavings });
          if (driver) await driver.update({ cashAtHand: parseFloat(driver.cashAtHand || 0) + withdrawalAmount });
          await withdrawalTransaction.update({ status: 'failed', paymentStatus: 'failed' });
          throw new Error(b2cResult.responseDescription || 'Failed to initiate B2C payment');
        }
      } catch (b2cError) {
        console.error('B2C initiation error:', b2cError);
        await wallet.update({ savings: currentSavings });
        if (driver) await driver.update({ cashAtHand: parseFloat(driver.cashAtHand || 0) + withdrawalAmount });
        await withdrawalTransaction.update({ status: 'failed', paymentStatus: 'failed' });
        throw b2cError;
      }
    }

    await wallet.reload();
    sendSuccess(res, {
      transaction: {
        id: withdrawalTransaction.id,
        amount: withdrawalAmount,
        phoneNumber: formattedPhone,
        status: withdrawalTransaction.status,
        conversationID: withdrawalTransaction.checkoutRequestID
      },
      newSavings: parseFloat(wallet.savings),
      remainingDailyLimit: Math.max(0, remainingLimit - withdrawalAmount),
      note: doRecordOnly
        ? `Savings withdrawal of KES ${withdrawalAmount.toFixed(2)}. Your cash at hand has been reduced by this amount.`
        : 'The withdrawal will be completed when M-Pesa processes the payment.'
    }, doRecordOnly ? 'Savings withdrawal completed.' : 'Savings withdrawal initiated. Payment will be processed shortly.');
  } catch (error) {
    console.error('Error processing savings withdrawal:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Withdraw to M-Pesa (B2C) - Wallet balance withdrawal
 * POST /api/driver-wallet/:driverId/withdraw
 */
router.post('/:driverId/withdraw', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount, phoneNumber } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid withdrawal amount');
    }

    if (!phoneNumber) {
      return sendError(res, 'Phone number is required');
    }

    // Get wallet
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
              totalTipsCount: 0,
              totalDeliveryPay: 0,
              totalDeliveryPayCount: 0
      });
    }

    const withdrawalAmount = parseFloat(amount);
    const totalBalance = parseFloat(wallet.balance) || 0;

    // Calculate available balance (exclude amount on hold)
    const tipTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'tip',
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'status']
      }]
    });

    let amountOnHold = 0;
    tipTransactions.forEach(tx => {
      if (tx.order && tx.order.status !== 'completed') {
        amountOnHold += parseFloat(tx.amount) || 0;
      }
    });

    const availableBalance = Math.max(0, totalBalance - amountOnHold);

    if (withdrawalAmount > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient available balance. Available: KES ${availableBalance.toFixed(2)}, On Hold: KES ${amountOnHold.toFixed(2)}` 
      });
    }

    // Format phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Initiate B2C payment via M-Pesa
    // Note: You'll need to implement B2C in mpesaService
    // For now, we'll create the withdrawal transaction and update wallet
    // The actual M-Pesa B2C call should be implemented in mpesaService.initiateB2C()

    // Create withdrawal transaction
    const withdrawalTransaction = await db.Transaction.create({
      orderId: null, // Withdrawals don't have order IDs
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'withdrawal',
      paymentMethod: 'mobile_money',
      paymentProvider: 'mpesa',
      amount: withdrawalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      phoneNumber: formattedPhone,
      notes: `Withdrawal to ${formattedPhone}`
    });

    // Update wallet balance (reserve the amount)
    await wallet.update({
      balance: totalBalance - withdrawalAmount
    });

    // Withdrawing from wallet reduces driver's cash at hand by the amount withdrawn
    const driver = await db.Driver.findByPk(driverId);
    if (driver) {
      const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
      const newCashAtHand = Math.max(0, currentCashAtHand - withdrawalAmount);
      await driver.update({ cashAtHand: newCashAtHand });
      console.log(`   Driver ${driverId} cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)} (withdrawal -${withdrawalAmount.toFixed(2)})`);
    }

    // Initiate M-Pesa B2C payment
    try {
      const b2cResult = await mpesaService.initiateB2C(
        formattedPhone, 
        withdrawalAmount, 
        `Driver withdrawal for transaction #${withdrawalTransaction.id}`,
        'Driver Wallet Withdrawal'
      );

      if (b2cResult.success) {
        // Update transaction with B2C details
        await withdrawalTransaction.update({
          checkoutRequestID: b2cResult.conversationID,
          merchantRequestID: b2cResult.originatorConversationID,
          notes: withdrawalTransaction.notes ? 
            `${withdrawalTransaction.notes}\nB2C initiated: ${b2cResult.responseDescription}` : 
            `B2C initiated: ${b2cResult.responseDescription}`
        });

        // Transaction will be updated to 'completed' when B2C callback confirms payment
        // For now, keep it as 'pending' until callback arrives
        console.log(`✅ B2C payment initiated for withdrawal transaction #${withdrawalTransaction.id}`);
      } else {
        // B2C initiation failed - refund the wallet balance
        await wallet.update({
          balance: totalBalance // Restore balance
        });
        
        await withdrawalTransaction.update({
          status: 'failed',
          paymentStatus: 'failed',
          notes: withdrawalTransaction.notes ? 
            `${withdrawalTransaction.notes}\nB2C failed: ${b2cResult.responseDescription}` : 
            `B2C failed: ${b2cResult.responseDescription}`
        });

        throw new Error(b2cResult.responseDescription || 'Failed to initiate B2C payment');
      }
    } catch (b2cError) {
      console.error('B2C initiation error:', b2cError);
      
      // Refund wallet balance on error
      await wallet.update({
        balance: totalBalance
      });
      
      await withdrawalTransaction.update({
        status: 'failed',
        paymentStatus: 'failed',
        notes: withdrawalTransaction.notes ? 
          `${withdrawalTransaction.notes}\nB2C error: ${b2cError.message}` : 
          `B2C error: ${b2cError.message}`
      });
      
      throw b2cError;
    }

    // Reload wallet to get updated balance
    await wallet.reload();

    sendSuccess(res, {
      transaction: {
        id: withdrawalTransaction.id,
        amount: withdrawalAmount,
        phoneNumber: formattedPhone,
        status: withdrawalTransaction.status,
        conversationID: withdrawalTransaction.checkoutRequestID
      },
      newBalance: parseFloat(wallet.balance),
      note: 'The withdrawal will be completed when M-Pesa processes the payment. You will be notified when it\'s completed.'
    }, 'Withdrawal initiated successfully. Payment will be processed shortly.');
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    sendError(res, error.message, 500);
  }
});

module.exports = router;

