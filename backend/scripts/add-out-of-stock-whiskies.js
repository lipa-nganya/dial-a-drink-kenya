const db = require('../models');

async function addOutOfStockWhiskies() {
  try {
    console.log('Adding out-of-stock whiskies from Dial a Drink Kenya website...');

    const whiskyCategory = await db.Category.findOne({ where: { name: 'Whisky' } });
    if (!whiskyCategory) {
      console.error('Whisky category not found!');
      return;
    }
    console.log('Whisky category found:', whiskyCategory.name);

    const allWhiskiesSubCategory = await db.SubCategory.findOne({ 
      where: { name: 'All Whiskies', categoryId: whiskyCategory.id } 
    });
    if (!allWhiskiesSubCategory) {
      console.error('All Whiskies subcategory not found!');
      return;
    }
    console.log('All Whiskies subcategory found:', allWhiskiesSubCategory.name);

    // Out-of-stock whiskies from the actual Dial a Drink Kenya website
    const outOfStockWhiskies = [
      {
        name: "Johnnie Walker Blonde",
        description: "Johnnie Walker Blonde (ABV 40%), Scotland",
        price: 4800,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 4800, currentPrice: 4800 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Jack Daniel 700ml Corkless",
        description: "Jack Daniel 700ml Corkless (ABV 40%), United States",
        price: 3400,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Sexton Single Malt",
        description: "Sexton Single Malt (ABV 40%), Ireland",
        price: 5400,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 5400, currentPrice: 5400 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Old Forester Signature Bourbon",
        description: "Old Forester Signature Bourbon (ABV 43%), America",
        price: 4600,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 4600, currentPrice: 4600 }
        ],
        abv: 43.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Oban Little Bay",
        description: "Oban Little Bay (ABV 43%), Scotland",
        price: 10500,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 10500, currentPrice: 10500 }
        ],
        abv: 43.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Laphroaig Px Cask",
        description: "Laphroaig Px Cask (ABV 48%), Scotland",
        price: 9900,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 9900, currentPrice: 9900 }
        ],
        abv: 48.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const whisky of outOfStockWhiskies) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: whisky.name, categoryId: whiskyCategory.id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${whisky.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: whisky.name,
        description: whisky.description,
        price: whisky.price.toString(),
        originalPrice: whisky.price.toString(),
        categoryId: whiskyCategory.id,
        subCategoryId: allWhiskiesSubCategory.id,
        capacity: whisky.capacity,
        capacityPricing: whisky.capacityPricing,
        abv: whisky.abv,
        isAvailable: false, // Explicitly set as out of stock
        isPopular: whisky.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      console.log(`Added out-of-stock whisky: ${whisky.name} - KES ${whisky.price}`);
    }

    console.log(`\nCompleted adding out-of-stock whiskies:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${outOfStockWhiskies.length}`);

  } catch (error) {
    console.error('Error adding out-of-stock whiskies:', error);
  } finally {
    await db.sequelize.close();
  }
}

addOutOfStockWhiskies();

