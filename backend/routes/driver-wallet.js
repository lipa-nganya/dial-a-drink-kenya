const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Get cash at hand data for driver
 * GET /api/driver-wallet/:driverId/cash-at-hand
 * IMPORTANT: This route must be defined BEFORE /:driverId to avoid route conflicts
 * 
 * Cash at hand = (Total cash received from pay_on_delivery orders where customer paid cash)
 *                - (Delivery fee portion that belongs to driver for each order)
 *                - (Cash remitted to business)
 */
router.get('/:driverId/cash-at-hand', async (req, res) => {
  try {
    const { driverId } = req.params;

    // Get driver to access cashAtHand field (source of truth)
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Use driver's cashAtHand field as the source of truth
    // This field is maintained when cash submissions are approved/rejected
    // CRITICAL: Always use the database value to match admin panel display
    // If it's 0/null, calculate and update it, but always return the calculated value for consistency
    let totalCashAtHand = parseFloat(driver.cashAtHand || 0);

    // Get all cash collected from pay_on_delivery orders where customer paid cash
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
      attributes: ['id', 'customerName', 'totalAmount', 'driverPayAmount', 'createdAt', 'status'],
      order: [['createdAt', 'DESC']]
    });

    // Get all cash settlement transactions where driver remits cash to company
    // These are negative amounts (cash going from driver to business)
    const cashSettlements = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.lt]: 0 // Only negative amounts (cash remitted)
        }
      },
      attributes: ['id', 'amount', 'createdAt', 'notes', 'receiptNumber'],
      order: [['createdAt', 'DESC']]
    });

    // Get all approved cash submissions (these reduce cash at hand)
    const approvedCashSubmissions = await db.CashSubmission.findAll({
      where: {
        driverId: driverId,
        status: 'approved'
      },
      attributes: ['id', 'amount', 'createdAt', 'submissionType', 'details'],
      order: [['createdAt', 'DESC']]
    });

    // Calculate actual cash at hand from transactions (for verification and sync)
    // For each order: totalAmount - driverPayAmount (delivery fee portion that belongs to driver)
    const cashCollected = cashOrders.reduce((sum, order) => {
      const totalAmount = parseFloat(order.totalAmount) || 0;
      const driverPayAmount = parseFloat(order.driverPayAmount) || 0;
      // Cash at hand = cash received minus the delivery fee portion that belongs to driver
      return sum + (totalAmount - driverPayAmount);
    }, 0);

    const cashRemitted = Math.abs(cashSettlements.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0));

    // Subtract approved cash submissions (these have been deducted from driver's cash)
    const approvedSubmissionsTotal = approvedCashSubmissions.reduce((sum, submission) => {
      return sum + parseFloat(submission.amount || 0);
    }, 0);

    // Allow negative cash at hand - drivers can go into negative balance (credit)
    const calculatedCashAtHand = cashCollected - cashRemitted - approvedSubmissionsTotal;

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
      console.log(`🔄 [Cash At Hand Sync] Driver ${driverId}: Updated cashAtHand from ${oldValue} to ${calculatedCashAtHand} (DB now: ${totalCashAtHand}, calculated: ${calculatedCashAtHand}, cashCollected: ${cashCollected}, cashRemitted: ${cashRemitted}, approvedSubmissions: ${approvedSubmissionsTotal})`);
    } else {
      // Values match, but always use calculated value to ensure consistency
      // This ensures both endpoints return the exact same value
      totalCashAtHand = calculatedCashAtHand;
      console.log(`✅ [Cash At Hand Sync] Driver ${driverId}: Value in sync (DB: ${parseFloat(driver.cashAtHand || 0)}, using calculated: ${calculatedCashAtHand})`);
    }

    // Format entries for response
    const entries = [];

    // Add cash order entries
    cashOrders.forEach(order => {
      const totalAmount = parseFloat(order.totalAmount) || 0;
      const driverPayAmount = parseFloat(order.driverPayAmount) || 0;
      const cashReceived = totalAmount - driverPayAmount;
      
      entries.push({
        type: 'cash_received',
        orderId: order.id,
        customerName: order.customerName,
        amount: cashReceived, // Cash received after subtracting driver's delivery fee portion
        date: order.createdAt,
        description: `Cash received for Order #${order.id}`
      });
    });

    // Add cash settlement entries (remittances to business)
    cashSettlements.forEach(tx => {
      entries.push({
        type: 'cash_sent',
        transactionId: tx.id,
        amount: Math.abs(parseFloat(tx.amount) || 0), // Make positive for display
        date: tx.createdAt,
        description: tx.notes || `Cash remitted to business`,
        receiptNumber: tx.receiptNumber
      });
    });

    // Add approved cash submission entries (these reduce cash at hand)
    approvedCashSubmissions.forEach(submission => {
      const submissionType = submission.submissionType;
      let description = 'Cash submission';
      if (submissionType === 'purchases' && submission.details?.supplier) {
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
      }

      entries.push({
        type: 'cash_submission',
        transactionId: submission.id,
        amount: parseFloat(submission.amount || 0),
        date: submission.createdAt,
        description: description
      });
    });

    // Sort entries by date (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // CRITICAL: Return the synced database value to ensure consistency
    // This value matches what's stored in drivers.cashAtHand and what admin panel shows
    sendSuccess(res, {
      totalCashAtHand: totalCashAtHand, // Synced database value from drivers.cashAtHand
      cashAtHand: totalCashAtHand, // Alias for consistency (some clients might use this field)
      entries: entries
    });
  } catch (error) {
    console.error('Error fetching cash at hand:', error);
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

    const cashSettlements = await db.Transaction.findAll({
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

    // For each order: totalAmount - driverPayAmount (delivery fee portion that belongs to driver)
    const cashCollected = cashOrders.reduce((sum, order) => {
      const totalAmount = parseFloat(order.totalAmount) || 0;
      const driverPayAmount = parseFloat(order.driverPayAmount) || 0;
      // Cash at hand = cash received minus the delivery fee portion that belongs to driver
      return sum + (totalAmount - driverPayAmount);
    }, 0);

    const cashRemitted = Math.abs(cashSettlements.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0));

    // Allow negative cash at hand - drivers can go into negative balance (credit)
    const currentCashAtHand = cashCollected - cashRemitted;

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

    // Get tip transactions for this driver
    const tipTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'tip',
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'createdAt', 'status']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50 // Last 50 tips
    });

    // Get driver pay transactions (only the per-delivery payouts configured in admin)
    const driverDeliveryTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'delivery_pay',
        driverWalletId: {
          [Op.not]: null
        },
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'createdAt', 'status']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50 // Last 50 delivery payments
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

    // Calculate amount on hold (tips for orders that are not completed)
    let amountOnHold = 0;
    tipTransactions.forEach(tx => {
      if (tx.order && tx.order.status !== 'completed') {
        amountOnHold += parseFloat(tx.amount) || 0;
      }
    });

    // Calculate available balance (total balance minus amount on hold)
    const totalBalance = parseFloat(wallet.balance) || 0;
    const availableBalance = Math.max(0, totalBalance - amountOnHold);

    // Get withdrawal transactions for this driver
    const withdrawalTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'withdrawal'
      },
      order: [['createdAt', 'DESC']],
      limit: 20 // Last 20 withdrawals
    });

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
        balance: totalBalance, // Total balance (includes amount on hold)
        availableBalance: availableBalance, // Available balance (excludes amount on hold)
        amountOnHold: amountOnHold, // Amount on hold (tips for non-completed orders)
        savings: savings, // Driver savings (withheld delivery fees)
        totalTipsReceived: parseFloat(wallet.totalTipsReceived) || 0,
              totalTipsCount: wallet.totalTipsCount || 0,
              totalDeliveryPay: parseFloat(wallet.totalDeliveryPay) || 0,
              totalDeliveryPayCount: wallet.totalDeliveryPayCount || 0
      },
      savingsWithdrawal: {
        dailyLimit: dailyLimit,
        todayWithdrawn: todayWithdrawn,
        remainingDailyLimit: remainingDailyLimit,
        canWithdraw: canWithdraw
      },
      recentDeliveryPayments: driverDeliveryTransactions.map(tx => ({
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
      recentTips: tipTransactions.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount),
        orderId: tx.orderId,
        orderNumber: tx.order?.id,
        customerName: tx.order?.customerName,
        date: tx.createdAt,
        notes: tx.notes
      })),
      recentWithdrawals: withdrawalTransactions.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount),
        phoneNumber: tx.phoneNumber,
        status: tx.status,
        paymentStatus: tx.paymentStatus,
        receiptNumber: tx.receiptNumber,
        date: tx.createdAt,
        notes: tx.notes
      }))
    });
  } catch (error) {
    console.error('Error fetching driver wallet:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Withdraw savings to M-Pesa (B2C)
 * POST /api/driver-wallet/:driverId/withdraw-savings
 * Daily limit: 1000 KES per day
 */
router.post('/:driverId/withdraw-savings', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount, phoneNumber } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid withdrawal amount', 400);
    }

    if (!phoneNumber) {
      return sendError(res, 'Phone number is required', 400);
    }

    const withdrawalAmount = parseFloat(amount);
    const dailyLimit = 1000; // 1000 KES per day

    // Get wallet to check savings
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

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayWithdrawals = await db.Transaction.findAll({
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

    const todayWithdrawn = todayWithdrawals.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0);

    const remainingLimit = dailyLimit - todayWithdrawn;

    if (withdrawalAmount > remainingLimit) {
      return sendError(res, `Daily withdrawal limit exceeded. You can withdraw up to KES ${remainingLimit.toFixed(2)} today (KES ${todayWithdrawn.toFixed(2)} already withdrawn, limit: KES ${dailyLimit.toFixed(2)}/day)`, 400);
    }

    // Format phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Create savings withdrawal transaction
    const withdrawalTransaction = await db.Transaction.create({
      orderId: null,
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'savings_withdrawal',
      paymentMethod: 'mobile_money',
      paymentProvider: 'mpesa',
      amount: withdrawalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      phoneNumber: formattedPhone,
      notes: `Savings withdrawal to ${formattedPhone}`
    });

    // Update wallet savings (reserve the amount)
    await wallet.update({
      savings: currentSavings - withdrawalAmount
    });

    // Initiate M-Pesa B2C payment
    try {
      const b2cResult = await mpesaService.initiateB2C(
        formattedPhone,
        withdrawalAmount,
        `Savings withdrawal for driver #${driverId} - Transaction #${withdrawalTransaction.id}`,
        'Savings Withdrawal'
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

        console.log(`✅ B2C payment initiated for savings withdrawal transaction #${withdrawalTransaction.id}`);
      } else {
        // B2C initiation failed - refund the savings
        await wallet.update({
          savings: currentSavings // Restore savings
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

      // Refund savings on error
      await wallet.update({
        savings: currentSavings
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

    // Reload wallet to get updated savings
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
      remainingDailyLimit: remainingLimit - withdrawalAmount,
      note: 'The withdrawal will be completed when M-Pesa processes the payment. You will be notified when it\'s completed.'
    }, 'Savings withdrawal initiated successfully. Payment will be processed shortly.');
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

