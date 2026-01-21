/**
 * Run the purchase price migration directly
 */

const db = require('./models');
const path = require('path');
const fs = require('fs');

async function runMigration() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    // Check if column already exists
    const [columns] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' AND column_name = 'purchasePrice'
    `);

    if (columns.length > 0) {
      console.log('✅ purchasePrice column already exists');
      
      // Check if we need to populate values
      const [stats] = await db.sequelize.query(`
        SELECT 
          COUNT(*) as total,
          COUNT("purchasePrice") as with_purchase_price
        FROM drinks 
        WHERE price IS NOT NULL AND price > 0
      `);
      
      const total = parseInt(stats[0].total);
      const withPurchasePrice = parseInt(stats[0].with_purchase_price);
      const withoutPurchasePrice = total - withPurchasePrice;
      
      console.log(`\n📊 Purchase Price Statistics:`);
      console.log(`   Total drinks: ${total}`);
      console.log(`   With purchasePrice: ${withPurchasePrice}`);
      console.log(`   Without purchasePrice: ${withoutPurchasePrice}`);
      
      if (withoutPurchasePrice > 0) {
        console.log('\n🔄 Populating missing purchase prices...');
        
        const [drinks] = await db.sequelize.query(`
          SELECT id, name, price, "purchasePrice"
          FROM drinks
          WHERE price IS NOT NULL AND price > 0 AND "purchasePrice" IS NULL
        `);
        
        let updated = 0;
        let skipped = 0;
        
        for (const drink of drinks) {
          const price = parseFloat(drink.price);
          const purchasePrice = price / 0.7;
          const roundedPurchasePrice = Math.round(purchasePrice * 100) / 100;
          
          // Check for overflow
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
            
            updated++;
          } catch (error) {
            console.error(`❌ Error updating drink ID ${drink.id}:`, error.message);
          }
        }
        
        console.log(`\n✅ Updated ${updated} drinks`);
        if (skipped > 0) {
          console.log(`⚠️  Skipped ${skipped} drinks (overflow)`);
        }
      } else {
        console.log('\n✅ All drinks already have purchasePrice set');
      }
    } else {
      console.log('🔄 Adding purchasePrice column...');
      
      // Run the migration
      await db.sequelize.query(`
        ALTER TABLE drinks
        ADD COLUMN "purchasePrice" DECIMAL(10, 2) NULL
        COMMENT 'Purchase/cost price of the inventory item'
      `);
      
      console.log('✅ Column added successfully');
      
      // Now populate purchase prices
      console.log('\n🔄 Populating purchase prices...');
      
      const [drinks] = await db.sequelize.query(`
        SELECT id, name, price
        FROM drinks
        WHERE price IS NOT NULL AND price > 0
      `);
      
      let updated = 0;
      let skipped = 0;
      
      for (const drink of drinks) {
        const price = parseFloat(drink.price);
        const purchasePrice = price / 0.7;
        const roundedPurchasePrice = Math.round(purchasePrice * 100) / 100;
        
        // Check for overflow
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
          
          updated++;
        } catch (error) {
          console.error(`❌ Error updating drink ID ${drink.id}:`, error.message);
        }
      }
      
      console.log(`\n✅ Updated ${updated} drinks`);
      if (skipped > 0) {
        console.log(`⚠️  Skipped ${skipped} drinks (overflow)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

runMigration();
