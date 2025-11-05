const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

// Comprehensive whiskey import based on Dial a Drink Kenya website
const whiskeyProducts = [
  // Glenfiddich Collection
  {
    name: "Glenfiddich 12 Years",
    description: "Glenfiddich 12 Years (ABV 40%), Scotland",
    price: 6500,
    capacity: ["750ml"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 6500, currentPrice: 6500 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Glenfiddich 18 Years Old Scotch Whiskey",
    description: "Glenfiddich 18 Years Old Scotch Whiskey (ABV 40%), Scotland",
    price: 19500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 19500, currentPrice: 19500 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Glenfiddich Fire & Cane",
    description: "Glenfiddich Fire & Cane (ABV 43%), Scotland",
    price: 6499,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 6499, currentPrice: 6499 }
    ],
    abv: 43.0
  },
  {
    name: "Glenfiddich Triple Oak 12 Years",
    description: "Glenfiddich Triple Oak 12 Years (ABV 40%), Scotland",
    price: 6500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 6500, currentPrice: 6500 }
    ],
    abv: 40.0
  },

  // Johnnie Walker Collection
  {
    name: "Johnnie Walker Red Label",
    description: "Johnnie Walker Red Label (ABV 40%), Scotland",
    price: 2200,
    capacity: ["750ml", "1 Litre"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 2200, currentPrice: 2200 },
      { capacity: "1 Litre", originalPrice: 2495, currentPrice: 2495 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Johnnie Walker Green Label",
    description: "Johnnie Walker Green Label (ABV 40%), Scotland",
    price: 7495,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 7495, currentPrice: 7495 }
    ],
    abv: 40.0
  },
  {
    name: "Johnnie Walker Double Black",
    description: "Johnnie Walker Double Black (ABV 40%), Scotland",
    price: 5800,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 5800, currentPrice: 5800 },
      { capacity: "1 Litre", originalPrice: 5995, currentPrice: 5995 }
    ],
    abv: 40.0
  },
  {
    name: "Johnnie Walker Blonde",
    description: "Johnnie Walker Blonde (ABV 40%), Scotland",
    price: 4800,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 40.0
  },
  {
    name: "Johnnie Walker Ultimate 18 Years",
    description: "Johnnie Walker Ultimate 18 Years (ABV 40%), Scotland",
    price: 18500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 18500, currentPrice: 18500 }
    ],
    abv: 40.0
  },

  // Jameson Collection
  {
    name: "Jameson Black Barrel",
    description: "Jameson Black Barrel (ABV 40%), Ireland",
    price: 4495,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 4495, currentPrice: 4495 }
    ],
    abv: 40.0
  },

  // Jack Daniel's Collection
  {
    name: "Jack Daniel's Honey",
    description: "Jack Daniel's Honey (ABV 40%), United States",
    price: 4000,
    capacity: ["700ML", "1 Litre"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 4000, currentPrice: 4000 },
      { capacity: "1 Litre", originalPrice: 4500, currentPrice: 4500 }
    ],
    abv: 40.0
  },

  // Chivas Regal Collection
  {
    name: "Chivas Regal 12 Years",
    description: "Chivas Regal 12 Years (ABV 40%), Scotland",
    price: 3799,
    capacity: ["750ml", "1 Litre"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 3799, currentPrice: 3799 },
      { capacity: "1 Litre", originalPrice: 4900, currentPrice: 4900 }
    ],
    abv: 40.0,
    isPopular: true
  },
  {
    name: "Chivas Regal Ultis",
    description: "Chivas Regal Ultis (ABV 40%), Scotland",
    price: 32000,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 32000, currentPrice: 32000 },
      { capacity: "1 Litre", originalPrice: 35000, currentPrice: 35000 }
    ],
    abv: 40.0
  },

  // Ballantine's Collection
  {
    name: "Ballantine's",
    description: "Ballantine's (ABV 40%), Scotland",
    price: 2600,
    capacity: ["750ml", "1 Litre"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 2600, currentPrice: 2600 },
      { capacity: "1 Litre", originalPrice: 2595, currentPrice: 2595 }
    ],
    abv: 40.0
  },

  // Grant's Collection
  {
    name: "Grant's 12 Years Triplewood",
    description: "Grant's 12 Years Triplewood (ABV 40%), Scotland",
    price: 4800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 40.0
  },
  {
    name: "Grant's 25 Years",
    description: "Grant's 25 Years (ABV 40%), Scotland",
    price: 28000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 28000, currentPrice: 28000 }
    ],
    abv: 40.0
  },

  // Famous Grouse
  {
    name: "Famous Grouse",
    description: "Famous Grouse (ABV 40%), Scotland",
    price: 2299,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2299, currentPrice: 2299 },
      { capacity: "1 Litre", originalPrice: 2499, currentPrice: 2499 }
    ],
    abv: 40.0
  },

  // Japanese Whiskey Collection
  {
    name: "Suntory Kakubin",
    description: "Suntory Kakubin (ABV 40%), Japan",
    price: 7999,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 7999, currentPrice: 7999 }
    ],
    abv: 40.0
  },
  {
    name: "Nikka Rare Old Super",
    description: "Nikka Rare Old Super (ABV 43%), Japan",
    price: 7000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 7000, currentPrice: 7000 }
    ],
    abv: 43.0
  },
  {
    name: "Kura Pure Malt",
    description: "Kura Pure Malt (ABV 43%), Japan",
    price: 12300,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 12300, currentPrice: 12300 }
    ],
    abv: 43.0
  },
  {
    name: "Chita Suntory Whisky",
    description: "Chita Suntory Whisky (ABV 43%), Japan",
    price: 21600,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 21600, currentPrice: 21600 }
    ],
    abv: 43.0
  },
  {
    name: "Kurayoshi Pure Malt",
    description: "Kurayoshi Pure Malt (ABV 43%), Japan",
    price: 17499,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 17499, currentPrice: 17499 }
    ],
    abv: 43.0
  },
  {
    name: "Hakushu Distillers Reserve",
    description: "Hakushu Distillers Reserve (ABV 43%), Japan",
    price: 14999,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 14999, currentPrice: 14999 }
    ],
    abv: 43.0
  },
  {
    name: "Kurayoshi Sherry Cask",
    description: "Kurayoshi Sherry Cask (ABV 43%), Japan",
    price: 18499,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 18499, currentPrice: 18499 }
    ],
    abv: 43.0
  },
  {
    name: "Hombo Iwai Tradition Premium Whisky",
    description: "Hombo Iwai Tradition Premium Whisky (ABV 40%), Japan",
    price: 4800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 40.0
  },
  {
    name: "Hombo Iwai Premium Whisky",
    description: "Hombo Iwai Premium Whisky (ABV 40%), Japan",
    price: 5800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 5800, currentPrice: 5800 }
    ],
    abv: 40.0
  },
  {
    name: "Nikka Coffey Malt Whisky",
    description: "Nikka Coffey Malt Whisky (ABV 45%), Japan",
    price: 12500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 12500, currentPrice: 12500 }
    ],
    abv: 45.0
  },

  // Irish Whiskey Collection
  {
    name: "Proper No.Twelve Whisky",
    description: "Proper No.Twelve Whisky (ABV 40%), Ireland",
    price: 6800,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 6800, currentPrice: 6800 }
    ],
    abv: 40.0
  },
  {
    name: "Sexton Single Malt",
    description: "Sexton Single Malt (ABV 40%), Ireland",
    price: 6800,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 6800, currentPrice: 6800 }
    ],
    abv: 40.0
  },
  {
    name: "Bushmills Black Bush",
    description: "Bushmills Black Bush (ABV 40%), Ireland",
    price: 4000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4000, currentPrice: 4000 }
    ],
    abv: 40.0
  },

  // Premium Scotch Collection
  {
    name: "Royal Salute 21 Years Sapphire Flagon",
    description: "Royal Salute 21 Years Sapphire Flagon (ABV 40%), Scotland",
    price: 21500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 21500, currentPrice: 21500 }
    ],
    abv: 40.0
  },
  {
    name: "Glenmorangie The Tribute 16 Years",
    description: "Glenmorangie The Tribute 16 Years (ABV 43%), Scotland",
    price: 19500,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 19500, currentPrice: 19500 }
    ],
    abv: 43.0
  },
  {
    name: "Buchanan's 18 Years Special Reserve",
    description: "Buchanan's 18 Years Special Reserve (ABV 40%), Scotland",
    price: 11800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 11800, currentPrice: 11800 }
    ],
    abv: 40.0
  },
  {
    name: "Jura 12 Years Old",
    description: "Jura 12 Years Old (ABV 40%), Scotland",
    price: 10000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 10000, currentPrice: 10000 }
    ],
    abv: 40.0
  },
  {
    name: "Lagavulin 12 Years",
    description: "Lagavulin 12 Years (ABV 56.4%), Scotland",
    price: 10800,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 10800, currentPrice: 10800 }
    ],
    abv: 56.4
  },
  {
    name: "Highland Park Valfather",
    description: "Highland Park Valfather (ABV 47%), Scotland",
    price: 8500,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
    ],
    abv: 47.0
  },
  {
    name: "Glenlivet Captain Reserve",
    description: "Glenlivet Captain Reserve (ABV 40%), Scotland",
    price: 8400,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 8400, currentPrice: 8400 }
    ],
    abv: 40.0
  },
  {
    name: "Glen Deveron 28 Years Whisky",
    description: "Glen Deveron 28 Years Whisky (ABV 40%), Scotland",
    price: 43899,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 43899, currentPrice: 43899 }
    ],
    abv: 40.0
  },
  {
    name: "Dalmore Valour",
    description: "Dalmore Valour (ABV 40%), Scotland",
    price: 14800,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 14800, currentPrice: 14800 }
    ],
    abv: 40.0
  },
  {
    name: "Dalmore Port Wood Reserve",
    description: "Dalmore Port Wood Reserve (ABV 46.5%), Scotland",
    price: 17000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 17000, currentPrice: 17000 }
    ],
    abv: 46.5
  },
  {
    name: "Macallan A Night on Earth",
    description: "Macallan A Night on Earth (ABV 43%), Scotland",
    price: 24200,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 24200, currentPrice: 24200 }
    ],
    abv: 43.0
  },
  {
    name: "Macallan Estate Single Malt",
    description: "Macallan Estate Single Malt (ABV 43%), Scotland",
    price: 39700,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 39700, currentPrice: 39700 }
    ],
    abv: 43.0
  },
  {
    name: "Glenlivet 15 Years",
    description: "Glenlivet 15 Years (ABV 40%), Scotland",
    price: 10800,
    capacity: ["700ML", "1 Litre"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 10800, currentPrice: 10800 },
      { capacity: "1 Litre", originalPrice: 13300, currentPrice: 13300 }
    ],
    abv: 40.0
  },
  {
    name: "Bunnahbhain 12 Years",
    description: "Bunnahbhain 12 Years (ABV 40%), Scotland",
    price: 9900,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 9900, currentPrice: 9900 }
    ],
    abv: 40.0
  },
  {
    name: "Shackleton Blended Malt",
    description: "Shackleton Blended Malt (ABV 40%), United Kingdom",
    price: 5200,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 5200, currentPrice: 5200 }
    ],
    abv: 40.0
  },
  {
    name: "King George V",
    description: "King George V (ABV 43%), Scotland",
    price: 67000,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 67000, currentPrice: 67000 }
    ],
    abv: 43.0
  },

  // Indian Whiskey Collection
  {
    name: "8PM Indian Whisky",
    description: "8PM Indian Whisky (ABV 42.8%), India",
    price: 1800,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 42.8
  },
  {
    name: "Rampur Single Malt Whisky",
    description: "Rampur Single Malt Whisky (ABV 45%), India",
    price: 7800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 7800, currentPrice: 7800 }
    ],
    abv: 45.0
  },
  {
    name: "All Seasons Whiskey",
    description: "All Seasons Whiskey (ABV 42.8%), India",
    price: 1600,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1600, currentPrice: 1600 },
      { capacity: "1 Litre", originalPrice: 1900, currentPrice: 1900 }
    ],
    abv: 42.8
  },
  {
    name: "Whytehall Fire",
    description: "Whytehall Fire (ABV 40%), India",
    price: 1800,
    capacity: ["750ml"],
    capacityPricing: [
      { capacity: "750ml", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 40.0
  },

  // American Whiskey Collection
  {
    name: "Benchmark Old No.8",
    description: "Benchmark Old No.8 (ABV 40%), America",
    price: 2600,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 40.0
  },
  {
    name: "Fireball Cinnamon Whisky",
    description: "Fireball Cinnamon Whisky",
    price: 3700,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 3700, currentPrice: 3700 }
    ],
    abv: null
  },

  // Other Premium Brands
  {
    name: "William Lawson's",
    description: "William Lawson's (ABV 40%), Scotland",
    price: 2400,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
      { capacity: "1 Litre", originalPrice: 2700, currentPrice: 2700 }
    ],
    abv: 40.0
  },
  {
    name: "Dalwhinnie Malt Winters Gold",
    description: "Dalwhinnie Malt Winters Gold (ABV 43%), Scotland",
    price: 8300,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 8300, currentPrice: 8300 }
    ],
    abv: 43.0
  },
  {
    name: "Clynelish Reserve Game of Thrones",
    description: "Clynelish Reserve Game of Thrones (ABV 51.2%), Scotland",
    price: 19999,
    capacity: ["700ML"],
    capacityPricing: [
      { capacity: "700ML", originalPrice: 19999, currentPrice: 19999 }
    ],
    abv: 51.2
  },
  {
    name: "Glenlivet White Oak Triple Cask Reserve",
    description: "Glenlivet White Oak Triple Cask Reserve (ABV 40%), Scotland",
    price: 8200,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 8200, currentPrice: 8200 }
    ],
    abv: 40.0
  },
  {
    name: "Isabella Islay Whisky",
    description: "Isabella Islay Whisky (ABV 40%), Scotland",
    price: 800600000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 800600000, currentPrice: 800600000 }
    ],
    abv: 40.0
  },
  {
    name: "VAT 69",
    description: "VAT 69 (ABV 40%), Scotland",
    price: 1950,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1950, currentPrice: 1950 },
      { capacity: "1 Litre", originalPrice: 2200, currentPrice: 2200 }
    ],
    abv: 40.0
  },
  {
    name: "John Barr Red",
    description: "John Barr Red (ABV 40%), Scotland",
    price: 2300,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 40.0
  },
  {
    name: "Glendale Whisky",
    description: "Glendale Whisky (ABV 43%), Scotland",
    price: 3200,
    capacity: ["750ML", "1 Litre"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 },
      { capacity: "1 Litre", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 43.0
  },
  {
    name: "High Commissioner Whisky",
    description: "High Commissioner Whisky (ABV 40%), Scotland",
    price: 2100,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 40.0
  },
  {
    name: "Best Whisky",
    description: "Best Whisky (ABV 42.8%), Scotland",
    price: 1495,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1495, currentPrice: 1495 }
    ],
    abv: 42.8
  },

  // Sake (Japanese)
  {
    name: "Kawashima Ginjo Sake",
    description: "Kawashima Ginjo Sake (ABV 15%), Japan",
    price: 4800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 15.0
  }
];

