const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

router.post('/add-specific-wines', async (req, res) => {
  try {
    console.log('Adding specific missing wine items...');
    
    // Get the Wine category
    const wineCategory = await Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      return res.status(404).json({ error: 'Wine category not found' });
    }

    // Get the "All Wines" subcategory
    const subCategory = await SubCategory.findOne({ 
      where: { name: 'All Wines', categoryId: wineCategory.id } 
    });
    
    if (!subCategory) {
      return res.status(404).json({ error: 'All Wines subcategory not found' });
    }

    const specificWines = [
      {
        name: "Alma Mora Pinot Grigio",
        description: "Alma Mora Pinot Grigio (ABV 12.5%), Argentina",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 12.5,
        isAvailable: false // Sold out on website
      },
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

    const results = [];

    for (const wine of specificWines) {
      try {
        // Force create without checking for existing
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

        console.log(`Added: ${wine.name} - KES ${wine.price}`);
        results.push({ name: wine.name, status: 'added', id: drink.id });
      } catch (error) {
        console.error(`Error adding ${wine.name}:`, error.message);
        results.push({ name: wine.name, status: 'error', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Specific wine items added',
      results
    });

  } catch (error) {
    console.error('Error adding specific wines:', error);
    res.status(500).json({ error: 'Failed to add specific wine products', details: error.message });
  }
});

module.exports = router;

