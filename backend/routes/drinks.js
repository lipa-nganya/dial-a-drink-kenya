const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

// Get all drinks
router.get('/', async (req, res) => {
  try {
    const { category, search, popular, available_only } = req.query;
    let whereClause = {};
    
    // Only filter by availability if explicitly requested
    if (available_only === 'true') {
      whereClause.isAvailable = true;
    }
    
    if (category) {
      whereClause.categoryId = category;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (popular === 'true') {
      whereClause.isPopular = true;
    }
    
    const drinks = await db.Drink.findAll({
      where: whereClause,
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }],
      order: [['name', 'ASC']]
    });
    
    console.log('Returning drinks with capacity pricing:', drinks.map(d => ({ 
      id: d.id, 
      name: d.name, 
      capacityPricing: d.capacityPricing 
    })));
    
    res.json(drinks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get drinks on offer
router.get('/offers', async (req, res) => {
  try {
    console.log('Fetching offers...');
    
    // First, get all available drinks
    const allDrinks = await db.Drink.findAll({
      where: { 
        isAvailable: true
      },
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }],
      order: [['name', 'ASC']]
    });
    
    // Filter drinks that have discounts (items with discounts automatically appear on offers page)
    const offers = allDrinks.filter(drink => {
      // Check if drink has discounts in capacityPricing
      if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
        const hasDiscount = drink.capacityPricing.some(pricing => {
          if (!pricing || typeof pricing !== 'object') return false;
          const originalPrice = parseFloat(pricing.originalPrice) || 0;
          const currentPrice = parseFloat(pricing.currentPrice) || parseFloat(pricing.price) || 0;
          // Return true if originalPrice is greater than currentPrice and originalPrice is valid
          return originalPrice > currentPrice && originalPrice > 0 && currentPrice >= 0;
        });
        if (hasDiscount) {
          return true;
        }
      }
      
      // Check if drink has a discount at the main price level
      const originalPrice = parseFloat(drink.originalPrice) || 0;
      const currentPrice = parseFloat(drink.price) || 0;
      // Return true if originalPrice is greater than currentPrice and both are valid
      if (originalPrice > currentPrice && originalPrice > 0 && currentPrice >= 0) {
        return true;
      }
      
      return false;
    });
    
    console.log('Offers found:', offers.length);
    console.log('Offers details:', offers.map(d => ({ 
      id: d.id, 
      name: d.name,
      hasCapacityDiscount: Array.isArray(d.capacityPricing) && d.capacityPricing.some(p => {
        const orig = parseFloat(p.originalPrice) || 0;
        const curr = parseFloat(p.currentPrice) || 0;
        return orig > curr && orig > 0;
      }),
      hasMainDiscount: parseFloat(d.originalPrice || 0) > parseFloat(d.price || 0)
    })));
    
    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get drink by ID
router.get('/:id', async (req, res) => {
  try {
    const drink = await db.Drink.findByPk(req.params.id, {
      include: [{
        model: db.Category,
        as: 'category'
      }]
    });
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    res.json(drink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