router.post('/import-whiskey', async (req, res) => {
  try {
    console.log('Starting whiskey import...');
    
    // Get the Whisky category
    const whiskyCategory = await Category.findOne({ where: { name: 'Whisky' } });
    if (!whiskyCategory) {
      return res.status(404).json({ error: 'Whisky category not found' });
    }

    // Get or create the "All Whiskies" subcategory
    let subCategory = await SubCategory.findOne({ 
      where: { name: 'All Whiskies', categoryId: whiskyCategory.id } 
    });
    
    if (!subCategory) {
      subCategory = await SubCategory.create({
        name: 'All Whiskies',
        categoryId: whiskyCategory.id,
        isActive: true
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of whiskeyProducts) {
      try {
        // Check if product already exists
        const existingDrink = await Drink.findOne({
          where: {
            name: product.name,
            categoryId: whiskyCategory.id
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
          categoryId: whiskyCategory.id,
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

    console.log(`Whiskey import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`);
    
    res.json({
      success: true,
      message: `Whiskey import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`,
      importedCount,
      skippedCount,
      totalProducts: whiskeyProducts.length,
      results
    });

  } catch (error) {
    console.error('Error in whiskey import:', error);
    res.status(500).json({ error: 'Failed to import whiskey products', details: error.message });
  }
});

module.exports = router;

