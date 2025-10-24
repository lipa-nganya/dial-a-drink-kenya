const db = require('../models');

async function revertOffers() {
  try {
    console.log('Reverting all offers...');
    
    // Get all drinks that are on offer
    const offerDrinks = await db.Drink.findAll({
      where: { isOnOffer: true }
    });

    for (const drink of offerDrinks) {
      if (drink.originalPrice) {
        await drink.update({
          isOnOffer: false,
          price: drink.originalPrice
        });
        console.log(`Reverted ${drink.name}: ${drink.price} -> ${drink.originalPrice}`);
      }
    }

    console.log('All offers reverted successfully!');
  } catch (error) {
    console.error('Error reverting offers:', error);
  } finally {
    process.exit(0);
  }
}

revertOffers();
