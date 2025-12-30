const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

// Get all drinks
router.get('/', async (req, res) => {
  // Set request timeout to prevent hanging
  req.setTimeout(5000); // 5 second timeout
  
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
    
    // Add query timeout to prevent hanging on database connection issues
    const queryTimeout = setTimeout(() => {
      console.error('⚠️ Drinks query timeout - database may be unresponsive');
      if (!res.headersSent) {
        res.status(503).json({ error: 'Database query timeout. Please try again.' });
      }
    }, 8000); // 8 second timeout
    
    try {
      const drinks = await Promise.race([
        db.Drink.findAll({
          where: whereClause,
          include: [{
            model: db.Category,
            as: 'category'
          }, {
            model: db.SubCategory,
            as: 'subCategory'
          }, {
            model: db.Brand,
            as: 'brand'
          }],
          order: [
            ['isAvailable', 'DESC'], // Available items first (true = 1, false = 0)
            ['name', 'ASC']
          ]
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 8000)
        )
      ]);
      
      clearTimeout(queryTimeout);
      
      console.log('Returning drinks with capacity pricing:', drinks.map(d => ({ 
        id: d.id, 
        name: d.name, 
        capacityPricing: d.capacityPricing 
      })));
      
      if (!res.headersSent) {
        res.json(drinks);
      }
    } catch (queryError) {
      clearTimeout(queryTimeout);
      throw queryError;
    }
  } catch (error) {
    console.error('❌ Error fetching drinks:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message || 'Failed to fetch drinks',
        message: 'Database connection issue. Please try again in a moment.'
      });
    }
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

// Get drink by barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    const drink = await db.Drink.findOne({
      where: {
        barcode: barcode
      },
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }]
    });

    if (!drink) {
      return res.status(404).json({ error: 'Product not found with this barcode' });
    }

    res.json(drink);
  } catch (error) {
    console.error('Error fetching drink by barcode:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed product description (must be before /:id route)
router.get('/:id/detailed-description', async (req, res) => {
  try {
    const drink = await db.Drink.findByPk(req.params.id, {
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }]
    });
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    console.log(`[Detailed Description] Generating for product: ${drink.name} (ID: ${drink.id})`);
    
    const { generateProductDescription } = require('../services/productDescriptionGenerator');
    const description = await generateProductDescription(
      drink.name,
      drink.category?.name,
      drink.subCategory?.name
    );
    
    if (!description) {
      console.log(`[Detailed Description] No description generated for ${drink.name}`);
      return res.status(404).json({ error: 'Could not generate detailed description' });
    }
    
    console.log(`[Detailed Description] Successfully generated ${description.length} characters for ${drink.name}`);
    res.json({ description });
  } catch (error) {
    console.error('[Detailed Description] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get testing notes for a product (must be before /:id route)
router.get('/:id/testing-notes', async (req, res) => {
  try {
    const drink = await db.Drink.findByPk(req.params.id, {
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }]
    });
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    console.log(`[Testing Notes] Generating for product: ${drink.name} (ID: ${drink.id})`);
    
    const { generateTestingNotes } = require('../services/testingNotesGenerator');
    const testingNotes = await generateTestingNotes(
      drink.name,
      drink.category?.name,
      drink.subCategory?.name
    );
    
    if (!testingNotes) {
      console.log(`[Testing Notes] No notes generated for ${drink.name}`);
      return res.status(404).json({ error: 'Could not generate testing notes' });
    }
    
    console.log(`[Testing Notes] Successfully generated ${testingNotes.length} characters for ${drink.name}`);
    res.json({ testingNotes });
  } catch (error) {
    console.error('[Testing Notes] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get drink by ID (must be after /:id/detailed-description and /:id/testing-notes routes)
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

