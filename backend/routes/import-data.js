const express = require('express');
const router = express.Router();
const db = require('../models');

// Import all categories from Dial A Drink Kenya
router.post('/import-categories', async (req, res) => {
  try {
    const categories = [
      { name: 'Whisky', description: 'Premium whisky collection from around the world' },
      { name: 'Vodka', description: 'Premium vodka collection' },
      { name: 'Wine', description: 'Fine wines from various regions' },
      { name: 'Champagne', description: 'Premium champagne and sparkling wines' },
      { name: 'Vapes', description: 'Electronic cigarettes and vaping products' },
      { name: 'Brandy', description: 'Premium brandy collection' },
      { name: 'Cognac', description: 'Fine cognac collection' },
      { name: 'Beer', description: 'Local and international beers' },
      { name: 'Tequila', description: 'Premium tequila collection' },
      { name: 'Rum', description: 'Premium rum collection' },
      { name: 'Gin', description: 'Premium gin collection' },
      { name: 'Liqueur', description: 'Sweet liqueurs and cordials' },
      { name: 'Soft Drinks', description: 'Non-alcoholic beverages' },
      { name: 'Smokes', description: 'Cigarettes and tobacco products' }
    ];

    let totalCreated = 0;
    const createdCategories = [];

    for (const categoryData of categories) {
      const [category, created] = await db.Category.findOrCreate({
        where: { name: categoryData.name },
        defaults: {
          name: categoryData.name,
          description: categoryData.description,
          isActive: true
        }
      });
      
      if (created) {
        totalCreated++;
        createdCategories.push(category);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Categories imported successfully',
      totalCreated: totalCreated,
      categories: createdCategories
    });

  } catch (error) {
    console.error('Error importing categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import all subcategories from Dial A Drink Kenya
router.post('/import-subcategories', async (req, res) => {
  try {
    const subcategoriesData = [
      { categoryName: 'Whisky', subcategories: ['All Whiskies', 'Single Malt', 'Bourbon Whisky', 'Blended Scotch', 'Irish Whisky', 'Tennessee Whisky'] },
      { categoryName: 'Vodka', subcategories: ['All Vodka', 'Flavoured Vodka', 'Unflavoured Vodka'] },
      { categoryName: 'Wine', subcategories: ['All Wine', 'Red Wine', 'White Wine', 'Rose Wine'] },
      { categoryName: 'Champagne', subcategories: ['All Champagne', 'Rose Champagne', 'Sparkling Wine'] },
      { categoryName: 'Vapes', subcategories: ['All Vapes'] },
      { categoryName: 'Brandy', subcategories: ['All Brandy'] },
      { categoryName: 'Cognac', subcategories: ['All Cognac'] },
      { categoryName: 'Beer', subcategories: ['All Beer', 'Cider', 'Lager', 'Malt', 'Draught'] },
      { categoryName: 'Tequila', subcategories: ['All Tequila', 'Gold Tequila', 'Silver Tequila', 'Reposado Tequila'] },
      { categoryName: 'Rum', subcategories: ['All Rum'] },
      { categoryName: 'Gin', subcategories: ['Gin'] },
      { categoryName: 'Liqueur', subcategories: ['All Liqueur'] },
      { categoryName: 'Soft Drinks', subcategories: ['All Soft Drinks'] },
      { categoryName: 'Smokes', subcategories: ['Smokes'] }
    ];

    let totalCreated = 0;
    const createdSubcategories = [];

    for (const categoryData of subcategoriesData) {
      const category = await db.Category.findOne({ where: { name: categoryData.categoryName } });
      if (category) {
        for (const subcategoryName of categoryData.subcategories) {
          const [subcategory, created] = await db.SubCategory.findOrCreate({
            where: { name: subcategoryName, categoryId: category.id },
            defaults: { 
              name: subcategoryName, 
              categoryId: category.id,
              isActive: true
            }
          });
          if (created) {
            totalCreated++;
            createdSubcategories.push(subcategory);
          }
        }
      } else {
        console.warn(`Category "${categoryData.categoryName}" not found. Skipping subcategories.`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Subcategories imported successfully',
      totalCreated: totalCreated,
      subcategories: createdSubcategories
    });

  } catch (error) {
    console.error('Error importing subcategories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

