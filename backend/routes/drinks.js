const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { generateCategorySlugFromName } = require('../utils/slugGenerator');

// Get all drinks
router.get('/', async (req, res) => {
  // Set request timeout to prevent hanging
  req.setTimeout(30000); // 30 second timeout
  
  let queryTimeout = null;
  
  try {
    const { category, search, popular, available_only, brandId } = req.query;
    let whereClause = {};
    
    // Only filter by availability if explicitly requested
    if (available_only === 'true') {
      whereClause.isAvailable = true;
    }
    
    if (category) {
      whereClause.categoryId = category;
    }
    
    if (brandId) {
      whereClause.brandId = brandId;
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
    queryTimeout = setTimeout(() => {
      console.error('⚠️ Drinks query timeout - database may be unresponsive');
      if (!res.headersSent) {
        res.status(503).json({ error: 'Database query timeout. Please try again.' });
      }
    }, 10000); // 10 second timeout
    
    try {
      // Query drinks, handling missing slug column gracefully
      let drinks;
      try {
        drinks = await Promise.race([
          db.Drink.findAll({
            where: whereClause,
            attributes: ['id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId', 'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice', 'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'slug', 'createdAt', 'updatedAt'],
            include: [{
              model: db.Category,
              as: 'category',
              required: false,
              attributes: {
                include: ['id', 'name', 'description', 'image', 'isActive'],
                // slug will be included if it exists, otherwise it will be null/undefined
              }
            }, {
              model: db.Brand,
              as: 'brand',
              required: false,
              attributes: ['id', 'name']
            }],
            order: [
              ['isAvailable', 'DESC'], // Available items first (true = 1, false = 0)
              ['name', 'ASC']
            ]
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 10000)
          )
        ]);
      } catch (error) {
        // If slug column doesn't exist, query without it
        if (error.message && (error.message.includes('column') && error.message.includes('slug'))) {
          console.log('⚠️  slug column not found in drinks table, querying without it...');
          drinks = await Promise.race([
            db.Drink.findAll({
              where: whereClause,
              attributes: ['id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId', 'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice', 'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'createdAt', 'updatedAt'], // Exclude slug
              include: [{
                model: db.Category,
                as: 'category',
                required: false,
                attributes: ['id', 'name', 'description', 'image', 'isActive'] // Exclude category slug too
              }, {
                model: db.Brand,
                as: 'brand',
                required: false,
                attributes: ['id', 'name']
              }],
              order: [
                ['isAvailable', 'DESC'],
                ['name', 'ASC']
              ]
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), 10000)
            )
          ]);
        } else {
          throw error;
        }
      }
      
      if (queryTimeout) {
        clearTimeout(queryTimeout);
        queryTimeout = null;
      }
      
      console.log(`✅ Returning ${drinks.length} drinks`);
      
      if (!res.headersSent) {
        res.json(drinks);
      }
    } catch (queryError) {
      if (queryTimeout) {
        clearTimeout(queryTimeout);
        queryTimeout = null;
      }
      throw queryError;
    }
  } catch (error) {
    if (queryTimeout) {
      clearTimeout(queryTimeout);
    }
    console.error('❌ Error fetching drinks:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to fetch drinks',
        message: 'Database query failed. Please try again in a moment.'
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
// Supports both numeric ID and slug
router.get('/:id/detailed-description', async (req, res) => {
  try {
    const identifier = req.params.id;
    const isNumeric = /^\d+$/.test(identifier);
    
    const drink = isNumeric
      ? await db.Drink.findByPk(identifier, {
          include: [{
            model: db.Category,
            as: 'category'
          }, {
            model: db.SubCategory,
            as: 'subCategory'
          }]
        })
      : await db.Drink.findOne({
          where: { slug: identifier },
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
// Supports both numeric ID and slug
router.get('/:id/testing-notes', async (req, res) => {
  try {
    const identifier = req.params.id;
    const isNumeric = /^\d+$/.test(identifier);
    
    const drink = isNumeric
      ? await db.Drink.findByPk(identifier, {
          include: [{
            model: db.Category,
            as: 'category'
          }, {
            model: db.SubCategory,
            as: 'subCategory'
          }]
        })
      : await db.Drink.findOne({
          where: { slug: identifier },
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

// Helper to ensure category.slug is always populated in API responses, even if DB column is null
function ensureCategorySlug(drink) {
  try {
    if (drink && drink.category && !drink.category.slug && drink.category.name) {
      drink.category.slug = generateCategorySlugFromName(drink.category.name);
    }
  } catch (e) {
    // Fail silently; this is just for nicer URLs and should not break main response
    console.error('⚠️ Failed to compute category slug for drink:', drink?.id, e.message);
  }
}

// Get drink by ID or slug (must be after /:id/detailed-description and /:id/testing-notes routes)
// This route handles old /product/:id URLs and redirects to category-based URLs
router.get('/:id', async (req, res) => {
  try {
    const identifier = req.params.id;
    const isNumeric = /^\d+$/.test(identifier);
    
    let drink;
    
    if (isNumeric) {
      // Old format: numeric ID - fetch by ID and redirect to category-based URL
      drink = await db.Drink.findByPk(identifier, {
        attributes: [
          'id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId',
          'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
          'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'slug', 'createdAt', 'updatedAt'
        ],
        include: [{
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'description', 'image', 'isActive', 'createdAt', 'updatedAt'],
          required: false
        }]
      });
      
      if (!drink) {
        return res.status(404).json({ error: 'Drink not found' });
      }

      // Populate category.slug in the JSON response if it's missing so the frontend
      // can build /{categorySlug}/{productSlug} URLs even when the DB column is null.
      ensureCategorySlug(drink);

      // Return JSON so the frontend can redirect to /{categorySlug}/{productSlug}
      // (API must not 301 redirect or the client gets the wrong response).
      return res.json(drink);
    } else {
      // Old format: /product/{slug} - redirect to category-based URL
      drink = await db.Drink.findOne({
        where: { slug: identifier },
        attributes: [
          'id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId',
          'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
          'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'slug', 'createdAt', 'updatedAt'
        ],
        include: [{
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'description', 'image', 'isActive', 'createdAt', 'updatedAt'],
          required: false
        }]
      });
      
      if (!drink) {
        return res.status(404).json({ error: 'Drink not found' });
      }

      // Populate category.slug for slug-based lookups as well
      ensureCategorySlug(drink);

      // Return JSON; frontend will redirect to /{categorySlug}/{productSlug}.
      res.json(drink);
    }
  } catch (error) {
    console.error('❌ Error fetching drink:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to fetch drink',
        message: error.message || 'Database query failed. Please try again in a moment.'
      });
    }
  }
});

module.exports = router;

