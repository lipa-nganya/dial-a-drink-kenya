/**
 * Fix purchase prices: Calculate purchasePrice as selling_price / 0.7
 * This ensures selling price is 70% of purchase price
 */

const db = require('../models');

async function fixPurchasePrices() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    const [drinks] = await db.sequelize.query(`
      SELECT id, name, price, "purchasePrice", "originalPrice"
      FROM drinks
      WHERE price IS NOT NULL AND price > 0
      ORDER BY id
    `);

    console.log(`\n📊 Found ${drinks.length} drinks to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const drink of drinks) {
      const currentPrice = parseFloat(drink.price) || 0;
      const currentPurchasePrice = drink.purchasePrice ? parseFloat(drink.purchasePrice) : null;
      
      // Calculate correct purchase price: selling_price / 0.7
      const correctPurchasePrice = currentPrice / 0.7;
      
      // Round to 2 decimal places
      const roundedPurchasePrice = Math.round(correctPurchasePrice * 100) / 100;
      
      // Check if update is needed
      const needsUpdate = currentPurchasePrice === null || 
                         Math.abs(currentPurchasePrice - roundedPurchasePrice) > 0.01;
      
      if (needsUpdate) {
        // Check for overflow (DECIMAL(10,2) max is 99999999.99)
        if (roundedPurchasePrice > 99999999.99) {
          console.warn(`⚠️  Skipping drink ID ${drink.id} (${drink.name}): Purchase price ${roundedPurchasePrice} exceeds limit`);
          skipped++;
          continue;
        }

        try {
          await db.sequelize.query(`
            UPDATE drinks
            SET "purchasePrice" = :purchasePrice
            WHERE id = :id
          `, {
            replacements: {
              purchasePrice: roundedPurchasePrice.toFixed(2),
              id: drink.id
            }
          });

          console.log(`✅ Updated drink ID ${drink.id}: "${drink.name}"`);
          console.log(`   Selling Price: ${currentPrice.toFixed(2)}`);
          console.log(`   Old Purchase Price: ${currentPurchasePrice !== null ? currentPurchasePrice.toFixed(2) : 'NULL'}`);
          console.log(`   New Purchase Price: ${roundedPurchasePrice.toFixed(2)}`);
          console.log('');
          
          updated++;
        } catch (error) {
          console.error(`❌ Error updating drink ID ${drink.id} (${drink.name}):`, error.message);
          errors++;
        }
      } else {
        skipped++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already correct): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${drinks.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

fixPurchasePrices();
