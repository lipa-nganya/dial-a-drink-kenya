/**
 * Product routes with category-based SEO URLs
 * API endpoint: /api/products/:categorySlug/:productSlug
 * Frontend will handle the public-facing /:categorySlug/:productSlug routes
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { generateCategorySlugFromName } = require('../utils/slugGenerator');

/**
 * Get product by category slug and product slug
 * API Route: /api/products/:categorySlug/:productSlug
 */
router.get('/:categorySlug/:productSlug', async (req, res) => {
  try {
    const { categorySlug, productSlug } = req.params;

    // Resolve attributes so we include nbv only when the column exists
    let drinkAttributes = ['id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId', 'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice', 'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'slug', 'createdAt', 'updatedAt'];
    try {
      const [cols] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drinks' ORDER BY column_name"
      );
      const colSet = new Set((cols || []).map(c => c.column_name.toLowerCase()));
      if (colSet.has('nbv')) {
        drinkAttributes = ['id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId', 'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice', 'capacity', 'capacityPricing', 'abv', 'nbv', 'barcode', 'stock', 'slug', 'createdAt', 'updatedAt'];
      }
      if (colSet.has('clicks')) {
        drinkAttributes = drinkAttributes.concat(['clicks']);
      }
    } catch (_) { /* use default */ }

    // Find product by slug and include its category.
    const drink = await db.Drink.findOne({
      where: {
        slug: productSlug
      },
      attributes: drinkAttributes,
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name', 'slug', 'description', 'image', 'isActive', 'createdAt', 'updatedAt'],
        required: false
      }, {
        model: db.SubCategory,
        as: 'subCategory',
        required: false,
        attributes: ['id', 'name', 'categoryId']
      }, {
        model: db.Brand,
        as: 'brand',
        required: false,
        attributes: ['id', 'name']
      }]
    });

    if (!drink) {
      return res.status(404).json({ error: 'Product not found in this category' });
    }

    // If there is a category, compute its slug from the name and verify it matches.
    if (!drink.category || !drink.category.name) {
      return res.status(404).json({ error: 'Category not found for this product' });
    }

    const computedCategorySlug = generateCategorySlugFromName(drink.category.name);
    if (computedCategorySlug !== categorySlug) {
      return res.status(404).json({ error: 'Product not found in this category' });
    }

    // Record product details view (clicks) - fire and forget, raw SQL so it works even if model/column was not migrated yet
    const drinkId = drink.id;
    Promise.resolve().then(async () => {
      try {
        const [cols] = await db.sequelize.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drinks' AND column_name = 'clicks'"
        );
        if (cols && cols.length > 0) {
          await db.sequelize.query(
            'UPDATE drinks SET clicks = COALESCE(clicks, 0) + 1 WHERE id = :id',
            { replacements: { id: drinkId } }
          );
        }
      } catch (_) { /* ignore */ }
    });

    // Ensure the response always has a category.slug value, even if the DB column is null
    if (!drink.category.slug) {
      drink.category.slug = computedCategorySlug;
    }

    res.json(drink);
  } catch (error) {
    console.error('❌ Error fetching product by category and slug:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to fetch product',
        message: error.message || 'Database query failed. Please try again in a moment.'
      });
    }
  }
});

module.exports = router;
