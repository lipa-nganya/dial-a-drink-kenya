const { Drink, Category, SubCategory } = require('../models');

async function addAlmaMora() {
  try {
    console.log('Adding Alma Mora Pinot Grigio...');
    
    // Get the Wine category
    const wineCategory = await Category.findOne({ where: { name: 'Wine' } });
    console.log('Wine category:', wineCategory ? wineCategory.name : 'Not found');
    
    // Get the "All Wines" subcategory
    const subCategory = await SubCategory.findOne({ 
      where: { name: 'All Wines', categoryId: wineCategory.id } 
    });
    console.log('All Wines subcategory:', subCategory ? subCategory.name : 'Not found');
    
    // Create the drink
    const drink = await Drink.create({
      name: "Alma Mora Pinot Grigio",
      description: "Alma Mora Pinot Grigio (ABV 12.5%), Argentina",
      price: "2100",
      originalPrice: "2100",
      categoryId: wineCategory.id,
      subCategoryId: subCategory.id,
      capacity: ["750ML"],
      capacityPricing: [
        { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
      ],
      abv: 12.5,
      isAvailable: false, // Sold out on website
      isPopular: false,
      isOnOffer: false,
      image: null
    });
    
    console.log('Successfully added:', drink.name, 'with ID:', drink.id);
    
    // Verify it was added
    const addedDrink = await Drink.findByPk(drink.id, {
      include: ['category', 'subCategory']
    });
    console.log('Verification:', addedDrink ? {
      id: addedDrink.id,
      name: addedDrink.name,
      category: addedDrink.category.name,
      isAvailable: addedDrink.isAvailable
    } : 'Not found');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addAlmaMora();

