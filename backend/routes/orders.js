const express = require('express');
const router = express.Router();
const db = require('../models');

// Create new order
router.post('/', async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, deliveryAddress, items, notes } = req.body;
    
    if (!customerName || !customerPhone || !deliveryAddress || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
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
    
    // Create order
    const order = await db.Order.create({
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      totalAmount,
      notes
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
    
    res.status(201).json(completeOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

module.exports = router;
