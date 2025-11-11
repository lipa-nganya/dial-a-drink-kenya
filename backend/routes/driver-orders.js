const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const pushNotifications = require('../services/pushNotifications');

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
    if (status === 'delivered') {
      if (order.paymentType === 'pay_on_delivery' && order.paymentStatus !== 'paid') {
        return res.status(400).json({ error: 'Cannot mark order as delivered until payment is confirmed as paid.' });
      }
    }

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

      // Credit driver pay per delivery if enabled (when order is completed) without creating extra transactions
      if (finalStatus === 'completed' && !order.driverPayCredited) {
        try {
          const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
            db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
            db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
          ]);

          const isDriverPayEnabled = driverPayEnabledSetting?.value === 'true';
          const driverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');

          if (isDriverPayEnabled && driverPayAmount > 0) {
            // Get or create driver wallet
            let driverWallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
            if (!driverWallet) {
              driverWallet = await db.DriverWallet.create({
                driverId: driverId,
                balance: 0,
                totalTipsReceived: 0,
                totalTipsCount: 0,
                totalDeliveryPay: 0,
                totalDeliveryPayCount: 0
              });
            }

            const currentBalance = parseFloat(driverWallet.balance) || 0;
            const currentDeliveryPayTotal = parseFloat(driverWallet.totalDeliveryPay) || 0;
            const currentDeliveryPayCount = driverWallet.totalDeliveryPayCount || 0;

            await driverWallet.update({
              balance: currentBalance + driverPayAmount,
              totalDeliveryPay: currentDeliveryPayTotal + driverPayAmount,
              totalDeliveryPayCount: currentDeliveryPayCount + 1
            });

            // Update or create driver delivery transaction
            try {
              const paymentTransaction = await db.Transaction.findOne({
                where: {
                  orderId: order.id,
                  transactionType: 'payment',
                  status: 'completed'
                },
                order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']]
              });

              let driverDeliveryTransaction = await db.Transaction.findOne({
                where: {
                  orderId: order.id,
                  transactionType: 'delivery_pay',
                  driverId
                },
                order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
              });

              if (!driverDeliveryTransaction) {
                driverDeliveryTransaction = await db.Transaction.findOne({
                  where: {
                    orderId: order.id,
                    transactionType: 'delivery_pay',
                    driverId: null,
                    paymentStatus: {
                      [Op.in]: ['pending', 'unpaid', 'paid']
                    }
                  },
                  order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
                });
              }

              const receiptNumberToUse = paymentTransaction?.receiptNumber || driverDeliveryTransaction?.receiptNumber || null;
              const checkoutRequestIDToUse = paymentTransaction?.checkoutRequestID || driverDeliveryTransaction?.checkoutRequestID || null;
              const merchantRequestIDToUse = paymentTransaction?.merchantRequestID || driverDeliveryTransaction?.merchantRequestID || null;
              const phoneNumberToUse = paymentTransaction?.phoneNumber || driverDeliveryTransaction?.phoneNumber || null;
              const transactionDateToUse =
                paymentTransaction?.transactionDate ||
                driverDeliveryTransaction?.transactionDate ||
                paymentTransaction?.createdAt ||
                driverDeliveryTransaction?.createdAt ||
                new Date();

              const driverDeliveryNotes = driverDeliveryTransaction
                ? `${driverDeliveryTransaction.notes || ''}\nDriver delivery fee payment credited to driver wallet.`
                : `Driver delivery fee payment for Order #${order.id}. Credited to driver wallet.`;

              const driverDeliveryPayload = {
                paymentMethod: paymentTransaction?.paymentMethod || driverDeliveryTransaction?.paymentMethod || order.paymentMethod || 'cash',
                paymentProvider: paymentTransaction?.paymentProvider || driverDeliveryTransaction?.paymentProvider || order.paymentMethod || 'cash',
                amount: driverPayAmount,
                status: 'completed',
                paymentStatus: 'paid',
                receiptNumber: receiptNumberToUse,
                checkoutRequestID: checkoutRequestIDToUse,
                merchantRequestID: merchantRequestIDToUse,
                phoneNumber: phoneNumberToUse,
                transactionDate: transactionDateToUse,
                driverId,
                driverWalletId: driverWallet.id,
                notes: driverDeliveryNotes.trim()
              };

              if (driverDeliveryTransaction) {
                await driverDeliveryTransaction.update(driverDeliveryPayload);
              } else {
                await db.Transaction.create({
                  orderId: order.id,
                  transactionType: 'delivery_pay',
                  ...driverDeliveryPayload
                });
              }
            } catch (driverTransactionError) {
              console.error('❌ Error recording driver delivery transaction:', driverTransactionError);
            }

            await order.update({
              driverPayCredited: true,
              driverPayCreditedAt: new Date(),
              driverPayAmount: driverPayAmount
            });

            console.log(`✅ Delivery pay of KES ${driverPayAmount} credited to driver #${driverId} wallet for Order #${order.id}`);

            // Emit socket event to notify driver about delivery pay
            const io = req.app.get('io');
            if (io) {
              io.to(`driver-${driverId}`).emit('delivery-pay-received', {
                orderId: order.id,
                amount: driverPayAmount,
                customerName: order.customerName,
                walletBalance: currentBalance + driverPayAmount
              });
              console.log(`📬 Delivery pay notification sent to driver #${driverId} for Order #${order.id}`);
            }

            if (driver?.pushToken) {
              pushNotifications.sendPushNotification(driver.pushToken, {
                title: 'Delivery Fee Received',
                body: `KES ${driverPayAmount.toFixed(2)} for Order #${order.id} has been added to your wallet.`,
                data: {
                  type: 'delivery_pay',
                  orderId: order.id,
                  amount: driverPayAmount
                }
              }).catch((pushError) => {
                console.error('❌ Error sending delivery pay push notification:', pushError);
              });
            }
          }
        } catch (deliveryPayError) {
          console.error('❌ Error crediting delivery pay to driver wallet:', deliveryPayError);
          // Don't fail the order status update if delivery pay credit fails
        }
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

          if (tipTransaction && tipTransaction.paymentMethod === 'cash') {
            console.log(`ℹ️  Tip for Order #${order.id} was paid in cash. Skipping wallet credit.`);
          } else if (tipTransaction) {
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

              // Determine transaction date to align with merchant payment
              let transactionDateToUse = tipTransaction.transactionDate;
              try {
                const paymentTransaction = await db.Transaction.findOne({
                  where: {
                    orderId: order.id,
                    transactionType: 'payment',
                    status: 'completed'
                  },
                  order: [
                    ['transactionDate', 'DESC'],
                    ['createdAt', 'DESC']
                  ]
                });

                if (paymentTransaction) {
                  transactionDateToUse = paymentTransaction.transactionDate || paymentTransaction.createdAt;
                }
              } catch (paymentLookupError) {
                console.warn('⚠️ Could not fetch payment transaction for tip synchronization:', paymentLookupError.message);
              }

              if (!transactionDateToUse) {
                transactionDateToUse = tipTransaction.createdAt;
              }

              // Update tip transaction with driver info and complete it
              // Note: receiptNumber should already be set when payment was completed
              await tipTransaction.update({
                driverId: driverId,
                driverWalletId: driverWallet.id,
                status: 'completed',
                paymentStatus: 'paid',
                transactionDate: transactionDateToUse,
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

              if (driver?.pushToken) {
                const tipAmount = Number(order.tipAmount) || 0;
                pushNotifications.sendPushNotification(driver.pushToken, {
                  title: 'Tip Received',
                  body: `You received a tip of KES ${tipAmount.toFixed(2)} for Order #${order.id}.`,
                  data: {
                    type: 'tip',
                    orderId: order.id,
                    amount: tipAmount
                  }
                }).catch((pushError) => {
                  console.error('❌ Error sending tip push notification:', pushError);
                });
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

    if (!['out_for_delivery'].includes(order.status)) {
      return res.status(400).json({ error: 'Order must be marked as On the Way before sending a payment prompt.' });
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
      
      // Create transaction records for STK push initiation (same as when customer initiates)
      // The tip will be created as a separate transaction when payment callback confirms
      try {
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
          merchantRequestID: merchantRequestID,
          phoneNumber: formattedPhone
        };

        const paymentNote = `STK Push initiated by driver. Customer pays KES ${amount.toFixed(2)}. Item portion: KES ${itemsTotal.toFixed(2)}.${tipAmount > 0 ? ` Tip (KES ${tipAmount.toFixed(2)}) will be recorded separately.` : ''}`;

        let paymentTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'payment',
            status: { [Op.ne]: 'completed' }
          },
          order: [['createdAt', 'DESC']]
        });

        if (paymentTransaction) {
          await paymentTransaction.update({
            ...baseTransactionPayload,
            amount: itemsTotal,
            notes: paymentNote
          });
          console.log(`✅ Payment transaction updated for driver-initiated payment on Order #${order.id} (transaction #${paymentTransaction.id})`);
        } else {
          paymentTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'payment',
            amount: itemsTotal,
            notes: paymentNote
          });
          console.log(`✅ Payment transaction created for driver-initiated payment on Order #${order.id} (transaction #${paymentTransaction.id})`);
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
            transactionType: 'delivery_pay',
            amount: merchantDeliveryAmount,
            notes: deliveryNote
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

          let driverDeliveryTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'delivery_pay',
              driverId: order.driverId,
              status: { [Op.ne]: 'completed' }
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
            await driverDeliveryTransaction.update(driverDeliveryPayload);
            console.log(`✅ Driver delivery fee transaction updated for Order #${orderId} (transaction #${driverDeliveryTransaction.id})`);
          } else {
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
      } catch (transactionError) {
        console.error('❌ Error preparing driver-initiated transactions:', transactionError);
        // Don't fail the STK push if transaction creation fails - log it but continue
        console.log('⚠️  Continuing with STK push despite transaction preparation error');
      }
      
      console.log(`✅ STK Push initiated for Order #${orderId}. CheckoutRequestID: ${checkoutRequestID}`);
      
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

