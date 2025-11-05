const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

// Vodka products that are actually on the Dial a Drink Kenya website
const dialadrinkVodkaProducts = [
  {
    name: "Elite Vodka",
    description: "Elite Vodka (ABV 40%), Russia",
    price: 2500,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 },
      { capacity: "1 Litre", originalPrice: 3000, currentPrice: 3000 }
    ],
    abv: 40.0
  },
  {
    name: "Flirt Vodka Unflavoured",
    description: "Flirt Vodka Unflavoured (ABV 40%), Bulgaria",
    price: 2200,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 },
      { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 40.0
  },
  {
    name: "Flirt Vodka Strawberry",
    description: "Flirt Vodka Strawberry (ABV 40%), Bulgaria",
    price: 2400,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
      { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
    ],
    abv: 40.0
  },
  {
    name: "Haku Vodka",
    description: "Haku Vodka (ABV 40%), Japan",
    price: 3500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 40.0
  },
  {
    name: "Bols Vanilla Vodka",
    description: "Bols Vanilla Vodka (ABV 40%), Netherlands",
    price: 2800,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 },
      { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 40.0
  }
];

router.post('/import-dialadrink-vodka', async (req, res) => {
  try {
    console.log('Starting Dial a Drink vodka import...');
    
    // Get the Vodka category
    const vodkaCategory = await Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      return res.status(404).json({ error: 'Vodka category not found' });
    }

    // Get or create the "All Vodka" subcategory
    let subCategory = await SubCategory.findOne({ 
      where: { name: 'All Vodka', categoryId: vodkaCategory.id } 
    });
    
    if (!subCategory) {
      subCategory = await SubCategory.create({
        name: 'All Vodka',
        categoryId: vodkaCategory.id,
        isActive: true
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of dialadrinkVodkaProducts) {
      try {
        // Check if product already exists
        const existingDrink = await Drink.findOne({
          where: {
            name: product.name,
            categoryId: vodkaCategory.id
          }
        });

        if (existingDrink) {
          console.log(`Skipping existing product: ${product.name}`);
          skippedCount++;
          results.push({ name: product.name, status: 'skipped', reason: 'already exists' });
          continue;
        }

        // Create the drink
        const drink = await Drink.create({
          name: product.name,
          description: product.description,
          price: product.price.toString(),
          originalPrice: product.price.toString(),
          categoryId: vodkaCategory.id,
          subCategoryId: subCategory.id,
          capacity: product.capacity,
          capacityPricing: product.capacityPricing,
          abv: product.abv,
          isAvailable: true,
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

    console.log(`Dial a Drink vodka import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`);
    
    res.json({
      success: true,
      message: `Dial a Drink vodka import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`,
      importedCount,
      skippedCount,
      totalProducts: dialadrinkVodkaProducts.length,
      results
    });

  } catch (error) {
    console.error('Error in Dial a Drink vodka import:', error);
    res.status(500).json({ error: 'Failed to import Dial a Drink vodka products', details: error.message });
  }
});

module.exports = router;

