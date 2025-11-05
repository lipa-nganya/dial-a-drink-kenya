const db = require('../models');

async function addMissingRumItems() {
  try {
    console.log('Adding missing rum items from Dial a Drink Kenya website...');

    const rumCategory = await db.Category.findOne({ where: { name: 'Rum' } });
    if (!rumCategory) {
      console.error('Rum category not found!');
      return;
    }
    console.log('Rum category found:', rumCategory.name);

    // Create subcategory for rum
    const [rumSubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Rum', categoryId: rumCategory.id },
      defaults: { description: 'All types of rum', categoryId: rumCategory.id }
    });
    console.log('Rum subcategory found/created:', rumSubCategory.name);

    const rumProducts = [
      // Premium Rums
      {
        name: "Diplomatico Reserva Exclusiva Rum",
        description: "Diplomatico Reserva Exclusiva Rum (ABV 40%), Venezuela",
        price: 6900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6900, currentPrice: 6900 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bumbu XO Rum",
        description: "Bumbu XO Rum (ABV 40%), Caribbean",
        price: 6700,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 6700, currentPrice: 6700 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Bumbu Cream Liqueur",
        description: "Bumbu Cream Liqueur (ABV 15%), Caribbean",
        price: 6000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 6000, currentPrice: 6000 }
        ],
        abv: 15.0,
        isAvailable: true
      },
      {
        name: "Bayou Reserve Rum",
        description: "Bayou Reserve Rum (ABV 40%), Ukraine",
        price: 4900,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 4900, currentPrice: 4900 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Mount Gay XO",
        description: "Mount Gay XO (ABV 43%), Caribbean",
        price: 10500,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 10500, currentPrice: 10500 }
        ],
        abv: 43.0,
        isAvailable: true
      },
      {
        name: "Mount Gay Eclipse",
        description: "Mount Gay Eclipse (ABV 40%), Caribbean",
        price: 3900,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 3900, currentPrice: 3900 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Mount Gay Silver",
        description: "Mount Gay Silver (ABV 40%), Caribbean",
        price: 3500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Mount Gay Black Barrel Barbados Rum",
        description: "Mount Gay Black Barrel Barbados Rum (ABV 43%), Caribbean",
        price: 4500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 4500, currentPrice: 4500 }
        ],
        abv: 43.0,
        isAvailable: true
      },
      {
        name: "Ron Zacapa Centenario 23",
        description: "Ron Zacapa Centenario 23 (ABV 40%), Guatemala",
        price: 8195,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 8195, currentPrice: 8195 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Kura Rum Cask Finish",
        description: "Kura Rum Cask Finish (ABV 40%), Japan",
        price: 16499,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 16499, currentPrice: 16499 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Angostura Rums
      {
        name: "Angostura Caribbean Rum 1824",
        description: "Angostura Caribbean Rum 1824 (ABV 40%), Trinidad",
        price: 8500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Angostura Caribbean Rum 1919",
        description: "Angostura Caribbean Rum 1919 (ABV 40%), Trinidad and Tobago",
        price: 5500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 5500, currentPrice: 5500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Angostura 5 Years Old Superior Gold",
        description: "Angostura 5 Years Old Superior Gold (ABV 37.5%), Trinidad",
        price: 3850,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 3850, currentPrice: 3850 }
        ],
        abv: 37.5,
        isAvailable: true
      },
      {
        name: "Angostura 3 Years Old Reserve",
        description: "Angostura 3 Years Old Reserve (ABV 37.5%), Trinidad",
        price: 3200,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 37.5,
        isAvailable: true
      },
      {
        name: "Angostura Bitters",
        description: "Angostura Bitters (ABV 44.7%), South Africa",
        price: 3400,
        capacity: ["473ml", "200ml"],
        capacityPricing: [
          { capacity: "473ml", originalPrice: 6400, currentPrice: 6400 },
          { capacity: "200ml", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 44.7,
        isAvailable: true
      },

      // Cuerpo Rums
      {
        name: "Cuerpo White Rum Liqueur",
        description: "Cuerpo White Rum Liqueur (ABV 15%), France",
        price: 2800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 15.0,
        isAvailable: true
      },
      {
        name: "Cuerpo Gold Rum Liqueur",
        description: "Cuerpo Gold Rum Liqueur (ABV 15%), France",
        price: 2950,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2950, currentPrice: 2950 }
        ],
        abv: 15.0,
        isAvailable: true
      },

      // Local and Regional Rums
      {
        name: "Bahari Rum",
        description: "Bahari Rum (ABV 40%), Kenya",
        price: 3200,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Contessa White Rum",
        description: "Contessa White Rum (ABV 40%), India",
        price: 1550,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1550, currentPrice: 1550 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Contessa Dark Rum",
        description: "Contessa Dark Rum (ABV 40%), India",
        price: 1550,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1550, currentPrice: 1550 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "New Grove Silver",
        description: "New Grove Silver (ABV 37.5%), Mauritius",
        price: 2000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 37.5,
        isAvailable: false // Sold out on website
      },
      {
        name: "New Grove Spiced Rum",
        description: "New Grove Spiced Rum (ABV 37.5%), Mauritius",
        price: 2000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 37.5,
        isAvailable: false // Sold out on website
      },
      {
        name: "Spytail Black Rum",
        description: "Spytail Black Rum (ABV 40%), France",
        price: 2800,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Oak Cask",
        description: "Oak Cask (ABV 40%), South Africa",
        price: 1300,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 1300, currentPrice: 1300 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Captain Morgan Rums
      {
        name: "Captain Morgan Gold",
        description: "Captain Morgan Gold (ABV 35%), Jamaica",
        price: 1400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Captain Morgan Spiced Gold",
        description: "Captain Morgan Spiced Gold (ABV 35%), Jamaica",
        price: 2400,
        capacity: ["1 Litre", "750ML"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2699, currentPrice: 2699 },
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Captain Morgan Black",
        description: "Captain Morgan Black (ABV 35%), Jamaica",
        price: 2499,
        capacity: ["1 Litre", "750ML"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2900, currentPrice: 2900 },
          { capacity: "750ML", originalPrice: 2499, currentPrice: 2499 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Captain Black Spiced Rum",
        description: "Captain Black Spiced Rum (ABV 40%), Jamaica",
        price: 2700,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2700, currentPrice: 2700 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Captain Morgan White Rum",
        description: "Captain Morgan White Rum (ABV 35%), Jamaica",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Captain Morgan Tiki",
        description: "Captain Morgan Tiki (ABV 25%), Jamaica",
        price: 3200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 25.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Captain Morgan Applesmash",
        description: "Captain Morgan Applesmash (ABV 37%), Jamaica",
        price: 3500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 37.0,
        isAvailable: false // Sold out on website
      },

      // Bacardi Rums
      {
        name: "Bacardi Breezer Pineapple",
        description: "Bacardi Breezer Pineapple (ABV 4%), Cuba",
        price: 1700,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 4.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bacardi Breezer Peach",
        description: "Bacardi Breezer Peach (ABV 4%), Cuba",
        price: 1700,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 4.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bacardi Breezer Lime",
        description: "Bacardi Breezer Lime (ABV 4%), Cuba",
        price: 1700,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 4.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bacardi Breezer Watermelon",
        description: "Bacardi Breezer Watermelon (ABV 4%), Cuba",
        price: 1700,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 4.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bacardi Carta Blanca",
        description: "Bacardi Carta Blanca (ABV 40%), Puerto Rico",
        price: 2600,
        capacity: ["1 Litre", "750ML"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2995, currentPrice: 2995 },
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Bacardi Black",
        description: "Bacardi Black (ABV 40%), Puerto Rico",
        price: 2499,
        capacity: ["1 Litre", "750ML"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2899, currentPrice: 2899 },
          { capacity: "750ML", originalPrice: 2499, currentPrice: 2499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Bacardi Limon rum",
        description: "Bacardi Limon rum (ABV 35%), Cuba",
        price: 2600,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Bacardi Oakheart [New Bacardi spiced]",
        description: "Bacardi Oakheart [New Bacardi spiced] (ABV 35%), Puerto Rico",
        price: 2700,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2700, currentPrice: 2700 }
        ],
        abv: 35.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bacardi Gold",
        description: "Bacardi Gold (ABV 37.5%), Puerto Rico",
        price: 2600,
        capacity: ["1 Litre", "750ml"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 },
          { capacity: "750ml", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 37.5,
        isAvailable: true
      },
      {
        name: "Bacardi 8 Years",
        description: "Bacardi 8 Years (ABV 40%), Puerto Rico",
        price: 4900,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 4900, currentPrice: 4900 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Bacardi Anejo Cuatro",
        description: "Bacardi Anejo Cuatro (ABV 40%), Puerto Rico",
        price: 2800,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Bacardi spiced Rum",
        description: "Bacardi spiced Rum (ABV 35%), Puerto Rico",
        price: 2600,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Bacardi Mojito",
        description: "Bacardi Mojito (ABV 15%), Cuba",
        price: 2700,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2700, currentPrice: 2700 }
        ],
        abv: 15.0,
        isAvailable: false // Sold out on website
      },

      // Other Premium Rums
      {
        name: "Bumbu Rum",
        description: "Bumbu Rum (ABV 35%), Caribbean",
        price: 5800,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 5800, currentPrice: 5800 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Myer's Rum",
        description: "Myer's Rum (ABV 40%), Jamaica",
        price: 2600,
        capacity: ["1 Litre", "750ml"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 },
          { capacity: "750ml", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Don papa Rum",
        description: "Don papa Rum (ABV 40%), Philippines",
        price: 4000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 4000, currentPrice: 4000 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tanduay Double Rum",
        description: "Tanduay Double Rum (ABV 40%), Philippines",
        price: 8900,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 8900, currentPrice: 8900 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },

      // Old Monk Rums
      {
        name: "Old Monk The Legend",
        description: "Old Monk The Legend (ABV 43%), India",
        price: 2400,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 43.0,
        isAvailable: true
      },
      {
        name: "Old Monk Rum",
        description: "Old Monk Rum (ABV 42.8%), India",
        price: 1395,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1395, currentPrice: 1395 }
        ],
        abv: 42.8,
        isAvailable: true
      },

      // Malibu and Flavored Rums
      {
        name: "Malibu",
        description: "Malibu (ABV 21%), Barbados",
        price: 2700,
        capacity: ["1 Litre", "750ml"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 },
          { capacity: "750ml", originalPrice: 2700, currentPrice: 2700 }
        ],
        abv: 21.0,
        isAvailable: true
      },
      {
        name: "Afri Bull Cafe Rum",
        description: "Afri Bull Cafe Rum (ABV 45%), India",
        price: 1400,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 1400, currentPrice: 1400 }
        ],
        abv: 45.0,
        isAvailable: false // Sold out on website
      },

      // Other Items (some are not rum but appear on rum page)
      {
        name: "McDowell's No.1 Platinum Whisky",
        description: "McDowell's No.1 Platinum Whisky (ABV 42.8%), India",
        price: 1500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 42.8,
        isAvailable: false, // Sold out on website
        categoryId: rumCategory.id // Keep in rum category as it appears on rum page
      },
      {
        name: "McDowell's No.1 Whisky",
        description: "McDowell's No.1 Whisky (ABV 40%), India",
        price: 1500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 40.0,
        isAvailable: false, // Sold out on website
        categoryId: rumCategory.id // Keep in rum category as it appears on rum page
      },
      {
        name: "Golden Rump beer",
        description: "Golden Rump beer (ABV 4.5%), Kenya",
        price: 1450,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1450, currentPrice: 1450 }
        ],
        abv: 4.5,
        isAvailable: false, // Sold out on website
        categoryId: rumCategory.id // Keep in rum category as it appears on rum page
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of rumProducts) {
      const existingDrink = await db.Drink.findOne({ 
        where: { 
          name: product.name, 
          categoryId: rumCategory.id 
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
        categoryId: rumCategory.id,
        subCategoryId: rumSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacityPricing,
        abv: product.abv,
        isAvailable: product.isAvailable,
        isPopular: product.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      console.log(`Added rum: ${drink.name} - KES ${drink.price} (Available: ${drink.isAvailable})`);
      addedCount++;
    }

    console.log(`\nCompleted adding rum items:\n- Added: ${addedCount}\n- Skipped: ${skippedCount}\n- Total processed: ${rumProducts.length}`);

  } catch (error) {
    console.error('Error adding rum items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addMissingRumItems();

