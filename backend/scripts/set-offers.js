const db = require('../models');

async function setOffers() {
  try {
    console.log('Setting up offers...');
    
    // Get some drinks to set as offers
    const drinks = await db.Drink.findAll({ limit: 3 });
    
    if (drinks.length === 0) {
      console.log('No drinks found. Please seed the database first.');
      return;
    }

    for (const drink of drinks) {
      // Set original price if not set
      if (!drink.originalPrice) {
        drink.originalPrice = drink.price;
        await drink.save();
      }

      // Set as offer with 20% discount
      const originalPrice = Number(drink.originalPrice);
      const discountedPrice = originalPrice * 0.8; // 20% off
      
      await drink.update({
        isOnOffer: true,
        price: discountedPrice.toFixed(2)
      });

      console.log(`Set ${drink.name} as offer: ${originalPrice} -> ${discountedPrice.toFixed(2)}`);
    }

    console.log('Offers set successfully!');
  } catch (error) {
    console.error('Error setting offers:', error);
  } finally {
    process.exit(0);
  }
}

setOffers();
