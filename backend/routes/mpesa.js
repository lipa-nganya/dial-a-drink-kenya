const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesa');
const db = require('../models');

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

    // Validate amount matches order total (excluding tip, since tip is separate transaction)
    // Note: order.totalAmount includes tip, so payment should be totalAmount - tipAmount
    const tipAmount = parseFloat(order.tipAmount) || 0;
    const expectedTotal = parseFloat(order.totalAmount) - tipAmount;
    
    if (Math.abs(parseFloat(amount) - expectedTotal) > 0.01) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected KES ${expectedTotal.toFixed(2)} (order total ${parseFloat(order.totalAmount).toFixed(2)} minus tip ${tipAmount.toFixed(2)}), got KES ${parseFloat(amount).toFixed(2)}` 
      });
    }

    // Initiate STK Push
    const reference = accountReference || `ORDER-${orderId}`;
    const description = `Payment for Order #${orderId}`;

    console.log('Initiating STK Push with:', {
      phoneNumber,
      amount,
      reference,
      description,
      orderId
    });

    const stkResponse = await mpesaService.initiateSTKPush(
      phoneNumber,
      amount,
      reference,
      description
    );

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
      
      // Create transaction record for STK push initiation
      // Payment amount should exclude tip (tip is separate transaction)
      const tipAmount = parseFloat(order.tipAmount) || 0;
      const paymentAmount = parseFloat(amount); // Already validated to be totalAmount - tipAmount
      
      try {
        await db.Transaction.create({
          orderId: order.id,
          transactionType: 'payment',
          paymentMethod: 'mobile_money',
          paymentProvider: 'mpesa',
          amount: paymentAmount, // Order total minus tip
          status: 'pending',
          paymentStatus: 'pending', // Set initial payment status
          checkoutRequestID: checkoutRequestID,
          merchantRequestID: stkResponse.MerchantRequestID,
          phoneNumber: phoneNumber,
          notes: `STK Push initiated. ${stkResponse.CustomerMessage || ''}${tipAmount > 0 ? ` (Tip: KES ${tipAmount.toFixed(2)} is separate transaction)` : ''}`
        });
        console.log(`✅ Transaction record created for Order #${orderId}`);
      } catch (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError);
        // Don't fail the STK push if transaction creation fails - log it but continue
        console.log('⚠️  Continuing with STK push despite transaction creation error');
      }
      
      console.log(`✅ STK Push initiated for Order #${orderId}. CheckoutRequestID: ${checkoutRequestID}`);

      res.json({
        success: true,
        message: stkResponse.CustomerMessage || stkResponse.customerMessage || 'STK Push initiated successfully. Please check your phone to complete payment.',
        checkoutRequestID: checkoutRequestID,
        customerMessage: stkResponse.CustomerMessage || stkResponse.customerMessage,
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

          // Find transaction record by checkoutRequestID first (most reliable)
          let transaction = await db.Transaction.findOne({
            where: {
              checkoutRequestID: checkoutRequestID
            }
          });
          
          console.log(`🔍 Transaction lookup by checkoutRequestID: ${transaction ? `Found #${transaction.id} (status: ${transaction.status})` : 'Not found'}`);
          
          // If not found by checkoutRequestID, try by orderId (get most recent pending transaction)
          if (!transaction) {
            transaction = await db.Transaction.findOne({
              where: {
                orderId: order.id
              },
              order: [['createdAt', 'DESC']]
            });
            console.log(`🔍 Transaction lookup by orderId: ${transaction ? `Found #${transaction.id} (status: ${transaction.status}, checkoutID: ${transaction.checkoutRequestID})` : 'Not found'}`);
          }
          
          // If still not found, try to find by matching checkoutRequestID in transaction checkoutRequestID field
          if (!transaction && checkoutRequestID) {
            // Try fuzzy match - sometimes the checkoutRequestID might be slightly different
            const allTransactions = await db.Transaction.findAll({
              where: {
                orderId: order.id
              },
              order: [['createdAt', 'DESC']]
            });
            
            // Find transaction with matching checkoutRequestID (exact or partial)
            transaction = allTransactions.find(t => 
              t.checkoutRequestID === checkoutRequestID || 
              (t.checkoutRequestID && checkoutRequestID.includes(t.checkoutRequestID.substring(0, 20))) ||
              (t.checkoutRequestID && t.checkoutRequestID.includes(checkoutRequestID.substring(0, 20)))
            );
            
            if (transaction) {
              console.log(`🔍 Found transaction via fuzzy match: #${transaction.id}`);
            }
          }

          if (!transaction) {
            // Create new transaction if not found
            // Payment amount should exclude tip (tip is separate transaction)
            const tipAmount = parseFloat(order.tipAmount) || 0;
            const paymentAmount = parseFloat(amount); // Callback amount already excludes tip if validation was correct
            
            console.log(`📝 Creating new transaction for Order #${order.id} with CheckoutRequestID: ${checkoutRequestID}`);
            transaction = await db.Transaction.create({
              orderId: order.id,
              transactionType: 'payment',
              paymentMethod: 'mobile_money',
              paymentProvider: 'mpesa',
              amount: paymentAmount, // Order total minus tip
              status: 'completed',
              paymentStatus: 'paid', // Set payment status to 'paid' when creating
              receiptNumber: receiptNumber,
              checkoutRequestID: checkoutRequestID,
              merchantRequestID: stkCallback.MerchantRequestID,
              phoneNumber: phoneNumber,
              transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
              notes: `Payment completed via M-Pesa. Receipt: ${receiptNumber}${tipAmount > 0 ? ` (Tip: KES ${tipAmount.toFixed(2)} is separate transaction)` : ''}`
            });
            console.log(`✅ Created transaction #${transaction.id} with status: ${transaction.status}`);
          } else {
            // Update existing transaction - ensure orderId is set if it wasn't
            // Also ensure amount excludes tip (in case transaction was created before fix)
            const tipAmount = parseFloat(order.tipAmount) || 0;
            const paymentAmount = parseFloat(amount); // Callback amount should already exclude tip
            
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
                    amount: paymentAmount, // Ensure amount excludes tip
                    receiptNumber: receiptNumber || transaction.receiptNumber || null,
                    transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
                    phoneNumber: phoneNumber || transaction.phoneNumber || null,
                    note: `✅ Payment completed. Receipt: ${receiptNumber || 'N/A'}${tipAmount > 0 ? ` (Tip: KES ${tipAmount.toFixed(2)} is separate transaction)` : ''}`
                  }
                }
              );
              
              // Also try Sequelize update as backup
              await transaction.update({
                orderId: order.id, // Ensure orderId is set
                amount: paymentAmount, // Ensure amount excludes tip
                status: 'completed',
                paymentStatus: 'paid', // Update payment status to 'paid'
                receiptNumber: receiptNumber,
                transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
                phoneNumber: phoneNumber || transaction.phoneNumber,
                notes: transaction.notes ? 
                  `${transaction.notes}\n✅ Payment completed. Receipt: ${receiptNumber}${tipAmount > 0 ? ` (Tip: KES ${tipAmount.toFixed(2)} is separate transaction)` : ''}` : 
                  `✅ Payment completed via M-Pesa. Receipt: ${receiptNumber}${tipAmount > 0 ? ` (Tip: KES ${tipAmount.toFixed(2)} is separate transaction)` : ''}`
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
          } else if (currentOrderStatus === 'pending' || currentOrderStatus === 'confirmed' || currentOrderStatus === 'preparing') {
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
    
    console.log(`🔍 M-Pesa status check: ResultCode=${mpesaStatus?.ResultCode}, hasReceiptNumber=${!!hasReceiptNumber}, isCompleted=${isCompleted}`);
    
    // If M-Pesa confirms payment completion (ResultCode 0 AND has receipt number), update our database
    if (isCompleted) {
      // Find transaction by checkoutRequestID
      const transaction = await db.Transaction.findOne({
        where: { checkoutRequestID: checkoutRequestID },
        include: [{
          model: db.Order,
          as: 'order'
        }]
      });
      
      if (transaction && transaction.status !== 'completed') {
        // Extract receipt number from M-Pesa response
        // M-Pesa query API returns receipt in CallbackMetadata when payment is complete
        // Check both possible locations
        const receiptFromMetadata = mpesaStatus.CallbackMetadata?.Item?.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
        const receiptFromResponse = mpesaStatus.ReceiptNumber;
        const receiptNumber = receiptFromMetadata || receiptFromResponse || null;
        
        console.log(`🔍 Receipt number extraction: metadata=${receiptFromMetadata}, response=${receiptFromResponse}, final=${receiptNumber}`);
        
        console.log(`💰 M-Pesa confirmed payment. Receipt: ${receiptNumber || 'N/A'}`);
        
        // STEP 1: Update transaction status FIRST (payment is independent of order status)
        await db.sequelize.query(
          `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "receiptNumber" = :receiptNumber, "updatedAt" = NOW() WHERE id = :id`,
          {
            replacements: {
              id: transaction.id,
              receiptNumber: receiptNumber
            }
          }
        );
        
        console.log(`✅ Transaction #${transaction.id} updated to completed`);
        
        // STEP 2: Update order status (transaction completion triggers order confirmation)
        if (transaction.orderId) {
          // Update order status to 'confirmed' (transaction completion triggers confirmation)
          // Note: paymentStatus is derived from transaction status, not stored separately
          await db.sequelize.query(
            `UPDATE orders SET status = 'confirmed', "updatedAt" = NOW() WHERE id = :id`,
            {
              replacements: { id: transaction.orderId }
            }
          );
          
          console.log(`✅ Order #${transaction.orderId} status updated to 'confirmed' (triggered by transaction completion)`);
          
          // Reload order with all relationships to get latest data including driverId
          const order = await db.Order.findByPk(transaction.orderId, {
            include: [
              {
                model: db.OrderItem,
                as: 'orderItems',
                include: [{ model: db.Drink, as: 'drink' }]
              }
            ]
          });
          
          if (order) {
            // Update paymentStatus to paid
            await order.update({ paymentStatus: 'paid' });
            await order.reload();
            
            // Prepare order data for socket event
            const orderData = order.toJSON ? order.toJSON() : order;
            const paymentConfirmedAt = new Date().toISOString();
            
            // Emit Socket.IO events
            const io = req.app.get('io');
            if (io) {
              const paymentConfirmedData = {
                orderId: order.id,
                status: 'confirmed',
                paymentStatus: 'paid',
                receiptNumber: receiptNumber,
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
              
              io.to('admin').emit('payment-confirmed', paymentConfirmedData);
            }
          }
          
          console.log(`✅ Updated transaction #${transaction.id} and order #${transaction.orderId} based on M-Pesa API query`);
        }
      }
      
      return res.json({
        success: true,
        status: 'completed',
        mpesaStatus: mpesaStatus,
        receiptNumber: mpesaStatus.ReceiptNumber || null,
        message: 'Transaction completed according to M-Pesa API'
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
       ORDER BY "updatedAt" DESC, "createdAt" DESC 
       LIMIT 1`,
      {
        replacements: { orderId },
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    
    const transaction = results?.[0] || results;
    
    if (transaction && transaction.receiptNumber) {
      // Payment completed - receipt exists
      // Auto-fix status if needed
      if (transaction.status !== 'completed') {
        console.log(`🔧 Auto-fixing transaction #${transaction.id} status from ${transaction.status} to completed (receipt: ${transaction.receiptNumber})`);
        await db.sequelize.query(
          `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "updatedAt" = NOW() WHERE id = :id`,
          { replacements: { id: transaction.id } }
        );
        
        // Update order status and paymentStatus
        await db.sequelize.query(
          `UPDATE orders SET status = 'confirmed', "paymentStatus" = 'paid', "updatedAt" = NOW() WHERE id = :orderId AND status = 'pending'`,
          { replacements: { orderId } }
        );
        
        // Reload order with all relationships to get latest data including driverId
        const order = await db.Order.findByPk(orderId, {
          include: [
            {
              model: db.OrderItem,
              as: 'orderItems',
              include: [{ model: db.Drink, as: 'drink' }]
            }
          ]
        });
        
        if (order) {
          // Prepare order data for socket event
          const orderData = order.toJSON ? order.toJSON() : order;
          const paymentConfirmedAt = new Date().toISOString();
          
          // Emit Socket.IO event
          const io = req.app.get('io');
          if (io) {
            const paymentConfirmedData = {
              orderId: order.id,
              status: 'confirmed',
              paymentStatus: 'paid',
              receiptNumber: transaction.receiptNumber,
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
              message: `Payment confirmed for Order #${order.id} (auto-detected)`
            });
          }
        }
      }
      
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
    
    // Get the most recent transaction for this order (by updatedAt to catch status changes)
    const transaction = await db.Transaction.findOne({
      where: { orderId },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']], // Prioritize by updatedAt to get the latest status
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'status', 'paymentStatus', 'customerName', 'customerEmail', 'customerPhone']
      }]
    });
    
    console.log(`🔍 Transaction lookup for order ${orderId}: ${transaction ? `Found transaction #${transaction.id} with status: ${transaction.status}, receipt: ${transaction.receiptNumber || 'none'}` : 'No transaction found'}`);
    
    // CRITICAL AUTO-FIX: If transaction has a receipt number but status isn't 'completed',
    // it means callback processed payment but status update might have failed
    // Auto-update it to completed immediately
    if (transaction && transaction.receiptNumber && transaction.status !== 'completed') {
      console.log(`⚠️  AUTOMATIC FIX: Transaction #${transaction.id} has receipt number (${transaction.receiptNumber}) but status is ${transaction.status}. Auto-updating to completed...`);
      try {
        await db.sequelize.query(
          `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "updatedAt" = NOW() WHERE id = :id`,
          {
            replacements: { id: transaction.id }
          }
        );
        
        // Also update order if payment is confirmed
        if (transaction.orderId) {
          await db.sequelize.query(
            `UPDATE orders SET status = 'confirmed', "updatedAt" = NOW() WHERE id = :id AND status = 'pending'`,
            {
              replacements: { id: transaction.orderId }
            }
          );
          
          // Reload order with all relationships to get latest data including driverId
          const order = await db.Order.findByPk(transaction.orderId, {
            include: [
              {
                model: db.OrderItem,
                as: 'orderItems',
                include: [{ model: db.Drink, as: 'drink' }]
              }
            ]
          });
          
          if (order) {
            // Prepare order data for socket event
            const orderData = order.toJSON ? order.toJSON() : order;
            const paymentConfirmedAt = new Date().toISOString();
            
            // Emit Socket.IO event for real-time update
            const io = req.app.get('io');
            if (io) {
              const paymentConfirmedData = {
                orderId: order.id,
                status: 'confirmed',
                paymentStatus: 'paid',
                receiptNumber: transaction.receiptNumber,
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
                message: `Payment confirmed for Order #${order.id} via M-Pesa (auto-detected)`
              });
            }
          }
          
          console.log(`✅ Auto-updated transaction #${transaction.id} and order #${transaction.orderId} to completed (receipt number detected)`);
        }
        
        // Reload transaction to get updated status
        await transaction.reload();
      } catch (updateError) {
        console.error(`❌ Error auto-updating transaction:`, updateError);
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

    // Also check transaction status - this is the single source of truth for payment
    const transaction = await db.Transaction.findOne({
      where: { orderId: order.id },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
    });
    
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
    const { receiptNumber } = req.body; // Optional receipt number
    
    console.log(`🔧 Manual payment confirmation requested for order #${orderId}`);
    
    // Find the order
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Find the transaction
    const transaction = await db.Transaction.findOne({
      where: { orderId: order.id },
      order: [['createdAt', 'DESC']]
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found for this order' });
    }
    
    // Update transaction status
    await db.sequelize.query(
      `UPDATE transactions SET status = 'completed', "paymentStatus" = 'paid', "receiptNumber" = COALESCE(:receiptNumber, "receiptNumber"), "updatedAt" = NOW() WHERE id = :id`,
      {
        replacements: {
          id: transaction.id,
          receiptNumber: receiptNumber || transaction.receiptNumber || null
        }
      }
    );
    
    // Update order status
    await db.sequelize.query(
      `UPDATE orders SET status = 'confirmed', "updatedAt" = NOW() WHERE id = :id`,
      {
        replacements: { id: order.id }
      }
    );
    
    // Reload order with all relationships to get latest data including driverId
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
    
    // Emit Socket.IO events
    const io = req.app.get('io');
    if (io) {
      const paymentConfirmedData = {
        orderId: order.id,
        status: 'confirmed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber || transaction.receiptNumber,
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
        message: `Payment manually confirmed for Order #${order.id}`
      });
    }
    
    console.log(`✅ Order #${order.id} manually confirmed`);
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      orderId: order.id,
      status: 'confirmed',
      transactionStatus: 'completed'
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

