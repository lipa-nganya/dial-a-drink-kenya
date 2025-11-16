const express = require('express');
const router = express.Router();
const db = require('../models');
const { ensureCustomerFromOrder } = require('../utils/customerSync');
const smsService = require('../services/sms');
const { getOrCreateHoldDriver } = require('../utils/holdDriver');
const { findClosestBranch } = require('../utils/branchAssignment');

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
    const { customerName, customerPhone, customerEmail, deliveryAddress, items, notes, paymentType, paymentMethod, tipAmount } = req.body;
    console.log('🛒 Incoming order payload:', JSON.stringify({
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      items,
      paymentType,
      paymentMethod,
      tipAmount
    }, null, 2));
    
    if (!customerName || !customerPhone || !deliveryAddress || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or empty cart' });
    }

    const normalizedItems = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item || item.drinkId === undefined || item.drinkId === null) {
        return res.status(400).json({ error: `Invalid item at position ${index + 1}: missing drinkId` });
      }

      const drinkId = parseInt(item.drinkId, 10);
      if (!Number.isInteger(drinkId) || drinkId <= 0) {
        return res.status(400).json({ error: `Invalid drinkId for item ${index + 1}` });
      }

      const quantity = parseInt(item.quantity, 10);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: `Invalid quantity for item ${index + 1}` });
      }

      const selectedPrice =
        item.selectedPrice !== undefined && item.selectedPrice !== null
          ? parseFloat(item.selectedPrice)
          : item.price !== undefined && item.price !== null
          ? parseFloat(item.price)
          : null;

      normalizedItems.push({
        drinkId,
        quantity,
        selectedPrice: Number.isFinite(selectedPrice) ? selectedPrice : null,
        selectedCapacity: item.selectedCapacity || null
      });
    }

    console.log('🛒 Normalized cart items:', JSON.stringify(normalizedItems, null, 2));

    if (!paymentType || !['pay_now', 'pay_on_delivery'].includes(paymentType)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    if (paymentType === 'pay_now' && (!paymentMethod || !['card', 'mobile_money'].includes(paymentMethod))) {
      return res.status(400).json({ error: 'Payment method required when paying now' });
    }

    let tip = parseFloat(tipAmount) || 0;
    if (tip < 0) {
      return res.status(400).json({ error: 'Tip amount cannot be negative' });
    }

    const [testModeSetting, maxTipSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'deliveryTestMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'maxTipEnabled' } }).catch(() => null)
    ]);

    const isTestMode = testModeSetting?.value === 'true';
    const maxTipEnabled = maxTipSetting?.value === 'true';

    if (isTestMode && maxTipEnabled && tip > 1) {
      tip = 1;
    }
    
    let createdOrderId = null;
    const transaction = await db.sequelize.transaction();

    try {
      let totalAmount = 0;
      const orderItems = [];

      for (const item of normalizedItems) {
        const drink = await db.Drink.findByPk(item.drinkId, { transaction });
        if (!drink) {
          await transaction.rollback();
          return res.status(400).json({ error: `Drink with ID ${item.drinkId} not found` });
        }

        const priceToUse =
          Number.isFinite(item.selectedPrice) && item.selectedPrice > 0
            ? item.selectedPrice
            : parseFloat(drink.price) || 0;

        console.log('[order:create] item', {
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.selectedPrice,
          drinkPrice: drink.price,
          computedPrice: priceToUse
        });

        const itemTotal = priceToUse * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          drinkId: item.drinkId,
          quantity: item.quantity,
          price: priceToUse
        });
      }

      const deliveryFee = await calculateDeliveryFee(normalizedItems);
      const finalTotal = totalAmount + deliveryFee + tip;

      let paymentStatus = paymentType === 'pay_now' ? 'pending' : 'unpaid';
      let orderStatus = 'pending';

      if (paymentType === 'pay_now' && paymentMethod === 'card') {
        orderStatus = 'confirmed';
        paymentStatus = 'paid';
      }

      // Assign HOLD Driver to all orders during creation
      // This ensures there's always a driverId/walletId available when payment happens
      const { driver: holdDriver } = await getOrCreateHoldDriver();

      // Find closest branch to delivery address
      const closestBranch = await findClosestBranch(deliveryAddress);
      const branchId = closestBranch ? closestBranch.id : null;

      const order = await db.Order.create({
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        totalAmount: finalTotal,
        tipAmount: tip,
        notes: notes ? `${notes}\nDelivery Fee: KES ${deliveryFee.toFixed(2)}${tip > 0 ? `\nTip: KES ${tip.toFixed(2)}` : ''}` : `Delivery Fee: KES ${deliveryFee.toFixed(2)}${tip > 0 ? `\nTip: KES ${tip.toFixed(2)}` : ''}`,
        paymentType: paymentType || 'pay_on_delivery',
        paymentMethod: paymentType === 'pay_now' ? paymentMethod : null,
        paymentStatus,
        status: orderStatus,
        driverId: holdDriver.id, // Assign HOLD Driver
        branchId: branchId // Assign closest branch
      }, { transaction });

      createdOrderId = order.id;

      await ensureCustomerFromOrder(order, { transaction });

      for (const item of orderItems) {
        console.log('[order:create] creating order item', item);
        await db.OrderItem.create({
          orderId: order.id,
          ...item
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      if (error?.errors) {
        console.error('Error creating order (validation):', error.errors.map((e) => ({
          message: e.message,
          path: e.path,
          value: e.value,
          type: e.type
        })));
      }
      console.error('Error creating order:', error);
      res.status(500).json({ error: error.message });
    }

    const completeOrder = await db.Order.findByPk(createdOrderId, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }]
    });

    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('new-order', {
        order: completeOrder,
        timestamp: new Date(),
        message: `New order #${completeOrder.id} from ${completeOrder.customerName}`
      });
    }
    
    try {
      const smsEnabledSetting = await db.Settings.findOne({ 
        where: { key: 'smsEnabled' } 
      }).catch(() => null);
      
      const isSmsEnabledNotifications = smsEnabledSetting?.value !== 'false';
      
      if (!isSmsEnabledNotifications) {
        console.log('📱 SMS notifications are DISABLED - skipping SMS for order #' + completeOrder.id);
      } else {
        console.log('📱 SMS notifications are ENABLED - sending SMS for order #' + completeOrder.id);
        const activeNotifications = await db.OrderNotification.findAll({
          where: { isActive: true }
        });
        
        if (activeNotifications.length > 0) {
          const smsMessage = `Order ID: ${completeOrder.id}\n` +
            `Customer: ${completeOrder.customerName}\n` +
            `Phone: ${completeOrder.customerPhone}\n` +
            `Total: KES ${parseFloat(completeOrder.totalAmount).toFixed(2)}`;
        
          const smsPromises = activeNotifications.map(notification => 
            smsService.sendSMS(notification.phoneNumber, smsMessage)
              .catch(error => {
                console.error(`Failed to send SMS to ${notification.name} (${notification.phoneNumber}):`, error);
                return { success: false, phone: notification.phoneNumber, error: error.message };
              })
          );
          
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
      console.error('Error sending SMS notifications:', error);
    }
    
    return res.status(201).json(completeOrder);
  } catch (error) {
    console.error('Error creating order:', error);
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
    const { status, reason } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const order = await db.Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let trimmedReason = null;
    if (status === 'cancelled') {
      trimmedReason = typeof reason === 'string' ? reason.trim() : '';
      if (!trimmedReason) {
        return res.status(400).json({ error: 'Cancellation reason is required' });
      }

      if (trimmedReason.length > 100) {
        return res.status(400).json({ error: 'Cancellation reason must be 100 characters or fewer' });
      }

      const cancellationNote = `[${new Date().toISOString()}] Cancelled by admin. Reason: ${trimmedReason}`;
      order.notes = order.notes ? `${order.notes}\n${cancellationNote}` : cancellationNote;
    }
    
    order.status = status;
    await order.save();

    if (trimmedReason) {
      order.setDataValue('cancellationReason', trimmedReason);
    }
    
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
          attributes: ['id', 'name', 'phoneNumber'],
          required: false // Left join - don't require driver to exist
        }
      ],
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