/**
 * Manually confirm payment received by driver (cash or direct M-Pesa)
 * POST /api/driver-orders/:orderId/confirm-cash-payment
 */
router.post('/:orderId/confirm-cash-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId, method = 'cash', receiptNumber: providedReceipt } = req.body || {};

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

    const now = new Date();
    const methodLabel = method === 'mpesa_manual' ? 'driver M-Pesa' : 'cash in hand';
    const paymentMethod = method === 'mpesa_manual' ? 'mobile_money' : 'cash';
    const paymentProvider = method === 'mpesa_manual' ? 'driver_mpesa_manual' : 'cash_in_hand';
    const normalizedReceipt = providedReceipt && typeof providedReceipt === 'string'
      ? providedReceipt.trim().slice(0, 64)
      : 'CASH';

    let driverWalletInstance = null;
    const ensureDriverWallet = async () => {
      if (!order.driverId) {
        return null;
      }
      if (driverWalletInstance) {
        return driverWalletInstance;
      }
      driverWalletInstance = await db.DriverWallet.findOne({ where: { driverId: order.driverId } });
      if (!driverWalletInstance) {
        driverWalletInstance = await db.DriverWallet.create({
          driverId: order.driverId,
          balance: 0,
          totalTipsReceived: 0,
          totalTipsCount: 0,
          totalDeliveryPay: 0,
          totalDeliveryPayCount: 0
        });
      }
      return driverWalletInstance;
    };

    let paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: order.id,
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']]
    });

    const manualNote = `Manual payment confirmation by driver #${driverId} (${methodLabel}).`;
    const manualConfirmationNote = `Payment confirmed (${methodLabel}) by driver #${driverId}.`;

    if (paymentTransaction) {
      await paymentTransaction.update({
        paymentMethod,
        paymentProvider,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: normalizedReceipt,
        transactionDate: now,
        notes: paymentTransaction.notes ? `${paymentTransaction.notes}\n${manualNote}` : manualNote
      });
    } else {
      const { itemsTotal, deliveryFee, tipAmount } = await getOrderFinancialBreakdown(order.id);
      paymentTransaction = await db.Transaction.create({
        orderId: order.id,
        transactionType: 'payment',
        paymentMethod,
        paymentProvider,
        amount: itemsTotal,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: normalizedReceipt,
        transactionDate: now,
        notes: manualNote
      });
    }

    const { itemsTotal, deliveryFee, tipAmount } = await getOrderFinancialBreakdown(order.id);
    const totalAmount = parseFloat(order.totalAmount) || 0;

    const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
    ]);

    const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
    const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
    const driverPayAmount = driverPaySettingEnabled && order.driverId && configuredDriverPayAmount > 0
      ? Math.min(parseFloat(deliveryFee) || 0, configuredDriverPayAmount)
      : 0;
    const merchantDeliveryAmount = Math.max((parseFloat(deliveryFee) || 0) - driverPayAmount, 0);

    if (merchantDeliveryAmount > 0.01) {
      let deliveryTransaction = await db.Transaction.findOne({
        where: {
          orderId: order.id,
          transactionType: 'delivery_pay'
        },
        order: [['createdAt', 'DESC']]
      });

      const deliveryNote = driverPayAmount > 0
        ? `Delivery fee marked as paid via ${methodLabel} confirmation by driver #${driverId}. Driver payout KES ${driverPayAmount.toFixed(2)} deducted.`
        : `Delivery fee marked as paid via ${methodLabel} confirmation by driver #${driverId}.`;

      if (deliveryTransaction) {
        await deliveryTransaction.update({
          paymentMethod,
          paymentProvider,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: deliveryTransaction.receiptNumber || normalizedReceipt,
          transactionDate: now,
          driverId: null,
          driverWalletId: null,
          notes: deliveryTransaction.notes ? `${deliveryTransaction.notes}\n${deliveryNote}` : deliveryNote,
          amount: merchantDeliveryAmount
        });
      } else {
        await db.Transaction.create({
          orderId: order.id,
          transactionType: 'delivery_pay',
          paymentMethod,
          paymentProvider,
          amount: merchantDeliveryAmount,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: normalizedReceipt,
          transactionDate: now,
          driverId: null,
          driverWalletId: null,
          notes: deliveryNote
        });
      }
    }

    if (driverPayAmount > 0.01 && order.driverId) {
      let driverDeliveryTransaction = await db.Transaction.findOne({
        where: {
          orderId: order.id,
          transactionType: 'delivery_pay',
          driverId: order.driverId
        },
        order: [['createdAt', 'DESC']]
      });

      const driverDeliveryNote = `Driver delivery fee payment confirmed via ${methodLabel} by driver #${driverId}.`;

      if (driverDeliveryTransaction) {
        await driverDeliveryTransaction.update({
          paymentMethod,
          paymentProvider,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: driverDeliveryTransaction.receiptNumber || normalizedReceipt,
          transactionDate: now,
          driverId: order.driverId,
          notes: driverDeliveryTransaction.notes ? `${driverDeliveryTransaction.notes}\n${driverDeliveryNote}` : driverDeliveryNote,
          amount: driverPayAmount
        });
      } else {
        driverDeliveryTransaction = await db.Transaction.create({
          orderId: order.id,
          transactionType: 'delivery_pay',
          paymentMethod,
          paymentProvider,
          amount: driverPayAmount,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: normalizedReceipt,
          transactionDate: now,
          driverId: order.driverId,
          notes: driverDeliveryNote
        });
      }

      try {
        const driverWallet = await ensureDriverWallet();
        if (driverWallet) {
          const alreadyCredited = driverDeliveryTransaction.driverWalletId === driverWallet.id && driverDeliveryTransaction.status === 'completed';

          if (!alreadyCredited) {
            await driverWallet.update({
              balance: parseFloat(driverWallet.balance) + driverPayAmount,
              totalDeliveryPay: parseFloat(driverWallet.totalDeliveryPay || 0) + driverPayAmount,
              totalDeliveryPayCount: (driverWallet.totalDeliveryPayCount || 0) + 1
            });

            await driverDeliveryTransaction.update({
              driverWalletId: driverWallet.id,
              status: 'completed',
              paymentStatus: 'paid',
              notes: `${driverDeliveryNote} Credited to driver wallet.`
            });

            await order.update({
              driverPayCredited: true,
              driverPayCreditedAt: now,
              driverPayAmount: driverPayAmount
            });
          }
        }
      } catch (driverPayError) {
        console.error('❌ Error crediting delivery fee payment during manual confirmation:', driverPayError);
      }
    }

    if (tipAmount > 0.01) {
      let tipTransaction = await db.Transaction.findOne({
        where: {
          orderId: order.id,
          transactionType: 'tip'
        },
        order: [['createdAt', 'DESC']]
      });

      const tipNote = `Tip recorded via ${methodLabel} confirmation by driver #${driverId}.`;

      if (tipTransaction) {
        await tipTransaction.update({
          paymentMethod,
          paymentProvider,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: tipTransaction.receiptNumber || normalizedReceipt,
          transactionDate: now,
          driverId: order.driverId,
          notes: tipTransaction.notes ? `${tipTransaction.notes}\n${tipNote}` : tipNote
        });
      } else {
        tipTransaction = await db.Transaction.create({
          orderId: order.id,
          transactionType: 'tip',
          paymentMethod,
          paymentProvider,
          amount: tipAmount,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: normalizedReceipt,
          transactionDate: now,
          driverId: order.driverId,
          notes: tipNote
        });
      }

      try {
        const driverWallet = await ensureDriverWallet();
        if (driverWallet && tipTransaction) {
          const alreadyCredited =
            tipTransaction.driverWalletId === driverWallet.id && tipTransaction.status === 'completed';

          if (!alreadyCredited) {
            await driverWallet.update({
              balance: parseFloat(driverWallet.balance) + tipAmount,
              totalTipsReceived: (parseFloat(driverWallet.totalTipsReceived) || 0) + tipAmount,
              totalTipsCount: (driverWallet.totalTipsCount || 0) + 1
            });

            await tipTransaction.update({
              driverWalletId: driverWallet.id,
              status: 'completed',
              paymentStatus: 'paid',
              notes: `${tipNote} Credited to driver wallet.`
            });
          }
        }
      } catch (tipWalletError) {
        console.error('❌ Error crediting tip during manual confirmation:', tipWalletError);
      }
    }

    const adminCreditAmount = Math.max((parseFloat(itemsTotal) || 0) + merchantDeliveryAmount, 0);

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

      await adminWallet.update({
        balance: parseFloat(adminWallet.balance) + adminCreditAmount,
        totalRevenue: parseFloat(adminWallet.totalRevenue) + adminCreditAmount,
        totalOrders: adminWallet.totalOrders + 1
      });

      console.log(`✅ Credited admin wallet with KES ${adminCreditAmount.toFixed(2)} for Order #${order.id} (manual confirmation)`);
    } catch (adminWalletError) {
      console.error('❌ Error crediting admin wallet during manual confirmation:', adminWalletError);
    }

    const cashSettlementAmount = Math.max(totalAmount - (parseFloat(tipAmount) || 0) - driverPayAmount, 0);

    if (cashSettlementAmount > 0.01 && order.driverId) {
      try {
        const driverWallet = await ensureDriverWallet();
        if (driverWallet) {
          await driverWallet.update({
            balance: parseFloat(driverWallet.balance) - cashSettlementAmount
          });

          await db.Transaction.create({
            orderId: order.id,
            transactionType: 'cash_settlement',
            paymentMethod,
            paymentProvider,
            amount: cashSettlementAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: normalizedReceipt,
            transactionDate: now,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            notes: `Cash received (${methodLabel}) for Order #${order.id} debited from driver wallet.`
          });
        }
      } catch (cashDebitError) {
        console.error('❌ Error recording cash settlement debit:', cashDebitError);
      }
    }

    await order.update({
      paymentStatus: 'paid',
      paymentConfirmedAt: now,
      notes: order.notes ? `${order.notes}\n${manualConfirmationNote}` : manualConfirmationNote,
      driverPayAmount: driverPayAmount > 0 ? driverPayAmount : order.driverPayAmount
    });

    // If order already delivered, upgrade to completed to follow paid workflow
    if (order.status === 'delivered') {
      await order.update({ status: 'completed' });
    }

    // Credit driver pay per delivery if enabled and not yet credited
    if ((order.status === 'completed' || order.status === 'delivered') && !order.driverPayCredited) {
      try {
        const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
          db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
          db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
        ]);

        const isDriverPayEnabled = driverPayEnabledSetting?.value === 'true';
        const driverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');

        if (isDriverPayEnabled && driverPayAmount > 0 && order.driverId) {
          const driverWallet = await ensureDriverWallet();
          if (!driverWallet) {
            throw new Error('Driver wallet not available for delivery pay credit');
          }

          const currentBalance = parseFloat(driverWallet.balance) || 0;
          const currentDeliveryPayTotal = parseFloat(driverWallet.totalDeliveryPay) || 0;
          const currentDeliveryPayCount = driverWallet.totalDeliveryPayCount || 0;

          await driverWallet.update({
            balance: currentBalance + driverPayAmount,
            totalDeliveryPay: currentDeliveryPayTotal + driverPayAmount,
            totalDeliveryPayCount: currentDeliveryPayCount + 1
          });

          await order.update({
            driverPayCredited: true,
            driverPayCreditedAt: now,
            driverPayAmount: driverPayAmount
          });

          const io = req.app.get('io');
          if (io) {
            io.to(`driver-${order.driverId}`).emit('delivery-pay-received', {
              orderId: order.id,
              amount: driverPayAmount,
              customerName: order.customerName,
              walletBalance: currentBalance + driverPayAmount
            });
          }

          const driver = await db.Driver.findByPk(order.driverId).catch(() => null);
          if (driver?.pushToken) {
            pushNotifications.sendPushNotification(driver.pushToken, {
              title: 'Delivery Fee Received',
              body: `KES ${driverPayAmount.toFixed(2)} for Order #${order.id} has been added to your wallet.`,
              data: {
                type: 'delivery_pay',
                orderId: order.id,
                amount: driverPayAmount
              }
            }).catch((pushError) => {
              console.error('❌ Error sending delivery pay push notification (manual confirmation):', pushError);
            });
          }
        }
      } catch (driverPayError) {
        console.error('❌ Error crediting delivery pay during manual confirmation:', driverPayError);
      }
    }

    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        orderId: order.id,
        status: order.status,
        paymentStatus: 'paid',
        receiptNumber: paymentTransaction.receiptNumber,
        transactionId: paymentTransaction.id,
        transactionStatus: 'completed',
        paymentConfirmedAt: now.toISOString(),
        order: order.toJSON ? order.toJSON() : order,
        message: `Payment confirmed manually for Order #${order.id}`
      };

      io.to(`order-${order.id}`).emit('payment-confirmed', payload);

      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('payment-confirmed', payload);
      }

      io.to('admin').emit('payment-confirmed', {
        ...payload,
        message: `Driver manually confirmed payment for Order #${order.id}`
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error confirming cash payment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

