const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { checkAndSendStockAlert } = require('../utils/stockAlerts');

/**
 * Attach barcode to a drink
 * POST /api/inventory/attach-barcode
 * Body: { drinkId, barcode }
 */
router.post('/attach-barcode', async (req, res) => {
  try {
    const { drinkId, barcode } = req.body;

    if (!drinkId || !barcode) {
      return res.status(400).json({ error: 'drinkId and barcode are required' });
    }

    // Check if barcode is already attached to another drink
    const existingDrink = await db.Drink.findOne({
      where: {
        barcode: barcode,
        id: { [Op.ne]: drinkId }
      }
    });

    if (existingDrink) {
      return res.status(400).json({ 
        error: `Barcode ${barcode} is already attached to ${existingDrink.name}` 
      });
    }

    // Update the drink with barcode
    const drink = await db.Drink.findByPk(drinkId);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    await drink.update({ barcode });
    
    res.json({ 
      success: true, 
      message: `Barcode ${barcode} attached to ${drink.name}`,
      drink 
    });
  } catch (error) {
    console.error('Error attaching barcode:', error);
    res.status(500).json({ error: 'Failed to attach barcode', details: error.message });
  }
});

/**
 * Update stock for a drink
 * POST /api/inventory/update-stock
 * Body: { drinkId, stock }
 */
router.post('/update-stock', async (req, res) => {
  try {
    const { drinkId, stock } = req.body;

    if (!drinkId || stock === undefined) {
      return res.status(400).json({ error: 'drinkId and stock are required' });
    }

    if (!Number.isInteger(parseInt(stock)) || parseInt(stock) < 0) {
      return res.status(400).json({ error: 'Stock must be a non-negative whole number' });
    }

    const drink = await db.Drink.findByPk(drinkId);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    const currentStock = parseInt(drink.stock) || 0;
    const newStock = parseInt(stock);
    
    // Automatically set isAvailable based on stock
    await drink.update({ 
      stock: newStock,
      isAvailable: newStock > 0 
    });

    // Check and send stock alert if needed
    await checkAndSendStockAlert(drinkId, currentStock, newStock, drink);
    
    res.json({ 
      success: true, 
      message: `Stock updated for ${drink.name}`,
      drink: await drink.reload()
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock', details: error.message });
  }
});

/**
 * Add stock to a drink (increment existing stock)
 * POST /api/inventory/add-stock
 * Body: { drinkId, quantity }
 */
router.post('/add-stock', async (req, res) => {
  try {
    const { drinkId, quantity } = req.body;

    if (!drinkId || quantity === undefined) {
      return res.status(400).json({ error: 'drinkId and quantity are required' });
    }

    if (!Number.isInteger(parseInt(quantity)) || parseInt(quantity) < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative whole number' });
    }

    const drink = await db.Drink.findByPk(drinkId);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    const currentStock = parseInt(drink.stock) || 0;
    const addQuantity = parseInt(quantity);
    const newStock = currentStock + addQuantity;

    // Automatically set isAvailable based on stock
    await drink.update({ 
      stock: newStock,
      isAvailable: newStock > 0 
    });

    // Note: Stock alerts only trigger when stock decreases, not when adding stock
    
    res.json({ 
      success: true, 
      message: `Stock added for ${drink.name}`,
      drink: await drink.reload(),
      previousStock: currentStock,
      addedQuantity: addQuantity,
      newStock
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    res.status(500).json({ error: 'Failed to add stock', details: error.message });
  }
});

/**
 * Decrease stock (used when item is sold at POS)
 * POST /api/inventory/decrease-stock
 * Body: { drinkId, quantity }
 */
router.post('/decrease-stock', async (req, res) => {
  try {
    const { drinkId, quantity } = req.body;

    if (!drinkId || !quantity) {
      return res.status(400).json({ error: 'drinkId and quantity are required' });
    }

    const drink = await db.Drink.findByPk(drinkId);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    const currentStock = parseInt(drink.stock) || 0;
    const newStock = Math.max(0, currentStock - parseInt(quantity));

    // Automatically set isAvailable based on stock
    await drink.update({ 
      stock: newStock,
      isAvailable: newStock > 0 
    });

    // Check and send stock alert if needed
    await checkAndSendStockAlert(drinkId, currentStock, newStock, drink);
    
    res.json({ 
      success: true, 
      message: `Stock decreased for ${drink.name}`,
      drink: await drink.reload(),
      previousStock: currentStock,
      newStock
    });
  } catch (error) {
    console.error('Error decreasing stock:', error);
    res.status(500).json({ error: 'Failed to decrease stock', details: error.message });
  }
});

/**
 * Get inventory info for all drinks
 * GET /api/inventory
 */
router.get('/', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'barcode', 'stock', 'isAvailable'],
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name']
      }],
      order: [['name', 'ASC']]
    });

    res.json({ drinks });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory', details: error.message });
  }
});

/**
 * Get drink by barcode (for scanning)
 * GET /api/inventory/barcode/:barcode
 */
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    const drink = await db.Drink.findOne({
      where: { barcode },
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name']
      }]
    });

    if (!drink) {
      return res.status(404).json({ error: 'Product not found with barcode: ' + barcode });
    }

    res.json(drink);
  } catch (error) {
    console.error('Error fetching drink by barcode:', error);
    res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

module.exports = router;

