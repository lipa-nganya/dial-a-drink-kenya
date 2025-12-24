const express = require('express');
const router = express.Router();
const db = require('../models');

// Test import of a single smoke product
router.post('/test-import', async (req, res) => {
  try {
    console.log('Starting test import...');
    
    const category = await db.Category.findOne({ where: { name: 'Smokes' } });
    console.log('Found category:', category ? category.name : 'NOT FOUND');
    
    const subCategory = await db.SubCategory.findOne({ where: { name: 'Cigarettes', categoryId: category.id } });
    console.log('Found subcategory:', subCategory ? subCategory.name : 'NOT FOUND');
    
    const testProduct = await db.Drink.create({
      name: 'Test Embassy Lights',
      description: 'Test cigarette packet',
      price: 600,
      categoryId: category.id,
      subCategoryId: subCategory.id,
      capacity: ['Packet'],
      capacityPricing: [{
        capacity: 'Packet',
        originalPrice: 600,
        currentPrice: 600
      }],
      isAvailable: true,
      originalPrice: 600,
    });
    
    console.log('Created test product:', testProduct.name);
    
    res.status(200).json({
      success: true,
      message: 'Test product created successfully',
      product: testProduct
    });

  } catch (error) {
    console.error('Error in test import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
































