const express = require('express');
const router = express.Router();
const pesapalService = require('../services/pesapal');
const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { creditWalletsOnDeliveryCompletion } = require('../utils/walletCredits');
const { finalizeOrderPayment } = require('./mpesa'); // Reuse payment finalization logic

/**
 * Initiate PesaPal card payment for an order
 * POST /api/pesapal/initiate-payment
 */
router.post('/initiate-payment', async (req, res) => {
  try {
    const { orderId, callbackUrl, cancellationUrl, cardDetails } = req.body;
    
    // Note: cardDetails are collected for UX, but PesaPal requires redirecting to their secure payment page
    // for PCI compliance. The card details will be entered again on PesaPal's secure page.
    if (cardDetails) {
      console.log('💳 Card details received (will redirect to PesaPal secure page):', {
        cardNumber: cardDetails.cardNumber ? `${cardDetails.cardNumber.slice(0, 4)}****` : 'N/A',
        expiryDate: cardDetails.expiryDate ? '**/**' : 'N/A',
        cardName: cardDetails.cardName || 'N/A'
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        error: 'Missing required field: orderId' 
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

    // Check if order is already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    // Prepare order data for PesaPal
    const orderData = {
      id: `ORDER-${orderId}-${Date.now()}`, // Unique tracking ID
      currency: 'KES',
      amount: parseFloat(order.totalAmount),
      description: `Payment for Order #${orderId}`,
      customerName: order.customerName || 'Customer',
      customerEmail: order.customerEmail || '',
      customerPhone: order.customerPhone || '',
      deliveryAddress: order.deliveryAddress || '',
      callbackUrl: callbackUrl,
      cancellationUrl: cancellationUrl
    };

    console.log('🚀 Initiating PesaPal payment:', {
      orderId,
      amount: orderData.amount,
      customerName: orderData.customerName
    });

    // Submit order request to PesaPal
    const pesapalResponse = await pesapalService.submitOrderRequest(orderData);

    if (!pesapalResponse.success) {
      return res.status(500).json({ 
        error: pesapalResponse.error || 'Failed to initiate PesaPal payment',
        details: pesapalResponse.rawResponse
      });
    }

    // Create a pending transaction record
    const transaction = await db.Transaction.create({
      orderId: order.id,
      transactionType: 'payment',
      paymentMethod: 'card',
      paymentProvider: 'pesapal',
      amount: parseFloat(order.totalAmount),
      status: 'pending',
      paymentStatus: 'pending',
      checkoutRequestID: pesapalResponse.orderTrackingId,
      merchantRequestID: pesapalResponse.merchantReference,
      notes: `PesaPal payment initiated for Order #${order.id}. Redirect URL: ${pesapalResponse.redirectUrl}`
    });

    console.log('✅ PesaPal payment initiated successfully:', {
      orderId: order.id,
      transactionId: transaction.id,
      redirectUrl: pesapalResponse.redirectUrl,
      orderTrackingId: pesapalResponse.orderTrackingId
    });

    return res.json({
      success: true,
      redirectUrl: pesapalResponse.redirectUrl,
      orderTrackingId: pesapalResponse.orderTrackingId,
      merchantReference: pesapalResponse.merchantReference,
      transactionId: transaction.id
    });
  } catch (error) {
    console.error('❌ Error initiating PesaPal payment:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to initiate payment',
      details: error.stack
    });
  }
});

/**
 * Handle PesaPal IPN (Instant Payment Notification) callback
 * GET /api/pesapal/ipn
 * PesaPal sends IPN notifications via GET request with query parameters
 */
router.get('/ipn', async (req, res) => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📥📥📥 PesaPal IPN CALLBACK RECEIVED:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request query:', JSON.stringify(req.query, null, 2));
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    const { OrderTrackingId, OrderMerchantReference } = req.query;

    console.log('📥 PesaPal IPN received:', {
      OrderTrackingId,
      OrderMerchantReference,
      query: req.query
    });

    if (!OrderTrackingId) {
      console.error('❌ Missing OrderTrackingId in IPN callback');
      return res.status(400).json({ error: 'Missing OrderTrackingId' });
    }

    // Get transaction status from PesaPal
    const statusResponse = await pesapalService.getTransactionStatus(OrderTrackingId);

    console.log('📊 PesaPal transaction status:', JSON.stringify(statusResponse, null, 2));

    // Find the transaction by orderTrackingId
    let transaction = await db.Transaction.findOne({
      where: {
        checkoutRequestID: OrderTrackingId,
        paymentProvider: 'pesapal'
      },
      include: [
        {
          model: db.Order,
          as: 'order'
        }
      ]
    });

    let order = null;

    // If transaction doesn't exist, try to find order by merchant reference and create transaction
    if (!transaction) {
      console.log('⚠️  Transaction not found for OrderTrackingId:', OrderTrackingId);
      console.log('   Attempting to find order by merchant reference:', OrderMerchantReference);
      
      // Try to extract order ID from merchant reference (format: ORDER-{orderId}-{timestamp})
      let orderId = null;
      if (OrderMerchantReference) {
        const match = OrderMerchantReference.match(/ORDER-(\d+)/);
        if (match) {
          orderId = parseInt(match[1]);
        }
      }
      
      // If we have orderId, find the order
      if (orderId) {
        order = await db.Order.findByPk(orderId);
        if (order) {
          console.log('✅ Found order #' + orderId + ' by merchant reference');
          
          // Create transaction record for this payment
          transaction = await db.Transaction.create({
            orderId: order.id,
            transactionType: 'payment',
            paymentMethod: 'card',
            paymentProvider: 'pesapal',
            amount: parseFloat(order.totalAmount),
            status: 'pending',
            paymentStatus: 'pending',
            checkoutRequestID: OrderTrackingId,
            merchantRequestID: OrderMerchantReference,
            notes: `PesaPal payment transaction created from IPN callback for Order #${order.id}`
          });
          
          console.log('✅ Created transaction #' + transaction.id + ' for Order #' + order.id);
        }
      }
      
      // If still no order/transaction, return error
      if (!transaction || !order) {
        console.error('❌ Could not find or create transaction/order for OrderTrackingId:', OrderTrackingId);
        return res.status(404).json({ error: 'Transaction and order not found' });
      }
    } else {
      order = transaction.order;
      if (!order) {
        console.error('❌ Order not found for transaction:', transaction.id);
        return res.status(404).json({ error: 'Order not found' });
      }
    }

    // Check payment status from PesaPal response
    const paymentStatus = statusResponse.payment_status_description || statusResponse.payment_status;
    const isPaid = paymentStatus === 'COMPLETED' || paymentStatus === 'completed';

    if (isPaid) {
      // Payment completed
      const receiptNumber = statusResponse.payment_method || statusResponse.payment_method_description || statusResponse.payment_reference || `PESAPAL-${OrderTrackingId}`;
      const paymentDate = statusResponse.payment_date || statusResponse.created_date || new Date();
      const paymentMethod = statusResponse.payment_method || statusResponse.payment_method_description || 'Card';
      
      console.log('✅ PesaPal payment completed for Order #' + order.id);
      console.log('   Receipt Number:', receiptNumber);
      console.log('   Payment Method:', paymentMethod);
      console.log('   Payment Date:', paymentDate);
      
      // Update transaction with payment details
      await transaction.update({
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber,
        transactionDate: paymentDate,
        amount: parseFloat(order.totalAmount), // Ensure amount matches order
        notes: `PesaPal payment completed. Status: ${paymentStatus}, Method: ${paymentMethod}, Tracking ID: ${OrderTrackingId}`
      });

      console.log('✅ Transaction #' + transaction.id + ' updated with payment details');

      // Finalize order payment (this updates order.paymentStatus to 'paid' and order.status to 'confirmed')
      // Use same pattern as M-Pesa callback for consistency
      try {
        console.log(`🔧 Calling finalizeOrderPayment for Order #${order.id} with transaction #${transaction.id}`);
        console.log(`   Transaction status: ${transaction.status}, paymentStatus: ${transaction.paymentStatus}`);
        console.log(`   Receipt number: ${receiptNumber || 'none'}`);
        console.log(`   Payment provider: ${transaction.paymentProvider || 'pesapal'}`);
        
        const finalizeResult = await finalizeOrderPayment({
          orderId: order.id,
          paymentTransaction: transaction,
          receiptNumber: receiptNumber,
          req: req,
          context: 'PesaPal IPN callback'
        });

        console.log('✅ PesaPal payment finalized successfully for Order #' + order.id);
        console.log('   Order paymentStatus:', finalizeResult.order?.paymentStatus || 'updated');
        console.log('   Order status:', finalizeResult.order?.status || 'updated');
      } catch (finalizeError) {
        console.error('❌ Error finalizing PesaPal payment:', finalizeError);
        console.error('   Error message:', finalizeError.message);
        console.error('   Error stack:', finalizeError.stack);
        console.error('   Order ID:', order.id);
        console.error('   Transaction ID:', transaction.id);
        console.error('   Receipt number:', receiptNumber);
        // Don't fail the IPN callback, but ensure order is updated
      }

      // Reload order after finalizeOrderPayment to get updated status (same as M-Pesa)
      await order.reload();
      
      // Check if this is a POS order
      const isPOSOrder = order.deliveryAddress === 'In-Store Purchase';
      
      // CRITICAL: Ensure order status is updated even if finalizeOrderPayment failed or returned early
      // This prevents orders from being stuck at pending (same pattern as M-Pesa)
      if (transaction.status === 'completed' && transaction.paymentStatus === 'paid') {
        const needsStatusUpdate = order.status === 'pending' || order.paymentStatus !== 'paid';
        if (needsStatusUpdate) {
          console.error(`⚠️  Order #${order.id} status not updated by finalizeOrderPayment. Current: status='${order.status}', paymentStatus='${order.paymentStatus}'. Forcing update...`);
          try {
            // For POS orders, set status to 'completed', for delivery orders set to 'confirmed'
            const targetStatus = isPOSOrder ? 'completed' : (order.status === 'pending' ? 'confirmed' : order.status);
            
            // Use raw SQL first to ensure it works (same as M-Pesa)
            await db.sequelize.query(
              `UPDATE orders SET "paymentStatus" = 'paid', status = CASE WHEN :isPOS = true THEN 'completed' WHEN status = 'pending' THEN 'confirmed' ELSE status END, "updatedAt" = NOW() WHERE id = :id`,
              {
                replacements: { id: order.id, isPOS: isPOSOrder }
              }
            );
            // Also try Sequelize update as backup (same as M-Pesa)
            await order.update({
              paymentStatus: 'paid',
              status: targetStatus
            });
            await order.reload();
            console.log(`✅ Forced order #${order.id} status update: paymentStatus='paid', status='${order.status}'${isPOSOrder ? ' (POS Order)' : ''}`);
          } catch (forceUpdateError) {
            console.error('❌ Error forcing order update:', forceUpdateError);
          }
        }
      }
      
      // CRITICAL: Double-check paymentStatus before emitting socket events (same as M-Pesa)
      // Use database values from direct query (most reliable)
      const dbOrder = await db.sequelize.query(
        `SELECT "paymentStatus", status, "driverId" FROM orders WHERE id = :id`,
        {
          replacements: { id: order.id },
          type: db.sequelize.QueryTypes.SELECT
        }
      );
      
      const actualPaymentStatus = dbOrder[0]?.paymentStatus || order.paymentStatus || 'paid';
      const actualStatus = dbOrder[0]?.status || order.status;
      
      // Double-check paymentStatus one more time before emitting (same as M-Pesa)
      if (actualPaymentStatus !== 'paid') {
        console.log(`⚠️  Final order paymentStatus is still not 'paid' (${actualPaymentStatus}), forcing update again...`);
        await db.sequelize.query(
          `UPDATE orders SET "paymentStatus" = 'paid' WHERE id = :id`,
          {
            replacements: { id: order.id }
          }
        );
        await order.reload();
        const finalVerify = await db.sequelize.query(
          `SELECT "paymentStatus" FROM orders WHERE id = :id`,
          {
            replacements: { id: order.id },
            type: db.sequelize.QueryTypes.SELECT
          }
        );
        console.log(`✅ After force update - PaymentStatus: ${finalVerify[0]?.paymentStatus}`);
      }
      
      // Update order object with database values
      order.paymentStatus = actualPaymentStatus;
      order.status = actualStatus;

      // Return success response to PesaPal
      return res.status(200).json({
        status: 'success',
        message: 'Payment processed successfully',
        orderId: order.id,
        transactionId: transaction.id
      });
    } else {
      // Payment not completed yet or failed
      const status = paymentStatus === 'FAILED' || paymentStatus === 'failed' ? 'failed' : 'pending';
      
      await transaction.update({
        status: status,
        paymentStatus: status === 'failed' ? 'unpaid' : 'pending',
        notes: `PesaPal payment status: ${paymentStatus}`
      });

      console.log(`⚠️  PesaPal payment ${status} for Order #${order.id}. Status: ${paymentStatus}`);

      return res.status(200).json({
        status: status,
        message: `Payment ${status}`
      });
    }
  } catch (error) {
    console.error('❌ Error processing PesaPal IPN:', error);
    // Return 200 to PesaPal even on error (to prevent retries)
    return res.status(200).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Get transaction status by order ID
 * GET /api/pesapal/transaction-status/:orderId
 */
router.get('/transaction-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get the order first
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Find the transaction for this order
    let transaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        paymentProvider: 'pesapal',
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']] // Get most recent
    });

    // If transaction doesn't exist, create one (payment might have been completed but transaction not recorded)
    if (!transaction) {
      console.log('⚠️  Transaction not found for Order #' + orderId + ', creating new transaction record');
      transaction = await db.Transaction.create({
        orderId: orderId,
        transactionType: 'payment',
        paymentMethod: 'card',
        paymentProvider: 'pesapal',
        amount: parseFloat(order.totalAmount),
        status: 'pending',
        paymentStatus: 'pending',
        notes: `PesaPal payment transaction created from status check for Order #${orderId}`
      });
      console.log('✅ Created transaction #' + transaction.id + ' for Order #' + orderId);
    }

    // CRITICAL: Always check status with PesaPal if we have a checkoutRequestID or orderTrackingId
    // This ensures we immediately finalize payment when PesaPal confirms success
    // Even if transaction appears completed, double-check with PesaPal API to ensure consistency
    const orderTrackingId = transaction.checkoutRequestID || order.orderTrackingId;
    if (orderTrackingId) {
      try {
        console.log(`🔍 Checking PesaPal transaction status for Order #${orderId} using tracking ID: ${orderTrackingId}...`);
        const statusResponse = await pesapalService.getTransactionStatus(orderTrackingId);
        const paymentStatus = statusResponse.payment_status_description || statusResponse.payment_status;
        const isPaid = paymentStatus === 'COMPLETED' || paymentStatus === 'completed';

        console.log(`📊 PesaPal status check result:`, {
          paymentStatus,
          isPaid,
          currentTransactionStatus: transaction.status,
          orderPaymentStatus: order.paymentStatus
        });

        // CRITICAL: If PesaPal confirms payment is completed, immediately finalize
        // Don't wait for IPN callbacks - trust PesaPal's API response
        // Update payment status to COMPLETED as soon as backend confirms success
        if (isPaid) {
          const receiptNumber = statusResponse.payment_method || statusResponse.payment_method_description || statusResponse.payment_reference || `PESAPAL-${orderTrackingId || orderId}`;
          const paymentDate = statusResponse.payment_date || statusResponse.created_date || new Date();
          const paymentMethod = statusResponse.payment_method || statusResponse.payment_method_description || 'Card';
          
          console.log('✅✅✅ PesaPal payment COMPLETED confirmed by API for Order #' + orderId);
          console.log('   Receipt Number:', receiptNumber);
          console.log('   Payment Method:', paymentMethod);
          console.log('   Payment Status from PesaPal:', paymentStatus);
          
          // CRITICAL: Update transaction immediately if payment is completed (regardless of current status)
          // This ensures payment status is set to COMPLETED as soon as backend confirms success
          if (transaction.status !== 'completed' || transaction.paymentStatus !== 'paid') {
            await transaction.update({
              status: 'completed',
              paymentStatus: 'paid',
              receiptNumber: receiptNumber,
              transactionDate: paymentDate,
              amount: parseFloat(order.totalAmount), // Ensure amount matches order
              checkoutRequestID: transaction.checkoutRequestID || statusResponse.order_tracking_id,
              notes: `PesaPal payment completed (confirmed via API). Status: ${paymentStatus}, Method: ${paymentMethod}`
            });
            console.log('✅ Transaction #' + transaction.id + ' updated to COMPLETED with payment details');
          } else {
            console.log('✅ Transaction #' + transaction.id + ' already marked as COMPLETED');
          }

          // Finalize order payment (this updates order.paymentStatus to 'paid' and order.status to 'confirmed')
          // Use same pattern as M-Pesa callback for consistency
          try {
            console.log(`🔧 Calling finalizeOrderPayment for Order #${order.id} with transaction #${transaction.id}`);
            console.log(`   Transaction status: ${transaction.status}, paymentStatus: ${transaction.paymentStatus}`);
            console.log(`   Receipt number: ${receiptNumber || 'none'}`);
            console.log(`   Payment provider: ${transaction.paymentProvider || 'pesapal'}`);
            
            const finalizeResult = await finalizeOrderPayment({
              orderId: order.id,
              paymentTransaction: transaction,
              receiptNumber: receiptNumber,
              req: req,
              context: 'PesaPal status check'
            });

            console.log('✅ PesaPal payment finalized successfully for Order #' + order.id);
            console.log('   Order paymentStatus:', finalizeResult.order?.paymentStatus || 'updated');
            console.log('   Order status:', finalizeResult.order?.status || 'updated');
          } catch (finalizeError) {
            console.error('❌ Error finalizing PesaPal payment:', finalizeError);
            console.error('   Error message:', finalizeError.message);
            console.error('   Error stack:', finalizeError.stack);
            console.error('   Order ID:', order.id);
            console.error('   Transaction ID:', transaction.id);
            console.error('   Receipt number:', receiptNumber);
            // Don't fail, but ensure order is updated
          }

          // Reload order after finalizeOrderPayment to get updated status (same as M-Pesa)
          await order.reload();
          
          // Check if this is a POS order
          const isPOSOrder = order.deliveryAddress === 'In-Store Purchase';
          
          // CRITICAL: Ensure order status is updated even if finalizeOrderPayment failed or returned early
          // This prevents orders from being stuck at pending (same pattern as M-Pesa)
          if (transaction.status === 'completed' && transaction.paymentStatus === 'paid') {
            const needsStatusUpdate = order.status === 'pending' || order.paymentStatus !== 'paid';
            if (needsStatusUpdate) {
              console.error(`⚠️  Order #${order.id} status not updated by finalizeOrderPayment. Current: status='${order.status}', paymentStatus='${order.paymentStatus}'. Forcing update...`);
              try {
                // For POS orders, set status to 'completed', for delivery orders set to 'confirmed'
                const targetStatus = isPOSOrder ? 'completed' : (order.status === 'pending' ? 'confirmed' : order.status);
                
                // Use raw SQL first to ensure it works (same as M-Pesa)
                await db.sequelize.query(
                  `UPDATE orders SET "paymentStatus" = 'paid', status = CASE WHEN :isPOS = true THEN 'completed' WHEN status = 'pending' THEN 'confirmed' ELSE status END, "updatedAt" = NOW() WHERE id = :id`,
                  {
                    replacements: { id: order.id, isPOS: isPOSOrder }
                  }
                );
                // Also try Sequelize update as backup (same as M-Pesa)
                await order.update({
                  paymentStatus: 'paid',
                  status: targetStatus
                });
                await order.reload();
                console.log(`✅ Forced order #${order.id} status update: paymentStatus='paid', status='${order.status}'${isPOSOrder ? ' (POS Order)' : ''}`);
              } catch (forceUpdateError) {
                console.error(`❌ Error forcing order status update:`, forceUpdateError);
              }
            }
          }
          
          // CRITICAL: Double-check paymentStatus before emitting socket events (same as M-Pesa)
          // Use database values from direct query (most reliable)
          const dbOrder = await db.sequelize.query(
            `SELECT "paymentStatus", status, "driverId" FROM orders WHERE id = :id`,
            {
              replacements: { id: order.id },
              type: db.sequelize.QueryTypes.SELECT
            }
          );
          
          const actualPaymentStatus = dbOrder[0]?.paymentStatus || order.paymentStatus || 'paid';
          const actualStatus = dbOrder[0]?.status || order.status;
          
          // Double-check paymentStatus one more time before emitting (same as M-Pesa)
          if (actualPaymentStatus !== 'paid') {
            console.log(`⚠️  Final order paymentStatus is still not 'paid' (${actualPaymentStatus}), forcing update again...`);
            await db.sequelize.query(
              `UPDATE orders SET "paymentStatus" = 'paid' WHERE id = :id`,
              {
                replacements: { id: order.id }
              }
            );
            await order.reload();
            const finalVerify = await db.sequelize.query(
              `SELECT "paymentStatus" FROM orders WHERE id = :id`,
              {
                replacements: { id: order.id },
                type: db.sequelize.QueryTypes.SELECT
              }
            );
            console.log(`✅ After force update - PaymentStatus: ${finalVerify[0]?.paymentStatus}`);
          }
          
          // Update order object with database values
          order.paymentStatus = actualPaymentStatus;
          order.status = actualStatus;
        }

        // Reload order to get latest status after finalization
        await order.reload();
        
        return res.json({
          success: isPaid,
          status: isPaid ? 'completed' : paymentStatus.toLowerCase(),
          receiptNumber: isPaid ? (statusResponse.payment_method || `PESAPAL-${transaction.checkoutRequestID}`) : null,
          paymentMethod: transaction.paymentMethod,
          transactionDate: isPaid ? (statusResponse.payment_date || transaction.transactionDate) : null,
          orderStatus: order.status,
          orderPaymentStatus: order.paymentStatus
        });
      } catch (statusError) {
        console.error('Error checking PesaPal transaction status:', statusError);
        // Return current transaction status if PesaPal check fails
        return res.json({
          success: false,
          status: transaction.status,
          receiptNumber: transaction.receiptNumber,
          paymentMethod: transaction.paymentMethod
        });
      }
    }

    // Return current transaction status
    return res.json({
      success: transaction.status === 'completed',
      status: transaction.status,
      receiptNumber: transaction.receiptNumber,
      paymentMethod: transaction.paymentMethod,
      transactionDate: transaction.transactionDate
    });
  } catch (error) {
    console.error('Error getting PesaPal transaction status:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Manual fix endpoint to update order status for successful card payments
 * GET /api/pesapal/fix-order/:orderId
 */
router.get('/fix-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔧 Manual fix requested for Order #${orderId}`);
    
    // Get the order
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Find the transaction for this order
    const transaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        paymentProvider: 'pesapal',
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'PesaPal transaction not found for this order' });
    }
    
    console.log(`📊 Order #${orderId} current status:`, {
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      transactionStatus: transaction.status,
      transactionPaymentStatus: transaction.paymentStatus
    });
    
    // If transaction is completed, update order
    if (transaction.status === 'completed' && transaction.paymentStatus === 'paid') {
      const isPOSOrder = order.deliveryAddress === 'In-Store Purchase';
      const targetStatus = isPOSOrder ? 'completed' : 'confirmed';
      
      console.log(`✅ Transaction is completed. Updating order to: paymentStatus='paid', status='${targetStatus}'`);
      
      await db.sequelize.query(
        `UPDATE orders SET "paymentStatus" = 'paid', status = :targetStatus, "updatedAt" = NOW() WHERE id = :id`,
        {
          replacements: { id: orderId, targetStatus },
          type: db.sequelize.QueryTypes.UPDATE
        }
      );
      
      await order.reload();
      
      // Call finalizeOrderPayment to ensure all side effects are handled
      try {
        await finalizeOrderPayment({
          orderId: order.id,
          paymentTransaction: transaction,
          receiptNumber: transaction.receiptNumber,
          req: req,
          context: 'Manual fix endpoint'
        });
        console.log(`✅ Order #${orderId} finalized successfully`);
      } catch (finalizeError) {
        console.error(`⚠️  Error in finalizeOrderPayment, but order status was updated:`, finalizeError);
      }
      
      return res.json({
        success: true,
        message: `Order #${orderId} updated successfully`,
        order: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
    } else {
      // Transaction not completed, check with PesaPal
      console.log(`⚠️  Transaction not completed. Checking with PesaPal...`);
      
      if (transaction.checkoutRequestID) {
        const statusResponse = await pesapalService.getTransactionStatus(transaction.checkoutRequestID);
        const paymentStatus = statusResponse.payment_status_description || statusResponse.payment_status;
        const isPaid = paymentStatus === 'COMPLETED' || paymentStatus === 'completed';
        
        if (isPaid) {
          // Update transaction and order
          const receiptNumber = statusResponse.payment_method || statusResponse.payment_method_description || statusResponse.payment_reference || `PESAPAL-${transaction.checkoutRequestID}`;
          
          await transaction.update({
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: receiptNumber
          });
          
          const isPOSOrder = order.deliveryAddress === 'In-Store Purchase';
          const targetStatus = isPOSOrder ? 'completed' : 'confirmed';
          
          await db.sequelize.query(
            `UPDATE orders SET "paymentStatus" = 'paid', status = :targetStatus, "updatedAt" = NOW() WHERE id = :id`,
            {
              replacements: { id: orderId, targetStatus },
              type: db.sequelize.QueryTypes.UPDATE
            }
          );
          
          await order.reload();
          
          // Call finalizeOrderPayment
          try {
            await finalizeOrderPayment({
              orderId: order.id,
              paymentTransaction: transaction,
              receiptNumber: receiptNumber,
              req: req,
              context: 'Manual fix endpoint (PesaPal check)'
            });
          } catch (finalizeError) {
            console.error(`⚠️  Error in finalizeOrderPayment:`, finalizeError);
          }
          
          return res.json({
            success: true,
            message: `Order #${orderId} updated successfully after PesaPal check`,
            order: {
              id: order.id,
              status: order.status,
              paymentStatus: order.paymentStatus
            }
          });
        } else {
          return res.json({
            success: false,
            message: `Payment not completed yet. Status: ${paymentStatus}`,
            order: {
              id: order.id,
              status: order.status,
              paymentStatus: order.paymentStatus
            }
          });
        }
      } else {
        return res.json({
          success: false,
          message: 'Transaction has no checkoutRequestID to check with PesaPal',
          order: {
            id: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error in manual fix endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
