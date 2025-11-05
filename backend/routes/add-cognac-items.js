const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

const cognacProducts = [
  {
    name: "Martell VS",
    description: "Martell VS (ABV 40%), France",
    price: 5500,
    capacity: ["1 Litre", "700ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 7595, currentPrice: 7595 },
      { capacity: "700ML", originalPrice: 5500, currentPrice: 5500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Courvoisier VS",
    description: "Courvoisier VS (ABV 40%), France",
    price: 5400,
    capacity: ["1 Litre", "750ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 7400, currentPrice: 7400 },
      { capacity: "750ML", originalPrice: 5400, currentPrice: 5400 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Martell Blueswift",
    description: "Martell Blueswift (ABV 40%), France",
    price: 9200,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 9200, currentPrice: 9200 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy VS",
    description: "Hennessy VS (ABV 40%), France",
    price: 5500,
    capacity: ["1 Litre", "700ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 7995, currentPrice: 7995 },
      { capacity: "700ML", originalPrice: 5500, currentPrice: 5500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy VSOP",
    description: "Hennessy VSOP (ABV 40%), France",
    price: 10400,
    capacity: ["1 Litre", "750ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 13500, currentPrice: 13500 },
      { capacity: "750ML", originalPrice: 10400, currentPrice: 10400 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Grand Marnier Raspberry Peach",
    description: "Grand Marnier Raspberry Peach (ABV 40%), France",
    price: 4400,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4400, currentPrice: 4400 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Martell VSOP",
    description: "Martell VSOP (ABV 40%), France",
    price: 8000,
    capacity: ["750ml", "1 Litre"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 8000, currentPrice: 8000 },
      { capacity: "1 Litre", originalPrice: 11200, currentPrice: 11200 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy XO",
    description: "Hennessy XO (ABV 40%), France",
    price: 28500,
    capacity: ["1 Litre", "700ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 35500, currentPrice: 35500 },
      { capacity: "700ML", originalPrice: 28500, currentPrice: 28500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy Paradis",
    description: "Hennessy Paradis (ABV 40%), France",
    price: 285000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 285000, currentPrice: 285000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Napoleon Gold Brandy",
    description: "Napoleon Gold Brandy (ABV 37.5%), France",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 37.5,
    isAvailable: true
  },
  {
    name: "Martel XO",
    description: "Martel XO (ABV 40%), France",
    price: 33000,
    capacity: ["700ML", "1 Litre"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 33000, currentPrice: 33000 },
      { capacity: "1 Litre", originalPrice: 46000, currentPrice: 46000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Remy Martins VSOP",
    description: "Remy Martins VSOP (ABV 40%), France",
    price: 7200,
    capacity: ["1 Litre", "700ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 9785, currentPrice: 9785 },
      { capacity: "700ML", originalPrice: 7200, currentPrice: 7200 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Grand Marnier Nuit Parisienne",
    description: "Grand Marnier Nuit Parisienne (ABV 40%), France",
    price: 5900,
    capacity: ["750ml"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 5900, currentPrice: 5900 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Remy Martin Louis XIII",
    description: "Remy Martin Louis XIII (ABV 40%), France",
    price: 482000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 482000, currentPrice: 482000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Henri IV Dudognon Heritage Cognac Grade Champagne",
    description: "Henri IV Dudognon Heritage Cognac Grade Champagne (ABV 41%), France",
    price: 2000000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2000000, currentPrice: 2000000 }
    ],
    abv: 41.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Dusse VSOP Cognac",
    description: "Dusse VSOP Cognac (ABV 40%), France",
    price: 11200,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 11200, currentPrice: 11200 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Courvoisier XO",
    description: "Courvoisier XO (ABV 40%), France",
    price: 26000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 26000, currentPrice: 26000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy James Cognac",
    description: "Hennessy James Cognac (ABV 40%), France",
    price: 39500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 39500, currentPrice: 39500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Martell Cordon Blue",
    description: "Martell Cordon Blue (ABV 40%), France",
    price: 24700,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 24700, currentPrice: 24700 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "KWV Brandy 10 years",
    description: "KWV Brandy 10 years (ABV 38%), South Africa",
    price: 3700,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3700, currentPrice: 3700 }
    ],
    abv: 38.0,
    isAvailable: true
  },
  {
    name: "Hine Rare VSOP",
    description: "Hine Rare VSOP (ABV 40%), France",
    price: 10400,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 10400, currentPrice: 10400 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Moet & Chandon Imperial Rose",
    description: "Moet & Chandon Imperial Rose (ABV 12%), France",
    price: 13500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 13500, currentPrice: 13500 }
    ],
    abv: 12.0,
    isAvailable: true
  },
  {
    name: "Courvoisier VSOP",
    description: "Courvoisier VSOP (ABV 40%), France",
    price: 7200,
    capacity: ["1 Litre", "750ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 7800, currentPrice: 7800 },
      { capacity: "750ML", originalPrice: 7200, currentPrice: 7200 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Remy Martin's XO",
    description: "Remy Martin's XO (ABV 40%), France",
    price: 28000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 28000, currentPrice: 28000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Grand Marnier",
    description: "Grand Marnier (ABV 40%), France",
    price: 4200,
    capacity: ["1 Litre", "700ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 4600, currentPrice: 4600 },
      { capacity: "700ML", originalPrice: 4200, currentPrice: 4200 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Camus VSOP",
    description: "Camus VSOP (ABV 40%), France",
    price: 7200,
    capacity: ["750ml", "1 Litre"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 7200, currentPrice: 7200 },
      { capacity: "1 Litre", originalPrice: 8400, currentPrice: 8400 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "JP Chenet French Brandy XO",
    description: "JP Chenet French Brandy XO (ABV 36%), France",
    price: 3500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 36.0,
    isAvailable: true
  },
  {
    name: "Camus VS",
    description: "Camus VS (ABV 40%), France",
    price: 5400,
    capacity: ["1 Litre", "750ML"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 6400, currentPrice: 6400 },
      { capacity: "750ML", originalPrice: 5400, currentPrice: 5400 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Camus XO",
    description: "Camus XO (ABV 40%), France",
    price: 34800,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 34800, currentPrice: 34800 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "St Rhys Napoleon Brandy",
    description: "St Rhys Napoleon Brandy (ABV 40%), France",
    price: 2500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 2500, currentPrice: 2500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "KWV brandy 12 years",
    description: "KWV brandy 12 years (ABV 38%), South Africa",
    price: 6300,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 6300, currentPrice: 6300 }
    ],
    abv: 38.0,
    isAvailable: true
  },
  {
    name: "KWV XO",
    description: "KWV XO (ABV 40%), South Africa",
    price: 14800,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 14800, currentPrice: 14800 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy Pure White",
    description: "Hennessy Pure White (ABV 40%), France",
    price: 20000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 20000, currentPrice: 20000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Remy Martin 1738 Accord Royal",
    description: "Remy Martin 1738 Accord Royal (ABV 40%), France",
    price: 12300,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 12300, currentPrice: 12300 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Raynal Vsop Brandy",
    description: "Raynal Vsop Brandy (ABV 40%), France",
    price: 3500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy Master Blender's Selection No.4",
    description: "Hennessy Master Blender's Selection No.4 (ABV 43%), France",
    price: 7500,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 7500, currentPrice: 7500 }
    ],
    abv: 43.0,
    isAvailable: true
  },
  {
    name: "Camus Borderies",
    description: "Camus Borderies (ABV 40%), France",
    price: 25000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 25000, currentPrice: 25000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Meukow X.O",
    description: "Meukow X.O (ABV 40%), France",
    price: 18000,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 18000, currentPrice: 18000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Gautier XO Gold & Blue Cognac",
    description: "Gautier XO Gold & Blue Cognac (ABV 40%), France",
    price: 19000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 19000, currentPrice: 19000 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Godet XO",
    description: "Godet XO (ABV 40%), France",
    price: 19500,
    capacity: ["750ml"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 19500, currentPrice: 19500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "De Luze VS Cognac",
    description: "De Luze VS Cognac (ABV 40%), France",
    price: 5700,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 5700, currentPrice: 5700 }
    ],
    abv: 40.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Biscut Cognac VS",
    description: "Biscut Cognac VS (ABV 40%), France",
    price: 4500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 4500, currentPrice: 4500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Biscut XO",
    description: "Biscut XO (ABV 40%), France",
    price: 16500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 16500, currentPrice: 16500 }
    ],
    abv: 40.0,
    isAvailable: true
  },
  {
    name: "Hennessy Black",
    description: "Hennessy Black (ABV 43%), France",
    price: 11500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 11500, currentPrice: 11500 }
    ],
    abv: 43.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Meukow VSOP",
    description: "Meukow VSOP (ABV 40%), France",
    price: 4400,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 4400, currentPrice: 4400 }
    ],
    abv: 40.0,
    isAvailable: false // Sold out on website
  }
];

router.post('/add-cognac-items', async (req, res) => {
  try {
    console.log('Adding cognac items from Dial a Drink Kenya website...');

    const cognacCategory = await Category.findOne({ where: { name: 'Cognac' } });
    if (!cognacCategory) {
      return res.status(404).json({ success: false, message: 'Cognac category not found' });
    }

    // Create subcategory for cognac
    const [cognacSubCategory] = await SubCategory.findOrCreate({
      where: { name: 'All Cognac', categoryId: cognacCategory.id },
      defaults: { description: 'All types of cognac', categoryId: cognacCategory.id }
    });

    let addedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of cognacProducts) {
      const existingDrink = await Drink.findOne({ 
        where: { 
          name: product.name, 
          categoryId: cognacCategory.id 
        } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${product.name} - already exists`);
        skippedCount++;
        results.push({ name: product.name, status: "skipped", reason: "already exists" });
        continue;
      }

      const drink = await Drink.create({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        originalPrice: product.price.toString(),
        categoryId: cognacCategory.id,
        subCategoryId: cognacSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacityPricing,
        abv: product.abv,
        isAvailable: product.isAvailable,
        isPopular: product.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      console.log(`Added cognac: ${drink.name} - KES ${drink.price} (Available: ${drink.isAvailable})`);
      addedCount++;
      results.push({ name: product.name, status: "added", id: drink.id });
    }

    res.status(200).json({
      success: true,
      message: `Cognac import completed. Added: ${addedCount}, Skipped: ${skippedCount}`,
      addedCount,
      skippedCount,
      totalProducts: cognacProducts.length,
      results
    });

  } catch (error) {
    console.error('Error adding cognac items:', error);
    res.status(500).json({ success: false, message: 'Failed to add cognac items', error: error.message });
  }
});

module.exports = router;

