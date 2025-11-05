const db = require('../models');

async function addChampagneItems() {
  try {
    console.log('Adding champagne items from Dial a Drink Kenya website...');

    const champagneCategory = await db.Category.findOne({ where: { name: 'Champagne' } });
    if (!champagneCategory) {
      console.error('Champagne category not found!');
      return;
    }
    console.log('Champagne category found:', champagneCategory.name);

    const allChampagneSubCategory = await db.SubCategory.findOne({ 
      where: { name: 'All Champagne', categoryId: champagneCategory.id } 
    });
    if (!allChampagneSubCategory) {
      // Create the subcategory if it doesn't exist
      const newSubCategory = await db.SubCategory.create({
        name: 'All Champagne',
        description: 'All types of champagne',
        categoryId: champagneCategory.id
      });
      console.log('Created All Champagne subcategory');
    } else {
      console.log('All Champagne subcategory found:', allChampagneSubCategory.name);
    }

    // Champagne items from the actual Dial a Drink Kenya website
    const champagneItems = [
      {
        name: "Veuve Clicquot Grand Dame Brut",
        description: "Veuve Clicquot Grand Dame Brut (ABV 12%), France",
        price: 30000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 30000, currentPrice: 30000 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Mumm Champagne Rouge Rose",
        description: "Mumm Champagne Rouge Rose (ABV 13%), France",
        price: 9200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 9200, currentPrice: 9200 }
        ],
        abv: 13.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Belaire Rose Fantome",
        description: "Belaire Rose Fantome (ABV 12.5%), France",
        price: 6400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6400, currentPrice: 6400 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Belaire Luxe",
        description: "Belaire Luxe (ABV 12.5%), France",
        price: 5200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Calvet Celebration Sparkling Brut-Rose",
        description: "Calvet Celebration Sparkling Brut-Rose (ABV 11.5%), France",
        price: 2500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 11.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Arthur Metz Crémant Rose",
        description: "Arthur Metz Crémant Rose (ABV 12%), France",
        price: 3095,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3095, currentPrice: 3095 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Calvet Ice Chardonnay Demi Sec",
        description: "Calvet Ice Chardonnay Demi Sec (ABV 11.5%), France",
        price: 2900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2900, currentPrice: 2900 }
        ],
        abv: 11.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Calvet Crémant Bordeaux Brut Rose",
        description: "Calvet Crémant Bordeaux Brut Rose (ABV 11.5%), France",
        price: 3200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 11.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Arthur Metz Crémant d'Alsace",
        description: "Arthur Metz Crémant d'Alsace (ABV 12%), France",
        price: 3600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Calvet Celebration Sparkling Brut-White",
        description: "Calvet Celebration Sparkling Brut-White (ABV 11.5%), France",
        price: 2500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 11.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Fleurs de Prairie Sparkling Brut-Rose",
        description: "Fleurs de Prairie Sparkling Brut-Rose (ABV 12%), France",
        price: 2500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Taittinger Brut Reserve",
        description: "Taittinger Brut Reserve (ABV 12%), France",
        price: 13500,
        capacity: ["750ML", "1.5 Litres"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 13500, currentPrice: 13500 },
          { capacity: "1.5 Litres", originalPrice: 19200, currentPrice: 19200 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Perle Noir Crémant d'Alsace",
        description: "Perle Noir Crémant d'Alsace (ABV 12%), France",
        price: 3500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Moet & Chandon Imperial Brut",
        description: "Moet & Chandon Imperial Brut (ABV 12%), France",
        price: 8200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 8200, currentPrice: 8200 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Belaire Luxe Rose Fantome",
        description: "Belaire Luxe Rose Fantome (ABV 12.5%), France",
        price: 5400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5400, currentPrice: 5400 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Taittinger Prestige Rose",
        description: "Taittinger Prestige Rose (ABV 12%), France",
        price: 14500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 14500, currentPrice: 14500 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Belaire Rose",
        description: "Belaire Rose (ABV 12.5%), France",
        price: 5200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
        ],
        abv: 12.5,
        isPopular: false,
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
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Fleurs de Prairie Sparkling Brut-White",
        description: "Fleurs de Prairie Sparkling Brut-White (ABV 12%), France",
        price: 2500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Veuve Clicquot Brut",
        description: "Veuve Clicquot Brut (ABV 12%), France",
        price: 11300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 11300, currentPrice: 11300 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Belaire Gold",
        description: "Belaire Gold (ABV 12.5%), France",
        price: 5200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Ace Of Spades Champagne",
        description: "Ace Of Spades Champagne (ABV 12.5%), France",
        price: 65000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 65000, currentPrice: 65000 }
        ],
        abv: 12.5,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Martini Zero",
        description: "Martini Zero (ABV 0%), Italy",
        price: 1700,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Laurent Perrier Brut",
        description: "Laurent Perrier Brut (ABV 12%), France",
        price: 11500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 11500, currentPrice: 11500 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Martini Prosecco",
        description: "Martini Prosecco (ABV 11.5%), Italy",
        price: 2895,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2895, currentPrice: 2895 }
        ],
        abv: 11.5,
        isPopular: false,
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
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Belaire Brut",
        description: "Belaire Brut (ABV 12.5%), France",
        price: 5600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5600, currentPrice: 5600 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Belaire Bleu",
        description: "Belaire Bleu (ABV 12.5%), France",
        price: 5200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Belaire Luxe Fantome",
        description: "Belaire Luxe Fantome (ABV 12.5%), France",
        price: 5000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5000, currentPrice: 5000 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Moet & Chandon Nectar Imperial Rose",
        description: "Moet & Chandon Nectar Imperial Rose (ABV 12%), France",
        price: 13500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 13500, currentPrice: 13500 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: false // Sold out on website
      },
      {
        name: "Belaire Gold Fantome",
        description: "Belaire Gold Fantome (ABV 12.5%), France",
        price: 5200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
        ],
        abv: 12.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Perrier Jouet",
        description: "Perrier Jouet (ABV 12%), France",
        price: 9500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 9500, currentPrice: 9500 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: false // Sold out on website
      },
      {
        name: "Moet & Chandon Imperial Ice",
        description: "Moet & Chandon Imperial Ice (ABV 12%), France",
        price: 14500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 14500, currentPrice: 14500 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Piper Heidesieck Rose",
        description: "Piper Heidesieck Rose (ABV 12%), France",
        price: 8500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Veuve Clicquot Rose",
        description: "Veuve Clicquot Rose (ABV 12%), France",
        price: 13800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 13800, currentPrice: 13800 }
        ],
        abv: 12.0,
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
        name: "Moet & Chandon 1.5litres",
        description: "Moet & Chandon 1.5litres (ABV 12%), France",
        price: 25000,
        capacity: ["1.5 Litres"],
        capacityPricing: [
          { capacity: "1.5 Litres", originalPrice: 25000, currentPrice: 25000 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: false // Sold out on website
      },
      {
        name: "Liopart Brut Reserva",
        description: "Liopart Brut Reserva (ABV 11.5%), Spain",
        price: 4000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4000, currentPrice: 4000 }
        ],
        abv: 11.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Moet & Chandon Nectar Imperial",
        description: "Moet & Chandon Nectar Imperial (ABV 12%), France",
        price: 14500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 14500, currentPrice: 14500 }
        ],
        abv: 12.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "GH Mumm",
        description: "GH Mumm (ABV 13%), France",
        price: 8500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 13.0,
        isPopular: false,
        isAvailable: true
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const champagne of champagneItems) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: champagne.name, categoryId: champagneCategory.id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${champagne.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: champagne.name,
        description: champagne.description,
        price: champagne.price.toString(),
        originalPrice: champagne.price.toString(),
        categoryId: champagneCategory.id,
        subCategoryId: allChampagneSubCategory.id,
        capacity: champagne.capacity,
        capacityPricing: champagne.capacityPricing,
        abv: champagne.abv,
        isAvailable: champagne.isAvailable,
        isPopular: champagne.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      console.log(`Added champagne: ${champagne.name} - KES ${champagne.price} (Available: ${champagne.isAvailable})`);
    }

    console.log(`\nCompleted adding champagne items:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${champagneItems.length}`);

  } catch (error) {
    console.error('Error adding champagne items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addChampagneItems();

