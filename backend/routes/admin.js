const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

// Admin authentication middleware (placeholder - can be implemented later)
const verifyAdmin = (req, res, next) => {
  // For now, allow all requests. Can add admin token verification later
  next();
};

// Get admin stats
router.get('/stats', async (req, res) => {
  try {
    // Get total orders count
    const totalOrders = await db.Order.count();

    // Get pending orders count
    const pendingOrders = await db.Order.count({
      where: {
        status: {
          [Op.in]: ['pending', 'confirmed']
        }
      }
    });

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await db.Order.count({
      where: {
        createdAt: {
          [Op.gte]: today
        }
      }
    });

    // Get today's revenue (excluding tips - tips go to drivers, not business)
    // Revenue = totalAmount - tipAmount (order + delivery fee only)
    const todayPaidOrders = await db.Order.findAll({
      where: {
        createdAt: {
          [Op.gte]: today
        },
        paymentStatus: 'paid'
      },
      attributes: ['totalAmount', 'tipAmount']
    });
    const todayRevenue = todayPaidOrders.reduce((sum, order) => {
      const orderAmount = parseFloat(order.totalAmount) || 0;
      const tipAmount = parseFloat(order.tipAmount) || 0;
      return sum + (orderAmount - tipAmount); // Exclude tip
    }, 0);

    // Get total revenue (excluding tips)
    const allPaidOrders = await db.Order.findAll({
      where: {
        paymentStatus: 'paid'
      },
      attributes: ['totalAmount', 'tipAmount']
    });
    const totalRevenue = allPaidOrders.reduce((sum, order) => {
      const orderAmount = parseFloat(order.totalAmount) || 0;
      const tipAmount = parseFloat(order.tipAmount) || 0;
      return sum + (orderAmount - tipAmount); // Exclude tip
    }, 0);

    // Get tip stats
    const todayTips = todayPaidOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.tipAmount) || 0);
    }, 0);
    const totalTips = allPaidOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.tipAmount) || 0);
    }, 0);
    const totalTipTransactions = await db.Transaction.count({
      where: {
        transactionType: 'tip',
        status: 'completed'
      }
    });
    const todayTipTransactions = await db.Transaction.count({
      where: {
        transactionType: 'tip',
        status: 'completed',
        createdAt: {
          [Op.gte]: today
        }
      }
    });

    // Get total drinks count
    const totalDrinks = await db.Drink.count();

    res.json({
      totalOrders,
      pendingOrders,
      todayOrders,
      todayRevenue: parseFloat(todayRevenue) || 0,
      totalRevenue: parseFloat(totalRevenue) || 0,
      totalDrinks,
      // Tip stats
      todayTips: parseFloat(todayTips) || 0,
      totalTips: parseFloat(totalTips) || 0,
      totalTipTransactions: totalTipTransactions || 0,
      todayTipTransactions: todayTipTransactions || 0
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all transactions (admin)
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await db.Transaction.findAll({
      include: [{
        model: db.Order,
        as: 'order',
        include: [{
          model: db.OrderItem,
          as: 'items',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        }]
      }, {
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get merchant wallet (admin wallet)
router.get('/merchant-wallet', async (req, res) => {
  try {
    // Get or create admin wallet (single wallet for all admin revenue)
    let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
    if (!adminWallet) {
      adminWallet = await db.AdminWallet.create({
        id: 1,
        balance: 0,
        totalRevenue: 0,
        totalOrders: 0
      });
    }

    // Get total orders count (all orders)
    const totalOrders = await db.Order.count();

    res.json({
      balance: parseFloat(adminWallet.balance) || 0,
      totalRevenue: parseFloat(adminWallet.totalRevenue) || 0,
      totalOrders: adminWallet.totalOrders || 0,
      allOrdersCount: totalOrders || 0
    });
  } catch (error) {
    console.error('Error fetching merchant wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all drinks (admin)
router.get('/drinks', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }],
      order: [['name', 'ASC']]
    });

    res.json(drinks);
  } catch (error) {
    console.error('Error fetching drinks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Save the Fishes stats
router.get('/save-the-fishes', async (req, res) => {
  try {
    // Get total saved addresses count
    const totalAddresses = await db.SavedAddress.count();

    // Get total cost saved (sum of all costSaved values)
    const totalCostSaved = await db.SavedAddress.sum('costSaved') || 0;

    // Get total API calls saved
    const totalApiCallsSaved = await db.SavedAddress.sum('apiCallsSaved') || 0;

    // Get most searched addresses
    const topAddresses = await db.SavedAddress.findAll({
      order: [['searchCount', 'DESC']],
      limit: 10,
      attributes: ['id', 'address', 'formattedAddress', 'searchCount', 'apiCallsSaved', 'costSaved']
    });

    res.json({
      totalAddresses,
      totalCostSaved: parseFloat(totalCostSaved) || 0,
      totalApiCallsSaved: parseInt(totalApiCallsSaved) || 0,
      topAddresses: topAddresses.map(addr => ({
        id: addr.id,
        address: addr.formattedAddress || addr.address,
        searchCount: addr.searchCount || 0,
        apiCallsSaved: addr.apiCallsSaved || 0,
        costSaved: parseFloat(addr.costSaved || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching Save the Fishes stats:', error);
    res.status(500).json({ error: 'Failed to fetch Save the Fishes stats' });
  }
});

// Get all orders (admin)
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.Order.findAll({
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
        },
        {
          model: db.Transaction,
          as: 'transactions'
        },
        {
          model: db.Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phoneNumber', 'status']
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
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update order status (admin)
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order status
    await order.update({ status });

    // If delivered and payment is paid, auto-update to completed
    let finalStatus = status;
    if (status === 'delivered' && order.paymentStatus === 'paid') {
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
    }

    // Credit driver pay per delivery if enabled (when order is completed)
    // This is separate from tips and is only credited when order is completed
    if (finalStatus === 'completed' && order.driverId) {
      try {
        const driverId = order.driverId;
        // Check if driver pay per delivery is enabled
        const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
          db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
          db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
        ]);

        const isDriverPayEnabled = driverPayEnabledSetting?.value === 'true';
        const driverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');

        if (isDriverPayEnabled && driverPayAmount > 0) {
          // Check if delivery pay transaction already exists for this order
          const existingDeliveryPayTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'delivery_pay',
              driverId: driverId
            }
          });

          if (!existingDeliveryPayTransaction) {
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

            // Credit delivery pay to driver wallet
            await driverWallet.update({
              balance: parseFloat(driverWallet.balance) + driverPayAmount
            });

            // Create delivery pay transaction
            await db.Transaction.create({
              orderId: order.id,
              driverId: driverId,
              driverWalletId: driverWallet.id,
              transactionType: 'delivery_pay',
              paymentMethod: 'system',
              paymentProvider: 'system',
              amount: driverPayAmount,
              status: 'completed',
              paymentStatus: 'paid',
              notes: `Delivery pay for Order #${order.id} - ${order.customerName} (credited to driver wallet)`
            });

            console.log(`✅ Delivery pay of KES ${driverPayAmount} credited to driver #${driverId} wallet for Order #${order.id}`);

            // Emit socket event to notify driver about delivery pay
            const io = req.app.get('io');
            if (io) {
              io.to(`driver-${driverId}`).emit('delivery-pay-received', {
                orderId: order.id,
                amount: driverPayAmount,
                customerName: order.customerName,
                walletBalance: parseFloat(driverWallet.balance)
              });
              console.log(`📬 Delivery pay notification sent to driver #${driverId} for Order #${order.id}`);
            }
          } else {
            console.log(`ℹ️  Delivery pay for Order #${order.id} was already credited to driver #${driverId} wallet`);
          }
        }
      } catch (deliveryPayError) {
        console.error('❌ Error crediting delivery pay to driver wallet:', deliveryPayError);
        // Don't fail the order status update if delivery pay credit fails
      }
    }

    // Update tip transaction if order has tip and is being delivered or completed
    // Only credit if tip transaction hasn't been credited yet (status is pending)
    if (order.tipAmount && parseFloat(order.tipAmount) > 0 && (status === 'delivered' || finalStatus === 'completed') && order.driverId) {
      try {
        const driverId = order.driverId;
        // Find existing tip transaction (created when payment was completed)
        const tipTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'tip',
            status: 'pending' // Only credit if not already credited
          }
        });

        if (tipTransaction) {
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
            notes: `Tip for Order #${order.id} - ${order.customerName} (credited to driver wallet)`
          });

          // Update driver wallet
          await driverWallet.update({
            balance: parseFloat(driverWallet.balance) + parseFloat(order.tipAmount),
            totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + parseFloat(order.tipAmount),
            totalTipsCount: driverWallet.totalTipsCount + 1
          });

          console.log(`✅ Tip transaction completed for Order #${order.id}: KES ${order.tipAmount} for Driver #${driverId}`);

          // Emit socket event to notify driver about tip
          const io = req.app.get('io');
          if (io) {
            io.to(`driver-${driverId}`).emit('tip-received', {
              orderId: order.id,
              tipAmount: parseFloat(order.tipAmount),
              customerName: order.customerName,
              walletBalance: parseFloat(driverWallet.balance) + parseFloat(order.tipAmount)
            });
            console.log(`📬 Tip notification sent to driver #${driverId} for Order #${order.id}`);
          }
        } else {
          console.log(`⚠️  No pending tip transaction found for Order #${order.id} - may have been completed already`);
        }
      } catch (tipError) {
        console.error('❌ Error updating tip transaction:', tipError);
        // Don't fail the order status update if tip transaction fails
      }
    }

    // Reload order to get updated data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
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
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }
    orderData.status = finalStatus;

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('order-status-updated', {
        orderId: order.id,
        status: finalStatus,
        paymentStatus: order.paymentStatus,
        order: orderData
      });

      // Also notify driver if assigned
      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('order-status-updated', {
          orderId: order.id,
          status: finalStatus,
          paymentStatus: order.paymentStatus,
          order: orderData
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update payment status (admin)
router.patch('/orders/:id/payment-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update payment status
    await order.update({ paymentStatus });

    // If delivered and payment is paid, auto-update to completed
    let finalStatus = order.status;
    if (order.status === 'delivered' && paymentStatus === 'paid') {
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
    }

    // Reload order to get updated data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
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
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }
    orderData.status = finalStatus;

    // Emit socket events for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit payment confirmed event if payment is now paid
      if (paymentStatus === 'paid') {
        io.to('admin').emit('payment-confirmed', {
          orderId: order.id,
          status: finalStatus,
          paymentStatus: 'paid',
          order: orderData
        });

        // Notify driver if assigned
        if (order.driverId) {
          io.to(`driver-${order.driverId}`).emit('payment-confirmed', {
            orderId: order.id,
            status: finalStatus,
            paymentStatus: 'paid',
            order: orderData
          });
        }
      }

      // Also emit order status update
      io.to('admin').emit('order-status-updated', {
        orderId: order.id,
        status: finalStatus,
        paymentStatus: paymentStatus,
        order: orderData
      });

      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('order-status-updated', {
          orderId: order.id,
          status: finalStatus,
          paymentStatus: paymentStatus,
          order: orderData
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Assign/remove driver (admin)
router.patch('/orders/:id/driver', async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is delivered - if so, don't allow driver removal
    if (order.status === 'delivered' || order.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify driver assignment for delivered/completed orders' });
    }

    const oldDriverId = order.driverId;

    // Update driver assignment
    await order.update({ driverId: driverId || null });

    // Reload order to get updated data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        },
        {
          model: db.Transaction,
          as: 'transactions'
        },
        {
          model: db.Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phoneNumber', 'status']
        }
      ]
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    // If driver was assigned and payment is completed, credit tip immediately if not already credited
    if (driverId && order.paymentStatus === 'paid' && order.tipAmount && parseFloat(order.tipAmount) > 0) {
      try {
        // Find pending tip transaction
        const tipTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'tip',
            status: 'pending'
          }
        });

        if (tipTransaction) {
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

          const tipAmount = parseFloat(order.tipAmount);

          // Credit tip to driver wallet
          await driverWallet.update({
            balance: parseFloat(driverWallet.balance) + tipAmount,
            totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + tipAmount,
            totalTipsCount: driverWallet.totalTipsCount + 1
          });

          // Update tip transaction
          await tipTransaction.update({
            driverId: driverId,
            driverWalletId: driverWallet.id,
            status: 'completed',
            notes: `Tip for Order #${order.id} - ${order.customerName} (credited to driver wallet)`
          });

          console.log(`✅ Tip of KES ${tipAmount} credited to driver #${driverId} wallet for Order #${order.id}`);
        }
      } catch (tipError) {
        console.error('❌ Error crediting tip when driver assigned:', tipError);
        // Don't fail driver assignment if tip credit fails
      }
    }

    // Emit socket events for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Notify admin about driver assignment change
      io.to('admin').emit('order-updated', {
        orderId: order.id,
        order: orderData,
        message: driverId ? `Driver assigned to order #${order.id}` : `Driver removed from order #${order.id}`
      });

      // If driver was assigned and tip was credited, notify the driver
      if (driverId && order.paymentStatus === 'paid' && order.tipAmount && parseFloat(order.tipAmount) > 0) {
        try {
          const tipTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'tip',
              status: 'completed',
              driverId: driverId
            }
          });
          if (tipTransaction) {
            const driverWallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
            io.to(`driver-${driverId}`).emit('tip-received', {
              orderId: order.id,
              tipAmount: parseFloat(order.tipAmount),
              customerName: order.customerName,
              walletBalance: parseFloat(driverWallet?.balance || 0)
            });
          }
        } catch (error) {
          console.error('Error sending tip notification:', error);
        }
      }

      // If driver was assigned, notify the driver
      if (driverId) {
        const driver = await db.Driver.findByPk(driverId);
        if (driver) {
          io.to(`driver-${driverId}`).emit('order-assigned', {
            order: orderData,
            playSound: true
          });
        }
      }

      // If driver was removed, notify the old driver
      if (oldDriverId && oldDriverId !== driverId) {
        io.to(`driver-${oldDriverId}`).emit('driver-removed', {
          orderId: order.id
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating driver assignment:', error);
    res.status(500).json({ error: 'Failed to update driver assignment' });
  }
});

// Verify payment manually (admin)
router.post('/orders/:id/verify-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { receiptNumber } = req.body;

    const order = await db.Order.findByPk(id, {
      include: [
        {
          model: db.Transaction,
          as: 'transactions'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update payment status to paid
    await order.update({ 
      paymentStatus: 'paid',
      status: order.status === 'pending' ? 'confirmed' : order.status
    });

    // Update transaction if exists
    if (order.transactions && order.transactions.length > 0) {
      const transaction = order.transactions[0];
      await transaction.update({
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber || transaction.receiptNumber
      });
    }

    // Create tip transaction if order has tip (only after payment is verified)
    if (order.tipAmount && parseFloat(order.tipAmount) > 0) {
      try {
        // Check if tip transaction already exists
        const existingTipTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'tip'
          }
        });

        if (!existingTipTransaction) {
          const tipAmount = parseFloat(order.tipAmount);
          // Get payment transaction to share payment attributes
          const paymentTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'payment',
              status: 'completed'
            },
            order: [['createdAt', 'DESC']]
          });
          
          let tipTransactionData = {
            orderId: order.id,
            transactionType: 'tip',
            paymentMethod: paymentTransaction?.paymentMethod || 'mobile_money', // Same payment method as order payment
            paymentProvider: paymentTransaction?.paymentProvider || 'mpesa', // Same payment provider
            amount: tipAmount,
            status: 'completed', // Tip is paid when order payment is paid
            paymentStatus: 'paid', // Tip is paid when order payment is paid
            receiptNumber: paymentTransaction?.receiptNumber || receiptNumber || null, // Same receipt number as order payment
            checkoutRequestID: paymentTransaction?.checkoutRequestID || null, // Same checkout request ID
            merchantRequestID: paymentTransaction?.merchantRequestID || null, // Same merchant request ID
            phoneNumber: paymentTransaction?.phoneNumber || null, // Same phone number
            transactionDate: paymentTransaction?.transactionDate || new Date(), // Same transaction date
            notes: `Tip for Order #${order.id} - ${order.customerName} (from same M-Pesa payment as order)`
          };

          // If driver is already assigned, credit tip immediately
          if (order.driverId) {
            try {
              // Get or create driver wallet
              let driverWallet = await db.DriverWallet.findOne({ where: { driverId: order.driverId } });
              if (!driverWallet) {
                driverWallet = await db.DriverWallet.create({
                  driverId: order.driverId,
                  balance: 0,
                  totalTipsReceived: 0,
                  totalTipsCount: 0
                });
              }

              // Credit tip to driver wallet
              await driverWallet.update({
                balance: parseFloat(driverWallet.balance) + tipAmount,
                totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + tipAmount,
                totalTipsCount: driverWallet.totalTipsCount + 1
              });

              // Update tip transaction data with driver info
              tipTransactionData.driverId = order.driverId;
              tipTransactionData.driverWalletId = driverWallet.id;
              tipTransactionData.status = 'completed'; // Completed since driver is assigned
              tipTransactionData.notes = `Tip for Order #${order.id} - ${order.customerName} (credited to driver wallet)`;

              console.log(`✅ Tip of KES ${tipAmount} credited to driver #${order.driverId} wallet for Order #${order.id}`);
            } catch (walletError) {
              console.error('❌ Error crediting tip to driver wallet:', walletError);
              // Continue with tip transaction creation even if wallet credit fails
              tipTransactionData.status = 'pending'; // Will be completed when driver is assigned
              tipTransactionData.notes = `Tip for Order #${order.id} - ${order.customerName} (pending driver assignment)`;
            }
          } else {
            tipTransactionData.status = 'pending'; // Will be completed when driver is assigned
            tipTransactionData.notes = `Tip for Order #${order.id} - ${order.customerName} (pending driver assignment)`;
          }

          await db.Transaction.create(tipTransactionData);
          console.log(`✅ Tip transaction created for Order #${order.id}: KES ${tipAmount} (after payment verification)`);
        } else {
          console.log(`⚠️  Tip transaction already exists for Order #${order.id}`);
        }
      } catch (tipError) {
        console.error('❌ Error creating tip transaction:', tipError);
        // Don't fail payment verification if tip transaction fails
      }
    }

    // Credit order payment to admin wallet (order total minus tip, since tip goes to driver)
    try {
      // Get or create admin wallet (single wallet for all admin revenue)
      let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
      if (!adminWallet) {
        adminWallet = await db.AdminWallet.create({
          id: 1,
          balance: 0,
          totalRevenue: 0,
          totalOrders: 0
        });
      }

      // Order total for admin is order.totalAmount - tipAmount (tip goes to driver)
      // Note: payment transaction amount already excludes tip
      const tipAmount = parseFloat(order.tipAmount) || 0;
      const orderTotalForAdmin = parseFloat(order.totalAmount) - tipAmount;

      // Update admin wallet
      await adminWallet.update({
        balance: parseFloat(adminWallet.balance) + orderTotalForAdmin,
        totalRevenue: parseFloat(adminWallet.totalRevenue) + orderTotalForAdmin,
        totalOrders: adminWallet.totalOrders + 1
      });

      console.log(`✅ Order payment of KES ${orderTotalForAdmin} credited to admin wallet for Order #${order.id}`);
    } catch (adminWalletError) {
      console.error('❌ Error crediting order payment to admin wallet:', adminWalletError);
      // Don't fail payment verification if admin wallet credit fails
    }

    // Reload order
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
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
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    res.json({ success: true, order: orderData });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Get current admin user
router.get('/me', async (req, res) => {
  try {
    // For now, return a default admin user
    // In production, this should get the user from the session/token
    const defaultAdmin = await db.Admin.findOne({ where: { username: 'admin' } });
    if (defaultAdmin) {
      res.json({
        id: defaultAdmin.id,
        username: defaultAdmin.username,
        email: defaultAdmin.email,
        role: defaultAdmin.role || 'admin'
      });
    } else {
      res.json({
        id: 1,
        username: 'admin',
        email: 'admin@dialadrink.com',
        role: 'admin'
      });
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all admin users
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const users = await db.Admin.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new admin user (invite)
router.post('/users', verifyAdmin, async (req, res) => {
  try {
    const { username, email, role } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    // Check if user already exists
    const existingUser = await db.Admin.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this username or email already exists' });
    }

    // Generate invite token
    const crypto = require('crypto');
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create user
    const user = await db.Admin.create({
      username,
      email,
      role: role || 'manager',
      password: null, // Password will be set when user accepts invite
      inviteToken,
      inviteTokenExpiry
    });

    // Send invite email
    const emailService = require('../services/email');
    const emailResult = await emailService.sendAdminInvite(email, inviteToken, username);

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
      // User is created, but email failed - still return success
    }

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order notifications (admin)
router.get('/order-notifications', async (req, res) => {
  try {
    const notifications = await db.OrderNotification.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching order notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create order notification (admin)
router.post('/order-notifications', async (req, res) => {
  try {
    const { name, phoneNumber, isActive, notes } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const notification = await db.OrderNotification.create({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      isActive: isActive !== undefined ? isActive : true,
      notes: notes || null
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order notification (admin)
router.put('/order-notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, isActive, notes } = req.body;

    const notification = await db.OrderNotification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    await notification.update({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      isActive: isActive !== undefined ? isActive : notification.isActive,
      notes: notes !== undefined ? notes : notification.notes
    });

    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete order notification (admin)
router.delete('/order-notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await db.OrderNotification.findByPk(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.destroy();
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get SMS settings
router.get('/sms-settings', async (req, res) => {
  try {
    const setting = await db.Settings.findOne({ where: { key: 'smsEnabled' } });
    res.json({
      smsEnabled: setting?.value !== 'false' // Default to enabled if not set
    });
  } catch (error) {
    console.error('Error fetching SMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update SMS settings
router.put('/sms-settings', async (req, res) => {
  try {
    const { smsEnabled } = req.body;

    const [setting] = await db.Settings.findOrCreate({
      where: { key: 'smsEnabled' },
      defaults: { value: smsEnabled.toString() }
    });

    if (!setting.isNewRecord) {
      setting.value = smsEnabled.toString();
      await setting.save();
    }

    res.json({
      smsEnabled: setting.value === 'true'
    });
  } catch (error) {
    console.error('Error updating SMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
