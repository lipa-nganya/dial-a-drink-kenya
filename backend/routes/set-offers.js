const express = require('express');
const router = express.Router();
const { Drink } = require('../models');

// Set some drinks as offers for testing
router.post('/set-test-offers', async (req, res) => {
  try {
    console.log('Setting test offers...');
    
    // Set a few drinks as offers
    const offersToSet = [
      { id: 1, name: 'Coca Cola', discount: 0.2 }, // 20% off
      { id: 2, name: 'Sprite', discount: 0.15 },  // 15% off
      { id: 3, name: 'Fanta Orange', discount: 0.25 }, // 25% off
      { id: 7, name: 'Smirnoff Vodka', discount: 0.3 }, // 30% off
      { id: 8, name: 'Johnnie Walker Red', discount: 0.2 } // 20% off
    ];

    const results = [];

    for (const offer of offersToSet) {
      const drink = await Drink.findByPk(offer.id);
      if (drink) {
        // Store original price if not already set
        if (!drink.originalPrice) {
          await drink.update({ originalPrice: drink.price });
        }
        
        // Calculate discounted price
        const originalPrice = parseFloat(drink.originalPrice || drink.price);
        const discountedPrice = originalPrice * (1 - offer.discount);
        
        // Update drink to be on offer
        await drink.update({
          isOnOffer: true,
          price: discountedPrice.toFixed(2)
        });
        
        results.push({
          id: drink.id,
          name: drink.name,
          originalPrice: originalPrice,
          discountedPrice: discountedPrice.toFixed(2),
          discount: Math.round(offer.discount * 100)
        });
        
        console.log(`✅ Set ${drink.name} as offer: ${originalPrice} -> ${discountedPrice.toFixed(2)} (${Math.round(offer.discount * 100)}% off)`);
      }
    }

    res.json({
      message: 'Test offers set successfully',
      offers: results
    });
  } catch (error) {
    console.error('Error setting test offers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all offers
router.post('/clear-offers', async (req, res) => {
  try {
    console.log('Clearing all offers...');
    
    const offerDrinks = await Drink.findAll({
      where: { isOnOffer: true }
    });

    for (const drink of offerDrinks) {
      if (drink.originalPrice) {
        await drink.update({
          isOnOffer: false,
          price: drink.originalPrice
        });
      }
    }

    res.json({
      message: 'All offers cleared successfully',
      clearedCount: offerDrinks.length
    });
  } catch (error) {
    console.error('Error clearing offers:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
