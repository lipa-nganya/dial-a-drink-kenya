const db = require('../models');
const { Op } = require('sequelize');
const { finalizeOrderPayment } = require('../routes/mpesa');

/**
 * Sync pending transactions for an order by querying M-Pesa status
 * This is called when an order is marked as paid but transactions are still pending
 * @param {number} orderId - Order ID
 * @returns {Promise<void>}
 */
const syncPendingTransactionsForOrder = async (orderId) => {
  try {
    console.log(`🔄 Syncing pending transactions for Order #${orderId}...`);
    
    // Find pending payment transactions for this order
    const pendingTransactions = await db.Transaction.findAll({
      where: {
        orderId: orderId,
        transactionType: 'payment',
        status: {
          [Op.in]: ['pending', 'processing']
        }
      },
      order: [['createdAt', 'DESC']]
    });

    if (!pendingTransactions || pendingTransactions.length === 0) {
      console.log(`ℹ️  No pending payment transactions found for Order #${orderId}`);
      return;
    }

    console.log(`📋 Found ${pendingTransactions.length} pending transaction(s) for Order #${orderId}`);

    // Get M-Pesa service
    const mpesaService = require('../services/mpesa');

    // Check each pending transaction
    for (const transaction of pendingTransactions) {
      if (!transaction.checkoutRequestID) {
        console.log(`⚠️  Transaction #${transaction.id} has no checkoutRequestID, skipping`);
        continue;
      }

      // Check if order is already marked as paid - if so, update transactions even without M-Pesa query
      const order = await db.Order.findByPk(orderId);
      const orderIsPaid = order && order.paymentStatus === 'paid';
      
      if (orderIsPaid) {
        console.log(`✅ Order #${orderId} is already marked as paid. Updating pending transactions...`);
        
        // Update transaction to completed (receipt number will be set if available from M-Pesa)
        await transaction.update({
          status: 'completed',
          paymentStatus: 'paid'
        });

        // Also update delivery_pay transaction if it exists
        const deliveryTransaction = await db.Transaction.findOne({
          where: {
            orderId: orderId,
            transactionType: 'delivery_pay',
            status: {
              [Op.in]: ['pending', 'processing']
            }
          }
        });

        if (deliveryTransaction) {
          await deliveryTransaction.update({
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: transaction.receiptNumber || null,
            checkoutRequestID: transaction.checkoutRequestID || null
          });
          console.log(`✅ Updated delivery transaction #${deliveryTransaction.id}`);
        }

        console.log(`✅ Updated payment transaction #${transaction.id} to completed`);
        
        // Try to query M-Pesa for receipt number if credentials are available
        try {
          console.log(`🔍 Querying M-Pesa for checkoutRequestID: ${transaction.checkoutRequestID}`);
          const mpesaStatus = await mpesaService.checkTransactionStatus(transaction.checkoutRequestID);
          
          const callbackMetadata = mpesaStatus?.CallbackMetadata;
          const items = callbackMetadata?.Item || [];
          const receiptFromMetadata = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
          const receiptFromResponse = mpesaStatus?.ReceiptNumber;
          const receiptNumber = receiptFromMetadata || receiptFromResponse;

          if (receiptNumber) {
            await transaction.update({ receiptNumber });
            if (deliveryTransaction) {
              await deliveryTransaction.update({ receiptNumber });
            }
            console.log(`✅ Updated transactions with receipt number: ${receiptNumber}`);
          }
        } catch (mpesaError) {
          console.log(`ℹ️  Could not query M-Pesa for receipt number (credentials may not be available): ${mpesaError.message}`);
          // This is okay - transactions are already updated to completed
        }
        
        continue; // Skip M-Pesa query attempt below
      }

      // If order is not paid, try to query M-Pesa
      try {
        console.log(`🔍 Querying M-Pesa for checkoutRequestID: ${transaction.checkoutRequestID}`);
        
        // Query M-Pesa for transaction status
        const mpesaStatus = await mpesaService.checkTransactionStatus(transaction.checkoutRequestID);
        
        console.log(`📊 M-Pesa response for ${transaction.checkoutRequestID}:`, JSON.stringify(mpesaStatus, null, 2));

        // Extract receipt number from M-Pesa response
        const callbackMetadata = mpesaStatus?.CallbackMetadata;
        const items = callbackMetadata?.Item || [];
        const receiptFromMetadata = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
        const receiptFromResponse = mpesaStatus?.ReceiptNumber;
        const receiptNumber = receiptFromMetadata || receiptFromResponse;

        // Check if payment was completed (ResultCode 0 with receipt number)
        const isCompleted = mpesaStatus && mpesaStatus.ResultCode === 0 && receiptNumber;

        if (isCompleted) {
          console.log(`✅ Payment completed for transaction #${transaction.id}. Receipt: ${receiptNumber}`);
          
          // Update transaction status
          await transaction.update({
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: receiptNumber
          });

          // Finalize order payment to update order status and create/update related transactions
          try {
            await finalizeOrderPayment({
              orderId: orderId,
              paymentTransaction: transaction,
              receiptNumber: receiptNumber,
              req: null, // No req object available in this context
              context: 'Transaction sync (auto-fix)'
            });
            console.log(`✅ Order #${orderId} finalized via transaction sync`);
          } catch (finalizeError) {
            console.error(`❌ Error finalizing order payment:`, finalizeError);
            // Don't throw - transaction is already updated
          }
        } else {
          console.log(`ℹ️  Transaction #${transaction.id} is still pending. ResultCode: ${mpesaStatus?.ResultCode}, Receipt: ${receiptNumber || 'none'}`);
        }
      } catch (mpesaError) {
        console.error(`❌ Error querying M-Pesa for transaction #${transaction.id}:`, mpesaError.message);
        // Continue with next transaction
      }
    }

    console.log(`✅ Finished syncing transactions for Order #${orderId}`);
  } catch (error) {
    console.error(`❌ Error syncing pending transactions for Order #${orderId}:`, error);
    // Don't throw - this is a non-critical operation
  }
};

module.exports = {
  syncPendingTransactionsForOrder
};

