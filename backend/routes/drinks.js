const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

// Get all drinks
router.get('/', async (req, res) => {
  try {
    const { category, search, popular } = req.query;
    let whereClause = { isAvailable: true };
    
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
    const drinks = await db.Drink.findAll({
      where: { 
        isAvailable: true,
        isOnOffer: true
      },
      include: [{
        model: db.Category,
        as: 'category'
      }],
      order: [['name', 'ASC']]
    });
    
    console.log('Offers found:', drinks.length);
    console.log('Offers with capacity pricing:', drinks.map(d => ({ 
      id: d.id, 
      name: d.name, 
      capacityPricing: d.capacityPricing 
    })));
    
    res.json(drinks);
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

