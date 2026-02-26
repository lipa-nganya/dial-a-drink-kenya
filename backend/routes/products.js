/**
 * Product routes with category-based SEO URLs
 * API endpoint: /api/products/:categorySlug/:productSlug
 * Frontend will handle the public-facing /:categorySlug/:productSlug routes
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get product by category slug and product slug
 * API Route: /api/products/:categorySlug/:productSlug
 */
router.get('/:categorySlug/:productSlug', async (req, res) => {
  try {
    const { categorySlug, productSlug } = req.params;

    // Find category by slug
    const category = await db.Category.findOne({
      where: { slug: categorySlug, isActive: true }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Find product by slug and verify it belongs to the category
    const drink = await db.Drink.findOne({
      where: {
        slug: productSlug,
        categoryId: category.id
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

    // Verify category matches (extra safety check)
    if (drink.categoryId !== category.id) {
      return res.status(404).json({ error: 'Product category mismatch' });
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
