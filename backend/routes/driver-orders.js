const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');

/**
 * Get orders assigned to a driver
 * GET /api/driver-orders/:driverId
 */
router.get('/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, startDate, endDate } = req.query;

    // Build where clause
    const whereClause = { driverId: parseInt(driverId) };
    
    // Filter by status if provided (can be multiple statuses)
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      whereClause.status = { [Op.in]: statuses };
    }

    // Filter by date range if provided (for completed orders)
    let dateFilter = {};
    if (startDate) {
      dateFilter.createdAt = { [Op.gte]: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.createdAt = { 
        ...dateFilter.createdAt,
        [Op.lte]: new Date(endDate + 'T23:59:59')
      };
    }

    const orders = await db.Order.findAll({
      where: {
        ...whereClause,
        ...dateFilter
      },
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [
            {
              model: db.Drink,
              as: 'drink'
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Map items to orderItems for compatibility
    const ordersWithMappedItems = orders.map(order => {
      const orderData = order.toJSON();
      if (orderData.items) {
        orderData.orderItems = orderData.items;
      }
      return orderData;
    });

    res.json(ordersWithMappedItems);
  } catch (error) {
    console.error('Error fetching driver orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Accept or reject order assignment
 * POST /api/driver-orders/:orderId/respond
 */
router.post('/:orderId/respond', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId, accepted } = req.body;

    if (typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'accepted must be a boolean' });
    }

    const order = await db.Order.findByPk(orderId, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      return res.status(403).json({ error: 'Not authorized to respond to this order' });
    }

    // Update driver acceptance status
    await order.update({ driverAccepted: accepted });

    // Reload order with all associations
    const updatedOrder = await db.Order.findByPk(order.id, {
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        },
        {
          model: db.Driver,
          as: 'driver',
          required: false
        }
      ]
    });

    // Emit Socket.IO event to notify admin
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('driver-order-response', {
        orderId: order.id,
        driverId: driverId,
        accepted: accepted,
        order: updatedOrder,
        message: `Driver ${accepted ? 'accepted' : 'rejected'} order #${order.id}`
      });
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: `Order ${accepted ? 'accepted' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Error responding to order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update order status (driver actions)
 * PATCH /api/driver-orders/:orderId/status
 */
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, driverId, oldStatus } = req.body;

    // Drivers cannot update to 'preparing' - only admin can
    if (status === 'preparing') {
      return res.status(403).json({ error: 'Only admin can update order to preparing status' });
    }

    if (!status || !['out_for_delivery', 'delivered', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await db.Order.findByPk(orderId, {
      include: [{ model: db.OrderItem, as: 'orderItems' }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      return res.status(403).json({ error: 'Not authorized to update this order' });
    }

    // Strict step-by-step validation: Cannot skip statuses
    const statusFlow = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed'];
    const currentStatusIndex = statusFlow.indexOf(order.status);
    const newStatusIndex = statusFlow.indexOf(status);

    if (currentStatusIndex === -1 || newStatusIndex === -1) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    // Must be exactly one step forward (unless auto-completing from delivered)
    if (status === 'completed') {
      // Allow completion only from delivered status
      if (order.status !== 'delivered') {
        return res.status(400).json({ error: 'Can only complete orders that are delivered' });
      }
    } else if (newStatusIndex !== currentStatusIndex + 1) {
      return res.status(400).json({ 
        error: `Cannot update to ${status}. Order must be in ${statusFlow[currentStatusIndex]} status first.` 
      });
    }

    let finalStatus = status;

    // If delivered and payment is paid, auto-update to completed
    if (status === 'delivered' && order.paymentStatus === 'paid') {
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
    } else {
      // Update order status
      await order.update({ status });
    }

    // If delivered or completed, also update driver status
    if (finalStatus === 'delivered' || finalStatus === 'completed') {
      const driver = await db.Driver.findByPk(driverId);
      if (driver) {
        await driver.update({ 
          status: 'active',
          lastActivity: new Date()
        });
      }

      // Update tip transaction if order has tip and is being delivered or completed
      // Credit tip to driver wallet when order is delivered (for orders paid immediately via M-Pesa)
      // Check if tip hasn't been credited to this driver yet
      if (order.tipAmount && parseFloat(order.tipAmount) > 0 && (finalStatus === 'delivered' || finalStatus === 'completed')) {
        try {
          // Find existing tip transaction (created when payment was completed)
          // Look for tip transaction that either:
          // 1. Has status 'pending' (not yet credited)
          // 2. Has status 'completed' but driverId doesn't match current driver (driver was reassigned or tip not credited to this driver)
          // 3. Has status 'completed' but driverWalletId is null (tip transaction exists but wasn't credited to wallet)
          const tipTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'tip',
              [Op.or]: [
                { status: 'pending' },
                { 
                  status: 'completed',
                  [Op.or]: [
                    { driverId: null },
                    { driverId: { [Op.ne]: driverId } },
                    { driverWalletId: null }
                  ]
                }
              ]
            }
          });

          if (tipTransaction) {
            // Check if tip was already credited to this driver's wallet
            const alreadyCredited = tipTransaction.driverId === driverId && tipTransaction.driverWalletId !== null;
            
            if (!alreadyCredited) {
              // Get or create driver wallet
              let driverWallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
              if (!driverWallet) {
                driverWallet = await db.DriverWallet.create({
                  driverId: driverId,
                  balance: 0,
                  totalTipsReceived: 0,
                  totalTipsCount: 0
                });
              }

              // Update tip transaction with driver info and complete it
              // Note: receiptNumber should already be set when payment was completed
              await tipTransaction.update({
                driverId: driverId,
                driverWalletId: driverWallet.id,
                status: 'completed',
                paymentStatus: 'paid',
                // Keep existing receiptNumber (set when payment was completed)
                notes: `Tip for Order #${order.id} - ${order.customerName} (credited to driver wallet when order marked as delivered)`
              });

              // Update driver wallet
              await driverWallet.update({
                balance: parseFloat(driverWallet.balance) + parseFloat(order.tipAmount),
                totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + parseFloat(order.tipAmount),
                totalTipsCount: driverWallet.totalTipsCount + 1
              });

              console.log(`✅ Tip of KES ${order.tipAmount} credited to driver #${driverId} wallet for Order #${order.id} (when marked as delivered)`);

              // Emit socket event to notify driver about tip
              const io = req.app.get('io');
              if (io) {
                io.to(`driver-${driverId}`).emit('tip-received', {
                  orderId: order.id,
                  tipAmount: parseFloat(order.tipAmount),
                  customerName: order.customerName,
                  walletBalance: parseFloat(driverWallet.balance)
                });
                console.log(`📬 Tip notification sent to driver #${driverId} for Order #${order.id}`);
              }
            } else {
              console.log(`ℹ️  Tip for Order #${order.id} was already credited to driver #${driverId} wallet`);
            }
          } else {
            // No tip transaction found - this shouldn't happen for paid orders with tips
            // But if it does, we can't credit the tip without a transaction record
            console.log(`⚠️  No tip transaction found for Order #${order.id} - tip may not have been created during payment`);
          }
        } catch (tipError) {
          console.error('❌ Error crediting tip to driver wallet:', tipError);
          // Don't fail the order status update if tip transaction fails
        }
      }
    } else if (finalStatus === 'out_for_delivery') {
      // Update driver status to on_delivery
      const driver = await db.Driver.findByPk(driverId);
      if (driver) {
        await driver.update({ 
          status: 'on_delivery',
          lastActivity: new Date()
        });
      }
    }

    // Reload order to get updated status with all related data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    // Get fresh order data to ensure we have the latest status
    const freshOrder = await db.Order.findByPk(order.id, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    // Emit Socket.IO event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Prepare order data for socket event (convert to plain object)
      const orderData = freshOrder.toJSON ? freshOrder.toJSON() : freshOrder;
      
      const statusUpdateData = {
        orderId: freshOrder.id,
        status: freshOrder.status,
        oldStatus: oldStatus,
        paymentStatus: freshOrder.paymentStatus,
        order: orderData // Send full order object with all latest data
      };
      
      console.log(`📡 Emitting order-status-updated for Order #${freshOrder.id}`);
      console.log(`   Status: ${oldStatus} → ${freshOrder.status}`);
      console.log(`   PaymentStatus: ${freshOrder.paymentStatus}`);
      
      // Emit to order room
      io.to(`order-${freshOrder.id}`).emit('order-status-updated', statusUpdateData);
      
      // Emit to admin room
      io.to('admin').emit('order-status-updated', statusUpdateData);
      
      // Also emit to driver room if order has driverId
      if (freshOrder.driverId) {
        io.to(`driver-${freshOrder.driverId}`).emit('order-status-updated', statusUpdateData);
        console.log(`📡 Also emitted to driver-${freshOrder.driverId} room`);
      }
      
      console.log(`📡 Emitted order-status-updated to admin room for Order #${freshOrder.id}: ${oldStatus} → ${freshOrder.status}`);
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initiate M-Pesa payment for customer (pay on delivery)
 * POST /api/driver-orders/:orderId/initiate-payment
 */
router.post('/:orderId/initiate-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId, customerPhone } = req.body;

    const order = await db.Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if order is pay on delivery
    if (order.paymentType !== 'pay_on_delivery') {
      return res.status(400).json({ error: 'Order is not pay on delivery' });
    }

    // Check if already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    // Format phone number
    const cleanedPhone = customerPhone.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Initiate STK push
    // Customer pays full amount including tip (order.totalAmount includes tip)
    // The payment will be split into 2 transactions: order payment (minus tip) and tip transaction
    const amount = parseFloat(order.totalAmount); // Full amount including tip
    const stkResult = await mpesaService.initiateSTKPush(
      formattedPhone,
      amount,
      order.id,
      `Payment for order #${order.id}`
    );

    // Check if STK push was initiated successfully
    // M-Pesa returns success even if the request is accepted, but payment hasn't completed yet
    // We should return success immediately and wait for callback to determine final status
    if (stkResult.success || stkResult.checkoutRequestID || stkResult.CheckoutRequestID) {
      const checkoutRequestID = stkResult.checkoutRequestID || stkResult.CheckoutRequestID;
      const merchantRequestID = stkResult.merchantRequestID || stkResult.MerchantRequestID;
      
      // Store checkout request ID in order notes (for callback to find order)
      const checkoutNote = `M-Pesa CheckoutRequestID: ${checkoutRequestID}`;
      await order.update({
        paymentMethod: 'mobile_money',
        notes: order.notes ? 
          `${order.notes}\n${checkoutNote}` : 
          checkoutNote
      });
      
      // Create transaction record for STK push initiation (same as when customer initiates)
      // This ensures the callback can find the order via transaction checkoutRequestID
      // Note: Customer pays full amount (order.totalAmount), but we store payment transaction as totalAmount - tipAmount
      // The tip will be created as a separate transaction when payment callback confirms
      const tipAmount = parseFloat(order.tipAmount) || 0;
      const paymentAmount = parseFloat(order.totalAmount) - tipAmount; // Order payment (excluding tip)
      
      try {
        await db.Transaction.create({
          orderId: order.id,
          transactionType: 'payment',
          paymentMethod: 'mobile_money',
          paymentProvider: 'mpesa',
          amount: paymentAmount, // Order total minus tip (tip is separate transaction)
          status: 'pending',
          paymentStatus: 'pending', // Initial payment status - will be updated to 'paid' when callback confirms
          checkoutRequestID: checkoutRequestID,
          merchantRequestID: merchantRequestID,
          phoneNumber: formattedPhone,
          notes: `STK Push initiated by driver. Customer pays KES ${amount.toFixed(2)} (includes KES ${tipAmount.toFixed(2)} tip which will be separate transaction). ${stkResult.CustomerMessage || stkResult.customerMessage || ''}`
        });
        console.log(`✅ Transaction record created for driver-initiated payment on Order #${order.id}`);
      } catch (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError);
        // Don't fail the STK push if transaction creation fails - log it but continue
        console.log('⚠️  Continuing with STK push despite transaction creation error');
      }
      
      // STK push was initiated - return success immediately
      // Don't wait for callback - that will come separately
      // The callback will handle payment status updates and notify driver via socket
      
      res.json({
        success: true,
        message: 'Payment request sent to customer. Waiting for payment confirmation...',
        checkoutRequestID: checkoutRequestID,
        merchantRequestID: merchantRequestID,
        status: 'pending' // Payment is pending until callback confirms
      });
    } else {
      // Only fail if STK push couldn't be initiated at all (network error, invalid credentials, etc.)
      // Not if it's just waiting for user to enter PIN
      res.status(500).json({
        success: false,
        error: stkResult.error || 'Failed to initiate payment request'
      });
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

