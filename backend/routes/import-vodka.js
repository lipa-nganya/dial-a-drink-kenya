const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

// Comprehensive vodka import based on common vodka brands and Dial a Drink Kenya standards
const vodkaProducts = [
  // Premium Vodka Brands
  {
    name: "Grey Goose Vodka",
    description: "Grey Goose Vodka (ABV 40%), France",
    price: 4500,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 },
      { capacity: "1 Litre", originalPrice: 5500, currentPrice: 5500 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Beluga Gold Line Vodka",
    description: "Beluga Gold Line Vodka (ABV 40%), Russia",
    price: 8500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Ciroc Vodka",
    description: "Ciroc Vodka (ABV 40%), France",
    price: 3500,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 },
      { capacity: "1 Litre", originalPrice: 4200, currentPrice: 4200 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Ketel One Vodka",
    description: "Ketel One Vodka (ABV 40%), Netherlands",
    price: 3200,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 },
      { capacity: "1 Litre", originalPrice: 3800, currentPrice: 3800 }
    ],
    abv: 40.0
  },
  {
    name: "Tito's Handmade Vodka",
    description: "Tito's Handmade Vodka (ABV 40%), USA",
    price: 2800,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 },
      { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 40.0
  },
  {
    name: "Stolichnaya Vodka",
    description: "Stolichnaya Vodka (ABV 40%), Russia",
    price: 2500,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 },
      { capacity: "1 Litre", originalPrice: 3000, currentPrice: 3000 }
    ],
    abv: 40.0
  },
  {
    name: "Skyy Vodka",
    description: "Skyy Vodka (ABV 40%), USA",
    price: 2200,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 },
      { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 40.0
  },
  {
    name: "Finlandia Vodka",
    description: "Finlandia Vodka (ABV 40%), Finland",
    price: 2400,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
      { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
    ],
    abv: 40.0
  },
  {
    name: "Russian Standard Vodka",
    description: "Russian Standard Vodka (ABV 40%), Russia",
    price: 2300,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 },
      { capacity: "1 Litre", originalPrice: 2700, currentPrice: 2700 }
    ],
    abv: 40.0
  },
  {
    name: "Svedka Vodka",
    description: "Svedka Vodka (ABV 40%), Sweden",
    price: 2100,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 },
      { capacity: "1 Litre", originalPrice: 2500, currentPrice: 2500 }
    ],
    abv: 40.0
  },
  {
    name: "New Amsterdam Vodka",
    description: "New Amsterdam Vodka (ABV 40%), USA",
    price: 2000,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 },
      { capacity: "1 Litre", originalPrice: 2400, currentPrice: 2400 }
    ],
    abv: 40.0
  },
  {
    name: "Burnett's Vodka",
    description: "Burnett's Vodka (ABV 40%), USA",
    price: 1800,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 },
      { capacity: "1 Litre", originalPrice: 2200, currentPrice: 2200 }
    ],
    abv: 40.0
  },
  {
    name: "Popov Vodka",
    description: "Popov Vodka (ABV 40%), USA",
    price: 1600,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1600, currentPrice: 1600 },
      { capacity: "1 Litre", originalPrice: 2000, currentPrice: 2000 }
    ],
    abv: 40.0
  },
  {
    name: "Sobieski Vodka",
    description: "Sobieski Vodka (ABV 40%), Poland",
    price: 1900,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 },
      { capacity: "1 Litre", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 40.0
  },
  {
    name: "Luksusowa Vodka",
    description: "Luksusowa Vodka (ABV 40%), Poland",
    price: 1700,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1700, currentPrice: 1700 },
      { capacity: "1 Litre", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 40.0
  },
  {
    name: "Wyborowa Vodka",
    description: "Wyborowa Vodka (ABV 40%), Poland",
    price: 2200,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 },
      { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 40.0
  },
  {
    name: "Zubrowka Vodka",
    description: "Zubrowka Vodka (ABV 40%), Poland",
    price: 2500,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 },
      { capacity: "1 Litre", originalPrice: 3000, currentPrice: 3000 }
    ],
    abv: 40.0
  },
  {
    name: "Belvedere Vodka",
    description: "Belvedere Vodka (ABV 40%), Poland",
    price: 4000,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4000, currentPrice: 4000 },
      { capacity: "1 Litre", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Chopin Vodka",
    description: "Chopin Vodka (ABV 40%), Poland",
    price: 3500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 40.0
  },
  {
    name: "Crystal Head Vodka",
    description: "Crystal Head Vodka (ABV 40%), Canada",
    price: 5500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 5500, currentPrice: 5500 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Hangar 1 Vodka",
    description: "Hangar 1 Vodka (ABV 40%), USA",
    price: 3000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3000, currentPrice: 3000 }
    ],
    abv: 40.0
  },
  {
    name: "Deep Eddy Vodka",
    description: "Deep Eddy Vodka (ABV 35%), USA",
    price: 2200,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 },
      { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 35.0
  },
  {
    name: "Three Olives Vodka",
    description: "Three Olives Vodka (ABV 40%), UK",
    price: 2000,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 },
      { capacity: "1 Litre", originalPrice: 2400, currentPrice: 2400 }
    ],
    abv: 40.0
  },
  {
    name: "UV Vodka",
    description: "UV Vodka (ABV 40%), USA",
    price: 1800,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 },
      { capacity: "1 Litre", originalPrice: 2200, currentPrice: 2200 }
    ],
    abv: 40.0
  },
  {
    name: "Pinnacle Vodka",
    description: "Pinnacle Vodka (ABV 40%), France",
    price: 1900,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 },
      { capacity: "1 Litre", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 40.0
  },
  {
    name: "Monopolowa Vodka",
    description: "Monopolowa Vodka (ABV 40%), Austria",
    price: 1700,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1700, currentPrice: 1700 },
      { capacity: "1 Litre", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 40.0
  },
  {
    name: "Reyka Vodka",
    description: "Reyka Vodka (ABV 40%), Iceland",
    price: 3200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 40.0
  },
  {
    name: "Level Vodka",
    description: "Level Vodka (ABV 40%), USA",
    price: 2600,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 },
      { capacity: "1 Litre", originalPrice: 3000, currentPrice: 3000 }
    ],
    abv: 40.0
  },
  {
    name: "Effen Vodka",
    description: "Effen Vodka (ABV 40%), Netherlands",
    price: 3000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3000, currentPrice: 3000 }
    ],
    abv: 40.0
  },
  {
    name: "Van Gogh Vodka",
    description: "Van Gogh Vodka (ABV 40%), Netherlands",
    price: 2800,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 },
      { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 40.0
  },
  {
    name: "Kauffman Vodka",
    description: "Kauffman Vodka (ABV 40%), Russia",
    price: 4500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 }
    ],
    abv: 40.0
  },
  {
    name: "Reyka Vodka",
    description: "Reyka Vodka (ABV 40%), Iceland",
    price: 3200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 40.0
  }
];

router.post('/import-vodka', async (req, res) => {
  try {
    console.log('Starting vodka import...');
    
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

    for (const product of vodkaProducts) {
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

    console.log(`Vodka import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`);
    
    res.json({
      success: true,
      message: `Vodka import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`,
      importedCount,
      skippedCount,
      totalProducts: vodkaProducts.length,
      results
    });

  } catch (error) {
    console.error('Error in vodka import:', error);
    res.status(500).json({ error: 'Failed to import vodka products', details: error.message });
  }
});

module.exports = router;
