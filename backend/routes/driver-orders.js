const express = require('express');
const router = express.Router();
const db = require('../models');
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
      whereClause.status = { [db.Sequelize.Op.in]: statuses };
    }

    // Filter by date range if provided (for completed orders)
    let dateFilter = {};
    if (startDate) {
      dateFilter.createdAt = { [db.Sequelize.Op.gte]: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.createdAt = { 
        ...dateFilter.createdAt,
        [db.Sequelize.Op.lte]: new Date(endDate + 'T23:59:59')
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

    // Reload order to get updated status
    await order.reload();

    // Emit Socket.IO event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`order-${orderId}`).emit('order-status-updated', {
        orderId: order.id,
        status: order.status,
        oldStatus: oldStatus,
        paymentStatus: order.paymentStatus
      });
      io.to('admin').emit('order-status-updated', {
        orderId: order.id,
        status: order.status,
        oldStatus: oldStatus,
        paymentStatus: order.paymentStatus
      });
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
    const amount = parseFloat(order.totalAmount);
    const stkResult = await mpesaService.initiateSTKPush(
      formattedPhone,
      amount,
      order.id,
      `Payment for order #${order.id}`
    );

    if (stkResult.success) {
      res.json({
        success: true,
        message: 'Payment request sent to customer',
        checkoutRequestID: stkResult.checkoutRequestID,
        merchantRequestID: stkResult.merchantRequestID
      });
    } else {
      res.status(500).json({
        success: false,
        error: stkResult.error || 'Failed to initiate payment'
      });
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

