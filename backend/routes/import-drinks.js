const express = require('express');
const router = express.Router();
const db = require('../models');

// Import all drinks from Dial A Drink Kenya
router.post('/import-drinks', async (req, res) => {
  try {
    const drinksData = [
      // Whisky
      { name: 'Jameson Whisky', description: 'Jameson Whisky (ABV 40%), Ireland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 3395, currentPrice: 3395 }, { capacity: '750ml', originalPrice: 3000, currentPrice: 3000 }], abv: 40, origin: 'Ireland' },
      { name: 'Jack Daniel\'s Whiskey', description: 'Jack Daniel\'s Whiskey (ABV 40%), USA', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['700ml', '1 Litre'], capacityPricing: [{ capacity: '700ml', originalPrice: 3495, currentPrice: 3495 }, { capacity: '1 Litre', originalPrice: 3995, currentPrice: 3995 }], abv: 40, origin: 'USA' },
      { name: 'Johnnie Walker Black Label', description: 'Johnnie Walker Black Label (ABV 40%), Scotland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 4300, currentPrice: 4300 }, { capacity: '750ml', originalPrice: 3595, currentPrice: 3595 }], abv: 40, origin: 'Scotland' },
      { name: 'Glenfiddich 15 Years', description: 'Glenfiddich 15 Years (ABV 40%), Scotland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 10500, currentPrice: 10500 }, { capacity: '750ml', originalPrice: 8995, currentPrice: 8995 }], abv: 40, origin: 'Scotland' },
      { name: 'Singleton 12 Yrs Luscious Nectar', description: 'Singleton 12 Yrs Luscious Nectar (ABV 40%), Scotland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['700ml'], capacityPricing: [{ capacity: '700ml', originalPrice: 4799, currentPrice: 4799 }], abv: 40, origin: 'Scotland' },
      { name: 'JnB Rare', description: 'JnB Rare (ABV 40%), Scotland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 2495, currentPrice: 2495 }, { capacity: '750ml', originalPrice: 2300, currentPrice: 2300 }], abv: 40, origin: 'Scotland' },
      { name: 'Black and White Whiskey', description: 'Black and White Whiskey (ABV 40%), Scotland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 2195, currentPrice: 2195 }, { capacity: '750ml', originalPrice: 1699, currentPrice: 1699 }], abv: 40, origin: 'Scotland' },
      { name: 'Monkey Shoulder', description: 'Monkey Shoulder (ABV 40%), Scotland', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 5995, currentPrice: 5995 }, { capacity: '750ml', originalPrice: 4800, currentPrice: 4800 }], abv: 40, origin: 'Scotland' },
      { name: 'Jim Beam', description: 'Jim Beam (ABV 40%), United States', category: 'Whisky', subCategory: 'All Whiskies', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 2595, currentPrice: 2595 }, { capacity: '750ml', originalPrice: 2299, currentPrice: 2299 }], abv: 40, origin: 'United States' },

      // Vodka
      { name: 'Absolut Vodka', description: 'Absolut Vodka (ABV 40%), Sweden', category: 'Vodka', subCategory: 'All Vodka', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 2595, currentPrice: 2595 }, { capacity: '750ml', originalPrice: 2200, currentPrice: 2200 }], abv: 40, origin: 'Sweden' },
      { name: 'Smirnoff Vodka', description: 'Smirnoff Vodka (ABV 40%), Russia', category: 'Vodka', subCategory: 'All Vodka', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 2200, currentPrice: 1995 }, { capacity: '750ml', originalPrice: 1799, currentPrice: 1799 }], abv: 40, origin: 'Russia', isOnOffer: true, originalPrice: 2200 },

      // Gin
      { name: 'Gilbey\'s Gin', description: 'Gilbey\'s Gin (ABV 40%), London', category: 'Gin', subCategory: 'Gin', capacity: ['750ml', 'Twinpack'], capacityPricing: [{ capacity: '750ml', originalPrice: 1500, currentPrice: 1500 }, { capacity: 'Twinpack', originalPrice: 3200, currentPrice: 2900 }], abv: 40, origin: 'London', isOnOffer: true, originalPrice: 3200 },
      { name: 'Gordon\'s Gin', description: 'Gordon\'s Gin (ABV 37%), United Kingdom', category: 'Gin', subCategory: 'Gin', capacity: ['750ml', '1 Litre'], capacityPricing: [{ capacity: '750ml', originalPrice: 2400, currentPrice: 2400 }, { capacity: '1 Litre', originalPrice: 2800, currentPrice: 2800 }], abv: 37, origin: 'United Kingdom' },
      { name: 'Tanqueray Gin', description: 'Tanqueray Gin (ABV 47.3%), London', category: 'Gin', subCategory: 'Gin', capacity: ['1 Litre', '750ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 3600, currentPrice: 3600 }, { capacity: '750ml', originalPrice: 2995, currentPrice: 2995 }], abv: 47.3, origin: 'London' },

      // Tequila
      { name: 'Don Julio Reposado', description: 'Don Julio Reposado (ABV 38%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['750ml'], capacityPricing: [{ capacity: '750ml', originalPrice: 8195, currentPrice: 8195 }], abv: 38, origin: 'Mexico' },
      { name: 'Patron Silver Tequila', description: 'Patron Silver Tequila (ABV 40%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['750ml'], capacityPricing: [{ capacity: '750ml', originalPrice: 6795, currentPrice: 6795 }], abv: 40, origin: 'Mexico' },
      { name: 'Jose Cuervo Gold', description: 'Jose Cuervo Gold (ABV 40%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['750ml', '1 Litre'], capacityPricing: [{ capacity: '750ml', originalPrice: 2895, currentPrice: 2895 }, { capacity: '1 Litre', originalPrice: 3400, currentPrice: 3400 }], abv: 40, origin: 'Mexico' },
      { name: 'Olmeca Gold', description: 'Olmeca Gold (ABV 38%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['750ml', '1 Litre'], capacityPricing: [{ capacity: '750ml', originalPrice: 3400, currentPrice: 3400 }, { capacity: '1 Litre', originalPrice: 4200, currentPrice: 4200 }], abv: 38, origin: 'Mexico' },
      { name: 'Olmeca Silver', description: 'Olmeca Silver (ABV 40%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['700ml'], capacityPricing: [{ capacity: '700ml', originalPrice: 3400, currentPrice: 3400 }], abv: 40, origin: 'Mexico' },
      { name: 'Patron Reposado', description: 'Patron Reposado (ABV 40%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['750ml'], capacityPricing: [{ capacity: '750ml', originalPrice: 9500, currentPrice: 9500 }], abv: 40, origin: 'Mexico' },
      { name: 'Jose Cuervo Silver', description: 'Jose Cuervo Silver (ABV 40%), Mexico', category: 'Tequila', subCategory: 'All Tequila', capacity: ['750ml', '1 Litre'], capacityPricing: [{ capacity: '750ml', originalPrice: 2995, currentPrice: 2995 }, { capacity: '1 Litre', originalPrice: 3195, currentPrice: 3195 }], abv: 40, origin: 'Mexico' },

      // Cognac
      { name: 'Martell VS', description: 'Martell VS (ABV 40%), France', category: 'Cognac', subCategory: 'All Cognac', capacity: ['1 Litre', '700ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 7595, currentPrice: 7595 }, { capacity: '700ml', originalPrice: 5499, currentPrice: 5499 }], abv: 40, origin: 'France' },
      { name: 'Hennessy VS', description: 'Hennessy VS (ABV 40%), France', category: 'Cognac', subCategory: 'All Cognac', capacity: ['1 Litre', '700ml'], capacityPricing: [{ capacity: '1 Litre', originalPrice: 7995, currentPrice: 7995 }, { capacity: '700ml', originalPrice: 5499, currentPrice: 5499 }], abv: 40, origin: 'France' },

      // Wine
      { name: 'The Guv\'nor Red Wine', description: 'The Guv\'nor Red Wine (ABV 13.5%), Spain', category: 'Wine', subCategory: 'All Wine', capacity: ['750ml', '1.5 Litres'], capacityPricing: [{ capacity: '750ml', originalPrice: 2195, currentPrice: 2195 }, { capacity: '1.5 Litres', originalPrice: 4200, currentPrice: 4200 }], abv: 13.5, origin: 'Spain' },
      { name: 'Choco Toffee Red wine', description: 'Choco Toffee Red wine (ABV 10%), Germany', category: 'Wine', subCategory: 'All Wine', capacity: ['750ml'], capacityPricing: [{ capacity: '750ml', originalPrice: 1799, currentPrice: 1799 }], abv: 10, origin: 'Germany' },
      { name: 'Bianco Nobile', description: 'Bianco Nobile (ABV 10%), Germany', category: 'Wine', subCategory: 'All Wine', capacity: ['750ml', 'Twinpack'], capacityPricing: [{ capacity: '750ml', originalPrice: 1895, currentPrice: 1895 }, { capacity: 'Twinpack', originalPrice: 3499, currentPrice: 3499 }], abv: 10, origin: 'Germany' },
      { name: 'Mucho Mas Wine', description: 'Mucho Mas Wine (ABV 14%), Spain', category: 'Wine', subCategory: 'All Wine', capacity: ['750ml', '1.5 Litres'], capacityPricing: [{ capacity: '750ml', originalPrice: 2595, currentPrice: 2595 }, { capacity: '1.5 Litres', originalPrice: 3999, currentPrice: 3999 }], abv: 14, origin: 'Spain' },
      { name: 'Namaqua Rose', description: 'Namaqua Rose (ABV 8.5%), South Africa', category: 'Wine', subCategory: 'All Wine', capacity: ['5 Litres'], capacityPricing: [{ capacity: '5 Litres', originalPrice: 3995, currentPrice: 3995 }], abv: 8.5, origin: 'South Africa' },
      { name: 'Signore Giuseppe Prosecco Spumante White', description: 'Signore Giuseppe Prosecco Spumante White (ABV 11%), Italy', category: 'Wine', subCategory: 'All Wine', capacity: ['750ml'], capacityPricing: [{ capacity: '750ml', originalPrice: 2700, currentPrice: 2700 }], abv: 11, origin: 'Italy' },

      // Liqueur
      { name: 'Olmeca Dark Chocolate', description: 'Olmeca Dark Chocolate (ABV 20%), Mexico', category: 'Liqueur', subCategory: 'All Liqueur', capacity: ['750ml'], capacityPricing: [{ capacity: '750ml', originalPrice: 3195, currentPrice: 3195 }], abv: 20, origin: 'Mexico' },

      // Beer
      { name: 'K.O Beer - Mango and Ginger', description: 'K.O Beer - Mango and Ginger (ABV 8%), Kenya', category: 'Beer', subCategory: 'All Beer', capacity: ['Six Pack', '12 PACK'], capacityPricing: [{ capacity: 'Six Pack', originalPrice: 1795, currentPrice: 1795 }, { capacity: '12 PACK', originalPrice: 3500, currentPrice: 3500 }], abv: 8, origin: 'Kenya' },
      { name: 'K.O - Lime & Ginger', description: 'K.O - Lime & Ginger (ABV 8%), Kenya', category: 'Beer', subCategory: 'All Beer', capacity: ['Six Pack', '12 PACK'], capacityPricing: [{ capacity: 'Six Pack', originalPrice: 1795, currentPrice: 1795 }, { capacity: '12 PACK', originalPrice: 3500, currentPrice: 3500 }], abv: 8, origin: 'Kenya' },
      { name: 'K.O Beer - Pineapple & Mint', description: 'K.O Beer - Pineapple & Mint (ABV 8%), Kenya', category: 'Beer', subCategory: 'All Beer', capacity: ['Six Pack', '12 PACK'], capacityPricing: [{ capacity: 'Six Pack', originalPrice: 1795, currentPrice: 1795 }, { capacity: '12 PACK', originalPrice: 3700, currentPrice: 3700 }], abv: 8, origin: 'Kenya' },
      { name: 'K.O Passion & Lime', description: 'K.O Passion & Lime (ABV 8%), Kenya', category: 'Beer', subCategory: 'All Beer', capacity: ['Six Pack', '12 PACK'], capacityPricing: [{ capacity: 'Six Pack', originalPrice: 1699, currentPrice: 1699 }, { capacity: '12 PACK', originalPrice: 4000, currentPrice: 4000 }], abv: 8, origin: 'Kenya' }
    ];

    let totalCreated = 0;
    const createdDrinks = [];

    for (const drinkData of drinksData) {
      // Find category and subcategory
      const category = await db.Category.findOne({ where: { name: drinkData.category } });
      const subCategory = await db.SubCategory.findOne({ 
        where: { name: drinkData.subCategory, categoryId: category.id } 
      });

      if (!category || !subCategory) {
        console.warn(`Category "${drinkData.category}" or SubCategory "${drinkData.subCategory}" not found for drink "${drinkData.name}"`);
        continue;
      }

      // Calculate the lowest price for the main price field
      const lowestPrice = Math.min(...drinkData.capacityPricing.map(p => p.currentPrice));

      const [drink, created] = await db.Drink.findOrCreate({
        where: { 
          name: drinkData.name,
          categoryId: category.id,
          subCategoryId: subCategory.id
        },
        defaults: {
          name: drinkData.name,
          description: drinkData.description,
          price: lowestPrice,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          capacity: drinkData.capacity,
          capacityPricing: drinkData.capacityPricing,
          abv: drinkData.abv,
          isAvailable: true,
          isPopular: false,
          isOnOffer: drinkData.isOnOffer || false,
          originalPrice: drinkData.originalPrice || lowestPrice
        }
      });

      if (created) {
        totalCreated++;
        createdDrinks.push(drink);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Drinks imported successfully',
      totalCreated: totalCreated,
      drinks: createdDrinks
    });

  } catch (error) {
    console.error('Error importing drinks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

