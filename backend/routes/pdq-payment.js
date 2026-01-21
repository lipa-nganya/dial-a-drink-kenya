const express = require('express');
const router = express.Router();
const db = require('../models');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { creditWalletsOnDeliveryCompletion } = require('../utils/walletCredits');
const { finalizeOrderPayment } = require('./mpesa'); // Reuse payment finalization logic

/**
 * Process PDQ card payment (for Admin)
 * POST /api/pdq-payment/process
 * This endpoint processes a card payment that was completed via PDQ machine
 */
router.post('/process', async (req, res) => {
  try {
    const { orderId, amount, cardLast4, cardType, authorizationCode, receiptNumber } = req.body;

    if (!orderId || !amount || !receiptNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: orderId, amount, receiptNumber' 
      });
    }

    // Validate order exists
    const order = await db.Order.findByPk(orderId, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    // Validate amount matches order total
    const expectedAmount = parseFloat(order.totalAmount);
    const providedAmount = parseFloat(amount);
    
    if (Math.abs(providedAmount - expectedAmount) > 0.01) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected KES ${expectedAmount.toFixed(2)}, got KES ${providedAmount.toFixed(2)}` 
      });
    }

    const now = new Date();
    const breakdown = await getOrderFinancialBreakdown(orderId);
    const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;

    // Create payment transaction
    let paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: order.id,
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']]
    });

    const pdqNote = `PDQ card payment processed. Card: ${cardType || 'N/A'} ending in ${cardLast4 || 'N/A'}, Auth Code: ${authorizationCode || 'N/A'}`;

    if (paymentTransaction) {
      await paymentTransaction.update({
        paymentMethod: 'card',
        paymentProvider: 'pdq',
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber,
        transactionDate: now,
        notes: paymentTransaction.notes ? `${paymentTransaction.notes}\n${pdqNote}` : pdqNote
      });
    } else {
      paymentTransaction = await db.Transaction.create({
        orderId: order.id,
        transactionType: 'payment',
        paymentMethod: 'card',
        paymentProvider: 'pdq',
        amount: itemsTotal,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber,
        transactionDate: now,
        notes: pdqNote
      });
    }

    // Finalize order payment
    await finalizeOrderPayment({
      orderId: order.id,
      paymentTransaction: paymentTransaction,
      receiptNumber: receiptNumber,
      req: req,
      context: 'PDQ card payment'
    });

    // Reload order to get updated status
    await order.reload();

    console.log(`✅ PDQ payment processed successfully for Order #${order.id}`);

    return res.json({
      success: true,
      message: 'PDQ payment processed successfully',
      order: order,
      transaction: paymentTransaction
    });
  } catch (error) {
    console.error('❌ Error processing PDQ payment:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process PDQ payment',
      details: error.stack
    });
  }
});

/**
 * Process PDQ card payment (for Driver)
 * POST /api/pdq-payment/driver-process
 * This endpoint processes a card payment that was completed via PDQ machine by driver
 */
router.post('/driver-process', async (req, res) => {
  try {
    const { orderId, driverId, amount, cardLast4, cardType, authorizationCode, receiptNumber } = req.body;

    if (!orderId || !driverId || !amount || !receiptNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: orderId, driverId, amount, receiptNumber' 
      });
    }

    // Validate order exists
    const order = await db.Order.findByPk(orderId, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.driverId !== parseInt(driverId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (order.paymentType !== 'pay_on_delivery') {
      return res.status(400).json({ error: 'Order is not pay on delivery' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order payment is already marked as paid' });
    }

    // Validate amount matches order total
    const expectedAmount = parseFloat(order.totalAmount);
    const providedAmount = parseFloat(amount);
    
    if (Math.abs(providedAmount - expectedAmount) > 0.01) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected KES ${expectedAmount.toFixed(2)}, got KES ${providedAmount.toFixed(2)}` 
      });
    }

    const now = new Date();
    const breakdown = await getOrderFinancialBreakdown(orderId);
    const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;

    // Create payment transaction
    let paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: order.id,
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']]
    });

    const pdqNote = `PDQ card payment processed by driver #${driverId}. Card: ${cardType || 'N/A'} ending in ${cardLast4 || 'N/A'}, Auth Code: ${authorizationCode || 'N/A'}`;

    if (paymentTransaction) {
      await paymentTransaction.update({
        paymentMethod: 'card',
        paymentProvider: 'pdq',
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber,
        transactionDate: now,
        notes: paymentTransaction.notes ? `${paymentTransaction.notes}\n${pdqNote}` : pdqNote
      });
    } else {
      paymentTransaction = await db.Transaction.create({
        orderId: order.id,
        transactionType: 'payment',
        paymentMethod: 'card',
        paymentProvider: 'pdq',
        amount: itemsTotal,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber,
        transactionDate: now,
        notes: pdqNote
      });
    }

    // Update order
    await order.update({
      paymentStatus: 'paid',
      paymentMethod: 'card',
      paymentConfirmedAt: now
    });

    // Determine final order status
    const currentOrderStatus = order.status;
    let finalStatus = currentOrderStatus;
    
    if (currentOrderStatus === 'out_for_delivery' ||
        currentOrderStatus === 'delivered') {
      finalStatus = 'completed';
    }

    if (finalStatus !== currentOrderStatus) {
      await order.update({ status: finalStatus });
    }

    // Credit wallets if order is completed
    if (finalStatus === 'completed') {
      try {
        await creditWalletsOnDeliveryCompletion(order.id);
      } catch (creditError) {
        console.error('Error crediting wallets:', creditError);
        // Don't fail the payment if wallet crediting fails
      }
    }

    // Reload order to get updated status
    await order.reload();

    console.log(`✅ PDQ payment processed successfully by driver for Order #${order.id}`);

    return res.json({
      success: true,
      message: 'PDQ payment processed successfully',
      order: order,
      transaction: paymentTransaction
    });
  } catch (error) {
    console.error('❌ Error processing driver PDQ payment:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process PDQ payment',
      details: error.stack
    });
  }
});

module.exports = router;
