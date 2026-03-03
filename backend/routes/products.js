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

    // Find product by slug and include its category.
    // We deliberately do NOT depend on Category.slug in the database, because
    // some legacy rows have null slugs. Instead we compute the slug from the
    // category name and compare it to :categorySlug.
    const drink = await db.Drink.findOne({
      where: {
        slug: productSlug
      },
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
