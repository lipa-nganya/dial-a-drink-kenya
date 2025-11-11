const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');

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

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        driverId: wallet.driverId,
        balance: totalBalance, // Total balance (includes amount on hold)
        availableBalance: availableBalance, // Available balance (excludes amount on hold)
        amountOnHold: amountOnHold, // Amount on hold (tips for non-completed orders)
        totalTipsReceived: parseFloat(wallet.totalTipsReceived) || 0,
              totalTipsCount: wallet.totalTipsCount || 0,
              totalDeliveryPay: parseFloat(wallet.totalDeliveryPay) || 0,
              totalDeliveryPayCount: wallet.totalDeliveryPayCount || 0
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * Withdraw to M-Pesa (B2C)
 * POST /api/driver-wallet/:driverId/withdraw
 */
router.post('/:driverId/withdraw', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount, phoneNumber } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
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

    res.json({
      success: true,
      message: 'Withdrawal initiated successfully. Payment will be processed shortly.',
      transaction: {
        id: withdrawalTransaction.id,
        amount: withdrawalAmount,
        phoneNumber: formattedPhone,
        status: withdrawalTransaction.status,
        conversationID: withdrawalTransaction.checkoutRequestID
      },
      newBalance: parseFloat(wallet.balance),
      note: 'The withdrawal will be completed when M-Pesa processes the payment. You will be notified when it\'s completed.'
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

