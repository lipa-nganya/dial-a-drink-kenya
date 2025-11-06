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

    // Get today's revenue
    const todayRevenue = await db.Order.sum('totalAmount', {
      where: {
        createdAt: {
          [Op.gte]: today
        },
        paymentStatus: 'paid'
      }
    }) || 0;

    // Get total revenue
    const totalRevenue = await db.Order.sum('totalAmount', {
      where: {
        paymentStatus: 'paid'
      }
    }) || 0;

    // Get total drinks count
    const totalDrinks = await db.Drink.count();

    res.json({
      totalOrders,
      pendingOrders,
      todayOrders,
      todayRevenue: parseFloat(todayRevenue) || 0,
      totalRevenue: parseFloat(totalRevenue) || 0,
      totalDrinks
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

    // Update tip transaction if order has tip and is being delivered
    if (order.tipAmount && parseFloat(order.tipAmount) > 0 && status === 'delivered' && order.driverId) {
      try {
        const driverId = order.driverId;
        // Find existing tip transaction (created at order creation time)
        const tipTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'tip',
            status: 'pending' // Only update pending tip transactions
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
          await tipTransaction.update({
            driverId: driverId,
            driverWalletId: driverWallet.id,
            status: 'completed',
            paymentStatus: 'paid',
            notes: `Tip for Order #${order.id} - ${order.customerName}`
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

    // Emit socket events for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Notify admin about driver assignment change
      io.to('admin').emit('order-updated', {
        orderId: order.id,
        order: orderData,
        message: driverId ? `Driver assigned to order #${order.id}` : `Driver removed from order #${order.id}`
      });

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

module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
