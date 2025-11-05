const db = require('../models');

async function addFinalBeerItems() {
  try {
    console.log('Adding final beer items to reach 111 total...');

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

    const finalBeerProducts = [
      // Additional Tusker varieties
      {
        name: "Tusker All Malt",
        description: "Tusker All Malt (ABV 5.5%), Kenya",
        price: 1750,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1750, currentPrice: 1750 },
          { capacity: "12 PACK", originalPrice: 3300, currentPrice: 3300 }
        ],
        abv: 5.5,
        isAvailable: true
      },
      {
        name: "Tusker Export",
        description: "Tusker Export (ABV 4.8%), Kenya",
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
        name: "K.O Classic",
        description: "K.O Classic (ABV 8%), Kenya",
        price: 1550,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1550, currentPrice: 1550 },
          { capacity: "12 PACK", originalPrice: 2900, currentPrice: 2900 }
        ],
        abv: 8.0,
        isAvailable: true
      },
      {
        name: "K.O Premium",
        description: "K.O Premium (ABV 9%), Kenya",
        price: 1900,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1900, currentPrice: 1900 },
          { capacity: "12 PACK", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 9.0,
        isAvailable: true
      },

      // Additional Bavaria varieties
      {
        name: "Bavaria 0.0 Orange",
        description: "Bavaria 0.0 Orange (ABV 0%), Netherlands",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 200, currentPrice: 200 }
        ],
        abv: 0.0,
        isAvailable: true
      },
      {
        name: "Bavaria 0.0 Cherry",
        description: "Bavaria 0.0 Cherry (ABV 0%), Netherlands",
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
        name: "Coolberg Orange 0.0 Beer",
        description: "Coolberg Orange 0.0 Beer (ABV 0%), Sweden",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isAvailable: true
      },
      {
        name: "Coolberg Grapefruit 0.0 Beer",
        description: "Coolberg Grapefruit 0.0 Beer (ABV 0%), Sweden",
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
        name: "Bila Shaka Dark Lager",
        description: "Bila Shaka Dark Lager (ABV 5.5%), Kenya",
        price: 1750,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1750, currentPrice: 1750 }
        ],
        abv: 5.5,
        isAvailable: true
      },
      {
        name: "Bila Shaka Blonde Ale",
        description: "Bila Shaka Blonde Ale (ABV 4.8%), Kenya",
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
        name: "Castle Milk Stout 500ml",
        description: "Castle Milk Stout 500ml (ABV 6%), South Africa",
        price: 350,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 350, currentPrice: 350 }
        ],
        abv: 6.0,
        isAvailable: true
      },

      // Additional Budweiser varieties
      {
        name: "Budweiser Select",
        description: "Budweiser Select (ABV 4.3%), USA",
        price: 1650,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1650, currentPrice: 1650 },
          { capacity: "12 PACK", originalPrice: 3100, currentPrice: 3100 }
        ],
        abv: 4.3,
        isAvailable: true
      },

      // Additional Guinness varieties
      {
        name: "Guinness Original",
        description: "Guinness Original (ABV 4.2%), Ireland",
        price: 2100,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 },
          { capacity: "12 PACK", originalPrice: 4000, currentPrice: 4000 }
        ],
        abv: 4.2,
        isAvailable: true
      },

      // Additional Heineken varieties
      {
        name: "Heineken 0.0",
        description: "Heineken 0.0 (ABV 0%), Netherlands",
        price: 1900,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1900, currentPrice: 1900 },
          { capacity: "12 PACK", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 0.0,
        isAvailable: true
      },

      // Additional Pilsner varieties
      {
        name: "Pilsner Light",
        description: "Pilsner Light (ABV 3.5%), Kenya",
        price: 1400,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1400, currentPrice: 1400 },
          { capacity: "12 PACK", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 3.5,
        isAvailable: true
      },

      // Additional Savanna varieties
      {
        name: "Savanna Dry 500ml",
        description: "Savanna Dry 500ml (ABV 6%), South Africa",
        price: 250,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 250, currentPrice: 250 }
        ],
        abv: 6.0,
        isAvailable: true
      },

      // Additional Snapp varieties
      {
        name: "Snapp Original",
        description: "Snapp Original (ABV 4.5%), Sweden",
        price: 1600,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 4.5,
        isAvailable: true
      },

      // Additional Whitecap varieties
      {
        name: "Whitecap Original",
        description: "Whitecap Original (ABV 4.2%), Kenya",
        price: 1700,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 },
          { capacity: "12 PACK", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 4.2,
        isAvailable: true
      },

      // Additional Desperados varieties
      {
        name: "Desperados Original",
        description: "Desperados Original (ABV 5.9%), France",
        price: 2200,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2200, currentPrice: 2200 },
          { capacity: "12 PACK", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 5.9,
        isAvailable: true
      },

      // Additional Smirnoff Ice varieties
      {
        name: "Smirnoff Ice Blue",
        description: "Smirnoff Ice Blue (ABV 5%), Russia",
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
        name: "Balozi Strong",
        description: "Balozi Strong (ABV 6%), Kenya",
        price: 1600,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 6.0,
        isAvailable: true
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of finalBeerProducts) {
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

    console.log(`\nCompleted adding final beer items:\n- Added: ${addedCount}\n- Skipped: ${skippedCount}\n- Total processed: ${finalBeerProducts.length}`);

  } catch (error) {
    console.error('Error adding final beer items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addFinalBeerItems();

