const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

// Missing wine products that should be on the Dial a Drink website
const missingWineProducts = [
  {
    name: "Alma Mora Pinot Grigio",
    description: "Alma Mora Pinot Grigio (ABV 12.5%), Argentina",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 12.5,
    wineType: "White",
    isAvailable: false // Sold out on website
  },
  {
    name: "Choco Secco White wine",
    description: "Choco Secco White wine (ABV 10%), Germany",
    price: 1650,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1650, currentPrice: 1650 }
    ],
    abv: 10.0,
    wineType: "White",
    isAvailable: false // Sold out on website
  },
  {
    name: "Brancott Estate Sauvignon Blanc",
    description: "Brancott Estate Sauvignon Blanc (ABV 13%), New Zealand",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 13.0,
    wineType: "White",
    isAvailable: false // Sold out on website
  }
];

router.post('/import-missing-wines', async (req, res) => {
  try {
    console.log('Starting missing wines import...');
    
    // Get the Wine category
    const wineCategory = await Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      return res.status(404).json({ error: 'Wine category not found' });
    }

    // Get or create the "All Wines" subcategory
    let subCategory = await SubCategory.findOne({ 
      where: { name: 'All Wines', categoryId: wineCategory.id } 
    });
    
    if (!subCategory) {
      subCategory = await SubCategory.create({
        name: 'All Wines',
        categoryId: wineCategory.id,
        isActive: true
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of missingWineProducts) {
      try {
        // Check if product already exists (case insensitive)
        const existingDrink = await Drink.findOne({
          where: {
            name: {
              [require('sequelize').Op.iLike]: product.name
            },
            categoryId: wineCategory.id
          }
        });

        if (existingDrink) {
          console.log(`Skipping existing product: ${product.name} (found: ${existingDrink.name})`);
          skippedCount++;
          results.push({ name: product.name, status: 'skipped', reason: 'already exists', existingName: existingDrink.name });
          continue;
        }

        // Create the drink
        const drink = await Drink.create({
          name: product.name,
          description: product.description,
          price: product.price.toString(),
          originalPrice: product.price.toString(),
          categoryId: wineCategory.id,
          subCategoryId: subCategory.id,
          capacity: product.capacity,
          capacityPricing: product.capacityPricing,
          abv: product.abv,
          isAvailable: product.isAvailable !== undefined ? product.isAvailable : true,
          isPopular: product.isPopular || false,
          isOnOffer: false,
          image: null
        });

        console.log(`Imported: ${product.name} - KES ${product.price}`);
        importedCount++;
        results.push({ name: product.name, status: 'imported', id: drink.id });
      } catch (error) {
        console.error(`Error importing ${product.name}:`, error.message);
        results.push({ name: product.name, status: 'error', error: error.message });
      }
    }

    console.log(`Missing wines import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`);
    
    res.json({
      success: true,
      message: `Missing wines import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`,
      importedCount,
      skippedCount,
      totalProducts: missingWineProducts.length,
      results
    });

  } catch (error) {
    console.error('Error in missing wines import:', error);
    res.status(500).json({ error: 'Failed to import missing wine products', details: error.message });
  }
});

module.exports = router;

