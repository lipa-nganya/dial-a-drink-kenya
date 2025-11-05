const { Drink, Category, SubCategory } = require('../models');

async function addRemainingWines() {
  try {
    console.log('Adding remaining missing wine items...');
    
    // Get the Wine category
    const wineCategory = await Category.findOne({ where: { name: 'Wine' } });
    console.log('Wine category:', wineCategory ? wineCategory.name : 'Not found');
    
    // Get the "All Wines" subcategory
    const subCategory = await SubCategory.findOne({ 
      where: { name: 'All Wines', categoryId: wineCategory.id } 
    });
    console.log('All Wines subcategory:', subCategory ? subCategory.name : 'Not found');
    
    const winesToAdd = [
      {
        name: "Choco Secco White wine",
        description: "Choco Secco White wine (ABV 10%), Germany",
        price: 1650,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1650, currentPrice: 1650 }
        ],
        abv: 10.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Brancott Estate Sauvignon Blanc",
        description: "Brancott Estate Sauvignon Blanc (ABV 13%), New Zealand",
        price: 1800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 13.0,
        isAvailable: false // Sold out on website
      }
    ];
    
    for (const wine of winesToAdd) {
      try {
        // Check if already exists
        const existing = await Drink.findOne({
          where: {
            name: wine.name,
            categoryId: wineCategory.id
          }
        });
        
        if (existing) {
          console.log(`Skipping ${wine.name} - already exists`);
          continue;
        }
        
        // Create the drink
        const drink = await Drink.create({
          name: wine.name,
          description: wine.description,
          price: wine.price.toString(),
          originalPrice: wine.price.toString(),
          categoryId: wineCategory.id,
          subCategoryId: subCategory.id,
          capacity: wine.capacity,
          capacityPricing: wine.capacityPricing,
          abv: wine.abv,
          isAvailable: wine.isAvailable,
          isPopular: false,
          isOnOffer: false,
          image: null
        });
        
        console.log(`Successfully added: ${wine.name} with ID: ${drink.id}`);
      } catch (error) {
        console.error(`Error adding ${wine.name}:`, error.message);
      }
    }
    
    console.log('Completed adding remaining wine items');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addRemainingWines();

