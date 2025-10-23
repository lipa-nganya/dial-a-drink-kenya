const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all orders for admin
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.Order.findAll({
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
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all drinks for inventory management
router.get('/drinks', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      include: [{
        model: db.Category,
        as: 'category'
      }],
      order: [['name', 'ASC']]
    });
    res.json(drinks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update drink availability
router.patch('/drinks/:id/availability', async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const drink = await db.Drink.findByPk(req.params.id);
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    drink.isAvailable = isAvailable;
    await drink.save();
    
    res.json(drink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update drink details
router.put('/drinks/:id', async (req, res) => {
  try {
    const { name, description, price, isAvailable, isPopular } = req.body;
    const drink = await db.Drink.findByPk(req.params.id);
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    drink.name = name;
    drink.description = description;
    drink.price = price;
    drink.isAvailable = isAvailable;
    drink.isPopular = isPopular;
    await drink.save();
    
    res.json(drink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/orders/:id/status', async (req, res) => {
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

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalOrders = await db.Order.count();
    const pendingOrders = await db.Order.count({ where: { status: 'pending' } });
    const totalDrinks = await db.Drink.count();
    const availableDrinks = await db.Drink.count({ where: { isAvailable: true } });
    
    // Get recent orders
    const recentOrders = await db.Order.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }]
    });
    
    res.json({
      totalOrders,
      pendingOrders,
      totalDrinks,
      availableDrinks,
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

