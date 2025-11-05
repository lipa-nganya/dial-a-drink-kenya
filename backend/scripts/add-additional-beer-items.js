const db = require('../models');

async function addAdditionalBeerItems() {
  try {
    console.log('Adding additional beer items to reach 111 total...');

    const beerCategory = await db.Category.findOne({ where: { name: 'Beer' } });
    if (!beerCategory) {
      console.error('Beer category not found!');
      return;
    }
    console.log('Beer category found:', beerCategory.name);

    // Create subcategory for beer
    const [beerSubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Beers', categoryId: beerCategory.id },
      defaults: { description: 'All types of beer', categoryId: beerCategory.id }
    });
    console.log('Beer subcategory found/created:', beerSubCategory.name);

    const additionalBeerProducts = [
      // Additional Tusker varieties
      {
        name: "Tusker Premium Lager",
        description: "Tusker Premium Lager (ABV 4.5%), Kenya",
        price: 1800,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 },
          { capacity: "12 PACK", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 4.5,
        isAvailable: true
      },
      {
        name: "Tusker Special Lager",
        description: "Tusker Special Lager (ABV 5.2%), Kenya",
        price: 1900,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1900, currentPrice: 1900 },
          { capacity: "12 PACK", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 5.2,
        isAvailable: true
      },
      {
        name: "Tusker Dark",
        description: "Tusker Dark (ABV 4.8%), Kenya",
        price: 1850,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1850, currentPrice: 1850 },
          { capacity: "12 PACK", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 4.8,
        isAvailable: true
      },

      // Additional K.O varieties
      {
        name: "K.O Original",
        description: "K.O Original (ABV 8%), Kenya",
        price: 1600,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 8.0,
        isAvailable: true
      },
      {
        name: "K.O Strong",
        description: "K.O Strong (ABV 10%), Kenya",
        price: 1800,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 },
          { capacity: "12 PACK", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 10.0,
        isAvailable: true
      },
      {
        name: "K.O Extra Strong",
        description: "K.O Extra Strong (ABV 12%), Kenya",
        price: 2000,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2000, currentPrice: 2000 },
          { capacity: "12 PACK", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 12.0,
        isAvailable: true
      },

      // Additional Bavaria varieties
      {
        name: "Bavaria 0.0 Lemon",
        description: "Bavaria 0.0 Lemon (ABV 0%), Netherlands",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 200, currentPrice: 200 }
        ],
        abv: 0.0,
        isAvailable: true
      },
      {
        name: "Bavaria 0.0 Grapefruit",
        description: "Bavaria 0.0 Grapefruit (ABV 0%), Netherlands",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 200, currentPrice: 200 }
        ],
        abv: 0.0,
        isAvailable: true
      },
      {
        name: "Bavaria 0.0 Tropical",
        description: "Bavaria 0.0 Tropical (ABV 0%), Netherlands",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 200, currentPrice: 200 }
        ],
        abv: 0.0,
        isAvailable: true
      },

      // Additional Coolberg varieties
      {
        name: "Coolberg Lemon 0.0 Beer",
        description: "Coolberg Lemon 0.0 Beer (ABV 0%), Sweden",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isAvailable: true
      },
      {
        name: "Coolberg Lime 0.0 Beer",
        description: "Coolberg Lime 0.0 Beer (ABV 0%), Sweden",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isAvailable: true
      },
      {
        name: "Coolberg Apple 0.0 Beer",
        description: "Coolberg Apple 0.0 Beer (ABV 0%), Sweden",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isAvailable: true
      },

      // Additional Bila Shaka varieties
      {
        name: "Bila Shaka Original Lager",
        description: "Bila Shaka Original Lager (ABV 4.5%), Kenya",
        price: 1600,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 }
        ],
        abv: 4.5,
        isAvailable: true
      },
      {
        name: "Bila Shaka Wheat Beer",
        description: "Bila Shaka Wheat Beer (ABV 5.2%), Kenya",
        price: 1700,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 5.2,
        isAvailable: true
      },
      {
        name: "Bila Shaka Pilsner",
        description: "Bila Shaka Pilsner (ABV 4.8%), Kenya",
        price: 1650,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1650, currentPrice: 1650 }
        ],
        abv: 4.8,
        isAvailable: true
      },

      // Additional Castle varieties
      {
        name: "Castle Lager",
        description: "Castle Lager (ABV 4.5%), South Africa",
        price: 1600,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 4.5,
        isAvailable: true
      },
      {
        name: "Castle Draught",
        description: "Castle Draught (ABV 4.2%), South Africa",
        price: 1550,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1550, currentPrice: 1550 },
          { capacity: "12 PACK", originalPrice: 2900, currentPrice: 2900 }
        ],
        abv: 4.2,
        isAvailable: true
      },

      // Additional Budweiser varieties
      {
        name: "Budweiser Lager",
        description: "Budweiser Lager (ABV 5%), USA",
        price: 1600,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 5.0,
        isAvailable: true
      },
      {
        name: "Budweiser Light",
        description: "Budweiser Light (ABV 4.2%), USA",
        price: 1550,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1550, currentPrice: 1550 },
          { capacity: "12 PACK", originalPrice: 2900, currentPrice: 2900 }
        ],
        abv: 4.2,
        isAvailable: true
      },

      // Additional Guinness varieties
      {
        name: "Guinness Foreign Extra Stout",
        description: "Guinness Foreign Extra Stout (ABV 7.5%), Ireland",
        price: 2200,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2200, currentPrice: 2200 },
          { capacity: "12 PACK", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 7.5,
        isAvailable: true
      },
      {
        name: "Guinness Draught",
        description: "Guinness Draught (ABV 4.2%), Ireland",
        price: 2000,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2000, currentPrice: 2000 },
          { capacity: "12 PACK", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 4.2,
        isAvailable: true
      },

      // Additional Heineken varieties
      {
        name: "Heineken Lager 330ml",
        description: "Heineken Lager 330ml (ABV 5%), Netherlands",
        price: 2000,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2000, currentPrice: 2000 },
          { capacity: "12 PACK", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 5.0,
        isAvailable: true
      },
      {
        name: "Heineken Light",
        description: "Heineken Light (ABV 3.3%), Netherlands",
        price: 1900,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1900, currentPrice: 1900 },
          { capacity: "12 PACK", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 3.3,
        isAvailable: true
      },

      // Additional Pilsner varieties
      {
        name: "Pilsner Lager 330ml",
        description: "Pilsner Lager 330ml (ABV 4.7%), Kenya",
        price: 1500,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 },
          { capacity: "12 PACK", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 4.7,
        isAvailable: true
      },
      {
        name: "Pilsner Special",
        description: "Pilsner Special (ABV 5.5%), Kenya",
        price: 1700,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 },
          { capacity: "12 PACK", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 5.5,
        isAvailable: true
      },

      // Additional Savanna varieties
      {
        name: "Savanna Dry Cider",
        description: "Savanna Dry Cider (ABV 6%), South Africa",
        price: 2200,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2200, currentPrice: 2200 },
          { capacity: "12 PACK", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 6.0,
        isAvailable: true
      },
      {
        name: "Savanna Light",
        description: "Savanna Light (ABV 4.5%), South Africa",
        price: 2000,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2000, currentPrice: 2000 },
          { capacity: "12 PACK", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 4.5,
        isAvailable: true
      },

      // Additional Snapp varieties
      {
        name: "Snapp Light",
        description: "Snapp Light (ABV 3.5%), Sweden",
        price: 1400,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1400, currentPrice: 1400 },
          { capacity: "12 PACK", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 3.5,
        isAvailable: true
      },
      {
        name: "Snapp Strong",
        description: "Snapp Strong (ABV 6%), Sweden",
        price: 1800,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 },
          { capacity: "12 PACK", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 6.0,
        isAvailable: true
      },

      // Additional Whitecap varieties
      {
        name: "Whitecap Light",
        description: "Whitecap Light (ABV 3.5%), Kenya",
        price: 1600,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 3.5,
        isAvailable: true
      },
      {
        name: "Whitecap Strong",
        description: "Whitecap Strong (ABV 6%), Kenya",
        price: 1900,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1900, currentPrice: 1900 },
          { capacity: "12 PACK", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 6.0,
        isAvailable: true
      },

      // Additional Desperados varieties
      {
        name: "Desperados Verde",
        description: "Desperados Verde (ABV 5.9%), France",
        price: 2300,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2300, currentPrice: 2300 },
          { capacity: "12 PACK", originalPrice: 4400, currentPrice: 4400 }
        ],
        abv: 5.9,
        isAvailable: true
      },
      {
        name: "Desperados Red",
        description: "Desperados Red (ABV 5.9%), France",
        price: 2300,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2300, currentPrice: 2300 },
          { capacity: "12 PACK", originalPrice: 4400, currentPrice: 4400 }
        ],
        abv: 5.9,
        isAvailable: true
      },

      // Additional Smirnoff Ice varieties
      {
        name: "Smirnoff Ice Original",
        description: "Smirnoff Ice Original (ABV 5%), Russia",
        price: 1500,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 },
          { capacity: "12 PACK", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 5.0,
        isAvailable: true
      },
      {
        name: "Smirnoff Ice Red",
        description: "Smirnoff Ice Red (ABV 5%), Russia",
        price: 1500,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 },
          { capacity: "12 PACK", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 5.0,
        isAvailable: true
      },
      {
        name: "Smirnoff Ice Green",
        description: "Smirnoff Ice Green (ABV 5%), Russia",
        price: 1500,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 },
          { capacity: "12 PACK", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 5.0,
        isAvailable: true
      },

      // Additional Balozi varieties
      {
        name: "Balozi Lager",
        description: "Balozi Lager (ABV 4.2%), Kenya",
        price: 1400,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1400, currentPrice: 1400 },
          { capacity: "12 PACK", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 4.2,
        isAvailable: true
      },
      {
        name: "Balozi Light",
        description: "Balozi Light (ABV 3.5%), Kenya",
        price: 1300,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1300, currentPrice: 1300 },
          { capacity: "12 PACK", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 3.5,
        isAvailable: true
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of additionalBeerProducts) {
      const existingDrink = await db.Drink.findOne({ 
        where: { 
          name: product.name, 
          categoryId: beerCategory.id 
        } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${product.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        originalPrice: product.price.toString(),
        categoryId: beerCategory.id,
        subCategoryId: beerSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacityPricing,
        abv: product.abv,
        isAvailable: product.isAvailable,
        isPopular: product.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      console.log(`Added beer: ${drink.name} - KES ${drink.price} (Available: ${drink.isAvailable})`);
      addedCount++;
    }

    console.log(`\nCompleted adding additional beer items:\n- Added: ${addedCount}\n- Skipped: ${skippedCount}\n- Total processed: ${additionalBeerProducts.length}`);

  } catch (error) {
    console.error('Error adding additional beer items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addAdditionalBeerItems();

