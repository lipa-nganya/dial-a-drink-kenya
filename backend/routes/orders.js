const express = require('express');
const router = express.Router();
const db = require('../models');
const smsService = require('../services/sms');

// Helper function to calculate delivery fee
const calculateDeliveryFee = async (items) => {
  try {
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
    if (items && items.length > 0) {
      const drinkIds = items.map(item => item.drinkId);
      const drinks = await db.Drink.findAll({
        where: { id: drinkIds },
        include: [{
          model: db.Category,
          as: 'category'
        }]
      });

      const allSoftDrinks = drinks.every(drink => 
        drink.category && drink.category.name === 'Soft Drinks'
      );

      if (allSoftDrinks) {
        return deliveryFeeWithoutAlcohol;
      }
    }

    return deliveryFeeWithAlcohol;
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    // Default to standard delivery fee on error
    return 50;
  }
};

// Create new order
router.post('/', async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, deliveryAddress, items, notes, paymentType, paymentMethod } = req.body;
    
    if (!customerName || !customerPhone || !deliveryAddress || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate payment information
    if (!paymentType || !['pay_now', 'pay_on_delivery'].includes(paymentType)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    if (paymentType === 'pay_now' && (!paymentMethod || !['card', 'mobile_money'].includes(paymentMethod))) {
      return res.status(400).json({ error: 'Payment method required when paying now' });
    }
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const drink = await db.Drink.findByPk(item.drinkId);
      if (!drink) {
        return res.status(400).json({ error: `Drink with ID ${item.drinkId} not found` });
      }
      
      const itemTotal = drink.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        drinkId: item.drinkId,
        quantity: item.quantity,
        price: drink.price
      });
    }

    // Calculate delivery fee
    const deliveryFee = await calculateDeliveryFee(items);
    const finalTotal = totalAmount + deliveryFee;
    
    // Create order
    // Determine payment status based on payment type
    let paymentStatus = 'pending';
    if (paymentType === 'pay_now') {
      paymentStatus = 'pending'; // Will be updated to 'paid' when payment completes
    } else {
      paymentStatus = 'unpaid'; // Pay on delivery starts as unpaid
    }

    // Determine order status based on payment
    let orderStatus = 'pending';
    if (paymentType === 'pay_now' && paymentMethod === 'mobile_money') {
      // M-Pesa payments start as pending, will be confirmed when payment callback arrives
      orderStatus = 'pending';
    } else if (paymentType === 'pay_now' && paymentMethod === 'card') {
      // Card payments can be confirmed immediately (assuming payment gateway handles it)
      orderStatus = 'confirmed';
      paymentStatus = 'paid';
    }

    const order = await db.Order.create({
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      totalAmount: finalTotal, // Include delivery fee in total
      notes: notes ? `${notes}\nDelivery Fee: KES ${deliveryFee.toFixed(2)}` : `Delivery Fee: KES ${deliveryFee.toFixed(2)}`,
      paymentType: paymentType || 'pay_on_delivery',
      paymentMethod: paymentType === 'pay_now' ? paymentMethod : null,
      paymentStatus: paymentStatus,
      status: orderStatus
    });
    
    // Create order items
    for (const item of orderItems) {
      await db.OrderItem.create({
        orderId: order.id,
        ...item
      });
    }
    
    // Fetch the complete order with items
    const completeOrder = await db.Order.findByPk(order.id, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }]
    });
    
    // Emit notification to admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('new-order', {
        order: completeOrder,
        timestamp: new Date(),
        message: `New order #${completeOrder.id} from ${completeOrder.customerName}`
      });
    }
    
    // Send SMS notifications to active notification recipients
    try {
      // Check if SMS is enabled
      const smsEnabledSetting = await db.Settings.findOne({ 
        where: { key: 'smsEnabled' } 
      }).catch(() => null);
      
      const isSmsEnabled = smsEnabledSetting?.value !== 'false'; // Default to enabled if not set
      
      if (!isSmsEnabled) {
        console.log('📱 SMS notifications are DISABLED - skipping SMS for order #' + completeOrder.id);
        // Continue without sending SMS - functionality is paused
        // Exit this try block without sending SMS
      } else {
        console.log('📱 SMS notifications are ENABLED - sending SMS for order #' + completeOrder.id);
        const activeNotifications = await db.OrderNotification.findAll({
          where: { isActive: true }
        });
        
        if (activeNotifications.length > 0) {
        // Format order details for SMS (simplified format)
        const smsMessage = `Order ID: ${completeOrder.id}\n` +
          `Customer: ${completeOrder.customerName}\n` +
          `Phone: ${completeOrder.customerPhone}\n` +
          `Total: KES ${parseFloat(completeOrder.totalAmount).toFixed(2)}`;
        
        // Send SMS to all active recipients (async, don't wait for all to complete)
        const smsPromises = activeNotifications.map(notification => 
          smsService.sendSMS(notification.phoneNumber, smsMessage)
            .catch(error => {
              console.error(`Failed to send SMS to ${notification.name} (${notification.phoneNumber}):`, error);
              return { success: false, phone: notification.phoneNumber, error: error.message };
            })
        );
        
          // Fire and forget - don't block the response
          Promise.all(smsPromises).then(results => {
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            console.log(`📱 SMS notifications sent: ${successful} successful, ${failed} failed`);
          }).catch(error => {
            console.error('Error processing SMS notifications:', error);
          });
        } else {
          console.log('📱 No active notification recipients found');
        }
      }
    } catch (error) {
      // Don't fail the order creation if SMS fails
      console.error('Error sending SMS notifications:', error);
    }
    
    res.status(201).json(completeOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find order by email or phone number (for customer login)
 * This route must be before /:id to avoid conflicts
 */
router.post('/find', async (req, res) => {
  try {
    const { email, phone, orderId } = req.body;

    if (!email && !phone && !orderId) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, phone number, or order ID is required' 
      });
    }

    let whereClause = {};
    
    if (orderId) {
      whereClause.id = orderId;
    } else {
      if (email) {
        whereClause.customerEmail = email;
      }
      if (phone) {
        // Clean phone number for comparison
        const cleanedPhone = phone.replace(/\D/g, '');
        whereClause.customerPhone = {
          [db.Sequelize.Op.like]: `%${cleanedPhone}%`
        };
      }
    }

    const order = await db.Order.findOne({
      where: whereClause,
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }],
      order: [['createdAt', 'DESC']] // Get most recent order
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found. Please check your email or phone number.'
      });
    }

    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('Error finding order:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to find order' 
    });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await db.Order.findByPk(req.params.id, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }]
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const order = await db.Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.status = status;
    await order.save();
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find all orders by email or phone number (for customer orders page)
 */
router.post('/find-all', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ 
        success: false,
        error: 'Email or phone number is required' 
      });
    }

    let whereClause = {};
    
    if (email) {
      whereClause.customerEmail = email;
    }
    if (phone) {
      // Clean phone number for comparison
      const cleanedPhone = phone.replace(/\D/g, '');
      whereClause.customerPhone = {
        [db.Sequelize.Op.like]: `%${cleanedPhone}%`
      };
    }

    const orders = await db.Order.findAll({
      where: whereClause,
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error finding orders:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to find orders' 
    });
  }
});

module.exports = router;
