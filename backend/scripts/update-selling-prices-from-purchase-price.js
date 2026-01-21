// Update selling prices to 70% of purchase price for all inventory items
const { Sequelize } = require('sequelize');
const config = require('../config');
const { getDatabaseConfigName } = require('../utils/envDetection');

const env = getDatabaseConfigName();
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

async function updateSellingPrices() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Get all drinks
    const allDrinks = await sequelize.query(`
      SELECT id, name, "purchasePrice", price 
      FROM drinks 
      WHERE price IS NOT NULL AND price > 0
      ORDER BY id
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n📊 Found ${allDrinks ? allDrinks.length : 0} items total`);
    
    if (!allDrinks || allDrinks.length === 0) {
      console.log('⚠️ No items found. Nothing to update.');
      process.exit(0);
    }
    
    // Separate drinks with and without purchase price
    const drinksWithPurchasePrice = allDrinks.filter(d => d.purchasePrice && parseFloat(d.purchasePrice) > 0);
    const drinksWithoutPurchasePrice = allDrinks.filter(d => !d.purchasePrice || parseFloat(d.purchasePrice) <= 0);
    
    console.log(`   Items with purchase price: ${drinksWithPurchasePrice.length}`);
    console.log(`   Items without purchase price: ${drinksWithoutPurchasePrice.length}`);
    
    let updated = 0;
    let skipped = 0;
    let purchasePriceSet = 0;
    
    // Update items with purchase price: selling price = 70% of purchase price
    for (const drink of drinksWithPurchasePrice) {
      const purchasePrice = parseFloat(drink.purchasePrice);
      const newSellingPrice = (purchasePrice * 0.7).toFixed(2);
      const currentPrice = parseFloat(drink.price);
      
      // Only update if the price is different (to avoid unnecessary updates)
      if (Math.abs(currentPrice - newSellingPrice) > 0.01) {
        await sequelize.query(`
          UPDATE drinks 
          SET price = :newPrice, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = :drinkId
        `, {
          replacements: {
            newPrice: newSellingPrice,
            drinkId: drink.id
          }
        });
        
        console.log(`✅ Updated: ${drink.name} - Purchase: KES ${purchasePrice.toFixed(2)} → Selling: KES ${newSellingPrice} (was KES ${currentPrice.toFixed(2)})`);
        updated++;
      } else {
        console.log(`⏭️  Skipped: ${drink.name} - Already at correct price (KES ${currentPrice.toFixed(2)})`);
        skipped++;
      }
    }
    
    // For items without purchase price: set purchase price = current price / 0.7, then selling price = 70% of that
    // This ensures selling price stays the same but purchase price is set correctly
    // Skip items where calculated purchase price would exceed DECIMAL(10,2) limit (99,999,999.99)
    for (const drink of drinksWithoutPurchasePrice) {
      const currentPrice = parseFloat(drink.price);
      const calculatedPurchasePrice = currentPrice / 0.7;
      
      // Check if calculated purchase price exceeds database limit
      if (calculatedPurchasePrice > 99999999.99) {
        console.log(`⚠️  Skipped: ${drink.name} - Calculated purchase price (KES ${calculatedPurchasePrice.toFixed(2)}) exceeds database limit`);
        skipped++;
        continue;
      }
      
      const purchasePriceStr = calculatedPurchasePrice.toFixed(2);
      
      try {
        await sequelize.query(`
          UPDATE drinks 
          SET "purchasePrice" = :purchasePrice, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = :drinkId
        `, {
          replacements: {
            purchasePrice: purchasePriceStr,
            drinkId: drink.id
          }
        });
        
        console.log(`📝 Set purchase price: ${drink.name} - Purchase: KES ${purchasePriceStr} (from selling: KES ${currentPrice.toFixed(2)})`);
        purchasePriceSet++;
      } catch (error) {
        console.error(`❌ Error updating ${drink.name}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`\n✅ Update complete!`);
    console.log(`   Updated selling prices: ${updated} items`);
    console.log(`   Skipped (already correct): ${skipped} items`);
    console.log(`   Set purchase prices: ${purchasePriceSet} items`);
    console.log(`   Total processed: ${allDrinks.length} items`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during update:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Confirm before running
console.log('⚠️  This script will update selling prices for ALL inventory items with purchase prices.');
console.log('⚠️  Selling price will be set to 70% of purchase price.');
console.log('⚠️  Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  updateSellingPrices();
}, 3000);
