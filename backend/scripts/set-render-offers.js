const { Sequelize } = require('sequelize');

// Use the DATABASE_URL environment variable for Render
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function setOffersOnRender() {
  try {
    await sequelize.authenticate();
    console.log('Connection to Render database has been established successfully.');

    // Set a few drinks as offers
    const drinksToOffer = [
      { id: 1, name: 'Coca Cola', discount: 0.2 }, // 20% off
      { id: 2, name: 'Sprite', discount: 0.15 },  // 15% off
      { id: 3, name: 'Fanta Orange', discount: 0.25 }, // 25% off
      { id: 7, name: 'Smirnoff Vodka', discount: 0.3 }, // 30% off
      { id: 8, name: 'Johnnie Walker Red', discount: 0.2 } // 20% off
    ];

    for (const drink of drinksToOffer) {
      // Get current drink data
      const [results] = await sequelize.query(
        `SELECT id, name, price, "originalPrice" FROM drinks WHERE id = ${drink.id}`
      );
      
      if (results.length > 0) {
        const currentDrink = results[0];
        const originalPrice = parseFloat(currentDrink.originalPrice || currentDrink.price);
        const discountedPrice = originalPrice * (1 - drink.discount);
        
        // Update the drink to be on offer
        await sequelize.query(`
          UPDATE drinks 
          SET "isOnOffer" = true, 
              "originalPrice" = ${originalPrice},
              price = ${discountedPrice.toFixed(2)}
          WHERE id = ${drink.id}
        `);
        
        console.log(`✅ Set ${drink.name} as offer: ${originalPrice} -> ${discountedPrice.toFixed(2)} (${Math.round(drink.discount * 100)}% off)`);
      }
    }

    console.log('✅ All offers set successfully on Render database!');
  } catch (error) {
    console.error('❌ Error setting offers:', error);
  } finally {
    await sequelize.close();
  }
}

setOffersOnRender();
