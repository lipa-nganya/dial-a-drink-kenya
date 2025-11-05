const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

const outOfStockWhiskyProducts = [
  {
    name: "Macallan 18 Year Old",
    description: "Macallan 18 Year Old Single Malt Scotch Whisky (ABV 43%), Scotland",
    price: 45000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 45000, currentPrice: 45000 }
    ],
    abv: 43.0,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Johnnie Walker Blue Label",
    description: "Johnnie Walker Blue Label Blended Scotch Whisky (ABV 40%), Scotland",
    price: 25000,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 25000, currentPrice: 25000 },
      { capacity: "1 Litre", originalPrice: 32000, currentPrice: 32000 }
    ],
    abv: 40.0,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Glenfiddich 21 Year Old",
    description: "Glenfiddich 21 Year Old Single Malt Scotch Whisky (ABV 40%), Scotland",
    price: 18000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 18000, currentPrice: 18000 }
    ],
    abv: 40.0,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Lagavulin 16 Year Old",
    description: "Lagavulin 16 Year Old Single Malt Scotch Whisky (ABV 43%), Scotland",
    price: 12000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 12000, currentPrice: 12000 }
    ],
    abv: 43.0,
    isPopular: false,
    isAvailable: false // Out of stock
  },
  {
    name: "Yamazaki 12 Year Old",
    description: "Yamazaki 12 Year Old Single Malt Whisky (ABV 43%), Japan",
    price: 22000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 22000, currentPrice: 22000 }
    ],
    abv: 43.0,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Hibiki 17 Year Old",
    description: "Hibiki 17 Year Old Blended Whisky (ABV 43%), Japan",
    price: 35000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 35000, currentPrice: 35000 }
    ],
    abv: 43.0,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Pappy Van Winkle 15 Year Old",
    description: "Pappy Van Winkle 15 Year Old Bourbon Whiskey (ABV 53.5%), USA",
    price: 55000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 55000, currentPrice: 55000 }
    ],
    abv: 53.5,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Redbreast 21 Year Old",
    description: "Redbreast 21 Year Old Irish Whiskey (ABV 46%), Ireland",
    price: 28000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 28000, currentPrice: 28000 }
    ],
    abv: 46.0,
    isPopular: false,
    isAvailable: false // Out of stock
  },
  {
    name: "Kavalan Solist Vinho Barrique",
    description: "Kavalan Solist Vinho Barrique Single Malt Whisky (ABV 57.8%), Taiwan",
    price: 32000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 32000, currentPrice: 32000 }
    ],
    abv: 57.8,
    isPopular: true,
    isAvailable: false // Out of stock
  },
  {
    name: "Ardbeg Uigeadail",
    description: "Ardbeg Uigeadail Single Malt Scotch Whisky (ABV 54.2%), Scotland",
    price: 8500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
    ],
    abv: 54.2,
    isPopular: false,
    isAvailable: false // Out of stock
  }
];

router.post('/add-out-of-stock-whisky', async (req, res) => {
  try {
    console.log('Adding out-of-stock whisky items...');
    
    const whiskyCategory = await Category.findOne({ where: { name: 'Whisky' } });
    if (!whiskyCategory) {
      return res.status(404).json({ success: false, message: 'Whisky category not found' });
    }

    const allWhiskiesSubCategory = await SubCategory.findOne({ 
      where: { name: 'All Whiskies', categoryId: whiskyCategory.id } 
    });
    if (!allWhiskiesSubCategory) {
      return res.status(404).json({ success: false, message: 'All Whiskies subcategory not found' });
    }

    let addedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of outOfStockWhiskyProducts) {
      const existingDrink = await Drink.findOne({ 
        where: { name: product.name, categoryId: whiskyCategory.id } 
      });
      
      if (existingDrink) {
        results.push({ 
          name: product.name, 
          status: "skipped", 
          reason: "already exists", 
          id: existingDrink.id 
        });
        skippedCount++;
        continue;
      }

      const drink = await Drink.create({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        originalPrice: product.price.toString(),
        categoryId: whiskyCategory.id,
        subCategoryId: allWhiskiesSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacityPricing,
        abv: product.abv,
        isAvailable: false, // Explicitly set as out of stock
        isPopular: product.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      results.push({ name: product.name, status: "added", id: drink.id });
      console.log(`Added out-of-stock whisky: ${product.name} - KES ${product.price}`);
    }

    res.status(200).json({
      success: true,
      message: `Out-of-stock whisky items added successfully`,
      addedCount,
      skippedCount,
      totalProducts: outOfStockWhiskyProducts.length,
      results
    });
  } catch (error) {
    console.error('Error adding out-of-stock whisky items:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add out-of-stock whisky items', 
      error: error.message 
    });
  }
});

module.exports = router;

