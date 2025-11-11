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
    console.log('Fetching limited time offers...');

    const countdown = await db.Countdown.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    if (!countdown) {
      console.log('No active countdown found. Returning empty offers list.');
      return res.json([]);
    }

    const now = new Date();
    const startDate = new Date(countdown.startDate);
    const endDate = new Date(countdown.endDate);

    if (now < startDate) {
      console.log('Countdown has not started yet. Returning empty offers list.');
      return res.json([]);
    }

    if (now > endDate) {
      console.log('Countdown has ended. Returning empty offers list.');
      if (countdown.isActive) {
        await countdown.update({ isActive: false });
      }
      return res.json([]);
    }

    const offers = await db.Drink.findAll({
      where: {
        limitedTimeOffer: true
      },
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }],
      order: [
        ['isAvailable', 'DESC'],
        ['name', 'ASC']
      ]
    });

    console.log('Limited time offers found:', offers.length);
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

