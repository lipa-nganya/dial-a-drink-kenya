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
        const { 
          name, 
          description, 
          price, 
          originalPrice,
          isAvailable, 
          isPopular, 
          isOnOffer,
          image,
          categoryId,
          capacity,
          capacityPricing,
          abv
        } = req.body;
    
    const drink = await db.Drink.findByPk(req.params.id);
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
        // Update basic fields
        drink.name = name;
        drink.description = description;
        drink.price = price;
        drink.isAvailable = isAvailable;
        drink.isPopular = isPopular;
        drink.isOnOffer = isOnOffer;
        drink.image = image;
        drink.categoryId = categoryId;
        drink.capacity = capacity;
        drink.capacityPricing = capacityPricing;
        drink.abv = abv;
    
    // Handle original price for offers
    if (originalPrice) {
      drink.originalPrice = originalPrice;
    }
    
    await drink.save();
    
    res.json(drink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alternative PATCH endpoint for partial updates
router.patch('/drinks/:id', async (req, res) => {
  try {
    const drink = await db.Drink.findByPk(req.params.id);
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
        // Update only provided fields
        const allowedFields = [
          'name', 'description', 'price', 'originalPrice', 
          'isAvailable', 'isPopular', 'isOnOffer', 'image', 'categoryId', 'subCategoryId',
          'capacity', 'capacityPricing', 'abv'
        ];
    
    console.log('Received request body:', req.body);
    console.log('Capacity pricing received:', req.body.capacityPricing);
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        console.log(`Updating field ${field}:`, req.body[field]);
        drink[field] = req.body[field];
      }
    }
    
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

