const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

const missingBeerProducts = [
  // Additional Tusker varieties
  {
    name: "Tusker Ndimu",
    description: "Tusker Ndimu (ABV 4.5%), Kenya",
    price: 2100,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 4.5,
    isAvailable: false // Sold out on website
  },
  
  // Additional K.O varieties
  {
    name: "K.O Hibiscus and lime",
    description: "K.O Hibiscus and lime (ABV 8%), Kenya",
    price: 1500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 8.0,
    isAvailable: true
  },
  {
    name: "K.O Chilli and Turmeric Tonic Water",
    description: "K.O Chilli and Turmeric Tonic Water (ABV 0%), Kenya",
    price: 1600,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 }
    ],
    abv: 0.0,
    isAvailable: true
  },
  {
    name: "K.O Light Tonic",
    description: "K.O Light Tonic (ABV 0%), Kenya",
    price: 150,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 150, currentPrice: 150 }
    ],
    abv: 0.0,
    isAvailable: true
  },

  // Additional Bavaria varieties
  {
    name: "Bavaria 0.0 Mango Passion",
    description: "Bavaria 0.0 Mango Passion (ABV 0%), Netherlands",
    price: 200,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 200, currentPrice: 200 }
    ],
    abv: 0.0,
    isAvailable: true
  },
  {
    name: "Bavaria 0.0 Ginger Lime",
    description: "Bavaria 0.0 Ginger Lime (ABV 0%), Netherlands",
    price: 400,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 400, currentPrice: 400 }
    ],
    abv: 0.0,
    isAvailable: false // Sold out on website
  },

  // Additional Coolberg varieties
  {
    name: "Coolberg Cranberry Beer 0.0",
    description: "Coolberg Cranberry Beer 0.0 (ABV 0%), Sweden",
    price: 300,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
    ],
    abv: 0.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Coolberg Ginger Beer 0.0",
    description: "Coolberg Ginger Beer 0.0 (ABV 0%), Sweden",
    price: 300,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
    ],
    abv: 0.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Coolberg Mint 0.0 Beer",
    description: "Coolberg Mint 0.0 Beer (ABV 0%), Sweden",
    price: 300,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
    ],
    abv: 0.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Coolberg Strawberry 0.0 Beer",
    description: "Coolberg Strawberry 0.0 Beer (ABV 0%), Sweden",
    price: 300,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
    ],
    abv: 0.0,
    isAvailable: false // Sold out on website
  },

  // Additional Bila Shaka varieties
  {
    name: "Bila Shaka Jua Kali-Hopped Lager",
    description: "Bila Shaka Jua Kali-Hopped Lager (ABV 4.6%), Kenya",
    price: 1650,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1650, currentPrice: 1650 }
    ],
    abv: 4.6,
    isAvailable: false // Sold out on website
  },
  {
    name: "Bila Shaka Fruity Fly-Mango IPA",
    description: "Bila Shaka Fruity Fly-Mango IPA (ABV 5.5%), Kenya",
    price: 1500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 5.5,
    isAvailable: false // Sold out on website
  },
  {
    name: "Bila Shaka Dirty Hairy-Copper Ale",
    description: "Bila Shaka Dirty Hairy-Copper Ale (ABV 5%), Kenya",
    price: 1500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 5.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Bila Shaka Chez Guerrilla-Imperial Stout",
    description: "Bila Shaka Chez Guerrilla-Imperial Stout (ABV 9%), Kenya",
    price: 1500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 9.0,
    isAvailable: false // Sold out on website
  },

  // Additional Castle varieties
  {
    name: "Castle Lite Can",
    description: "Castle Lite Can (ABV 4%), South Africa",
    price: 1450,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1450, currentPrice: 1450 }
    ],
    abv: 4.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Castle Lite",
    description: "Castle Lite (ABV 4%), South Africa",
    price: 1500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 4.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Castle Milk Stout",
    description: "Castle Milk Stout (ABV 6%), Tanzania",
    price: 300,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 300, currentPrice: 300 }
    ],
    abv: 6.0,
    isAvailable: false // Sold out on website
  },

  // Additional Budweiser varieties
  {
    name: "Budweiser Beer 355ml",
    description: "Budweiser Beer 355ml (ABV 5%), USA",
    price: 1500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 5.0,
    isAvailable: false // Sold out on website
  },

  // Additional Guinness varieties
  {
    name: "Guinness Smooth 330ml",
    description: "Guinness Smooth 330ml (ABV 4.2%), Ireland",
    price: 2100,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 4.2,
    isAvailable: true
  },
  {
    name: "Guinness Hop house beer",
    description: "Guinness Hop house beer (ABV 5%), Ireland",
    price: 1650,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1650, currentPrice: 1650 }
    ],
    abv: 5.0,
    isAvailable: false // Sold out on website
  },

  // Additional Jack Daniel's varieties
  {
    name: "Jack Daniel's Apple Tonic Beer",
    description: "Jack Daniel's Apple Tonic Beer (ABV 5%), USA",
    price: 3500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 5.0,
    isAvailable: false // Sold out on website
  },
  {
    name: "Jack Daniel's Honey Lemonade",
    description: "Jack Daniel's Honey Lemonade (ABV 5%), USA",
    price: 3500,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 5.0,
    isAvailable: false // Sold out on website
  },

  // Additional O J varieties
  {
    name: "O J 12% Beer",
    description: "O J 12% Beer (ABV 12%), Netherlands, Belgium",
    price: 1800,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 12.0,
    isAvailable: false // Sold out on website
  },

  // Additional Obolon varieties
  {
    name: "Obolon Premium",
    description: "Obolon Premium (ABV 5%), Ukraine",
    price: 300,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 300, currentPrice: 300 }
    ],
    abv: 5.0,
    isAvailable: false // Sold out on website
  },

  // Additional Faxe varieties
  {
    name: "Faxe 10% Extra",
    description: "Faxe 10% Extra (ABV 10%), Denmark",
    price: 2250,
    capacity: ["Six Pack", "12 PACK", "24 PACK"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 2250, currentPrice: 2250 },
      { capacity: "12 PACK", originalPrice: 4200, currentPrice: 4200 },
      { capacity: "24 PACK", originalPrice: 8000, currentPrice: 8000 }
    ],
    abv: 10.0,
    isAvailable: true
  },

  // Additional Hunter's varieties
  {
    name: "Hunter's Gold Cider",
    description: "Hunter's Gold Cider (ABV 5.5%), Kenya",
    price: 1400,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1400, currentPrice: 1400 }
    ],
    abv: 5.5,
    isAvailable: true
  },

  // Additional Manyatta varieties
  {
    name: "Manyatta Cider Beer",
    description: "Manyatta Cider Beer (ABV 7%), Kenya",
    price: 2100,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 7.0,
    isAvailable: true
  },

  // Additional Sikera varieties
  {
    name: "Sikera Apple Cider",
    description: "Sikera Apple Cider (ABV 4.5%), Kenya",
    price: 1299,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1299, currentPrice: 1299 }
    ],
    abv: 4.5,
    isAvailable: false // Sold out on website
  },

  // Additional Karibrew varieties
  {
    name: "Karibrew beer",
    description: "Karibrew beer (ABV 5.3%), Kenya",
    price: 1450,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1450, currentPrice: 1450 }
    ],
    abv: 5.3,
    isAvailable: false // Sold out on website
  },

  // Additional Golden Rump varieties
  {
    name: "Golden Rump beer",
    description: "Golden Rump beer (ABV 4.5%), Kenya",
    price: 1450,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1450, currentPrice: 1450 }
    ],
    abv: 4.5,
    isAvailable: false // Sold out on website
  },

  // Additional Summit varieties
  {
    name: "Summit Lager",
    description: "Summit Lager (ABV 4.2%), Kenya",
    price: 230,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 230, currentPrice: 230 }
    ],
    abv: 4.2,
    isAvailable: false // Sold out on website
  },

  // Additional Hopsmith varieties
  {
    name: "Hopsmith Lager Gluten Free",
    description: "Hopsmith Lager Gluten Free (ABV 4.4%), Kenya",
    price: 480,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 480, currentPrice: 480 }
    ],
    abv: 4.4,
    isAvailable: false // Sold out on website
  },

  // Additional Oettinger varieties
  {
    name: "Oettinger Pils 4.7%",
    description: "Oettinger Pils 4.7% (ABV 4.7%), Germany",
    price: 1500,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 4.7,
    isAvailable: true
  },

  // Additional Peroni varieties
  {
    name: "Peroni",
    description: "Peroni (ABV 5.1%), Italy",
    price: 1400,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1400, currentPrice: 1400 }
    ],
    abv: 5.1,
    isAvailable: false // Sold out on website
  },

  // Additional Carlsberg varieties
  {
    name: "Carlsberg",
    description: "Carlsberg (ABV 3.8%), Denmark",
    price: 220,
    capacity: ["330ml"],
    capacityPricing: [
      { capacity: "330ml", originalPrice: 220, currentPrice: 220 }
    ],
    abv: 3.8,
    isAvailable: false // Sold out on website
  },

  // Additional Curonia varieties
  {
    name: "Curonia Beer 16%",
    description: "Curonia Beer 16% (ABV 16%), Latvia",
    price: 380,
    capacity: ["500ml"],
    capacityPricing: [
      { capacity: "500ml", originalPrice: 380, currentPrice: 380 }
    ],
    abv: 16.0,
    isAvailable: false // Sold out on website
  },

  // Additional Atlas varieties
  {
    name: "Atlas Ultra Strong 14",
    description: "Atlas Ultra Strong 14 (ABV 14%), Netherlands",
    price: 1600,
    capacity: ["Six Pack"],
    capacityPricing: [
      { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 }
    ],
    abv: 14.0,
    isAvailable: true
  }
];

router.post('/add-missing-beer-items', async (req, res) => {
  try {
    console.log('Adding missing beer items from Dial a Drink Kenya website...');

    const beerCategory = await Category.findOne({ where: { name: 'Beer' } });
    if (!beerCategory) {
      return res.status(404).json({ success: false, message: 'Beer category not found' });
    }

    // Create subcategory for beer
    const [beerSubCategory] = await SubCategory.findOrCreate({
      where: { name: 'All Beers', categoryId: beerCategory.id },
      defaults: { description: 'All types of beer', categoryId: beerCategory.id }
    });

    let addedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of missingBeerProducts) {
      const existingDrink = await Drink.findOne({ 
        where: { 
          name: product.name, 
          categoryId: beerCategory.id 
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
      results.push({ name: product.name, status: "added", id: drink.id });
    }

    res.status(200).json({
      success: true,
      message: `Missing beer items import completed. Added: ${addedCount}, Skipped: ${skippedCount}`,
      addedCount,
      skippedCount,
      totalProducts: missingBeerProducts.length,
      results
    });

  } catch (error) {
    console.error('Error adding missing beer items:', error);
    res.status(500).json({ success: false, message: 'Failed to add missing beer items', error: error.message });
  }
});

module.exports = router;

