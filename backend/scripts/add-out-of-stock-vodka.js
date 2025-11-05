const db = require('../models');

async function addOutOfStockVodka() {
  try {
    console.log('Adding out-of-stock vodka from Dial a Drink Kenya website...');

    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }
    console.log('Vodka category found:', vodkaCategory.name);

    const allVodkaSubCategory = await db.SubCategory.findOne({ 
      where: { name: 'All Vodka', categoryId: vodkaCategory.id } 
    });
    if (!allVodkaSubCategory) {
      console.error('All Vodka subcategory not found!');
      return;
    }
    console.log('All Vodka subcategory found:', allVodkaSubCategory.name);

    // Out-of-stock vodka from the actual Dial a Drink Kenya website
    const outOfStockVodka = [
      {
        name: "Magic Moments Orange",
        description: "Magic Moments Orange Vodka (ABV 37.5%), India",
        price: 1595,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1595, currentPrice: 1595 }
        ],
        abv: 37.5,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Absolut Watkins",
        description: "Absolut Watkins Vodka (ABV 40%), Sweden",
        price: 2500,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Jumping Goat Vodka Liqueur",
        description: "Jumping Goat Vodka Liqueur (ABV 20%), South Africa",
        price: 4000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 4000, currentPrice: 4000 }
        ],
        abv: 20.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Amsterdam Vodka",
        description: "Amsterdam Vodka (ABV 40%), Netherlands",
        price: 1500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Luksusowa Vodka",
        description: "Luksusowa Vodka (ABV 40%), Poland",
        price: 1200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1200, currentPrice: 1200 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const vodka of outOfStockVodka) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: vodka.name, categoryId: vodkaCategory.id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${vodka.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: vodka.name,
        description: vodka.description,
        price: vodka.price.toString(),
        originalPrice: vodka.price.toString(),
        categoryId: vodkaCategory.id,
        subCategoryId: allVodkaSubCategory.id,
        capacity: vodka.capacity,
        capacityPricing: vodka.capacityPricing,
        abv: vodka.abv,
        isAvailable: false, // Explicitly set as out of stock
        isPopular: vodka.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      console.log(`Added out-of-stock vodka: ${vodka.name} - KES ${vodka.price}`);
    }

    console.log(`\nCompleted adding out-of-stock vodka:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${outOfStockVodka.length}`);

  } catch (error) {
    console.error('Error adding out-of-stock vodka:', error);
  } finally {
    await db.sequelize.close();
  }
}

addOutOfStockVodka();

