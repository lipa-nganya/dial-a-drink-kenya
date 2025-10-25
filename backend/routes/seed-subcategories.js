const express = require('express');
const router = express.Router();
const db = require('../models');

// Seed subcategories endpoint
router.post('/seed-subcategories', async (req, res) => {
  try {
    console.log('🌱 Starting subcategories seeding...');

    // First, get all categories
    const categories = await db.Category.findAll({
      order: [['name', 'ASC']]
    });

    console.log('Found categories:', categories.map(c => c.name));

    // Define subcategories data
    const subcategoriesData = [
      // Whisky
      { categoryName: 'Whisky', subcategories: [
        'All Whiskys', 'Single Malt', 'Bourbon Whisky', 'Blended Scotch', 'Irish Whisky', 'Tennessee Whisky'
      ]},
      // Vodka
      { categoryName: 'Vodka', subcategories: [
        'All Vodka', 'Flavoured Vodka', 'Unflavoured Vodka'
      ]},
      // Wine
      { categoryName: 'Wine', subcategories: [
        'All Wine', 'Red Wine', 'White Wine', 'Rose Wine'
      ]},
      // Champagne
      { categoryName: 'Champagne', subcategories: [
        'All Champagne', 'Rose Champagne', 'Sparkling Wine'
      ]},
      // Beer
      { categoryName: 'Beer', subcategories: [
        'All Beer', 'Cider', 'Lager', 'Malt', 'Draught'
      ]},
      // Tequila
      { categoryName: 'Tequila', subcategories: [
        'All Tequila', 'Gold Tequila', 'Silver Tequila', 'Reposado Tequila'
      ]}
    ];

    let totalCreated = 0;

    for (const categoryData of subcategoriesData) {
      const category = categories.find(c => c.name === categoryData.categoryName);
      
      if (!category) {
        console.log(`⚠️  Category "${categoryData.categoryName}" not found, skipping...`);
        continue;
      }

      console.log(`\n📁 Processing category: ${categoryData.categoryName} (ID: ${category.id})`);

      for (const subcategoryName of categoryData.subcategories) {
        try {
          // Check if subcategory already exists
          const existing = await db.SubCategory.findOne({
            where: { 
              name: subcategoryName, 
              categoryId: category.id 
            }
          });

          if (existing) {
            console.log(`  ✅ "${subcategoryName}" already exists`);
            continue;
          }

          // Create subcategory
          await db.SubCategory.create({
            name: subcategoryName,
            categoryId: category.id
          });

          console.log(`  ➕ Created: "${subcategoryName}"`);
          totalCreated++;

        } catch (error) {
          console.error(`  ❌ Error creating "${subcategoryName}":`, error.message);
        }
      }
    }

    console.log(`\n🎉 Subcategories seeding completed!`);
    console.log(`📊 Total subcategories created: ${totalCreated}`);

    // Show summary
    const allSubcategories = await db.SubCategory.findAll({
      include: [{
        model: db.Category,
        as: 'category'
      }],
      order: [['categoryId', 'ASC'], ['name', 'ASC']]
    });

    console.log('\n📋 All subcategories:');
    allSubcategories.forEach(item => {
      console.log(`  ${item.category.name} → ${item.name}`);
    });

    res.json({ 
      success: true, 
      message: 'Subcategories seeded successfully',
      totalCreated,
      subcategories: allSubcategories
    });

  } catch (error) {
    console.error('❌ Error seeding subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
