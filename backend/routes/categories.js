const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.Category.findAll({
      order: [['name', 'ASC']]
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Add new categories (admin endpoint)
router.post('/add-all', async (req, res) => {
  try {
    const categories = [
      'Whisky',
      'Vodka', 
      'Wine',
      'Champagne',
      'Vapes',
      'Brandy',
      'Cognac',
      'Beer',
      'Tequila',
      'Rum',
      'Gin',
      'Liqueur',
      'Soft Drinks',
      'Smokes'
    ];

    const addedCategories = [];
    const existingCategories = [];

    for (const categoryName of categories) {
      // Check if category already exists
      const existing = await db.Category.findOne({
        where: { name: categoryName }
      });

      if (!existing) {
        // Insert new category
        const newCategory = await db.Category.create({
          name: categoryName
        });
        addedCategories.push(newCategory);
        console.log(`✅ Added category: ${categoryName}`);
      } else {
        existingCategories.push(existing);
        console.log(`⏭️  Category already exists: ${categoryName}`);
      }
    }
    
    res.json({ 
      message: 'Categories processed successfully',
      added: addedCategories,
      existing: existingCategories
    });
  } catch (error) {
    console.error('Error adding categories:', error);
    res.status(500).json({ error: 'Failed to add categories' });
  }
});

module.exports = router;