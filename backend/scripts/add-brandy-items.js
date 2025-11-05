const db = require('../models');

async function addBrandyItems() {
  try {
    console.log('Adding brandy items from Dial a Drink Kenya website...');

    const brandyCategory = await db.Category.findOne({ where: { name: 'Brandy' } });
    if (!brandyCategory) {
      console.error('Brandy category not found!');
      return;
    }
    console.log('Brandy category found:', brandyCategory.name);

    const allBrandySubCategory = await db.SubCategory.findOne({ 
      where: { name: 'All Brandy', categoryId: brandyCategory.id } 
    });
    if (!allBrandySubCategory) {
      // Create the subcategory if it doesn't exist
      const newSubCategory = await db.SubCategory.create({
        name: 'All Brandy',
        description: 'All types of brandy and cognac',
        categoryId: brandyCategory.id
      });
      console.log('Created All Brandy subcategory');
    } else {
      console.log('All Brandy subcategory found:', allBrandySubCategory.name);
    }

    // Brandy items from the actual Dial a Drink Kenya website
    const brandyItems = [
      {
        name: "Emperador Brandy",
        description: "Emperador Brandy (ABV 36%), Philippines",
        price: 3500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 36.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Don Montego VSOP",
        description: "Don Montego VSOP (ABV 40%), Moldova",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0,
        isPopular: false,
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
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Viceroy",
        description: "Viceroy (ABV 43%), France",
        price: 1700,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 43.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "St Remy XO",
        description: "St Remy XO (ABV 40%), France",
        price: 3400,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0,
        isPopular: false,
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
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Richot Brandy 750ml",
        description: "Richot Brandy 750ml (ABV 40%), Italy",
        price: 1550,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1550, currentPrice: 1550 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Grand Marnier Nuit Parisienne",
        description: "Grand Marnier Nuit Parisienne (ABV 40%), France",
        price: 5900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5900, currentPrice: 5900 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: true
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
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Viceroy 10 Years",
        description: "Viceroy 10 Years (ABV 36%), South Africa",
        price: 4300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4300, currentPrice: 4300 }
        ],
        abv: 36.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bardinet VSOP Brandy",
        description: "Bardinet VSOP Brandy (ABV 40%), France",
        price: 2400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Imperial Blue Whiskey",
        description: "Imperial Blue Whiskey (ABV 42.8%), India",
        price: 1500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 42.8,
        isPopular: false,
        isAvailable: false // Sold out on website
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
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Cicero Brandy",
        description: "Cicero Brandy (ABV 40%), Kenya",
        price: 1400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "St Remy VSOP",
        description: "St Remy VSOP (ABV 40%), France",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Three Barrels VSOP",
        description: "Three Barrels VSOP (ABV 40%), France",
        price: 2595,
        capacity: ["1 Litre", "750ML"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 2685, currentPrice: 2685 },
          { capacity: "750ML", originalPrice: 2595, currentPrice: 2595 }
        ],
        abv: 40.0,
        isPopular: false,
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
        isPopular: true,
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
        isPopular: true,
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
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Camus VSOP",
        description: "Camus VSOP (ABV 40%), France",
        price: 7200,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7200, currentPrice: 7200 },
          { capacity: "1 Litre", originalPrice: 8400, currentPrice: 8400 }
        ],
        abv: 40.0,
        isPopular: true,
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
        isPopular: false,
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
        isPopular: false,
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
        isPopular: true,
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
        isPopular: false,
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
        isPopular: false,
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
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Piper Heidesieck",
        description: "Piper Heidesieck (ABV 12.5%), France",
        price: 8500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 12.5,
        isPopular: false,
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
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Metaxa 7 Stars",
        description: "Metaxa 7 Stars (ABV 40%), Greece",
        price: 5400,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 5400, currentPrice: 5400 }
        ],
        abv: 40.0,
        isPopular: false,
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
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Godet XO",
        description: "Godet XO (ABV 40%), France",
        price: 19500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 19500, currentPrice: 19500 }
        ],
        abv: 40.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Metaxa 5 Stars",
        description: "Metaxa 5 Stars (ABV 40%), Greece",
        price: 4500,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 4500, currentPrice: 4500 }
        ],
        abv: 40.0,
        isPopular: false,
        isAvailable: true
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
        isPopular: false,
        isAvailable: false // Sold out on website
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
        isPopular: false,
        isAvailable: false // Sold out on website
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const brandy of brandyItems) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: brandy.name, categoryId: brandyCategory.id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${brandy.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: brandy.name,
        description: brandy.description,
        price: brandy.price.toString(),
        originalPrice: brandy.price.toString(),
        categoryId: brandyCategory.id,
        subCategoryId: allBrandySubCategory.id,
        capacity: brandy.capacity,
        capacityPricing: brandy.capacityPricing,
        abv: brandy.abv,
        isAvailable: brandy.isAvailable,
        isPopular: brandy.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      console.log(`Added brandy: ${brandy.name} - KES ${brandy.price} (Available: ${brandy.isAvailable})`);
    }

    console.log(`\nCompleted adding brandy items:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${brandyItems.length}`);

  } catch (error) {
    console.error('Error adding brandy items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addBrandyItems();

